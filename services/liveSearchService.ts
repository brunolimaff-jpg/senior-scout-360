import { ProspectLead } from '../types';
import { searchRealData } from './geminiService';

export const searchPublicData = async (lead: ProspectLead) => {
  const aiData = await searchRealData(lead);

  const realHectares = typeof aiData.hectares === 'number' ? aiData.hectares : 0;
  const realFunc = typeof aiData.funcionarios === 'number' ? aiData.funcionarios : 0;
  const socios = Array.isArray(aiData.socios) ? aiData.socios : [];
  const grupo = (aiData.grupo && aiData.grupo !== "N/D") ? aiData.grupo : null;

  let foundLog = '';
  // Se encontrou qualquer dado relevante, monta o log ou usa o resumo da IA
  if (realHectares > 0 || realFunc > 0 || socios.length > 0 || grupo) {
    foundLog = aiData.resumo || `IA Localizou: ${realHectares}ha, ${realFunc} funcs e ${socios.length} sócios.`;
  } else {
    foundLog = 'Varredura pública não encontrou dados explícitos.';
  }

  return {
    hectares: realHectares,
    funcionarios: realFunc,
    socios: socios, // Novo campo: Lista de sócios
    grupo: grupo,   // Novo campo: Nome do Grupo Econômico
    log: foundLog
  };
};