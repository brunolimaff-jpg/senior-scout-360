
import { GoogleGenAI } from "@google/genai";
import { PFProspect } from "../types";

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

export const discoverRelatedCnpjs = async (prospect: PFProspect): Promise<Array<{ cnpj: string; source: string; url: string }>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // FIXED: Access displayName instead of name, and city/uf directly instead of via region property
  const prompt = `LOCALIZE CNPJs (Holdings, Agropecuárias, Armazéns) ligados ao produtor: ${prospect.displayName} em ${prospect.city}/${prospect.uf}.
  PESQUISE: Participações societárias, Diários oficiais, Relatórios de sustentabilidade.
  RETORNE APENAS JSON: [{ "cnpj": "números apenas", "razao": "", "url": "" }]
  REGRA: Se não encontrar CNPJ real com URL de evidência, retorne lista vazia [].`;

  try {
    /**
     * FIXED: Removed responseMimeType when using googleSearch as per guidelines.
     * Manual cleanup used instead.
     */
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });

    const results = cleanAndParseJSON(response.text || '[]');
    if (!Array.isArray(results)) return [];
    
    return results.map((r: any) => ({
      cnpj: (r.cnpj || '').replace(/\D/g, ''),
      source: r.razao || 'Entidade Relacionada',
      url: r.url
    })).filter((r: any) => r.cnpj.length === 14);
  } catch (e) {
    return [];
  }
};
