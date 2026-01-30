import React, { useState } from 'react';
import { Evidence } from '../types';
import { Plus, Link as LinkIcon, FileText, File } from 'lucide-react';

interface Props {
  onAdd: (evidence: Evidence) => void;
}

export const ManualEvidenceForm: React.FC<Props> = ({ onAdd }) => {
  const [form, setForm] = useState<{
    type: 'texto' | 'url' | 'pdf';
    source: string;
    text: string;
    url: string;
  }>({
    type: "texto",
    source: "",
    text: "",
    url: "",
  });

  const handleSubmit = () => {
    // Validações
    if (form.text.length < 10) {
      alert("Texto deve ter no mínimo 10 caracteres");
      return;
    }
    if (form.type === "url" && !form.url.includes('.')) {
      alert("URL inválida");
      return;
    }

    const newEvidence: Evidence = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'Manual',
      title: form.source || "Evidência Manual",
      snippet: form.text,
      text: form.text,
      url: form.url || undefined,
      source: form.source || "Interno",
      type: form.type,
      selected: true,
      createdAt: new Date().toISOString()
    };

    onAdd(newEvidence);
    setForm({ type: "texto", source: "", text: "", url: "" });
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 shadow-sm">
      <h3 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4" /> Adicionar Evidência Manual
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-amber-800 mb-1">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'texto' | 'url' | 'pdf' })}
            className="w-full p-2 text-sm border border-amber-200 rounded-lg bg-white focus:ring-amber-500"
          >
            <option value="texto">Texto / Nota</option>
            <option value="url">Link / URL</option>
            <option value="pdf">Documento PDF</option>
          </select>
        </div>
        
        <div className="md:col-span-9">
          <label className="block text-xs font-medium text-amber-800 mb-1">Fonte / Origem</label>
          <input
            type="text"
            placeholder="Ex: CRM, E-mail, Relatório Anual..."
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="w-full p-2 text-sm border border-amber-200 rounded-lg focus:ring-amber-500"
          />
        </div>

        <div className="md:col-span-12">
          <label className="block text-xs font-medium text-amber-800 mb-1">Conteúdo / Observação</label>
          <textarea
            rows={2}
            placeholder="Cole o trecho relevante ou digite sua observação..."
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            className="w-full p-2 text-sm border border-amber-200 rounded-lg focus:ring-amber-500"
          />
        </div>

        {form.type === "url" && (
          <div className="md:col-span-12">
            <label className="block text-xs font-medium text-amber-800 mb-1">URL</label>
            <input
              type="text"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full p-2 text-sm border border-amber-200 rounded-lg focus:ring-amber-500"
            />
          </div>
        )}

        <div className="md:col-span-12 flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition shadow-sm"
          >
            Adicionar ao Dossiê
          </button>
        </div>
      </div>
    </div>
  );
};