/**
 * NSXDC Cache Integration Tests
 * Tests for cache endpoints and extraction caching
 * 
 * Day 10: Cache Layer Integration Testing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import { cacheService } from '../../src/services/cache.service';

// Mock server setup (simplified for testing)
const setupTestServer = (): Express => {
  const app = express();
  app.use(express.json());
  
  // Cache stats endpoint
  app.get('/api/v1/cache/stats', (_req, res) => {
    try {
      const stats = cacheService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: 'Failed to get stats' } });
    }
  });
  
  // Clear all cache
  app.post('/api/v1/cache/clear', (_req, res) => {
    try {
      const count = cacheService.clearAll();
      res.json({ success: true, message: `Cleared ${count} entries`, clearedCount: count });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: 'Failed to clear cache' } });
    }
  });
  
  // Clear cache by type
  app.post('/api/v1/cache/clear/:type', (req, res) => {
    try {
      const { type } = req.params;
      const validTypes = ['extraction', 'terminology', 'validation', 'general'];
      
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_CACHE_TYPE', message: 'Invalid cache type' },
        });
        return;
      }
      
      const count = cacheService.clearType(type as any);
      res.json({
        success: true,
        message: `Cleared ${count} entries of type '${type}'`,
        clearedCount: count,
        type,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: 'Failed to clear cache' } });
    }
  });
  
  // Mock extraction endpoint with caching
  app.post('/api/v1/extract', (req, res) => {
    const { clinicalNotes, narrativeMode } = req.body;
    
    if (!clinicalNotes) {
      res.status(400).json({
        success: false,
        error: { message: 'Clinical notes required' },
      });
      return;
    }
    
    // Check cache
    const cacheKey = `${clinicalNotes}:${narrativeMode || 'STANDARD'}`;
    const cachedResult = cacheService.get(cacheKey, 'extraction');
    
    if (cachedResult.success) {
      res.json({
        ...cachedResult.value,
        cached: true,
        processingTimeMs: 5,
      });
      return;
    }
    
    // Simulate extraction
    const result = {
      success: true,
      extraction: {
        patient: { name: 'Test Patient', age: 45 },
        medications: [{ name: 'Test Drug', dose: '10mg' }],
      },
      narrative: 'Test narrative summary',
      extractionId: `test-${Date.now()}`,
    };
    
    // Cache the result
    cacheService.set(cacheKey, result, 'extraction');
    
    res.json({
      ...result,
      cached: false,
      processingTimeMs: 100,
    });
  });
  
  return app;
};

describe('Cache Integration Tests', () => {
  let app: Express;
  
  beforeAll(() => {
    app = setupTestServer();
    cacheService.clearAll();
    cacheService.resetStats();
  });
  
  afterAll(() => {
    cacheService.clearAll();
  });

  // ============================================================================
  // CACHE STATISTICS ENDPOINT
  // ============================================================================

  describe('GET /api/v1/cache/stats', () => {
    it('should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/v1/cache/stats')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalEntries');
      expect(response.body.data).toHaveProperty('totalHits');
      expect(response.body.data).toHaveProperty('totalMisses');
      expect(response.body.data).toHaveProperty('hitRate');
      expect(response.body.data).toHaveProperty('types');
      expect(response.body.data).toHaveProperty('memoryUsage');
    });

    it('should include stats for all cache types', async () => {
      // Add entries to different cache types
      cacheService.set('test1', { data: 1 }, 'extraction');
      cacheService.set('test2', { data: 2 }, 'validation');
      cacheService.set('test3', { data: 3 }, 'terminology');
      
      const response = await request(app)
        .get('/api/v1/cache/stats')
        .expect(200);
      
      expect(response.body.data.types).toHaveProperty('extraction');
      expect(response.body.data.types).toHaveProperty('validation');
      expect(response.body.data.types).toHaveProperty('terminology');
      expect(response.body.data.types).toHaveProperty('general');
    });

    it('should calculate hit rate correctly', async () => {
      cacheService.clearAll();
      cacheService.resetStats();
      
      // Set and hit
      cacheService.set('hit-test', { data: 'test' }, 'general');
      cacheService.get('hit-test', 'general'); // Hit
      cacheService.get('miss-test', 'general'); // Miss
      
      const response = await request(app)
        .get('/api/v1/cache/stats')
        .expect(200);
      
      expect(response.body.data.hitRate).toBe(50); // 1 hit, 1 miss = 50%
    });
  });

  // ============================================================================
  // CLEAR ALL CACHE ENDPOINT
  // ============================================================================

  describe('POST /api/v1/cache/clear', () => {
    it('should clear all cache entries', async () => {
      // Add some entries
      cacheService.set('test1', { data: 1 }, 'extraction');
      cacheService.set('test2', { data: 2 }, 'validation');
      cacheService.set('test3', { data: 3 }, 'general');
      
      const response = await request(app)
        .post('/api/v1/cache/clear')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.clearedCount).toBeGreaterThan(0);
      
      // Verify cache is empty
      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should return count of cleared entries', async () => {
      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        cacheService.set(`entry-${i}`, { data: i }, 'general');
      }
      
      const response = await request(app)
        .post('/api/v1/cache/clear')
        .expect(200);
      
      expect(response.body.clearedCount).toBeGreaterThanOrEqual(5);
    });
  });

  // ============================================================================
  // CLEAR CACHE BY TYPE ENDPOINT
  // ============================================================================

  describe('POST /api/v1/cache/clear/:type', () => {
    beforeEach(() => {
      cacheService.clearAll();
    });

    it('should clear only specified cache type', async () => {
      // Add entries to different types
      cacheService.set('ext-1', { data: 1 }, 'extraction');
      cacheService.set('ext-2', { data: 2 }, 'extraction');
      cacheService.set('val-1', { data: 1 }, 'validation');
      
      const response = await request(app)
        .post('/api/v1/cache/clear/extraction')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.type).toBe('extraction');
      expect(response.body.clearedCount).toBe(2);
      
      // Verify only extraction cache cleared
      expect(cacheService.has('ext-1', 'extraction')).toBe(false);
      expect(cacheService.has('val-1', 'validation')).toBe(true);
    });

    it('should validate cache type parameter', async () => {
      const response = await request(app)
        .post('/api/v1/cache/clear/invalid-type')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CACHE_TYPE');
    });

    it('should support all valid cache types', async () => {
      const validTypes = ['extraction', 'terminology', 'validation', 'general'];
      
      for (const type of validTypes) {
        cacheService.set('test', { data: 'test' }, type as any);
        
        const response = await request(app)
          .post(`/api/v1/cache/clear/${type}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.type).toBe(type);
      }
    });
  });

  // ============================================================================
  // EXTRACTION ENDPOINT CACHING
  // ============================================================================

  describe('Extraction Endpoint Caching', () => {
    beforeEach(() => {
      cacheService.clearAll();
      cacheService.resetStats();
    });

    it('should cache extraction results', async () => {
      const clinicalNotes = 'Patient: John Doe, Age: 45, Diagnosis: Test condition';
      
      // First request - cache miss
      const response1 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes, narrativeMode: 'STANDARD' })
        .expect(200);
      
      expect(response1.body.success).toBe(true);
      expect(response1.body.cached).toBe(false);
      expect(response1.body.processingTimeMs).toBeGreaterThan(50);
      
      // Second request - cache hit
      const response2 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes, narrativeMode: 'STANDARD' })
        .expect(200);
      
      expect(response2.body.success).toBe(true);
      expect(response2.body.cached).toBe(true);
      expect(response2.body.processingTimeMs).toBeLessThan(50);
    });

    it('should differentiate cache by narrative mode', async () => {
      const clinicalNotes = 'Test patient data';
      
      // Standard mode
      const response1 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes, narrativeMode: 'STANDARD' })
        .expect(200);
      
      expect(response1.body.cached).toBe(false);
      
      // Enhanced mode (should be cache miss)
      const response2 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes, narrativeMode: 'ENHANCED' })
        .expect(200);
      
      expect(response2.body.cached).toBe(false);
      
      // Standard mode again (should be cache hit)
      const response3 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes, narrativeMode: 'STANDARD' })
        .expect(200);
      
      expect(response3.body.cached).toBe(true);
    });

    it('should improve performance on cache hits', async () => {
      const clinicalNotes = 'Test patient: Jane Smith, Age: 32';
      
      // First request (uncached)
      const response1 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes });
      
      // Second request (cached)
      const response2 = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes });
      
      expect(response1.body.cached).toBe(false);
      expect(response2.body.cached).toBe(true);
      
      // Cache should report faster processing time for cached result
      expect(response2.body.processingTimeMs).toBeLessThanOrEqual(response1.body.processingTimeMs);
    });

    it('should track cache hit rate for extractions', async () => {
      const notes1 = 'Patient A data';
      const notes2 = 'Patient B data';
      
      // First extraction (miss)
      await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes: notes1 });
      
      // Second extraction, different patient (miss)
      await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes: notes2 });
      
      // Repeat first extraction (hit)
      await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes: notes1 });
      
      const stats = cacheService.getStats();
      expect(stats.types.extraction?.hits).toBeGreaterThan(0);
      expect(stats.types.extraction?.misses).toBeGreaterThan(0);
      expect(stats.types.extraction?.hitRate).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CACHE PERFORMANCE
  // ============================================================================

  describe('Cache Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      const clinicalNotes = 'Concurrent test patient data';
      
      // First request to populate cache
      await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes });
      
      // Multiple concurrent cached requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/v1/extract')
            .send({ clinicalNotes })
        );
      }
      
      const responses = await Promise.all(promises);
      
      // All should be cache hits
      responses.forEach(response => {
        expect(response.body.cached).toBe(true);
      });
    });

    it('should maintain cache integrity under load', async () => {
      cacheService.clearAll(); // Start fresh
      
      const requests = [];
      
      // 30 unique requests (smaller number for more reliable test)
      for (let i = 0; i < 30; i++) {
        requests.push(
          request(app)
            .post('/api/v1/extract')
            .send({ clinicalNotes: `Patient ${i} data` })
        );
      }
      
      await Promise.all(requests);
      
      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeLessThanOrEqual(30);
    });
  });

  // ============================================================================
  // CACHE STATISTICS ACCURACY
  // ============================================================================

  describe('Cache Statistics Accuracy', () => {
    beforeEach(() => {
      cacheService.clearAll();
      cacheService.resetStats();
    });

    it('should accurately track extraction cache usage', async () => {
      const note1 = 'Patient A';
      const note2 = 'Patient B';
      
      // 2 unique extractions
      await request(app).post('/api/v1/extract').send({ clinicalNotes: note1 });
      await request(app).post('/api/v1/extract').send({ clinicalNotes: note2 });
      
      // 2 cached extractions
      await request(app).post('/api/v1/extract').send({ clinicalNotes: note1 });
      await request(app).post('/api/v1/extract').send({ clinicalNotes: note2 });
      
      const response = await request(app)
        .get('/api/v1/cache/stats')
        .expect(200);
      
      const extractionStats = response.body.data.types.extraction;
      expect(extractionStats.entries).toBe(2);
      expect(extractionStats.hits).toBe(2);
      expect(extractionStats.misses).toBe(2);
      expect(extractionStats.hitRate).toBe(50);
    });

    it('should report memory usage accurately', async () => {
      // Add several extractions with large data
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/extract')
          .send({ clinicalNotes: `Large patient data ${'x'.repeat(2000)} - ${i}` });
      }
      
      const response = await request(app)
        .get('/api/v1/cache/stats')
        .expect(200);
      
      expect(response.body.data.memoryUsage.estimated).toBeGreaterThan(500);
      expect(response.body.data.memoryUsage.formatted).toMatch(/\d+\.\d+\s+(Bytes|KB|MB)/);
    });
  });
});
