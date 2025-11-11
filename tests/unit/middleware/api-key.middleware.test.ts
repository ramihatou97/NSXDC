/**
 * Unit Tests: API Key Middleware
 * Tests for API key authentication
 */

import { Request, Response, NextFunction } from 'express';
import {
  validateApiKey,
  optionalApiKey,
  isApiKeyEnabled,
  isValidApiKey,
  getApiKeyStatus,
} from '../../../src/middleware/api-key.middleware';

// Store original env vars
const originalEnv = { ...process.env };

// Mock Express objects
const createMockRequest = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers,
  method: 'POST',
  path: '/api/v1/extract',
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('API Key Middleware', () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.API_KEY_ENABLED;
    delete process.env.API_KEYS;
    delete process.env.API_KEY;
    delete process.env.API_KEY_HEADER;
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateApiKey (required)', () => {
    it('should allow requests when API key validation is disabled', () => {
      process.env.API_KEY_ENABLED = 'false';
      
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests with missing API key when enabled', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'test-key-123,test-key-456';

      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'MISSING_API_KEY',
            message: expect.stringContaining('API key is required'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should block requests with invalid API key', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key-123,valid-key-456';

      const req = createMockRequest({ 'x-api-key': 'invalid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_API_KEY',
            message: expect.stringContaining('Invalid API key'),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests with valid API key from API_KEYS', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'key1,key2,key3';

      const req = createMockRequest({ 'x-api-key': 'key2' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests with valid API key from API_KEY (single)', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEY = 'single-api-key';

      const req = createMockRequest({ 'x-api-key': 'single-api-key' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use custom API key header name', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';
      process.env.API_KEY_HEADER = 'Authorization';

      const req = createMockRequest({ Authorization: 'valid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive header names', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({ 'X-API-KEY': 'valid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should trim whitespace from API keys', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = ' key1 , key2 , key3 ';

      const req = createMockRequest({ 'x-api-key': 'key2' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail-open if no keys configured but enabled', () => {
      process.env.API_KEY_ENABLED = 'true';
      // No API_KEYS or API_KEY set

      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      // Should allow (fail-open for safety)
      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalApiKey', () => {
    it('should allow requests without API key', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      optionalApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should validate API key if provided', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({ 'x-api-key': 'invalid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      optionalApiKey(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow valid API key', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({ 'x-api-key': 'valid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      optionalApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should respect disabled state', () => {
      process.env.API_KEY_ENABLED = 'false';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({ 'x-api-key': 'invalid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      optionalApiKey(req as Request, res as Response, next);

      // Should allow even with invalid key when disabled
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('isApiKeyEnabled', () => {
    it('should return true when API_KEY_ENABLED=true', () => {
      process.env.API_KEY_ENABLED = 'true';
      expect(isApiKeyEnabled()).toBe(true);
    });

    it('should return false when API_KEY_ENABLED=false', () => {
      process.env.API_KEY_ENABLED = 'false';
      expect(isApiKeyEnabled()).toBe(false);
    });

    it('should return false when API_KEY_ENABLED is not set', () => {
      delete process.env.API_KEY_ENABLED;
      expect(isApiKeyEnabled()).toBe(false);
    });

    it('should handle truthy string values', () => {
      process.env.API_KEY_ENABLED = '1';
      expect(isApiKeyEnabled()).toBe(true);

      process.env.API_KEY_ENABLED = 'TRUE';
      expect(isApiKeyEnabled()).toBe(true);

      process.env.API_KEY_ENABLED = 'yes';
      expect(isApiKeyEnabled()).toBe(true);
    });

    it('should handle falsy string values', () => {
      process.env.API_KEY_ENABLED = '0';
      expect(isApiKeyEnabled()).toBe(false);

      process.env.API_KEY_ENABLED = 'FALSE';
      expect(isApiKeyEnabled()).toBe(false);

      process.env.API_KEY_ENABLED = 'no';
      expect(isApiKeyEnabled()).toBe(false);
    });
  });

  describe('isValidApiKey', () => {
    it('should validate against API_KEYS list', () => {
      process.env.API_KEYS = 'key1,key2,key3';

      expect(isValidApiKey('key1')).toBe(true);
      expect(isValidApiKey('key2')).toBe(true);
      expect(isValidApiKey('key3')).toBe(true);
      expect(isValidApiKey('invalid')).toBe(false);
    });

    it('should validate against single API_KEY', () => {
      process.env.API_KEY = 'single-key';

      expect(isValidApiKey('single-key')).toBe(true);
      expect(isValidApiKey('wrong-key')).toBe(false);
    });

    it('should prioritize API_KEYS over API_KEY', () => {
      process.env.API_KEYS = 'key1,key2';
      process.env.API_KEY = 'single-key';

      expect(isValidApiKey('key1')).toBe(true);
      expect(isValidApiKey('key2')).toBe(true);
      expect(isValidApiKey('single-key')).toBe(false); // Not in API_KEYS
    });

    it('should trim whitespace', () => {
      process.env.API_KEYS = ' key1 , key2 , key3 ';

      expect(isValidApiKey('key1')).toBe(true);
      expect(isValidApiKey('key2')).toBe(true);
    });

    it('should return false if no keys configured', () => {
      delete process.env.API_KEYS;
      delete process.env.API_KEY;

      expect(isValidApiKey('any-key')).toBe(false);
    });

    it('should handle empty string keys', () => {
      process.env.API_KEYS = 'key1,,key2';

      expect(isValidApiKey('key1')).toBe(true);
      expect(isValidApiKey('key2')).toBe(true);
      expect(isValidApiKey('')).toBe(false);
    });
  });

  describe('getApiKeyStatus', () => {
    it('should return status when enabled with keys', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'key1,key2,key3';

      const status = getApiKeyStatus();

      expect(status).toEqual({
        enabled: true,
        keysConfigured: 3,
      });
    });

    it('should return status when disabled', () => {
      process.env.API_KEY_ENABLED = 'false';
      process.env.API_KEYS = 'key1,key2';

      const status = getApiKeyStatus();

      expect(status).toEqual({
        enabled: false,
        keysConfigured: 2,
      });
    });

    it('should count single API_KEY', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEY = 'single-key';

      const status = getApiKeyStatus();

      expect(status).toEqual({
        enabled: true,
        keysConfigured: 1,
      });
    });

    it('should return 0 keys if none configured', () => {
      process.env.API_KEY_ENABLED = 'true';

      const status = getApiKeyStatus();

      expect(status).toEqual({
        enabled: true,
        keysConfigured: 0,
      });
    });

    it('should ignore empty keys', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'key1,,key2,';

      const status = getApiKeyStatus();

      expect(status).toEqual({
        enabled: true,
        keysConfigured: 2,
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined environment variables', () => {
      delete process.env.API_KEY_ENABLED;
      delete process.env.API_KEYS;
      delete process.env.API_KEY;

      const req = createMockRequest({ 'x-api-key': 'any-key' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      // Should allow (disabled by default)
      expect(next).toHaveBeenCalled();
    });

    it('should handle malformed API_KEYS', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = ',,,';

      const status = getApiKeyStatus();
      expect(status.keysConfigured).toBe(0);
    });

    it('should handle very long API keys', () => {
      const longKey = 'a'.repeat(1000);
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = longKey;

      const req = createMockRequest({ 'x-api-key': longKey });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle special characters in API keys', () => {
      const specialKey = 'key-with-special!@#$%^&*()_+=chars';
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = specialKey;

      const req = createMockRequest({ 'x-api-key': specialKey });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should be case-sensitive for API key values', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'ValidKey123';

      const req = createMockRequest({ 'x-api-key': 'validkey123' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      // Should fail (case mismatch)
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Security considerations', () => {
    it('should not leak key information in error messages', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'secret-key-123';

      const req = createMockRequest({ 'x-api-key': 'invalid-key' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      const errorCall = (res.json as jest.Mock).mock.calls[0][0];
      const errorMessage = JSON.stringify(errorCall);
      
      // Should not contain the actual key
      expect(errorMessage).not.toContain('secret-key-123');
    });

    it('should handle empty API key header', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({ 'x-api-key': '' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only API key', () => {
      process.env.API_KEY_ENABLED = 'true';
      process.env.API_KEYS = 'valid-key';

      const req = createMockRequest({ 'x-api-key': '   ' });
      const res = createMockResponse();
      const next = createMockNext();

      validateApiKey(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
