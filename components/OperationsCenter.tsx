
import React, { useState, useEffect } from 'react';
import { PipelineItem, HistoryItem, AlertItem, ProspectLead } from '../types';
import { getPipeline, getHistory, getAlerts, updatePipelineStage, savePipeline, exportData, importData } from '../services/storageService';
import { LayoutDashboard, History, Bell, SplitSquareHorizontal, Download, Upload, Swords, Crosshair, Users, Zap, Shield, TrendingUp, Briefcase, BrainCircuit, Target, Lightbulb, FileSearch, Heart, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  comparisonLeads: ProspectLead[];
  onClearComparison: () => void;
}

const STAGES = {
  'DESCOBERTA': 'Descoberta',
  'QUALIFICACAO': 'Qualificação',
  'ABORDAGEM': 'Abordagem',
  'NEGOCIACAO': 'Negociação',
  'GANHO': 'Ganho',
  'PERDIDO': 'Perdido'
};

// ATUALIZADO: Estrutura Problema vs Solução para maior impacto visual
const COMPETITORS: Record<string, { problemTitle: string; problemText: string; attackText: string }> = {
  'TOTVS': {
    problemTitle: "🏭 ERP de Fábrica na Roça",
    problemText: "Tentam adaptar o chão de fábrica ('Centro de Custo') para a dinâmica do campo.",
    attackText: "O 'Centro de Custo' industrial não reflete a safra. O GAtec nasceu na terra, controlando safrinhas, variedades e custo real, sem gambiarra."
  },
  'SAP': {
    problemTitle: "💣 O Problema do 'Frankenstein'",
    problemText: "Cuidado. O SAP sozinho não roda Agro. Eles dependem de parceiros (Liberali, Agrotis, Spro) para fazer o campo.",
    attackText: "Você vai assinar dois contratos? Se a integração der erro, a SAP culpa o parceiro e vice-versa. Na Senior, o ERP, o GAtec (Campo) e o HCM (Pessoas) são nativos e de um único fornecedor. Responsabilidade única."
  },
  'VIASOFT': {
    problemTitle: "📦 Forte na Loja, Médio no Campo",
    problemText: "Eles nasceram fortes em Cerealistas e Revendas (Varejo), não na Produção.",
    attackText: "Para gerir a Loja eles são bons. Mas para o Custo de Produção detalhado (Talhão/Safra) e Manutenção de Frota, o GAtec é superior. E o RH? O Viasoft geralmente integra com terceiros. O Senior HCM é o líder de mercado."
  },
  'LOCAIS': {
    problemTitle: "🚧 O Teto de Vidro (Governança)",
    problemText: "Sistemas regionais funcionam para fazendas familiares, mas não aguentam crescimento.",
    attackText: "Se vocês quiserem auditoria (Big 4), crédito barato ou M&A, esses sistemas travam por falta de compliance. A Senior prepara sua fazenda para virar uma Multinacional. Não troque de sistema de novo daqui a 2 anos."
  },
  'EXCEL': {
    problemTitle: "📉 Risco Fiscal e Sucessório",
    problemText: "A gestão está na cabeça de uma pessoa. Planilha não tem trava de segurança.",
    attackText: "Risco LCDPR Crítico. Se a Receita cruzar os dados, a multa é automática. Venda a segurança fiscal do Senior ERP e a auditoria do sistema."
  }
};

interface BehavioralProfile {
  id: string;
  label: string;
  archetype: string;
  color: string;
  textColor: string;
  borderColor: string;
  icon: React.ReactNode;
  salesTip: string;
  keywords: string[];
}

const BEHAVIOR_PROFILES: Record<string, BehavioralProfile> = {
  'DOMINANTE': {
    id: 'D',
    label: 'DOMINANTE (D)',
    archetype: 'Tubarão 🦈',
    color: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
    icon: <Target className="w-5 h-5 text-red-600" />,
    salesTip: "Seja breve. Fale de ROI, Prazo e Metas. Não mostre 'como funciona', mostre 'o que entrega'. Ele quer resultado para ontem.",
    keywords: ['resultado', 'rápido', 'rapido', 'lucro', 'meta', 'direto', 'dinheiro', 'eficiência', 'vencer', 'ganhar', 'poder', 'agora']
  },
  'INFLUENTE': {
    id: 'I',
    label: 'INFLUENTE (I)',
    archetype: 'Visionário 🦅',
    color: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    icon: <Lightbulb className="w-5 h-5 text-amber-600" />,
    salesTip: "Venda o sonho. Mostre dashboards bonitos, fale de inovação, tablet no campo e futuro. Crie conexão pessoal e energia.",
    keywords: ['inovação', 'inovacao', 'time', 'pessoas', 'futuro', 'inspirar', 'junto', 'parceria', 'tecnologia', 'ideia', 'novidade', 'sonho']
  },
  'CONFORME': {
    id: 'C',
    label: 'CONFORME (C)',
    archetype: 'Analítico 🦉',
    color: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200',
    icon: <FileSearch className="w-5 h-5 text-blue-600" />,
    salesTip: "Venda Compliance e Segurança. Mostre dados técnicos, planilhas comparativas e casos de sucesso detalhados. Não pressione o fechamento.",
    keywords: ['segurança', 'seguranca', 'processo', 'garantia', 'risco', 'conformidade', 'detalhe', 'analisar', 'lógica', 'dados', 'números', 'regras']
  },
  'ESTAVEL': {
    id: 'S',
    label: 'ESTÁVEL (S)',
    archetype: 'Relacional 🐢',
    color: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    icon: <Heart className="w-5 h-5 text-green-600" />,
    salesTip: "Venda Confiança e Tradição. Fale que a Senior tem 30 anos de mercado. Cite clientes vizinhos que ele conhece. Evite mudanças bruscas.",
    keywords: ['família', 'familia', 'legado', 'calma', 'tradição', 'tradicao', 'confiança', 'confianca', 'equipe', 'juntos', 'seguro', 'paz']
  }
};

export const OperationsCenter: React.FC<Props> = ({ comparisonLeads, onClearComparison }) => {
  const [activeTab, setActiveTab] = useState<'KANBAN' | 'HISTORY' | 'ALERTS' | 'COMPARE' | 'TOOLS'>('TOOLS');
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Tools State
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('');
  
  // Profiler State
  const [profilerText, setProfilerText] = useState('');
  const [profileResult, setProfileResult] = useState<BehavioralProfile | null>(null);
  const [isProfiling, setIsProfiling] = useState(false);

  useEffect(() => {
    setPipeline(getPipeline());
    setHistory(getHistory());
    setAlerts(getAlerts());
    if (comparisonLeads.length > 0) setActiveTab('COMPARE');
  }, [comparisonLeads]);

  const handleStageChange = (id: string, newStage: string) => {
    updatePipelineStage(id, newStage as any);
    setPipeline(getPipeline()); // Refresh
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (importData(evt.target?.result as string)) {
        alert("Dados importados com sucesso!");
        window.location.reload();
      } else {
        alert("Erro ao importar.");
      }
    };
    reader.readAsText(file);
  };

  const analyzeProfile = () => {
    if (!profilerText.trim()) return;

    setIsProfiling(true);
    setProfileResult(null);

    // Simulating "thinking" time
    setTimeout(() => {
      const textLower = profilerText.toLowerCase();
      let bestMatch: BehavioralProfile | null = null;
      let maxHits = 0;

      // Simple keyword counting
      Object.values(BEHAVIOR_PROFILES).forEach(profile => {
        let hits = 0;
        profile.keywords.forEach(kw => {
          if (textLower.includes(kw)) hits++;
        });
        if (hits > maxHits) {
          maxHits = hits;
          bestMatch = profile;
        }
      });

      // Fallback
      if (!bestMatch) {
         setProfileResult({
            id: 'X',
            label: 'PERFIL EQUILIBRADO',
            archetype: 'Camaleão 🦎',
            color: 'bg-slate-50',
            textColor: 'text-slate-800',
            borderColor: 'border-slate-200',
            icon: <Users className="w-5 h-5 text-slate-600" />,
            salesTip: "Texto neutro. Use uma abordagem consultiva padrão (SPIN Selling): investigue a dor antes de propor a solução. Foque em segurança e ROI.",
            keywords: []
         });
      } else {
        setProfileResult(bestMatch);
      }
      setIsProfiling(false);
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Swords className="w-6 h-6 text-indigo-600" /> Arsenal Tático
        </h1>
        <div className="flex gap-2">
           <button onClick={exportData} className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 rounded-lg transition border border-slate-200">
             <Download className="w-4 h-4" /> Exportar Backup
           </button>
           <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 rounded-lg transition border border-slate-200">
             <Upload className="w-4 h-4" /> Importar
           </button>
           <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setActiveTab('TOOLS')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${activeTab === 'TOOLS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
          <Crosshair className="w-4 h-4" /> Ferramentas Rápidas
        </button>
        <button onClick={() => setActiveTab('KANBAN')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${activeTab === 'KANBAN' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
          <LayoutDashboard className="w-4 h-4" /> Pipeline
        </button>
        <button onClick={() => setActiveTab('HISTORY')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${activeTab === 'HISTORY' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
          <History className="w-4 h-4" /> Histórico
        </button>
        <button onClick={() => setActiveTab('ALERTS')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${activeTab === 'ALERTS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
          <Bell className="w-4 h-4" /> Alertas <span className="bg-red-100 text-red-700 text-xs px-1.5 rounded-full">{alerts.length}</span>
        </button>
        {comparisonLeads.length > 0 && (
          <button onClick={() => setActiveTab('COMPARE')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${activeTab === 'COMPARE' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
            <SplitSquareHorizontal className="w-4 h-4" /> Comparação ({comparisonLeads.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-slate-50 min-h-[500px] rounded-xl border border-slate-200 p-6">
        
        {/* TOOLS VIEW (New) */}
        {activeTab === 'TOOLS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* CARD 1: COMPETITOR KILLER (ATUALIZADO) */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition flex flex-col">
               <div className="flex items-center gap-3 mb-6">
                  <div className="bg-red-100 p-2.5 rounded-lg">
                    <Swords className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">Matador de Concorrência</h3>
                    <p className="text-xs text-slate-500">Argumentos de ataque cirúrgicos</p>
                  </div>
               </div>

               <div className="mb-6">
                 <label className="block text-sm font-bold text-slate-700 mb-2">Qual sistema eles usam hoje?</label>
                 <select 
                   value={selectedCompetitor}
                   onChange={(e) => setSelectedCompetitor(e.target.value)}
                   className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-red-500 outline-none"
                 >
                   <option value="">Selecione...</option>
                   <option value="TOTVS">TOTVS (Protheus/Datasul)</option>
                   <option value="SAP">SAP B1 ou S/4 (Via Parceiro)</option>
                   <option value="VIASOFT">Viasoft / Agrotitan</option>
                   <option value="LOCAIS">Locais (CHB, Unysistem, etc)</option>
                   <option value="EXCEL">Excel / Planilhas</option>
                 </select>
               </div>

               {selectedCompetitor && COMPETITORS[selectedCompetitor] && (
                 <div className="space-y-3 animate-in zoom-in-95">
                    {/* The Problem (Red) */}
                    <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-900 shadow-sm">
                       <h4 className="font-bold text-sm flex items-center gap-2 mb-1.5">
                          <AlertTriangle className="w-4 h-4" /> {COMPETITORS[selectedCompetitor].problemTitle}
                       </h4>
                       <p className="text-sm opacity-90 leading-relaxed">
                          "{COMPETITORS[selectedCompetitor].problemText}"
                       </p>
                    </div>

                    {/* The Solution (Green) */}
                    <div className="p-4 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm">
                       <h4 className="font-bold text-sm flex items-center gap-2 mb-1.5">
                          <CheckCircle2 className="w-4 h-4" /> O Contra-Ataque Senior
                       </h4>
                       <p className="text-sm font-medium leading-relaxed">
                          "{COMPETITORS[selectedCompetitor].attackText}"
                       </p>
                    </div>
                 </div>
               )}
               
               {!selectedCompetitor && (
                 <div className="text-center py-8 text-slate-300 border-2 border-dashed border-slate-100 rounded-lg mt-auto">
                   <Swords className="w-8 h-8 mx-auto mb-2 opacity-20" />
                   <p className="text-xs">Selecione um alvo para revelar a estratégia.</p>
                 </div>
               )}
            </div>

            {/* CARD 2: WAR ROOM PROFILER */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition">
               <div className="flex items-center gap-3 mb-6">
                  <div className="bg-indigo-100 p-2.5 rounded-lg">
                    <BrainCircuit className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">Sala de Guerra (Profiler)</h3>
                    <p className="text-xs text-slate-500">Análise psicológica via texto do lead</p>
                  </div>
               </div>

               <div className="mb-4">
                 <label className="block text-sm font-bold text-slate-700 mb-2">🕵️ Cole aqui um texto do Lead (LinkedIn, E-mail, Bio...)</label>
                 <textarea 
                   value={profilerText}
                   onChange={(e) => setProfilerText(e.target.value)}
                   placeholder="Ex: 'Focamos em resultado rápido e expansão agressiva da área plantada...'"
                   rows={3}
                   className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-xs"
                 />
                 <button 
                  onClick={analyzeProfile}
                  disabled={isProfiling || !profilerText.trim()}
                  className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                 >
                   {isProfiling ? 'Processando...' : 'Analisar Perfil Psicológico'}
                   {!isProfiling && <Zap className="w-4 h-4 fill-current" />}
                 </button>
               </div>

               {profileResult && (
                 <div className={`p-4 rounded-lg border shadow-sm animate-in zoom-in-95 ${profileResult.color} ${profileResult.borderColor}`}>
                    <div className="flex justify-between items-start mb-2">
                       <h4 className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${profileResult.textColor}`}>
                          {profileResult.icon} {profileResult.label}
                       </h4>
                       <span className="text-xs font-bold bg-white/50 px-2 py-0.5 rounded border border-black/5">
                         {profileResult.archetype}
                       </span>
                    </div>
                    
                    <div className="bg-white/60 p-3 rounded-lg border border-black/5 mt-2">
                      <p className={`text-sm font-medium leading-relaxed ${profileResult.textColor}`}>
                         "{profileResult.salesTip}"
                      </p>
                    </div>
                 </div>
               )}

               {!profileResult && !isProfiling && (
                 <div className="text-center py-6 text-slate-300 border-2 border-dashed border-slate-100 rounded-lg">
                   <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                   <p className="text-xs">Cole um texto para a IA identificar o padrão.</p>
                 </div>
               )}
            </div>

          </div>
        )}

        {/* KANBAN VIEW */}
        {activeTab === 'KANBAN' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto">
            {Object.entries(STAGES).map(([key, label]) => (
              <div key={key} className="min-w-[200px] bg-white rounded-lg border border-slate-200 flex flex-col h-full shadow-sm">
                 <div className="p-3 border-b border-slate-100 font-bold text-xs text-slate-600 uppercase tracking-wider bg-slate-50 rounded-t-lg">
                   {label}
                 </div>
                 <div className="p-2 space-y-2 flex-1">
                    {pipeline.filter(i => i.stage === key).map(item => (
                      <div key={item.id} className="p-3 bg-white border border-slate-200 rounded shadow-sm text-sm hover:shadow-md transition">
                        <div className="font-bold text-slate-800">{item.companyName}</div>
                        <div className="text-xs text-slate-500 mb-2">{item.city}/{item.uf}</div>
                        <select 
                          value={item.stage} 
                          onChange={(e) => handleStageChange(item.id, e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded p-1 bg-slate-50"
                        >
                          {Object.entries(STAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                    {pipeline.filter(i => i.stage === key).length === 0 && (
                      <div className="text-center text-xs text-slate-300 py-4 italic">Vazio</div>
                    )}
                 </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTORY VIEW */}
        {activeTab === 'HISTORY' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                 <tr>
                   <th className="p-4">Data</th>
                   <th className="p-4">Tipo</th>
                   <th className="p-4">Título / Empresa</th>
                   <th className="p-4 text-center">Ações</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {history.map(item => (
                   <tr key={item.id} className="hover:bg-slate-50">
                     <td className="p-4 text-slate-500">{new Date(item.timestamp).toLocaleDateString()}</td>
                     <td className="p-4"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">{item.type}</span></td>
                     <td className="p-4 font-medium text-slate-800">{item.title}</td>
                     <td className="p-4 text-center">
                       <button className="text-indigo-600 hover:underline text-xs">Ver Detalhes</button>
                     </td>
                   </tr>
                 ))}
                 {history.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum histórico encontrado.</td></tr>}
               </tbody>
            </table>
          </div>
        )}

        {/* COMPARISON VIEW */}
        {activeTab === 'COMPARE' && (
           <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Comparativo Lado a Lado</h3>
                <button onClick={onClearComparison} className="text-red-600 text-sm hover:underline">Limpar Comparação</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {comparisonLeads.map((lead, idx) => (
                   <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 rounded-t-xl"></div>
                      <h3 className="font-bold text-lg mb-1">{lead.companyName}</h3>
                      <p className="text-sm text-slate-500 mb-4">{lead.city}/{lead.uf}</p>
                      
                      <div className="space-y-4 text-sm">
                         <div>
                            <span className="block text-xs font-bold text-slate-400 uppercase">Prioridade</span>
                            <div className="flex items-center gap-2">
                               <div className="flex-1 h-2 bg-slate-100 rounded-full"><div style={{width: `${lead.priority}%`}} className="h-full bg-green-500 rounded-full"></div></div>
                               <span className="font-bold">{lead.priority}</span>
                            </div>
                         </div>
                         <div>
                            <span className="block text-xs font-bold text-slate-400 uppercase">Aderência (Fit)</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${lead.fitLevel === 'Sim' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{lead.fitLevel}</span>
                         </div>
                         <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Motivos</span>
                            <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                               {(lead.fitExplanation?.motivos || []).map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                         </div>
                         <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <span className="block text-xs font-bold text-red-400 uppercase mb-1">Pontos de Atenção</span>
                            <ul className="list-disc pl-4 text-xs text-red-600 space-y-1">
                               {(lead.fitExplanation?.faltouConfirmar || []).map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        )}

      </div>
    </div>
  );
};
