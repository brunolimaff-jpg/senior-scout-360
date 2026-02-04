
import React, { useState, useEffect } from 'react';
import { SocioDetalhado, mapearEmpresasSocio } from '../services/socioMappingService';
import { ChevronDown, Loader2, Building2, User, Search, AlertTriangle, RefreshCw, X, Timer } from 'lucide-react';

interface AccordionSociosProps {
  sociosIniciais: Array<{ nome: string; qualificacao: string }>;
  cnpjEmpresa: string;
}

export const AccordionSocios: React.FC<AccordionSociosProps> = ({ sociosIniciais, cnpjEmpresa }) => {
  const [sociosState, setSociosState] = useState<SocioDetalhado[]>([]);

  useEffect(() => {
    // Inicializa o estado com os dados básicos recebidos e campos de controle de erro
    setSociosState(
      sociosIniciais.map(s => ({
        nome: s.nome,
        cargo: s.qualificacao,
        isExpanded: false,
        isLoading: false,
        empresas_vinculadas: [],
        hasError: false,
        errorMessage: '',
        retryCount: 0
      }))
    );
  }, [sociosIniciais]);

  const handleExpandSocio = async (index: number, forceRetry = false) => {
    const socio = sociosState[index];
    
    // Toggle collapse se já tiver dados carregados com sucesso e não for um retry forçado
    if (socio.isExpanded && !forceRetry) {
      updateSocioState(index, { isExpanded: false });
      return;
    }
    
    // Se já tem dados (e não é erro), expande sem buscar
    if (socio.empresas_vinculadas && socio.empresas_vinculadas.length > 0 && !forceRetry && !socio.hasError) {
      updateSocioState(index, { isExpanded: true });
      return;
    }

    // Inicia busca: Reseta erros, ativa loading e expande
    updateSocioState(index, { 
        isLoading: true, 
        isExpanded: true, 
        hasError: false, 
        errorMessage: '' 
    });
    
    try {
      const empresas = await mapearEmpresasSocio(
        socio.nome,
        socio.cargo,
        cnpjEmpresa,
        (attempt, max, delayMs) => {
            // Callback de atualização de progresso do retry
            updateSocioState(index, {
                retryCount: attempt,
                errorMessage: `Tentativa ${attempt}/${max}. Aguardando ${(delayMs/1000).toFixed(0)}s...`
            });
        }
      );
      
      updateSocioState(index, { 
        empresas_vinculadas: empresas,
        isLoading: false,
        hasError: false,
        retryCount: 0,
        errorMessage: ''
      });
      
    } catch (error: any) {
      console.error('Erro ao mapear sócio:', error);
      
      // Fallback: garante que pelo menos a empresa atual aparece, mas marca como erro
      const fallbackEmpresas = (!socio.empresas_vinculadas || socio.empresas_vinculadas.length === 0) 
        ? [{
            cnpj: cnpjEmpresa,
            razao_social: '(Empresa atual - dados adicionais indisponíveis)',
            cargo_socio: socio.cargo,
            situacao: 'ATIVA' as const,
            fonte: 'INFERENCIA' as const
          }]
        : socio.empresas_vinculadas;

      updateSocioState(index, { 
          isLoading: false,
          hasError: true,
          errorMessage: error.message || 'Todas as tentativas falharam.',
          retryCount: 10, // Max atingido
          empresas_vinculadas: fallbackEmpresas
      });
    }
  };

  const updateSocioState = (index: number, updates: Partial<SocioDetalhado>) => {
    setSociosState(prev => {
        const newState = [...prev];
        newState[index] = { ...newState[index], ...updates };
        return newState;
    });
  };

  const formatMoney = (val?: number) => val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/D';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2 px-1">
         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <User size={12} /> Rede Societária ({sociosState.length})
         </h4>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {sociosState.map((socio, idx) => (
          <div 
            key={idx}
            className={`bg-white rounded-lg border transition-all duration-200 overflow-hidden ${
                socio.hasError 
                    ? 'border-red-300 shadow-sm' 
                    : socio.isExpanded 
                        ? 'border-teal-400 shadow-md ring-1 ring-teal-100' 
                        : 'border-slate-200 hover:border-teal-300'
            }`}
          >
            {/* Header Sócio */}
            <button
              onClick={() => handleExpandSocio(idx, false)}
              disabled={socio.isLoading}
              className="w-full p-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 ${
                  socio.hasError 
                    ? 'bg-gradient-to-br from-red-500 to-orange-600' 
                    : socio.isExpanded 
                        ? 'bg-teal-600' 
                        : 'bg-slate-400'
              }`}>
                {socio.hasError ? <AlertTriangle size={14}/> : socio.nome.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{socio.nome}</div>
                <div className={`text-[10px] truncate ${socio.hasError ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    {socio.hasError ? '⚠️ Falha na busca de dados' : socio.cargo}
                </div>
              </div>

              {/* Badge Contador de Tentativas ou Empresas */}
              {socio.isLoading && socio.retryCount && socio.retryCount > 0 ? (
                 <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-100 flex items-center gap-1 animate-pulse">
                    <Timer size={10} /> Tentativa {socio.retryCount}/10...
                 </span>
              ) : (
                 socio.empresas_vinculadas && socio.empresas_vinculadas.length > 1 && !socio.isExpanded && (
                    <span className="text-[9px] font-bold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 whitespace-nowrap">
                        +{socio.empresas_vinculadas.length - 1} empresas
                    </span>
                 )
              )}

              <div className="text-slate-400">
                {socio.isLoading ? (
                    <Loader2 size={14} className="animate-spin text-teal-500" />
                ) : (
                    <ChevronDown size={14} className={`transition-transform ${socio.isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>
            </button>

            {/* Conteúdo Expandido */}
            {socio.isExpanded && (
              <div className={`border-t p-3 space-y-3 animate-in slide-in-from-top-1 ${
                  socio.hasError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'
              }`}>
                
                {/* BLOC0 DE ERRO FINAL */}
                {socio.hasError && (
                    <div className="bg-white border border-red-200 rounded-lg p-3 shadow-sm mb-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <h5 className="text-xs font-bold text-red-800 mb-1">Falha na Conexão</h5>
                                <p className="text-[10px] text-red-600 leading-relaxed mb-3">
                                    Todas as tentativas automáticas falharam. O serviço de dados externos pode estar indisponível.
                                </p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleExpandSocio(idx, true); }}
                                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={12}/> Reiniciar Ciclo
                                    </button>
                                    <button
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            updateSocioState(idx, { isExpanded: false });
                                        }}
                                        className="flex items-center gap-1 bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-50"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State com Feedback de Retry */}
                {socio.isLoading && (
                    <div className="text-center py-6 bg-white rounded-lg border border-slate-200 border-dashed">
                        {socio.retryCount && socio.retryCount > 0 ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 size={24} className="animate-spin text-amber-500"/>
                                <span className="text-xs font-bold text-amber-600">
                                    Tentativa automática {socio.retryCount}/10
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {socio.errorMessage || "Conectando..."}
                                </span>
                            </div>
                        ) : (
                            <span className="text-xs text-slate-500 flex items-center justify-center gap-2">
                                <Search size={12} className="animate-pulse"/> Mapeando rede empresarial na web...
                            </span>
                        )}
                    </div>
                )}

                {/* Lista de Empresas (se houver, mesmo com erro parcial) */}
                {!socio.isLoading && socio.empresas_vinculadas && socio.empresas_vinculadas.length > 0 && (
                    socio.empresas_vinculadas.map((empresa, empIdx) => (
                        <div key={empIdx} className="bg-white p-3 rounded border border-slate-200 shadow-sm hover:border-teal-200 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <h5 className="text-xs font-bold text-slate-800 line-clamp-2" title={empresa.razao_social}>
                                    {empresa.razao_social}
                                </h5>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    empresa.situacao === 'ATIVA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {empresa.situacao}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
                                    {empresa.cnpj}
                                </span>
                                {empresa.capital_social && empresa.capital_social > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700">
                                        {formatMoney(empresa.capital_social)}
                                    </span>
                                )}
                            </div>

                            <div className="text-[10px] text-slate-500 grid grid-cols-2 gap-1 border-t border-slate-50 pt-2 mt-1">
                                <div><span className="font-semibold">Cargo:</span> {empresa.cargo_socio}</div>
                                {empresa.participacao && <div><span className="font-semibold">Part:</span> {empresa.participacao}</div>}
                            </div>
                            
                            <div className="mt-1 flex justify-end">
                                <span className="text-[8px] text-slate-300 font-medium uppercase tracking-wide">
                                    Fonte: {empresa.fonte}
                                </span>
                            </div>
                        </div>
                    ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
