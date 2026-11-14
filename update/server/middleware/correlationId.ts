import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId =
    typeof incoming === 'string' && incoming.trim().length > 0 && incoming.startsWith('corr_')
      ? incoming.trim()
      : `corr_${crypto.randomUUID()}`;

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
