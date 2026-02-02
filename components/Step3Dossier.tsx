import React, { useMemo } from 'react';
import { ProspectLead, SeniorAgroScoreResult, ScorePillar, AccountData, Evidence } from '../types';
import { analyzeLeadIntelligence } from '../services/intelligenceService';
import { 
  Trophy, Target, Users, TrendingUp, ShieldCheck, 
  BrainCircuit, ArrowRight, ArrowLeft, CheckCircle2, FileText
} from 'lucide-react';

interface Step3Props {
  data: AccountData;
  initialLead: ProspectLead;
  evidenceList: Evidence[];
  setDossierContent: (content: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const Step3Dossier: React.FC<Step3Props> = ({ data, initialLead, evidenceList, setDossierContent, onNext, onBack }) => {
  
  // Constroi o Lead composto combinando dados iniciais + edições + evidências
  const compositeLead: ProspectLead = useMemo(() => {
    return {
      ...initialLead,
      companyName: data.companyName || initialLead.companyName,
      cnpj: data.cnpj || initialLead.cnpj,
      city: data.municipality || initialLead.city,
      uf: data.uf || initialLead.uf,
      // Concatenar notas para enriquecer análise de texto
      notes: (initialLead.notes || '') + ' ' + evidenceList.map(e => e.text).join(' '),
      // Preserva metadados críticos
      capitalSocial: initialLead.capitalSocial,
      cnaes: initialLead.cnaes
    };
  }, [data, initialLead, evidenceList]);

  // O Motor SAS 4.0 roda aqui em tempo real
  const intelligence = useMemo(() => analyzeLeadIntelligence(compositeLead), [compositeLead]);
  const { totalScore, tier, pillars, recommendedSolutions, auditLog } = intelligence;

  // Configuração Visual dos Tiers (Cores e Ícones)
  const tierConfig: any = {
    BRONZE: { 
      color: 'text-orange-700 bg-orange-50 border-orange-200', 
      bar: 'bg-orange-500',
      label: 'Lead em Desenvolvimento'
    },
    PRATA: { 
      color: 'text-slate-700 bg-slate-50 border-slate-200', 
      bar: 'bg-slate-500',
      label: 'Lead Comercial (SMB)'
    },
    OURO: { 
      color: 'text-amber-700 bg-amber-50 border-amber-200', 
      bar: 'bg-amber-500',
      label: 'Lead Estratégico (Corporate)'
    },
    DIAMANTE: { 
      color: 'text-cyan-700 bg-cyan-50 border-cyan-200 shadow-lg shadow-cyan-100/50', 
      bar: 'bg-cyan-500',
      label: 'Conta Nomeada (Enterprise)'
    },
  };

  const style = tierConfig[tier] || tierConfig.BRONZE;

  const handleNext = () => {
    // Gera o conteúdo Markdown baseado no Score para o Step 4 (Exportação)
    const report = `
# Dossiê Estratégico: ${compositeLead.companyName}
**Data:** ${new Date().toLocaleDateString('pt-BR')}

---

## 🏆 Senior Agro Score (SAS 4.0)
**Pontuação:** ${totalScore}/1000  
**Classificação:** ${tier} (${style.label})

---

## 🎯 Estratégia Recomendada
${recommendedSolutions.length > 0 ? recommendedSolutions.map(s => `- **${s}**`).join('\n') : '- Análise em andamento.'}

---

## 📊 Detalhamento dos 4 Pilares

### 1. Músculo (Escala e Ativos)
**Score:** ${pillars.musculo.score}/250
${pillars.musculo.details.map(d => `- ${d}`).join('\n')}

### 2. Complexidade Operacional
**Score:** ${pillars.complexidade.score}/250
${pillars.complexidade.details.map(d => `- ${d}`).join('\n')}

### 3. Gente & Governança (Risco)
**Score:** ${pillars.gente.score}/250
${pillars.gente.details.map(d => `- ${d}`).join('\n')}

### 4. Momento & Maturidade
**Score:** ${pillars.momento.score}/250
${pillars.momento.details.map(d => `- ${d}`).join('\n')}

---

## 📝 Log de Auditoria
Principais evidências que compuseram este score:
${auditLog.map(l => `- ${l}`).join('\n')}

---
*Gerado automaticamente pelo Senior Scout 360.*
`;
    setDossierContent(report);
    onNext();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. O PLACAR (SCOREBOARD) */}
      <div className={`rounded-2xl border-2 p-6 flex items-center justify-between ${style.color}`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-widest">{tier}</h2>
          </div>
          <p className="text-sm opacity-80 font-medium">{style.label}</p>
          <p className="text-xs mt-1 opacity-60 font-mono">CNPJ: {compositeLead.cnpj}</p>
        </div>
        
        <div className="text-right">
          <div className="text-5xl font-black tracking-tighter">
            {totalScore}
            <span className="text-lg font-medium opacity-50 text-slate-500">/1000</span>
          </div>
          <div className="text-xs font-bold uppercase mt-1 opacity-70">Senior Agro Score (SAS)</div>
        </div>
      </div>

      {/* 2. OS 4 PILARES (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PillarCard 
          icon={<TrendingUp />} 
          data={pillars.musculo} 
          color="bg-blue-600" 
          desc="Escala e Ativos"
        />
        <PillarCard 
          icon={<BrainCircuit />} 
          data={pillars.complexidade} 
          color="bg-purple-600" 
          desc="Dor Operacional"
        />
        <PillarCard 
          icon={<Users />} 
          data={pillars.gente} 
          color="bg-pink-600" 
          desc="Risco HCM & Fiscal"
        />
        <PillarCard 
          icon={<Target />} 
          data={pillars.momento} 
          color="bg-green-600" 
          desc="Maturidade Digital"
        />
      </div>

      {/* 3. A ESTRATÉGIA (O QUE VENDER?) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600" />
          Estratégia Recomendada
        </h3>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {recommendedSolutions.length > 0 ? recommendedSolutions.map((sol, idx) => (
            <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold text-sm">
              {sol}
            </span>
          )) : (
            <span className="text-slate-400 italic text-sm">Nenhuma recomendação específica.</span>
          )}
        </div>

        {/* LOG DE AUDITORIA (POR QUE ESSE SCORE?) */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Evidências Detectadas (Fatores de Score)</h4>
          <ul className="space-y-1">
            {auditLog.map((log, idx) => (
              <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                <CheckCircle2 size={12} className="mt-0.5 text-green-500 shrink-0" />
                {log}
              </li>
            ))}
            {auditLog.length === 0 && <li className="text-xs text-slate-400 italic">Nenhum fator de destaque encontrado.</li>}
          </ul>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-between pt-4 border-t border-slate-100">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <button 
          onClick={handleNext}
          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1 text-sm"
        >
          Gerar PDF Final
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

// Sub-componente para os Cards dos Pilares (Limpeza de Código)
const PillarCard = ({ icon, data, color, desc }: { icon: any, data: ScorePillar, color: string, desc: string }) => {
  // Calcula porcentagem da barra (max 250pts)
  const percent = Math.min(100, (data.score / 250) * 100);

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-white ${color} bg-opacity-90`}>
            {React.cloneElement(icon, { size: 20 })}
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">{data.name}</h4>
            <p className="text-[10px] text-slate-400 uppercase font-bold">{desc}</p>
          </div>
        </div>
        <span className="text-xl font-bold text-slate-700">{data.score}</span>
      </div>

      {/* Barra de Progresso */}
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
        <div 
          className={`h-full ${color} transition-all duration-1000 ease-out`} 
          style={{ width: `${percent}%` }}
        />
      </div>
      
      {/* Detalhe do Topo (Motivo Principal) */}
      <p className="text-[10px] text-slate-500 truncate h-4" title={data.details[0]}>
        {data.details[0] || "Dados insuficientes"}
      </p>
    </div>
  );
};

export default Step3Dossier;