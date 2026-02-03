
import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, MapPin, Loader2, Radar, CheckCircle2, 
  Clock, ShieldCheck, Database, FileSearch, XCircle,
  AlertCircle, Activity, Globe, Zap
} from 'lucide-react';
import { runPFSearchPipeline } from '../services/pfSearchService';
import { consolidatePFProspects } from '../services/pfConsolidationService';
import { ProspectLead, PhaseTelemetry, PFSearchRunSummary } from '../types';

interface ManualSearchProps {
  onSearch: (leads: ProspectLead[]) => void;
  onStatusUpdate: (msg: string) => void;
  selectedUf?: string;
}

export const ManualSearch: React.FC<ManualSearchProps> = ({ onSearch, onStatusUpdate, selectedUf }) => {
  const [mode, setMode] = useState<'GEO' | 'NAME'>('GEO');
  const [uf, setUf] = useState(selectedUf || 'MT');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [vertical, setVertical] = useState('GRAOS');
  const [directName, setDirectName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
  const [telemetry, setTelemetry] = useState<PhaseTelemetry[]>([]);
  const [summary, setSummary] = useState<PFSearchRunSummary>({
    pfCandidatesFound: 0,
    pfUniqueAfterDedupe: 0,
    evidencesTotal: 0,
    orgSeedsExtracted: 0,
    farmSeedsExtracted: 0,
    cnpjCandidatesFound: 0,
    cnpjValidated: 0,
    networkNodes: 0,
    networkEdges: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setCities(data.map((c: any) => c.nome).sort());
    });
  }, [uf]);

  const handlePhaseUpdate = (t: PhaseTelemetry) => {
    setTelemetry(prev => {
      const idx = prev.findIndex(item => item.phaseId === t.phaseId);
      if (idx === -1) return [...prev, t];
      const next = [...prev];
      next[idx] = t;
      return next;
    });
  };

  const startSearch = async () => {
    setIsScanning(true);
    setTelemetry([]);
    setSummary({ pfCandidatesFound: 0, pfUniqueAfterDedupe: 0, evidencesTotal: 0, orgSeedsExtracted: 0, farmSeedsExtracted: 0, cnpjCandidatesFound: 0, cnpjValidated: 0, networkNodes: 0, networkEdges: 0 });
    
    abortControllerRef.current = new AbortController();
    onStatusUpdate("🛰️ Iniciando Pipeline de Investigação PF...");

    try {
      const { prospects, telemetry: finalTel } = await runPFSearchPipeline(
        mode === 'GEO' ? selectedCity : '',
        uf,
        vertical,
        handlePhaseUpdate,
        abortControllerRef.current.signal
      );

      const consolidated = consolidatePFProspects(prospects);
      
      setSummary(s => ({
        ...s,
        pfCandidatesFound: prospects.length,
        pfUniqueAfterDedupe: consolidated.length,
        evidencesTotal: prospects.reduce((acc, p) => acc + p.evidences.length, 0)
      }));

      const leads: ProspectLead[] = consolidated.map(p => ({
        id: p.id,
        companyName: p.displayName,
        cnpj: "PF CANDIDATO",
        cpf: undefined, // REMOVIDO MOCK
        cpfStatus: 'PENDENTE',
        city: p.city,
        uf: p.uf,
        isValidated: false,
        isSA: false,
        isMatriz: false,
        activityCount: 1,
        contactType: 'Direto',
        priority: 60,
        businessType: `Produtor Rural (${vertical})`,
        isPF: true,
        confidence: p.confidence,
        metadata: {
          hectaresTotal: p.hectares || 0,
          fontes: p.evidences.map(e => e.sourceName),
          urls: p.evidences.map(e => e.url),
          contextos: p.evidences.map(e => e.snippet),
          formatos: ['web']
        },
        tacticalAnalysis: {
          verticalizationScore: 0,
          badges: p.isStrongCandidate ? ['Pilar Agro Detectado'] : [],
          salesComplexity: 'CONSULTIVA/SUCESSAO',
          goldenHook: p.evidences[0]?.snippet || '',
          rawEvidences: p.evidences,
          searchTelemetry: telemetry
        }
      }));

      onSearch(leads);
      onStatusUpdate(`✅ Busca finalizada. ${leads.length} produtores encontrados.`);
    } catch (e) {
      if ((e as Error).name === 'AbortError') onStatusUpdate("🛑 Busca cancelada pelo usuário.");
      else onStatusUpdate(`❌ Erro na varredura: ${String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button onClick={() => setMode('GEO')} disabled={isScanning} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${mode === 'GEO' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}>Perímetro</button>
        <button onClick={() => setMode('NAME')} disabled={isScanning} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${mode === 'NAME' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}>Nome Direto</button>
      </div>

      {isScanning ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* PAINEL DE TELEMETRIA */}
          <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
               <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Executando Pipeline v4.0</span>
               </div>
               <button onClick={handleCancel} className="text-[9px] bg-red-500/20 text-red-400 px-3 py-1 rounded-full hover:bg-red-500/40 font-bold uppercase transition-all">Cancelar</button>
            </div>

            <div className="p-4 space-y-3">
              {telemetry.map(t => (
                <div key={t.phaseId} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                     <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'COMPLETED' ? 'bg-teal-500' : t.status === 'RUNNING' ? 'bg-teal-400 animate-pulse' : t.status === 'FAILED' ? 'bg-red-500' : 'bg-slate-700'}`} />
                     <span className={`text-[10px] font-bold uppercase tracking-tight ${t.status === 'COMPLETED' ? 'text-teal-500' : t.status === 'RUNNING' ? 'text-white' : 'text-slate-600'}`}>{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.durationMs > 0 && <span className="text-[8px] font-mono text-slate-500">{t.durationMs}ms</span>}
                    {t.counts.pfFound > 0 && <span className="bg-teal-500/10 text-teal-400 text-[9px] px-1.5 py-0.5 rounded font-black">+{t.counts.pfFound}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 p-3 gap-2 bg-slate-950/50 border-t border-slate-800">
               <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Candidatos</span>
                  <span className="text-sm font-black text-teal-400">{summary.pfCandidatesFound}</span>
               </div>
               <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Dedupe</span>
                  <span className="text-sm font-black text-white">{summary.pfUniqueAfterDedupe}</span>
               </div>
               <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Provas</span>
                  <span className="text-sm font-black text-indigo-400">{summary.evidencesTotal}</span>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {mode === 'GEO' ? (
            <div className="grid grid-cols-4 gap-2">
              <select value={uf} onChange={e => setUf(e.target.value)} className="col-span-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none">
                <option value="MT">MT</option><option value="GO">GO</option><option value="PR">PR</option><option value="BA">BA</option><option value="MS">MS</option>
              </select>
              <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="col-span-3 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none">
                <option value="">Município...</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : (
            <input type="text" value={directName} onChange={e => setDirectName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-teal-500 shadow-inner" placeholder="Nome do Produtor / Família..." />
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Foco de Atividade</label>
            <select value={vertical} onChange={e => setVertical(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none">
               <option value="GRAOS">Grãos (Soja/Milho)</option>
               <option value="PECUARIA">Pecuária Intensiva</option>
               <option value="ALGODAO">Algodão & Fibras</option>
               <option value="INDUSTRIA">Agroindústria</option>
            </select>
          </div>

          <button 
            onClick={startSearch} 
            disabled={(!selectedCity && mode === 'GEO') || (!directName && mode === 'NAME')}
            className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            <Radar size={16} className="group-hover:rotate-180 transition-transform duration-700" /> Iniciar Caçada Regional
          </button>
        </div>
      )}
    </div>
  );
};
