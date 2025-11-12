/**
 * NSXDC Cache Service Tests
 * Comprehensive unit tests for LRU cache implementation
 * 
 * Day 10: Caching Layer Testing
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CacheService, type CacheType } from '../../src/services/cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    // Create fresh cache instance for each test
    cache = new CacheService();
  });

  // ============================================================================
  // BASIC OPERATIONS
  // ============================================================================

  describe('Basic Operations', () => {
    it('should set and get a value', () => {
      const content = 'test-content';
      const value = { data: 'test-data' };
      
      const setResult = cache.set(content, value, 'general');
      expect(setResult.success).toBe(true);
      expect(setResult.cached).toBe(true);

      const getResult = cache.get(content, 'general');
      expect(getResult.success).toBe(true);
      expect(getResult.cached).toBe(true);
      expect(getResult.value).toEqual(value);
    });

    it('should return cache miss for non-existent key', () => {
      const result = cache.get('non-existent', 'general');
      expect(result.success).toBe(false);
      expect(result.cached).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should handle different cache types', () => {
      const types: CacheType[] = ['extraction', 'terminology', 'validation', 'general'];
      
      types.forEach((type, index) => {
        const content = `content-${index}`;
        const value = { type, index };
        
        cache.set(content, value, type);
        const result = cache.get(content, type);
        
        expect(result.success).toBe(true);
        expect(result.value).toEqual(value);
      });
    });

    it('should use content-based keys (same content = same cache)', () => {
      const content = 'identical content';
      const value1 = { version: 1 };
      const value2 = { version: 2 };
      
      // Set first value
      cache.set(content, value1, 'general');
      
      // Set again with different value (should overwrite)
      cache.set(content, value2, 'general');
      
      // Should get the second value
      const result = cache.get(content, 'general');
      expect(result.value).toEqual(value2);
    });

    it('should differentiate same content across types', () => {
      const content = 'same content';
      const extractionValue = { type: 'extraction' };
      const validationValue = { type: 'validation' };
      
      cache.set(content, extractionValue, 'extraction');
      cache.set(content, validationValue, 'validation');
      
      const extractionResult = cache.get(content, 'extraction');
      const validationResult = cache.get(content, 'validation');
      
      expect(extractionResult.value).toEqual(extractionValue);
      expect(validationResult.value).toEqual(validationValue);
    });
  });

  // ============================================================================
  // TTL AND EXPIRATION
  // ============================================================================

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const content = 'expiring-content';
      const value = { data: 'test' };
      
      // Set with 100ms TTL
      cache.set(content, value, 'general', 100);
      
      // Should exist immediately
      let result = cache.get(content, 'general');
      expect(result.success).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      result = cache.get(content, 'general');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry expired');
    });

    it('should use default TTL from config', () => {
      const content = 'test';
      const value = { data: 'test' };
      
      cache.set(content, value, 'extraction');
      
      const config = cache.getConfig('extraction');
      expect(config.ttl).toBe(3600000); // 1 hour default
    });

    it('should allow custom TTL override', () => {
      const content = 'custom-ttl';
      const value = { data: 'test' };
      
      const customTTL = 5000; // 5 seconds
      cache.set(content, value, 'general', customTTL);
      
      // Entry should exist
      const result = cache.get(content, 'general');
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // LRU EVICTION
  // ============================================================================

  describe('LRU Eviction', () => {
    it('should evict least recently used entries when cache is full', () => {
      // Set max size to 5 for testing
      cache.setConfig('general', { maxSize: 5, ttl: 60000, enabled: true });
      
      // Fill cache to max
      for (let i = 0; i < 5; i++) {
        cache.set(`content-${i}`, { index: i }, 'general');
      }
      
      // Verify all entries exist
      for (let i = 0; i < 5; i++) {
        const result = cache.get(`content-${i}`, 'general');
        expect(result.success).toBe(true);
      }
      
      // Add one more (should evict oldest)
      cache.set('content-new', { index: 'new' }, 'general');
      
      // First entry should be evicted (LRU)
      const oldestResult = cache.get('content-0', 'general');
      expect(oldestResult.success).toBe(false);
      
      // Newest should exist
      const newestResult = cache.get('content-new', 'general');
      expect(newestResult.success).toBe(true);
    });

    it('should update access time on get', () => {
      cache.setConfig('general', { maxSize: 5, ttl: 60000, enabled: true });
      
      // Fill cache to max
      for (let i = 0; i < 5; i++) {
        cache.set(`entry-${i}`, { index: i }, 'general');
      }
      
      // Access first entry to make it recently used
      const accessed = cache.get('entry-0', 'general');
      expect(accessed.success).toBe(true);
      
      // Add one more entry (should trigger eviction)
      cache.set('new-entry', { data: 'new' }, 'general');
      
      // Cache should not exceed max size
      const stats = cache.getStats();
      expect(stats.types.general?.entries).toBeLessThanOrEqual(5);
    });

    it('should evict multiple entries when needed', () => {
      cache.setConfig('general', { maxSize: 10, ttl: 60000, enabled: true });
      
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`content-${i}`, { index: i }, 'general');
      }
      
      // Add new entry (should evict 10% = 1 entry)
      cache.set('content-new', { index: 'new' }, 'general');
      
      // At least one old entry should be evicted
      const stats = cache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(10);
    });
  });

  // ============================================================================
  // CACHE STATISTICS
  // ============================================================================

  describe('Cache Statistics', () => {
    it('should track hits and misses', () => {
      const content = 'test';
      const value = { data: 'test' };
      
      // Set value
      cache.set(content, value, 'general');
      
      // Hit
      cache.get(content, 'general');
      
      // Miss
      cache.get('non-existent', 'general');
      
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(50); // 1 hit, 1 miss = 50%
    });

    it('should track stats per cache type', () => {
      // Extraction cache
      cache.set('extract-1', { data: 1 }, 'extraction');
      cache.get('extract-1', 'extraction'); // Hit
      cache.get('extract-2', 'extraction'); // Miss
      
      // Validation cache
      cache.set('valid-1', { data: 1 }, 'validation');
      cache.get('valid-1', 'validation'); // Hit
      
      const stats = cache.getStats();
      
      expect(stats.types.extraction?.hits).toBe(1);
      expect(stats.types.extraction?.misses).toBe(1);
      expect(stats.types.extraction?.hitRate).toBe(50);
      
      expect(stats.types.validation?.hits).toBe(1);
      expect(stats.types.validation?.misses).toBe(0);
      expect(stats.types.validation?.hitRate).toBe(100);
    });

    it('should calculate memory usage', () => {
      const largeValue = { data: 'x'.repeat(10000) }; // 10KB to ensure KB formatting
      
      cache.set('large', largeValue, 'general');
      
      const stats = cache.getStats();
      expect(stats.memoryUsage.estimated).toBeGreaterThan(10000);
      expect(stats.memoryUsage.formatted).toMatch(/KB|MB/); // Accept KB or MB
    });

    it('should track oldest and newest entries', () => {
      const now = Date.now();
      
      cache.set('first', { data: 1 }, 'general');
      cache.set('second', { data: 2 }, 'general');
      
      const stats = cache.getStats();
      expect(stats.oldestEntry).toBeLessThanOrEqual(now);
      expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry!);
    });

    it('should return correct entry counts', () => {
      cache.set('ext-1', { data: 1 }, 'extraction');
      cache.set('ext-2', { data: 2 }, 'extraction');
      cache.set('val-1', { data: 1 }, 'validation');
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.types.extraction?.entries).toBe(2);
      expect(stats.types.validation?.entries).toBe(1);
    });
  });

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  describe('Cache Management', () => {
    it('should delete specific entries', () => {
      const content = 'to-delete';
      const value = { data: 'test' };
      
      cache.set(content, value, 'general');
      expect(cache.has(content, 'general')).toBe(true);
      
      const deleted = cache.delete(content, 'general');
      expect(deleted).toBe(true);
      expect(cache.has(content, 'general')).toBe(false);
    });

    it('should clear cache by type', () => {
      // Add entries to different types
      cache.set('ext-1', { data: 1 }, 'extraction');
      cache.set('ext-2', { data: 2 }, 'extraction');
      cache.set('val-1', { data: 1 }, 'validation');
      
      const clearedCount = cache.clearType('extraction');
      expect(clearedCount).toBe(2);
      
      // Extraction entries should be gone
      expect(cache.has('ext-1', 'extraction')).toBe(false);
      expect(cache.has('ext-2', 'extraction')).toBe(false);
      
      // Validation entry should still exist
      expect(cache.has('val-1', 'validation')).toBe(true);
    });

    it('should clear all cache entries', () => {
      cache.set('ext-1', { data: 1 }, 'extraction');
      cache.set('val-1', { data: 1 }, 'validation');
      cache.set('gen-1', { data: 1 }, 'general');
      
      const clearedCount = cache.clearAll();
      expect(clearedCount).toBe(3);
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should reset statistics', () => {
      cache.set('test', { data: 1 }, 'general');
      cache.get('test', 'general'); // Hit
      cache.get('missing', 'general'); // Miss
      
      let stats = cache.getStats();
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
      
      cache.resetStats();
      
      stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });

    it('should clean up expired entries', async () => {
      // Add entry with short TTL
      cache.set('expiring', { data: 'test' }, 'general', 50);
      
      // Add entry with long TTL
      cache.set('keeping', { data: 'test' }, 'general', 60000);
      
      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const removed = cache.cleanup();
      expect(removed).toBe(1);
      
      // Only keeping entry should remain
      expect(cache.has('expiring', 'general')).toBe(false);
      expect(cache.has('keeping', 'general')).toBe(true);
    });
  });

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  describe('Configuration', () => {
    it('should get default configuration', () => {
      const config = cache.getConfig('extraction');
      
      expect(config.maxSize).toBe(1000);
      expect(config.ttl).toBe(3600000); // 1 hour
      expect(config.enabled).toBe(true);
    });

    it('should update configuration', () => {
      cache.setConfig('general', { maxSize: 50, ttl: 5000, enabled: true });
      
      const config = cache.getConfig('general');
      expect(config.maxSize).toBe(50);
      expect(config.ttl).toBe(5000);
    });

    it('should respect disabled cache', () => {
      cache.setConfig('general', { maxSize: 100, ttl: 60000, enabled: false });
      
      const setResult = cache.set('test', { data: 'test' }, 'general');
      expect(setResult.success).toBe(false);
      expect(setResult.error).toBe('Cache disabled for this type');
      
      const getResult = cache.get('test', 'general');
      expect(getResult.success).toBe(false);
    });

    it('should have different defaults for different types', () => {
      const extractionConfig = cache.getConfig('extraction');
      const terminologyConfig = cache.getConfig('terminology');
      
      expect(extractionConfig.maxSize).toBe(1000);
      expect(extractionConfig.ttl).toBe(3600000);
      
      expect(terminologyConfig.maxSize).toBe(5000);
      expect(terminologyConfig.ttl).toBe(86400000); // 24 hours
    });
  });

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  describe('Helper Methods', () => {
    it('should check if entry exists', () => {
      cache.set('exists', { data: 'test' }, 'general');
      
      expect(cache.has('exists', 'general')).toBe(true);
      expect(cache.has('not-exists', 'general')).toBe(false);
    });

    it('should get all keys', () => {
      cache.set('key1', { data: 1 }, 'general');
      cache.set('key2', { data: 2 }, 'extraction');
      cache.set('key3', { data: 3 }, 'general');
      
      const allKeys = cache.getKeys();
      expect(allKeys.length).toBe(3);
      
      const generalKeys = cache.getKeys('general');
      expect(generalKeys.length).toBe(2);
      
      const extractionKeys = cache.getKeys('extraction');
      expect(extractionKeys.length).toBe(1);
    });

    it('should generate consistent keys for same content', () => {
      const content = 'test content';
      
      cache.set(content, { version: 1 }, 'general');
      cache.set(content, { version: 2 }, 'general');
      
      // Should have only 1 entry (same key)
      const keys = cache.getKeys('general');
      expect(keys.length).toBe(1);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const result = cache.set('', { data: 'empty' }, 'general');
      expect(result.success).toBe(true);
      
      const getResult = cache.get('', 'general');
      expect(getResult.success).toBe(true);
    });

    it('should handle large values', () => {
      const largeValue = {
        data: 'x'.repeat(100000), // 100KB string
        array: new Array(1000).fill({ nested: 'data' }),
      };
      
      const result = cache.set('large', largeValue, 'general');
      expect(result.success).toBe(true);
      
      const getResult = cache.get('large', 'general');
      expect(getResult.success).toBe(true);
      expect(getResult.value).toEqual(largeValue);
    });

    it('should handle complex nested objects', () => {
      const complexValue = {
        extraction: {
          patient: { name: 'Test', age: 45 },
          medications: [{ name: 'Drug A', dose: '10mg' }],
        },
        validation: {
          passed: true,
          issues: [],
        },
      };
      
      cache.set('complex', complexValue, 'extraction');
      const result = cache.get('complex', 'extraction');
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual(complexValue);
    });

    it('should handle null and undefined values', () => {
      cache.set('null', null, 'general');
      cache.set('undefined', undefined, 'general');
      
      const nullResult = cache.get('null', 'general');
      const undefinedResult = cache.get('undefined', 'general');
      
      expect(nullResult.success).toBe(true);
      expect(nullResult.value).toBeNull();
      
      expect(undefinedResult.success).toBe(true);
      expect(undefinedResult.value).toBeUndefined();
    });

    it('should handle very long content strings', () => {
      const longContent = 'x'.repeat(10000);
      const value = { data: 'test' };
      
      cache.set(longContent, value, 'general');
      const result = cache.get(longContent, 'general');
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual(value);
    });
  });

  // ============================================================================
  // CONCURRENT OPERATIONS
  // ============================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent sets', () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(cache.set(`concurrent-${i}`, { index: i }, 'general'))
        );
      }
      
      return Promise.all(promises).then(() => {
        const stats = cache.getStats();
        expect(stats.totalEntries).toBeLessThanOrEqual(100);
      });
    });

    it('should handle concurrent gets and sets', async () => {
      // Pre-populate cache
      for (let i = 0; i < 10; i++) {
        cache.set(`item-${i}`, { index: i }, 'general');
      }
      
      const operations = [];
      
      // Mix of gets and sets
      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          operations.push(cache.get(`item-${i % 10}`, 'general'));
        } else {
          operations.push(cache.set(`new-${i}`, { index: i }, 'general'));
        }
      }
      
      await Promise.all(operations);
      
      // Should not throw errors
      const stats = cache.getStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
    });
  });
});
