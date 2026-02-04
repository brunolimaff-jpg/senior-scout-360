
import React, { useEffect, useState } from 'react';
import { ProspectLead, DadosEmpresa, ScoreSAS } from '../../types';
import { consultarCNPJ } from '../../services/cnpjService';
import { auditarEmpresaComIA } from '../../services/aiService';
import { enrichCompanyData, CompanyEnrichment, clearEnrichmentCache } from '../../services/enrichmentService';
import { 
  X, Building2, MapPin, Activity, Users, Sparkles, 
  AlertTriangle, ShieldCheck, DollarSign, BrainCircuit, Target, TrendingUp,
  Newspaper, RefreshCw, ExternalLink, Clipboard, Copy
} from 'lucide-react';
import { AccordionSocios } from '../AccordionSocios'; // Importando o novo componente

interface Props {
  lead: ProspectLead;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLead?: (lead: ProspectLead) => void;
}

export const CompanyDetailsModal: React.FC<Props> = ({ lead, isOpen, onClose, onUpdateLead }) => {
  const [loading, setLoading] = useState(true);
  const [dadosCadastrais, setDadosCadastrais] = useState<DadosEmpresa | null>(null);
  const [inteligencia, setInteligencia] = useState<ScoreSAS | null>(null);
  const [enrichment, setEnrichment] = useState<CompanyEnrichment | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [statusStep, setStatusStep] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      executarAuditoria();
    }
  }, [isOpen, lead.cnpj]);

  const executarAuditoria = async (forceRefresh = false) => {
    setLoading(true);
    setErro(null);
    if (!forceRefresh) {
        setDadosCadastrais(null);
        setInteligencia(null);
        setEnrichment(null);
    }

    try {
      if (forceRefresh) {
         clearEnrichmentCache(lead.cnpj);
      }

      // Passo 1: Busca Cadastral (BrasilAPI)
      setStatusStep('📡 Conectando à Receita Federal...');
      const dados = await consultarCNPJ(lead.cnpj);
      setDadosCadastrais(dados);

      // Atualiza o lead com dados reais imediatamente
      if (onUpdateLead) {
        const updatedLead: ProspectLead = {
          ...lead,
          companyName: dados.razao_social || lead.companyName,
          capitalSocial: dados.capital_social,
          cnaes: [
            { code: dados.cnae_fiscal, description: dados.cnae_fiscal_descricao, persona: 'PRODUTOR' },
            ...(lead.cnaes || []).slice(1)
          ],
          naturezaJuridica: dados.razao_social.toUpperCase().includes('S.A') ? 'S.A.' : 'Ltda',
          isSA: dados.razao_social.toUpperCase().includes('S.A'),
          cnae_principal: dados.cnae_fiscal_descricao,
          city: dados.municipio || lead.city,
          uf: dados.uf || lead.uf
        };
        onUpdateLead(updatedLead);
      }

      // Passo 2: Inteligência Artificial (Gemini Core)
      setStatusStep('🧠 Sara analisando estrutura e score...');
      const intel = await auditarEmpresaComIA(dados);
      setInteligencia(intel);

      // Passo 3: Enriquecimento (Notícias + Faturamento Real + Funcionários + Resumo Estratégico)
      setStatusStep('📰 Buscando notícias, balanços e gerando análise estratégica...');
      
      const qsaNormalizado = (dados.qsa || []).map(s => ({
        nome: s.nome_socio,
        qualificacao: s.qualificacao_socio
      }));

      const location = {
        state: dados.uf || lead.uf || '',
        city: dados.municipio || lead.city || ''
      };

      const richData = await enrichCompanyData(
        dados.razao_social,
        lead.cnpj,
        dados.capital_social,
        lead.hectaresEstimado || 0,
        dados.natureza_juridica || 'Ltda',
        dados.cnae_fiscal_descricao || 'Agro',
        qsaNormalizado,
        location,
        (msg) => setStatusStep(`🔍 ${msg}`)
      );
      setEnrichment(richData);

    } catch (e: any) {
      setErro(e.message || 'Erro desconhecido na auditoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceRefresh = () => {
    executarAuditoria(true);
  };

  const copyToClipboard = () => {
    if (enrichment?.resumo) {
      navigator.clipboard.writeText(enrichment.resumo);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (!isOpen) return null;

  const formatMoney = (val?: number) => 
    val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        
        {/* HEADER */}
        <div className="bg-slate-50 p-5 border-b border-slate-200 flex justify-between items-start">
          <div className="flex gap-4">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
               <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-tight uppercase">
                {dadosCadastrais?.razao_social || lead.companyName}
              </h2>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1 font-medium">
                <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-700">{lead.cnpj}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><MapPin size={14}/> {dadosCadastrais ? `${dadosCadastrais.municipio}/${dadosCadastrais.uf}` : `${lead.city}/${lead.uf}`}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button 
                onClick={handleForceRefresh} 
                disabled={loading}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition disabled:opacity-50"
                title="Forçar atualização de dados"
             >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
             </button>
             <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition">
               <X size={24} />
             </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {loading && !enrichment ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white/50 rounded-2xl border-2 border-dashed border-slate-200">
               <div className="relative mb-6">
                 <div className="absolute inset-0 bg-teal-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                 <Sparkles className="w-16 h-16 text-teal-600 animate-bounce relative z-10" />
               </div>
               <h3 className="text-xl font-black text-teal-800 uppercase tracking-widest animate-pulse">
                 🤖 Sara AI está analisando a empresa...
               </h3>
               <p className="text-teal-600 text-sm mt-2 font-medium">
                 {statusStep || 'Cruzando dados de mercado e gerando insights estratégicos...'}
               </p>
               <div className="mt-6 flex gap-2">
                  <span className="h-2 w-2 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                  <span className="h-2 w-2 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                  <span className="h-2 w-2 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
               </div>
            </div>
          ) : erro ? (
            <div className="flex flex-col items-center justify-center py-20">
               <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
               <h3 className="text-lg font-bold text-red-700">Falha na Auditoria</h3>
               <p className="text-slate-500 max-w-md text-center">{erro}</p>
               <button onClick={() => executarAuditoria(true)} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">Tentar Novamente</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* COLUNA ESQUERDA: SCORE & DADOS (4 Colunas) */}
              <div className="lg:col-span-4 space-y-6">
                 
                 {/* SCORE CARD */}
                 <div className={`p-6 rounded-2xl border-2 shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden bg-white
                    ${inteligencia?.tier === 'DIAMANTE' ? 'border-cyan-400 shadow-cyan-100' : 
                      inteligencia?.tier === 'OURO' ? 'border-amber-400 shadow-amber-100' : 'border-slate-200'}
                 `}>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Senior Agro Score</span>
                    <span className="text-6xl font-black text-slate-800 tracking-tighter mb-2">{inteligencia?.score}</span>
                    <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                       inteligencia?.tier === 'DIAMANTE' ? 'bg-cyan-100 text-cyan-800' : 
                       inteligencia?.tier === 'OURO' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                       {inteligencia?.tier}
                    </span>
                 </div>

                 {/* DADOS CADASTRAIS */}
                 <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Dados Oficiais</h3>
                    <div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Capital Social</span>
                       <div className="text-slate-800 font-bold">{formatMoney(dadosCadastrais?.capital_social)}</div>
                    </div>
                    <div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Situação</span>
                       <div className="flex items-center gap-1.5 text-sm font-medium">
                          {dadosCadastrais?.situacao_cadastral === 'ATIVA' ? <ShieldCheck className="w-4 h-4 text-green-500"/> : <AlertTriangle className="w-4 h-4 text-red-500"/>}
                          {dadosCadastrais?.situacao_cadastral}
                       </div>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Atividade Principal</span>
                        <div className="text-xs text-slate-600 leading-tight">{dadosCadastrais?.cnae_fiscal_descricao}</div>
                    </div>
                 </div>

                 {/* QUADRO SOCIETÁRIO (NOVO ACCORDION) */}
                 <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    {dadosCadastrais?.qsa && dadosCadastrais.qsa.length > 0 ? (
                       <AccordionSocios 
                          sociosIniciais={dadosCadastrais.qsa.map(s => ({
                             nome: s.nome_socio,
                             qualificacao: s.qualificacao_socio
                          }))}
                          cnpjEmpresa={lead.cnpj}
                       />
                    ) : (
                       <div className="text-center text-xs text-slate-400 italic py-4">
                          Sócios não informados na base pública.
                       </div>
                    )}
                 </div>

              </div>

              {/* COLUNA DIREITA: INTELLIGENCE & NEWS (8 Colunas) */}
              <div className="lg:col-span-8 space-y-6">
                 
                 {/* 1. RESUMO EXECUTIVO ESTRATÉGICO (SARA AI) */}
                 {enrichment?.resumo && (
                    <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 p-8 rounded-2xl border-2 border-teal-300 shadow-xl">
                        
                        <div className="flex items-start gap-4 mb-6">
                          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-3 rounded-xl shadow-lg text-white">
                            <BrainCircuit size={24} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-black text-teal-900 text-xl mb-1">
                              Resumo Executivo
                            </h3>
                            <p className="text-teal-700 text-sm font-semibold">
                              Análise Estratégica Sara AI • Atualizado em {new Date(enrichment.timestamp).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {/* AVISO DE DADOS CORRIGIDOS */}
                        {enrichment.hectares_corrigidos && enrichment.hectares_corrigidos > (lead.hectaresEstimado || 0) && (
                          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg flex items-start gap-3 shadow-sm">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div>
                              <h4 className="font-bold text-amber-900 text-sm">Dados Corrigidos pela Inteligência</h4>
                              <p className="text-xs text-amber-800 mt-1">
                                Os dados cadastrais apresentavam inconsistências. 
                                Área corrigida: <span className="font-bold">{lead.hectaresEstimado?.toLocaleString() || 0} ha → {enrichment.hectares_corrigidos.toLocaleString()} ha</span> 
                                {' '}(baseado em notícias e validação cruzada).
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Texto do resumo - parágrafos bem separados */}
                        <div className="space-y-6">
                          {enrichment.resumo.split('\n\n').filter(p => p.trim()).map((paragrafo, idx) => {
                            // Identifica seção por ordem
                            let sectionIcon = '📊';
                            let sectionTitle = '';
                            
                            if (idx === 0) { sectionIcon = '🏢'; sectionTitle = 'Perfil & Mercado'; }
                            else if (idx === 1) { sectionIcon = '⚙️'; sectionTitle = 'Complexidade Operacional'; }
                            else if (idx === 2) { sectionIcon = '🎯'; sectionTitle = 'Oportunidades Senior'; }
                            else if (idx === 3) { sectionIcon = '💡'; sectionTitle = 'Insights Estratégicos'; }
                            
                            return (
                              <div key={idx} className="bg-white/90 backdrop-blur p-5 rounded-xl border-l-4 border-teal-500 shadow-sm">
                                {sectionTitle && (
                                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-teal-200">
                                    <span className="text-xl">{sectionIcon}</span>
                                    <span className="font-bold text-teal-800 text-sm uppercase tracking-wide">
                                      {sectionTitle}
                                    </span>
                                  </div>
                                )}
                                <p 
                                  className="text-gray-800 leading-relaxed text-base font-medium"
                                  style={{ textAlign: 'justify', hyphens: 'auto' }}
                                >
                                  {paragrafo}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                          <button 
                            onClick={copyToClipboard}
                            className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl"
                          >
                            {copySuccess ? <Clipboard className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                            {copySuccess ? 'Copiado!' : 'Copiar Análise Completa'}
                          </button>
                          <button 
                            onClick={() => executarAuditoria(true)}
                            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                          >
                            <RefreshCw className="w-4 h-4" /> Regenerar
                          </button>
                        </div>
                        
                    </div>
                 )}

                 {/* 2. FATURAMENTO VALIDADO */}
                 {enrichment && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                       <div className="flex justify-between items-start mb-4">
                          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                             <TrendingUp size={16} className="text-emerald-600" /> Validação Financeira
                          </h3>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                             enrichment.faturamento_validado.confiabilidade === 'ALTA' ? 'bg-green-50 text-green-700 border-green-200' :
                             enrichment.faturamento_validado.confiabilidade === 'MEDIA' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                             'bg-red-50 text-red-700 border-red-200'
                          }`}>
                             Confiança: {enrichment.faturamento_validado.confiabilidade}
                          </span>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                             <span className="text-xs font-bold text-emerald-800 uppercase opacity-70">Faturamento Anual (Est.)</span>
                             <div className="text-2xl font-black text-emerald-700 mt-1">
                                {formatMoney(enrichment.faturamento_validado.valor)}
                             </div>
                             <div className="mt-2 text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                                <span>Fonte:</span>
                                <span className="bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                   {enrichment.faturamento_validado.fonte}
                                </span>
                             </div>
                          </div>
                          <div className="flex flex-col justify-center text-xs text-slate-500 space-y-2">
                             <p><strong>Justificativa:</strong> {enrichment.faturamento_validado.justificativa || 'Análise baseada em dados de mercado.'}</p>
                             <p><strong>Referência:</strong> {enrichment.faturamento_validado.ultima_atualizacao}</p>
                          </div>
                       </div>
                    </div>
                 )}

                 {/* 2.5 FUNCIONÁRIOS VALIDADOS */}
                 {enrichment?.funcionarios_validados && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border-2 border-blue-200">
                        <h3 className="font-black text-blue-900 text-lg mb-4 flex items-center gap-2">
                        <span className="text-2xl">👥</span> Funcionários Validados
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                        
                        {/* Quantidade */}
                        <div>
                            <div className="text-sm text-blue-700 font-semibold mb-1">Número de Funcionários</div>
                            <div className="text-4xl font-black text-blue-900">
                            {enrichment.funcionarios_validados.quantidade.toLocaleString()}
                            </div>
                        </div>
                        
                        {/* Fonte + Confiabilidade */}
                        <div>
                            <div className="text-sm text-blue-700 font-semibold mb-1">Fonte</div>
                            <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                enrichment.funcionarios_validados.fonte === 'RAIS' ? 'bg-green-600 text-white' :
                                enrichment.funcionarios_validados.fonte === 'CAGED' ? 'bg-green-500 text-white' :
                                enrichment.funcionarios_validados.fonte === 'NOTICIA' ? 'bg-blue-500 text-white' :
                                enrichment.funcionarios_validados.fonte === 'VAGAS' ? 'bg-purple-500 text-white' :
                                'bg-amber-500 text-white'
                            }`}>
                                {enrichment.funcionarios_validados.fonte === 'RAIS' && '✓ RAIS (Oficial)'}
                                {enrichment.funcionarios_validados.fonte === 'CAGED' && '✓ CAGED'}
                                {enrichment.funcionarios_validados.fonte === 'NOTICIA' && '📰 Notícia'}
                                {enrichment.funcionarios_validados.fonte === 'VAGAS' && '💼 Vagas'}
                                {enrichment.funcionarios_validados.fonte === 'ESTIMATIVA_IA' && '🤖 Estimativa IA'}
                            </span>
                            
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                enrichment.funcionarios_validados.confiabilidade === 'ALTA' ? 'bg-green-100 text-green-700' :
                                enrichment.funcionarios_validados.confiabilidade === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                {enrichment.funcionarios_validados.confiabilidade}
                            </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-2">
                            Ref: {enrichment.funcionarios_validados.ano_referencia}
                            </div>
                        </div>
                        
                        </div>
                        
                        {/* Detalhes/Justificativa */}
                        {enrichment.funcionarios_validados.detalhes && (
                        <div className="mt-4 bg-white/70 p-3 rounded-lg border border-blue-200">
                            <p className="text-xs text-gray-600 leading-relaxed">
                            <span className="font-semibold text-blue-800">ℹ️ Como chegamos neste número:</span><br/>
                            {enrichment.funcionarios_validados.detalhes}
                            </p>
                        </div>
                        )}
                    </div>
                 )}

                 {/* 3. ÚLTIMAS NOTÍCIAS */}
                 {enrichment?.noticias && enrichment.noticias.length > 0 && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                       <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Newspaper size={16} className="text-blue-600" /> Sinais de Mercado (Últimos 12 meses)
                       </h3>
                       <div className="grid gap-3">
                          {enrichment.noticias.map((news, idx) => (
                             <div key={idx} className="group p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                                <div className="flex justify-between items-start">
                                   <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors mb-1">
                                      {news.titulo}
                                   </h4>
                                   {news.url && (
                                      <a href={news.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600">
                                         <ExternalLink size={14} />
                                      </a>
                                   )}
                                </div>
                                <p className="text-xs text-slate-600 mb-2 line-clamp-2">{news.resumo}</p>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase">
                                   <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{news.fonte}</span>
                                   <span>{news.data}</span>
                                   <span className={`px-1.5 py-0.5 rounded ${news.relevancia === 'ALTA' ? 'text-red-600 bg-red-50' : 'text-slate-500'}`}>
                                      Relevância {news.relevancia}
                                   </span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {/* 4. ANÁLISE DOS 4 PILARES (SCORE) */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                       <div className="text-[10px] font-bold text-blue-700 uppercase mb-1">Músculo</div>
                       <div className="text-lg font-black text-slate-800">{inteligencia?.analise.musculo.score}/400</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                       <div className="text-[10px] font-bold text-purple-700 uppercase mb-1">Complexidade</div>
                       <div className="text-lg font-black text-slate-800">{inteligencia?.analise.complexidade.score}/250</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                       <div className="text-[10px] font-bold text-pink-700 uppercase mb-1">Gente</div>
                       <div className="text-lg font-black text-slate-800">{inteligencia?.analise.gente.score}/200</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                       <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Momento</div>
                       <div className="text-lg font-black text-slate-800">{inteligencia?.analise.momento.score}/150</div>
                    </div>
                 </div>

              </div>

            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
           <button onClick={onClose} className="px-6 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50 transition">Fechar</button>
           <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center gap-2">
              <TrendingUp size={16} /> Ver Oportunidades no CRM
           </button>
        </div>

      </div>
    </div>
  );
};
