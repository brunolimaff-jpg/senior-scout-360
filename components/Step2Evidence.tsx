
import React, { useState, useEffect } from 'react';
import { AccountData, Evidence, CostInfo } from '../types';
import { searchEvidence } from '../services/geminiService';
import { formatCost } from '../services/costService';
import { useSimulatedProgress } from '../hooks/useSimulatedProgress';
import { 
  Search, ExternalLink, Newspaper, CheckCircle, 
  Activity, Globe, Zap, TrendingUp, ShieldAlert, 
  Coins, Filter, MousePointer2, CheckSquare, Square
} from 'lucide-react';

interface Props {
  data: AccountData;
  evidenceList: Evidence[];
  setEvidenceList: (list: Evidence[]) => void;
  isSearching: boolean;
  setIsSearching: (val: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  addLog?: (msg: string, type?: any) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  'Expansão': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <TrendingUp size={12} /> },
  'Tecnologia': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: <Zap size={12} /> },
  'Financeiro': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Coins size={12} /> },
  'Jurídico': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <ShieldAlert size={12} /> },
  'Geral': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: <Activity size={12} /> }
};

export default function Step2Evidence({ 
  data, evidenceList, setEvidenceList, isSearching, setIsSearching, onNext, onBack, addLog 
}: Props) {
  const { progress, timeLeft } = useSimulatedProgress(isSearching, 35);
  const [lastCost, setLastCost] = useState<CostInfo | null>(null);

  const handleSearch = async () => {
    setIsSearching(true);
    if (addLog) addLog("Sara: Iniciando varredura profunda por pilares estratégicos...", 'info');
    try {
      const { evidence, costInfo } = await searchEvidence(data, addLog);
      setEvidenceList(evidence);
      setLastCost(costInfo);
    } catch (err) {
      if (addLog) addLog(`Erro na varredura: ${String(err)}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleEvidence = (id: string) => {
    setEvidenceList(evidenceList.map(e => e.id === id ? { ...e, selected: !e.selected } : e));
  };

  const selectAll = (val: boolean) => {
    setEvidenceList(evidenceList.map(e => ({ ...e, selected: val })));
  };

  if (isSearching) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center animate-in fade-in zoom-in-95">
        <div className="relative mb-10 inline-block">
           <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse"></div>
           <Globe className="w-20 h-20 text-indigo-600 animate-spin relative" style={{ animationDuration: '6s' }} />
        </div>
        <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter mb-4">Sara está Caçando...</h2>
        <p className="text-slate-500 mb-8 font-medium italic">"Mapeando sinais de Expansão, Tecnologia e Risco para o seu pitch."</p>
        
        <div className="max-w-md mx-auto space-y-4">
           <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
              <span>Varredura Tática</span>
              <span>{Math.round(progress)}% • {timeLeft}s</span>
           </div>
           <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className="h-full bg-indigo-600 transition-all duration-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }}></div>
           </div>
           <div className="text-[10px] text-indigo-500 font-bold uppercase animate-pulse">Consultando Diários Oficiais e Fontes de Mercado...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="bg-slate-900 p-2 rounded-lg text-white"><Newspaper size={20} /></div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Curadoria de Sinais</h2>
          </div>
          <p className="text-slate-500 font-medium">Alvo: <span className="text-indigo-600 font-bold">{data.companyName}</span> • Selecione o que entrará no dossiê.</p>
        </div>
        
        <div className="flex items-center gap-3">
           {evidenceList.length > 0 && (
              <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                 <button onClick={() => selectAll(true)} className="px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white rounded transition flex items-center gap-1.5"><CheckSquare size={12}/> Tudo</button>
                 <button onClick={() => selectAll(false)} className="px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white rounded transition flex items-center gap-1.5"><Square size={12}/> Nada</button>
              </div>
           )}
           <button onClick={handleSearch} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition shadow-lg shadow-indigo-200">
             <Search size={16} /> {evidenceList.length > 0 ? 'Refazer Busca' : 'Iniciar Varredura'}
           </button>
        </div>
      </div>

      {evidenceList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evidenceList.map((item) => {
            const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Geral'];
            return (
              <div 
                key={item.id} 
                onClick={() => toggleEvidence(item.id)}
                className={`group relative bg-white rounded-2xl border-2 transition-all duration-300 cursor-pointer p-5 flex flex-col gap-4 ${
                  item.selected ? 'border-indigo-600 shadow-xl scale-[1.02]' : 'border-slate-100 hover:border-slate-200 opacity-70 hover:opacity-100'
                }`}
              >
                {/* Check Indicator */}
                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-transparent'
                }`}>
                  <CheckCircle size={14} />
                </div>

                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 ${style.bg} ${style.text} ${style.border}`}>
                         {style.icon} {item.category}
                      </span>
                      {item.recommendation === 'MANTER' && (
                         <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Destaque</span>
                      )}
                   </div>
                   
                   <h4 className="font-bold text-slate-900 text-base leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                      {item.title}
                   </h4>
                   <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-4">
                      {item.text}
                   </p>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <Globe size={10} /> {item.source}
                   </div>
                   {item.url && (
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-500 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 rounded-lg transition"
                      >
                         <ExternalLink size={14} />
                      </a>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-32 text-center">
           <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <MousePointer2 className="w-10 h-10 text-slate-300" />
           </div>
           <h3 className="text-xl font-bold text-slate-800 uppercase italic">Nenhum sinal coletado</h3>
           <p className="text-slate-400 max-w-sm mx-auto mt-2 text-sm">
             Clique no botão acima para que a Sara inicie a varredura digital em busca de sinais de Expansão, Tecnologia e Risco.
           </p>
        </div>
      )}

      {evidenceList.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-xl px-2 py-2 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-4">
           <div className="px-4 py-2 border-r border-slate-700">
              <div className="text-[10px] font-black text-slate-500 uppercase">Sinais Selecionados</div>
              <div className="text-lg font-black text-white leading-none">{evidenceList.filter(e => e.selected).length}</div>
           </div>
           <div className="flex gap-2 pr-2">
              <button onClick={onBack} className="px-6 py-3 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest transition">Voltar</button>
              <button 
                onClick={onNext} 
                disabled={evidenceList.filter(e => e.selected).length === 0}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gerar Dossiê Estratégico
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
