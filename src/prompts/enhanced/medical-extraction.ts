/**
 * Enhanced Medical Extraction Prompts
 * Day 15: Integrated Medical Logic with Confidence Calibration
 * 
 * Incorporates:
 * - Medical terminology validation
 * - Clinical reasoning rules
 * - Context-aware extraction
 * - Confidence calibration guidance
 */

/**
 * Medical Logic Rules for Extraction
 */
export const MEDICAL_LOGIC_RULES = {
  /**
   * Diagnosis Validation Rules
   */
  diagnosisValidation: {
    neurosurgical: [
      'glioblastoma', 'meningioma', 'astrocytoma', 'oligodendroglioma',
      'ependymoma', 'medulloblastoma', 'pituitary adenoma', 'schwannoma',
      'craniopharyngioma', 'chordoma', 'hemangioblastoma', 'lymphoma',
      'metastatic', 'hemorrhage', 'subdural hematoma', 'epidural hematoma',
      'aneurysm', 'AVM', 'hydrocephalus', 'chiari malformation'
    ],
    requiresLocation: [
      'glioblastoma', 'meningioma', 'astrocytoma', 'metastatic',
      'hemorrhage', 'aneurysm', 'AVM', 'abscess'
    ],
    requiresGrade: [
      'glioblastoma', 'astrocytoma', 'oligodendroglioma', 'ependymoma',
      'meningioma'
    ]
  },

  /**
   * Procedure-Diagnosis Coherence Rules
   */
  procedureCoherence: {
    craniotomy: ['tumor', 'hemorrhage', 'aneurysm', 'AVM', 'abscess'],
    craniectomy: ['stroke', 'trauma', 'malignant edema', 'hemorrhage'],
    biopsy: ['tumor', 'lesion', 'mass'],
    ventriculostomy: ['hydrocephalus', 'hemorrhage', 'increased ICP'],
    shunt: ['hydrocephalus', 'pseudotumor cerebri']
  },

  /**
   * Clinical Score Ranges
   */
  scoreRanges: {
    GCS: { min: 3, max: 15, normal: 15 },
    mRS: { min: 0, max: 6, normal: 0 },
    KPS: { min: 0, max: 100, normal: 100, step: 10 },
    NIHSS: { min: 0, max: 42, normal: 0 },
    ECOG: { min: 0, max: 5, normal: 0 }
  },

  /**
   * Temporal Logic Rules
   */
  temporalRules: {
    typicalPostOpStay: {
      craniotomy: { min: 3, max: 7, typical: 5 },
      craniectomy: { min: 7, max: 21, typical: 14 },
      biopsy: { min: 1, max: 3, typical: 1 },
      EVD_placement: { min: 3, max: 10, typical: 7 }
    },
    warningThresholds: {
      maxReasonableLOS: 90,        // > 90 days unusual
      minTypicalLOS: 1,            // < 1 day unusual for craniotomy
      futureEventWarning: 7        // Events > 7 days future suspicious
    }
  },

  /**
   * Medication-Condition Coherence
   */
  medicationCoherence: {
    antiSeizure: {
      indications: ['seizure', 'tumor', 'hemorrhage', 'stroke', 'trauma'],
      common: ['levetiracetam', 'phenytoin', 'lacosamide', 'valproate']
    },
    steroids: {
      indications: ['tumor', 'edema', 'mass effect', 'inflammation'],
      common: ['dexamethasone', 'methylprednisolone']
    },
    dvtProphylaxis: {
      indications: ['post-operative', 'immobility', 'high risk'],
      common: ['enoxaparin', 'heparin', 'fondaparinux']
    },
    painManagement: {
      mild: ['acetaminophen', 'ibuprofen'],
      moderate: ['tramadol', 'codeine'],
      severe: ['oxycodone', 'hydromorphone', 'morphine', 'fentanyl']
    }
  }
};

/**
 * Build enhanced extraction prompt with medical logic
 */
export function buildEnhancedExtractionPrompt(clinicalNotes: string): string {
  return `# ROLE AND MISSION
You are an expert neurosurgical data extraction AI with integrated medical knowledge.
Extract clinical data with medical reasoning validation and confidence calibration.

# CORE EXTRACTION PRINCIPLES

## 1. MEDICAL TERMINOLOGY VALIDATION

### Standard Neurosurgical Diagnoses:
${MEDICAL_LOGIC_RULES.diagnosisValidation.neurosurgical.join(', ')}

**Validation Rules:**
- Use standardized terms when possible
- Flag non-standard terminology with warnings
- Preserve original wording in source field
- Map synonyms to standard terms (e.g., "GBM" → "glioblastoma")

### Diagnosis Completeness Requirements:
- **Requires Location**: ${MEDICAL_LOGIC_RULES.diagnosisValidation.requiresLocation.join(', ')}
- **Requires Grade/Stage**: ${MEDICAL_LOGIC_RULES.diagnosisValidation.requiresGrade.join(', ')}

**Example - Complete Diagnosis:**
\`\`\`json
{
  "diagnosis": {
    "value": "left frontal glioblastoma (WHO grade IV)",
    "source": "Pathology: High-grade glioma, WHO grade IV, IDH-wildtype [Pathology report 2024-01-16]",
    "confidence": "high"
  }
}
\`\`\`

**Example - Incomplete Diagnosis (requires warning):**
\`\`\`json
{
  "diagnosis": {
    "value": "brain tumor",
    "source": "Large mass noted on imaging [Radiology note 2024-01-15]",
    "confidence": "low",
    "warnings": [
      "Non-specific diagnosis - lacks tumor type",
      "Missing location information",
      "Requires pathological confirmation"
    ]
  }
}
\`\`\`

## 2. CLINICAL REASONING VALIDATION

### Procedure-Diagnosis Coherence:
Verify procedures align with diagnosis:
${Object.entries(MEDICAL_LOGIC_RULES.procedureCoherence).map(([proc, diagnoses]) => 
  `- **${proc}**: typically for ${diagnoses.join(', ')}`
).join('\n')}

**Coherence Check Example:**
\`\`\`json
{
  "diagnosis": { "value": "pituitary adenoma" },
  "procedure": { "value": "transsphenoidal resection" },
  "coherenceCheck": "✓ Procedure appropriate for diagnosis"
}
\`\`\`

**Incoherence Warning Example:**
\`\`\`json
{
  "diagnosis": { "value": "spinal cord tumor" },
  "procedure": { 
    "value": "craniotomy",
    "confidence": "low",
    "warnings": [
      "Procedure-diagnosis mismatch: craniotomy typically for intracranial pathology, not spinal"
    ]
  }
}
\`\`\`

### Clinical Score Validation:
${Object.entries(MEDICAL_LOGIC_RULES.scoreRanges).map(([score, range]) => 
  `- **${score}**: ${range.min}-${range.max} (normal: ${range.normal})`
).join('\n')}

**Score Validation Rules:**
1. Verify scores within valid ranges
2. Flag scores outside ranges with warnings
3. Validate score-clinical description consistency
4. Check for appropriate temporal context

**Example - Invalid Score:**
\`\`\`json
{
  "dischargeGCS": {
    "value": 18,
    "source": "Patient alert and following commands [Discharge exam 2024-01-20]",
    "confidence": "low",
    "warnings": [
      "GCS score 18 exceeds maximum of 15",
      "Clinical description suggests GCS 15 (E4V5M6)"
    ]
  }
}
\`\`\`

## 3. MEDICATION VALIDATION WITH CLINICAL CONTEXT

### Standard Medication Format:
**Drug name | Dose | Unit | Route | Frequency**

### Medication-Condition Coherence:

**Anti-Seizure Medications:**
- **Indications**: ${MEDICAL_LOGIC_RULES.medicationCoherence.antiSeizure.indications.join(', ')}
- **Common drugs**: ${MEDICAL_LOGIC_RULES.medicationCoherence.antiSeizure.common.join(', ')}

**Steroids:**
- **Indications**: ${MEDICAL_LOGIC_RULES.medicationCoherence.steroids.indications.join(', ')}
- **Common drugs**: ${MEDICAL_LOGIC_RULES.medicationCoherence.steroids.common.join(', ')}

**DVT Prophylaxis:**
- **Indications**: ${MEDICAL_LOGIC_RULES.medicationCoherence.dvtProphylaxis.indications.join(', ')}
- **Common drugs**: ${MEDICAL_LOGIC_RULES.medicationCoherence.dvtProphylaxis.common.join(', ')}

**Validation Rules:**
1. Verify medication appropriate for diagnosis
2. Check dose within typical range
3. Validate route appropriate for medication
4. Flag unusual combinations with warnings

**Example - Validated Medication:**
\`\`\`json
{
  "medications": {
    "discharge": [
      {
        "name": "levetiracetam",
        "dose": "750",
        "unit": "mg",
        "route": "PO",
        "frequency": "BID",
        "source": "Keppra 750mg by mouth twice daily [Discharge summary 2024-01-20]",
        "indication": "seizure prophylaxis",
        "confidence": "high",
        "validation": "✓ Appropriate for brain tumor post-craniotomy"
      }
    ]
  }
}
\`\`\`

## 4. TEMPORAL COHERENCE VALIDATION

### Typical Post-Operative Stay Durations:
${Object.entries(MEDICAL_LOGIC_RULES.temporalRules.typicalPostOpStay).map(([proc, duration]) =>
  `- **${proc}**: ${duration.typical} days (range: ${duration.min}-${duration.max})`
).join('\n')}

### Temporal Warning Thresholds:
- **Maximum reasonable LOS**: ${MEDICAL_LOGIC_RULES.temporalRules.warningThresholds.maxReasonableLOS} days
- **Minimum typical LOS**: ${MEDICAL_LOGIC_RULES.temporalRules.warningThresholds.minTypicalLOS} day
- **Future event warning**: ${MEDICAL_LOGIC_RULES.temporalRules.warningThresholds.futureEventWarning} days

**Temporal Validation Rules:**
1. admission < surgery < discharge
2. LOS should match procedure complexity
3. POD/HD calculations must be accurate
4. Future dates > 7 days require warnings
5. Extremely short/long stays require explanation

**Example - Temporal Validation:**
\`\`\`json
{
  "admissionDate": { "value": "2024-01-15" },
  "surgeryDate": { "value": "2024-01-16" },
  "dischargeDate": { 
    "value": "2024-01-21",
    "lengthOfStay": {
      "days": 6,
      "validation": "✓ Within typical range for craniotomy (3-7 days)"
    }
  }
}
\`\`\`

**Example - Temporal Warning:**
\`\`\`json
{
  "admissionDate": { "value": "2024-01-15" },
  "surgeryDate": { "value": "2024-01-16" },
  "dischargeDate": { 
    "value": "2024-03-20",
    "confidence": "medium",
    "lengthOfStay": {
      "days": 65,
      "validation": "⚠ Unusually long stay for craniotomy (typical: 5 days)"
    },
    "warnings": [
      "Length of stay significantly exceeds typical range",
      "May indicate complications or rehabilitation needs"
    ]
  }
}
\`\`\`

## 5. CONFIDENCE CALIBRATION GUIDANCE

### Multi-Factor Confidence Assessment:

**Source Reliability (20% weight):**
- Operative report: 1.0 (highest)
- Discharge summary: 0.95
- Pathology report: 0.95
- Progress note: 0.85
- Nursing note: 0.75
- Unknown source: 0.5

**Extraction Quality (20% weight):**
- Direct quote: 1.0
- Explicit value: 0.9
- Inferred from clinical description: 0.7
- Deduced from multiple sources: 0.6
- Default/assumed: 0.4

**Completeness (15% weight):**
- All required fields present: 1.0
- Most fields present: 0.7-0.9
- Many missing fields: 0.3-0.6
- Minimal information: 0.0-0.3

**Medical Validity (15% weight):**
- Validated terminology: 1.0
- Scores within range: 1.0
- Procedure-diagnosis coherent: 1.0
- Non-standard terms: 0.6
- Scores out of range: <0.5
- Incoherent relationships: <0.5

**Consistency (15% weight):**
- No contradictions: 1.0
- Minor inconsistencies: 0.7-0.9
- Significant contradictions: <0.5

**Temporal Coherence (10% weight):**
- Logical date sequence: 1.0
- Appropriate source timing: 1.0
- Date inconsistencies: 0.5-0.8
- Temporal impossibilities: <0.3

**Context Clarity (5% weight):**
- Clear, specific information: 0.9-1.0
- Somewhat vague: 0.6-0.8
- Ambiguous: 0.3-0.5
- Very unclear: 0.0-0.3

### Confidence Level Assignment:

- **high** (implicit, no need to specify): Score ≥ 0.75
  - Use when: Strong source, clear extraction, validated terminology
  
- **medium** (must specify): Score 0.50-0.74
  - Use when: Reasonable source but some uncertainty
  - Include rationale in warnings array
  
- **low** (must specify): Score < 0.50
  - Use when: Weak source, ambiguous data, or multiple concerns
  - Must include detailed warnings explaining concerns

### Example - Confidence Calibration:

**High Confidence (no need to specify):**
\`\`\`json
{
  "diagnosis": {
    "value": "left frontal glioblastoma, WHO grade IV",
    "source": "Final pathology: Glioblastoma, WHO grade IV, IDH-wildtype [Pathology report 2024-01-17]"
  }
}
\`\`\`

**Medium Confidence:**
\`\`\`json
{
  "dischargeGCS": {
    "value": 15,
    "source": "Alert, following commands, moving all extremities [Progress note POD 4, 2024-01-20]",
    "confidence": "medium",
    "deduced": "clinical-exam-gcs-e4v5m6",
    "warnings": [
      "GCS not explicitly documented",
      "Score deduced from clinical description",
      "Using POD 4 note - no discharge exam available"
    ]
  }
}
\`\`\`

**Low Confidence:**
\`\`\`json
{
  "complications": {
    "value": ["possible infection"],
    "source": "Patient with fever and elevated WBC [Nursing note 2024-01-19]",
    "confidence": "low",
    "warnings": [
      "Infection not confirmed by physician",
      "Based on nursing documentation only",
      "No culture results or physician assessment",
      "Fever could have other etiologies"
    ]
  }
}
\`\`\`

## 6. STRUCTURED VALIDATION CHECKLIST

For each extraction, validate:

✓ **Terminology**: Uses standard medical terms
✓ **Completeness**: Required fields present for diagnosis type
✓ **Coherence**: Procedure matches diagnosis
✓ **Ranges**: Clinical scores within valid bounds
✓ **Medications**: Appropriate for condition, proper formatting
✓ **Temporal**: Date sequence logical, sources appropriately timed
✓ **Confidence**: Calibrated based on multi-factor assessment
✓ **Sources**: All values grounded in specific clinical text with temporal context

# OUTPUT FORMAT

Return a JSON object with validated extraction and confidence metadata:

\`\`\`json
{
  "extraction": {
    // ... all extracted fields with sources ...
  },
  "validation": {
    "terminology": "validated|warnings",
    "coherence": "coherent|concerns",
    "temporal": "valid|warnings",
    "completeness": 0.0-1.0,
    "overallConfidence": 0.0-1.0
  },
  "warnings": [
    // Array of any validation concerns
  ]
}
\`\`\`

# INPUT CLINICAL NOTES

${clinicalNotes}

# YOUR TASK

Extract all available data following medical logic validation rules above.
Apply confidence calibration. Include detailed source attribution with temporal context.
Flag any medical coherence concerns. Validate terminology against standard terms.
`;
}

/**
 * Build enhanced narrative generation prompt with medical logic
 */
export function buildEnhancedNarrativePrompt(extractedData: any): string {
  return `# ROLE AND MISSION
You are an expert neurosurgical clinical narrative generator.
Create a structured clinical summary that integrates medical reasoning and validates coherence.

# NARRATIVE STRUCTURE

## 1. Clinical Summary
- Brief overview of patient presentation, diagnosis, and treatment
- Highlight key clinical findings
- Note any concerns or warnings from extraction

## 2. Medical Coherence Analysis
- Verify procedure-diagnosis alignment
- Check medication-condition appropriateness
- Validate clinical score consistency
- Flag any incoherent relationships

## 3. Temporal Summary
- Document clinical course timeline
- Validate date logic (admission → surgery → discharge)
- Calculate length of stay with typical range comparison
- Note any temporal concerns

## 4. Confidence Assessment
- Overall extraction quality
- Areas of high confidence
- Areas requiring additional validation
- Recommendations for data verification

# MEDICAL REASONING RULES

Apply these validation rules in your narrative:

${Object.entries(MEDICAL_LOGIC_RULES.procedureCoherence).map(([proc, diagnoses]) =>
  `- ${proc} typically performed for: ${diagnoses.join(', ')}`
).join('\n')}

# INPUT EXTRACTED DATA

${JSON.stringify(extractedData, null, 2)}

# YOUR TASK

Generate a clinically coherent narrative that:
1. Summarizes the patient's neurosurgical care
2. Validates medical logic and coherence
3. Highlights areas of high/low confidence
4. Provides actionable recommendations for data quality improvement
`;
}

/**
 * Validation helper for clinical score ranges
 */
export function validateClinicalScore(
  scoreName: keyof typeof MEDICAL_LOGIC_RULES.scoreRanges,
  value: number
): { valid: boolean; warning?: string } {
  const range = MEDICAL_LOGIC_RULES.scoreRanges[scoreName];
  
  if (value < range.min || value > range.max) {
    return {
      valid: false,
      warning: `${scoreName} score ${value} outside valid range ${range.min}-${range.max}`
    };
  }
  
  return { valid: true };
}

/**
 * Validation helper for procedure-diagnosis coherence
 */
export function validateProcedureDiagnosisCoherence(
  procedure: string,
  diagnosis: string
): { coherent: boolean; warning?: string } {
  const procedureLower = procedure.toLowerCase();
  const diagnosisLower = diagnosis.toLowerCase();
  
  for (const [proc, expectedDiagnoses] of Object.entries(MEDICAL_LOGIC_RULES.procedureCoherence)) {
    if (procedureLower.includes(proc.toLowerCase())) {
      const isCoherent = expectedDiagnoses.some(d => diagnosisLower.includes(d.toLowerCase()));
      
      if (!isCoherent) {
        return {
          coherent: false,
          warning: `${proc} typically performed for ${expectedDiagnoses.join(', ')}, but diagnosis is ${diagnosis}`
        };
      }
      
      return { coherent: true };
    }
  }
  
  return { coherent: true }; // Unknown procedure, no validation
}

/**
 * Validation helper for medication-diagnosis appropriateness
 */
export function validateMedicationAppropriate(
  medication: string,
  diagnosis: string
): { appropriate: boolean; category?: string } {
  const medLower = medication.toLowerCase();
  const diagLower = diagnosis.toLowerCase();
  
  // Check pain medications separately
  const painMeds = MEDICAL_LOGIC_RULES.medicationCoherence.painManagement;
  const allPainMeds = [
    ...painMeds.mild,
    ...painMeds.moderate,
    ...painMeds.severe
  ];
  const isPainMed = allPainMeds.some((drug: string) => medLower.includes(drug.toLowerCase()));
  if (isPainMed && diagLower.includes('pain')) {
    return { appropriate: true, category: 'painManagement' };
  }
  
  // Check standard medication categories
  const standardCategories = [
    MEDICAL_LOGIC_RULES.medicationCoherence.antiSeizure,
    MEDICAL_LOGIC_RULES.medicationCoherence.steroids,
    MEDICAL_LOGIC_RULES.medicationCoherence.dvtProphylaxis
  ];
  
  for (const info of standardCategories) {
    const isThisMed = info.common.some((drug: string) => medLower.includes(drug.toLowerCase()));
    
    if (isThisMed) {
      const isAppropriate = info.indications.some((indication: string) => 
        diagLower.includes(indication.toLowerCase())
      );
      
      // Find category name
      const category = Object.entries(MEDICAL_LOGIC_RULES.medicationCoherence).find(
        ([_name, val]) => val === info
      )?.[0];
      
      return { appropriate: isAppropriate, category };
    }
  }
  
  return { appropriate: true }; // Unknown medication, no validation
}

/**
 * Calculate expected length of stay based on procedure
 */
export function calculateExpectedLOS(procedure: string): {
  typical: number;
  min: number;
  max: number;
  range: string;
} | null {
  const procLower = procedure.toLowerCase();
  
  for (const [proc, duration] of Object.entries(MEDICAL_LOGIC_RULES.temporalRules.typicalPostOpStay)) {
    if (procLower.includes(proc.toLowerCase().replace('_', ' '))) {
      return {
        ...duration,
        range: `${duration.min}-${duration.max} days`
      };
    }
  }
  
  return null;
}
