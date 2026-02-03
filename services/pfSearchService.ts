
import { GoogleGenAI } from "@google/genai";
import { PFProspect, PhaseTelemetry, SourceEvidence } from "../types";

const SEARCH_PHASES = [
  { id: 1, name: "Perímetro Geo", prompt: "Lista de maiores produtores rurais ativos em {city}/{uf}" },
  { id: 2, name: "Varredura Ambiental", prompt: "Consulta SIGEF/CAR produtores agro {city} {uf}" },
  { id: 3, name: "Editais & Diários", prompt: "Publicações agropecuária diário oficial {city} {uf} nomes" },
  { id: 4, name: "Censo de Cooperativas", prompt: "Principais associados e produtores destaque em {city} agro" },
  { id: 5, name: "Holdings de Família", prompt: "Famílias tradicionais do agronegócio em {city}/{uf} gestão rural" },
  { id: 6, name: "Eventos & Safra", prompt: "Destaques produtividade soja milho algodão {city} {uf} nomes produtores" },
  { id: 7, name: "Mapeamento CAR", prompt: "Análise de áreas consolidadas e detentores de imóveis rurais {city}" },
  { id: 8, name: "Crédito & Financiamento", prompt: "Cédulas de Produto Rural (CPR) e registros de garantias {city} {uf}" },
  { id: 9, name: "Consolidação de Provas", prompt: "Verificação de evidências digitais para os nomes encontrados" }
];

export async function runPFSearchPipeline(
  city: string,
  uf: string,
  vertical: string,
  onPhaseUpdate: (telemetry: PhaseTelemetry) => void,
  abortSignal: AbortSignal
): Promise<{ prospects: PFProspect[]; telemetry: PhaseTelemetry[] }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const allTelemetry: PhaseTelemetry[] = [];
  const rawResults: PFProspect[] = [];

  for (const phase of SEARCH_PHASES) {
    if (abortSignal.aborted) {
      onPhaseUpdate({ phaseId: phase.id, name: phase.name, status: 'CANCELLED', durationMs: 0, counts: {}, topUrls: [] });
      break;
    }

    const start = Date.now();
    onPhaseUpdate({ phaseId: phase.id, name: phase.name, status: 'RUNNING', durationMs: 0, counts: {}, topUrls: [] });

    try {
      const phasePrompt = phase.prompt.replace('{city}', city).replace('{uf}', uf);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `ATUE COMO: Investigador de Mercado Agro. FASE: ${phase.name}. 
        BUSQUE: Produtores Pessoa Física reais (Pessoas, não empresas).
        ALVO: ${vertical} em ${city}/${uf}.
        
        FONTES PRIORITÁRIAS:
        1. Sistema CAR (Cadastro Ambiental Rural)
        2. CNDs ambientais IBAMA/SEMA
        3. Listas SENAR/Sindicatos
        4. Diários Oficiais
        
        REGRA ZERO FICÇÃO: Retorne APENAS se houver evidência real com URL.
        NÃO INVENTE CPF. Se encontrar na fonte pública, inclua. Se não, retorne null.
        
        FORMATO JSON: [{ "nome": "string", "cpf": "string|null", "ha": number|null, "evidencia_url": "string", "snippet": "string" }]`,
        config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
      });

      const items = JSON.parse(response.text || '[]');
      let foundInPhase = 0;
      const phaseUrls: string[] = [];

      items.forEach((item: any) => {
        if (item.evidencia_url && item.nome) {
          rawResults.push({
            id: `pf-${Math.random().toString(36).substr(2, 9)}`,
            displayName: item.nome,
            normalizedName: item.nome.toUpperCase().trim(),
            city,
            uf,
            vertical,
            confidence: 70,
            isStrongCandidate: !!item.ha,
            hectares: item.ha,
            evidences: [{ sourceName: 'Google Search', url: item.evidencia_url, title: item.nome, snippet: item.snippet || '' }]
          });
          foundInPhase++;
          if (!phaseUrls.includes(item.evidencia_url)) phaseUrls.push(item.evidencia_url);
        }
      });

      const tel: PhaseTelemetry = {
        phaseId: phase.id,
        name: phase.name,
        status: 'COMPLETED',
        startedAt: new Date(start).toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        counts: { pfFound: foundInPhase },
        topUrls: phaseUrls.slice(0, 3)
      };
      allTelemetry.push(tel);
      onPhaseUpdate(tel);

    } catch (err: any) {
      const tel: PhaseTelemetry = {
        phaseId: phase.id,
        name: phase.name,
        status: 'FAILED',
        durationMs: Date.now() - start,
        counts: { pfFound: 0 },
        topUrls: [],
        errorMessage: String(err)
      };
      allTelemetry.push(tel);
      onPhaseUpdate(tel);
    }
  }

  return { prospects: rawResults, telemetry: allTelemetry };
}
