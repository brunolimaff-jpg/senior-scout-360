
import React, { useMemo } from 'react';
import { 
  Building2, MapPin, Target, Network,
  TrendingUp, BrainCircuit, Users, Zap
} from 'lucide-react';
import { ProspectLead } from '../types';
import { calculateSeniorAgroScore, getTierColor, getTierEmoji } from '../services/marketEstimator';
import { formatCNPJ } from '../utils/formatCNPJ';

interface LeadCardProps {
  lead: ProspectLead;
  onAction: (lead: ProspectLead) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onAction }) => {
  
  // ========== MOTOR SAS 4.0 (On-the-fly Calculation se não persistido) ==========
  const sas = useMemo(() => {
    // Se já temos o resultado persistido, usamos
    if (lead.sasResult) return lead.sasResult;

    // Caso contrário, calculamos agora (Lazy Calc)
    return calculateSeniorAgroScore({
      razao_social: lead.companyName,
      capital_social: lead.capitalSocial || 0,
      hectares: lead.hectaresAudited || lead.hectaresEstimado || lead.hectares || 0,
      natureza_juridica: lead.naturezaJuridica || (lead.isSA ? 'S.A.' : 'Ltda'),
      cultura_principal: lead.cnae_principal || lead.cnaes?.[0]?.description || '',
      cnae_principal: lead.cnae_principal || lead.cnaes?.[0]?.code || '',
      funcionarios: lead.funcionarios || lead.numFuncionarios || 0,
      agroindustria: lead.agroindustria || lead.tacticalAnalysis?.badges?.includes('INDUSTRIA'),
      silos: lead.silos || lead.tacticalAnalysis?.badges?.includes('ARMAZEM'),
      logistica: lead.logistica || lead.tacticalAnalysis?.badges?.includes('FROTA'),
      dominio: lead.dominio || !!lead.website,
      vagas_ti: lead.vagas_ti,
      conectividade: lead.conectividade,
      cnpj: lead.cnpj
    });
  }, [lead]);

  const tierColor = getTierColor(sas.tier);
  const tierEmoji = getTierEmoji(sas.tier);

  // Helper para renderizar a barra de progresso de um pilar
  const renderPilar = (label: string, score: number, max: number, icon: React.ReactNode, colorClass: string, tooltip: string) => {
    const percent = Math.min(100, (score / max) * 100);
    return (
      <div className="flex flex-col gap-1.5" title={tooltip}>
        <div className="flex justify-between items-center text-xs">
          <span className={`font-bold flex items-center gap-1.5 ${colorClass}`}>
            {icon} {label}
          </span>
          <span className="font-mono font-bold text-slate-600 text-[10px]">{score}/{max}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`} 
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`
        bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 
        border border-slate-200 overflow-hidden flex flex-col h-full relative group
        hover:border-indigo-300 cursor-pointer
      `}
      onClick={() => onAction(lead)}
    >
      {/* Top Border Indicator (Tier Color) */}
      <div className={`h-1.5 w-full ${tierColor}`}></div>

      <div className="p-5 flex flex-col h-full">
        
        {/* HEADER: Identificação & Tier */}
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
               <h3 className="text-lg font-black text-slate-800 leading-tight truncate uppercase" title={lead.companyName}>
                 {lead.companyName}
               </h3>
               {lead.source === 'Senior MI' && <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 rounded border border-purple-200">MI</span>}
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                {lead.cnpj && (
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {formatCNPJ(lead.cnpj)}
                  </span>
                )}
                <span className="flex items-center gap-1 truncate max-w-[120px]">
                  <MapPin size={12} /> {lead.city}/{lead.uf}
                </span>
              </div>
              
              {/* Badges Rápidos (Flags) */}
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {sas.flags.big_fish && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[9px] font-bold uppercase tracking-wide">
                    🐋 Big Fish
                  </span>
                )}
                {sas.flags.s_a && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold uppercase tracking-wide">
                    🏢 S.A.
                  </span>
                )}
                {sas.flags.sementeiro && (
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded text-[9px] font-bold uppercase tracking-wide">
                    🌱 Sementeiro
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TIER BADGE (Score Visual) */}
          <div className={`
            flex flex-col items-center justify-center p-2 rounded-xl min-w-[70px] shadow-sm border
            ${tierColor.replace('bg-gradient-to-br', 'bg-opacity-10 bg-white border-opacity-20')}
            ${sas.tier === 'DIAMANTE' ? 'border-cyan-200 bg-cyan-50' : 
              sas.tier === 'OURO' ? 'border-amber-200 bg-amber-50' : 
              sas.tier === 'PRATA' ? 'border-slate-200 bg-slate-50' : 
              'border-orange-200 bg-orange-50'}
          `}>
             <div className="text-2xl drop-shadow-sm filter">{tierEmoji}</div>
             <div className="text-xl font-black text-slate-800 leading-none mt-1">{sas.sas_final}</div>
             <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">SAS 4.0</div>
          </div>
        </div>

        {/* BODY: Os 4 Pilares (Grid) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-6 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          
          {/* 1. Músculo */}
          {renderPilar(
            "Músculo", 
            sas.pilar_musculo, 
            400, 
            <TrendingUp size={12} />, 
            "text-blue-600",
            `Capacidade Financeira & Hectares (Score: ${sas.pilar_musculo}/400)`
          )}

          {/* 2. Complexidade */}
          {renderPilar(
            "Complex.", 
            sas.pilar_complexidade, 
            250, 
            <BrainCircuit size={12} />, 
            "text-purple-600",
            `Dificuldade Operacional & Verticalização (Score: ${sas.pilar_complexidade}/250)`
          )}

          {/* 3. Gente */}
          {renderPilar(
            "Gente", 
            sas.pilar_gente, 
            200, 
            <Users size={12} />, 
            "text-pink-600",
            `Estrutura de RH & Risco Trabalhista (Score: ${sas.pilar_gente}/200)`
          )}

          {/* 4. Momento */}
          {renderPilar(
            "Momento", 
            sas.pilar_momento, 
            150, 
            <Zap size={12} />, 
            "text-emerald-600",
            `Maturidade Digital & Governança (Score: ${sas.pilar_momento}/150)`
          )}

        </div>

        {/* FOOTER: Action Button */}
        <div className="mt-auto pt-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onAction(lead); }}
            className="
              w-full py-3 px-4 bg-slate-900 hover:bg-indigo-600 text-white 
              rounded-xl text-xs font-black uppercase tracking-widest 
              shadow-lg hover:shadow-indigo-200 transition-all duration-300
              flex items-center justify-center gap-2 group-hover:translate-y-0
            "
          >
            <Network size={16} className="text-white/80" /> 
            Mapear Conta & Dossiê
          </button>
        </div>

      </div>
    </div>
  );
};
