
import { GoogleGenAI } from "@google/genai";

// ==================== INTERFACES ====================

export interface SocioDetalhado {
  nome: string;
  cargo: string;
  cpf?: string;
  empresas_vinculadas?: EmpresaVinculada[];
  isExpanded?: boolean;
  isLoading?: boolean;
  // Campos para controle de erro e retry
  hasError?: boolean;
  errorMessage?: string;
  retryCount?: number;
}

export interface EmpresaVinculada {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  cargo_socio: string;  // Sócio, Administrador, Presidente, etc
  participacao?: string;  // Ex: "50%", "Sócio Majoritário"
  situacao: 'ATIVA' | 'BAIXADA' | 'SUSPENSA' | 'INAPTA';
  atividade_principal?: string;
  capital_social?: number;
  data_abertura?: string;
  fonte: 'RECEITA_FEDERAL' | 'GOOGLE_SEARCH' | 'INFERENCIA';
}

// ==================== CONFIGURAÇÃO ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
// Modelo rápido e capaz de raciocínio estruturado
const MAPPING_MODEL = 'gemini-2.5-flash'; 

// ==================== HELPER: JSON PARSER ====================

function parseGeminiJsonResponse(text: string): any {
  let cleaned = text.trim();
  
  // Remover markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ Falha ao parsear JSON:', cleaned);
    throw new Error('Resposta da IA não está em formato JSON válido');
  }
}

// ==================== CACHE MANAGER ====================

function getCachedSocioEmpresas(nomeSocio: string): EmpresaVinculada[] | null {
  const cacheKey = `socio_map_v1_${nomeSocio.toLowerCase().replace(/\s+/g, '_')}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const data = JSON.parse(cached);
      const ageHours = (Date.now() - data.timestamp) / 1000 / 60 / 60;
      
      // Cache válido por 7 dias
      if (ageHours < 24 * 7) {
        return data.empresas;
      }
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }
  
  return null;
}

function setCachedSocioEmpresas(nomeSocio: string, empresas: EmpresaVinculada[]): void {
  const cacheKey = `socio_map_v1_${nomeSocio.toLowerCase().replace(/\s+/g, '_')}`;
  localStorage.setItem(cacheKey, JSON.stringify({
    empresas,
    timestamp: Date.now()
  }));
}

/**
 * Retry com exponential backoff
 * @param fn Função assíncrona a ser executada
 * @param maxRetries Número máximo de tentativas (padrão: 10)
 * @param onRetry Callback executado a cada tentativa (opcional)
 * @returns Promise com resultado da função
 */
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 10,
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`🔄 Tentativa ${attempt}/${maxRetries}...`);
      }
      
      const result = await fn();
      
      return result;
      
    } catch (error: any) {
      lastError = error;
      
      // Erros permanentes: NÃO fazer retry
      const isPermanentError = 
        error.message?.includes('404') ||
        error.message?.includes('not found') ||
        error.message?.includes('invalid model') ||
        error.status === 404;
      
      if (isPermanentError) {
        console.error(`❌ Erro permanente, abortando retries:`, error.message);
        throw error;
      }
      
      // Se ainda há tentativas restantes
      if (attempt < maxRetries) {
        // Calcular delay exponencial: 2^attempt * 500ms, máximo 15s
        // (Tentativas: 1s, 2s, 4s, 8s, 15s, 15s...)
        const baseDelay = Math.pow(2, attempt) * 500;
        const delay = Math.min(baseDelay, 15000);
        
        // Se for rate limit (429), aumentar delay
        const isRateLimit = error.status === 429 || error.message?.includes('429');
        const finalDelay = isRateLimit ? delay * 2 : delay;
        
        console.warn(
          `⚠️ Tentativa ${attempt}/${maxRetries} falhou: ${error.message || 'Erro desconhecido'}`
        );
        
        // Notificar componente sobre retry (para UI feedback)
        if (onRetry) {
          onRetry(attempt, maxRetries, finalDelay);
        }
        
        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, finalDelay));
        
      } else {
        // Última tentativa falhou
        console.error(`❌ Todas as ${maxRetries} tentativas falharam.`);
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  throw lastError || new Error('Falha após todas as tentativas');
}

// ==================== BUSCA PRINCIPAL ====================

export async function mapearEmpresasSocio(
  nomeSocio: string,
  cargoAtual: string,
  cnpjEmpresaAtual: string,
  onRetryUpdate?: (attempt: number, maxRetries: number, delayMs: number) => void
): Promise<EmpresaVinculada[]> {
  
  // Verifica cache
  const cached = getCachedSocioEmpresas(nomeSocio);
  if (cached) return cached;
  
  const prompt = `
TAREFA: Mapear TODAS as empresas onde a pessoa é sócia/administradora.

PESSOA: ${nomeSocio}
Cargo atual conhecido: ${cargoAtual}
CNPJ empresa atual: ${cnpjEmpresaAtual}

FONTES PRIORITÁRIAS (nesta ordem):
1. **Receita Federal - QSA**
2. **Diários Oficiais**
3. **Google Search** (LinkedIn, CNPJ.biz, Econodata)

INSTRUÇÕES:
- Use o Google Search para buscar conexões societárias reais.
- IGNORE empresas BAIXADAS há muito tempo se irrelevantes.
- PRIORIZE empresas ATIVAS do agronegócio.
- Se pessoa tem sobrenome comum em região (ex: Dallastra no RS/SC), verifique se faz parte de grupo familiar.

IMPORTANTE: Retorne APENAS um array JSON válido, SEM texto adicional, SEM markdown.

FORMATO OBRIGATÓRIO (JSON puro):
{
  "empresas": [
    {
      "cnpj": "string (XX.XXX.XXX/XXXX-XX)",
      "razao_social": "string",
      "nome_fantasia": "string | null",
      "cargo_socio": "string (Sócio-Administrador, Diretor, etc)",
      "participacao": "string | null (Ex: 50%, Majoritário)",
      "situacao": "ATIVA|BAIXADA|SUSPENSA|INAPTA",
      "atividade_principal": "string | null",
      "capital_social": number | null,
      "data_abertura": "string (YYYY-MM-DD) | null",
      "fonte": "RECEITA_FEDERAL|GOOGLE_SEARCH|INFERENCIA"
    }
  ]
}

REGRAS:
1. SEMPRE inclua a empresa atual (${cnpjEmpresaAtual}) como primeiro item.
2. Ordene por relevância (Ativas > Baixadas).
3. Mínimo 1 empresa (a atual).

RETORNE APENAS O JSON.
`;

  return retryWithExponentialBackoff(async () => {
    try {
      const response = await ai.models.generateContent({
        model: MAPPING_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
          // responseMimeType removed to avoid conflicts with tools
          maxOutputTokens: 4096,
          tools: [{ googleSearch: {} }] // Habilita pesquisa real
        }
      });

      const data = parseGeminiJsonResponse(response.text || "{}");

      const empresas: EmpresaVinculada[] = data.empresas || [];
      
      // Fallback: Se array vazio, insere a empresa atual manualmente
      if (empresas.length === 0) {
          empresas.push({
              cnpj: cnpjEmpresaAtual,
              razao_social: "Empresa Atual (Dados IA indisponíveis)",
              cargo_socio: cargoAtual,
              situacao: 'ATIVA',
              fonte: 'INFERENCIA'
          });
      } else {
          // Garante que a atual está na lista (fallback de segurança)
          const temAtual = empresas.some(e => e.cnpj.includes(cnpjEmpresaAtual.slice(0,8)));
          if (!temAtual) {
              empresas.unshift({
                  cnpj: cnpjEmpresaAtual,
                  razao_social: "(Empresa Atual)",
                  cargo_socio: cargoAtual,
                  situacao: 'ATIVA',
                  fonte: 'INFERENCIA'
              });
          }
      }
      
      // Salva cache
      setCachedSocioEmpresas(nomeSocio, empresas);
      
      return empresas;
      
    } catch (error: any) {
      console.error('❌ Erro detalhado mapeamento:', {
        nome: nomeSocio,
        error: error.message
      });
      
      // Identificar e tratar tipos de erro comuns para feedback ao usuário
      let errorMessage = 'Erro desconhecido ao buscar dados.';
      
      const errStr = error.message?.toLowerCase() || '';
      
      if (errStr.includes('quota') || errStr.includes('429')) {
        errorMessage = 'Limite de requisições da IA atingido. Aguarde um momento.';
      } else if (errStr.includes('timeout') || errStr.includes('deadline')) {
        errorMessage = 'A busca demorou muito e expirou. Tente novamente.';
      } else if (errStr.includes('network') || errStr.includes('fetch')) {
        errorMessage = 'Erro de conexão com a rede. Verifique sua internet.';
      } else if (errStr.includes('json')) {
        errorMessage = 'Erro ao processar os dados retornados.';
      } else if (errStr.includes('not found') || errStr.includes('404')) {
          errorMessage = 'Modelo de IA não encontrado ou indisponível na região.';
      }
      
      // Lança o erro tratado para o componente lidar
      throw new Error(errorMessage);
    }
  }, 10, onRetryUpdate); // Max 10 retries
}
