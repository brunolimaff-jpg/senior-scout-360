
import React, { useState, useEffect } from 'react';
import { AppState, INITIAL_STATE, ProspectLead, AccountData } from './types';
import { Phase0Prospector } from './components/Phase0Prospector';
import Step1Account from './components/Step1Account';
import Step2Evidence from './components/Step2Evidence';
import Step3Dossier from './components/Step3Dossier';
import Step4Export from './components/Step4Export';
import { OperationsCenter } from './components/OperationsCenter';
import { LogConsole } from './components/LogConsole';
import { Target, ShieldCheck, Sparkles, Swords } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: new Date().toISOString()
    };
    setState(s => ({ ...s, logs: [...s.logs, newLog] }));
  };

  const handleDeepDive = (lead: ProspectLead) => {
    setState(s => ({
      ...s,
      activeModule: 'SCOUT',
      data: {
        ...s.data,
        companyName: lead.companyName,
        cnpj: lead.cnpj,
        municipality: lead.city,
        uf: lead.uf
      },
      step: 1
    }));
  };

  const handleCompareLeads = (leads: ProspectLead[]) => {
    setState(s => ({ 
      ...s, 
      comparisonLeads: leads,
      activeModule: 'ARSENAL'
    }));
  };

  const clearLogs = () => setState(s => ({ ...s, logs: [] }));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {state.activeModule === 'RADAR' ? (
        <Phase0Prospector 
          savedLeads={state.savedLeads}
          onSaveLeads={(leads) => setState(s => ({ ...s, savedLeads: leads }))}
          onDeepDive={handleDeepDive}
          onCompare={handleCompareLeads}
        />
      ) : (
        <main className="flex-1 max-w-7xl mx-auto w-full p-8 animate-in fade-in duration-500">
           {/* Navigation back for non-Radar modules */}
           <div className="mb-6 flex justify-between items-center">
             <button 
               onClick={() => setState(s => ({ ...s, activeModule: 'RADAR' }))}
               className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold uppercase text-xs tracking-wider"
             >
               &larr; Voltar para Radar Agro
             </button>
             <h2 className="text-sm font-black text-slate-300 uppercase">{state.activeModule}</h2>
           </div>

           {state.activeModule === 'ARSENAL' && (
             <OperationsCenter 
               comparisonLeads={state.comparisonLeads}
               onClearComparison={() => setState(s => ({ ...s, comparisonLeads: [] }))}
             />
           )}

           {state.activeModule === 'SCOUT' && (
             <div className="w-full">
               {state.step === 1 && (
                  <Step1Account
                    data={state.data}
                    onUpdate={(data) => setState(s => ({ ...s, data }))}
                    onNext={() => setState(s => ({ ...s, step: 2 }))}
                  />
                )}
                {state.step === 2 && (
                  <Step2Evidence
                    data={state.data}
                    evidenceList={state.evidenceList}
                    setEvidenceList={(list) => setState(s => ({ ...s, evidenceList: list }))}
                    isSearching={state.isSearching}
                    setIsSearching={(val) => setState(s => ({ ...s, isSearching: val }))}
                    onNext={() => setState(s => ({ ...s, step: 3 }))}
                    onBack={() => setState(s => ({ ...s, step: 1 }))}
                    // Fixed: removed onUpdateAccount as it is not present in Step2Evidence Props
                    addLog={addLog}
                  />
                )}
                {state.step === 3 && (
                  <Step3Dossier
                    data={state.data}
                    evidenceList={state.evidenceList}
                    dossierContent={state.dossierContent}
                    setDossierContent={(content) => setState(s => ({ ...s, dossierContent: content }))}
                    isGenerating={state.isGenerating}
                    setIsGenerating={(val) => setState(s => ({ ...s, isGenerating: val }))}
                    onNext={() => setState(s => ({ ...s, step: 4 }))}
                    onBack={() => setState(s => ({ ...s, step: 2 }))}
                    addLog={addLog}
                  />
                )}
                {state.step === 4 && (
                  <Step4Export
                    data={state.data}
                    content={state.dossierContent}
                    onBack={() => setState(s => ({ ...s, step: 3 }))}
                  />
                )}
             </div>
           )}
        </main>
      )}

      <LogConsole logs={state.logs} onClear={clearLogs} />

      {state.activeModule !== 'RADAR' && (
        <footer className="bg-white border-t border-slate-100 py-8 px-6 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2025 Senior Sistemas • Sales Intelligence Unit</p>
            <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <a href="#" className="hover:text-indigo-600">Documentação</a>
              <a href="#" className="hover:text-indigo-600">Suporte Sara</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
