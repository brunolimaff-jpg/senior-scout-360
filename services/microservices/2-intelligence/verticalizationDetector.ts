
import { GoogleGenAI } from "@google/genai";
import { queuedGeminiCall } from "../../requestQueueService";
import { ProspectLead, Evidence } from "../../../types";

// ==================== TIPOS ====================

interface VerticalizationSignals {
  hasAgriculturalCNAE: boolean;
  hasFarmMentions: boolean;
  hasHectaresMentioned: boolean;
  hasGroupFarms: boolean;
  regionalPattern: boolean;
  aiConfirmed: boolean;
}

export interface VerticalizationResult {
  isVerticalized: boolean;
  estimatedOwnHectares: number | null;
  confidence: number; // 0.0 a 1.0
  signals: VerticalizationSignals;
  evidenceSummary: string;
}

// ==================== CONFIGURAÇÃO ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Palavras-chave que indicam OPERAÇÃO PRÓPRIA (não apenas compra)
const OWN_OPERATION_KEYWORDS = [
  'integração vertical', 'verticalizada', 'autossuficiente',
  'produção própria', 'área agrícola', 'fazenda da usina',
  'plantio próprio', 'lavoura própria', 'área de cultivo',
  'canavial próprio', 'terras próprias', 'lavoura da empresa',
  'nossa produção', 'nossas fazendas'
];

// Estados onde a verticalização é padrão para grandes players
const HIGH_VERTICALIZATION_STATES = ['MT', 'MS', 'GO', 'MA', 'TO', 'PI']; // Centro-Oeste + Matopiba

// ==================== LÓGICA CORE ====================

export async function detectVerticalization(
  lead: ProspectLead,
  evidences: Evidence[]
): Promise<VerticalizationResult> {
  
  console.log(`🏭🌱 [Verticalização] Iniciando análise profunda para: ${lead.companyName}`);
  
  const signals: VerticalizationSignals = {
    hasAgriculturalCNAE: false,
    hasFarmMentions: false,
    hasHectaresMentioned: false,
    hasGroupFarms: false,
    regionalPattern: false,
    aiConfirmed: false
  };

  let detectedHectares: number | null = null;
  let detectedEvidenceSnippet = "";

  // ------------------------------------------------------------
  // 1. ANÁLISE DE CNAE SECUNDÁRIO (Sinal Forte)
  // ------------------------------------------------------------
  const allCnaes = lead.cnaes || [];
  const agroKeywords = ['cultivo', 'criação', 'produção de sementes', 'lavoura', 'plantio', 'colheita'];
  
  signals.hasAgriculturalCNAE = allCnaes.some(cnae => {
    const desc = cnae.description.toLowerCase();
    // Ignora "comércio" ou "representação", foca em produção
    if (desc.includes('comércio') || desc.includes('representação')) return false;
    return agroKeywords.some(kw => desc.includes(kw));
  });

  if (signals.hasAgriculturalCNAE) {
    console.log('✅ CNAE secundário de produção agrícola detectado.');
  }

  // ------------------------------------------------------------
  // 2. MINERAÇÃO DE TEXTO (Regex em Evidências)
  // ------------------------------------------------------------
  // Concatena snippets de evidências, notas e resumo
  const combinedText = [
    lead.notes || '',
    ...evidences.map(e => e.snippet + ' ' + e.text)
  ].join(' ').toLowerCase();

  // 2.1 Busca por números de hectares associados a posse
  // Ex: "30.000 hectares próprios", "plantio de 5 mil ha"
  const hectaresPatterns = [
    /(\d{1,3}(?:\.\d{3})*)\s*(?:mil|k)?\s*hectares?\s*(?:próprios?|da\s+empresa|de\s+cultivo|plantados)/gi,
    /área\s+(?:própria|de\s+cultivo|agrícola)\s+de\s+(\d{1,3}(?:\.\d{3})*)/gi,
    /planta\s+(?:cerca\s+de\s+)?(\d{1,3}(?:\.\d{3})*)\s*(?:mil|k)?\s*ha/gi,
    /capacidade\s+de\s+plantio\s+de\s+(\d{1,3}(?:\.\d{3})*)/gi
  ];

  for (const pattern of hectaresPatterns) {
    const match = pattern.exec(combinedText);
    if (match) {
      signals.hasHectaresMentioned = true;
      // Normaliza número (remove ponto de milhar, trata 'mil')
      let rawNum = match[1].replace(/\./g, '').replace(',', '.');
      let val = parseFloat(rawNum);
      
      if (match[0].includes('mil') || match[0].includes(' k ')) {
        val *= 1000;
      }
      
      // Filtro de sanidade: Hectares > 50 e < 1.000.000
      if (val > 50 && val < 1000000) {
        if (!detectedHectares || val > detectedHectares) {
          detectedHectares = val;
          detectedEvidenceSnippet = match[0];
        }
      }
    }
  }

  if (signals.hasHectaresMentioned) {
    console.log(`✅ Hectares mencionados no texto: ~${detectedHectares} ha ("${detectedEvidenceSnippet}")`);
  }

  // 2.2 Busca por termos qualitativos de verticalização
  signals.hasFarmMentions = OWN_OPERATION_KEYWORDS.some(kw => combinedText.includes(kw));
  if (signals.hasFarmMentions) {
    console.log('✅ Termos de operação agrícola própria encontrados no texto.');
  }

  // ------------------------------------------------------------
  // 3. PADRÃO REGIONAL (Heurística de Negócio)
  // ------------------------------------------------------------
  const uf = lead.uf?.toUpperCase() || '';
  const capital = lead.capitalSocial || 0;
  
  // É uma indústria? (CNAE principal)
  const mainCnae = (lead.cnaes?.[0]?.description || '').toLowerCase();
  const isIndustry = mainCnae.includes('fabricação') || mainCnae.includes('indústria') || mainCnae.includes('usina') || mainCnae.includes('açúcar') || mainCnae.includes('etanol');

  // Regra: MT/MS/GO + Indústria + Capital > 50M = Alta chance de ter terra própria
  if (HIGH_VERTICALIZATION_STATES.includes(uf) && isIndustry && capital > 50_000_000) {
    signals.regionalPattern = true;
    console.log('✅ Padrão Regional Detectado: Indústria de Grande Porte no Cerrado/Matopiba.');
  }

  // ------------------------------------------------------------
  // 4. CÁLCULO DE CONFIANÇA PRELIMINAR
  // ------------------------------------------------------------
  let score = 0;
  if (signals.hasAgriculturalCNAE) score += 0.4;
  if (signals.hasHectaresMentioned) score += 0.4;
  if (signals.hasFarmMentions) score += 0.2;
  if (signals.regionalPattern) score += 0.2;

  // Se já temos certeza (Score > 0.6) ou se não temos quase nada, decidimos se chamamos a IA
  // Chamamos a IA se: Temos indícios (Regional ou Termos) mas não temos o número de Hectares, ou para confirmar CNAE duvidoso.
  
  const needsAiConfirmation = (score >= 0.2 && score < 0.8) && !detectedHectares;

  if (needsAiConfirmation) {
    console.log('🤔 Sinais encontrados mas inconclusivos. Acionando Agente Especialista (Gemini)...');
    
    try {
      const aiResult = await queryGeminiForVerticalization(lead);
      if (aiResult.isVerticalized) {
        signals.aiConfirmed = true;
        score += 0.3; // Boost de confiança
        if (aiResult.hectares && !detectedHectares) {
          detectedHectares = aiResult.hectares;
          detectedEvidenceSnippet = `IA: ${aiResult.evidence}`;
        }
      } else {
        // IA disse que NÃO é verticalizada (ex: "compra 100% da cana")
        score -= 0.3; 
      }
    } catch (e) {
      console.warn('⚠️ Falha na verificação AI de verticalização.', e);
    }
  }

  // ------------------------------------------------------------
  // 5. ESTIMATIVA FINAL E RETORNO
  // ------------------------------------------------------------
  
  // Se detectamos verticalização mas não achamos o número exato, estimamos pelo Capital Social (proxy)
  // Apenas para usinas/indústrias onde o padrão regional se aplica
  if (score >= 0.4 && !detectedHectares && signals.regionalPattern) {
    // Estimativa conservadora: R$ 1M de capital ~ 30 hectares próprios (Indústria tem muito capital em máquina)
    // Usinas costumam ter 30-50% de cana própria.
    detectedHectares = Math.round((capital / 1_000_000) * 30);
    detectedEvidenceSnippet = "Estimativa baseada em porte de capital industrial na região (Proxy)";
  }

  // Montagem do Resumo
  const reasons: string[] = [];
  if (signals.hasAgriculturalCNAE) reasons.push("CNAE Secundário de Cultivo");
  if (signals.hasHectaresMentioned) reasons.push(`Evidência de ${detectedHectares?.toLocaleString()} ha próprios`);
  if (signals.hasFarmMentions) reasons.push("Menções textuais de produção própria");
  if (signals.regionalPattern) reasons.push("Padrão de Usina/Indústria Verticalizada no CO/Matopiba");
  if (signals.aiConfirmed) reasons.push("Validação Semântica via IA");

  const finalConfidence = Math.min(score, 1.0);
  const isVerticalized = finalConfidence >= 0.4;

  return {
    isVerticalized,
    estimatedOwnHectares: isVerticalized ? (detectedHectares || 0) : 0,
    confidence: finalConfidence,
    signals,
    evidenceSummary: isVerticalized 
      ? `Verticalização Detectada (${(finalConfidence*100).toFixed(0)}%): ${reasons.join(', ')}.` 
      : "Indícios insuficientes de operação agrícola própria."
  };
}

// ==================== SUB-FUNÇÃO: AGENTE IA ====================

async function queryGeminiForVerticalization(lead: ProspectLead): Promise<{ isVerticalized: boolean; hectares: number | null; evidence: string }> {
  const prompt = `
    ATUE COMO: Investigador de Agronegócio Sênior.
    OBJETIVO: Descobrir se a empresa "${lead.companyName}" (CNPJ: ${lead.cnpj}) tem PRODUÇÃO AGRÍCOLA PRÓPRIA (Verticalização) ou se apenas processa/comercializa.

    CONTEXTO:
    Empresa em ${lead.city}/${lead.uf}. Atividade principal: ${lead.cnaes?.[0]?.description}.

    INVESTIGUE NA WEB:
    1. Busque termos como "hectares próprios", "área plantada", "autossuficiência", "fazendas da empresa".
    2. Diferencie "área total administrada" (que pode incluir fornecedores) de "área própria".
    3. Para usinas de cana/etanol, verifique se possuem "canavial próprio".

    RETORNE JSON:
    {
      "isVerticalized": boolean,
      "hectares": number | null (Apenas se encontrar número explícito de área PRÓPRIA),
      "evidence": "Breve trecho do texto que comprova ou refuta (máx 150 chars)"
    }
  `;

  return queuedGeminiCall(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Modelo mais inteligente para essa dedução
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const txt = response.text?.replace(/```json|```/g, '').trim() || '{}';
    try {
      return JSON.parse(txt);
    } catch {
      return { isVerticalized: false, hectares: null, evidence: "Erro parse IA" };
    }
  }, 'MEDIUM');
}
