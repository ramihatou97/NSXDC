/**
 * NSXDC Cache Service
 * 
 * Implements a high-performance LRU (Least Recently Used) cache with:
 * - Content-based cache keys using SHA256 hashing
 * - Multiple cache types (extraction, terminology, validation)
 * - Configurable TTL per cache type
 * - Cache statistics and metrics
 * - Memory-efficient eviction policies
 * 
 * Day 10: Caching Layer Implementation
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Cache types for different data categories
 */
export type CacheType = 'extraction' | 'terminology' | 'validation' | 'general';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T = any> {
  key: string;
  value: T;
  type: CacheType;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  size: number; // Approximate size in bytes
  ttl: number; // Time to live in milliseconds
}

/**
 * Cache configuration per type
 */
interface CacheConfig {
  maxSize: number; // Maximum number of entries
  ttl: number; // Time to live in milliseconds
  enabled: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number; // Percentage (0-100)
  types: {
    [key in CacheType]?: {
      entries: number;
      hits: number;
      misses: number;
      hitRate: number;
      totalSize: number; // Approximate total size in bytes
    };
  };
  memoryUsage: {
    estimated: number; // Estimated memory usage in bytes
    formatted: string; // Human-readable format (e.g., "2.5 MB")
  };
  oldestEntry: number | null; // Timestamp of oldest entry
  newestEntry: number | null; // Timestamp of newest entry
}

/**
 * Cache operation result
 */
interface CacheOperationResult<T = any> {
  success: boolean;
  value?: T;
  cached: boolean;
  error?: string;
}

// ============================================================================
// CACHE SERVICE CLASS
// ============================================================================

/**
 * Generic LRU Cache Service with multi-type support
 */
export class CacheService {
  private cache: Map<string, CacheEntry>;
  private accessOrder: Map<string, number>; // Track access order for LRU
  private config: Map<CacheType, CacheConfig>;
  
  // Statistics
  private stats = {
    hits: new Map<CacheType, number>(),
    misses: new Map<CacheType, number>(),
  };

  constructor() {
    this.cache = new Map();
    this.accessOrder = new Map();
    this.config = new Map();
    
    // Initialize default configurations
    this.initializeDefaultConfig();
  }

  /**
   * Initialize default cache configurations
   */
  private initializeDefaultConfig(): void {
    // Extraction cache: Large responses, longer TTL
    this.config.set('extraction', {
      maxSize: 1000,
      ttl: 3600000, // 1 hour
      enabled: true,
    });

    // Terminology cache: Small lookups, very long TTL
    this.config.set('terminology', {
      maxSize: 5000,
      ttl: 86400000, // 24 hours
      enabled: true,
    });

    // Validation cache: Medium responses, medium TTL
    this.config.set('validation', {
      maxSize: 2000,
      ttl: 1800000, // 30 minutes
      enabled: true,
    });

    // General cache: Catch-all
    this.config.set('general', {
      maxSize: 500,
      ttl: 600000, // 10 minutes
      enabled: true,
    });

    // Initialize stats for each type
    for (const type of this.config.keys()) {
      this.stats.hits.set(type, 0);
      this.stats.misses.set(type, 0);
    }
  }

  /**
   * Generate SHA256 hash for content-based cache key
   */
  private generateCacheKey(content: string, type: CacheType): string {
    const hash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
    
    return `${type}:${hash}`;
  }

  /**
   * Calculate approximate size of an object in bytes
   */
  private calculateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    return now - entry.createdAt > entry.ttl;
  }

  /**
   * Evict least recently used entries to make room
   */
  private evictLRU(type: CacheType, count: number = 1): void {
    // Get all entries of this type
    const typeEntries = Array.from(this.cache.entries())
      .filter(([, entry]) => entry.type === type);

    // Sort by last accessed time (ascending)
    typeEntries.sort((a, b) => 
      a[1].lastAccessedAt - b[1].lastAccessedAt
    );

    // Evict the specified number of oldest entries
    for (let i = 0; i < Math.min(count, typeEntries.length); i++) {
      const [key] = typeEntries[i];
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Get configuration for a cache type
   */
  public getConfig(type: CacheType): CacheConfig {
    return this.config.get(type) || {
      maxSize: 100,
      ttl: 600000,
      enabled: true,
    };
  }

  /**
   * Update configuration for a cache type
   */
  public setConfig(type: CacheType, config: Partial<CacheConfig>): void {
    const current = this.getConfig(type);
    this.config.set(type, { ...current, ...config });
  }

  /**
   * Get value from cache
   */
  public get<T = any>(
    content: string,
    type: CacheType = 'general'
  ): CacheOperationResult<T> {
    const config = this.getConfig(type);
    
    // Check if cache is enabled
    if (!config.enabled) {
      this.recordMiss(type);
      return {
        success: false,
        cached: false,
        error: 'Cache disabled for this type',
      };
    }

    const key = this.generateCacheKey(content, type);
    const entry = this.cache.get(key);

    // Cache miss
    if (!entry) {
      this.recordMiss(type);
      return {
        success: false,
        cached: false,
      };
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.recordMiss(type);
      return {
        success: false,
        cached: false,
        error: 'Entry expired',
      };
    }

    // Cache hit - update access metadata
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.accessOrder.set(key, entry.lastAccessedAt);
    this.recordHit(type);

    return {
      success: true,
      value: entry.value as T,
      cached: true,
    };
  }

  /**
   * Set value in cache
   */
  public set<T = any>(
    content: string,
    value: T,
    type: CacheType = 'general',
    customTTL?: number
  ): CacheOperationResult<void> {
    const config = this.getConfig(type);
    
    // Check if cache is enabled
    if (!config.enabled) {
      return {
        success: false,
        cached: false,
        error: 'Cache disabled for this type',
      };
    }

    const key = this.generateCacheKey(content, type);
    const now = Date.now();
    const size = this.calculateSize(value);
    const ttl = customTTL || config.ttl;

    // Check if we need to evict entries
    const typeCount = this.getTypeCount(type);
    if (typeCount >= config.maxSize) {
      // Evict 10% of entries or at least 1
      const evictCount = Math.max(1, Math.floor(config.maxSize * 0.1));
      this.evictLRU(type, evictCount);
    }

    // Create cache entry
    const entry: CacheEntry<T> = {
      key,
      value,
      type,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      size,
      ttl,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, now);

    return {
      success: true,
      cached: true,
    };
  }

  /**
   * Delete specific cache entry
   */
  public delete(content: string, type: CacheType = 'general'): boolean {
    const key = this.generateCacheKey(content, type);
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries of a specific type
   */
  public clearType(type: CacheType): number {
    let count = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.type === type) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  public clearAll(): number {
    const count = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    return count;
  }

  /**
   * Get number of entries for a specific type
   */
  private getTypeCount(type: CacheType): number {
    let count = 0;
    for (const entry of this.cache.values()) {
      if (entry.type === type) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total size for a specific type
   */
  private getTypeSize(type: CacheType): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      if (entry.type === type) {
        size += entry.size;
      }
    }
    return size;
  }

  /**
   * Record cache hit
   */
  private recordHit(type: CacheType): void {
    const current = this.stats.hits.get(type) || 0;
    this.stats.hits.set(type, current + 1);
  }

  /**
   * Record cache miss
   */
  private recordMiss(type: CacheType): void {
    const current = this.stats.misses.get(type) || 0;
    this.stats.misses.set(type, current + 1);
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    // Clean up expired entries first
    this.cleanupExpired();

    const totalHits = Array.from(this.stats.hits.values()).reduce((a, b) => a + b, 0);
    const totalMisses = Array.from(this.stats.misses.values()).reduce((a, b) => a + b, 0);
    const totalRequests = totalHits + totalMisses;

    const typeStats: CacheStats['types'] = {};
    
    for (const type of this.config.keys()) {
      const hits = this.stats.hits.get(type) || 0;
      const misses = this.stats.misses.get(type) || 0;
      const requests = hits + misses;
      
      typeStats[type] = {
        entries: this.getTypeCount(type),
        hits,
        misses,
        hitRate: requests > 0 ? (hits / requests) * 100 : 0,
        totalSize: this.getTypeSize(type),
      };
    }

    // Calculate memory usage
    let totalSize = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      
      if (oldestEntry === null || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (newestEntry === null || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: this.cache.size,
      totalHits,
      totalMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      types: typeStats,
      memoryUsage: {
        estimated: totalSize,
        formatted: this.formatBytes(totalSize),
      },
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Reset all statistics
   */
  public resetStats(): void {
    for (const type of this.config.keys()) {
      this.stats.hits.set(type, 0);
      this.stats.misses.set(type, 0);
    }
  }

  /**
   * Run periodic cleanup (removes expired entries)
   * Should be called periodically (e.g., every 5 minutes)
   */
  public cleanup(): number {
    const beforeCount = this.cache.size;
    this.cleanupExpired();
    const afterCount = this.cache.size;
    return beforeCount - afterCount;
  }

  /**
   * Get all cache keys for a specific type (for debugging)
   */
  public getKeys(type?: CacheType): string[] {
    const keys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (!type || entry.type === type) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * Check if cache has a specific entry
   */
  public has(content: string, type: CacheType = 'general'): boolean {
    const key = this.generateCacheKey(content, type);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton cache service instance
 */
export const cacheService = new CacheService();

// ============================================================================
// EXPORTS
// ============================================================================

export default cacheService;
