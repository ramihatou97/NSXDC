/**
 * Validation Prompts - Quality Assurance Layer (ALWAYS ON)
 * Catches hallucinations, inconsistencies, temporal errors, medical logic issues
 */

/**
 * Build combined validation prompt (validates both extraction and narrative)
 */
export function buildValidationPrompt(
  originalNotes: string,
  extractedData: Record<string, any>,
  narrative?: string,
  _documentationInventory?: any
): string {
  const hasNarrative = !!narrative;

  return `# MEDICAL DATA VALIDATION

Verify accuracy and completeness of extracted data${hasNarrative ? ' and generated narrative' : ''}, catching hallucinations, errors, and inconsistencies.

## EXTRACTION VALIDATION

### 1. GROUNDING (CRITICAL)
- Every value has sourceQuote that exists VERBATIM in original notes
- sourceQuote supports the extracted value (no paraphrase, no fabrication)

### 2. TEMPORAL COHERENCE (CRITICAL)

**Date Format & Chronology:**
- Valid dates (YYYY-MM-DD format required)
- Chronological order: admission ≤ surgery ≤ discharge
- POD/HD calculations correct (POD 3 = Surgery Date + 3 days)
- No temporal impossibilities (event on POD 7 cannot occur before POD 3)

**Source Context Validation:**
- Every extracted field has sourceContext documenting temporal origin
- Discharge status fields cite discharge-timeframe sources (discharge exam, final 24-48h notes)
- Admission fields cite admission sources (admission H&P)
- NO using admission exam for discharge status (temporal hallucination)
- NO using pre-op imaging for post-op complications
- NO using early post-op data (POD 0-2) for discharge functional status without justification

**Hospital Course Completeness:**
- All documented hospital days extracted
- Events in chronological order within each day
- Clinical trajectory documented with evidence timeline
- Key milestones captured (surgery, extubation, first ambulation, complications, discharge)
- Gaps in documentation noted ("No progress note available POD 2")

**Temporal Consistency Checks:**
- Length of stay = discharge date - admission date (verify calculation)
- Post-operative day at discharge = discharge date - surgery date (verify)
- Medication start dates ≤ stop dates
- Complication onset date → management date → resolution date (logical sequence)
- Functional status changes over time are plausible (not GCS 15 → 8 → 15 in 24h without explanation)

**Examples of Temporal Violations:**

❌ **CRITICAL: Temporal Misattribution**
{
  "dischargeGCS": {
    "value": 15,
    "sourceQuote": "Alert and oriented x3",
    "sourceContext": "Admission exam dated 2024-01-15"  // Using admission for discharge!
  }
}
**Issue:** Cannot use admission exam for discharge status. This is fabrication.

❌ **CRITICAL: Impossible Event Sequence**
{
  "hospitalCourse": {
    "dailyProgress": [
      { "date": "2024-01-20", "postOpDay": 5, "event": "Developed fever" },
      { "date": "2024-01-18", "postOpDay": 3, "event": "Started antibiotics" }
    ]
  }
}
**Issue:** Cannot start antibiotics POD 3 for fever that develops POD 5.

❌ **CRITICAL: Missing Source Context**
{
  "dischargeKPS": {
    "value": 80,
    "sourceQuote": "Ambulating independently",
    "sourceContext": null  // Missing!
  }
}
**Issue:** Must document temporal context of every quote.

### 3. MEDICAL (CRITICAL)
- Procedures match pathology, medications match conditions
- Scores valid: GCS 3-15, mRS 0-6, KPS 0-100, ECOG 0-5

### 4. DISCHARGE STATUS (CRITICAL)
- Deduced scores (GCS, KPS, mRS) have sourceQuote with actual clinical findings
- NOT assumed without documentation, NOT using admission status

### 5. MODE COMPLIANCE (MAJOR)
- Confidence levels appropriate: "high" (explicit), "medium" (inference), "low" (weak)
- Low confidence items have warnings

### 6. COMPLETENESS (MAJOR)
- Key fields present (admission date, diagnosis)
- High-priority info extracted (GCS, deficits, complications)

### 7. MEDICATION SAFETY (CRITICAL)
- Doses within safe ranges (use extraction prompt reference)
- Units correct (mg not g for Keppra, units not mg for heparin)
- Routes appropriate (PO for oral meds, IV for certain antibiotics)
- No obvious contraindications (e.g., anticoagulants post-craniotomy should be scrutinized)
- Frequency reasonable (BID/TID/QID standard, Q2H unusual and should be flagged)

### 8. ANATOMICAL CONSISTENCY (CRITICAL)
- Laterality matches (right frontal tumor → right frontal craniotomy, NOT left)
- Location matches (brain pathology → craniotomy, NOT laminectomy)
- Approach matches location (transsphenoidal for pituitary, NOT craniotomy)
- Deficits match lesion location (left MCA stroke → right-sided weakness)

### 9. GCS CALCULATION (CRITICAL)
- If GCS components present (Eye, Verbal, Motor), verify: E + V + M = Total GCS
- Eye: 1-4, Verbal: 1-5, Motor: 1-6, Total: 3-15
- Example: E4V5M6 = 15 (correct), E3V4M5 = 12 (not 11)
- Flag if deductionMethod mentions GCS but calculation wrong
${hasNarrative ? `
## NARRATIVE VALIDATION

### 1. FABRICATION (CRITICAL)
- Every statement traceable to extraction
- NO added complications/outcomes/plans not documented

### 2. GROUNDING (CRITICAL)
- Demographics, dates, procedures, medications match extraction exactly

### 3. TEMPORAL (CRITICAL)
- Events chronological, dates consistent
` : ''}
## OUTPUT

Return JSON:
${hasNarrative ? `
{
  "extraction": {"isValid": bool, "score": 0-100, "issues": [...]},
  "narrative": {"isValid": bool, "score": 0-100, "issues": [...]},
  "overall": {"isValid": bool, "score": 0-100, "summary": "text"}
}

Issue format: {"severity": "critical|major|minor", "category": "grounding|temporal|medical|medication|anatomical|gcs|mode|completeness", "message": "text", "location": "field", "suggestedFix": "text"}

Scoring: Start 100, -20 per critical, -5 per major, -1 per minor (min 0)
Valid: score ≥ 80 AND no critical issues
Overall: Average scores, valid only if BOTH valid
` : `
{
  "isValid": bool,
  "score": 0-100,
  "issues": [{"severity": "critical|major|minor", "category": "grounding|temporal|medical|medication|anatomical|gcs|mode|completeness", "message": "text", "location": "field", "suggestedFix": "text"}]
}

Scoring: Start 100, -20 per critical, -5 per major, -1 per minor (min 0)
Valid: score ≥ 80 AND no critical issues
`}
---

# ORIGINAL NOTES
${originalNotes}

---

# EXTRACTED DATA
${JSON.stringify(extractedData, null, 2)}
${hasNarrative ? `
---

# NARRATIVE
${narrative}
` : ''}
---

Perform validation and return JSON report.`;
}
