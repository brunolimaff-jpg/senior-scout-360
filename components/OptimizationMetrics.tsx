
import React, { useState, useEffect } from 'react';
import { Activity, Database, Server, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { getRequestQueueManager } from '../services/requestQueueService';
import { getCacheManager } from '../services/advancedCacheService';

export const OptimizationMetrics: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const updateMetrics = () => {
        const queue = getRequestQueueManager().getMetrics();
        const cache = getCacheManager().getMetrics();
        setMetrics({ queue, cache });
    };

    updateMetrics(); // Initial
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  // Determine System Health
  const pending = metrics.queue.pendingHigh + metrics.queue.pendingMedium + metrics.queue.pendingLow;
  let healthColor = 'bg-green-500';
  let healthText = 'Saudável';
  
  if (pending > 5 || metrics.queue.totalFailed > 0) {
      healthColor = 'bg-yellow-500';
      healthText = 'Ocupado';
  }
  if (pending > 15) {
      healthColor = 'bg-red-500';
      healthText = 'Sobrecarregado';
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end">
        {/* Panel */}
        {isOpen && (
            <div className="mb-4 bg-white rounded-xl shadow-2xl border border-slate-200 w-72 overflow-hidden animate-in slide-in-from-bottom-5">
                <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <Zap size={14} className="text-yellow-400" /> Sistema de Otimização
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${healthColor} animate-pulse`}></span>
                        <span className="text-[10px] font-mono opacity-80">{healthText}</span>
                    </div>
                </div>
                
                <div className="p-4 space-y-4">
                    {/* Queue Metrics */}
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                            <Server size={12} /> Fila de Requisições (Gemini)
                        </h4>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="text-lg font-bold text-slate-700">{metrics.queue.totalProcessed}</div>
                                <div className="text-[8px] text-slate-400 uppercase">Processados</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <div className={`text-lg font-bold ${pending > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{pending}</div>
                                <div className="text-[8px] text-slate-400 uppercase">Na Fila</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <div className={`text-lg font-bold ${metrics.queue.totalFailed > 0 ? 'text-red-600' : 'text-slate-700'}`}>{metrics.queue.totalFailed}</div>
                                <div className="text-[8px] text-slate-400 uppercase">Falhas</div>
                            </div>
                        </div>
                    </div>

                    {/* Cache Metrics */}
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                            <Database size={12} /> Cache Inteligente (L1/L2)
                        </h4>
                        <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <div className="flex-1">
                                <div className="text-xs text-indigo-800 font-bold mb-1">Taxa de Economia</div>
                                <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                                    <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: metrics.cache.hitRate }}></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-black text-indigo-700">{metrics.cache.hitRate}</div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-1">
                            <span>Memória: <strong>{metrics.cache.memoryItems}</strong> itens</span>
                            <span>Disco: <strong>{metrics.cache.diskItems}</strong> itens</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Toggle Button */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-2 px-4 rounded-full shadow-lg border border-slate-200 flex items-center gap-2 transition-all hover:scale-105"
        >
            <Activity size={16} className="text-indigo-600" />
            {isOpen ? 'Ocultar Métricas' : 'Status do Sistema'}
            {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
    </div>
  );
};
