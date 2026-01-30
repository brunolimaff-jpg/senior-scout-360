
import React, { useEffect, useState } from 'react';
import { ProspectLead } from '../types';
import { generateFlashBriefing } from '../services/geminiService';
import { fetchCnpjData } from '../services/apiService';
import { X, Building2, MapPin, Calendar, Activity, Users, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  lead: ProspectLead;
  onClose: () => void;
}

export const CompanyDetailsModal: React.FC<Props> = ({ lead, onClose }) => {
  const [briefing, setBriefing] = useState<string>('');
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // 1. Gera Briefing via Gemini Flash
    const loadBriefing = async () => {
      setLoadingBriefing(true);
      try {
        const text = await generateFlashBriefing(lead);
        if (isMounted) setBriefing(text);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoadingBriefing(false);
      }
    };

    // 2. Busca dados complementares (Sócios/Endereço) se não estiverem completos
    const loadData = async () => {
      setLoadingData(true);
      try {
        const cnpjClean = lead.cnpj.replace(/\D/g, '');
        if (cnpjClean.length === 14) {
            const data = await fetchCnpjData(cnpjClean);
            if (isMounted && data) setEnrichedData(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadBriefing();
    loadData();

    return () => { isMounted = false; };
  }, [lead]);

  // Formata moeda
  const formatMoney = (val?: number) => 
    val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        
        {/* HEADER */}
        <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-start">
          <div className="flex gap-3">
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
               <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">{lead.companyName}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <span className="font-mono bg-slate-100 px-1.5 rounded">{lead.cnpj}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><MapPin size={12}/> {lead.city}/{lead.uf}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUNA ESQUERDA: IA BRIEFING */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card de Inteligência (Flash Briefing) */}
              <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-indigo-600" />
                   <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Briefing Executivo (Sara AI)</h3>
                </div>
                <div className="p-5">
                  {loadingBriefing ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-2 bg-slate-100 rounded w-3/4"></div>
                      <div className="h-2 bg-slate-100 rounded w-full"></div>
                      <div className="h-2 bg-slate-100 rounded w-5/6"></div>
                      <div className="h-2 bg-slate-100 rounded w-2/3"></div>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-indigo text-slate-600 max-w-none">
                      <ReactMarkdown>{briefing}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              {/* Matriz de Complexidade (Visualização do Score) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                 <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600"/> Matriz de Complexidade (ICO)
                 </h3>
                 
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Capital Social</span>
                       <span className="text-sm font-bold text-slate-700">{formatMoney(lead.capitalSocial)}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Faturamento Est.</span>
                       <span className={`text-sm font-bold ${lead.estimatedRevenue ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {formatMoney(lead.estimatedRevenue || 0)}
                       </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Score ICO</span>
                       <span className="text-sm font-bold text-amber-600">{lead.tacticalAnalysis?.operationalComplexity || 0} pts</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Perfil Venda</span>
                       <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded inline-block">
                          {lead.tacticalAnalysis?.salesComplexity || 'N/D'}
                       </span>
                    </div>
                 </div>

                 {/* Badges Explicativos */}
                 <div className="mt-4 flex flex-wrap gap-2">
                    {lead.tacticalAnalysis?.badges.map((b, i) => (
                       <span key={i} className="text-[10px] px-2 py-1 rounded border bg-white text-slate-600 border-slate-200 font-medium">{b}</span>
                    ))}
                 </div>
              </div>

            </div>

            {/* COLUNA DIREITA: DADOS ESTRUTURAIS */}
            <div className="space-y-6">
               
               {/* Dados Cadastrais */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Dados Cadastrais</h3>
                  <ul className="space-y-3 text-sm">
                     <li>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Natureza Jurídica</span>
                        <span className="text-slate-700 font-medium">{enrichedData?.natureza_juridica || (lead.isSA ? "Sociedade Anônima" : "Ltda/Outros")}</span>
                     </li>
                     <li>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Atividade Principal</span>
                        <span className="text-slate-700 font-medium text-xs">{lead.cnaes?.[0]?.description || enrichedData?.cnae_fiscal_descricao}</span>
                     </li>
                     <li>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Situação</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           {lead.status === 'ATIVO' ? <ShieldCheck className="w-3.5 h-3.5 text-green-500"/> : <AlertTriangle className="w-3.5 h-3.5 text-red-500"/>}
                           <span className="text-slate-700 font-bold">{lead.status || 'Ativa'}</span>
                        </div>
                     </li>
                  </ul>
               </div>

               {/* Quadro Societário */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                     <Users size={14} /> Quadro Societário
                  </h3>
                  
                  {loadingData ? (
                     <div className="space-y-2 animate-pulse">
                        <div className="h-8 bg-slate-50 rounded"></div>
                        <div className="h-8 bg-slate-50 rounded"></div>
                     </div>
                  ) : enrichedData?.qsa && enrichedData.qsa.length > 0 ? (
                     <ul className="space-y-2">
                        {enrichedData.qsa.slice(0, 5).map((socio: any, idx: number) => (
                           <li key={idx} className="bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="text-xs font-bold text-slate-700">{socio.nome_socio_razao_social || socio.nome}</div>
                              <div className="text-[10px] text-slate-500">{socio.qualificacao_socio_completa || socio.qualificacao}</div>
                           </li>
                        ))}
                        {enrichedData.qsa.length > 5 && (
                           <li className="text-center text-[10px] text-slate-400 italic pt-1">
                              + {enrichedData.qsa.length - 5} sócios não listados
                           </li>
                        )}
                     </ul>
                  ) : (
                     <div className="text-center py-4 text-slate-400 text-xs italic">
                        Nenhum sócio identificado na base pública.
                     </div>
                  )}
               </div>

            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
           <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition">Fechar</button>
        </div>

      </div>
    </div>
  );
};
