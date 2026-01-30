
import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { ChevronUp, ChevronDown, Terminal, XCircle, CheckCircle2, Info, AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export const LogConsole: React.FC<Props> = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive if open
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  // Auto-open if an error occurs
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.type === 'error') {
      setIsOpen(true);
    }
  }, [logs]);

  if (logs.length === 0) return null;

  const lastLog = logs[logs.length - 1];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[60] transition-all duration-300 shadow-2xl ${isOpen ? 'h-64' : 'h-10'}`}>
      
      {/* Header / Summary Bar */}
      <div 
        className="h-10 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-mono font-bold uppercase">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Console do Sistema
          </div>
          
          {!isOpen && lastLog && (
             <div className="flex items-center gap-2 text-xs font-mono truncate">
               <span className="text-slate-600">|</span>
               <span className={
                 lastLog.type === 'error' ? 'text-red-400' :
                 lastLog.type === 'success' ? 'text-green-400' :
                 lastLog.type === 'warning' ? 'text-amber-400' : 'text-slate-400'
               }>
                 {lastLog.message}
               </span>
             </div>
          )}
        </div>

        <div className="flex items-center gap-2">
           <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{logs.length} eventos</span>
           {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="h-[calc(100%-2.5rem)] bg-slate-950 text-slate-300 font-mono text-xs overflow-y-auto p-4 custom-scrollbar">
           <div className="flex justify-end mb-2">
             <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-slate-500 hover:text-red-400 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
               <Trash2 className="w-3 h-3" /> Limpar Logs
             </button>
           </div>
           
           <div className="space-y-1.5">
             {logs.map((log) => (
               <div key={log.id} className="flex gap-3 hover:bg-slate-900/50 p-1 rounded -mx-1">
                 <span className="text-slate-600 flex-shrink-0 w-16 text-right">
                   {(log.timestamp.split('T')[1] || '').slice(0,8)}
                 </span>
                 <span className="flex-shrink-0 mt-0.5">
                   {log.type === 'info' && <Info className="w-3 h-3 text-blue-500" />}
                   {log.type === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                   {log.type === 'warning' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                   {log.type === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
                 </span>
                 <span className={`break-words ${
                   log.type === 'error' ? 'text-red-300' : 
                   log.type === 'success' ? 'text-green-300' : 
                   log.type === 'warning' ? 'text-amber-300' : 'text-slate-300'
                 }`}>
                   {log.message}
                 </span>
               </div>
             ))}
             <div ref={messagesEndRef} />
           </div>
        </div>
      )}
    </div>
  );
};
