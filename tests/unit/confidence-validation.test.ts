/**
 * Advanced Confidence Calibration Validation Tests
 * 
 * Day 14: Comprehensive edge cases, stress testing, performance validation,
 * and integration scenarios for the confidence calibration service.
 */

import { ConfidenceCalibrationService } from '../../src/services/confidence-calibration.service';

describe('ConfidenceCalibrationService - Advanced Validation', () => {
  let service: ConfidenceCalibrationService;

  beforeEach(() => {
    service = new ConfidenceCalibrationService();
  });

  describe('Stress Testing', () => {
    it('should handle 1000 consecutive calculations', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const result = service.calculateConfidence({
          sourceType: 'discharge_summary',
          extractionMethod: 'explicit_value',
          contextClarity: Math.random()
        });
        
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 calculations in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large aggregate confidence arrays', () => {
      const confidences = [];
      
      for (let i = 0; i < 100; i++) {
        confidences.push(service.calculateConfidence({
          sourceType: 'operative_report',
          extractionMethod: 'direct_quote',
          contextClarity: 0.8 + (Math.random() * 0.2)
        }));
      }
      
      const aggregate = service.calculateAggregateConfidence(confidences);
      
      expect(aggregate.score).toBeGreaterThanOrEqual(0);
      expect(aggregate.score).toBeLessThanOrEqual(1);
      expect(aggregate.level).toBeDefined();
    });

    it('should maintain consistency across repeated calculations', () => {
      const params = {
        sourceType: 'discharge_summary' as const,
        extractionMethod: 'explicit_value' as const,
        contextClarity: 0.75
      };
      
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(service.calculateConfidence(params));
      }
      
      // All results should be identical
      const firstScore = results[0].score;
      for (const result of results) {
        expect(result.score).toBe(firstScore);
      }
    });
  });

  describe('Boundary Value Testing', () => {
    describe('Score Boundaries', () => {
      it('should handle score exactly at critical threshold (0.95)', () => {
        // Need perfect scores to hit exactly 0.95
        const result = service.calculateConfidence({
          sourceType: 'operative_report',
          extractionMethod: 'direct_quote',
          completeness: {
            requiredFields: ['f1'],
            providedFields: ['f1']
          },
          consistency: {
            currentValue: 'val',
            relatedValues: [{ field: 'f', value: 'val' }]
          },
          medicalValidity: {
            dataType: 'diagnosis',
            value: 'glioblastoma',
            expectedValues: ['glioblastoma']
          },
          temporalCoherence: {
            eventDate: new Date('2024-01-01'),
            referenceDate: new Date('2024-01-10')
          },
          contextClarity: 1.0
        });
        
        // Should be critical or very close
        expect(result.score).toBeGreaterThanOrEqual(0.90);
      });

      it('should handle score exactly at high/medium boundary (0.75)', () => {
        const result = service.calculateConfidence({
          sourceType: 'discharge_summary',
          extractionMethod: 'explicit_value',
          contextClarity: 0.75
        });
        
        // Should be in high or medium range
        expect(result.score).toBeGreaterThanOrEqual(0.50);
        expect(result.score).toBeLessThanOrEqual(1.0);
      });

      it('should handle score exactly at medium/low boundary (0.50)', () => {
        const result = service.calculateConfidence({
          sourceType: 'progress_note',
          extractionMethod: 'inferred_value',
          contextClarity: 0.5
        });
        
        // Should be around medium range
        expect(result.score).toBeGreaterThanOrEqual(0.40);
        expect(result.score).toBeLessThanOrEqual(0.70);
      });

      it('should handle score exactly at low/very-low boundary (0.30)', () => {
        const result = service.calculateConfidence({
          sourceType: 'unknown',
          extractionMethod: 'default_value',
          contextClarity: 0.2,
          completeness: {
            requiredFields: ['f1', 'f2'],
            providedFields: []
          }
        });
        
        // Should be in low or very-low range
        expect(result.score).toBeLessThan(0.50);
      });
    });

    describe('Completeness Boundaries', () => {
      it('should handle 0% completeness', () => {
        const result = service.calculateConfidence({
          completeness: {
            requiredFields: ['f1', 'f2', 'f3'],
            providedFields: []
          }
        });
        
        expect(result.factors.completeness).toBe(0.0);
      });

      it('should handle 100% completeness', () => {
        const result = service.calculateConfidence({
          completeness: {
            requiredFields: ['f1', 'f2', 'f3'],
            providedFields: ['f1', 'f2', 'f3']
          }
        });
        
        expect(result.factors.completeness).toBe(1.0);
      });

      it('should handle 33.33% completeness', () => {
        const result = service.calculateConfidence({
          completeness: {
            requiredFields: ['f1', 'f2', 'f3'],
            providedFields: ['f1']
          }
        });
        
        expect(result.factors.completeness).toBeCloseTo(0.333, 2);
      });
    });

    describe('Numeric Range Boundaries', () => {
      it('should handle value exactly at minimum range', () => {
        const result = service.calculateConfidence({
          medicalValidity: {
            dataType: 'vital',
            value: 90,
            expectedRange: [90, 140]
          }
        });
        
        expect(result.factors.medicalValidity).toBe(1.0);
      });

      it('should handle value exactly at maximum range', () => {
        const result = service.calculateConfidence({
          medicalValidity: {
            dataType: 'vital',
            value: 140,
            expectedRange: [90, 140]
          }
        });
        
        expect(result.factors.medicalValidity).toBe(1.0);
      });

      it('should handle value just below minimum', () => {
        const result = service.calculateConfidence({
          medicalValidity: {
            dataType: 'vital',
            value: 89,
            expectedRange: [90, 140]
          }
        });
        
        expect(result.factors.medicalValidity).toBeLessThan(1.0);
      });

      it('should handle value just above maximum', () => {
        const result = service.calculateConfidence({
          medicalValidity: {
            dataType: 'vital',
            value: 141,
            expectedRange: [90, 140]
          }
        });
        
        expect(result.factors.medicalValidity).toBeLessThan(1.0);
      });
    });
  });

  describe('Complex Interaction Testing', () => {
    it('should handle all factors at different levels', () => {
      const result = service.calculateConfidence({
        sourceType: 'discharge_summary',      // 0.95
        extractionMethod: 'inferred_value',   // 0.70
        completeness: {
          requiredFields: ['f1', 'f2'],
          providedFields: ['f1']              // 0.50
        },
        consistency: {
          currentValue: 'val1',
          relatedValues: [
            { field: 'f1', value: 'val2' }    // Contradiction
          ]
        },
        medicalValidity: {
          dataType: 'vital',
          value: 150,
          expectedRange: [90, 140]            // Outside range
        },
        temporalCoherence: {
          eventDate: new Date(),
          referenceDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
        },
        contextClarity: 0.4
      });
      
      // Should calculate weighted average correctly
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(1);
      expect(result.uncertainties.length).toBeGreaterThan(0);
    });

    it('should prioritize high-weight factors', () => {
      // Test with high source reliability but low other factors
      const highSource = service.calculateConfidence({
        sourceType: 'operative_report',      // 1.0 (20% weight)
        extractionMethod: 'default_value',   // 0.4 (20% weight)
        contextClarity: 0.3
      });
      
      // Test with low source reliability but high other factors
      const lowSource = service.calculateConfidence({
        sourceType: 'unknown',               // 0.5 (20% weight)
        extractionMethod: 'direct_quote',    // 1.0 (20% weight)
        contextClarity: 0.9
      });
      
      // Neither should dominate completely due to balanced weights
      expect(Math.abs(highSource.score - lowSource.score)).toBeLessThan(0.3);
    });

    it('should handle contradictory signals gracefully', () => {
      // High quality source but deduced value
      const result = service.calculateConfidence({
        sourceType: 'operative_report',      // High reliability
        extractionMethod: 'deduced_value',   // Low quality
        medicalValidity: {
          dataType: 'diagnosis',
          value: 'condition',                // Vague
          expectedValues: ['glioblastoma', 'meningioma']
        }
      });
      
      // Should balance contradictory signals
      expect(result.score).toBeGreaterThan(0.3);
      expect(result.score).toBeLessThan(0.8);
      expect(result.uncertainties.length).toBeGreaterThan(0);
    });
  });

  describe('Weight Configuration Testing', () => {
    it('should respect extreme weight configurations', () => {
      const extremeService = new ConfidenceCalibrationService({
        sourceReliability: 0.99,
        extractionQuality: 0.01
      });
      
      const result = extremeService.calculateConfidence({
        sourceType: 'operative_report',      // 1.0
        extractionMethod: 'default_value',   // 0.4
      });
      
      // Should be dominated by source reliability (but other default factors affect it)
      expect(result.score).toBeGreaterThan(0.80);
    });

    it('should handle equal weights across all factors', () => {
      const equalService = new ConfidenceCalibrationService({
        sourceReliability: 1/7,
        extractionQuality: 1/7,
        completeness: 1/7,
        consistency: 1/7,
        medicalValidity: 1/7,
        temporalCoherence: 1/7,
        contextClarity: 1/7
      });
      
      const weights = equalService.getWeights();
      const allEqual = Object.values(weights).every(w => 
        Math.abs(w - 1/7) < 0.01
      );
      
      expect(allEqual).toBe(true);
    });

    it('should allow weight updates mid-session', () => {
      const initialResult = service.calculateConfidence({
        sourceType: 'operative_report',
        extractionMethod: 'direct_quote'
      });
      
      service.updateWeights({
        sourceReliability: 0.5,
        extractionQuality: 0.5
      });
      
      const updatedResult = service.calculateConfidence({
        sourceType: 'operative_report',
        extractionMethod: 'direct_quote'
      });
      
      // Results should differ after weight update
      expect(updatedResult.score).not.toBe(initialResult.score);
    });
  });

  describe('Medical Validity Edge Cases', () => {
    it('should handle extremely long medication names', () => {
      const longName = 'a'.repeat(100);
      
      const result = service.calculateConfidence({
        medicalValidity: {
          dataType: 'medication',
          value: longName
        }
      });
      
      expect(result.factors.medicalValidity).toBeLessThan(0.7);
    });

    it('should handle special characters in diagnosis', () => {
      const result = service.calculateConfidence({
        medicalValidity: {
          dataType: 'diagnosis',
          value: 'glio-blastoma #1'
        }
      });
      
      expect(result.factors.medicalValidity).toBeGreaterThan(0);
    });

    it('should handle numeric diagnoses', () => {
      const result = service.calculateConfidence({
        medicalValidity: {
          dataType: 'diagnosis',
          value: '12345'
        }
      });
      
      expect(result.factors.medicalValidity).toBeLessThan(0.7);
    });

    it('should handle extremely large vital values', () => {
      const result = service.calculateConfidence({
        medicalValidity: {
          dataType: 'vital',
          value: 99999
        }
      });
      
      expect(result.factors.medicalValidity).toBeLessThan(0.5);
    });

    it('should handle negative vital values', () => {
      const result = service.calculateConfidence({
        medicalValidity: {
          dataType: 'vital',
          value: -50
        }
      });
      
      expect(result.factors.medicalValidity).toBeLessThan(0.5);
    });

    it('should handle zero vital values', () => {
      const result = service.calculateConfidence({
        medicalValidity: {
          dataType: 'vital',
          value: 0
        }
      });
      
      expect(result.factors.medicalValidity).toBeLessThan(0.5);
    });
  });

  describe('Temporal Coherence Edge Cases', () => {
    it('should handle dates exactly 7 days in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const result = service.calculateConfidence({
        temporalCoherence: {
          eventDate: futureDate
        }
      });
      
      expect(result.factors.temporalCoherence).toBeGreaterThan(0.5);
    });

    it('should handle dates exactly 10 years in past', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 10);
      
      const result = service.calculateConfidence({
        temporalCoherence: {
          eventDate: oldDate
        }
      });
      
      expect(result.factors.temporalCoherence).toBeGreaterThan(0.5);
    });

    it('should handle same event and reference date', () => {
      const date = new Date('2024-01-15');
      
      const result = service.calculateConfidence({
        temporalCoherence: {
          eventDate: date,
          referenceDate: date
        }
      });
      
      expect(result.factors.temporalCoherence).toBe(1.0);
    });

    it('should handle event far in past, reference recent', () => {
      const oldDate = new Date('2000-01-01');
      const recentDate = new Date('2024-01-01');
      
      const result = service.calculateConfidence({
        temporalCoherence: {
          eventDate: oldDate,
          referenceDate: recentDate
        }
      });
      
      // Old date but coherent ordering
      expect(result.factors.temporalCoherence).toBeGreaterThan(0);
    });
  });

  describe('Consistency Edge Cases', () => {
    it('should handle empty related values array', () => {
      const result = service.calculateConfidence({
        consistency: {
          currentValue: 'value',
          relatedValues: []
        }
      });
      
      expect(result.factors.consistency).toBe(0.5); // Default
    });

    it('should handle many related values (100+)', () => {
      const relatedValues = [];
      for (let i = 0; i < 100; i++) {
        relatedValues.push({ field: `f${i}`, value: 'consistent' });
      }
      
      const result = service.calculateConfidence({
        consistency: {
          currentValue: 'consistent',
          relatedValues
        }
      });
      
      expect(result.factors.consistency).toBe(1.0);
    });

    it('should handle mixed consistent/inconsistent values', () => {
      const result = service.calculateConfidence({
        consistency: {
          currentValue: 'value1',
          relatedValues: [
            { field: 'f1', value: 'value1' },
            { field: 'f2', value: 'value2' },
            { field: 'f3', value: 'value1' }
          ]
        }
      });
      
      expect(result.factors.consistency).toBeGreaterThan(0);
      expect(result.factors.consistency).toBeLessThan(1.0);
    });

    it('should handle null/undefined values', () => {
      const result = service.calculateConfidence({
        consistency: {
          currentValue: null,
          relatedValues: [
            { field: 'f1', value: null }
          ]
        }
      });
      
      expect(result.factors.consistency).toBeGreaterThanOrEqual(0);
    });

    it('should handle object value comparisons', () => {
      const result = service.calculateConfidence({
        consistency: {
          currentValue: { key: 'value' },
          relatedValues: [
            { field: 'f1', value: { key: 'value' } }
          ]
        }
      });
      
      expect(result.factors.consistency).toBe(1.0);
    });
  });

  describe('Aggregate Confidence Edge Cases', () => {
    it('should handle confidences with vastly different scores', () => {
      const high = service.calculateConfidence({
        sourceType: 'operative_report',
        extractionMethod: 'direct_quote'
      });
      
      const low = service.calculateConfidence({
        sourceType: 'unknown',
        extractionMethod: 'default_value'
      });
      
      const aggregate = service.calculateAggregateConfidence([high, low]);
      
      expect(aggregate.score).toBeGreaterThan(low.score);
      expect(aggregate.score).toBeLessThan(high.score);
    });

    it('should handle 1000 confidence objects', () => {
      const confidences = [];
      for (let i = 0; i < 1000; i++) {
        confidences.push(service.calculateConfidence({
          contextClarity: Math.random()
        }));
      }
      
      const aggregate = service.calculateAggregateConfidence(confidences);
      
      expect(aggregate.score).toBeGreaterThanOrEqual(0);
      expect(aggregate.score).toBeLessThanOrEqual(1);
    });

    it('should deduplicate uncertainties in aggregate', () => {
      const conf1 = service.calculateConfidence({
        sourceType: 'unknown'
      });
      
      const conf2 = service.calculateConfidence({
        sourceType: 'unknown'
      });
      
      const aggregate = service.calculateAggregateConfidence([conf1, conf2]);
      
      // Should have unique uncertainties only
      const uniqueUncertainties = new Set(aggregate.uncertainties);
      expect(uniqueUncertainties.size).toBe(aggregate.uncertainties.length);
    });
  });

  describe('Real-World Complex Scenarios', () => {
    it('should handle post-operative medication extraction', () => {
      const result = service.calculateConfidence({
        sourceType: 'operative_report',
        extractionMethod: 'explicit_value',
        completeness: {
          requiredFields: ['medication', 'dose', 'route', 'frequency'],
          providedFields: ['medication', 'dose', 'route']
        },
        consistency: {
          currentValue: 'dexamethasone',
          relatedValues: [
            { field: 'pre_op_meds', value: 'dexamethasone' },
            { field: 'post_op_orders', value: 'Decadron' } // Brand name
          ]
        },
        medicalValidity: {
          dataType: 'medication',
          value: 'dexamethasone'
        },
        contextClarity: 0.9
      });
      
      expect(result.level).toBe('high');
      expect(result.score).toBeGreaterThan(0.75);
    });

    it('should handle ambiguous diagnosis from nursing note', () => {
      const result = service.calculateConfidence({
        sourceType: 'nursing_note',
        extractionMethod: 'inferred_value',
        completeness: {
          requiredFields: ['diagnosis', 'location', 'severity'],
          providedFields: ['diagnosis']
        },
        medicalValidity: {
          dataType: 'diagnosis',
          value: 'brain mass'  // Vague term
        },
        contextClarity: 0.4
      });
      
      expect(result.level).toMatch(/medium|low/);
      expect(result.uncertainties.length).toBeGreaterThan(2);
      expect(result.recommendations.length).toBeGreaterThan(2);
    });

    it('should handle contradictory surgical dates', () => {
      const result = service.calculateConfidence({
        sourceType: 'progress_note',
        extractionMethod: 'explicit_value',
        consistency: {
          currentValue: '2024-01-15',
          relatedValues: [
            { field: 'operative_report_date', value: '2024-01-16' },
            { field: 'scheduling_system', value: '2024-01-15' }
          ]
        },
        temporalCoherence: {
          eventDate: new Date('2024-01-15'),
          referenceDate: new Date('2024-01-20')
        },
        contextClarity: 0.7
      });
      
      // Should have uncertainties and recommendations
      expect(result.uncertainties.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle lab value outside normal range', () => {
      const result = service.calculateConfidence({
        sourceType: 'lab_report',
        extractionMethod: 'explicit_value',
        medicalValidity: {
          dataType: 'lab',
          value: 200,           // High sodium
          expectedRange: [135, 145]
        },
        completeness: {
          requiredFields: ['value', 'units', 'timestamp'],
          providedFields: ['value', 'units', 'timestamp']
        },
        temporalCoherence: {
          eventDate: new Date('2024-01-10'),
          referenceDate: new Date('2024-01-15')
        },
        contextClarity: 0.95
      });
      
      expect(result.factors.medicalValidity).toBeLessThan(1.0);
      // Overall score can still be high due to other strong factors
      expect(result.score).toBeLessThan(1.0);
    });

    it('should handle discharge summary with complete information', () => {
      const result = service.calculateConfidence({
        sourceType: 'discharge_summary',
        extractionMethod: 'direct_quote',
        completeness: {
          requiredFields: [
            'admission_date', 'discharge_date', 'diagnosis',
            'procedures', 'medications', 'follow_up'
          ],
          providedFields: [
            'admission_date', 'discharge_date', 'diagnosis',
            'procedures', 'medications', 'follow_up', 'complications'
          ]
        },
        consistency: {
          currentValue: 'glioblastoma',
          relatedValues: [
            { field: 'admission_diagnosis', value: 'glioblastoma' },
            { field: 'operative_diagnosis', value: 'glioblastoma' },
            { field: 'pathology_diagnosis', value: 'glioblastoma multiforme' }
          ]
        },
        medicalValidity: {
          dataType: 'diagnosis',
          value: 'glioblastoma',
          expectedValues: ['glioblastoma', 'glioblastoma multiforme']
        },
        temporalCoherence: {
          eventDate: new Date('2024-01-01'),
          referenceDate: new Date('2024-01-20')
        },
        contextClarity: 0.95
      });
      
      expect(result.level).toMatch(/critical|high/);
      expect(result.uncertainties.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Characteristics', () => {
    it('should calculate confidence in under 5ms', () => {
      const iterations = 100;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        service.calculateConfidence({
          sourceType: 'discharge_summary',
          extractionMethod: 'explicit_value',
          completeness: {
            requiredFields: ['f1', 'f2', 'f3'],
            providedFields: ['f1', 'f2']
          },
          consistency: {
            currentValue: 'val',
            relatedValues: [
              { field: 'f1', value: 'val' },
              { field: 'f2', value: 'val' }
            ]
          },
          contextClarity: 0.8
        });
        
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      expect(avgTime).toBeLessThan(5); // Average under 5ms
    });

    it('should handle concurrent calculations efficiently', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(service.calculateConfidence({
          sourceType: 'operative_report',
          extractionMethod: 'direct_quote'
        })));
      }
      
      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Under 100ms for 100 calculations
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid source type gracefully', () => {
      const result = service.calculateConfidence({
        sourceType: 'invalid_type' as any
      });
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle invalid extraction method gracefully', () => {
      const result = service.calculateConfidence({
        extractionMethod: 'invalid_method' as any
      });
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle empty provided fields', () => {
      const result = service.calculateConfidence({
        completeness: {
          requiredFields: ['f1'],
          providedFields: []
        }
      });
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.completeness).toBe(0);
    });

    it('should handle malformed consistency context', () => {
      const result = service.calculateConfidence({
        consistency: {
          currentValue: 'val',
          relatedValues: null as any
        }
      });
      
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid date objects', () => {
      const result = service.calculateConfidence({
        temporalCoherence: {
          eventDate: new Date('invalid'),
          referenceDate: new Date('2024-01-01')
        }
      });
      
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
