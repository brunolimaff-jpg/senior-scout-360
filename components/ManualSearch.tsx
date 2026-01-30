
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Sprout, Building2, Terminal, 
  Loader2, Crosshair, Tractor, Wheat, Factory, 
  ShieldAlert, ScanLine, Radar, Globe, AlertTriangle, CheckCircle2, FileWarning, ExternalLink,
  Cpu, Layers, Database, Filter, XCircle, PauseOctagon, GraduationCap, TrendingUp, Users, Zap, FileSearch, BookOpen, 
  RotateCcw, Check, RefreshCw
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProspectLead, SourceEvidence } from '../types';

interface ManualSearchProps {
  onSearch: (leads: ProspectLead[]) => void;
  onStatusUpdate: (msg: string) => void;
  selectedUf?: string;
}

const VERTICALS = [
  { id: 'GRAOS', label: 'Grãos (Soja/Milho)', icon: <Wheat size={14} />, keywords: ['soja', 'milho', 'armazém', 'silo', 'grãos'] },
  { id: 'PECUARIA', label: 'Pecuária Intensiva', icon: <Tractor size={14} />, keywords: ['bovino', 'rebanho', 'confinamento', 'gado', 'carne', 'pastagem'] },
  { id: 'ALGODAO', label: 'Algodão & Fibras', icon: <Sprout size={14} />, keywords: ['pluma', 'algodoeira', 'proalmat', 'fibra', 'fardo'] },
  { id: 'INDUSTRIA', label: 'Agroindústria', icon: <Factory size={14} />, keywords: ['usina', 'frigorífico', 'processamento', 'beneficiamento', 'fábrica'] },
];

const VERTICAL_BOOSTERS: Record<string, string> = {
  'GRAOS': '("soja" OR "milho" OR "armazém" OR "silo")',
  'ALGODAO': '("pluma" OR "beneficiário" OR "PROALMAT")',
  'PECUARIA': '("rebanho" OR "carne" OR "bovino" OR "fazenda de gado")',
  'INDUSTRIA': '("agroindústria" OR "beneficiamento" OR "processamento")'
};

const SEARCH_PHASES = [
  { id: 1, label: "INICIALIZAÇÃO TÁTICA", desc: "Configurando parâmetros..." },
  { id: 2, label: "VARREDURA JURÍDICA & FISCAL", desc: "Consultando bases governamentais..." },
  { id: 3, label: "VARREDURA AMBIENTAL & FUNDIÁRIA", desc: "Buscando Licenças, CAR e SIGEF..." },
  { id: 4, label: "MAPEAMENTO DE GRUPOS ECONÔMICOS", desc: "Identificando Holdings e Fazendas Corporativas..." },
  { id: 5, label: "MODO SOMBRA PDF", desc: "Análise profunda de documentos detectados..." },
  { id: 6, label: "INVESTIGAÇÃO DE SUCESSÃO", desc: "Localizando herdeiros no LinkedIn..." },
  { id: 7, label: "MAPEAMENTO DE GATEKEEPERS", desc: "Identificando contadores e assessores..." },
  { id: 8, label: "CÁLCULO DE PROPENSÃO", desc: "Predictive Scoring via Gemini AI..." },
  { id: 9, label: "CONSOLIDAÇÃO FINAL", desc: "Unificando inteligência..." }
];

const SURNAME_STOPWORDS = ['FILHO', 'NETO', 'JUNIOR', 'SOBRINHO', 'DA', 'DOS', 'DE', 'DO', 'DAS', 'DI', 'SILVA', 'SANTOS', 'OLIVEIRA', 'SOUZA', 'RODRIGUES', 'FERREIRA'];

const normalizeString = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const isValidCPF = (cpf: string) => {
    const clean = cpf.replace(/[^\d]+/g, '');
    if (clean.length !== 11 || !!clean.match(/(\d)\1{10}/)) return false;
    let soma = 0; let resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(clean.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(clean.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(clean.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(clean.substring(10, 11))) return false;
    return true;
};

const maskCPF = (cpf: string) => {
    const clean = cpf.replace(/\D/g, '');
    if (!isValidCPF(clean)) return "CPF INVÁLIDO";
    return `***.${clean.substring(3, 6)}.***-${clean.substring(9, 11)}`;
};

const cleanNamePF = (rawName: string): string => {
    if (!rawName) return "NOME DESCONHECIDO";
    let clean = rawName.replace(/\b(CPF|RG|CNPJ|PRODUTOR|RURAL|FAZENDA|SITIO|VILA|RUA|AVENIDA|LTDA|S\/A)\b/gi, '').trim();
    clean = clean.replace(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '');
    clean = clean.replace(/\s+/g, ' ').trim().toUpperCase();
    return clean;
};

const extractSurname = (fullName: string): string | null => {
    const parts = fullName.split(' ');
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1].toUpperCase();
    if (last.length >= 3 && !SURNAME_STOPWORDS.includes(last)) return last;
    if (parts.length >= 3) {
        const penult = parts[parts.length - 2].toUpperCase();
        if (penult.length >= 3 && !SURNAME_STOPWORDS.includes(penult)) return penult;
    }
    return null;
};

// --- 1. BADGES SIMPLIFICADOS (REGRA 3) ---
const normalizeSource = (source: string): string => {
  const s = source.toUpperCase();
  if (s.includes("DIARIO") || s.includes("DIÁRIO") || s.includes("OFICIAL") || s.includes("DOE")) return "Diário Oficial";
  if (s.includes("SEMA") || s.includes("MEIO AMBIENTE") || s.includes("LICENCA")) return "SEMA-MT";
  if (s.includes("INCRA") || s.includes("SIGEF") || s.includes("TERRA") || s.includes("CERTIFICADO") || s.includes("CCIR")) return "INCRA/SIGEF";
  if (s.includes("RECEITA") || s.includes("FEDERAL")) return "Receita Federal";
  if (s.includes("JUSBRASIL") || s.includes("TRIBUNAL") || s.includes("PROCESSO")) return "Judiciário";
  if (s.includes("SINDICATO") || s.includes("RURAL")) return "Sindicato Rural";
  if (s.includes("LINKEDIN")) return "LinkedIn";
  return "Web Pública";
};

// --- 2. ENGENHARIA DE HECTARES (REGRA 4) ---
const parseAgroHectares = (val: any): number => {
  if (!val) return 0;
  let clean = String(val).trim().replace(/[^\d.,]/g, '');
  // Regra: 210.015 com 3 casas decimais -> trata ponto como vírgula (decimal)
  if (clean.includes('.') && clean.split('.').pop()?.length === 3 && !clean.includes(',')) {
    return parseFloat(clean); 
  }
  // Regra: 1.250,50 -> remove ponto, troca vírgula por ponto
  clean = clean.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

// --- 3. SANITIZAÇÃO DE URL E AUDITORIA (REGRA 4) ---
const sanitizeUrl = (url: string, city: string): string => {
  if (!url) return "";
  let cleanUrl = url.trim();
  
  if (cleanUrl.startsWith("http")) return cleanUrl;
  
  // Reconstrução Inteligente baseada na Cidade/Contexto
  const cityNorm = normalizeString(city);
  
  if (cityNorm.includes("CAMPO VERDE")) {
      return `https://sindruralcampoverde.com.br/${cleanUrl.replace(/^\//, '')}`;
  }
  if (cleanUrl.includes("iomat")) {
      return `https://www.iomat.mt.gov.br/portal/visualizacoes/pdf/${cleanUrl.replace(/\D/g, '')}`;
  }
  
  // Fallback seguro
  return `https://${cleanUrl}`;
};

export const ManualSearch: React.FC<ManualSearchProps> = ({ onSearch, onStatusUpdate, selectedUf }) => {
  const [mode, setMode] = useState<'GEO' | 'NAME'>('GEO');
  const [uf, setUf] = useState(selectedUf || 'MT');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>(['GRAOS']);
  const [directName, setDirectName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [subPhaseLog, setSubPhaseLog] = useState<string>("");
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [verticalMismatch, setVerticalMismatch] = useState<{detected: string, label: string} | null>(null);
  
  const runIdRef = useRef(0);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setCities(data.map((c: any) => c.nome).sort());
    });
  }, [uf]);

  useEffect(() => { if (selectedUf) setUf(selectedUf); }, [selectedUf]);

  const toggleVertical = (id: string) => { 
    if (runningRef.current) return;
    setSelectedVerticals(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]); 
  };
  
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  const addLog = (msg: string) => { setScanLog(prev => [msg, ...prev]); setSubPhaseLog(msg); };
  
  const handleCancel = () => { 
    runIdRef.current++; 
    if (abortRef.current) abortRef.current.abort();
    runningRef.current = false;
    setIsScanning(false); 
    setCurrentPhase(0); 
    setSubPhaseLog("Cancelado pelo usuário.");
    onStatusUpdate("Operação abortada."); 
    addLog("🛑 Varredura interrompida pelo usuário.");
  };

  const handleReset = () => {
    runIdRef.current++;
    runningRef.current = false;
    setIsScanning(false);
    setCurrentPhase(0);
    setScanLog([]);
    setSearchResult(null);
    setSubPhaseLog("");
    setVerticalMismatch(null);
  };

  const getAgroSignatureDorks = (city: string, uf: string, verticals: string[]) => {
    const boost = verticals.map(vid => VERTICAL_BOOSTERS[vid] || '').join(' OR ');
    return [
        `filetype:pdf intext:CPF intext:CCIR (${boost}) "${city}" "${uf}"`,
        `site:doe.${uf.toLowerCase()}.gov.br "${city}" intext:CPF ("produtor rural" OR "licença")`,
        `site:sindrural*.com.br "${city}" intext:associado`,
        `intext:"fazenda" intext:CPF intext:"hectares" "${city}" -site:jusbrasil.com.br`
    ].join(' OR ');
  };

  const executeMicroRequest = async (ai: GoogleGenAI, context: string, label: string, dorks: string, myRunId: number, phase: number) => {
    if (myRunId !== runIdRef.current) return [];
    
    addLog(`🔍 EXEC: ${label}`);
    
    const prompt = phase === 4 
      ? `ATUE COMO: Auditor de Inteligência de Mercado.
         ALVO: Encontrar entidades comerciais vinculadas ao sobrenome "${context.split(' ')[0]}" em "${context.split(' ').slice(1).join(' ')}".
         DORKS: ${dorks}
         
         REGRAS RÍGIDAS:
         1. Ignore resultados que NÃO contenham o sobrenome "${context.split(' ')[0]}" no nome da entidade.
         2. Busque por "Grupo", "Agropecuária", "Fazenda", "Holding".
         3. A cidade DEVE ser ${context.split(' ').slice(1).join(' ')}.
         
         EXTRAÇÃO: Nome da Entidade, Cidade, Fonte, URL.
         ADICIONE CAMPO "is_group": true.
         OUTPUT JSON ARRAY.`
      : `ATUE COMO: Auditor Agro. CONTEXTO: ${context}. DORKS: ${dorks}. 
         EXTRAÇÃO: Nome Completo, CPF, Cidade (Obrigatório), Hectares (Exato), Fonte, Contexto (Resumo da atividade), URL. 
         REGRAS: Ignore se a cidade não for ${context.split('/')[0]}. 
         OUTPUT JSON ARRAY.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
        });
        
        if (myRunId !== runIdRef.current) return [];
        
        try {
            return JSON.parse(response.text || '[]');
        } catch (e) {
            console.error(`[${label}] Erro no parse JSON:`, e);
            return [];
        }
    } catch (e) {
        console.error(`[${label}] Erro na chamada Gemini:`, e);
        return [];
    }
  };

  const processAndMapResults = (items: any[], leadsMap: Map<string, ProspectLead>, surnameMap: Map<string, number>, targetCity: string, hasGroupFound: boolean = false) => {
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
       const itemCity = normalizeString(item.Cidade || item.city || "");
       const targetCityNorm = normalizeString(targetCity);
       if (itemCity && !itemCity.includes(targetCityNorm) && !targetCityNorm.includes(itemCity)) {
           continue; 
       }

       const rawCpf = item.CPF || item.cpf_found || "";
       if (!rawCpf || rawCpf === "Não Informado") continue;

       const cpfDigits = rawCpf.replace(/\D/g, '');
       if (cpfDigits.length < 5) continue; 

       // 🔒 1. BLINDAGEM ANTI-DUPLICIDADE REFORÇADA
       // Se o ID já existir, ignora completamente para evitar duplicação visual.
       if (leadsMap.has(cpfDigits)) {
           continue; 
       }

       const name = cleanNamePF(item["Nome Completo"] || item["Nome da Entidade"] || item.full_name || "PRODUTOR IDENTIFICADO");
       
       const surname = extractSurname(name);
       if (surname) surnameMap.set(surname, (surnameMap.get(surname) || 0) + 1);

       // 2. Normalização de Hectares (parseAgroHectares)
       const rawHectares = item.Hectares?.toString() || "0";
       const hectaresAtual = parseAgroHectares(rawHectares);

       // 3. Simplificação de Fontes (Badges)
       const sourceRaw = item.Fonte || item.badge_source || "Web Pública";
       const sourceLabel = normalizeSource(sourceRaw);

       const url = sanitizeUrl(item.URL || item.evidence_url || "", targetCity);
       const formato = url.split('.').pop()?.toUpperCase().substring(0, 3) || "WEB";
       const contexto = item.Contexto || "Registro Fundiário Identificado";

       // Criação de NOVO LEAD (Já verificado acima que não existe)
       const isBigFish = hectaresAtual > 1000;
       
       leadsMap.set(cpfDigits, {
           id: `pf-${cpfDigits}-${Date.now()}-${Math.random()}`,
           companyName: name,
           tradeName: `PRODUTOR RURAL (PF)`,
           cnpj: maskCPF(rawCpf),
           city: targetCity.toUpperCase(),
           uf: uf,
           isValidated: true,
           capitalSocial: hectaresAtual * 50000, 
           confidence: isBigFish ? 95 : 70,
           score: isBigFish ? 98 : 75,
           isSA: false,
           isMatriz: true,
           activityCount: 1,
           contactType: 'Direto',
           priority: isBigFish ? 90 : 60,
           businessType: 'Produtor Rural (PF)',
           fitLevel: 'Sim',
           sizeInfo: `${hectaresAtual} ha`,
           source: 'Grounding',
           bestEvidenceUrl: url,
           notes: contexto,
           tacticalAnalysis: { 
               badges: [], 
               goldenHook: '', 
               verticalizationScore: 0, 
               salesComplexity: 'TRANSACIONAL' 
           },
           metadata: {
               hectaresTotal: hectaresAtual,
               fontes: [sourceLabel],
               formatos: [formato],
               urls: [url],
               contextos: [contexto],
               hasGroup: hasGroupFound
           }
       } as ProspectLead);
    }
  };

  const handleSearch = async (reScanVertical?: string) => {
    if (runningRef.current) return;
    
    const activeVerticals = reScanVertical ? [reScanVertical] : selectedVerticals;
    if (reScanVertical) setSelectedVerticals([reScanVertical]);

    if ((mode === 'GEO' && !selectedCity) || (mode === 'NAME' && !directName) || activeVerticals.length === 0) return;
    
    const apiKey = process.env.API_KEY; 
    if (!apiKey) return;

    runningRef.current = true;
    const myRunId = ++runIdRef.current;
    abortRef.current = new AbortController();

    const targetCity = mode === 'GEO' ? selectedCity : (directName || 'Busca Global');
    
    setIsScanning(true); 
    setScanLog([]); 
    setSearchResult(null); 
    setVerticalMismatch(null);
    setCurrentPhase(1);
    
    onStatusUpdate(`🛰️ Sara: Iniciando varredura PF em ${targetCity}...`);
    
    const ai = new GoogleGenAI({ apiKey });
    const leadsMap = new Map<string, ProspectLead>();
    const surnameFreqMap = new Map<string, number>();

    try {
      if (myRunId !== runIdRef.current) return;
      addLog(`Definindo perímetro: ${targetCity} / ${uf}`); 
      await delay(300);

      const agroSignatureDorks = getAgroSignatureDorks(targetCity, uf, activeVerticals);

      // --- ETAPA 2 ---
      if (myRunId !== runIdRef.current) return;
      setCurrentPhase(2);
      const res2 = await executeMicroRequest(ai, targetCity, "Jurídico & Fiscal", agroSignatureDorks, myRunId, 2);
      processAndMapResults(res2, leadsMap, surnameFreqMap, targetCity);
      
      // --- ETAPA 3 ---
      if (myRunId !== runIdRef.current) return;
      setCurrentPhase(3);
      const res3 = await executeMicroRequest(ai, targetCity, "Ambiental & Fundiário", agroSignatureDorks, myRunId, 3);
      processAndMapResults(res3, leadsMap, surnameFreqMap, targetCity);

      // --- ETAPA 4: MAPEAMENTO DE GRUPOS ECONÔMICOS ---
      if (myRunId !== runIdRef.current) return;
      setCurrentPhase(4);
      // Pega os sobrenomes mais frequentes das fases anteriores
      const hotSurnames = Array.from(surnameFreqMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
      
      for (const surname of hotSurnames) {
          if (myRunId !== runIdRef.current) break;
          
          // Dorks agressivas para encontrar a PJ do grupo
          const groupDorks = `("Grupo ${surname}" OR "Agropecuária ${surname}" OR "Fazenda ${surname}" OR "${surname} Agronegócios") "${targetCity}"`;
          
          // Contexto envia sobrenome e cidade para o prompt específico
          const contextStr = `${surname} ${targetCity}`;
          
          const resGroup = await executeMicroRequest(ai, contextStr, `Grupo Econômico ${surname}`, groupDorks, myRunId, 4);
          processAndMapResults(resGroup, leadsMap, surnameFreqMap, targetCity, true); // true = hasGroupFound
      }

      // --- ETAPA 5 ---
      if (myRunId === runIdRef.current) {
        setCurrentPhase(5);
        await delay(500);
      }

      // --- ETAPA FINAL ---
      if (myRunId === runIdRef.current) {
        const finalLeads = Array.from(leadsMap.values());
        if (finalLeads.length > 0) {
            onSearch(finalLeads); 
            setSearchResult(`Varredura completa: ${finalLeads.length} produtores identificados.`);
            setCurrentPhase(9);
        } else {
            setSearchResult("Dados capturados, mas não foi possível validar os CPFs.");
        }
      }

    } catch (e: any) { 
        if (e.name !== 'AbortError') {
           console.error("Erro fatal no pipeline:", e);
           addLog(`❌ ERRO: Falha na varredura. Verifique conexão.`); 
        }
    } finally { 
        if (myRunId === runIdRef.current) { 
            runningRef.current = false;
            setTimeout(() => {
                if (myRunId === runIdRef.current) {
                    setIsScanning(false);
                }
            }, 800);
        } 
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {verticalMismatch && (
        <div className="bg-indigo-600 p-4 rounded-xl shadow-xl border border-indigo-400 animate-in slide-in-from-top-4 duration-500 z-50">
           <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg text-white"><Zap size={18} fill="currentColor" /></div>
              <div className="flex-1">
                 <h4 className="text-white text-xs font-black uppercase tracking-tight">Detectei sinais de {verticalMismatch.label}</h4>
                 <p className="text-indigo-100 text-[10px] mt-1">Deseja alternar a busca para focar nesta vertical?</p>
                 <div className="flex gap-2 mt-3">
                    <button onClick={() => handleSearch(verticalMismatch.detected)} className="flex-1 py-1.5 bg-white text-indigo-700 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 shadow-sm"><RotateCcw size={12}/> Alternar</button>
                    <button onClick={() => setVerticalMismatch(null)} className="py-1.5 px-4 bg-indigo-500/30 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-500/50">Manter</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {!isScanning && currentPhase === 0 && (
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          <button onClick={() => setMode('GEO')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${mode === 'GEO' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}><MapPin size={12} /> Perímetro</button>
          <button onClick={() => setMode('NAME')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${mode === 'NAME' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}><Search size={12} /> Nome Alvo</button>
        </div>
      )}

      {isScanning || currentPhase > 0 ? (
        <div className="space-y-4">
           <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2"><Cpu className="w-4 h-4 text-teal-600 animate-pulse" /> Radar Multi-Espectral</h3>
                 {isScanning ? (
                    <button onClick={handleCancel} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold flex items-center gap-1 hover:bg-red-100"><XCircle size={12} /> Abortar</button>
                 ) : (
                    <button onClick={handleReset} className="text-[10px] bg-white text-slate-600 px-2 py-1 rounded border border-slate-200 font-bold flex items-center gap-1 hover:bg-slate-50 hover:text-indigo-600 shadow-sm"><RefreshCw size={12} /> Nova Busca</button>
                 )}
              </div>
              <div className="space-y-3 relative">
                 <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-slate-100"></div>
                 {SEARCH_PHASES.map((phase) => {
                   const isActive = currentPhase === phase.id; const isDone = currentPhase > phase.id;
                   return (
                     <div key={phase.id} className={`relative z-10 flex items-start gap-3 transition-all ${isActive || isDone ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-200' : isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>{isDone ? <Check size={12} /> : phase.id}</div>
                        <div className="flex-1">
                           <h4 className={`text-[10px] font-bold uppercase ${isActive ? 'text-teal-700' : 'text-slate-600'}`}>{phase.label}</h4>
                           {isActive && <p className="text-[10px] text-teal-600 font-mono mt-1 animate-pulse flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> {subPhaseLog}</p>}
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
           <div className="bg-slate-900 rounded-xl p-3 font-mono text-[10px] text-green-400 border border-slate-700 shadow-inner h-32 overflow-hidden flex flex-col-reverse">
              {scanLog.slice(0, 8).map((log, i) => (
                <div key={i} className="opacity-80 first:opacity-100 whitespace-nowrap overflow-hidden text-ellipsis"><span className="opacity-40 mr-2">{'>'}</span> {log}</div>
              ))}
           </div>
        </div>
      ) : (
        <div className="space-y-4">
          {searchResult && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-3 animate-in zoom-in-95">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800">{searchResult}</span>
            </div>
          )}
          {mode === 'GEO' ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1"><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">UF</label><select value={uf} onChange={e => setUf(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:border-teal-500 outline-none"><option value="MT">MT</option><option value="GO">GO</option><option value="PR">PR</option><option value="BA">BA</option></select></div>
                <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Município</label><select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:border-teal-500 outline-none"><option value="">Selecione...</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {VERTICALS.map(v => (
                  <button key={v.id} onClick={() => toggleVertical(v.id)} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${selectedVerticals.includes(v.id) ? 'bg-teal-50 border-teal-200 text-teal-800 ring-1 ring-teal-200 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}>
                    <div className={`p-1.5 rounded-md ${selectedVerticals.includes(v.id) ? 'bg-white text-teal-600' : 'bg-slate-50'}`}>{selectedVerticals.includes(v.id) ? <CheckCircle2 size={14} /> : v.icon}</div>
                    <span className="text-[10px] font-bold uppercase">{v.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
             <div className="space-y-2"><label className="text-[9px] font-bold text-slate-400 uppercase block">Nome do Produtor</label><input type="text" value={directName} onChange={e => setDirectName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-teal-500 outline-none" placeholder="Ex: Eloi Marchett" /></div>
          )}
          <button 
            onClick={() => handleSearch()} 
            disabled={(mode === 'GEO' && !selectedCity) || (mode === 'NAME' && !directName) || selectedVerticals.length === 0 || runningRef.current} 
            className="w-full py-4 bg-teal-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-teal-700 transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            <Crosshair size={16} className="group-hover:rotate-90 transition-all duration-500" /> 
            {runningRef.current ? 'Varredura em Curso...' : 'Iniciar Caçada Digital'}
          </button>
        </div>
      )}
    </div>
  );
};
