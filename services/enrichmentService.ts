
// Business Logic for Visual Inferences (Tags/Badges)
import { getAgroContext } from '../utils/agroCalendar';

const PUBLIC_DOMAINS = [
  'gmail.com', 'hotmail.com', 'yahoo.com', 'yahoo.com.br', 
  'uol.com.br', 'bol.com.br', 'outlook.com', 'terra.com.br', 
  'ig.com.br', 'live.com', 'icloud.com'
];

export interface VisualInference {
  label: string;
  color: string; // Tailwind class subset (bg-color-100 text-color-700)
  icon: string; // Emoji
  type: 'MATURITY' | 'STRUCTURE' | 'HARVEST';
}

// 1. Maturidade Digital (Via Email)
export const analyzeDigitalMaturity = (email?: string): VisualInference | null => {
  if (!email) return null;
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  if (PUBLIC_DOMAINS.includes(domain)) {
    return {
      label: "Gestão Familiar/Simples",
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      icon: "⚠️",
      type: 'MATURITY'
    };
  } else {
    return {
      label: "Corporativo/Estruturado",
      color: "bg-green-100 text-green-800 border-green-200",
      icon: "🏢",
      type: 'MATURITY'
    };
  }
};

// 2. Estrutura Societária (Via QSA)
export const analyzeCorporateStructure = (qsa?: Array<{ nome: string; qual: string }>): VisualInference | null => {
  if (!qsa || qsa.length === 0) return null;

  // Check for Holding/PJ partners
  const hasLegalEntityPartner = qsa.some(p => {
    const name = p.nome.toUpperCase();
    return name.includes('LTDA') || name.includes('S.A') || name.includes('S/A') || name.includes('HOLDING') || name.includes('PARTICIPACOES') || name.includes('INVESTIMENTOS');
  });

  if (hasLegalEntityPartner) {
    return {
      label: "Holding/Grupo Econômico",
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: "🏛️",
      type: 'STRUCTURE'
    };
  }

  // Check for Family Clan (Same Surnames)
  if (qsa.length > 2) {
    const surnames = qsa.map(p => {
      const parts = p.nome.trim().split(' ');
      return parts[parts.length - 1].toUpperCase();
    }).filter(s => s.length > 2 && !['JUNIOR', 'FILHO', 'NETO', 'SOBRINHO'].includes(s));

    // Count occurrences
    const counts: Record<string, number> = {};
    let maxCount = 0;
    surnames.forEach(s => {
      counts[s] = (counts[s] || 0) + 1;
      if (counts[s] > maxCount) maxCount = counts[s];
    });

    if (maxCount >= 2) {
      return {
        label: "Clã Familiar (Sucessão)",
        color: "bg-teal-100 text-teal-800 border-teal-200",
        icon: "👨‍👩‍👦",
        type: 'STRUCTURE'
      };
    }
  }

  return null;
};

// 3. Status da Safra (Via AgroCalendar)
export const getHarvestStatus = (uf?: string, segment?: string): VisualInference | null => {
  if (!uf) return null;
  
  // Usa o novo motor de contexto com Segmento
  const context = getAgroContext(uf, segment || '');

  let color = "bg-emerald-50 text-emerald-700 border-emerald-100";
  
  if (context.alertLevel === 'high') {
    // Nível Crítico (Colheita/Plantio Intenso/Cobrança)
    color = "bg-orange-100 text-orange-800 border-orange-200";
  } else if (context.alertLevel === 'medium') {
    // Nível Médio (Desenvolvimento)
    color = "bg-yellow-100 text-yellow-800 border-yellow-200";
  } else {
    // Nível Baixo (Vazio/Preparação)
    color = "bg-green-100 text-green-800 border-green-200";
  }

  return {
    label: context.status,
    color: color,
    icon: context.emoji,
    type: 'HARVEST'
  };
};

export const getAllInferences = (lead: { email?: string, qsa?: any[], uf?: string, businessType?: string }): VisualInference[] => {
  const list: VisualInference[] = [];
  
  const maturity = analyzeDigitalMaturity(lead.email);
  if (maturity) list.push(maturity);

  const structure = analyzeCorporateStructure(lead.qsa);
  if (structure) list.push(structure);

  const harvest = getHarvestStatus(lead.uf, lead.businessType);
  if (harvest) list.push(harvest);

  return list;
};