import React, { useState } from 'react';
import { AccountData, Evidence, ProspectLead, OutputProfile } from '../types';
import Step1Account from './Step1Account';
import Step2Evidence from './Step2Evidence';
import Step3Dossier from './Step3Dossier';
import Step4Export from './Step4Export';

interface ScoutModuleProps {
  initialLead: ProspectLead;
  onBack: () => void;
  addLog: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ScoutModule({ initialLead, onBack, addLog }: ScoutModuleProps) {
  const [step, setStep] = useState(1);
  
  // FIXED: Initialize with empty strings fallback to prevent "cannot read properties of undefined (reading 'length')"
  const [data, setData] = useState<AccountData>({
    companyName: initialLead.companyName || '',
    cnpj: initialLead.cnpj || '',
    municipality: initialLead.city || '',
    uf: initialLead.uf || '',
    profile: OutputProfile.STANDARD,
    notes: initialLead.notes || ''
  });

  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [dossierContent, setDossierContent] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => Math.max(1, prev - 1));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      {/* Header do Fluxo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <button 
            onClick={onBack} 
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 hover:underline mb-2 flex items-center gap-1 uppercase tracking-wider transition-colors"
          >
            &larr; Voltar ao Radar
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            Dossiê Estratégico: <span className="text-indigo-600">{data.companyName}</span>
          </h1>
        </div>
        
        {/* Indicador de Passos */}
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((s) => (
            <div 
                key={s} 
                className={`h-2.5 w-12 rounded-full transition-all duration-500 ${
                  s <= step 
                    ? 'bg-indigo-600 shadow-sm shadow-indigo-300 scale-105' 
                    : 'bg-slate-200'
                }`} 
                title={`Passo ${s}`}
            />
          ))}
        </div>
      </div>

      {/* Renderização Dinâmica dos Passos */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 md:p-8">
            {step === 1 && (
            <Step1Account
                data={data}
                onUpdate={setData}
                onNext={nextStep}
            />
            )}
            {step === 2 && (
            <Step2Evidence
                data={data}
                evidenceList={evidenceList}
                setEvidenceList={setEvidenceList}
                isSearching={isSearching}
                setIsSearching={setIsSearching}
                onNext={nextStep}
                onBack={prevStep}
                addLog={addLog}
            />
            )}
            {step === 3 && (
            <Step3Dossier
                data={data}
                initialLead={initialLead}
                evidenceList={evidenceList}
                setDossierContent={setDossierContent}
                onNext={nextStep}
                onBack={prevStep}
            />
            )}
            {step === 4 && (
            <Step4Export
                data={data}
                content={dossierContent}
                onBack={prevStep}
            />
            )}
        </div>
      </div>
    </div>
  );
}