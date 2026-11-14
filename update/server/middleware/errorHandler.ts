import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { AppError } from '../utils/errors.ts';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;

  // 1. Ensure security headers are stamped onto error responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Correlation-ID', correlationId);

  // 2. Handle Operational App Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        correlationId,
        ...(err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  // 3. Handle Express JSON Syntax Errors (Malformed Body)
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload provided',
        correlationId
      }
    });
    return;
  }

  // 4. Handle Payload Too Large (e.g. from express.json limit)
  if (err.type === 'entity.too.large' || err.status === 413) {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the maximum 10MB limit',
        correlationId
      }
    });
    return;
  }

  // 5. Handle Zod Schema Errors
  if (err.name === 'ZodError') {
    const issues = err.issues || [];
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: issues[0]?.message || 'Input validation failed',
        correlationId,
        details: issues.map((i: any) => ({
          field: Array.isArray(i.path) ? i.path.join('.') : i.path,
          message: i.message
        }))
      }
    });
    return;
  }

  // 6. Fail-Secure Unhandled Internal Errors (500)
  // Server-side logging: Full stack trace, path, method logged privately
  console.error(`[ErrorSanitizer] CorrelationId: ${correlationId} | ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err);

  // Client response: ABSOLUTELY ZERO stack trace, internal paths, or schema leaks
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
      correlationId
    }
  });
}
