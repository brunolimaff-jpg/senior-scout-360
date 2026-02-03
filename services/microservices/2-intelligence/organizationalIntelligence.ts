// src/services/microservices/2-intelligence/organizationalIntelligence.ts

import { GoogleGenAI } from "@google/genai";
import { 
  MicroserviceResult, 
  OrganizationalIntelResult, 
  OrchestrationContext,
  CNPJValidationResult
} from '../types/microserviceTypes';

/**
 * MICRO-SERVIÇO: ORGANIZATIONAL INTELLIGENCE
 * Responsabilidade: Buscar funcionários e vagas via Gemini AI (Sem estimativas)
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
          console.error("Falha crítica no parseGeminiJSON (Org). Texto:", text);
          throw e;
       }
    }
  }
}

export async function searchOrganizationalData(
  context: OrchestrationContext
): Promise<MicroserviceResult<OrganizationalIntelResult>> {
  
  const startTime = Date.now();
  const logs: string[] = [];
  const sources: string[] = [];
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return {
      status: 'failed',
      data: null,
      error: 'API Key do Gemini não configurada',
      duration: 0,
      logs: ['❌ API Key não encontrada'],
      confidence: 0,
      sources: [],
      timestamp: Date.now()
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    logs.push('🔍 Verificando dependência: cnpjValidator...');
    context.onProgress('organizationalIntelligence', '🔍 Verificando dependências...');

    const cnpjResult = context.results.get('cnpjValidator');
    
    if (!cnpjResult || cnpjResult.status !== 'completed' || !cnpjResult.data) {
      logs.push('⏭️ Pulando - cnpjValidator não disponível');
      return {
        status: 'skipped',
        data: null,
        error: 'Dependência cnpjValidator não disponível',
        duration: Date.now() - startTime,
        logs,
        confidence: 0,
        sources: [],
        timestamp: Date.now()
      };
    }

    const cnpjData = cnpjResult.data as CNPJValidationResult;
    const razaoSocial = cnpjData.razaoSocial;

    logs.push(`✅ Empresa: ${razaoSocial}`);

    logs.push('🧠 Buscando dados organizacionais via Gemini (SEM ESTIMATIVAS)...');
    context.onProgress('organizationalIntelligence', '🧠 Buscando funcionários reais...');

    const prompt = `Você é um analista de RH especializado em agronegócio.

TAREFA:
Busque informações REAIS e PÚBLICAS sobre:
Empresa: ${razaoSocial}
Capital Social: R$ ${cnpjData.capitalSocial.toLocaleString('pt-BR')}

DADOS A BUSCAR (APENAS SE ENCONTRAR FONTE PÚBLICA):
1. Número de funcionários
2. Vagas abertas (LinkedIn, Portais)
3. Maturidade digital (Site, Redes)

REGRAS:
❌ NÃO ESTIME número de funcionários por Capital Social. Retorne null se não achar.
✅ Fontes devem ser URLs REAIS.
✅ SEJA CONCISO E BREVE.

FORMATO JSON:
{
  "employees": <número ou null>,
  "openRoles": [
    { "title": "Agrônomo", "department": "Operações", "source": "URL" }
  ],
  "leaders": [],
  "digitalMaturity": {
    "score": <0-100>,
    "signals": ["Site institucional"],
    "reasoning": "Empresa tem site e vagas."
  },
  "confidence": <0-100>
}

RETORNE APENAS JSON.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        tools: [{googleSearch: {}}]
      }
    });

    logs.push('✅ Gemini respondeu');
    const geminiText = response.text || "{}";
    
    let parsedData: any;
    try {
        parsedData = parseGeminiJSON(geminiText);
    } catch (e) {
        console.error('Gemini Raw Text (Org):', geminiText);
        parsedData = {};
        logs.push('⚠️ Erro ao parsear JSON organizacional - formato inválido');
    }

    const employees = parsedData.employees ? Number(parsedData.employees) : null;
    const confidence = parsedData.confidence || 0;

    if (employees) {
      logs.push(`👥 Funcionários identificados: ${employees}`);
      context.onProgress('organizationalIntelligence', `✅ ${employees} funcionários (Fonte real)`);
    } else {
        logs.push(`⚠️ Funcionários não encontrados na web`);
        context.onProgress('organizationalIntelligence', `⚠️ Funcionários não encontrados`);
    }

    logs.push(`🎯 Maturidade Digital: ${parsedData.digitalMaturity?.score || 'N/D'}/100`);

    const result: OrganizationalIntelResult = {
      employees,
      openRoles: parsedData.openRoles || [],
      leaders: parsedData.leaders || [],
      certifications: parsedData.certifications || [],
      digitalMaturity: parsedData.digitalMaturity || {
        score: 50,
        signals: [],
        reasoning: 'N/D'
      },
      confidence
    };

    const duration = Date.now() - startTime;
    logs.push(`⏱️ Concluído em ${duration}ms`);

    return {
      status: 'completed',
      data: result,
      error: null,
      duration,
      logs,
      confidence,
      sources,
      timestamp: Date.now()
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      logs.push('🛑 Operação cancelada');
      return {
        status: 'failed',
        data: null,
        error: 'Operação cancelada',
        duration,
        logs,
        confidence: 0,
        sources,
        timestamp: Date.now()
      };
    }

    logs.push(`❌ Erro: ${error.message}`);
    context.onError('organizationalIntelligence', error.message);

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