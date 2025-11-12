/**
 * StorageService - File-based JSON storage for extraction results
 * 
 * Features:
 * - Atomic writes with temp files
 * - Directory organization by date (YYYY-MM/DD/)
 * - Extraction ID generation (timestamp + random)
 * - CRUD operations via ExtractionRepository
 * - Configurable retention policy
 * - Thread-safe operations
 * 
 * @module services/storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { ExtractionResponse } from '../types';

/**
 * Stored extraction with metadata
 */
export interface StoredExtraction {
  id: string;
  timestamp: Date;
  extraction: ExtractionResponse;
  metadata: {
    processingTimeMs: number;
    tokensUsed?: number;
    cost?: number;
    version: string;
  };
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  baseDir: string;
  retentionDays?: number; // Auto-cleanup after N days (0 = never)
  enableCompression?: boolean; // Future: compress old files
}

/**
 * Pagination options for listing extractions
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: 'timestamp' | 'id';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result set
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Date range filter for queries
 */
export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

/**
 * StorageService - Manages persistent storage of extraction results
 */
export class StorageService {
  private config: Required<StorageConfig>;

  constructor(config: StorageConfig) {
    this.config = {
      baseDir: config.baseDir,
      retentionDays: config.retentionDays ?? 0,
      enableCompression: config.enableCompression ?? false,
    };
  }

  /**
   * Initialize storage (create directories)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.baseDir, { recursive: true });
      console.log(`[StorageService] Initialized at: ${this.config.baseDir}`);
    } catch (error) {
      console.error('[StorageService] Initialization failed:', error);
      throw new Error(`Failed to initialize storage: ${error}`);
    }
  }

  /**
   * Generate unique extraction ID
   * Format: {timestamp}-{random} (e.g., "1699718400000-a3f2d9c1")
   */
  generateExtractionId(): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Get file path for extraction ID
   * Directory structure: baseDir/YYYY-MM/DD/extractionId.json
   */
  private getFilePath(id: string, timestamp?: Date): string {
    const date = timestamp || this.parseTimestampFromId(id);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const dir = path.join(this.config.baseDir, `${year}-${month}`, day);
    return path.join(dir, `${id}.json`);
  }

  /**
   * Parse timestamp from extraction ID
   */
  private parseTimestampFromId(id: string): Date {
    const timestampStr = id.split('-')[0];
    const timestamp = parseInt(timestampStr, 10);
    return new Date(timestamp);
  }

  /**
   * Save extraction with atomic write (write to temp, then rename)
   */
  async save(stored: StoredExtraction): Promise<void> {
    const filePath = this.getFilePath(stored.id, stored.timestamp);
    const dir = path.dirname(filePath);
    const tempPath = `${filePath}.tmp`;

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write to temp file
      const jsonData = JSON.stringify(stored, null, 2);
      await fs.writeFile(tempPath, jsonData, 'utf-8');

      // Atomic rename (overwrites if exists)
      await fs.rename(tempPath, filePath);

      console.log(`[StorageService] Saved extraction: ${stored.id}`);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {}
      
      console.error(`[StorageService] Save failed for ${stored.id}:`, error);
      throw new Error(`Failed to save extraction: ${error}`);
    }
  }

  /**
   * Retrieve extraction by ID
   */
  async get(id: string): Promise<StoredExtraction | null> {
    try {
      const filePath = this.getFilePath(id);
      const jsonData = await fs.readFile(filePath, 'utf-8');
      const stored: StoredExtraction = JSON.parse(jsonData);
      
      // Convert timestamp string back to Date
      stored.timestamp = new Date(stored.timestamp);
      
      return stored;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // Not found
      }
      console.error(`[StorageService] Get failed for ${id}:`, error);
      throw new Error(`Failed to retrieve extraction: ${error}`);
    }
  }

  /**
   * Check if extraction exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete extraction by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
      console.log(`[StorageService] Deleted extraction: ${id}`);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false; // Already deleted
      }
      console.error(`[StorageService] Delete failed for ${id}:`, error);
      throw new Error(`Failed to delete extraction: ${error}`);
    }
  }

  /**
   * List all extractions with pagination
   */
  async list(
    options: PaginationOptions,
    dateFilter?: DateRangeFilter
  ): Promise<PaginatedResult<StoredExtraction>> {
    try {
      // Get all extraction IDs
      const allIds = await this.getAllExtractionIds(dateFilter);
      
      // Sort
      const sortedIds = this.sortExtractionIds(
        allIds,
        options.sortBy || 'timestamp',
        options.sortOrder || 'desc'
      );

      // Paginate
      const total = sortedIds.length;
      const totalPages = Math.ceil(total / options.pageSize);
      const startIndex = (options.page - 1) * options.pageSize;
      const endIndex = startIndex + options.pageSize;
      const pageIds = sortedIds.slice(startIndex, endIndex);

      // Load extractions
      const items: StoredExtraction[] = [];
      for (const id of pageIds) {
        const extraction = await this.get(id);
        if (extraction) {
          items.push(extraction);
        }
      }

      return {
        items,
        total,
        page: options.page,
        pageSize: options.pageSize,
        totalPages,
      };
    } catch (error) {
      console.error('[StorageService] List failed:', error);
      throw new Error(`Failed to list extractions: ${error}`);
    }
  }

  /**
   * Get all extraction IDs (with optional date filter)
   */
  private async getAllExtractionIds(
    dateFilter?: DateRangeFilter
  ): Promise<string[]> {
    const ids: string[] = [];

    try {
      // Read all year-month directories
      const yearMonthDirs = await this.getYearMonthDirectories(dateFilter);

      for (const yearMonthDir of yearMonthDirs) {
        const yearMonthPath = path.join(this.config.baseDir, yearMonthDir);
        
        // Read all day directories
        const dayDirs = await fs.readdir(yearMonthPath);
        
        for (const dayDir of dayDirs) {
          const dayPath = path.join(yearMonthPath, dayDir);
          
          // Check if it's a directory
          const stat = await fs.stat(dayPath);
          if (!stat.isDirectory()) continue;

          // Read all JSON files
          const files = await fs.readdir(dayPath);
          
          for (const file of files) {
            if (file.endsWith('.json') && !file.endsWith('.tmp')) {
              const id = file.replace('.json', '');
              
              // Apply date filter
              if (dateFilter) {
                const timestamp = this.parseTimestampFromId(id);
                if (dateFilter.startDate && timestamp < dateFilter.startDate) continue;
                if (dateFilter.endDate && timestamp > dateFilter.endDate) continue;
              }
              
              ids.push(id);
            }
          }
        }
      }
    } catch (error) {
      console.error('[StorageService] Failed to get extraction IDs:', error);
    }

    return ids;
  }

  /**
   * Get year-month directories that match date filter
   */
  private async getYearMonthDirectories(
    dateFilter?: DateRangeFilter
  ): Promise<string[]> {
    try {
      const allDirs = await fs.readdir(this.config.baseDir);
      
      // Filter for YYYY-MM format
      const yearMonthDirs = allDirs.filter(dir => /^\d{4}-\d{2}$/.test(dir));
      
      if (!dateFilter) {
        return yearMonthDirs;
      }

      // Apply date filter
      return yearMonthDirs.filter(dir => {
        const [year, month] = dir.split('-').map(Number);
        const dirDate = new Date(year, month - 1, 1);
        
        if (dateFilter.startDate) {
          const startYearMonth = new Date(
            dateFilter.startDate.getFullYear(),
            dateFilter.startDate.getMonth(),
            1
          );
          if (dirDate < startYearMonth) return false;
        }
        
        if (dateFilter.endDate) {
          const endYearMonth = new Date(
            dateFilter.endDate.getFullYear(),
            dateFilter.endDate.getMonth() + 1,
            0
          );
          if (dirDate > endYearMonth) return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error('[StorageService] Failed to read directories:', error);
      return [];
    }
  }

  /**
   * Sort extraction IDs
   */
  private sortExtractionIds(
    ids: string[],
    sortBy: 'timestamp' | 'id',
    sortOrder: 'asc' | 'desc'
  ): string[] {
    const sorted = [...ids].sort((a, b) => {
      if (sortBy === 'timestamp') {
        const tsA = parseInt(a.split('-')[0], 10);
        const tsB = parseInt(b.split('-')[0], 10);
        return tsA - tsB;
      } else {
        return a.localeCompare(b);
      }
    });

    return sortOrder === 'desc' ? sorted.reverse() : sorted;
  }

  /**
   * Clean up old extractions based on retention policy
   */
  async cleanup(): Promise<number> {
    if (this.config.retentionDays === 0) {
      return 0; // Retention disabled
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const dateFilter: DateRangeFilter = {
      endDate: cutoffDate,
    };

    try {
      const oldIds = await this.getAllExtractionIds(dateFilter);
      
      let deletedCount = 0;
      for (const id of oldIds) {
        const deleted = await this.delete(id);
        if (deleted) deletedCount++;
      }

      console.log(`[StorageService] Cleanup: deleted ${deletedCount} old extractions`);
      return deletedCount;
    } catch (error) {
      console.error('[StorageService] Cleanup failed:', error);
      throw new Error(`Failed to cleanup old extractions: ${error}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalExtractions: number;
    oldestDate: Date | null;
    newestDate: Date | null;
    storageSizeMB: number;
  }> {
    try {
      const allIds = await this.getAllExtractionIds();
      
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;
      
      if (allIds.length > 0) {
        const timestamps = allIds.map(id => this.parseTimestampFromId(id));
        oldestDate = new Date(Math.min(...timestamps.map(d => d.getTime())));
        newestDate = new Date(Math.max(...timestamps.map(d => d.getTime())));
      }

      // Calculate storage size (approximate)
      const storageSizeMB = await this.calculateStorageSize();

      return {
        totalExtractions: allIds.length,
        oldestDate,
        newestDate,
        storageSizeMB,
      };
    } catch (error) {
      console.error('[StorageService] Failed to get stats:', error);
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }

  /**
   * Calculate total storage size in MB
   */
  private async calculateStorageSize(): Promise<number> {
    let totalBytes = 0;

    const walk = async (dir: string): Promise<void> => {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isDirectory()) {
            await walk(filePath);
          } else {
            totalBytes += stat.size;
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    await walk(this.config.baseDir);
    return totalBytes / (1024 * 1024); // Convert to MB
  }
}

/**
 * ExtractionRepository - High-level API for extraction storage
 */
export class ExtractionRepository {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * Create new extraction record
   */
  async create(
    extraction: ExtractionResponse,
    metadata: {
      processingTimeMs: number;
      tokensUsed?: number;
      cost?: number;
    }
  ): Promise<StoredExtraction> {
    const id = this.storage.generateExtractionId();
    const timestamp = new Date();

    const stored: StoredExtraction = {
      id,
      timestamp,
      extraction,
      metadata: {
        ...metadata,
        version: '2.0.0',
      },
    };

    await this.storage.save(stored);
    return stored;
  }

  /**
   * Find extraction by ID
   */
  async findById(id: string): Promise<StoredExtraction | null> {
    return this.storage.get(id);
  }

  /**
   * Find all extractions with pagination
   */
  async findAll(
    options: PaginationOptions,
    dateFilter?: DateRangeFilter
  ): Promise<PaginatedResult<StoredExtraction>> {
    return this.storage.list(options, dateFilter);
  }

  /**
   * Find extractions by date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options: PaginationOptions
  ): Promise<PaginatedResult<StoredExtraction>> {
    return this.storage.list(options, { startDate, endDate });
  }

  /**
   * Delete extraction by ID
   */
  async deleteById(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * Check if extraction exists
   */
  async exists(id: string): Promise<boolean> {
    return this.storage.exists(id);
  }

  /**
   * Get repository statistics
   */
  async getStats() {
    return this.storage.getStats();
  }

  /**
   * Run cleanup (delete old extractions)
   */
  async cleanup(): Promise<number> {
    return this.storage.cleanup();
  }
}
