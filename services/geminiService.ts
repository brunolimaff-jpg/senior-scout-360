
import { GoogleGenAI, Type } from "@google/genai";
import { AccountData, Evidence, FitCriteria, RadarResult, CostInfo, GroundingMetadata, SpiderGraph, SpiderNode, SpiderEdge, DossierUpdate, DossierPlanSection, TemporalEvent, ProspectLead } from "../types";
import { calculateCost } from "./costService";
import { sanitizePII } from "./apiService";
import { generateStrategySectionMarkdown } from "./strategyService";
import { getGlobalCache, setGlobalCache } from "./storageService";

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Horas

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  return new GoogleGenAI({ apiKey });
};

const MODELS = {
  PRIMARY: 'gemini-3-pro-preview',
  FALLBACK: 'gemini-3-flash-preview',
  FAST: 'gemini-3-flash-preview' // Usado para briefings rápidos
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithFallback<T>(
  operation: (model: string) => Promise<{ result: any, usage: any, modelUsed: string, groundingMetadata?: any }>,
  functionName: string,
  addLog?: (msg: string, type: any) => void
): Promise<{ data: T, costInfo: CostInfo, groundingMetadata?: GroundingMetadata }> {
  
  const attemptRequest = async (model: string, attempt: number = 1): Promise<any> => {
    try {
      const { result, usage, modelUsed, groundingMetadata } = await operation(model);
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
}

// --- NAME TO CNPJ DISCOVERY ---
export const findCnpjByName = async (name: string, ufContext: string = ''): Promise<string | null> => {
  const cacheKey = `cnpj_search_${name}_${ufContext}`;
  const cached = getGlobalCache(cacheKey);
  if (cached) return cached;

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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;
    
    const data = JSON.parse(text);
    const cnpj = data.cnpj;
    
    if (cnpj) {
      setGlobalCache(cacheKey, cnpj);
    }
    return cnpj;
  } catch (e) {
    console.error("CNPJ Lookup Error:", e);
    return null;
  }
};

// --- FLASH BRIEFING (SALES PITCH) ---
export const generateFlashBriefing = async (lead: ProspectLead): Promise<string> => {
  const cacheKey = `briefing_${lead.id}_${lead.cnpj}`;
  const cached = getGlobalCache(cacheKey, CACHE_TTL);
  if (cached) return cached;

  const ai = getAiClient();
  
  // Sanitização para evitar erro de JSON string
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
    const response = await ai.models.generateContent({
      model: MODELS.FAST,
      contents: prompt,
    });
    
    const text = response.text || "Não foi possível gerar o briefing no momento.";
    setGlobalCache(cacheKey, text);
    return text;
  } catch (e) {
    console.error("Erro Flash Briefing:", e);
    return "Briefing indisponível (Erro de conexão IA).";
  }
};

// --- TEMPORAL TRACE (Rastro Temporal) ---

export const fetchTemporalTrace = async (name: string, city: string, uf: string, addLog?: any): Promise<{ trace: TemporalEvent[], costInfo: CostInfo }> => {
  const cacheKey = `temporal_${name}_${city}`;
  const cached = getGlobalCache(cacheKey, CACHE_TTL);
  if (cached) return { trace: cached, costInfo: { model: 'cache', inputTokens: 0, outputTokens: 0, totalCost: 0 }};

  const ai = getAiClient();
  const lastName = name.split(' ').pop();
  
  const prompt = `
    ATUE COMO: Investigador de Rastro Temporal (Corporativo/Agro).
    ALVO: "${name}" em "${city}-${uf}".
    
    TAREFA: Encontre eventos relevantes dos últimos 3 ANOS (2022, 2023, 2024).
    
    DORKS PARA BUSCA:
    1. "${name}" multa after:2022
    2. "${name}" (expansão OR aquisição OR investimento) after:2023
    3. "${name}" vaga (TI OR contábil) after:2024
    4. "${city}" (licitação OR edital) "${lastName}" after:2022
    5. "${name}" certificação after:2023

    EXTRAÇÃO:
    - Evento (Título claro e curto)
    - Data (Ano ou Data completa)
    - Categoria (MULTA, EXPANSAO, VAGA, EDITAL, CERTIFICACAO, GERAL)
    - URL da fonte
    - Fonte (Nome amigável)

    RETORNO: JSON Array ordenado por data descendente.
  `;

  const { data, costInfo } = await callGeminiWithFallback<TemporalEvent[]>(async (model) => {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              date: { type: Type.STRING },
              category: { type: Type.STRING, enum: ["MULTA", "EXPANSAO", "VAGA", "EDITAL", "CERTIFICACAO", "GERAL"] },
              url: { type: Type.STRING },
              source: { type: Type.STRING }
            },
            required: ["title", "date", "category", "url", "source"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return { result, usage: response.usageMetadata, modelUsed: model };
  }, 'fetchTemporalTrace', addLog);

  const trace = data.map((e, i) => ({ ...e, id: `temp-${Date.now()}-${i}` }));
  setGlobalCache(cacheKey, trace);
  return { trace, costInfo };
};

// --- QUERY EXPANSION & SYNONYMS ---

export async function buildQueryVariants(account: AccountData): Promise<string[]> {
  const base = [
    `"${account.companyName}" ${account.municipality}`,
    `"${account.companyName}" tecnologia agro`,
    `"${account.companyName}" investimentos expansão`,
    `"${account.companyName}" processo jurídico dívida`,
  ];
  return base;
}

// --- EVIDENCE SEARCH (STRICT PILLARS) ---

export const searchEvidence = async (account: AccountData, addLog?: (msg: string, type: any) => void): Promise<{ evidence: Evidence[], costInfo: CostInfo }> => {
  const cacheKey = `evidence_${account.cnpj || account.companyName}_${account.municipality}`;
  const cached = getGlobalCache(cacheKey, CACHE_TTL);
  if (cached) {
    if (addLog) addLog("Sara: Evidências estratégicas recuperadas do cache (24h).", 'success');
    return cached;
  }

  const ai = getAiClient();
  const queries = await buildQueryVariants(account);
  
  const prompt = `
  ATUE COMO: Analista de Inteligência Competitiva Sênior.
  ALVO: "${account.companyName}" (${account.municipality}-${account.uf}).
  
  MISSÃO: Encontre de 15 a 20 sinais vitais divididos nestes 4 pilares:
  1. EXPANSÃO: Novas unidades, silos, frotas, contratações em massa ou planos de investimento.
  2. TECNOLOGIA: Softwares usados (ERP, CRM), vagas que pedem conhecimento em sistemas, automação no campo.
  3. FINANCEIRO: Faturamentos citados, capital social, saúde de crédito, aportes de sócios ou exportações.
  4. JURÍDICO/RISCO: Recuperação judicial, multas ambientais pesadas, passivos trabalhistas ou disputas societárias.

  REGRAS:
  - Seja analítico: Não apenas cite o fato, explique por que é um sinal tático para venda.
  - Extraia a URL exata da fonte.
  - Retorne APENAS o JSON no formato solicitado.

  OUTPUT SCHEMA:
  [
    {
      "title": "Título Curto",
      "text": "Análise do fato e seu impacto tático (max 250 chars)",
      "url": "URL da fonte",
      "category": "Expansão" | "Tecnologia" | "Financeiro" | "Jurídico",
      "recommendation": "MANTER" | "DESCARTE"
    }
  ]
  `;

  const { data, costInfo } = await callGeminiWithFallback<any>(async (modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${prompt}\n\nCONSULTE ESTAS VARIAÇÕES:\n${queries.join('\n')}`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    return {
      result: JSON.parse(response.text || "[]"),
      usage: response.usageMetadata,
      modelUsed: modelName
    };
  }, 'searchEvidence', addLog);

  const rawEvidence: any[] = Array.isArray(data) ? data : [];
  
  const evidence = rawEvidence.map((e, idx) => ({
    id: `ev-${Date.now()}-${idx}`,
    title: sanitizePII(e.title),
    text: sanitizePII(e.text),
    snippet: sanitizePII(e.text),
    url: e.url,
    category: e.category,
    selected: e.recommendation === 'MANTER',
    recommendation: e.recommendation,
    source: new URL(e.url || 'http://google.com').hostname.replace('www.', ''),
    type: 'web' as const
  }));

  const result = { evidence, costInfo };
  setGlobalCache(cacheKey, result);
  return result;
};

export async function analyzeGraphRelationships(rootNode: SpiderNode, account: AccountData, addLog?: any) {
    const ai = getAiClient();
    const prompt = `Analise grupo econômico para ${account.companyName}`;
    const { data, costInfo } = await callGeminiWithFallback<any>(async (model) => {
        const resp = await ai.models.generateContent({ model, contents: prompt, config: { tools: [{googleSearch:{}}], responseMimeType: "application/json" }});
        return { result: JSON.parse(resp.text || '{"nodes":[], "edges":[]}'), usage: resp.usageMetadata, modelUsed: model };
    }, 'graph', addLog);
    return { ...data, costInfo };
}

export async function findSimilarAccounts(current: AccountData, criteria: FitCriteria) {
    const ai = getAiClient();
    const prompt = `Encontre empresas similares a ${current.companyName}`;
    const { data, costInfo } = await callGeminiWithFallback<any>(async (model) => {
        const resp = await ai.models.generateContent({ model, contents: prompt, config: { tools: [{googleSearch:{}}], responseMimeType: "application/json" }});
        return { result: JSON.parse(resp.text || '{"accounts":[]}'), usage: resp.usageMetadata, modelUsed: model };
    }, 'similar', undefined);
    return { result: data, costInfo };
}

export async function generateDossierPlan(account: AccountData, count: number, addLog?: any) {
    const ai = getAiClient();
    const resp = await ai.models.generateContent({ model: MODELS.FALLBACK, contents: `Crie plano para dossiê de ${account.companyName}`, config: { responseMimeType: "application/json" }});
    return { plan: JSON.parse(resp.text || "[]"), costInfo: calculateCost(MODELS.FALLBACK, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0) };
}

export async function generateDossierSection(section: DossierPlanSection, account: AccountData, digest: string) {
    const ai = getAiClient();
    const resp = await ai.models.generateContent({ model: MODELS.PRIMARY, contents: `Escreva seção ${section.title} para ${account.companyName} usando: ${digest}` });
    return { markdown: resp.text || "", costInfo: calculateCost(MODELS.PRIMARY, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0) };
}

export async function askDossierSmart(content: string, account: AccountData, q: string, addLog?: any) {
    const ai = getAiClient();
    const resp = await ai.models.generateContent({ 
        model: MODELS.PRIMARY, 
        contents: `Responda sobre ${account.companyName}: ${q} com base no dossiê: ${content}`, 
        config: { tools: [{googleSearch:{}}] }
    });
    return { 
        answer: resp.text || "", 
        costInfo: calculateCost(MODELS.PRIMARY, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0), 
        groundingMetadata: resp.candidates?.[0]?.groundingMetadata,
        dossierUpdate: undefined as DossierUpdate | undefined
    };
}
