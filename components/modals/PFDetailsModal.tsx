
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Globe, ExternalLink, Building2, 
  Loader2, Network, Users, Zap, 
  XCircle, Database, AlertCircle, TrendingUp, RefreshCw,
  Coins, ListChecks, ArrowDownWideNarrow, BarChart3, Info,
  Activity, ShieldCheck, Map as MapIcon, Calculator, Menu, Search, MapPin
} from 'lucide-react';
import { ProspectLead, GroupCompany, SourceEvidence } from '../../types';
import { searchCompaniesByCPF } from '../../services/networkService';
import { fetchCnpjData } from '../../services/apiService';

interface PFDetailsModalProps {
  lead: ProspectLead;
  isOpen: boolean;
  onClose: () => void;
  onAddPJ?: (pj: ProspectLead) => void;
  addLog?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const PFDetailsModal: React.FC<PFDetailsModalProps> = ({ lead, isOpen, onClose, onAddPJ, addLog }) => {
  const [activeTab, setActiveTab] = useState<'EVIDENCES' | 'RELATIONSHIPS' | 'TRACE'>('RELATIONSHIPS');
  const [groupCompanies, setGroupCompanies] = useState<GroupCompany[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [magnitudeData, setMagnitudeData] = useState<{ revenue: number; capital: number } | null>(null);
  const [expandedCNPJ, setExpandedCNPJ] = useState<string | null>(null);

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const formatCNPJ = (cnpj: string) => {
    if (cnpj.includes('.')) return cnpj;
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    const clean = cpf.replace(/\D/g, '');
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Auto-Cálculo de Estimativa Unificada
  useEffect(() => {
    if (groupCompanies.length > 0) {
      // Heurística de Faturamento: Capital Social * Multiplicador
      // Multiplicador base = 3.5. Indústria/Sementes = 5.0. Transporte/Serviço = 2.5
      const totalCapital = groupCompanies.reduce((acc, c) => acc + (c.capitalSocial || 0), 0);
      
      const estimatedRevenue = groupCompanies.reduce((sum, c) => {
        let multiplier = 3.5;
        const atividade = (c.atividadePrincipal || "").toUpperCase();
        if (atividade.includes('INDÚSTRIA') || atividade.includes('SEMENTES')) multiplier = 5.0;
        if (atividade.includes('TRANSPORTE') || atividade.includes('SERVIÇOS')) multiplier = 2.5;
        return sum + (c.capitalSocial * multiplier);
      }, 0);

      setMagnitudeData({ capital: totalCapital, revenue: estimatedRevenue });
    }
  }, [groupCompanies]);

  // Top 3 Sócios Recorrentes
  const topSocios = useMemo(() => {
    const socioCount = new Map<string, number>();
    groupCompanies.forEach(c => 
      c.qsa?.forEach(s => {
        const name = s.nome.trim().toUpperCase();
        socioCount.set(name, (socioCount.get(name) || 0) + 1);
      })
    );
    
    // Filtra o próprio lead para mostrar apenas parceiros
    const leadNameUpper = lead.companyName.toUpperCase();
    
    return Array.from(socioCount.entries())
      .filter(([nome, count]) => count > 1 && !nome.includes(leadNameUpper))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [groupCompanies, lead.companyName]);

  const handleDiscoverGroup = async () => {
    setIsDiscovering(true);
    addLog?.('🔍 Iniciando Discovery de Grupo Econômico...', 'info');
    
    try {
      const companies = await searchCompaniesByCPF(lead.cpf || '00000000000'); 
      setGroupCompanies(companies);
      addLog?.(`✅ Grupo identificado: ${companies.length} empresas vinculadas.`, 'success');
    } catch (e) {
      console.error(e);
      addLog?.('❌ Erro no Discovery de Grupo.', 'error');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleRevalidateCNPJ = async (cnpj: string) => {
    addLog?.(`🔄 Revalidando ${cnpj} na Receita Federal...`, 'info');
    try {
      const clean = cnpj.replace(/\D/g, '');
      const updated = await fetchCnpjData(clean);
      if (updated) {
        setGroupCompanies(prev => prev.map(c => 
          c.cnpj.replace(/\D/g, '') === clean ? { 
            ...c, 
            capitalSocial: parseFloat(updated.capital_social || '0'),
            nome: updated.razao_social,
            status: 'VALIDADA',
            atividadePrincipal: updated.cnae_fiscal_descricao,
            qsa: updated.qsa.map((q: any) => ({ 
              nome: q.nome_socio || q.nome, 
              qualificacao: q.qualificacao_socio || q.qualificacao 
            }))
          } : c
        ));
        addLog?.(`✅ ${updated.razao_social} atualizada com sucesso.`, 'success');
      } else {
        addLog?.(`⚠️ CNPJ ${cnpj} não encontrado ou inativo.`, 'warning');
      }
    } catch (e) {
      addLog?.(`❌ Erro ao revalidar ${cnpj}.`, 'error');
    }
  };

  const toggleExpand = (cnpj: string) => {
    setExpandedCNPJ(expandedCNPJ === cnpj ? null : cnpj);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        
        {/* HEADER */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
           <div className="flex items-center gap-4">
              <div className="bg-teal-600 p-3 rounded-2xl text-white shadow-lg"><Users size={24} /></div>
              <div>
                 <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{lead.companyName}</h2>
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mt-1 uppercase">
                   <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">CPF: {formatCPF(lead.cpf)}</span>
                   <span className="flex items-center gap-1"><Globe size={12}/> {lead.city}/{lead.uf}</span>
                 </div>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
        </div>

        {/* TABS */}
        <div className="flex px-6 border-b border-slate-100 bg-white">
          <button onClick={() => setActiveTab('EVIDENCES')} className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'EVIDENCES' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Sinais Digitais</button>
          <button onClick={() => setActiveTab('RELATIONSHIPS')} className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'RELATIONSHIPS' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Grupo & Magnitude</button>
          <button onClick={() => setActiveTab('TRACE')} className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'TRACE' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Telemetria</button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          
          {activeTab === 'EVIDENCES' && (
            <div className="space-y-4">
               {lead.tacticalAnalysis?.rawEvidences?.map((ev: SourceEvidence, idx: number) => (
                 <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-300 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 uppercase tracking-widest">{ev.sourceName}</span>
                       <a href={ev.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-teal-600 transition-colors"><ExternalLink size={16} /></a>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">"{ev.snippet}"</p>
                 </div>
               ))}
            </div>
          )}

          {activeTab === 'RELATIONSHIPS' && (
            <div className="space-y-6">
              
              {groupCompanies.length === 0 ? (
                // ESTADO VAZIO (Initial State)
                <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="mx-auto w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6">
                     <Search size={40} className="text-teal-400 opacity-80" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase mb-2">Discovery de Grupo Econômico</h3>
                  <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm">
                    Nenhuma empresa mapeada ainda. O sistema irá varrer bases societárias buscando participações cruzadas pelo CPF.
                  </p>
                  <button 
                    onClick={handleDiscoverGroup} 
                    disabled={isDiscovering}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-4 rounded-xl hover:shadow-2xl transform hover:scale-105 transition-all font-bold flex items-center gap-3 mx-auto disabled:opacity-70 disabled:cursor-wait"
                  >
                    {isDiscovering ? <Loader2 className="animate-spin" size={20}/> : <Search size={20} />}
                    {isDiscovering ? 'MAPEANDO VÍNCULOS...' : '🔍 DESCOBRIR GRUPO ECONÔMICO'}
                  </button>
                </div>
              ) : (
                // ESTADO POPULADO (Results)
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  
                  {/* DASHBOARD ESCURO */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl mb-6 shadow-xl text-white border border-slate-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-white">
                      <div>
                        <label className="text-[10px] font-bold opacity-60 uppercase tracking-widest block mb-1">Faturamento Grupo (Est.)</label>
                        <div className="text-2xl font-black text-emerald-400">{formatCurrency(magnitudeData?.revenue || 0)}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold opacity-60 uppercase tracking-widest block mb-1">Capital Social Total</label>
                        <div className="text-xl font-black">{formatCurrency(magnitudeData?.capital || 0)}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold opacity-60 uppercase tracking-widest block mb-1">Empresas Validadas</label>
                        <div className="text-xl font-black">{groupCompanies.filter(c => c.status === 'VALIDADA').length} / {groupCompanies.length}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold opacity-60 uppercase tracking-widest block mb-1">Cobertura Estimativa</label>
                        <div className="text-xl font-black text-blue-400">{groupCompanies.length} CNPJs</div>
                      </div>
                    </div>
                  </div>

                  {/* INFO BANNER */}
                  <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl flex items-start gap-3">
                    <Info className="text-amber-500 mt-0.5 shrink-0" size={18} />
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      <strong>Discovery de Grupo Econômico:</strong> Mapeamento automático de holdings e participações vinculadas. 
                      Os valores apresentados são baseados em dados públicos oficiais e estimativas de mercado.
                    </p>
                  </div>

                  {/* WIDGET TOP SÓCIOS */}
                  {topSocios.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 rounded-2xl mb-6 text-white shadow-lg">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <Network size={20} className="text-white/80"/> Top 3 Sócios Recorrentes
                      </h3>
                      <div className="grid gap-2">
                        {topSocios.map(([nome, count], idx) => (
                          <div key={nome} className="bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center justify-between border border-white/10 hover:bg-white/30 transition-colors">
                            <span className="flex items-center gap-3">
                              <span className="bg-white text-purple-600 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">{idx+1}</span>
                              <span className="font-bold text-sm tracking-wide">{nome}</span>
                            </span>
                            <span className="bg-amber-400 text-purple-900 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                              {count} empresas
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <button className="flex-1 bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 font-bold text-xs uppercase tracking-widest shadow-md flex items-center justify-center gap-2 transition-all">
                      <MapIcon size={16} /> Mapear Grupo / Consulta Sócio
                    </button>
                  </div>

                  {/* LISTA DE EMPRESAS (ACCORDION) */}
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {groupCompanies.map(company => (
                      <div key={company.cnpj} className="bg-white border-2 border-slate-100 rounded-xl overflow-hidden hover:shadow-lg hover:border-teal-200 transition-all group">
                        
                        {/* Header do Card (Sempre Visível) */}
                        <div className="p-4 flex flex-col md:flex-row items-center justify-between cursor-pointer" onClick={() => toggleExpand(company.cnpj)}>
                          <div className="flex-1 min-w-0 mb-3 md:mb-0 w-full">
                            <div className="flex items-center gap-2 mb-1">
                               <div className="p-1.5 bg-teal-50 rounded-lg text-teal-600"><Building2 size={16}/></div>
                               <div className="font-black text-sm text-slate-800 uppercase truncate">{company.nome}</div>
                            </div>
                            <div className="flex items-center gap-3 pl-9">
                               <div className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 rounded">{formatCNPJ(company.cnpj)}</div>
                               <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  company.status === 'VALIDADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                               }`}>{company.status}</span>
                            </div>
                          </div>
                          
                          <div className="text-right flex items-center gap-4 w-full md:w-auto justify-between md:justify-end pl-9 md:pl-0">
                            <div>
                               <div className="text-[9px] font-bold text-slate-400 uppercase">Capital Social</div>
                               <div className="font-black text-sm text-slate-700">R$ {formatCurrency(company.capitalSocial)}</div>
                            </div>
                            <button className="bg-slate-100 text-slate-400 p-2 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
                               {expandedCNPJ === company.cnpj ? <ArrowDownWideNarrow size={16} className="rotate-180"/> : <Menu size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Detalhes Expansíveis */}
                        {expandedCNPJ === company.cnpj && (
                          <div className="bg-slate-50 border-t border-slate-100 p-6 space-y-4 animate-in slide-in-from-top-2">
                             
                             <div className="flex justify-between items-start">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Atividade Principal</label>
                                  <p className="text-sm font-medium text-slate-700">{company.atividadePrincipal || 'Não informado'}</p>
                                </div>
                                {company.status !== 'VALIDADA' && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleRevalidateCNPJ(company.cnpj); }}
                                     className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600 flex items-center gap-1 shadow-sm"
                                   >
                                     <RefreshCw size={12} /> Revalidar CNPJ
                                   </button>
                                )}
                             </div>

                             <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Endereço Registrado</label>
                                <p className="text-xs text-slate-600 flex items-center gap-1"><MapPin size={12} /> {company.endereco || 'Não informado'}</p>
                             </div>

                             <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Quadro Societário (QSA)</label>
                                <div className="space-y-2">
                                   {company.qsa && company.qsa.length > 0 ? (
                                      company.qsa.map((socio, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                                           <div>
                                              <span className="text-xs font-bold text-slate-700 block">{socio.nome}</span>
                                              <span className="text-[10px] text-slate-400">{socio.qualificacao}</span>
                                           </div>
                                           {socio.participacao && (
                                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                                {socio.participacao}%
                                              </span>
                                           )}
                                        </div>
                                      ))
                                   ) : (
                                      <p className="text-xs text-slate-400 italic">QSA não disponível na base pública.</p>
                                   )}
                                </div>
                             </div>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>
          )}

          {activeTab === 'TRACE' && (
            <div className="text-center py-20 text-slate-300 italic text-xs uppercase font-bold">Rastreabilidade da Caçada ativa.</div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
           <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Fechar</button>
           {groupCompanies.length > 0 && (
             <button className="bg-slate-900 text-white px-8 py-3 rounded-xl hover:bg-slate-800 font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
               <ShieldCheck size={16} /> Salvar Dossiê de Grupo
             </button>
           )}
        </div>

      </div>
    </div>
  );
};
