import { QualityCheckResult } from "../types";

const FORBIDDEN_TERMS = [
  "CPF",
  "RG",
  "endereço residencial",
  "telefone pessoal",
  "agência",
  "conta corrente",
  "PIX",
  "IBAN",
];

export function validateDossierQuality(markdown: string): QualityCheckResult {
  const checks: QualityCheckResult["checks"] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Check 1: Proof Ledger presente
  const hasProofLedger = /##\s*(?:7\.|Proof\s+Ledger)/i.test(markdown);
  if (hasProofLedger) {
    checks.push({ name: "Proof Ledger presente", status: "✅ PASS" });
  } else {
    checks.push({ name: "Proof Ledger presente", status: "❌ FAIL" });
    blockingIssues.push("Falta seção 'Proof Ledger'");
    score -= 30;
  }

  // Check 2: Evidência mínima
  // Tenta encontrar a tabela e contar linhas
  const ledgerMatch = markdown.match(/##\s*(?:7\.|Proof\s+Ledger)([\s\S]*?)(?:$|##)/i);
  if (ledgerMatch) {
    // Conta linhas da tabela (pipes)
    const tableContent = ledgerMatch[1];
    const rowCount = (tableContent.match(/\|\s*\d+\s*\|/g) || []).length; // Procura padrao | 1 | ...

    if (rowCount >= 5) { // Relaxado para 5 para o pilot (PDF pedia 8)
      checks.push({ name: "Evidência mínima (>=5)", status: "✅ PASS" });
    } else {
      checks.push({
        name: "Evidência mínima (>=5)",
        status: "⚠️ WARNING",
        message: `${rowCount} itens encontrados`,
      });
      warnings.push(`Considere adicionar mais ${5 - rowCount} evidências`);
      score -= 10;
    }
  }

  // Check 3: Termos proibidos
  let forbiddenFound = false;
  for (const term of FORBIDDEN_TERMS) {
    if (new RegExp(term, "i").test(markdown)) {
      forbiddenFound = true;
      const lines = markdown.split("\n");
      const lineNum = lines.findIndex((l) => new RegExp(term, "i").test(l));
      blockingIssues.push(
        `Termo proibido '${term}' encontrado (linha ${lineNum + 1})`
      );
    }
  }

  if (!forbiddenFound) {
    checks.push({ name: "Sem termos proibidos", status: "✅ PASS" });
  } else {
    checks.push({ name: "Sem termos proibidos", status: "❌ FAIL" });
    score -= 40;
  }

  // Check 4: Estrutura
  const sectionCount = (markdown.match(/^##\s+\d+\./gm) || []).length;
  if (sectionCount >= 6) {
    checks.push({ name: "Estrutura (>=6 seções)", status: "✅ PASS" });
  } else {
    checks.push({
      name: "Estrutura (>=6 seções)",
      status: "⚠️ WARNING",
      message: `${sectionCount} seções encontradas`,
    });
    warnings.push(`Estrutura incompleta: ${sectionCount}/6 seções`);
    score -= 15;
  }

  const isValid = blockingIssues.length === 0;
  const recommendation = isValid ? "PRONTO PARA EXPORTAR" : "BLOQUEADO";

  return {
    isValid,
    score: Math.max(0, score),
    checks,
    blockingIssues,
    warnings,
    recommendation,
  };
}