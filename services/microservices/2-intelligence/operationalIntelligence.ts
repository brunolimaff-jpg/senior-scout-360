// src/services/microservices/2-intelligence/operationalIntelligence.ts

import { GoogleGenAI } from "@google/genai";
import { 
  MicroserviceResult, 
  OperationalIntelResult, 
  OrchestrationContext,
  CNPJValidationResult
} from '../types/microserviceTypes';

/**
 * MICRO-SERVIÇO: OPERATIONAL INTELLIGENCE
 * Responsabilidade: Mapear PERFIL DA OPERAÇÃO da empresa (O QUE ela faz)
 * Não foca só em hectares - foca em ATIVIDADES
 */

const GEMINI_MODEL = 'gemini-2.5-flash';

function parseGeminiJSON(text: string): any {
  let cleanText = text.trim();
  
  // 1. Tenta extrair de blocos de código Markdown se houver
  const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/```\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleanText = jsonMatch[1];
  }

  // 2. Tenta parse direto
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // 3. Tentativa de Reparo de JSON Truncado (Heurística)
    try {
      let fixed = cleanText.trim();
      
      // Fecha string aberta se necessário
      const quoteCount = (fixed.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        fixed += '"';
      }

      // Fecha chaves e colchetes abertos
      const stack = [];
      for (const char of fixed) {
        if (char === '{') stack.push('}');
        if (char === '[') stack.push(']');
        if (char === '}' || char === ']') {
            // Se encontrar fechamento, remove o esperado da pilha (se bater)
            if (stack.length > 0 && stack[stack.length - 1] === char) {
                stack.pop();
            }
        }
      }
      
      // Adiciona o que faltou fechar (na ordem inversa)
      while (stack.length > 0) {
        fixed += stack.pop();
      }

      return JSON.parse(fixed);
    } catch (repairError) {
       // 4. Última tentativa: Limpeza de caracteres de controle
       try {
          const sanitized = cleanText.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");
          return JSON.parse(sanitized);
       } catch (e3) {
          console.error("Falha crítica no parseGeminiJSON. Texto:", text);
          throw e;
       }
    }
  }
}

export async function searchOperationalData(
  context: OrchestrationContext
): Promise<MicroserviceResult<OperationalIntelResult>> {
  
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
    logs.push('✓ Iniciando análise operacional');
    context.onProgress('operationalIntelligence', 'Analisando perfil operacional...');

    const cnpjResult = context.results.get('cnpjValidator');
    
    if (!cnpjResult || cnpjResult.status !== 'completed' || !cnpjResult.data) {
      logs.push('⊗ Dados cadastrais não disponíveis');
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
    const razaoSocial = cnpjData.razaoSocial;
    const cnae = cnpjData.cnae;

    logs.push(`✓ Empresa: ${razaoSocial}`);
    logs.push(`→ Consultando inteligência artificial...`);
    context.onProgress('operationalIntelligence', 'Mapeando atividades...');

    const prompt = `Você é um analista de agronegócio brasileiro. Analise o PERFIL OPERACIONAL desta empresa:

Empresa: ${razaoSocial}
CNAE: ${cnae}

TAREFA:
Identifique QUAIS ATIVIDADES a empresa realiza. Marque TRUE/FALSE:

1. **Plantio Próprio**: Empresa cultiva lavouras?
2. **Indústria/Beneficiamento**: Tem UBS, fábrica?
3. **Comércio/Trading**: Revende insumos?
4. **Exportação**: Exporta grãos?
5. **Serviços**: Presta serviços?
6. **Transporte/Logística**: Tem frota?

REGRAS RÍGIDAS DE OUTPUT:
- Explique EM UMA FRASE CURTA o motivo.
- SEJA CONCISO. Evite textos longos para não cortar a resposta.
- Se encontrar FONTE PÚBLICA, inclua URL.

FORMATO JSON (RESPONDAS CURTAS):
{
  "activities": {
    "farming": { "active": true, "description": "Curta explicação.", "source": "URL" },
    "industry": { "active": false, "description": "Curta explicação.", "source": "URL" },
    "trading": { "active": false, "description": "Curta explicação.", "source": "URL" },
    "export": { "active": false, "description": "Curta explicação.", "source": "URL" },
    "services": { "active": false, "description": "Curta explicação.", "source": "URL" },
    "logistics": { "active": false, "description": "Curta explicação.", "source": "URL" }
  },
  "hectares": null,
  "farms": [],
  "crops": [],
  "production": null,
  "confidence": 60
}

RETORNE APENAS JSON.`;

    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192, // Aumentado para evitar corte
        tools: [{googleSearch: {}}]
      }
    });
    
    logs.push('✓ Resposta recebida da IA');
    const geminiText = geminiResponse.text || "{}";
    
    let parsedData: any;
    try {
      parsedData = parseGeminiJSON(geminiText);
      logs.push('✓ Dados estruturados com sucesso');
    } catch (parseError) {
      console.error('Gemini Raw Text:', geminiText);
      logs.push('⊗ Erro ao processar resposta da IA');
      throw new Error('IA retornou formato inválido');
    }

    // Contar atividades detectadas
    const activities = parsedData.activities || {};
    const activeCount = Object.values(activities).filter((a: any) => a?.active).length;

    if (activeCount > 0) {
      logs.push(`✓ ${activeCount} atividade(s) identificada(s)`);
      context.onProgress('operationalIntelligence', `${activeCount} atividades mapeadas`);
    } else {
      logs.push('→ Nenhuma atividade específica identificada');
    }

    // Log individual de cada atividade detectada
    if (activities.farming?.active) logs.push('  • Plantio Próprio');
    if (activities.industry?.active) logs.push('  • Indústria/Beneficiamento');
    if (activities.trading?.active) logs.push('  • Comércio/Trading');
    if (activities.export?.active) logs.push('  • Exportação');
    if (activities.services?.active) logs.push('  • Serviços');
    if (activities.logistics?.active) logs.push('  • Transporte/Logística');

    if (parsedData.hectares) {
      logs.push(`✓ Área identificada: ${parsedData.hectares.toLocaleString('pt-BR')} ha`);
    }

    const result: OperationalIntelResult = {
      hectares: parsedData.hectares || null,
      farms: parsedData.farms || [],
      crops: parsedData.crops || [],
      production: parsedData.production || null,
      confidence: parsedData.confidence || 60,
      activities: activities
    };

    const duration = Date.now() - startTime;
    logs.push(`✓ Análise concluída em ${(duration / 1000).toFixed(1)}s`);

    return {
      status: 'completed',
      data: result,
      error: null,
      duration,
      logs,
      confidence: parsedData.confidence || 60,
      sources,
      timestamp: Date.now()
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      logs.push('⊗ Operação cancelada');
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

    logs.push(`⊗ Erro: ${error.message}`);
    context.onError('operationalIntelligence', error.message);

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