import { ProspectLead, AgroProfile, SeniorAgroScoreResult } from '../types';
import { calculateSeniorAgroScore } from '../utils/marketEstimator';

/**
 * CONVERSOR DE DADOS BRUTOS -> PERFIL AGRO
 * Transforma dados parciais (CSV/API) em um perfil calculável para o SAS 4.0.
 */
export const generateAgroProfile = (lead: ProspectLead): AgroProfile => {
  // 1. Detecção de Cultura via CNAE ou Nome
  let atividade: AgroProfile['atividadePrincipal'] = 'SOJA'; // Default
  
  const cnaePrincipal = lead.cnaes?.[0]?.description || '';
  const nomeFantasia = lead.tradeName || '';
  const razaoSocial = lead.companyName || '';
  const notes = lead.notes || '';

  const textoBusca = (cnaePrincipal + ' ' + nomeFantasia + ' ' + razaoSocial + ' ' + notes).toUpperCase();

  if (textoBusca.includes('USINA') || textoBusca.includes('AÇUCAR') || textoBusca.includes('ETANOL') || textoBusca.includes('SUCRO')) atividade = 'INDUSTRIA';
  else if (textoBusca.includes('ALGOD') || textoBusca.includes('FIBRA')) atividade = 'ALGODAO';
  else if (textoBusca.includes('SEMENT')) atividade = 'SEMENTE';
  else if (textoBusca.includes('CANA')) atividade = 'CANA';
  else if (textoBusca.includes('CAFE')) atividade = 'CAFE';
  else if (textoBusca.includes('BOVINO') || textoBusca.includes('GADO') || textoBusca.includes('PECUARIA') || textoBusca.includes('CRIA')) atividade = 'PECUARIA';
  
  // 2. Estimativas de Porte (Heurística de Capital Social se dados faltarem)
  const capital = lead.capitalSocial || 0;
  
  // Se não temos hectares, estimamos: R$ 10.000 de Capital Social ~= 1 Hectare produtivo (Proxy conservador)
  const hectaresReais = lead.metadata?.hectaresTotal || 0;
  const hectaresEstimados = hectaresReais > 0 
    ? hectaresReais 
    : Math.floor(capital / 10000);

  // Se não temos funcionários, estimamos: R$ 300.000 de Capital ~= 1 Funcionário (Proxy Agro)
  const funcEstimados = Math.max(1, Math.floor(capital / 300000));

  // 3. Detecção de Governança
  const isSA = lead.isSA || razaoSocial.toUpperCase().includes('S.A') || razaoSocial.toUpperCase().includes('S/A') || razaoSocial.toUpperCase().includes('SOCIEDADE ANONIMA');
  const isGrupo = razaoSocial.toUpperCase().includes('HOLDING') || razaoSocial.toUpperCase().includes('GRUPO') || !!lead.corporateDomain;

  return {
    hectares: hectaresEstimados,
    atividadePrincipal: atividade,
    funcionarios: funcEstimados,
    isSA: !!isSA,
    isGrupoEconomico: !!isGrupo,
    // Estes campos abaixo serão enriquecidos na FASE 2 (Busca Google/Gemini), 
    // por enquanto assumimos heurística textual para ser conservador no Score inicial.
    temIrrigacao: textoBusca.includes('IRRIGA') || textoBusca.includes('PIVO'),
    temArmazem: textoBusca.includes('SILO') || textoBusca.includes('ARMAZEM') || textoBusca.includes('SECADOR'),
    temFrota: textoBusca.includes('TRANSPORT') || textoBusca.includes('FROTA') || textoBusca.includes('LOGISTICA'),
    temGestaoProfissional: textoBusca.includes('CEO') || textoBusca.includes('CFO') || textoBusca.includes('DIRETORIA'), 
    temConectividade: textoBusca.includes('4G') || textoBusca.includes('CONECTIVIDADE'),
    temCertificacao: textoBusca.includes('ISO') || textoBusca.includes('RTRS') || textoBusca.includes('CERTIFIC'),
    isExportador: textoBusca.includes('EXPORT') || textoBusca.includes('TRADING')
  };
};

/**
 * FUNÇÃO MESTRE: AUDITORIA DE INTELIGÊNCIA
 * Retorna o Score Completo (0-1000) e a Estratégia.
 */
export const analyzeLeadIntelligence = (lead: ProspectLead): SeniorAgroScoreResult => {
  // 1. Gera o Perfil
  const profile = generateAgroProfile(lead);
  
  // 2. Roda a Fórmula SAS 4.0
  return calculateSeniorAgroScore(profile);
};