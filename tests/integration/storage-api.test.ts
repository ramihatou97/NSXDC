/**
 * Integration tests for storage API endpoints
 * Tests the storage service integration with Express API
 */

import request from 'supertest';
import express, { type Express } from 'express';
import { StorageService, ExtractionRepository } from '../../src/services/storage.service';
import { ExtractionResponse } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Storage API Integration', () => {
  let app: Express;
  let storage: StorageService;
  let repo: ExtractionRepository;
  const testDir = path.join(__dirname, '../../data/test-storage-api');

  beforeAll(async () => {
    // Setup storage
    storage = new StorageService({
      baseDir: testDir,
      retentionDays: 30,
    });
    await storage.initialize();
    repo = new ExtractionRepository(storage);

    // Setup minimal Express app
    app = express();
    app.use(express.json());

    // Add storage endpoints
    app.get('/api/v1/extractions/:id', async (req, res) => {
      try {
        const stored = await repo.findById(req.params.id);
        if (!stored) {
          res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Extraction not found' },
          });
          return;
        }
        res.json({ success: true, data: stored });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve extraction' },
        });
      }
    });

    app.get('/api/v1/extractions', async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const sortBy = (req.query.sortBy as 'timestamp' | 'id') || 'timestamp';
        const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const result = await repo.findAll(
          { page, pageSize, sortBy, sortOrder },
          startDate || endDate ? { startDate, endDate } : undefined
        );

        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to list extractions' },
        });
      }
    });

    app.delete('/api/v1/extractions/:id', async (req, res) => {
      try {
        const deleted = await repo.deleteById(req.params.id);
        if (!deleted) {
          res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Extraction not found' },
          });
          return;
        }
        res.json({ success: true, message: 'Extraction deleted successfully' });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete extraction' },
        });
      }
    });

    app.get('/api/v1/storage/stats', async (_req, res) => {
      try {
        const stats = await repo.getStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to get storage statistics' },
        });
      }
    });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(async () => {
    // Clear storage before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await storage.initialize();
    } catch {}
  });

  describe('GET /api/v1/extractions/:id', () => {
    it('should retrieve extraction by ID', async () => {
      // Create extraction
      const extraction = createMockExtraction();
      const stored = await repo.create(extraction, { processingTimeMs: 1500 });

      // Retrieve via API
      const response = await request(app)
        .get(`/api/v1/extractions/${stored.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(stored.id);
      expect(response.body.data.extraction).toBeDefined();
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .get('/api/v1/extractions/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/extractions', () => {
    beforeEach(async () => {
      // Create multiple extractions
      for (let i = 0; i < 5; i++) {
        await repo.create(createMockExtraction(), { processingTimeMs: 1500 });
      }
    });

    it('should list all extractions with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/extractions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(5);
      expect(response.body.data.total).toBe(5);
      expect(response.body.data.page).toBe(1);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/extractions?page=2&pageSize=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.totalPages).toBe(3);
    });

    it('should sort results', async () => {
      const response = await request(app)
        .get('/api/v1/extractions?sortBy=timestamp&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const timestamps = response.body.data.items.map((item: any) => 
        new Date(item.timestamp).getTime()
      );

      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
      }
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 60000); // 1 minute ago
      const endDate = new Date(now.getTime() + 60000); // 1 minute from now

      const response = await request(app)
        .get(`/api/v1/extractions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/v1/extractions/:id', () => {
    it('should delete extraction by ID', async () => {
      const extraction = createMockExtraction();
      const stored = await repo.create(extraction, { processingTimeMs: 1500 });

      const response = await request(app)
        .delete(`/api/v1/extractions/${stored.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify deletion
      const exists = await repo.exists(stored.id);
      expect(exists).toBe(false);
    });

    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .delete('/api/v1/extractions/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/storage/stats', () => {
    it('should return storage statistics', async () => {
      // Create some extractions
      await repo.create(createMockExtraction(), { processingTimeMs: 1500 });
      await repo.create(createMockExtraction(), { processingTimeMs: 2000 });

      const response = await request(app)
        .get('/api/v1/storage/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalExtractions).toBe(2);
      expect(response.body.data.oldestDate).toBeDefined();
      expect(response.body.data.newestDate).toBeDefined();
      expect(response.body.data.storageSizeMB).toBeGreaterThan(0);
    });

    it('should handle empty storage', async () => {
      const response = await request(app)
        .get('/api/v1/storage/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalExtractions).toBe(0);
      expect(response.body.data.oldestDate).toBeNull();
      expect(response.body.data.newestDate).toBeNull();
    });
  });

  describe('Concurrent operations', () => {
    it('should handle 100+ concurrent writes', async () => {
      const promises = Array.from({ length: 100 }, () =>
        repo.create(createMockExtraction(), { processingTimeMs: 1500 })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);

      // Verify all IDs are unique
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);

      // Verify all can be retrieved
      const response = await request(app)
        .get('/api/v1/extractions?pageSize=100')
        .expect(200);

      expect(response.body.data.total).toBe(100);
    });
  });
});

// Helper function
function createMockExtraction(): ExtractionResponse {
  return {
    success: true,
    extraction: {
      patientInfo: {
        name: 'Test Patient',
        age: 65,
        gender: 'male',
      },
      diagnosis: {
        primary: 'Test diagnosis',
      },
    },
    narrative: 'Test narrative',
    validation: {
      passed: true,
      score: 85,
      issues: [],
    },
    metadata: {
      extractionMode: 'VALIDATED',
      modelUsed: 'claude-sonnet-4',
      processingTime: 1500,
      timestamp: new Date().toISOString(),
    },
  };
}
