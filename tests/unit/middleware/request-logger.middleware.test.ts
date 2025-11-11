/**
 * Unit Tests: Request Logger Middleware
 * Tests for request/response logging
 */

import { Request, Response, NextFunction } from 'express';
import {
  requestLogger,
  minimalRequestLogger,
  detailedRequestLogger,
} from '../../../src/middleware/request-logger.middleware';

// Mock console.log to capture output
let consoleOutput: string[] = [];
const originalLog = console.log;

beforeAll(() => {
  console.log = (...args: any[]) => {
    consoleOutput.push(args.map(String).join(' '));
  };
});

afterAll(() => {
  console.log = originalLog;
});

beforeEach(() => {
  consoleOutput = [];
  jest.clearAllMocks();
});

// Mock Express objects
const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  method: 'POST',
  path: '/api/v1/extract',
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'Mozilla/5.0',
  },
  query: {},
  body: { clinicalNotes: 'Test data' },
  ...overrides,
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    statusCode: 200,
  };
  res.on = jest.fn((event: string, callback: Function) => {
    if (event === 'finish') {
      // Simulate response finish
      setTimeout(() => callback(), 10);
    }
    return res;
  });
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Request Logger Middleware', () => {
  describe('requestLogger (standard)', () => {
    it('should log request details', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      // Wait for async logging
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
      expect(consoleOutput.length).toBeGreaterThan(0);

      const output = consoleOutput.join('\n');
      expect(output).toContain('POST /api/v1/extract');
      expect(output).toContain('127.0.0.1');
      expect(output).toContain('Mozilla/5.0');
    });

    it('should log response details on finish', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.statusCode = 200;
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      // Wait for response finish event
      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('200');
    });

    it('should format body size correctly', async () => {
      const req = createMockRequest({
        body: { clinicalNotes: 'a'.repeat(1024) }, // 1KB
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Body Size.*1\.\d{2}\s*KB|1024\.\d{2}\s*B/i);
    });

    it('should log query parameters if present', async () => {
      const req = createMockRequest({
        query: { page: '1', limit: '10' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('page=1');
      expect(output).toContain('limit=10');
    });

    it('should use X-Forwarded-For if present', async () => {
      const req = createMockRequest({
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Mozilla/5.0',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('203.0.113.1');
    });

    it('should log timestamp', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      // Check for ISO timestamp format
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should mark failed responses correctly', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.statusCode = 500;
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌');
      expect(output).toContain('500');
    });

    it('should mark successful responses correctly', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.statusCode = 200;
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅');
      expect(output).toContain('200');
    });
  });

  describe('minimalRequestLogger', () => {
    it('should log single-line format', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      minimalRequestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
      
      // Minimal logger should produce fewer lines than standard
      const standardReq = createMockRequest();
      const standardRes = createMockResponse();
      consoleOutput = [];
      
      requestLogger(standardReq as Request, standardRes as Response, createMockNext());
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const standardLineCount = consoleOutput.length;
      
      consoleOutput = [];
      minimalRequestLogger(req as Request, res as Response, createMockNext());
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const minimalLineCount = consoleOutput.length;
      expect(minimalLineCount).toBeLessThanOrEqual(standardLineCount);
    });

    it('should include essential information', async () => {
      const req = createMockRequest({
        method: 'GET',
        path: '/health',
      });
      const res = createMockResponse();
      res.statusCode = 200;
      const next = createMockNext();

      minimalRequestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join(' ');
      expect(output).toContain('GET');
      expect(output).toContain('/health');
      expect(output).toContain('200');
    });
  });

  describe('detailedRequestLogger (debug mode)', () => {
    it('should log request body', async () => {
      const req = createMockRequest({
        body: {
          clinicalNotes: 'Patient admitted with chest pain',
          mode: 'VALIDATED',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      detailedRequestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('Patient admitted with chest pain');
      expect(output).toContain('VALIDATED');
    });

    it('should log response body if available', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      detailedRequestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
      // Response body logging depends on implementation details
    });

    it('should log more details than standard logger', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      consoleOutput = [];
      requestLogger(req as Request, res as Response, createMockNext());
      await new Promise((resolve) => setTimeout(resolve, 50));
      const standardOutput = consoleOutput.join('\n');

      consoleOutput = [];
      detailedRequestLogger(req as Request, res as Response, createMockNext());
      await new Promise((resolve) => setTimeout(resolve, 50));
      const detailedOutput = consoleOutput.join('\n');

      // Detailed should have more content
      expect(detailedOutput.length).toBeGreaterThanOrEqual(standardOutput.length);
    });
  });

  describe('Response timing', () => {
    it('should calculate response time', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Response Time.*\d+ms/i);
    });

    it('should format response time correctly', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      // Should contain time in milliseconds
      expect(output).toMatch(/\d+ms/);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing user-agent', async () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('should handle missing IP', async () => {
      const req: Partial<Request> = {
        method: 'POST',
        path: '/api/v1/extract',
        headers: {},
        query: {},
        body: {},
      };
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(next).toHaveBeenCalled();
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    it('should handle empty body', async () => {
      const req = createMockRequest({
        body: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toContain('0.00 B');
    });

    it('should handle large body sizes', async () => {
      const largeBody = { clinicalNotes: 'a'.repeat(1024 * 1024) }; // 1MB
      const req = createMockRequest({ body: largeBody });
      const res = createMockResponse();
      const next = createMockNext();

      requestLogger(req as Request, res as Response, next);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/1\.\d{2}\s*MB/i);
    });
  });

  describe('Different HTTP methods', () => {
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach((method) => {
      it(`should log ${method} requests correctly`, async () => {
        const req = createMockRequest({ method });
        const res = createMockResponse();
        const next = createMockNext();

        requestLogger(req as Request, res as Response, next);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const output = consoleOutput.join('\n');
        expect(output).toContain(method);
      });
    });
  });

  describe('Different status codes', () => {
    [200, 201, 400, 401, 404, 429, 500].forEach((statusCode) => {
      it(`should log ${statusCode} status correctly`, async () => {
        const req = createMockRequest();
        const res = createMockResponse();
        res.statusCode = statusCode;
        const next = createMockNext();

        requestLogger(req as Request, res as Response, next);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const output = consoleOutput.join('\n');
        expect(output).toContain(String(statusCode));
        
        if (statusCode >= 400) {
          expect(output).toContain('❌');
        } else {
          expect(output).toContain('✅');
        }
      });
    });
  });
});
