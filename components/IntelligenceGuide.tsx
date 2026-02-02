import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, TrendingUp, BrainCircuit, Users, Target } from 'lucide-react';

export const IntelligenceGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg mb-6 shadow-sm transition-all duration-300">
      {/* Cabeçalho Acordeão */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors rounded-t-lg border-b border-slate-100"
      >
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm uppercase tracking-wide">
          <HelpCircle size={16} className="text-indigo-600" />
          CRITÉRIOS DE AVALIAÇÃO SAS 4.0 (SCORE 1000)
        </div>
        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {/* Conteúdo Explicativo (Grid de 4 Colunas) */}
      {isOpen && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Pilar 1: Músculo */}
          <div className="flex flex-col gap-2 relative">
            <div className="absolute top-0 right-0 text-[9px] font-bold text-slate-300">MAX 250 PTS</div>
            <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase">
              <TrendingUp size={16} />
              1. Músculo (Escala)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mede o <strong>Tamanho Físico e Financeiro</strong>. Baseado em Hectares produtivos, Capital Social e Verticalização (Silos/Frota). É a base da pirâmide.
            </p>
          </div>

          {/* Pilar 2: Complexidade */}
          <div className="flex flex-col gap-2 relative">
             <div className="absolute top-0 right-0 text-[9px] font-bold text-slate-300">MAX 250 PTS</div>
            <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase">
              <BrainCircuit size={16} />
              2. Complexidade
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mede a <strong>Dor Operacional</strong>. Culturas como Algodão e Sementes (1.5x) ou Indústria (3.0x) exigem muito mais controle sistêmico que Pecuária (0.8x).
            </p>
          </div>

          {/* Pilar 3: Gente */}
          <div className="flex flex-col gap-2 relative">
             <div className="absolute top-0 right-0 text-[9px] font-bold text-slate-300">MAX 250 PTS</div>
            <div className="flex items-center gap-2 text-pink-700 font-bold text-xs uppercase">
              <Users size={16} />
              3. Gente (HCM)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mede o <strong>Risco Trabalhista</strong>. Empresas com muitos funcionários (>200) ou turnos complexos (Usinas) pontuam alto aqui.
            </p>
          </div>

          {/* Pilar 4: Momento */}
          <div className="flex flex-col gap-2 relative">
             <div className="absolute top-0 right-0 text-[9px] font-bold text-slate-300">MAX 250 PTS</div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase">
              <Target size={16} />
              4. Momento
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mede a <strong>Maturidade de Governança</strong>. Estruturas S.A., Holdings, Gestão Profissional e Conectividade no campo indicam prontidão de compra.
            </p>
          </div>

        </div>
      )}
    </div>
  );
};