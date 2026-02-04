
import { BusinessPersona } from "./businessPersonaDetector";

// ==================== TIPOS E INTERFACES ====================

export interface MarketContext {
  vertical: string; // Ex: "Sucroenergético", "Grãos & Fibras", "Cooperativismo"
  verticalDescription: string;
  scaleIndicator: {
    metric: string;  // "Capacidade de moagem", "Hectares próprios", "Volume movimentado"
    value: string;   // Valor formatado ou estimado
    benchmark: string;  // "Médio porte no setor (top 30%)"
    interpretation: string; // Explicação contextual
  };
  typicalMargins: {
    low: number; // %
    high: number; // %
    commentary: string; // "Volátil devido ao preço do ATR/Etanol"
  };
  decisionStructure: {
    type: string; // "Familiar Profissionalizada", "Corporativa (Board)", "Assembleia Cooperada"
    keyRoles: string[]; // ["Diretor Agrícola", "Gerente Industrial", "CFO"]
    influencers: string[]; // ["Consultores Agronômicos", "Conselho de Família"]
    salesCycle: string; // "Longo (6-12 meses)", "Médio (3-6 meses)"
    approvalLevels: number; // 1 a 5
    buyingTrigger: string; // O que faz eles assinarem contrato?
  };
  typicalPainPoints: string[];
  competitiveContext: string;
}

interface EnrichmentInput {
  persona: BusinessPersona;
  capitalSocial: number;
  cnaePrincipal: string;
  location: { state: string; city: string };
  faturamentoEstimado?: number;
}

// ==================== BASE DE CONHECIMENTO (HARD-CODED) ====================

interface VerticalProfile {
  name: string;
  description: string;
  scaleMetric: string;
  margins: { low: number; high: number; comment: string };
  painPoints: string[];
  buyingTrigger: string;
  keyRoles: string[];
}

const VERTICAL_KNOWLEDGE_BASE: Record<string, VerticalProfile> = {
  'SUCROENERGIA': {
    name: 'Indústria Sucroenergética (Usinas)',
    description: 'Setor de capital intensivo focado em processamento de cana-de-açúcar para açúcar, etanol e bioenergia.',
    scaleMetric: 'Capacidade de Moagem (TC/Safra)',
    margins: { low: 12, high: 22, comment: 'Margens voláteis atreladas ao preço internacional do açúcar e paridade do etanol. Eficiência industrial é crítica.' },
    painPoints: [
      'Gestão de fornecedores de cana (integração agrícola)',
      'Custos de manutenção industrial (entressafra)',
      'Compliance ambiental e certificações (RenovaBio)',
      'Gestão de ativos biológicos (canavial próprio vs terceiro)'
    ],
    buyingTrigger: 'Redução de Custo Industrial e Compliance Fiscal/Ambiental',
    keyRoles: ['Diretor Industrial', 'Diretor Agrícola', 'CFO', 'Gerente de Manutenção']
  },
  'GRAOS_FIBRAS': {
    name: 'Produção de Grãos & Fibras (Soja/Milho/Algodão)',
    description: 'Produção em larga escala com foco em eficiência agronômica e gestão de custos por hectare.',
    scaleMetric: 'Área Plantada (Hectares)',
    margins: { low: 15, high: 35, comment: 'Alta dependência climática e cambial. Algodão possui margens maiores mas custo operacional 3x superior à soja.' },
    painPoints: [
      'Controle de custos por talhão/safra',
      'Gestão de maquinário e manutenção de frota',
      'Inventário de insumos e rastreabilidade',
      'Obrigação fiscal LCDPR (Livro Caixa Digital)'
    ],
    buyingTrigger: 'Controle de Custo Real e Planejamento de Safra',
    keyRoles: ['Gerente de Fazenda', 'CFO/Financeiro', 'Proprietário', 'Agrônomo Chefe']
  },
  'COOPERATIVA': {
    name: 'Cooperativismo Agrícola',
    description: 'Sociedade de pessoas voltada para prestação de serviços aos cooperados (recebimento, armazenamento, assistência técnica).',
    scaleMetric: 'Faturamento Agregado & Nº Cooperados',
    margins: { low: 2, high: 5, comment: 'Margens operacionais estreitas (modelo repasse). Foco em volume e sobras para o cooperado.' },
    painPoints: [
      'Gestão de relacionamento com milhares de cooperados',
      'Rastreabilidade da produção recebida',
      'Compliance tributário complexo (Ato Cooperativo)',
      'Gestão de lojas agropecuárias e crédito'
    ],
    buyingTrigger: 'Governança, Compliance e Serviços ao Cooperado',
    keyRoles: ['Presidente', 'Diretor Executivo', 'Conselho de Administração', 'Gerente de TI']
  },
  'TRADING_LOGISTICA': {
    name: 'Trading & Armazenagem',
    description: 'Intermediação comercial, armazenamento e logística de escoamento. Não produz, movimenta.',
    scaleMetric: 'Volume Movimentado (Toneladas)',
    margins: { low: 1, high: 4, comment: 'Margens de trading puras são baixas. Ganho em escala, spread logístico e arbitragem financeira.' },
    painPoints: [
      'Gestão de risco de mercado (Hedge)',
      'Logística e fretes',
      'Contratos futuros e Barter',
      'Qualidade de armazenagem (quebra técnica)'
    ],
    buyingTrigger: 'Velocidade na Operação Comercial e Gestão de Risco',
    keyRoles: ['Trader Sênior', 'Diretor Comercial', 'Gerente de Logística', 'CFO']
  },
  'PECUARIA': {
    name: 'Pecuária Intensiva/Extensiva',
    description: 'Criação de gado (corte/leite). Ciclos longos e gestão de ativo biológico animal.',
    scaleMetric: 'Cabeças de Gado (Rebanho)',
    margins: { low: 8, high: 20, comment: 'Pecuária de ciclo completo tem margem menor que recria/engorda intensiva. Alta imobilização de capital.' },
    painPoints: [
      'Rastreabilidade animal individual (SISBOV)',
      'Controle de custos nutricionais',
      'Gestão de mortalidade e natalidade',
      'Conectividade no campo'
    ],
    buyingTrigger: 'Gestão de Rebanho e Controle Nutricional',
    keyRoles: ['Gerente de Pecuária', 'Veterinário Responsável', 'Proprietário']
  },
  'SEMENTES': {
    name: 'Produção de Sementes (Sementeira)',
    description: 'Indústria de base tecnológica. Alta regulação (MAPA) e valor agregado.',
    scaleMetric: 'Sacos/Volume Produzido',
    margins: { low: 20, high: 40, comment: 'Margens premium devido à tecnologia embarcada e royalties. Risco de qualidade (germinação) é crítico.' },
    painPoints: [
      'Rastreabilidade rigorosa (RENASEM)',
      'Controle de qualidade laboratorial',
      'Gestão de royalties (Bayer, Syngenta)',
      'Logística de entrega fracionada'
    ],
    buyingTrigger: 'Compliance Regulatório e Controle de Qualidade',
    keyRoles: ['Diretor de Produção', 'Responsável Técnico (RT)', 'Comercial']
  }
};

// ==================== LÓGICA DE CLASSIFICAÇÃO ====================

function detectVerticalKey(persona: BusinessPersona, cnae: string): string {
  const cnaeClean = cnae.toLowerCase();
  
  if (persona.ownership === 'COOPERATIVA' || persona.primaryRole === 'COOPERATIVA') {
    return 'COOPERATIVA';
  }

  if (cnaeClean.includes('cana') || cnaeClean.includes('álcool') || cnaeClean.includes('açúcar') || cnaeClean.includes('bioenergia')) {
    return 'SUCROENERGIA';
  }

  if (cnaeClean.includes('semente') || cnaeClean.includes('genética')) {
    return 'SEMENTES';
  }

  if (cnaeClean.includes('algodão') || cnaeClean.includes('fibra')) {
    // Algodão tem dinâmica quase industrial
    return 'GRAOS_FIBRAS'; 
  }

  if (persona.primaryRole === 'TRADING_ARMAZEM' || cnaeClean.includes('armazém') || cnaeClean.includes('silo') || cnaeClean.includes('atacadista de soja')) {
    return 'TRADING_LOGISTICA';
  }

  if (cnaeClean.includes('bovino') || cnaeClean.includes('gado') || cnaeClean.includes('pecuária')) {
    return 'PECUARIA';
  }

  // Default agro padrão
  return 'GRAOS_FIBRAS';
}

function assessScale(verticalKey: string, input: EnrichmentInput): MarketContext['scaleIndicator'] {
  const cap = input.capitalSocial;
  const ha = input.persona.realHectares || 0;
  
  // Lógica específica por vertical
  if (verticalKey === 'SUCROENERGIA') {
    // Usinas medem por moagem, mas capital social é proxy de infraestrutura
    let benchmark = "Pequeno porte / Destilaria autônoma";
    if (cap > 200_000_000) benchmark = "Grupo Sucroenergético Major (Top Tier)";
    else if (cap > 50_000_000) benchmark = "Usina de porte médio-grande";
    
    return {
      metric: "Capacidade Industrial (Proxy Capital)",
      value: `Capital R$ ${(cap/1_000_000).toFixed(0)}MM`,
      benchmark,
      interpretation: "O porte é definido pela capacidade industrial instalada, não apenas pela área própria, já que é comum processar cana de fornecedores."
    };
  }

  if (verticalKey === 'COOPERATIVA') {
    let benchmark = "Cooperativa Regional";
    if (cap > 100_000_000) benchmark = "Grande Cooperativa (Hub de Exportação)";
    else if (cap > 20_000_000) benchmark = "Cooperativa Média consolidada";

    return {
      metric: "Força Cooperada (Capital Social)",
      value: `R$ ${(cap/1_000_000).toFixed(0)}MM`,
      benchmark,
      interpretation: "O capital reflete a solidez e o número de cotas-partes. Faturamento real é geralmente 10-20x o capital social."
    };
  }

  if (verticalKey === 'GRAOS_FIBRAS') {
    // Aqui Hectares mandam
    let benchmark = "Produtor Médio";
    if (ha > 50_000) benchmark = "Mega Produtor (Agro-Empresa)";
    else if (ha > 10_000) benchmark = "Grande Produtor (Corporate)";
    else if (ha > 2_000) benchmark = "Produtor Médio-Grande";
    else if (ha < 500) benchmark = "Pequeno Produtor / Familiar";

    return {
      metric: "Área de Plantio",
      value: `${ha.toLocaleString()} hectares`,
      benchmark,
      interpretation: "Escala baseada em área produtiva. Acima de 5.000ha, a gestão profissionalizada torna-se mandatória para manter margens."
    };
  }

  // Default Fallback
  return {
    metric: "Capital Social",
    value: `R$ ${(cap/1_000_000).toFixed(0)}MM`,
    benchmark: cap > 10_000_000 ? "Empresa de Grande Porte" : "PME do Agro",
    interpretation: "Indicador financeiro padrão utilizado na ausência de métricas operacionais específicas."
  };
}

function assessDecisionStructure(verticalKey: string, input: EnrichmentInput): MarketContext['decisionStructure'] {
  const { persona, capitalSocial } = input;
  const isSA = persona.ownership === 'INVESTIDOR_FINANCEIRO' || input.persona.ecosystem.role.includes('S.A');
  const isLarge = capitalSocial > 50_000_000;

  if (verticalKey === 'COOPERATIVA') {
    return {
      type: "Assembleia & Diretoria Executiva",
      keyRoles: ["Presidente do Conselho", "Superintendente", "Gerente de TI/Inovação"],
      influencers: ["Conselho Fiscal", "Líderes Regionais", "Consultoria Externa"],
      salesCycle: "Longo (6-12 meses)",
      approvalLevels: 5,
      buyingTrigger: "Aprovação em assembleia ou orçamento anual estratégico."
    };
  }

  if (isSA || isLarge) {
    return {
      type: "Corporativa (C-Level & Board)",
      keyRoles: ["CEO", "CFO", "Diretor de Operações (COO)", "Gerente de TI"],
      influencers: ["Gerentes de Unidade", "Usuários Chave", "Consultoria de ERP"],
      salesCycle: "Médio-Longo (4-9 meses)",
      approvalLevels: 4,
      buyingTrigger: "ROI comprovado, Compliance e Integração de dados para o Board."
    };
  }

  // Familiar Profissionalizada
  if (capitalSocial > 5_000_000) {
    return {
      type: "Familiar Profissionalizada",
      keyRoles: ["Sócio-Administrador (Patriarca/Sucessor)", "Gerente Financeiro (Não-familiar)", "Agrônomo Chefe"],
      influencers: ["Contador Externo", "Filhos na gestão", "Consultor Agronômico"],
      salesCycle: "Médio (2-5 meses)",
      approvalLevels: 2,
      buyingTrigger: "Confiança na marca, Indicação de vizinhos e Controle Financeiro."
    };
  }

  // Familiar Padrão
  return {
    type: "Familiar Centralizada",
    keyRoles: ["Proprietário (Dono)", "Esposa/Filho (Financeiro)"],
    influencers: ["Contador", "Vendedor da Revenda", "Vizinhos"],
    salesCycle: "Curto-Médio (1-3 meses)",
    approvalLevels: 1,
    buyingTrigger: "Preço, Simplicidade de uso e Resolver dor imediata (ex: Nota Fiscal)."
  };
}

// ==================== FUNÇÃO PRINCIPAL (ENTRY POINT) ====================

export function enrichMarketContext(input: EnrichmentInput): MarketContext {
  // 1. Identificar a Vertical Real
  const verticalKey = detectVerticalKey(input.persona, input.cnaePrincipal);
  const profile = VERTICAL_KNOWLEDGE_BASE[verticalKey] || VERTICAL_KNOWLEDGE_BASE['GRAOS_FIBRAS'];

  // 2. Calcular Escala Contextualizada
  const scale = assessScale(verticalKey, input);

  // 3. Definir Estrutura de Decisão
  const decision = assessDecisionStructure(verticalKey, input);

  // 4. Montar Contexto Competitivo
  let competitiveContext = `O setor de ${profile.name} em ${input.location.state} é altamente competitivo. `;
  if (scale.benchmark.includes("Grande") || scale.benchmark.includes("Major")) {
    competitiveContext += "Esta empresa atua como líder/consolidada, provável alvo de M&A ou IPO. Possui poder de barganha alto com fornecedores.";
  } else {
    competitiveContext += "Esta empresa busca eficiência operacional para sobreviver à consolidação do mercado e flutuação de preços.";
  }

  // 5. Ajustar Pain Points com base na Persona Específica
  // Ex: Se a persona diz que NÃO planta (é apenas indústria), removemos pain points de campo
  let finalPainPoints = [...profile.painPoints];
  if (input.persona.verticalization === 'NONE' && verticalKey === 'SUCROENERGIA') {
    finalPainPoints = finalPainPoints.filter(p => !p.includes('canavial próprio'));
    finalPainPoints.push("Dependência de fornecedores de cana terceiros");
  }

  return {
    vertical: profile.name,
    verticalDescription: profile.description,
    scaleIndicator: scale,
    typicalMargins: {
      low: profile.margins.low,
      high: profile.margins.high,
      commentary: profile.margins.comment
    },
    decisionStructure: decision,
    typicalPainPoints: finalPainPoints,
    competitiveContext
  };
}
