/**
 * LLM Service
 * Handles all interactions with Anthropic Claude API
 * Includes prompt caching, retry logic, and error handling
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, LLMRequest, LLMResponse } from '../types/index.js';

export class LLMService {
  private client: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  /**
   * Send request to Claude with retry logic
   */
  async sendWithRetry(request: LLMRequest, maxRetries: number = 3): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.send(request);
      } catch (error) {
        lastError = error as Error;
        console.error(`LLM request attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`LLM request failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Send request to Claude
   */
  private async send(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: request.maxTokens || this.config.maxTokens || 8000,
      temperature: request.temperature ?? this.config.temperature ?? 0,
      system: request.system,
      messages: request.messages,
    });

    // Extract text content
    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: (response.usage as any).cache_read_input_tokens,
        cacheCreationTokens: (response.usage as any).cache_creation_input_tokens,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
}
