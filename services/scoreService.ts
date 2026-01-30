import { DossierAnalysisData, ExplainableScore, ScoreDimension } from "../types";

function calculateFinancialOpportunity(data: DossierAnalysisData['metrics']): number {
  let score = 0;
  if (data.estimatedTicket > 1000000) score += 30;
  if (data.roi > 30) score += 30;
  if (data.paybackMonths > 0 && data.paybackMonths < 12) score += 30;
  if (data.annualSavings > 500000) score += 10;
  return Math.min(score, 100);
}

function calculateOperationalComplexity(data: DossierAnalysisData['metrics']): number {
  let score = 0;
  if (data.cnpjCount >= 5) score += 25;
  if (data.unitsCount >= 4) score += 25;
  if (data.shadowItScore > 70) score += 25;
  if (data.employeeCount > 200) score += 25;
  return Math.min(score, 100);
}

function calculateRegulatoryUrgency(data: DossierAnalysisData['metrics']): number {
  let score = 0;
  if (data.debtAmount > 1000000) score += 30;
  if (data.prodeicRenewalMonths > 0 && data.prodeicRenewalMonths < 6) score += 35;
  if (data.expiringLicensesCount > 0) score += 20;
  if (data.auditRisk > 70) score += 15;
  return Math.min(score, 100);
}

function calculateTechMaturity(data: DossierAnalysisData['metrics']): number {
  let score = 0;
  if (data.systemAge > 5) score += 25;
  if (data.shadowItScore > 60) score += 25;
  if (data.deciderProfile.toLowerCase().includes("conservative")) score += 20;
  if (data.accountingStatus.toLowerCase().includes("defasada")) score += 30;
  return Math.min(score, 100);
}

export function calculateExplainableScore(analysisData: DossierAnalysisData): ExplainableScore {
  const m = analysisData.metrics;

  const dimensions: ScoreDimension[] = [
    {
      name: "Oportunidade Financeira",
      score: calculateFinancialOpportunity(m),
      weight: 0.30,
      evidences: [
        `Ticket estimado: R$ ${(m.estimatedTicket / 1000000).toFixed(1)}MM`,
        `ROI: ${m.roi}%`,
        `Payback: ${m.paybackMonths} meses`,
      ],
    },
    {
      name: "Complexidade Operacional",
      score: calculateOperationalComplexity(m),
      weight: 0.25,
      evidences: [
        `${m.cnpjCount} CNPJs em silos`,
        `${m.unitsCount} fazendas/plantas`,
        `Shadow IT Score: ${m.shadowItScore}/100`,
      ],
    },
    {
      name: "Urgência Regulatória",
      score: calculateRegulatoryUrgency(m),
      weight: 0.30,
      evidences: [
        `Dívida ativa: R$ ${(m.debtAmount / 1000000).toFixed(1)}MM`,
        `PRODEIC renova em: ${m.prodeicRenewalMonths} meses`,
        `Licenças vencendo: ${m.expiringLicensesCount}`,
      ],
    },
    {
      name: "Maturidade Tecnológica",
      score: calculateTechMaturity(m),
      weight: 0.15,
      evidences: [
        `Sistema: ${m.systemAge} anos de uso`,
        `Contabilidade: ${m.accountingStatus}`,
        `Perfil Decisor: ${m.deciderProfile}`,
      ],
    },
  ];

  // Weighted average
  const scoreTotal = Math.round(
    dimensions.reduce((sum, dim) => sum + dim.score * dim.weight, 0)
  );

  const recommendation =
    scoreTotal >= 75 ? "🔥 QUENTE" : scoreTotal >= 60 ? "☕ MORNO" : "❄️ FRIO";

  return {
    scoreTotal,
    dimensions,
    recommendation,
  };
}