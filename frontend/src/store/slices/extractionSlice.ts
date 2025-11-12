/**
 * Extraction Slice - Manages current extraction state
 * Handles extraction requests, loading states, errors, and results
 */

import type { StateCreator } from 'zustand';
import type {
  ExtractionRequest,
  ExtractionResponse,
  ExtractionResult,
} from '../../types';
import APIClient, { APIError } from '../../services/api-client';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface ExtractionSlice {
  // Current extraction state
  currentExtraction: ExtractionResult | null;
  isLoading: boolean;
  error: string | null;

  // Request metadata
  lastRequest: ExtractionRequest | null;
  lastRequestTimestamp: string | null;

  // Actions
  extract: (request: ExtractionRequest) => Promise<void>;
  clearExtraction: () => void;
  clearError: () => void;
  setError: (error: string) => void;
}

// ============================================================================
// SLICE IMPLEMENTATION
// ============================================================================

export const createExtractionSlice: StateCreator<
  ExtractionSlice,
  [],
  [],
  ExtractionSlice
> = (set, get) => ({
  // Initial state
  currentExtraction: null,
  isLoading: false,
  error: null,
  lastRequest: null,
  lastRequestTimestamp: null,

  // Extract action
  extract: async (request: ExtractionRequest) => {
    // Set loading state
    set({
      isLoading: true,
      error: null,
      lastRequest: request,
      lastRequestTimestamp: new Date().toISOString(),
    });

    try {
      // Call API
      const data = await APIClient.extract(request);

      // Transform to frontend format
      const result: ExtractionResult = {
        extraction: data.extraction || {},
        narrative: data.narrative,
        validation: {
          overallConfidence: data.validation?.score || 0,
          passed: data.validation?.passed || false,
          score: data.validation?.score || 0,
        },
        warnings: data.validation?.issues
          ?.filter(issue => issue.severity === 'major' || issue.severity === 'critical')
          .map(issue => `${issue.severity.toUpperCase()}: ${issue.message}`) || [],
      };

      // Update state with result
      set({
        currentExtraction: result,
        isLoading: false,
        error: null,
      });

      // Log success to server
      await APIClient.logError({
        message: 'Extraction completed successfully',
        context: {
          component: 'ExtractionSlice',
          action: 'extract',
          success: true,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {
        // Silently fail if logging fails
      });
    } catch (err) {
      // Handle errors
      let errorMessage = 'An unexpected error occurred';

      if (err instanceof APIError) {
        errorMessage = `API Error: ${err.message}${err.code ? ` (${err.code})` : ''}`;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      set({
        error: errorMessage,
        isLoading: false,
        currentExtraction: null,
      });

      // Log error to server
      if (err instanceof Error) {
        await APIClient.logError({
          message: err.message,
          stack: err.stack,
          context: {
            component: 'ExtractionSlice',
            action: 'extract',
            request: request.clinicalNotes.substring(0, 200), // First 200 chars only
          },
        }).catch(() => {
          // Silently fail if error logging fails
        });
      }

      // Re-throw for caller to handle if needed
      throw err;
    }
  },

  // Clear extraction
  clearExtraction: () => {
    set({
      currentExtraction: null,
      error: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Set error
  setError: (error: string) => {
    set({ error });
  },
});
