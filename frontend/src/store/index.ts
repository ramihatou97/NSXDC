/**
 * Main Zustand Store
 * Combines all slices into a single store with persistence middleware
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  createExtractionSlice,
  type ExtractionSlice,
} from './slices/extractionSlice';
import {
  createHistorySlice,
  type HistorySlice,
} from './slices/historySlice';
import {
  createCacheSlice,
  type CacheSlice,
} from './slices/cacheSlice';
import {
  createProgressSlice,
  type ProgressSlice,
} from './slices/progressSlice';
import {
  createUISlice,
  type UISlice,
} from './slices/uiSlice';

// ============================================================================
// STORE TYPE
// ============================================================================

export type Store = ExtractionSlice & HistorySlice & CacheSlice & ProgressSlice & UISlice;

// ============================================================================
// STORE CREATION
// ============================================================================

/**
 * Main application store combining all slices
 * Uses persistence middleware for UI preferences
 */
export const useStore = create<Store>()(
  persist(
    (...a) => ({
      ...createExtractionSlice(...a),
      ...createHistorySlice(...a),
      ...createCacheSlice(...a),
      ...createProgressSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'nsxdc-storage', // LocalStorage key
      storage: createJSONStorage(() => localStorage),

      // Only persist UI preferences, not transient data
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        pageSize: state.pageSize,
      }),
    }
  )
);

// ============================================================================
// EXPORTS
// ============================================================================

// Export slice types for use in components
export type {
  ExtractionSlice,
  HistorySlice,
  CacheSlice,
  ProgressSlice,
  UISlice,
};

// Export store hook
export default useStore;
