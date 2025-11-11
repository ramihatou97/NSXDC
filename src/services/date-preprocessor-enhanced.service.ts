/**
 * Enhanced Date Preprocessor Service (Week 1 Day 2)
 * 
 * Features:
 * 1. Support 5+ date formats (ISO, MM/DD/YYYY, Month DD YYYY, relative, partial)
 * 2. Date type inference (admission/discharge/procedure/event)
 * 3. Multi-factor confidence scoring
 * 4. Date validation (chronological order, length of stay, reasonable ranges)
 * 5. Comprehensive test coverage
 * 
 * Addresses: Date preprocessing errors, temporal coherence, confidence calibration
 */

import type { ValidationWarning } from '../types/index.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of clinical dates
 */
export type DateType =
  | 'admission'
  | 'discharge'
  | 'surgery'
  | 'procedure'
  | 'consultation'
  | 'event'
  | 'follow-up'
  | 'unknown';

/**
 * Date format classifications
 */
export type DateFormat =
  | 'ISO_8601'           // YYYY-MM-DD or YYYY/MM/DD
  | 'US_FORMAT'          // MM/DD/YYYY
  | 'EU_FORMAT'          // DD/MM/YYYY
  | 'WRITTEN_FULL'       // Month DD, YYYY (e.g., "January 15, 2024")
  | 'WRITTEN_SHORT'      // Mon DD, YYYY (e.g., "Jan 15, 2024")
  | 'RELATIVE'           // "3 days ago", "yesterday", "last week"
  | 'PARTIAL'            // "May 2024", "2024", "early January"
  | 'UNKNOWN';

/**
 * Confidence levels
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Factors contributing to confidence score
 */
export interface DateConfidenceFactors {
  formatClarity: number;        // 0-1: How clear is the format?
  contextAvailability: number;  // 0-1: Is there surrounding context?
  temporalConsistency: number;  // 0-1: Does it fit the timeline?
  ambiguityPenalty: number;     // 0-1: Penalty for ambiguous formats
  overallConfidence: number;    // 0-1: Combined confidence score
}

/**
 * Parsed date result
 */
export interface ParsedDate {
  original: string;              // Original text
  normalized: string;            // ISO 8601 format (YYYY-MM-DD)
  format: DateFormat;            // Detected format
  dateType: DateType;            // Inferred type
  confidence: ConfidenceLevel;   // Overall confidence
  confidenceFactors: DateConfidenceFactors;
  context: string;               // Surrounding text (±50 chars)
  position: { start: number; end: number };
  warnings: string[];            // Any issues detected
}

/**
 * Date validation result
 */
export interface DateValidationResult {
  isValid: boolean;
  chronologicalOrder: boolean;   // admission < surgery < discharge
  lengthOfStay?: number;         // Days between admission and discharge
  reasonableRanges: boolean;     // Dates within reasonable bounds
  errors: string[];
  warnings: string[];
}

/**
 * Complete preprocessing result
 */
export interface DatePreprocessingResult {
  parsedDates: ParsedDate[];
  validation: DateValidationResult;
  summary: {
    totalDates: number;
    byType: Record<DateType, number>;
    byFormat: Record<DateFormat, number>;
    avgConfidence: number;
  };
  warnings: ValidationWarning[];
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class DatePreprocessorEnhancedService {
  private readonly MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  private readonly MONTH_ABBR = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];

  private readonly DATE_TYPE_KEYWORDS: Record<DateType, string[]> = {
    admission: ['admitted', 'admission', 'presented', 'arrived', 'ED visit'],
    discharge: ['discharged', 'discharge', 'sent home', 'left hospital', 'released'],
    surgery: ['surgery', 'operation', 'operative', 'OR', 'procedure performed'],
    procedure: ['procedure', 'intervention', 'biopsy', 'tap', 'placed'],
    consultation: ['consult', 'consultation', 'evaluated by', 'seen by'],
    event: ['event', 'incident', 'complication', 'developed', 'occurred'],
    'follow-up': ['follow-up', 'followup', 'return visit', 'clinic visit'],
    unknown: []
  };

  /**
   * Main preprocessing function
   */
  public preprocessDates(clinicalNotes: string): DatePreprocessingResult {
    // Step 1: Parse all dates
    const parsedDates = this.parseAllDates(clinicalNotes);

    // Step 2: Infer date types based on context
    const datesWithTypes = parsedDates.map(date => 
      this.inferDateType(date, clinicalNotes)
    );

    // Step 3: Calculate confidence scores
    const datesWithConfidence = datesWithTypes.map(date =>
      this.calculateConfidence(date, datesWithTypes)
    );

    // Step 4: Validate dates
    const validation = this.validateDates(datesWithConfidence);

    // Step 5: Generate summary
    const summary = this.generateSummary(datesWithConfidence);

    // Step 6: Generate warnings
    const warnings = this.generateWarnings(datesWithConfidence, validation);

    return {
      parsedDates: datesWithConfidence,
      validation,
      summary,
      warnings
    };
  }

  /**
   * Parse all dates from clinical notes
   */
  private parseAllDates(text: string): ParsedDate[] {
    const dates: ParsedDate[] = [];

    // Pattern 1: ISO 8601 (YYYY-MM-DD or YYYY/MM/DD)
    dates.push(...this.parseISO8601(text));

    // Pattern 2: Written dates (Month DD, YYYY)
    dates.push(...this.parseWrittenDates(text));

    // Pattern 3: Numeric dates (MM/DD/YYYY or DD/MM/YYYY)
    dates.push(...this.parseNumericDates(text));

    // Pattern 4: Relative dates ("3 days ago")
    dates.push(...this.parseRelativeDates(text));

    // Pattern 5: Partial dates ("May 2024", "early January")
    dates.push(...this.parsePartialDates(text));

    // Sort by position in text
    return dates.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * Parse ISO 8601 format dates
   */
  private parseISO8601(text: string): ParsedDate[] {
    const dates: ParsedDate[] = [];
    const regex = /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      
      // Validate date components
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        continue; // Invalid date
      }

      const normalized = `${year}-${month}-${day}`;
      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format: 'ISO_8601',
        dateType: 'unknown',
        confidence: 'high',
        confidenceFactors: {
          formatClarity: 1.0,
          contextAvailability: 0.5,
          temporalConsistency: 0.5,
          ambiguityPenalty: 0.0,
          overallConfidence: 0.75
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings: []
      });
    }

    return dates;
  }

  /**
   * Parse written date formats
   */
  private parseWrittenDates(text: string): ParsedDate[] {
    const dates: ParsedDate[] = [];
    
    // Full month names: January 15, 2024 or 15 January 2024
    const fullRegex = new RegExp(
      `\\b(${this.MONTH_NAMES.join('|')}|${this.MONTH_NAMES.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
      'gi'
    );
    
    // Abbreviated month names: Jan 15, 2024
    const abbrRegex = new RegExp(
      `\\b(${this.MONTH_ABBR.join('|')}|${this.MONTH_ABBR.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
      'gi'
    );

    // Parse full month names
    let match;
    while ((match = fullRegex.exec(text)) !== null) {
      const monthName = match[1].toLowerCase();
      const monthNum = (this.MONTH_NAMES.indexOf(monthName) + 1).toString().padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      const normalized = `${year}-${monthNum}-${day}`;
      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format: 'WRITTEN_FULL',
        dateType: 'unknown',
        confidence: 'high',
        confidenceFactors: {
          formatClarity: 1.0,
          contextAvailability: 0.5,
          temporalConsistency: 0.5,
          ambiguityPenalty: 0.0,
          overallConfidence: 0.75
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings: []
      });
    }

    // Parse abbreviated month names
    while ((match = abbrRegex.exec(text)) !== null) {
      const monthAbbr = match[1].toLowerCase();
      const monthNum = (this.MONTH_ABBR.indexOf(monthAbbr) + 1).toString().padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      const normalized = `${year}-${monthNum}-${day}`;
      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format: 'WRITTEN_SHORT',
        dateType: 'unknown',
        confidence: 'high',
        confidenceFactors: {
          formatClarity: 0.95,
          contextAvailability: 0.5,
          temporalConsistency: 0.5,
          ambiguityPenalty: 0.0,
          overallConfidence: 0.725
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings: []
      });
    }

    return dates;
  }

  /**
   * Parse numeric date formats (MM/DD/YYYY or DD/MM/YYYY)
   * Uses heuristics to disambiguate
   */
  private parseNumericDates(text: string): ParsedDate[] {
    const dates: ParsedDate[] = [];
    const regex = /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      let year = match[3];
      
      // Handle 2-digit years
      if (year.length === 2) {
        year = `20${year}`;
      }

      let normalized: string;
      let format: DateFormat;
      let confidence: ConfidenceLevel;
      let ambiguityPenalty = 0.0;
      const warnings: string[] = [];

      // Disambiguate based on values
      if (first > 12) {
        // Must be DD/MM/YYYY
        normalized = `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        format = 'EU_FORMAT';
        confidence = 'high';
      } else if (second > 12) {
        // Must be MM/DD/YYYY
        normalized = `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        format = 'US_FORMAT';
        confidence = 'high';
      } else {
        // Ambiguous - assume US format (MM/DD/YYYY) but flag
        normalized = `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        format = 'US_FORMAT';
        confidence = 'medium';
        ambiguityPenalty = 0.3;
        warnings.push('Ambiguous date format - assumed MM/DD/YYYY');
      }

      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format,
        dateType: 'unknown',
        confidence,
        confidenceFactors: {
          formatClarity: 1.0 - ambiguityPenalty,
          contextAvailability: 0.5,
          temporalConsistency: 0.5,
          ambiguityPenalty,
          overallConfidence: 0.65
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings
      });
    }

    return dates;
  }

  /**
   * Parse relative dates ("3 days ago", "yesterday", "last week")
   */
  private parseRelativeDates(text: string): ParsedDate[] {
    const dates: ParsedDate[] = [];
    const today = new Date();

    // Pattern: "X days/weeks/months ago"
    const relativeRegex = /\b(\d+)\s+(day|days|week|weeks|month|months)\s+ago\b/gi;
    let match;

    while ((match = relativeRegex.exec(text)) !== null) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      let targetDate = new Date(today);
      if (unit.startsWith('day')) {
        targetDate.setDate(targetDate.getDate() - amount);
      } else if (unit.startsWith('week')) {
        targetDate.setDate(targetDate.getDate() - (amount * 7));
      } else if (unit.startsWith('month')) {
        targetDate.setMonth(targetDate.getMonth() - amount);
      }

      const normalized = targetDate.toISOString().split('T')[0];
      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format: 'RELATIVE',
        dateType: 'unknown',
        confidence: 'medium',
        confidenceFactors: {
          formatClarity: 0.7,
          contextAvailability: 0.5,
          temporalConsistency: 0.5,
          ambiguityPenalty: 0.2,
          overallConfidence: 0.6
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings: ['Relative date - calculated from current date']
      });
    }

    // Special cases: "yesterday", "today", "last week"
    const specialCases = [
      { pattern: /\byesterday\b/gi, offset: -1, unit: 'day' },
      { pattern: /\btoday\b/gi, offset: 0, unit: 'day' },
      { pattern: /\blast week\b/gi, offset: -7, unit: 'day' },
      { pattern: /\bnext week\b/gi, offset: 7, unit: 'day' },
    ];

    for (const special of specialCases) {
      while ((match = special.pattern.exec(text)) !== null) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + special.offset);
        const normalized = targetDate.toISOString().split('T')[0];
        const context = this.extractContext(text, match.index, match[0].length);

        dates.push({
          original: match[0],
          normalized,
          format: 'RELATIVE',
          dateType: 'unknown',
          confidence: 'medium',
          confidenceFactors: {
            formatClarity: 0.7,
            contextAvailability: 0.5,
            temporalConsistency: 0.5,
            ambiguityPenalty: 0.2,
            overallConfidence: 0.6
          },
          context,
          position: { start: match.index, end: match.index + match[0].length },
          warnings: ['Relative date - calculated from current date']
        });
      }
    }

    return dates;
  }

  /**
   * Parse partial dates ("May 2024", "early January", "2024")
   */
  private parsePartialDates(text: string): ParsedDate[] {
    const dates: ParsedDate[] = [];

    // Pattern: "Month YYYY"
    const monthYearRegex = new RegExp(
      `\\b(${this.MONTH_NAMES.join('|')}|${this.MONTH_NAMES.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join('|')})\\s+(\\d{4})\\b`,
      'gi'
    );
    
    let match;
    while ((match = monthYearRegex.exec(text)) !== null) {
      const monthName = match[1].toLowerCase();
      const monthNum = (this.MONTH_NAMES.indexOf(monthName) + 1).toString().padStart(2, '0');
      const year = match[2];
      const normalized = `${year}-${monthNum}-01`; // Use first day of month
      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format: 'PARTIAL',
        dateType: 'unknown',
        confidence: 'low',
        confidenceFactors: {
          formatClarity: 0.5,
          contextAvailability: 0.3,
          temporalConsistency: 0.3,
          ambiguityPenalty: 0.5,
          overallConfidence: 0.35
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings: ['Partial date - specific day unknown, using first of month']
      });
    }

    // Pattern: "early/mid/late Month"
    const descriptiveRegex = new RegExp(
      `\\b(early|mid|late)\\s+(${this.MONTH_NAMES.join('|')})\\b`,
      'gi'
    );

    while ((match = descriptiveRegex.exec(text)) !== null) {
      const modifier = match[1].toLowerCase();
      const monthName = match[2].toLowerCase();
      const monthNum = (this.MONTH_NAMES.indexOf(monthName) + 1).toString().padStart(2, '0');
      
      // Estimate day based on modifier
      const day = modifier === 'early' ? '05' : modifier === 'mid' ? '15' : '25';
      
      // Try to find year in nearby context
      const yearMatch = text.slice(Math.max(0, match.index - 50), match.index + 50).match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
      
      const normalized = `${year}-${monthNum}-${day}`;
      const context = this.extractContext(text, match.index, match[0].length);

      dates.push({
        original: match[0],
        normalized,
        format: 'PARTIAL',
        dateType: 'unknown',
        confidence: 'low',
        confidenceFactors: {
          formatClarity: 0.3,
          contextAvailability: 0.3,
          temporalConsistency: 0.3,
          ambiguityPenalty: 0.6,
          overallConfidence: 0.25
        },
        context,
        position: { start: match.index, end: match.index + match[0].length },
        warnings: ['Descriptive date - approximate date estimated']
      });
    }

    return dates;
  }

  /**
   * Infer date type based on surrounding context
   */
  private inferDateType(date: ParsedDate, fullText: string): ParsedDate {
    const contextWindow = 100; // characters before and after
    const start = Math.max(0, date.position.start - contextWindow);
    const end = Math.min(fullText.length, date.position.end + contextWindow);
    const surroundingText = fullText.slice(start, end).toLowerCase();

    // Score each date type based on keyword presence
    const scores: Record<DateType, number> = {
      admission: 0,
      discharge: 0,
      surgery: 0,
      procedure: 0,
      consultation: 0,
      event: 0,
      'follow-up': 0,
      unknown: 0
    };

    for (const [type, keywords] of Object.entries(this.DATE_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (surroundingText.includes(keyword.toLowerCase())) {
          scores[type as DateType] += 1;
        }
      }
    }

    // Find highest score
    let maxScore = 0;
    let inferredType: DateType = 'unknown';
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        inferredType = type as DateType;
      }
    }

    // If no keywords found (maxScore === 0), keep as unknown
    if (maxScore === 0) {
      inferredType = 'unknown';
    }

    return {
      ...date,
      dateType: inferredType
    };
  }

  /**
   * Calculate multi-factor confidence score
   */
  private calculateConfidence(date: ParsedDate, allDates: ParsedDate[]): ParsedDate {
    // Factor 1: Format Clarity (already set during parsing)
    const formatClarity = date.confidenceFactors.formatClarity;

    // Factor 2: Context Availability (is there helpful context?)
    const contextAvailability = this.assessContextQuality(date);

    // Factor 3: Temporal Consistency (does it fit with other dates?)
    const temporalConsistency = this.assessTemporalConsistency(date, allDates);

    // Factor 4: Ambiguity Penalty (already set during parsing)
    const ambiguityPenalty = date.confidenceFactors.ambiguityPenalty;

    // Calculate overall confidence
    const overallConfidence = (
      formatClarity * 0.35 +
      contextAvailability * 0.25 +
      temporalConsistency * 0.25 +
      (1 - ambiguityPenalty) * 0.15
    );

    // Determine confidence level
    let confidence: ConfidenceLevel;
    if (overallConfidence >= 0.75) {
      confidence = 'high';
    } else if (overallConfidence >= 0.50) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      ...date,
      confidence,
      confidenceFactors: {
        formatClarity,
        contextAvailability,
        temporalConsistency,
        ambiguityPenalty,
        overallConfidence
      }
    };
  }

  /**
   * Assess quality of surrounding context
   */
  private assessContextQuality(date: ParsedDate): number {
    const context = date.context.toLowerCase();
    
    // Check for helpful keywords
    const hasDateType = date.dateType !== 'unknown';
    const hasTimeInfo = /\b(at|around|approximately|~)\b/.test(context);
    const hasNoteType = /\b(admission|discharge|progress|operative|consult)\b/.test(context);
    
    let score = 0.5; // Base score
    if (hasDateType) score += 0.3;
    if (hasTimeInfo) score += 0.1;
    if (hasNoteType) score += 0.1;
    
    return Math.min(1.0, score);
  }

  /**
   * Assess temporal consistency with other dates
   */
  private assessTemporalConsistency(date: ParsedDate, allDates: ParsedDate[]): number {
    // If this is the only date, return neutral
    if (allDates.length <= 1) {
      return 0.5;
    }

    try {
      const dateObj = new Date(date.normalized);
      const dateTime = dateObj.getTime();

      // Check if date is reasonable (not too far in past/future)
      const now = new Date().getTime();
      const fiveYearsAgo = now - (5 * 365 * 24 * 60 * 60 * 1000);
      const oneYearFuture = now + (365 * 24 * 60 * 60 * 1000);

      if (dateTime < fiveYearsAgo || dateTime > oneYearFuture) {
        return 0.3; // Suspicious date range
      }

      // Check consistency with other dates of known types
      const admissionDates = allDates.filter(d => d.dateType === 'admission');
      const dischargeDates = allDates.filter(d => d.dateType === 'discharge');

      if (date.dateType === 'discharge' && admissionDates.length > 0) {
        const admissionDate = new Date(admissionDates[0].normalized).getTime();
        if (dateTime < admissionDate) {
          return 0.2; // Discharge before admission - very inconsistent
        }
      }

      if (date.dateType === 'admission' && dischargeDates.length > 0) {
        const dischargeDate = new Date(dischargeDates[0].normalized).getTime();
        if (dateTime > dischargeDate) {
          return 0.2; // Admission after discharge - very inconsistent
        }
      }

      return 0.8; // Looks consistent
    } catch (error) {
      return 0.5; // Unable to validate
    }
  }

  /**
   * Validate dates for chronological order and reasonableness
   */
  private validateDates(dates: ParsedDate[]): DateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Find key dates
    const admissionDates = dates.filter(d => d.dateType === 'admission');
    const dischargeDates = dates.filter(d => d.dateType === 'discharge');
    const surgeryDates = dates.filter(d => d.dateType === 'surgery');

    let chronologicalOrder = true;
    let lengthOfStay: number | undefined;
    let reasonableRanges = true;

    // Validate chronological order
    if (admissionDates.length > 0 && dischargeDates.length > 0) {
      const admission = new Date(admissionDates[0].normalized);
      const discharge = new Date(dischargeDates[0].normalized);

      if (discharge < admission) {
        chronologicalOrder = false;
        errors.push('Discharge date is before admission date');
      }

      // Calculate length of stay
      lengthOfStay = Math.floor((discharge.getTime() - admission.getTime()) / (24 * 60 * 60 * 1000));

      if (lengthOfStay < 0) {
        reasonableRanges = false;
        errors.push('Negative length of stay');
      } else if (lengthOfStay > 365) {
        reasonableRanges = false;
        warnings.push(`Unusually long hospital stay (${lengthOfStay} days)`);
      } else if (lengthOfStay > 90) {
        warnings.push(`Long hospital stay (${lengthOfStay} days) - verify dates`);
      }
    }

    // Validate surgery is between admission and discharge
    if (surgeryDates.length > 0 && admissionDates.length > 0 && dischargeDates.length > 0) {
      const surgery = new Date(surgeryDates[0].normalized);
      const admission = new Date(admissionDates[0].normalized);
      const discharge = new Date(dischargeDates[0].normalized);

      if (surgery < admission || surgery > discharge) {
        chronologicalOrder = false;
        errors.push('Surgery date is outside admission-discharge range');
      }
    }

    // Check for future dates
    const now = new Date();
    for (const date of dates) {
      const dateObj = new Date(date.normalized);
      if (dateObj > now) {
        warnings.push(`Future date detected: ${date.original} (${date.normalized})`);
      }
    }

    // Check for very old dates
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    for (const date of dates) {
      const dateObj = new Date(date.normalized);
      if (dateObj < fiveYearsAgo) {
        warnings.push(`Date more than 5 years old: ${date.original} (${date.normalized})`);
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      chronologicalOrder,
      lengthOfStay,
      reasonableRanges,
      errors,
      warnings
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(dates: ParsedDate[]) {
    const byType: Record<DateType, number> = {
      admission: 0,
      discharge: 0,
      surgery: 0,
      procedure: 0,
      consultation: 0,
      event: 0,
      'follow-up': 0,
      unknown: 0
    };

    const byFormat: Record<DateFormat, number> = {
      ISO_8601: 0,
      US_FORMAT: 0,
      EU_FORMAT: 0,
      WRITTEN_FULL: 0,
      WRITTEN_SHORT: 0,
      RELATIVE: 0,
      PARTIAL: 0,
      UNKNOWN: 0
    };

    let totalConfidence = 0;

    for (const date of dates) {
      byType[date.dateType]++;
      byFormat[date.format]++;
      totalConfidence += date.confidenceFactors.overallConfidence;
    }

    const avgConfidence = dates.length > 0 ? totalConfidence / dates.length : 0;

    return {
      totalDates: dates.length,
      byType,
      byFormat,
      avgConfidence
    };
  }

  /**
   * Generate validation warnings
   */
  private generateWarnings(dates: ParsedDate[], validation: DateValidationResult): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Add validation errors as warnings
    for (const error of validation.errors) {
      warnings.push({
        type: 'temporal_inconsistency',
        message: error,
        recommendation: 'Verify dates in source document and correct if needed'
      });
    }

    // Add validation warnings
    for (const warning of validation.warnings) {
      warnings.push({
        type: 'requires_verification',
        message: warning,
        recommendation: 'Review dates for accuracy'
      });
    }

    // Add warnings for low confidence dates
    const lowConfidenceDates = dates.filter(d => d.confidence === 'low');
    if (lowConfidenceDates.length > 0) {
      warnings.push({
        type: 'low_confidence',
        message: `${lowConfidenceDates.length} dates with low confidence`,
        recommendation: 'Review low-confidence dates and provide more context if possible'
      });
    }

    // Add warnings for ambiguous formats
    const ambiguousDates = dates.filter(d => d.warnings.length > 0);
    if (ambiguousDates.length > 0) {
      warnings.push({
        type: 'requires_verification',
        message: `${ambiguousDates.length} dates with ambiguous format`,
        recommendation: 'Verify date interpretations match source document'
      });
    }

    // Add warning if no key dates found
    const hasAdmission = dates.some(d => d.dateType === 'admission');
    const hasDischarge = dates.some(d => d.dateType === 'discharge');
    
    if (!hasAdmission) {
      warnings.push({
        type: 'missing_data',
        message: 'No admission date detected',
        recommendation: 'Verify admission date is present in clinical notes'
      });
    }

    if (!hasDischarge) {
      warnings.push({
        type: 'missing_data',
        message: 'No discharge date detected',
        recommendation: 'Verify discharge date is present in clinical notes'
      });
    }

    return warnings;
  }

  /**
   * Extract surrounding context for a date
   */
  private extractContext(text: string, position: number, length: number): string {
    const contextSize = 50;
    const start = Math.max(0, position - contextSize);
    const end = Math.min(text.length, position + length + contextSize);
    
    let context = text.slice(start, end);
    
    // Trim to word boundaries
    if (start > 0) {
      const firstSpace = context.indexOf(' ');
      if (firstSpace > 0) {
        context = '...' + context.slice(firstSpace);
      }
    }
    
    if (end < text.length) {
      const lastSpace = context.lastIndexOf(' ');
      if (lastSpace > 0) {
        context = context.slice(0, lastSpace) + '...';
      }
    }
    
    return context.trim();
  }

  /**
   * Get key dates for quick access
   */
  public getKeyDates(result: DatePreprocessingResult): {
    admission?: ParsedDate;
    discharge?: ParsedDate;
    surgery?: ParsedDate;
  } {
    return {
      admission: result.parsedDates.find(d => d.dateType === 'admission'),
      discharge: result.parsedDates.find(d => d.dateType === 'discharge'),
      surgery: result.parsedDates.find(d => d.dateType === 'surgery')
    };
  }
}
