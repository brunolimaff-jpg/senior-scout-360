
import { GoogleGenAI, Type } from "@google/genai";
import { DadosEmpresa, ScoreSAS } from '../types';

// Inicialização segura do Cliente Gemini
// IMPORTANTE: Em produção real, chaves devem ser protegidas.
// Para este pilot serverless, usamos a env var do processo.
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const MODEL_NAME = 'gemini-2.5-pro'; // Modelo de Raciocínio Superior

/**
 * Função Core: "Sara" Audita a Empresa
 * Recebe dados brutos da Receita e retorna Inteligência Estratégica.
 */
export async function auditarEmpresaComIA(dados: DadosEmpresa): Promise<ScoreSAS> {
  if (!apiKey) {
    console.error("API Key do Gemini não encontrada.");
    throw new Error("Chave de API da IA não configurada.");
  }

  const prompt = `
    ATUE COMO: "Sara", uma Auditora Sênior de Inteligência de Mercado para o Agronegócio.
    TAREFA: Analisar os dados cadastrais desta empresa e gerar um Score de Potencial de Compra (SAS 4.0).

    DADOS DA EMPRESA:
    - Razão Social: ${dados.razao_social}
    - Nome Fantasia: ${dados.nome_fantasia || 'N/D'}
    - Capital Social: R$ ${dados.capital_social}
    - Localização: ${dados.municipio}/${dados.uf}
    - Atividade Principal: ${dados.cnae_fiscal_descricao} (${dados.cnae_fiscal})
    - Sócios (QSA): ${dados.qsa.map(s => `${s.nome_socio} (${s.qualificacao_socio})`).join(', ')}

    CRITÉRIOS DE AVALIAÇÃO (SAS 4.0):
    1. MÚSCULO (0-400): Capacidade financeira baseada no Capital Social e porte.
    2. COMPLEXIDADE (0-250): Dificuldade operacional (Indústria > Sementes > Grãos > Pecuária).
    3. GENTE (0-200): Tamanho da estrutura (estimada por sócios/capital) e risco trabalhista.
    4. MOMENTO (0-150): Governança (S.A., Holding) e maturidade.

    REGRA DE NEGÓCIO:
    - Se for "S.A." ou "Holding", o score deve ser alto (>750).
    - Se Capital Social > 10 Milhões, Músculo deve ser > 300.
    - Se CNAE for "Soja", "Algodão" ou "Sementes", Complexidade alta.

    RETORNE APENAS UM JSON VÁLIDO COM A SEGUINTE ESTRUTURA:
    {
      "score": number,
      "tier": "BRONZE" | "PRATA" | "OURO" | "DIAMANTE",
      "analise": {
        "musculo": { "score": number, "justificativa": "string curta" },
        "complexidade": { "score": number, "justificativa": "string curta" },
        "gente": { "score": number, "justificativa": "string curta" },
        "momento": { "score": number, "justificativa": "string curta" }
      },
      "produtosSugeridos": ["Lista", "de", "Produtos", "Senior"],
      "riscos": ["Risco 1", "Risco 2"],
      "oportunidades": ["Oportunidade 1"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, // Baixa temperatura para análise técnica consistente
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("IA não retornou resposta.");

    const resultado = JSON.parse(jsonText) as ScoreSAS;
    return resultado;

  } catch (error) {
    console.error("Erro na Auditoria IA:", error);
    // Fallback básico em caso de erro da IA para não quebrar a UI
    return {
      score: 50,
      tier: 'BRONZE',
      analise: {
        musculo: { score: 10, justificativa: "Erro na análise IA" },
        complexidade: { score: 10, justificativa: "Erro na análise IA" },
        gente: { score: 10, justificativa: "Erro na análise IA" },
        momento: { score: 10, justificativa: "Erro na análise IA" }
      },
      produtosSugeridos: ["ERP Senior"],
      riscos: ["Dados inconclusivos"],
      oportunidades: ["Verificar manualmente"]
    };
  }
}
