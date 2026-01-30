// services/networkService.ts
import { NetworkNode } from '../types';

// Utilitário para limpar CNPJ
const clean = (val: string) => val.replace(/[^\d]/g, '');

/**
 * Busca Sócios de uma Empresa (BrasilAPI + Mock de Demo)
 */
export const fetchCompanyConnections = async (cnpj: string, level: number, parentId: string): Promise<NetworkNode[]> => {
  const cnpjClean = clean(cnpj);

  // 💎 MOCK DEMO: EVERMAT S/A (Caso específico para demonstração)
  if (cnpjClean.includes("50259360")) {
    return [
      { id: `P-${Date.now()}-1`, label: 'TIAGO STEFANELLO NOGUEIRA', type: 'PERSON', status: 'ACTIVE', role: 'Presidente', level: level + 1, parentId },
      { id: `P-${Date.now()}-2`, label: 'DIOGO HENRIQUE BIAZAO BASSO', type: 'PERSON', status: 'ACTIVE', role: 'Diretor', level: level + 1, parentId },
    ];
  }

  // 🌍 MUNDO REAL: Consulta na BrasilAPI se tiver CNPJ válido
  if (cnpjClean.length === 14) {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (response.ok) {
        const data = await response.json();
        // Retorna os 2 primeiros sócios encontrados (regra de negócio)
        return (data.qsa || []).slice(0, 2).map((socio: any) => ({
          id: `P-${clean(socio.nome_socio_razao_social || socio.nome)}-${Math.random().toString(36).substr(2, 5)}`,
          label: socio.nome_socio_razao_social || socio.nome,
          type: 'PERSON',
          status: 'ACTIVE',
          role: socio.qualificacao_socio_completa || socio.qualificacao,
          level: level + 1,
          parentId: parentId
        }));
      }
    } catch (error) {
      console.warn("Erro ao buscar sócios na API, usando fallback gerado.");
    }
  }

  // FALLBACK GENERATIVO (Se não tiver CNPJ ou API falhar)
  // Gera 2 sócios fictícios baseados no nome da empresa para manter o fluxo
  return [
    { id: `P-GEN-${Date.now()}-1`, label: `Sócio Administrador 01`, type: 'PERSON', status: 'ACTIVE', role: 'Sócio-Admin', level: level + 1, parentId },
    { id: `P-GEN-${Date.now()}-2`, label: `Investidor Capital`, type: 'PERSON', status: 'ACTIVE', role: 'Sócio-Cotista', level: level + 1, parentId }
  ];
};

/**
 * Busca Empresas de um Sócio (Gera Holding e Transportadora conforme solicitado)
 */
export const fetchPersonAssets = async (personName: string, level: number, parentId: string): Promise<NetworkNode[]> => {
  const parts = personName.split(' ');
  const lastName = parts[parts.length - 1].toUpperCase().replace(/[^A-Z]/g, ''); // Limpa sufixos
  const cleanName = lastName.length > 2 ? lastName : 'FAMILIA';

  return [
    { 
      id: `C-HOLD-${Date.now()}`, 
      label: `HOLDING ${cleanName} PARTICIPAÇÕES`, 
      type: 'COMPANY', 
      status: 'ACTIVE', 
      cnpj: 'Gerado Automaticamente', 
      role: '🏭 HOLDING PATRIMONIAL', 
      level: level + 1, 
      parentId 
    },
    { 
      id: `C-LOG-${Date.now()}`, 
      label: `TRANS${cleanName} LOGÍSTICA`, 
      type: 'COMPANY', 
      status: 'ACTIVE', 
      cnpj: 'Gerado Automaticamente', 
      role: '🚚 TRANSPORTADORA', 
      level: level + 1, 
      parentId 
    }
  ];
};
