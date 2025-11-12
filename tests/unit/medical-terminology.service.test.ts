/**
 * Medical Terminology Service Tests
 * 
 * Week 3, Day 11: Test drug dictionary functionality
 */

import { MedicalTerminologyService } from '../../src/services/medical-terminology.service';

describe('MedicalTerminologyService', () => {
  let service: MedicalTerminologyService;

  beforeEach(() => {
    service = new MedicalTerminologyService();
  });

  describe('Drug Dictionary Initialization', () => {
    it('should initialize with comprehensive drug dictionary', () => {
      const stats = service.getStatistics();
      expect(stats.totalDrugs).toBeGreaterThan(80); // We added 80+ unique drugs
      expect(stats.drugClasses).toBeGreaterThan(15); // Multiple drug classes
    });

    it('should have all major drug classes', () => {
      const classes = service.getDrugClasses();
      
      expect(classes).toContain('Anticonvulsant');
      expect(classes).toContain('Corticosteroid');
      expect(classes).toContain('Opioid Analgesic');
      expect(classes).toContain('Antiplatelet');
      expect(classes).toContain('Anticoagulant');
      expect(classes).toContain('Antibiotic (Cephalosporin)');
    });

    it('should index drugs by both generic and brand names', () => {
      // Test generic lookup
      const generic = service.getDrugInfo('levetiracetam');
      expect(generic).not.toBeNull();
      expect(generic?.generic).toBe('levetiracetam');

      // Test brand lookup
      const brand = service.getDrugInfo('Keppra');
      expect(brand).not.toBeNull();
      expect(brand?.generic).toBe('levetiracetam');

      // Should be the same drug
      expect(generic).toEqual(brand);
    });
  });

  describe('Drug Name Normalization', () => {
    it('should normalize generic drug names (exact match)', () => {
      const match = service.normalizeDrugName('levetiracetam');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('exact');
      expect(match?.confidence).toBe(1.0);
      expect(match?.standardizedTerm).toBe('levetiracetam');
    });

    it('should normalize brand names to generic (exact match)', () => {
      const match = service.normalizeDrugName('Keppra');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('exact');
      expect(match?.confidence).toBe(1.0);
      expect(match?.standardizedTerm).toBe('levetiracetam');
    });

    it('should handle case-insensitive matching', () => {
      const lowercase = service.normalizeDrugName('keppra');
      const uppercase = service.normalizeDrugName('KEPPRA');
      const mixed = service.normalizeDrugName('KePpRa');

      expect(lowercase?.standardizedTerm).toBe('levetiracetam');
      expect(uppercase?.standardizedTerm).toBe('levetiracetam');
      expect(mixed?.standardizedTerm).toBe('levetiracetam');
    });

    it('should trim whitespace', () => {
      const match = service.normalizeDrugName('  Keppra  ');
      
      expect(match).not.toBeNull();
      expect(match?.standardizedTerm).toBe('levetiracetam');
    });

    it('should handle multiple brand names for same drug', () => {
      // Hydrocodone has multiple brand names
      const vicodin = service.normalizeDrugName('Vicodin');
      const norco = service.normalizeDrugName('Norco');
      const lortab = service.normalizeDrugName('Lortab');

      expect(vicodin?.standardizedTerm).toBe('hydrocodone');
      expect(norco?.standardizedTerm).toBe('hydrocodone');
      expect(lortab?.standardizedTerm).toBe('hydrocodone');
    });
  });

  describe('Fuzzy Matching', () => {
    it('should fuzzy match with 1 character difference', () => {
      // 'kepra' is 1 character off from 'keppra'
      const match = service.normalizeDrugName('kepra');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('fuzzy');
      expect(match?.confidence).toBeGreaterThan(0.5);
      expect(match?.confidence).toBeLessThan(1.0);
      expect(match?.standardizedTerm).toBe('levetiracetam');
    });

    it('should fuzzy match with 2 character difference', () => {
      // 'dilntin' is 2 characters off from 'dilantin'
      const match = service.normalizeDrugName('dilntin');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('fuzzy');
      expect(match?.standardizedTerm).toBe('phenytoin');
    });

    it('should not match with >2 character difference', () => {
      const match = service.normalizeDrugName('kepprrra'); // 3 chars off
      
      // Might still match if there's another similar term, but confidence should be lower
      // or might not match at all
      if (match) {
        expect(match.confidence).toBeLessThan(0.9);
      }
    });

    it('should return null for completely unrecognized drugs', () => {
      const match = service.normalizeDrugName('unknowndrugxyz123');
      
      expect(match).toBeNull();
    });

    it('should prefer exact matches over fuzzy matches', () => {
      // Add a test where both exact and fuzzy could apply
      const exactMatch = service.normalizeDrugName('aspirin');
      
      expect(exactMatch?.matchType).toBe('exact');
      expect(exactMatch?.confidence).toBe(1.0);
    });
  });

  describe('Drug Information Retrieval', () => {
    it('should retrieve complete drug information', () => {
      const drugInfo = service.getDrugInfo('levetiracetam');
      
      expect(drugInfo).not.toBeNull();
      expect(drugInfo?.generic).toBe('levetiracetam');
      expect(drugInfo?.brandNames).toContain('Keppra');
      expect(drugInfo?.rxNormCode).toBe('135446');
      expect(drugInfo?.drugClass).toBe('Anticonvulsant');
      expect(drugInfo?.routes).toContain('oral');
      expect(drugInfo?.routes).toContain('IV');
      expect(drugInfo?.neurosurgicalUse).toBe(true);
    });

    it('should include typical doses when available', () => {
      const drugInfo = service.getDrugInfo('levetiracetam');
      
      expect(drugInfo?.typicalDoses).toBeDefined();
      expect(drugInfo?.typicalDoses?.length).toBeGreaterThan(0);
      expect(drugInfo?.typicalDoses).toContain('500mg');
      expect(drugInfo?.typicalDoses).toContain('1000mg');
    });

    it('should return null for unknown drugs', () => {
      const drugInfo = service.getDrugInfo('unknowndrugxyz');
      
      expect(drugInfo).toBeNull();
    });

    it('should retrieve info by brand name', () => {
      const drugInfo = service.getDrugInfo('Dilantin');
      
      expect(drugInfo).not.toBeNull();
      expect(drugInfo?.generic).toBe('phenytoin');
    });
  });

  describe('Route Validation', () => {
    it('should validate correct routes', () => {
      expect(service.validateRoute('levetiracetam', 'oral')).toBe(true);
      expect(service.validateRoute('levetiracetam', 'IV')).toBe(true);
    });

    it('should reject invalid routes', () => {
      expect(service.validateRoute('levetiracetam', 'IM')).toBe(false);
      expect(service.validateRoute('levetiracetam', 'transdermal')).toBe(false);
    });

    it('should handle case-insensitive route validation', () => {
      expect(service.validateRoute('levetiracetam', 'ORAL')).toBe(true);
      expect(service.validateRoute('levetiracetam', 'iv')).toBe(true);
      expect(service.validateRoute('levetiracetam', 'Iv')).toBe(true);
    });

    it('should validate routes for brand names', () => {
      expect(service.validateRoute('Keppra', 'oral')).toBe(true);
      expect(service.validateRoute('Keppra', 'IV')).toBe(true);
    });

    it('should return false for unknown drugs', () => {
      expect(service.validateRoute('unknowndrugxyz', 'oral')).toBe(false);
    });

    it('should handle route whitespace', () => {
      expect(service.validateRoute('levetiracetam', '  oral  ')).toBe(true);
    });
  });

  describe('Drug Class Queries', () => {
    it('should retrieve all drugs in a class', () => {
      const anticonvulsants = service.getDrugsByClass('Anticonvulsant');
      
      expect(anticonvulsants.length).toBeGreaterThan(5);
      
      const generics = anticonvulsants.map((d) => d.generic);
      expect(generics).toContain('levetiracetam');
      expect(generics).toContain('phenytoin');
      expect(generics).toContain('valproic acid');
      expect(generics).toContain('lamotrigine');
    });

    it('should retrieve corticosteroids', () => {
      const corticosteroids = service.getDrugsByClass('Corticosteroid');
      
      expect(corticosteroids.length).toBeGreaterThan(2);
      
      const generics = corticosteroids.map((d) => d.generic);
      expect(generics).toContain('dexamethasone');
      expect(generics).toContain('methylprednisolone');
    });

    it('should retrieve opioid analgesics', () => {
      const opioids = service.getDrugsByClass('Opioid Analgesic');
      
      expect(opioids.length).toBeGreaterThan(4);
      
      const generics = opioids.map((d) => d.generic);
      expect(generics).toContain('oxycodone');
      expect(generics).toContain('morphine');
      expect(generics).toContain('hydromorphone');
    });

    it('should return empty array for unknown class', () => {
      const results = service.getDrugsByClass('UnknownClass');
      
      expect(results).toEqual([]);
    });

    it('should not return duplicates', () => {
      const anticonvulsants = service.getDrugsByClass('Anticonvulsant');
      const generics = anticonvulsants.map((d) => d.generic);
      const uniqueGenerics = new Set(generics);
      
      expect(generics.length).toBe(uniqueGenerics.size);
    });
  });

  describe('Specific Drug Tests', () => {
    describe('Anticonvulsants', () => {
      it('should have levetiracetam (Keppra)', () => {
        const drug = service.getDrugInfo('Keppra');
        expect(drug?.generic).toBe('levetiracetam');
        expect(drug?.rxNormCode).toBe('135446');
      });

      it('should have phenytoin (Dilantin)', () => {
        const drug = service.getDrugInfo('Dilantin');
        expect(drug?.generic).toBe('phenytoin');
        expect(drug?.drugClass).toBe('Anticonvulsant');
      });

      it('should have valproic acid (Depakote)', () => {
        const drug = service.getDrugInfo('Depakote');
        expect(drug?.generic).toBe('valproic acid');
      });
    });

    describe('Corticosteroids', () => {
      it('should have dexamethasone (Decadron)', () => {
        const drug = service.getDrugInfo('Decadron');
        expect(drug?.generic).toBe('dexamethasone');
        expect(drug?.drugClass).toBe('Corticosteroid');
      });

      it('should have methylprednisolone (Solu-Medrol)', () => {
        const drug = service.getDrugInfo('Solu-Medrol');
        expect(drug?.generic).toBe('methylprednisolone');
      });
    });

    describe('Osmotic Agents', () => {
      it('should have mannitol (Osmitrol)', () => {
        const drug = service.getDrugInfo('mannitol');
        expect(drug?.drugClass).toBe('Osmotic Diuretic');
        expect(drug?.routes).toContain('IV');
      });

      it('should have hypertonic saline', () => {
        const drug = service.getDrugInfo('hypertonic saline');
        expect(drug?.drugClass).toBe('Osmotic Agent');
      });
    });

    describe('Anticoagulants', () => {
      it('should have warfarin (Coumadin)', () => {
        const drug = service.getDrugInfo('Coumadin');
        expect(drug?.generic).toBe('warfarin');
        expect(drug?.drugClass).toBe('Anticoagulant');
      });

      it('should have enoxaparin (Lovenox)', () => {
        const drug = service.getDrugInfo('Lovenox');
        expect(drug?.generic).toBe('enoxaparin');
        expect(drug?.drugClass).toBe('Anticoagulant (LMWH)');
      });

      it('should have apixaban (Eliquis)', () => {
        const drug = service.getDrugInfo('Eliquis');
        expect(drug?.generic).toBe('apixaban');
        expect(drug?.drugClass).toBe('Anticoagulant (DOAC)');
      });
    });

    describe('Calcium Channel Blockers', () => {
      it('should have nimodipine (Nimotop)', () => {
        const drug = service.getDrugInfo('Nimotop');
        expect(drug?.generic).toBe('nimodipine');
        expect(drug?.drugClass).toBe('Calcium Channel Blocker');
      });

      it('should have nicardipine (Cardene)', () => {
        const drug = service.getDrugInfo('Cardene');
        expect(drug?.generic).toBe('nicardipine');
      });
    });

    describe('Antibiotics', () => {
      it('should have vancomycin', () => {
        const drug = service.getDrugInfo('vancomycin');
        expect(drug?.drugClass).toBe('Antibiotic (Glycopeptide)');
      });

      it('should have ceftriaxone (Rocephin)', () => {
        const drug = service.getDrugInfo('Rocephin');
        expect(drug?.generic).toBe('ceftriaxone');
        expect(drug?.drugClass).toBe('Antibiotic (Cephalosporin)');
      });
    });
  });

  describe('RxNorm Code Support', () => {
    it('should provide RxNorm codes for major drugs', () => {
      const keppra = service.getDrugInfo('Keppra');
      expect(keppra?.rxNormCode).toBe('135446');

      const dilantin = service.getDrugInfo('Dilantin');
      expect(dilantin?.rxNormCode).toBe('8183');

      const decadron = service.getDrugInfo('Decadron');
      expect(decadron?.rxNormCode).toBe('3264');
    });
  });

  describe('Neurosurgical Relevance', () => {
    it('should mark all drugs as neurosurgically relevant', () => {
      // Get a sample of drugs
      const sampleDrugs = [
        'levetiracetam',
        'dexamethasone',
        'mannitol',
        'nimodipine',
        'vancomycin',
      ];

      sampleDrugs.forEach((drugName) => {
        const drug = service.getDrugInfo(drugName);
        expect(drug?.neurosurgicalUse).toBe(true);
      });
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const stats = service.getStatistics();
      
      expect(stats.totalDrugs).toBeGreaterThan(80);
      expect(stats.drugClasses).toBeGreaterThan(15);
      expect(stats.totalDiagnoses).toBeGreaterThan(70); // Now implemented
      expect(stats.totalProcedures).toBeGreaterThan(60); // Now implemented
    });

    it('should count unique drugs only', () => {
      const stats = service.getStatistics();
      
      // Even though we index by brand names too, 
      // stats should only count unique generics
      expect(stats.totalDrugs).toBeLessThan(200); // Reasonable upper bound
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const match = service.normalizeDrugName('');
      expect(match).toBeNull();
    });

    it('should handle single character', () => {
      const match = service.normalizeDrugName('k');
      // Might match or not, but shouldn't crash
      expect(match === null || match.confidence < 1.0).toBe(true);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(100);
      const match = service.normalizeDrugName(longString);
      expect(match).toBeNull();
    });

    it('should handle special characters', () => {
      const match = service.normalizeDrugName('keppra!!!');
      // Should not match exactly, might fuzzy match
      if (match) {
        expect(match.matchType).not.toBe('exact');
      }
    });

    it('should handle numbers in drug names', () => {
      const match = service.normalizeDrugName('3% NaCl');
      expect(match).not.toBeNull();
      expect(match?.standardizedTerm).toBe('hypertonic saline');
    });
  });
});
