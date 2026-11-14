import type { Request, Response, NextFunction } from 'express';
import { envConfig, securityConfig } from '../config/index.ts';

const ALLOWED_ORIGINS = new Set([
  ...securityConfig.corsAllowedOrigins,
  ...(envConfig.CORS_ORIGIN ? envConfig.CORS_ORIGIN.split(',').map(s => s.trim()) : [])
]);

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Correlation-ID, Set-Cookie');
    res.setHeader('Access-Control-Max-Age', '86400');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
