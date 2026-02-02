import { ProspectLead, ScoreBreakdown, AgroTacticalAnalysis, CnaeInfo } from "../types";

const cleanCNPJ = (val: string) => val.replace(/[^\d]/g, '');

const PUBLIC_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br', 
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'live.com', 
  'icloud.com', 'aol.com', 'protonmail.com'
];

const TITAN_DOMAINS = [
  'scheffer', 'amaggi', 'bomfuturo', 'polato', 'grupovisa', 
  'slcagricola', 'terrasbrasil', 'agroamazonia', 'vanguarda'
];

/**
 * 🧮 LÓGICA DE FATURAMENTO (EXATA DO IMPORTAR)
 */
const calculateEstimatedRevenue = (
    capital: number, 
    cnaes: string, 
    natureza: string, 
    isMatriz: boolean,
    corporateDomain: string | null
): number | null => {
  if (!capital || capital <= 0) return null;

  const natUpper = natureza.toUpperCase();
  const cnaesUpper = cnaes.toUpperCase();

  if (capital < 10000) return capital * 3.0;
  
  let multiplier = 2.0; 
  if (corporateDomain && TITAN_DOMAINS.some(titan => corporateDomain.toLowerCase().includes(titan))) {
      multiplier = 15.0;
  } else if ((cnaesUpper.includes("SEMENTE") || cnaesUpper.includes("GENETICA") || cnaesUpper.includes("BIOTECNOLOGIA")) && natUpper.includes("SOCIEDADE ANONIMA")) {
    multiplier = 35.0; 
  } else if (cnaesUpper.includes("COMERCIO ATACADISTA") || cnaesUpper.includes("EXPORTACAO")) {
    multiplier = 12.5; 
  }
  
  let estimated = capital * multiplier;
  if (natUpper.includes("SOCIEDADE ANONIMA") || natUpper.includes("S.A")) estimated *= 1.8;
  if (capital > 50000000) estimated *= 1.2;

  return estimated;
};

/**
 * 🧠 FUNÇÃO CENTRAL DE INTELIGÊNCIA (ICO/SCORE/BADGES)
 */
export const calculateLeadIntelligence = (params: {
    capitalSocial: number;
    cnaeDesc: string;
    natureza: string;
    razaoSocial: string;
    isMatriz: boolean;
    corporateDomain: string | null;
    yearsExistence: number;
    nomeFantasia?: string;
}) => {
    const { capitalSocial, cnaeDesc, natureza, razaoSocial, isMatriz, corporateDomain, yearsExistence, nomeFantasia } = params;

    // 1. Faturamento Estimado
    const estimatedRevenue = calculateEstimatedRevenue(capitalSocial, cnaeDesc, natureza, isMatriz, corporateDomain);

    // 2. Score ICO (S_fit / Operational Complexity)
    const vCap = Math.max(1, capitalSocial / 1000000);
    let iCult = 1.0;
    const todosCnaes = cnaeDesc.toUpperCase();
    if (todosCnaes.includes("ALGODAO") || todosCnaes.includes("FIBRA") || todosCnaes.includes("SEMENTE")) iCult = 1.5;
    
    let fVert = 1.0;
    if (todosCnaes.includes("BENEFICIAMENTO") || todosCnaes.includes("INDUSTRIA")) fVert = 1.3;
    
    let mGov = 0;
    const natUpper = natureza.toUpperCase();
    const nameUpper = razaoSocial.toUpperCase();
    const isCorporate = natUpper.includes("S.A") || natUpper.includes("ANÔNIMA") || nameUpper.includes("HOLDING");
    if (isCorporate) mGov = 150;
    
    const bStab = yearsExistence > 5 ? 50 : 0;

    const rawComplexityScore = (vCap * iCult * fVert) + mGov + bStab;
    const operationalComplexity = Math.min(1000, Math.round(rawComplexityScore));

    // 3. Score de Confiança Agro
    let confidence = 50;
    const tags: string[] = [];
    if (capitalSocial > 10000000) { confidence += 30; tags.push('BIG FISH'); }
    if (todosCnaes.includes('SOJA') || todosCnaes.includes('AGRICOLA') || nameUpper.includes('AGRO')) { 
        confidence += 20; 
        tags.push('CORE AGRO'); 
    }

    if (isCorporate) tags.push('CORPORATE S/A');
    if (corporateDomain) tags.push(`GRUPO ${corporateDomain}`);

    const fitLevel = operationalComplexity > 500 ? 'Alto' : operationalComplexity > 200 ? 'Médio' : 'Baixo';

    return {
        operationalComplexity,
        estimatedRevenue,
        badges: Array.from(new Set(tags)),
        fitLevel,
        confidence: Math.min(100, confidence),
        isSA: isCorporate,
        fVert: fVert,
        breakdown: { 
            financial: Math.min(10, capitalSocial / 100000), 
            legal: isCorporate ? 10 : 5, 
            verticalFit: fVert * 5, 
            operational: operationalComplexity / 100, 
            stability: yearsExistence / 2, 
            techReadiness: 5, 
            longevity: yearsExistence, 
            decisionPower: 8, 
            location: 0, 
            workforce: 0
        }
    };
};

/**
 * 📡 CLIENTE HTTP RESILIENTE
 */
const fetchWithRetry = async (url: string, retries = 2, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok && response.status === 429) throw new Error(`Status 429`);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (retries > 0) {
      await new Promise(res => setTimeout(res, 1000));
      return fetchWithRetry(url, retries - 1, timeout);
    }
    throw err;
  }
};

const extractCorporateDomain = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;
  const domainFull = email.split('@')[1].toLowerCase().trim();
  if (PUBLIC_DOMAINS.includes(domainFull)) return null;
  return domainFull.split('.')[0].toUpperCase();
};

const calculateYearsOfExistence = (dateString?: string): number => {
  if (!dateString) return 0;
  try {
    const start = new Date(dateString);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  } catch { return 0; }
};

export const enrichLeadWithRealData = async (lead: ProspectLead): Promise<ProspectLead> => {
  const cnpjLimpo = cleanCNPJ(lead.cnpj);
  if (!cnpjLimpo || cnpjLimpo.length < 11) return lead;

  let apiData: any = null;
  let status = 'ATIVO';

  try {
    const response = await fetchWithRetry(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    if (response.ok) {
        apiData = await response.json();
    } else {
        return { ...lead, isValidated: false, status: 'ERRO_AUDITORIA' };
    }
  } catch (error) {
    return { ...lead, isValidated: false, status: 'ERRO_CONEXAO' };
  }

  const capital = parseFloat(apiData.capital_social || "0");
  const razaoSocial = (apiData.razao_social || "").toUpperCase();
  const natureza = (apiData.natureza_juridica || "").toUpperCase();
  const isAtiva = apiData.descricao_situacao_cadastral === 'ATIVA'; 
  const cnaePrincipal = (apiData.cnae_fiscal_descricao || "").toUpperCase();
  const cnaeSecundarios = (apiData.cnaes_secundarios || []).map((c: any) => c.descricao.toUpperCase());
  
  const email = (apiData?.email || "").toLowerCase();
  const corporateDomain = extractCorporateDomain(email);
  const yearsExistence = calculateYearsOfExistence(apiData.data_inicio_atividade);

  const intel = calculateLeadIntelligence({
      capitalSocial: capital,
      cnaeDesc: [cnaePrincipal, ...cnaeSecundarios].join(" "),
      natureza: natureza,
      razaoSocial: razaoSocial,
      isMatriz: !lead.cnpj.includes("0001"),
      corporateDomain: corporateDomain,
      yearsExistence: yearsExistence,
      nomeFantasia: apiData?.nome_fantasia || lead.companyName
  });

  return {
    ...lead,
    companyName: razaoSocial || lead.companyName,
    isValidated: true,
    status: isAtiva ? 'ATIVO' : 'BAIXADO',
    capitalSocial: capital,
    activityCount: (cnaeSecundarios?.length || 0) + 1,
    isSA: intel.isSA,
    contactType: email.includes('contabil') ? 'Contabilidade' : 'Direto',
    estimatedRevenue: intel.estimatedRevenue,
    confidence: intel.confidence, 
    score: intel.operationalComplexity,
    fitLevel: intel.fitLevel,
    corporateDomain: corporateDomain || undefined,
    priority: Math.min(99, Math.max(10, Math.floor(intel.operationalComplexity / 10))),
    cnaes: [
        { code: '', description: cnaePrincipal, persona: 'PRODUTOR' },
        ...cnaeSecundarios.map((c: string) => ({ code: '', description: c, persona: 'OUTRO' as const }))
    ],
    breakdown: intel.breakdown,
    metadata: {
        ...lead.metadata,
        hectaresTotal: lead.metadata?.hectaresTotal || 0,
        fontes: lead.metadata?.fontes || [],
        urls: lead.metadata?.urls || [],
        hasGroup: !!corporateDomain || intel.badges.includes('BIG FISH')
    },
    tacticalAnalysis: {
      verticalizationScore: 50,
      badges: Array.from(new Set([...(lead.tacticalAnalysis?.badges || []), ...intel.badges])),
      salesComplexity: intel.isSA ? 'COMPLEXA/COMITE' : 'CONSULTIVA/SUCESSAO',
      goldenHook: intel.badges.includes('BIG FISH') ? "Alvo Estratégico Senior: Alto Capital Social." : "", 
      predictiveScore: intel.confidence,
      operationalComplexity: intel.operationalComplexity
    }
  };
};