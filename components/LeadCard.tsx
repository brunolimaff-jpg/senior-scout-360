
import React from 'react';
import { ProspectLead } from '../types';
import { ExternalLink, FileText, Map, Database, Info, FileSpreadsheet, File, ShieldCheck, Building2, TrendingUp, Target, DollarSign, Lightbulb, Share2, FolderPlus, Crown, AlertTriangle, Network, Eye } from 'lucide-react';

interface Props {
  lead: ProspectLead;
  onSave?: (l: ProspectLead) => void;
  onDeepDive?: (l: ProspectLead) => void; // Agora abre o Modal
  onIndividualAudit?: (leadId: string) => void;
  onFindPJs?: (lead: ProspectLead) => void; // Busca de Grupo
  isBeingAudited?: boolean;
}

const LeadCard: React.FC<Props> = ({ lead, onDeepDive, onFindPJs }) => {
  // --- 1. DETECÇÃO DE TIPO E ESTADO ---
  const isPF = lead.businessType === 'Produtor Rural (PF)' || lead.id.startsWith('pf-');
  const isError = lead.status === 'ERRO_CONEXAO' || lead.status === 'ERRO_AUDITORIA';
  
  // Detecta se é dado Offline (Fallback do CSV)
  const isOfflineData = !lead.isValidated && lead.status !== 'ERRO_CONEXAO';

  // Helpers
  const formatMoney = (val: number) => {
    if (!val) return 'R$ 0';
    if (val >= 1000000000) return `R$ ${(val / 1000000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Bi`;
    if (val >= 1000000) return `R$ ${(val / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MM`;
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getFileIcon = (format: string) => {
    if (format.includes('XLS') || format.includes('CSV')) return <FileSpreadsheet size={10} />;
    if (format.includes('PDF')) return <FileText size={10} />;
    return <File size={10} />;
  };

  // --- DADOS PF ---
  const totalHectares = lead.metadata?.hectaresTotal || 0;
  const evidenceCount = lead.metadata?.fontes?.length || 0;
  const formattedArea = totalHectares.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const [integerPart, decimalPart] = formattedArea.split(',');
  const isUltraVerified = isPF && evidenceCount >= 3;

  // --- DADOS PJ ---
  const score = lead.score || lead.confidence || 0;
  const complexityScore = lead.tacticalAnalysis?.operationalComplexity ?? score;
  
  const badges = lead.tacticalAnalysis?.badges || [];
  const isTop1Percent = badges.includes('TOP 1% AGRO');
  const isCorporate = badges.includes('CORPORATE') || badges.includes('CORPORATE S/A');
  const hasCorporateDomain = !!lead.corporateDomain;

  return (
    <div className={`
      bg-white border rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full animate-in zoom-in-95 duration-300 relative group
      ${isTop1Percent ? 'border-amber-400 ring-2 ring-amber-100' : isCorporate ? 'border-blue-300 ring-1 ring-blue-50' : 'border-slate-200'}
    `}>
      
      {/* --- BANNER SUPERIOR (CONDICIONAL) --- */}
      {isPF && isUltraVerified && (
        <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-black uppercase text-center py-1 tracking-widest shadow-md z-10 flex items-center justify-center gap-1">
           <ShieldCheck size={10} /> Ultra-Verificado (Risco Zero)
        </div>
      )}
      
      {/* Banner para TOP 1% AGRO */}
      {!isPF && isTop1Percent && (
         <div className="absolute top-0 right-0 left-0 bg-slate-900 text-amber-400 text-[9px] font-black uppercase text-center py-1 tracking-widest shadow-md z-10 flex items-center justify-center gap-1">
            <Crown size={10} fill="currentColor" /> TOP 1% AGRO (Elite)
         </div>
      )}
      {!isPF && !isTop1Percent && isCorporate && (
         <div className="absolute top-0 right-0 left-0 bg-blue-800 text-white text-[9px] font-black uppercase text-center py-1 tracking-widest shadow-md z-10 flex items-center justify-center gap-1">
            <Building2 size={10} /> Corporate Account
         </div>
      )}

      {/* --- HEADER --- */}
      <div className={`p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start ${isUltraVerified || isTop1Percent || isCorporate ? 'pt-7' : ''}`}>
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-black text-slate-800 leading-tight uppercase tracking-tight truncate text-sm" title={lead.companyName}>
            {lead.companyName}
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1 flex items-center gap-1">
            <Database size={10} /> {lead.cnpj} • {lead.city}
          </p>
        </div>
        
        {/* SCORE BADGE */}
        {isPF ? (
            <div className={`px-2 py-1 rounded-lg text-center border shrink-0 ${score >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <p className="text-[8px] uppercase font-black leading-none italic">Confiança</p>
                <p className="text-sm font-black leading-none mt-0.5">{score}%</p>
            </div>
        ) : (
            <div className={`px-2 py-1 rounded-lg text-center border shrink-0 ${complexityScore > 500 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <p className="text-[8px] uppercase font-black leading-none italic tracking-tight">Complexidade</p>
                <p className="text-sm font-black leading-none mt-0.5">{complexityScore} <span className="text-[8px]">pts</span></p>
            </div>
        )}
      </div>

      {/* --- BARRA DE BADGES (CONDICIONAL) --- */}
      <div className="px-4 py-3 flex flex-wrap gap-1.5 bg-white min-h-[50px] content-start">
        {isPF ? (
            // BADGES DE FONTE (CPF)
            <>
                {(lead.metadata?.fontes || []).slice(0, 3).map((fonte, idx) => (
                <span key={`f-${idx}`} className="bg-slate-100 text-slate-700 text-[9px] px-2 py-1 rounded border border-slate-200 font-bold flex items-center gap-1 uppercase truncate max-w-[120px]">
                    <Info size={8} /> {fonte}
                </span>
                ))}
            </>
        ) : (
            // BADGES COMERCIAIS (CNPJ)
            <>
                {/* Badge de Domínio Corporativo em Destaque */}
                {hasCorporateDomain && (
                    <span className="text-[9px] px-2 py-1 rounded border font-black uppercase flex items-center gap-1 bg-blue-100 text-blue-800 border-blue-300 shadow-sm animate-pulse">
                        <Network size={10} /> GRUPO: {lead.corporateDomain}
                    </span>
                )}

                {badges.map((badge, idx) => {
                    if (badge.includes("GRUPO") && hasCorporateDomain) return null; // Evita duplicar

                    // Cores específicas para novos Badges
                    let colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                    if (badge.includes('LOGÍSTICA') || badge.includes('TRANSPORTE')) colorClass = 'bg-orange-50 text-orange-700 border-orange-200';
                    if (badge.includes('SEMENTES')) colorClass = 'bg-green-50 text-green-700 border-green-200';
                    if (badge.includes('SILOS')) colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (badge.includes('TOP 1%')) colorClass = 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-sm';
                    if (badge === 'BAIXADA') colorClass = 'bg-red-50 text-red-700 border-red-100';

                    return (
                    <span key={idx} className={`text-[9px] px-2 py-1 rounded border font-bold uppercase flex items-center gap-1 ${colorClass}`}>
                        {badge === 'TOP 1% AGRO' ? <Crown size={8} fill="currentColor"/> : badge.includes('BAIXADA') ? <AlertTriangle size={8}/> : null} {badge}
                    </span>
                )})}
                
                {badges.length === 0 && !hasCorporateDomain && <span className="text-[9px] text-slate-400 italic">Sem etiquetas táticas</span>}
            </>
        )}
      </div>

      {/* --- GRID DE MÉTRICAS (CONDICIONAL) --- */}
      <div className="px-4 py-3 grid grid-cols-2 gap-4 border-y border-slate-50 bg-slate-50/20">
        {isPF ? (
            // VISÃO FUNDIÁRIA (PF)
            <>
                <div className="border-r border-slate-100">
                    <p className="text-[9px] text-slate-400 uppercase font-black flex items-center gap-1 mb-1">
                        <Map size={10} className="text-emerald-600" /> Área Acumulada
                    </p>
                    <p className="text-lg font-black text-emerald-700 leading-none">
                        {integerPart}<span className="text-[12px] text-emerald-600/70">,{decimalPart}</span> <span className="text-[10px] font-bold text-slate-400">ha</span>
                    </p>
                </div>
                <div>
                    <p className="text-[9px] text-slate-400 uppercase font-black flex items-center gap-1 mb-1">
                        Documentos
                    </p>
                    <p className="text-lg font-black text-slate-700 leading-none">
                        {evidenceCount} <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">found</span>
                    </p>
                </div>
            </>
        ) : (
            // VISÃO FINANCEIRA TURBINADA (PJ)
            <>
                <div className="border-r border-slate-100 relative group/tooltip">
                    <p className="text-[9px] text-slate-400 uppercase font-black flex items-center gap-1 mb-1">
                        <TrendingUp size={10} className="text-indigo-600" /> Fat. Turbo (Est.)
                        {isOfflineData && <AlertTriangle size={10} className="text-amber-500 animate-pulse" />}
                    </p>
                    <p className={`text-sm font-black leading-none truncate ${isTop1Percent ? 'text-amber-600' : isError ? 'text-red-400' : 'text-indigo-700'}`}>
                        {isError ? 'Indisponível' : lead.estimatedRevenue ? formatMoney(lead.estimatedRevenue) : 'N/D'}
                    </p>
                    {/* Tooltip Nativo */}
                    {isOfflineData && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 text-white text-[9px] p-2 rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-50 pointer-events-none">
                            Dados extraídos da planilha original. Não foi possível validar online devido a instabilidade na Receita Federal.
                        </div>
                    )}
                </div>
                <div className="relative group/tooltip">
                    <p className="text-[9px] text-slate-400 uppercase font-black flex items-center gap-1 mb-1">
                        <DollarSign size={10} className="text-emerald-600" /> Capital Social
                        {isOfflineData && <AlertTriangle size={10} className="text-amber-500" />}
                    </p>
                    <p className="text-sm font-black text-slate-700 leading-none truncate">
                        {formatMoney(lead.capitalSocial || 0)}
                    </p>
                </div>
            </>
        )}
      </div>

      {/* --- CORPO PRINCIPAL (CONDICIONAL) --- */}
      <div className="p-4 flex-1 bg-white flex flex-col">
        {isPF ? (
            // LISTA DE AUDITORIA (PF)
            <>
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-1">
                    <FileText size={10} /> Auditoria de Fontes
                </h4>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[120px] custom-scrollbar">
                    {lead.metadata?.fontes?.map((fonte, idx) => (
                        <div key={idx} className="group/item relative p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                            <div className="flex justify-between items-start mb-1.5">
                                <span className="text-[9px] font-black text-slate-700 uppercase truncate pr-2">
                                    #{idx + 1} {fonte}
                                </span>
                                <a 
                                    href={lead.metadata?.urls[idx]}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 bg-white rounded border border-slate-200 text-slate-400 group-hover/item:text-blue-600 group-hover/item:border-blue-300 shadow-sm transition-all"
                                    title="Abrir Documento Original"
                                >
                                    <ExternalLink size={10} />
                                </a>
                            </div>
                            <p className="text-[10px] text-slate-500 italic leading-relaxed border-l-2 border-slate-200 pl-2 whitespace-normal break-words line-clamp-2 hover:line-clamp-none transition-all">
                                {lead.metadata?.contextos[idx] || "Evidência capturada via varredura automática."}
                            </p>
                        </div>
                    ))}
                    {(!lead.metadata?.fontes || lead.metadata.fontes.length === 0) && (
                        <div className="text-center py-4 text-[10px] text-slate-400 italic">
                            Nenhuma evidência pública indexada.
                        </div>
                    )}
                </div>
            </>
        ) : (
            // BOTÕES DE AÇÃO ESTRATÉGICA (PJ)
            <div className="flex flex-col h-full justify-between">
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-1">
                        <Lightbulb size={10} /> Ações Recomendadas
                    </h4>
                    {/* Botões de Alta Performance */}
                    <div className="space-y-2">
                        {/* Botão Especial de Busca de Grupo - AZUL SENIOR */}
                        {hasCorporateDomain ? (
                            <button 
                                onClick={() => onFindPJs?.(lead)} 
                                disabled={isError}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 rounded-lg flex items-center justify-between group transition-all shadow-md shadow-blue-200 disabled:opacity-50"
                            >
                                <span className="text-[10px] font-black uppercase flex items-center gap-2">
                                    <Network size={14} className="animate-pulse" /> Buscar Grupo {lead.corporateDomain}
                                </span>
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-bold text-white">Power User</span>
                            </button>
                        ) : (
                            <button 
                                onClick={() => onFindPJs?.(lead)} // Fallback para busca normal se não tiver domínio
                                disabled={isError}
                                className="w-full py-3 px-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-between group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-[10px] font-black uppercase flex items-center gap-2">
                                    <Share2 size={14} /> Mapear Grupo Econômico
                                </span>
                                <span className="bg-white px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm text-indigo-500 group-hover:text-indigo-700">+ Holdings</span>
                            </button>
                        )}

                        <button 
                            onClick={() => onDeepDive?.(lead)} // Abre o Modal
                            disabled={isError}
                            className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center justify-between group transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <span className="text-[10px] font-black uppercase flex items-center gap-2">
                                <Eye size={14} className="text-slate-400 group-hover:text-slate-600"/> Briefing de Vendas (IA)
                            </span>
                            <span className="bg-indigo-100 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm text-indigo-600 group-hover:text-indigo-700">Detalhes</span>
                        </button>
                    </div>
                </div>

                {/* Mini Breakdown Visual */}
                <div className="mt-4">
                    <div className="flex justify-between text-[8px] text-slate-400 font-mono mb-1 uppercase">
                        <span>Finan</span>
                        <span>Tech</span>
                        <span>Ops</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" title="Fit Financeiro">
                            <div className="h-full bg-emerald-500" style={{width: `${(lead.breakdown?.financial || 0) * 10}%`}}></div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" title="Maturidade Tech">
                            <div className="h-full bg-indigo-500" style={{width: `${(lead.breakdown?.techReadiness || 0) * 10}%`}}></div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" title="Complexidade">
                            <div className="h-full bg-purple-500" style={{width: `${(lead.breakdown?.operational || 0) * 10}%`}}></div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* --- FOOTER DE AÇÕES --- */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
        <button 
            onClick={() => onDeepDive?.(lead)}
            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <FileText size={12} /> {isPF ? 'Exportar' : 'Resumo'}
        </button>
        {isPF && (
            <button className="flex-1 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2">
            Abrir Mapa
            </button>
        )}
      </div>
    </div>
  );
};

export default LeadCard;
