
import { ProspectLead, AgroProfile, SeniorAgroScoreResult, AgroTier } from '../types';
import { calculateExplainableScore } from './scoreService';

/**
 * CONVERSOR DE DADOS BRUTOS -> PERFIL AGRO
 * Mantido para compatibilidade de tipos, mas o motor principal agora é o SAS 4.0 direto.
 */
export const generateAgroProfile = (lead: ProspectLead): AgroProfile => {
  // Lógica simplificada de perfil, apenas para tipagem se necessário
  return {
    hectares: lead.metadata?.hectaresTotal || 0,
    atividadePrincipal: 'SOJA', // Placeholder, calculado no scoreService
    funcionarios: 0,
    isSA: lead.isSA,
    isGrupoEconomico: !!lead.corporateDomain,
    temIrrigacao: false,
    temArmazem: false,
    temFrota: false,
    temGestaoProfissional: false,
    temConectividade: false,
    temCertificacao: false,
    isExportador: false
  };
};

/**
 * FUNÇÃO MESTRE: AUDITORIA DE INTELIGÊNCIA (ADAPTER SAS 4.0)
 * Retorna o Score Completo (0-1000) formatado para a UI do Dossiê.
 */
export const analyzeLeadIntelligence = (lead: ProspectLead): SeniorAgroScoreResult => {
  // Roda a Fórmula SAS 4.0 (scoreService)
  const result = calculateExplainableScore(lead);

  // Helper to parse Tier string (e.g. "💎 DIAMANTE" -> "DIAMANTE")
  const tierMap: Record<string, AgroTier> = {
    'BRONZE': 'BRONZE',
    'PRATA': 'PRATA',
    'OURO': 'OURO',
    'DIAMANTE': 'DIAMANTE'
  };
  
  const rawTier = result.recommendation.split(' ')[1] || 'BRONZE';
  const tier = tierMap[rawTier] || 'BRONZE';

  const pillars = {
    musculo: {
        name: result.dimensions[0].name,
        score: result.dimensions[0].score,
        max: 400,
        details: result.dimensions[0].evidences
    },
    complexidade: {
        name: result.dimensions[1].name,
        score: result.dimensions[1].score,
        max: 250,
        details: result.dimensions[1].evidences
    },
    gente: {
        name: result.dimensions[2].name,
        score: result.dimensions[2].score,
        max: 200,
        details: result.dimensions[2].evidences
    },
    momento: {
        name: result.dimensions[3].name,
        score: result.dimensions[3].score,
        max: 150,
        details: result.dimensions[3].evidences
    }
  };

  const auditLog = result.dimensions.flatMap(d => d.evidences);

  // Recommendations Logic
  const recommendedSolutions = ['Senior ERP (Backbone)'];
  const score = result.scoreTotal;
  
  if (score > 750) recommendedSolutions.push('WMS / Logística (Complexidade Alta)');
  if (score > 500) recommendedSolutions.push('Senior HCM (Gestão de Pessoas)');
  
  const cnaeText = (lead.cnaes || []).map(c => c.description).join(' ').toLowerCase();
  if (cnaeText.includes('algodão') || cnaeText.includes('semente') || cnaeText.includes('cana')) {
      recommendedSolutions.push('GAtec (Gestão Agroespecialista)');
  }

  return {
    totalScore: score,
    tier,
    pillars,
    auditLog,
    recommendedSolutions
  };
};
