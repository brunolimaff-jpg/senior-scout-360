
import { getGlobalCache, setGlobalCache } from "./storageService";

export interface IbgeCity {
  id: number;
  nome: string;
}

// Helper para fetch com timeout e retry
const fetchWithRetry = async (url: string, retries = 3, timeout = 5000): Promise<Response> => {
  let attempt = 0;
  while (attempt < retries) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      
      // Se for 429 (Too Many Requests) ou erro de servidor (5xx), lança erro para retentar
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Status ${response.status}`);
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(id);
      attempt++;
      // Se for erro de rede (Failed to fetch) ou timeout, retenta
      if (attempt >= retries) throw error;
      
      // Backoff exponencial: 1s, 2s, 4s...
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`[BrasilAPI] Retry ${attempt}/${retries} after ${delay}ms due to: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
};

export const fetchCnpjData = async (cnpj: string) => {
  const cleanCnpj = cnpj.replace(/[^\d]/g, '');
  if (cleanCnpj.length !== 14) return null;

  // 24h Cache check (definido no storageService)
  const cacheKey = `cnpj_${cleanCnpj}`;
  const cached = getGlobalCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    
    // Se não encontrou (404), retorna null sem erro
    if (response.status === 404) return null;
    
    if (!response.ok) return null;

    const data = await response.json();
    
    const result = {
      municipio: data.municipio || '',
      uf: data.uf || '',
      nome_fantasia: data.nome_fantasia,
      razao_social: data.razao_social,
      capital_social: data.capital_social,
      email: data.email,
      cnae_fiscal: data.cnae_fiscal,
      cnae_fiscal_descricao: data.cnae_fiscal_descricao,
      cnaes_secundarios: data.cnaes_secundarios || [],
      qsa: data.qsa || []
    };

    // Save to cache for 24 hours (86400000ms via default storageService)
    setGlobalCache(cacheKey, result);
    return result;
  } catch (error) {
    // Log discreto para não poluir console em caso de falha de rede persistente
    console.warn("BrasilAPI unavailable after retries:", error);
    return null;
  }
};

export const normalizeLocation = async (municipio: string, uf: string): Promise<string> => {
  return municipio || ""; // Simplificado para o exemplo
};

export const fetchMunicipalitiesByUf = async (uf: string): Promise<IbgeCity[]> => {
  if (!uf || uf.length !== 2) return [];
  try {
    // IBGE API é mais estável, mas também pode ter fetchWithRetry se necessário. 
    // Por enquanto mantemos simples.
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("IBGE Error:", error);
    return [];
  }
};

export const sanitizePII = (t: string) => t;
