/**
 * Orchestrator Service
 * Coordinates extraction pipeline with VALIDATED mode and QA validation ALWAYS ON
 */

import { LLMService } from './llm.service.js';
import { DatePreprocessorEnhancedService } from './date-preprocessor-enhanced.service.js';
import { DocumentationInventoryService } from './documentation-inventory.service.js';
import { CompletenessCheckerService } from './completeness-checker.service.js';
import { buildExtractionPrompt } from '../prompts/extraction.js';
import { buildNarrativePrompt } from '../prompts/narrative.js';
import { buildValidationPrompt } from '../prompts/validation.js';
import { jsonrepair } from 'jsonrepair';
import type {
  ExtractionRequest,
  ExtractionResponse,
  OrchestratorConfig,
  ValidationResult,
} from '../types/index.js';

export class OrchestratorService {
  private llmService: LLMService;
  private config: OrchestratorConfig;
  private datePreprocessor: DatePreprocessorEnhancedService;
  private documentationInventory: DocumentationInventoryService;
  private completenessChecker: CompletenessCheckerService;

  constructor(llmService: LLMService, config: OrchestratorConfig) {
    this.llmService = llmService;
    this.config = config;
    this.datePreprocessor = new DatePreprocessorEnhancedService();
    this.documentationInventory = new DocumentationInventoryService({
      requireAdmissionHP: true,
      requireDischargeSummary: true,
      minPODCoveragePercent: 80,
    });
    this.completenessChecker = new CompletenessCheckerService();

    // Log enforcement
    console.log('🔒 NSXDC Orchestrator initialized with ENFORCED settings:');
    console.log(`   - Extraction Mode: ${this.config.extractionMode} (LOCKED)`);
    console.log(`   - QA Validation: ${this.config.forceValidation ? 'ALWAYS ON (LOCKED)' : 'OFF'}`);
    console.log(`   - Prompt Caching: ${this.config.enableCaching ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Completeness Checking: ENABLED (Phase 8)`);
  }

  /**
   * Calculate optimal max_tokens based on input size and task type (Phase 3)
   * Prevents truncation by estimating required output tokens
   */
  private calculateAdaptiveMaxTokens(
    inputText: string,
    taskType: 'extraction' | 'narrative' | 'validation'
  ): number {
    // Estimate input tokens (roughly 4 characters per token)
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

    // Calculate output tokens needed based on task type
    let outputMultiplier: number;
    let minTokens: number;

    switch (taskType) {
      case 'extraction':
        // Extraction produces structured JSON with extensive grounding metadata
        // v1.2.0: Each field has value + sourceQuote + sourceContext + confidence + deductionMethod + warnings
        // For large documents (18K+ tokens), output can equal or exceed input size
        outputMultiplier = 1.0; // 100% of input size to accommodate full grounding structure
        minTokens = 12000; // Minimum for structured extraction with Phase 4+ enhancements
        break;
      case 'narrative':
        // Narrative is prose summary (~30-40% of input size)
        outputMultiplier = 0.4;
        minTokens = 2000; // Minimum for coherent narrative
        break;
      case 'validation':
        // Validation is analysis report (~20-30% of input size)
        outputMultiplier = 0.3;
        minTokens = 1500; // Minimum for validation report
        break;
    }

    // Calculate base output tokens
    let outputTokens = Math.ceil(estimatedInputTokens * outputMultiplier);

    // Ensure minimum
    outputTokens = Math.max(outputTokens, minTokens);

    // Add 30% safety buffer (v1.1.0: increased from 20% to handle large comprehensive notes)
    outputTokens = Math.ceil(outputTokens * 1.3);

    // Cap at 24000 tokens (v1.2.0: increased to handle extensive grounding metadata for large documents)
    // Claude Sonnet 4.5 supports up to 200K context, leaving ample room for 24K output
    outputTokens = Math.min(outputTokens, 24000);

    console.log(`📊 Adaptive Token Allocation (${taskType}):`);
    console.log(`   - Estimated input: ~${estimatedInputTokens} tokens`);
    console.log(`   - Allocated output: ${outputTokens} tokens`);

    return outputTokens;
  }

  /**
   * Run complete extraction pipeline
   * Validation is ALWAYS performed (cannot be disabled)
   */
  async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    const startTime = Date.now();

    try {
      // Step 0: Preprocess dates (Week 1 Day 2 - Enhanced Date Preprocessing)
      console.log('📅 Step 0: Preprocessing dates with enhanced analysis...');
      const preprocessResult = this.datePreprocessor.preprocessDates(request.clinicalNotes);

      const keyDates = this.datePreprocessor.getKeyDates(preprocessResult);
      
      console.log(`   ✓ Total dates found: ${preprocessResult.summary.totalDates}`);
      console.log(`   ✓ Average confidence: ${(preprocessResult.summary.avgConfidence * 100).toFixed(1)}%`);
      console.log(`   ✓ Key dates: Admission=${keyDates.admission?.normalized || 'N/A'}, Discharge=${keyDates.discharge?.normalized || 'N/A'}, Surgery=${keyDates.surgery?.normalized || 'N/A'}`);
      console.log(`   ✓ Validation: ${preprocessResult.validation.isValid ? 'PASS' : 'FAIL'} (${preprocessResult.validation.errors.length} errors, ${preprocessResult.validation.warnings.length} warnings)`);
      if (preprocessResult.validation.lengthOfStay) {
        console.log(`   ✓ Length of stay: ${preprocessResult.validation.lengthOfStay} days`);
      }
      console.log(`   ✓ Preprocessing warnings: ${preprocessResult.warnings.length}`);

      // Step 1: Extract structured data (VALIDATED mode)
      console.log('🔍 Step 1: Extracting structured data (VALIDATED mode)...');
      const extraction = await this.performExtraction(request);

      // Step 1.5: Analyze documentation inventory (Phase 2 - Gap Detection)
      console.log('📋 Step 1.5: Analyzing documentation inventory for gaps...');

      // Extract date values from GroundedValue objects (extraction returns {value, sourceQuote, ...})
      const surgeryDateValue = extraction.data.surgeryDate?.value || null;
      const dischargeDateValue = extraction.data.dischargeDate?.value || null;

      const inventoryResult = this.documentationInventory.analyze(
        request.clinicalNotes,
        surgeryDateValue,
        dischargeDateValue
      );

      console.log(`   ✓ Documents detected: ${inventoryResult.documents.length}`);
      console.log(`   ✓ POD coverage: ${inventoryResult.podCoverage.coveragePercentage}% (${inventoryResult.podCoverage.presentPODs.length}/${inventoryResult.podCoverage.expectedPODs.length} PODs)`);
      console.log(`   ✓ Missing PODs: ${inventoryResult.podCoverage.missingPODs.length}`);
      console.log(`   ✓ Completeness score: ${inventoryResult.completenessScore}/100`);
      console.log(`   ✓ Warnings generated: ${inventoryResult.warnings.length}`);

      // Step 1.75: Pre-extraction completeness check (Phase 8)
      console.log('✅ Step 1.75: Running pre-extraction completeness check (Phase 8)...');
      const preExtractionChecklist = this.completenessChecker.preExtractionCheck(
        request.clinicalNotes,
        inventoryResult
      );

      console.log(`   ✓ Readiness score: ${preExtractionChecklist.readinessScore}/100`);
      console.log(`   ✓ Checks passed: ${preExtractionChecklist.checks.filter(c => c.passed).length}/${preExtractionChecklist.checks.length}`);
      console.log(`   ✓ Critical blockers: ${preExtractionChecklist.blockers.length}`);
      console.log(`   ✓ Warnings: ${preExtractionChecklist.warnings.length}`);

      if (!preExtractionChecklist.overallReady) {
        console.warn(`⚠️  PRE-EXTRACTION READINESS WARNING: ${preExtractionChecklist.blockers.length} critical blocker(s) detected`);
        for (const blocker of preExtractionChecklist.blockers) {
          console.warn(`   - ${blocker.message}`);
          if (blocker.recommendation) {
            console.warn(`     → ${blocker.recommendation}`);
          }
        }
      }

      // Step 1.9: Post-extraction completeness check (Phase 8)
      console.log('✅ Step 1.9: Running post-extraction completeness check (Phase 8)...');
      const postExtractionChecklist = this.completenessChecker.postExtractionCheck(
        extraction.data,
        inventoryResult
      );

      console.log(`   ✓ Completeness score: ${postExtractionChecklist.completenessScore}/100`);
      console.log(`   ✓ Checks passed: ${postExtractionChecklist.checks.filter(c => c.passed).length}/${postExtractionChecklist.checks.length}`);
      console.log(`   ✓ Critical issues: ${postExtractionChecklist.criticalIssues.length}`);
      console.log(`   ✓ Major issues: ${postExtractionChecklist.majorIssues.length}`);
      console.log(`   ✓ Minor issues: ${postExtractionChecklist.minorIssues.length}`);

      if (!postExtractionChecklist.overallComplete) {
        console.warn(`⚠️  POST-EXTRACTION COMPLETENESS WARNING: ${postExtractionChecklist.criticalIssues.length} critical + ${postExtractionChecklist.majorIssues.length} major issue(s) detected`);
        for (const issue of [...postExtractionChecklist.criticalIssues, ...postExtractionChecklist.majorIssues].slice(0, 5)) {
          console.warn(`   - ${issue.message}`);
          if (issue.recommendation) {
            console.warn(`     → ${issue.recommendation}`);
          }
        }
      }

      // Steps 2 & 3: Generate narrative (if requested) and validate in parallel
      let narrative: string | undefined;
      let narrativeTokens = { input: 0, output: 0 };
      let validation: ValidationResult;

      if (request.narrativeMode) {
        console.log(`📝 Step 2 & 3: Running narrative generation and validation in parallel...`);

        // Run narrative and extraction-only validation in parallel for speed
        const [narrativeResult, validationResult] = await Promise.all([
          this.performNarrative(extraction.data, request.narrativeMode),
          this.performValidation(request.clinicalNotes, extraction.data, undefined, inventoryResult)
        ]);

        narrative = narrativeResult.narrative;
        narrativeTokens = narrativeResult.tokens;
        validation = validationResult;

        console.log(`   ✓ Narrative generated (${request.narrativeMode} mode)`);
        console.log(`   ✓ Extraction validated (parallel execution)`);
      } else {
        // Step 3: ALWAYS validate (enforced)
        console.log('✅ Step 3: Running QA validation (ALWAYS ON)...');
        validation = await this.performValidation(
          request.clinicalNotes,
          extraction.data,
          undefined,
          inventoryResult
        );
      }

      // Build response
      const response: ExtractionResponse = {
        success: true,
        extraction: extraction.data,
        narrative,
        validation, // Always present
        datePreprocessing: {
          detectedFormat: 'AUTO', // Enhanced service auto-detects multiple formats
          confidence: preprocessResult.summary.avgConfidence >= 0.75 ? 'high' : 
                     preprocessResult.summary.avgConfidence >= 0.50 ? 'medium' : 'low',
          conversionsCount: preprocessResult.parsedDates.length,
          ambiguousDatesCount: preprocessResult.parsedDates.filter(d => d.warnings.length > 0).length,
          warnings: preprocessResult.warnings,
        },
        documentationInventory: {
          documents: inventoryResult.documents,
          podCoverage: inventoryResult.podCoverage,
          gaps: inventoryResult.gaps,
          completenessScore: inventoryResult.completenessScore,
          warnings: inventoryResult.warnings,
        },
        completenessCheck: {
          preExtraction: preExtractionChecklist,
          postExtraction: postExtractionChecklist,
        },
        metadata: {
          extractionMode: 'VALIDATED', // Always VALIDATED
          narrativeMode: request.narrativeMode,
          modelUsed: this.llmService.getConfig().model,
          tokenCount: {
            input: extraction.tokens.input + narrativeTokens.input,
            output: extraction.tokens.output + narrativeTokens.output,
            cached: extraction.tokens.cached,
          },
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

      console.log(`✨ Extraction complete in ${response.metadata.processingTime}ms`);
      console.log(`   - Date Format Detected: ${response.datePreprocessing?.detectedFormat} (${response.datePreprocessing?.confidence} confidence)`);
      console.log(`   - Ambiguous Dates: ${response.datePreprocessing?.ambiguousDatesCount}`);
      console.log(`   - Date Warnings: ${response.datePreprocessing?.warnings.length}`);
      console.log(`   - Documentation Completeness: ${response.documentationInventory?.completenessScore}/100`);
      console.log(`   - POD Coverage: ${response.documentationInventory?.podCoverage.coveragePercentage}%`);
      console.log(`   - Documentation Warnings: ${response.documentationInventory?.warnings.length}`);
      console.log(`   - Pre-Extraction Readiness: ${response.completenessCheck?.preExtraction.readinessScore}/100 (${response.completenessCheck?.preExtraction.blockers.length} blockers)`);
      console.log(`   - Post-Extraction Completeness: ${response.completenessCheck?.postExtraction.completenessScore}/100 (${response.completenessCheck?.postExtraction.criticalIssues.length} critical, ${response.completenessCheck?.postExtraction.majorIssues.length} major)`);
      console.log(`   - Validation Score: ${validation.score}/100`);
      console.log(`   - Issues Found: ${validation.issues.length}`);

      return response;
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      return {
        success: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: (error as Error).message,
          details: error,
        },
        metadata: {
          extractionMode: 'VALIDATED',
          narrativeMode: request.narrativeMode,
          modelUsed: this.llmService.getConfig().model,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Perform extraction step
   */
  private async performExtraction(request: ExtractionRequest): Promise<{
    data: Record<string, any>;
    tokens: { input: number; output: number; cached?: number };
  }> {
    // Build prompt with date format configuration
    const systemPrompt = buildExtractionPrompt(request.clinicalNotes, {
      dateFormat: request.dateFormat,
      dateFormatHints: request.dateFormatHints,
      regionLocale: request.regionLocale,
    });

    // Phase 3: Calculate adaptive max_tokens to prevent truncation
    const maxTokens = this.calculateAdaptiveMaxTokens(request.clinicalNotes, 'extraction');

    // Build LLM request with caching
    const llmRequest = {
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          ...(this.config.enableCaching ? { cache_control: { type: 'ephemeral' as const } } : {}),
        },
      ],
      messages: [
        {
          role: 'user' as const,
          content: 'Extract the clinical data from the notes provided in the system prompt.',
        },
      ],
      maxTokens, // Phase 3: Adaptive token allocation
    };

    // Call LLM
    const llmResponse = await this.llmService.sendWithRetry(llmRequest);

    // Phase 3: Check for truncation
    if (llmResponse.truncationWarning) {
      console.warn(`⚠️  ${llmResponse.truncationWarning}`);
    }
    if (llmResponse.truncated) {
      const errorMsg = `Clinical notes too long for processing. Output truncated at ${llmResponse.usage.outputTokens} tokens. Please contact support for assistance with very long documents.`;
      console.error(`🚨 EXTRACTION TRUNCATED: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Parse JSON from response
    let extractedData: any;
    try {
      extractedData = this.extractJSON(llmResponse.content);
    } catch (error) {
      console.error('Failed to parse extraction JSON, attempting repair...', error);
      // Try to repair JSON
      try {
        const repaired = jsonrepair(llmResponse.content);
        extractedData = JSON.parse(repaired);
        console.log('✓ JSON successfully repaired');
      } catch (repairError) {
        throw new Error(`Failed to parse and repair extraction JSON: ${(error as Error).message}`);
      }
    }

    return {
      data: extractedData,
      tokens: {
        input: llmResponse.usage.inputTokens,
        output: llmResponse.usage.outputTokens,
        cached: llmResponse.usage.cacheReadTokens,
      },
    };
  }

  /**
   * Perform narrative generation step
   */
  private async performNarrative(
    extractedData: Record<string, any>,
    mode: any
  ): Promise<{
    narrative: string;
    tokens: { input: number; output: number };
  }> {
    // Build prompt
    const systemPrompt = buildNarrativePrompt(extractedData, mode);

    // Phase 3: Calculate adaptive max_tokens based on extracted data size
    const extractedDataText = JSON.stringify(extractedData);
    const maxTokens = this.calculateAdaptiveMaxTokens(extractedDataText, 'narrative');

    // Build LLM request with caching
    const llmRequest = {
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          ...(this.config.enableCaching ? { cache_control: { type: 'ephemeral' as const } } : {}),
        },
      ],
      messages: [
        {
          role: 'user' as const,
          content: 'Generate the narrative discharge summary from the extracted data provided in the system prompt.',
        },
      ],
      maxTokens, // Phase 3: Adaptive token allocation
    };

    // Call LLM
    const llmResponse = await this.llmService.sendWithRetry(llmRequest);

    // Phase 3: Check for truncation
    if (llmResponse.truncationWarning) {
      console.warn(`⚠️  ${llmResponse.truncationWarning}`);
    }
    if (llmResponse.truncated) {
      const errorMsg = `Narrative generation truncated at ${llmResponse.usage.outputTokens} tokens. Summary is incomplete. Please contact support.`;
      console.error(`🚨 NARRATIVE TRUNCATED: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return {
      narrative: llmResponse.content,
      tokens: {
        input: llmResponse.usage.inputTokens,
        output: llmResponse.usage.outputTokens,
      },
    };
  }

  /**
   * Perform validation step (ALWAYS runs)
   */
  private async performValidation(
    originalNotes: string,
    extractedData: Record<string, any>,
    narrative?: string,
    documentationInventory?: any
  ): Promise<ValidationResult> {
    // Build validation prompt with documentation inventory (Phase 2)
    const systemPrompt = buildValidationPrompt(
      originalNotes,
      extractedData,
      narrative,
      documentationInventory
    );

    // Phase 3: Calculate adaptive max_tokens based on input size
    // Validation analyzes both original notes and extracted data
    const combinedInput = originalNotes + JSON.stringify(extractedData) + (narrative || '');
    const maxTokens = this.calculateAdaptiveMaxTokens(combinedInput, 'validation');

    // Build LLM request with caching
    const llmRequest = {
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          ...(this.config.enableCaching ? { cache_control: { type: 'ephemeral' as const } } : {}),
        },
      ],
      messages: [
        {
          role: 'user' as const,
          content: 'Perform comprehensive validation and return the JSON validation report.',
        },
      ],
      maxTokens, // Phase 3: Adaptive token allocation
    };

    // Call LLM
    const llmResponse = await this.llmService.sendWithRetry(llmRequest);

    // Parse validation JSON
    let validationResult: any;
    try {
      validationResult = this.extractJSON(llmResponse.content);
    } catch (error) {
      console.error('Failed to parse validation JSON:', error);
      return {
        passed: false,
        score: 0,
        issues: [
          {
            severity: 'critical',
            category: 'grounding',
            message: 'Failed to parse validation response',
            details: (error as Error).message,
          },
        ],
      };
    }

    // Transform validation result to match UI expectations
    return this.transformValidationResult(validationResult, !!narrative);
  }

  /**
   * Transform validation result from nested structure to flat structure
   */
  private transformValidationResult(validationResult: any, hasNarrative: boolean): ValidationResult {
    // Handle combined validation (has both extraction and narrative)
    if (validationResult.extraction && validationResult.overall) {
      const allIssues = [
        ...(validationResult.extraction.issues || []),
        ...(validationResult.narrative?.issues || []),
      ];

      return {
        passed: validationResult.overall.isValid,
        score: validationResult.overall.score,
        issues: allIssues,
        details: {
          extraction: {
            passed: validationResult.extraction.isValid,
            score: validationResult.extraction.score,
            issueCount: validationResult.extraction.issues?.length || 0,
          },
          narrative: hasNarrative
            ? {
                passed: validationResult.narrative.isValid,
                score: validationResult.narrative.score,
                issueCount: validationResult.narrative.issues?.length || 0,
              }
            : undefined,
          summary: validationResult.overall.summary,
        },
      };
    }

    // Handle extraction-only validation
    if (validationResult.isValid !== undefined) {
      return {
        passed: validationResult.isValid,
        score: validationResult.score || 0,
        issues: validationResult.issues || [],
      };
    }

    // Fallback
    console.warn('Unexpected validation result structure:', validationResult);
    return {
      passed: false,
      score: 0,
      issues: [
        {
          severity: 'critical',
          category: 'grounding',
          message: 'Unexpected validation result structure',
        },
      ],
    };
  }

  /**
   * Extract JSON from text (handles markdown code blocks)
   */
  private extractJSON(text: string): any {
    // Remove markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
    }

    // Try to parse
    try {
      return JSON.parse(text);
    } catch (error) {
      // Try to find JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in response');
    }
  }
}
