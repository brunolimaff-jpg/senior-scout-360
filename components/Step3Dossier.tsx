
import React, { useEffect, useState, useRef } from 'react';
import { AccountData, Evidence, CostInfo, GroundingMetadata, ChatMessage, DossierPlanSection, DossierUpdate } from '../types';
import { generateDossierPlan, generateDossierSection, askDossierSmart } from '../services/geminiService';
import { saveDossierCheckpoint, getDossierCheckpoint, clearDossierCheckpoint, DossierCheckpoint } from '../services/storageService';
import { formatCost } from '../services/costService';
import { Sparkles, Loader2, FileText, BrainCircuit, Timer, Coins, MessageSquare, Send, CheckCircle2, Play, RefreshCw, HelpCircle, PenTool, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { FUN_MESSAGES } from '../utils/funMessages';
import { useRotatingMessage } from '../hooks/useRotatingMessage';
import { useSimulatedProgress } from '../hooks/useSimulatedProgress';

interface Props {
  data: AccountData;
  evidenceList: Evidence[];
  dossierContent: string;
  setDossierContent: (content: string) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  addLog?: (msg: string, type?: 'info' | 'error' | 'success' | 'warning') => void;
}

export default function Step3Dossier({
  data, evidenceList, dossierContent, setDossierContent, isGenerating, setIsGenerating, onNext, onBack, addLog
}: Props) {

  const [plan, setPlan] = useState<DossierPlanSection[]>([]);
  const [completedSections, setCompletedSections] = useState<Record<number, string>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(-1);
  const [accumulatedCost, setAccumulatedCost] = useState<number>(0);
  const [errorInSection, setErrorInSection] = useState<number | null>(null);
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadingMessage = useRotatingMessage(FUN_MESSAGES, isGenerating, 4000);
  const { progress, timeLeft } = useSimulatedProgress(isGenerating, 45);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper para gerar uma chave de persistência estável
  const buildDossierKey = (accountData: AccountData) => {
    const cnpj = (accountData.cnpj || "").replace(/\D/g, "");
    if (cnpj.length === 14) return `dossier:${cnpj}`;
    const name = (accountData.companyName || "").trim().toLowerCase();
    return `dossier:name:${name}`;
  };

  useEffect(() => {
    const stableKey = buildDossierKey(data);
    let cp = getDossierCheckpoint(stableKey);
    
    // Fallback: Tenta recuperar dossiê salvo antes da migração de chave (usando o nome da empresa)
    if (!cp) {
      const oldCp = getDossierCheckpoint(data.companyName);
      if (oldCp) {
        cp = oldCp;
        // Migra para a nova chave estável e apaga a antiga
        saveDossierCheckpoint(stableKey, oldCp);
        clearDossierCheckpoint(data.companyName);
        if (addLog) addLog("Sara: Dossiê legado recuperado e migrado para chave estável.", 'success');
      }
    }

    if (cp && cp.plan.length > 0) {
      setHasCheckpoint(true);
      setPlan(cp.plan);
      setCompletedSections(cp.completedSections);
      setAccumulatedCost(cp.accumulatedCost);
      
      const partialContent = cp.plan.map((_, idx) => cp.completedSections[idx] || '').join('\n\n');
      setDossierContent(partialContent);
    }
  }, [data, data.companyName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const getEvidenceDigest = () => {
    return evidenceList
      .filter(e => e.selected)
      .map((e, i) => `[${i+1}] ${e.title} (${e.category}): ${e.snippet || e.text?.substring(0, 150)}... URL: ${e.url}`)
      .join('\n');
  };

  const saveProgress = (newSections: Record<number, string>, cost: number, currentPlan: DossierPlanSection[]) => {
    const stableKey = buildDossierKey(data);
    const cp: DossierCheckpoint = {
      companyName: data.companyName,
      plan: currentPlan,
      completedSections: newSections,
      accumulatedCost: cost,
      lastUpdated: new Date().toISOString()
    };
    saveDossierCheckpoint(stableKey, cp);
    
    const fullMarkdown = currentPlan.map((_, idx) => newSections[idx] || '').join('\n\n');
    setDossierContent(fullMarkdown);
  };

  const handleStartOrResume = async () => {
    setIsGenerating(true);
    setErrorInSection(null);
    setHasCheckpoint(false);

    try {
      let currentPlan = plan;
      let cost = accumulatedCost;

      if (currentPlan.length === 0) {
        if (addLog) addLog("Sara: Gerando plano estruturado para o dossiê...", 'info');
        const { plan: newPlan, costInfo } = await generateDossierPlan(data, evidenceList.length, addLog);
        currentPlan = newPlan;
        setPlan(newPlan);
        cost += costInfo.totalCost;
      }

      const digest = getEvidenceDigest();
      
      for (let i = 0; i < currentPlan.length; i++) {
        if (completedSections[i]) continue;

        setCurrentSectionIndex(i);
        if (addLog) addLog(`Sara: Redigindo seção ${i+1}/${currentPlan.length}: ${currentPlan[i].title}`, 'info');

        try {
          const { markdown, costInfo } = await generateDossierSection(currentPlan[i], data, digest);
          cost += costInfo.totalCost;
          
          setCompletedSections(prev => {
            const next = { ...prev, [i]: markdown };
            saveProgress(next, cost, currentPlan);
            return next;
          });
          setAccumulatedCost(cost);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);

        } catch (e) {
          setErrorInSection(i);
          setIsGenerating(false);
          return;
        }
      }

      if (addLog) addLog("Sara: Dossiê finalizado com sucesso.", 'success');
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
      setCurrentSectionIndex(-1);
    }
  };

  const handleRetrySection = () => handleStartOrResume();

  const handleRegenerateAll = () => {
    if (confirm("Sara: Isso apagará o rascunho atual e iniciará um novo. Deseja prosseguir?")) {
      const stableKey = buildDossierKey(data);
      clearDossierCheckpoint(stableKey);
      clearDossierCheckpoint(data.companyName); // Limpa também a chave antiga se existir
      setPlan([]);
      setCompletedSections({});
      setAccumulatedCost(0);
      setDossierContent('');
      setTimeout(handleStartOrResume, 100);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', text: question, timestamp: new Date().toISOString() };
    setChatHistory(prev => [...prev, userMsg]);
    setQuestion('');
    setIsAsking(true);

    try {
      const { answer, costInfo, groundingMetadata, dossierUpdate } = await askDossierSmart(dossierContent, data, userMsg.text, addLog);
      const modelMsg: ChatMessage = { id: `resp-${Date.now()}`, role: 'model', text: answer, timestamp: new Date().toISOString(), grounding: groundingMetadata, dossierUpdate: dossierUpdate };
      setChatHistory(prev => [...prev, modelMsg]);
      setAccumulatedCost(prev => prev + costInfo.totalCost);

      if (dossierUpdate) {
        const sectionIdx = plan.findIndex(s => s.title.toLowerCase().includes(dossierUpdate.sectionTitle.toLowerCase()));
        const idxToUpdate = sectionIdx !== -1 ? sectionIdx : plan.length - 1;
        const oldContent = completedSections[idxToUpdate] || '';
        const newContent = `${oldContent}\n\n${dossierUpdate.appendMarkdown}`;
        
        setCompletedSections(prev => {
          const next = { ...prev, [idxToUpdate]: newContent };
          saveProgress(next, accumulatedCost + costInfo.totalCost, plan);
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAsking(false);
    }
  };

  if (!dossierContent && !isGenerating && !hasCheckpoint) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center bg-white rounded-xl shadow-sm border border-slate-200">
        <BrainCircuit className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Geração de Dossiê Estratégico</h2>
        <p className="text-slate-500 mb-8 max-w-lg mx-auto">Sara utilizará as evidências coletadas para redigir uma análise profunda em seções modulares.</p>
        <button onClick={handleStartOrResume} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg rounded-xl font-bold shadow-xl flex items-center gap-3 mx-auto transition transform hover:scale-105">
          <Play className="w-6 h-6" /> Iniciar Inteligência
        </button>
      </div>
    );
  }

  if (hasCheckpoint && !isGenerating) {
    const progressPercent = Math.round((Object.keys(completedSections).length / plan.length) * 100);
    return (
      <div className="max-w-2xl mx-auto py-12 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-6">
        <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <Timer className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dossiê em Andamento</h2>
          <p className="text-slate-500 mt-2">Sara encontrou um progresso de {progressPercent}% para <strong>{data.companyName}</strong>.</p>
        </div>
        <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-3">
           <div className="bg-amber-500 h-3 rounded-full" style={{width: `${progressPercent}%`}}></div>
        </div>
        <div className="flex justify-center gap-4">
           <button onClick={handleRegenerateAll} className="px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition">Reiniciar</button>
           <button onClick={handleStartOrResume} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2">
             <Play className="w-4 h-4" /> Continuar Redação
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col gap-6 pb-20">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-4 w-full md:w-auto flex-1">
            <div className="bg-indigo-50 p-2 rounded-lg">
               {isGenerating ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
            </div>
            <div className="flex-1 min-w-0">
               <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                 {isGenerating ? loadingMessage : 'Relatório Sara AI Finalizado'}
                 <button onClick={() => setShowHelp(!showHelp)} className="text-slate-400 hover:text-indigo-600"><HelpCircle className="w-3.5 h-3.5"/></button>
               </h3>
               {isGenerating && plan.length > 0 && (
                  <div className="w-full max-w-xs mt-1.5 space-y-1">
                     <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1"><Timer className="w-3 h-3"/> {timeLeft}s estimativo</span>
                        <span>Seção {Object.keys(completedSections).length + 1}/{plan.length}</span>
                     </div>
                     <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{width: `${progress}%`}}></div>
                     </div>
                  </div>
               )}
            </div>
         </div>
         <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right hidden sm:block">
               <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Investimento em Tokens</div>
               <div className="text-sm font-bold text-slate-700 flex items-center justify-end gap-1">
                 <Coins className="w-3 h-3 text-amber-500" /> {formatCost(accumulatedCost)}
               </div>
            </div>
            {errorInSection !== null && !isGenerating && (
               <button onClick={handleRetrySection} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse">
                 <RefreshCw className="w-3 h-3" /> Retentar Seção {errorInSection + 1}
               </button>
            )}
            {!isGenerating && plan.length > 0 && Object.keys(completedSections).length === plan.length && (
               <button onClick={onNext} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition hover:-translate-y-0.5">
                 <FileText className="w-4 h-4" /> Finalizar & Exportar
               </button>
            )}
         </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-slate-200 min-h-[60vh] flex flex-col">
             <div className="flex-1 overflow-y-auto prose prose-indigo max-w-none custom-scrollbar" ref={scrollRef}>
                {dossierContent ? <ReactMarkdown>{dossierContent}</ReactMarkdown> : <div className="text-center text-slate-300 mt-20"><p>Sara está processando o plano tático...</p></div>}
                {isGenerating && <div className="flex items-center gap-2 text-indigo-500 text-sm font-bold mt-4 animate-pulse"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> <PenTool className="w-3 h-3"/> Sara está escrevendo...</div>}
             </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Linha do Tempo de Redação</h4>
                <div className="space-y-2">
                   {plan.map((section, idx) => (
                     <div key={idx} className={`flex items-center gap-2 text-xs p-2 rounded ${completedSections[idx] ? 'text-green-700 bg-green-50' : currentSectionIndex === idx ? 'text-indigo-700 bg-indigo-50 border border-indigo-100' : 'text-slate-400'}`}>
                        {completedSections[idx] ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current text-xs flex items-center justify-center">{idx+1}</div>}
                        <span className="truncate">{section.title}</span>
                     </div>
                   ))}
                </div>
             </div>
             <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-[500px]">
                <div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                   <h3 className="font-bold text-slate-700 text-xs flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Oráculo Sara (Inteligência sob Demanda)</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                   {chatHistory.length === 0 && <div className="text-center text-slate-400 py-10 px-4 text-xs"><Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Sara responde dúvidas e busca dados em tempo real para atualizar o dossiê.</p></div>}
                   {chatHistory.map((msg) => (
                     <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                       <div className={`max-w-[90%] px-3 py-2 rounded-lg text-xs shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>{msg.text}</div>
                       {msg.grounding?.searchEntryPoint?.renderedContent && <div className="mt-2 w-full max-w-[90%] bg-slate-50 border border-slate-100 rounded-lg overflow-hidden text-[10px]"><div className="px-2 py-1 bg-slate-100 text-slate-500 font-bold uppercase flex items-center gap-1"><Globe className="w-3 h-3"/> Fontes Google</div><div className="p-2" dangerouslySetInnerHTML={{ __html: msg.grounding.searchEntryPoint.renderedContent }} /></div>}
                       {msg.dossierUpdate && <div className="mt-1 flex items-center gap-1.5 text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 animate-in slide-in-from-left-2"><RefreshCw className="w-3 h-3" /> Dossiê atualizado: <strong>{msg.dossierUpdate.sectionTitle}</strong></div>}
                     </div>
                   ))}
                   {isAsking && <div className="flex justify-start"><div className="bg-slate-50 text-slate-500 px-3 py-2 rounded-lg rounded-bl-none text-xs flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Sara está consultando fontes...</div></div>}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-2 border-t border-slate-100 flex gap-2">
                  <input type="text" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAsk()} placeholder="Perguntar à Sara..." disabled={isAsking} className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"/>
                  <button onClick={handleAsk} disabled={isAsking || !dossierContent} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"><Send className="w-3 h-3" /></button>
                </div>
             </div>
          </div>
      </div>
      {!isGenerating && <div className="mt-2"><button onClick={onBack} className="text-slate-500 hover:text-slate-800 text-sm underline">Voltar para Curadoria</button></div>}
    </div>
  );
}
