
export interface EstimationParams {
  hectares?: number;
  heads?: number; // Cabeças de gado
  branches?: number;
  crushingCapacity?: number; // Toneladas de cana
}

export interface RevenueEstimation {
  estimatedRange: string;
  rawAvg: number;
  logic: string;
}

export const estimateRevenue = (segment: string, data: EstimationParams): RevenueEstimation | null => {
  let lowEstimate = 0;
  let highEstimate = 0;
  let logic = "";

  const cleanSegment = (segment || "").toLowerCase();

  // --- 1. PRODUTOR DE GRÃOS (Soja/Milho) ---
  // Lógica: Safra (Verão) + Safrinha (Inverno)
  // Base: R$ 10k a R$ 13k por hectare/ano bruto
  if (cleanSegment.includes('grãos') || cleanSegment.includes('soja') || cleanSegment.includes('produtor') || cleanSegment.includes('agrícola') || cleanSegment.includes('algodão')) {
    if (data.hectares && data.hectares > 0) {
      // Se for algodão, o valor é bem maior, ajustamos se detectado
      const isCotton = cleanSegment.includes('algodão') || cleanSegment.includes('fibra');
      const multiplierLow = isCotton ? 18000 : 10000;
      const multiplierHigh = isCotton ? 25000 : 13000;

      lowEstimate = data.hectares * multiplierLow;
      highEstimate = data.hectares * multiplierHigh;
      logic = isCotton 
        ? `Baseado em alto custo/receita do Algodão (MT/BA).`
        : `Baseado em produtividade média de Soja+Milho na região (60+100 sc/ha) x Preço Médio de Mercado.`;
    }
  }

  // --- 2. PECUÁRIA (Gado de Corte) ---
  else if (cleanSegment.includes('pecuária') || cleanSegment.includes('gado') || cleanSegment.includes('bovino')) {
    if (data.heads && data.heads > 0) { 
      // Se temos nº de cabeças (Giro)
      lowEstimate = data.heads * 1500; // Faturamento por cabeça girada
      highEstimate = data.heads * 2200;
      logic = `Estimativa baseada no giro de rebanho e preço da Arroba atual.`;
    } else if (data.hectares && data.hectares > 0) {
      // Se temos apenas área (Extensivo vs Intensivo)
      lowEstimate = data.hectares * 2500;
      highEstimate = data.hectares * 4000;
      logic = `Estimativa baseada em lotação média de pastagem e giro de arroba (Pecuária de Ciclo Curto).`;
    }
  }

  // --- 3. INDÚSTRIA (Usinas e Frigoríficos) ---
  else if (cleanSegment.includes('usina') || cleanSegment.includes('sucro') || cleanSegment.includes('etanol') || cleanSegment.includes('bioenergia')) {
    if (data.crushingCapacity && data.crushingCapacity > 0) { 
      // Capacidade de Moagem (Ex: 2.000.000 tons)
      lowEstimate = data.crushingCapacity * 280;
      highEstimate = data.crushingCapacity * 350;
      logic = `Baseado no mix de produção (Açúcar/Etanol) por tonelada de cana moída (TCH).`;
    }
  }

  // Se não conseguiu estimar
  if (lowEstimate === 0 || highEstimate === 0) return null;

  // Formata para milhões (MM)
  const format = (val: number) => (val / 1000000).toFixed(1).replace('.', ',') + " MM";

  return {
    estimatedRange: `R$ ${format(lowEstimate)} - R$ ${format(highEstimate)}`,
    rawAvg: (lowEstimate + highEstimate) / 2,
    logic: logic
  };
};
