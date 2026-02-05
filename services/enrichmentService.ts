import { GoogleGenAI } from "@google/genai";
import { detectBusinessPersona, BusinessPersona } from "./microservices/2-intelligence/businessPersonaDetector";
import { enrichMarketContext, MarketContext } from "./microservices/2-intelligence/marketContextEnricher";
import { ProspectLead, Evidence } from "../types"; 

// ==================== CONFIGURAÇÃO ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_FAST = 'gemini-2.5-flash'; 
const MODEL_SMART = 'gemini-2.5-pro'; 

// ==================== INTERFACES ====================

export interface NewsItem {
  titulo: string;
  resumo: string;
  fonte: string;
  data: string;
  url?: string;
  relevancia: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export interface CompanyEnrichment {
  resumo: string;
  noticias: NewsItem[];
  faturamento_validado: any;
  funcionarios_validados: any;
  hectares_corrigidos?: number;
  timestamp: number;
}

// ==================== HELPER: JSON PARSER ====================

function parseGeminiJsonResponse(text: string): any {
  if (!text) return {};
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) {}
    }
    return {};
  }
}

// ==================== 1. THE HUNTER (BUSCADOR) ====================

async function searchCompanyNews(razaoSocial: string, cnpj: string): Promise<NewsItem[]> {
  const prompt = `
    ATUE COMO: Investigador de Inteligência Competitiva (Agro).
    ALVO: "${razaoSocial}" (CNPJ: ${cnpj}).
    
    MISSÃO: Encontrar SINAIS DE CAPITAL e OPERAÇÃO (Últimos 24 meses).
    O QUE BUSCAR:
    1. DINHEIRO: "Investimento", "Aporte", "CRA", "Fiagro", "BNDES", "Financiamento".
    2. ESTRUTURA: "Holding", "Grupo", "Fusão", "Aquisição", "Sócios".
    3. OPERAÇÃO: "Hectares", "Planta", "Armazém", "Licença Ambiental", "Expansão".
    
    OUTPUT: JSON com array "noticias".
    SCHEMA: { "noticias": [{ "titulo": "...", "resumo": "Cite valores exatos (R$)", "fonte": "...", "data": "...", "relevancia": "ALTA" }] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_SMART, // PRO: Busca profunda
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }] 
      }
    });

    const result = parseGeminiJsonResponse(response.text || '{}');
    return result.noticias || [];
  } catch (error) {
    console.error("Erro no Hunter:", error);
    return [];
  }
}

// ==================== VALIDATOR: REVENUE SYNC ====================

function extractMoneyFromNews(noticias: NewsItem[]): number {
  let maxVal = 0;
  const regexMoney = /(?:R\$|BRL|R)\s*([\d\.,]+)\s*(milhões|bilhões|bi|mi|milhao|bilhao)/gi;
  
  const text = noticias.map(n => n.titulo + ' ' + n.resumo).join(' ');
  let match;
  
  while ((match = regexMoney.exec(text)) !== null) {
    let valStr = match[1].replace(/\./g, '').replace(',', '.');
    let val = parseFloat(valStr);
    const unit = match[2].toLowerCase();
    const multiplier = (unit.startsWith('bi')) ? 1_000_000_000 : 1_000_000;
    const total = val * multiplier;
    if (total > maxVal) maxVal = total;
  }
  return maxVal;
}

async function validateRevenue(razaoSocial: string, cnpj: string, capitalSocial: number, noticias: NewsItem[]): Promise<any> {
  const newsRevenue = extractMoneyFromNews(noticias);
  
  // Regra Evermat/Jequitibá: Notícia > 10M vence Capital Social
  if (newsRevenue > 10_000_000 && newsRevenue > capitalSocial) {
     return {
        valor: newsRevenue,
        fonte: 'SINAIS_DE_MERCADO',
        confiabilidade: 'ALTA',
        ultima_atualizacao: new Date().getFullYear().toString(),
        justificativa: `Valor ajustado com base em sinais de mercado (Investimentos/Aportes detectados).`
     };
  }
  
  const baseRevenue = capitalSocial > 0 ? capitalSocial * 1.5 : 1000000; 
  return {
      valor: baseRevenue,
      fonte: 'ESTIMATIVA_CAPITAL',
      confiabilidade: 'MEDIA',
      ultima_atualizacao: '2025',
      justificativa: 'Estimativa baseada no Capital Social (Holding/Asset).'
  };
}

async function validateEmployeeCount(razao: string, cnpj: string, ha: number, cap: number) {
    return { quantidade: ha > 0 ? Math.floor(ha/100) : 10, fonte: 'ESTIMATIVA', confiabilidade: 'MEDIA' };
}

// ==================== 2. THE JUDGE (CLASSIFICADOR) ====================

async function classifyBusinessArchetype(lead: ProspectLead, evidences: Evidence[]): Promise<string> {
  const evidenceText = evidences.map(e => `${e.title}: ${e.snippet}`).join('\n');
  
  const prompt = `
    ATUE COMO: Consultor Estratégico.
    EMPRESA: ${lead.companyName}.
    EVIDÊNCIAS: ${evidenceText}
    
    CLASSIFIQUE O ARQUÉTIPO (Escolha UM):
    1. HOLDING_PATRIMONIAL: Capital >100M, "Participações". (Ex: Natter).
    2. SA_PRODUTORES: Usina/Indústria com muitos sócios produtores. (Ex: Evermat).
    3. CORPORATE_INVESTIDOR: Fundos, Fiagros. (Ex: Jequitibá).
    4. PRODUTOR_RURAL: Foco em plantio direto.
    
    Retorne APENAS o nome do arquétipo.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { temperature: 0.0 }
    });
    return response.text?.trim() || 'PRODUTOR_RURAL';
  } catch (e) { return 'PRODUTOR_RURAL'; }
}

// ==================== 3. THE WRITER (O CORRETOR DO SURTO) ====================

async function generateExecutiveSummary(
  lead: ProspectLead,
  persona: BusinessPersona,
  marketContext: MarketContext,
  evidences: Evidence[],
  archetype: string
): Promise<string> {
  
  // PROTEÇÃO CONTRA ALUCINAÇÃO: Se não houver notícias, usamos CNAE e Capital.
  let evidenceText = evidences.slice(0, 5).map(e => `- ${e.title}: ${e.snippet}`).join('\n');
  if (evidenceText.length < 10) {
      evidenceText = `AVISO: Não foram encontradas notícias recentes. Baseie-se ESTRITAMENTE na atividade econômica: ${lead.cnaes?.[0]?.description} e Capital Social: R$ ${lead.capitalSocial}. NÃO INVENTE DADOS.`;
  }

  const prompt = `
    ATUE COMO: Sara, Analista Sênior da Senior Sistemas.
    PÚBLICO: Vendedor Interno (Briefing Tático).
    ALVO: ${lead.companyName}.
    ARQUÉTIPO: ${archetype}.
    
    FATOS (A VERDADE):
    ${evidenceText}
    
    REGRAS DE OURO (ANTI-ALUCINAÇÃO):
    1. ATENHA-SE AOS FATOS: Se não há notícias de "Construção", NÃO fale de Construção. Se é Agro, fale de Agro.
    2. ZERO SAUDAÇÕES: Comece direto. Sem "Prezados", sem "Olá".
    3. ZERO VISUAL SUJO: Não repita as instruções do prompt no texto final.
    
    ESTRUTURA DE SAÍDA (Use ||| como separador único):
    [PARAGRAFO 1: PERFIL & REALIDADE FINANCEIRA]
    |||
    [PARAGRAFO 2: DORES OPERACIONAIS]
    |||
    [PARAGRAFO 3: TESE DE VENDA (SOLUÇÃO SENIOR)]
    |||
    [PARAGRAFO 4: GATILHO DE ATAQUE]
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { temperature: 0.1 } // Baixíssima temperatura para evitar invenção
    });

    let text = response.text || '';
    if (!text.includes('|||')) text = text.replace(/\n\n/g, '|||');
    
    // VASSOURA UNIVERSAL (Limpa qualquer coisa entre colchetes ou que pareça cabeçalho)
    text = text
        .replace(/\[.*?\]/g, '') // Remove [Qualquer Coisa]
        .replace(/\(.*?\):/g, '') // Remove (Instruções):
        .replace(/#\s*Seção\s*\d+/gi, '')
        .replace(/^(Prezados|Olá|Caros|Estimados).*?(\n|$)/gim, '')
        .replace(/^(Nesta análise|A seguir).*?(\n|$)/gim, '')
        .replace(/```/g, '')
        .trim();

    // Limpeza extra de linhas vazias que sobram após remover tags
    text = text.split('|||').map(p => p.trim()).join('|||');

    return text;

  } catch (error) { return "Erro na geração."; }
}

// ==================== ORCHESTRATOR ====================

export async function enrichCompanyData(
  razaoSocial: string,
  cnpj: string,
  capitalSocial: number,
  hectares: number,
  natureza: string,
  cultura: string,
  qsa: any[],
  location: any,
  onProgress?: (msg: string) => void
): Promise<CompanyEnrichment> {
  
  const safeRazao = razaoSocial || 'Empresa Agrícola';
  const safeCnpj = cnpj || '';
  const safeCapital = Number(capitalSocial) || 0;
  const safeCultura = (cultura && cultura.length > 2) ? cultura : 'AGRONEGOCIO_GERAL';
  
  const cached = localStorage.getItem(`enrichment_v16_${safeCnpj.replace(/\D/g, '')}`);
  if (cached) return JSON.parse(cached);

  onProgress?.('Caçando sinais de mercado...');
  
  const noticias = await searchCompanyNews(safeRazao, safeCnpj);
  const faturamento = await validateRevenue(safeRazao, safeCnpj, safeCapital, noticias);
  const funcionarios = await validateEmployeeCount(safeRazao, safeCnpj, hectares || 0, safeCapital);

  const tempLead = {
    id: 'temp',
    companyName: safeRazao, 
    cnpj: safeCnpj, 
    capitalSocial: safeCapital,
    city: location?.city || '',
    uf: location?.state || '',
    cnaes: [{ description: safeCultura }],
    numFuncionarios: funcionarios.quantidade,
    isValidated: true,
    isSA: safeRazao.toUpperCase().includes('S.A') || safeRazao.toUpperCase().includes('S/A'),
    isMatriz: true,
    contactType: 'Direto',
    activityCount: 1,
    priority: 50,
    confidence: 90
  } as ProspectLead;

  onProgress?.('Classificando Arquétipo...');
  const evidenceList = noticias.map(n => ({ title: n.titulo, snippet: n.resumo, source: n.fonte, type: 'web' } as Evidence));
  const archetype = await classifyBusinessArchetype(tempLead, evidenceList);
  
  const persona = await detectBusinessPersona({ 
      cnpj: safeCnpj,
      razaoSocial: safeRazao,
      cnaePrincipal: safeCultura,
      cnaesSecundarios: [],
      qsa: qsa || [],
      hectaresCadastrais: hectares || 0,
      capitalSocial: safeCapital,
      uf: location?.state || 'MT'
  });

  const marketContext = enrichMarketContext({ 
      persona, 
      capitalSocial: safeCapital, 
      cnaePrincipal: safeCultura, 
      location: location || { state: 'MT', city: 'Sinop' }, 
      faturamentoEstimado: faturamento.valor 
  });

  onProgress?.(`Gerando estratégia para ${archetype}...`);
  const resumo = await generateExecutiveSummary(tempLead, persona, marketContext, evidenceList, archetype);

  const enrichment = {
    resumo, noticias, faturamento_validado: faturamento,
    funcionarios_validados: funcionarios, hectares_corrigidos: hectares || 0,
    timestamp: Date.now()
  };

  localStorage.setItem(`enrichment_v16_${safeCnpj.replace(/\D/g, '')}`, JSON.stringify(enrichment));
  return enrichment;
}

export function clearEnrichmentCache(cnpj: string): void {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  localStorage.removeItem(`enrichment_v16_${cleanCnpj}`);
}
