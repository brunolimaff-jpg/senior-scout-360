
import React from 'react';
import { 
  Building2, MapPin, TrendingUp, ScanSearch, 
  Crown, DollarSign, BrainCircuit, Users, Target, Activity
} from 'lucide-react';
import { ProspectLead } from '../types';

interface LeadCardProps {
  lead: ProspectLead;
  onAction: () => void; // Ação única: Mapear Conta
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onAction }) => {
  
  // 1. Definição de ELITE (Regra de Negócio Visual)
  const isElite = (lead.capitalSocial || 0) > 10000000 || (lead.metadata?.hectaresTotal || 0) > 5000;
  
  // 2. Formatação Financeira
  const formatCurrency = (val?: number) => {
    if (!val) return 'N/D';
    if (val >= 1000000000) return `R$ ${(val / 1000000000).toFixed(1)} Bi`;
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)} MM`;
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)} K`;
    return `R$ ${val.toFixed(2)}`;
  };

  // 3. Simulação Visual SAS 4.0 (Barras de Progresso)
  const cap = lead.capitalSocial || 0;
  
  // Músculo: Capital ou Hectares
  let scoreMusculo = 30;
  if (cap > 20000000) scoreMusculo = 100;
  else if (cap > 5000000) scoreMusculo = 75;
  else if (cap > 1000000) scoreMusculo = 50;

  // Complexidade: Atividade (Indústria/Semente > Grãos > Pecuária)
  const isInd = lead.cnaes?.some(c => c.description.includes('INDUSTRIA') || c.description.includes('SEMENTE'));
  const scoreComplex = isInd ? 90 : 50;

  // Gente: Estimativa baseada em Capital (Proxy)
  const estFunc = Math.ceil(cap / 300000); 
  const scoreGente = Math.min(100, Math.max(20, (estFunc / 50) * 100));

  // Momento: S.A. ou Digital
  const scoreMomento = lead.isSA ? 100 : 40;

  return (
    <div className={`group relative bg-white rounded-xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden flex flex-col ${isElite ? 'border-amber-200 shadow-amber-50/50' : 'border-slate-200 shadow-sm'}`}>
      
      {/* ELITE GLOW HEADER */}
      {isElite && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500"></div>
      )}

      {/* BODY CONTENT */}
      <div className="p-5 flex-1 flex flex-col">
        
        {/* HEADER: NOME & SCORE */}
        <div className="flex justify-between items-start mb-3">
           <div className="flex-1 min-w-0 pr-3">
              <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none truncate flex items-center gap-2 group-hover:text-emerald-700 transition-colors">
                {lead.companyName}
                {isElite && <Crown size={16} className="text-amber-500 fill-amber-100 flex-shrink-0" />}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                 <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                    <Building2 size={10} /> {lead.cnpj || 'CPF/PENDENTE'}
                 </div>
                 <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                    <MapPin size={10} /> {lead.city}/{lead.uf}
                 </div>
              </div>
           </div>

           {/* SCORE BOX */}
           <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-2 min-w-[60px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">SAS</span>
              <span className={`text-lg font-black leading-none ${isElite ? 'text-amber-600' : 'text-slate-700'}`}>
                {lead.score || 50}
              </span>
           </div>
        </div>

        {/* BADGES ROW */}
        <div className="flex flex-wrap gap-2 mb-5">
           {isElite && (
             <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase border border-amber-200 flex items-center gap-1">
               <Crown size={10} className="fill-amber-600"/> TOP 1% AGRO
             </span>
           )}
           {lead.cnaes?.some(c => c.description.includes('SOJA') || c.description.includes('CEREAIS')) && (
             <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase border border-emerald-100">🌱 Produtor</span>
           )}
           {lead.isSA && (
             <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase border border-blue-100">🏢 S.A.</span>
           )}
        </div>

        {/* PAINEL FINANCEIRO (MÚSCULO) */}
        <div className="grid grid-cols-2 gap-4 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
           <div className="flex flex-col justify-center">
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                 <TrendingUp size={10} /> Faturamento Est.
              </span>
              <span className="text-lg font-black text-emerald-800 tracking-tight">
                 {formatCurrency(lead.estimatedRevenue)}
              </span>
           </div>
           <div className="flex flex-col justify-center border-l border-slate-200 pl-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                 <DollarSign size={10} /> Capital Social
              </span>
              <span className="text-sm font-bold text-slate-600">
                 {formatCurrency(lead.capitalSocial)}
              </span>
           </div>
        </div>

        {/* ACTION BUTTON (BOTTOM ALIGNED) */}
        <div className="mt-auto">
           <button 
             onClick={onAction}
             className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-sm hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
           >
             <ScanSearch size={16} /> Mapear Conta & Dossiê
           </button>
        </div>

      </div>

      {/* FOOTER: SAS 4.0 BARS */}
      <div className="grid grid-cols-4 border-t border-slate-100 h-10 divide-x divide-slate-100 bg-slate-50">
         {/* Músculo */}
         <div className="flex flex-col items-center justify-center p-1 group/bar" title={`Músculo: ${scoreMusculo}%`}>
            <div className="flex items-center gap-1 mb-1">
               <Activity size={10} className="text-emerald-500" />
               <span className="text-[8px] font-bold text-slate-400 uppercase">Músculo</span>
            </div>
            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
               <div style={{width: `${scoreMusculo}%`}} className="h-full bg-emerald-500 rounded-full"></div>
            </div>
         </div>

         {/* Complexidade */}
         <div className="flex flex-col items-center justify-center p-1 group/bar" title={`Complexidade: ${scoreComplex}%`}>
            <div className="flex items-center gap-1 mb-1">
               <BrainCircuit size={10} className="text-amber-500" />
               <span className="text-[8px] font-bold text-slate-400 uppercase">Complex.</span>
            </div>
            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
               <div style={{width: `${scoreComplex}%`}} className="h-full bg-amber-500 rounded-full"></div>
            </div>
         </div>

         {/* Gente */}
         <div className="flex flex-col items-center justify-center p-1 group/bar" title={`Gente: ${scoreGente}%`}>
            <div className="flex items-center gap-1 mb-1">
               <Users size={10} className="text-blue-500" />
               <span className="text-[8px] font-bold text-slate-400 uppercase">Gente</span>
            </div>
            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
               <div style={{width: `${scoreGente}%`}} className="h-full bg-blue-500 rounded-full"></div>
            </div>
         </div>

         {/* Momento */}
         <div className="flex flex-col items-center justify-center p-1 group/bar" title={`Momento: ${scoreMomento}%`}>
            <div className="flex items-center gap-1 mb-1">
               <Target size={10} className="text-purple-500" />
               <span className="text-[8px] font-bold text-slate-400 uppercase">Momento</span>
            </div>
            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
               <div style={{width: `${scoreMomento}%`}} className="h-full bg-purple-500 rounded-full"></div>
            </div>
         </div>
      </div>

    </div>
  );
};
