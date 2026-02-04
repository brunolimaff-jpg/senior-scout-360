
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { queuedGeminiCall } from "../../requestQueueService";

// ==================== TIPOS E INTERFACES ====================

// Interface Completa (Mantida para compatibilidade com outros serviços)
export interface BusinessPersona {
  primaryRole: 'PRODUTOR' | 'INDUSTRIA_PROCESSADORA' | 'TRADING_ARMAZEM' | 'COOPERATIVA' | 'VERTICALIZADA' | 'SERVICOS';
  ownership: 'FAMILIAR' | 'CORPORATIVO' | 'COOPERATIVA' | 'INVESTIDOR_FINANCEIRO';
  verticalization: 'FULL' | 'PARTIAL' | 'NONE';
  realHectares: number | null;
  processingCapacity: string | null;
  cooperativeLinks: string[];
  ecosystem: {
    role: string;
    upstreamPartners: string[];
    downstreamPartners: string[];
  };
  correctionNote?: string;
  confidence: number;
}

// Contexto de Entrada
export interface InputContext {
  cnpj: string;
  razaoSocial: string;
  cnaePrincipal: string;
  cnaesSecundarios: string[];
  qsa: Array<{ nome: string; qualificacao: string }>;
  hectaresCadastrais?: number;
  capitalSocial: number; // Obrigatório para regras
  uf: string;            // Obrigatório para regras regionais
}

// Interface Simplificada (Uso interno da análise)
interface SimplifiedAnalysis {
  primaryRole: BusinessPersona['primaryRole'];
  ownership: BusinessPersona['ownership'];
  realHectares: number;
  correctionNote?: string;
  confidence: number;
}

// ==================== LÓGICA PRINCIPAL ====================

export async function detectBusinessPersona(context: InputContext): Promise<BusinessPersona> {
  console.log(`🕵️ Detectando Persona para: ${context.razaoSocial}`);
  
  try {
    // 1. PRIMEIRA TENTATIVA: Análise rápida baseada em regras (SEM IA)
    const quickAnalysis = analyzeByRules(context);
    
    // Se confiança da análise rápida for alta (>70%), usa direto
    if (quickAnalysis.confidence > 0.7) {
      console.log(`✅ Persona detectada por regras: ${quickAnalysis.primaryRole} (confiança: ${(quickAnalysis.confidence * 100).toFixed(0)}%)`);
      return expandToFullPersona(quickAnalysis);
    }
    
    // 2. SEGUNDA TENTATIVA: Busca complementar com IA
    console.log(`⚠️ Confiança baixa nas regras (${(quickAnalysis.confidence * 100).toFixed(0)}%). Consultando IA...`);
    
    const prompt = `
Analise esta empresa do agronegócio brasileiro e identifique seu papel real na cadeia produtiva:

EMPRESA: ${context.razaoSocial}
CNPJ: ${context.cnpj}
CNAE: ${context.cnaePrincipal}
CAPITAL: R$ ${context.capitalSocial.toLocaleString('pt-BR')}
ESTADO: ${context.uf}

IMPORTANTE: No Brasil, muitas usinas de álcool/açúcar e processadoras de soja são VERTICALIZADAS - elas cultivam cana/soja própria E processam. Não assuma que toda indústria só processa.

Busque sinais de:
1. Menções de "hectares próprios", "área de cultivo", "fazendas"
2. Se é cooperativa (nome tem "cooperativa", "coop")
3. Se planta ou só processa

Responda em português, formato livre, destacando:
- PAPEL PRINCIPAL: (PRODUTOR | INDUSTRIA_PROCESSADORA | VERTICALIZADA | TRADING | COOPERATIVA)
- PROPRIEDADE: (FAMILIAR | CORPORATIVO | COOPERATIVA)
- HECTARES PRÓPRIOS: (número ou "não cultivam")
- CONFIANÇA: (alta | média | baixa)
- JUSTIFICATIVA: breve explicação

Seja direto e objetivo.
`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await queuedGeminiCall<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],  // USA Google Search
          temperature: 0.2
          // NÃO USA responseMimeType quando tem tools
        }
      }),
      'HIGH'
    );
    
    const responseText = response.text || '';
    // console.log('📄 Resposta da IA:', responseText);
    
    // Parse manual da resposta em texto livre
    const aiAnalysis = parseAIResponse(responseText, quickAnalysis);
    
    console.log(`✅ Persona final (IA): ${aiAnalysis.primaryRole} (confiança: ${(aiAnalysis.confidence * 100).toFixed(0)}%)`);
    
    return expandToFullPersona(aiAnalysis);
    
  } catch (error) {
    console.error('❌ Erro na detecção de persona:', error);
    
    // FALLBACK: Retorna análise básica por regras com baixa confiança
    const fallback = analyzeByRules(context);
    fallback.correctionNote = 'Análise profunda falhou. Dados baseados apenas em regras cadastrais.';
    fallback.confidence = 0.3;
    
    return expandToFullPersona(fallback);
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Análise rápida baseada em regras deterministicas (SEM IA)
 */
function analyzeByRules(ctx: InputContext): SimplifiedAnalysis {
  const cnae = ctx.cnaePrincipal.toLowerCase();
  const name = ctx.razaoSocial.toUpperCase();
  const capital = ctx.capitalSocial;
  const uf = ctx.uf?.toUpperCase() || '';
  
  let primaryRole: BusinessPersona['primaryRole'] = 'INDUSTRIA_PROCESSADORA';
  let ownership: BusinessPersona['ownership'] = 'FAMILIAR';
  let realHectares = 0;
  let confidence = 0.5;
  let note = '';
  
  // REGRA 1: Detecta cooperativa pelo nome
  if (name.includes('COOPERATIVA') || name.includes('COOP') || name.includes('COOPERADO')) {
    primaryRole = 'COOPERATIVA';
    ownership = 'COOPERATIVA';
    confidence = 0.95;
    note = 'Cooperativa identificada pelo nome.';
    return { primaryRole, ownership, realHectares, correctionNote: note, confidence };
  }
  
  // REGRA 2: Detecta produtor rural puro
  if (cnae.includes('cultivo de') || cnae.includes('criação de') || cnae.includes('produção de')) {
    primaryRole = 'PRODUTOR';
    ownership = capital > 50_000_000 ? 'CORPORATIVO' : 'FAMILIAR';
    confidence = 0.8;
    note = 'Produtor rural identificado pelo CNAE de cultivo/criação.';
    return { primaryRole, ownership, realHectares, correctionNote: note, confidence };
  }
  
  // REGRA 3: Detecta trading/armazenador
  if (cnae.includes('armazenamento') || cnae.includes('comércio atacadista') || 
      cnae.includes('representante comercial')) {
    primaryRole = 'TRADING_ARMAZEM';
    ownership = 'CORPORATIVO';
    confidence = 0.85;
    note = 'Trading/Armazenador - não cultiva, apenas comercializa.';
    return { primaryRole, ownership, realHectares, correctionNote: note, confidence };
  }
  
  // REGRA 4: Indústrias processadoras - ALTA CHANCE DE VERTICALIZAÇÃO EM MT/MS/GO
  if (cnae.includes('fabricação') || cnae.includes('processamento') || cnae.includes('esmagamento') || cnae.includes('usina')) {
    
    // Sub-regra: Estados com alta verticalização + capital alto = provável verticalização
    const verticalizationStates = ['MT', 'MS', 'GO'];
    const isInVerticalizationRegion = verticalizationStates.includes(uf);
    const hasLargeCapital = capital > 100_000_000;
    
    if (isInVerticalizationRegion && hasLargeCapital) {
      // Provável verticalização, mas precisa confirmar com IA
      primaryRole = 'INDUSTRIA_PROCESSADORA'; // Mantém conservador até IA confirmar
      ownership = 'CORPORATIVO';
      confidence = 0.5; // Baixa confiança = vai acionar busca de IA
      note = 'Indústria em região de alta verticalização. Necessária busca avançada.';
    } else {
      // Provavelmente só processa
      primaryRole = 'INDUSTRIA_PROCESSADORA';
      ownership = capital > 100_000_000 ? 'CORPORATIVO' : 'FAMILIAR';
      confidence = 0.75;
      note = 'Indústria processadora. Não detectados sinais fortes de verticalização.';
    }
    
    return { primaryRole, ownership, realHectares, correctionNote: note, confidence };
  }
  
  // REGRA 5: Default genérico
  ownership = capital > 100_000_000 ? 'CORPORATIVO' : 'FAMILIAR';
  confidence = 0.3;
  note = 'Classificação incerta. Necessária análise manual ou busca avançada.';
  
  return { primaryRole, ownership, realHectares, correctionNote: note, confidence };
}

/**
 * Parse da resposta em texto livre da IA
 */
function parseAIResponse(responseText: string, fallback: SimplifiedAnalysis): SimplifiedAnalysis {
  
  const text = responseText.toUpperCase();
  
  let primaryRole: BusinessPersona['primaryRole'] = fallback.primaryRole;
  let ownership: BusinessPersona['ownership'] = fallback.ownership;
  let realHectares = 0;
  let confidence = 0.6;
  let note = '';
  
  // Extrai papel principal
  if (text.includes('VERTICALIZADA')) {
    primaryRole = 'VERTICALIZADA';
    note = 'Empresa verticalizada - cultiva E processa. ';
  } else if (text.includes('PRODUTOR')) {
    primaryRole = 'PRODUTOR';
    note = 'Produtor rural. ';
  } else if (text.includes('COOPERATIVA')) {
    primaryRole = 'COOPERATIVA';
    ownership = 'COOPERATIVA';
    note = 'Cooperativa de produtores. ';
  } else if (text.includes('TRADING') || text.includes('ARMAZEM')) {
    primaryRole = 'TRADING_ARMAZEM';
    note = 'Trading/Armazenador. ';
  } else if (text.includes('INDUSTRIA') || text.includes('PROCESSADORA')) {
    primaryRole = 'INDUSTRIA_PROCESSADORA';
    note = 'Indústria processadora sem cultivo próprio. ';
  }
  
  // Extrai propriedade
  if (text.includes('COOPERATIVA')) {
    ownership = 'COOPERATIVA';
  } else if (text.includes('CORPORATIVO') || text.includes('S.A') || text.includes('HOLDING')) {
    ownership = 'CORPORATIVO';
  } else if (text.includes('FAMILIAR')) {
    ownership = 'FAMILIAR';
  }
  
  // Extrai hectares se mencionados
  const hectaresMatch = responseText.match(/(\d{1,3}\.?\d{0,3})\s*(mil)?\s*hectares/i);
  if (hectaresMatch) {
    let val = parseInt(hectaresMatch[1].replace('.', ''));
    if (hectaresMatch[2]?.toLowerCase() === 'mil') {
      val *= 1000;
    }
    realHectares = val;
    note += `Área estimada: ${realHectares.toLocaleString('pt-BR')} ha. `;
  }
  
  // Extrai confiança
  if (text.includes('CONFIANÇA: ALTA') || text.includes('ALTA CONFIANÇA')) {
    confidence = 0.9;
  } else if (text.includes('CONFIANÇA: MÉDIA') || text.includes('MÉDIA CONFIANÇA')) {
    confidence = 0.6;
  } else if (text.includes('CONFIANÇA: BAIXA') || text.includes('BAIXA CONFIANÇA')) {
    confidence = 0.4;
  }
  
  // Extrai justificativa (pega até 200 caracteres após "JUSTIFICATIVA")
  const justMatch = responseText.match(/JUSTIFICATIVA:(.{0,200})/i);
  if (justMatch) {
    const rawJust = justMatch[1].trim().split('\n')[0];
    if (rawJust) note += rawJust;
  }
  
  return {
    primaryRole,
    ownership,
    realHectares,
    correctionNote: note || 'Análise baseada em busca avançada com IA.',
    confidence
  };
}

/**
 * Expande análise simplificada para o objeto completo BusinessPersona
 */
function expandToFullPersona(simple: SimplifiedAnalysis): BusinessPersona {
  let verticalization: BusinessPersona['verticalization'] = 'NONE';
  if (simple.primaryRole === 'VERTICALIZADA') verticalization = 'FULL';
  if (simple.primaryRole === 'PRODUTOR') verticalization = 'NONE'; 

  return {
    ...simple,
    verticalization,
    processingCapacity: null,
    cooperativeLinks: [],
    ecosystem: {
      role: `${simple.primaryRole} (${simple.ownership})`,
      upstreamPartners: [],
      downstreamPartners: []
    }
  };
}
