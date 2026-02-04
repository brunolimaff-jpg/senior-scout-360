
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Terminal, Layers, PlayCircle, PauseCircle, LayoutDashboard, 
  Shield, Search as SearchIcon, 
  ArrowDownWideNarrow, TrendingUp, LayoutGrid, Target, UserCircle,
  UploadCloud, MapPin, CheckCircle2, BarChart3, FileText, Network
} from 'lucide-react';
import { CSVImporter } from './CSVImporter';
import { ManualSearch } from './ManualSearch';
import { LeadCard } from './LeadCard';
import { IntelligenceGuide } from './IntelligenceGuide';
import { ProspectLead } from '../types';
import { enrichLeadWithRealData } from '../services/prospectorService';
import { getRandomPhrase } from '../utils/saraPersonality';
import { CompanyDetailsModal } from './modals/CompanyDetailsModal';
import { OperationsCenter } from './OperationsCenter';

export const Phase0Prospector: React.FC<{
  savedLeads: ProspectLead[];
  onSaveLeads: (leads: ProspectLead[]) => void;
  onDeepDive: (lead: ProspectLead) => void;
  onCompare: (leads: ProspectLead[]) => void;
}> = ({ savedLeads, onSaveLeads, onDeepDive }) => {
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0 });
  const [statusMsg, setStatusMsg] = useState(getRandomPhrase('START'));
  const isAuditingRef = useRef(false);

  // Estados de Navegação
  const [activeTab, setActiveTab] = useState<'RADAR' | 'ARSENAL'>('RADAR');
  const [sidebarMode, setSidebarMode] = useState<'UPLOAD' | 'SEARCH_CPF'>('UPLOAD'); // Removido SEARCH_CNPJ
  const [selectedRegion, setSelectedRegion] = useState('MT');
  
  // Estado para Modal de Dossiê
  const [selectedLeadForModal, setSelectedLeadForModal] = useState<ProspectLead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado de Ordenação
  const [sortMode, setSortMode] = useState<'SCORE' | 'CAPITAL'>('SCORE');

  // Estado para Comparação
  const [comparisonLeads, setComparisonLeads] = useState<ProspectLead[]>([]);

  // Lógica de Ordenação
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      if (sortMode === 'CAPITAL') return (b.capitalSocial || 0) - (a.capitalSocial || 0);
      // Score Default
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      return scoreB - scoreA;
    });
  }, [leads, sortMode]);

  useEffect(() => {
    isAuditingRef.current = isAuditing;
    if (isAuditing) startAuditProcess();
  }, [isAuditing]);

  const startAuditProcess = async () => {
    for (const lead of leads) {
      if (!isAuditingRef.current) break;
      if (lead.isValidated) {
        setAuditProgress(p => ({ ...p, current: p.current + 1 }));
        continue;
      }

      setStatusMsg(`Auditoria Profunda: ${lead.companyName}...`);
      try {
        const enriched = await enrichLeadWithRealData(lead);
        if (enriched) {
            setLeads(prev => prev.map(l => l.id === lead.id ? enriched : l));
        }
      } catch (e) { console.error(e); }
      
      setAuditProgress(p => ({ ...p, current: p.current + 1 }));
    }
    setIsAuditing(false);
  };

  const handleLeadsUpdate = (newLeads: ProspectLead[]) => {
    setLeads(prev => {
      const existing = new Set(prev.map(l => l.cnpj || l.companyName));
      const filtered = newLeads.filter(l => !existing.has(l.cnpj || l.companyName));
      return [...filtered, ...prev];
    });
    setAuditProgress({ current: 0, total: newLeads.length });
  };

  const handleOpenDossier = (lead: ProspectLead) => {
    setSelectedLeadForModal(lead);
    setIsModalOpen(true);
  };

  const handleLeadDataUpdate = (updatedLead: ProspectLead) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    // Se o lead atualizado for o que está no modal, atualiza ele também para consistência
    if (selectedLeadForModal?.id === updatedLead.id) {
      setSelectedLeadForModal(updatedLead);
    }
  };

  const leadsValidados = leads.filter(l => l.isValidated).length;
  const progressPercent = leads.length > 0 ? (leadsValidados / leads.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      
      {/* MODAL DE DOSSIÊ PROFUNDO */}
      {selectedLeadForModal && (
        <CompanyDetailsModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          lead={selectedLeadForModal} 
          onUpdateLead={handleLeadDataUpdate}
        />
      )}

      {/* HEADER PRINCIPAL */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 w-64">
           <div className="bg-emerald-600 p-2 rounded-lg text-white shadow-sm shadow-emerald-200"><Target size={20} /></div>
           <div>
             <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none">Senior Scout <span className="text-emerald-600">360</span></h1>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Intelligence Platform</p>
           </div>
        </div>
        <nav className="hidden md:flex items-center h-full gap-8">
           <button onClick={() => setActiveTab('RADAR')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'RADAR' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><LayoutDashboard size={16} /> Radar Agro</button>
           <button onClick={() => setActiveTab('ARSENAL')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'ARSENAL' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Shield size={16} /> Arsenal Tático</button>
        </nav>
        <div className="w-64 flex justify-end"><UserCircle className="text-slate-300" size={32} /></div>
      </header>

      {/* VIEW: ARSENAL */}
      {activeTab === 'ARSENAL' ? (
         <div className="flex-1 p-6 animate-in zoom-in-95 duration-300 bg-slate-50/50">
            <div className="max-w-[1800px] mx-auto h-full flex flex-col">
                <button onClick={() => setActiveTab('RADAR')} className="mb-4 text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 uppercase tracking-wide self-start">
                  &larr; Voltar para o Radar
                </button>
                <OperationsCenter comparisonLeads={comparisonLeads} onClearComparison={() => { setComparisonLeads([]); setActiveTab('RADAR'); }} />
            </div>
         </div>
      ) : (
        // VIEW: RADAR
        <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto p-4 lg:p-6 w-full animate-in fade-in duration-300">
          
          {/* SIDEBAR TÁTICA */}
          <aside className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-4">
            
            {/* CARD DE ENTRADA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100">
                <button 
                  onClick={() => setSidebarMode('UPLOAD')}
                  className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${sidebarMode === 'UPLOAD' ? 'text-emerald-600 bg-emerald-50/30 border-b-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                  <UploadCloud size={16} /> Importar / CNPJ
                </button>
                <button 
                  onClick={() => setSidebarMode('SEARCH_CPF')}
                  className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${sidebarMode === 'SEARCH_CPF' ? 'text-emerald-600 bg-emerald-50/30 border-b-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                  <SearchIcon size={16} /> Busca Produtor
                </button>
              </div>

              <div className="p-5 space-y-5">
                 {/* SELETOR DE REGIÃO */}
                 <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={12} className="text-emerald-500" /> Região de Análise
                      </label>
                      <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-colors hover:border-emerald-300 appearance-none cursor-pointer">
                          <option value="MT">Mato Grosso (MT)</option>
                          <option value="GO">Goiás (GO)</option>
                          <option value="PR">Paraná (PR)</option>
                          <option value="BA">Matopiba (BA)</option>
                      </select>
                  </div>

                  {/* INPUT DINÂMICO */}
                  <div className="min-h-[120px]">
                    {sidebarMode === 'UPLOAD' ? (
                      <CSVImporter onImport={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />
                    ) : (
                      <ManualSearch selectedUf={selectedRegion} onSearch={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />
                    )}
                  </div>

                  {/* ENTREGAS */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <CheckCircle2 size={12} className="text-emerald-500" /> Entregas da Inteligência
                    </h4>
                    <ul className="space-y-2">
                       <li className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <BarChart3 size={14} className="text-emerald-600" />
                          <span>Análise 4 Pilares <span className="text-slate-400 text-[10px]">(Musc/Comp/Gente/Mom)</span></span>
                       </li>
                       <li className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <TrendingUp size={14} className="text-emerald-600" />
                          <span>Cálculo de Receita Estimada</span>
                       </li>
                       <li className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <FileText size={14} className="text-emerald-600" />
                          <span>Dossiê Comercial Completo</span>
                       </li>
                       <li className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <Network size={14} className="text-emerald-600" />
                          <span>Mapeamento de Grupo Econômico</span>
                       </li>
                    </ul>
                  </div>
              </div>
            </div>

            {/* STATUS DO AUDITOR */}
            {leads.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm animate-in slide-in-from-left-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Terminal size={14} className="text-emerald-600" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Status do Auditor</span></div>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{leadsValidados}/{leads.length}</span>
                    </div>
                    
                    <div className="space-y-1.5">
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${isAuditing ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${progressPercent}%` }} />
                       </div>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[3rem] flex items-center">
                      <p className="text-xs text-slate-500 italic leading-relaxed line-clamp-2">
                         <span className={`w-1.5 h-1.5 rounded-full inline-block mr-2 ${isAuditing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                         "{statusMsg}"
                      </p>
                    </div>

                    <button 
                       onClick={() => setIsAuditing(!isAuditing)} 
                       disabled={leadsValidados === leads.length} 
                       className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${leadsValidados === leads.length ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-100' : isAuditing ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
                    >
                       {leadsValidados === leads.length ? "✨ Análise Concluída" : isAuditing ? <><PauseCircle size={16} /> Pausar</> : <><PlayCircle size={16} /> Iniciar Auditoria</>}
                    </button>
                  </div>
            )}
          </aside>

          {/* GRID DE RESULTADOS */}
          <div className="flex-1 min-w-0">
            {leads.length === 0 ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-slate-100">
                   <Layers size={48} className="text-emerald-100 fill-emerald-50" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Área de Operações Vazia</h3>
                <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                  Utilize o <span className="font-bold text-emerald-600">Console Tático</span> à esquerda para importar dados ou buscar empresas. A Sara irá classificar automaticamente as oportunidades.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* HEADER DA LISTA */}
                <div className="flex flex-col xl:flex-row justify-between items-end gap-4 px-1 pb-2 border-b border-slate-200">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                      <LayoutGrid size={24} className="text-emerald-600" />
                      Resultados da Busca
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      <span className="font-bold text-slate-800">{leads.length}</span> oportunidades encontradas
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 uppercase">Ordenar por:</span>
                      <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                          <button 
                            onClick={() => setSortMode('SCORE')} 
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors ${sortMode === 'SCORE' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            <ArrowDownWideNarrow size={12} /> Score
                          </button>
                          <button 
                            onClick={() => setSortMode('CAPITAL')} 
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors ${sortMode === 'CAPITAL' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            <TrendingUp size={12} /> Capital
                          </button>
                      </div>
                  </div>
                </div>
                
                {/* GRID DE CARDS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                  {sortedLeads.map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onAction={() => handleOpenDossier(lead)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
