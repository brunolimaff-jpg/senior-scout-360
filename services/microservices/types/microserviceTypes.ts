// src/services/microservices/types/microserviceTypes.ts

/**
 * TIPOS BASE PARA ARQUITETURA DE MICRO-SERVIÇOS DE INTELIGÊNCIA
 * Versão: 1.0 - Estrutura Base
 */

// Status de execução de um micro-serviço
export type MicroserviceStatus = 
  | 'pending'    // Aguardando execução
  | 'running'    // Em execução
  | 'completed'  // Concluído com sucesso
  | 'failed'     // Falhou
  | 'skipped';   // Pulado (dependência não atendida)

// Resultado genérico de um micro-serviço
export interface MicroserviceResult<T> {
  status: MicroserviceStatus;
  data: T | null;
  error: string | null;
  duration: number; // Tempo de execução em ms
  logs: string[]; // Mensagens de progresso
  confidence: number; // 0-100, confiança nos dados retornados
  sources: string[]; // URLs ou referências de onde vieram os dados
  timestamp: number; // Quando foi executado
}

// Configuração de um micro-serviço
export interface MicroserviceConfig {
  name: string;
  maxRetries: number;
  timeout: number; // em ms
  cacheable: boolean;
  cacheTTL: number; // em ms
  requiredDependencies: string[]; // Nomes de outros micro-serviços necessários
}

// Contexto de orquestração (compartilhado entre micro-serviços)
export interface OrchestrationContext {
  leadId: string;
  cnpj: string;
  razaoSocial: string;
  results: Map<string, MicroserviceResult<any>>;
  onProgress: (serviceName: string, message: string) => void;
  onComplete: (serviceName: string, result: MicroserviceResult<any>) => void;
  onError: (serviceName: string, error: string) => void;
  abortController: AbortController;
}

// ============================================
// TIPOS DE OUTPUT ESPECÍFICOS (por micro-serviço)
// ============================================

// Resultado do cnpjValidator
export interface CNPJValidationResult {
  status: string; // 'ATIVA', 'INAPTA', etc.
  razaoSocial: string;
  nomeFantasia?: string;
  capitalSocial: number;
  qsa: Array<{ nome: string; qualificacao: string; participacao?: number; cnpjCpf?: string }>;
  naturezaJuridica: string;
  dataAbertura: string;
  cnae: string;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
}

// Resultado do corporateAnalyzer
export interface CorporateAnalysisResult {
  isSA: boolean;
  isHolding: boolean;
  isGroupMember: boolean;
  keyExecutives: Array<{ nome: string; role: string }>;
  governanceScore: number; // 0-100
}

// Resultado do operationalIntelligence
export interface OperationalIntelResult {
  hectares: number | null;
  farms: Array<{
    name: string;
    location: string;
    hectares: number | null;
    source: string;
  }>;
  crops: Array<{
    name: string;
    hectares: number | null;
  }>;
  production: {
    crop: string;
    tons: number;
    year: number;
    source: string;
  } | null;
  confidence: number;
  activities?: {
    farming?: { active: boolean; description: string; source: string };
    industry?: { active: boolean; description: string; source: string };
    trading?: { active: boolean; description: string; source: string };
    export?: { active: boolean; description: string; source: string };
    services?: { active: boolean; description: string; source: string };
    logistics?: { active: boolean; description: string; source: string };
  };
}

// Resultado do revenueSearcher
export interface RevenueResult {
  revenue: number | null;
  year: number | null;
  source: string | null;
  isEstimated: boolean;
  confidence: number;
  reasoning: string;
}

// Resultado do organizationalIntelligence
export interface OrganizationalIntelResult {
  employees: number | null;
  openRoles: Array<{
    title: string;
    department: string;
    postedDate: string;
    source: string;
  }>;
  leaders: Array<{
    name: string;
    role: string;
    source: string;
  }>;
  certifications: Array<{
    name: string;
    issuedBy: string;
    year: number;
    source: string;
  }>;
  digitalMaturity: {
    score: number; // 0-100
    signals: string[];
    reasoning: string;
  };
  confidence: number;
}

// Resultado do financialIntelligence
export interface FinancialIntelResult {
  investments: Array<{
    type: string;
    value: number | null;
    date: string;
    description: string;
    source: string;
  }>;
  risks: Array<{
    type: 'Trabalhista' | 'Tributário' | 'Ambiental' | 'Outros';
    description: string;
    severity: 'Baixa' | 'Média' | 'Alta';
    date: string;
    source: string;
  }>;
  awards: Array<{
    name: string;
    year: number;
    issuedBy: string;
    source: string;
  }>;
  momentum: {
    trend: 'Crescimento' | 'Estável' | 'Declínio';
    signals: string[];
    reasoning: string;
  };
  healthScore: number; // 0-100
  confidence: number;
}

// Resultado do scoreCalculator
export interface ScoreResult {
  totalScore: number; // 0-1000
  tier: 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';
  breakdown: {
    musculo: number;
    complexidade: number;
    gente: number;
    momento: number;
  };
  confidence: number;
  appliedRules: string[];
}

// Resultado do scoreValidator
export interface ScoreValidationResult {
  isCoherent: boolean;
  warnings: Array<{
    field: string;
    issue: string;
    severity: 'Baixa' | 'Média' | 'Alta';
  }>;
  regionalContext: {
    state: string;
    avgHectaresPerEmployee: number;
    avgProductivity: string;
  };
  anomalies: string[];
  confidence: number;
}

// Resultado do evidenceSearcher
export interface EvidenceResult {
  category: 'Expansão' | 'Tecnologia' | 'Financeiro' | 'Risco';
  articles: Array<{
    title: string;
    date: string;
    source: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    validatedBy: string;
    url: string;
  }>;
}

// Resultado do evidenceEnricher
export interface EnrichedEvidenceResult {
  enrichedArticles: Array<{
    title: string;
    extracted: {
      value: { amount: number; currency: string; original: string } | null;
      quantity: { value: number; unit: string } | null;
      completionDate: string | null;
      impact: { type: string; description: string } | null;
    };
  }>;
}

// Resultado do bottleneckAnalyzer
export interface BottleneckResult {
  primaryBottleneck: 'Financial' | 'Operational' | 'People';
  reasoning: string;
  urgency: number; // 1-10
  secondaryIssues: string[];
  confidence: number;
}

// Resultado do strategyGenerator
export interface StrategyResult {
  product: 'ERP' | 'GAtec' | 'HCM';
  pitch: string;
  lossSimulator: {
    scenario: string;
    annualLoss: number;
    calculation: string;
  };
  caseStudy: {
    clientName: string;
    profile: string;
    results: string;
  };
  roi: {
    months: number;
    improvementPercent: number;
    description: string;
  };
  urgency: 'CRÍTICA' | 'ALTA' | 'MÉDIA';
  confidence: number;
}

// Resultado do dossierAuditor
export interface AuditResult {
  approved: boolean;
  issues: Array<{
    type: 'LGPD' | 'Inconsistency' | 'Unfounded' | 'Tone';
    description: string;
    severity: 'Blocker' | 'Warning';
  }>;
  suggestions: string[];
  confidence: number;
}

// Resultado final da orquestração
export interface OrchestrationResult {
  success: boolean;
  results: Map<string, MicroserviceResult<any>>;
  errors: Array<{ serviceName: string; error: string }>;
  duration: number; // Tempo total em ms
  servicesRun: number;
  servicesFailed: number;
  servicesSkipped: number;
}