import express, { type Application } from 'express';
import { correlationIdMiddleware } from './middleware/correlationId.ts';
import { securityHeadersMiddleware } from './middleware/securityHeaders.ts';
import { corsMiddleware } from './middleware/cors.ts';
import { cookieParserMiddleware } from './middleware/cookieParser.ts';
import { globalApiLimiter } from './middleware/rateLimiter.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { notFoundHandler } from './middleware/notFoundHandler.ts';

// Routers
import { healthRouter } from './routes/health.routes.ts';
import { apiV1Router } from './routes/index.ts';

export function createApp(): Application {
  const app = express();

  // 1. Disable server signature header (CWE-200)
  app.disable('x-powered-by');

  // 2. Correlation ID tracking (OWASP A09)
  app.use(correlationIdMiddleware);

  // 3. Security headers (Helmet compliant: nosniff, DENY, HSTS, CSP)
  app.use(securityHeadersMiddleware);

  // 4. CORS origin verification & credentials
  app.use(corsMiddleware);

  // 5. Body parsers with 10MB payload ceiling
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(
    express.raw({
      limit: '10mb',
      type: (req) => {
        const ct = req.headers['content-type'];
        return ct ? !ct.includes('application/json') && !ct.includes('application/x-www-form-urlencoded') : false;
      }
    })
  );

  // 6. Cookie parser for HttpOnly session tracking
  app.use(cookieParserMiddleware);

  // 7. Global API rate limiter (DoS protection)
  app.use('/api', globalApiLimiter);

  // 8. Public diagnostics endpoints (no auth required)
  app.use('/api/v1', healthRouter);

  // 9. Master API routes
  app.use('/api/v1', apiV1Router);

  // 10. 404 Catch-All
  app.use(notFoundHandler);

  // 11. Fail-Secure Global Error Sanitizer
  app.use(errorHandler);

  return app;
}
