
/**
 * SERVIÇO DE CACHE AVANÇADO (L1 + L2)
 * -----------------------------------------------------
 * Objetivo: Reduzir custos e latência armazenando respostas da IA e APIs.
 * 
 * Analogia do Armazém Logístico:
 * Imagine que este serviço é um armazém de dados com dois setores:
 * 
 * 1. O Balcão (Memória RAM / L1): 
 *    - Acesso instantâneo.
 *    - Espaço pequeno.
 *    - Se a luz acabar (refresh da página), tudo some.
 * 
 * 2. O Estoque de Fundo (LocalStorage / L2):
 *    - Acesso um pouco mais lento (precisa buscar na caixa).
 *    - Espaço maior (até 5MB).
 *    - Persiste mesmo se a loja fechar (fechar o navegador).
 * 
 * Se o dado não está nem no balcão nem no estoque, nós "encomendamos da fábrica"
 * (chamamos a API/Gemini), o que custa dinheiro e tempo.
 */

// Configurações Padrão
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 Horas
const GARBAGE_COLLECTOR_INTERVAL = 5 * 60 * 1000; // 5 Minutos
const MAX_MEMORY_ITEMS = 100; // Máximo de itens na RAM
const MAX_DISK_ITEMS = 500;   // Máximo de itens no LocalStorage
const CACHE_PREFIX = 'scout_cache_v2_'; // Prefixo para não misturar com outros dados

export interface CacheOptions {
  ttl?: number;           // Tempo de vida em ms
  tags?: string[];        // Etiquetas para agrupar dados (ex: 'cnpj_123', 'safra_2024')
  persist?: boolean;      // Se deve salvar no LocalStorage (padrão: true)
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;      // Quando o dado morre
  createdAt: number;      // Quando nasceu
  lastAccessed: number;   // Para o algoritmo LRU (quem foi usado por último fica)
  hits: number;           // Quantas vezes economizamos uma chamada de API
  tags: string[];         // Etiquetas para invalidação em massa
  key: string;            // Chave de identificação
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: string;
  memoryItems: number;
  diskItems: number;
}

class AdvancedCache {
  private static instance: AdvancedCache;
  
  // Nível 1: Memória (Map é mais rápido que Object)
  private memoryLayer: Map<string, CacheEntry<any>> = new Map();
  
  // Métricas
  private metrics = {
    hits: 0,
    misses: 0
  };

  private constructor() {
    // Inicia o "Faxineiro" (Garbage Collector)
    setInterval(() => this.runGarbageCollector(), GARBAGE_COLLECTOR_INTERVAL);
    
    // Hidratação inicial: Carrega índices do LocalStorage para Memória (opcional, aqui faremos lazy load)
    console.log('[Cache] Serviço iniciado. Armazém pronto.');
  }

  public static getInstance(): AdvancedCache {
    if (!AdvancedCache.instance) {
      AdvancedCache.instance = new AdvancedCache();
    }
    return AdvancedCache.instance;
  }

  /**
   * PONTO DE ACESSO PRINCIPAL
   * Tenta pegar do cache. Se falhar, executa a função fetcher e salva o resultado.
   */
  public async fetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitiza chave
    
    // 1. Tenta buscar no Armazém (Memória ou Disco)
    const cached = this.getInternal<T>(safeKey);

    if (cached) {
      this.metrics.hits++;
      // console.debug(`[Cache] Hit! Economizamos uma chamada para: ${key}`);
      return cached.value;
    }

    // 2. Se não achou (Cache Miss), temos que "encomendar da fábrica"
    this.metrics.misses++;
    // console.debug(`[Cache] Miss. Buscando dados frescos para: ${key}...`);

    try {
      // Executa a função real (API Call)
      const data = await fetcher();

      // 3. Armazena o resultado novo no estoque
      this.setInternal(safeKey, data, options);

      return data;
    } catch (error) {
      // Se a API falhar, não cacheia o erro (a menos que quiséssemos cachear falhas)
      throw error;
    }
  }

  /**
   * BUSCA INTERNA (Lógica L1 -> L2)
   */
  private getInternal<T>(key: string): CacheEntry<T> | null {
    const now = Date.now();

    // A. Verifica Memória (L1)
    if (this.memoryLayer.has(key)) {
      const entry = this.memoryLayer.get(key)!;
      
      // Verifica validade
      if (entry.expiresAt > now) {
        entry.lastAccessed = now;
        entry.hits++;
        return entry;
      } else {
        // Expirou? Joga fora.
        this.memoryLayer.delete(key);
        this.removeFromDisk(key);
        return null;
      }
    }

    // B. Verifica Disco (L2 - LocalStorage)
    const storageKey = `${CACHE_PREFIX}${key}`;
    const raw = localStorage.getItem(storageKey);
    
    if (raw) {
      try {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        
        // Verifica validade
        if (entry.expiresAt > now) {
          // Promove para Memória (L1) para ficar mais rápido na próxima
          entry.lastAccessed = now;
          entry.hits++;
          this.memoryLayer.set(key, entry);
          
          // Atualiza stats no disco (assíncrono para não travar UI)
          setTimeout(() => localStorage.setItem(storageKey, JSON.stringify(entry)), 0);
          
          return entry;
        } else {
          // Expirou no disco
          this.removeFromDisk(key);
        }
      } catch (e) {
        console.warn(`[Cache] Dados corrompidos para ${key}. Removendo.`);
        this.removeFromDisk(key);
      }
    }

    return null;
  }

  /**
   * ARMAZENAMENTO (Lógica de Escrita e LRU)
   */
  private setInternal<T>(key: string, value: T, options: CacheOptions) {
    const now = Date.now();
    const ttl = options.ttl || DEFAULT_TTL;
    
    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: now + ttl,
      createdAt: now,
      lastAccessed: now,
      hits: 0,
      tags: options.tags || []
    };

    // 1. Salva na Memória (L1)
    if (this.memoryLayer.size >= MAX_MEMORY_ITEMS) {
      this.evictLRU(this.memoryLayer); // Espaço cheio? Remove o mais antigo
    }
    this.memoryLayer.set(key, entry);

    // 2. Salva no Disco (L2), se permitido
    if (options.persist !== false) {
      try {
        const storageKey = `${CACHE_PREFIX}${key}`;
        localStorage.setItem(storageKey, JSON.stringify(entry));
        
        // Controle de tamanho do Disco (simplificado)
        // Nota: Um controle LRU real no localStorage é caro (precisa ler tudo).
        // Aqui confiamos no Garbage Collector para limpar antigos.
      } catch (e) {
        console.warn('[Cache] LocalStorage cheio ou indisponível. Tentando limpar espaço...');
        this.pruneDiskAggressive();
      }
    }
  }

  /**
   * ALGORITMO LRU (Least Recently Used)
   * Remove o item que foi acessado há mais tempo para dar lugar ao novo.
   */
  private evictLRU(map: Map<string, CacheEntry<any>>) {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of map.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      map.delete(oldestKey);
      // console.debug(`[Cache] Memória cheia. Removido item antigo: ${oldestKey}`);
    }
  }

  /**
   * INVALIDAÇÃO POR TAGS
   * Ex: "Dados do CNPJ mudaram". Removemos tudo relacionado a ele.
   */
  public invalidateByTag(tag: string) {
    let count = 0;
    
    // 1. Limpa Memória
    for (const [key, entry] of this.memoryLayer.entries()) {
      if (entry.tags.includes(tag)) {
        this.memoryLayer.delete(key);
        this.removeFromDisk(key);
        count++;
      }
    }

    // 2. Limpa Disco (Scan completo necessário infelizmente)
    // Para otimizar, só fazemos o scan se não achamos na memória ou para garantir consistência
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey?.startsWith(CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw && raw.includes(tag)) { // Check rápido de string antes de parsear
             const entry = JSON.parse(raw) as CacheEntry<any>;
             if (entry.tags && entry.tags.includes(tag)) {
               localStorage.removeItem(storageKey);
               count++;
             }
          }
        } catch (e) { /* ignore */ }
      }
    }
    
    console.log(`[Cache] Invalidados ${count} itens com a tag: ${tag}`);
  }

  /**
   * REMOVE DO DISCO
   */
  private removeFromDisk(key: string) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  }

  /**
   * O FAXINEIRO (Limpeza automática)
   */
  private runGarbageCollector() {
    const now = Date.now();
    let removed = 0;

    // Limpa Memória
    for (const [key, entry] of this.memoryLayer.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryLayer.delete(key);
        this.removeFromDisk(key);
        removed++;
      }
    }

    // Limpa Disco (Amostragem ou Scan)
    // Para não travar a UI, fazemos um scan parcial ou total dependendo da carga
    // Aqui faremos um scan total simples pois localStorage é síncrono e rápido para < 5MB
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}');
          if (entry.expiresAt && entry.expiresAt <= now) {
            localStorage.removeItem(key);
            removed++;
          }
        } catch(e) {
          localStorage.removeItem(key); // Remove corrompidos
        }
      }
    });

    if (removed > 0) {
      console.log(`[Cache] Faxina concluída. ${removed} itens expirados removidos.`);
    }
  }

  /**
   * LIMPEZA DE EMERGÊNCIA (QUANDO O DISCO ENCHE)
   * Remove 20% dos itens mais antigos do LocalStorage.
   */
  private pruneDiskAggressive() {
    const items: { key: string, lastAccessed: number }[] = [];
    
    // Coleta metadados
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}');
          items.push({ key, lastAccessed: entry.lastAccessed || 0 });
        } catch (e) { /* ignore */ }
      }
    }

    // Ordena por mais antigo
    items.sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Remove os 20% mais antigos
    const toRemoveCount = Math.ceil(items.length * 0.2);
    for (let i = 0; i < toRemoveCount; i++) {
      localStorage.removeItem(items[i].key);
    }
    
    console.warn(`[Cache] Limpeza agressiva: ${toRemoveCount} itens removidos do disco.`);
  }

  /**
   * MÉTRICAS PÚBLICAS
   */
  public getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total === 0 ? '0%' : `${((this.metrics.hits / total) * 100).toFixed(1)}%`;
    
    // Conta itens no disco (aproximado)
    let diskItems = 0;
    for(let key in localStorage) {
        if(key.startsWith(CACHE_PREFIX)) diskItems++;
    }

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate,
      memoryItems: this.memoryLayer.size,
      diskItems
    };
  }
}

// Wrapper simplificado para uso externo
export const cachedFetch = <T>(
  key: string, 
  fetcher: () => Promise<T>, 
  options?: CacheOptions
): Promise<T> => {
  return AdvancedCache.getInstance().fetch(key, fetcher, options);
};

// Wrapper para invalidar
export const invalidateCacheTag = (tag: string) => {
  AdvancedCache.getInstance().invalidateByTag(tag);
};

// Accessor para o componente de métricas
export const getCacheManager = (config?: any) => {
  return AdvancedCache.getInstance();
};

// Exporta métricas para debug
export const getCacheMetrics = () => AdvancedCache.getInstance().getMetrics();
