
import { DossierAnalysisData, ExplainableScore, ScoreDimension, ProspectLead } from "../types";

// ============================================================================
// MOTOR SAS 4.0 (Senior Agro Score)
// Total: 0-1000 pontos | Pesos: Músculo (40%), Complexidade (25%), Gente (20%), Momento (15%)
// ============================================================================

// PILAR 1: MÚSCULO (0-400 pts)
function calculateMuscleScore(lead: ProspectLead): { score: number, evidences: string[] } {
  let score = 0;
  const evidences: string[] = [];

  // 1.1 Capital Social (Max 200)
  const cap = lead.capitalSocial || 0;
  let capScore = 0;
  if (cap > 50000000) capScore = 200;
  else if (cap > 10000000) capScore = 150;
  else if (cap > 2000000) capScore = 100;
  else if (cap > 500000) capScore = 50;
  
  score += capScore;
  if (capScore > 0) evidences.push(`Capital Social: R$ ${(cap/1000000).toFixed(1)}MM (+${capScore} pts)`);

  // 1.2 Hectares (Max 200)
  const ha = lead.metadata?.hectaresTotal || 0;
  let haScore = 0;
  if (ha > 10000) haScore = 200;
  else if (ha > 5000) haScore = 150;
  else if (ha > 2000) haScore = 100;
  else if (ha > 500) haScore = 50;

  score += haScore;
  if (haScore > 0) evidences.push(`Área Plantada: ${ha} ha (+${haScore} pts)`);
  else if (lead.metadata?.hectaresTotal === undefined && lead.estimatedRevenue && lead.estimatedRevenue > 50000000) {
     // Fallback se não tiver hectares mas tiver faturamento alto
     score += 100;
     evidences.push(`Área Estimada (Silo/Receita): Grande Porte (+100 pts)`);
  }

  return { score: Math.min(score, 400), evidences };
}

// PILAR 2: COMPLEXIDADE (0-250 pts)
function calculateComplexityScore(lead: ProspectLead): { score: number, evidences: string[] } {
  let score = 0;
  const evidences: string[] = [];

  // 2.1 Cultura (Max 150)
  const cnaes = (lead.cnaes || []).map(c => c.description.toLowerCase()).join(' ');
  const companyName = lead.companyName.toLowerCase();
  
  let culturaScore = 30; // Base Pecuária
  let culturaNome = "Pecuária/Mista";

  if (cnaes.includes('soja') || cnaes.includes('milho') || cnaes.includes('cereais')) {
    culturaScore = 80;
    culturaNome = "Grãos (Soja/Milho)";
  }
  if (cnaes.includes('algodao') || cnaes.includes('algodão') || cnaes.includes('cafe')) {
    culturaScore = 120;
    culturaNome = "Algodão/Café";
  }
  if (cnaes.includes('semente') || cnaes.includes('horti') || companyName.includes('sementes')) {
    culturaScore = 150;
    culturaNome = "Sementes/HF (Alta Complexidade)";
  }
  if (cnaes.includes('usina') || cnaes.includes('acucar') || cnaes.includes('etanol')) {
    culturaScore = 200;
    culturaNome = "Usina/Bioenergia";
  }

  score += culturaScore;
  evidences.push(`Cultura Principal: ${culturaNome} (+${culturaScore} pts)`);

  // 2.2 Verticalização (Max 100)
  let vertScore = 0;
  const infra = (lead.tacticalAnalysis?.badges || []).join(' ');
  
  if (cnaes.includes('armazem') || cnaes.includes('silo') || infra.includes('Silo')) {
    vertScore += 30;
    evidences.push("Possui Silos/Armazenagem (+30 pts)");
  }
  if (cnaes.includes('beneficiamento') || cnaes.includes('industria') || (lead.capitalSocial || 0) > 20000000) {
    vertScore += 50;
    evidences.push("Agroindústria Detectada (+50 pts)");
  }
  if (cnaes.includes('transporte') || cnaes.includes('logistica')) {
    vertScore += 20;
    evidences.push("Logística Própria (+20 pts)");
  }

  score += Math.min(vertScore, 100);
  
  return { score: Math.min(score, 250), evidences };
}

// PILAR 3: GENTE (0-200 pts)
function calculatePeopleScore(lead: ProspectLead): { score: number, evidences: string[] } {
  let score = 0;
  const evidences: string[] = [];

  // 3.1 Estimativa de Funcionários via Capital Social (Proxy)
  // R$ 10M Capital ~ 50 Funcionários (Agro é capital intensivo, não labor intensivo, exceto usinas)
  const capital = lead.capitalSocial || 0;
  const estimatedEmployees = Math.ceil(capital / 300000); 
  let funcScore = 0;

  if (estimatedEmployees > 500) funcScore = 120;
  else if (estimatedEmployees > 200) funcScore = 90;
  else if (estimatedEmployees > 50) funcScore = 60;
  else if (estimatedEmployees > 10) funcScore = 30;

  score += funcScore;
  evidences.push(`Est. Funcionários: ~${estimatedEmployees} (+${funcScore} pts)`);

  // 3.2 Risco HCM & Gestão (Max 80)
  // Gestão Profissional? (Não ter nome de pessoa na razão social ou ser S.A)
  const isFamilyName = lead.companyName.includes('AGROPECUARIA') || lead.companyName.split(' ').length < 3;
  if (lead.isSA || !isFamilyName) {
    score += 40;
    evidences.push("Gestão Profissional (+40 pts)");
  } else {
    evidences.push("Gestão Familiar (Potencial Profissionalização)");
  }

  // Benefícios/CLT (Assumimos positivo para grandes empresas)
  if (capital > 5000000) {
    score += 30;
    evidences.push("Estrutura CLT Provável (+30 pts)");
  }

  return { score: Math.min(score, 200), evidences };
}

// PILAR 4: MOMENTO (0-150 pts)
function calculateMomentScore(lead: ProspectLead): { score: number, evidences: string[] } {
  let score = 0;
  const evidences: string[] = [];

  // 4.1 Governança (Max 70)
  if (lead.isSA) {
    score += 50;
    evidences.push("Sociedade Anônima (S.A.) (+50 pts)");
  } else if (lead.companyName.toUpperCase().includes('LTDA')) {
    score += 25; 
    evidences.push("Sociedade Limitada Sólida (+25 pts)");
  }

  // 4.2 Maturidade Digital (Max 80)
  const hasSite = lead.metadata?.urls?.some(u => !u.includes('google') && !u.includes('cnpjs') && !u.includes('econodata'));
  if (hasSite) {
    score += 20;
    evidences.push("Presença Digital Ativa (+20 pts)");
  }
  
  // Bonus por tecnologia detectada nos badges
  if (lead.tacticalAnalysis?.badges?.includes('Tecnologia') || lead.tacticalAnalysis?.badges?.includes('CONECTIVIDADE')) {
    score += 25;
    evidences.push("Investimento em Tech (+25 pts)");
  }

  return { score: Math.min(score, 150), evidences };
}

// FUNÇÃO PRINCIPAL DE CÁLCULO
export function calculateExplainableScore(lead: ProspectLead): ExplainableScore {
  const muscle = calculateMuscleScore(lead);
  const complexity = calculateComplexityScore(lead);
  const people = calculatePeopleScore(lead);
  const moment = calculateMomentScore(lead);

  const scoreTotal = muscle.score + complexity.score + people.score + moment.score;

  const dimensions: ScoreDimension[] = [
    { name: "Músculo (Capital + Terra)", score: muscle.score, weight: 0.40, evidences: muscle.evidences },
    { name: "Complexidade (Cultura + Infra)", score: complexity.score, weight: 0.25, evidences: complexity.evidences },
    { name: "Gente (HCM + Gestão)", score: people.score, weight: 0.20, evidences: people.evidences },
    { name: "Momento (Gov + Digital)", score: moment.score, weight: 0.15, evidences: moment.evidences },
  ];

  // DEFINIÇÃO DE TIERS (CLASSIFICAÇÃO)
  let recommendation = "🥉 BRONZE";
  if (scoreTotal > 750) recommendation = "💎 DIAMANTE";
  else if (scoreTotal > 500) recommendation = "🥇 OURO";
  else if (scoreTotal > 250) recommendation = "🥈 PRATA";

  return {
    scoreTotal,
    dimensions,
    recommendation
  };
}

// Mapeador para compatibilidade (legacy)
export function calculateLegacyScore(lead: ProspectLead): number {
    return calculateExplainableScore(lead).scoreTotal;
}
