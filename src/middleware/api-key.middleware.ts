/**
 * API Key Validation Middleware
 * 
 * Optional authentication layer for API access control.
 * Day 4 Enhancement - Week 1
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * API key configuration from environment
 */
interface ApiKeyConfig {
  enabled: boolean;
  keys: string[];
  header: string;
}

/**
 * Get API key configuration from environment variables
 * 
 * @returns API key configuration
 */
function getApiKeyConfig(): ApiKeyConfig {
  const enabled = process.env.API_KEY_ENABLED === 'true';
  const keysEnv = process.env.API_KEYS || process.env.API_KEY || '';
  const keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
  const header = process.env.API_KEY_HEADER || 'x-api-key';

  return { enabled, keys, header };
}

/**
 * Validate API key middleware
 * 
 * Checks for valid API key in request headers.
 * Can be disabled via environment variable API_KEY_ENABLED=false
 * 
 * Configuration (via .env):
 * - API_KEY_ENABLED: "true" to enable, "false" to disable (default: false)
 * - API_KEYS: Comma-separated list of valid API keys
 * - API_KEY: Single API key (alternative to API_KEYS)
 * - API_KEY_HEADER: Header name to check (default: "x-api-key")
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns 401 if invalid key, or calls next()
 */
export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getApiKeyConfig();

  // If API key validation is disabled, skip
  if (!config.enabled) {
    next();
    return;
  }

  // If no API keys configured, log warning and allow (fail-open)
  if (config.keys.length === 0) {
    console.warn('⚠️  WARNING: API key validation enabled but no keys configured');
    console.warn('   Set API_KEYS or API_KEY environment variable');
    next();
    return;
  }

  // Get API key from header
  const providedKey = req.headers[config.header.toLowerCase()] as string;

  // Check if API key provided
  if (!providedKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required',
        details: `Please provide a valid API key in the '${config.header}' header.`
      }
    });
    return;
  }

  // Validate API key
  if (!config.keys.includes(providedKey)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        details: 'The provided API key is not authorized to access this resource.'
      }
    });
    return;
  }

  // API key valid, proceed
  next();
}

/**
 * Optional API key middleware
 * Allows requests without API key but validates if provided
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function optionalApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const config = getApiKeyConfig();

  // If disabled or no keys configured, skip
  if (!config.enabled || config.keys.length === 0) {
    next();
    return;
  }

  // Get API key from header
  const providedKey = req.headers[config.header.toLowerCase()] as string;

  // If no key provided, allow (optional)
  if (!providedKey) {
    next();
    return;
  }

  // If key provided, validate it
  if (!config.keys.includes(providedKey)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        details: 'The provided API key is not authorized. You can omit the API key for public access.'
      }
    });
    return;
  }

  // API key valid, proceed
  next();
}

/**
 * Check if API key validation is enabled
 * 
 * @returns True if API key validation is enabled
 */
export function isApiKeyEnabled(): boolean {
  return getApiKeyConfig().enabled;
}

/**
 * Check if a specific API key is valid
 * Useful for testing and admin operations
 * 
 * @param key - API key to validate
 * @returns True if key is valid
 */
export function isValidApiKey(key: string): boolean {
  const config = getApiKeyConfig();
  return config.enabled && config.keys.includes(key);
}

/**
 * Generate API key status for health checks
 * 
 * @returns API key status object
 */
export function getApiKeyStatus(): {
  enabled: boolean;
  keysConfigured: number;
  header: string;
} {
  const config = getApiKeyConfig();
  return {
    enabled: config.enabled,
    keysConfigured: config.keys.length,
    header: config.header
  };
}
