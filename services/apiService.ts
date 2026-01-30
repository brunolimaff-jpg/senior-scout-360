
import { getGlobalCache, setGlobalCache } from "./storageService";

export interface IbgeCity {
  id: number;
  nome: string;
}

export const fetchCnpjData = async (cnpj: string) => {
  const cleanCnpj = cnpj.replace(/[^\d]/g, '');
  if (cleanCnpj.length !== 14) return null;

  // 24h Cache check (definido no storageService)
  const cacheKey = `cnpj_${cleanCnpj}`;
  const cached = getGlobalCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
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
    console.error("BrasilAPI Error:", error);
    return null;
  }
};

export const normalizeLocation = async (municipio: string, uf: string): Promise<string> => {
  return municipio || ""; // Simplificado para o exemplo
};

export const fetchMunicipalitiesByUf = async (uf: string): Promise<IbgeCity[]> => {
  if (!uf || uf.length !== 2) return [];
  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("IBGE Error:", error);
    return [];
  }
};

export const sanitizePII = (t: string) => t;
