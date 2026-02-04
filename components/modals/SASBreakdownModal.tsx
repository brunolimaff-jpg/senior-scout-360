
import React from 'react';
import { getTierColor, getTierEmoji } from '../../services/marketEstimator';
import type { SASResult } from '../../services/marketEstimator';

interface SASBreakdownModalProps {
  sasResult: SASResult;
  leadName: string;
  onClose: () => void;
}

export function SASBreakdownModal({ sasResult, leadName, onClose }: SASBreakdownModalProps) {
  const tierColor = getTierColor(sasResult.tier);
  const tierEmoji = getTierEmoji(sasResult.tier);
  
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ========== HEADER ========== */}
        <div className={`${tierColor} p-8 text-white relative overflow-hidden`}>
          {/* Botão X MAIOR */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all z-10"
          >
            ✕
          </button>
          
          <div className="text-center relative z-0">
            {/* Emoji grande */}
            <div className="text-7xl mb-4 drop-shadow-md">{tierEmoji}</div>
            
            {/* Score LIMPO */}
            <div className="mb-2 flex items-baseline justify-center gap-2">
              <span className="text-6xl font-black tracking-tighter">{sasResult.sas_final}</span>
              <span className="text-2xl font-bold opacity-90">pts</span>
            </div>
            
            {/* Tier */}
            <div className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">
              Senior Agro Score 4.0
            </div>
            <div className="text-3xl font-black uppercase tracking-tight">
              Tier {sasResult.tier}
            </div>
          </div>
        </div>
        
        {/* ========== BODY: 4 PILARES ========== */}
        <div className="p-6 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            
            {/* Pilar Músculo */}
            <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-100">
              <div className="flex items-center gap-2 mb-3 border-b border-emerald-200 pb-2">
                <span className="text-2xl">💪</span>
                <span className="font-black text-emerald-800 text-sm uppercase">Músculo</span>
                <span className="ml-auto font-bold text-emerald-600 text-xs">Max 400</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-900/70 font-medium">Hectares</span>
                  <span className="font-bold text-emerald-700">{sasResult.breakdown.hectares_pts} pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-900/70 font-medium">Capital</span>
                  <span className="font-bold text-emerald-700">{sasResult.breakdown.capital_pts} pts</span>
                </div>
                <div className="border-t border-emerald-200 pt-2 flex justify-between items-center mt-1">
                  <span className="text-xs font-black text-emerald-800 uppercase">Total</span>
                  <span className="text-lg font-black text-emerald-600">{sasResult.pilar_musculo}</span>
                </div>
              </div>
            </div>
            
            {/* Pilar Complexidade */}
            <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-100">
              <div className="flex items-center gap-2 mb-3 border-b border-purple-200 pb-2">
                <span className="text-2xl">⚡</span>
                <span className="font-black text-purple-800 text-sm uppercase">Complexidade</span>
                <span className="ml-auto font-bold text-purple-600 text-xs">Max 250</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-purple-900/70 font-medium">Cultura</span>
                  <span className="font-bold text-purple-700">{sasResult.breakdown.cultura_pts} pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-900/70 font-medium">Verticalização</span>
                  <span className="font-bold text-purple-700">{sasResult.breakdown.verticalizacao_pts} pts</span>
                </div>
                <div className="border-t border-purple-200 pt-2 flex justify-between items-center mt-1">
                  <span className="text-xs font-black text-purple-800 uppercase">Total</span>
                  <span className="text-lg font-black text-purple-600">{sasResult.pilar_complexidade}</span>
                </div>
              </div>
            </div>
            
            {/* Pilar Gente */}
            <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100">
              <div className="flex items-center gap-2 mb-3 border-b border-blue-200 pb-2">
                <span className="text-2xl">👥</span>
                <span className="font-black text-blue-800 text-sm uppercase">Gente</span>
                <span className="ml-auto font-bold text-blue-600 text-xs">Max 200</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-blue-900/70 font-medium">Funcionários</span>
                  <span className="font-bold text-blue-700">{sasResult.breakdown.funcionarios_pts} pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-900/70 font-medium">Gestão</span>
                  <span className="font-bold text-blue-700">{sasResult.breakdown.gestao_pts} pts</span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between items-center mt-1">
                  <span className="text-xs font-black text-blue-800 uppercase">Total</span>
                  <span className="text-lg font-black text-blue-600">{sasResult.pilar_gente}</span>
                </div>
              </div>
            </div>
            
            {/* Pilar Momento */}
            <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-100">
              <div className="flex items-center gap-2 mb-3 border-b border-amber-200 pb-2">
                <span className="text-2xl">🚀</span>
                <span className="font-black text-amber-800 text-sm uppercase">Momento</span>
                <span className="ml-auto font-bold text-amber-600 text-xs">Max 150</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-amber-900/70 font-medium">Natureza</span>
                  <span className="font-bold text-amber-700">{sasResult.breakdown.natureza_pts} pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-900/70 font-medium">Digital</span>
                  <span className="font-bold text-amber-700">{sasResult.breakdown.presenca_pts} pts</span>
                </div>
                <div className="border-t border-amber-200 pt-2 flex justify-between items-center mt-1">
                  <span className="text-xs font-black text-amber-800 uppercase">Total</span>
                  <span className="text-lg font-black text-amber-600">{sasResult.pilar_momento}</span>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Flags */}
          {(sasResult.flags.s_a || sasResult.flags.sementeiro || sasResult.flags.big_fish) && (
            <div className="flex gap-2 justify-center flex-wrap">
              {sasResult.flags.s_a && (
                <span className="bg-slate-800 text-amber-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm border border-slate-700">
                  🏢 Sociedade Anônima
                </span>
              )}
              {sasResult.flags.sementeiro && (
                <span className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm border border-green-700">
                  🌱 Sementeiro
                </span>
              )}
              {sasResult.flags.big_fish && (
                <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm border border-indigo-700">
                  🐋 Big Fish
                </span>
              )}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
