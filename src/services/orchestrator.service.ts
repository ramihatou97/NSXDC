/**
 * Orchestrator Service
 * Coordinates extraction pipeline with VALIDATED mode and QA validation ALWAYS ON
 */

import { LLMService } from './llm.service.js';
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

  constructor(llmService: LLMService, config: OrchestratorConfig) {
    this.llmService = llmService;
    this.config = config;

    // Log enforcement
    console.log('🔒 NSXDC Orchestrator initialized with ENFORCED settings:');
    console.log(`   - Extraction Mode: ${this.config.extractionMode} (LOCKED)`);
    console.log(`   - QA Validation: ${this.config.forceValidation ? 'ALWAYS ON (LOCKED)' : 'OFF'}`);
    console.log(`   - Prompt Caching: ${this.config.enableCaching ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Run complete extraction pipeline
   * Validation is ALWAYS performed (cannot be disabled)
   */
  async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Extract structured data (VALIDATED mode)
      console.log('🔍 Step 1: Extracting structured data (VALIDATED mode)...');
      const extraction = await this.performExtraction(request.clinicalNotes);

      // Steps 2 & 3: Generate narrative (if requested) and validate in parallel
      let narrative: string | undefined;
      let narrativeTokens = { input: 0, output: 0 };
      let validation: ValidationResult;

      if (request.narrativeMode) {
        console.log(`📝 Step 2 & 3: Running narrative generation and validation in parallel...`);

        // Run narrative and extraction-only validation in parallel for speed
        const [narrativeResult, validationResult] = await Promise.all([
          this.performNarrative(extraction.data, request.narrativeMode),
          this.performValidation(request.clinicalNotes, extraction.data, undefined)
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
          undefined
        );
      }

      // Build response
      const response: ExtractionResponse = {
        success: true,
        extraction: extraction.data,
        narrative,
        validation, // Always present
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
  private async performExtraction(clinicalNotes: string): Promise<{
    data: Record<string, any>;
    tokens: { input: number; output: number; cached?: number };
  }> {
    // Build prompt
    const systemPrompt = buildExtractionPrompt(clinicalNotes);

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
    };

    // Call LLM
    const llmResponse = await this.llmService.sendWithRetry(llmRequest);

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
    };

    // Call LLM
    const llmResponse = await this.llmService.sendWithRetry(llmRequest);

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
    narrative?: string
  ): Promise<ValidationResult> {
    // Build validation prompt
    const systemPrompt = buildValidationPrompt(originalNotes, extractedData, narrative);

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
