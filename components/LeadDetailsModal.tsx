import React from 'react';
import { X, MapPin, Award, AlertTriangle, CheckCircle } from 'lucide-react';

// Exportando as interfaces para uso no componente pai
export interface LeadIntelligence {
  score: number;
  products: string[];
  tags: string[];
  is_big_fish: boolean;
}

export interface LeadData {
  status: string;
  company: {
    name: string;
    cnpj: string;
    capital: number;
    location: string;
    activity: string;
  };
  intelligence: LeadIntelligence;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LeadData | null;
}

export function LeadDetailsModal({ isOpen, onClose, data }: ModalProps) {
  if (!isOpen || !data) return null;

  // Define a cor do Score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* CABEÇALHO */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{data.company.name}</h2>
              {data.intelligence.is_big_fish && (
                <span className="px-3 py-1 text-xs font-bold text-white bg-blue-600 rounded-full flex items-center gap-1 shadow-sm">
                  <Award size={14} /> BIG FISH
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 font-mono">{data.company.cnpj}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* CORPO DO DOSSIÊ */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* COLUNA DA ESQUERDA: DADOS CADASTRAIS */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Dados da Empresa</h3>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-3 text-gray-700">
                  <MapPin size={18} className="text-indigo-500" />
                  <span className="font-medium">{data.company.location}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <span className="text-emerald-600 font-bold bg-emerald-100 px-1.5 rounded text-xs">R$</span>
                  <span className="font-medium">Capital: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.company.capital)}</span>
                </div>
                <div className="text-sm text-gray-600 border-t border-gray-200 pt-3 mt-3">
                  <span className="block text-gray-400 text-[10px] uppercase font-bold mb-1">Atividade Principal</span>
                  {data.company.activity}
                </div>
              </div>
            </div>

            {/* TAGS INTELIGENTES */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sinais Táticos (Sara)</h3>
              <div className="flex flex-wrap gap-2">
                {data.intelligence.tags.map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase rounded-md border border-indigo-100">
                    #{tag}
                  </span>
                ))}
                {data.intelligence.tags.length === 0 && <span className="text-gray-400 italic text-sm">Nenhuma tag identificada</span>}
              </div>
            </div>
          </div>

          {/* COLUNA DA DIREITA: INTELIGÊNCIA */}
          <div className="space-y-6">
            
            {/* SCORE CARD */}
            <div className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center ${getScoreColor(data.intelligence.score)}`}>
              <span className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Score de Crédito</span>
              <span className="text-6xl font-black tracking-tighter">{data.intelligence.score}</span>
              <div className="flex items-center gap-2 mt-3 text-sm font-bold uppercase">
                {data.intelligence.score > 50 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {data.intelligence.score >= 80 ? 'Excelente Potencial' : data.intelligence.score > 50 ? 'Potencial Moderado' : 'Alto Risco'}
              </div>
            </div>

            {/* PRODUTOS SUGERIDOS */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Oportunidades Sugeridas</h3>
              <ul className="space-y-2">
                {data.intelligence.products.map((prod, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700 bg-white border border-gray-200 p-2.5 rounded-lg shadow-sm font-medium text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    {prod}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* RODAPÉ */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-bold text-sm hover:text-gray-900 transition-colors">
            Fechar
          </button>
          <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-indigo-200 transition-all transform active:scale-95 flex items-center gap-2">
            <Award size={16} /> Gerar PDF Completo
          </button>
        </div>
      </div>
    </div>
  );
}