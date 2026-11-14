import type { Request, Response, NextFunction } from 'express';
import { envConfig } from '../config/index.ts';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
  code?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitRecord>();

  // Background cleanup every 5 minutes to prevent memory leaks (CWE-400)
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  timer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Bypass in test environment or if flag is active
    if (envConfig.DISABLE_RATE_LIMIT) {
      next();
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || '127.0.0.1';
    const now = Date.now();
    let record = store.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs
      };
      store.set(ip, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, options.max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', options.max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.max) {
      res.setHeader('Retry-After', resetSeconds);
      res.status(429).json({
        success: false,
        error: {
          code: options.code || 'TOO_MANY_REQUESTS',
          message: options.message,
          correlationId: req.correlationId || 'unknown'
        }
      });
      return;
    }

    next();
  };
}

// Preset Limiters
export const authLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  code: 'TOO_MANY_REQUESTS'
});

export const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'API rate limit exceeded. Please try again later.',
  code: 'TOO_MANY_REQUESTS'
});
