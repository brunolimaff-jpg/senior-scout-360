
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  CostInfo, 
  GroundingMetadata, 
  ProspectLead, 
  TemporalEvent, 
  AccountData, 
  Evidence, 
  SpiderNode, 
  FitCriteria, 
  DossierPlanSection, 
  DossierUpdate 
} from "../types";
import { calculateCost } from "./costService";
import { sanitizePII } from "./apiService";
import { queuedGeminiCall, Priority } from "./requestQueueService";
import { cachedFetch } from "./advancedCacheService";

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Horas

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  return new GoogleGenAI({ apiKey });
};

const MODELS = {
  PRIMARY: 'gemini-2.5-pro',
  FALLBACK: 'gemini-2.5-flash',
  FAST: 'gemini-2.5-flash' // Usado para briefings rápidos
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função Helper para limpar e parsear JSON (Substitui responseMimeType quando usamos tools)
function cleanAndParseJSON(text: string): any {
  // Remove marcadores de código markdown se existirem (```json ... ```)
  const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch (error) {
    console.warn("Gemini: Tentando recuperar JSON malformado...");
    // Tenta extrair apenas o objeto/array se houver texto em volta
    const match = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            console.error("Falha irrecuperável no parse JSON:", cleanText);
            return null;
        }
    }
    return null; 
  }
}

// Opções para controle refinado de Cache e Fila
export interface GeminiRequestOptions {
  priority?: Priority;
  cacheKey?: string;
  cacheTTL?: number;
  cacheTags?: string[];
}

async function callGeminiWithFallback<T>(
  operation: (model: string) => Promise<{ result: any, usage: any, modelUsed: string, groundingMetadata?: any }>,
  functionName: string,
  addLog?: (msg: string, type: any) => void,
  options: GeminiRequestOptions = {} // Novo parâmetro de opções
): Promise<{ data: T, costInfo: CostInfo, groundingMetadata?: GroundingMetadata }> {
  
  // Função que executa a lógica de retry e fallback
  const executeLogic = async () => {
    const attemptRequest = async (model: string, attempt: number = 1): Promise<any> => {
      try {
        // Enfileira a requisição para respeitar rate limit do Gemini (15 RPM free tier)
        // Se a fila estiver cheia, o sistema aguarda automaticamente
        const { result, usage, modelUsed, groundingMetadata } = await queuedGeminiCall(
          () => operation(model), 
          options.priority || 'MEDIUM'
        );

        const costInfo = calculateCost(modelUsed, usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0);
        return { data: result, costInfo, groundingMetadata };
      } catch (error: any) {
        const errorMessage = error.message?.toLowerCase() || '';
        
        const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota');
        const isServerError = errorMessage.includes('500') || errorMessage.includes('internal error') || errorMessage.includes('503') || errorMessage.includes('504');

        if (isServerError && attempt < 2) {
          if (addLog) addLog(`Sara: Instabilidade no servidor Google. Retentativa ${attempt}...`, 'warning');
          await delay(1500);
          return attemptRequest(model, attempt + 1);
        }

        if ((isQuotaError || isServerError) && model === MODELS.PRIMARY) {
          if (addLog) addLog(`Sara: Alternando para motor de contingência (Flash) devido a erro de rede.`, 'warning');
          await delay(1000);
          return attemptRequest(MODELS.FALLBACK, 1);
        }
        throw error;
      }
    };

    return attemptRequest(MODELS.PRIMARY);
  };

  // Se houver chave de cache, envolvemos a execução no AdvancedCacheService
  if (options.cacheKey) {
    return cachedFetch(
      options.cacheKey,
      executeLogic,
      {
        ttl: options.cacheTTL || CACHE_TTL,
        tags: options.cacheTags || [functionName]
      }
    );
  }

  // Se não, executa direto (mas ainda passando pela fila interna)
  return executeLogic();
}

// --- NAME TO CNPJ DISCOVERY ---
export const findCnpjByName = async (name: string, ufContext: string = ''): Promise<string | null> => {
  const cacheKey = `cnpj_search_${name}_${ufContext}`;
  
  // Cache de 7 dias porque dados cadastrais mudam pouco
  return cachedFetch(
    cacheKey,
    async () => {
      const ai = getAiClient();
      const prompt = `
        ATUE COMO: Investigador de Dados Corporativos.
        TAREFA: Encontrar o CNPJ da empresa "${name}"${ufContext ? ` localizada em ${ufContext}` : ''}.
        
        1. Use o Google Search para encontrar o site oficial ou registros em sites como CNPJ.biz, Econodata, Casa dos Dados.
        2. Identifique o CNPJ da MATRIZ (prioridade) ou Filial principal.
        3. Retorne APENAS o JSON abaixo.

        { "cnpj": "XX.XXX.XXX/0001-XX" }
        
        Se não encontrar com certeza, retorne { "cnpj": null }.
      `;

      try {
        const response = await queuedGeminiCall<GenerateContentResponse>(
          () => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              // responseMimeType REMOVIDO para suportar tools
            }
          }),
          'MEDIUM'
        );

        const text = response.text || "{}";
        const data = cleanAndParseJSON(text); // Sanitizer manual
        return data?.cnpj || null;
      } catch (e) {
        console.error("CNPJ Lookup Error:", e);
        return null;
      }
    },
    {
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 dias
      tags: [`company_${name}`, `uf_${ufContext}`, 'cadastral']
    }
  );
};

// --- FLASH BRIEFING (SALES PITCH) ---
export const generateFlashBriefing = async (lead: ProspectLead): Promise<string> => {
  const cacheKey = `briefing_${lead.id}_${lead.cnpj}`;
  
  return cachedFetch(
    cacheKey,
    async () => {
      const ai = getAiClient();
      const companyName = sanitizePII(lead.companyName).substring(0, 100);
      const cnaes = lead.cnaes?.map(c => c.description).join(', ').substring(0, 300) || "Agronegócio Geral";
      const city = lead.city || "Região não informada";

      const prompt = `
        Gere um briefing de vendas ultra-conciso (máx 150 palavras) para a empresa ${companyName} (${city}).
        Atividade Econômica (CNAE): ${cnaes}.
        
        FOQUE EM:
        1. Principais atividades produtivas (O que eles fazem?)
        2. Presença regional (Onde atuam?)
        3. Prováveis dores tecnológicas (Ex: gestão de safra, logística, RH, fiscal).
        
        Use tom profissional, direto e executivo. Use bullet points para facilitar leitura rápida.
        Não invente dados, baseie-se na atividade econômica.
      `;

      try {
        const response = await queuedGeminiCall<GenerateContentResponse>(
          () => ai.models.generateContent({
            model: MODELS.FAST,
            contents: prompt,
          }),
          'HIGH'
        );
        
        return response.text || "Não foi possível gerar o briefing no momento.";
      } catch (e) {
        console.error("Erro Flash Briefing:", e);
        return "Briefing indisponível (Erro de conexão IA).";
      }
    },
    { ttl: CACHE_TTL, tags: [`lead_${lead.id}`] }
  );
};

// --- SARA ANALYST: REDAÇÃO ESTRATÉGICA (WRITER AGENT) ---
export const generateStrategicNarrative = async (contextPayload: any): Promise<string> => {
  const ai = getAiClient();
  
  const systemPrompt = `
    VOCÊ É: Sara, Analista Sênior de Inteligência de Vendas (Agro).
    SUA MISSÃO: Escrever um briefing estratégico ("off-the-record") para um Executivo de Contas da Senior Sistemas.
    
    O QUE VOCÊ VAI RECEBER: Um JSON com dados brutos da empresa (Faturamento, Cultura, Verticalização, Notícias).
    O QUE VOCÊ DEVE ENTREGAR: 4 BLOCOS de texto distintos, escritos em PROSA FLUIDA, DIRETA e ANALÍTICA.
    
    REGRAS DE TOM E ESTILO:
    1. ZERO CORPORATÊS: Não use frases vazias.
    2. REALPOLITIK: Fale da verdade nua e crua.
    3. CAUSA & EFEITO: Conecte os dados.
    4. ESPECIFICIDADE: Use os números do JSON.

    REGRAS DE OURO DO PORTFÓLIO:
    - Agroindústria: Venda GAtec (Originação/Indústria) + ERP (Backoffice).
    - Produtor: Venda GAtec (Campo) + ERP (Fiscal).

    SAÍDA STRICT (RÍGIDA):
    1. NÃO use Introduções ("Aqui está...", "Com base nos dados...").
    2. NÃO use Títulos Markdown (como '# Seção 1: Perfil').
    3. Retorne OBRIGATORIAMENTE 4 blocos de texto separados pela string delimitadora '|||'.
    
    ESTRUTURA EXATA DA RESPOSTA:
    [Texto do Perfil e Mercado] ||| [Texto da Complexidade Operacional e Dores] ||| [Texto da Proposta de Valor / Fit Senior] ||| [Texto dos Insights de Ataque e Abordagem]
  `;

  try {
    const response = await queuedGeminiCall<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: MODELS.PRIMARY, 
        contents: `CONTEXTO DO CLIENTE (JSON): ${JSON.stringify(contextPayload)}`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3
        }
      }),
      'HIGH'
    );

    const rawText = response.text || "";
    // Limpeza de segurança caso o modelo seja "educado" demais no início
    const cleanText = rawText.replace(/^Ok.*?briefing\./i, '').trim();
    
    // Validação básica: se não tiver separador, o frontend vai falhar, então tentamos um fallback
    if (!cleanText.includes('|||')) {
        console.warn("Gemini não retornou separadores |||. Retornando texto bruto.");
        return cleanText;
    }

    return cleanText;
  } catch (error) {
    console.error("Erro no Writer Agent:", error);
    return "Erro ao gerar narrativa. Utilize os dados brutos nos cards ao lado.";
  }
};

// --- TEMPORAL TRACE (Rastro Temporal) ---
export const fetchTemporalTrace = async (name: string, city: string, uf: string, addLog?: any): Promise<{ trace: TemporalEvent[], costInfo: CostInfo }> => {
  const cacheKey = `temporal_${name}_${city}`;
  
  const result = await callGeminiWithFallback<TemporalEvent[]>(
    async (model) => {
      const ai = getAiClient();
      const prompt = `
        ATUE COMO: Investigador de Rastro Temporal (Corporativo/Agro).
        ALVO: "${name}" em "${city}-${uf}".
        TAREFA: Encontre eventos relevantes dos últimos 3 ANOS.
        
        RETORNE JSON:
        [
          { "title": "...", "date": "YYYY-MM-DD", "url": "...", "source": "...", "category": "MULTA|EXPANSAO|VAGA|EDITAL|CERTIFICACAO|GERAL" }
        ]
      `;
      
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            // responseMimeType REMOVIDO
        }
      });
      
      const text = response.text || "[]";
      const result = cleanAndParseJSON(text); // Sanitizer
      const trace = Array.isArray(result) ? result.map((e: any, i: number) => ({ ...e, id: `temp-${Date.now()}-${i}` })) : [];
      return { result: trace, usage: response.usageMetadata, modelUsed: model };
    }, 
    'fetchTemporalTrace', 
    addLog,
    { priority: 'MEDIUM', cacheKey, cacheTTL: CACHE_TTL }
  );
  return { trace: result.data, costInfo: result.costInfo };
};

export async function buildQueryVariants(account: AccountData): Promise<string[]> {
  return [
    `"${account.companyName}" ${account.municipality}`,
    `"${account.companyName}" tecnologia agro`,
    `"${account.companyName}" investimentos expansão`,
    `"${account.companyName}" processo jurídico dívida`
  ];
}

export const searchEvidence = async (account: AccountData, addLog?: (msg: string, type: any) => void): Promise<{ evidence: Evidence[], costInfo: CostInfo }> => {
    const cacheKey = `evidence_${account.cnpj || account.companyName}_${account.municipality}`;
    const result = await callGeminiWithFallback<Evidence[]>(
    async (modelName) => {
      const ai = getAiClient();
      const queries = await buildQueryVariants(account);
      const prompt = `ATUE COMO: Analista de Inteligência Competitiva Sênior. ALVO: "${account.companyName}". Retorne JSON com evidências: [{title, text, url, category, recommendation}]`;
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${prompt}\n\nCONSULTE ESTAS VARIAÇÕES:\n${queries.join('\n')}`,
        config: { 
            tools: [{ googleSearch: {} }],
            // responseMimeType REMOVIDO
        }
      });
      
      const rawEvidence: any[] = cleanAndParseJSON(response.text || "[]") || [];
      const evidence = rawEvidence.map((e, idx) => ({
        id: `ev-${Date.now()}-${idx}`,
        title: e.title || "Evidência encontrada",
        text: e.text || "",
        snippet: e.snippet || e.text || "",
        url: e.url || "",
        source: e.source || "Web",
        type: 'web' as const,
        category: e.category || 'Geral',
        selected: e.recommendation === 'MANTER',
        recommendation: e.recommendation || 'NEUTRO'
      }));
      return { result: evidence, usage: response.usageMetadata, modelUsed: modelName };
    }, 'searchEvidence', addLog, { priority: 'HIGH', cacheKey, cacheTTL: CACHE_TTL }
  );
  return { evidence: result.data, costInfo: result.costInfo };
};

export async function analyzeGraphRelationships(rootNode: SpiderNode, account: AccountData, addLog?: any) {
    return callGeminiWithFallback<any>(async (model) => {
        const ai = getAiClient();
        const resp = await ai.models.generateContent({ 
            model, 
            contents: `Analise grupo econômico para ${account.companyName}. Retorne JSON {nodes:[], edges:[]}`, 
            config: { 
                tools: [{googleSearch:{}}],
                // responseMimeType REMOVIDO
            }
        });
        return { result: cleanAndParseJSON(resp.text || '{}'), usage: resp.usageMetadata, modelUsed: model };
    }, 'graph', addLog, { priority: 'MEDIUM' });
}

export async function findSimilarAccounts(current: AccountData, criteria: FitCriteria) {
    return callGeminiWithFallback<any>(async (model) => {
        const ai = getAiClient();
        const resp = await ai.models.generateContent({ 
            model, 
            contents: `Encontre empresas similares a ${current.companyName}. Retorne JSON {accounts:[]}`, 
            config: { 
                tools: [{googleSearch:{}}],
                // responseMimeType REMOVIDO
            }
        });
        return { result: cleanAndParseJSON(resp.text || '{}'), usage: resp.usageMetadata, modelUsed: model };
    }, 'similar', undefined, { priority: 'LOW' });
}

export async function generateDossierPlan(account: AccountData, count: number, addLog?: any) {
    const ai = getAiClient();
    const resp = await queuedGeminiCall<GenerateContentResponse>(() => ai.models.generateContent({ 
        model: MODELS.FALLBACK, 
        contents: `Crie plano para dossiê de ${account.companyName}. Retorne JSON.`, 
        config: { responseMimeType: "application/json" } // OK: Sem tools
    }), 'MEDIUM');
    return { plan: JSON.parse(resp.text || "[]"), costInfo: calculateCost(MODELS.FALLBACK, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0) };
}

export async function generateDossierSection(section: DossierPlanSection, account: AccountData, digest: string) {
    const ai = getAiClient();
    const resp = await queuedGeminiCall<GenerateContentResponse>(() => ai.models.generateContent({ 
        model: MODELS.PRIMARY, 
        contents: `Escreva seção ${section.title} para ${account.companyName} usando: ${digest}` 
    }), 'MEDIUM');
    return { markdown: resp.text || "", costInfo: calculateCost(MODELS.PRIMARY, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0) };
}

export async function askDossierSmart(content: string, account: AccountData, q: string, addLog?: any) {
    const ai = getAiClient();
    const resp = await queuedGeminiCall<GenerateContentResponse>(() => ai.models.generateContent({ 
        model: MODELS.PRIMARY, 
        contents: `Responda sobre ${account.companyName}: ${q} com base no dossiê: ${content}`, 
        config: { tools: [{googleSearch:{}}] } // responseMimeType não definido, OK
    }), 'HIGH');
    return { 
        answer: resp.text || "", 
        costInfo: calculateCost(MODELS.PRIMARY, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0), 
        groundingMetadata: resp.candidates?.[0]?.groundingMetadata,
        dossierUpdate: undefined as DossierUpdate | undefined
    };
}

export const searchRealData = async (lead: ProspectLead): Promise<{ 
  hectares: number, funcionarios: number, socios: string[], grupo: string, resumo: string, fonte: string 
}> => {
  const cacheKey = `real_data_v2_${lead.cnpj.replace(/\D/g, '')}`;
  return cachedFetch(
    cacheKey,
    async () => {
      const ai = getAiClient();
      const cnaeText = lead.cnaes?.map(c => c.description).join(', ').substring(0, 1000) || '';
      const prompt = `Atue como um analista de inteligência... Alvo: ${lead.companyName}... Retorne JSON: {hectares, funcionarios, socios, grupo, resumo, fonte}`;
      
      const response = await queuedGeminiCall<GenerateContentResponse>(
          () => ai.models.generateContent({
            model: MODELS.PRIMARY,
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }], 
                // responseMimeType REMOVIDO
            }
          }),
          'MEDIUM'
      );
      
      const result = cleanAndParseJSON(response.text || "{}") || {};
      
      return {
          hectares: typeof result.hectares === 'number' ? result.hectares : 0,
          funcionarios: typeof result.funcionarios === 'number' ? result.funcionarios : 0,
          socios: Array.isArray(result.socios) ? result.socios : [],
          grupo: result.grupo || "N/D",
          resumo: result.resumo || "",
          fonte: result.fonte || "Estimativa IA"
      };
    },
    { ttl: CACHE_TTL, tags: [`real_data_${lead.cnpj}`] }
  );
};
