import { ProspectLead, ScoreBreakdown, AgroTacticalAnalysis, CnaeInfo } from "../types";

const cleanCNPJ = (val: string) => val.replace(/[^\d]/g, '');

const PUBLIC_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br', 
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'live.com', 
  'icloud.com', 'aol.com', 'protonmail.com'
];

// Domínios que ativam multiplicadores agressivos (Big Players conhecidos)
const TITAN_DOMAINS = [
  'scheffer', 'amaggi', 'bomfuturo', 'polato', 'grupovisa', 
  'slcagricola', 'terrasbrasil', 'agroamazonia', 'vanguarda'
];

/**
 * 📧 EXTRAÇÃO DE DOMÍNIO CORPORATIVO
 */
const extractCorporateDomain = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;
  const domainFull = email.split('@')[1].toLowerCase().trim();
  if (PUBLIC_DOMAINS.includes(domainFull)) return null;
  const domainName = domainFull.split('.')[0];
  if (domainName.includes('contabil') || domainName.includes('contabilidade') || domainName.includes('assessoria')) {
      return null;
  }
  return domainName.toUpperCase();
};

/**
 * 📡 CLIENTE HTTP RESILIENTE
 */
const fetchWithRetry = async (url: string, retries = 3, timeout = 15000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    
    if (!response.ok && (response.status >= 500 || response.status === 429)) {
        throw new Error(`Status ${response.status}`);
    }
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (retries > 0) {
      // console.warn(`♻️ Retrying API... (${retries} left)`); // Log limpo do console do usuário
      await new Promise(res => setTimeout(res, 2000));
      return fetchWithRetry(url, retries - 1, timeout);
    }
    if (url.includes('brasilapi') && !url.includes('corsproxy')) {
        // console.warn("🔄 Switching to CORS Proxy..."); // Log limpo
        return fetchWithRetry(`https://corsproxy.io/?${encodeURIComponent(url)}`, 0, 15000);
    }
    throw err;
  }
};

/**
 * 🧮 FÓRMULA BLINDADA DE FATURAMENTO
 * Agora com trava rígida para capital baixo.
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

  // --- TRAVA DE SEGURANÇA ABSOLUTA (CAPITAL BAIXO) ---
  // Se Capital < 10k, trava em 3x (Evita que R$ 1.000 vire milhões)
  if (capital < 10000) {
      return capital * 3.0;
  }

  // --- TRAVA DE SEGURANÇA RELATIVA (LTDA PADRÃO) ---
  if ((natUpper.includes("LIMITADA") || natUpper.includes("LTDA")) && capital < 100000) {
      return capital * 3.0;
  }

  let multiplier = 2.0; // Base Agro

  // --- MULTIPLICADORES DE ALTA ALAVANCAGEM ---
  if (corporateDomain && TITAN_DOMAINS.some(titan => corporateDomain.toLowerCase().includes(titan))) {
      multiplier = 15.0; // Corporate Automático via Domínio
  }
  else if ((cnaesUpper.includes("SEMENTE") || cnaesUpper.includes("GENETICA") || cnaesUpper.includes("BIOTECNOLOGIA")) && natUpper.includes("SOCIEDADE ANONIMA")) {
    multiplier = 35.0; 
  }
  else if (cnaesUpper.includes("COMERCIO ATACADISTA") || cnaesUpper.includes("EXPORTACAO")) {
    multiplier = 12.5; 
  }
  else if (cnaesUpper.includes("FRIGORIFICO") || cnaesUpper.includes("ABATE")) {
    multiplier = 5.0; 
  }
  else if (cnaesUpper.includes("BENEFICIAMENTO") || cnaesUpper.includes("INDUSTRIA")) {
    multiplier = 4.0;
  }
  
  let estimated = capital * multiplier;

  if (natUpper.includes("SOCIEDADE ANONIMA") || natUpper.includes("S.A")) {
    estimated *= 1.8;
  }

  if (capital > 50000000) {
    estimated *= 1.2;
  }

  return estimated;
};

const calculateYearsOfExistence = (dateString?: string): number => {
  if (!dateString) return 0;
  try {
    const start = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  } catch {
    return 0;
  }
};

/**
 * MOCK HIGH-FIDELITY (Apenas DTI Sementes - Demo)
 */
const getHighFidelityMock = (cnpj: string, originalName: string) => {
  const clean = cnpj.replace(/[^\d]/g, '');
  const nameUpper = (originalName || "").toUpperCase();
  
  if (clean.includes("14894223") || nameUpper.includes("DTI SEMENTES")) {
     return {
        razao_social: "DTI SEMENTES E AGRONEGOCIOS S.A.",
        nome_fantasia: "DTI SEMENTES",
        capital_social: 14900000, 
        natureza_juridica: "SOCIEDADE ANONIMA FECHADA", 
        cnae_fiscal_descricao: "PRODUCAO DE SEMENTES CERTIFICADAS", 
        cnaes_secundarios: [
            { descricao: "COMERCIO ATACADISTA DE SEMENTES" },
            { descricao: "BENEFICIAMENTO DE SEMENTES" },
            { descricao: "CULTIVO DE SOJA" }
        ],
        descricao_situacao_cadastral: "ATIVA",
        municipio: "CAMPO VERDE",
        uf: "MT",
        data_inicio_atividade: "2011-08-15",
        email: "diretoria@dtisementes.com.br"
     };
  }
  return null;
};

export const enrichLeadWithRealData = async (lead: ProspectLead): Promise<ProspectLead> => {
  const cnpjLimpo = cleanCNPJ(lead.cnpj);
  let isOfflineData = false;
  let apiData: any = null;

  try {
    // 1. Tenta Mock Específico (Demo)
    const mockData = getHighFidelityMock(cnpjLimpo, lead.companyName);
    
    if (mockData) {
        apiData = mockData;
    } else {
        // 2. Busca API Real
        const response = await fetchWithRetry(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
        if (!response.ok) throw new Error("API Error");
        apiData = await response.json();
    }
  } catch (error) {
    console.error("API Failed, falling back to CSV data:", error);
    isOfflineData = true;
    // Em caso de erro, não inventa dados. Marca flag para usar o que veio do CSV.
  }

  // --- DADOS ORIGINAIS OU DA API ---
  // Se a API falhou, usamos os dados que já estavam no lead (CSV)
  const capital = apiData ? parseFloat(apiData.capital_social || "0") : (lead.capitalSocial || 0);
  const razaoSocial = apiData ? (apiData.razao_social || "").toUpperCase() : lead.companyName.toUpperCase();
  const natureza = apiData ? (apiData.natureza_juridica || "").toUpperCase() : (lead.isSA ? "SOCIEDADE ANONIMA" : "LIMITADA");
  const isAtiva = apiData ? apiData.descricao_situacao_cadastral === 'ATIVA' : true; // Assume ativo se veio do CSV recente
  
  // CNAEs: Se API falhou, tenta usar descrição do negócio ou CNAEs prévios
  const cnaePrincipal = apiData ? (apiData.cnae_fiscal_descricao || "").toUpperCase() : (lead.businessType || "").toUpperCase();
  const cnaeSecundarios = apiData ? (apiData.cnaes_secundarios || []).map((c: any) => c.descricao.toUpperCase()) : [];
  const todosCnaes = [cnaePrincipal, ...cnaeSecundarios].join(" ").toUpperCase();
  
  const email = (apiData?.email || lead.email || "").toLowerCase();
  const isContador = email.includes('contabil') || email.includes('assessoria') || email.includes('escritorio');
  const corporateDomain = extractCorporateDomain(email);

  // 3. Execução da Fórmula Blindada
  const isMatriz = !lead.cnpj.includes("0001");
  const estimatedRevenue = calculateEstimatedRevenue(capital, todosCnaes, natureza, isMatriz, corporateDomain);

  // --- CÁLCULO S_fit ---
  const vCap = Math.max(1, capital / 1000000);
  let iCult = 1.0;
  if (todosCnaes.includes("ALGODAO") || todosCnaes.includes("FIBRA") || todosCnaes.includes("SEMENTE")) iCult = 1.5;
  else if (todosCnaes.includes("BOVINOS") && !todosCnaes.includes("SOJA")) iCult = 0.8;
  
  let fVert = 1.0;
  if (todosCnaes.includes("BENEFICIAMENTO") || todosCnaes.includes("INDUSTRIA") || todosCnaes.includes("ARMAZEM") || todosCnaes.includes("SILO")) fVert = 1.3;
  
  let mGov = 0;
  const isCorporate = natureza.includes("S.A") || natureza.includes("ANÔNIMA") || razaoSocial.includes("HOLDING");
  if (isCorporate) mGov = 150;
  else if (natureza.includes("LIMITADA") || natureza.includes("LTDA")) mGov = 50;
  
  const yearsExistence = apiData ? calculateYearsOfExistence(apiData.data_inicio_atividade) : 5; // Default 5 se offline
  const bStab = yearsExistence > 5 ? 50 : 0;

  const rawComplexityScore = (vCap * iCult * fVert) + mGov + bStab;
  const operationalComplexity = Math.min(1000, Math.round(rawComplexityScore));

  // --- BADGES INTELIGENTES (POR PALAVRA-CHAVE DE CNAE) ---
  let badges: string[] = [];

  if (!isAtiva) {
    badges.push('BAIXADA');
  } else {
    // Top 1% apenas se receita > 500MM
    if (estimatedRevenue && estimatedRevenue > 500000000) {
        badges.push('TOP 1% AGRO');
    } 
    // Corporate S/A
    else if (isCorporate) {
        badges.push('CORPORATE S/A');
    }

    if (corporateDomain) badges.push(`GRUPO ${corporateDomain}`);

    // CNAE Badges Específicos
    if (todosCnaes.includes("TRANSPORTE") || todosCnaes.includes("LOGISTICA") || todosCnaes.includes("RODOVIARIO")) {
        badges.push('🚚 LOGÍSTICA');
    }
    if (todosCnaes.includes("ARMAZEM") || todosCnaes.includes("SILOS") || todosCnaes.includes("DEPOSITO")) {
        badges.push('🏗️ SILOS/ARMAZÉM');
    }
    if (todosCnaes.includes("SEMENTE") || todosCnaes.includes("GENETICA")) {
        badges.push('🌱 SEMENTES');
    }
    if (todosCnaes.includes("COMERCIO") || todosCnaes.includes("REVENDA") || todosCnaes.includes("ATACADISTA")) {
        badges.push('🤝 TRADING/REVENDA');
    }
    if (todosCnaes.includes("INDUSTRIA") || fVert > 1.0) {
        badges.push('🏭 INDÚSTRIA');
    }
    if (todosCnaes.includes("ALGODAO")) {
        badges.push('☁️ ALGODÃO');
    }

    if (isContador) {
       if (capital > 20000000) badges.push('OPORT. INTERNALIZAÇÃO');
       else badges.push('TERCEIRIZADO');
    }
  }

  // Breakdown Visual
  let breakdown: ScoreBreakdown = { 
      financial: Math.min(10, capital / 100000), 
      legal: isCorporate ? 10 : 5, 
      verticalFit: fVert * 5, 
      operational: operationalComplexity / 100, 
      stability: yearsExistence / 2, 
      techReadiness: isContador ? 2 : 8, 
      longevity: yearsExistence, 
      decisionPower: 8, 
      location: 0, 
      workforce: 0
  };

  return {
    ...lead,
    isValidated: !isOfflineData, // Se offline, não está validado na Receita
    status: isAtiva ? 'ATIVO' : 'BAIXADO',
    capitalSocial: capital,
    activityCount: (cnaeSecundarios?.length || 0) + 1,
    isSA: isCorporate,
    contactType: isContador ? 'Contabilidade' : 'Direto',
    estimatedRevenue: estimatedRevenue,
    confidence: isAtiva ? (isOfflineData ? 50 : 90) : 0, // Confiança menor se offline
    score: operationalComplexity,
    fitLevel: operationalComplexity > 500 ? 'Alto' : operationalComplexity > 200 ? 'Médio' : 'Baixo',
    corporateDomain: corporateDomain || undefined,
    priority: Math.min(99, Math.max(10, Math.floor(operationalComplexity / 10))),
    cnaes: apiData ? [
        { code: '', description: cnaePrincipal, persona: 'PRODUTOR' },
        ...cnaeSecundarios.map((c: string) => ({ code: '', description: c, persona: 'OUTRO' as const }))
    ] : lead.cnaes, // Mantém CNAEs originais se offline
    breakdown: breakdown,
    metadata: {
        ...lead.metadata,
        hectaresTotal: lead.metadata?.hectaresTotal || 0,
        fontes: lead.metadata?.fontes || [],
        formatos: lead.metadata?.formatos || [],
        urls: lead.metadata?.urls || [],
        contextos: lead.metadata?.contextos || [],
        hasGroup: !!corporateDomain // Flag simples
    },
    // Flag de metadados para UI saber que é dado offline
    // Usamos um campo opcional existente ou injetamos no tacticalAnalysis
    tacticalAnalysis: {
      verticalizationScore: 50,
      badges: badges,
      salesComplexity: isCorporate ? 'COMPLEXA/COMITE' : 'CONSULTIVA/SUCESSAO',
      goldenHook: isOfflineData ? "Dados do CSV (Não validado online)" : "", 
      predictiveScore: 0,
      operationalComplexity: operationalComplexity,
      isPotentialHomonym: isOfflineData // Usando este booleano existente como proxy para "Flag de Atenção"
    }
  };
};