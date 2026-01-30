
import React, { useEffect, useRef } from 'react';
import { Terminal, Cpu, Globe } from 'lucide-react';

interface Props {
  status: string;
  isAuditing: boolean;
}

export const AuditConsole: React.FC<Props> = ({ status, isAuditing }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden mb-8">
      <div className="bg-slate-800/50 px-5 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sara AI Auditor v2.1</span>
        </div>
        <div className="flex gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isAuditing ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`}></div>
          <div className={`w-2 h-2 rounded-full ${isAuditing ? 'bg-emerald-500 animate-pulse delay-75' : 'bg-slate-600'}`}></div>
        </div>
      </div>
      
      <div className="p-5 flex items-center gap-4 bg-slate-900">
         <div className={`p-2 rounded-lg ${isAuditing ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
            {isAuditing ? <Globe className="animate-spin" size={20} /> : <Cpu size={20} />}
         </div>
         <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Status do Sistema:</p>
            <p className="text-sm font-medium text-white italic truncate leading-none">
              "{status}"
            </p>
         </div>
      </div>
    </div>
  );
};
