import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getSessionRepository, getUserRepository } from '../repositories/dataStore.ts';
import type { UserAccount } from '../repositories/types.ts';
import { securityConfig } from '../config/index.ts';

declare global {
  namespace Express {
    interface Request {
      user?: UserAccount;
      sessionId?: string;
    }
  }
}

export function extractSessionToken(req: Request): string | null {
  // 1. Check parsed cookie object
  if (req.cookies && req.cookies[securityConfig.cookieName]) {
    return req.cookies[securityConfig.cookieName];
  }

  // 2. Check raw Cookie header
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/nexus_session=([a-zA-Z0-9_\-]+)/);
    if (match) return match[1];
    if (!cookieHeader.includes('=')) return cookieHeader.trim();
  }

  // 3. Check Bearer Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session authentication required',
        correlationId
      }
    });
    return;
  }

  const sessionRepo = getSessionRepository();
  const session = sessionRepo.findByToken(token);

  if (!session) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session token',
        correlationId
      }
    });
    return;
  }

  // Inactivity timeout (30 minutes) & absolute expiry (8 hours)
  const now = Date.now();
  const INACTIVITY_MS = securityConfig.sessionRollingInactivityMs;
  const ABSOLUTE_EXPIRY_MS = securityConfig.sessionAbsoluteExpiryMs;

  const lastActivity = new Date(session.lastActivityAt || session.createdAt).getTime();
  const createdTime = new Date(session.createdAt).getTime();

  if (now - lastActivity > INACTIVITY_MS || now - createdTime > ABSOLUTE_EXPIRY_MS) {
    await sessionRepo.deleteByToken(token);
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session has expired due to inactivity',
        correlationId
      }
    });
    return;
  }

  // Retrieve user account
  const userRepo = getUserRepository();
  const user = userRepo.findById(session.userId);

  if (!user) {
    await sessionRepo.deleteByToken(token);
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User account not found',
        correlationId
      }
    });
    return;
  }

  if (user.status !== 'ACTIVE') {
    res.status(403).json({
      success: false,
      error: {
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is suspended or deactivated',
        correlationId
      }
    });
    return;
  }

  // Update session sliding window
  await sessionRepo.touchSession(token);

  req.user = user;
  req.sessionId = token;
  next();
}
