
import { GoogleGenAI } from "@google/genai";
import { PFProspect } from "../types";

export const discoverRelatedCnpjs = async (prospect: PFProspect): Promise<Array<{ cnpj: string; source: string; url: string }>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // FIXED: Access displayName instead of name, and city/uf directly instead of via region property
  const prompt = `LOCALIZE CNPJs (Holdings, Agropecuárias, Armazéns) ligados ao produtor: ${prospect.displayName} em ${prospect.city}/${prospect.uf}.
  PESQUISE: Participações societárias, Diários oficiais, Relatórios de sustentabilidade.
  RETORNE APENAS JSON: [{ "cnpj": "números apenas", "razao": "", "url": "" }]
  REGRA: Se não encontrar CNPJ real com URL de evidência, retorne lista vazia [].`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
    });

    const results = JSON.parse(response.text || '[]');
    return results.map((r: any) => ({
      cnpj: r.cnpj.replace(/\D/g, ''),
      source: r.razao || 'Entidade Relacionada',
      url: r.url
    })).filter((r: any) => r.cnpj.length === 14);
  } catch (e) {
    return [];
  }
};