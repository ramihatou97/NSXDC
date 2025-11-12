/**
 * Unit tests for StorageService
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageService, ExtractionRepository, StoredExtraction } from '../../src/services/storage.service';
import { ExtractionResponse } from '../../src/types';

describe('StorageService', () => {
  let storage: StorageService;
  const testDir = path.join(__dirname, '../../data/test-extractions');

  beforeEach(async () => {
    storage = new StorageService({
      baseDir: testDir,
      retentionDays: 30,
    });
    await storage.initialize();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('initialize', () => {
    it('should create base directory', async () => {
      const stat = await fs.stat(testDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await expect(storage.initialize()).resolves.not.toThrow();
    });
  });

  describe('generateExtractionId', () => {
    it('should generate unique IDs', () => {
      const id1 = storage.generateExtractionId();
      const id2 = storage.generateExtractionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^\d+-[a-f0-9]{8}$/);
      expect(id2).toMatch(/^\d+-[a-f0-9]{8}$/);
    });

    it('should include timestamp', () => {
      const id = storage.generateExtractionId();
      const timestamp = parseInt(id.split('-')[0], 10);
      const now = Date.now();
      
      expect(timestamp).toBeLessThanOrEqual(now);
      expect(timestamp).toBeGreaterThan(now - 1000); // Within 1 second
    });
  });

  describe('save and get', () => {
    it('should save and retrieve extraction', async () => {
      const stored: StoredExtraction = {
        id: storage.generateExtractionId(),
        timestamp: new Date(),
        extraction: createMockExtraction(),
        metadata: {
          processingTimeMs: 1500,
          tokensUsed: 1000,
          cost: 0.05,
          version: '2.0.0',
        },
      };

      await storage.save(stored);
      const retrieved = await storage.get(stored.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(stored.id);
      expect(retrieved!.extraction.extraction).toEqual(stored.extraction.extraction);
    });

    it('should organize files by date', async () => {
      const stored: StoredExtraction = {
        id: storage.generateExtractionId(),
        timestamp: new Date('2025-11-15T10:30:00Z'),
        extraction: createMockExtraction(),
        metadata: {
          processingTimeMs: 1500,
          version: '2.0.0',
        },
      };

      await storage.save(stored);
      
      const expectedPath = path.join(testDir, '2025-11', '15', `${stored.id}.json`);
      const stat = await fs.stat(expectedPath);
      expect(stat.isFile()).toBe(true);
    });

    it('should return null for non-existent ID', async () => {
      const result = await storage.get('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should handle concurrent saves', async () => {
      const saves = Array.from({ length: 10 }, (_, i) => {
        const stored: StoredExtraction = {
          id: storage.generateExtractionId(),
          timestamp: new Date(),
          extraction: createMockExtraction({ name: `Patient ${i}` }),
          metadata: {
            processingTimeMs: 1500,
            version: '2.0.0',
          },
        };
        return storage.save(stored).then(() => stored.id);
      });

      const ids = await Promise.all(saves);
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10); // All unique
    });
  });

  describe('exists', () => {
    it('should return true for existing extraction', async () => {
      const stored: StoredExtraction = {
        id: storage.generateExtractionId(),
        timestamp: new Date(),
        extraction: createMockExtraction(),
        metadata: {
          processingTimeMs: 1500,
          version: '2.0.0',
        },
      };

      await storage.save(stored);
      const exists = await storage.exists(stored.id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent extraction', async () => {
      const exists = await storage.exists('nonexistent-id');
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing extraction', async () => {
      const stored: StoredExtraction = {
        id: storage.generateExtractionId(),
        timestamp: new Date(),
        extraction: createMockExtraction(),
        metadata: {
          processingTimeMs: 1500,
          version: '2.0.0',
        },
      };

      await storage.save(stored);
      const deleted = await storage.delete(stored.id);
      expect(deleted).toBe(true);
      
      const exists = await storage.exists(stored.id);
      expect(exists).toBe(false);
    });

    it('should return false for non-existent extraction', async () => {
      const deleted = await storage.delete('nonexistent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create multiple extractions
      const dates = [
        new Date('2025-11-10T10:00:00Z'),
        new Date('2025-11-11T10:00:00Z'),
        new Date('2025-11-12T10:00:00Z'),
        new Date('2025-11-13T10:00:00Z'),
        new Date('2025-11-14T10:00:00Z'),
      ];

      for (const date of dates) {
        const stored: StoredExtraction = {
          id: `${date.getTime()}-test1234`,
          timestamp: date,
          extraction: createMockExtraction(),
          metadata: {
            processingTimeMs: 1500,
            version: '2.0.0',
          },
        };
        await storage.save(stored);
      }
    });

    it('should list all extractions', async () => {
      const result = await storage.list({ page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(5);
    });

    it('should paginate results', async () => {
      const page1 = await storage.list({ page: 1, pageSize: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.totalPages).toBe(3);

      const page2 = await storage.list({ page: 2, pageSize: 2 });
      expect(page2.items).toHaveLength(2);
      expect(page2.page).toBe(2);
    });

    it('should sort by timestamp descending (default)', async () => {
      const result = await storage.list({ page: 1, pageSize: 10 });
      const timestamps = result.items.map(item => item.timestamp.getTime());
      
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    it('should sort by timestamp ascending', async () => {
      const result = await storage.list({
        page: 1,
        pageSize: 10,
        sortBy: 'timestamp',
        sortOrder: 'asc',
      });
      
      const timestamps = result.items.map(item => item.timestamp.getTime());
      
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
      }
    });

    it('should filter by date range', async () => {
      const result = await storage.list(
        { page: 1, pageSize: 10 },
        {
          startDate: new Date('2025-11-11T00:00:00Z'),
          endDate: new Date('2025-11-13T23:59:59Z'),
        }
      );

      expect(result.items).toHaveLength(3);
      result.items.forEach(item => {
        expect(item.timestamp.getTime()).toBeGreaterThanOrEqual(
          new Date('2025-11-11T00:00:00Z').getTime()
        );
        expect(item.timestamp.getTime()).toBeLessThanOrEqual(
          new Date('2025-11-13T23:59:59Z').getTime()
        );
      });
    });
  });

  describe('cleanup', () => {
    it('should delete old extractions', async () => {
      const storage = new StorageService({
        baseDir: testDir,
        retentionDays: 7,
      });
      await storage.initialize();

      // Create old and recent extractions
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);

      await storage.save({
        id: `${oldDate.getTime()}-old12345`,
        timestamp: oldDate,
        extraction: createMockExtraction(),
        metadata: { processingTimeMs: 1500, version: '2.0.0' },
      });

      await storage.save({
        id: `${recentDate.getTime()}-new12345`,
        timestamp: recentDate,
        extraction: createMockExtraction(),
        metadata: { processingTimeMs: 1500, version: '2.0.0' },
      });

      const deletedCount = await storage.cleanup();
      expect(deletedCount).toBe(1);

      const result = await storage.list({ page: 1, pageSize: 10 });
      expect(result.total).toBe(1);
    });

    it('should not delete if retention is 0', async () => {
      const storage = new StorageService({
        baseDir: testDir,
        retentionDays: 0,
      });
      await storage.initialize();

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365);

      await storage.save({
        id: `${oldDate.getTime()}-old12345`,
        timestamp: oldDate,
        extraction: createMockExtraction(),
        metadata: { processingTimeMs: 1500, version: '2.0.0' },
      });

      const deletedCount = await storage.cleanup();
      expect(deletedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      const date1 = new Date('2025-11-10T10:00:00Z');
      const date2 = new Date('2025-11-15T10:00:00Z');
      
      await storage.save({
        id: `${date1.getTime()}-test1234`,
        timestamp: date1,
        extraction: createMockExtraction(),
        metadata: { processingTimeMs: 1500, version: '2.0.0' },
      });

      await storage.save({
        id: `${date2.getTime()}-test5678`,
        timestamp: date2,
        extraction: createMockExtraction(),
        metadata: { processingTimeMs: 1500, version: '2.0.0' },
      });

      const stats = await storage.getStats();
      expect(stats.totalExtractions).toBe(2);
      expect(stats.oldestDate).toEqual(date1);
      expect(stats.newestDate).toEqual(date2);
      expect(stats.storageSizeMB).toBeGreaterThan(0);
    });

    it('should handle empty storage', async () => {
      const stats = await storage.getStats();
      expect(stats.totalExtractions).toBe(0);
      expect(stats.oldestDate).toBeNull();
      expect(stats.newestDate).toBeNull();
    });
  });
});

describe('ExtractionRepository', () => {
  let storage: StorageService;
  let repository: ExtractionRepository;
  const testDir = path.join(__dirname, '../../data/test-repo');

  beforeEach(async () => {
    storage = new StorageService({
      baseDir: testDir,
      retentionDays: 30,
    });
    await storage.initialize();
    repository = new ExtractionRepository(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('create', () => {
    it('should create new extraction record', async () => {
      const extraction = createMockExtraction();
      const stored = await repository.create(extraction, {
        processingTimeMs: 1500,
        tokensUsed: 1000,
        cost: 0.05,
      });

      expect(stored.id).toBeDefined();
      expect(stored.timestamp).toBeInstanceOf(Date);
      expect(stored.extraction).toEqual(extraction);
      expect(stored.metadata.processingTimeMs).toBe(1500);
      expect(stored.metadata.version).toBe('2.0.0');
    });
  });

  describe('findById', () => {
    it('should find extraction by ID', async () => {
      const extraction = createMockExtraction();
      const created = await repository.create(extraction, {
        processingTimeMs: 1500,
      });

      const found = await repository.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all extractions with pagination', async () => {
      // Create 3 extractions
      for (let i = 0; i < 3; i++) {
        await repository.create(createMockExtraction(), {
          processingTimeMs: 1500,
        });
      }

      const result = await repository.findAll({ page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });
  });

  describe('findByDateRange', () => {
    it('should find extractions in date range', async () => {
      const extraction = createMockExtraction();
      await repository.create(extraction, { processingTimeMs: 1500 });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const result = await repository.findByDateRange(
        startDate,
        endDate,
        { page: 1, pageSize: 10 }
      );

      expect(result.items).toHaveLength(1);
    });
  });

  describe('deleteById', () => {
    it('should delete extraction by ID', async () => {
      const extraction = createMockExtraction();
      const created = await repository.create(extraction, {
        processingTimeMs: 1500,
      });

      const deleted = await repository.deleteById(created.id);
      expect(deleted).toBe(true);

      const exists = await repository.exists(created.id);
      expect(exists).toBe(false);
    });
  });
});

// Helper functions
function createMockExtraction(overrides?: any): ExtractionResponse {
  return {
    success: true,
    extraction: {
      patientInfo: {
        name: overrides?.name || 'John Doe',
        age: 65,
        gender: 'male',
        mrn: '12345678',
      },
      admission: {
        date: '2025-11-01',
        time: '10:30',
        chiefComplaint: 'Severe headache',
      },
      diagnosis: {
        primary: 'Subarachnoid hemorrhage',
      },
    },
    narrative: 'Test summary',
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
