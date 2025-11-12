/**
 * Progress Slice - Manages real-time extraction progress via SSE
 * Handles progress events, job tracking, and cancellation
 */

import type { StateCreator } from 'zustand';
import type { ProgressEvent, ProgressStage } from '../../types';
import APIClient from '../../services/api-client';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface ProgressSlice {
  // Progress data
  currentJobId: string | null;
  currentProgress: ProgressEvent | null;
  progressHistory: ProgressEvent[];

  // SSE connection
  eventSource: EventSource | null;

  // Actions
  connectProgress: (jobId: string) => void;
  disconnectProgress: () => void;
  cancelJob: (jobId: string) => Promise<void>;
  clearProgress: () => void;

  // Internal handlers (not meant to be called directly)
  _handleProgressEvent: (event: ProgressEvent) => void;
  _handleProgressError: (error: Error) => void;
  _handleProgressComplete: () => void;
}

// ============================================================================
// SLICE IMPLEMENTATION
// ============================================================================

export const createProgressSlice: StateCreator<
  ProgressSlice,
  [],
  [],
  ProgressSlice
> = (set, get) => ({
  // Initial state
  currentJobId: null,
  currentProgress: null,
  progressHistory: [],
  eventSource: null,

  // Connect to progress stream
  connectProgress: (jobId: string) => {
    // Disconnect existing connection if any
    const { eventSource, disconnectProgress } = get();
    if (eventSource) {
      disconnectProgress();
    }

    // Set job ID
    set({
      currentJobId: jobId,
      progressHistory: [],
      currentProgress: null,
    });

    // Create new EventSource connection
    const newEventSource = APIClient.connectProgressStream(
      jobId,
      get()._handleProgressEvent,
      get()._handleProgressError,
      get()._handleProgressComplete
    );

    set({ eventSource: newEventSource });
  },

  // Disconnect from progress stream
  disconnectProgress: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }

    set({
      eventSource: null,
      currentJobId: null,
    });
  },

  // Cancel job
  cancelJob: async (jobId: string) => {
    try {
      await APIClient.cancelExtraction(jobId);

      // Disconnect progress stream
      get().disconnectProgress();

      // Clear progress
      set({
        currentProgress: null,
        currentJobId: null,
      });
    } catch (err) {
      // If cancellation fails, still disconnect
      get().disconnectProgress();
      throw err;
    }
  },

  // Clear progress
  clearProgress: () => {
    get().disconnectProgress();
    set({
      currentProgress: null,
      progressHistory: [],
      currentJobId: null,
    });
  },

  // Handle progress event (internal)
  _handleProgressEvent: (event: ProgressEvent) => {
    const { progressHistory } = get();

    set({
      currentProgress: event,
      progressHistory: [...progressHistory, event],
    });

    // If completed/failed/cancelled, disconnect after a short delay
    if (['completed', 'failed', 'cancelled'].includes(event.stage)) {
      setTimeout(() => {
        const { disconnectProgress } = get();
        disconnectProgress();
      }, 1000); // 1 second delay to allow final event to be processed
    }
  },

  // Handle progress error (internal)
  _handleProgressError: (error: Error) => {
    console.error('Progress stream error:', error);

    // Disconnect on error
    get().disconnectProgress();
  },

  // Handle progress complete (internal)
  _handleProgressComplete: () => {
    // This is called when the SSE connection closes normally
    // No action needed, state is already updated via _handleProgressEvent
  },
});
