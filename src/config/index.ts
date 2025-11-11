/**
 * NSXDC Configuration
 * Environment-based configuration with secure defaults
 */

import { config } from 'dotenv';
import { LLMConfig, OrchestratorConfig, DEFAULT_ORCHESTRATOR_CONFIG } from '../types/index.js';

// Load environment variables
config();

/**
 * Validate required environment variables
 */
function validateEnv(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
}

/**
 * Get LLM configuration from environment
 */
export function getLLMConfig(): LLMConfig {
  validateEnv();

  return {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: process.env.MODEL || 'claude-sonnet-4-5-20250929',
    maxTokens: 16384, // Increased to 16K for very long clinical notes (handles ~65K words)
    temperature: 0,
    enableCaching: process.env.ENABLE_CACHING !== 'false', // Default: true
  };
}

/**
 * Get orchestrator configuration from environment
 * FORCE_VALIDATED_MODE and FORCE_VALIDATION cannot be disabled
 */
export function getOrchestratorConfig(): OrchestratorConfig {
  const forceValidated = process.env.FORCE_VALIDATED_MODE !== 'false';
  const forceValidation = process.env.FORCE_VALIDATION !== 'false';

  // Log warnings if someone tries to disable
  if (process.env.FORCE_VALIDATED_MODE === 'false') {
    console.warn('⚠️  WARNING: FORCE_VALIDATED_MODE=false detected. Ignoring - VALIDATED mode is enforced for safety.');
  }
  if (process.env.FORCE_VALIDATION === 'false') {
    console.warn('⚠️  WARNING: FORCE_VALIDATION=false detected. Ignoring - QA validation is enforced for safety.');
  }

  return {
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    // These are ENFORCED and cannot be disabled
    extractionMode: 'VALIDATED',
    forceValidation: true,
    enableCaching: process.env.ENABLE_CACHING !== 'false',
  };
}

/**
 * Get server configuration
 */
export function getServerConfig() {
  return {
    port: parseInt(process.env.PORT || '3002', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

/**
 * Get application metadata
 */
export function getAppMetadata() {
  return {
    name: 'NSXDC',
    version: '1.0.0',
    description: 'Neurosurgical Discharge Summarizer - Always-ON Validation',
    features: {
      validatedExtraction: true,
      qaValidation: true,
      interactiveDashboard: true,
      dischargeStatusDeduction: true,
    },
  };
}
