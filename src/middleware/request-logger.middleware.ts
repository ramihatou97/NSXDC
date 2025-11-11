/**
 * Request Logger Middleware
 * 
 * Comprehensive request/response logging for debugging and monitoring.
 * Day 4 Enhancement - Week 1
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Request log entry interface
 */
interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  contentLength: number;
  query: Record<string, any>;
  bodySize: number;
  responseTime?: number;
  statusCode?: number;
  success?: boolean;
}

/**
 * Get client IP address
 * 
 * @param req - Express request object
 * @returns Client IP address
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Calculate size of request body in bytes
 * 
 * @param body - Request body
 * @returns Size in bytes
 */
function getBodySize(body: any): number {
  if (!body) return 0;
  try {
    return JSON.stringify(body).length;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 KB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format response time to human-readable string
 * 
 * @param ms - Time in milliseconds
 * @returns Formatted string (e.g., "1.23s" or "456ms")
 */
function formatResponseTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Request logger middleware
 * 
 * Logs incoming requests and outgoing responses with comprehensive details:
 * - Request: timestamp, method, path, IP, user-agent, body size
 * - Response: status code, response time, success flag
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Capture request details
  const log: RequestLog = {
    timestamp,
    method: req.method,
    path: req.path,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    contentLength: parseInt(req.headers['content-length'] || '0', 10),
    query: req.query,
    bodySize: getBodySize(req.body)
  };

  // Log request immediately
  console.log('\n' + '─'.repeat(80));
  console.log(`📥 ${log.method} ${log.path}`);
  console.log(`   Timestamp: ${log.timestamp}`);
  console.log(`   Client IP: ${log.ip}`);
  console.log(`   User-Agent: ${log.userAgent}`);
  
  if (Object.keys(log.query).length > 0) {
    console.log(`   Query: ${JSON.stringify(log.query)}`);
  }
  
  if (log.bodySize > 0) {
    console.log(`   Body Size: ${formatBytes(log.bodySize)}`);
  }
  
  console.log('─'.repeat(80));

  // Capture response using event listeners
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send to capture response
  res.send = function (body: any): Response {
    res.send = originalSend; // Restore original
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    log.responseTime = responseTime;
    log.statusCode = res.statusCode;
    log.success = res.statusCode >= 200 && res.statusCode < 400;

    // Log response
    const statusEmoji = log.success ? '✅' : '❌';
    
    console.log('\n' + '─'.repeat(80));
    console.log(`📤 ${statusEmoji} ${log.method} ${log.path} - ${log.statusCode}`);
    console.log(`   Response Time: ${formatResponseTime(responseTime)}`);
    console.log(`   Success: ${log.success}`);
    console.log('─'.repeat(80) + '\n');

    return originalSend.call(this, body);
  };

  // Override res.json to capture response
  res.json = function (body: any): Response {
    res.json = originalJson; // Restore original
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    log.responseTime = responseTime;
    log.statusCode = res.statusCode;
    log.success = res.statusCode >= 200 && res.statusCode < 400;

    // Log response
    const statusEmoji = log.success ? '✅' : '❌';
    
    console.log('\n' + '─'.repeat(80));
    console.log(`📤 ${statusEmoji} ${log.method} ${log.path} - ${log.statusCode}`);
    console.log(`   Response Time: ${formatResponseTime(responseTime)}`);
    console.log(`   Success: ${log.success}`);
    console.log('─'.repeat(80) + '\n');

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Minimal request logger (for production)
 * Logs only essential information without verbose details
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function minimalRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // Capture response
  const originalJson = res.json;
  res.json = function (body: any): Response {
    res.json = originalJson;
    const responseTime = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;
    const emoji = success ? '✅' : '❌';
    
    console.log(
      `${emoji} ${req.method} ${req.path} ${res.statusCode} ${formatResponseTime(responseTime)}`
    );
    
    return originalJson.call(this, body);
  };

  next();
}

/**
 * Detailed request logger with body content (for debugging)
 * WARNING: May log sensitive data - use only in development
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function detailedRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // Log full request
  console.log('\n' + '═'.repeat(80));
  console.log('📥 INCOMING REQUEST');
  console.log('═'.repeat(80));
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`IP: ${getClientIp(req)}`);
  console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`Body:`, JSON.stringify(req.body, null, 2));
  }
  
  console.log('═'.repeat(80));

  // Capture response with full body
  const originalJson = res.json;
  res.json = function (body: any): Response {
    res.json = originalJson;
    const responseTime = Date.now() - startTime;
    
    console.log('\n' + '═'.repeat(80));
    console.log('📤 OUTGOING RESPONSE');
    console.log('═'.repeat(80));
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response Time: ${formatResponseTime(responseTime)}`);
    console.log(`Body:`, JSON.stringify(body, null, 2));
    console.log('═'.repeat(80) + '\n');
    
    return originalJson.call(this, body);
  };

  next();
}
