
// ==================== INTERFACES ====================

export interface SASResult {
  sas_final: number;                    // 0-1000 pontos
  confidence_score: number;             // 0-100%
  tier: 'DIAMANTE' | 'OURO' | 'PRATA' | 'BRONZE';
  pilar_musculo: number;                // 0-400 pts
  pilar_complexidade: number;           // 0-250 pts
  pilar_gente: number;                  // 0-200 pts
  pilar_momento: number;                // 0-150 pts
  flags: {
    big_fish: boolean;                  // Capital >50M
    sementeiro: boolean;                // CNAE 0119
    s_a: boolean;                       // S.A.
  };
  breakdown: {
    capital_pts: number;
    hectares_pts: number;
    cultura_pts: number;
    verticalizacao_pts: number;
    funcionarios_pts: number;
    gestao_pts: number;
    natureza_pts: number;
    presenca_pts: number;
  };
}

export interface LeadInput {
  razao_social: string;
  capital_social: number;               // R$
  hectares: number;
  natureza_juridica: 'S.A.' | 'Ltda' | 'Cooperativa' | string;
  cultura_principal?: string;
  cnae_principal?: string;
  funcionarios: number;
  // Estrutura operacional
  agroindustria?: boolean;
  silos?: boolean;
  logistica?: boolean;
  dominio?: boolean;
  vagas_ti?: boolean;
  conectividade?: boolean;
  cnpj?: string;
}

// ==================== LOOKUP TABLES (FÓRMULA EXATA) ====================

function lookupCapital(capital: number): number {
  if (capital >= 100_000_000) return 200;   // >R$ 100M
  if (capital >= 50_000_000) return 150;    // R$ 50-100M
  if (capital >= 10_000_000) return 100;    // R$ 10-50M
  if (capital >= 1_000_000) return 50;      // R$ 1-10M
  return 0;
}

function lookupHectares(hectares: number): number {
  if (hectares >= 50_000) return 200;       // >50k ha
  if (hectares >= 10_000) return 150;       // 10-50k ha
  if (hectares >= 3_000) return 100;        // 3-10k ha
  if (hectares >= 500) return 50;           // 500-3k ha
  return 0;
}

function lookupCultura(cultura: string): number {
  if (!cultura) return 50;
  const culturaLower = cultura.toLowerCase();
  
  // Ordem decrescente de complexidade
  if (culturaLower.includes('bioenergia') || culturaLower.includes('cana')) return 150;
  if (culturaLower.includes('semente') || culturaLower.includes('seed')) return 130;
  if (culturaLower.includes('algod') || culturaLower.includes('cotton')) return 120;
  if (culturaLower.includes('café') || culturaLower.includes('cafe') || culturaLower.includes('coffee')) return 110;
  if (culturaLower.includes('soja') || culturaLower.includes('milho') || culturaLower.includes('gr')) return 80;
  if (culturaLower.includes('pecuária') || culturaLower.includes('pecuaria') || culturaLower.includes('gado') || culturaLower.includes('boi')) return 30;
  
  return 50; // Default
}

function lookupFuncionarios(funcionarios: number): number {
  if (funcionarios >= 500) return 120;
  if (funcionarios >= 200) return 90;
  if (funcionarios >= 100) return 60;
  if (funcionarios >= 50) return 30;
  return 0;
}

function lookupNatureza(natureza: string): number {
  if (!natureza) return 10;
  if (natureza === 'S.A.' || natureza.includes('Sociedade Anônima') || natureza.includes('S/A')) return 50;
  if (natureza === 'Cooperativa') return 15;
  if (natureza === 'Ltda') return 20;
  return 10;
}

// ==================== HELPERS ====================

function isNomeLimpo(razao: string): boolean {
  // Retorna true se NÃO for empresa familiar explícita
  return !/(familia|familias|ltda me|mei|eireli)/i.test(razao);
}

function isSementeiro(cnae: string): boolean {
  if (!cnae) return false;
  // CNAEs sementes: 0119-6, 0115-3
  return /^011[59]/i.test(cnae);
}

// ==================== MOTOR SAS 4.0 - CÁLCULO PRINCIPAL ====================

export function calculateSeniorAgroScore(lead: LeadInput): SASResult {
  
  // ========== PILAR 1: MÚSCULO (400 pts máx) ==========
  const capital_pts = lookupCapital(lead.capital_social || 0);
  const hectares_pts = lookupHectares(lead.hectares || 0);
  const pilar_musculo = Math.min(capital_pts + hectares_pts, 400);
  
  // ========== PILAR 2: COMPLEXIDADE (250 pts máx) ==========
  const cultura_pts = lookupCultura(lead.cultura_principal || '');
  
  const verticalizacao_pts = Math.min(
    (lead.agroindustria ? 50 : 0) +
    (lead.silos ? 30 : 0) +
    (lead.logistica ? 20 : 0),
    100
  );
  
  let complexidade_bruto = Math.min(cultura_pts + verticalizacao_pts, 250);
  
  // REGRA ESPECIAL: Sementeiro +15% no pilar (cap 250)
  const is_sementeiro = isSementeiro(lead.cnae_principal || '');
  if (is_sementeiro) {
    complexidade_bruto = Math.min(complexidade_bruto * 1.15, 250);
  }
  
  const pilar_complexidade = Math.round(complexidade_bruto);
  
  // ========== PILAR 3: GENTE (200 pts máx) ==========
  const funcionarios_pts = lookupFuncionarios(lead.funcionarios || 0);
  
  const gestao_pts = Math.min(
    (lead.natureza_juridica === 'S.A.' ? 40 : 0) +
    (isNomeLimpo(lead.razao_social) ? 20 : 0) +
    (lead.funcionarios >= 50 ? 20 : 0), // Proxy CLT robusta
    80
  );
  
  const pilar_gente = Math.min(funcionarios_pts + gestao_pts, 200);
  
  // ========== PILAR 4: MOMENTO (150 pts máx) ==========
  const natureza_pts = lookupNatureza(lead.natureza_juridica || '');
  
  const presenca_pts = Math.min(
    (lead.dominio ? 20 : 0) +
    (lead.vagas_ti ? 25 : 0) +
    (lead.conectividade ? 20 : 0) +
    15, // Proxy redes sociais (assumido padrão agro)
    80
  );
  
  const pilar_momento = Math.min(natureza_pts + presenca_pts, 150);
  
  // ========== BÔNUS & FLAGS ==========
  const is_s_a = lead.natureza_juridica === 'S.A.' || lead.natureza_juridica?.includes('S/A');
  const is_big_fish = (lead.capital_social || 0) >= 50_000_000;
  
  const bonus = is_s_a ? 50 : 0;
  
  const flags = {
    big_fish: is_big_fish,
    sementeiro: is_sementeiro,
    s_a: is_s_a
  };
  
  // ========== CONFIDENCE SCORE (0-100%) ==========
  const confidence_score = computeConfidence(lead);
  
  // ========== SAS BRUTO ==========
  let sas_bruto = pilar_musculo + pilar_complexidade + pilar_gente + pilar_momento + bonus;
  
  // PENALIDADE: Confidence <50% reduz 10%
  if (confidence_score < 50) {
    sas_bruto *= 0.90;
  }
  
  const sas_final = Math.max(0, Math.min(Math.round(sas_bruto), 1000));
  
  // ========== TIER CLASSIFICATION ==========
  let tier: SASResult['tier'] = 'BRONZE';
  
  if (sas_final >= 751) tier = 'DIAMANTE';
  else if (sas_final >= 501) tier = 'OURO';
  else if (sas_final >= 251) tier = 'PRATA';
  
  // BIG FISH OVERRIDE: Capital >50M + Prata → upgrade Ouro
  if (is_big_fish && tier === 'PRATA') {
    tier = 'OURO';
  }
  
  // ========== RETURN ==========
  return {
    sas_final,
    confidence_score,
    tier,
    pilar_musculo,
    pilar_complexidade,
    pilar_gente,
    pilar_momento,
    flags,
    breakdown: {
      capital_pts,
      hectares_pts,
      cultura_pts,
      verticalizacao_pts,
      funcionarios_pts,
      gestao_pts,
      natureza_pts,
      presenca_pts
    }
  };
}

// ==================== CONFIDENCE CALCULATOR ====================

function computeConfidence(lead: LeadInput): number {
  const campos = [
    { field: (lead.capital_social || 0) > 0, peso: 20 },
    { field: (lead.hectares || 0) > 0, peso: 20 },
    { field: lead.natureza_juridica && lead.natureza_juridica !== '', peso: 15 },
    { field: lead.cultura_principal && lead.cultura_principal !== '', peso: 15 },
    { field: lead.cnpj && lead.cnpj !== '', peso: 15 },
    { field: lead.cnae_principal && lead.cnae_principal !== '', peso: 15 }
  ];
  
  return campos.reduce((acc, c) => acc + (c.field ? c.peso : 0), 0);
}

// ==================== UI HELPERS ====================

export function getTierColor(tier: SASResult['tier']): string {
  const colors = {
    'DIAMANTE': 'bg-gradient-to-br from-blue-600 to-indigo-700',
    'OURO': 'bg-gradient-to-br from-amber-400 to-yellow-500',
    'PRATA': 'bg-gradient-to-br from-gray-400 to-slate-500',
    'BRONZE': 'bg-gradient-to-br from-orange-600 to-red-600'
  };
  return colors[tier] || colors['BRONZE'];
}

export function getTierEmoji(tier: SASResult['tier']): string {
  const emojis = {
    'DIAMANTE': '💎',
    'OURO': '🥇',
    'PRATA': '🥈',
    'BRONZE': '🥉'
  };
  return emojis[tier];
}

export function getTierLabel(tier: SASResult['tier']): string {
  return tier;
}

// ==================== COMPATIBILIDADE LEGADO ====================

// Para manter compatibilidade com código existente
export { calculateSeniorAgroScore as calculateSASScore };
