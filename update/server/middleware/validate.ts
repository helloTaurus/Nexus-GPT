import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { ZodType } from '../schemas/zod.ts';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;

    // 1. Intercept unauthorized restricted field modification attempts for profile updates
    if (req.originalUrl?.includes('/portal/profile') || req.originalUrl?.includes('/employees/me') || req.path?.includes('/profile')) {
      const user = (req as any).user;
      if (user && user.role !== 'ADMIN' && req.body && typeof req.body === 'object') {
        const restricted = ['salary', 'title', 'role', 'staffId', 'designation'];
        const hasRestricted = restricted.some(field => field in req.body);
        if (hasRestricted) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot modify restricted compensation or role fields',
              correlationId
            }
          });
          return;
        }
      }
    }

    // 2. Check specific NUBAN error code mapping requirement
    if (req.body && typeof req.body === 'object' && req.body.bankAccountNumber !== undefined) {
      const val = String(req.body.bankAccountNumber).trim();
      if (!/^\d{10}$/.test(val)) {
        res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_NUBAN',
            message: 'Nigerian NUBAN account number must be exactly 10 digits',
            correlationId
          }
        });
        return;
      }
    }

    // 3. Check weak password error code mapping requirement
    if (
      (req.originalUrl?.includes('/recover/verify') ||
        req.originalUrl?.includes('/change-password') ||
        req.originalUrl?.includes('/reset-password')) &&
      req.body &&
      req.body.newPassword !== undefined
    ) {
      if (String(req.body.newPassword).length < 8) {
        res.status(422).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password must be at least 8 characters',
            correlationId
          }
        });
        return;
      }
    }

    // 4. Schema validation
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.message || 'Payload validation failed',
          correlationId,
          details: result.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        }
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.message || 'Query parameter validation failed',
          correlationId,
          details: result.error.errors
        }
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}
