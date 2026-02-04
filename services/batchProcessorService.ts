
import { GoogleGenAI } from "@google/genai";
import { queuedGeminiCall } from "./requestQueueService";
import { cachedFetch, invalidateCacheTag } from "./advancedCacheService";

/**
 * SERVIÇO DE PROCESSAMENTO EM LOTE (BATCH PROCESSOR)
 * -----------------------------------------------------
 * Objetivo: Agrupar múltiplas requisições pequenas em uma única chamada robusta ao Gemini.
 * 
 * Analogia da Lista de Compras:
 * Imagine que você precisa comprar 10 maçãs.
 * 
 * - Abordagem Antiga (Sem Batch): Você vai ao mercado, compra 1 maçã, volta para casa. Vai de novo, compra outra...
 *   (Gasta muita gasolina/tempo = Muitas requisições API/Custo).
 * 
 * - Abordagem Batch (Este Serviço): Você anota na lista de compras. Quando tiver 10 itens (ou passar 2 segundos),
 *   você vai ao mercado UMA VEZ e compra tudo junto.
 *   (Economia massiva de requisições e tempo total).
 */

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Configuração do Lote
interface BatchConfig {
  maxBatchSize: number;   // Quantos itens juntar antes de processar (Ex: 15)
  maxWaitTimeMs: number;  // Quanto tempo esperar se o lote não encher (Ex: 2000ms)
  processorName: string;  // Nome para logs
}

// Item na fila de espera
interface QueuedItem<I, O> {
  input: I;
  resolve: (value: O | PromiseLike<O>) => void;
  reject: (reason?: any) => void;
  key: string; // Identificador único para cache
}

/**
 * CLASSE GENÉRICA DE PROCESSAMENTO EM LOTE
 */
export class BatchProcessor<I, O> {
  private queue: QueuedItem<I, O>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private config: BatchConfig;

  // Função que sabe falar com o Gemini para processar VÁRIOS itens de uma vez
  private batchHandler: (inputs: I[]) => Promise<O[]>;

  constructor(
    config: BatchConfig,
    batchHandler: (inputs: I[]) => Promise<O[]>
  ) {
    this.config = config;
    this.batchHandler = batchHandler;
  }

  /**
   * ADICIONAR ITEM À FILA
   * Verifica cache primeiro. Se não tiver, põe na lista de compras.
   */
  public async add(key: string, input: I): Promise<O> {
    // 1. Tenta Cache Individual (L1/L2)
    // Usamos o cachedFetch mas forçamos um erro se não achar para capturar no catch e enfileirar
    try {
      return await cachedFetch<O>(key, () => Promise.reject("CACHE_MISS"), { 
        ttl: 24 * 60 * 60 * 1000, // 24h default
        tags: [this.config.processorName]
      });
    } catch (e) {
      if (e !== "CACHE_MISS") throw e;
      // Se não achou no cache, continua para enfileirar...
    }

    return new Promise((resolve, reject) => {
      // 2. Adiciona à fila
      this.queue.push({ input, resolve, reject, key });

      // 3. Verifica se deve processar agora
      if (this.queue.length >= this.config.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        // Inicia contagem regressiva se for o primeiro item
        this.timer = setTimeout(() => this.flush(), this.config.maxWaitTimeMs);
      }
    });
  }

  /**
   * FLUSH (PROCESSAR O LOTE)
   * A "ida ao mercado". Pega tudo na fila e manda pro Gemini.
   */
  private async flush() {
    // Limpa o timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    // Isola o lote atual e limpa a fila principal
    const currentBatch = [...this.queue];
    this.queue = [];

    console.log(`[Batch:${this.config.processorName}] Processando lote de ${currentBatch.length} itens...`);

    try {
      // Extrai apenas os inputs para enviar ao processador
      const inputs = currentBatch.map(item => item.input);

      // CHAMA O GEMINI (Via Rate Limiter)
      const results = await queuedGeminiCall(
        () => this.batchHandler(inputs),
        'HIGH' // Batches têm prioridade pois desbloqueiam múltiplos usuários
      );

      // Distribui os resultados
      if (results.length !== currentBatch.length) {
        console.warn(`[Batch:${this.config.processorName}] Atenção: Entrada (${currentBatch.length}) != Saída (${results.length}). Tentando alinhar...`);
      }

      currentBatch.forEach((item, index) => {
        const result = results[index];
        
        if (result) {
          // Salva no cache individualmente para o futuro
          // Assim, se pedirem só esse item depois, já está lá
          cachedFetch(item.key, async () => result, { ttl: 24 * 60 * 60 * 1000 });
          
          item.resolve(result);
        } else {
          item.reject(new Error("Item não processado no lote"));
        }
      });

    } catch (error) {
      console.error(`[Batch:${this.config.processorName}] Falha no lote:`, error);
      // Se o lote falhar, rejeita todas as promises individuais
      currentBatch.forEach(item => item.reject(error));
    }
  }
}

// ============================================================================
// IMPLEMENTAÇÕES ESPECIALIZADAS (FACTORIES)
// ============================================================================

// --- 1. VALIDATOR DE CNPJ EM MASSA ---

export interface CnpjBatchResult {
  cnpj: string;
  razaoSocial: string;
  status: string;
  atividade: string;
  isValid: boolean;
}

let cnpjBatchInstance: BatchProcessor<string, CnpjBatchResult> | null = null;

export const getCnpjBatchValidator = () => {
  if (!cnpjBatchInstance) {
    cnpjBatchInstance = new BatchProcessor<string, CnpjBatchResult>(
      { maxBatchSize: 10, maxWaitTimeMs: 2500, processorName: 'CNPJ_VALIDATOR' },
      async (cnpjs) => {
        const prompt = `
          ATUE COMO: Auditor Cadastral Brasileiro.
          TAREFA: Validar e extrair dados básicos dos seguintes CNPJs usando Google Search.
          
          LISTA DE CNPJS:
          ${cnpjs.map((c, i) => `${i + 1}. ${c}`).join('\n')}

          INSTRUÇÕES:
          1. Para cada CNPJ, busque Razão Social, Situação (Ativa/Baixada) e Atividade Principal.
          2. Use fontes como Receita Federal, Casa dos Dados, Econodata.
          3. Retorne a ordem EXATA da lista de entrada.

          FORMATO JSON OBRIGATÓRIO:
          [
            { "cnpj": "...", "razaoSocial": "...", "status": "ATIVA/BAIXADA/NÃO ENCONTRADO", "atividade": "...", "isValid": true }
          ]
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash', // Modelo rápido é suficiente
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          }
        });

        // Parse seguro
        const json = JSON.parse(response.text || '[]');
        return json;
      }
    );
  }
  return {
    validate: (cnpj: string) => cnpjBatchInstance!.add(`cnpj_batch_${cnpj.replace(/\D/g,'')}`, cnpj),
    validateMany: (cnpjs: string[]) => Promise.all(cnpjs.map(c => cnpjBatchInstance!.add(`cnpj_batch_${c.replace(/\D/g,'')}`, c)))
  };
};

// --- 2. ENRIQUECIMENTO DE DADOS (Website/Email) ---

export interface EnrichmentInput {
  name: string;
  city: string;
}

export interface EnrichmentOutput {
  website: string | null;
  linkedin: string | null;
  email: string | null;
}

let enrichmentInstance: BatchProcessor<EnrichmentInput, EnrichmentOutput> | null = null;

export const getDataEnrichmentProcessor = () => {
  if (!enrichmentInstance) {
    enrichmentInstance = new BatchProcessor<EnrichmentInput, EnrichmentOutput>(
      { maxBatchSize: 8, maxWaitTimeMs: 3000, processorName: 'DATA_ENRICHMENT' },
      async (companies) => {
        const list = companies.map((c, i) => `${i+1}. ${c.name} (${c.city})`).join('\n');
        
        const prompt = `
          TAREFA: Encontrar Website oficial e LinkedIn para as empresas abaixo.
          
          EMPRESAS:
          ${list}

          RETORNO JSON (Array ordenado):
          [
            { "website": "url ou null", "linkedin": "url ou null", "email": "email publico ou null" }
          ]
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          }
        });

        return JSON.parse(response.text || '[]');
      }
    );
  }
  return {
    enrich: (data: EnrichmentInput) => enrichmentInstance!.add(`enrich_${data.name}_${data.city}`, data)
  };
};

// --- 3. SCORING RÁPIDO (Triagem de Leads) ---

export interface ScoringInput {
  companyName: string;
  capitalSocial: number;
  activity: string;
}

export interface ScoringOutput {
  score: number; // 0-100
  tier: 'Gold' | 'Silver' | 'Bronze';
  reason: string;
}

let scoringInstance: BatchProcessor<ScoringInput, ScoringOutput> | null = null;

export const getLeadScoringBatchProcessor = () => {
  if (!scoringInstance) {
    scoringInstance = new BatchProcessor<ScoringInput, ScoringOutput>(
      { maxBatchSize: 20, maxWaitTimeMs: 1500, processorName: 'LEAD_SCORING' },
      async (leads) => {
        // Aqui usamos Gemini Pro pois requer raciocínio, mas em lote vale a pena
        const prompt = `
          ATUE COMO: Especialista em Vendas B2B Agro (Senior Scout).
          TAREFA: Classificar (Score 0-100) a lista de leads abaixo para venda de ERP.

          CRITÉRIOS:
          - Capital Social Alto (> R$ 10M) = Score Alto
          - Atividade Complexa (Sementes, Indústria, Algodão) = Score Alto
          - Pecuária Simples = Score Médio/Baixo

          LEADS:
          ${JSON.stringify(leads)}

          RETORNO JSON (Array ordenado correspondente):
          [
            { "score": number, "tier": "Gold/Silver/Bronze", "reason": "Curta justificativa" }
          ]
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-pro', // Modelo mais inteligente para Scoring
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        return JSON.parse(response.text || '[]');
      }
    );
  }
  return {
    score: (lead: ScoringInput) => scoringInstance!.add(`score_${lead.companyName}`, lead)
  };
};
