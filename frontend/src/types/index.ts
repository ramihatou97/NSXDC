/**
 * NSXDC Frontend Type System
 * Comprehensive type definitions for all API interactions and frontend state
 */

// ============================================================================
// EXTRACTION MODES & CONFIGURATION
// ============================================================================

export type ExtractionMode = 'PURE' | 'DEDUCTION' | 'VALIDATED';
export type NarrativeMode = 'STRICT' | 'STANDARD' | 'ENHANCED';
export type DateFormatType = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'AUTO';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================================================
// VALIDATION & WARNING TYPES
// ============================================================================

export type ValidationWarningType =
  | 'missing_data'
  | 'low_confidence'
  | 'contradiction'
  | 'temporal_inconsistency'
  | 'medical_inconsistency'
  | 'requires_verification';

export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  recommendation?: string;
}

export type ValidationIssueSeverity = 'critical' | 'major' | 'minor';

export type ValidationIssueCategory =
  | 'grounding'
  | 'temporal'
  | 'medical'
  | 'medication'
  | 'anatomical'
  | 'gcs'
  | 'mode'
  | 'completeness'
  | 'confidence'
  | 'fabrication'
  | 'quality'
  | 'date_format';

export interface ValidationIssue {
  severity: ValidationIssueSeverity;
  category: ValidationIssueCategory;
  message: string;
  location?: string;
  suggestedFix?: string;
  details?: string;
}

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  details?: {
    extraction?: {
      passed: boolean;
      score: number;
      issueCount: number;
    };
    narrative?: {
      passed: boolean;
      score: number;
      issueCount: number;
    };
    summary?: string;
  };
}

// ============================================================================
// GROUNDED VALUE TYPE (Source Attribution)
// ============================================================================

export type DocumentType =
  | 'ADMISSION_HP'
  | 'OPERATIVE_NOTE'
  | 'PROGRESS_NOTE'
  | 'DISCHARGE_SUMMARY'
  | 'IMAGING_REPORT'
  | 'LAB_REPORT'
  | 'CONSULTATION_NOTE'
  | 'UNKNOWN';

export interface GroundedValue<T = unknown> {
  value: T;
  sourceQuote: string;
  sourceNoteType?: DocumentType;
  confidence: ConfidenceLevel;
  deductionMethod?: string;
  warnings?: ValidationWarning[];
}

// ============================================================================
// DATE PREPROCESSING TYPES
// ============================================================================

export interface DatePreprocessingResult {
  detectedFormat: DateFormatType;
  confidence: ConfidenceLevel;
  conversionsCount: number;
  ambiguousDatesCount: number;
  warnings: ValidationWarning[];
}

// ============================================================================
// DOCUMENTATION INVENTORY TYPES
// ============================================================================

export interface DocumentInstance {
  type: DocumentType;
  detectedAt: string;
  confidence: number;
  excerpt: string;
  pod?: number;
  dateRange?: {
    start: string;
    end?: string;
  };
}

export interface PODCoverage {
  totalPODs: number;
  coveredPODs: number;
  coveragePercentage: number;
  missingPODs: number[];
  documentedPODs: number[];
}

export interface DocumentationGaps {
  missingTypes: DocumentType[];
  missingPODs: number[];
  sparseDocumentation: boolean;
  hasDischargeInfo: boolean;
}

export interface DocumentationInventoryResult {
  documents: DocumentInstance[];
  podCoverage: PODCoverage;
  gaps: DocumentationGaps;
  completenessScore: number;
  warnings: string[];
}

// ============================================================================
// COMPLETENESS CHECK TYPES
// ============================================================================

export interface PreExtractionCheck {
  passed: boolean;
  blocker: boolean;
  message: string;
  recommendation: string;
}

export interface PreExtractionChecklist {
  readinessScore: number;
  checks: PreExtractionCheck[];
  criticalBlockers: PreExtractionCheck[];
  warnings: PreExtractionCheck[];
  overallAssessment: string;
}

export interface PostExtractionCheck {
  field: string;
  passed: boolean;
  severity: 'critical' | 'major' | 'minor';
  message: string;
  recommendation: string;
}

export interface PostExtractionChecklist {
  completenessScore: number;
  checks: PostExtractionCheck[];
  criticalIssues: PostExtractionCheck[];
  majorIssues: PostExtractionCheck[];
  minorIssues: PostExtractionCheck[];
  overallAssessment: string;
}

export interface CompletenessCheckResult {
  preExtraction: PreExtractionChecklist;
  postExtraction: PostExtractionChecklist;
}

// ============================================================================
// TOKEN USAGE & METADATA TYPES
// ============================================================================

export interface TokenCount {
  input: number;
  output: number;
  cached?: number;
}

export interface ExtractionMetadata {
  extractionMode: ExtractionMode;
  narrativeMode?: NarrativeMode;
  modelUsed: string;
  tokenCount?: TokenCount;
  processingTime: number;
  timestamp: string;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

export interface ExtractionRequest {
  clinicalNotes: string;
  mode?: ExtractionMode;
  narrativeMode?: NarrativeMode;
  includeValidation?: boolean;
  dateFormat?: DateFormatType;
  dateFormatHints?: string;
  regionLocale?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ExtractionData {
  // Demographics
  patientAge?: GroundedValue<number>;
  patientSex?: GroundedValue<string>;

  // Key Dates
  admissionDate?: GroundedValue<string>;
  surgeryDate?: GroundedValue<string>;
  dischargeDate?: GroundedValue<string>;

  // Admission Data
  chiefComplaint?: GroundedValue<string>;
  presentingSymptoms?: GroundedValue<string[]>;
  admissionGCS?: GroundedValue<number>;
  admissionKPS?: GroundedValue<number>;

  // Diagnosis & Procedure
  diagnosis?: GroundedValue<string>;
  procedure?: GroundedValue<string>;

  // Discharge Status
  dischargeGCS?: GroundedValue<number>;
  dischargeKPS?: GroundedValue<number>;
  dischargemRS?: GroundedValue<number>;
  dischargeECOG?: GroundedValue<number>;

  // Clinical Course
  hospitalCourse?: GroundedValue<string>;
  complications?: GroundedValue<string[]>;

  // Medications
  dischargeMedications?: GroundedValue<Array<{
    name: string;
    dose: string;
    route: string;
    frequency: string;
  }>>;

  // Additional fields (extensible)
  [key: string]: GroundedValue<unknown> | undefined;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ExtractionResponse {
  success: boolean;
  extraction?: ExtractionData;
  narrative?: string;
  validation?: ValidationResult;
  datePreprocessing?: DatePreprocessingResult;
  documentationInventory?: DocumentationInventoryResult;
  completenessCheck?: CompletenessCheckResult;
  error?: ApiError;
  metadata: ExtractionMetadata;

  // Storage fields (added when saved)
  extractionId?: string;
  jobId?: string;
  cached?: boolean;
}

// ============================================================================
// PROGRESS TRACKING TYPES (SSE)
// ============================================================================

export type ProgressStage =
  | 'initializing'
  | 'date_preprocessing'
  | 'extraction'
  | 'documentation_analysis'
  | 'pre_completeness_check'
  | 'post_completeness_check'
  | 'narrative_generation'
  | 'validation'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProgressEvent {
  jobId: string;
  stage: ProgressStage;
  percent: number;
  message: string;
  timestamp: string;
  estimatedTimeRemainingMs?: number;
  metadata?: {
    stagesCompleted: number;
    totalStages: number;
    currentStageProgress?: number;
  };
}

// ============================================================================
// STORAGE/HISTORY TYPES
// ============================================================================

export interface StoredExtraction {
  id: string;
  timestamp: string;
  extraction: ExtractionResponse;
  metadata: {
    processingTimeMs: number;
    tokensUsed?: number;
    cost?: number;
    version: string;
  };
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: 'timestamp' | 'id';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StorageStats {
  totalExtractions: number;
  totalSize: number;
  oldestExtraction: string | null;
  newestExtraction: string | null;
  byMonth: Record<string, number>;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export type CacheType = 'extraction' | 'terminology' | 'validation' | 'general';

export interface CacheTypeStats {
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  types: {
    [key in CacheType]?: CacheTypeStats;
  };
  memoryUsage: {
    estimated: number;
    formatted: string;
  };
  oldestEntry: number | null;
  newestEntry: number | null;
}

// ============================================================================
// VERSION & CONFIG TYPES
// ============================================================================

export interface VersionInfo {
  name: string;
  version: string;
  description: string;
  buildDate: string;
  commit?: string;
}

export interface SystemConfig {
  extractionMode: ExtractionMode;
  narrativeMode: NarrativeMode;
  model: string;
  enableCaching: boolean;
  features: {
    datePreprocessing: boolean;
    documentationInventory: boolean;
    completenessCheck: boolean;
    progressTracking: boolean;
    storage: boolean;
    cache: boolean;
  };
}

// ============================================================================
// FRONTEND-SPECIFIC TYPES
// ============================================================================

export interface ExtractionResult {
  extraction: ExtractionData;
  narrative?: string;
  validation?: {
    overallConfidence: number;
    passed: boolean;
    score?: number;
  };
  confidence?: {
    score: number;
    level?: string;
    factors?: Record<string, number>;
    uncertainties?: string[];
    recommendations?: string[];
  };
  warnings?: string[];
}

// UI State Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface UINotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  timestamp: Date;
  dismissed: boolean;
}

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

export function isExtractionResponse(data: unknown): data is ExtractionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    'metadata' in data
  );
}

export function isValidationIssue(data: unknown): data is ValidationIssue {
  return (
    typeof data === 'object' &&
    data !== null &&
    'severity' in data &&
    'category' in data &&
    'message' in data
  );
}
