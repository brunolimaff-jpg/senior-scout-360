
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
  // Novos campos para Score Determinístico
  deterministicScore?: number;
  deterministicBreakdown?: string[];
  operationalComplexity?: number; // Novo campo S_fit (0 a 1000)
}

export interface LeadMetadata {
  hectaresTotal: number;
  fontes: string[];
  formatos: string[];
  urls: string[];
  contextos: string[];
  hasGroup?: boolean;
}

export interface ProspectLead {
  id: string;
  companyName: string;
  tradeName?: string;
  cnpj: string;
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
  corporateDomain?: string; // NOVO CAMPO: Identificador de Grupo via Email
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

export interface Citation {
  source: string;
  confidence: number;
}

export interface Evidence {
  id: string;
  title: string;
  text: string;
  snippet?: string;
  url?: string;
  category: string;
  selected: boolean;
  recommendation?: 'MANTER' | 'DESCARTE';
  source?: string;
  type: 'web' | 'texto' | 'url' | 'pdf';
  reason?: string;
  citations?: Citation[];
  createdAt?: string;
}

export interface CostInfo {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface AppState {
  activeModule: 'RADAR' | 'SCOUT' | 'ARSENAL';
  step: number;
  data: AccountData;
  evidenceList: Evidence[];
  dossierContent: string;
  isGenerating: boolean;
  isSearching: boolean;
  savedLeads: ProspectLead[];
  comparisonLeads: ProspectLead[];
  logs: LogEntry[];
}

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
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

export interface GroundingMetadata {
  searchEntryPoint?: {
    renderedContent?: string;
  };
  groundingChunks?: any[];
}

export interface SpiderGraph {
  nodes: SpiderNode[];
  edges: SpiderEdge[];
}

export interface SpiderNode {
  id: string;
  label: string;
  type: 'COMPANY' | 'PERSON' | 'GROUP' | 'ASSET';
  level: number;
  parentId?: string;
  metadata?: {
    role?: string;
  };
}

export interface SpiderEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  status: 'CONFIRMED' | 'PROBABLE';
  evidence?: {
    snippet: string;
    url?: string;
  };
}

export interface DossierUpdate {
  sectionTitle: string;
  appendMarkdown: string;
  reason: string;
}

export interface DossierPlanSection {
  title: string;
  objective: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  grounding?: GroundingMetadata;
  dossierUpdate?: DossierUpdate;
}

export interface QualityCheckResult {
  isValid: boolean;
  score: number;
  checks: Array<{ name: string; status: string; message?: string }>;
  blockingIssues: string[];
  warnings: string[];
  recommendation: string;
}

export interface DossierAnalysisData {
  company: {
    name: string;
  };
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
  scoreExplanation?: {
    scoreTotal: number;
    drivers: Array<{ label: string; points: number; why: string }>;
    missingInfo: string[];
    howToConfirm: string[];
  };
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
  timestamp: string;
}

// --- SAS 4.0: Senior Agro Score ---

export type AgroTier = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';

export interface AgroProfile {
  hectares: number;
  atividadePrincipal: 'SOJA' | 'MILHO' | 'ALGODAO' | 'SEMENTE' | 'CAFE' | 'CANA' | 'PECUARIA' | 'INDUSTRIA' | 'MISTO';
  funcionarios: number;
  isSA: boolean;            // Sociedade Anônima?
  isGrupoEconomico: boolean; // Holding/Filiais?
  temIrrigacao: boolean;
  temArmazem: boolean;      // Silos
  temFrota: boolean;        // Oficina/Caminhões
  temGestaoProfissional: boolean; // CEO/CFO identificados
  temConectividade: boolean; // 4G/Tech
  temCertificacao: boolean;  // ESG/ISO
  isExportador: boolean;
}

export interface ScorePillar {
  name: string;
  score: number; // 0-250
  max: number;   // 250
  details: string[]; // Logs do porquê pontuou
}

export interface SeniorAgroScoreResult {
  totalScore: number; // 0-1000
  tier: AgroTier;
  pillars: {
    musculo: ScorePillar;
    complexidade: ScorePillar;
    gente: ScorePillar;
    momento: ScorePillar;
  };
  auditLog: string[]; // Resumo geral para o Vendedor
  recommendedSolutions: string[];
}

export const INITIAL_STATE: AppState = {
  activeModule: 'RADAR',
  step: 1,
  data: { companyName: '', cnpj: '', municipality: '', uf: '', profile: OutputProfile.STANDARD },
  evidenceList: [],
  dossierContent: '',
  isGenerating: false,
  isSearching: false,
  savedLeads: [],
  comparisonLeads: [],
  logs: []
};
