
import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Printer, Download, Copy, Check, ChevronLeft, FileDown, Loader2, AlertOctagon, CheckCircle2, XCircle, Unlock, Info, HelpCircle } from 'lucide-react';
import { AccountData, QualityCheckResult } from '../types';
import { validateDossierQuality } from '../services/qualityGateService';
import { jsPDF } from 'jspdf';

interface Props {
  data: AccountData;
  content: string;
  onBack: () => void;
}

const Step4Export: React.FC<Props> = ({ data, content, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);

  useEffect(() => {
    // Run validation on mount
    const result = validateDossierQuality(content);
    setQualityResult(result);
  }, [content]);

  // Processa o markdown para transformar [1] em links e prepara componentes customizados
  const processedContent = useMemo(() => {
    // Transforma [1] em [[1]](#citation-1) para ser interpretado como link pelo Markdown
    return content.replace(/\[(\d+)\]/g, '[$&](#citation-$1)');
  }, [content]);

  const markdownComponents = {
    // Customiza a renderização de células da tabela para adicionar ID de âncora
    td: ({ children, ...props }: any) => {
      const text = React.Children.toArray(children).join('').trim();
      // Se a célula contém apenas um número (coluna de índice do Proof Ledger)
      if (/^\d+$/.test(text)) {
        return (
          <td {...props} id={`citation-${text}`} className="scroll-mt-32 transition-colors duration-1000">
            {children}
          </td>
        );
      }
      return <td {...props}>{children}</td>;
    },
    // Customiza links para smooth scroll
    a: ({ href, children, ...props }: any) => {
      const isCitationLink = href?.startsWith('#citation-');
      
      const handleClick = (e: React.MouseEvent) => {
        if (isCitationLink) {
          e.preventDefault();
          const id = href.substring(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight effect
            element.parentElement?.classList.add('bg-yellow-100');
            setTimeout(() => {
              element.parentElement?.classList.remove('bg-yellow-100');
            }, 2000);
          }
        }
      };

      if (isCitationLink) {
        return (
          <a 
            href={href} 
            onClick={handleClick} 
            className="text-indigo-600 font-bold hover:underline cursor-pointer bg-indigo-50 px-0.5 rounded mx-0.5 text-xs align-super"
            {...props}
          >
            {children}
          </a>
        );
      }
      return <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (qualityResult?.recommendation === "BLOQUEADO") {
       const confirm = window.confirm("ATENÇÃO: O dossiê possui alertas de qualidade. A exportação pode conter erros ou dados sensíveis. Continuar?");
       if (!confirm) return;
    }

    if (isPdfGenerating) return;
    setIsPdfGenerating(true);
    
    // Pequeno delay para garantir que o estado de loading apareça na UI
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const doc = new jsPDF();
      
      // -- Configuração Inicial --
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let cursorY = 20;

      // -- Função Helper de Limpeza --
      // Remove emojis e caracteres que o jsPDF (fonte padrão) não suporta bem
      const cleanForPdf = (text: string) => {
        return (text || '')
          .replace(/[^\x20-\x7E\xC0-\xFF\n\r\t\u2013\u2014\u201C\u201D\u2018\u2019]/g, '') // Mantém ASCII + Latin1 + pontuação comum
          .replace(/\*\*/g, '') // Remove markdown bold
          .replace(/##/g, '')   // Remove markdown header
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links mantendo texto
          .trim();
      };

      // -- HEADER --
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text("Senior Scout 360", margin, cursorY);
      
      cursorY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Dossiê: ${cleanForPdf(data.companyName)}`, margin, cursorY);
      
      cursorY += 5;
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, cursorY);
      
      cursorY += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 10;

      // -- CONTENT PROCESS --
      const rawLines = content.split('\n');

      for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i];
        // Pula linhas vazias consecutivas para economizar espaço
        if (!rawLine.trim()) {
           cursorY += 4;
           continue;
        }

        // Nova página se necessário
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = margin;
        }

        const cleanLine = cleanForPdf(rawLine);

        // Estilização baseada em Markdown simples
        if (rawLine.startsWith('# ')) {
           doc.setFont("helvetica", "bold");
           doc.setFontSize(14);
           doc.setTextColor(15, 23, 42); // slate-900
           cursorY += 4;
        } else if (rawLine.startsWith('## ')) {
           doc.setFont("helvetica", "bold");
           doc.setFontSize(12);
           doc.setTextColor(51, 65, 85); // slate-700
           cursorY += 2;
        } else if (rawLine.startsWith('### ')) {
           doc.setFont("helvetica", "bold");
           doc.setFontSize(11);
           doc.setTextColor(71, 85, 105); // slate-600
        } else if (rawLine.trim().startsWith('- ') || rawLine.trim().startsWith('* ')) {
           doc.setFont("helvetica", "normal");
           doc.setFontSize(10);
           doc.setTextColor(51, 65, 85);
        } else if (rawLine.startsWith('|')) {
           // Tabela (renderização simplificada monoespaçada)
           doc.setFont("courier", "normal");
           doc.setFontSize(8);
           doc.setTextColor(70, 70, 70);
        } else {
           // Texto normal
           doc.setFont("helvetica", "normal");
           doc.setFontSize(10);
           doc.setTextColor(30, 41, 59);
        }

        // Quebra de linha automática
        const lines = doc.splitTextToSize(cleanLine, contentWidth);
        
        // Renderiza cada linha quebrada
        // eslint-disable-next-line no-loop-func
        lines.forEach((line: string) => {
           if (cursorY > pageHeight - 15) {
              doc.addPage();
              cursorY = margin;
           }
           doc.text(line, margin, cursorY);
           cursorY += 5; // Altura da linha
        });
      }

      // -- FOOTER --
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${p} de ${totalPages} • Gerado via Senior Scout 360`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      doc.save(`Dossie_${data.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

    } catch (e) {
      console.error("Erro PDF:", e);
      alert("Houve um erro ao gerar o PDF. Tente usar a opção 'Copiar MD' e salvar em um editor de texto.");
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 items-start pb-20">
      
      {/* Sidebar: Quality Gates & Help */}
      <div className="w-full md:w-80 flex-shrink-0 print:hidden sticky top-6 space-y-4">
        
        {/* Quality Gate Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
             <h3 className="font-bold text-slate-700 text-sm">Quality Gate</h3>
             <span className={`text-xs px-2 py-0.5 rounded font-bold ${qualityResult?.score && qualityResult.score > 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
               {qualityResult?.score}/100
             </span>
           </div>
           
           <div className="p-4 space-y-4">
              {qualityResult?.checks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                   <span className="mt-0.5">{check.status.includes('PASS') ? <CheckCircle2 className="w-4 h-4 text-green-500"/> : check.status.includes('WARNING') ? <AlertOctagon className="w-4 h-4 text-amber-500"/> : <XCircle className="w-4 h-4 text-red-500"/>}</span>
                   <span className="text-slate-600">{check.name}</span>
                </div>
              ))}
              
              {(qualityResult?.blockingIssues.length || 0) > 0 && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-xs text-red-800">
                  <strong className="block mb-1">Bloqueios:</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {qualityResult?.blockingIssues.map(i => <li key={i}>{i}</li>)}
                  </ul>
                </div>
              )}

               {(qualityResult?.warnings.length || 0) > 0 && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                  <strong className="block mb-1">Sugestões:</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {qualityResult?.warnings.map(i => <li key={i}>{i}</li>)}
                  </ul>
                </div>
              )}

              <div className={`text-center font-bold text-sm py-2 rounded border flex justify-center items-center gap-2 ${
                 qualityResult?.recommendation === 'PRONTO PARA EXPORTAR' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                 {qualityResult?.recommendation === 'BLOQUEADO' ? <Unlock className="w-3 h-3 text-slate-400"/> : null}
                 {qualityResult?.recommendation === 'BLOQUEADO' ? 'LIBERADO C/ RISCO' : qualityResult?.recommendation}
              </div>
           </div>
        </div>

        {/* Help Box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
           <h4 className="font-bold flex items-center gap-2 mb-2">
             <HelpCircle className="w-4 h-4"/> Dicas de Exportação
           </h4>
           <ul className="list-disc pl-4 space-y-2 text-xs">
             <li><strong>Baixar PDF:</strong> Gera um arquivo formatado para impressão ou envio por e-mail.</li>
             <li><strong>Copiar MD:</strong> Copia o texto puro (Markdown). Ideal para colar no Notion, Obsidian ou ChatGPT para ajustes.</li>
             <li><strong>Quality Gate:</strong> Verifica se há dados sensíveis (CPF, contas) ou alucinações antes de liberar o arquivo.</li>
           </ul>
        </div>

      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Action Bar */}
        <div className="print:hidden mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium self-start sm:self-auto">
            <ChevronLeft className="w-4 h-4" /> Voltar para Edição
          </button>
          
          <div className="flex flex-wrap gap-3 justify-end w-full sm:w-auto">
            <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-sm font-medium">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Markdown'}
            </button>
            
            <button 
              onClick={handleDownloadPdf} 
              disabled={isPdfGenerating}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition text-sm font-bold shadow-md disabled:opacity-70 disabled:cursor-wait ${
                  qualityResult?.recommendation === 'BLOQUEADO' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isPdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {isPdfGenerating ? 'Gerando PDF...' : qualityResult?.recommendation === 'BLOQUEADO' ? 'Baixar com Alertas' : 'Baixar PDF'}
            </button>
          </div>
        </div>

        {/* Report View */}
        <div className="bg-white p-8 md:p-12 rounded-xl shadow-sm print:shadow-none print:p-0 max-w-[210mm] mx-auto min-h-[297mm] border border-slate-100 print:border-none">
          <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-tight">Senior Scout 360</h1>
              <p className="text-slate-500 text-sm mt-1">Inteligência Comercial & Account Planning</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-slate-900">{data.companyName}</div>
              <div className="text-sm text-slate-500">{new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h2:text-indigo-900 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-h2:mt-8 prose-p:text-justify prose-table:text-sm prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2 prose-a:no-underline">
            <ReactMarkdown components={markdownComponents}>{processedContent}</ReactMarkdown>
          </article>

          <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            Gerado por Senior Scout 360 (Pilot) • Confidencial • Uso Interno
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4Export;
