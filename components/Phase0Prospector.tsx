
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  MapPin, Terminal, Database, Layers, 
  PlayCircle, PauseCircle, LayoutDashboard, 
  TrendingUp, UploadCloud, Target, Bell, UserCircle,
  Briefcase, Shield, Search as SearchIcon, Building2,
  ArrowDownWideNarrow, LayoutGrid
} from 'lucide-react';
import { CSVImporter } from './CSVImporter';
import { ManualSearch } from './ManualSearch';
import { ManualSearchPJ } from './ManualSearchPJ';
import { LeadCard } from './LeadCard';
import { LeadDetailsModal, LeadData } from './LeadDetailsModal';
import { IntelligenceGuide } from './IntelligenceGuide';
import { ProspectLead } from '../types';
import { enrichLeadWithRealData } from '../services/prospectorService';
import { getRandomPhrase } from '../utils/saraPersonality';
import { OperationsCenter } from './OperationsCenter';

export const Phase0Prospector: React.FC<{
  savedLeads: ProspectLead[];
  onSaveLeads: (leads: ProspectLead[]) => void;
  onDeepDive: (lead: ProspectLead) => void;
  onCompare: (leads: ProspectLead[]) => void;
}> = ({ savedLeads, onSaveLeads, onDeepDive }) => {
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditingLeadId, setAuditingLeadId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0 });
  const [statusMsg, setStatusMsg] = useState(getRandomPhrase('START'));
  const isAuditingRef = useRef(false);

  // Estados de Navegação
  const [activeTab, setActiveTab] = useState<'RADAR' | 'ARSENAL'>('RADAR');
  const [sidebarMode, setSidebarMode] = useState<'UPLOAD' | 'SEARCH_CPF' | 'SEARCH_CNPJ'>('SEARCH_CNPJ');
  const [selectedRegion, setSelectedRegion] = useState('MT');
  
  // Estado para Busca PJ Programática e Comparação
  const [comparisonLeads, setComparisonLeads] = useState<ProspectLead[]>([]);

  // Estado para Modal de Detalhes
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado de Ordenação
  const [sortMode, setSortMode] = useState<'HECTARES' | 'EVIDENCE' | 'SCORE' | 'CAPITAL'>('SCORE');

  // SMART SORTING (RANKING AUTOMÁTICO)
  const sortedLeads = useMemo(() => {
    const validLeads = leads.filter(l => !!l);

    // Se estiver no modo busca CPF, mantém as opções de Hectares/Evidence
    if (sidebarMode === 'SEARCH_CPF' && validLeads.some(l => l.businessType?.includes('PF'))) {
        return [...validLeads].sort((a, b) => {
            if (sortMode === 'HECTARES') return (b.metadata?.hectaresTotal || 0) - (a.metadata?.hectaresTotal || 0);
            if (sortMode === 'EVIDENCE') return (b.metadata?.fontes?.length || 0) - (a.metadata?.fontes?.length || 0);
            if (sortMode === 'SCORE') return (b.confidence || 0) - (a.confidence || 0);
            return 0;
        });
    }

    // Ordenação Geral (PJ/Importação)
    return [...validLeads].sort((a, b) => {
      if (sortMode === 'CAPITAL') {
         return (b.capitalSocial || 0) - (a.capitalSocial || 0);
      }
      
      if (sortMode === 'SCORE') {
         // Se um está validado e outro não, prioriza o validado para score real
         if (a.isValidated !== b.isValidated) return a.isValidated ? -1 : 1;
         
         // Usa o score calculado ou confidence
         const scoreA = a.score || a.confidence || 0;
         const scoreB = b.score || b.confidence || 0;
         return scoreB - scoreA;
      }

      // Default fallback
      return (b.capitalSocial || 0) - (a.capitalSocial || 0);
    });
  }, [leads, sortMode, sidebarMode]);

  useEffect(() => {
    isAuditingRef.current = isAuditing;
    if (isAuditing) startAuditProcess();
  }, [isAuditing]);

  const handleLeadsUpdate = (newLeads: ProspectLead[]) => {
    setLeads(prev => {
        const safePrev = prev.filter(l => !!l);
        const safeNew = newLeads.filter(l => !!l);
        
        const getUniqueKey = (l: ProspectLead) => {
            const cnpjNums = l.cnpj ? l.cnpj.replace(/\D/g, '') : '';
            if (cnpjNums.length > 8) return cnpjNums;
            return l.companyName.trim().toUpperCase().replace(/\s+/g, ' ');
        };

        const existingKeys = new Set(safePrev.map(getUniqueKey));
        const filteredNew = safeNew.filter(l => {
            const key = getUniqueKey(l);
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
        });
        
        return [...filteredNew, ...safePrev];
    });
    setAuditProgress({ current: 0, total: newLeads.length });
  };

  const startAuditProcess = async () => {
    for (const lead of leads) {
      if (!lead) continue; 
      if (!isAuditingRef.current) {
        setStatusMsg("⏸️ Processo em espera.");
        break;
      }
      if (lead.isValidated && lead.businessType !== 'Produtor Rural (PF)') {
        setAuditProgress(p => ({ ...p, current: p.current + 1 }));
        continue;
      }
      setAuditingLeadId(lead.id);
      setStatusMsg(`Auditoria Profunda: ${lead.companyName}...`);
      try {
        const enriched = await enrichLeadWithRealData(lead);
        if (enriched) {
            setLeads(prev => prev.map(l => l && l.id === lead.id ? enriched : l));
        }
      } catch (e) {
        console.error("Erro auditoria", e);
      } finally {
        setAuditProgress(p => ({ ...p, current: p.current + 1 }));
      }
    }
    setAuditingLeadId(null);
    setIsAuditing(false);
  };

  // AÇÃO UNIFICADA: MAPEAR CONTA (Abre Modal + Prepara Dados)
  const handleMapAccount = (lead: ProspectLead) => {
    console.log("🚀 Mapeando conta:", lead.companyName);
    
    // Converte ProspectLead para o formato LeadData esperado pelo Modal
    const modalData: LeadData = {
        status: lead.status || 'EM ANÁLISE',
        company: {
            name: lead.companyName,
            cnpj: lead.cnpj,
            capital: lead.capitalSocial || 0,
            location: `${lead.city}/${lead.uf}`,
            activity: lead.cnaes?.[0]?.description || 'Agroindústria'
        },
        intelligence: {
            score: lead.score || 50,
            products: ['ERP Senior', 'Gestão de Pessoas', 'GAtec'], // Mock inicial
            tags: lead.tacticalAnalysis?.badges || [],
            is_big_fish: (lead.capitalSocial || 0) > 10000000
        }
    };

    setSelectedLead(modalData);
    setIsModalOpen(true);
  };
  
  const progressPercent = auditProgress.total > 0 ? (auditProgress.current / auditProgress.total) * 100 : 0;
  const leadsValidados = leads.filter(l => l && l.isValidated).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-600 flex flex-col relative">
      
      {/* MODAL GLOBAL (Z-INDEX ALTO) */}
      <LeadDetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        data={selectedLead} 
      />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 w-64">
           <div className="bg-emerald-600 p-2 rounded-lg text-white shadow-sm shadow-emerald-200"><Target size={20} /></div>
           <div><h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none">Senior Scout <span className="text-emerald-600">360</span></h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Intelligence Platform</p></div>
        </div>
        <nav className="hidden md:flex items-center h-full gap-8">
           <button onClick={() => setActiveTab('RADAR')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'RADAR' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><LayoutDashboard size={16} /> Radar Agro</button>
           <button onClick={() => setActiveTab('ARSENAL')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'ARSENAL' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Shield size={16} /> Arsenal Tático</button>
        </nav>
        <div className="flex items-center gap-4 w-64 justify-end">
           <div className="hidden lg:flex flex-col items-end mr-2"><span className="text-xs font-bold text-slate-700">Bruno Diretor</span><span className="text-[10px] text-slate-400 uppercase">Comercial Agro</span></div>
           <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-full transition-colors relative group"><Bell size={20} /><span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform"></span></button>
           <div className="w-9 h-9 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:ring-2 hover:ring-emerald-200 cursor-pointer transition-all"><UserCircle size={24} /></div>
        </div>
      </header>

      {activeTab === 'ARSENAL' ? (
         // VIEW: ARSENAL
         <div className="flex-1 p-6 animate-in zoom-in-95 duration-300 bg-slate-50/50">
            <div className="max-w-[1800px] mx-auto h-full flex flex-col">
                <button 
                  onClick={() => setActiveTab('RADAR')} 
                  className="mb-4 text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 uppercase tracking-wide self-start"
                >
                  &larr; Voltar para o Radar
                </button>
                <OperationsCenter 
                  comparisonLeads={comparisonLeads}
                  onClearComparison={() => {
                     setComparisonLeads([]);
                     setActiveTab('RADAR');
                  }}
                />
            </div>
         </div>
      ) : (
        // VIEW: RADAR (GRID DE LEADS)
        <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto p-4 lg:p-6 w-full animate-in fade-in duration-300">
          <aside className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto custom-scrollbar">
              <div className="p-5 border-b border-slate-100 bg-white flex items-center gap-3 sticky top-0 z-10">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Briefcase size={18} /></div>
                <div><h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Filtros de Prospecção</h2><p className="text-[10px] text-slate-400 font-medium">Configure sua busca</p></div>
              </div>
              <div className="p-5 space-y-6">
                <div className="flex p-1 bg-slate-100 rounded-xl overflow-hidden">
                  <button onClick={() => setSidebarMode('UPLOAD')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${sidebarMode === 'UPLOAD' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><UploadCloud size={14}/> Importar</button>
                  <button onClick={() => setSidebarMode('SEARCH_CPF')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${sidebarMode === 'SEARCH_CPF' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><SearchIcon size={14}/> Busca CPF</button>
                  <button onClick={() => setSidebarMode('SEARCH_CNPJ')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${sidebarMode === 'SEARCH_CNPJ' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Building2 size={14}/> Busca CNPJ</button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><MapPin size={12} className="text-emerald-500" /> Região Alvo</label>
                      <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full pl-3 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-colors hover:border-emerald-300 appearance-none">
                          <option value="MT">Mato Grosso (MT)</option><option value="GO">Goiás (GO)</option><option value="PR">Paraná (PR)</option><option value="BA">Matopiba (BA)</option>
                      </select>
                  </div>
                  {sidebarMode === 'UPLOAD' && <CSVImporter onImport={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />}
                  {sidebarMode === 'SEARCH_CPF' && <ManualSearch selectedUf={selectedRegion} onSearch={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />}
                  {sidebarMode === 'SEARCH_CNPJ' && <ManualSearchPJ selectedUf={selectedRegion} onSearch={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />}
                </div>
                {leads.length > 0 && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4 animate-in fade-in slide-in-from-left-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Terminal size={14} className="text-emerald-600" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sara Auditor</span></div>
                      <span className="bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{leadsValidados}/{leads.length}</span>
                    </div>
                    <div className="space-y-1.5"><div className="h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${isAuditing ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${progressPercent}%` }} /></div></div>
                    <div className="bg-white border border-slate-100 rounded-lg p-3 min-h-[3rem] flex items-center shadow-sm">
                      <p className="text-xs text-slate-500 italic leading-relaxed line-clamp-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-2 animate-pulse" />"{statusMsg}"</p>
                    </div>
                    <button onClick={() => setIsAuditing(!isAuditing)} disabled={leadsValidados === leads.length} className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${leadsValidados === leads.length ? 'bg-emerald-100 text-emerald-600 cursor-default border border-emerald-200' : isAuditing ? 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}>{leadsValidados === leads.length ? "✨ Análise Concluída" : isAuditing ? <><PauseCircle size={16} /> Pausar</> : <><PlayCircle size={16} /> Iniciar Auditoria</>}</button>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 transition-colors hover:bg-emerald-100/50 cursor-pointer group">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm text-emerald-600 group-hover:text-emerald-700"><Database size={16} /></div>
                    <div><div className="text-[10px] font-bold uppercase text-emerald-600/70 group-hover:text-emerald-700">Cofre de Leads</div><div className="text-sm font-bold">{savedLeads.length} <span className="text-xs font-normal opacity-70">empresas salvas</span></div></div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {leads.length === 0 ? (
              <div className="h-[600px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-100/50">
                <div className="bg-white p-6 rounded-full shadow-sm mb-6"><Layers size={48} className="text-slate-300" /></div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Área de Prospecção</h3>
                <p className="text-sm text-slate-500 max-w-sm">{sidebarMode === 'UPLOAD' ? 'Importe sua planilha .csv' : sidebarMode === 'SEARCH_CPF' ? 'Faça uma busca de produtores PF' : 'Pesquise empresas PJ'} para que a Sara classifique as oportunidades por potencial.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* HEADER DA LISTA + ORDENAÇÃO */}
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
                            <ArrowDownWideNarrow size={12} /> Maior Score
                          </button>
                          <button 
                            onClick={() => setSortMode('CAPITAL')} 
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors ${sortMode === 'CAPITAL' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            <TrendingUp size={12} /> Maior Capital
                          </button>
                      </div>
                  </div>
                </div>

                <IntelligenceGuide />
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                  {sortedLeads.map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onAction={() => handleMapAccount(lead)} // Dispara o modal
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
