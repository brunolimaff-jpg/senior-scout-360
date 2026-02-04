
import { GoogleGenAI } from "@google/genai";
import { detectBusinessPersona, BusinessPersona } from "./microservices/2-intelligence/businessPersonaDetector";
import { enrichMarketContext, MarketContext } from "./microservices/2-intelligence/marketContextEnricher";
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
  resumo: string;                       // Resumo executivo estratégico (Narrativa)
  noticias: NewsItem[];                 // Top 3 notícias
  faturamento_validado: {
    valor: number;                      // R$
    fonte: 'RECEITA_FEDERAL' | 'BALANCO' | 'ESTIMATIVA_IA';
    confiabilidade: 'ALTA' | 'MEDIA' | 'BAIXA';
    ultima_atualizacao: string;         // Data
    justificativa?: string;
  };
  funcionarios_validados: FuncionariosValidados;
  hectares_corrigidos?: number;         // Campo novo para armazenar valor corrigido
  timestamp: number;                    // Cache timestamp
}

// ==================== CONFIGURAÇÃO ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Modelos Válidos (Série 2.5 - Stable 2026)
const MODEL_FAST = 'gemini-2.5-flash'; // Para JSON simples e buscas rápidas
const MODEL_SMART = 'gemini-2.5-pro';  // Para texto complexo e análise financeira

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

function getCachedEnrichment(cnpj: string): CompanyEnrichment | null {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cacheKey = `enrichment_v11_${cleanCnpj}`; // Bumped version for narrative engine (prose)
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const data = JSON.parse(cached) as CompanyEnrichment;
      const ageMinutes = (Date.now() - data.timestamp) / 1000 / 60;
      
      // Cache válido por 24 horas (1440 minutos)
      if (ageMinutes < 1440) {
        return data;
      }
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }
  return null;
}

function setCachedEnrichment(cnpj: string, data: CompanyEnrichment): void {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cacheKey = `enrichment_v11_${cleanCnpj}`;
  localStorage.setItem(cacheKey, JSON.stringify(data));
}

export function clearEnrichmentCache(cnpj: string): void {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cacheKey = `enrichment_v11_${cleanCnpj}`;
  localStorage.removeItem(cacheKey);
}

// ==================== SEARCH & AI FUNCTIONS ====================

async function searchCompanyNews(razaoSocial: string, cnpj: string): Promise<NewsItem[]> {
  const prompt = `
    ATUE COMO: Analista de Inteligência de Mercado Agro.
    TAREFA: Buscar notícias RECENTES (últimos 18 meses) sobre a empresa.
    
    EMPRESA: "${razaoSocial}" (CNPJ: ${cnpj})
    
    INSTRUÇÕES:
    1. Busque por expansões, aquisições, investimentos, resultados financeiros, inauguração de unidades.
    2. IGNORE processos trabalhistas comuns ou diários oficiais irrelevantes.
    3. Retorne no máximo 3 notícias mais impactantes para um vendedor B2B.
    
    FORMATO OBRIGATÓRIO (JSON puro, sem markdown):
    {
      "noticias": [
        {
          "titulo": "Título da manchete",
          "resumo": "Resumo de 1 linha sobre o impacto",
          "fonte": "Nome do veículo (Ex: Valor, G1)",
          "data": "Data aproximada (Ex: Jan/2024)",
          "url": "Link da notícia (se disponível)",
          "relevancia": "ALTA"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST, // Flash é suficiente para busca e formatação JSON
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }] // Habilita Google Search
      }
    });

    const result = parseGeminiJsonResponse(response.text || '{"noticias": []}');
    return result.noticias || [];
  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    return [];
  }
}

async function validateRevenue(
  razaoSocial: string, 
  cnpj: string, 
  capitalSocial: number
): Promise<CompanyEnrichment['faturamento_validado']> {
  
  const prompt = `
    ATUE COMO: Auditor Financeiro.
    TAREFA: Estimar o Faturamento Anual Bruto com base em dados financeiros.
    
    DADOS:
    - Empresa: ${razaoSocial}
    - CNPJ: ${cnpj}
    - Capital Social: R$ ${capitalSocial.toLocaleString('pt-BR')}
    
    RETORNE APENAS O JSON ABAIXO (sem texto adicional, sem markdown, sem explicações):
    {
      "valor": número (em reais),
      "fonte": "ESTIMATIVA_IA",
      "confiabilidade": "ALTA" | "MEDIA" | "BAIXA",
      "ano_referencia": "2025",
      "justificativa": "Explicação curta da origem do dado"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST, // Flash é mais rápido e obedece melhor ao JSON mode
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json" // FORÇA JSON
        // REMOVIDO: tools: [{ googleSearch: {} }] para evitar texto explicativo misturado
      }
    });

    const result = parseGeminiJsonResponse(response.text || '{}');
    
    // Fallback de segurança se a IA falhar em retornar números
    if (!result.valor) {
        return {
            valor: capitalSocial * 5.0, // Estimativa conservadora corrigida para 5x
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
      valor: capitalSocial * 5, // Fallback robusto
      fonte: 'ESTIMATIVA_IA',
      confiabilidade: 'BAIXA',
      ultima_atualizacao: 'N/D',
      justificativa: 'Erro na conexão IA. Estimativa padrão aplicada.'
    };
  }
}

async function validateEmployeeCount(
  razaoSocial: string,
  cnpj: string,
  hectares: number,
  capitalSocial: number
): Promise<FuncionariosValidados> {
  
  const prompt = `
    TAREFA: Validar número REAL de funcionários de empresa agropecuária.
    
    EMPRESA: ${razaoSocial}
    CNPJ: ${cnpj}
    Hectares: ${hectares}
    Capital Social: R$ ${capitalSocial}
    
    FONTES PRIORITÁRIAS:
    1. RAIS/CAGED (Dados Oficiais)
    2. Notícias ("empresa tem X funcionários")
    3. LinkedIn/Glassdoor (Vagas e Insights)
    4. Estimativa baseada em porte (se não houver dados reais)
    
    FORMATO OBRIGATÓRIO (JSON puro, sem markdown):
    {
      "quantidade_funcionarios": number,
      "fonte": "RAIS" | "CAGED" | "NOTICIA" | "VAGAS" | "ESTIMATIVA_IA",
      "confiabilidade": "ALTA" | "MEDIA" | "BAIXA",
      "ano_referencia": "YYYY",
      "detalhes": "explicação curta"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST, // Flash é rápido para extração simples
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }]
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

// ==================== HELPER: EXTRAIR HECTARES ====================

function extrairHectaresDasNoticias(noticias: NewsItem[]): number {
  for (const noticia of noticias) {
    const texto = `${noticia.titulo} ${noticia.resumo}`.toLowerCase();
    
    // Regex: busca padrões como "77.000 hectares", "77 mil ha", "77k hectares"
    const patterns = [
      /(\d{1,3}(?:[.,]\d{3})*)\s*(?:mil|thousand)?\s*(?:hectares|ha)/gi,
      /(\d{1,3})\.(\d{3})\s*(?:hectares|ha)/gi,
      /(\d{1,3})k\s*(?:hectares|ha)/gi
    ];
    
    for (const pattern of patterns) {
      const match = texto.match(pattern);
      if (match) {
        // Extrai número
        let numero = match[0].replace(/[^\d.,k]/gi, '');
        
        // Converte
        if (numero.includes('k')) {
          return parseFloat(numero.replace('k', '')) * 1000;
        }
        numero = numero.replace(/\./g, '').replace(',', '.');
        const hectares = parseFloat(numero);
        
        if (hectares >= 1000) {  // Mínimo razoável
          return Math.round(hectares);
        }
      }
    }
  }
  
  return 0;
}

// ==================== ENGINE DE NARRATIVA E STORYTELLING ====================

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
  suppliers: {
    count: number;
  };
  certifications: string[];
  triggers: {
    recent: Array<{ category: string; title: string; date: string | null }>;
  };
}

function extractKeyFacts(lead: ProspectLead, evidences: Evidence[]): ExtractedFacts {
  
  const allText = evidences.map(e => (e.text || '') + ' ' + (e.snippet || '')).join(' ').toLowerCase();
  
  // Extrai produtos principais e coprodutos
  const mainProducts: string[] = [];
  const byProducts: string[] = [];
  const rawMaterials: string[] = [];
  
  // Detecta matéria-prima (O que entra)
  if (allText.includes('milho')) rawMaterials.push('milho');
  if (allText.includes('cana')) rawMaterials.push('cana-de-açúcar');
  if (allText.includes('soja')) rawMaterials.push('soja');
  if (allText.includes('algodão') || allText.includes('pluma')) rawMaterials.push('algodão');
  
  // Detecta produtos principais (O que sai - Core)
  const cnae = lead.cnaes?.[0]?.description?.toLowerCase() || '';
  if (cnae.includes('etanol') || cnae.includes('álcool') || allText.includes('etanol')) mainProducts.push('etanol');
  if (cnae.includes('açúcar') || allText.includes('açúcar')) mainProducts.push('açúcar');
  if (cnae.includes('biodiesel') || allText.includes('biodiesel')) mainProducts.push('biodiesel');
  if (cnae.includes('semente') || allText.includes('semente')) mainProducts.push('sementes certificadas');
  
  // Detecta coprodutos (Valor Agregado)
  if (allText.includes('ddgs') || allText.includes('ddg')) byProducts.push('DDGS (nutrição animal)');
  if (allText.includes('óleo de milho') || allText.includes('corn oil')) byProducts.push('óleo de milho');
  if (allText.includes('energia elétrica') || allText.includes('cogeração') || allText.includes('bioeletricidade')) byProducts.push('bioenergia excedente');
  if (allText.includes('bagaço')) byProducts.push('biomassa (bagaço)');
  if (allText.includes('vinhaça')) byProducts.push('biofertilizantes (vinhaça)');
  if (allText.includes('torta') || allText.includes('farelo')) byProducts.push('farelo/torta');
  
  // Extrai história de origem (Storytelling)
  let originStory = null;
  let cooperativeDetails = null;
  const cooperativeMatch = allText.match(/(\d+)\s*famílias|união de.*produtores|cooperados.*fundaram|nasceu.*cooperativa|grupo.*familiar/i);
  if (cooperativeMatch) {
    const evidenceSnippet = evidences.find(e => 
      e.text.toLowerCase().includes('famílias') || 
      e.text.toLowerCase().includes('cooperados') ||
      e.text.toLowerCase().includes('união')
    );
    
    if (evidenceSnippet) {
      // Tenta pegar a frase que contem a match
      const snippet = evidenceSnippet.text;
      const matchIndex = snippet.toLowerCase().indexOf(cooperativeMatch[0]);
      if (matchIndex >= 0) {
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(snippet.length, matchIndex + 150);
          let extracted = snippet.substring(start, end).trim();
          if (start > 0) extracted = '...' + extracted;
          if (end < snippet.length) extracted = extracted + '...';
          originStory = extracted;
          cooperativeDetails = originStory;
      }
    }
  }
  
  // Localização estratégica
  let isStrategic = false;
  let locationRelevance = null;
  const uf = lead.uf?.toUpperCase() || '';
  
  if (uf === 'MT' && (rawMaterials.includes('milho') || mainProducts.includes('etanol'))) {
    isStrategic = true;
    locationRelevance = 'no coração da produção de milho de segunda safra (safrinha), garantindo matéria-prima abundante';
  } else if (uf === 'MS' && rawMaterials.includes('soja')) {
    isStrategic = true;
    locationRelevance = 'em hub logístico estratégico para escoamento e processamento';
  } else if (uf === 'GO' && (rawMaterials.includes('soja') || rawMaterials.includes('milho'))) {
    isStrategic = true;
    locationRelevance = 'no corredor logístico do Centro-Oeste, com acesso privilegiado a mercados consumidores';
  } else if (uf === 'BA' && (rawMaterials.includes('algodão') || rawMaterials.includes('soja'))) {
    isStrategic = true;
    locationRelevance = 'na região do Matopiba, fronteira agrícola de alta tecnologia e produtividade';
  }
  
  // Gatilhos recentes (notícias)
  const recentTriggers = (lead.tacticalAnalysis?.temporalTrace || [])
    .filter(t => {
      const dateMs = new Date(t.date).getTime();
      const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000); // Últimos 6 meses
      return !isNaN(dateMs) && dateMs > sixMonthsAgo;
    })
    .slice(0, 3)
    .map(t => ({
      category: t.category,
      title: t.title,
      date: t.date
    }));
  
  return {
    origin: {
      story: originStory,
      isCooperativeBased: lead.companyName.toUpperCase().includes('COOP') || cooperativeMatch !== null,
      cooperativeDetails
    },
    products: {
      rawMaterials: [...new Set(rawMaterials)], // Unique
      mainProducts: [...new Set(mainProducts)],
      byProducts: [...new Set(byProducts)]
    },
    location: {
      isStrategic,
      relevance: locationRelevance
    },
    suppliers: {
      count: 0  // Placeholder para futura expansão
    },
    certifications: [],
    triggers: {
      recent: recentTriggers
    }
  };
}

// Auxiliar para definir Tier no texto
function getOpportunityTier(persona: BusinessPersona, lead: ProspectLead): string {
  const score = lead.score || persona.confidence * 100;
  if (score > 80 || lead.capitalSocial > 50_000_000) return 'estratégica (Key Account)';
  if (score > 50) return 'de médio porte (Corporate)';
  return 'de desenvolvimento (SMB)';
}

function generateOpeningMessage(facts: ExtractedFacts, persona: BusinessPersona, lead: ProspectLead): string {
  
  let msg = `Olá, equipe ${lead.companyName}. `;
  
  // Personalização baseada na origem
  if (facts.origin.isCooperativeBased) {
    msg += `Admiro a trajetória de vocês, representando a força dos produtores locais `;
  } else {
    msg += `Acompanho a evolução da empresa `;
  }
  
  // Contexto de produto
  if (facts.products.mainProducts.length > 0) {
    msg += `no setor de ${facts.products.mainProducts[0]}. `;
  } else {
    msg += `no agronegócio regional. `;
  }
  
  // Gatilho Quente (Se houver)
  if (facts.triggers.recent.length > 0) {
    const trigger = facts.triggers.recent[0];
    msg += `Vi a notícia sobre "${trigger.title.substring(0, 40)}..." e acredito que seja um momento chave. `;
  }
  
  // Proposta de Valor Conectada
  if (persona.primaryRole === 'VERTICALIZADA') {
    msg += `A Senior tem expertise específica em integração campo-fábrica (custo real do grão ao produto final) que elimina gargalos de sistemas isolados. `;
  } else if (facts.origin.isCooperativeBased) {
    msg += `Temos soluções nativas para gestão de múltiplos cooperados, rateios e assembleias, reduzindo a carga operacional do backoffice. `;
  } else {
    msg += `Podemos agregar valor na profissionalização dos controles ${persona.primaryRole === 'INDUSTRIA_PROCESSADORA' ? 'industriais' : 'agrícolas'}, garantindo compliance e eficiência. `;
  }
  
  msg += `Podemos agendar uma conversa breve?`;
  
  return msg;
}

// ==================== GERADOR DE RESUMO EXECUTIVO (FINAL) ====================

async function generateExecutiveSummary(
  lead: ProspectLead,
  persona: BusinessPersona,
  marketContext: MarketContext,
  evidences: Evidence[]
): Promise<string> {
  
  const facts = extractKeyFacts(lead, evidences);
  let story = '';
  
  // ===== CABEÇALHO =====
  story += `# Briefing: ${lead.companyName}\n\n`;
  story += `_Análise Sara AI • ${new Date().toLocaleDateString('pt-BR')}_\n\n`;
  
  // ===== ABERTURA: Quem é e por que é relevante =====
  story += `A **${lead.companyName}** representa uma oportunidade ${getOpportunityTier(persona, lead)} `;
  story += `no segmento de ${facts.products.mainProducts[0] || 'agronegócio'}. `;
  
  if (facts.origin.cooperativeDetails) {
    story += `${facts.origin.cooperativeDetails} `;
  }
  
  if (facts.location.isStrategic) {
    story += `Sediada em **${lead.city}/${lead.uf}**, ${facts.location.relevance}. `;
  }
  
  story += `\n\n`;
  
  // ===== OPERAÇÃO: Como funciona especificamente =====
  if (persona.primaryRole === 'VERTICALIZADA') {
    story += `**O modelo de negócio é verticalizado**, integrando campo e indústria. `;
    story += `A empresa cultiva ${facts.products.rawMaterials.join(' e ')} `;
    
    if (persona.realHectares && persona.realHectares > 0) {
      story += `em base produtiva estimada de **${persona.realHectares.toLocaleString('pt-BR')} hectares** `;
    }
    
    story += `e processa essa matéria-prima para gerar ${facts.products.mainProducts.join(' e ')}`;
    
    if (facts.products.byProducts.length > 0) {
      story += `, além de coprodutos valiosos como ${facts.products.byProducts.join(', ')}`;
    }
    
    story += `. `;
    
    const capital = lead.capitalSocial || 0;
    if (capital > 100_000_000) {
      story += `Com estrutura de capital de **R$ ${(capital / 1_000_000).toFixed(0)} milhões**, `;
    }
    
    story += `posiciona-se como **${marketContext.scaleIndicator.benchmark}** no setor.\n\n`;
    
    // COMPLEXIDADE OPERACIONAL (integrada à narrativa, SEM BULLETS)
    story += `**Essa verticalização traz complexidade operacional elevada.** `;
    story += `O primeiro desafio é a **sincronia entre campo e fábrica**: a colheita precisa alimentar a indústria `;
    story += `sem deixá-la ociosa (perda financeira) nem sobrecarregá-la (perda de matéria-prima perecível). `;
    story += `Há também decisões contínuas de **mix de suprimento** — processar produção própria ou comprar no mercado spot? `;
    story += `Cada opção tem implicações diferentes de custo e margem. `;
    
    story += `\n\nO segundo desafio é a **precificação de transferência interna**: `;
    story += `quanto "vale" o ${facts.products.rawMaterials[0] || 'grão'} que sai do campo próprio e entra na fábrica? `;
    story += `Definir errado distorce análise de rentabilidade das duas pontas (campo pode parecer lucrativo mas fábrica deficitária, ou vice-versa). `;
    story += `Isso exige **rateio sofisticado de custos compartilhados** — logística, armazenagem, administrativo. `;
    
  } else if (persona.primaryRole === 'INDUSTRIA_PROCESSADORA') {
    story += `**Diferente de modelos verticalizados, esta empresa atua exclusivamente no processamento industrial**, `;
    story += `sem cultivo próprio. Sua operação consiste em receber ${facts.products.rawMaterials.join(' ou ')} `;
    story += `de uma base de fornecedores terceiros e transformar em ${facts.products.mainProducts.join(' e ')}`;
    
    if (facts.products.byProducts.length > 0) {
      story += `, aproveitando coprodutos como ${facts.products.byProducts.join(', ')}`;
    }
    
    story += `. `;
    
    if (facts.origin.isCooperativeBased) {
      story += `Como **braço industrial de cooperativa**, a dinâmica é específica: `;
      story += `a empresa processa produção dos cooperados associados, garantindo escoamento da safra e agregando valor. `;
    }
    
    story += `\n\n**A complexidade aqui está na gestão de fornecedores e rastreabilidade.** `;
    story += `Com matéria-prima de múltiplas origens, há necessidade de controles rigorosos de qualidade no recebimento, `;
    story += `rastreabilidade de lotes (essencial para certificações como RenovaBio), `;
    story += `e gestão de relacionamento com fornecedores (contratos, preços, volumes). `;
  } else {
    // Produtor ou Outros
    story += `**A operação foca na eficiência produtiva agrícola.** `;
    story += `Com foco em ${facts.products.rawMaterials.join(', ') || 'commodities'}, `;
    story += `o desafio central é o **custo de produção por hectare** e a gestão de insumos. `;
    story += `A margem é pressionada por fatores climáticos e de mercado, exigindo controle fino do estoque e planejamento de safra. `;
  }
  
  // RH (se relevante)
  const numFunc = lead.numFuncionarios || 0;
  if (numFunc > 50) {
    story += `\n\nCom **${numFunc} colaboradores**, há também complexidade trabalhista significativa: `;
    story += `compliance de eSocial, gestão de ponto eletrônico, benefícios, turnover`;
    if (numFunc > 200) story += `, e operação em múltiplos turnos`;
    story += `. Passivo trabalhista mal gerido pode gerar multas e autuações.`;
  }
  
  story += `\n\n`;
  
  // ===== FIT SENIOR (integrado à narrativa, não como lista de produtos) =====
  story += `**É exatamente nessa complexidade que o portfólio Senior entrega valor tangível.** `;
  
  if (persona.primaryRole === 'VERTICALIZADA') {
    story += `A integração entre **Senior Gestão Agro** (módulo de campo/GAtec) e **Senior Gestão Industrial** `;
    story += `permite visão única do custo desde o plantio até o produto final embalado. `;
    story += `Isso elimina as planilhas de Excel que hoje fazem conciliação manual entre sistemas isolados, `;
    story += `e oferece ao CFO/Controller uma visão consolidada real da margem — não estimativas ou alocações arbitrárias. `;
    
    story += `\n\nPara a **decisão de mix** (produção própria vs compra), o sistema integrado mostra em tempo real `;
    story += `o custo verdadeiro de cada alternativa, considerando todos os fatores (logística, qualidade, disponibilidade). `;
    
  } else if (persona.primaryRole === 'INDUSTRIA_PROCESSADORA') {
    story += `O **Senior Gestão Industrial** traz controles de processamento, qualidade e manutenção preventiva. `;
    story += `O **módulo de gestão de fornecedores** garante rastreabilidade completa (origem, lote, qualidade), `;
    story += `essencial para certificações e auditorias. `;
  } else {
    story += `O **Senior Gestão Agro** profissionaliza o controle "porteira para dentro", `;
    story += `transformando dados agronômicos em inteligência financeira. `;
  }
  
  if (numFunc > 50) {
    story += `\n\nO **Senior HCM** resolve a dor de compliance trabalhista: `;
    story += `eSocial automatizado, ponto eletrônico integrado, gestão de férias e benefícios. `;
    story += `Reduz drasticamente risco de autuação e agiliza fechamento de folha.`;
  }
  
  story += `\n\n`;
  
  // ===== ABORDAGEM (integrada ao final, não como seção separada) =====
  story += `**Do ponto de vista comercial**, a estrutura de decisão é **${marketContext.decisionStructure.type}**, `;
  story += `com ciclo médio de **${marketContext.decisionStructure.salesCycle}**. `;
  story += `Os stakeholders-chave são ${marketContext.decisionStructure.keyRoles.slice(0, 3).join(', ')}. `;
  
  if (facts.triggers.recent.length > 0) {
    const trigger = facts.triggers.recent[0];
    story += `\n\nTemos **gatilho quente identificado**: "${trigger.title}" `;
    if (trigger.date) {
      story += `(${new Date(trigger.date).toLocaleDateString('pt-BR')})`;
    }
    story += `. Isso indica momento propício para abordagem, `;
    story += `pois mudanças (expansão, investimento, nova gestão) criam janela para revisão de sistemas.`;
  }
  
  story += `\n\n**Mensagem de abertura sugerida:** `;
  story += `"${generateOpeningMessage(facts, persona, lead)}"`;
  
  return story;
}

// ==================== ORCHESTRATOR ====================

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
  
  // 1. Check Cache
  const cached = getCachedEnrichment(cnpj);
  if (cached) {
    onProgress?.('Dados recuperados do cache.');
    return cached;
  }

  // 2. Parallel Execution (Data Gathering First)
  onProgress?.('Consultando fontes oficiais, notícias e balanços...');
  
  try {
    const [noticias, faturamento, funcionarios] = await Promise.all([
      searchCompanyNews(razaoSocial, cnpj),
      validateRevenue(razaoSocial, cnpj, capitalSocial),
      validateEmployeeCount(razaoSocial, cnpj, hectares, capitalSocial)
    ]);

    // ========== CORREÇÃO DE DADOS (Hectares Inconsistentes) ==========
    
    let hectaresCorrigidos = hectares;
    
    // Regra: se funcionários validado é alto mas hectares é zero/baixo
    if (funcionarios.quantidade >= 50 && hectares < 500) {
        // Estimativa baseada em funcionários (70 ha / func - média grãos/algodão)
        const hectaresEstimados = funcionarios.quantidade * 70;
        hectaresCorrigidos = Math.max(hectaresCorrigidos, hectaresEstimados);
    }
    
    // Regra: se notícias mencionam hectares maiores
    const hectaresNoticia = extrairHectaresDasNoticias(noticias);
    if (hectaresNoticia > hectaresCorrigidos) {
        hectaresCorrigidos = hectaresNoticia;
    }

    // 1. DETECÇÃO DE PERSONA REAL (Intelligence Service)
    const personaInput = {
      cnpj,
      razaoSocial,
      cnaePrincipal: cultura, // Cultura funciona como proxy do CNAE aqui
      cnaesSecundarios: [],
      qsa: qsa || [],
      hectaresCadastrais: hectaresCorrigidos, // Usa corrigido
      capitalSocial: capitalSocial,
      uf: location.state
    };
    
    const persona = await detectBusinessPersona(personaInput);
    
    // 2. ENRIQUECIMENTO DE CONTEXTO DE MERCADO
    const enrichmentInput = {
      persona,
      capitalSocial,
      cnaePrincipal: cultura,
      location: location,
      faturamentoEstimado: faturamento.valor
    };
    
    const marketContext = enrichMarketContext(enrichmentInput);

    // 3. Generate Executive Summary (With FULLY CORRECTED context)
    onProgress?.('Gerando análise estratégica Sara AI...');
    
    // Cria um objeto ProspectLead temporário e rico para o gerador de texto
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
            // Mapeia notícias para o rastro temporal que o gerador usa
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

    // Converter NewsItems para formato Evidence para o extrator de fatos
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
      hectares_corrigidos: hectaresCorrigidos, // <--- Salva para UI
      timestamp: Date.now()
    };

    // 4. Save Cache
    setCachedEnrichment(cnpj, enrichment);
    return enrichment;

  } catch (error) {
    console.error("Erro fatal no enriquecimento:", error);
    throw error;
  }
}
