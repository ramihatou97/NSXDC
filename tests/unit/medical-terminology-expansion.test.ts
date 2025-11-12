/**
 * Medical Terminology Service Tests - Day 12 Expansion
 * 
 * Tests for diagnosis and procedure dictionaries
 */

import { MedicalTerminologyService } from '../../src/services/medical-terminology.service';

describe('MedicalTerminologyService - Diagnosis & Procedure Expansion', () => {
  let service: MedicalTerminologyService;

  beforeEach(() => {
    service = new MedicalTerminologyService();
  });

  describe('Diagnosis Dictionary', () => {
    it('should initialize with comprehensive diagnosis dictionary', () => {
      const stats = service.getStatistics();
      expect(stats.totalDiagnoses).toBeGreaterThan(70); // 70+ diagnoses
    });

    it('should have all major diagnosis categories', () => {
      const categories = service.getDiagnosisCategories();
      
      expect(categories).toContain('Malignant Brain Tumor');
      expect(categories).toContain('Hemorrhagic Stroke');
      expect(categories).toContain('Traumatic Brain Injury');
      expect(categories).toContain('Vascular Malformation');
      expect(categories).toContain('CSF Disorder');
      expect(categories).toContain('Spinal Cord Injury');
    });
  });

  describe('Diagnosis Normalization', () => {
    it('should normalize diagnosis names (exact match)', () => {
      const match = service.normalizeDiagnosisName('glioblastoma');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('exact');
      expect(match?.confidence).toBe(1.0);
      expect(match?.standardizedTerm).toBe('glioblastoma');
    });

    it('should handle case-insensitive diagnosis matching', () => {
      const lowercase = service.normalizeDiagnosisName('glioblastoma');
      const uppercase = service.normalizeDiagnosisName('GLIOBLASTOMA');
      const mixed = service.normalizeDiagnosisName('GlIoBlAsToMa');

      expect(lowercase?.standardizedTerm).toBe('glioblastoma');
      expect(uppercase?.standardizedTerm).toBe('glioblastoma');
      expect(mixed?.standardizedTerm).toBe('glioblastoma');
    });

    it('should match common abbreviations', () => {
      const avm = service.normalizeDiagnosisName('AVM');
      expect(avm?.standardizedTerm).toBe('AVM');
      
      const tbi = service.normalizeDiagnosisName('TBI');
      expect(tbi?.standardizedTerm).toBe('TBI');
    });

    it('should fuzzy match with minor typos', () => {
      // 'glioblstoma' - missing 'a'
      const match = service.normalizeDiagnosisName('glioblstoma');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('fuzzy');
      expect(match?.confidence).toBeGreaterThan(0.5);
      expect(match?.standardizedTerm).toBe('glioblastoma');
    });
  });

  describe('Diagnosis Information Retrieval', () => {
    it('should retrieve complete diagnosis information', () => {
      const diagnosis = service.getDiagnosisInfo('glioblastoma');
      
      expect(diagnosis).not.toBeNull();
      expect(diagnosis?.name).toBe('glioblastoma');
      expect(diagnosis?.icd10Code).toBe('C71.9');
      expect(diagnosis?.snomedCode).toBe('393563007');
      expect(diagnosis?.category).toBe('Malignant Brain Tumor');
      expect(diagnosis?.severity).toBe('critical');
    });

    it('should return null for unknown diagnoses', () => {
      const diagnosis = service.getDiagnosisInfo('unknowndiagnosisxyz');
      expect(diagnosis).toBeNull();
    });

    it('should handle alternate names', () => {
      // Both names should return same diagnosis
      const gbm1 = service.getDiagnosisInfo('glioblastoma');
      const gbm2 = service.getDiagnosisInfo('glioblastoma multiforme');
      
      expect(gbm1?.icd10Code).toBe('C71.9');
      expect(gbm2?.icd10Code).toBe('C71.9');
    });
  });

  describe('Diagnosis Categories', () => {
    it('should retrieve all diagnoses in a category', () => {
      const malignantTumors = service.getDiagnosesByCategory('Malignant Brain Tumor');
      
      expect(malignantTumors.length).toBeGreaterThan(3);
      
      const names = malignantTumors.map((d) => d.name);
      expect(names).toContain('glioblastoma');
      expect(names).toContain('anaplastic astrocytoma');
    });

    it('should retrieve traumatic brain injuries', () => {
      const tbiDiagnoses = service.getDiagnosesByCategory('Traumatic Brain Injury');
      
      expect(tbiDiagnoses.length).toBeGreaterThan(5);
      
      const names = tbiDiagnoses.map((d) => d.name);
      expect(names).toContain('subdural hematoma');
      expect(names).toContain('epidural hematoma');
      expect(names).toContain('traumatic brain injury');
    });

    it('should return empty array for unknown category', () => {
      const results = service.getDiagnosesByCategory('UnknownCategory');
      expect(results).toEqual([]);
    });
  });

  describe('Specific Diagnosis Tests', () => {
    describe('Brain Tumors', () => {
      it('should have glioblastoma', () => {
        const diagnosis = service.getDiagnosisInfo('glioblastoma');
        expect(diagnosis?.category).toBe('Malignant Brain Tumor');
        expect(diagnosis?.severity).toBe('critical');
      });

      it('should have meningioma', () => {
        const diagnosis = service.getDiagnosisInfo('meningioma');
        expect(diagnosis?.category).toBe('Benign Brain Tumor');
        expect(diagnosis?.severity).toBe('mild');
      });

      it('should have pituitary adenoma', () => {
        const diagnosis = service.getDiagnosisInfo('pituitary adenoma');
        expect(diagnosis?.icd10Code).toBe('D35.2');
      });
    });

    describe('Vascular Conditions', () => {
      it('should have subarachnoid hemorrhage', () => {
        const diagnosis = service.getDiagnosisInfo('subarachnoid hemorrhage');
        expect(diagnosis?.category).toBe('Hemorrhagic Stroke');
        expect(diagnosis?.severity).toBe('critical');
      });

      it('should have subdural hematoma variants', () => {
        const acute = service.getDiagnosisInfo('acute subdural hematoma');
        const chronic = service.getDiagnosisInfo('chronic subdural hematoma');
        
        expect(acute?.severity).toBe('critical');
        expect(chronic?.severity).toBe('moderate');
      });

      it('should have cerebral aneurysm', () => {
        const diagnosis = service.getDiagnosisInfo('cerebral aneurysm');
        expect(diagnosis?.category).toBe('Vascular Malformation');
      });

      it('should have AVM', () => {
        const avm1 = service.getDiagnosisInfo('AVM');
        const avm2 = service.getDiagnosisInfo('arteriovenous malformation');
        
        expect(avm1?.icd10Code).toBe(avm2?.icd10Code);
      });
    });

    describe('Spine Conditions', () => {
      it('should have spinal cord injury', () => {
        const diagnosis = service.getDiagnosisInfo('spinal cord injury');
        expect(diagnosis?.category).toBe('Spinal Cord Injury');
        expect(diagnosis?.severity).toBe('critical');
      });

      it('should have herniated disc variants', () => {
        const variant1 = service.getDiagnosisInfo('herniated disc');
        const variant2 = service.getDiagnosisInfo('disc herniation');
        
        expect(variant1?.icd10Code).toBe(variant2?.icd10Code);
      });

      it('should have spinal stenosis', () => {
        const diagnosis = service.getDiagnosisInfo('spinal stenosis');
        expect(diagnosis?.category).toBe('Degenerative Spine');
      });
    });

    describe('Hydrocephalus', () => {
      it('should have hydrocephalus types', () => {
        const normal = service.getDiagnosisInfo('normal pressure hydrocephalus');
        const obstructive = service.getDiagnosisInfo('obstructive hydrocephalus');
        
        expect(normal?.category).toBe('CSF Disorder');
        expect(obstructive?.category).toBe('CSF Disorder');
      });
    });

    describe('Infections', () => {
      it('should have brain abscess', () => {
        const diagnosis = service.getDiagnosisInfo('brain abscess');
        expect(diagnosis?.category).toBe('CNS Infection');
        expect(diagnosis?.severity).toBe('critical');
      });

      it('should have meningitis', () => {
        const diagnosis = service.getDiagnosisInfo('meningitis');
        expect(diagnosis?.severity).toBe('critical');
      });
    });
  });

  describe('ICD-10 and SNOMED CT Codes', () => {
    it('should provide ICD-10 codes for all diagnoses', () => {
      const glioblastoma = service.getDiagnosisInfo('glioblastoma');
      const meningioma = service.getDiagnosisInfo('meningioma');
      const sah = service.getDiagnosisInfo('subarachnoid hemorrhage');
      
      expect(glioblastoma?.icd10Code).toBe('C71.9');
      expect(meningioma?.icd10Code).toBe('D32.9');
      expect(sah?.icd10Code).toBe('I60.9');
    });

    it('should provide SNOMED CT codes when available', () => {
      const glioblastoma = service.getDiagnosisInfo('glioblastoma');
      expect(glioblastoma?.snomedCode).toBe('393563007');
    });
  });

  describe('Procedure Dictionary', () => {
    it('should initialize with comprehensive procedure dictionary', () => {
      const stats = service.getStatistics();
      expect(stats.totalProcedures).toBeGreaterThan(60); // 60+ procedures
    });

    it('should have all major procedure categories', () => {
      const categories = service.getProcedureCategories();
      
      expect(categories).toContain('Cranial Surgery');
      expect(categories).toContain('Tumor Surgery');
      expect(categories).toContain('Vascular Surgery');
      expect(categories).toContain('CSF Shunt');
      expect(categories).toContain('Spine Surgery');
    });
  });

  describe('Procedure Normalization', () => {
    it('should normalize procedure names (exact match)', () => {
      const match = service.normalizeProcedureName('craniotomy');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('exact');
      expect(match?.confidence).toBe(1.0);
      expect(match?.standardizedTerm).toBe('craniotomy');
    });

    it('should handle case-insensitive procedure matching', () => {
      const lowercase = service.normalizeProcedureName('craniotomy');
      const uppercase = service.normalizeProcedureName('CRANIOTOMY');
      
      expect(lowercase?.standardizedTerm).toBe('craniotomy');
      expect(uppercase?.standardizedTerm).toBe('craniotomy');
    });

    it('should match common abbreviations', () => {
      const vpShunt = service.normalizeProcedureName('VP shunt');
      expect(vpShunt?.standardizedTerm).toBe('VP shunt');
      
      const evd = service.normalizeProcedureName('EVD');
      expect(evd?.standardizedTerm).toBe('EVD');
      
      const acdf = service.normalizeProcedureName('ACDF');
      expect(acdf?.standardizedTerm).toBe('ACDF');
    });

    it('should fuzzy match with minor typos', () => {
      // 'cranitomy' - missing 'o'
      const match = service.normalizeProcedureName('cranitomy');
      
      expect(match).not.toBeNull();
      expect(match?.matchType).toBe('fuzzy');
      expect(match?.standardizedTerm).toBe('craniotomy');
    });
  });

  describe('Procedure Information Retrieval', () => {
    it('should retrieve complete procedure information', () => {
      const procedure = service.getProcedureInfo('craniotomy');
      
      expect(procedure).not.toBeNull();
      expect(procedure?.name).toBe('craniotomy');
      expect(procedure?.cptCode).toBe('61510');
      expect(procedure?.category).toBe('Cranial Surgery');
      expect(procedure?.approach).toBe('open');
    });

    it('should return null for unknown procedures', () => {
      const procedure = service.getProcedureInfo('unknownprocedurexyz');
      expect(procedure).toBeNull();
    });

    it('should handle alternate names', () => {
      const vp1 = service.getProcedureInfo('ventriculoperitoneal shunt');
      const vp2 = service.getProcedureInfo('VP shunt');
      
      expect(vp1?.cptCode).toBe(vp2?.cptCode);
    });
  });

  describe('Procedure Categories', () => {
    it('should retrieve all procedures in a category', () => {
      const cranialSurgeries = service.getProceduresByCategory('Cranial Surgery');
      
      expect(cranialSurgeries.length).toBeGreaterThanOrEqual(2);
      
      const names = cranialSurgeries.map((p) => p.name);
      expect(names).toContain('craniotomy');
      expect(names).toContain('craniectomy');
    });

    it('should retrieve CSF shunt procedures', () => {
      const shunts = service.getProceduresByCategory('CSF Shunt');
      
      expect(shunts.length).toBeGreaterThan(2);
      
      const names = shunts.map((p) => p.name);
      expect(names).toContain('ventriculoperitoneal shunt');
      expect(names).toContain('VP shunt');
    });

    it('should return empty array for unknown category', () => {
      const results = service.getProceduresByCategory('UnknownCategory');
      expect(results).toEqual([]);
    });
  });

  describe('Specific Procedure Tests', () => {
    describe('Cranial Procedures', () => {
      it('should have craniotomy variants', () => {
        const basic = service.getProcedureInfo('craniotomy');
        const tumor = service.getProcedureInfo('craniotomy for tumor resection');
        const awake = service.getProcedureInfo('awake craniotomy');
        
        expect(basic?.category).toBe('Cranial Surgery');
        expect(tumor?.category).toBe('Tumor Surgery');
        expect(awake?.approach).toBe('open');
      });

      it('should have decompressive craniectomy', () => {
        const procedure = service.getProcedureInfo('decompressive craniectomy');
        expect(procedure?.category).toBe('Decompression');
        expect(procedure?.complications).toBeDefined();
      });

      it('should have biopsy procedures', () => {
        const stereotactic = service.getProcedureInfo('stereotactic biopsy');
        expect(stereotactic?.approach).toBe('percutaneous');
      });
    });

    describe('Transsphenoidal Surgery', () => {
      it('should have pituitary surgery', () => {
        const procedure = service.getProcedureInfo('transsphenoidal hypophysectomy');
        expect(procedure?.category).toBe('Pituitary Surgery');
        expect(procedure?.approach).toBe('endoscopic');
      });

      it('should match endoscopic transsphenoidal', () => {
        const procedure = service.getProcedureInfo('endoscopic transsphenoidal surgery');
        expect(procedure?.cptCode).toBe('61548');
      });
    });

    describe('Vascular Procedures', () => {
      it('should have aneurysm clipping', () => {
        const procedure = service.getProcedureInfo('aneurysm clipping');
        expect(procedure?.category).toBe('Vascular Surgery');
        expect(procedure?.approach).toBe('open');
      });

      it('should have aneurysm coiling', () => {
        const procedure = service.getProcedureInfo('aneurysm coiling');
        expect(procedure?.approach).toBe('endovascular');
      });

      it('should have AVM resection', () => {
        const avm1 = service.getProcedureInfo('AVM resection');
        const avm2 = service.getProcedureInfo('arteriovenous malformation resection');
        
        expect(avm1?.cptCode).toBe(avm2?.cptCode);
      });

      it('should have CEA', () => {
        const cea1 = service.getProcedureInfo('carotid endarterectomy');
        const cea2 = service.getProcedureInfo('CEA');
        
        expect(cea1?.cptCode).toBe(cea2?.cptCode);
      });
    });

    describe('CSF Procedures', () => {
      it('should have VP shunt variants', () => {
        const full = service.getProcedureInfo('ventriculoperitoneal shunt');
        const abbrev = service.getProcedureInfo('VP shunt');
        
        expect(full?.cptCode).toBe('62223');
        expect(abbrev?.cptCode).toBe('62223');
        expect(full?.complications).toBeDefined();
      });

      it('should have EVD variants', () => {
        const full = service.getProcedureInfo('external ventricular drain');
        const abbrev = service.getProcedureInfo('EVD');
        
        expect(full?.cptCode).toBe(abbrev?.cptCode);
        expect(full?.approach).toBe('percutaneous');
      });

      it('should have ETV', () => {
        const full = service.getProcedureInfo('endoscopic third ventriculostomy');
        const abbrev = service.getProcedureInfo('ETV');
        
        expect(full?.cptCode).toBe(abbrev?.cptCode);
      });
    });

    describe('Spine Procedures', () => {
      it('should have ACDF', () => {
        const full = service.getProcedureInfo('anterior cervical discectomy and fusion');
        const abbrev = service.getProcedureInfo('ACDF');
        
        expect(full?.cptCode).toBe('22551');
        expect(abbrev?.cptCode).toBe('22551');
      });

      it('should have laminectomy variants', () => {
        const cervical = service.getProcedureInfo('cervical laminectomy');
        const lumbar = service.getProcedureInfo('lumbar laminectomy');
        
        expect(cervical?.category).toBe('Spine Decompression');
        expect(lumbar?.category).toBe('Spine Decompression');
      });

      it('should have fusion procedures', () => {
        const plif = service.getProcedureInfo('PLIF');
        const tlif = service.getProcedureInfo('TLIF');
        
        expect(plif?.category).toBe('Spine Surgery');
        expect(tlif?.category).toBe('Spine Surgery');
      });
    });

    describe('Hematoma Evacuation', () => {
      it('should have subdural hematoma evacuation', () => {
        const procedure = service.getProcedureInfo('subdural hematoma evacuation');
        expect(procedure?.category).toBe('Hematoma Evacuation');
      });

      it('should have burr hole drainage', () => {
        const procedure = service.getProcedureInfo('burr hole drainage');
        expect(procedure?.approach).toBe('percutaneous');
      });
    });
  });

  describe('CPT and ICD-10-PCS Codes', () => {
    it('should provide CPT codes for procedures', () => {
      const craniotomy = service.getProcedureInfo('craniotomy');
      const vpShunt = service.getProcedureInfo('VP shunt');
      const acdf = service.getProcedureInfo('ACDF');
      
      expect(craniotomy?.cptCode).toBe('61510');
      expect(vpShunt?.cptCode).toBe('62223');
      expect(acdf?.cptCode).toBe('22551');
    });

    it('should provide ICD-10-PCS codes when available', () => {
      const craniotomy = service.getProcedureInfo('craniotomy');
      expect(craniotomy?.icd10PcsCode).toBe('00B00ZZ');
    });
  });

  describe('Overall Statistics', () => {
    it('should provide accurate comprehensive statistics', () => {
      const stats = service.getStatistics();
      
      expect(stats.totalDrugs).toBeGreaterThan(80);
      expect(stats.totalDiagnoses).toBeGreaterThan(70);
      expect(stats.totalProcedures).toBeGreaterThan(60);
      expect(stats.drugClasses).toBeGreaterThan(15);
    });
  });

  describe('Edge Cases - Diagnoses', () => {
    it('should handle empty diagnosis string', () => {
      const match = service.normalizeDiagnosisName('');
      expect(match).toBeNull();
    });

    it('should handle very long diagnosis strings', () => {
      const longString = 'a'.repeat(200);
      const match = service.normalizeDiagnosisName(longString);
      expect(match).toBeNull();
    });
  });

  describe('Edge Cases - Procedures', () => {
    it('should handle empty procedure string', () => {
      const match = service.normalizeProcedureName('');
      expect(match).toBeNull();
    });

    it('should handle very long procedure strings', () => {
      const longString = 'a'.repeat(200);
      const match = service.normalizeProcedureName(longString);
      expect(match).toBeNull();
    });
  });
});
