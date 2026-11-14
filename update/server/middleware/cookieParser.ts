import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      cookies: Record<string, string>;
    }
  }
}

export function cookieParserMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        if (key) {
          try {
            req.cookies[key] = decodeURIComponent(val);
          } catch {
            req.cookies[key] = val;
          }
        }
      }
    }
  }
  next();
}
