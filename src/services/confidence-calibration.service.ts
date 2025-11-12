/**
 * Confidence Calibration Service
 * 
 * Provides multi-factor confidence scoring and uncertainty quantification
 * for all components of the medical extraction pipeline.
 * 
 * Week 3 Day 13: Medical Intelligence Layer
 * 
 * Features:
 * - Multi-factor confidence scoring
 * - Uncertainty quantification
 * - Completeness metrics
 * - Consistency checking
 * - Source reliability assessment
 * - Calibration and adjustment
 */

/**
 * Confidence level categories
 */
export type ConfidenceLevel = 'critical' | 'high' | 'medium' | 'low' | 'very-low';

/**
 * Confidence factor weights (configurable)
 */
export interface ConfidenceWeights {
  sourceReliability: number;     // 0-1: How reliable is the data source?
  extractionQuality: number;     // 0-1: How well was the data extracted?
  completeness: number;          // 0-1: How complete is the information?
  consistency: number;           // 0-1: Is it consistent with other data?
  medicalValidity: number;       // 0-1: Is it medically plausible?
  temporalCoherence: number;     // 0-1: Does timing make sense?
  contextClarity: number;        // 0-1: Is the context clear?
}

/**
 * Default confidence weights (balanced)
 */
export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  sourceReliability: 0.20,
  extractionQuality: 0.20,
  completeness: 0.15,
  consistency: 0.15,
  medicalValidity: 0.15,
  temporalCoherence: 0.10,
  contextClarity: 0.05
};

/**
 * Confidence factors for a single data point
 */
export interface ConfidenceFactors {
  sourceReliability: number;     // 0-1
  extractionQuality: number;     // 0-1
  completeness: number;          // 0-1
  consistency: number;           // 0-1
  medicalValidity: number;       // 0-1
  temporalCoherence: number;     // 0-1
  contextClarity: number;        // 0-1
  overallConfidence: number;     // 0-1: Weighted combination
}

/**
 * Calibrated confidence score
 */
export interface CalibratedConfidence {
  level: ConfidenceLevel;        // Categorical level
  score: number;                 // 0-1: Numeric score
  factors: ConfidenceFactors;    // Individual factor scores
  uncertainties: string[];       // List of uncertainty sources
  recommendations: string[];     // Recommendations for improvement
}

/**
 * Source type for reliability assessment
 */
export type SourceType = 
  | 'admission_note'
  | 'progress_note'
  | 'discharge_summary'
  | 'operative_report'
  | 'consultation_note'
  | 'radiology_report'
  | 'lab_report'
  | 'medication_list'
  | 'nursing_note'
  | 'unknown';

/**
 * Extraction method type
 */
export type ExtractionMethod = 
  | 'direct_quote'
  | 'explicit_value'
  | 'inferred_value'
  | 'calculated_value'
  | 'deduced_value'
  | 'default_value';

/**
 * Medical validity context
 */
export interface MedicalValidityContext {
  dataType: 'medication' | 'diagnosis' | 'procedure' | 'vital' | 'lab' | 'date' | 'other';
  value: any;
  expectedRange?: [number, number];
  expectedValues?: string[];
  relatedData?: Record<string, any>;
}

/**
 * Temporal coherence context
 */
export interface TemporalCoherenceContext {
  eventDate: Date;
  referenceDate?: Date;
  relatedEvents?: Array<{ date: Date; type: string }>;
  expectedOrder?: string[];
}

/**
 * Completeness context
 */
export interface CompletenessContext {
  requiredFields: string[];
  providedFields: string[];
  optionalFields?: string[];
}

/**
 * Consistency context
 */
export interface ConsistencyContext {
  currentValue: any;
  relatedValues: Array<{ field: string; value: any; source?: string }>;
}

/**
 * Confidence Calibration Service
 */
export class ConfidenceCalibrationService {
  private weights: ConfidenceWeights;
  
  // Source reliability scores (based on documentation type)
  private readonly SOURCE_RELIABILITY: Record<SourceType, number> = {
    'operative_report': 1.0,      // Most reliable
    'discharge_summary': 0.95,
    'admission_note': 0.90,
    'radiology_report': 0.90,
    'lab_report': 0.95,
    'consultation_note': 0.85,
    'medication_list': 0.85,
    'progress_note': 0.80,
    'nursing_note': 0.75,
    'unknown': 0.50               // Least reliable
  };

  // Extraction method reliability scores
  private readonly EXTRACTION_QUALITY: Record<ExtractionMethod, number> = {
    'direct_quote': 1.0,          // Most reliable
    'explicit_value': 0.95,
    'calculated_value': 0.85,
    'inferred_value': 0.70,
    'deduced_value': 0.60,
    'default_value': 0.40         // Least reliable
  };

  // Confidence level thresholds
  private readonly CONFIDENCE_THRESHOLDS = {
    critical: 0.95,  // > 0.95
    high: 0.75,      // 0.75 - 0.95
    medium: 0.50,    // 0.50 - 0.75
    low: 0.30,       // 0.30 - 0.50
    'very-low': 0.0  // < 0.30
  };

  constructor(customWeights?: Partial<ConfidenceWeights>) {
    this.weights = {
      ...DEFAULT_CONFIDENCE_WEIGHTS,
      ...customWeights
    };

    // Ensure weights sum to 1.0
    this.normalizeWeights();
  }

  /**
   * Calculate comprehensive confidence score for a data point
   */
  calculateConfidence(params: {
    sourceType?: SourceType;
    extractionMethod?: ExtractionMethod;
    completeness?: CompletenessContext;
    consistency?: ConsistencyContext;
    medicalValidity?: MedicalValidityContext;
    temporalCoherence?: TemporalCoherenceContext;
    contextClarity?: number;
  }): CalibratedConfidence {
    // Calculate individual factors
    const sourceReliability = this.assessSourceReliability(params.sourceType);
    const extractionQuality = this.assessExtractionQuality(params.extractionMethod);
    const completeness = this.assessCompleteness(params.completeness);
    const consistency = this.assessConsistency(params.consistency);
    const medicalValidity = this.assessMedicalValidity(params.medicalValidity);
    const temporalCoherence = this.assessTemporalCoherence(params.temporalCoherence);
    const contextClarity = params.contextClarity ?? 0.5;

    // Calculate weighted overall confidence
    const overallConfidence = 
      sourceReliability * this.weights.sourceReliability +
      extractionQuality * this.weights.extractionQuality +
      completeness * this.weights.completeness +
      consistency * this.weights.consistency +
      medicalValidity * this.weights.medicalValidity +
      temporalCoherence * this.weights.temporalCoherence +
      contextClarity * this.weights.contextClarity;

    // Determine confidence level
    const level = this.getConfidenceLevel(overallConfidence);

    // Create complete factors object
    const factors: ConfidenceFactors = {
      sourceReliability,
      extractionQuality,
      completeness,
      consistency,
      medicalValidity,
      temporalCoherence,
      contextClarity,
      overallConfidence
    };

    // Identify uncertainties
    const uncertainties = this.identifyUncertainties(factors);

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, params);

    return {
      level,
      score: overallConfidence,
      factors: {
        sourceReliability,
        extractionQuality,
        completeness,
        consistency,
        medicalValidity,
        temporalCoherence,
        contextClarity,
        overallConfidence
      },
      uncertainties,
      recommendations
    };
  }

  /**
   * Assess source reliability based on documentation type
   */
  private assessSourceReliability(sourceType?: SourceType): number {
    if (!sourceType || sourceType === 'unknown') {
      return this.SOURCE_RELIABILITY.unknown;
    }
    return this.SOURCE_RELIABILITY[sourceType] ?? 0.5;
  }

  /**
   * Assess extraction quality based on method used
   */
  private assessExtractionQuality(method?: ExtractionMethod): number {
    if (!method) {
      return 0.5; // Default mid-range if unknown
    }
    return this.EXTRACTION_QUALITY[method] ?? 0.5;
  }

  /**
   * Assess data completeness
   */
  private assessCompleteness(context?: CompletenessContext): number {
    if (!context) {
      return 0.5; // Default if no context
    }

    const { requiredFields, providedFields } = context;
    
    if (requiredFields.length === 0) {
      return 1.0; // No requirements
    }

    // Check which required fields are provided
    const providedRequired = requiredFields.filter(field =>
      providedFields.includes(field)
    );

    // Base score: percentage of required fields provided
    const baseScore = providedRequired.length / requiredFields.length;

    // Bonus for optional fields if provided
    const optionalBonus = context.optionalFields 
      ? context.optionalFields.filter(field => 
          providedFields.includes(field)
        ).length * 0.05
      : 0;

    return Math.min(1.0, baseScore + optionalBonus);
  }

  /**
   * Assess data consistency with related values
   */
  private assessConsistency(context?: ConsistencyContext): number {
    if (!context || !context.relatedValues || context.relatedValues.length === 0) {
      return 0.5; // Default if no related values to compare
    }

    const { currentValue, relatedValues } = context;
    let consistencyScore = 1.0;

    // Check for contradictions
    for (const related of relatedValues) {
      if (this.valuesContradict(currentValue, related.value)) {
        consistencyScore -= 0.3; // Penalty for each contradiction
      }
    }

    return Math.max(0.0, consistencyScore);
  }

  /**
   * Check if two values contradict each other
   */
  private valuesContradict(value1: any, value2: any): boolean {
    // Same type comparison
    if (typeof value1 !== typeof value2) {
      return false; // Different types, can't directly contradict
    }

    // String comparison (case-insensitive)
    if (typeof value1 === 'string') {
      return value1.toLowerCase() !== value2.toLowerCase();
    }

    // Number comparison (with tolerance)
    if (typeof value1 === 'number') {
      const tolerance = Math.abs(value1) * 0.1; // 10% tolerance
      return Math.abs(value1 - value2) > tolerance;
    }

    // Boolean comparison
    if (typeof value1 === 'boolean') {
      return value1 !== value2;
    }

    // Object comparison (shallow)
    if (typeof value1 === 'object') {
      return JSON.stringify(value1) !== JSON.stringify(value2);
    }

    return false;
  }

  /**
   * Assess medical validity
   */
  private assessMedicalValidity(context?: MedicalValidityContext): number {
    if (!context) {
      return 0.5; // Default if no context
    }

    const { dataType, value, expectedRange, expectedValues } = context;

    // Check against expected range (for numeric values)
    if (expectedRange && typeof value === 'number') {
      const [min, max] = expectedRange;
      if (value < min || value > max) {
        // Outside expected range - calculate how far
        const distance = value < min 
          ? (min - value) / min 
          : (value - max) / max;
        
        // More distance = lower validity
        return Math.max(0.0, 1.0 - distance);
      }
      return 1.0; // Within expected range
    }

    // Check against expected values (for categorical data)
    if (expectedValues && typeof value === 'string') {
      const normalizedValue = value.toLowerCase().trim();
      const matches = expectedValues.some(expected =>
        expected.toLowerCase().trim() === normalizedValue
      );
      return matches ? 1.0 : 0.4;
    }

    // Type-specific validation
    switch (dataType) {
      case 'medication':
        return this.validateMedicationValue(value);
      case 'diagnosis':
        return this.validateDiagnosisValue(value);
      case 'vital':
        return this.validateVitalValue(value, context);
      default:
        return 0.7; // Default for unknown types
    }
  }

  /**
   * Validate medication value
   */
  private validateMedicationValue(value: any): number {
    if (!value || typeof value !== 'string') {
      return 0.3;
    }

    // Check for common medication name patterns
    const hasValidPattern = /^[a-z]+$/i.test(value.replace(/\s/g, ''));
    const hasReasonableLength = value.length >= 3 && value.length <= 50;

    if (hasValidPattern && hasReasonableLength) {
      return 0.8;
    } else if (hasValidPattern || hasReasonableLength) {
      return 0.6;
    }

    return 0.4;
  }

  /**
   * Validate diagnosis value
   */
  private validateDiagnosisValue(value: any): number {
    if (!value || typeof value !== 'string') {
      return 0.3;
    }

    // Check for medical terminology patterns
    const hasLatinRoots = /oma|itis|osis|pathy|trophy|plasia/i.test(value);
    const hasReasonableLength = value.length >= 4 && value.length <= 100;

    if (hasLatinRoots && hasReasonableLength) {
      return 0.8;
    } else if (hasReasonableLength) {
      return 0.6;
    }

    return 0.4;
  }

  /**
   * Validate vital sign value
   */
  private validateVitalValue(value: any, context: MedicalValidityContext): number {
    if (typeof value !== 'number') {
      return 0.3;
    }

    // Use provided range if available
    if (context.expectedRange) {
      const [min, max] = context.expectedRange;
      if (value >= min && value <= max) {
        return 1.0;
      }
      
      // Outside range but plausible (within 50% of range)
      const rangeSpan = max - min;
      const distanceFromRange = value < min ? (min - value) : (value - max);
      
      if (distanceFromRange <= rangeSpan * 0.5) {
        return 0.6;
      }
      
      return 0.3; // Too far from expected range
    }

    // Basic vital sign validation (generic ranges)
    if (value > 0 && value < 1000) {
      return 0.7; // Reasonable range for most vitals
    }

    return 0.3;
  }

  /**
   * Assess temporal coherence
   */
  private assessTemporalCoherence(context?: TemporalCoherenceContext): number {
    if (!context) {
      return 0.5; // Default if no temporal context
    }

    const { eventDate, referenceDate, relatedEvents, expectedOrder } = context;
    let score = 1.0;

    // Check against reference date (e.g., discharge date should be after admission)
    if (referenceDate) {
      const isCoherent = eventDate <= referenceDate;
      if (!isCoherent) {
        score -= 0.4; // Major penalty for temporal incoherence
      }
    }

    // Check against related events
    if (relatedEvents && relatedEvents.length > 0) {
      // Check if order makes sense with expected order
      if (expectedOrder && expectedOrder.length > 0) {
        // More sophisticated ordering check could go here
        // For now, just check basic temporal consistency
        relatedEvents.forEach(() => {
          // Placeholder for future temporal ordering logic
        });
      }
    }

    // Check for future dates (usually suspicious)
    const now = new Date();
    if (eventDate > now) {
      const daysDiff = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) {
        score -= 0.3; // Penalty for dates far in the future
      }
    }

    // Check for very old dates (potentially data errors)
    const yearsAgo = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsAgo > 10) {
      score -= 0.2; // Slight penalty for very old dates
    }

    return Math.max(0.0, score);
  }

  /**
   * Convert numeric confidence to categorical level
   */
  private getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= this.CONFIDENCE_THRESHOLDS.critical) {
      return 'critical';
    } else if (score >= this.CONFIDENCE_THRESHOLDS.high) {
      return 'high';
    } else if (score >= this.CONFIDENCE_THRESHOLDS.medium) {
      return 'medium';
    } else if (score >= this.CONFIDENCE_THRESHOLDS.low) {
      return 'low';
    } else {
      return 'very-low';
    }
  }

  /**
   * Identify sources of uncertainty
   */
  private identifyUncertainties(factors: ConfidenceFactors): string[] {
    const uncertainties: string[] = [];
    const threshold = 0.6; // Flag factors below this threshold

    if (factors.sourceReliability < threshold) {
      uncertainties.push('Uncertain data source reliability');
    }

    if (factors.extractionQuality < threshold) {
      uncertainties.push('Low extraction quality (inferred or deduced value)');
    }

    if (factors.completeness < threshold) {
      uncertainties.push('Incomplete data - missing required fields');
    }

    if (factors.consistency < threshold) {
      uncertainties.push('Inconsistent with other documented values');
    }

    if (factors.medicalValidity < threshold) {
      uncertainties.push('Questionable medical validity');
    }

    if (factors.temporalCoherence < threshold) {
      uncertainties.push('Temporal inconsistency detected');
    }

    if (factors.contextClarity < threshold) {
      uncertainties.push('Unclear context or ambiguous phrasing');
    }

    return uncertainties;
  }

  /**
   * Generate recommendations for improving confidence
   */
  private generateRecommendations(
    factors: ConfidenceFactors,
    _params: any  // Reserved for future use
  ): string[] {
    const recommendations: string[] = [];
    const threshold = 0.7;

    if (factors.sourceReliability < threshold) {
      recommendations.push('Verify information from more reliable source (e.g., operative report, discharge summary)');
    }

    if (factors.extractionQuality < threshold) {
      recommendations.push('Look for explicit statement or direct quote in documentation');
    }

    if (factors.completeness < threshold) {
      recommendations.push('Obtain missing required information from additional documentation');
    }

    if (factors.consistency < threshold) {
      recommendations.push('Investigate contradictory values and determine correct information');
    }

    if (factors.medicalValidity < threshold) {
      recommendations.push('Verify medical plausibility with clinical expert');
    }

    if (factors.temporalCoherence < threshold) {
      recommendations.push('Confirm dates and event sequence with clinical team');
    }

    if (factors.contextClarity < threshold) {
      recommendations.push('Clarify ambiguous context or phrasing in documentation');
    }

    return recommendations;
  }

  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    
    if (Math.abs(sum - 1.0) > 0.001) {
      // Normalize each weight
      for (const key of Object.keys(this.weights) as Array<keyof ConfidenceWeights>) {
        this.weights[key] = this.weights[key] / sum;
      }
    }
  }

  /**
   * Get current weight configuration
   */
  getWeights(): ConfidenceWeights {
    return { ...this.weights };
  }

  /**
   * Update weight configuration
   */
  updateWeights(newWeights: Partial<ConfidenceWeights>): void {
    this.weights = {
      ...this.weights,
      ...newWeights
    };
    this.normalizeWeights();
  }

  /**
   * Calculate aggregate confidence for multiple data points
   */
  calculateAggregateConfidence(confidences: CalibratedConfidence[]): CalibratedConfidence {
    if (confidences.length === 0) {
      throw new Error('Cannot calculate aggregate confidence for empty array');
    }

    if (confidences.length === 1) {
      return confidences[0];
    }

    // Calculate average of each factor
    const avgFactors: ConfidenceFactors = {
      sourceReliability: 0,
      extractionQuality: 0,
      completeness: 0,
      consistency: 0,
      medicalValidity: 0,
      temporalCoherence: 0,
      contextClarity: 0,
      overallConfidence: 0
    };

    for (const conf of confidences) {
      for (const key of Object.keys(avgFactors) as Array<keyof ConfidenceFactors>) {
        avgFactors[key] += conf.factors[key];
      }
    }

    for (const key of Object.keys(avgFactors) as Array<keyof ConfidenceFactors>) {
      avgFactors[key] /= confidences.length;
    }

    // Collect all uncertainties (unique)
    const allUncertainties = new Set<string>();
    for (const conf of confidences) {
      conf.uncertainties.forEach(u => allUncertainties.add(u));
    }

    // Collect all recommendations (unique)
    const allRecommendations = new Set<string>();
    for (const conf of confidences) {
      conf.recommendations.forEach(r => allRecommendations.add(r));
    }

    return {
      level: this.getConfidenceLevel(avgFactors.overallConfidence),
      score: avgFactors.overallConfidence,
      factors: avgFactors,
      uncertainties: Array.from(allUncertainties),
      recommendations: Array.from(allRecommendations)
    };
  }

  /**
   * Convert old confidence format to new calibrated format
   */
  convertLegacyConfidence(
    oldConfidence: 'high' | 'medium' | 'low',
    sourceType?: SourceType,
    extractionMethod?: ExtractionMethod
  ): CalibratedConfidence {
    // Map old confidence to score
    const scoreMap = {
      'high': 0.85,
      'medium': 0.65,
      'low': 0.40
    };

    const baseScore = scoreMap[oldConfidence];

    return this.calculateConfidence({
      sourceType,
      extractionMethod,
      contextClarity: baseScore
    });
  }
}
