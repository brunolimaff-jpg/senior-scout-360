import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { ProspectLead } from '../types';

interface CSVImporterProps {
  onImport: (leads: ProspectLead[]) => void;
  onStatusUpdate: (msg: string) => void;
}

export const CSVImporter: React.FC<CSVImporterProps> = ({ onImport, onStatusUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; removed: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    setStats(null);
    onStatusUpdate("🔄 Processando arquivo e aplicando pente fino (Anti-MEI)...");

    Papa.parse(file, {
      header: true, skipEmptyLines: true, delimiter: ";",
      complete: (results) => {
        const rawData = results.data;
        
        // 🛑 FILTRO PENTE FINO V2 (AGORA PEGA TUDO)
        const cleanedLeads = rawData.filter((row: any) => {
          const nome = row['Nome da Empresa']?.toUpperCase() || "";
          const nat = row['Natureza Jurídica']?.toUpperCase() || "";
          
          // 1. MEI / EIRELI / EMPRESÁRIO INDIVIDUAL (Explícito)
          if (nat.includes("MEI") || nat.includes("MICROEMPREENDEDOR") || nat.includes("EIRELI") || nat.includes("EMPRESARIO INDIVIDUAL")) return false;

          // 2. PADRÃO DE NÚMERO NO NOME (Corrigido para pegar pontos)
          // Remove tudo que não é dígito. Se sobrar mais que 5 números, é MEI/CPF/CNPJ no nome.
          // Ex: "52.152.481 JOSE..." vira "52152481" -> BLOQUEIA.
          // Ex: "JOSE SILVA 123456" -> BLOQUEIA.
          const digitosNoNome = nome.replace(/\D/g, ''); 
          if (digitosNoNome.length > 5) return false;

          // 3. FILTRO DE "PESSOA FÍSICA DISFARÇADA" (Opcional - mas recomendado)
          // Se NÃO tem indicadores de empresa (LTDA, S/A, AGRO, FAZENDA, ETC) e parece nome de gente.
          const corporateKeywords = ["LTDA", "S/A", "S.A", "LIMITADA", "CIA", "COMPANHIA", "SOCIEDADE", "COOPERATIVA", "AGRO", "AGRICOLA", "FAZENDA", "SITIO", "ESTANCIA", "GRANJA", "HARAS", "ARMAZENS", "CEREALISTA"];
          const hasCorporateKeyword = corporateKeywords.some(kw => nome.includes(kw));
          
          // Se não tem palavra corporativa e tem 2+ nomes (Ex: "JOSE LUCIO DA PAZ"), bloqueia.
          // (Isso remove os produtores PF pequenos que não têm "Fazenda" no nome)
          if (!hasCorporateKeyword && nome.split(' ').length > 1) {
             return false; 
          }

          return true;
        }).map((row: any, idx: number) => ({
             id: `lead-${idx}-${Date.now()}`,
             companyName: row['Nome da Empresa'] || "Empresa Desconhecida",
             tradeName: row['Nome Fantasia'] || row['Nome da Empresa'] || "",
             cnpj: row['CNPJ'] || "",
             city: row['Cidade'] || row['Municipio'] || "",
             uf: row['UF'] || row['Estado'] || "",
             capitalSocial: 0, 
             isValidated: false,
             cnaes: [],
             tacticalAnalysis: { 
               badges: [], 
               goldenHook: '',
               verticalizationScore: 0,
               salesComplexity: 'TRANSACIONAL'
             }
        })) as ProspectLead[];

        // Estatísticas
        const removedCount = rawData.length - cleanedLeads.length;
        setStats({ total: rawData.length, removed: removedCount });

        setTimeout(() => {
            onImport(cleanedLeads);
            setIsLoading(false);
            onStatusUpdate(`✅ Limpeza Concluída: ${cleanedLeads.length} empresas corporativas. (${removedCount} MEIs/Individuais removidos).`);
        }, 1000);
      }
    });
  };

  return (
    <div className="w-full">
      <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-input-premium" />
      
      <label 
        htmlFor="csv-input-premium" 
        className={`
          relative flex flex-col items-center justify-center w-full p-6 
          border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 group
          ${fileName ? 'border-teal-500 bg-teal-50/30' : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-slate-50 hover:shadow-lg'}
        `}
      >
        <div className={`p-4 rounded-full mb-2 transition-colors ${fileName ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-500'}`}>
            {isLoading ? <Loader2 size={24} className="animate-spin"/> : fileName ? <CheckCircle2 size={24}/> : <UploadCloud size={24} />}
        </div>

        <div className="text-center space-y-1">
            {fileName ? (
                <>
                  <span className="text-sm font-bold text-teal-800 break-all line-clamp-1">{fileName}</span>
                  {stats && (
                    <span className="text-[10px] font-bold text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full inline-block">
                      -{stats.removed} "sujeiras"
                    </span>
                  )}
                </>
            ) : (
                <>
                    <h3 className="text-sm font-bold text-slate-700 group-hover:text-teal-700 transition-colors">
                        Upload da Base Agro
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium max-w-[150px] mx-auto leading-tight">
                        Filtro automático: MEI, Eireli e CPF no nome
                    </p>
                </>
            )}
        </div>

        {!fileName && (
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <FileSpreadsheet size={16} className="text-teal-400" />
            </div>
        )}
      </label>
    </div>
  );
};