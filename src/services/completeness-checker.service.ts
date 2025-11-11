/**
 * Completeness Checker Service (Phase 8)
 *
 * Performs pre-extraction and post-extraction completeness validation:
 * - Pre-extraction: Analyzes input clinical notes for extractability requirements
 * - Post-extraction: Validates extracted data for field-level completeness and quality
 *
 * This service acts as a quality gate to ensure:
 * 1. Input clinical notes contain minimum required information
 * 2. Extraction produced complete, high-confidence data
 * 3. Missing/low-quality extractions are flagged with actionable warnings
 */

import type { DocumentationInventoryResult } from './documentation-inventory.service.js';

// ============================================================================
// PRE-EXTRACTION CHECKLIST TYPES
// ============================================================================

export type PreExtractionCheckType =
  | 'required_document'      // Critical document missing
  | 'temporal_anchor'        // Key date missing
  | 'document_quality'       // Document incomplete/truncated
  | 'pod_coverage'           // POD documentation gaps
  | 'discharge_readiness';   // Discharge documentation incomplete

export interface PreExtractionCheck {
  type: PreExtractionCheckType;
  passed: boolean;
  severity: 'critical' | 'major' | 'minor';
  message: string;
  recommendation?: string;
  details?: string;
}

export interface PreExtractionChecklist {
  overallReady: boolean;           // Can extraction proceed?
  readinessScore: number;          // 0-100
  checks: PreExtractionCheck[];
  blockers: PreExtractionCheck[];  // Critical failures
  warnings: PreExtractionCheck[];  // Non-critical issues
}

// ============================================================================
// POST-EXTRACTION CHECKLIST TYPES
// ============================================================================

export type PostExtractionCheckType =
  | 'field_completeness'     // Expected field missing/null
  | 'field_confidence'       // Field has low confidence
  | 'field_quality'          // Field has warnings/issues
  | 'temporal_coverage'      // Discharge fields use non-discharge data
  | 'data_consistency'       // Cross-field inconsistencies
  | 'source_attribution';    // Missing sourceQuote or sourceNoteType

export interface PostExtractionCheck {
  type: PostExtractionCheckType;
  passed: boolean;
  severity: 'critical' | 'major' | 'minor';
  fieldName?: string;          // Which field has issue
  message: string;
  recommendation?: string;
  details?: string;
}

export interface PostExtractionChecklist {
  overallComplete: boolean;        // Is extraction complete enough?
  completenessScore: number;       // 0-100
  checks: PostExtractionCheck[];
  criticalIssues: PostExtractionCheck[];  // Must-fix issues
  majorIssues: PostExtractionCheck[];     // Should-fix issues
  minorIssues: PostExtractionCheck[];     // Nice-to-fix issues
}

// ============================================================================
// FIELD REQUIREMENTS CONFIGURATION
// ============================================================================

export interface FieldRequirement {
  fieldPath: string;           // JSON path (e.g., "admissionDate")
  required: boolean;           // Must be present?
  minConfidence?: 'low' | 'medium' | 'high';  // Minimum confidence
  requiresSource?: boolean;    // Must have sourceQuote?
  requiresNoteType?: boolean;  // Must have sourceNoteType?
  category: 'admission' | 'surgical' | 'discharge' | 'other';
}

// ============================================================================
// COMPLETENESS CHECKER SERVICE
// ============================================================================

export class CompletenessCheckerService {
  /**
   * Define field requirements for post-extraction validation
   * Based on neurosurgical discharge documentation standards
   */
  private readonly fieldRequirements: FieldRequirement[] = [
    // =========== ADMISSION FIELDS (Required) ===========
    { fieldPath: 'admissionDate', required: true, minConfidence: 'medium', requiresSource: true, category: 'admission' },
    { fieldPath: 'chiefComplaint', required: true, minConfidence: 'medium', requiresSource: true, category: 'admission' },
    { fieldPath: 'presentingSymptoms', required: true, minConfidence: 'medium', requiresSource: true, category: 'admission' },
    { fieldPath: 'admissionGCS', required: true, minConfidence: 'medium', requiresSource: true, requiresNoteType: true, category: 'admission' },
    { fieldPath: 'admissionKPS', required: true, minConfidence: 'medium', requiresSource: true, requiresNoteType: true, category: 'admission' },

    // =========== SURGICAL FIELDS (Required if surgical case) ===========
    { fieldPath: 'surgeryDate', required: false, minConfidence: 'high', requiresSource: true, category: 'surgical' },
    { fieldPath: 'procedure', required: false, minConfidence: 'high', requiresSource: true, category: 'surgical' },
    { fieldPath: 'surgicalApproach', required: false, minConfidence: 'medium', requiresSource: true, category: 'surgical' },
    { fieldPath: 'operativeFindings', required: false, minConfidence: 'medium', requiresSource: true, category: 'surgical' },

    // =========== DISCHARGE FIELDS (Required) ===========
    { fieldPath: 'dischargeDate', required: true, minConfidence: 'medium', requiresSource: true, category: 'discharge' },
    { fieldPath: 'dischargeGCS', required: true, minConfidence: 'medium', requiresSource: true, requiresNoteType: true, category: 'discharge' },
    { fieldPath: 'dischargeKPS', required: true, minConfidence: 'medium', requiresSource: true, requiresNoteType: true, category: 'discharge' },
    { fieldPath: 'dischargeDisposition', required: true, minConfidence: 'high', requiresSource: true, category: 'discharge' },
    { fieldPath: 'dischargeMedications', required: true, minConfidence: 'medium', requiresSource: true, category: 'discharge' },
    { fieldPath: 'dischargeAmbulation', required: true, minConfidence: 'medium', requiresSource: true, requiresNoteType: true, category: 'discharge' },

    // =========== OTHER FIELDS (Nice-to-have) ===========
    { fieldPath: 'complications', required: false, minConfidence: 'medium', requiresSource: true, category: 'other' },
    { fieldPath: 'pathologyResults', required: false, minConfidence: 'high', requiresSource: true, category: 'other' },
    { fieldPath: 'followUpPlan', required: false, minConfidence: 'medium', requiresSource: true, category: 'discharge' },
  ];

  /**
   * PRE-EXTRACTION: Check if clinical notes are ready for extraction
   * Analyzes documentation inventory to identify blockers and warnings
   */
  preExtractionCheck(
    clinicalNotes: string,
    inventoryResult: DocumentationInventoryResult
  ): PreExtractionChecklist {
    const checks: PreExtractionCheck[] = [];

    // CHECK 1: Required document - Admission H&P
    const hasAdmissionHP = inventoryResult.documents.some(d => d.type === 'ADMISSION_HP');
    checks.push({
      type: 'required_document',
      passed: hasAdmissionHP,
      severity: 'critical',
      message: hasAdmissionHP
        ? 'Admission H&P document detected'
        : 'Missing Admission History & Physical document',
      recommendation: hasAdmissionHP
        ? undefined
        : 'Admission H&P is required for extracting admission baseline (GCS, KPS, presenting symptoms). Cannot extract admission data without this document.',
      details: hasAdmissionHP
        ? `Found ${inventoryResult.documents.filter(d => d.type === 'ADMISSION_HP').length} admission document(s)`
        : 'No admission documentation detected in clinical notes',
    });

    // CHECK 2: Required document - Discharge Summary (or late progress note)
    const hasDischargeDoc = inventoryResult.documents.some(
      d => d.type === 'DISCHARGE_SUMMARY' || (d.type === 'PROGRESS_NOTE' && d.postOpDay !== null && d.postOpDay >= 5)
    );
    checks.push({
      type: 'required_document',
      passed: hasDischargeDoc,
      severity: 'major',
      message: hasDischargeDoc
        ? 'Discharge documentation detected'
        : 'Missing Discharge Summary or late progress note',
      recommendation: hasDischargeDoc
        ? undefined
        : 'Discharge summary or late progress note (POD 5+) required for extracting discharge status. Discharge fields may be incomplete or use admission data (temporal hallucination risk).',
      details: hasDischargeDoc
        ? `Found ${inventoryResult.documents.filter(d => d.type === 'DISCHARGE_SUMMARY').length} discharge summary, ${inventoryResult.documents.filter(d => d.type === 'PROGRESS_NOTE' && d.postOpDay !== null && d.postOpDay >= 5).length} late progress notes`
        : 'No discharge summary or late progress notes (POD 5+) detected',
    });

    // CHECK 3: Temporal anchor - Admission date
    const admissionDateDetected = /admission.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i.test(clinicalNotes.substring(0, 5000));
    checks.push({
      type: 'temporal_anchor',
      passed: admissionDateDetected,
      severity: 'critical',
      message: admissionDateDetected
        ? 'Admission date detected in notes'
        : 'Admission date not clearly identified',
      recommendation: admissionDateDetected
        ? undefined
        : 'Admission date is required as temporal anchor for timeline reconstruction. Without it, POD calculations will fail.',
      details: admissionDateDetected
        ? 'Admission date found in first 5000 characters'
        : 'No clear admission date pattern found in early portion of notes',
    });

    // CHECK 4: Temporal anchor - Discharge date
    const dischargeDateDetected = /discharge.*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i.test(clinicalNotes);
    checks.push({
      type: 'temporal_anchor',
      passed: dischargeDateDetected,
      severity: 'major',
      message: dischargeDateDetected
        ? 'Discharge date detected in notes'
        : 'Discharge date not clearly identified',
      recommendation: dischargeDateDetected
        ? undefined
        : 'Discharge date required as temporal endpoint. Without it, cannot validate recency principle for discharge fields.',
      details: dischargeDateDetected
        ? 'Discharge date pattern found'
        : 'No clear discharge date pattern found',
    });

    // CHECK 5: POD coverage (if surgical case)
    const isSurgicalCase = inventoryResult.documents.some(d => d.type === 'OPERATIVE_REPORT');
    if (isSurgicalCase && inventoryResult.podCoverage.expectedPODs.length > 0) {
      const podCoveragePassed = inventoryResult.podCoverage.coveragePercentage >= 80;
      checks.push({
        type: 'pod_coverage',
        passed: podCoveragePassed,
        severity: podCoveragePassed ? 'minor' : 'major',
        message: `POD coverage: ${inventoryResult.podCoverage.coveragePercentage}% (${inventoryResult.podCoverage.presentPODs.length}/${inventoryResult.podCoverage.expectedPODs.length} PODs documented)`,
        recommendation: podCoveragePassed
          ? undefined
          : `Large documentation gaps detected: ${inventoryResult.podCoverage.missingRanges.join(', ')}. Extraction may miss complications, status changes, or discharge readiness information.`,
        details: `Missing PODs: ${inventoryResult.podCoverage.missingPODs.join(', ')}`,
      });
    }

    // CHECK 6: Document quality - Check for truncated notes
    const seemsTruncated = clinicalNotes.includes('[TRUNCATED]') ||
                           clinicalNotes.includes('...continued') ||
                           (clinicalNotes.length > 50000 && !clinicalNotes.includes('discharge'));
    checks.push({
      type: 'document_quality',
      passed: !seemsTruncated,
      severity: 'major',
      message: seemsTruncated
        ? 'Clinical notes may be truncated or incomplete'
        : 'Clinical notes appear complete',
      recommendation: seemsTruncated
        ? 'Notes contain truncation markers or appear incomplete. Extraction may miss critical information. Verify complete notes are available.'
        : undefined,
    });

    // CHECK 7: Discharge readiness - Look for discharge planning documentation
    const hasDischargeInfo = /discharge.*?(medications|disposition|instructions|plan|follow.*?up)/i.test(clinicalNotes);
    checks.push({
      type: 'discharge_readiness',
      passed: hasDischargeInfo,
      severity: 'major',
      message: hasDischargeInfo
        ? 'Discharge planning documentation detected'
        : 'Limited discharge planning documentation',
      recommendation: hasDischargeInfo
        ? undefined
        : 'No clear discharge medications, disposition, or follow-up plans detected. Discharge fields may be incomplete or missing.',
      details: hasDischargeInfo
        ? 'Found discharge-related keywords in notes'
        : 'No discharge medications, disposition, or follow-up patterns detected',
    });

    // Calculate overall readiness
    const blockers = checks.filter(c => !c.passed && c.severity === 'critical');
    const warnings = checks.filter(c => !c.passed && (c.severity === 'major' || c.severity === 'minor'));
    const passedChecks = checks.filter(c => c.passed).length;
    const readinessScore = Math.round((passedChecks / checks.length) * 100);
    const overallReady = blockers.length === 0;

    return {
      overallReady,
      readinessScore,
      checks,
      blockers,
      warnings,
    };
  }

  /**
   * POST-EXTRACTION: Validate completeness of extracted data
   * Checks for missing fields, low confidence, poor source attribution
   */
  postExtractionCheck(
    extractedData: Record<string, any>,
    inventoryResult: DocumentationInventoryResult
  ): PostExtractionChecklist {
    const checks: PostExtractionCheck[] = [];

    // Determine if this is a surgical case
    const isSurgicalCase = extractedData.surgeryDate?.value !== null && extractedData.surgeryDate?.value !== undefined;

    // CHECK EACH FIELD REQUIREMENT
    for (const requirement of this.fieldRequirements) {
      const fieldValue = this.getFieldValue(extractedData, requirement.fieldPath);

      // Skip non-required surgical fields if not a surgical case
      if (requirement.category === 'surgical' && !requirement.required && !isSurgicalCase) {
        continue;
      }

      // For surgical cases, surgical fields become required
      const isRequired = requirement.required || (requirement.category === 'surgical' && isSurgicalCase);

      // Check 1: Field completeness (required field missing/null)
      if (isRequired) {
        const isPresent = fieldValue !== null && fieldValue !== undefined &&
                         (typeof fieldValue !== 'object' || fieldValue.value !== null);

        if (!isPresent) {
          checks.push({
            type: 'field_completeness',
            passed: false,
            severity: requirement.category === 'admission' || requirement.category === 'discharge' ? 'critical' : 'major',
            fieldName: requirement.fieldPath,
            message: `Required field "${requirement.fieldPath}" is missing or null`,
            recommendation: `Extract ${requirement.fieldPath} from clinical notes. This is a required field for ${requirement.category} data.`,
            details: `Field category: ${requirement.category}, Required: ${isRequired}`,
          });
          continue; // Skip other checks if field is missing
        } else {
          checks.push({
            type: 'field_completeness',
            passed: true,
            severity: 'minor',
            fieldName: requirement.fieldPath,
            message: `Field "${requirement.fieldPath}" is present`,
          });
        }
      }

      // For present fields, check quality
      if (fieldValue && typeof fieldValue === 'object' && fieldValue.value !== null) {
        // Check 2: Field confidence
        if (requirement.minConfidence) {
          const confidenceLevel = { low: 1, medium: 2, high: 3 };
          const actualLevel = confidenceLevel[fieldValue.confidence as 'low' | 'medium' | 'high'] || 0;
          const requiredLevel = confidenceLevel[requirement.minConfidence];

          const confidencePassed = actualLevel >= requiredLevel;
          if (!confidencePassed) {
            checks.push({
              type: 'field_confidence',
              passed: false,
              severity: requirement.category === 'discharge' ? 'major' : 'minor',
              fieldName: requirement.fieldPath,
              message: `Field "${requirement.fieldPath}" has low confidence: ${fieldValue.confidence} (expected ${requirement.minConfidence}+)`,
              recommendation: `Review source documentation for ${requirement.fieldPath}. Low confidence may indicate ambiguous or unclear data.`,
              details: `Actual: ${fieldValue.confidence}, Required: ${requirement.minConfidence}+`,
            });
          } else {
            checks.push({
              type: 'field_confidence',
              passed: true,
              severity: 'minor',
              fieldName: requirement.fieldPath,
              message: `Field "${requirement.fieldPath}" has acceptable confidence: ${fieldValue.confidence}`,
            });
          }
        }

        // Check 3: Source attribution - sourceQuote
        if (requirement.requiresSource) {
          const hasSource = fieldValue.sourceQuote && fieldValue.sourceQuote.trim().length > 0;
          if (!hasSource) {
            checks.push({
              type: 'source_attribution',
              passed: false,
              severity: 'major',
              fieldName: requirement.fieldPath,
              message: `Field "${requirement.fieldPath}" missing sourceQuote`,
              recommendation: `Add sourceQuote for ${requirement.fieldPath} to enable grounding verification.`,
            });
          } else {
            checks.push({
              type: 'source_attribution',
              passed: true,
              severity: 'minor',
              fieldName: requirement.fieldPath,
              message: `Field "${requirement.fieldPath}" has sourceQuote`,
            });
          }
        }

        // Check 4: Source attribution - sourceNoteType (Phase 4+)
        if (requirement.requiresNoteType) {
          const hasNoteType = fieldValue.sourceNoteType && fieldValue.sourceNoteType.trim().length > 0;
          if (!hasNoteType) {
            checks.push({
              type: 'source_attribution',
              passed: false,
              severity: 'minor',
              fieldName: requirement.fieldPath,
              message: `Field "${requirement.fieldPath}" missing sourceNoteType`,
              recommendation: `Add sourceNoteType for ${requirement.fieldPath} (e.g., ADMISSION_HP, DISCHARGE_SUMMARY, PROGRESS_NOTE).`,
            });
          } else {
            checks.push({
              type: 'source_attribution',
              passed: true,
              severity: 'minor',
              fieldName: requirement.fieldPath,
              message: `Field "${requirement.fieldPath}" has sourceNoteType: ${fieldValue.sourceNoteType}`,
            });
          }
        }

        // Check 5: Discharge field temporal coverage (Phase 5 - Timeline tracking)
        if (requirement.category === 'discharge') {
          const sourceNoteType = fieldValue.sourceNoteType;
          // Discharge fields should NOT come from ADMISSION_HP
          if (sourceNoteType === 'ADMISSION_HP') {
            checks.push({
              type: 'temporal_coverage',
              passed: false,
              severity: 'critical',
              fieldName: requirement.fieldPath,
              message: `CRITICAL: Discharge field "${requirement.fieldPath}" sourced from ADMISSION_HP (temporal crossover)`,
              recommendation: `Extract ${requirement.fieldPath} from discharge documentation, not admission. This is temporal hallucination - using admission status for discharge field.`,
              details: `sourceNoteType: ${sourceNoteType}. Discharge fields must use discharge-timeframe documentation (DISCHARGE_SUMMARY, late PROGRESS_NOTE, THERAPY_NOTE).`,
            });
          } else if (sourceNoteType && !['DISCHARGE_SUMMARY', 'PROGRESS_NOTE', 'THERAPY_NOTE', 'NURSING_NOTE'].includes(sourceNoteType)) {
            checks.push({
              type: 'temporal_coverage',
              passed: false,
              severity: 'major',
              fieldName: requirement.fieldPath,
              message: `Discharge field "${requirement.fieldPath}" sourced from unexpected note type: ${sourceNoteType}`,
              recommendation: `Verify ${requirement.fieldPath} is from discharge-timeframe documentation. Expected: DISCHARGE_SUMMARY, late PROGRESS_NOTE, or THERAPY_NOTE.`,
            });
          } else {
            checks.push({
              type: 'temporal_coverage',
              passed: true,
              severity: 'minor',
              fieldName: requirement.fieldPath,
              message: `Discharge field "${requirement.fieldPath}" sourced from appropriate note type`,
            });
          }
        }

        // Check 6: Field quality - warnings embedded in extraction
        if (fieldValue.warnings && Array.isArray(fieldValue.warnings) && fieldValue.warnings.length > 0) {
          checks.push({
            type: 'field_quality',
            passed: false,
            severity: 'minor',
            fieldName: requirement.fieldPath,
            message: `Field "${requirement.fieldPath}" has ${fieldValue.warnings.length} warning(s)`,
            details: fieldValue.warnings.map((w: any) => w.message).join('; '),
            recommendation: `Review warnings for ${requirement.fieldPath}: ${fieldValue.warnings.map((w: any) => w.message).join('; ')}`,
          });
        }
      }
    }

    // CHECK 7: Cross-field consistency - Discharge date after admission date
    const admissionDate = extractedData.admissionDate?.value;
    const dischargeDate = extractedData.dischargeDate?.value;
    if (admissionDate && dischargeDate) {
      const admissionTime = new Date(admissionDate).getTime();
      const dischargeTime = new Date(dischargeDate).getTime();
      const datesConsistent = dischargeTime >= admissionTime;

      checks.push({
        type: 'data_consistency',
        passed: datesConsistent,
        severity: datesConsistent ? 'minor' : 'critical',
        message: datesConsistent
          ? 'Admission and discharge dates are consistent'
          : 'CRITICAL: Discharge date is before admission date',
        recommendation: datesConsistent
          ? undefined
          : 'Date order is incorrect. Check date format interpretation (DD/MM/YYYY vs MM/DD/YYYY) or extraction logic.',
        details: `Admission: ${admissionDate}, Discharge: ${dischargeDate}`,
      });
    }

    // CHECK 8: Cross-field consistency - Surgery date between admission and discharge
    if (isSurgicalCase) {
      const surgeryDate = extractedData.surgeryDate?.value;
      if (admissionDate && dischargeDate && surgeryDate) {
        const admissionTime = new Date(admissionDate).getTime();
        const dischargeTime = new Date(dischargeDate).getTime();
        const surgeryTime = new Date(surgeryDate).getTime();
        const surgeryDateValid = surgeryTime >= admissionTime && surgeryTime <= dischargeTime;

        checks.push({
          type: 'data_consistency',
          passed: surgeryDateValid,
          severity: surgeryDateValid ? 'minor' : 'critical',
          message: surgeryDateValid
            ? 'Surgery date is between admission and discharge'
            : 'CRITICAL: Surgery date is outside admission-discharge window',
          recommendation: surgeryDateValid
            ? undefined
            : 'Surgery date must fall between admission and discharge. Check date extraction or format interpretation.',
          details: `Admission: ${admissionDate}, Surgery: ${surgeryDate}, Discharge: ${dischargeDate}`,
        });
      }
    }

    // Calculate overall completeness
    const criticalIssues = checks.filter(c => !c.passed && c.severity === 'critical');
    const majorIssues = checks.filter(c => !c.passed && c.severity === 'major');
    const minorIssues = checks.filter(c => !c.passed && c.severity === 'minor');
    const passedChecks = checks.filter(c => c.passed).length;
    const completenessScore = Math.round((passedChecks / checks.length) * 100);
    const overallComplete = criticalIssues.length === 0 && majorIssues.length === 0;

    return {
      overallComplete,
      completenessScore,
      checks,
      criticalIssues,
      majorIssues,
      minorIssues,
    };
  }

  /**
   * Helper: Get nested field value from extracted data
   */
  private getFieldValue(data: Record<string, any>, fieldPath: string): any {
    const keys = fieldPath.split('.');
    let value = data;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }
}
