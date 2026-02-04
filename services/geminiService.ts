
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AccountData, Evidence, FitCriteria, RadarResult, CostInfo, GroundingMetadata, SpiderGraph, SpiderNode, SpiderEdge, DossierUpdate, DossierPlanSection, TemporalEvent, ProspectLead } from "../types";
import { calculateCost } from "./costService";
import { sanitizePII } from "./apiService";
import { generateStrategySectionMarkdown } from "./strategyService";
import { getGlobalCache, setGlobalCache } from "./storageService";

// --- NOVOS SERVIÇOS DE OTIMIZAÇÃO ---
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
  // Utiliza o novo sistema de cache robusto (L1 RAM + L2 Disk)
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
        // Prioridade MEDIUM pois é uma ação que pode esperar alguns segundos se a fila estiver cheia
        const response = await queuedGeminiCall<GenerateContentResponse>(
          () => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: "application/json"
            }
          }),
          'MEDIUM'
        );

        const text = response.text;
        if (!text) return null;
        
        const data = JSON.parse(text);
        return data.cnpj || null;
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
  
  // Usamos o cachedFetch ao invés do getGlobalCache antigo
  return cachedFetch(
    cacheKey,
    async () => {
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
        // Prioridade HIGH pois o usuário está esperando este texto aparecer no modal
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

// --- TEMPORAL TRACE (Rastro Temporal) ---

export const fetchTemporalTrace = async (name: string, city: string, uf: string, addLog?: any): Promise<{ trace: TemporalEvent[], costInfo: CostInfo }> => {
  const cacheKey = `temporal_${name}_${city}`;
  
  // Utiliza o novo wrapper com fila e cache integrado
  const result = await callGeminiWithFallback<TemporalEvent[]>(
    async (model) => {
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
      const trace = result.map((e: any, i: number) => ({ ...e, id: `temp-${Date.now()}-${i}` }));
      return { result: trace, usage: response.usageMetadata, modelUsed: model };
    }, 
    'fetchTemporalTrace', 
    addLog,
    { 
      priority: 'MEDIUM',
      cacheKey,
      cacheTTL: CACHE_TTL
    }
  );

  return { trace: result.data, costInfo: result.costInfo };
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
  
  // Utiliza o novo wrapper com fila e cache integrado
  const result = await callGeminiWithFallback<Evidence[]>(
    async (modelName) => {
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

      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${prompt}\n\nCONSULTE ESTAS VARIAÇÕES:\n${queries.join('\n')}`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const rawEvidence: any[] = JSON.parse(response.text || "[]");
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

      return {
        result: evidence,
        usage: response.usageMetadata,
        modelUsed: modelName
      };
    }, 
    'searchEvidence', 
    addLog,
    {
      priority: 'HIGH', // Evidência é o coração do produto
      cacheKey,
      cacheTTL: CACHE_TTL
    }
  );

  return { evidence: result.data, costInfo: result.costInfo };
};

export async function analyzeGraphRelationships(rootNode: SpiderNode, account: AccountData, addLog?: any) {
    const ai = getAiClient();
    const prompt = `Analise grupo econômico para ${account.companyName}`;
    
    // Agora usando o novo wrapper
    return callGeminiWithFallback<any>(
      async (model) => {
        const resp = await ai.models.generateContent({ model, contents: prompt, config: { tools: [{googleSearch:{}}], responseMimeType: "application/json" }});
        return { result: JSON.parse(resp.text || '{"nodes":[], "edges":[]}'), usage: resp.usageMetadata, modelUsed: model };
      }, 
      'graph', 
      addLog,
      { priority: 'MEDIUM' } // Sem cacheKey, pois grafos são dinâmicos na sessão
    );
}

export async function findSimilarAccounts(current: AccountData, criteria: FitCriteria) {
    const ai = getAiClient();
    const prompt = `Encontre empresas similares a ${current.companyName}`;
    
    return callGeminiWithFallback<any>(
      async (model) => {
        const resp = await ai.models.generateContent({ model, contents: prompt, config: { tools: [{googleSearch:{}}], responseMimeType: "application/json" }});
        return { result: JSON.parse(resp.text || '{"accounts":[]}'), usage: resp.usageMetadata, modelUsed: model };
      }, 
      'similar', 
      undefined,
      { priority: 'LOW' } // Similaridade é "nice to have", prioridade baixa
    );
}

export async function generateDossierPlan(account: AccountData, count: number, addLog?: any) {
    const ai = getAiClient();
    // Wrap direto com fila, sem cache complexo
    const resp = await queuedGeminiCall<GenerateContentResponse>(() => ai.models.generateContent({ 
        model: MODELS.FALLBACK, 
        contents: `Crie plano para dossiê de ${account.companyName}`, 
        config: { responseMimeType: "application/json" }
    }), 'MEDIUM');
    
    return { plan: JSON.parse(resp.text || "[]"), costInfo: calculateCost(MODELS.FALLBACK, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0) };
}

export async function generateDossierSection(section: DossierPlanSection, account: AccountData, digest: string) {
    const ai = getAiClient();
    // Wrap direto com fila
    const resp = await queuedGeminiCall<GenerateContentResponse>(() => ai.models.generateContent({ 
        model: MODELS.PRIMARY, 
        contents: `Escreva seção ${section.title} para ${account.companyName} usando: ${digest}` 
    }), 'MEDIUM');

    return { markdown: resp.text || "", costInfo: calculateCost(MODELS.PRIMARY, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0) };
}

export async function askDossierSmart(content: string, account: AccountData, q: string, addLog?: any) {
    const ai = getAiClient();
    // Wrap direto com fila, prioridade alta pois é chat interativo
    const resp = await queuedGeminiCall<GenerateContentResponse>(() => ai.models.generateContent({ 
        model: MODELS.PRIMARY, 
        contents: `Responda sobre ${account.companyName}: ${q} com base no dossiê: ${content}`, 
        config: { tools: [{googleSearch:{}}] }
    }), 'HIGH');

    return { 
        answer: resp.text || "", 
        costInfo: calculateCost(MODELS.PRIMARY, resp.usageMetadata?.promptTokenCount||0, resp.usageMetadata?.candidatesTokenCount||0), 
        groundingMetadata: resp.candidates?.[0]?.groundingMetadata,
        dossierUpdate: undefined as DossierUpdate | undefined
    };
}

/**
 * BUSCA DE DADOS CADASTRAIS REAIS (HECTARES, FUNCIONÁRIOS, SÓCIOS)
 * Usa o modelo para inferir dados baseados em conhecimento público ou snippets.
 */
export const searchRealData = async (lead: ProspectLead): Promise<{ 
  hectares: number, 
  funcionarios: number, 
  socios: string[], 
  grupo: string, 
  resumo: string,
  fonte: string 
}> => {
  const cacheKey = `real_data_v2_${lead.cnpj.replace(/\D/g, '')}`;
  
  // Utiliza o novo cachedFetch
  return cachedFetch(
    cacheKey,
    async () => {
      const ai = getAiClient();
      const cnaeText = lead.cnaes?.map(c => c.description).join(', ').substring(0, 1000) || '';
      const isHolding = lead.companyName.toUpperCase().includes('HOLDING') || lead.companyName.toUpperCase().includes('PARTICIPACOES') || lead.companyName.toUpperCase().includes('INVESTIMENTOS');

      const prompt = `
        Atue como um analista de inteligência de mercado do Agronegócio Brasileiro (Senior Scout).
        Alvo: ${lead.companyName} (CNPJ: ${lead.cnpj})
        Cidade: ${lead.city}/${lead.uf}
        Atividade: ${cnaeText}

        Busque em sua base de conhecimento E NA WEB (notícias, relatórios, LinkedIn, dados públicos) por fatos sobre esta empresa.
        ${isHolding ? 'ATENÇÃO: Esta empresa parece ser uma HOLDING. Tente mapear o Grupo Econômico e suas controladas.' : ''}

        Retorne estritamente um JSON com:
        1. "hectares": number (estimativa real de área plantada/própria, 0 se não achar)
        2. "funcionarios": number (vínculos estimados, 0 se não achar)
        3. "socios": array de strings (nomes dos principais sócios ou família controladora)
        4. "grupo": string (Nome do Grupo Econômico se identificado, ou "N/D")
        5. "resumo": string (breve resumo da operação e estrutura, máx 200 caracteres)
        6. "fonte": string (origem principal da informação, ex: LinkedIn, Relatório Sustentabilidade)

        Regras Rígidas:
        - NÃO INVENTE DADOS. Se não souber, retorne 0 ou "N/D".
        - Para sócios, busque por "Família X", "Irmãos Y" ou nomes listados em QSA público.
        - Se for Holding, explique no resumo quem ela controla.
      `;

      try {
        // Enfileira a chamada
        const response = await queuedGeminiCall<GenerateContentResponse>(
          () => ai.models.generateContent({
            model: MODELS.PRIMARY, // Usando o modelo Pro para melhor pesquisa
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: "application/json"
            }
          }),
          'MEDIUM'
        );

        const text = response.text;
        if (!text) return { hectares: 0, funcionarios: 0, socios: [], grupo: "N/D", resumo: "Sem dados", fonte: "IA" };

        const result = JSON.parse(text);
        
        return {
          hectares: typeof result.hectares === 'number' ? result.hectares : 0,
          funcionarios: typeof result.funcionarios === 'number' ? result.funcionarios : 0,
          socios: Array.isArray(result.socios) ? result.socios : [],
          grupo: result.grupo || "N/D",
          resumo: result.resumo || "",
          fonte: result.fonte || "Estimativa IA"
        };

      } catch (error) {
        console.error("Erro na busca real Gemini:", error);
        return { hectares: 0, funcionarios: 0, socios: [], grupo: "N/D", resumo: "Erro na conexão IA", fonte: "Erro" };
      }
    },
    {
      ttl: CACHE_TTL,
      tags: [`real_data_${lead.cnpj}`]
    }
  );
};
