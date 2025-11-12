/**
 * NSXDC API Client
 * Centralized API communication with error handling, retries, and type safety
 */

import type {
  ExtractionRequest,
  ExtractionResponse,
  StoredExtraction,
  PaginatedResult,
  PaginationOptions,
  StorageStats,
  CacheStats,
  VersionInfo,
  SystemConfig,
  ProgressEvent,
} from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || 'demo-key';
const DEFAULT_TIMEOUT = 300000; // 5 minutes for extraction
const DEFAULT_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

// ============================================================================
// ERROR TYPES
// ============================================================================

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Delay helper for retries
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof NetworkError) return true;
  if (error instanceof APIError) {
    // Retry on 5xx errors and 429 (rate limit)
    return error.statusCode ? error.statusCode >= 500 || error.statusCode === 429 : false;
  }
  return false;
}

// ============================================================================
// BASE REQUEST HANDLER
// ============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

async function makeRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRY_ATTEMPTS,
    headers = {},
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        timeout
      );

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error?.message || errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData.error?.code || errorData.code,
          errorData.error?.details || errorData.details
        );
      }

      // Parse and return response
      const data = await response.json();
      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === retries || !isRetryableError(error)) {
        break;
      }

      // Wait before retry with exponential backoff
      await delay(RETRY_DELAY * Math.pow(2, attempt));
    }
  }

  // If we get here, all retries failed
  if (lastError) {
    throw lastError;
  }
  throw new Error('Request failed without error');
}

// ============================================================================
// API CLIENT CLASS
// ============================================================================

export class APIClient {
  // --------------------------------------------------------------------------
  // EXTRACTION ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * Run extraction pipeline
   */
  static async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    return makeRequest<ExtractionResponse>('/api/v1/extract', {
      method: 'POST',
      body: request,
      timeout: 600000, // 10 minutes for large documents
    });
  }

  /**
   * Cancel ongoing extraction
   */
  static async cancelExtraction(jobId: string): Promise<{ success: boolean; message: string }> {
    return makeRequest(`/api/v1/cancel/${jobId}`, {
      method: 'POST',
      timeout: 5000,
      retries: 0,
    });
  }

  // --------------------------------------------------------------------------
  // PROGRESS TRACKING (SSE)
  // --------------------------------------------------------------------------

  /**
   * Connect to progress stream via Server-Sent Events
   */
  static connectProgressStream(
    jobId: string,
    onProgress: (event: ProgressEvent) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): EventSource {
    const url = `${API_BASE_URL}/api/v1/progress/${jobId}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        onProgress(data);

        // Close connection when complete or failed
        if (['completed', 'failed', 'cancelled'].includes(data.stage)) {
          eventSource.close();
          if (onComplete) onComplete();
        }
      } catch (error) {
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    eventSource.onerror = (error) => {
      eventSource.close();
      if (onError) {
        onError(new NetworkError('Progress stream connection failed'));
      }
    };

    return eventSource;
  }

  // --------------------------------------------------------------------------
  // STORAGE/HISTORY ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * Get extraction by ID
   */
  static async getExtraction(id: string): Promise<StoredExtraction> {
    return makeRequest<StoredExtraction>(`/api/v1/extractions/${id}`, {
      timeout: 10000,
    });
  }

  /**
   * List extractions with pagination
   */
  static async listExtractions(
    options: PaginationOptions = { page: 1, pageSize: 20 }
  ): Promise<PaginatedResult<StoredExtraction>> {
    const params = new URLSearchParams({
      page: String(options.page),
      pageSize: String(options.pageSize),
      ...(options.sortBy && { sortBy: options.sortBy }),
      ...(options.sortOrder && { sortOrder: options.sortOrder }),
    });

    return makeRequest<PaginatedResult<StoredExtraction>>(
      `/api/v1/extractions?${params.toString()}`,
      {
        timeout: 15000,
      }
    );
  }

  /**
   * Delete extraction by ID
   */
  static async deleteExtraction(id: string): Promise<{ success: boolean; message: string }> {
    return makeRequest(`/api/v1/extractions/${id}`, {
      method: 'DELETE',
      timeout: 5000,
    });
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<StorageStats> {
    return makeRequest<StorageStats>('/api/v1/storage/stats', {
      timeout: 10000,
    });
  }

  /**
   * Run storage cleanup (delete old extractions)
   */
  static async runStorageCleanup(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    return makeRequest('/api/v1/storage/cleanup', {
      method: 'POST',
      timeout: 30000,
    });
  }

  // --------------------------------------------------------------------------
  // CACHE ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<CacheStats> {
    return makeRequest<CacheStats>('/api/v1/cache/stats', {
      timeout: 5000,
    });
  }

  /**
   * Clear all cache entries
   */
  static async clearCache(): Promise<{ success: boolean; message: string; clearedCount: number }> {
    return makeRequest('/api/v1/cache/clear', {
      method: 'POST',
      timeout: 5000,
    });
  }

  /**
   * Clear cache by type
   */
  static async clearCacheByType(
    type: 'extraction' | 'terminology' | 'validation' | 'general'
  ): Promise<{ success: boolean; message: string; clearedCount: number }> {
    return makeRequest(`/api/v1/cache/clear/${type}`, {
      method: 'POST',
      timeout: 5000,
    });
  }

  // --------------------------------------------------------------------------
  // SYSTEM ENDPOINTS
  // --------------------------------------------------------------------------

  /**
   * Get version information
   */
  static async getVersion(): Promise<VersionInfo> {
    return makeRequest<VersionInfo>('/api/v1/version', {
      timeout: 5000,
      retries: 1,
    });
  }

  /**
   * Get system configuration
   */
  static async getConfig(): Promise<SystemConfig> {
    return makeRequest<SystemConfig>('/api/v1/config', {
      timeout: 5000,
      retries: 1,
    });
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
  }> {
    return makeRequest('/health', {
      timeout: 5000,
      retries: 0,
    });
  }

  /**
   * Log client error to server
   */
  static async logError(error: {
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
  }): Promise<{ success: boolean }> {
    return makeRequest('/api/v1/logs/error', {
      method: 'POST',
      body: error,
      timeout: 5000,
      retries: 1,
    });
  }
}

// Export as default and named
export default APIClient;
