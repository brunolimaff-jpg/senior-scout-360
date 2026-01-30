import React, { useState } from 'react';
import { NetworkNode } from '../types';
import { fetchCompanyConnections, fetchPersonAssets } from '../services/networkService';
import { User, Building2, ChevronRight, XCircle, Search, ExternalLink, RefreshCw, ZoomIn } from 'lucide-react';

interface Props {
  rootData: { name: string; cnpj: string };
  nodes: NetworkNode[];
  onNodesChange: (nodes: NetworkNode[]) => void;
}

export const RelationshipWeb: React.FC<Props> = ({ rootData, nodes, onNodesChange }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

  // Initialize with Root if empty
  React.useEffect(() => {
    if (nodes.length === 0 && rootData.name) {
      const initialNode: NetworkNode = { 
        id: 'root-seed', 
        label: rootData.name, 
        type: 'COMPANY', 
        status: 'ACTIVE', 
        cnpj: rootData.cnpj, 
        level: 1 // Level 1: Azul
      };
      onNodesChange([initialNode]);
    }
  }, [rootData, nodes.length]);

  const handleExpand = async (node: NetworkNode) => {
    // 🛑 Bloqueio de Segurança: Empresas Baixadas/Inaptas
    if (node.status === 'INACTIVE') return;

    // Toggle: Se já está aberto, fecha
    if (expandedNodes.includes(node.id)) {
      setExpandedNodes(prev => prev.filter(id => id !== node.id));
      return;
    }

    // Bloqueio Nível 3 (Deep Dive limit)
    if (node.level >= 3) {
       alert("Limite de profundidade atingido (Nível 3).");
       return;
    }

    setLoadingId(node.id);
    let newConnections: NetworkNode[] = [];

    try {
      if (node.type === 'COMPANY') {
        // EMPRESA -> 2 SÓCIOS
        newConnections = await fetchCompanyConnections(node.cnpj || '', node.level, node.id);
      } else if (node.type === 'PERSON') {
        // PESSOA -> 2 EMPRESAS
        newConnections = await fetchPersonAssets(node.label, node.level, node.id);
      }
    } catch (e) {
      console.error(e);
    }

    setLoadingId(null);

    if (newConnections.length > 0) {
      // Filter duplicates
      const uniqueNew = newConnections.filter(n => !nodes.some(ex => ex.id === n.id));
      if (uniqueNew.length > 0) {
         onNodesChange([...nodes, ...uniqueNew]);
      }
      setExpandedNodes(prev => [...prev, node.id]);
    } else {
      if (node.type === 'COMPANY') {
        alert("Nenhum vínculo adicional encontrado na base pública.");
      }
    }
  };

  const handleReset = () => {
    if (confirm("Reiniciar a investigação apagará as conexões expandidas. Confirmar?")) {
        onNodesChange([]); // Effect will re-init
        setExpandedNodes([]);
    }
  };

  const getNodeColorClass = (level: number, type: string) => {
    if (level === 1) return 'bg-blue-100 text-blue-700 border-blue-200'; // Nível 1: Azul
    if (level === 2) return 'bg-green-100 text-green-700 border-green-200'; // Nível 2: Verde
    if (level >= 3) return 'bg-orange-100 text-orange-800 border-orange-200'; // Nível 3: Laranja
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const renderTree = (parentId?: string) => {
    const children = nodes.filter(n => n.parentId === parentId);
    if (children.length === 0 && parentId !== undefined) return null;

    return (
      <div className={`flex flex-col gap-3 ${parentId ? 'ml-8 pl-6 border-l-2 border-slate-200 relative animate-in slide-in-from-left-2' : ''}`}>
        {children.map(node => (
          <div key={node.id} className="relative group">
            
            {/* Conector Horizontal */}
            {parentId && (
              <div className="absolute -left-6 top-6 w-6 h-0.5 bg-slate-200 group-hover:bg-indigo-300 transition-colors"></div>
            )}

            {/* CARD DO NÓ */}
            <div 
              className={`
                relative flex items-center gap-3 p-3 rounded-lg border shadow-sm transition-all w-fit min-w-[320px] pr-4
                ${node.status === 'INACTIVE' 
                  ? 'bg-red-50 border-red-200 opacity-75 grayscale' 
                  : 'bg-white hover:shadow-md cursor-pointer'
                }
                ${node.status === 'ACTIVE' ? 'hover:border-indigo-400' : ''}
              `}
              onClick={() => handleExpand(node)}
            >
              {/* Ícone com Cor de Nível */}
              <div className={`
                p-2 rounded-full shrink-0 border
                ${node.status === 'INACTIVE' ? 'bg-red-100 text-red-500 border-red-200' : getNodeColorClass(node.level, node.type)}
              `}>
                {node.status === 'INACTIVE' ? <XCircle size={18} /> : 
                 node.type === 'COMPANY' ? <Building2 size={18} /> : <User size={18} />}
              </div>

              {/* Informações */}
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-bold truncate ${node.status === 'INACTIVE' ? 'text-red-800 line-through' : 'text-slate-800'}`}>
                  {node.label}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase">
                  {node.type === 'COMPANY' ? (
                     <span>{node.cnpj || 'CNPJ NÃO LOCALIZADO'}</span>
                  ) : (
                     <span>{node.role || 'SÓCIO / VÍNCULO'}</span>
                  )}
                  {node.status === 'INACTIVE' && <span className="font-bold text-red-600">BAIXADA</span>}
                </div>
              </div>

              {/* Ações / Indicadores */}
              <div className="flex items-center gap-1">
                {loadingId === node.id ? (
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"/>
                ) : (
                  <>
                    {/* Seta de Expansão */}
                    {node.status === 'ACTIVE' && node.level < 3 && (
                       <ChevronRight 
                         size={16} 
                         className={`text-slate-300 transition-transform ${expandedNodes.includes(node.id) ? 'rotate-90 text-indigo-500' : 'group-hover:text-indigo-500'}`} 
                       />
                    )}
                    
                    {/* Botão de Link Externo (PF) */}
                    {node.type === 'PERSON' && (
                      <a 
                        href={`https://www.consultasocio.com/q/sa/${node.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()} 
                        className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Investigar em Fonte Externa"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Recursão para filhos */}
            {expandedNodes.includes(node.id) && renderTree(node.id)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px] mb-6 animate-in fade-in">
      {/* Header da Ferramenta */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Search size={16} className="text-indigo-600"/>
            Teia de Relacionamentos (Dossiê)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Clique nos nós para expandir a rede societária.
          </p>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mr-4 font-medium">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Nível 1</span>
                <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Nível 2</span>
                <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Nível 3</span>
            </div>
            <button 
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 transition-colors shadow-sm"
            >
            <RefreshCw size={12} /> Reiniciar Investigação
            </button>
        </div>
      </div>

      {/* Área da Teia (Scrollável) */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50/50 relative">
        <div className="min-w-max pb-10">
           {renderTree(undefined)}
        </div>
      </div>
    </div>
  );
};
