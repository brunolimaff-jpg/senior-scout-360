import { AgroProfile, SeniorAgroScoreResult, ScorePillar, AgroTier } from '../types';

const PILLAR_CAP = 250;
const MAX_SCORE = 1000;

export const calculateSeniorAgroScore = (profile: AgroProfile): SeniorAgroScoreResult => {
  // --- 1. PILAR MÚSCULO (Escala Física ou Financeira) ---
  const pMusculo = calculateMuscle(profile);
  
  // --- 2. PILAR COMPLEXIDADE (Dor Operacional) ---
  const pComplexidade = calculateComplexity(profile);

  // --- 3. PILAR GENTE & GOVERNANÇA (Risco) ---
  const pGente = calculatePeopleAndGovernance(profile);

  // --- 4. PILAR MOMENTO (Prontidão) ---
  const pMomento = calculateMoment(profile);

  // --- TOTALIZAÇÃO ---
  const totalScore = Math.min(
    pMusculo.score + pComplexidade.score + pGente.score + pMomento.score, 
    MAX_SCORE
  );

  // --- CLASSIFICAÇÃO (TIER) - Ajuste de Réguas (Novas Faixas) ---
  let tier: AgroTier = 'BRONZE';
  if (totalScore > 750) tier = 'DIAMANTE';      // 751 - 1000 (Azul Premium)
  else if (totalScore > 500) tier = 'OURO';     // 501 - 750 (Amber/Gold)
  else if (totalScore > 250) tier = 'PRATA';    // 251 - 500 (Silver/Corporate)
  // 0 - 250 é Bronze (Neutro)

  const solutions = recommendSolutions(profile, totalScore, tier);

  return {
    totalScore,
    tier,
    pillars: { musculo: pMusculo, complexidade: pComplexidade, gente: pGente, momento: pMomento },
    auditLog: [...pMusculo.details, ...pComplexidade.details],
    recommendedSolutions: solutions
  };
};

// --- SUB-MOTORES RECALIBRADOS ---

const calculateMuscle = (p: AgroProfile): ScorePillar => {
  let score = 0;
  const details: string[] = [];

  // 1. Pontos por Hectare (Base Física)
  let scoreHa = 0;
  if (p.hectares > 30000) scoreHa = 250;
  else if (p.hectares > 10000) scoreHa = 200;
  else if (p.hectares > 5000) scoreHa = 150;
  else if (p.hectares > 1000) scoreHa = 80;

  // 2. Pontos por Perfil Industrial (Base de Valor)
  let scoreCap = 0;
  if (p.atividadePrincipal === 'INDUSTRIA' || p.atividadePrincipal === 'SEMENTE') {
     scoreCap = 220; // Indústria tem "Músculo Financeiro" alto por default
  }

  // Define score base pelo maior indicador
  if (scoreCap > scoreHa) {
    score = scoreCap;
    details.push("🏭 Força Industrial (Alto Valor Agregado)");
  } else {
    score = scoreHa;
    if (score > 0) details.push(`🚜 Força Produtiva: ${p.hectares.toLocaleString('pt-BR')} ha`);
  }

  // --- REGRA DE NEGÓCIO UNIVERSAL (PISO CORPORATIVO) ---
  // Grupos Econômicos e S.A. possuem lastro financeiro que muitas vezes não aparece em hectares no CNPJ principal.
  // Garante um piso de 180 pontos (Tier Prata/Corporate garantido no pilar)
  if ((p.isGrupoEconomico || p.isSA) && score < 180) {
    score = 180;
    details.push("🏢 Força Corporativa (Grupo/S.A. - Piso Garantido)");
  }

  // 3. Bônus de Ativos (Verticalização)
  if (p.temArmazem) { score += 30; details.push("📦 Silos Próprios"); }
  if (p.temFrota) { score += 20; details.push("🚛 Frota Própria"); }

  return { name: "Músculo (Escala)", score: Math.min(score, PILLAR_CAP), max: PILLAR_CAP, details };
};

const calculateComplexity = (p: AgroProfile): ScorePillar => {
  let score = 0;
  const details: string[] = [];

  switch (p.atividadePrincipal) {
    case 'INDUSTRIA':
    case 'SEMENTE': // Sementes agora pontua MÁXIMO igual Indústria
      score += 250;
      details.push("🧬 Complexidade Industrial/Genética (Crítica)");
      break;
    case 'ALGODAO':
      score += 200;
      details.push("☁️ Algodão (Alta Tecnologia)");
      break;
    case 'CANA':
    case 'MISTO':
      score += 150;
      details.push("🔄 Operação Mista/Usinas");
      break;
    case 'SOJA':
    case 'MILHO':
      score += 100;
      details.push("🌾 Grãos (Produção Padrão)");
      break;
    default:
      score += 50;
  }
  
  if (p.temIrrigacao) { score += 50; details.push("💧 Irrigação (Pivô)"); }

  return { name: "Complexidade", score: Math.min(score, PILLAR_CAP), max: PILLAR_CAP, details };
};

const calculatePeopleAndGovernance = (p: AgroProfile): ScorePillar => {
  let score = 0;
  const details: string[] = [];

  // Motor HCM
  let baseHcm = 0;
  // Se for indústria, o multiplicador de gente é maior
  const multiplier = (p.atividadePrincipal === 'INDUSTRIA' || p.atividadePrincipal === 'SEMENTE') ? 1.5 : 1.0;
  
  if (p.funcionarios >= 1000) baseHcm = 250;
  else if (p.funcionarios >= 500) baseHcm = 200;
  else if (p.funcionarios >= 200) baseHcm = 150;
  else if (p.funcionarios >= 50) baseHcm = 80;
  else baseHcm = 30;

  score += Math.min(Math.round(baseHcm * multiplier), 200);

  // Governança
  if (p.isSA) { score += 50; details.push("⚖️ S.A. (Compliance)"); }
  if (p.isGrupoEconomico) { score += 50; details.push("🏢 Grupo Econômico"); }

  return { name: "Gente & Gov", score: Math.min(score, PILLAR_CAP), max: PILLAR_CAP, details };
};

const calculateMoment = (p: AgroProfile): ScorePillar => {
  let score = 50; // Base inicial
  const details: string[] = [];
  
  // Se é S.A. ou Indústria, o momento de tecnologia é sempre alto
  if (p.isSA || p.atividadePrincipal === 'INDUSTRIA') {
    score += 100;
    details.push("🚀 Maturidade Digital Alta");
  }

  if (p.temGestaoProfissional) { score += 50; }
  if (p.temConectividade) { score += 50; }

  return { name: "Momento", score: Math.min(score, PILLAR_CAP), max: PILLAR_CAP, details };
};

const recommendSolutions = (p: AgroProfile, score: number, tier: AgroTier): string[] => {
  const list = ['Senior ERP'];
  if (p.atividadePrincipal === 'INDUSTRIA' || p.atividadePrincipal === 'SEMENTE' || p.funcionarios > 100) list.push('Senior HCM');
  if (['ALGODAO', 'SEMENTE', 'CANA', 'MISTO'].includes(p.atividadePrincipal) || p.temIrrigacao) list.push('GAtec');
  if (tier === 'DIAMANTE') list.push('WMS / Logística');
  return list;
};