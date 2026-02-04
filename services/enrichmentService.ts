
import { GoogleGenAI } from "@google/genai";
import { detectBusinessPersona, BusinessPersona } from "./microservices/2-intelligence/businessPersonaDetector";
import { enrichMarketContext, MarketContext } from "./microservices/2-intelligence/marketContextEnricher";
import { generateStrategicNarrative } from "./geminiService";
import { ProspectLead, Evidence } from "../types"; 

// ==================== INTERFACES ====================

export interface NewsItem {
  titulo: string;
  resumo: string;
  fonte: string;
  data: string;
  url?: string;
  relevancia: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export interface FuncionariosValidados {
  quantidade: number;
  fonte: 'RAIS' | 'CAGED' | 'NOTICIA' | 'VAGAS' | 'ESTIMATIVA_IA';
  confiabilidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  ano_referencia: string;
  detalhes?: string;
}

export interface CompanyEnrichment {
  resumo: string;
  noticias: NewsItem[];
  faturamento_validado: {
    valor: number;
    fonte: 'RECEITA_FEDERAL' | 'BALANCO' | 'ESTIMATIVA_IA';
    confiabilidade: 'ALTA' | 'MEDIA' | 'BAIXA';
    ultima_atualizacao: string;
    justificativa?: string;
  };
  funcionarios_validados: FuncionariosValidados;
  hectares_corrigidos?: number;
  timestamp: number;
}

// ==================== CONFIGURAÇÃO ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Modelos Válidos (Série 2.5 - Stable 2026)
const MODEL_FAST = 'gemini-2.5-flash'; 

// Prompt de Bloqueio de Conversa (Injeção de Sistema)
const SYSTEM_PROMPT_JSON_ONLY = `
VOCÊ É UMA API STRICT JSON. VOCÊ NÃO FALA. VOCÊ NÃO EXPLICA.
- Se a informação não for encontrada, retorne null, 0 ou array vazio nos campos.
- JAMAIS retorne texto plano, markdown fora do JSON ou explicações.
- Output OBRIGATÓRIO: Apenas o objeto JSON.
`;

// ==================== HELPER: JSON PARSER ====================

function parseGeminiJsonResponse(text: string): any {
  let cleaned = text.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('Gemini Parse Warn: Recuperando JSON parcial...');
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
        try { return JSON.parse(match[0]); } catch(e) { return {}; }
    }
    throw new Error('Resposta da IA não está em formato JSON válido');
  }
}

// ==================== CACHE MANAGER ====================

function getCachedEnrichment(cnpj: string): CompanyEnrichment | null {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cacheKey = `enrichment_v15_${cleanCnpj}`; 
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const data = JSON.parse(cached) as CompanyEnrichment;
      const ageMinutes = (Date.now() - data.timestamp) / 1000 / 60;
      if (ageMinutes < 1440) return data;
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }
  return null;
}

function setCachedEnrichment(cnpj: string, data: CompanyEnrichment): void {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cacheKey = `enrichment_v15_${cleanCnpj}`;
  localStorage.setItem(cacheKey, JSON.stringify(data));
}

export function clearEnrichmentCache(cnpj: string): void {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cacheKey = `enrichment_v15_${cleanCnpj}`;
  localStorage.removeItem(cacheKey);
}

// ==================== SEARCH & AI FUNCTIONS ====================

async function searchCompanyNews(razaoSocial: string, cnpj: string): Promise<NewsItem[]> {
  const prompt = `
    ${SYSTEM_PROMPT_JSON_ONLY}
    ATUE COMO: Analista de Inteligência de Mercado Agro.
    TAREFA: Buscar notícias RECENTES (últimos 18 meses) sobre a empresa.
    EMPRESA: "${razaoSocial}" (CNPJ: ${cnpj})
    
    FORMATO OBRIGATÓRIO (JSON puro): { "noticias": [{ "titulo": "...", "resumo": "...", "fonte": "...", "data": "...", "url": "...", "relevancia": "ALTA" }] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST, 
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }], // Google Search ativado
        // responseMimeType REMOVIDO para evitar conflito
      }
    });

    const result = parseGeminiJsonResponse(response.text || '{"noticias": []}');
    return result.noticias || [];
  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    return [];
  }
}

async function validateRevenue(razaoSocial: string, cnpj: string, capitalSocial: number): Promise<CompanyEnrichment['faturamento_validado']> {
  const prompt = `
    ${SYSTEM_PROMPT_JSON_ONLY}
    ATUE COMO: Auditor Financeiro.
    TAREFA: Estimar o Faturamento Anual Bruto com base em dados financeiros e heurística de mercado.
    DADOS: Empresa: ${razaoSocial}, CNPJ: ${cnpj}, Capital: R$ ${capitalSocial.toLocaleString('pt-BR')}
    
    RETORNE APENAS O JSON: { "valor": number, "fonte": "ESTIMATIVA_IA", "confiabilidade": "MEDIA", "ano_referencia": "2025", "justificativa": "..." }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST, 
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json" // OK: Sem tools
      }
    });

    const result = parseGeminiJsonResponse(response.text || '{}');
    if (!result.valor) {
        return {
            valor: capitalSocial * 5.0, 
            fonte: 'ESTIMATIVA_IA',
            confiabilidade: 'BAIXA',
            ultima_atualizacao: new Date().getFullYear().toString(),
            justificativa: 'Estimativa baseada em multiplicador de Capital Social (Fallback).'
        };
    }
    return {
      valor: result.valor,
      fonte: result.fonte || 'ESTIMATIVA_IA',
      confiabilidade: result.confiabilidade || 'MEDIA',
      ultima_atualizacao: result.ano_referencia || 'N/D',
      justificativa: result.justificativa
    };
  } catch (error) {
    console.error("Erro ao validar faturamento:", error);
    return {
      valor: capitalSocial * 5, 
      fonte: 'ESTIMATIVA_IA',
      confiabilidade: 'BAIXA',
      ultima_atualizacao: 'N/D',
      justificativa: 'Erro na conexão IA. Estimativa padrão aplicada.'
    };
  }
}

async function validateEmployeeCount(razaoSocial: string, cnpj: string, hectares: number, capitalSocial: number): Promise<FuncionariosValidados> {
  const prompt = `
    ${SYSTEM_PROMPT_JSON_ONLY}
    TAREFA: Validar número REAL de funcionários de empresa agropecuária.
    EMPRESA: ${razaoSocial}, CNPJ: ${cnpj}
    
    FORMATO OBRIGATÓRIO (JSON puro): { "quantidade_funcionarios": number, "fonte": "...", "confiabilidade": "...", "ano_referencia": "...", "detalhes": "..." }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }], // Google Search ativado
        // responseMimeType REMOVIDO
      }
    });

    const data = parseGeminiJsonResponse(response.text || '{}');
    return {
      quantidade: data.quantidade_funcionarios || estimateFuncionarios(hectares),
      fonte: data.fonte || 'ESTIMATIVA_IA',
      confiabilidade: data.confiabilidade || 'MEDIA',
      ano_referencia: data.ano_referencia || new Date().getFullYear().toString(),
      detalhes: data.detalhes || 'Estimativa baseada em porte da operação'
    };
  } catch (error) {
    console.error('Erro validação funcionários:', error);
    return {
      quantidade: estimateFuncionarios(hectares),
      fonte: 'ESTIMATIVA_IA',
      confiabilidade: 'BAIXA',
      ano_referencia: new Date().getFullYear().toString(),
      detalhes: 'Estimativa baseada em média setor (Fallback)'
    };
  }
}

function estimateFuncionarios(hectares: number): number {
  if (hectares === 0) return 10;
  const estimate = Math.floor(hectares / 70);
  return Math.max(5, Math.min(estimate, 800));
}

function extrairHectaresDasNoticias(noticias: NewsItem[]): number {
  for (const noticia of noticias) {
    const texto = `${noticia.titulo} ${noticia.resumo}`.toLowerCase();
    const patterns = [
      /(\d{1,3}(?:[.,]\d{3})*)\s*(?:mil|thousand)?\s*(?:hectares|ha)/gi,
      /(\d{1,3})\.(\d{3})\s*(?:hectares|ha)/gi,
      /(\d{1,3})k\s*(?:hectares|ha)/gi
    ];
    for (const pattern of patterns) {
      const match = texto.match(pattern);
      if (match) {
        let numero = match[0].replace(/[^\d.,k]/gi, '');
        if (numero.includes('k')) { return parseFloat(numero.replace('k', '')) * 1000; }
        numero = numero.replace(/\./g, '').replace(',', '.');
        const hectares = parseFloat(numero);
        if (hectares >= 1000) { return Math.round(hectares); }
      }
    }
  }
  return 0;
}

// ==================== ENGINE DE FATOS ====================

interface ExtractedFacts {
  origin: {
    story: string | null;
    isCooperativeBased: boolean;
    cooperativeDetails: string | null;
  };
  products: {
    rawMaterials: string[];
    mainProducts: string[];
    byProducts: string[];
  };
  location: {
    isStrategic: boolean;
    relevance: string | null;
  };
  triggers: {
    recent: Array<{ category: string; title: string; date: string | null }>;
  };
}

function extractKeyFacts(lead: ProspectLead, evidences: Evidence[]): ExtractedFacts {
  const allText = evidences.map(e => (e.text || '') + ' ' + (e.snippet || '')).join(' ').toLowerCase();
  
  const mainProducts: string[] = [];
  const byProducts: string[] = [];
  const rawMaterials: string[] = [];
  
  if (allText.includes('milho')) rawMaterials.push('milho');
  if (allText.includes('cana')) rawMaterials.push('cana-de-açúcar');
  if (allText.includes('soja')) rawMaterials.push('soja');
  if (allText.includes('algodão') || allText.includes('pluma')) rawMaterials.push('algodão');
  
  const cnae = lead.cnaes?.[0]?.description?.toLowerCase() || '';
  if (cnae.includes('etanol') || cnae.includes('álcool') || allText.includes('etanol')) mainProducts.push('etanol');
  if (cnae.includes('açúcar') || allText.includes('açúcar')) mainProducts.push('açúcar');
  if (cnae.includes('biodiesel') || allText.includes('biodiesel')) mainProducts.push('biodiesel');
  if (cnae.includes('semente') || allText.includes('semente')) mainProducts.push('sementes certificadas');
  
  if (allText.includes('ddgs') || allText.includes('ddg')) byProducts.push('DDGS (nutrição animal)');
  if (allText.includes('energia elétrica') || allText.includes('cogeração') || allText.includes('bioeletricidade')) byProducts.push('bioenergia');
  
  let originStory = null;
  const cooperativeMatch = allText.match(/(\d+)\s*famílias|união de.*produtores|cooperados.*fundaram|nasceu.*cooperativa|grupo.*familiar/i);
  
  let isStrategic = false;
  let locationRelevance = null;
  const uf = lead.uf?.toUpperCase() || '';
  
  if (uf === 'MT' && (rawMaterials.includes('milho') || mainProducts.includes('etanol'))) {
    isStrategic = true;
    locationRelevance = 'no coração da produção de milho de segunda safra (safrinha)';
  } else if (uf === 'MS') {
    isStrategic = true;
    locationRelevance = 'em hub logístico estratégico';
  } else if (uf === 'BA') {
    isStrategic = true;
    locationRelevance = 'na região do Matopiba (fronteira agrícola)';
  }
  
  const recentTriggers = (lead.tacticalAnalysis?.temporalTrace || [])
    .filter(t => {
      const dateMs = new Date(t.date).getTime();
      const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000); 
      return !isNaN(dateMs) && dateMs > sixMonthsAgo;
    })
    .slice(0, 3)
    .map(t => ({ category: t.category, title: t.title, date: t.date }));
  
  return {
    origin: {
      story: originStory,
      isCooperativeBased: lead.companyName.toUpperCase().includes('COOP') || cooperativeMatch !== null,
      cooperativeDetails: originStory
    },
    products: {
      rawMaterials: [...new Set(rawMaterials)], 
      mainProducts: [...new Set(mainProducts)],
      byProducts: [...new Set(byProducts)]
    },
    location: {
      isStrategic,
      relevance: locationRelevance
    },
    triggers: {
      recent: recentTriggers
    }
  };
}

async function generateExecutiveSummary(lead: ProspectLead, persona: BusinessPersona, marketContext: MarketContext, evidences: Evidence[]): Promise<string> {
  const facts = extractKeyFacts(lead, evidences);
  let solucaoAgro = "GAtec (Gestão Agrícola)";
  let solucaoBackoffice = "Senior ERP (Backoffice e Fiscal)";
  let solucaoPessoas = "HCM (Gestão de Pessoas)";
  let contextoFit = "";

  if (persona.primaryRole === 'INDUSTRIA_PROCESSADORA' || persona.primaryRole === 'VERTICALIZADA' || persona.primaryRole === 'COOPERATIVA') {
      solucaoAgro = "GAtec (MANDATÓRIO: Originação, Pesagem, Laboratório, Custos Industriais)";
      contextoFit = "Integração Campo-Indústria (Rastreabilidade Total)";
  } else if (persona.primaryRole === 'PRODUTOR') {
      solucaoAgro = "GAtec (Safra, Frota, Custo por Talhão)";
      contextoFit = "Profissionalização da Gestão (Porteira para Dentro)";
  }

  const contextPayload = {
    empresa: {
      nome: lead.companyName,
      cidade: lead.city,
      estado: lead.uf,
      capital_social: lead.capitalSocial,
      funcionarios: lead.numFuncionarios || 0,
      origem_cooperativa: facts.origin.isCooperativeBased
    },
    persona: {
      tipo: persona.primaryRole,
      hectares_reais: persona.realHectares || 0,
      propriedade: persona.ownership
    },
    operacao: {
      entradas: facts.products.rawMaterials,
      saidas: facts.products.mainProducts,
      coprodutos: facts.products.byProducts,
      contexto_local: facts.location.relevance
    },
    inteligencia_mercado: {
      vertical: marketContext.vertical,
      dores_tipicas: marketContext.typicalPainPoints,
      estrutura_decisao: marketContext.decisionStructure.type,
      gatilho_compra: marketContext.decisionStructure.buyingTrigger
    },
    sinais_recentes: facts.triggers.recent.map(t => t.title),
    solucoes_senior_recomendadas: {
      gestao_agroindustrial: solucaoAgro,
      backoffice: solucaoBackoffice,
      rh: solucaoPessoas,
      tese_venda: contextoFit
    }
  };

  const narrative = await generateStrategicNarrative(contextPayload);
  return narrative;
}

export async function enrichCompanyData(
  razaoSocial: string,
  cnpj: string,
  capitalSocial: number,
  hectares: number,
  natureza: string,
  cultura: string,
  qsa: Array<{ nome: string; qualificacao: string }>,
  location: { state: string; city: string },
  onProgress?: (msg: string) => void
): Promise<CompanyEnrichment> {
  const cached = getCachedEnrichment(cnpj);
  if (cached) {
    onProgress?.('Dados recuperados do cache.');
    return cached;
  }

  onProgress?.('Consultando fontes oficiais, notícias e balanços...');
  try {
    const [noticias, faturamento, funcionarios] = await Promise.all([
      searchCompanyNews(razaoSocial, cnpj),
      validateRevenue(razaoSocial, cnpj, capitalSocial),
      validateEmployeeCount(razaoSocial, cnpj, hectares, capitalSocial)
    ]);

    let hectaresCorrigidos = hectares;
    if (funcionarios.quantidade >= 50 && hectares < 500) {
        const hectaresEstimados = funcionarios.quantidade * 70;
        hectaresCorrigidos = Math.max(hectaresCorrigidos, hectaresEstimados);
    }
    const hectaresNoticia = extrairHectaresDasNoticias(noticias);
    if (hectaresNoticia > hectaresCorrigidos) {
        hectaresCorrigidos = hectaresNoticia;
    }

    const personaInput = {
      cnpj,
      razaoSocial,
      cnaePrincipal: cultura,
      cnaesSecundarios: [],
      qsa: qsa || [],
      hectaresCadastrais: hectaresCorrigidos,
      capitalSocial: capitalSocial,
      uf: location.state
    };
    
    const persona = await detectBusinessPersona(personaInput);
    const enrichmentInput = {
      persona,
      capitalSocial,
      cnaePrincipal: cultura,
      location: location,
      faturamentoEstimado: faturamento.valor
    };
    
    const marketContext = enrichMarketContext(enrichmentInput);

    onProgress?.('Gerando análise estratégica Sara AI...');
    const tempLead: ProspectLead = {
        id: 'temp_enrich',
        companyName: razaoSocial,
        cnpj: cnpj,
        capitalSocial: capitalSocial,
        city: location.city,
        uf: location.state,
        cnaes: [{ code: '', description: cultura, persona: 'PRODUTOR' }],
        numFuncionarios: funcionarios.quantidade,
        isValidated: true,
        isSA: natureza.toUpperCase().includes('S.A'),
        isMatriz: true,
        contactType: 'Direto',
        activityCount: 1,
        priority: 50,
        businessType: persona.primaryRole,
        confidence: persona.confidence * 100,
        tacticalAnalysis: {
            verticalizationScore: 50,
            badges: [],
            salesComplexity: 'CONSULTIVA/SUCESSAO',
            goldenHook: '',
            temporalTrace: noticias.map((n, i) => ({
                id: String(i),
                title: n.titulo,
                date: n.data,
                category: 'GERAL',
                url: n.url || '',
                source: n.fonte
            })),
            rawEvidences: noticias.map(n => ({
                sourceName: n.fonte,
                url: n.url || '',
                title: n.titulo,
                snippet: n.resumo
            }))
        }
    };

    const evidenceList: Evidence[] = noticias.map((n, i) => ({
        id: `news-${i}`,
        title: n.titulo,
        text: n.resumo,
        snippet: n.resumo,
        url: n.url || '',
        category: 'Notícia',
        selected: true,
        recommendation: 'MANTER',
        source: n.fonte,
        type: 'web'
    }));

    const resumo = await generateExecutiveSummary(tempLead, persona, marketContext, evidenceList);

    const enrichment: CompanyEnrichment = {
      resumo,
      noticias,
      faturamento_validado: faturamento,
      funcionarios_validados: funcionarios,
      hectares_corrigidos: hectaresCorrigidos,
      timestamp: Date.now()
    };

    setCachedEnrichment(cnpj, enrichment);
    return enrichment;

  } catch (error) {
    console.error("Erro fatal no enriquecimento:", error);
    throw error;
  }
}
