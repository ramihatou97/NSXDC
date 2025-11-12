/**
 * History Slice - Manages extraction history and storage
 * Handles listing, pagination, deletion, and retrieval of past extractions
 */

import type { StateCreator } from 'zustand';
import type {
  StoredExtraction,
  PaginationOptions,
  PaginatedResult,
  StorageStats,
} from '../../types';
import APIClient from '../../services/api-client';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface HistorySlice {
  // History data
  extractions: StoredExtraction[];
  currentPage: number;
  pageSize: number;
  totalExtractions: number;
  totalPages: number;

  // Storage stats
  storageStats: StorageStats | null;

  // Loading states
  isLoadingHistory: boolean;
  isLoadingStats: boolean;
  historyError: string | null;

  // Actions
  loadHistory: (options?: Partial<PaginationOptions>) => Promise<void>;
  loadStorageStats: () => Promise<void>;
  getExtraction: (id: string) => Promise<StoredExtraction>;
  deleteExtraction: (id: string) => Promise<void>;
  runCleanup: () => Promise<{ deletedCount: number }>;
  clearHistory: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

// ============================================================================
// SLICE IMPLEMENTATION
// ============================================================================

export const createHistorySlice: StateCreator<
  HistorySlice,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  // Initial state
  extractions: [],
  currentPage: 1,
  pageSize: 20,
  totalExtractions: 0,
  totalPages: 0,
  storageStats: null,
  isLoadingHistory: false,
  isLoadingStats: false,
  historyError: null,

  // Load history
  loadHistory: async (options?: Partial<PaginationOptions>) => {
    const { currentPage, pageSize } = get();
    const paginationOptions: PaginationOptions = {
      page: options?.page || currentPage,
      pageSize: options?.pageSize || pageSize,
      sortBy: options?.sortBy || 'timestamp',
      sortOrder: options?.sortOrder || 'desc',
    };

    set({ isLoadingHistory: true, historyError: null });

    try {
      const result: PaginatedResult<StoredExtraction> = await APIClient.listExtractions(paginationOptions);

      set({
        extractions: result.items,
        currentPage: result.page,
        pageSize: result.pageSize,
        totalExtractions: result.total,
        totalPages: result.totalPages,
        isLoadingHistory: false,
        historyError: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load history';
      set({
        historyError: errorMessage,
        isLoadingHistory: false,
      });
      throw err;
    }
  },

  // Load storage stats
  loadStorageStats: async () => {
    set({ isLoadingStats: true });

    try {
      const stats = await APIClient.getStorageStats();
      set({
        storageStats: stats,
        isLoadingStats: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load storage stats';
      set({
        historyError: errorMessage,
        isLoadingStats: false,
      });
      throw err;
    }
  },

  // Get single extraction
  getExtraction: async (id: string) => {
    try {
      const extraction = await APIClient.getExtraction(id);
      return extraction;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get extraction';
      set({ historyError: errorMessage });
      throw err;
    }
  },

  // Delete extraction
  deleteExtraction: async (id: string) => {
    try {
      await APIClient.deleteExtraction(id);

      // Reload history after deletion
      const { loadHistory, currentPage } = get();
      await loadHistory({ page: currentPage });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete extraction';
      set({ historyError: errorMessage });
      throw err;
    }
  },

  // Run cleanup
  runCleanup: async () => {
    try {
      const result = await APIClient.runStorageCleanup();

      // Reload history and stats after cleanup
      const { loadHistory, loadStorageStats } = get();
      await Promise.all([
        loadHistory({ page: 1 }), // Reset to first page
        loadStorageStats(),
      ]);

      return { deletedCount: result.deletedCount };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run cleanup';
      set({ historyError: errorMessage });
      throw err;
    }
  },

  // Clear history
  clearHistory: () => {
    set({
      extractions: [],
      currentPage: 1,
      totalExtractions: 0,
      totalPages: 0,
      historyError: null,
    });
  },

  // Set page
  setPage: (page: number) => {
    const { loadHistory } = get();
    set({ currentPage: page });
    loadHistory({ page });
  },

  // Set page size
  setPageSize: (pageSize: number) => {
    const { loadHistory } = get();
    set({ pageSize, currentPage: 1 }); // Reset to first page when changing page size
    loadHistory({ page: 1, pageSize });
  },
});
