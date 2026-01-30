
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  MapPin, Terminal, Database, Layers, 
  PlayCircle, PauseCircle, LayoutDashboard, 
  TrendingUp, UploadCloud, Target, Bell, UserCircle,
  Briefcase, Shield, FileText, Search as SearchIcon, Building2,
  ListFilter, ArrowDownUp, Check
} from 'lucide-react';
import { CSVImporter } from './CSVImporter';
import { ManualSearch } from './ManualSearch';
import { ManualSearchPJ } from './ManualSearchPJ';
import LeadCard from './LeadCard';
import { CompanyDetailsModal } from './CompanyDetailsModal';
import { IntelligenceGuide } from './IntelligenceGuide';
import { ProspectLead } from '../types';
import { enrichLeadWithRealData } from '../services/prospectorService';
import { getRandomPhrase } from '../utils/saraPersonality';

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
  const [activeTab, setActiveTab] = useState<'RADAR' | 'DOSSIE' | 'ARSENAL' | 'VAULT'>('RADAR');
  const [sidebarMode, setSidebarMode] = useState<'UPLOAD' | 'SEARCH_CPF' | 'SEARCH_CNPJ'>('UPLOAD');
  const [selectedRegion, setSelectedRegion] = useState('MT');
  
  // Estado para Busca PJ Programática (Grupo)
  const [prefillSearchTerm, setPrefillSearchTerm] = useState('');
  const [autoTriggerSearch, setAutoTriggerSearch] = useState(false);

  // Estado para Modal de Detalhes
  const [selectedLeadForDetails, setSelectedLeadForDetails] = useState<ProspectLead | null>(null);
  
  // Estado de Ordenação
  const [sortMode, setSortMode] = useState<'HECTARES' | 'EVIDENCE' | 'SCORE' | 'REVENUE'>('REVENUE');

  // SMART SORTING (RANKING AUTOMÁTICO)
  const sortedLeads = useMemo(() => {
    const validLeads = leads.filter(l => !!l);

    // MODO CPF
    if (sidebarMode === 'SEARCH_CPF' && validLeads.some(l => l.businessType?.includes('PF'))) {
        return [...validLeads].sort((a, b) => {
            if (sortMode === 'HECTARES') {
                return (b.metadata?.hectaresTotal || 0) - (a.metadata?.hectaresTotal || 0);
            }
            if (sortMode === 'EVIDENCE') {
                return (b.metadata?.fontes?.length || 0) - (a.metadata?.fontes?.length || 0);
            }
            // Default SCORE
            return (b.confidence || 0) - (a.confidence || 0);
        });
    }

    // MODO CNPJ (Ranking Corporativo)
    return [...validLeads].sort((a, b) => {
      // 1. TOP 1% AGRO (Revenue > 500MM)
      const revA = a.estimatedRevenue || 0;
      const revB = b.estimatedRevenue || 0;
      
      // Se ambos tiverem revenue estimado, ganha o maior
      if (revA !== revB) return revB - revA;

      // 2. CORPORATE (S.A.)
      if (a.isSA !== b.isSA) return a.isSA ? -1 : 1;

      // 3. COMPLEXIDADE (S_fit)
      const complexA = a.tacticalAnalysis?.operationalComplexity || 0;
      const complexB = b.tacticalAnalysis?.operationalComplexity || 0;
      if (complexA !== complexB) return complexB - complexA;

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
        
        // 🛡️ DEDUPLICAÇÃO ROBUSTA (CNPJ > NOME)
        const getUniqueKey = (l: ProspectLead) => {
            const cnpjNums = l.cnpj ? l.cnpj.replace(/\D/g, '') : '';
            // Se tem CNPJ válido (>8 dígitos), usa ele como chave primária
            if (cnpjNums.length > 8) return cnpjNums;
            // Senão, usa o nome normalizado (Upper + Trim + Sem espaços duplos)
            return l.companyName.trim().toUpperCase().replace(/\s+/g, ' ');
        };

        // Mapeia chaves existentes
        const existingKeys = new Set(safePrev.map(getUniqueKey));
        
        // Filtra novos que não colidam com existentes
        const filteredNew = safeNew.filter(l => {
            const key = getUniqueKey(l);
            if (existingKeys.has(key)) return false;
            
            // Adiciona ao set para evitar duplicatas dentro do próprio lote novo
            existingKeys.add(key);
            return true;
        });
        
        return [...filteredNew, ...safePrev];
    });
    // Reseta progresso apenas para os novos (visual) ou para o lote todo se for re-auditado
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
    if (auditProgress.current === auditProgress.total && auditProgress.total > 0) {
        setStatusMsg("✅ Ranking de Oportunidades Atualizado.");
    }
  };

  const handleIndividualAudit = async (leadId: string) => {
    const target = leads.find(l => l && l.id === leadId);
    if (!target) return;
    setAuditingLeadId(leadId);
    setStatusMsg(`Focando em: ${target.companyName}...`);
    const enriched = await enrichLeadWithRealData(target);
    if (enriched) {
        setLeads(prev => prev.map(l => l && l.id === leadId ? enriched : l));
    }
    setAuditingLeadId(null);
  };

  // Acionado pelo botão "BUSCAR GRUPO [DOMAIN]"
  const handleGroupSearch = async (lead: ProspectLead) => {
    // 1. Define termo de busca (Domínio ou Nome)
    const searchTerm = lead.corporateDomain || lead.companyName;
    
    // 2. Muda para aba de busca PJ
    setSidebarMode('SEARCH_CNPJ');
    
    // 3. Prepara o gatilho automático
    setPrefillSearchTerm(searchTerm);
    setAutoTriggerSearch(true);
    
    setStatusMsg(`🕵️ Iniciando varredura corporativa para grupo: ${searchTerm}...`);
    
    // Reset do trigger após curto delay para permitir que o componente filho reaja
    setTimeout(() => setAutoTriggerSearch(false), 1000);
  };
  
  const progressPercent = auditProgress.total > 0 ? (auditProgress.current / auditProgress.total) * 100 : 0;
  const leadsValidados = leads.filter(l => l && l.isValidated).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-600 flex flex-col">
      
      {/* Modal de Detalhes (Overlay) */}
      {selectedLeadForDetails && (
        <CompanyDetailsModal 
          lead={selectedLeadForDetails} 
          onClose={() => setSelectedLeadForDetails(null)} 
        />
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 w-64">
           <div className="bg-teal-600 p-2 rounded-lg text-white shadow-sm shadow-teal-200"><Target size={20} /></div>
           <div><h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none">Senior Scout <span className="text-teal-600">360</span></h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Intelligence Platform</p></div>
        </div>
        <nav className="hidden md:flex items-center h-full gap-8">
           <button onClick={() => setActiveTab('RADAR')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'RADAR' ? 'border-teal-50 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><LayoutDashboard size={16} /> Radar Agro</button>
           <button onClick={() => setActiveTab('DOSSIE')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'DOSSIE' ? 'border-teal-50 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><FileText size={16} /> Dossiê Scout</button>
           <button onClick={() => setActiveTab('ARSENAL')} className={`h-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all px-2 ${activeTab === 'ARSENAL' ? 'border-teal-50 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Shield size={16} /> Arsenal Tático</button>
        </nav>
        <div className="flex items-center gap-4 w-64 justify-end">
           <div className="hidden lg:flex flex-col items-end mr-2"><span className="text-xs font-bold text-slate-700">Bruno Diretor</span><span className="text-[10px] text-slate-400 uppercase">Comercial Agro</span></div>
           <button className="p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-full transition-colors relative group"><Bell size={20} /><span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform"></span></button>
           <div className="w-9 h-9 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:ring-2 hover:ring-teal-200 cursor-pointer transition-all"><UserCircle size={24} /></div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto p-4 lg:p-6 w-full">
        
        <aside className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-24 overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 bg-white flex items-center gap-3">
               <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Briefcase size={18} /></div>
               <div><h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Filtros de Prospecção</h2><p className="text-[10px] text-slate-400 font-medium">Configure sua busca</p></div>
            </div>

            <div className="p-5 space-y-6">
              
              <div className="flex p-1 bg-slate-100 rounded-xl overflow-hidden">
                 <button 
                   onClick={() => setSidebarMode('UPLOAD')}
                   className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${sidebarMode === 'UPLOAD' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   <UploadCloud size={14}/> Importar
                 </button>
                 <button 
                   onClick={() => setSidebarMode('SEARCH_CPF')}
                   className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${sidebarMode === 'SEARCH_CPF' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   <SearchIcon size={14}/> Busca CPF
                 </button>
                 <button 
                   onClick={() => setSidebarMode('SEARCH_CNPJ')}
                   className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${sidebarMode === 'SEARCH_CNPJ' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   <Building2 size={14}/> Busca CNPJ
                 </button>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={12} className="text-teal-500" /> Região Alvo
                    </label>
                    <div className="relative">
                      <select 
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="w-full pl-3 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-teal-500 transition-colors hover:border-teal-300 cursor-pointer appearance-none"
                      >
                        <option value="MT">Mato Grosso (MT)</option>
                        <option value="GO">Goiás (GO)</option>
                        <option value="PR">Paraná (PR)</option>
                        <option value="BA">Matopiba (BA)</option>
                      </select>
                    </div>
                 </div>
                 
                 {sidebarMode === 'UPLOAD' && (
                    <CSVImporter onImport={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />
                 )}
                 {sidebarMode === 'SEARCH_CPF' && (
                    <ManualSearch selectedUf={selectedRegion} onSearch={handleLeadsUpdate} onStatusUpdate={setStatusMsg} />
                 )}
                 {sidebarMode === 'SEARCH_CNPJ' && (
                    <ManualSearchPJ 
                      selectedUf={selectedRegion} 
                      onSearch={handleLeadsUpdate} 
                      onStatusUpdate={setStatusMsg}
                      // Props para busca programática
                      initialSearchTerm={prefillSearchTerm}
                      autoTrigger={autoTriggerSearch}
                    />
                 )}
              </div>
              
              {leads.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Terminal size={14} className="text-teal-600" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sara Auditor</span></div>
                    <span className="bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{leadsValidados}/{leads.length}</span>
                  </div>
                  <div className="space-y-1.5">
                     <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${isAuditing ? 'bg-teal-500' : 'bg-slate-400'}`} style={{ width: `${progressPercent}%` }} />
                     </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg p-3 min-h-[3rem] flex items-center shadow-sm">
                     <p className="text-xs text-slate-500 italic leading-relaxed line-clamp-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block mr-2 animate-pulse" />"{statusMsg}"</p>
                  </div>
                  <button 
                    onClick={() => setIsAuditing(!isAuditing)}
                    disabled={leadsValidados === leads.length}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${leadsValidados === leads.length ? 'bg-emerald-100 text-emerald-600 cursor-default border border-emerald-200' : isAuditing ? 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200' : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-200'}`}
                  >
                    {leadsValidados === leads.length ? "✨ Análise Concluída" : isAuditing ? <><PauseCircle size={16} /> Pausar</> : <><PlayCircle size={16} /> Iniciar Auditoria</>}
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                 <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 border border-teal-100 text-teal-900 transition-colors hover:bg-teal-100/50 cursor-pointer group">
                   <div className="bg-white p-1.5 rounded-lg shadow-sm text-teal-600 group-hover:text-teal-700"><Database size={16} /></div>
                   <div><div className="text-[10px] font-bold uppercase text-teal-600/70 group-hover:text-teal-700">Cofre de Leads</div><div className="text-sm font-bold">{savedLeads.length} <span className="text-xs font-normal opacity-70">empresas salvas</span></div></div>
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
              <p className="text-sm text-slate-500 max-w-sm">
                {sidebarMode === 'UPLOAD' ? 'Importe sua planilha .csv' : sidebarMode === 'SEARCH_CPF' ? 'Faça uma busca de produtores PF' : 'Pesquise empresas PJ'} para que a Sara classifique as oportunidades por potencial.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col xl:flex-row justify-between items-end gap-4 px-1">
                 <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Resultados da Busca</h1>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-500"></span>Ranking por <strong className="text-teal-700">{sidebarMode === 'SEARCH_CPF' ? 'Potencial de Fechamento' : 'Faturamento Estimado & Complexidade'}</strong></p>
                 </div>
                 
                 {/* Sort Selector (CPF Mode Exclusive) */}
                 {sidebarMode === 'SEARCH_CPF' && (
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <button onClick={() => setSortMode('HECTARES')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors ${sortMode === 'HECTARES' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                           <MapPin size={12} /> Poder de Terra
                        </button>
                        <button onClick={() => setSortMode('EVIDENCE')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors ${sortMode === 'EVIDENCE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                           <ListFilter size={12} /> Volume Evidências
                        </button>
                        <button onClick={() => setSortMode('SCORE')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1.5 transition-colors ${sortMode === 'SCORE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                           <ArrowDownUp size={12} /> Grau de Confiança
                        </button>
                    </div>
                 )}

                 {sidebarMode !== 'SEARCH_CPF' && (
                    <div className="hidden xl:flex gap-4">
                        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                        <TrendingUp size={16} className="text-slate-400" />
                        <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">Pipeline Total</span><span className="text-xs font-bold text-slate-700">R$ {((leads.reduce((acc, l) => acc + (l.capitalSocial || 0), 0))/1000000).toFixed(0)} MM</span></div>
                        </div>
                    </div>
                 )}
              </div>

              <IntelligenceGuide mode={sidebarMode} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                {sortedLeads.map(lead => (
                  <LeadCard 
                    key={lead.id} 
                    lead={lead} 
                    onSave={(l) => onSaveLeads([...savedLeads, l])} 
                    onDeepDive={(l) => setSelectedLeadForDetails(l)} // Abre Modal
                    onIndividualAudit={handleIndividualAudit}
                    onFindPJs={handleGroupSearch} // Inicia Busca de Grupo
                    isBeingAudited={auditingLeadId === lead.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
