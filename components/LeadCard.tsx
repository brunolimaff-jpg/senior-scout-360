
import React, { useMemo, useState } from 'react';
import { ProspectLead, NetworkNode } from '../types';
import { analyzeLeadIntelligence } from '../services/intelligenceService';
import { 
  Building2, TrendingUp, Sprout, Crown, Clock, 
  FileText, Network, ChevronDown, ChevronUp, Users, 
  CheckCircle2, Globe, MapPin, Search, Eye, Share2, 
  AlertTriangle, ShieldCheck, Briefcase, FileSearch,
  Loader2, UserSearch, PenSquare
} from 'lucide-react';
import { CompanyDetailsModal } from './modals';
import { PFDetailsModal } from './modals/PFDetailsModal';
import { RelationshipWeb } from './RelationshipWeb';

interface LeadCardProps {
  lead: ProspectLead;
  onScout: (lead: ProspectLead) => void;
  onFindPJs?: (lead: ProspectLead) => void;
  onIndividualAudit?: (leadId: string) => void;
  isBeingAudited?: boolean;
  onUpdate?: (lead: ProspectLead) => void;
  onSave?: (lead: ProspectLead) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, onScout, onFindPJs, isBeingAudited, onUpdate }) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPFModal, setShowPFModal] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);

  const isPending = lead.status === 'pending' || !lead.isValidated;
  
  const intelligence = useMemo(() => {
    if (isPending && !lead.isPF) return null;
    return analyzeLeadIntelligence(lead);
  }, [lead, isPending]);

  const totalScore = intelligence?.totalScore || 0;
  let tierKey = 'BRONZE';
  if (totalScore > 750) tierKey = 'DIAMANTE';
  else if (totalScore > 500) tierKey = 'OURO';
  else if (totalScore > 250) tierKey = 'PRATA';

  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(val);

  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    const clean = cpf.replace(/\D/g, '');
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleManualCPF = () => {
    const cpf = prompt(`Digite o CPF real de ${lead.companyName}:`);
    if (cpf) {
        // Validação simples de formato
        const clean = cpf.replace(/\D/g, '');
        if (clean.length === 11) {
            if (onUpdate) {
                onUpdate({ 
                    ...lead, 
                    cpf: clean, 
                    cpfStatus: 'MANUAL',
                    isValidated: true // Assume validação manual
                });
            }
        } else {
            alert("CPF inválido. Deve conter 11 dígitos.");
        }
    }
  };

  const visualConfig: any = {
    PENDING: { borderColor: 'border-slate-200 border-dashed', headerBg: 'bg-slate-50', headerText: 'text-slate-400', label: 'EM ANÁLISE' },
    BRONZE: { borderColor: 'border-slate-200', headerBg: 'bg-slate-50', headerText: 'text-slate-500', label: 'STANDARD' },
    PRATA: { borderColor: 'border-slate-300', headerBg: 'bg-slate-100', headerText: 'text-slate-700', label: 'CORPORATE' },
    OURO: { borderColor: 'border-amber-400', headerBg: 'bg-amber-400', headerText: 'text-white', label: 'KEY ACCOUNT' },
    DIAMANTE: { borderColor: 'border-blue-600', headerBg: 'bg-blue-600', headerText: 'text-white', label: 'TOP 1% AGRO' },
  };

  const style = visualConfig[tierKey] || visualConfig.BRONZE;

  return (
    <div className="relative pt-2">
      {lead.isPF && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <span className="bg-teal-600 text-white px-3 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 shadow-lg shadow-teal-100">
            <Users size={10} /> PRODUTOR PF
          </span>
        </div>
      )}

      <div className={`flex flex-col rounded-3xl border-2 bg-white transition-all duration-500 hover:shadow-xl ${style.borderColor} ${isBeingAudited ? 'opacity-50' : ''}`}>
        
        {isBeingAudited && (
          <div className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-[1px] rounded-3xl">
              <Loader2 className="animate-spin text-teal-600" size={32} />
          </div>
        )}

        <div className={`px-4 py-2 flex justify-between items-center rounded-t-[22px] ${style.headerBg}`}>
          <span className={`text-[10px] font-black uppercase tracking-widest ${style.headerText}`}>{style.label}</span>
          {!isPending && (
             <div className="text-right">
                <span className="text-[8px] font-bold text-slate-400 block -mb-1">SCORE</span>
                <span className="text-sm font-black text-slate-700">{totalScore}</span>
             </div>
          )}
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <h3 className="font-black text-slate-800 text-sm leading-tight uppercase truncate">{lead.companyName}</h3>
            
            {/* PF / PJ INFO LINE */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
               {lead.isPF ? (
                 lead.cpf ? (
                   <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-sm flex items-center gap-1">
                     CPF: {formatCPF(lead.cpf)}
                     {lead.cpfStatus === 'MANUAL' && <PenSquare size={8} className="opacity-70"/>}
                   </span>
                 ) : (
                   <button 
                     onClick={handleManualCPF}
                     className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                   >
                     ⚠️ CPF PENDENTE <PenSquare size={10}/>
                   </button>
                 )
               ) : (
                 <span className="text-[9px] text-slate-400 font-mono bg-slate-50 px-1 rounded border border-slate-100">
                   {lead.cnpj}
                 </span>
               )}
               <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-bold uppercase"><MapPin size={8}/> {lead.city}/{lead.uf}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
               <span className="text-[8px] font-bold text-slate-400 uppercase block">Porte Est.</span>
               <span className="text-xs font-black text-slate-700">{lead.metadata?.hectaresTotal ? `${lead.metadata.hectaresTotal.toLocaleString('pt-BR')} ha` : 'Auditando...'}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
               <span className="text-[8px] font-bold text-slate-400 uppercase block">Certeza IA</span>
               <span className="text-xs font-black text-indigo-600">{lead.confidence}%</span>
            </div>
          </div>

          <div className="space-y-2">
            {lead.isPF ? (
               <button
                 onClick={() => setShowPFModal(true)}
                 disabled={!lead.cpf}
                 className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
                 title={!lead.cpf ? "Necessário inserir CPF" : ""}
               >
                 <UserSearch size={14} /> Investigar Produtor PF
               </button>
            ) : (
              <button
                onClick={() => setShowDetailsModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
              >
                <Eye size={14} /> Investigar Dados Reais
              </button>
            )}

            {lead.cnpj && lead.cnpj !== 'PF CANDIDATO' && (
              <button
                onClick={() => setShowNetwork(!showNetwork)}
                className={`w-full flex items-center justify-center gap-2 py-2 border rounded-xl text-[10px] font-black uppercase transition-all ${showNetwork ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Network size={14} /> {showNetwork ? 'Ocultar Rede' : 'Consultar Sócios/Grupo'}
              </button>
            )}
          </div>

          {showNetwork && (
            <div className="mt-2 animate-in fade-in zoom-in-95">
              <RelationshipWeb 
                rootData={{ name: lead.companyName, cnpj: lead.cnpj }} 
                nodes={networkNodes} 
                onNodesChange={setNetworkNodes} 
              />
            </div>
          )}
        </div>
      </div>

      <CompanyDetailsModal lead={lead} isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} />
      <PFDetailsModal lead={lead} isOpen={showPFModal} onClose={() => setShowPFModal(false)} />
    </div>
  );
};
