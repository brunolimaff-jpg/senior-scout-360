// src/services/microservices/2-intelligence/corporateNetwork.ts

import { 
  MicroserviceResult, 
  OrchestrationContext,
  CNPJValidationResult
} from '../types/microserviceTypes';

/**
 * MICRO-SERVIÇO: CORPORATE NETWORK MAPPER
 * Responsabilidade: Mapear empresas relacionadas via QSA (recursivo na BrasilAPI)
 * Dependências: cnpjValidator
 */

interface RelatedCompany {
  cnpj: string;
  razaoSocial: string;
  relationType: 'Sócio PJ' | 'Empresa Coligada';
  participacao?: number;
  capitalSocial: number;
}

interface NetworkResult {
  relatedCompanies: RelatedCompany[];
  totalConnections: number;
}

// Função auxiliar para limpar CNPJ
function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

// Função auxiliar para validar CNPJ
function isValidCNPJ(cnpj: string): boolean {
  const clean = cleanCNPJ(cnpj);
  return clean.length === 14 && /^\d+$/.test(clean);
}

// Helper para fetch com retry interno
async function fetchWithRetry(url: string, signal?: AbortSignal, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { 
        signal,
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.status === 429 || response.status >= 500) {
         throw new Error(`HTTP Error ${response.status}`);
      }
      
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      if (i === retries - 1) throw err;
      const delay = 1000 * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Network error');
}

// Buscar empresa na BrasilAPI
async function fetchCompanyData(cnpj: string, abortSignal?: AbortSignal): Promise<any> {
  const clean = cleanCNPJ(cnpj);
  const url = `https://brasilapi.com.br/api/cnpj/v1/${clean}`;
  
  const response = await fetchWithRetry(url, abortSignal, 3);

  if (!response.ok) {
    throw new Error(`BrasilAPI retornou ${response.status} para ${cnpj}`);
  }

  return response.json();
}

// Extrair CNPJs de sócios PJ
function extractCNPJsFromQSA(qsa: any[]): string[] {
  const cnpjs: string[] = [];
  
  for (const socio of qsa) {
    const nome = socio.nome || '';
    
    // Detectar se é PJ (nome em maiúsculas ou contém LTDA/S.A.)
    const isPJ = 
      nome.toUpperCase() === nome && (
      nome.includes('LTDA') || 
      nome.includes('S.A.') ||
      nome.includes('S/A') ||
      nome.includes('HOLDING') ||
      nome.includes('PARTICIPACOES'));
    
    if (isPJ) {
      // Tentar extrair CNPJ do campo cnpjCpf (mapped in cnpjValidator)
      const cnpjField = socio.cnpjCpf || '';
      
      if (isValidCNPJ(cnpjField)) {
        cnpjs.push(cleanCNPJ(cnpjField));
      }
    }
  }
  
  return cnpjs;
}

export async function mapCorporateNetwork(
  context: OrchestrationContext
): Promise<MicroserviceResult<NetworkResult>> {
  
  const startTime = Date.now();
  const logs: string[] = [];
  const sources: string[] = ['BrasilAPI - Receita Federal'];

  try {
    logs.push('🔍 Verificando dependência: cnpjValidator...');
    context.onProgress('corporateNetwork', '🔍 Mapeando rede societária...');

    const cnpjResult = context.results.get('cnpjValidator');
    
    if (!cnpjResult || cnpjResult.status !== 'completed' || !cnpjResult.data) {
      logs.push('⏭️ Pulando - cnpjValidator não disponível');
      return {
        status: 'skipped',
        data: null,
        error: 'Dependência não disponível',
        duration: Date.now() - startTime,
        logs,
        confidence: 0,
        sources: [],
        timestamp: Date.now()
      };
    }

    const cnpjData = cnpjResult.data as CNPJValidationResult;
    const qsa = cnpjData.qsa || [];

    logs.push(`📊 Analisando ${qsa.length} sócios...`);

    // Extrair CNPJs de sócios PJ
    const socioCNPJs = extractCNPJsFromQSA(qsa);
    
    if (socioCNPJs.length === 0) {
      logs.push('ℹ️ Nenhum sócio PJ encontrado no QSA');
      return {
        status: 'completed',
        data: {
          relatedCompanies: [],
          totalConnections: 0
        },
        error: null,
        duration: Date.now() - startTime,
        logs,
        confidence: 100,
        sources,
        timestamp: Date.now()
      };
    }

    logs.push(`🏢 ${socioCNPJs.length} sócio(s) PJ detectado(s)`);
    context.onProgress('corporateNetwork', `🏢 ${socioCNPJs.length} empresas relacionadas`);

    const relatedCompanies: RelatedCompany[] = [];

    // Buscar dados de cada sócio PJ na BrasilAPI
    for (const socioCNPJ of socioCNPJs.slice(0, 5)) { // Limitar a 5 para não sobrecarregar
      try {
        logs.push(`🔎 Buscando dados de ${socioCNPJ}...`);
        
        const socioData = await fetchCompanyData(socioCNPJ, context.abortController.signal);
        
        const socio = qsa.find(s => {
          const cnpjField = s.cnpjCpf || '';
          return cleanCNPJ(cnpjField) === socioCNPJ;
        });

        relatedCompanies.push({
          cnpj: socioCNPJ,
          razaoSocial: socioData.razao_social || 'N/D',
          relationType: 'Sócio PJ',
          participacao: socio?.participacao,
          capitalSocial: parseFloat(socioData.capital_social || '0')
        });

        logs.push(`✅ ${socioData.razao_social}`);

      } catch (error: any) {
        logs.push(`⚠️ Erro ao buscar ${socioCNPJ}: ${error.message}`);
      }
    }

    logs.push(`✅ ${relatedCompanies.length} empresas relacionadas mapeadas`);

    const duration = Date.now() - startTime;
    logs.push(`⏱️ Concluído em ${duration}ms`);

    return {
      status: 'completed',
      data: {
        relatedCompanies,
        totalConnections: relatedCompanies.length
      },
      error: null,
      duration,
      logs,
      confidence: 100, // BrasilAPI é fonte oficial
      sources,
      timestamp: Date.now()
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logs.push(`❌ Erro: ${error.message}`);
    context.onError('corporateNetwork', error.message);

    return {
      status: 'failed',
      data: null,
      error: error.message,
      duration,
      logs,
      confidence: 0,
      sources,
      timestamp: Date.now()
    };
  }
}
