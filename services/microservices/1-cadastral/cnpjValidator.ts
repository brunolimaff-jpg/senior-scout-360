// src/services/microservices/1-cadastral/cnpjValidator.ts

import { GoogleGenAI } from "@google/genai";
import { 
  MicroserviceResult, 
  CNPJValidationResult, 
  OrchestrationContext 
} from '../types/microserviceTypes';

/**
 * MICRO-SERVIÇO: CNPJ VALIDATOR
 * Responsabilidade: Consultar BrasilAPI e validar CNPJ
 * Fallback: Gemini AI com Google Search se API falhar
 */

// Função auxiliar para limpar CNPJ
function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

// Função auxiliar para formatar CNPJ
function formatCNPJ(cnpj: string): string {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) return cnpj;
  return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`;
}

// Validação básica de formato CNPJ
function isValidCNPJFormat(cnpj: string): boolean {
  const clean = cleanCNPJ(cnpj);
  return clean.length === 14 && /^\d+$/.test(clean);
}

// Helper para parsear JSON do Gemini
function parseGeminiJSON(text: string): any {
  let cleanText = text.trim();
  const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/```\s*([\s\S]*?)\s*```/);
  if (jsonMatch) cleanText = jsonMatch[1];
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    try {
       const firstOpen = cleanText.indexOf('{');
       const lastClose = cleanText.lastIndexOf('}');
       if (firstOpen !== -1 && lastClose > firstOpen) {
          return JSON.parse(cleanText.substring(firstOpen, lastClose + 1));
       }
    } catch (e2) { /* ignore */ }
    throw e;
  }
}

// Helper para fetch com retry interno
async function fetchWithRetry(url: string, signal: AbortSignal, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { 
        signal,
        headers: { 'Accept': 'application/json' }
      });
      
      // Se for 429 (Rate Limit) ou 5xx (Server Error), lança erro para retentar
      if (response.status === 429 || response.status >= 500) {
         throw new Error(`HTTP Error ${response.status}`);
      }
      
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err; // Não retenta se abortado pelo usuário
      if (i === retries - 1) throw err; // Lança na última tentativa
      
      // Exponential backoff: 1s, 2s, 4s...
      const delay = 1000 * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Network error');
}

// Fallback: Consulta via Gemini (Google Search)
async function fetchCNPJViaGemini(cnpj: string, logs: string[]): Promise<CNPJValidationResult> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key não encontrada para fallback.");

  logs.push('🤖 Iniciando Fallback IA (Gemini Search)...');
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';

  const prompt = `
    Atue como um auditor de dados cadastrais.
    Pesquise na web informações ATUALIZADAS sobre a empresa com CNPJ: ${cnpj}
    
    Retorne um JSON estrito com os dados encontrados:
    {
      "razao_social": "Nome oficial",
      "nome_fantasia": "Nome fantasia ou null",
      "situacao_cadastral": "ATIVA", "BAIXADA" ou "INAPTA",
      "data_abertura": "dd/mm/aaaa" ou "N/D",
      "capital_social": número (ex: 100000) ou 0,
      "natureza_juridica": "Ex: Sociedade Empresária Limitada",
      "cnae_principal": "Descrição da atividade",
      "endereco": {
        "logradouro": "...", "numero": "...", "bairro": "...", 
        "municipio": "...", "uf": "...", "cep": "..."
      },
      "qsa": [
        { "nome": "Nome Sócio", "qualificacao": "Sócio-Administrador" }
      ]
    }
    
    Priorize fontes como: Receita Federal, Casa dos Dados, Econodata, CNPJ.biz.
    SEJA PRECISO.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.1,
      tools: [{googleSearch: {}}]
    }
  });

  const data = parseGeminiJSON(response.text || "{}");
  
  if (!data.razao_social) throw new Error("IA não conseguiu estruturar dados do CNPJ.");

  return {
    status: data.situacao_cadastral || 'ATIVA',
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia,
    capitalSocial: typeof data.capital_social === 'number' ? data.capital_social : 0,
    qsa: Array.isArray(data.qsa) ? data.qsa : [],
    naturezaJuridica: data.natureza_juridica || 'N/D',
    dataAbertura: data.data_abertura || 'N/D',
    cnae: data.cnae_principal || 'N/D',
    endereco: data.endereco
  };
}

// Função principal do micro-serviço
export async function validateCNPJ(
  context: OrchestrationContext
): Promise<MicroserviceResult<CNPJValidationResult>> {
  
  const startTime = Date.now();
  const logs: string[] = [];
  const sources: string[] = [];

  try {
    // 1. VALIDAÇÃO DE FORMATO
    logs.push('🔍 Validando formato do CNPJ...');
    context.onProgress('cnpjValidator', '🔍 Validando formato do CNPJ...');

    if (!isValidCNPJFormat(context.cnpj)) {
      logs.push('❌ CNPJ inválido (formato incorreto)');
      return {
        status: 'failed',
        data: null,
        error: 'CNPJ inválido - deve ter 14 dígitos',
        duration: Date.now() - startTime,
        logs,
        confidence: 0,
        sources: [],
        timestamp: Date.now()
      };
    }

    const cleanedCNPJ = cleanCNPJ(context.cnpj);
    logs.push(`✅ Formato válido: ${formatCNPJ(cleanedCNPJ)}`);

    // 2. TENTATIVA 1: CONSULTAR BRASILAPI
    logs.push('🌐 Consultando BrasilAPI (Receita Federal)...');
    context.onProgress('cnpjValidator', '🌐 Consultando BrasilAPI...');

    const url = `https://brasilapi.com.br/api/cnpj/v1/${cleanedCNPJ}`;
    sources.push(url);

    let result: CNPJValidationResult;
    let confidence = 100;

    try {
      const response = await fetchWithRetry(url, context.abortController.signal, 3);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('CNPJ não encontrado na base pública (404)');
        }
        throw new Error(`BrasilAPI status ${response.status}`);
      }

      const data = await response.json();
      
      // Mapeamento BrasilAPI -> CNPJValidationResult
      result = {
        status: data.descricao_situacao_cadastral || data.situacao_cadastral || 'DESCONHECIDA',
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || undefined,
        capitalSocial: parseFloat(data.capital_social || '0'),
        qsa: (data.qsa || []).map((socio: any) => ({
          nome: socio.nome_socio || socio.nome,
          qualificacao: socio.qualificacao_socio || socio.qualificacao || 'N/D',
          participacao: socio.percentual_capital ? parseFloat(socio.percentual_capital) : undefined,
          cnpjCpf: socio.cnpj_cpf_do_socio || socio.cpf_cnpj_socio || undefined
        })),
        naturezaJuridica: data.natureza_juridica || data.codigo_natureza_juridica || 'N/D',
        dataAbertura: data.data_inicio_atividade || data.data_abertura || 'N/D',
        cnae: data.cnae_fiscal_descricao || data.cnae_fiscal || 'N/D',
        endereco: data.logradouro ? {
          logradouro: data.logradouro,
          numero: data.numero || 'S/N',
          complemento: data.complemento || undefined,
          bairro: data.bairro,
          municipio: data.municipio,
          uf: data.uf,
          cep: data.cep
        } : undefined
      };
      
      logs.push(`✅ Dados oficiais recuperados com sucesso.`);

    } catch (apiError: any) {
      // 3. FALLBACK: GEMINI SEARCH
      logs.push(`⚠️ BrasilAPI falhou: ${apiError.message}`);
      logs.push('🛡️ Ativando contingência: Busca Inteligente (Gemini)...');
      context.onProgress('cnpjValidator', '🛡️ Ativando Fallback IA...');

      try {
        result = await fetchCNPJViaGemini(cleanedCNPJ, logs);
        confidence = 85; // Menor confiança pois é extraído de busca web
        sources.push("Google Search (Fallback IA)");
        logs.push('✅ Dados recuperados via Inteligência Artificial');
      } catch (geminiError: any) {
        // Se ambos falharem, lança o erro original da API ou do Gemini
        throw new Error(`Falha total (API + Fallback): ${geminiError.message}`);
      }
    }

    // 4. LOGS FINAIS E RETORNO
    if (result.status === 'ATIVA') {
      context.onProgress('cnpjValidator', `✅ Empresa ATIVA: ${result.razaoSocial}`);
    } else {
      context.onProgress('cnpjValidator', `⚠️ Empresa ${result.status}`);
    }

    logs.push(`📊 Capital Social: R$ ${result.capitalSocial.toLocaleString('pt-BR')}`);
    logs.push(`👥 Quadro Societário: ${result.qsa.length} sócio(s)`);

    const duration = Date.now() - startTime;
    logs.push(`⏱️ Concluído em ${duration}ms`);

    return {
      status: 'completed',
      data: result,
      error: null,
      duration,
      logs,
      confidence,
      sources,
      timestamp: Date.now()
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      logs.push('🛑 Operação cancelada');
      return {
        status: 'failed',
        data: null,
        error: 'Operação cancelada',
        duration,
        logs,
        confidence: 0,
        sources,
        timestamp: Date.now()
      };
    }

    logs.push(`❌ Erro fatal: ${error.message}`);
    context.onError('cnpjValidator', error.message);

    return {
      status: 'failed',
      data: null,
      error: error.message,
      duration,
      logs,
      confidence: 0,
      sources,
      timestamp: Date.now()
    };
  }
}