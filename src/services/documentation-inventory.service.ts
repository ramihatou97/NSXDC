/**
 * Documentation Inventory Service (Phase 2)
 * Analyzes clinical notes to identify present vs. expected documentation
 * Detects gaps in POD coverage and missing document types
 */

export type DocumentType =
  | 'ADMISSION_HP'           // Admission History & Physical
  | 'PREOP_CONSULT'          // Pre-operative consultation/visit
  | 'OPERATIVE_REPORT'       // Operative report (surgery note)
  | 'PROGRESS_NOTE'          // Daily progress note (includes POD notes)
  | 'DISCHARGE_SUMMARY'      // Discharge summary
  | 'CONSULT_NOTE'           // Specialty consult (non-neurosurgery)
  | 'PROCEDURE_NOTE'         // Non-operative procedure note
  | 'IMAGING_REPORT'         // Radiology/imaging report
  | 'LAB_REPORT'             // Laboratory results
  | 'NURSING_NOTE'           // Nursing assessment/note
  | 'THERAPY_NOTE'           // PT/OT/Speech therapy note
  | 'OTHER';                 // Unclassified note type

export interface DocumentInstance {
  type: DocumentType;
  date: string | null;           // Date of document (ISO format)
  postOpDay: number | null;      // Post-operative day (if applicable)
  title: string;                 // Document title/header
  author: string | null;         // Author name
  specialty: string | null;      // Medical specialty
  sourceQuote: string;           // First 200 chars of document
  confidence: 'high' | 'medium' | 'low';  // Detection confidence
}

export interface PODCoverage {
  surgeryDate: string | null;        // Surgery date (ISO format)
  dischargeDate: string | null;      // Discharge date (ISO format)
  expectedPODs: number[];            // Expected POD numbers [0, 1, 2, ..., N]
  presentPODs: number[];             // PODs with documentation
  missingPODs: number[];             // PODs without documentation
  missingRanges: string[];           // Human-readable gaps (e.g., "POD 3-16")
  coveragePercentage: number;        // % of expected PODs documented
}

export interface DocumentationGaps {
  missingCritical: DocumentType[];   // Critical missing docs (Op Report, D/C Summary)
  missingImportant: DocumentType[];  // Important missing docs (Admission H&P)
  missingPODCount: number;           // Number of missing POD progress notes
  missingPODRanges: string[];        // Human-readable POD gaps
  totalGapDays: number;              // Total days of missing documentation
}

export interface DocumentationInventoryResult {
  documents: DocumentInstance[];     // All detected documents
  podCoverage: PODCoverage;          // POD analysis
  gaps: DocumentationGaps;           // Identified gaps
  completenessScore: number;         // Overall completeness (0-100)
  warnings: string[];                // Completeness warnings
}

export interface DocumentationInventoryConfig {
  requireAdmissionHP: boolean;       // Flag missing Admission H&P
  requireDischargeSummary: boolean;  // Flag missing Discharge Summary
  minPODCoveragePercent: number;     // Minimum acceptable POD coverage (%)
}

export class DocumentationInventoryService {
  private config: DocumentationInventoryConfig;

  constructor(config?: Partial<DocumentationInventoryConfig>) {
    this.config = {
      requireAdmissionHP: true,
      requireDischargeSummary: true,
      minPODCoveragePercent: 80,
      ...config,
    };
  }

  /**
   * Analyze clinical notes to identify present documentation and gaps
   */
  analyze(
    clinicalNotes: string,
    surgeryDate: string | null,
    dischargeDate: string | null
  ): DocumentationInventoryResult {
    // Step 1: Detect all documents in clinical notes
    const documents = this.detectDocuments(clinicalNotes);

    // Step 2: Analyze POD coverage
    const podCoverage = this.analyzePODCoverage(documents, surgeryDate, dischargeDate);

    // Step 3: Identify documentation gaps
    const gaps = this.identifyGaps(documents, podCoverage);

    // Step 4: Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(documents, podCoverage, gaps);

    // Step 5: Generate warnings
    const warnings = this.generateWarnings(documents, podCoverage, gaps);

    return {
      documents,
      podCoverage,
      gaps,
      completenessScore,
      warnings,
    };
  }

  /**
   * Detect all document instances in clinical notes
   */
  private detectDocuments(clinicalNotes: string): DocumentInstance[] {
    const documents: DocumentInstance[] = [];
    const lines = clinicalNotes.split('\n');

    // Split into document sections (separated by ════ dividers)
    const sections: string[] = [];
    let currentSection: string[] = [];

    for (const line of lines) {
      if (line.includes('════')) {
        if (currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
          currentSection = [];
        }
      } else {
        currentSection.push(line);
      }
    }
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }

    // Analyze each section
    for (const section of sections) {
      const doc = this.detectDocumentType(section);
      if (doc) {
        documents.push(doc);
      }
    }

    return documents;
  }

  /**
   * Detect document type from a section of clinical notes
   */
  private detectDocumentType(section: string): DocumentInstance | null {
    if (section.trim().length < 20) return null; // Too short to be a document

    const lowerSection = section.toLowerCase();
    const lines = section.split('\n');

    // Extract metadata
    const author = this.extractAuthor(section);
    const specialty = this.extractSpecialty(section);
    const date = this.extractDate(section);
    const postOpDay = this.extractPostOpDay(section);

    // Detect document type based on keywords and patterns
    let type: DocumentType = 'OTHER';
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let title = 'Unknown Document';

    // Operative Report
    if (
      lowerSection.includes('op note') ||
      lowerSection.includes('operative report') ||
      lowerSection.includes('procedure note')
    ) {
      type = 'OPERATIVE_REPORT';
      confidence = 'high';
      title = 'Operative Report';
    }
    // Progress Note (including POD notes)
    else if (
      lowerSection.includes('progress note') ||
      lowerSection.includes('post-op') ||
      lowerSection.includes('postop') ||
      lowerSection.includes('pod ') ||
      lowerSection.includes('day post-op') ||
      lowerSection.includes('postoperative day')
    ) {
      type = 'PROGRESS_NOTE';
      confidence = 'high';
      title = postOpDay !== null ? `Progress Note POD ${postOpDay}` : 'Progress Note';
    }
    // Admission H&P
    else if (
      lowerSection.includes('admission') &&
      (lowerSection.includes('history') || lowerSection.includes('h&p'))
    ) {
      type = 'ADMISSION_HP';
      confidence = 'high';
      title = 'Admission History & Physical';
    }
    // Pre-op Consult
    else if (
      (lowerSection.includes('pre-op') || lowerSection.includes('preop') || lowerSection.includes('pre op')) &&
      (lowerSection.includes('consult') || lowerSection.includes('clinic') || lowerSection.includes('visit'))
    ) {
      type = 'PREOP_CONSULT';
      confidence = 'high';
      title = 'Pre-operative Consultation';
    }
    // Discharge Summary
    else if (
      lowerSection.includes('discharge') &&
      (lowerSection.includes('summary') || lowerSection.includes('note'))
    ) {
      type = 'DISCHARGE_SUMMARY';
      confidence = 'high';
      title = 'Discharge Summary';
    }
    // Consult Note
    else if (lowerSection.includes('consult') || lowerSection.includes('consultation')) {
      type = 'CONSULT_NOTE';
      confidence = 'medium';
      title = 'Consultation Note';
    }
    // Nursing Note
    else if (lowerSection.includes('nursing')) {
      type = 'NURSING_NOTE';
      confidence = 'medium';
      title = 'Nursing Note';
    }
    // Therapy Note
    else if (
      lowerSection.includes(' pt ') ||
      lowerSection.includes('physical therapy') ||
      lowerSection.includes('occupational therapy') ||
      lowerSection.includes(' ot ')
    ) {
      type = 'THERAPY_NOTE';
      confidence = 'medium';
      title = 'Therapy Note';
    }

    // Get source quote (first 200 chars)
    const sourceQuote = section.substring(0, 200).trim();

    return {
      type,
      date,
      postOpDay,
      title,
      author,
      specialty,
      sourceQuote,
      confidence,
    };
  }

  /**
   * Extract author name from document section
   */
  private extractAuthor(section: string): string | null {
    // Look for patterns like "**👤 Name, MD**" or "Dr. Name"
    const patterns = [
      /\*\*👤\s+([^*]+?),\s*MD\*\*/,
      /\*\*👤\s+([^*]+)\*\*/,
      /Dr\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    ];

    for (const pattern of patterns) {
      const match = section.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract specialty from document section
   */
  private extractSpecialty(section: string): string | null {
    const patterns = [
      /\*\*Specialty:\*\*\s+([^\n]+)/,
      /Specialty:\s+([^\n]+)/,
    ];

    for (const pattern of patterns) {
      const match = section.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Check for common specialties mentioned
    const lowerSection = section.toLowerCase();
    if (lowerSection.includes('neurosurgery')) return 'Neurosurgery';
    if (lowerSection.includes('cardiology')) return 'Cardiology';
    if (lowerSection.includes('radiology')) return 'Radiology';

    return null;
  }

  /**
   * Extract date from document section
   */
  private extractDate(section: string): string | null {
    // Look for dates in various formats
    // This is a simplified extraction - in production, use datePreprocessor
    const datePatterns = [
      /Date of Service:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Encounter Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = section.match(pattern);
      if (match) {
        // Return raw date string - conversion to ISO handled elsewhere
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract post-operative day from document section
   */
  private extractPostOpDay(section: string): number | null {
    const lowerSection = section.toLowerCase();

    // Pattern 1: "POD 5", "POD #5"
    const pod1 = lowerSection.match(/\bpod\s*#?\s*(\d+)/);
    if (pod1) return parseInt(pod1[1], 10);

    // Pattern 2: "5 days post-op", "day 5 post-op"
    const pod2 = lowerSection.match(/(\d+)\s+days?\s+post-?op/);
    if (pod2) return parseInt(pod2[1], 10);

    // Pattern 3: "postoperative day 5"
    const pod3 = lowerSection.match(/postoperative\s+day\s+(\d+)/);
    if (pod3) return parseInt(pod3[1], 10);

    // Pattern 4: "LOS: 1 day 1 Day Post-Op" means POD 1
    const pod4 = lowerSection.match(/los:\s*\d+\s+day\s+(\d+)\s+day\s+post-?op/);
    if (pod4) return parseInt(pod4[1], 10);

    return null;
  }

  /**
   * Analyze POD coverage (expected vs. present)
   */
  private analyzePODCoverage(
    documents: DocumentInstance[],
    surgeryDate: string | null,
    dischargeDate: string | null
  ): PODCoverage {
    // Find present PODs first (needed for fallback logic)
    const presentPODs = documents
      .filter((doc) => doc.type === 'PROGRESS_NOTE' && doc.postOpDay !== null)
      .map((doc) => doc.postOpDay as number)
      .filter((pod, index, self) => self.indexOf(pod) === index) // Unique
      .sort((a, b) => a - b);

    // Calculate expected PODs based on surgery and discharge dates
    const expectedPODs: number[] = [];
    if (surgeryDate && dischargeDate) {
      // CASE 1: Both surgery and discharge dates available (patient discharged)
      const surgeryTime = new Date(surgeryDate).getTime();
      const dischargeTime = new Date(dischargeDate).getTime();
      const daysDiff = Math.floor((dischargeTime - surgeryTime) / (1000 * 60 * 60 * 24));

      // Expected: POD 0 (day of surgery) through discharge day
      for (let i = 0; i <= daysDiff; i++) {
        expectedPODs.push(i);
      }
    } else if (surgeryDate && presentPODs.length > 0) {
      // CASE 2: Surgery date available but no discharge (patient still admitted)
      // Use highest documented POD as fallback - if we have notes up to POD 17,
      // we should expect documentation for all PODs from 0 to 17
      const highestDocumentedPOD = Math.max(...presentPODs);
      for (let i = 0; i <= highestDocumentedPOD; i++) {
        expectedPODs.push(i);
      }
    }
    // CASE 3: No surgery date or no documented PODs - expectedPODs remains empty []

    // Calculate missing PODs
    const missingPODs = expectedPODs.filter((pod) => !presentPODs.includes(pod));

    // Generate human-readable missing ranges
    const missingRanges = this.generatePODRanges(missingPODs);

    // Calculate coverage percentage
    const coveragePercentage = expectedPODs.length > 0
      ? Math.round(((expectedPODs.length - missingPODs.length) / expectedPODs.length) * 100)
      : 100;

    return {
      surgeryDate,
      dischargeDate,
      expectedPODs,
      presentPODs,
      missingPODs,
      missingRanges,
      coveragePercentage,
    };
  }

  /**
   * Generate human-readable POD ranges (e.g., "POD 3-16", "POD 5", "POD 8-10")
   */
  private generatePODRanges(pods: number[]): string[] {
    if (pods.length === 0) return [];

    const sortedPODs = [...pods].sort((a, b) => a - b);
    const ranges: string[] = [];
    let rangeStart = sortedPODs[0];
    let rangeLast = sortedPODs[0];

    for (let i = 1; i < sortedPODs.length; i++) {
      if (sortedPODs[i] === rangeLast + 1) {
        // Continue current range
        rangeLast = sortedPODs[i];
      } else {
        // End current range, start new one
        if (rangeStart === rangeLast) {
          ranges.push(`POD ${rangeStart}`);
        } else {
          ranges.push(`POD ${rangeStart}-${rangeLast}`);
        }
        rangeStart = sortedPODs[i];
        rangeLast = sortedPODs[i];
      }
    }

    // Add final range
    if (rangeStart === rangeLast) {
      ranges.push(`POD ${rangeStart}`);
    } else {
      ranges.push(`POD ${rangeStart}-${rangeLast}`);
    }

    return ranges;
  }

  /**
   * Identify documentation gaps
   */
  private identifyGaps(
    documents: DocumentInstance[],
    podCoverage: PODCoverage
  ): DocumentationGaps {
    const documentTypes = documents.map((doc) => doc.type);

    const missingCritical: DocumentType[] = [];
    const missingImportant: DocumentType[] = [];

    // Check for critical documents
    if (!documentTypes.includes('OPERATIVE_REPORT')) {
      missingCritical.push('OPERATIVE_REPORT');
    }
    if (this.config.requireDischargeSummary && !documentTypes.includes('DISCHARGE_SUMMARY')) {
      missingCritical.push('DISCHARGE_SUMMARY');
    }

    // Check for important documents
    if (this.config.requireAdmissionHP && !documentTypes.includes('ADMISSION_HP')) {
      missingImportant.push('ADMISSION_HP');
    }

    return {
      missingCritical,
      missingImportant,
      missingPODCount: podCoverage.missingPODs.length,
      missingPODRanges: podCoverage.missingRanges,
      totalGapDays: podCoverage.missingPODs.length,
    };
  }

  /**
   * Calculate overall completeness score (0-100)
   */
  private calculateCompletenessScore(
    documents: DocumentInstance[],
    podCoverage: PODCoverage,
    gaps: DocumentationGaps
  ): number {
    let score = 100;

    // Deduct for missing critical documents (40 points each)
    score -= gaps.missingCritical.length * 40;

    // Deduct for missing important documents (20 points each)
    score -= gaps.missingImportant.length * 20;

    // Deduct for POD coverage (up to 40 points based on coverage %)
    const podPenalty = Math.round((100 - podCoverage.coveragePercentage) * 0.4);
    score -= podPenalty;

    return Math.max(0, score);
  }

  /**
   * Generate completeness warnings
   */
  private generateWarnings(
    documents: DocumentInstance[],
    podCoverage: PODCoverage,
    gaps: DocumentationGaps
  ): string[] {
    const warnings: string[] = [];

    // Critical gaps
    if (gaps.missingCritical.length > 0) {
      warnings.push(
        `CRITICAL: Missing ${gaps.missingCritical.join(', ')}. These documents are required for complete discharge summary.`
      );
    }

    // Important gaps
    if (gaps.missingImportant.length > 0) {
      warnings.push(
        `IMPORTANT: Missing ${gaps.missingImportant.join(', ')}. These documents provide important context for patient care.`
      );
    }

    // POD gaps
    if (gaps.missingPODCount > 0) {
      warnings.push(
        `POD Coverage: ${podCoverage.coveragePercentage}% - Missing ${gaps.missingPODCount} progress notes (${gaps.missingPODRanges.join(', ')}). This represents a ${gaps.totalGapDays}-day documentation gap.`
      );
    }

    // Low POD coverage warning
    if (podCoverage.coveragePercentage < this.config.minPODCoveragePercent) {
      warnings.push(
        `POD coverage (${podCoverage.coveragePercentage}%) is below minimum threshold (${this.config.minPODCoveragePercent}%). Daily progress notes are critical for continuity of care.`
      );
    }

    return warnings;
  }
}
