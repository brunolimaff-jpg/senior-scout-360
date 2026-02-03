// src/services/microservices/2-intelligence/revenueSearcher.ts

import { GoogleGenAI } from "@google/genai";
import { 
  MicroserviceResult, 
  OrchestrationContext, 
  CNPJValidationResult,
  RevenueResult
} from '../types/microserviceTypes';

/**
 * MICRO-SERVIÇO: REVENUE SEARCHER
 * Responsabilidade: Buscar faturamento real em fontes públicas via Gemini AI
 * Dependências: cnpjValidator
 */

const GEMINI_MODEL = 'gemini-2.5-flash';

function parseGeminiJSON(text: string): any {
  let cleanText = text.trim();
  
  const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/```\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleanText = jsonMatch[1];
  }

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Tentativa de Reparo de JSON Truncado
    try {
      let fixed = cleanText.trim();
      const quoteCount = (fixed.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) fixed += '"';

      const stack = [];
      for (const char of fixed) {
        if (char === '{') stack.push('}');
        if (char === '[') stack.push(']');
        if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) stack.pop();
        }
      }
      while (stack.length > 0) fixed += stack.pop();

      return JSON.parse(fixed);
    } catch (repairError) {
       try {
          const sanitized = cleanText.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");
          return JSON.parse(sanitized);
       } catch (e3) {
          console.error("Falha ao parsear JSON Gemini. Texto recebido:", text);
          throw e;
       }
    }
  }
}

export async function searchRevenue(
  context: OrchestrationContext
): Promise<RevenueResult> {
  
  const startTime = Date.now();
  const logs: string[] = [];
  const sources: string[] = [];
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return {
      revenue: null,
      year: null,
      source: null,
      isEstimated: true,
      confidence: 0,
      reasoning: 'API Key não encontrada'
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Validar dependências
  const cnpjResult = context.results.get('cnpjValidator');
  
  if (!cnpjResult?.data) {
    return {
      revenue: null,
      year: null,
      source: null,
      isEstimated: true,
      confidence: 0,
      reasoning: 'Dados cadastrais não disponíveis'
    };
  }

  const cnpjData = cnpjResult.data as CNPJValidationResult;
  const razaoSocial = cnpjData.razaoSocial;
  const capitalSocial = cnpjData.capitalSocial;

  // 2. Construir Prompt Agressivo
  const prompt = `Você é um analista financeiro especializado em empresas brasileiras do agronegócio.

TAREFA CRÍTICA:
Busque o FATURAMENTO ANUAL REAL da empresa abaixo em fontes públicas brasileiras:

Empresa: ${razaoSocial}
CNPJ: ${context.cnpj}
Capital Social: R$ ${capitalSocial.toLocaleString('pt-BR')}

ONDE BUSCAR:
1. Sites de notícias do agro, Portais financeiros, Relatórios públicos, Rankings (Valor 1000, Exame), Releases.

INSTRUÇÕES:
✅ Procure menções explícitas de "faturamento", "receita", "vendas" em R$ ou US$
✅ Priorize dados dos últimos 3 anos (2022-2024)
✅ SEJA CONCISO. Retorne apenas o dado essencial.

❌ Se NÃO encontrar NADA, retorne revenue: null. Não use heurística (deixe isso para o fallback).

FORMATO JSON:
{
  "revenue": <número em BRL ou null>,
  "year": <ano ou null>,
  "source": "Fonte (curto)",
  "confidence": <0-100>,
  "reasoning": "Explicação em 1 frase."
}

RETORNE APENAS JSON.`;

  try {
    context.onProgress('revenueSearcher', '💰 Buscando faturamento real...');
    
    // 3. Executar Chamada Gemini
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1, 
        maxOutputTokens: 8192, 
        tools: [{googleSearch: {}}] 
      }
    });

    const geminiText = response.text || "{}";
    const data = parseGeminiJSON(geminiText);

    // Extrair URLs do grounding
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    groundingChunks.forEach((chunk: any) => {
        if(chunk.web?.uri) sources.push(chunk.web.uri);
    });

    // 4. Processar Resultado
    // Se Gemini encontrou dados reais
    if (data.revenue && data.revenue > 0 && !data.reasoning?.toLowerCase().includes('estimativa')) {
      context.onProgress('revenueSearcher', `✓ Faturamento real encontrado`);
      
      return {
        revenue: Number(data.revenue),
        year: data.year || new Date().getFullYear(),
        source: data.source || (sources.length > 0 ? sources[0] : 'Fonte pública identificada pela IA'),
        isEstimated: false,
        confidence: data.confidence || 70,
        reasoning: data.reasoning || 'Dado encontrado em fonte pública'
      };
    }

    // Se não encontrou, usar heurística com AVISO CLARO
    context.onProgress('revenueSearcher', '⚠️ Faturamento não encontrado - usando estimativa');
    
    const estimatedRevenue = capitalSocial * 6.5;
    return {
      revenue: estimatedRevenue,
      year: null,
      source: null,
      isEstimated: true,
      confidence: 40,
      reasoning: `Estimativa baseada no Capital Social (R$ ${capitalSocial.toLocaleString('pt-BR')} × 6.5). Não foram encontrados dados públicos de faturamento.`
    };

  } catch (error: any) {
    // Fallback: heurística com erro loggado
    console.error('Erro ao buscar faturamento:', error);
    
    const estimatedRevenue = capitalSocial * 6.5;
    return {
      revenue: estimatedRevenue,
      year: null,
      source: null,
      isEstimated: true,
      confidence: 40,
      reasoning: `Estimativa (erro na busca: ${error.message || 'Erro desconhecido'})`
    };
  }
}