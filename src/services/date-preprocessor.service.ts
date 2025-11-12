/**
 * Date Preprocessor Service
 * Handles date format detection and preprocessing for clinical notes
 * Addresses DD/MM/YYYY vs MM/DD/YYYY ambiguity
 */

import type { ValidationWarning, DateFormatType } from '../types/index.js';

export interface DatePreprocessorConfig {
  preferredFormat: DateFormatType;
  dateFormatHints?: string; // User-provided context about date format
}

export interface DatePattern {
  original: string;
  normalized: string; // ISO 8601 format
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  position: { start: number; end: number };
}

export interface DateFormatAnalysis {
  detectedFormat: DateFormatType;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  patternsFound: {
    ddmmyyyy: number;
    mmddyyyy: number;
    yyyymmdd: number;
    ambiguous: number;
  };
  unambiguousDates: DatePattern[];
  ambiguousDates: DatePattern[];
}

export interface PreprocessResult {
  annotatedNotes: string;
  conversions: DatePattern[];
  warnings: ValidationWarning[];
  analysis: DateFormatAnalysis;
}

export class DatePreprocessorService {
  /**
   * Detect date format pattern in clinical notes
   */
  detectDateFormats(clinicalNotes: string): DateFormatAnalysis {
    const patterns = {
      ddmmyyyy: 0,
      mmddyyyy: 0,
      yyyymmdd: 0,
      ambiguous: 0,
    };

    const unambiguousDates: DatePattern[] = [];
    const ambiguousDates: DatePattern[] = [];

    // Regex patterns for different date formats
    const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
    const isoRegex = /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g;
    const monthNameRegex = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{2,4})\b/gi;

    let match;

    // Check for ISO format (YYYY-MM-DD)
    while ((match = isoRegex.exec(clinicalNotes)) !== null) {
      patterns.yyyymmdd++;
      unambiguousDates.push({
        original: match[0],
        normalized: `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
        confidence: 'high',
        reasoning: 'ISO 8601 format',
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Check for month names (unambiguous)
    while ((match = monthNameRegex.exec(clinicalNotes)) !== null) {
      const monthNames: { [key: string]: string } = {
        January: '01', February: '02', March: '03', April: '04',
        May: '05', June: '06', July: '07', August: '08',
        September: '09', October: '10', November: '11', December: '12',
      };
      const day = match[1].padStart(2, '0');
      const month = monthNames[match[2]];
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];

      unambiguousDates.push({
        original: match[0],
        normalized: `${year}-${month}-${day}`,
        confidence: 'high',
        reasoning: 'Month name present',
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Check ambiguous DD/MM or MM/DD patterns
    const usedPositions = new Set(
      [...unambiguousDates].map(d => `${d.position.start}-${d.position.end}`)
    );

    while ((match = dateRegex.exec(clinicalNotes)) !== null) {
      const posKey = `${match.index}-${match.index + match[0].length}`;
      if (usedPositions.has(posKey)) continue; // Skip already processed dates

      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];

      // Determine if unambiguous
      if (first > 12) {
        // Must be DD/MM/YYYY
        patterns.ddmmyyyy++;
        unambiguousDates.push({
          original: match[0],
          normalized: `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`,
          confidence: 'high',
          reasoning: `Day=${first} > 12, must be DD/MM/YYYY`,
          position: { start: match.index, end: match.index + match[0].length },
        });
      } else if (second > 12) {
        // Must be MM/DD/YYYY
        patterns.mmddyyyy++;
        unambiguousDates.push({
          original: match[0],
          normalized: `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`,
          confidence: 'high',
          reasoning: `Day=${second} > 12, must be MM/DD/YYYY`,
          position: { start: match.index, end: match.index + match[0].length },
        });
      } else {
        // Ambiguous (both ≤ 12)
        patterns.ambiguous++;
        ambiguousDates.push({
          original: match[0],
          normalized: '', // Will be determined by context
          confidence: 'low',
          reasoning: 'Ambiguous - both values ≤ 12',
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    // Determine overall format
    let detectedFormat: DateFormatType = 'AUTO';
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let reasoning = '';

    if (patterns.yyyymmdd > patterns.ddmmyyyy && patterns.yyyymmdd > patterns.mmddyyyy) {
      detectedFormat = 'YYYY-MM-DD';
      confidence = 'high';
      reasoning = `ISO 8601 format predominant (${patterns.yyyymmdd} occurrences)`;
    } else if (patterns.ddmmyyyy > patterns.mmddyyyy * 2) {
      detectedFormat = 'DD/MM/YYYY';
      confidence = 'high';
      reasoning = `DD/MM/YYYY pattern predominant (${patterns.ddmmyyyy} unambiguous occurrences)`;
    } else if (patterns.mmddyyyy > patterns.ddmmyyyy * 2) {
      detectedFormat = 'MM/DD/YYYY';
      confidence = 'high';
      reasoning = `MM/DD/YYYY pattern predominant (${patterns.mmddyyyy} unambiguous occurrences)`;
    } else if (patterns.ddmmyyyy > 0 && patterns.mmddyyyy === 0) {
      detectedFormat = 'DD/MM/YYYY';
      confidence = 'medium';
      reasoning = `Some DD/MM/YYYY evidence, no MM/DD/YYYY evidence`;
    } else if (patterns.mmddyyyy > 0 && patterns.ddmmyyyy === 0) {
      detectedFormat = 'MM/DD/YYYY';
      confidence = 'medium';
      reasoning = `Some MM/DD/YYYY evidence, no DD/MM/YYYY evidence`;
    } else {
      detectedFormat = 'AUTO';
      confidence = 'low';
      reasoning = `Insufficient evidence to determine format (${patterns.ambiguous} ambiguous dates)`;
    }

    return {
      detectedFormat,
      confidence,
      reasoning,
      patternsFound: patterns,
      unambiguousDates,
      ambiguousDates,
    };
  }

  /**
   * Preprocess dates in clinical notes with format standardization
   */
  preprocessDates(clinicalNotes: string, config: DatePreprocessorConfig): PreprocessResult {
    const analysis = this.detectDateFormats(clinicalNotes);
    const conversions: DatePattern[] = [];
    const warnings: ValidationWarning[] = [];

    // Determine format to use
    const wasAutoDetected = config.preferredFormat === 'AUTO';
    let formatToUse: DateFormatType = config.preferredFormat;
    if (config.preferredFormat === 'AUTO') {
      formatToUse = analysis.detectedFormat;
      if (analysis.confidence === 'low') {
        warnings.push({
          type: 'requires_verification',
          message: `Date format auto-detection has low confidence. ${analysis.reasoning}`,
          recommendation: 'Manually specify date format (DD/MM/YYYY or MM/DD/YYYY) for better accuracy.',
        });
      }
    }

    // Start with original notes
    let annotatedNotes = clinicalNotes;

    // Process ambiguous dates with determined format
    for (const ambigDate of analysis.ambiguousDates) {
      const match = ambigDate.original.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (!match) continue;

      const first = match[1].padStart(2, '0');
      const second = match[2].padStart(2, '0');
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];

      let normalized: string;
      let interpretation: string;

      if (formatToUse === 'DD/MM/YYYY') {
        normalized = `${year}-${second}-${first}`;
        interpretation = `Interpreted as DD/MM/YYYY: ${first}/${second}/${year} → ${normalized}`;
      } else if (formatToUse === 'MM/DD/YYYY') {
        normalized = `${year}-${first}-${second}`;
        interpretation = `Interpreted as MM/DD/YYYY: ${first}/${second}/${year} → ${normalized}`;
      } else {
        // Cannot determine - leave ambiguous
        normalized = ambigDate.original;
        interpretation = `Ambiguous date format - unable to normalize`;
        warnings.push({
          type: 'low_confidence',
          message: `Date "${ambigDate.original}" is ambiguous (could be DD/MM or MM/DD)`,
          recommendation: 'Specify date format for accurate extraction',
        });
        continue;
      }

      conversions.push({
        original: ambigDate.original,
        normalized,
        confidence: wasAutoDetected ? 'low' : 'medium',
        reasoning: interpretation,
        position: ambigDate.position,
      });
    }

    // Add conversions for unambiguous dates
    conversions.push(...analysis.unambiguousDates);

    // Generate summary warning if many ambiguous dates
    if (analysis.ambiguousDates.length > 3) {
      warnings.push({
        type: 'requires_verification',
        message: `Found ${analysis.ambiguousDates.length} ambiguous dates. All interpreted as ${formatToUse}.`,
        recommendation: 'Verify date interpretations are correct, especially for critical dates (admission, surgery, discharge).',
      });
    }

    return {
      annotatedNotes,
      conversions,
      warnings,
      analysis,
    };
  }

  /**
   * Generate date warnings for extraction
   */
  generateDateWarnings(analysis: DateFormatAnalysis): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (analysis.ambiguousDates.length > 0) {
      warnings.push({
        type: 'requires_verification',
        message: `${analysis.ambiguousDates.length} dates with ambiguous format (DD/MM vs MM/DD) detected`,
        recommendation: 'Verify date format interpretation with source institution or documentation standards',
      });
    }

    if (analysis.confidence === 'low') {
      warnings.push({
        type: 'low_confidence',
        message: `Date format detection has low confidence: ${analysis.reasoning}`,
        recommendation: 'Manually specify date format for better accuracy',
      });
    }

    return warnings;
  }
}
