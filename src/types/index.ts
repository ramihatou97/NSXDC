/**
 * NSXDC Type Definitions
 * Neurosurgical Discharge Summarizer - eXtended & Distributed Core
 *
 * VALIDATED extraction and QA validation ALWAYS ON by design
 */

// ============================================================================
// EXTRACTION TYPES
// ============================================================================

/**
 * Extraction modes - VALIDATED is default and recommended
 */
export type ExtractionMode = 'PURE' | 'DEDUCTION' | 'VALIDATED';

/**
 * Narrative generation modes
 */
export type NarrativeMode = 'STRICT' | 'STANDARD' | 'ENHANCED';

/**
 * Grounded value with source attribution
 */
export interface GroundedValue<T = any> {
  value: T;
  sourceQuote: string;
  confidence: 'high' | 'medium' | 'low';
  deductionMethod?: string;
  warnings?: ValidationWarning[];
}

/**
 * Warning embedded in extraction (VALIDATED mode)
 */
export interface ValidationWarning {
  type: 'missing_data' | 'low_confidence' | 'contradiction' | 'temporal_inconsistency' | 'medical_inconsistency' | 'requires_verification';
  message: string;
  recommendation?: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation issue from QA layer
 */
export interface ValidationIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'grounding' | 'temporal' | 'medical' | 'mode' | 'completeness' | 'confidence' | 'fabrication' | 'quality';
  message: string;
  location?: string;
  suggestedFix?: string;
  details?: string;
}

/**
 * Validation result from QA layer
 */
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
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Extraction request
 */
export interface ExtractionRequest {
  clinicalNotes: string;
  mode?: ExtractionMode; // Defaults to VALIDATED
  narrativeMode?: NarrativeMode;
  includeValidation?: boolean; // Defaults to TRUE (always ON)
}

/**
 * Extraction response
 */
export interface ExtractionResponse {
  success: boolean;
  extraction?: Record<string, any>;
  narrative?: string;
  validation?: ValidationResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    extractionMode: ExtractionMode;
    narrativeMode?: NarrativeMode;
    modelUsed: string;
    tokenCount?: {
      input: number;
      output: number;
      cached?: number;
    };
    processingTime: number;
    timestamp: string;
  };
}

// ============================================================================
// LLM SERVICE TYPES
// ============================================================================

/**
 * LLM configuration
 */
export interface LLMConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  enableCaching?: boolean;
}

/**
 * LLM request with prompt caching support
 */
export interface LLMRequest {
  system: Array<{
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  }>;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
}

/**
 * LLM response with token usage
 */
export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

/**
 * Orchestrator configuration
 * VALIDATED mode and validation ALWAYS ON by default
 */
export interface OrchestratorConfig {
  extractionMode: ExtractionMode;
  narrativeMode: NarrativeMode;
  enableCaching: boolean;
  forceValidation: boolean; // ALWAYS TRUE - cannot be disabled
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  extractionMode: 'VALIDATED',
  narrativeMode: 'STANDARD',
  enableCaching: true,
  forceValidation: true, // ENFORCED
};
