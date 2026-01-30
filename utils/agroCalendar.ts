
// utils/agroCalendar.ts

export type AgroContext = {
  status: string;
  emoji: string;
  alertLevel: 'low' | 'medium' | 'high';
  message: string;
};

export const getAgroContext = (uf: string, segment: string): AgroContext => {
  const today = new Date();
  const month = today.getMonth() + 1; // 1 = Janeiro, 2 = Fevereiro...
  const seg = segment.toLowerCase();
  const isCentroOeste = ['MT', 'GO', 'MS', 'DF', 'TO'].includes(uf.toUpperCase());

  // --- 1. PRODUTOR DE ALGODÃO (Ciclo de Alto Custo) ---
  if (seg.includes('algodão') && seg.includes('produtor')) {
    // Jan/Fev: Plantio e Tratos Iniciais (MT/BA)
    if (month <= 2) return {
      status: "🚜 Plantio do Algodão", emoji: "☁️", alertLevel: 'high',
      message: "Fase de alto desembolso financeiro (Sementes/Químicos). Margem operacional pressionada."
    };
    // Jun/Jul/Ago: Colheita
    if (month >= 6 && month <= 9) return {
      status: "🚛 Colheita do Algodão", emoji: "📦", alertLevel: 'high',
      message: "Logística complexa de fardos e transporte intenso para algodoeira."
    };
  }

  // --- 2. PRODUTOR DE GRÃOS (Soja/Milho - O Padrão) ---
  if (seg.includes('soja') || seg.includes('grãos') || seg.includes('produtor') || seg.includes('pecuária')) {
    // Jan/Fev/Mar: Colheita Soja / Plantio Milho (O Caos)
    if (month <= 3 && isCentroOeste) return {
      status: "🚜 Pico de Safra (Colheita/Plantio)", emoji: "🌽", alertLevel: 'high',
      message: "Operação no limite. Máquinas em uso máximo, chuva atrapalhando logística de escoamento."
    };
    // Mai/Jun: Desenvolvimento Milho
    if (month >= 4 && month <= 6) return {
      status: "🌱 Desenvolvimento Safrinha", emoji: "🌾", alertLevel: 'medium',
      message: "Momento de monitoramento da lavoura e planejamento de vendas futuras."
    };
  }

  // --- 3. REVENDAS E MÁQUINAS (O Ciclo Financeiro Inverso) ---
  // Quando o produtor colhe, a revenda cobra.
  if (seg.includes('revenda') || seg.includes('máquinas') || seg.includes('insumos')) {
    // Jan/Fev/Mar: Produtor colhendo = Revenda recebendo (Barter/Prazo Safra)
    if (month <= 4) return {
      status: "💰 Safra Financeira (Cobrança)", emoji: "💲", alertLevel: 'high',
      message: "Foco total do backoffice em receber contas dos produtores e liquidar contratos de Barter."
    };
    // Ago/Set/Out: Pré-Plantio = Venda e Entrega
    if (month >= 8 && month <= 10) return {
      status: "🚚 Expedição & Vendas", emoji: "📦", alertLevel: 'high',
      message: "Logística de entrega de insumos no pico. Estoque girando rápido."
    };
  }

  // --- 4. INDÚSTRIA (Usinas e Frigoríficos) ---
  if (seg.includes('usina') || seg.includes('sucro') || seg.includes('bioenergia')) {
    // Jan/Fev/Mar: Entressafra (Manutenção)
    if (month <= 3) return {
      status: "🛠️ Entressafra (Manutenção Industrial)", emoji: "🏭", alertLevel: 'medium',
      message: "Usina parada para reforma. Alto volume de compras de peças e serviços de manutenção."
    };
    // Abr em diante: Moagem
    if (month >= 4) return {
      status: "🔥 Safra de Moagem", emoji: "⚡", alertLevel: 'high',
      message: "Indústria rodando 24h. Foco crítico em rendimento industrial e disponibilidade de planta."
    };
  }

  // Default / Outros
  return {
    status: "Monitoramento de Mercado", emoji: "📡", alertLevel: 'low',
    message: "Verifique o momento específico da empresa."
  };
};
