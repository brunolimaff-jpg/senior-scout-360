import React, { useState, useEffect } from 'react';
import { ProspectLead, LogEntry } from './types';
import { Phase0Prospector } from './components/Phase0Prospector';
import { OperationsCenter } from './components/OperationsCenter';
import ScoutModule from './components/ScoutModule';
import { LogConsole } from './components/LogConsole';

// Tipos de Visão da Aplicação
type AppView = 'RADAR' | 'SCOUT' | 'ARSENAL';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('RADAR');
  const [selectedLead, setSelectedLead] = useState<ProspectLead | null>(null);
  
  // Estado Global (Persistente durante a sessão)
  const [savedLeads, setSavedLeads] = useState<ProspectLead[]>([]);
  const [comparisonLeads, setComparisonLeads] = useState<ProspectLead[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Sistema de Log Centralizado
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: new Date().toISOString()
    };
    setLogs(s => [...s, newLog]);
  };

  // --- Handlers de Navegação ---

  // Iniciar Deep Dive (Scout)
  const handleStartScout = (lead: ProspectLead) => {
    addLog(`Sara: Iniciando auditoria profunda para: ${lead.companyName}...`, 'info');
    setSelectedLead(lead);
    setCurrentView('SCOUT');
  };

  const handleBackToRadar = () => {
    setSelectedLead(null);
    setCurrentView('RADAR');
  };

  const handleCompareLeads = (leads: ProspectLead[]) => {
    setComparisonLeads(leads);
    setCurrentView('ARSENAL');
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* VIEW: RADAR (Descoberta) */}
        {currentView === 'RADAR' && (
          <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            <Phase0Prospector 
              savedLeads={savedLeads}
              onSaveLeads={setSavedLeads}
              onDeepDive={handleStartScout}
              onCompare={handleCompareLeads}
            />
          </div>
        )}

        {/* VIEW: SCOUT (Auditoria Profunda) */}
        {currentView === 'SCOUT' && selectedLead && (
          <div className="flex-1 overflow-y-auto w-full bg-slate-50/50 p-6 md:p-8 animate-in slide-in-from-right-8 duration-500">
             <ScoutModule 
               initialLead={selectedLead}
               onBack={handleBackToRadar}
               addLog={addLog}
             />
          </div>
        )}

        {/* VIEW: ARSENAL (Comparativo & Ferramentas) */}
        {currentView === 'ARSENAL' && (
           <div className="flex-1 overflow-y-auto w-full p-6 md:p-8 animate-in fade-in zoom-in-95">
             <div className="max-w-7xl mx-auto">
               <div className="mb-6 flex justify-between items-center">
                  <button 
                    onClick={handleBackToRadar}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold uppercase text-xs tracking-wider transition-colors"
                  >
                    &larr; Voltar para Radar
                  </button>
                  <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest">Arsenal Tático</h2>
               </div>
               <OperationsCenter 
                 comparisonLeads={comparisonLeads}
                 onClearComparison={() => setComparisonLeads([])}
               />
             </div>
           </div>
        )}

        {/* Footer Global (apenas fora do Radar para não poluir a view full-screen) */}
        {currentView !== 'RADAR' && (
          <footer className="bg-white border-t border-slate-100 py-4 px-8 mt-auto flex-shrink-0 z-10">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2025 Senior Sistemas • Sales Intelligence Unit</p>
              <div className="flex gap-4">
                 <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">v2.1 Pilot</span>
              </div>
            </div>
          </footer>
        )}

      </main>

      {/* Console de Logs Flutuante */}
      <LogConsole logs={logs} onClear={clearLogs} />

    </div>
  );
}