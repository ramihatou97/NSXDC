/**
 * Middleware Export Index
 * 
 * Central export point for all middleware functions.
 * Day 4 Enhancement - Week 1
 */

// Validation middleware
export {
  validateExtractionRequest,
  sanitizeRequestBody
} from './validation.middleware.js';

// Rate limiting middleware
export {
  createRateLimiter,
  rateLimiter,
  strictRateLimiter,
  lenientRateLimiter,
  getRateLimitStatus,
  clearRateLimit,
  clearAllRateLimits
} from './rate-limiter.middleware.js';

// Request logging middleware
export {
  requestLogger,
  minimalRequestLogger,
  detailedRequestLogger
} from './request-logger.middleware.js';

// API key validation middleware
export {
  validateApiKey,
  optionalApiKey,
  isApiKeyEnabled,
  isValidApiKey,
  getApiKeyStatus
} from './api-key.middleware.js';
