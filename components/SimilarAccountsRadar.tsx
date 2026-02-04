
import React, { useState } from 'react';
import { AccountData, FitCriteria, RadarResult, SimilarAccount, CostInfo } from '../types';
import { findSimilarAccounts } from '../services/geminiService';
import { formatCost } from '../services/costService';
import { Radar, Loader2, Target, ArrowRight, ExternalLink, Sliders, CheckCircle2, Timer, Coins } from 'lucide-react';
import { useSimulatedProgress } from '../hooks/useSimulatedProgress';

interface Props {
  currentAccount: AccountData;
  onSelectAccount: (account: Partial<AccountData>) => void;
  onClose: () => void;
}

export const SimilarAccountsRadar: React.FC<Props> = ({ currentAccount, onSelectAccount, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarResult | null>(null);
  const [lastCost, setLastCost] = useState<CostInfo | null>(null);
  
  // Increased ETA to 30s
  const { progress, timeLeft } = useSimulatedProgress(loading, 30);
  
  const [criteria, setCriteria] = useState<FitCriteria>({
    geography: ['Mesmo estado'],
    segment: ['Mesmo segmento'],
    complexity: [],
    pain: []
  });

  const toggleCriterion = (key: keyof FitCriteria, value: string) => {
    setCriteria(prev => ({
      ...prev,
      [key]: prev[key].includes(value) 
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value]
    }));
  };

  const handleSearch = async () => {
    setLoading(true);
    setLastCost(null);
    try {
      const { data: radarResult, costInfo } = await findSimilarAccounts(currentAccount, criteria);
      setResult(radarResult);
      setLastCost(costInfo);
    } catch (e) {
      alert("Erro ao buscar similares.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseAccount = (acc: SimilarAccount) => {
    // Parse location if possible "City - UF"
    let city = acc.location;
    let uf = '';
    if (acc.location.includes('-')) {
        const parts = acc.location.split('-');
        city = parts[0].trim();
        uf = parts[1].trim();
    }

    onSelectAccount({
      companyName: acc.name,
      municipality: city,
      uf: uf,
      notes: `Lead similar a ${currentAccount.companyName}.\nSinais: ${(acc.similaritySignals || []).join(', ')}.\nDor provável: ${acc.likelyPain}.`
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Radar className="w-6 h-6 text-indigo-400" /> Radar de Contas Similares
            </h2>
            <p className="text-slate-400 text-sm">
              Encontre oportunidades parecidas com <strong>{currentAccount.companyName}</strong>.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">Fechar</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Fit Criteria Selector */}
          <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
             <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
               <Sliders className="w-4 h-4" /> Critérios de Similaridade (Fit)
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                   <span className="block text-xs font-semibold text-slate-500 mb-1">Geografia</span>
                   <div className="flex flex-wrap gap-2">
                      {['Mesmo município', 'Mesmo estado', 'Região próxima'].map(c => (
                        <button key={c} onClick={() => toggleCriterion('geography', c)} 
                          className={`px-3 py-1 rounded-full border transition ${criteria.geography.includes(c) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {c}
                        </button>
                      ))}
                   </div>
                </div>
                <div>
                   <span className="block text-xs font-semibold text-slate-500 mb-1">Segmento</span>
                   <div className="flex flex-wrap gap-2">
                      {['Mesmo segmento', 'Produtor Rural', 'Cooperativa', 'Indústria'].map(c => (
                        <button key={c} onClick={() => toggleCriterion('segment', c)} 
                          className={`px-3 py-1 rounded-full border transition ${criteria.segment.includes(c) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {c}
                        </button>
                      ))}
                   </div>
                </div>
                 <div>
                   <span className="block text-xs font-semibold text-slate-500 mb-1">Complexidade</span>
                   <div className="flex flex-wrap gap-2">
                      {['Multi-CNPJ', 'Grande porte', 'Exportadora'].map(c => (
                        <button key={c} onClick={() => toggleCriterion('complexity', c)} 
                          className={`px-3 py-1 rounded-full border transition ${criteria.complexity.includes(c) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {c}
                        </button>
                      ))}
                   </div>
                </div>
                 <div>
                   <span className="block text-xs font-semibold text-slate-500 mb-1">Dor Provável</span>
                   <div className="flex flex-wrap gap-2">
                      {['Fiscal', 'Integração', 'Sucessão', 'Gestão'].map(c => (
                        <button key={c} onClick={() => toggleCriterion('pain', c)} 
                          className={`px-3 py-1 rounded-full border transition ${criteria.pain.includes(c) ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {c}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
             
             <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleSearch} 
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-70 shadow-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Radar className="w-4 h-4"/>}
                  {loading ? 'Buscando...' : 'Buscar Similares com IA'}
                </button>
             </div>
             
             {loading && (
               <div className="mt-4 px-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> Tempo estimado: {timeLeft > 0 ? timeLeft : 'Calculando...'}s</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
               </div>
             )}
          </div>

          {/* Results Table */}
          {result && result.accounts.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="font-bold text-slate-800">Resultados Encontrados ({result.accounts.length})</h3>
                 {lastCost && (
                    <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-mono border border-slate-200" title={`Modelo: ${lastCost.model} | Input: ${lastCost.inputTokens} | Output: ${lastCost.outputTokens}`}>
                       <Coins className="w-3 h-3" />
                       Custo: {formatCost(lastCost.totalCost)} ({lastCost.model.includes('flash') ? '⚡ Flash' : '🧠 Pro'})
                    </div>
                 )}
              </div>
              <div className="overflow-hidden border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Empresa</th>
                      <th className="p-3">Sinais de Similaridade</th>
                      <th className="p-3">Dor Provável</th>
                      <th className="p-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.accounts.map((acc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 group">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{acc.name}</div>
                          <div className="text-xs text-slate-500">{acc.location}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(acc.similaritySignals || []).map((s, i) => (
                              <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 italic">
                          {acc.likelyPain}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleUseAccount(acc)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 mx-auto shadow-sm"
                          >
                            Gerar Dossiê <ArrowRight className="w-3 h-3"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Search Suggestions (Google Grounding) */}
          {result?.searchSuggestionsHtml && (
             <div className="mt-6 border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                   <Target className="w-3 h-3" /> Sugestões para Aprofundar (Google)
                </h4>
                {/* Renderizado seguro do HTML do grounding */}
                <div 
                  className="prose prose-sm prose-indigo max-w-none bg-slate-50 p-4 rounded-lg border border-slate-200 search-suggestions-container"
                  dangerouslySetInnerHTML={{ __html: result.searchSuggestionsHtml }}
                />
             </div>
          )}

        </div>
      </div>
    </div>
  );
};
