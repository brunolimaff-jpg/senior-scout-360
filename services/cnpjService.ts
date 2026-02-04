
import axios from 'axios';
import { DadosEmpresa } from '../types';
import { getGlobalCache, setGlobalCache } from './storageService';

const BRASIL_API_BASE = 'https://brasilapi.com.br/api/cnpj/v1';

// Configuração do Axios
const api = axios.create({
  baseURL: BRASIL_API_BASE,
  timeout: 10000,
});

/**
 * Consulta dados cadastrais de uma empresa via BrasilAPI.
 * Inclui lógica de Cache (24h) e Retry (3x).
 */
export async function consultarCNPJ(cnpj: string): Promise<DadosEmpresa> {
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ inválido. Deve conter 14 dígitos.');
  }

  // 1. Verificar Cache
  const cacheKey = `dados_cadastrais_${cnpjLimpo}`;
  const cached = getGlobalCache(cacheKey);
  if (cached) {
    console.log(`[CNPJ Service] Cache hit para ${cnpjLimpo}`);
    return cached as DadosEmpresa;
  }

  // 2. Consulta API com Retry
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await api.get(`/${cnpjLimpo}`);
      const dados = response.data as DadosEmpresa;

      // Sanitização básica
      if (!dados.qsa) dados.qsa = [];
      dados.capital_social = Number(dados.capital_social) || 0;

      // Salvar Cache (24h)
      setGlobalCache(cacheKey, dados);
      
      return dados;

    } catch (error: any) {
      attempts++;
      const status = error.response?.status;

      if (status === 404) {
        throw new Error('CNPJ não encontrado na base da Receita Federal.');
      }

      if (status === 429) {
        console.warn(`[CNPJ Service] Rate limit. Aguardando... (Tentativa ${attempts})`);
        await new Promise(r => setTimeout(r, 2000 * attempts)); // Backoff
        continue;
      }

      if (attempts === maxAttempts) {
        throw new Error(`Falha ao consultar CNPJ após ${maxAttempts} tentativas. Verifique sua conexão.`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error('Erro desconhecido no serviço de CNPJ.');
}
