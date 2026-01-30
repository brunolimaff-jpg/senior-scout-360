
import { AccountData, Evidence } from "../types";

interface ExtractedMetrics {
  areaHa: number;
  employees: number;
  isPF: boolean; // Pessoa Física / Produtor Rural sem CNPJ empresarial claro
  hasMachines: boolean;
}

// Utilitário para extrair métricas de texto não estruturado (Regex)
function extractMetrics(account: AccountData, evidenceList: Evidence[]): ExtractedMetrics {
  const combinedText = `${account.notes} ${account.companyName} ${evidenceList.map(e => e.text).join(' ')}`.toLowerCase();
  
  // 1. Extração de Área (Hectares)
  // Procura por "1000 ha", "1.000 hectares", "area de 5000"
  const areaMatch = combinedText.match(/(\d+[.,]?\d*)\s*(?:ha|hectares?|alq|alqueires?)/i);
  let areaHa = 0;
  if (areaMatch) {
    let val = parseFloat(areaMatch[1].replace('.', '').replace(',', '.'));
    // Conversão simplificada de Alqueire (média 2.42) se necessário, mas assumindo input em HA para simplificar piloto
    if (combinedText.includes('alq')) val = val * 2.42; 
    areaHa = val;
  }
  
  // Fallback: Tenta inferir pelo tamanho da empresa se não achar número
  if (areaHa === 0) {
    if (combinedText.includes('grande porte') || combinedText.includes('multinacional')) areaHa = 15000;
    else if (combinedText.includes('médio porte')) areaHa = 2000;
    else areaHa = 500; // Default conservador
  }

  // 2. Extração de Funcionários
  const empMatch = combinedText.match(/(\d+)\s*(?:funcion[áa]rios?|colaboradores?|empregados?)/i);
  let employees = empMatch ? parseInt(empMatch[1]) : 0;
  // Fallback Linkedin snippets
  if (employees === 0) {
    if (combinedText.includes('201-500')) employees = 300;
    else if (combinedText.includes('51-200')) employees = 100;
    else if (combinedText.includes('11-50')) employees = 30;
  }

  // 3. Detecção de Máquinas/Frota (Sinais)
  const hasMachines = /frota|maquin[áa]rio|tratores|colheitadeiras|manuten[çc][ãa]o/i.test(combinedText);

  // 4. Detecção de Perfil Fiscal (Nome)
  // Se NÃO tiver indicativo de sociedade ltda/sa, assume chance alta de Produtor Rural PF
  const corporateSignals = /\b(ltda|s\.a|s\/a|limitada|participa[çc][õo]es|holding|agropecu[áa]ria|com[ée]rcio)\b/i;
  const isPF = !corporateSignals.test(account.companyName);

  return { areaHa, employees, hasMachines, isPF };
}

export function generateStrategySectionMarkdown(account: AccountData, evidenceList: Evidence[]): string {
  const metrics = extractMetrics(account, evidenceList);
  
  // --- LÓGICA 1: SIMULADOR FINANCEIRO (IMEA) ---
  // Premissas: Soja, 60 sc/ha, R$ 120,00/sc (Conservador)
  const BAGS_PER_HA = 60;
  const PRICE_PER_BAG = 120;
  const revenuePotential = metrics.areaHa * BAGS_PER_HA * PRICE_PER_BAG;
  const marginLoss = revenuePotential * 0.15; // 15% de perda por falta de gestão

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const financialBlock = `
### 📊 1. Simulador de Cenário (Estimativa IMEA/Soja)
> *Baseado em área estimada de **${metrics.areaHa.toLocaleString('pt-BR')} hectares**.*

* **Receita Bruta Potencial (Safra):** ~${formatCurrency(revenuePotential)}
* **Risco de Quebra Operacional:** Estudos indicam que a falta de gestão integrada pode corroer até 15% da margem.

::: warning
⚠️ **Risco Calculado:** Sem um ERP especialista, este cliente está deixando na mesa aproximadamente **${formatCurrency(marginLoss)}** por safra devido a ineficiências de compra, estoque e venda.
:::
`;

  // --- LÓGICA 2: A REGRA DE OURO (CROSS-SELL) ---
  let strategyIcon = "📦";
  let strategyTitle = "Pacote Standard";
  let strategyText = "Venda **Senior ERP (Backbone)**. Foco em profissionalização fiscal e financeira.";
  
  if (metrics.employees > 50 && (metrics.areaHa > 5000 || metrics.hasMachines)) {
    strategyIcon = "👑";
    strategyTitle = "OFERTA DIAMANTE (Full Suite)";
    strategyText = "Venda **ERP + GAtec + HCM**. Cliente estratégico de alta complexidade. A dor está na gestão de pessoas E no custo de produção. Venda a Plataforma completa.";
  } else if (metrics.employees > 50) {
    strategyIcon = "🔥";
    strategyTitle = "Estratégia de Agregação (Pessoas)";
    strategyText = "Venda **ERP + HCM**. Cliente com alta complexidade de folha/eSocial (>50 vidas). Use o HCM e o Compliance trabalhista para travar o negócio e diferenciar da concorrência local.";
  } else if (metrics.areaHa > 3000 || metrics.hasMachines) {
    strategyIcon = "🚜";
    strategyTitle = "Estratégia de Agregação (Campo)";
    strategyText = "Venda **ERP + GAtec**. O ERP controla o escritório (Backoffice), mas a dor real dele está no custo hora/máquina. O GAtec é o diferencial técnico que ganha do SAP B1/Totvs neste cenário.";
  }

  const offerBlock = `
### ${strategyIcon} 2. A Regra de Ouro (Sugestão de Oferta)
**${strategyTitle}**

${strategyText}
`;

  // --- LÓGICA 3: ALERTA FISCAL (LCDPR) ---
  let fiscalBlock = "";
  if (metrics.isPF) {
    fiscalBlock = `
### 🛡️ 3. Alerta de Oportunidade Fiscal
::: info
**Risco LCDPR Detectado:** A razão social sugere Produtor Rural (Pessoa Física).
* **Argumento Matador:** "O Sr. não precisa virar LTDA para ter gestão. O Senior ERP gera o LCDPR (Livro Caixa Digital) automaticamente, evitando malha fina na Receita Federal."
:::
`;
  }

  return `
## 💰 Cenário Financeiro & Estratégia Senior
*Gerado automaticamente baseado nos dados coletados.*

${financialBlock}
${offerBlock}
${fiscalBlock}

---
*Nota: Valores estimados com base em médias de mercado (Soja/MT) para fins de argumentação de venda.*
`;
}
