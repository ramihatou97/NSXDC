/**
 * Rate Limiting Middleware
 * 
 * In-memory rate limiter with sliding window algorithm.
 * Day 4 Enhancement - Week 1
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Rate limit entry for tracking requests
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  requests: number[]; // Timestamps of requests for sliding window
}

/**
 * Rate limit store (in-memory)
 * In production, use Redis or similar distributed cache
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  message?: string;        // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
}

/**
 * Default rate limiter configuration
 */
const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60 * 1000,     // 1 minute
  maxRequests: 10,         // 10 requests per minute
  message: 'Too many requests, please try again later.',
  skipSuccessfulRequests: false,
  skipFailedRequests: false
};

/**
 * Get client identifier (IP address)
 * Falls back to socket address if IP is not available
 * 
 * @param req - Express request object
 * @returns Client identifier string
 */
function getClientIdentifier(req: Request): string {
  // Try to get real IP from X-Forwarded-For header (if behind proxy)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Fall back to direct connection IP
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Clean up expired entries from rate limit store
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredEntries(_windowMs: number): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Create rate limiter middleware with custom configuration
 * 
 * Implements sliding window algorithm:
 * - Tracks timestamps of all requests within the window
 * - Removes expired requests from the window
 * - Counts only active requests within the current window
 * 
 * @param config - Rate limiter configuration
 * @returns Express middleware function
 */
export function createRateLimiter(
  config: Partial<RateLimiterConfig> = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const options = { ...DEFAULT_CONFIG, ...config };

  // Cleanup expired entries every minute
  setInterval(() => cleanupExpiredEntries(options.windowMs), 60 * 1000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Get or create entry for this client
    let entry = rateLimitStore.get(clientId);
    
    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + options.windowMs,
        requests: []
      };
      rateLimitStore.set(clientId, entry);
    }

    // Remove expired requests from sliding window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (entry.requests.length >= options.maxRequests) {
      const oldestRequest = entry.requests[0];
      const retryAfter = Math.ceil((oldestRequest + options.windowMs - now) / 1000);

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message,
          details: `Maximum ${options.maxRequests} requests per ${options.windowMs / 1000} seconds exceeded.`,
          retryAfter: retryAfter,
          limit: options.maxRequests,
          window: options.windowMs / 1000,
          remaining: 0
        }
      });

      // Set Retry-After header (in seconds)
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(oldestRequest + options.windowMs).toISOString());
      
      return;
    }

    // Add current request to the window
    entry.requests.push(now);
    entry.count++;
    entry.resetTime = now + options.windowMs;

    // Set rate limit headers
    const remaining = options.maxRequests - entry.requests.length;
    res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    next();
  };
}

/**
 * Default rate limiter middleware (10 requests per minute)
 * Ready to use without configuration
 */
export const rateLimiter = createRateLimiter();

/**
 * Strict rate limiter for sensitive endpoints (5 requests per minute)
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Too many requests to this sensitive endpoint. Please try again later.'
});

/**
 * Lenient rate limiter for health checks (100 requests per minute)
 */
export const lenientRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'Rate limit exceeded for health check endpoint.'
});

/**
 * Get current rate limit status for a client
 * Useful for debugging and monitoring
 * 
 * @param req - Express request object
 * @returns Rate limit status or null if no entry exists
 */
export function getRateLimitStatus(req: Request): {
  requests: number;
  limit: number;
  remaining: number;
  resetTime: Date;
} | null {
  const clientId = getClientIdentifier(req);
  const entry = rateLimitStore.get(clientId);
  
  if (!entry) {
    return null;
  }

  const now = Date.now();
  const windowStart = now - DEFAULT_CONFIG.windowMs;
  const activeRequests = entry.requests.filter(timestamp => timestamp > windowStart);

  return {
    requests: activeRequests.length,
    limit: DEFAULT_CONFIG.maxRequests,
    remaining: Math.max(0, DEFAULT_CONFIG.maxRequests - activeRequests.length),
    resetTime: new Date(entry.resetTime)
  };
}

/**
 * Clear rate limit for a specific client
 * Useful for testing or admin operations
 * 
 * @param clientId - Client identifier (IP address)
 */
export function clearRateLimit(clientId: string): void {
  rateLimitStore.delete(clientId);
}

/**
 * Clear all rate limits
 * Useful for testing or system reset
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
