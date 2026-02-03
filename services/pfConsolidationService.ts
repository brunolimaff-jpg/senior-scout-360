
import { PFProspect } from "../types";

export function consolidatePFProspects(raw: PFProspect[]): PFProspect[] {
  const map = new Map<string, PFProspect>();

  raw.forEach(p => {
    const key = `${p.normalizedName}-${p.city}-${p.uf}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      // Adiciona novas evidências se a URL for única
      p.evidences.forEach(ev => {
        if (!existing.evidences.some(e => e.url === ev.url)) {
          existing.evidences.push(ev);
        }
      });
      // Atualiza hectares se encontrar valor maior (presume evidência mais recente ou completa)
      if (p.hectares && (!existing.hectares || p.hectares > existing.hectares)) {
        existing.hectares = p.hectares;
      }
      // Incrementa confiança baseado na quantidade de evidências
      existing.confidence = Math.min(99, 70 + (existing.evidences.length * 5));
    } else {
      map.set(key, { ...p });
    }
  });

  return Array.from(map.values());
}
