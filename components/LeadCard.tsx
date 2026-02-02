import React, { useMemo, useState } from 'react';
import { ProspectLead } from '../types';
import { analyzeLeadIntelligence } from '../services/intelligenceService';
import { searchPublicData } from '../services/liveSearchService';
import { 
  FileSearch, TrendingUp, Clock, 
  Crown, Sprout, Building2, Atom, 
  FileText, Network, ChevronDown, ChevronUp, Users, Map, 
  CheckCircle2, Globe, MapPin, Search, Server, Satellite, Briefcase
} from 'lucide-react';
import { CompanyDetailsModal } from './CompanyDetailsModal';

interface LeadCardProps {
  lead: ProspectLead;
  onScout: (lead: ProspectLead) => void;
  // Props de compatibilidade com Phase0Prospector
  onFindPJs?: (lead: ProspectLead) => void;
  onSave?: (l: ProspectLead) => void;
  onIndividualAudit?: (leadId: string) => void;
  isBeingAudited?: boolean;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onScout, onFindPJs, isBeingAudited }) => {
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [enrichStep, setEnrichStep] = useState(0);
  const [dataSource, setDataSource] = useState<'ESTIMADO' | 'IA_REAL'>('ESTIMADO');
  
  const [localData, setLocalData] = useState({
    hectares: lead.metadata?.hectaresTotal || lead.hectares || 0,
    funcionarios: lead.numFuncionarios || 0,
    socios: [] as string[],
    grupo: '',
    log: ''
  });

  const isPending = lead.status === 'pending' || !lead.isValidated;
  const isHoldingName = lead.companyName.toUpperCase().includes('HOLDING') || lead.companyName.toUpperCase().includes('PARTICIPACOES') || lead.companyName.toUpperCase().includes('INVESTIMENTOS');

  const currentStats = useMemo(() => ({
    ...lead,
    hectares: localData.hectares > 0 ? localData.hectares : (lead.metadata?.hectaresTotal || lead.hectares || 0),
    numFuncionarios: localData.funcionarios > 0 ? localData.funcionarios : (lead.numFuncionarios || 0),
    isGrupoEconomico: lead.isGrupoEconomico || isHoldingName || !!localData.grupo
  }), [lead, localData, isHoldingName]);
  
  const intelligence = useMemo(() => {
    if (isPending) return null;
    return analyzeLeadIntelligence(currentStats);
  }, [currentStats, isPending]);

  // Tier calculado baseado no Score Numérico (Garante consistência)
  const totalScore = intelligence?.totalScore || 0;
  let tierKey = 'PENDING';
  if (!isPending) {
    if (totalScore > 750) tierKey = 'DIAMANTE';
    else if (totalScore > 500) tierKey = 'OURO';
    else if (totalScore > 250) tierKey = 'PRATA';
    else tierKey = 'BRONZE';
  }
  
  const pillars = intelligence?.pillars;

  // Lógica de Enriquecimento
  const runEnrichmentSequence = async () => {
    if (enrichStep > 0) return;
    setEnrichStep(1);
    await new Promise(r => setTimeout(r, 600));
    setEnrichStep(2);
    try {
      const result = await searchPublicData(lead);
      await new Promise(r => setTimeout(r, 600));
      setLocalData(prev => ({
        hectares: result.hectares || prev.hectares,
        funcionarios: result.funcionarios || prev.funcionarios,
        socios: result.socios || [],
        grupo: result.grupo || '',
        log: result.log
      }));
      if (result.hectares > 0 || result.funcionarios > 0 || (result.socios && result.socios.length > 0)) {
        setDataSource('IA_REAL');
      }
    } catch (error) { console.error(error); } finally { setEnrichStep(3); }
  };

  const handleToggleDetails = () => {
    if (!showDetails) { setShowDetails(true); if (dataSource === 'ESTIMADO' && enrichStep === 0 && !isPending) runEnrichmentSequence(); } 
    else { setShowDetails(false); }
  };

  const calculateTurboRevenue = () => {
    if (isPending) return 0;
    let multiplier = 2.5; 
    if (lead.isSA) multiplier = 10; 
    const cnaeCode = lead.cnaes?.[0]?.code || '';
    if (cnaeCode.startsWith('10') || lead.companyName.toUpperCase().includes('S.A')) multiplier = 60; 
    if (isHoldingName) multiplier = 50; 
    return (lead.capitalSocial || 0) * multiplier; 
  };
  
  const estimatedRevenue = calculateTurboRevenue();
  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(val);

  // Helper Mappers
  const displayHectares = localData.hectares > 0 ? localData.hectares : (lead.metadata?.hectaresTotal || 0);
  const firstName = lead.tradeName ? lead.tradeName.split(' ')[0] : lead.companyName.split(' ')[0];
  const groupName = localData.grupo || firstName;

  // --- CONFIGURAÇÃO VISUAL DE TIERS (REFINADA) ---
  const visualConfig: any = {
    // 0 - 250 (Neutro)
    PENDING: { 
      borderColor: 'border-slate-200 border-dashed', 
      headerBg: 'bg-slate-50', 
      headerText: 'text-slate-400', 
      icon: <Clock size={16} />, 
      label: 'EM ANÁLISE',
      scoreBg: 'bg-slate-200 text-slate-500' 
    },
    // 0 - 250 (Bronze / Neutro)
    BRONZE: { 
      borderColor: 'border-slate-200', 
      headerBg: 'bg-slate-50', 
      headerText: 'text-slate-500', 
      icon: <Building2 size={16} />, 
      label: 'SMB / STANDARD', 
      scoreBg: 'bg-slate-200 text-slate-500 border border-slate-300'
    },
    // 251 - 500 (Prata / Corporate)
    PRATA: { 
      borderColor: 'border-slate-300', 
      headerBg: 'bg-slate-100', 
      headerText: 'text-slate-700', 
      icon: <Building2 size={16} />, 
      label: 'CORPORATE',
      scoreBg: 'bg-white text-slate-700 border border-slate-300 shadow-sm'
    },
    // 501 - 750 (Ouro / Key Account)
    OURO: { 
      borderColor: 'border-amber-400', 
      headerBg: 'bg-amber-400', 
      headerText: 'text-white', 
      icon: <Crown size={16} fill="currentColor" />, 
      label: 'KEY ACCOUNT',
      scoreBg: 'bg-white text-amber-600 border border-amber-200 shadow-sm'
    },
    // 751+ (Diamante / Premium)
    DIAMANTE: { 
      borderColor: 'border-blue-600', 
      headerBg: 'bg-blue-600', 
      headerText: 'text-white', 
      icon: <Crown size={16} fill="currentColor" />, 
      label: 'TOP 1% AGRO',
      scoreBg: 'bg-white text-blue-700 font-black shadow-sm border border-blue-200'
    },
  };

  const style = visualConfig[tierKey] || visualConfig.BRONZE;
  
  // Se for Corporate (Prata), o label já diz "CORPORATE".
  const displayLabel = style.label;

  const getCropBadge = () => {
    const details = pillars?.complexidade.details[0] || '';
    if (details.includes('Algodão')) return 'ALGODÃO';
    if (details.includes('Semente') || details.includes('Genética')) return 'SEMENTES';
    if (details.includes('Indústria')) return 'INDÚSTRIA';
    return 'GRÃOS';
  };

  return (
    <div className="relative pt-3 pb-1"> {/* Wrapper com padding top para o badge sobreposto */}
      
      {/* SELO "CORPORATE S.A." CENTRALIZADO (PRETO & DOURADO) */}
      {!isPending && lead.isSA && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <span className="bg-slate-900 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-slate-300/50 ring-2 ring-white">
            <Briefcase size={10} className="text-amber-400" /> CORPORATE S.A.
          </span>
        </div>
      )}

      <div className={`flex flex-col rounded-xl border-2 bg-white transition-all duration-500 hover:shadow-xl ${style.borderColor} ${isPending ? 'opacity-70' : ''} relative overflow-visible`}>
        
        {/* Loading Overlay if auditing */}
        {isBeingAudited && (
          <div className="absolute inset-0 bg-white/50 z-30 flex items-center justify-center backdrop-blur-sm rounded-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* HEADER */}
        <div className={`px-4 py-3 flex justify-between items-center rounded-t-[9px] transition-colors duration-500 relative z-0 ${style.headerBg} ${tierKey === 'BRONZE' ? 'border-b border-slate-100' : ''}`}>
          <div className="flex flex-col items-start">
            <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${style.headerText}`}>
              {style.icon}
              {displayLabel}
            </div>
          </div>
          
          {/* SCORE BADGE */}
          {!isPending && (
            <div className={`px-2.5 py-1 rounded-[6px] leading-tight text-center min-w-[60px] ${style.scoreBg}`}>
              <span className="block text-[7px] font-bold uppercase opacity-70 tracking-tight mb-[1px]">SCORE</span>
              <span className="text-sm font-black tracking-tight">{totalScore}</span>
            </div>
          )}
        </div>

        {/* CORPO DO CARD */}
        <div className="p-5 flex flex-col gap-4">
          
          {/* Identificação */}
          <div className="relative">
            <h3 className="font-bold text-slate-800 text-lg leading-tight truncate uppercase tracking-tight" title={lead.companyName}>
              {lead.tradeName || lead.companyName}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
               <span className="text-[10px] text-slate-500 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-mono">
                  <FileText size={10} /> {lead.cnpj}
               </span>
            </div>
            
            {dataSource === 'IA_REAL' && (
               <span className="absolute top-0 right-0 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-[4px] text-[9px] font-bold flex items-center gap-1 animate-pulse">
                 <CheckCircle2 size={10} /> IA VERIFIED
               </span>
            )}
          </div>

          {/* Badges de Contexto */}
          {!isPending && (
            <div className="flex flex-wrap gap-2">
              {(currentStats.isGrupoEconomico || isHoldingName) && (
                <button 
                  onClick={(e) => { 
                      if(onFindPJs) { e.stopPropagation(); onFindPJs(lead); } 
                  }}
                  disabled={!onFindPJs}
                  className={`px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-[4px] text-[10px] font-bold uppercase flex items-center gap-1.5 ${onFindPJs ? 'hover:bg-blue-100 cursor-pointer' : ''}`}
                >
                  <Network size={10} /> GRUPO {groupName}
                </button>
              )}
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-[4px] text-[10px] font-bold uppercase flex items-center gap-1.5">
                <Sprout size={10} /> {getCropBadge()}
              </span>
              {(lead.cnaes?.[0]?.code?.startsWith('10') || lead.companyName.toUpperCase().includes('SEMENTE')) && (
                <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-[4px] text-[10px] font-bold uppercase flex items-center gap-1.5">
                  <Atom size={10} /> GENÉTICA/IND.
                </span>
              )}
            </div>
          )}

          {/* Grid Financeiro (Clean) */}
          <div className="grid grid-cols-2 gap-4 pb-2">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1 mb-1">
                <TrendingUp size={10} className="text-orange-500" /> FAT. TURBO
              </p>
              <p className="text-xl font-bold text-slate-700 tracking-tight">
                {isPending ? '---' : formatMoney(estimatedRevenue)}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1 mb-1">
                <Building2 size={10} className="text-slate-400" /> CAPITAL SOCIAL
              </p>
              <p className="text-base font-semibold text-slate-600 mt-0.5">
                {formatMoney(lead.capitalSocial || 0)}
              </p>
            </div>
          </div>

          {/* Ações e Botões */}
          <div className="space-y-2">
            <button 
              onClick={() => !isPending && onScout(currentStats)}
              disabled={isPending}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-[6px] shadow-sm transition-all border group ${
                isPending 
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-black uppercase group-hover:translate-x-1 transition-transform">
                <FileSearch size={14} />
                {isPending ? 'AGUARDANDO...' : 'ABRIR DOSSIÊ ESTRATÉGICO'}
              </div>
              {!isPending && (
                <span className="bg-emerald-200/60 px-2 py-0.5 rounded text-[9px] font-bold text-emerald-900">Deep Dive</span>
              )}
            </button>

            {/* GAVETA DETALHES */}
            {!isPending && (
              <div className="mt-2">
                <button 
                  onClick={handleToggleDetails}
                  className={`w-full py-2 border text-[10px] font-bold uppercase rounded-[6px] transition-colors flex items-center justify-center gap-1 ${
                    showDetails ? 'bg-slate-50 border-slate-300 text-slate-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {enrichStep > 0 && enrichStep < 3 ? <Server size={12} className="animate-pulse" /> : <FileText size={12} />} 
                  {showDetails ? 'FECHAR GAVETA' : 'INVESTIGAR DADOS REAIS'}
                  {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                
                {showDetails && (
                  <div className="mt-2 bg-slate-50 rounded border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 relative">
                     {enrichStep === 3 && (
                      <div className="p-3">
                        {localData.socios && localData.socios.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[8px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Users size={8}/> QUADRO SOCIETÁRIO</p>
                            <div className="flex flex-wrap gap-1">
                              {localData.socios.slice(0, 4).map((s,i) => (
                                <span key={i} className="bg-white border border-slate-200 px-2 py-1 rounded text-[9px] font-bold text-slate-700 shadow-sm flex items-center gap-1">
                                  👤 {s}
                                </span>
                              ))}
                              {localData.socios.length > 4 && (
                                <span className="text-[9px] text-slate-400 px-1 py-1">+{localData.socios.length - 4} outros</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                           <div className="bg-white p-2 border border-slate-100 rounded shadow-sm">
                              <p className="text-[8px] text-slate-400 font-bold flex items-center gap-1"><Users size={8}/> VÍNCULOS</p>
                              <p className="font-bold text-indigo-700 text-sm">{currentStats.numFuncionarios || 'N/D'}</p>
                           </div>
                           <div className="bg-white p-2 border border-slate-100 rounded shadow-sm">
                              <p className="text-[8px] text-slate-400 font-bold flex items-center gap-1"><Map size={8}/> ÁREA (HA)</p>
                              <p className="font-bold text-indigo-700 text-sm">{displayHectares > 0 ? `${displayHectares} ha` : 'N/D'}</p>
                           </div>
                        </div>
                        <div className="mt-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                          <p className="text-[9px] text-indigo-800 leading-relaxed">
                            <strong>SARA INSIGHT:</strong> {localData.log || "Dados processados."}
                          </p>
                        </div>
                        {/* Links Rápidos */}
                        <div className="flex gap-2 justify-end mt-2">
                          <button className="text-[9px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200">
                            <Globe size={9} /> LinkedIn
                          </button>
                          <button className="text-[9px] font-bold text-slate-400 hover:text-green-600 flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200">
                            <MapPin size={9} /> Maps
                          </button>
                        </div>
                      </div>
                     )}
                     
                     {enrichStep === 0 && (
                        <div className="p-4 text-center">
                           <p className="text-[10px] text-slate-500 mb-2">Clique para mapear Sócios e Grupo Econômico.</p>
                        </div>
                     )}

                     {/* Loading State Overlay for Drawer */}
                     {enrichStep > 0 && enrichStep < 3 && (
                      <div className="p-4 flex flex-col gap-3 justify-center min-h-[140px] bg-slate-50">
                         <div className="flex items-center gap-2 text-slate-600 transition-all duration-300">
                           {enrichStep === 1 ? <Server size={14} className="animate-pulse text-indigo-600" /> : <CheckCircle2 size={14} className="text-green-500" />}
                           <span className={`text-[10px] font-bold ${enrichStep === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
                             Mapeando Sócios & Grupo Econômico...
                           </span>
                         </div>
                         <div className={`flex items-center gap-2 text-slate-600 transition-all duration-300 ${enrichStep < 2 ? 'opacity-30' : 'opacity-100'}`}>
                           {enrichStep === 2 ? <Satellite size={14} className="animate-pulse text-indigo-600" /> : <CheckCircle2 size={14} className="text-green-500" />}
                           <span className={`text-[10px] font-bold ${enrichStep === 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
                             Cruzando Dados de Satélite & CAR...
                           </span>
                         </div>
                         <div className="w-full bg-slate-200 h-1 mt-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full animate-pulse"></div>
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BARRAS DE PROGRESSO DO RODAPÉ (4 PILARES) */}
            {!isPending && pillars && !showDetails && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex gap-1.5 mb-1 h-1.5">
                   <div className="flex-1 bg-slate-100 rounded-full overflow-hidden" title={`Músculo: ${pillars.musculo.score}/250 pts`}><div className="h-full bg-blue-600" style={{ width: `${(pillars.musculo.score / 250) * 100}%` }}></div></div>
                   <div className="flex-1 bg-slate-100 rounded-full overflow-hidden" title={`Complexidade: ${pillars.complexidade.score}/250 pts`}><div className="h-full bg-purple-600" style={{ width: `${(pillars.complexidade.score / 250) * 100}%` }}></div></div>
                   <div className="flex-1 bg-slate-100 rounded-full overflow-hidden" title={`Gente: ${pillars.gente.score}/250 pts`}><div className="h-full bg-pink-600" style={{ width: `${(pillars.gente.score / 250) * 100}%` }}></div></div>
                   <div className="flex-1 bg-slate-100 rounded-full overflow-hidden" title={`Momento: ${pillars.momento.score}/250 pts`}><div className="h-full bg-emerald-500" style={{ width: `${(pillars.momento.score / 250) * 100}%` }}></div></div>
                </div>
                <div className="flex justify-between text-[7px] font-black text-slate-300 uppercase px-1 tracking-tighter">
                  <span className="text-blue-600">MÚSC</span><span className="text-purple-600">CPLX</span><span className="text-pink-600">GENTE</span><span className="text-emerald-600">MOMT</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Modal de Detalhes */}
        {showModal && <CompanyDetailsModal lead={lead} onClose={() => setShowModal(false)} />}
      </div>
    </div>
  );
};