import React, { useState, useMemo } from 'react';
import { SpiderGraph, SpiderNode } from '../types';
import { Network, User, Building, Layers, Link as LinkIcon, ExternalLink, AlertTriangle, RotateCcw, ZoomIn, Lock, Filter, Eye, Landmark, Sprout, Truck } from 'lucide-react';

interface Props {
  graph: SpiderGraph;
  onExpand?: (nodeId: string) => void;
  onReset?: () => void;
}

export const SpiderGraphPanel: React.FC<Props> = ({ graph, onExpand, onReset }) => {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  
  // Ícones Contextuais
  const getNodeIcon = (node: SpiderNode) => {
    const role = (node.metadata?.role || '').toUpperCase();
    
    if (node.type === 'COMPANY') {
      if (role.includes('HOLDING') || role.includes('INVESTIMENTO')) return <Landmark className="w-4 h-4 text-white" />;
      if (role.includes('RURAL') || role.includes('PLANTIO')) return <Sprout className="w-4 h-4 text-white" />;
      if (role.includes('LOGÍSTICA') || role.includes('TRANSPORTE')) return <Truck className="w-4 h-4 text-white" />;
      return <Building className="w-4 h-4 text-white" />;
    }
    
    if (node.type === 'PERSON') return <User className="w-4 h-4 text-white" />;
    if (node.type === 'GROUP') return <Layers className="w-4 h-4 text-white" />;
    return <Network className="w-4 h-4 text-white" />;
  };

  // Cores por Nível (Solicitação Exata)
  const getNodeColor = (node: SpiderNode) => {
    const level = node.level;
    
    if (level === 1) return 'bg-blue-600 border-blue-700 ring-blue-200'; // Nível 1: Azul
    if (level === 2) return 'bg-green-600 border-green-700 ring-green-200'; // Nível 2: Verde
    if (level >= 3) return 'bg-orange-500 border-orange-600 ring-orange-200'; // Nível 3: Laranja

    return 'bg-slate-400 border-slate-500 ring-slate-200';
  };

  const getLevelBadge = (node: SpiderNode) => {
    const level = node.level;
    const role = node.metadata?.role || '';

    if (level === 1) return <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase tracking-tight">Alvo (N1)</span>;
    if (level === 2) return <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-tight">Conexão (N2)</span>;
    if (level >= 3) return <span className="text-[9px] font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200 uppercase tracking-tight">Expansão (N3)</span>;
    
    return null;
  };

  // --- FILTERING LOGIC ---
  const { displayedNodes, displayedEdges } = useMemo(() => {
    if (!focusedNodeId) {
      return { displayedNodes: graph.nodes, displayedEdges: graph.edges };
    }

    const relevantEdges = graph.edges.filter(e => e.source === focusedNodeId || e.target === focusedNodeId);
    
    const involvedNodeIds = new Set<string>();
    involvedNodeIds.add(focusedNodeId);
    relevantEdges.forEach(e => {
      involvedNodeIds.add(e.source);
      involvedNodeIds.add(e.target);
    });

    const relevantNodes = graph.nodes.filter(n => involvedNodeIds.has(n.id));

    return { displayedNodes: relevantNodes, displayedEdges: relevantEdges };
  }, [graph, focusedNodeId]);

  const handleNodeClick = (nodeId: string, level: number) => {
    if (level >= 3) {
        alert("Limite de profundidade atingido (Nível 3).");
        return; 
    }
    
    if (onExpand) onExpand(nodeId);
    // Não foca automaticamente para permitir ver a expansão acontecer no contexto geral
    // setFocusedNodeId(nodeId); 
  };

  const handleResetAll = () => {
    setFocusedNodeId(null);
    if (onReset) onReset();
  }

  if (!graph || graph.nodes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in mb-6">
      {/* HEADER */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div>
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             <Network className="w-5 h-5 text-indigo-500" /> Mapa de Relacionamentos
           </h3>
           <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
             {focusedNodeId ? (
                <span className="flex items-center gap-1 text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                   <Filter className="w-3 h-3" /> Foco Ativo
                </span>
             ) : (
                <span>Total Mapeado: {graph.nodes.length} Entidades</span>
             )}
           </p>
        </div>
        
        <div className="flex items-center gap-2">
           {focusedNodeId && (
              <button onClick={() => setFocusedNodeId(null)} className="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition flex items-center gap-2">
                 <Eye className="w-3 h-3" /> Ver Todos
              </button>
           )}
           
           {onReset && (
              <button onClick={handleResetAll} className="text-xs text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition flex items-center gap-2 shadow-sm bg-white">
                <RotateCcw className="w-3 h-3" /> Reiniciar Investigação
              </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        
        {/* LEFT COLUMN: NODES (INTERACTIVE) */}
        <div className="p-4 border-r border-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col bg-white">
           <div className="space-y-2 mb-4 flex-1">
             {displayedNodes.map(node => {
               const isLocked = node.level >= 3;
               const isFocused = node.id === focusedNodeId;
               
               return (
                 <div 
                    key={node.id} 
                    onClick={() => handleNodeClick(node.id, node.level)}
                    className={`
                      flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 relative group
                      ${isLocked 
                        ? 'bg-slate-50 border-slate-200 cursor-default opacity-90' 
                        : 'cursor-pointer bg-white border-slate-100 hover:border-indigo-300 hover:shadow-md hover:scale-[1.01]'}
                      ${isFocused ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-500 bg-indigo-50/10' : ''}
                    `}
                 >
                    {/* Icon Circle */}
                    <div className={`
                        p-2 rounded-full shadow-sm border flex-shrink-0 transition-transform 
                        ${getNodeColor(node)} 
                        ${!isLocked && 'group-hover:scale-110'}
                    `}>
                      {isLocked ? <Lock className="w-4 h-4 text-white/90" /> : getNodeIcon(node)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                         <div className={`font-bold text-sm truncate ${isLocked ? 'text-slate-600' : 'text-slate-800'}`}>
                           {node.label}
                         </div>
                         {getLevelBadge(node)}
                      </div>
                      
                      <div className="text-[10px] text-slate-500 uppercase flex gap-2 items-center">
                         <span className="font-semibold tracking-wide">{node.type}</span>
                         {node.metadata?.role && (
                           <>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-slate-500 truncate max-w-[150px]">{node.metadata.role}</span>
                           </>
                         )}
                      </div>
                    </div>
                    
                    {/* Action Hint */}
                    {!isLocked && (
                      <div className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3">
                        <ZoomIn className="w-4 h-4 fill-indigo-50" />
                      </div>
                    )}
                 </div>
               );
             })}
           </div>
        </div>

        {/* RIGHT COLUMN: EDGES */}
        <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/50">
           <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex justify-between items-center">
             <span>Conexões</span>
             <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[10px]">{displayedEdges.length}</span>
           </h4>
           
           <div className="space-y-3">
             {displayedEdges.map(edge => {
               const sourceNode = graph.nodes.find(n => n.id === edge.source);
               const targetNode = graph.nodes.find(n => n.id === edge.target);
               
               return (
                 <div key={edge.id} className="text-sm p-3 border border-slate-200 bg-white rounded-lg shadow-sm relative overflow-hidden group">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${edge.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                    
                    <div className="flex flex-col gap-1 pl-2">
                       <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{sourceNode?.label}</span>
                          <LinkIcon className="w-3 h-3 text-slate-300" />
                          <span>{targetNode?.label}</span>
                       </div>
                       <div className="font-bold text-slate-700 text-xs uppercase bg-slate-100 w-fit px-2 py-0.5 rounded border border-slate-200 mt-1">
                          {edge.relation}
                       </div>
                       {edge.evidence?.snippet && (
                         <div className="text-[10px] text-slate-400 italic mt-1 border-t border-slate-100 pt-1">
                           "{edge.evidence.snippet}"
                         </div>
                       )}
                    </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    </div>
  );
};