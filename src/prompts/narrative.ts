/**
 * Narrative Generation Prompt
 * Generates clinical discharge summaries from extracted data
 */

import type { NarrativeMode } from '../types/index.js';

/**
 * Build narrative generation prompt
 */
export function buildNarrativePrompt(extractedData: Record<string, any>, mode: NarrativeMode = 'STANDARD'): string {
  const modeInstructions = {
    STRICT: `**STRICT MODE**: Minimalist data presentation
- List facts directly from extraction (dates, procedures, findings)
- NO clinical context or explanations
- NO reasoning about treatment choices
- NO interpretation of outcomes
- Telegraphic style acceptable ("Admitted 2024-01-15. Craniotomy 2024-01-16.")
- Use for: Legal documentation, data transfer`,

    STANDARD: `**STANDARD MODE**: Professional clinical narrative
- Present data in flowing prose with standard medical phrasing
- Add minimal context: procedure indications ("for resection"), standard complications
- Basic clinical reasoning: "Patient tolerated procedure well"
- Professional linking: "Subsequently," "Post-operatively," "On hospital day 3"
- NO extended explanations or teaching points
- Use for: Typical discharge summaries, referral letters`,

    ENHANCED: `**ENHANCED MODE**: Rich clinical narrative with reasoning
- Full clinical context: pathophysiology, treatment rationale, differential considerations
- Explicit clinical reasoning: WHY procedures chosen, HOW decisions made
- Outcome interpretation: "Excellent recovery given extent of resection"
- Educational value: Brief explanations of findings/choices
- Synthesis: Connect findings → treatment → outcomes
- Use for: Academic cases, complex cases, teaching files

**Clinical Reasoning Framework** (ENHANCED mode):
1. **Problem**: Chief complaint + key findings
2. **Assessment**: Diagnosis + severity + urgency
3. **Plan Rationale**: WHY this treatment (alternatives, risks/benefits)
4. **Execution**: HOW treatment performed + intraop findings
5. **Outcome**: Response + trajectory + prognosis indicators`
  }[mode];

  return `# NARRATIVE GENERATION TASK

Generate a professional neurosurgical discharge summary from the extracted clinical data.

## MODE: ${mode}

${modeInstructions}

## CRITICAL RULES

1. **Zero Fabrication**: Only use information from extracted data
2. **Exact Match**: Demographics, dates, medications, procedures must match extraction EXACTLY
3. **No Additions**: Do not add information not in extraction
4. **Grounded**: Every statement must be traceable to extraction data

## STANDARD DISCHARGE SUMMARY FORMAT

### PATIENT INFORMATION
- Name, Age, Gender, MRN
- Admission Date, Surgery Date, Discharge Date

### DIAGNOSES
- Primary diagnosis
- Secondary diagnoses (if applicable)

### HOSPITAL COURSE

**CRITICAL: Synthesize daily course data intelligently - Complete yet concise**

#### Hospital Course Synthesis Guidelines:

**1. Chronological Organization:**
- Present events in temporal order (admission → surgery → post-op → discharge)
- Use temporal markers: "On hospital day 3," "Post-operatively," "By discharge"
- Group related events: Don't describe every single day separately if course was stable

**2. Level of Detail Decision Tree:**

**Uncomplicated Course (3-5 days, no major events):**
- HIGH-LEVEL SUMMARY: "The patient underwent [procedure] on hospital day 2. Post-operative course was uncomplicated. The patient progressed well with physical therapy, achieving independent ambulation by post-operative day 2. At discharge on hospital day 5, the patient was neurologically intact and tolerating a regular diet."
- ❌ DON'T: List every day separately if uneventful
- ✅ DO: Focus on key milestones (surgery, first ambulation, discharge)

**Complicated Course (>5 days OR complications):**
- DAY-BY-DAY for periods with complications/changes
- SUMMARY for stable periods
- Example: "Post-operatively, the patient did well initially, progressing with therapy on post-operative days 1-2. On post-operative day 3, the patient developed fever to 38.9°C. Workup revealed hospital-acquired pneumonia, and the patient was started on ceftriaxone. Over the next 3 days, fever resolved and respiratory status improved. By post-operative day 7, the patient had completed antibiotic course and was medically cleared for discharge."

**Complex/ICU Course (prolonged, multiple complications):**
- ORGAN SYSTEM approach or PROBLEM-BASED approach
- Example: "The patient's post-operative course was complicated by several issues:

  Neurological: Initial post-operative exam showed expected deficits (right hemiparesis 4/5). Serial exams demonstrated gradual improvement to 4+/5 by discharge.

  Infectious: Developed fever POD 3, found to have pneumonia. Treated with 7-day course of ceftriaxone with resolution.

  Hematologic: Post-operative anemia (Hgb 7.2) requiring 1 unit PRBC transfusion POD 2. Hemoglobin stabilized at 9.1."

**3. What to Include:**

**Always Include:**
- Reason for admission + key presenting findings
- Procedure performed (date, type, extent, surgeon if available)
- Major complications with timing, management, resolution
- Trajectory (improving, stable, complicated)
- Key functional milestones (extubation, out of bed, ambulating independently)
- Discharge readiness criteria met

**Include if Documented:**
- Significant intraoperative findings (tumor consistency, resection extent, complications)
- ICU course details (ventilation duration, hemodynamic support)
- Imaging evolution (pre-op → post-op → discharge findings)
- Consultations (neurology, endocrine, PT/OT, social work)
- Code status discussions, family meetings, goals of care

**Can Omit:**
- Routine daily exams if stable ("Neurologically stable POD 1-4")
- Minor symptomatic complaints that resolved quickly
- Routine post-op imaging if no findings ("Routine post-op CT showed expected changes")
- Daily vital signs unless abnormal
- Hourly nursing assessments

**4. Avoid Redundancy:**

❌ **BAD (Repetitive):**
"On post-operative day 1, the patient was alert and oriented. On post-operative day 2, the patient remained alert and oriented. On post-operative day 3, the patient continued to be alert and oriented."

✅ **GOOD (Synthesized):**
"The patient remained neurologically stable throughout the post-operative period, consistently alert and oriented with no new deficits."

❌ **BAD (Over-detailed):**
"The patient was admitted on 1/15. On 1/15 at 14:00, MRI was done. On 1/15 at 20:00, anesthesia saw the patient. On 1/16 at 08:00, the patient went to OR. At 08:30, surgery started..."

✅ **GOOD (Appropriately detailed):**
"The patient was admitted on January 15th. Pre-operative MRI confirmed the diagnosis. The patient underwent left frontal craniotomy on January 16th."

**5. Temporal Flow Phrases:**

Use professional transition phrases:
- "The patient presented with..."
- "On hospital day 2, the patient underwent..."
- "Post-operatively, the course was [uncomplicated | complicated by X]"
- "Over the next several days..."
- "By post-operative day 5..."
- "Throughout the hospitalization..."
- "At the time of discharge..."

**6. Completeness vs. Conciseness Balance:**

**Extraction Phase: Extract EVERYTHING**
- Full day-by-day data
- All events, even minor
- Complete timeline

**Narrative Phase: Synthesize INTELLIGENTLY**
- Present complete picture
- Highlight important events
- Summarize stable periods
- Avoid unnecessary repetition

**Example of Proper Synthesis:**

**From Extracted Data (5 days of daily events):**
- HD1: Admitted, pre-op labs, imaging
- HD2: Surgery, ICU, stable post-op
- HD3: Out of bed, advanced diet, transferred to floor
- HD4: Ambulating, stable
- HD5: Discharge

**Synthesized Narrative:**
"The patient was admitted on January 15th with progressive headaches and underwent left frontal craniotomy for meningioma resection on January 16th. Gross total resection was achieved without intraoperative complications. Post-operatively, the patient recovered well in the ICU overnight and was transferred to the floor on post-operative day 1. The patient progressed well with physical therapy, achieving independent ambulation by post-operative day 2. The hospital course was otherwise uncomplicated, and the patient was discharged home on post-operative day 3."

(Note: 5 days of data → 5 sentences, capturing all key events without listing every routine detail)

### DISCHARGE STATUS
- Neurological status (GCS, deficits)
- Functional status (KPS, mRS, ECOG if documented)
- Activity level and mobility

### DISCHARGE MEDICATIONS
- List all medications with doses, route, frequency

### FOLLOW-UP
- Follow-up appointments
- Activity restrictions
- Special instructions

---

# EXTRACTED CLINICAL DATA

${JSON.stringify(extractedData, null, 2)}

---

Generate the discharge summary narrative. Use professional medical language, proper structure, and ensure all information is grounded in the extracted data above.

Return ONLY the narrative text, no JSON or additional commentary.`;
}
