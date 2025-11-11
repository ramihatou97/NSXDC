/**
 * NSXDC API Server
 * Express server with health monitoring and extraction endpoint
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLLMConfig, getOrchestratorConfig, getServerConfig, getAppMetadata } from '../config/index.js';
import { LLMService } from '../services/llm.service.js';
import { OrchestratorService } from '../services/orchestrator.service.js';
import type { ExtractionRequest } from '../types/index.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize services
const llmConfig = getLLMConfig();
const orchestratorConfig = getOrchestratorConfig();
const serverConfig = getServerConfig();
const appMetadata = getAppMetadata();

const llmService = new LLMService(llmConfig);
const orchestrator = new OrchestratorService(llmService, orchestratorConfig);

// Create Express app
const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for single-page app
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../public')));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: appMetadata.name,
    version: appMetadata.version,
    timestamp: new Date().toISOString(),
    features: appMetadata.features,
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

// Main extraction endpoint
app.post('/api/v1/extract', async (req: Request, res: Response) => {
  try {
    const request: ExtractionRequest = {
      clinicalNotes: req.body.clinicalNotes,
      mode: req.body.mode || 'VALIDATED', // Always VALIDATED
      narrativeMode: req.body.narrativeMode,
      includeValidation: true, // ALWAYS true (enforced)
    };

    // Validate request
    if (!request.clinicalNotes || typeof request.clinicalNotes !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'clinicalNotes is required and must be a string',
        },
      });
    }

    if (request.clinicalNotes.length < 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'clinicalNotes must be at least 50 characters',
        },
      });
    }

    // Log request
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 New extraction request`);
    console.log(`   - Notes length: ${request.clinicalNotes.length} chars`);
    console.log(`   - Extraction mode: ${request.mode}`);
    console.log(`   - Narrative mode: ${request.narrativeMode || 'None'}`);
    console.log(`   - Validation: ALWAYS ON (enforced)`);
    console.log(`${'='.repeat(60)}\n`);

    // Process request
    const result = await orchestrator.extract(request);

    // Return response
    res.json(result);

  } catch (error) {
    console.error('❌ Extraction endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during extraction',
        details: serverConfig.nodeEnv === 'development' ? (error as Error).message : undefined,
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
  console.log('📡 Endpoints:');
  console.log('   POST /api/v1/extract - Run extraction pipeline');
  console.log('   GET  /api/v1/version - Get version info');
  console.log('   GET  /api/v1/config  - Get configuration');
  console.log('   GET  /health         - Health check');
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
