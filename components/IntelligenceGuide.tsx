import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Target, Zap, ShieldCheck, Map, FileSearch, Shield } from 'lucide-react';

interface Props {
  mode?: 'CPF' | 'CNPJ' | 'UPLOAD' | 'SEARCH_CPF' | 'SEARCH_CNPJ';
}

export const IntelligenceGuide: React.FC<Props> = ({ mode = 'SEARCH_CNPJ' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isCpfMode = mode === 'SEARCH_CPF' || mode === 'CPF';

  return (
    <div className="mb-6 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-teal-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Critérios de Avaliação da Sara ({isCpfMode ? 'Inteligência Fundiária' : 'Complexidade Operacional'})
          </span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
      </button>
      
      {isOpen && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
          
          {/* Pilar 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              {isCpfMode ? <Map size={18} /> : <Target size={18} />}
              <h4 className="text-xs font-black uppercase">{isCpfMode ? 'Patrimônio Fundiário' : 'Complexidade Operacional'}</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isCpfMode 
                ? "Área produtiva total identificada via CAR, SIGEF e Licenças Ambientais. Cruzamos dados de múltiplos cadastros."
                : "Score baseado no Poder Econômico alavancado pela verticalização da operação (Indústria, Silos e Logística)."}
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-teal-600 mb-1">
              {isCpfMode ? <ShieldCheck size={18} /> : <Zap size={18} />}
              <h4 className="text-xs font-black uppercase">{isCpfMode ? 'Confiança da Fonte' : 'Multiplicador de Cultura'}</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isCpfMode 
                ? "Score baseado na procedência oficial (Diário Oficial, SEMA) e consistência entre documentos públicos."
                : "Diferenciamos a complexidade de software exigida para Algodão (1.5x) vs Pecuária (0.8x) vs Grãos (1.0x)."}
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              {isCpfMode ? <FileSearch size={18} /> : <Shield size={18} />}
              <h4 className="text-xs font-black uppercase">{isCpfMode ? 'Rastro de Evidências' : 'Maturidade de Governança'}</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isCpfMode 
                ? "Quantidade de documentos independentes que validam a existência e atividade do produtor na região."
                : "Prioridade para estruturas S/A e Holdings com maior necessidade de ERP robusto. Empresas com >5 anos ganham bônus."}
            </p>
          </div>

        </div>
      )}
    </div>
  );
};