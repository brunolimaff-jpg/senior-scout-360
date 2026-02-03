// src/components/modals/CompanyDetailsModal.tsx

import React, { useState, useEffect } from 'react';
import { ProspectLead } from '../../types';
import { runBasicAudit } from '../../services/microservices/orchestrator';
import { 
  X, Building2, MapPin, Users, TrendingUp, Shield, 
  Loader2, Factory, Calendar, Briefcase,
  Award, AlertCircle, CheckCircle2, Clock, Sprout, Tractor, AlertTriangle, DollarSign
} from 'lucide-react';

interface CompanyDetailsModalProps {
  lead: ProspectLead;
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({
  lead,
  isOpen,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [cnpjData, setCnpjData] = useState<any>(null);
  const [corporateData, setCorporateData] = useState<any>(null);
  const [operationalData, setOperationalData] = useState<any>(null);
  const [organizationalData, setOrganizationalData] = useState<any>(null);
  const [networkData, setNetworkData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCompanyData(1);
    }
  }, [isOpen, lead.cnpj]);

  const loadCompanyData = async (attempt: number = 1) => {
    const maxAttempts = 5;
    
    if (attempt === 1) {
      setIsLoading(true);
      setError(null);
      setLogs([]);
      
      // Reset states
      setCnpjData(null);
      setCorporateData(null);
      setOperationalData(null);
      setOrganizationalData(null);
      setNetworkData(null);
      setRevenueData(null);
    }

    try {
      // Adicionar log de tentativa
      if (attempt > 1) {
        setLogs(prev => [...prev, `⟳ Tentativa ${attempt} de ${maxAttempts}...`]);
      }

      const result = await runBasicAudit(lead.cnpj, lead.companyName, {
        onProgress: (service, msg) => {
          const cleanMsg = msg.replace(/^\[.*?\]\s*/, '');
          setLogs(prev => [...prev, cleanMsg]);
        }
      });

      if (!result.success) {
        throw new Error(result.errors?.[0]?.error || 'Falha ao carregar dados');
      }

      // Extrair dados de cada micro-serviço
      const cnpjResult = result.results.get('cnpjValidator');
      const corpResult = result.results.get('corporateAnalyzer');
      const opResult = result.results.get('operationalIntelligence');
      const orgResult = result.results.get('organizationalIntelligence');
      const netResult = result.results.get('corporateNetwork');
      const revResult = result.results.get('revenueSearcher');

      if (cnpjResult?.data) setCnpjData(cnpjResult.data);
      if (corpResult?.data) setCorporateData(corpResult.data);
      if (opResult?.data) setOperationalData(opResult.data);
      if (orgResult?.data) setOrganizationalData(orgResult.data);
      if (netResult?.data) setNetworkData(netResult.data);
      if (revResult?.data) setRevenueData(revResult.data);

      setIsLoading(false);
      
    } catch (err: any) {
      console.error(`❌ Tentativa ${attempt} falhou:`, err);
      
      // Se não atingiu o máximo de tentativas, tentar novamente
      if (attempt < maxAttempts) {
        // Backoff exponencial: 1s, 2s, 4s, 8s, 16s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        const delaySec = delayMs / 1000;
        
        setLogs(prev => [...prev, `⚠️ Erro detectado. Aguardando ${delaySec}s para nova tentativa...`]);
        
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Tentar novamente (recursivo)
        return loadCompanyData(attempt + 1);
        
      } else {
        // Atingiu o máximo de tentativas - mostrar erro
        setLogs(prev => [...prev, `❌ Falha após ${maxAttempts} tentativas`]);
        setError(err.message || 'Não foi possível carregar os dados da empresa');
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <Building2 size={28} className="flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-2xl font-black uppercase tracking-tight truncate">
                    {cnpjData?.razaoSocial || lead.companyName}
                  </h2>
                  <div className="flex items-center gap-3 text-sm opacity-90 mt-1">
                    <span className="font-mono">{lead.cnpj}</span>
                    {cnpjData?.endereco && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {cnpjData.endereco.municipio}/{cnpjData.endereco.uf}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0 ml-4"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* CORPO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="relative mb-8">
                <Loader2 className="animate-spin text-indigo-600" size={64} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              <h3 className="text-xl font-black text-slate-800 mb-2">Investigando Dados Reais</h3>
              <p className="text-sm text-slate-500 mb-8">Consultando Receita Federal, BrasilAPI e Gemini AI...</p>

              {/* LOG LIMPO - SEM FUNDO PRETO */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 max-w-2xl w-full shadow-lg">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-300">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wide">Progresso da Análise</p>
                  </div>
                  
                  {/* Badge de Retry - só aparece quando está retrying */}
                  {logs.some(log => log.includes('Tentativa')) && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full border border-yellow-300">
                      Reconectando...
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {logs.slice(-8).map((log, idx) => {
                    return (
                      <div key={idx} className="flex items-start gap-2 py-1">
                        <span className="text-indigo-500 text-sm mt-0.5">•</span>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {log}
                        </p>
                      </div>
                    );
                  })}
                  
                  {logs.length === 0 && (
                    <p className="text-sm text-slate-400 italic">Aguardando início da análise...</p>
                  )}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="relative mb-6">
                <AlertCircle className="text-red-500" size={64} />
              </div>
              
              <h3 className="text-xl font-black text-red-600 mb-2">Não foi possível carregar os dados</h3>
              <p className="text-sm text-slate-600 text-center max-w-md mb-6">
                Tentamos 5 vezes com intervalos crescentes, mas não conseguimos conectar aos servidores.
                Isso pode ser um problema temporário de rede ou da BrasilAPI.
              </p>
              
              {/* Mostrar últimos logs */}
              {logs.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-2xl w-full mb-6">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-2">Últimas Atividades:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {logs.slice(-8).map((log, idx) => (
                      <p key={idx} className="text-xs text-slate-600 font-mono">
                        {log}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button 
                  onClick={() => loadCompanyData(1)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors shadow-lg"
                >
                  🔄 Tentar Novamente
                </button>
                <button 
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
              
              <p className="text-xs text-slate-400 mt-6">
                💡 Dica: Verifique sua conexão com a internet e tente novamente em alguns segundos.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* SEÇÃO 1: INFORMAÇÕES FINANCEIRAS */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-blue-600" size={24} />
                  <h3 className="text-lg font-black text-slate-800">Informações Financeiras</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Capital Social */}
                  <div className="bg-white rounded-lg p-5 border-2 border-blue-200 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-2 flex items-center gap-1">
                      <DollarSign size={12} />
                      Capital Social
                    </p>
                    <p className="text-2xl font-black text-slate-900 break-words">
                      {formatMoney(cnpjData?.capitalSocial || 0)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">✓ Receita Federal</p>
                  </div>

                  {/* Faturamento */}
                  <div className="bg-white rounded-lg p-5 border-2 border-blue-200 shadow-sm">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-2 flex items-center gap-1">
                      <TrendingUp size={12} />
                      Faturamento Anual
                    </p>
                    {revenueData ? (
                      !revenueData.isEstimated ? (
                        <>
                          <p className="text-2xl font-black text-green-600 break-words">
                            {formatMoney(revenueData.revenue)}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            <CheckCircle2 size={10} className="text-green-600" />
                            <p className="text-[10px] text-green-600">
                              Dado real ({revenueData.year})
                            </p>
                          </div>
                          {revenueData.source && (
                            <p className="text-[9px] text-green-500 mt-1 truncate" title={revenueData.source}>
                              📊 {revenueData.source}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-black text-orange-600 break-words">
                            {formatMoney(revenueData.revenue)}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            <AlertTriangle size={10} className="text-orange-600" />
                            <p className="text-[10px] text-orange-600">
                              Estimativa (CS × 6.5)
                            </p>
                          </div>
                          <button 
                            onClick={() => {
                              alert(`💡 Por que é estimativa?\n\n${revenueData.reasoning || 'Baseado em Capital Social × 6.5. Não foram encontrados dados públicos de faturamento para esta empresa.'}`);
                            }}
                            className="text-[9px] text-orange-500 hover:underline mt-1 cursor-pointer"
                          >
                            ℹ️ Por que é estimativa?
                          </button>
                        </>
                      )
                    ) : (
                      <>
                        <p className="text-2xl font-black text-slate-400">Calculando...</p>
                        <p className="text-[10px] text-slate-400 mt-2">Aguardando análise</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Aviso sobre estimativa */}
                {revenueData?.isEstimated && (
                  <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                    <p className="text-xs text-yellow-700 flex items-start gap-2">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Aviso:</strong> Faturamento em laranja é uma estimativa baseada em heurística 
                        (Capital Social × 6.5). Este valor não reflete necessariamente a realidade financeira 
                        da empresa. Para dados precisos, consulte demonstrações financeiras oficiais.
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* SEÇÃO 2: PERFIL DA OPERAÇÃO */}
              {operationalData?.activities && Object.values(operationalData.activities).some((a: any) => a?.active) && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="text-green-600" size={24} />
                    <h3 className="text-lg font-black text-green-900">Perfil da Operação</h3>
                  </div>
                  
                  {/* AVISO SOBRE FONTE DOS DADOS */}
                  <div className="bg-green-100 border border-green-300 rounded-lg p-3 mb-4">
                    <p className="text-xs text-green-700 flex items-start gap-2">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Análise baseada em:</strong> CNAEs primário e secundários da empresa + 
                        análise de inteligência artificial (Gemini AI). Atividades inferidas a partir da 
                        natureza do negócio registrada na Receita Federal.
                      </span>
                    </p>
                  </div>

                  {/* Grid de Atividades */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {Object.entries(operationalData.activities).map(([key, activity]: [string, any]) => {
                      if (!activity?.active) return null;

                      const icons: any = {
                        farming: '🌾',
                        industry: '🏭',
                        trading: '📦',
                        export: '🚢',
                        services: '🔧',
                        logistics: '🚛'
                      };

                      const labels: any = {
                        farming: 'Plantio Próprio',
                        industry: 'Indústria',
                        trading: 'Trading',
                        export: 'Exportação',
                        services: 'Serviços',
                        logistics: 'Logística'
                      };

                      return (
                        <div key={key} className="bg-white rounded-lg p-4 border-2 border-green-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{icons[key]}</span>
                            <p className="font-bold text-sm text-slate-800">{labels[key]}</p>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                            {activity.description}
                          </p>
                          {activity.source && activity.source !== 'Baseado no CNAE' && (
                            <a 
                              href={activity.source} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[10px] text-green-600 hover:underline mt-2 block truncate"
                              title={activity.source}
                            >
                              🔗 Ver fonte
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Hectares (se disponível) */}
                  {operationalData.hectares && (
                    <div className="bg-white rounded-lg p-5 border-2 border-green-200">
                      <p className="text-xs text-green-600 uppercase font-bold mb-2">Área Total Identificada</p>
                      <p className="text-3xl font-black text-green-700">
                        {operationalData.hectares.toLocaleString('pt-BR')} <span className="text-lg">hectares</span>
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-green-600 mt-4">
                    ✓ Confiança: {operationalData.confidence}% • Fonte: Gemini AI + Receita Federal
                  </p>
                </div>
              )}

              {/* SEÇÃO 3: DADOS ORGANIZACIONAIS */}
              {organizationalData?.employees && (
                <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="text-purple-600" size={24} />
                    <h3 className="text-lg font-black text-purple-900">Dados Organizacionais</h3>
                  </div>
                  
                  {/* AVISO SOBRE FONTE DOS DADOS */}
                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-3 mb-4">
                    <p className="text-xs text-purple-700 flex items-start gap-2">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Fonte dos dados:</strong> Análise via Gemini AI. Funcionários estimados com base em 
                        informações públicas (LinkedIn, portais de emprego, notícias) e análise do Capital Social. 
                        Maturidade Digital avaliada por sinais digitais (site institucional, presença online, vagas de TI).
                      </span>
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-5 border-2 border-purple-200 shadow-sm">
                      <p className="text-xs text-purple-600 uppercase font-bold mb-2">Funcionários Identificados</p>
                      <p className="text-3xl font-black text-purple-700">
                        ~{organizationalData.employees}
                      </p>
                      <p className="text-[10px] text-purple-600 mt-2">
                        Confiança: {organizationalData.confidence}%
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-5 border-2 border-purple-200 shadow-sm">
                      <p className="text-xs text-purple-600 uppercase font-bold mb-2">Maturidade Digital</p>
                      <p className="text-3xl font-black text-purple-700">
                        {organizationalData.digitalMaturity?.score || '--'}<span className="text-lg">/100</span>
                      </p>
                      <p className="text-[10px] text-purple-600 mt-2 line-clamp-2">
                        {organizationalData.digitalMaturity?.reasoning || 'Baseado em análise de presença digital'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Sinais Digitais */}
                  {organizationalData.digitalMaturity?.signals && organizationalData.digitalMaturity.signals.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-purple-600 uppercase font-bold mb-2">Sinais Digitais Detectados:</p>
                      <div className="flex flex-wrap gap-2">
                        {organizationalData.digitalMaturity.signals.map((signal: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO 4: ATIVIDADE PRINCIPAL (CNAE) */}
              {cnpjData?.cnae && (
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
                  <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Briefcase className="text-slate-600" size={24} />
                    Atividade Principal (CNAE)
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-5 border-2 border-slate-200">
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">
                      {cnpjData.cnae}
                    </p>
                  </div>
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Fonte:</strong> Receita Federal. Este é o CNAE primário registrado oficialmente.
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* SEÇÃO 5: QUADRO SOCIETÁRIO */}
              {cnpjData?.qsa && cnpjData.qsa.length > 0 && (
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Users className="text-slate-600" size={24} />
                      Quadro Societário
                    </h3>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                      {cnpjData.qsa.length} {cnpjData.qsa.length === 1 ? 'sócio' : 'sócios'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {cnpjData.qsa.slice(0, 5).map((socio: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-bold text-sm text-slate-800 truncate" title={socio.nome}>
                            {socio.nome}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-1" title={socio.qualificacao}>
                            {socio.qualificacao}
                          </p>
                        </div>
                        {socio.participacao && socio.participacao > 0 && (
                          <div className="flex-shrink-0 text-right">
                            <span className="text-lg font-black text-indigo-600">
                              {socio.participacao.toFixed(2)}%
                            </span>
                            <p className="text-[9px] text-slate-400 uppercase">participação</p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {cnpjData.qsa.length > 5 && (
                      <div className="text-center py-3 px-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500">
                          + {cnpjData.qsa.length - 5} sócio(s) não exibido(s)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Fonte:</strong> Dados oficiais da Receita Federal consultados via BrasilAPI.
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* SEÇÃO 6: EMPRESAS RELACIONADAS */}
              {networkData?.relatedCompanies && networkData.relatedCompanies.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-300 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="text-purple-600" size={24} />
                    <h3 className="text-lg font-black text-purple-900">
                      Empresas Relacionadas ({networkData.totalConnections})
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    {networkData.relatedCompanies.map((company: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-lg p-5 border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3 gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800 truncate" title={company.razaoSocial}>
                              {company.razaoSocial}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-1">{company.cnpj}</p>
                          </div>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full flex-shrink-0">
                            {company.relationType}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Capital Social</p>
                            <p className="text-sm font-bold text-slate-700 break-words">
                              {formatMoney(company.capitalSocial)}
                            </p>
                          </div>
                          {company.participacao && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Participação</p>
                              <p className="text-sm font-bold text-purple-600">
                                {company.participacao.toFixed(2)}%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <p className="text-xs text-purple-700 flex items-start gap-2">
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Fonte:</strong> Dados oficiais da Receita Federal via BrasilAPI. 
                        Empresas listadas são sócios Pessoa Jurídica identificados no Quadro Societário.
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* SEÇÃO 7: DADOS CADASTRAIS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                    <Calendar size={12} />
                    Situação Cadastral
                  </p>
                  <div className="flex items-center gap-2">
                    {cnpjData?.status === 'ATIVA' ? (
                      <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-bold ${cnpjData?.status === 'ATIVA' ? 'text-green-600' : 'text-red-600'}`}>
                      {cnpjData?.status || 'N/D'}
                    </p>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Data de Abertura</p>
                  <p className="text-sm font-bold text-slate-800">
                    {cnpjData?.dataAbertura || 'N/D'}
                  </p>
                </div>
              </div>
              
              {/* NATUREZA JURÍDICA - CARD SEPARADO */}
              {cnpjData?.naturezaJuridica && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Natureza Jurídica</p>
                  <p className="text-sm font-bold text-slate-800">
                    {cnpjData.naturezaJuridica}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">✓ Receita Federal</p>
                </div>
              )}

            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};