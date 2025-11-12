/**
 * Integration Tests: Full Middleware Chain
 * Tests the complete middleware stack with real HTTP requests
 */

import request from 'supertest';
import express, { Express } from 'express';
import {
  requestLogger,
  rateLimiter,
  validateApiKey,
  sanitizeRequestBody,
  validateExtractionRequest,
} from '../../src/middleware';

// Create test Express app with middleware chain
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  
  // Global middleware
  app.use(requestLogger);
  
  // Test endpoint with full middleware chain
  app.post(
    '/api/v1/extract',
    rateLimiter,
    validateApiKey,
    sanitizeRequestBody,
    validateExtractionRequest,
    (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Validation passed',
        receivedFields: Object.keys(req.body),
      });
    }
  );
  
  return app;
}

describe('Integration Tests: Middleware Chain', () => {
  let app: Express;
  
  beforeEach(() => {
    app = createTestApp();
    // Clear any environment variables
    delete process.env.API_KEY_ENABLED;
    delete process.env.API_KEYS;
  });
  
  describe('Valid requests', () => {
    it('should accept valid minimal request', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted on 2024-01-15 with headache. Workup completed. Discharged home on 2024-01-18 in stable condition with follow-up scheduled.',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.receivedFields).toContain('clinicalNotes');
    });
    
    it('should accept valid request with all optional fields', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted on 2024-01-15 with headache. Workup completed. Discharged home on 2024-01-18 in stable condition.',
          mode: 'VALIDATED',
          narrativeMode: 'STANDARD',
          dateFormat: 'AUTO',
          regionLocale: 'CA',
          dateFormatHints: 'Canadian date format expected',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.receivedFields).toEqual(
        expect.arrayContaining(['clinicalNotes', 'mode', 'narrativeMode', 'dateFormat', 'regionLocale', 'dateFormatHints'])
      );
    });
  });
  
  describe('Validation errors', () => {
    it('should reject request with missing clinicalNotes', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.errors[0].field).toBe('clinicalNotes');
    });
    
    it('should reject request with too-short clinicalNotes', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes: 'Too short' });
      
      expect(response.status).toBe(400);
      expect(response.body.error.errors[0].code).toBe('FIELD_TOO_SHORT');
    });
    
    it('should reject request with invalid mode', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
          mode: 'INVALID_MODE',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.errors[0].field).toBe('mode');
    });
    
    it('should reject request with invalid narrativeMode', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
          narrativeMode: 'INVALID',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.errors[0].field).toBe('narrativeMode');
    });
    
    it('should report multiple validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Short',
          mode: 'INVALID',
          dateFormat: 'INVALID',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.errors.length).toBeGreaterThan(1);
    });
  });
  
  describe('Sanitization', () => {
    it('should remove unexpected fields', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
          unexpectedField: 'malicious data',
          anotherBadField: '<script>alert("XSS")</script>',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.receivedFields).not.toContain('unexpectedField');
      expect(response.body.receivedFields).not.toContain('anotherBadField');
    });
  });
  
  describe('Rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/v1/extract')
          .send({
            clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
          });
        
        expect(response.status).toBe(200);
      }
    });
    
    it('should block 11th request (rate limit exceeded)', async () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/extract')
          .send({
            clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
          });
      }
      
      // 11th request should be blocked
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
        });
      
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
    
    it('should set rate limit headers', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
        });
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
  
  describe('API Key authentication (when enabled)', () => {
    beforeEach(() => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'test-key-123,test-key-456';
    });
    
    it('should reject request without API key', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_API_KEY');
    });
    
    it('should reject request with invalid API key', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .set('x-api-key', 'invalid-key')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_API_KEY');
    });
    
    it('should accept request with valid API key', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .set('x-api-key', 'test-key-123')
        .send({
          clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('Combined scenarios', () => {
    it('should validate after sanitization', async () => {
      const response = await request(app)
        .post('/api/v1/extract')
        .send({
          clinicalNotes: 'Short', // Too short
          unexpectedField: 'malicious',
        });
      
      // Should fail validation (after sanitization removes unexpected field)
      expect(response.status).toBe(400);
      expect(response.body.error.errors[0].code).toBe('FIELD_TOO_SHORT');
    });
    
    it('should enforce rate limit before validation', async () => {
      // Exhaust rate limit with valid requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/extract')
          .send({
            clinicalNotes: 'Patient admitted with stroke. CT showed large MCA infarct. Started on ASA and statin. Discharged to rehab.',
          });
      }
      
      // Next request should be rate limited (even though it's invalid)
      const response = await request(app)
        .post('/api/v1/extract')
        .send({ clinicalNotes: 'Short' }); // Invalid
      
      expect(response.status).toBe(429); // Rate limit, not validation error
    });
  });
});
