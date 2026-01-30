
import { DossierAnalysisData, Evidence, ExplainableScore } from "../types";

function getScoreEmoji(score: number): string {
  if (score >= 75) return "🔥";
  if (score >= 60) return "☕";
  return "❄️";
}

export function generateDossierFromTemplate(
  analysis: DossierAnalysisData,
  score: ExplainableScore,
  evidenceList: Evidence[]
): string {
  const today = new Date().toLocaleDateString("pt-BR");
  const company = analysis.company;
  const metrics = analysis.metrics;
  const qual = analysis.qualitative;
  const recommendations = analysis.seniorRecommendations || [];
  const explanation = analysis.scoreExplanation;

  const proofLedgerRows = evidenceList
    .filter(e => e.selected)
    .map((ev, idx) => {
      const conf = ev.citations?.[0]?.confidence ? Math.round(ev.citations[0].confidence * 100) : 95;
      const source = ev.source || ev.url || 'Manual';
      const cleanUrl = ev.url ? `[Link](${ev.url})` : '';
      return `| ${idx + 1} | ${ev.title || ev.text?.substring(0, 50)} | ${source} ${cleanUrl} | ${conf}% |`;
    })
    .join("\n");

  const driversList = (explanation?.drivers || []).map(d => 
    `- **${d.label}** (${d.points > 0 ? '+' : ''}${d.points}): ${d.why}`
  ).join('\n') || "Análise automática.";

  const missingList = (explanation?.missingInfo || []).map(m => `- ${m}`).join('\n') || "- Nada crítico identificado.";
  const confirmList = (explanation?.howToConfirm || []).map(m => `- ${m}`).join('\n') || "- Verificar na primeira reunião.";

  return `# Dossiê Estratégico de Conta — ${company.name}

**Data:** ${today} | **Inteligência de Mercado Senior**

---

## 1. RESUMO EXECUTIVO & SCORE
**Score de Oportunidade:** ${explanation?.scoreTotal || score.scoreTotal}/100 ${getScoreEmoji(explanation?.scoreTotal || score.scoreTotal)}

### 📊 Por que este Score? (Drivers)
${driversList}

### 📝 O Que Faltou Descobrir (Missing Info)
${missingList}

### 🕵️ Como Confirmar na Reunião
${confirmList}

---

## 2. RAIO-X OPERACIONAL
- **Unidades:** ${metrics.unitsCount} fazendas/plantas
- **CNPJs:** ${metrics.cnpjCount} (Indicativo de complexidade fiscal)
- **Funcionários:** ~${metrics.employeeCount}
- **Stack Tecnológico:** ${qual.techSummary}
- **Sistema Atual:** Estimado ${metrics.systemAge} anos de uso.

---

## 3. SOLUÇÕES SENIOR RECOMENDADAS
*Baseado nas dores identificadas nas evidências.*

${recommendations.map(rec => `
### 🟢 ${rec.product} (${rec.module})
- **Dor:** ${rec.painAddressed}
- **Valor:** ${rec.valueProp}
- **Caso Similar:** ${rec.similarUseCase || 'Consultar base de casos.'}
`).join('\n')}

---

## 4. ANÁLISE QUALITATIVA
**Situação Fiscal:**
${qual.fiscalSummary}

**Perfil do Decisor:**
${metrics.deciderProfile} — ${qual.decisionSummary}

---

## 5. PROOF LEDGER (EVIDÊNCIAS ORIGINAIS)
| # | Afirmação / Evidência | Fonte | Confiança |
| :--- | :--- | :--- | :--- |
${proofLedgerRows}

---
*Uso estritamente interno para inteligência de mercado.*
`;
}
