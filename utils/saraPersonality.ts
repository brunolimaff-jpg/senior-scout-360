export const SARA_PHRASES = {
  START: [
    "☕ Enchendo a garrafa de café e calibrando o GPS...",
    "🚜 Ligando os motores e verificando o óleo da inteligência...",
    "👢 Calçando a botina para entrar no mato digital...",
    "🤠 Ajeitando o chapéu: hora de caçar oportunidades...",
    "📡 Ajustando a antena da Starlink para achar sinal de dinheiro..."
  ],
  API_CONNECT: [
    "📡 Conectando na Receita Federal...",
    "💾 Baixando lista oficial de CNPJs...",
    "🏛️ Acessando base de dados governamental...",
    "🔑 Autenticando no portal de dados abertos...",
    "📂 Recuperando fichas cadastrais..."
  ],
  STRATEGY: [
    "🎯 Ajustando a mira no alvo...",
    "🛰️ Definindo os vetores de busca regional...",
    "📐 Traçando o mapa da prospecção estratégica...",
    "🔦 Verificando as lanternas da inteligência..."
  ],
  HUNTING: [
    "🛰️ Sobrevoando a região com drone espião...",
    "👀 Olhando por cima da cerca do vizinho...",
    "📜 Lendo Diários Oficiais mais rápido que fofoca...",
    "🚧 Varrendo a internet atrás de quem está expandindo...",
    "🌽 Contando os grãos antes da colheita..."
  ],
  INVESTIGATING: [
    "🕵️ Investigando reputação...",
    "🔍 Verificando passivos trabalhistas...",
    "⚖️ Consultando diários oficiais...",
    "📰 Cruzando notícias de mercado...",
    "🚨 Checando sinais de risco..."
  ],
  SCRAPING: [
    "📑 Extraindo dados de portais rurais e cooperativas...",
    "📰 Lendo notícias de expansão e investimentos...",
    "🔗 Mapeando sites corporativos e LinkedIn...",
    "📊 Coletando sinais de faturamento e área..."
  ],
  CROSS_REF: [
    "🔗 Cruzando malhas de dados e sinais de mercado...",
    "🧬 Identificando o DNA do grupo econômico...",
    "📡 Sincronizando dados de satélite com registros comerciais...",
    "🧩 Unindo as peças do quebra-cabeça corporativo..."
  ],
  FISCAL_SCAN: [
    "⚖️ Verificando capital social e histórico de licenças...",
    "🏦 Analisando saúde financeira e porte estimado...",
    "📜 Checando registros de exportação e comercialização...",
    "💰 Validando o poder de fogo para investimentos..."
  ],
  FILTERING: [
    "🚜 Passando o trator no que não é ICP...",
    "🧹 Limpando a base de dados de leads 'ruído'...",
    "🔍 Refinando a lista: só entra quem tem perfil Senior...",
    "🗑️ Descartando cadastros defasados e sem relevância..."
  ],
  ANALYZING: [
    "📉 Caçando quem ainda usa Excel para gerir 5.000 hectares...",
    "🔥 Identificando dores de crescimento e gargalos operacionais...",
    "🧩 Analisando a maturidade tecnológica da gestão...",
    "⚠️ Detectando riscos fiscais e sucessórios latentes..."
  ],
  SCORING: [
    "⚖️ Separando o Joio (sem grana) do Trigo (Leads Senior)...",
    "⭐ Calculando o Score de Aderência (Fit Index)...",
    "🥇 Ranqueando os melhores alvos por prioridade...",
    "💎 Lapidando os dados: sai terra, fica o diamante..."
  ],
  DONE: [
    "🥩 O bife está no ponto. Leads na bandeja.",
    "🚀 Compilando o dossiê para o ataque.",
    "🥂 Pode preparar o contrato, achei ouro.",
    "🤠 Missão cumprida. O gado tá no curral."
  ]
};

export const getRandomPhrase = (category: keyof typeof SARA_PHRASES): string => {
  const phrases = SARA_PHRASES[category];
  return phrases[Math.floor(Math.random() * phrases.length)];
};
