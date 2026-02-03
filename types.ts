
export enum OutputProfile {
  SHORT = 'Curto (1-2 pgs)',
  STANDARD = 'Padrão (5-10 pgs)',
  COMPLETE = 'Completo (10-20 pgs)'
}

export interface TemporalEvent {
  id: string;
  title: string;
  date: string;
  url: string;
  source: string;
  category: 'MULTA' | 'EXPANSAO' | 'VAGA' | 'EDITAL' | 'CERTIFICACAO' | 'GERAL';
}

export interface GroupCompany {
  cnpj: string;
  nome: string;
  capitalSocial: number;
  status: 'VALIDADA' | 'PENDENTE' | 'FALHOU';
  participacao?: number;
  atividadePrincipal?: string;
  endereco?: string;
  qsa?: Array<{
    nome: string;
    qualificacao: string;
    participacao?: string;
  }>;
}

export interface ScoreBreakdown {
  financial: number;    
  longevity: number;    
  legal: number;        
  decisionPower: number;
  verticalFit: number;  
  operational: number;  
  location: number;     
  workforce: number;    
  stability: number;    
  techReadiness: number;
}

export interface CnaeInfo {
  code: string;
  description: string;
  persona: 'PRODUTOR' | 'LOGISTICA' | 'INDUSTRIA' | 'REVENDA' | 'ARMAZEM' | 'SERVICOS' | 'OUTRO';
  emoji?: string;
}

export interface SourceEvidence {
  sourceName: string;
  url: string;
  title: string;
  snippet: string;
}

export interface PhaseTelemetry {
  phaseId: number;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt?: string;
  endedAt?: string;
  durationMs: number;
  counts: Record<string, number>;
  topUrls: string[];
  errorMessage?: string;
  manualRetry?: boolean;
}

export interface CompanyRelatedItem {
  cnpj: string;
  razaoSocial: string;
  tradeName?: string;
  situacao: string;
  capitalSocial: number | null;
  qsaCount: number | null;
  evidenceUrls: string[];
  snippets: string[];
  validationStatus: 'VALIDADA' | 'PENDENTE' | 'FALHOU';
  validationErrorMessage?: string;
  lastValidatedAt?: string;
  attemptCount: number;
  estimatedRevenue: number | null;
  confidence: number;
  linkReasons: string[];
}

export interface GroupMagnitudeSummary {
  validatedCnpjsCount: number;
  totalCapitalSocial: number;
  maxCapitalSocial: number;
  estimatedRevenueTotal: number;
  estimateCompaniesUsed: number;
  estimateCompaniesExcluded: number;
}

export interface JobProgress {
  runId: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStepName: string;
  completedSteps: number;
  totalSteps: number;
  currentItemIndex: number;
  totalItems: number;
  startedAt?: string;
  endedAt?: string;
  durationMs: number;
}

export interface PFProspect {
  id: string;
  displayName: string;
  normalizedName: string;
  city: string;
  uf: string;
  vertical: string;
  evidences: SourceEvidence[];
  confidence: number;
  isStrongCandidate: boolean;
  hectares?: number;
}

export interface ProspectLead {
  id: string;
  companyName: string;
  tradeName?: string;
  cnpj: string;
  cpf?: string;
  cpfStatus?: 'VALIDADO_FONTE' | 'VALIDADO_API' | 'PENDENTE' | 'MANUAL';
  city: string;
  uf: string;
  isValidated: boolean;
  status?: string;
  capitalSocial?: number;
  estimatedRevenue?: number | null; 
  foundationDate?: string;
  isSA: boolean;
  isMatriz: boolean;
  activityCount: number;
  email?: string;
  corporateDomain?: string; 
  contactType: 'Direto' | 'Contabilidade';
  confidence: number; 
  score?: number; 
  breakdown?: ScoreBreakdown;
  tacticalAnalysis?: AgroTacticalAnalysis;
  cnaes?: CnaeInfo[];
  savedAt?: string;
  notes?: string;
  website?: string;
  priority: number;
  businessType?: string;
  sizeInfo?: string;
  fitLevel?: string;
  bestEvidenceUrl?: string;
  source?: string;
  tags?: string[]; 
  fitExplanation?: {
    motivos: string[];
    faltouConfirmar: string[];
  };
  metadata?: LeadMetadata;
  hectares?: number;
  numFuncionarios?: number;
  isGrupoEconomico?: boolean;
  isPF?: boolean;
  fonte?: string;
  confiabilidade?: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export interface AgroTacticalAnalysis {
  verticalizationScore: number;
  badges: string[];
  salesComplexity: 'COMPLEXA/COMITE' | 'CONSULTIVA/SUCESSAO' | 'TRANSACIONAL';
  goldenHook: string;
  successorHint?: string;
  temporalTrace?: TemporalEvent[];
  predictiveScore?: number; 
  buyingMoment?: 'agora' | '3 meses' | '6+ meses'; 
  scoreReason?: string;
  evidenceCount?: number;
  sourcesSummary?: string[];
  summaryLine?: string;
  isPotentialHomonym?: boolean;
  rawEvidences?: SourceEvidence[];
  isProcessingPdf?: boolean;
  pdfProcessed?: boolean;
  deterministicScore?: number;
  deterministicBreakdown?: string[];
  operationalComplexity?: number;
  searchTelemetry?: PhaseTelemetry[];
}

export interface LeadMetadata {
  hectaresTotal: number;
  fontes: string[];
  formatos: string[];
  urls: string[];
  contextos: string[];
  hasGroup?: boolean;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'COMPANY' | 'PERSON';
  status: 'ACTIVE' | 'INACTIVE';
  cnpj?: string;
  role?: string;
  level: number;
  parentId?: string;
}

export interface AccountData {
  companyName: string;
  cnpj: string;
  municipality: string;
  uf: string;
  profile: OutputProfile;
  website?: string;
  notes?: string;
}

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

export interface Evidence {
  id: string;
  title: string;
  text: string;
  snippet: string;  
  url: string;
  category: string;
  selected: boolean;
  recommendation: string;
  source: string;
  type: 'web' | 'texto' | 'url' | 'pdf';
  citations?: Array<{ confidence: number }>;
  createdAt?: string;
}

export interface FitCriteria {
  geography: string[];
  segment: string[];
  complexity: string[];
  pain: string[];
}

export interface SimilarAccount {
  name: string;
  location: string;
  similaritySignals: string[];
  likelyPain: string;
}

export interface RadarResult {
  accounts: SimilarAccount[];
  searchSuggestionsHtml?: string;
}

export interface CostInfo {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface GroundingMetadata {
  groundingChunks?: any[];
  searchEntryPoint?: any;
}

export interface SpiderNode {
  id: string;
  label: string;
  type: 'COMPANY' | 'PERSON' | 'GROUP';
  level: number;
  metadata?: {
    role?: string;
  };
}

export interface SpiderEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  status: 'CONFIRMED' | 'PENDING';
  evidence?: {
    snippet?: string;
  };
}

export interface SpiderGraph {
  nodes: SpiderNode[];
  edges: SpiderEdge[];
}

export interface DossierUpdate {
  content?: string;
}

export interface DossierPlanSection {
  title: string;
  objective: string;
}

export type AgroTier = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';

export interface ScorePillar {
  name: string;
  score: number;
  max: number;
  details: string[];
}

export interface SeniorAgroScoreResult {
  totalScore: number;
  tier: AgroTier;
  pillars: {
    musculo: ScorePillar;
    complexidade: ScorePillar;
    gente: ScorePillar;
    momento: ScorePillar;
  };
  auditLog: string[];
  recommendedSolutions: string[];
}

export interface QualityCheckResult {
  isValid: boolean;
  score: number;
  checks: Array<{ name: string; status: string; message?: string }>;
  blockingIssues: string[];
  warnings: string[];
  recommendation: string;
}

export interface ScoreDimension {
  name: string;
  score: number;
  weight: number;
  evidences: string[];
}

export interface ExplainableScore {
  scoreTotal: number;
  dimensions: ScoreDimension[];
  recommendation: string;
  drivers?: Array<{ label: string; points: number; why: string }>;
  missingInfo?: string[];
  howToConfirm?: string[];
}

export interface DossierAnalysisData {
  metrics: {
    estimatedTicket: number;
    roi: number;
    paybackMonths: number;
    annualSavings: number;
    cnpjCount: number;
    unitsCount: number;
    shadowItScore: number;
    employeeCount: number;
    debtAmount: number;
    prodeicRenewalMonths: number;
    expiringLicensesCount: number;
    auditRisk: number;
    systemAge: number;
    deciderProfile: string;
    accountingStatus: string;
  };
  company: {
    name: string;
  };
  qualitative: {
    techSummary: string;
    fiscalSummary: string;
    decisionSummary: string;
  };
  seniorRecommendations?: Array<{
    product: string;
    module: string;
    painAddressed: string;
    valueProp: string;
    similarUseCase?: string;
  }>;
  scoreExplanation?: ExplainableScore;
}

export interface PipelineItem {
  id: string;
  companyName: string;
  city: string;
  uf: string;
  stage: 'DESCOBERTA' | 'QUALIFICACAO' | 'ABORDAGEM' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';
  lastUpdated: string;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  type: string;
  title: string;
}

export interface AlertItem {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AgroProfile {
  hectares: number;
  atividadePrincipal: 'SOJA' | 'MILHO' | 'ALGODAO' | 'CANA' | 'MISTO' | 'INDUSTRIA' | 'SEMENTE' | 'PECUARIA' | 'CAFE';
  funcionarios: number;
  isSA: boolean;
  isGrupoEconomico: boolean;
  temIrrigacao: boolean;
  temArmazem: boolean;
  temFrota: boolean;
  temGestaoProfissional: boolean;
  temConectividade: boolean;
  temCertificacao: boolean;
  isExportador: boolean;
}

export interface PFSearchRunSummary {
  pfCandidatesFound: number;
  pfUniqueAfterDedupe: number;
  evidencesTotal: number;
  orgSeedsExtracted: number;
  farmSeedsExtracted: number;
  cnpjCandidatesFound: number;
  cnpjValidated: number;
  networkNodes: number;
  networkEdges: number;
}

export interface CompanyCandidate {
  cnpj: string;
  legalName: string;
  uf: string;
  city: string;
  evidenceUrls: string[];
  snippets: string[];
  confidence: number;
  linkReasons: string[];
  validationStatus: 'pending' | 'VALIDADA' | 'FALHOU';
  attemptCount: number;
  capitalSocial: number;
}
