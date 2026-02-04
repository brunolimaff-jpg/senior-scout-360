
/**
 * SERVIÇO DE FILA DE REQUISIÇÕES GEMINI (RATE LIMITER)
 * -----------------------------------------------------
 * Objetivo: Gerenciar o tráfego para a API do Google Gemini para evitar o erro 429 (Too Many Requests).
 * O plano gratuito permite aprox. 15 requisições por minuto (RPM).
 * 
 * Como funciona (Analogia do Balde):
 * Imagine um balde que enche de "fichas" (tokens) gota a gota.
 * - A cada 4 segundos, uma nova ficha cai no balde.
 * - Para fazer uma requisição, você precisa pegar uma ficha.
 * - Se não tem ficha, você entra na fila e espera.
 * - Se a fila está grande, quem tem cartão VIP (Prioridade HIGH) passa na frente.
 */

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

interface QueueItem<T> {
  task: () => Promise<T>;           // A função que chama a API
  resolve: (value: T) => void;      // Promessa para devolver o resultado
  reject: (reason: any) => void;    // Promessa para devolver erro
  priority: Priority;               // Urgência
  retries: number;                  // Quantas vezes já tentamos
  id: string;                       // Identificador para debug
}

// Configurações do Limitador
const MAX_RPM = 15;                 // Limite do Google (Recomendado: 15)
const TOKEN_REFILL_RATE = 60000 / MAX_RPM; // Ms para ganhar 1 token (4000ms = 4s)
const MAX_RETRIES = 3;              // Tentativas antes de desistir
const BURST_CAPACITY = 1;           // Capacidade do balde (1 = sem burst, mais seguro para free tier)

class GeminiRequestQueue {
  private static instance: GeminiRequestQueue;
  
  // As 3 filas de prioridade (Como filas de embarque no aeroporto)
  private queueHigh: QueueItem<any>[] = [];
  private queueMedium: QueueItem<any>[] = [];
  private queueLow: QueueItem<any>[] = [];

  // Variáveis do Token Bucket (O Balde de Fichas)
  private tokens: number = 1;       // Começamos com 1 token para a primeira req ser rápida
  private lastRefill: number = Date.now();
  private isProcessing: boolean = false;
  private pausedUntil: number = 0;  // Para pausar tudo se o Google bloquear (Circuit Breaker)

  // Métricas para observabilidade
  private metrics = {
    totalProcessed: 0,
    totalFailed: 0,
    totalRetries: 0
  };

  private constructor() {
    // Singleton: Construtor privado para evitar múltiplas instâncias
  }

  public static getInstance(): GeminiRequestQueue {
    if (!GeminiRequestQueue.instance) {
      GeminiRequestQueue.instance = new GeminiRequestQueue();
    }
    return GeminiRequestQueue.instance;
  }

  /**
   * PONTO DE ENTRADA PRINCIPAL
   * Envolve a chamada da API e coloca na fila correta.
   * 
   * @param task Função que retorna a Promise do Gemini
   * @param priority Nível de urgência
   */
  public enqueue<T>(task: () => Promise<T>, priority: Priority = 'MEDIUM'): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        task,
        resolve,
        reject,
        priority,
        retries: 0,
        id: Math.random().toString(36).substr(2, 9)
      };

      // 1. Escolhe a fila correta (Triagem)
      switch (priority) {
        case 'HIGH':
          this.queueHigh.push(item);
          break;
        case 'MEDIUM':
          this.queueMedium.push(item);
          break;
        case 'LOW':
          this.queueLow.push(item);
          break;
      }

      console.log(`[Queue] Item adicionado (${priority}). Fila: H:${this.queueHigh.length} M:${this.queueMedium.length} L:${this.queueLow.length}`);

      // 2. Acorda o processador se ele estiver dormindo
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * O PROCESSADOR (O Motor da Fila)
   * Executa em loop enquanto houver itens, respeitando o limite de velocidade.
   */
  private async processQueue() {
    if (this.isProcessing) return; // Já está rodando, não duplica
    this.isProcessing = true;

    while (true) {
      // 1. Verifica Circuit Breaker (Pausa forçada por erro 429 grave)
      if (Date.now() < this.pausedUntil) {
        const waitTime = this.pausedUntil - Date.now();
        console.log(`[Queue] Sistema em pausa forçada por ${Math.ceil(waitTime/1000)}s...`);
        await new Promise(r => setTimeout(r, waitTime));
      }

      // 2. Algoritmo Token Bucket (Recarrega as fichas baseado no tempo passado)
      this.refillTokens();

      // 3. Verifica se tem "ficha" para gastar
      if (this.tokens < 1) {
        // Sem ficha? Calcula quanto tempo falta para a próxima cair no balde
        const timeToNextToken = TOKEN_REFILL_RATE - (Date.now() - this.lastRefill);
        if (timeToNextToken > 0) {
          // Espera a próxima ficha cair
          await new Promise(r => setTimeout(r, timeToNextToken));
          continue; // Volta pro início do loop para recarregar e tentar de novo
        }
      }

      // 4. Pega o próximo item (Respeitando a hierarquia VIP)
      const item = this.getNextItem();

      if (!item) {
        // Filas vazias? Desliga o motor.
        this.isProcessing = false;
        break;
      }

      // 5. Consome 1 ficha e executa
      this.tokens -= 1;
      
      try {
        const result = await item.task();
        this.metrics.totalProcessed++;
        item.resolve(result); // Sucesso! Devolve o dado pra quem chamou.
      } catch (error: any) {
        await this.handleError(item, error);
      }
    }
  }

  /**
   * LÓGICA DE TRATAMENTO DE ERRO
   * Decide se tenta de novo ou desiste.
   */
  private async handleError(item: QueueItem<any>, error: any) {
    const errorMsg = error?.message || '';
    const isRateLimit = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('quota');
    const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network');

    // Se for Rate Limit (429), o Google está bravo. Pausa tudo.
    if (isRateLimit) {
      console.warn(`[Queue] 🛑 Rate Limit (429) detectado! Pausando fila...`);
      // Pausa por 10 segundos + um tempo aleatório para não bater todos juntos
      this.pausedUntil = Date.now() + 10000 + (Math.random() * 5000); 
      
      // Devolve o item para o INÍCIO da fila (High) para tentar de novo primeiro
      this.queueHigh.unshift(item); 
      return;
    }

    // Se for erro recuperável e ainda tiver tentativas
    if ((isNetworkError || error.status >= 500) && item.retries < MAX_RETRIES) {
      item.retries++;
      this.metrics.totalRetries++;
      
      // Backoff Exponencial: Espera 2s, depois 4s, depois 8s
      const delay = 2000 * Math.pow(2, item.retries);
      console.warn(`[Queue] ⚠️ Erro transitório. Retentativa ${item.retries}/${MAX_RETRIES} em ${delay}ms...`);
      
      await new Promise(r => setTimeout(r, delay));
      
      // Recoloca na frente da fila de origem
      if (item.priority === 'HIGH') this.queueHigh.unshift(item);
      else if (item.priority === 'MEDIUM') this.queueMedium.unshift(item);
      else this.queueLow.unshift(item);
      
      return;
    }

    // Se chegou aqui, é erro fatal ou acabaram as tentativas
    this.metrics.totalFailed++;
    console.error(`[Queue] ❌ Falha definitiva na tarefa ${item.id}:`, errorMsg);
    item.reject(error);
  }

  /**
   * RECARREGAR FICHAS (Matemática do Bucket)
   */
  private refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    // Calcula quantos tokens "nasceram" nesse tempo
    const newTokens = elapsed / TOKEN_REFILL_RATE;
    
    if (newTokens > 0) {
      this.tokens = Math.min(BURST_CAPACITY, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  /**
   * SELETOR DE PRIORIDADE
   * Pega sempre da fila mais importante primeiro.
   */
  private getNextItem(): QueueItem<any> | undefined {
    if (this.queueHigh.length > 0) return this.queueHigh.shift();
    if (this.queueMedium.length > 0) return this.queueMedium.shift();
    if (this.queueLow.length > 0) return this.queueLow.shift();
    return undefined;
  }

  /**
   * MÉTRICAS PÚBLICAS
   */
  public getMetrics() {
    return {
      ...this.metrics,
      pendingHigh: this.queueHigh.length,
      pendingMedium: this.queueMedium.length,
      pendingLow: this.queueLow.length
    };
  }
}

// Exporta uma função wrapper simples para facilitar o uso
export const queuedGeminiCall = <T>(
  task: () => Promise<T>, 
  priority: Priority = 'MEDIUM'
): Promise<T> => {
  return GeminiRequestQueue.getInstance().enqueue(task, priority);
};

// Accessor para o componente de métricas
export const getRequestQueueManager = (config?: any) => {
  return GeminiRequestQueue.getInstance();
};
