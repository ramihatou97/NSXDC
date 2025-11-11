/**
 * Unit Tests: Rate Limiter Middleware
 * Tests for sliding window rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import {
  createRateLimiter,
  rateLimiter,
  strictRateLimiter,
  lenientRateLimiter,
  getRateLimitStatus,
  clearRateLimit,
  clearAllRateLimits,
} from '../../../src/middleware/rate-limiter.middleware';

// Mock Express objects
const createMockRequest = (ip: string = '127.0.0.1'): Partial<Request> => ({
  ip,
  headers: {},
  method: 'POST',
  path: '/api/v1/extract',
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllRateLimits();
    jest.clearAllMocks();
  });

  describe('createRateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 3 });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Request 1
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();

      // Request 2
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();

      // Request 3
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding limit', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Request 1 & 2 should pass
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Request 3 should be blocked
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2); // Still 2, not called for 3rd request
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
            message: expect.stringContaining('Too many requests'),
          }),
        })
      );
    });

    it('should set X-RateLimit headers', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      limiter(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should track different IPs separately', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');
      const res = createMockResponse();
      const next = createMockNext();

      // IP1: 2 requests (at limit)
      limiter(req1 as Request, res as Response, next);
      limiter(req1 as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      // IP1: 3rd request should be blocked
      limiter(req1 as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).toHaveBeenCalledTimes(2);

      // IP2: Should still be allowed (different IP)
      jest.clearAllMocks();
      limiter(req2 as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use X-Forwarded-For header if present', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
      const req = createMockRequest('127.0.0.1');
      req.headers = { 'x-forwarded-for': '203.0.113.1' };
      const res = createMockResponse();
      const next = createMockNext();

      // Make 2 requests
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      // 3rd request should be blocked based on X-Forwarded-For IP
      limiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should handle sliding window correctly', async () => {
      const limiter = createRateLimiter({ windowMs: 100, maxRequests: 2 }); // 100ms window
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 2 requests (at limit)
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      // 3rd request should be blocked
      jest.clearAllMocks();
      limiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // After window expires, should be allowed again
      jest.clearAllMocks();
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }, 10000); // Increase timeout for async test

    it('should include Retry-After header when rate limited', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // First request passes
      limiter(req as Request, res as Response, next);

      // Second request blocked with Retry-After
      limiter(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('Default rate limiter variants', () => {
    it('rateLimiter should use 10 req/min default', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 10 requests (should all pass)
      for (let i = 0; i < 10; i++) {
        rateLimiter(req as Request, res as Response, next);
      }
      expect(next).toHaveBeenCalledTimes(10);

      // 11th request should be blocked
      jest.clearAllMocks();
      rateLimiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('strictRateLimiter should use 5 req/min limit', () => {
      clearAllRateLimits();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 5 requests (should all pass)
      for (let i = 0; i < 5; i++) {
        strictRateLimiter(req as Request, res as Response, next);
      }
      expect(next).toHaveBeenCalledTimes(5);

      // 6th request should be blocked
      jest.clearAllMocks();
      strictRateLimiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('lenientRateLimiter should use 100 req/min limit', () => {
      clearAllRateLimits();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Make 100 requests (should all pass)
      for (let i = 0; i < 100; i++) {
        lenientRateLimiter(req as Request, res as Response, next);
      }
      expect(next).toHaveBeenCalledTimes(100);

      // 101st request should be blocked
      jest.clearAllMocks();
      lenientRateLimiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status for tracked IP', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
      const req = createMockRequest('192.168.1.100');
      const res = createMockResponse();
      const next = createMockNext();

      // Make 3 requests
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);

      const status = getRateLimitStatus(req as Request);
      expect(status).toEqual({
        limit: 5,
        remaining: 2,
        reset: expect.any(Number),
      });
    });

    it('should return null for untracked IP', () => {
      const req = createMockRequest('192.168.1.200');
      const status = getRateLimitStatus(req as Request);
      expect(status).toBeNull();
    });
  });

  describe('clearRateLimit', () => {
    it('should clear rate limit for specific IP', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
      const req = createMockRequest('192.168.1.50');
      const res = createMockResponse();
      const next = createMockNext();

      // Make 2 requests (at limit)
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);

      // 3rd should be blocked
      jest.clearAllMocks();
      limiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);

      // Clear the limit
      clearRateLimit('192.168.1.50');

      // Should now be allowed again
      jest.clearAllMocks();
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');
      const res = createMockResponse();
      const next = createMockNext();

      // Exhaust limits for both IPs
      limiter(req1 as Request, res as Response, next);
      limiter(req2 as Request, res as Response, next);

      // Both should be blocked
      jest.clearAllMocks();
      limiter(req1 as Request, res as Response, next);
      limiter(req2 as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledTimes(2);

      // Clear all limits
      clearAllRateLimits();

      // Both should be allowed again
      jest.clearAllMocks();
      limiter(req1 as Request, res as Response, next);
      limiter(req2 as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing IP address', () => {
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
      const req: Partial<Request> = {
        headers: {},
        method: 'POST',
        path: '/api/v1/extract',
      };
      const res = createMockResponse();
      const next = createMockNext();

      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled(); // Should default to 'unknown' and proceed
    });

    it('should handle very short window correctly', () => {
      const limiter = createRateLimiter({ windowMs: 10, maxRequests: 1 });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Immediate 2nd request should be blocked
      jest.clearAllMocks();
      limiter(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });
});
