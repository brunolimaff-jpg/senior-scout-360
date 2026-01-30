import React, { useRef, useState } from 'react';
import { ProspectLead } from '../types';
import { Download, Upload, Trash2, Table, FileSpreadsheet, FileJson, ArrowRightCircle } from 'lucide-react';
import { CSVImporter } from './CSVImporter';

interface Props {
  leads: ProspectLead[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onImport: (leads: ProspectLead[]) => void;
  onDeepDive: (lead: ProspectLead) => void;
}

export const LeadVault: React.FC<Props> = ({ leads, onRemove, onClear, onImport, onDeepDive }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleDownloadCSV = () => {
    // Cabeçalhos fáceis em português
    const headers = [
      "Empresa", "Cidade", "UF", "Tipo de Negocio", "Tamanho Encontrado", 
      "Aderencia", "Grau Certeza", "Prioridade", "Melhor Evidencia", "Observacao"
    ];
    
    const rows = leads.map(l => [
      l.companyName, l.city, l.uf, l.businessType, l.sizeInfo,
      l.fitLevel, l.confidence, l.priority, l.bestEvidenceUrl, l.notes
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')); // Escape CSV

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cofre-leads_agro-radar_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDownloadJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      source: "Agro Radar (Prospector)",
      leads: leads
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cofre-leads_completo_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed.leads)) {
          onImport(parsed.leads);
          alert(`${parsed.leads.length} leads importados com sucesso!`);
        } else {
          alert("Formato de arquivo inválido. Use o JSON completo exportado pelo sistema.");
        }
      } catch (err) {
        alert("Erro ao ler arquivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  if (leads.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          <Table className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>O cofre está vazio.</p>
          <p className="text-sm mb-6">Salve leads da pesquisa ou importe um arquivo.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 transition cursor-pointer" onClick={handleImportClick}>
                <FileJson className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <span className="font-bold text-slate-600 block">Restaurar Backup JSON</span>
                <span className="text-xs text-slate-400">Dados completos do sistema</span>
             </div>
             
             {/* New CSV Importer Component */}
             <div className="w-full">
                <CSVImporter 
                  onImport={onImport} 
                  onStatusUpdate={(msg) => setStatusMsg(msg)}
                />
                {statusMsg && <p className="text-xs text-slate-500 mt-2 font-mono">{statusMsg}</p>}
             </div>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">Total Salvo: {leads.length}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition">
            <FileSpreadsheet className="w-4 h-4" /> Excel (CSV)
          </button>
          <button onClick={handleDownloadJSON} className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm font-medium transition">
            <FileJson className="w-4 h-4" /> Backup (JSON)
          </button>
          <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-sm font-medium transition">
            <Upload className="w-4 h-4" /> Restaurar
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
          <div className="w-px h-6 bg-slate-300 mx-1"></div>
          <button onClick={onClear} className="text-red-600 hover:text-red-700 px-2 text-sm font-medium flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Limpar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-700 font-semibold">
            <tr>
              <th className="p-3">Empresa</th>
              <th className="p-3">Local</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Prioridade</th>
              <th className="p-3">Aderência</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">
                   {lead.companyName}
                   {lead.source === 'Senior MI' && <span className="ml-2 text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">MI</span>}
                </td>
                <td className="p-3 text-slate-600">{lead.city}/{lead.uf}</td>
                <td className="p-3 text-slate-600">{lead.businessType}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${lead.priority}%` }}></div>
                    </div>
                    <span className="text-xs text-slate-500">{lead.priority}</span>
                  </div>
                </td>
                <td className="p-3">
                   <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      lead.fitLevel === 'Sim' ? 'bg-green-100 text-green-700' : 
                      lead.fitLevel === 'Provável' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                   }`}>
                     {lead.fitLevel}
                   </span>
                </td>
                <td className="p-3 flex justify-center gap-2">
                  <button 
                    onClick={() => onDeepDive(lead)}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs font-bold transition"
                    title="Enviar para Senior Scout (Dossiê)"
                  >
                    Aprofundar <ArrowRightCircle className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => onRemove(lead.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};