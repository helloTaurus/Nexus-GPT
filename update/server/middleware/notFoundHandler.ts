import type { Request, Response } from 'express';
import crypto from 'node:crypto';

export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Correlation-ID', correlationId);

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.path} does not exist`,
      correlationId
    }
  });
}
