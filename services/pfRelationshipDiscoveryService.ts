
import { GoogleGenAI } from "@google/genai";
import { PFProspect, CompanyCandidate, PhaseTelemetry } from "../types";

// Helper for cleaning and parsing JSON from Gemini
function cleanAndParseJSON(text: string): any {
  const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch (error) {
    const match = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

export async function discoverPFRelationships(
  pf: PFProspect,
  onPhaseUpdate: (tel: PhaseTelemetry) => void,
  abortSignal: AbortSignal
): Promise<{ candidates: CompanyCandidate[]; telemetry: PhaseTelemetry[] }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const candidates: CompanyCandidate[] = [];
  const telemetry: PhaseTelemetry[] = [];

  const strategies = [
    { id: 101, name: "Strategy A: ORG + CNPJ", prompt: `Busque por "CNPJ" + "${pf.displayName}" em diários oficiais e editais agro.` },
    { id: 102, name: "Strategy B: Holdings Regionais", prompt: `Busque por holdings, participações ou agropecuárias ligadas ao sobrenome da família de ${pf.displayName} em ${pf.city}/${pf.uf}.` },
    { id: 103, name: "Strategy C: Sócio Vínculos", prompt: `Busque em sites de transparência societária o nome "${pf.displayName}" como sócio administrador.` },
    { id: 104, name: "Strategy D: Unidades & Fazendas", prompt: `Busque por nomes de fazendas, silos ou armazéns vinculados a ${pf.displayName}.` }
  ];

  for (const strat of strategies) {
    if (abortSignal.aborted) break;
    const start = Date.now();
    onPhaseUpdate({ phaseId: strat.id, name: strat.name, status: 'RUNNING', durationMs: 0, counts: {}, topUrls: [] });

    try {
      /**
       * FIXED: Removed responseMimeType when using googleSearch as per guidelines.
       * Manual cleanup used instead.
       */
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${strat.prompt} 
        RETORNE JSON: [{ "cnpj": "apenas numeros", "razao": "string", "uf": "string", "cidade": "string", "url": "string", "snippet": "string", "motivo": "string" }]
        REGRAS: 1. Zero Ficção. 2. Apenas se achar URL real.`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const items = cleanAndParseJSON(response.text || '[]');
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const cnpjClean = item.cnpj?.replace(/\D/g, '');
          if (cnpjClean && cnpjClean.length === 14) {
            candidates.push({
              cnpj: cnpjClean,
              legalName: item.razao,
              uf: item.uf,
              city: item.cidade,
              evidenceUrls: [item.url],
              snippets: [item.snippet],
              confidence: 85,
              linkReasons: [item.motivo],
              // Estados Iniciais
              validationStatus: 'pending',
              attemptCount: 0,
              capitalSocial: 0
            });
          }
        });
      }

      const tel: PhaseTelemetry = {
        phaseId: strat.id,
        name: strat.name,
        status: 'COMPLETED',
        durationMs: Date.now() - start,
        counts: { cnpjFound: Array.isArray(items) ? items.length : 0 },
        topUrls: Array.isArray(items) ? items.map((i: any) => i.url).slice(0, 2) : []
      };
      telemetry.push(tel);
      onPhaseUpdate(tel);

    } catch (e) {
      telemetry.push({ phaseId: strat.id, name: strat.name, status: 'FAILED', durationMs: Date.now() - start, counts: {}, topUrls: [] });
    }
  }

  // Dedupe candidates por CNPJ
  const uniqueCnpjs = new Map<string, CompanyCandidate>();
  candidates.forEach(c => {
    if (!uniqueCnpjs.has(c.cnpj!)) uniqueCnpjs.set(c.cnpj!, c);
  });

  return { candidates: Array.from(uniqueCnpjs.values()), telemetry };
}
