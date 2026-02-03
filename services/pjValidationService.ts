
import { fetchCnpjData } from "./apiService";

export const validateDiscoveredCnpj = async (cnpj: string) => {
  if (!cnpj || cnpj.length !== 14) return null;
  try {
    const data = await fetchCnpjData(cnpj);
    if (!data) return null;
    return {
      cnpj: cnpj,
      razaoSocial: data.razao_social,
      status: data.status,
      capitalSocial: data.capital_social,
      municipio: data.municipio,
      uf: data.uf
    };
  } catch (e) {
    return null;
  }
};
