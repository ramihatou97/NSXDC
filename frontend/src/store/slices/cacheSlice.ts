/**
 * Cache Slice - Manages cache statistics and operations
 * Handles cache stats, clearing, and type-specific operations
 */

import type { StateCreator } from 'zustand';
import type { CacheStats, CacheType } from '../../types';
import APIClient from '../../services/api-client';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface CacheSlice {
  // Cache data
  cacheStats: CacheStats | null;

  // Loading states
  isLoadingCache: boolean;
  cacheError: string | null;

  // Actions
  loadCacheStats: () => Promise<void>;
  clearCache: () => Promise<{ clearedCount: number }>;
  clearCacheByType: (type: CacheType) => Promise<{ clearedCount: number }>;
  refreshCacheStats: () => Promise<void>;
}

// ============================================================================
// SLICE IMPLEMENTATION
// ============================================================================

export const createCacheSlice: StateCreator<
  CacheSlice,
  [],
  [],
  CacheSlice
> = (set, get) => ({
  // Initial state
  cacheStats: null,
  isLoadingCache: false,
  cacheError: null,

  // Load cache stats
  loadCacheStats: async () => {
    set({ isLoadingCache: true, cacheError: null });

    try {
      const stats = await APIClient.getCacheStats();
      set({
        cacheStats: stats,
        isLoadingCache: false,
        cacheError: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cache stats';
      set({
        cacheError: errorMessage,
        isLoadingCache: false,
      });
      throw err;
    }
  },

  // Clear all cache
  clearCache: async () => {
    set({ isLoadingCache: true, cacheError: null });

    try {
      const result = await APIClient.clearCache();

      // Reload stats after clearing
      const { loadCacheStats } = get();
      await loadCacheStats();

      return { clearedCount: result.clearedCount };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache';
      set({
        cacheError: errorMessage,
        isLoadingCache: false,
      });
      throw err;
    }
  },

  // Clear cache by type
  clearCacheByType: async (type: CacheType) => {
    set({ isLoadingCache: true, cacheError: null });

    try {
      const result = await APIClient.clearCacheByType(type);

      // Reload stats after clearing
      const { loadCacheStats } = get();
      await loadCacheStats();

      return { clearedCount: result.clearedCount };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache by type';
      set({
        cacheError: errorMessage,
        isLoadingCache: false,
      });
      throw err;
    }
  },

  // Refresh cache stats (same as load but for explicit refresh)
  refreshCacheStats: async () => {
    return get().loadCacheStats();
  },
});
