/**
 * Date Preprocessor Enhanced Service - Unit Tests
 * Week 1 Day 2 - Comprehensive Test Coverage
 * 
 * Tests cover:
 * 1. All date format parsers (ISO, written, numeric, relative, partial)
 * 2. Date type inference
 * 3. Confidence scoring
 * 4. Date validation
 * 5. Edge cases and error handling
 */

import { DatePreprocessorEnhancedService } from '../../src/services/date-preprocessor-enhanced.service';

describe('DatePreprocessorEnhancedService', () => {
  let service: DatePreprocessorEnhancedService;

  beforeEach(() => {
    service = new DatePreprocessorEnhancedService();
  });

  // ============================================================================
  // TEST GROUP 1: ISO 8601 Format Parsing
  // ============================================================================

  describe('ISO 8601 Date Parsing', () => {
    it('should parse ISO 8601 format (YYYY-MM-DD)', () => {
      const text = 'Patient admitted on 2024-01-15 and discharged 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(2);
      expect(result.parsedDates[0].format).toBe('ISO_8601');
      expect(result.parsedDates[0].normalized).toBe('2024-01-15');
      expect(result.parsedDates[0].confidence).toBe('high');
    });

    it('should parse ISO format with forward slashes', () => {
      const text = 'Surgery date: 2024/03/22';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('ISO_8601');
      expect(result.parsedDates[0].normalized).toBe('2024-03-22');
    });

    it('should pad single-digit months and days', () => {
      const text = 'Date: 2024-5-3';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].normalized).toBe('2024-05-03');
    });

    it('should reject invalid ISO dates', () => {
      const text = 'Invalid date: 2024-13-45';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(0);
    });
  });

  // ============================================================================
  // TEST GROUP 2: Written Date Format Parsing
  // ============================================================================

  describe('Written Date Format Parsing', () => {
    it('should parse full month name dates', () => {
      const text = 'Admitted January 15, 2024 and discharged February 3, 2024.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(2);
      expect(result.parsedDates[0].format).toBe('WRITTEN_FULL');
      expect(result.parsedDates[0].normalized).toBe('2024-01-15');
      expect(result.parsedDates[1].normalized).toBe('2024-02-03');
    });

    it('should parse abbreviated month names', () => {
      const text = 'Surgery on Jan 15, 2024 went well.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('WRITTEN_SHORT');
      expect(result.parsedDates[0].normalized).toBe('2024-01-15');
    });

    it('should handle dates without commas', () => {
      const text = 'Consultation March 10 2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].normalized).toBe('2024-03-10');
    });

    it('should handle mixed case month names', () => {
      const text = 'Date: JANUARY 5, 2024 and december 25, 2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(2);
      expect(result.parsedDates[0].normalized).toBe('2024-01-05');
      expect(result.parsedDates[1].normalized).toBe('2024-12-25');
    });
  });

  // ============================================================================
  // TEST GROUP 3: Numeric Date Format Parsing (Ambiguity Handling)
  // ============================================================================

  describe('Numeric Date Format Parsing', () => {
    it('should detect MM/DD/YYYY when day > 12', () => {
      const text = 'Admission: 03/25/2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('US_FORMAT');
      expect(result.parsedDates[0].normalized).toBe('2024-03-25');
      expect(result.parsedDates[0].confidence).toBe('high');
    });

    it('should detect DD/MM/YYYY when first number > 12', () => {
      const text = 'Date: 25/03/2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('EU_FORMAT');
      expect(result.parsedDates[0].normalized).toBe('2024-03-25');
      expect(result.parsedDates[0].confidence).toBe('high');
    });

    it('should flag ambiguous dates (both values <= 12)', () => {
      const text = 'Date: 03/05/2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('US_FORMAT'); // Defaults to US
      expect(result.parsedDates[0].confidence).toBe('medium');
      expect(result.parsedDates[0].warnings.length).toBeGreaterThan(0);
      expect(result.parsedDates[0].warnings[0]).toContain('Ambiguous');
    });

    it('should handle 2-digit years', () => {
      const text = 'Date: 03/15/24';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].normalized).toBe('2024-03-15');
    });

    it('should handle dates with dashes', () => {
      const text = 'Date: 12-25-2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].normalized).toBe('2024-12-25');
    });
  });

  // ============================================================================
  // TEST GROUP 4: Relative Date Parsing
  // ============================================================================

  describe('Relative Date Parsing', () => {
    it('should parse "X days ago"', () => {
      const text = 'Patient fell 3 days ago';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('RELATIVE');
      expect(result.parsedDates[0].confidence).toBe('medium');
      expect(result.parsedDates[0].warnings.length).toBeGreaterThan(0);
    });

    it('should parse "yesterday"', () => {
      const text = 'Surgery was yesterday';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('RELATIVE');
    });

    it('should parse "X weeks ago"', () => {
      const text = 'Initial symptoms 2 weeks ago';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('RELATIVE');
    });

    it('should parse "last week"', () => {
      const text = 'Consultation last week';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('RELATIVE');
    });
  });

  // ============================================================================
  // TEST GROUP 5: Partial Date Parsing
  // ============================================================================

  describe('Partial Date Parsing', () => {
    it('should parse "Month YYYY" format', () => {
      const text = 'Patient seen in May 2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('PARTIAL');
      expect(result.parsedDates[0].normalized).toBe('2024-05-01');
      expect(result.parsedDates[0].confidence).toBe('low');
    });

    it('should parse "early Month" format', () => {
      const text = 'Surgery scheduled for early March';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('PARTIAL');
      expect(result.parsedDates[0].confidence).toBe('low');
    });

    it('should parse "mid Month" format', () => {
      const text = 'Follow-up in mid April';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('PARTIAL');
    });

    it('should parse "late Month" format', () => {
      const text = 'Expected discharge late January';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(1);
      expect(result.parsedDates[0].format).toBe('PARTIAL');
    });
  });

  // ============================================================================
  // TEST GROUP 6: Date Type Inference
  // ============================================================================

  describe('Date Type Inference', () => {
    it('should infer admission date type', () => {
      const text = 'Patient was admitted on 2024-01-15 with severe headache.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].dateType).toBe('admission');
    });

    it('should infer discharge date type', () => {
      const text = 'Patient discharged home on 2024-01-20 in stable condition.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].dateType).toBe('discharge');
    });

    it('should infer surgery date type', () => {
      const text = 'Surgery was performed on 2024-01-16 without complications.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].dateType).toBe('surgery');
    });

    it('should infer procedure date type', () => {
      const text = 'Lumbar puncture procedure completed on 2024-01-17.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].dateType).toBe('procedure');
    });

    it('should infer consultation date type', () => {
      const text = 'Neurology consultation obtained on 2024-01-18.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].dateType).toBe('consultation');
    });

    it('should mark unknown when no context clues', () => {
      const text = 'The date was 2024-01-15 according to records.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].dateType).toBe('unknown');
    });
  });

  // ============================================================================
  // TEST GROUP 7: Confidence Scoring
  // ============================================================================

  describe('Confidence Scoring', () => {
    it('should assign high confidence to unambiguous ISO dates', () => {
      const text = 'Admission: 2024-01-15';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].confidence).toBe('high');
      expect(result.parsedDates[0].confidenceFactors.formatClarity).toBe(1.0);
      expect(result.parsedDates[0].confidenceFactors.overallConfidence).toBeGreaterThan(0.7);
    });

    it('should assign medium confidence to ambiguous numeric dates', () => {
      const text = 'Date: 05/08/2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].confidence).toBe('medium');
      expect(result.parsedDates[0].confidenceFactors.ambiguityPenalty).toBeGreaterThan(0);
    });

    it('should assign low confidence to partial dates', () => {
      const text = 'Seen in May 2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates[0].confidence).toBe('low');
      expect(result.parsedDates[0].confidenceFactors.overallConfidence).toBeLessThan(0.5);
    });

    it('should boost confidence when temporal consistency is high', () => {
      const text = 'Admitted January 15, 2024 and discharged January 20, 2024.';
      const result = service.preprocessDates(text);

      // Both dates should have reasonable temporal consistency
      expect(result.parsedDates[0].confidenceFactors.temporalConsistency).toBeGreaterThan(0.5);
      expect(result.parsedDates[1].confidenceFactors.temporalConsistency).toBeGreaterThan(0.5);
    });
  });

  // ============================================================================
  // TEST GROUP 8: Date Validation
  // ============================================================================

  describe('Date Validation', () => {
    it('should validate chronological order (admission < discharge)', () => {
      const text = 'Admitted 2024-01-15, discharged 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.validation.isValid).toBe(true);
      expect(result.validation.chronologicalOrder).toBe(true);
    });

    it('should detect discharge before admission error', () => {
      const text = 'Admitted 2024-01-20, discharged 2024-01-15.';
      const result = service.preprocessDates(text);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.chronologicalOrder).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it('should calculate length of stay', () => {
      const text = 'Admitted 2024-01-15, discharged 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.validation.lengthOfStay).toBe(5);
    });

    it('should warn about unusually long stays', () => {
      const text = 'Admitted 2023-01-15, discharged 2024-01-15.';
      const result = service.preprocessDates(text);

      expect(result.validation.lengthOfStay).toBe(366);
      expect(result.validation.warnings.length).toBeGreaterThan(0);
    });

    it('should validate surgery is between admission and discharge', () => {
      const text = 'Admitted 2024-01-15, surgery 2024-01-16, discharged 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.validation.isValid).toBe(true);
      expect(result.validation.chronologicalOrder).toBe(true);
    });

    it('should detect surgery outside admission-discharge range', () => {
      const text = 'Admitted 2024-01-15, surgery 2024-01-25, discharged 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it('should warn about future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureStr = futureDate.toISOString().split('T')[0];
      const text = `Follow-up scheduled for ${futureStr}`;
      const result = service.preprocessDates(text);

      expect(result.validation.warnings.some(w => w.includes('Future date'))).toBe(true);
    });

    it('should warn about very old dates', () => {
      const text = 'Original surgery date: 2015-01-15';
      const result = service.preprocessDates(text);

      expect(result.validation.warnings.some(w => w.includes('5 years old'))).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 9: Summary Generation
  // ============================================================================

  describe('Summary Generation', () => {
    it('should count dates by type', () => {
      const text = 'Admitted 2024-01-15, surgery 2024-01-16, discharged 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.summary.totalDates).toBe(3);
      expect(result.summary.byType.admission).toBe(1);
      expect(result.summary.byType.surgery).toBe(1);
      expect(result.summary.byType.discharge).toBe(1);
    });

    it('should count dates by format', () => {
      const text = 'ISO: 2024-01-15, Written: January 20, 2024, Numeric: 01/25/2024';
      const result = service.preprocessDates(text);

      expect(result.summary.totalDates).toBe(3);
      expect(result.summary.byFormat.ISO_8601).toBeGreaterThan(0);
      expect(result.summary.byFormat.WRITTEN_FULL).toBeGreaterThan(0);
      expect(result.summary.byFormat.US_FORMAT).toBeGreaterThan(0);
    });

    it('should calculate average confidence', () => {
      const text = '2024-01-15 and January 20, 2024';
      const result = service.preprocessDates(text);

      expect(result.summary.avgConfidence).toBeGreaterThan(0);
      expect(result.summary.avgConfidence).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // TEST GROUP 10: Warning Generation
  // ============================================================================

  describe('Warning Generation', () => {
    it('should warn about low confidence dates', () => {
      const text = 'Approximately early May';
      const result = service.preprocessDates(text);

      expect(result.warnings.some(w => w.message.includes('low confidence'))).toBe(true);
    });

    it('should warn about ambiguous format dates', () => {
      const text = 'Date: 03/05/2024';
      const result = service.preprocessDates(text);

      expect(result.warnings.some(w => w.message.includes('ambiguous format'))).toBe(true);
    });

    it('should warn when admission date is missing', () => {
      const text = 'Patient was discharged on 2024-01-20.';
      const result = service.preprocessDates(text);

      expect(result.warnings.some(w => w.message.includes('admission date'))).toBe(true);
    });

    it('should warn when discharge date is missing', () => {
      const text = 'Patient was admitted on 2024-01-15.';
      const result = service.preprocessDates(text);

      expect(result.warnings.some(w => w.message.includes('discharge date'))).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 11: Integration/Complex Scenarios
  // ============================================================================

  describe('Complex Clinical Note Scenarios', () => {
    it('should handle complete clinical note with mixed formats', () => {
      const text = `
        Patient admitted on January 15, 2024 via ED with altered mental status.
        CT obtained on 1/15/2024 showed large subdural hematoma.
        Craniotomy performed on 2024-01-16 without complications.
        POD 1 (2024-01-17): Patient neurologically intact, GCS 15.
        POD 3 (01/19/2024): Patient ambulating with PT.
        Discharged home 2024-01-20 with follow-up in 2 weeks.
      `;
      const result = service.preprocessDates(text);

      // Should find admission, surgery, discharge, and several POD dates
      expect(result.parsedDates.length).toBeGreaterThan(5);
      expect(result.parsedDates.some(d => d.dateType === 'admission')).toBe(true);
      expect(result.parsedDates.some(d => d.dateType === 'surgery')).toBe(true);
      expect(result.parsedDates.some(d => d.dateType === 'discharge')).toBe(true);

      // Should validate chronology
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.lengthOfStay).toBe(5);
    });

    it('should handle notes with only relative dates', () => {
      const text = 'Patient fell 3 days ago, presented yesterday, surgery today.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(2); // "3 days ago" and "yesterday"
      expect(result.parsedDates.every(d => d.format === 'RELATIVE')).toBe(true);
    });

    it('should handle notes with no dates', () => {
      const text = 'Patient presents with headache and no neurological deficits.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(0);
      expect(result.warnings.some(w => w.message.includes('admission date'))).toBe(true);
      expect(result.warnings.some(w => w.message.includes('discharge date'))).toBe(true);
    });
  });

  // ============================================================================
  // TEST GROUP 12: Helper Methods
  // ============================================================================

  describe('Helper Methods', () => {
    it('should extract key dates correctly', () => {
      const text = 'Admitted 2024-01-15, surgery 2024-01-16, discharged 2024-01-20.';
      const result = service.preprocessDates(text);
      const keyDates = service.getKeyDates(result);

      expect(keyDates.admission).toBeDefined();
      expect(keyDates.admission?.normalized).toBe('2024-01-15');
      expect(keyDates.surgery).toBeDefined();
      expect(keyDates.surgery?.normalized).toBe('2024-01-16');
      expect(keyDates.discharge).toBeDefined();
      expect(keyDates.discharge?.normalized).toBe('2024-01-20');
    });

    it('should return undefined for missing key dates', () => {
      const text = 'Patient had procedure on 2024-01-16.';
      const result = service.preprocessDates(text);
      const keyDates = service.getKeyDates(result);

      expect(keyDates.admission).toBeUndefined();
      expect(keyDates.discharge).toBeUndefined();
      expect(keyDates.surgery).toBeUndefined();
    });
  });

  // ============================================================================
  // TEST GROUP 13: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const text = '';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(0);
      expect(result.summary.totalDates).toBe(0);
    });

    it('should handle text with only non-date numbers', () => {
      const text = 'GCS 15, temperature 98.6, BP 120/80';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(0);
    });

    it('should not confuse medical scores with dates', () => {
      const text = 'Patient GCS 3/15 with mRS 4/6';
      const result = service.preprocessDates(text);

      // Should not parse medical scores as dates
      expect(result.parsedDates.length).toBe(0);
    });

    it('should handle very long clinical notes', () => {
      const longText = 'Patient admitted 2024-01-15. ' + 'Additional notes. '.repeat(1000) + 'Discharged 2024-01-20.';
      const result = service.preprocessDates(longText);

      expect(result.parsedDates.length).toBe(2);
      expect(result.validation.lengthOfStay).toBe(5);
    });

    it('should handle multiple dates on same line', () => {
      const text = 'Admitted 2024-01-15, surgery 2024-01-16, discharged 2024-01-20 all successful.';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(3);
    });

    it('should handle dates with extra whitespace', () => {
      const text = 'Date:    2024-01-15    and    January    20,    2024';
      const result = service.preprocessDates(text);

      expect(result.parsedDates.length).toBe(2);
    });
  });
});
