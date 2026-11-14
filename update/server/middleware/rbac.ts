import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { UserRole } from '../repositories/types.ts';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', correlationId }
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient role permissions to access this resource',
          correlationId
        }
      });
      return;
    }

    next();
  };
}

export function requireOwnershipOrRole(
  getOwnerId: (req: Request) => string | Promise<string>,
  ...allowedRoles: UserRole[]
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', correlationId }
      });
      return;
    }

    if (allowedRoles.includes(user.role)) {
      return next();
    }

    const ownerId = await Promise.resolve(getOwnerId(req));
    if (user.profile.id === ownerId || user.id === ownerId) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: You are not authorized to access this resource',
        correlationId
      }
    });
  };
}

export function preventSelfApproval(
  getApplicantId: (req: Request) => string | Promise<string>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', correlationId }
      });
      return;
    }

    const applicantId = await Promise.resolve(getApplicantId(req));
    if (user.profile.id === applicantId || user.id === applicantId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SELF_APPROVAL_PROHIBITED',
          message: 'Self-approval is strictly prohibited by governance policy',
          correlationId
        }
      });
      return;
    }

    next();
  };
}
