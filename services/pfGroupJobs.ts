
import { GoogleGenAI } from "@google/genai";
import { CompanyRelatedItem, PFProspect, PhaseTelemetry, GroupMagnitudeSummary } from "../types";
import { JobRunner, JobCallbacks } from "./jobRunnerService";
import { fetchCnpjData } from "./apiService";
import { calculateLeadIntelligence } from "./prospectorService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * JOB 1: SeedDiscoveryJob
 * Extrai CNPJs candidatos a partir do rastro digital do PF.
 */
export async function runSeedDiscoveryJob(
  pf: PFProspect,
  // FIX: Generic parameter 'I' should be CompanyRelatedItem, not CompanyRelatedItem[]
  callbacks: JobCallbacks<CompanyRelatedItem[], CompanyRelatedItem>
) {
  const runner = new JobRunner("Seed Discovery");
  return runner.run(1, async (r, controller) => {
    r.updateStep("Caçando sementes de CNPJ...", 0, 1);
    callbacks.onLog?.(`🕵️ Iniciando Varredura Tática para ${pf.displayName}...`, 'info');

    const prompt = `LOCALIZE CNPJs reais ligados ao produtor: ${pf.displayName} em ${pf.city}/${pf.uf}.
    ESTRATÉGIAS: 1. Holdings da família. 2. Fazendas registradas como PJ. 3. Sócios administradores.
    REGRA ZERO FICÇÃO: Retorne APENAS se houver URL real.
    FORMATO JSON: [{ "cnpj": "14 digitos", "razao": "nome", "url": "url", "snippet": "texto", "motivo": "vínculo" }]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
    });

    const items = JSON.parse(response.text || '[]');
    const results: CompanyRelatedItem[] = items.map((i: any) => ({
      cnpj: i.cnpj?.replace(/\D/g, ''),
      razaoSocial: i.razao,
      situacao: 'PENDENTE',
      capitalSocial: null,
      qsaCount: null,
      evidenceUrls: [i.url],
      snippets: [i.snippet],
      validationStatus: 'PENDENTE',
      attemptCount: 0,
      estimatedRevenue: null,
      confidence: 80,
      linkReasons: [i.motivo]
    })).filter((i: any) => i.cnpj?.length === 14);

    r.updateStep("Discovery finalizado", 1, 1);
    callbacks.onLog?.(`🎯 IA localizou ${results.length} candidatos com evidências.`, 'success');
    callbacks.onItemUpdate?.(results);
    return results;
  }, callbacks);
}

/**
 * JOB 2: CNPJValidationJob
 * Valida incrementalmente cada CNPJ via BrasilAPI.
 */
export async function runCNPJValidationJob(
  items: CompanyRelatedItem[],
  // FIX: Generic parameter 'I' should be CompanyRelatedItem, not CompanyRelatedItem[]
  callbacks: JobCallbacks<CompanyRelatedItem[], CompanyRelatedItem>
) {
  const runner = new JobRunner("CNPJ Validation");
  return runner.run(items.length, async (r, controller) => {
    const enriched = [...items];
    
    for (let i = 0; i < enriched.length; i++) {
      if (controller.signal.aborted) break;
      
      const item = enriched[i];
      r.updateStep(`Validando ${item.cnpj}...`, i + 1, items.length);
      callbacks.onLog?.(`🌐 Validando BrasilAPI: ${i+1}/${items.length} — ${item.cnpj}`, 'info');

      try {
        const data = await fetchCnpjData(item.cnpj);
        if (data) {
          enriched[i] = {
            ...item,
            razaoSocial: data.razao_social,
            situacao: data.situacao_cadastral || 'ATIVA',
            capitalSocial: data.capital_social || 0,
            qsaCount: data.qsa?.length || 0,
            validationStatus: 'VALIDADA',
            lastValidatedAt: new Date().toISOString(),
            attemptCount: item.attemptCount + 1
          };
          callbacks.onLog?.(`✅ Capital de R$ ${data.capital_social.toLocaleString('pt-BR')} para ${data.razao_social}`, 'success');
        } else {
          throw new Error("Não encontrado");
        }
      } catch (e) {
        enriched[i] = {
          ...item,
          validationStatus: 'FALHOU',
          validationErrorMessage: String(e),
          attemptCount: item.attemptCount + 1
        };
        callbacks.onLog?.(`❌ Falha ao validar ${item.cnpj}`, 'error');
      }

      callbacks.onItemUpdate?.([...enriched]);
      callbacks.onProgress(r.getProgress());
      await new Promise(res => setTimeout(res, 800)); // Rate limit safety
    }
    return enriched;
  }, callbacks);
}

/**
 * JOB 3: GroupEstimateJob
 * Calcula faturamento unificado baseado em CNAE e Capital.
 */
export async function runGroupEstimateJob(
  items: CompanyRelatedItem[],
  // FIX: Generic parameter 'I' should be CompanyRelatedItem, not CompanyRelatedItem[]
  callbacks: JobCallbacks<{ items: CompanyRelatedItem[]; summary: GroupMagnitudeSummary }, CompanyRelatedItem>
) {
  const runner = new JobRunner("Group Estimation");
  return runner.run(1, async (r, controller) => {
    r.updateStep("Calculando Magnitude...", 0, 1);
    callbacks.onLog?.(`🧮 Calculando Estimativa Unificada do Grupo...`, 'info');

    const validated = items.filter(it => it.validationStatus === 'VALIDADA');
    let totalRevenue = 0;
    let usedCount = 0;

    const updatedItems = items.map(it => {
      if (it.validationStatus !== 'VALIDADA') return it;
      
      // Reaproveita lógica do prospectorService
      const intel = calculateLeadIntelligence({
        capitalSocial: it.capitalSocial || 0,
        cnaeDesc: "Atividade Agro", // Simplificado para o job de massa
        natureza: "LTDA",
        razaoSocial: it.razaoSocial,
        isMatriz: true,
        corporateDomain: null,
        yearsExistence: 5
      });

      if (intel.estimatedRevenue) {
        totalRevenue += intel.estimatedRevenue;
        usedCount++;
      }

      return { ...it, estimatedRevenue: intel.estimatedRevenue };
    });

    const summary: GroupMagnitudeSummary = {
      validatedCnpjsCount: validated.length,
      totalCapitalSocial: validated.reduce((acc, curr) => acc + (curr.capitalSocial || 0), 0),
      maxCapitalSocial: Math.max(...validated.map(v => v.capitalSocial || 0), 0),
      estimatedRevenueTotal: totalRevenue,
      estimateCompaniesUsed: usedCount,
      estimateCompaniesExcluded: validated.length - usedCount
    };

    callbacks.onLog?.(`✨ Magnitude: R$ ${totalRevenue.toLocaleString('pt-BR')} faturamento anual estimado.`, 'success');
    callbacks.onItemUpdate?.(updatedItems);
    r.updateStep("Cálculo finalizado", 1, 1);

    return { items: updatedItems, summary };
  }, callbacks);
}
