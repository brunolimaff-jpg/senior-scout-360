
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Sprout, Building2, Terminal, 
  Loader2, Crosshair, Tractor, Wheat, Factory, 
  ScanLine, Radar, Globe, CheckCircle2, 
  Cpu, XCircle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProspectLead } from '../types';

interface ManualSearchPJProps {
  onSearch: (leads: ProspectLead[]) => void;
  onStatusUpdate: (msg: string) => void;
  selectedUf?: string;
  // Novos props para busca automática
  initialSearchTerm?: string;
  autoTrigger?: boolean;
}

// Sincronizado com Busca CPF conforme solicitado
const VERTICALS = [
  { id: 'GRAOS', label: 'Grãos (Soja/Milho)', icon: <Wheat size={14} /> },
  { id: 'PECUARIA', label: 'Pecuária Intensiva', icon: <Tractor size={14} /> },
  { id: 'ALGODAO', label: 'Algodão & Fibras', icon: <Sprout size={14} /> },
  { id: 'INDUSTRIA', label: 'Agroindústria', icon: <Factory size={14} /> },
];

const SEARCH_PHASES = [
  { id: 1, label: "DELIMITAÇÃO CORPORATIVA", desc: "Mapeando clusters industriais..." },
  { id: 2, label: "VARREDURA DE INCENTIVOS", desc: "Consultando PRODEIC e incentivos estaduais..." },
  { id: 3, label: "INTELIGÊNCIA DE MERCADO", desc: "Buscando notícias de expansão e investimentos..." },
  { id: 4, label: "SÍNTESE DE DADOS (PJ)", desc: "Extraindo CNPJs e estruturando cards..." }
];

const cleanNamePJ = (rawName: string): string => {
    if (!rawName) return "EMPRESA DESCONHECIDA";
    let clean = rawName.replace(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '');
    clean = clean.replace(/\s+/g, ' ').trim().toUpperCase();
    return clean;
};

export const ManualSearchPJ: React.FC<ManualSearchPJProps> = ({ 
  onSearch, onStatusUpdate, selectedUf, initialSearchTerm, autoTrigger 
}) => {
  const [mode, setMode] = useState<'GEO' | 'NAME'>('GEO');
  const [uf, setUf] = useState(selectedUf || 'MT');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>(['GRAOS']);
  const [directName, setDirectName] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [subPhaseLog, setSubPhaseLog] = useState<string>("");
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const abortRef = useRef(false);
  const autoTriggerProcessedRef = useRef(false);

  useEffect(() => {
    fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`)
      .then(r => r.json())
      .then(data => setCities(data.map((c: any) => c.nome).sort()));
  }, [uf]);

  useEffect(() => {
    if (selectedUf) setUf(selectedUf);
  }, [selectedUf]);

  // Lógica de Gatilho Automático
  useEffect(() => {
    if (autoTrigger && initialSearchTerm && !isScanning && !autoTriggerProcessedRef.current) {
        setMode('NAME');
        setDirectName(initialSearchTerm);
        autoTriggerProcessedRef.current = true;
        // Pequeno timeout para garantir que o estado atualizou antes de disparar
        setTimeout(() => handleSearch(initialSearchTerm), 500);
    }
    // Reset da flag se o termo mudar
    if (initialSearchTerm !== directName && !isScanning) {
        autoTriggerProcessedRef.current = false;
    }
  }, [autoTrigger, initialSearchTerm]);

  const toggleVertical = (id: string) => {
    setSelectedVerticals(prev => 
      prev.includes(id) 
        ? prev.filter(v => v !== id)
        : [...prev, id]
    );
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const addLog = (msg: string) => {
    setScanLog(prev => [msg, ...prev]);
    setSubPhaseLog(msg);
  };

  const handleCancel = () => {
    abortRef.current = true;
    setIsScanning(false);
    setCurrentPhase(0);
    onStatusUpdate("Busca cancelada.");
  };

  const executeMicroRequest = async (
    ai: GoogleGenAI, 
    context: string, 
    focusLabel: string, 
    dorks: string
  ): Promise<any[]> => {
    if (abortRef.current) return [];
    addLog(`📡 PJ SCAN: ${focusLabel}`);
    await delay(400);

    const prompt = `
      ATUE COMO: Analista de Inteligência Comercial Sênior (Foco em PJ/Empresas Agro).
      CONTEXTO: Buscando empresas do setor em ${context}. 
      CRÍTICO: Identifique a CIDADE correta da unidade encontrada. Se o usuário forneceu uma cidade, valide se a empresa atua LÁ.
      MISSÃO: ${focusLabel}.
      
      DORKS SUGERIDAS:
      ${dorks}

      EXTRAÇÃO OBRIGATÓRIA (ESTRUTURA CORPORATIVA):
      1. Razão Social ou Nome Fantasia.
      2. CNPJ (Tente encontrar o número exato no texto. Se for filial, pegue o CNPJ da filial).
      3. Cidade/Município (Priorize a cidade citada no texto da evidência).
      4. Estado (UF).
      5. Fonte da informação.
      6. Contexto do lead (Ex: "Incentivo Fiscal", "Nova Fábrica", "Exportador").
      7. URL da evidência.

      OUTPUT JSON (Array):
      [
        {
          "company_name": "NOME DA EMPRESA",
          "cnpj_found": "CNPJ OU NULL",
          "city": "CIDADE",
          "uf": "UF",
          "badge_source": "FONTE",
          "context": "DETALHE DO NEGÓCIO",
          "evidence_url": "URL"
        }
      ]
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const rawText = response.text || '[]';
      let items = JSON.parse(rawText);
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.error("MicroRequest Error:", error);
      return [];
    }
  };

  // Aceita overrideTerm para uso programático
  const handleSearch = async (overrideTerm?: string) => {
    const termToUse = overrideTerm || directName;
    
    if (mode === 'GEO' && !selectedCity) return;
    if (mode === 'NAME' && !termToUse) return;
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) return;

    abortRef.current = false;
    const targetCity = mode === 'GEO' ? selectedCity : (termToUse + (selectedCity ? ` ${selectedCity}` : ''));
    const locationStr = `${targetCity} ${uf}`;
    
    setIsScanning(true);
    setScanLog([]);
    setSearchResult(null);
    onStatusUpdate(`🛰️ Sara: Iniciando varredura PJ para ${targetCity}...`);

    const ai = new GoogleGenAI({ apiKey });
    const leadsMap = new Map<string, ProspectLead>();

    try {
      setCurrentPhase(1);
      addLog(`Mapeando ecossistema PJ em ${locationStr}`);
      await delay(600);

      // FASE 2: FISCAL (PRODEIC / SEFAZ)
      setCurrentPhase(2);
      const fiscalResults = await executeMicroRequest(
        ai, locationStr, "Incentivos Fiscais & PRODEIC",
        `site:sefaz.${uf.toLowerCase()}.gov.br "PRODEIC" "Enquadramento" "${targetCity}" OR site:doe.${uf.toLowerCase()}.gov.br "Incentivo Fiscal" "${targetCity}"`
      );
      processResults(fiscalResults, leadsMap);

      // FASE 3: INVESTIMENTOS & EXPANSÃO
      if (abortRef.current) return;
      setCurrentPhase(3);
      const bizResults = await executeMicroRequest(
        ai, locationStr, "Notícias de Expansão & Cooperativismo",
        `"Nova fábrica" OR "Investimento" OR "Unidade de Recebimento" "${targetCity}" agro OR "Cooperativa" "${targetCity}"`
      );
      processResults(bizResults, leadsMap);

      // FASE 4: CONSOLIDAÇÃO
      setCurrentPhase(4);
      addLog("🧠 Consolidando dados societários...");
      await delay(800);

      const finalLeads = Array.from(leadsMap.values());
      if (finalLeads.length > 0) {
         onSearch(finalLeads);
         const msg = `✅ ${finalLeads.length} empresas identificadas. Prontas para auditoria.`;
         onStatusUpdate(msg);
         setSearchResult(msg);
      } else {
         addLog("⚠️ Nenhum lead PJ qualificado nesta varredura.");
         setSearchResult("Nenhum lead encontrado.");
      }

    } catch (e) {
      addLog("❌ Falha técnica na varredura.");
      console.error(e);
    } finally {
      if (!abortRef.current) {
        setCurrentPhase(5);
        setTimeout(() => { setIsScanning(false); setCurrentPhase(0); }, 3000);
      }
    }
  };

  const processResults = (items: any[], map: Map<string, ProspectLead>) => {
    for (const item of items) {
       const rawName = item.company_name || "EMPRESA";
       if (rawName.length < 3) continue;
       
       const cleanName = cleanNamePJ(rawName);
       const cnpj = item.cnpj_found || "CNPJ NÃO IDENTIFICADO";
       const key = cnpj !== "CNPJ NÃO IDENTIFICADO" ? cnpj.replace(/\D/g, '') : cleanName;

       if (!map.has(key)) {
          const newLead: ProspectLead = {
              id: `pj-ai-${Date.now()}-${Math.random()}`,
              companyName: cleanName,
              tradeName: item.context || "Empresa Agro",
              cnpj: cnpj,
              city: (item.city || selectedCity || "").toUpperCase(),
              uf: (item.uf || uf || "").toUpperCase(),
              isValidated: false, 
              capitalSocial: 0,
              confidence: 0,
              isSA: cleanName.includes('S/A') || cleanName.includes('SA'),
              isMatriz: cnpj.includes('0001'),
              activityCount: 1,
              contactType: 'Direto',
              breakdown: { financial: 0, longevity: 0, legal: 0, decisionPower: 0, verticalFit: 0, operational: 0, location: 0, workforce: 0, stability: 0, techReadiness: 0 },
              cnaes: [],
              tacticalAnalysis: {
                  badges: ['BUSCA PJ', (item.badge_source || 'WEB').toUpperCase()],
                  verticalizationScore: 0,
                  salesComplexity: 'TRANSACIONAL',
                  goldenHook: `Identificado via ${item.badge_source}. Contexto: ${item.context}`
              },
              priority: 50,
              businessType: 'Empresa Rural (PJ)',
              fitLevel: 'Provável',
              source: 'Busca Ativa PJ',
              notes: `Origem: ${item.context}`,
              bestEvidenceUrl: item.evidence_url
          };
          map.set(key, newLead);
          addLog(`🏢 LOCALIZADO: ${cleanName} (${newLead.city})`);
       }
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 pb-6">
      {!isScanning && currentPhase === 0 && (
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          <button onClick={() => setMode('GEO')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${mode === 'GEO' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}><MapPin size={12} /> Perímetro</button>
          <button onClick={() => setMode('NAME')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${mode === 'NAME' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}><Search size={12} /> Alvo Direto</button>
        </div>
      )}

      {isScanning || currentPhase > 0 ? (
        <div className="space-y-4">
           <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                   <Cpu className="w-4 h-4 text-teal-600 animate-pulse" />
                   Varredura Corporativa PJ
                 </h3>
                 <button onClick={handleCancel} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 font-bold flex items-center gap-1"><XCircle size={12} /> Cancelar</button>
              </div>
              <div className="space-y-3 relative">
                 <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-slate-100"></div>
                 {SEARCH_PHASES.map((phase) => {
                   const isActive = currentPhase === phase.id;
                   const isDone = currentPhase > phase.id;
                   return (
                     <div key={phase.id} className={`relative z-10 flex items-start gap-3 transition-all ${isActive || isDone ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-teal-600 border-teal-600 text-white' : isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                          {isDone ? <CheckCircle2 size={12} /> : phase.id}
                        </div>
                        <div className="flex-1">
                           <h4 className={`text-[10px] font-bold uppercase ${isActive ? 'text-teal-700' : 'text-slate-600'}`}>{phase.label}</h4>
                           {isActive && <p className="text-[10px] text-teal-600 font-mono mt-1 animate-pulse flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> {subPhaseLog}</p>}
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
           <div className="bg-slate-900 rounded-xl p-3 font-mono text-[10px] text-green-400 border border-slate-700 shadow-inner h-24 overflow-hidden flex flex-col-reverse">
              {scanLog.slice(0, 5).map((log, i) => (
                <div key={i} className="opacity-80 first:opacity-100 first:font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                  <span className="opacity-40 mr-2">{'>'}</span> {log}
                </div>
              ))}
           </div>
        </div>
      ) : (
        <div className="space-y-4">
          {searchResult && (
             <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-3 animate-in zoom-in-95">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span className="text-xs font-bold text-emerald-800">{searchResult}</span>
             </div>
          )}

          {mode === 'GEO' ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1"><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">UF</label><select value={uf} onChange={e => setUf(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-teal-500"><option value="MT">MT</option><option value="GO">GO</option><option value="PR">PR</option><option value="BA">BA</option></select></div>
                <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Município</label><select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-teal-500"><option value="">Selecione...</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase block">Alvos Táticos (Múltipla Escolha)</label>
                <div className="grid grid-cols-1 gap-2">
                  {VERTICALS.map(v => {
                    const isSelected = selectedVerticals.includes(v.id);
                    return (
                      <button key={v.id} onClick={() => toggleVertical(v.id)} className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${isSelected ? 'bg-teal-50 border-teal-200 text-teal-800 ring-1 ring-teal-200 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                        <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white text-teal-600' : 'bg-slate-50 text-slate-400'}`}>
                           {isSelected ? <CheckCircle2 size={14} /> : v.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
             <div className="space-y-2">
               <label className="text-[9px] font-bold text-slate-400 uppercase block">Nome da Empresa / Grupo</label>
               <input type="text" value={directName} onChange={e => setDirectName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-teal-500 outline-none" placeholder="Ex: Bom Futuro, Amaggi..." />
               <label className="text-[9px] font-bold text-slate-400 uppercase block mt-3">Refinar por Cidade (Opcional)</label>
               <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-teal-500"><option value="">Todas as Cidades...</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>
             </div>
          )}

          <div className="pt-2">
             <button 
               onClick={() => handleSearch()} 
               disabled={(mode === 'GEO' && !selectedCity) || (mode === 'NAME' && !directName) || selectedVerticals.length === 0} 
               className="w-full py-4 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-700 transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50"
             >
               <Radar size={16} className="group-hover:rotate-90 transition-transform duration-500" />
               Caçar Empresas PJ
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
