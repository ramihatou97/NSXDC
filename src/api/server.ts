/**
 * NSXDC API Server
 * Express server with health monitoring and extraction endpoint
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLLMConfig, getOrchestratorConfig, getServerConfig, getAppMetadata } from '../config/index.js';
import { LLMService } from '../services/llm.service.js';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { StorageService, ExtractionRepository } from '../services/storage.service.js';
import { progressService } from '../services/progress.service.js';
import { cacheService } from '../services/cache.service.js';
import type { ExtractionRequest } from '../types/index.js';
import { validateEnvironmentOrExit } from '../utils/env-validator.js';

// Import middleware - Day 4 Enhancement
import {
  requestLogger,
  rateLimiter,
  validateApiKey,
  validateExtractionRequest,
  sanitizeRequestBody,
  getApiKeyStatus
} from '../middleware/index.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables before starting
console.log('🔍 Validating environment configuration...');
validateEnvironmentOrExit();

// Initialize services
const llmConfig = getLLMConfig();
const orchestratorConfig = getOrchestratorConfig();
const serverConfig = getServerConfig();
const appMetadata = getAppMetadata();

const llmService = new LLMService(llmConfig);
const orchestrator = new OrchestratorService(llmService, orchestratorConfig);

// Initialize storage service - Day 7
const storage = new StorageService({
  baseDir: path.join(__dirname, '../../data/extractions'),
  retentionDays: 90, // Keep extractions for 90 days
});
const extractionRepo = new ExtractionRepository(storage);

// Initialize storage
storage.initialize().catch((error) => {
  console.error('❌ Failed to initialize storage:', error);
  process.exit(1);
});

// Create Express app
const app = express();

// ============================================================================
// GLOBAL MIDDLEWARE - Day 4 Enhancement, Day 9: Compression
// ============================================================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for single-page app
}));
app.use(cors());

// Compression middleware - Day 9 (gzip/deflate with 1KB threshold, level 6)
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (0-9, 6 is default balanced)
  filter: (req, res) => {
    // Don't compress SSE (Server-Sent Events)
    if (req.headers['accept']?.includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '10mb' }));

// Request logging middleware (log all requests)
app.use(requestLogger);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../public')));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const apiKeyStatus = getApiKeyStatus();
  
  res.json({
    status: 'healthy',
    app: appMetadata.name,
    version: appMetadata.version,
    timestamp: new Date().toISOString(),
    features: appMetadata.features,
    security: {
      apiKeyEnabled: apiKeyStatus.enabled,
      apiKeysConfigured: apiKeyStatus.keysConfigured
    }
  });
});

// Version endpoint
app.get('/api/v1/version', (_req: Request, res: Response) => {
  res.json({
    app: appMetadata.name,
    version: appMetadata.version,
    description: appMetadata.description,
    model: llmConfig.model,
    extractionMode: orchestratorConfig.extractionMode,
    validationEnforced: orchestratorConfig.forceValidation,
  });
});

// Config endpoint
app.get('/api/v1/config', (_req: Request, res: Response) => {
  res.json({
    extractionMode: orchestratorConfig.extractionMode,
    narrativeModes: ['STRICT', 'STANDARD', 'ENHANCED'],
    validationEnforced: orchestratorConfig.forceValidation,
    cachingEnabled: orchestratorConfig.enableCaching,
  });
});

// Error logging endpoint - Day 3 Enhancement
app.post('/api/v1/logs/error', (req: Request, res: Response) => {
  try {
    const { type, details, timestamp } = req.body;
    
    // Log client-side error to server console
    console.error('\n' + '='.repeat(60));
    console.error(`🔴 CLIENT-SIDE ERROR - ${type}`);
    console.error('='.repeat(60));
    console.error(`Timestamp: ${timestamp}`);
    
    if (details) {
      console.error('Details:');
      Object.entries(details).forEach(([key, value]) => {
        if (key === 'stack') {
          console.error(`  ${key}:\n${value}`);
        } else {
          console.error(`  ${key}: ${value}`);
        }
      });
    }
    console.error('='.repeat(60) + '\n');
    
    // In production, you would write to a log file or external logging service
    // For now, console logging is sufficient
    
    res.status(200).json({ 
      success: true,
      message: 'Error logged successfully' 
    });
  } catch (error) {
    console.error('Failed to log client error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to log error' 
    });
  }
});

// ============================================================================
// PROGRESS TRACKING ENDPOINT - Day 9: Server-Sent Events (SSE)
// ============================================================================

// SSE endpoint for real-time progress updates
app.get('/api/v1/progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  console.log(`📡 SSE connection established for job: ${jobId}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

  // Listen for progress events
  const progressHandler = (event: any) => {
    if (event.jobId === jobId) {
      res.write(`data: ${JSON.stringify({ type: 'progress', ...event })}\n\n`);
      
      // Close connection when job completes/fails/cancels
      if (['completed', 'failed', 'cancelled'].includes(event.stage)) {
        console.log(`📡 SSE connection closing for job: ${jobId} (${event.stage})`);
        setTimeout(() => {
          res.write(`data: ${JSON.stringify({ type: 'close' })}\n\n`);
          res.end();
        }, 1000); // Give client time to receive final message
      }
    }
  };

  progressService.on('progress', progressHandler);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`📡 SSE connection closed by client for job: ${jobId}`);
    progressService.removeListener('progress', progressHandler);
  });
});

// Cancel extraction endpoint
app.post('/api/v1/cancel/:jobId',
  validateApiKey,
  (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const cancelled = progressService.cancelJob(jobId);
    
    if (cancelled) {
      res.json({
        success: true,
        message: 'Extraction cancelled successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found or already completed',
        },
      });
    }
  } catch (error) {
    console.error('❌ Cancel extraction error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel extraction',
      },
    });
  }
});

// Main extraction endpoint - Day 4: Now with comprehensive middleware, Day 7: With storage, Day 9: With progress tracking, Day 10: With caching
app.post('/api/v1/extract',
  rateLimiter,                    // Rate limiting (10 req/min)
  validateApiKey,                 // API key validation (if enabled)
  sanitizeRequestBody,            // Remove unexpected fields
  validateExtractionRequest,      // Validate request body
  async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Use jobId from request (Day 9: frontend-generated) or generate one
    const jobId = req.body.jobId || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const request: ExtractionRequest = {
      clinicalNotes: req.body.clinicalNotes,
      mode: req.body.mode || 'VALIDATED', // Always VALIDATED
      narrativeMode: req.body.narrativeMode,
      includeValidation: true, // ALWAYS true (enforced)
    };

    // Day 10: Check cache first
    // Generate cache key from clinical notes + narrative mode
    const cacheContent = `${request.clinicalNotes}:${request.narrativeMode || 'STANDARD'}`;
    const cachedResult = cacheService.get(cacheContent, 'extraction');

    if (cachedResult.success && cachedResult.value) {
      const processingTime = Date.now() - startTime;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`💚 Cache HIT - Returning cached extraction`);
      console.log(`   - Job ID: ${jobId}`);
      console.log(`   - Notes length: ${request.clinicalNotes.length} chars`);
      console.log(`   - Cache processing time: ${processingTime}ms`);
      console.log(`${'='.repeat(60)}\n`);

      // Return cached result with cache indicator
      return res.json({
        ...cachedResult.value,
        jobId,
        cached: true,
        processingTimeMs: processingTime,
      });
    }

    // Log request (validation already done by middleware)
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 New extraction request (validated by middleware)`);
    console.log(`   - Job ID: ${jobId}`);
    console.log(`   - Notes length: ${request.clinicalNotes.length} chars`);
    console.log(`   - Extraction mode: ${request.mode}`);
    console.log(`   - Narrative mode: ${request.narrativeMode || 'None'}`);
    console.log(`   - Validation: ALWAYS ON (enforced)`);
    console.log(`   - Cache: MISS - Processing new extraction`);
    console.log(`${'='.repeat(60)}\n`);

    // Process request with progress tracking (Day 9)
    const result = await orchestrator.extract(request, progressService, jobId);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Save to storage (Day 7)
    const stored = await extractionRepo.create(result, {
      processingTimeMs: processingTime,
      tokensUsed: result.metadata?.tokenCount?.input ? 
        result.metadata.tokenCount.input + (result.metadata.tokenCount.output || 0) : 
        undefined,
      cost: undefined, // TODO: Calculate cost based on token usage
    });
    
    console.log(`💾 Extraction saved with ID: ${stored.id}`);

    // Day 10: Cache the successful result
    cacheService.set(cacheContent, {
      ...result,
      extractionId: stored.id,
    }, 'extraction');

    console.log(`✅ Result cached for future requests`);

    // Return response with extraction ID and job ID
    return res.json({
      ...result,
      extractionId: stored.id, // Add extraction ID to response
      jobId, // Add job ID for progress tracking
      cached: false,
    });

  } catch (error) {
    console.error('❌ Extraction endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during extraction',
        details: serverConfig.nodeEnv === 'development' ? (error as Error).message : undefined,
      },
    });
  }
});

// ============================================================================
// STORAGE ENDPOINTS - Day 7
// ============================================================================

// Get extraction by ID
app.get('/api/v1/extractions/:id', 
  validateApiKey, 
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const stored = await extractionRepo.findById(id);
    
    if (!stored) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Extraction not found',
        },
      });
      return;
    }
    
    res.json({
      success: true,
      data: stored,
    });
  } catch (error) {
    console.error('❌ Get extraction error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve extraction',
      },
    });
  }
});

// List extractions with pagination
app.get('/api/v1/extractions', 
  validateApiKey, 
  async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const sortBy = (req.query.sortBy as 'timestamp' | 'id') || 'timestamp';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    
    // Date range filter
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const result = await extractionRepo.findAll(
      { page, pageSize, sortBy, sortOrder },
      startDate || endDate ? { startDate, endDate } : undefined
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ List extractions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list extractions',
      },
    });
  }
});

// Delete extraction by ID (admin only - requires API key)
app.delete('/api/v1/extractions/:id', 
  validateApiKey, 
  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const deleted = await extractionRepo.deleteById(id);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Extraction not found',
        },
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Extraction deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete extraction error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete extraction',
      },
    });
  }
});

// Get storage statistics
app.get('/api/v1/storage/stats', 
  validateApiKey, 
  async (_req: Request, res: Response) => {
  try {
    const stats = await extractionRepo.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Get storage stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get storage statistics',
      },
    });
  }
});

// ============================================================================
// CACHE ENDPOINTS - Day 10
// ============================================================================

// Get cache statistics
app.get('/api/v1/cache/stats',
  validateApiKey,
  (_req: Request, res: Response) => {
  try {
    const stats = cacheService.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Get cache stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get cache statistics',
      },
    });
  }
});

// Clear all cache entries
app.post('/api/v1/cache/clear',
  validateApiKey,
  (_req: Request, res: Response) => {
  try {
    const count = cacheService.clearAll();
    
    res.json({
      success: true,
      message: `Cleared ${count} cache entries`,
      clearedCount: count,
    });
  } catch (error) {
    console.error('❌ Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to clear cache',
      },
    });
  }
});

// Clear cache entries by type
app.post('/api/v1/cache/clear/:type',
  validateApiKey,
  (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    // Validate cache type
    const validTypes = ['extraction', 'terminology', 'validation', 'general'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CACHE_TYPE',
          message: `Invalid cache type. Must be one of: ${validTypes.join(', ')}`,
        },
      });
      return;
    }
    
    const count = cacheService.clearType(type as any);
    
    res.json({
      success: true,
      message: `Cleared ${count} cache entries of type '${type}'`,
      clearedCount: count,
      type,
    });
  } catch (error) {
    console.error('❌ Clear cache by type error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to clear cache by type',
      },
    });
  }
});

// Run cleanup (delete old extractions)
app.post('/api/v1/storage/cleanup', 
  validateApiKey, 
  async (_req: Request, res: Response) => {
  try {
    const deletedCount = await extractionRepo.cleanup();
    
    res.json({
      success: true,
      message: `Cleanup complete: deleted ${deletedCount} old extraction(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error('❌ Storage cleanup error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to run cleanup',
      },
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Start server
const server = app.listen(serverConfig.port, () => {
  const apiKeyStatus = getApiKeyStatus();
  
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 ${appMetadata.name} v${appMetadata.version}`);
  console.log('='.repeat(60));
  console.log();
  console.log(`📍 Server:      http://localhost:${serverConfig.port}`);
  console.log(`🏥 Health:      http://localhost:${serverConfig.port}/health`);
  console.log(`📋 Version:     http://localhost:${serverConfig.port}/api/v1/version`);
  console.log(`⚙️  Config:      http://localhost:${serverConfig.port}/api/v1/config`);
  console.log();
  console.log(`🔧 Environment: ${serverConfig.nodeEnv}`);
  console.log(`🤖 Model:       ${llmConfig.model}`);
  console.log(`🔒 Mode:        ${orchestratorConfig.extractionMode} (LOCKED)`);
  console.log(`✅ Validation:  ALWAYS ON (ENFORCED)`);
  console.log(`⚡ Caching:     ${orchestratorConfig.enableCaching ? 'Enabled' : 'Disabled'}`);
  console.log();
  console.log('='.repeat(60));
  console.log();
  console.log('✨ Features:');
  console.log('   - VALIDATED extraction mode (always ON)');
  console.log('   - QA validation layer (always ON)');
  console.log('   - Interactive validation dashboard');
  console.log('   - Discharge status deduction');
  console.log('   - Zero-hallucination enforcement');
  console.log();
  console.log('🛡️  Middleware (Day 4):');
  console.log('   - Request logging (all requests)');
  console.log('   - Rate limiting (10 req/min per IP)');
  console.log(`   - API key validation (${apiKeyStatus.enabled ? 'ENABLED' : 'DISABLED'})`);
  if (apiKeyStatus.enabled) {
    console.log(`     └─ ${apiKeyStatus.keysConfigured} key(s) configured`);
  }
  console.log('   - Request validation (comprehensive)');
  console.log('   - Request sanitization (XSS protection)');
  console.log('   - Response compression (Day 9, 1KB threshold, level 6)');
  console.log();
  console.log('📡 Endpoints:');
  console.log('   POST   /api/v1/extract            - Run extraction pipeline');
  console.log('   POST   /api/v1/logs/error         - Log client errors');
  console.log('   GET    /api/v1/version            - Get version info');
  console.log('   GET    /api/v1/config             - Get configuration');
  console.log('   GET    /health                    - Health check');
  console.log();
  console.log('📊 Progress Tracking (Day 9):');
  console.log('   GET    /api/v1/progress/:jobId    - SSE progress stream');
  console.log('   POST   /api/v1/cancel/:jobId      - Cancel extraction');
  console.log();
  console.log('📦 Storage Endpoints (Day 7):');
  console.log('   GET    /api/v1/extractions/:id    - Get extraction by ID');
  console.log('   GET    /api/v1/extractions        - List extractions (paginated)');
  console.log('   DELETE /api/v1/extractions/:id    - Delete extraction');
  console.log('   GET    /api/v1/storage/stats      - Get storage statistics');
  console.log('   POST   /api/v1/storage/cleanup    - Run retention cleanup');
  console.log();
  console.log('💾 Cache Endpoints (Day 10):');
  console.log('   GET    /api/v1/cache/stats        - Get cache statistics');
  console.log('   POST   /api/v1/cache/clear        - Clear all cache entries');
  console.log('   POST   /api/v1/cache/clear/:type  - Clear cache by type');
  console.log();
  console.log('='.repeat(60));
  console.log();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
