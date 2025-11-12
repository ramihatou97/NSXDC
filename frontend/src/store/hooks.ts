/**
 * Custom Zustand Hooks
 * Provides optimized selectors and convenience hooks for common patterns
 */

import { useStore } from './index';
import type { Store } from './index';

// ============================================================================
// EXTRACTION HOOKS
// ============================================================================

/**
 * Hook for extraction state
 */
export const useExtraction = () => {
  return useStore((state) => ({
    currentExtraction: state.currentExtraction,
    isLoading: state.isLoading,
    error: state.error,
    extract: state.extract,
    clearExtraction: state.clearExtraction,
    clearError: state.clearError,
  }));
};

/**
 * Hook for just the current extraction result
 */
export const useCurrentExtraction = () => {
  return useStore((state) => state.currentExtraction);
};

/**
 * Hook for extraction loading state
 */
export const useExtractionLoading = () => {
  return useStore((state) => state.isLoading);
};

/**
 * Hook for extraction error
 */
export const useExtractionError = () => {
  return useStore((state) => state.error);
};

// ============================================================================
// HISTORY HOOKS
// ============================================================================

/**
 * Hook for history state
 */
export const useHistory = () => {
  return useStore((state) => ({
    extractions: state.extractions,
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    totalExtractions: state.totalExtractions,
    totalPages: state.totalPages,
    isLoadingHistory: state.isLoadingHistory,
    historyError: state.historyError,
    loadHistory: state.loadHistory,
    deleteExtraction: state.deleteExtraction,
    setPage: state.setPage,
    setPageSize: state.setPageSize,
  }));
};

/**
 * Hook for storage stats
 */
export const useStorageStats = () => {
  return useStore((state) => ({
    storageStats: state.storageStats,
    isLoadingStats: state.isLoadingStats,
    loadStorageStats: state.loadStorageStats,
    runCleanup: state.runCleanup,
  }));
};

// ============================================================================
// CACHE HOOKS
// ============================================================================

/**
 * Hook for cache state
 */
export const useCache = () => {
  return useStore((state) => ({
    cacheStats: state.cacheStats,
    isLoadingCache: state.isLoadingCache,
    cacheError: state.cacheError,
    loadCacheStats: state.loadCacheStats,
    clearCache: state.clearCache,
    clearCacheByType: state.clearCacheByType,
    refreshCacheStats: state.refreshCacheStats,
  }));
};

// ============================================================================
// PROGRESS HOOKS
// ============================================================================

/**
 * Hook for progress state
 */
export const useProgress = () => {
  return useStore((state) => ({
    currentJobId: state.currentJobId,
    currentProgress: state.currentProgress,
    progressHistory: state.progressHistory,
    connectProgress: state.connectProgress,
    disconnectProgress: state.disconnectProgress,
    cancelJob: state.cancelJob,
    clearProgress: state.clearProgress,
  }));
};

/**
 * Hook for current progress event only
 */
export const useCurrentProgress = () => {
  return useStore((state) => state.currentProgress);
};

// ============================================================================
// UI HOOKS
// ============================================================================

/**
 * Hook for notifications
 */
export const useNotifications = () => {
  return useStore((state) => ({
    notifications: state.notifications,
    addNotification: state.addNotification,
    dismissNotification: state.dismissNotification,
    clearNotifications: state.clearNotifications,
  }));
};

/**
 * Hook for modals
 */
export const useModal = () => {
  return useStore((state) => ({
    activeModal: state.activeModal,
    modalData: state.modalData,
    openModal: state.openModal,
    closeModal: state.closeModal,
  }));
};

/**
 * Hook for theme
 */
export const useTheme = () => {
  return useStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
  }));
};

/**
 * Hook for sidebar
 */
export const useSidebar = () => {
  return useStore((state) => ({
    sidebarOpen: state.sidebarOpen,
    toggleSidebar: state.toggleSidebar,
    setSidebarOpen: state.setSidebarOpen,
  }));
};

// ============================================================================
// COMPOSITE HOOKS (Multiple slices)
// ============================================================================

/**
 * Hook for complete extraction workflow
 * Combines extraction, progress, and notifications
 */
export const useExtractionWorkflow = () => {
  const extraction = useExtraction();
  const progress = useProgress();
  const { addNotification } = useNotifications();

  return {
    ...extraction,
    ...progress,
    addNotification,
  };
};

/**
 * Hook for admin/management features
 * Combines history, cache, and storage
 */
export const useAdminPanel = () => {
  const history = useHistory();
  const cache = useCache();
  const storageStats = useStorageStats();

  return {
    ...history,
    ...cache,
    ...storageStats,
  };
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get entire store (use sparingly - causes re-render on any state change)
 */
export const useEntireStore = () => {
  return useStore();
};

/**
 * Hook to get store actions only (no state, never re-renders)
 */
export const useStoreActions = () => {
  return useStore((state) => ({
    // Extraction actions
    extract: state.extract,
    clearExtraction: state.clearExtraction,
    clearError: state.clearError,

    // History actions
    loadHistory: state.loadHistory,
    deleteExtraction: state.deleteExtraction,
    setPage: state.setPage,

    // Cache actions
    loadCacheStats: state.loadCacheStats,
    clearCache: state.clearCache,
    clearCacheByType: state.clearCacheByType,

    // Progress actions
    connectProgress: state.connectProgress,
    disconnectProgress: state.disconnectProgress,
    cancelJob: state.cancelJob,

    // UI actions
    addNotification: state.addNotification,
    dismissNotification: state.dismissNotification,
    openModal: state.openModal,
    closeModal: state.closeModal,
    setTheme: state.setTheme,
    toggleSidebar: state.toggleSidebar,
  }));
};

/**
 * Custom hook for creating selectors
 * Useful for complex derived state
 */
export const useSelector = <T,>(selector: (state: Store) => T): T => {
  return useStore(selector);
};
