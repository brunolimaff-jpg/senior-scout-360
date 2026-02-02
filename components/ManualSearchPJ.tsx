import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Sprout, Building2, Terminal, 
  Loader2, Crosshair, Tractor, Wheat, Factory, 
  ScanLine, Radar, Globe, CheckCircle2, 
  Cpu, XCircle, RefreshCw, Database, Sparkles, ShieldCheck
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProspectLead } from '../types';
import { calculateLeadIntelligence, enrichLeadWithRealData } from '../services/prospectorService';

interface ManualSearchPJProps {
  onSearch: (leads: ProspectLead[]) => void;
  onStatusUpdate: (msg: string) => void;
  selectedUf?: string;
  initialSearchTerm?: string;
  autoTrigger?: boolean;
}

const VERTICALS = [
  { id: 'GRAOS', label: 'Grãos (Soja/Milho)', icon: <Wheat size={14} /> },
  { id: 'PECUARIA', label: 'Pecuária Intensiva', icon: <Tractor size={14} /> },
  { id: 'ALGODAO', label: 'Algodão & Fibras', icon: <Sprout size={14} /> },
  { id: 'INDUSTRIA', label: 'Agroindústria', icon: <Factory size={14} /> },
];

const SEARCH_PHASES = [
  { id: 0, label: "CAPTURA DE CNPJS (Base BrasilAPI)", desc: "Sincronizando registros ativos no município..." },
  { id: 1, label: "AUDITORIA DE CAPITAL SOCIAL", desc: "Validando faturamento oficial e enquadramento..." },
  { id: 2, label: "RASTREIO DE INCENTIVOS", desc: "Consultando PRODEIC e benefícios fiscais..." },
  { id: 3, label: "INVESTIGAÇÃO DE MERCADO", desc: "Buscando expansão, investimentos e dores..." },
  { id: 4, label: "CONSOLIDAÇÃO & SCORE ICO", desc: "Consolidando Dossiê e Ranking Estratégico..." }
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
  const [currentPhase, setCurrentPhase] = useState(-1);
  const [subPhaseLog, setSubPhaseLog] = useState<string>("");
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const abortRef = useRef(false);

  useEffect(() => {
    fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`)
      .then(r => r.json())
      .then(data => {
          if (Array.isArray(data)) setCities(data.map((c: any) => c.nome).sort());
      });
  }, [uf]);

  useEffect(() => {
    if (selectedUf) setUf(selectedUf);
  }, [selectedUf]);

  useEffect(() => {
    if (autoTrigger && initialSearchTerm && !isScanning) {
        setMode('NAME');
        setDirectName(initialSearchTerm);
        setTimeout(() => handleSearch(initialSearchTerm), 500);
    }
  }, [autoTrigger, initialSearchTerm]);

  const toggleVertical = (id: string) => {
    setSelectedVerticals(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  const addLog = (msg: string) => { setScanLog(prev => [msg, ...prev]); setSubPhaseLog(msg); };

  const handleCancel = () => {
    abortRef.current = true;
    setIsScanning(false);
    setCurrentPhase(-1);
    onStatusUpdate("Busca cancelada.");
  };

  const executeMicroRequest = async (ai: GoogleGenAI, context: string, focusLabel: string, dorks: string): Promise<any[]> => {
    if (abortRef.current) return [];
    addLog(`📡 PJ SCAN: ${focusLabel}`);
    
    const prompt = `
      ATUE COMO: Analista de Inteligência Comercial Sênior. 
      CONTEXTO: ${context}. MISSÃO: ${focusLabel}.
      DORKS: ${dorks}

      EXTRAÇÃO OBRIGATÓRIA (JSON ARRAY):
      company_name, cnpj_found (números), city, uf, badge_source, context, evidence_url.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || '[]');
    } catch (error: any) {
      return [];
    }
  };

  const handleSearch = async (overrideTerm?: string) => {
    const termToUse = overrideTerm || directName;
    if ((mode === 'GEO' && !selectedCity) || (mode === 'NAME' && !termToUse)) return;
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) return;

    abortRef.current = false;
    const targetCity = mode === 'GEO' ? selectedCity : (termToUse + (selectedCity ? ` ${selectedCity}` : ''));
    const locationStr = `${targetCity} ${uf}`;
    
    setIsScanning(true);
    setScanLog([]);
    setSearchResult(null);
    onStatusUpdate(`🛰️ Sara: Iniciando varredura oficial via BrasilAPI para ${targetCity}...`);

    const ai = new GoogleGenAI({ apiKey });
    const leadsMap = new Map<string, ProspectLead>();

    try {
      // --- FASE 0: DESCOBERTA DE CNPJS (AÇÃO PRINCIPAL) ---
      setCurrentPhase(0);
      addLog(`🔍 Capturando CNPJs de registros oficiais em ${targetCity}...`);
      const discoveryResults = await executeMicroRequest(ai, locationStr, "Mapeamento BrasilAPI", `site:cnpj.biz OR site:econodata.com.br "agro" "${targetCity}" "${uf}"`);
      
      const discoveredRawLeads = processInitialDiscovery(discoveryResults);
      
      // --- FASE 1: AUDITORIA IMEDIATA (BRASILAPI) ---
      if (abortRef.current) return;
      setCurrentPhase(1);
      const auditedLeads: ProspectLead[] = [];
      
      for (const lead of discoveredRawLeads) {
        if (abortRef.current) break;
        if (lead.cnpj && lead.cnpj.length > 8) {
           addLog(`⚖️ Auditando BrasilAPI: ${lead.companyName}...`);
           try {
             const enriched = await enrichLeadWithRealData(lead);
             auditedLeads.push(enriched);
           } catch (e) {
             addLog(`⚠️ BrasilAPI Offline para ${lead.companyName}.`);
             auditedLeads.push(lead);
           }
        } else {
           auditedLeads.push(lead);
        }
      }

      // --- FASE 2: RASTREIO DE INCENTIVOS (FALLBACK / ENRIQUECIMENTO) ---
      if (abortRef.current) return;
      setCurrentPhase(2);
      for (const lead of auditedLeads) {
          if (abortRef.current) break;
          // Só rastreia web se a auditoria já nos deu o nome real
          const fiscalResults = await executeMicroRequest(ai, lead.companyName, `Incentivos: ${lead.companyName}`, `site:sefaz.${uf.toLowerCase()}.gov.br "PRODEIC" "${lead.companyName}"`);
          if (fiscalResults.length > 0) {
              lead.tacticalAnalysis?.badges.push('INCENTIVO FISCAL');
              lead.notes = (lead.notes || "") + ` | ${fiscalResults[0].context}`;
          }
      }

      // --- FASE 3: INVESTIGAÇÃO DE MERCADO ---
      if (abortRef.current) return;
      setCurrentPhase(3);
      for (const lead of auditedLeads.slice(0, 5)) { // Top 5 para evitar rate limit
          if (abortRef.current) break;
          const bizResults = await executeMicroRequest(ai, lead.companyName, `Mercado: ${lead.companyName}`, `"Investimento" OR "Nova Unidade" "${lead.companyName}" agro`);
          if (bizResults.length > 0) {
              lead.tacticalAnalysis?.badges.push('EXPANSÃO');
          }
      }

      // --- FASE 4: FINALIZAÇÃO ---
      setCurrentPhase(4);
      addLog("🧠 Finalizando Dossiê e Ranking...");
      await delay(800);

      if (auditedLeads.length > 0) {
         onSearch(auditedLeads);
         setSearchResult(`✅ ${auditedLeads.length} empresas identificadas e auditadas.`);
      } else {
         setSearchResult("Nenhum lead qualificado encontrado nas bases oficiais.");
      }
    } catch (e) {
      addLog("❌ Erro no pipeline de auditoria.");
    } finally {
      if (!abortRef.current) {
        setTimeout(() => { setIsScanning(false); setCurrentPhase(-1); }, 2000);
      }
    }
  };

  const processInitialDiscovery = (items: any[]): ProspectLead[] => {
    const list: ProspectLead[] = [];
    for (const item of items) {
       const rawName = item.company_name || "EMPRESA";
       if (rawName.length < 3) continue;
       
       const cleanName = cleanNamePJ(rawName);
       const cnpj = (item.cnpj_found || "").replace(/\D/g, '');
       if (cnpj.length < 8) continue; 

       const intel = calculateLeadIntelligence({
           capitalSocial: 0,
           cnaeDesc: "Atividade Agro",
           natureza: 'LIMITADA',
           razaoSocial: cleanName,
           isMatriz: cnpj.includes('0001'),
           corporateDomain: null,
           yearsExistence: 0
       });

       const newLead: ProspectLead = {
           id: `pj-hunt-${cnpj}-${Date.now()}`,
           companyName: cleanName,
           cnpj: item.cnpj_found || cnpj,
           city: (item.city || selectedCity || uf).toUpperCase(),
           uf: uf,
           isValidated: false, 
           capitalSocial: 0,
           confidence: 50, 
           isSA: false,
           isMatriz: cnpj.includes('0001'),
           activityCount: 1,
           contactType: 'Direto',
           cnaes: [],
           breakdown: intel.breakdown,
           tacticalAnalysis: {
               badges: ['REGISTRO OFICIAL'],
               verticalizationScore: 0,
               salesComplexity: 'TRANSACIONAL',
               goldenHook: `Identificado via Censo BrasilAPI.`,
               operationalComplexity: 0
           },
           priority: 50,
           businessType: 'Empresa Rural (PJ)',
           fitLevel: 'Médio',
           source: 'Busca Ativa PJ',
           score: 0
       };
       list.push(newLead);
    }
    return list;
  };

  return (
    <div className="space-y-4 pb-6">
      {!isScanning && currentPhase === -1 && (
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          <button onClick={() => setMode('GEO')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${mode === 'GEO' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}><MapPin size={12} /> Perímetro</button>
          <button onClick={() => setMode('NAME')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${mode === 'NAME' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}><Search size={12} /> Alvo Direto</button>
        </div>
      )}

      {isScanning || currentPhase >= 0 ? (
        <div className="space-y-4">
           <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                   <ShieldCheck className="w-4 h-4 text-teal-600 animate-pulse" />
                   Estratégia de Caça PJ
                 </h3>
                 <button onClick={handleCancel} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold flex items-center gap-1"><XCircle size={12} /> Cancelar</button>
              </div>
              <div className="space-y-3 relative">
                 <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-slate-100"></div>
                 {SEARCH_PHASES.map((phase) => {
                   const isActive = currentPhase === phase.id; const isDone = currentPhase > phase.id;
                   return (
                     <div key={phase.id} className={`relative z-10 flex items-start gap-3 transition-all ${isActive || isDone ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-200' : isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                          {isDone ? <CheckCircle2 size={12} /> : phase.id === 0 ? <Database size={10}/> : phase.id}
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
           <div className="bg-slate-900 rounded-xl p-3 font-mono text-[10px] text-green-400 border border-slate-700 h-24 overflow-hidden flex flex-col-reverse shadow-inner">
              {scanLog.slice(0, 5).map((log, i) => (
                <div key={i} className="opacity-80 first:opacity-100 truncate"><span className="opacity-40 mr-2">{'>'}</span> {log}</div>
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
                <div className="col-span-1"><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">UF</label><select value={uf} onChange={e => setUf(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:border-teal-500 outline-none"><option value="MT">MT</option><option value="GO">GO</option><option value="PR">PR</option><option value="BA">BA</option></select></div>
                <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Município</label><select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-teal-500"><option value="">Selecione...</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {VERTICALS.map(v => {
                  const isSelected = selectedVerticals.includes(v.id);
                  return (
                    <button key={v.id} onClick={() => toggleVertical(v.id)} className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${isSelected ? 'bg-teal-50 border-teal-200 text-teal-800 ring-1 ring-teal-200 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}>
                      <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white text-teal-600' : 'bg-slate-50'}`}>{isSelected ? <CheckCircle2 size={14} /> : v.icon}</div>
                      <span className="text-[10px] font-bold uppercase">{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
             <div className="space-y-2">
               <label className="text-[9px] font-bold text-slate-400 uppercase block">Empresa / Grupo</label>
               <input type="text" value={directName} onChange={e => setDirectName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-teal-500 outline-none" placeholder="Ex: Bom Futuro, Amaggi..." />
               <label className="text-[9px] font-bold text-slate-400 uppercase block mt-3">Cidade (Opcional)</label>
               <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-teal-500"><option value="">Todas...</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select>
             </div>
          )}
          <button 
            onClick={() => handleSearch()} 
            disabled={(mode === 'GEO' && !selectedCity) || (mode === 'NAME' && !directName) || selectedVerticals.length === 0} 
            className="w-full py-4 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-700 transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <Radar size={16} className="group-hover:rotate-90 transition-transform duration-500" />
            Caçar Empresas PJ
          </button>
        </div>
      )}
    </div>
  );
};