
import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, Loader2, Target, Search, FileSpreadsheet, PlusCircle } from 'lucide-react';
import { ProspectLead } from '../types';

interface CSVImporterProps {
  onImport: (leads: ProspectLead[]) => void;
  onStatusUpdate: (msg: string) => void;
}

export const CSVImporter: React.FC<CSVImporterProps> = ({ onImport, onStatusUpdate }) => {
  const [cnpjInput, setCnpjInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingCSV, setIsLoadingCSV] = useState(false);

  // --- LÓGICA SNIPER (ADICIONAR POR CNPJ) ---
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 14) val = val.slice(0, 14);
    
    // Máscara CNPJ
    if (val.length > 12) val = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    else if (val.length > 8) val = val.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, '$1.$2.$3/$4');
    else if (val.length > 5) val = val.replace(/^(\d{2})(\d{3})(\d{1,3}).*/, '$1.$2.$3');
    else if (val.length > 2) val = val.replace(/^(\d{2})(\d{1,3}).*/, '$1.$2');
    
    setCnpjInput(val);
  };

  const handleSniperAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCnpj = cnpjInput.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;

    setIsSearching(true);
    onStatusUpdate(`🎯 Sniper: Localizando alvo ${cnpjInput}...`);

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (response.status === 404) throw new Error('CNPJ não encontrado na Receita.');
      if (response.status === 429) throw new Error('Muitas requisições. Aguarde.');
      if (!response.ok) throw new Error('Erro na consulta.');

      const data = await response.json();
      
      const newLead: ProspectLead = {
        id: `sniper-${cleanCnpj}-${Date.now()}`,
        companyName: data.razao_social || data.nome_fantasia || 'Empresa Sniper',
        cnpj: cnpjInput,
        city: data.municipio || 'N/D',
        uf: data.uf || '--',
        isValidated: false, // Será validado pelo auditor depois
        capitalSocial: parseFloat(data.capital_social || '0'),
        activityCount: (data.cnaes_secundarios?.length || 0) + 1,
        contactType: 'Direto',
        priority: 70, // Alta prioridade manual
        businessType: 'Alvo Direto',
        confidence: 90,
        isSA: (data.natureza_juridica || '').toUpperCase().includes('ANÔNIMA') || (data.natureza_juridica || '').toUpperCase().includes('S.A'),
        isMatriz: !cnpjInput.includes('0001'), // Inferência básica
        cnaes: [{ 
            code: data.cnae_fiscal || '', 
            description: data.cnae_fiscal_descricao || 'Agro', 
            persona: 'OUTRO' 
        }],
        tacticalAnalysis: { 
            badges: ['SNIPER'], 
            verticalizationScore: 0, 
            salesComplexity: 'TRANSACIONAL', 
            goldenHook: 'Adição manual direta.' 
        }
      };

      onImport([newLead]);
      setCnpjInput('');
      onStatusUpdate(`✅ ${newLead.companyName} adicionada com sucesso.`);
    } catch (err: any) {
      onStatusUpdate(`❌ Erro: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // --- LÓGICA ARRASTÃO (CSV) ---
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingCSV(true);
    onStatusUpdate("🔄 Processando planilha estratégica...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8", // Tenta UTF-8 padrão
      complete: (results) => {
        const leads = results.data.map((row: any, idx: number) => {
             // Mapeamento flexível de colunas
             const name = row['Nome da Empresa'] || row['Razao Social'] || row['Nome'] || "Empresa CSV";
             const cnpjRaw = row['CNPJ'] || row['CPF/CNPJ'] || "";
             
             return {
                id: `csv-${idx}-${Date.now()}`,
                companyName: name,
                cnpj: cnpjRaw,
                city: row['Cidade'] || row['Município'] || "",
                uf: row['UF'] || row['Estado'] || "",
                isValidated: false,
                priority: 40,
                businessType: 'Importação CSV',
                confidence: 50,
                isSA: name.toUpperCase().includes('S.A') || name.toUpperCase().includes('S/A'),
                isMatriz: true,
                contactType: 'Direto',
                activityCount: 1,
                tacticalAnalysis: { badges: [], goldenHook: '', verticalizationScore: 0, salesComplexity: 'TRANSACIONAL' }
             };
        }) as ProspectLead[];

        // Filtra vazios
        const validLeads = leads.filter(l => l.companyName && l.companyName !== "Empresa CSV");

        setTimeout(() => {
            onImport(validLeads);
            setIsLoadingCSV(false);
            onStatusUpdate(`✅ ${validLeads.length} leads importados via Arrastão.`);
        }, 800);
      },
      error: (err) => {
          onStatusUpdate(`❌ Erro ao ler CSV: ${err.message}`);
          setIsLoadingCSV(false);
      }
    });
    
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      
      {/* BLOCO 1: SNIPER (Entrada Rápida) */}
      <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
        <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3 block flex items-center gap-2">
          <Target size={14} /> Adição Sniper (CNPJ)
        </label>
        <form onSubmit={handleSniperAdd} className="flex gap-2">
          <input
            type="text"
            value={cnpjInput}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0000-00"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 transition-all font-mono placeholder:text-slate-400 placeholder:font-sans"
          />
          <button 
            type="submit"
            disabled={cnpjInput.length < 14 || isSearching}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
            Adicionar
          </button>
        </form>
      </div>

      {/* BLOCO 2: ARRASTÃO (Upload CSV) */}
      <div className="bg-emerald-50/40 p-5 rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/70 transition-all group cursor-pointer">
        <label htmlFor="mass-csv" className="cursor-pointer block">
            <div className="flex flex-col items-center justify-center py-2">
                {isLoadingCSV ? (
                    <Loader2 size={32} className="text-emerald-600 animate-spin mb-2" />
                ) : (
                    <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <FileSpreadsheet size={24} className="text-emerald-500" />
                    </div>
                )}
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Importação Arrastão (CSV)</span>
                <span className="text-[10px] text-emerald-600 mt-1">Arraste ou clique para carregar lista</span>
            </div>
        </label>
        <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" id="mass-csv" />
      </div>

    </div>
  );
};
