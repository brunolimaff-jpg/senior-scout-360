
import { NetworkNode, GroupCompany } from '../types';

const clean = (val: string) => val.replace(/[^\d]/g, '');

/**
 * Busca Sócios e Empresas Relacionadas (BrasilAPI Real-time)
 * Objetivo: "Zero Ficção" - apenas retorna o que está na Receita Federal
 */
export const fetchCompanyConnections = async (cnpj: string, level: number, parentId: string): Promise<NetworkNode[]> => {
  const cnpjClean = clean(cnpj);
  if (cnpjClean.length !== 14) return [];

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
    if (!response.ok) throw new Error("BrasilAPI Offline");
    
    const data = await response.json();
    
    // Mapeia QSA para Nodes
    return (data.qsa || []).map((socio: any) => {
      const isPJ = !!socio.cnpj_cpf_do_socio && socio.cnpj_cpf_do_socio.replace(/\D/g, '').length === 14;
      
      return {
        id: `net-${clean(socio.nome_socio_razao_social || socio.nome)}-${Math.random().toString(36).substr(2, 5)}`,
        label: socio.nome_socio_razao_social || socio.nome,
        type: isPJ ? 'COMPANY' : 'PERSON',
        status: 'ACTIVE',
        cnpj: isPJ ? clean(socio.cnpj_cpf_do_socio) : undefined,
        role: socio.qualificacao_socio_completa || socio.qualificacao || 'Sócio',
        level: level + 1,
        parentId: parentId
      };
    });
  } catch (error) {
    console.warn("Falha na busca de conexões oficiais:", error);
    return [];
  }
};

/**
 * Busca ativos de uma pessoa física (Inferência por sobrenome - Desativado para manter Zero Ficção)
 * Agora retorna lista vazia para evitar alucinação se não houver base oficial.
 */
export const fetchPersonAssets = async (personName: string, level: number, parentId: string): Promise<NetworkNode[]> => {
  // Retornamos vazio pois a BrasilAPI não permite busca reversa por CPF sem autorização.
  // Evitamos gerar nomes fictícios.
  console.info("Busca reversa por CPF bloqueada por política de Zero Ficção.");
  return [];
};

/**
 * Simulação de Busca Reversa por CPF para funcionalidade de Grupo Econômico (Pilot)
 * Em produção, isso bateria em um endpoint enriquecido (Ex: BigDataCorp ou Serasa).
 */
export const searchCompaniesByCPF = async (cpf: string): Promise<GroupCompany[]> => {
  await new Promise(r => setTimeout(r, 1800)); // Delay para sensação de processamento

  // Mock data baseado no contexto de "Gilberto" ou produtor padrão
  return [
    { 
      cnpj: '12.345.678/0001-99', 
      nome: 'AGROPECUARIA BOM RETIRO LTDA', 
      capitalSocial: 1500000, 
      status: 'VALIDADA',
      participacao: 50,
      atividadePrincipal: 'Cultivo de Soja e Milho',
      endereco: 'Rua Principal, SN, Zona Rural, Sorriso - MT',
      qsa: [
        { nome: 'GILBERTO GOMES', qualificacao: 'Sócio-Administrador', participacao: '50' },
        { nome: 'MARIA OLIVEIRA GOMES', qualificacao: 'Sócio', participacao: '50' }
      ]
    },
    { 
      cnpj: '98.765.432/0001-55', 
      nome: 'HOLDING FAMILIAR G.S. PARTICIPACOES', 
      capitalSocial: 5000000, 
      status: 'VALIDADA',
      participacao: 100,
      atividadePrincipal: 'Holdings de Instituições Não-Financeiras',
      endereco: 'Av. Paulista, 1000, Sala 10, São Paulo - SP',
      qsa: [
        { nome: 'GILBERTO GOMES', qualificacao: 'Diretor', participacao: '90' },
        { nome: 'JOAO GOMES NETO', qualificacao: 'Diretor', participacao: '10' }
      ]
    },
    { 
      cnpj: '45.612.378/0001-22', 
      nome: 'TRANSPORTADORA GRANELEIRA DO VALE', 
      capitalSocial: 300000, 
      status: 'VALIDADA',
      participacao: 33,
      atividadePrincipal: 'Transporte Rodoviário de Carga',
      endereco: 'Rodovia BR-163, KM 10, Sinop - MT',
      qsa: [
        { nome: 'GILBERTO GOMES', qualificacao: 'Sócio', participacao: '33' },
        { nome: 'PEDRO HENRIQUE SILVA', qualificacao: 'Sócio-Administrador', participacao: '33' },
        { nome: 'MARIA OLIVEIRA GOMES', qualificacao: 'Sócio', participacao: '33' }
      ]
    },
    { 
      cnpj: '11.223.344/0001-88', 
      nome: 'ARMAZENS GERAIS INTEGRACAO', 
      capitalSocial: 800000, 
      status: 'PENDENTE',
      participacao: 25,
      atividadePrincipal: 'Armazenamento e Depósito',
      endereco: 'Anel Viário Sul, Sorriso - MT',
      qsa: [] // Pendente não tem QSA carregado
    }
  ];
};
