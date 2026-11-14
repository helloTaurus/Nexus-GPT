# Server Architecture & Express Middleware Specification (Milestone 2)

**Author:** `explorer_m2_1` (Server Architecture & Express Middleware Explorer)  
**Role:** Explorer / System Architect  
**Milestone:** M2 — DevSecOps Foundation, Zero-Trust Schemas & Auth/RBAC Backend Service  
**Date:** November 10, 2026  
**Status:** Approved Architectural Blueprint  

---

## 1. Executive Summary & Architectural Overview

This document specifies the complete, production-grade Express 4 application architecture for `update/server/`. It establishes the foundational HTTP runtime, security middleware pipeline, diagnostics, brute-force protections, fail-secure error handling, and lifecycle orchestration required to power the Nexus Finance HRMS & Expense Management Suite (Zoho People Replication).

### 1.1 Architectural Objectives
1. **DevSecOps Zero-Trust Foundation**: Apply OWASP Top 10, NIST SSDF (SP 800-218), SEI CERT Coding Standards, CWE / SANS Top 25, and Microsoft SDL across the entire HTTP boundary.
2. **Deterministic Middleware Pipeline**: Strictly sequence request tracking, security headers, CORS origin verification, parsing, rate limiting, and route handling to eliminate bypass vectors.
3. **Fail-Secure Error Masking**: Completely prevent information disclosure (CWE-209 / OWASP A09) by masking stack traces and internal paths from clients while guaranteeing unique correlation IDs (`corr_${uuid}`) for auditability.
4. **Resilient Server Lifecycle**: Deliver robust port resolution, transactional store initialization before socket listening, and signal-trapped graceful shutdown (`SIGTERM`, `SIGINT`).
5. **Seamless Test Suite Integration**: Support both standalone server execution on port 3001 (for live E2E verification via `API_BASE_URL="http://127.0.0.1:3001"`) and decoupled in-process app export.

---

## 2. Directory Layout & Code Organization

The backend server is isolated inside `update/server/`, completely separating the Node.js/Express service from client-side React code:

```
update/server/
├── index.ts                     # Server entry point: process lifecycle, store boot, port binding, graceful shutdown
├── app.ts                       # Express application factory: middleware assembly, route mounting
├── config/
│   ├── index.ts                 # Centralized configuration loader with validated defaults
│   ├── env.ts                   # Environment variable parser (PORT, HOST, NODE_ENV)
│   └── security.ts              # Security settings (CORS allowlist, CSP directives, cookie flags)
├── middleware/
│   ├── correlationId.ts         # Request tracking: extracts or assigns X-Correlation-ID
│   ├── securityHeaders.ts       # Helmet-compliant HTTP headers (nosniff, DENY, HSTS, CSP)
│   ├── cors.ts                  # Secure CORS middleware with origin whitelist & credentials
│   ├── cookieParser.ts          # RFC 6265 compliant cookie decoder for session tokens
│   ├── rateLimiter.ts           # Sliding-window brute force & DoS limiter (login & global API)
│   ├── errorHandler.ts          # Fail-secure error sanitizer & RFC 7807 problem details mapper
│   ├── auth.ts                  # [explorer_m2_2] HttpOnly session validator
│   ├── rbac.ts                  # [explorer_m2_2] Role-based access control guard
│   └── validate.ts              # [explorer_m2_2] Zero-trust Zod schema validator
├── routes/
│   ├── index.ts                 # Master router aggregating all /api/v1 endpoints
│   ├── health.routes.ts         # Public diagnostic endpoints (/api/v1/health)
│   ├── auth.routes.ts           # [explorer_m2_2] Authentication endpoints (/api/v1/auth/*)
│   ├── portal.routes.ts         # [explorer_m2_2] Employee profile endpoints (/api/v1/portal/*)
│   ├── employees.routes.ts      # [explorer_m2_2/m2_3] Workforce directory & admin onboarding
│   ├── admin.routes.ts          # [explorer_m2_3] Settings & audit log endpoints (/api/v1/admin/*)
│   ├── leaves.routes.ts         # [Milestone 3] Leave balance & request workflows
│   ├── expenses.routes.ts       # [Milestone 4] Itemized expense filing & reimbursement
│   └── appraisals.routes.ts     # [Milestone 5] Performance appraisal review cycles
├── controllers/                 # Thin route handlers delegating to domain services
├── services/                    # Business logic and domain rules
│   └── auditService.ts          # [explorer_m2_3] Immutable append-only audit trail logger
├── repositories/                # [explorer_m2_3] Transactional storage abstractions
└── data/                        # [explorer_m2_3] Atomic JSON persistent storage
```

---

## 3. Server Startup, Port Resolution & Graceful Shutdown (`index.ts`)

### 3.1 Design Invariants
- **Port Resolution**: Defaults to port `3001` (`process.env.PORT || 3001`), matching the project architecture specification and the test runner target (`http://127.0.0.1:3001`).
- **Host Binding**: Configurable via `process.env.HOST || '0.0.0.0'` (or `'127.0.0.1'`).
- **Store Pre-Warming**: The server must asynchronously initialize the persistence layer (`await initializeDataStore()`) **prior** to invoking `server.listen()`. This eliminates race conditions where incoming HTTP requests attempt to read uninitialized files.
- **Dual Export Pattern**: `app.ts` exports the Express application instance, while `index.ts` manages process runtime execution.

### 3.2 Graceful Shutdown Flow
1. Intercept `SIGTERM` (container orchestrator termination) and `SIGINT` (`Ctrl+C` interrupt).
2. Intercept `uncaughtException` and `unhandledRejection` (fatal runtime errors).
3. Set internal shutdown flag `isShuttingDown = true` so new incoming requests can receive a `503 Service Unavailable` header (`Connection: close`).
4. Invoke `server.close(...)` to stop accepting new TCP sockets and gracefully drain active requests.
5. Invoke persistence synchronization (`await closeDataStore()`) to flush pending transactional logs to disk.
6. Guard with a strict 10-second force-kill timeout (`setTimeout(..., 10000).unref()`) to prevent hanging processes.

### 3.3 Concrete Implementation Blueprint (`update/server/index.ts`)
```ts
import http from 'node:http';
import { createApp } from './app.ts';
import { envConfig } from './config/index.ts';
// explorer_m2_3 store lifecycle
import { initializeDataStore, closeDataStore } from './repositories/dataStore.ts';

async function bootstrap() {
  console.log(`[Bootstrap] Initializing Nexus Finance HRMS Server (Environment: ${envConfig.NODE_ENV})...`);

  // Step 1: Initialize persistent data store (file-locked / SQLite)
  try {
    await initializeDataStore();
    console.log('[Bootstrap] Persistent data store initialized and verified.');
  } catch (storeError) {
    console.error('[Bootstrap] Fatal error initializing data store:', storeError);
    process.exit(1);
  }

  // Step 2: Create Express application instance
  const app = createApp();
  const server = http.createServer(app);

  const PORT = envConfig.PORT;
  const HOST = envConfig.HOST;

  // Step 3: Bind HTTP listener
  server.listen(PORT, HOST, () => {
    console.log(`======================================================`);
    console.log(` Nexus Finance Backend Service Running`);
    console.log(` Address: http://${HOST}:${PORT}`);
    console.log(` Health:  http://${HOST}:${PORT}/api/v1/health`);
    console.log(`======================================================`);
  });

  // Step 4: Graceful Shutdown Orchestration
  let isShuttingDown = false;

  async function handleGracefulShutdown(signal: string, exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Process] Received ${signal}. Starting graceful shutdown sequence...`);

    // Forceful shutdown guard
    const forceTimer = setTimeout(() => {
      console.error('[Process] Forceful shutdown initiated due to timeout (10s). Active sockets remained.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    server.close(async (err) => {
      if (err) {
        console.error('[Process] Error closing HTTP server listener:', err);
        process.exit(1);
      }
      console.log('[Process] HTTP listener closed. Active connections drained.');

      try {
        await closeDataStore();
        console.log('[Process] Storage handles synchronized and closed.');
      } catch (flushErr) {
        console.error('[Process] Error during data store cleanup:', flushErr);
      }

      console.log('[Process] Graceful shutdown completed. Exiting process.');
      process.exit(exitCode);
    });
  }

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM', 0));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT', 0));

  process.on('uncaughtException', (error) => {
    console.error('[Process] FATAL Uncaught Exception:', error);
    handleGracefulShutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Process] FATAL Unhandled Promise Rejection:', reason);
    handleGracefulShutdown('unhandledRejection', 1);
  });
}

// Execute bootstrap when invoked directly
bootstrap();
```

---

## 4. Deterministic Middleware Pipeline

The pipeline order in Express is strictly deterministic. Any misplacement introduces vulnerabilities (e.g., placing rate limiters after body parsers enables parser-level DoS, or placing error handlers before routes misses exceptions).

```
   HTTP Request Received
             │
             ▼
┌──────────────────────────────────────────────┐
│  1. Correlation ID Middleware                │  --> Sets req.correlationId & X-Correlation-ID header
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  2. Security Headers (Helmet / Custom)       │  --> nosniff, DENY, HSTS, CSP, no-powered-by
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  3. CORS Origin Validation & Preflight       │  --> Origin whitelist, credentials: true, OPTIONS 204
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  4. Body & Cookie Parsers                    │  --> json({ limit: '10mb' }), urlencoded, cookie decoder
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  5. Global API Rate Limiter                  │  --> 500 req / 15 min per IP (CWE-400 DoS defense)
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  6. Diagnostics Route (/api/v1/health)       │  --> Public, non-blocking health check
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  7. Auth Rate Limiter (Brute-Force Guard)    │  --> 10 req / 15 min on /api/v1/auth/login
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  8. Application Routes (/api/v1/*)           │  --> Auth, Portal, Leaves, Expenses, Appraisals, Admin
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  9. 404 Not Found Catch-All                  │  --> Standardized NOT_FOUND error envelope
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  10. Fail-Secure Error Sanitizer (4 params)  │  --> OWASP A09 / SDL compliant error masking
└──────────────────────────────────────────────┘
             │
             ▼
   HTTP Response Dispatched
```

---

## 5. Security Middleware Specifications

### 5.1 Correlation ID Middleware (`middleware/correlationId.ts`)
- **Requirement**: OWASP A09 (Security Logging and Monitoring Failures) & Test Suite compliance (`tests/e2e/tier1-features/auth-rbac.test.ts:145`).
- **Function**:
  1. Inspects incoming `X-Correlation-ID` or `X-Request-ID` header.
  2. If absent or invalid format, generates a cryptographically random identifier: `corr_${crypto.randomUUID()}`.
  3. Attaches identifier to `req.correlationId`.
  4. Echoes `X-Correlation-ID: req.correlationId` on the outgoing response.
  5. Propagates `req.correlationId` into all loggers, audit trails, and error payloads.

```ts
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
  const correlationId = typeof incoming === 'string' && incoming.trim().length > 0
    ? incoming.trim()
    : `corr_${crypto.randomUUID()}`;

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
```

---

### 5.2 Security Headers Middleware (`middleware/securityHeaders.ts`)
- **Requirements**:
  - OWASP A05 (Security Misconfiguration)
  - CWE-79 (Cross-Site Scripting)
  - CWE-1021 (Clickjacking)
  - CWE-430 (MIME Sniffing)
  - Verified by tests: `tests/e2e/tier1-features/audit-security.test.ts:85-87`.
- **Enforced Headers**:
  - `X-Content-Type-Options: nosniff`: Mandatory. Strictly prevents browsers from sniffing MIME types away from declared `Content-Type`.
  - `X-Frame-Options: DENY`: Mandatory. Completely prohibits embedding in `<frame>`, `<iframe>`, `<embed>`, or `<object>`, neutralizing clickjacking.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`: Mandatory. Enforces HTTPS for at least 1 year across all subdomains.
  - `Content-Security-Policy`:
    ```
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com data:;
    img-src 'self' data: blob:;
    connect-src 'self' http://localhost:* ws://localhost:*;
    frame-ancestors 'none';
    object-src 'none';
    base-uri 'self'
    ```
  - `X-XSS-Protection: 0`: Disables legacy, flawed browser XSS filters that introduced side-channel vulnerabilities.
  - `Referrer-Policy: strict-origin-when-cross-origin`: Protects sensitive URL path parameters during cross-origin requests.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Restricts sensitive browser hardware APIs.
  - Disable `app.disable('x-powered-by')` to prevent attacker fingerprinting (CWE-200).

```ts
import type { Request, Response, NextFunction } from 'express';

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:*; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
  );
  next();
}
```

---

### 5.3 CORS Configuration (`middleware/cors.ts`)
- **Requirements**:
  - OWASP A01 (Broken Access Control)
  - CWE-346 (Origin Validation Error)
  - CWE-352 (Cross-Site Request Forgery)
- **Rules**:
  1. **Strict Origin Matching**: Validate `Origin` header against an allowlist:
     - `http://localhost:5173` (Vite dev client)
     - `http://127.0.0.1:5173` (Vite dev IP)
     - `http://localhost:3000` (Alternative client)
     - `http://127.0.0.1:3000` (Alternative client)
     - Configurable origins via `process.env.CORS_ORIGIN`.
  2. **Credentials Support**: `Access-Control-Allow-Credentials: true` is strictly required for the browser to transmit the `nexus_session` HttpOnly cookie.
  3. **No Wildcard with Credentials**: Setting `Access-Control-Allow-Origin: *` while `credentials: true` is illegal in browsers and explicitly violates OWASP A05.
  4. **Preflight Optimization**: Fast response (`204 No Content`) for `OPTIONS` requests with `Access-Control-Max-Age: 86400`.

```ts
import type { Request, Response, NextFunction } from 'express';
import { envConfig } from '../config/index.ts';

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(envConfig.CORS_ORIGIN ? envConfig.CORS_ORIGIN.split(',').map(s => s.trim()) : [])
]);

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Correlation-ID, Set-Cookie');
    res.setHeader('Access-Control-Max-Age', '86400');
  } else if (!origin) {
    // Non-browser / same-origin / internal tool request
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
```

---

### 5.4 Cookie Parsing Middleware (`middleware/cookieParser.ts`)
- **Requirement**: Decode RFC 6265 cookie header without external dependency vulnerability overhead (or using installed `cookie` module in `node_modules`).
- **Function**: Parses `req.headers.cookie` and populates `req.cookies` object containing `nexus_session`.

```ts
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
          req.cookies[key] = decodeURIComponent(val);
        }
      }
    }
  }
  next();
}
```

---

### 5.5 Brute-Force & Credential Stuffing Rate Limiter (`middleware/rateLimiter.ts`)
- **Requirements**:
  - OWASP A07 (Identification and Authentication Failures)
  - NIST SP 800-63B (Digital Identity Guidelines — Memorized Secret Authenticators)
  - CWE-307 (Improper Restriction of Excessive Authentication Attempts)
  - CWE-400 (Uncontrolled Resource Consumption)
- **Architecture**:
  - Sliding-window in-memory bucket keyed by client IP (`req.ip || req.headers['x-forwarded-for']`).
  - Distinct limits:
    - **Auth Login Limiter (`authLoginLimiter`)**: Applied strictly to `POST /api/v1/auth/login` and `POST /api/v1/auth/recover/request`. Max **10 attempts** per **15 minutes**.
    - **Global API Limiter (`globalApiLimiter`)**: Applied across all `/api/v1/*` routes. Max **500 requests** per **15 minutes**.
  - **Memory Leak Protection**: Automatic background interval (`setInterval(..., 5 * 60 * 1000).unref()`) purges expired bucket entries.
  - **Test Environment Bypass**: When `process.env.NODE_ENV === 'test'` or `process.env.DISABLE_RATE_LIMIT === 'true'`, rate limiting is bypassed to enable ultra-fast execution of the 122 automated test suites without false positive throttling.
  - **Standard Headers & Response**:
    - Emits `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After`.
    - Returns HTTP `429 Too Many Requests` in standardized fail-secure envelope.

```ts
import type { Request, Response, NextFunction } from 'express';

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
    // Bypass in test suite runner
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
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
  max: 10,                   // 10 failed attempts
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  code: 'TOO_MANY_REQUESTS'
});

export const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'API rate limit exceeded. Please try again later.',
  code: 'TOO_MANY_REQUESTS'
});
```

---

## 6. Health & Diagnostics Endpoint (`routes/health.routes.ts`)

- **Requirements**: System diagnostic monitoring, cloud load balancer readiness checks, operational health validation.
- **Path**: `GET /api/v1/health`
- **Access**: Public, unauthenticated, non-blocking.
- **Payload Schema**:
```json
{
  "status": "healthy",
  "uptime": 245.12,
  "timestamp": "2026-11-10T00:30:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "checks": {
    "server": "ok",
    "storage": "connected"
  },
  "memory": {
    "rssMb": 42.15,
    "heapUsedMb": 21.84
  }
}
```

### Concrete Implementation (`update/server/routes/health.routes.ts`)
```ts
import { Router, type Request, type Response } from 'express';
import { envConfig } from '../config/index.ts';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: envConfig.NODE_ENV,
    checks: {
      server: 'ok',
      storage: 'connected'
    },
    memory: {
      rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2))
    }
  });
});

healthRouter.get('/ping', (_req: Request, res: Response) => {
  res.status(200).send('pong');
});
```

---

## 7. Fail-Secure Error Sanitizer (`middleware/errorHandler.ts`)

### 7.1 Security Rationale & Threat Model
- **OWASP Top 10 (A09 — Security Logging and Monitoring Failures)**: Logging must capture forensic details server-side while never echoing sensitive internals back to untrusted callers.
- **Microsoft Security Development Lifecycle (SDL)**: Error messages must fail securely, returning generic, sanitized descriptions that mask internal architecture, database structures, file paths, and stack frames (CWE-209).
- **SEI CERT ERR01-J**: Prevent information leakage across network trust boundaries.
- **E2E Test Assertion**: Verified directly by `tests/e2e/tier1-features/auth-rbac.test.ts:140-148` and `audit-security.test.ts:65-79` ("Stack trace should not leak").

### 7.2 Custom Error Hierarchy (`update/server/utils/errors.ts`)
To allow controllers and services to throw strongly-typed domain errors with predictable HTTP status codes, define the `AppError` base class:

```ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Session authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(409, code, message);
  }
}

export class PolicyViolationError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(422, code, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'Payload exceeds maximum allowed limit (10MB)') {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'File type not permitted') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}
```

### 7.3 Fail-Secure Error Sanitizer Implementation (`update/server/middleware/errorHandler.ts`)
```ts
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

  // Step 1: Ensure security headers are stamped onto error responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Correlation-ID', correlationId);

  // Step 2: Handle Operational App Errors
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

  // Step 3: Handle Express JSON Syntax Errors (Malformed Body)
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

  // Step 4: Handle Payload Too Large (e.g. from express.json limit)
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

  // Step 5: Handle Zod Schema Errors (if thrown directly)
  if (err.name === 'ZodError') {
    const issues = err.issues || [];
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: issues[0]?.message || 'Input validation failed',
        correlationId,
        details: issues.map((i: any) => ({
          field: i.path.join('.'),
          message: i.message
        }))
      }
    });
    return;
  }

  // Step 6: Fail-Secure Unhandled Internal Errors (500)
  // Server-side logging: Full stack trace, path, method, and parameters logged privately
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
```

### 7.4 404 Not Found Catch-All Handler (`middleware/notFoundHandler.ts`)
```ts
import type { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = req.correlationId || 'unknown';
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.path} does not exist`,
      correlationId
    }
  });
}
```

---

## 8. Express Application Assembly (`app.ts`)

`update/server/app.ts` centralizes the Express setup and middleware sequence:

```ts
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
```

---

## 9. Coordination Contracts with Peer Explorers

### 9.1 Coordination with `explorer_m2_2` (Zero-Trust Schemas & Auth/RBAC)
1. **Router Integration**:
   - `apiV1Router` mounts `authRouter` at `/api/v1/auth` (Login, Logout, Me, Recover).
   - `apiV1Router` mounts `portalRouter` at `/api/v1/portal` (Profile GET/PATCH).
2. **Session Context Injection**:
   - `auth.ts` middleware extracts `req.cookies.nexus_session` and validates session token against data store.
   - Attaches authenticated user object to `req.user`:
     ```ts
     interface AuthenticatedUser {
       id: string;
       email: string;
       role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
       profile: {
         id: string;
         staffId: string;
         firstName: string;
         lastName: string;
         department: string;
         departmentId: string;
         designation: string;
         designationId: string;
         managerId: string | null;
       };
     }
     ```
3. **Cookie Contract**:
   - Login sets `nexus_session` cookie:
     `nexus_session=<token>; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
   - Logout clears cookie:
     `nexus_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
4. **Validation Contract**:
   - `validateBody(schema)`, `validateQuery(schema)`, `validateParams(schema)` catches Zod errors and forwards them to `next(error)` so `errorHandler.ts` formats the response with `correlationId`.

### 9.2 Coordination with `explorer_m2_3` (Transactional Store & Audit Service)
1. **Store Lifecycle Hooks**:
   - `index.ts` imports `initializeDataStore()` and awaits it before listening.
   - `index.ts` invokes `closeDataStore()` upon `SIGTERM` / `SIGINT`.
2. **Audit Service Telemetry**:
   - Controllers invoke `auditService.recordAuditLog(actorId, action, entityType, entityId, req.ip, req.headers['user-agent'], diff)`.
   - `admin.routes.ts` mounts `GET /api/v1/admin/audit-logs` protected by `requireRole('ADMIN')`.
3. **Database Seed Data**:
   - Conforms exactly to `tests/fixtures/seedData.ts` (accounts: `admin@nexusfinance.ng`, `manager@nexusfinance.ng`, `employee@nexusfinance.ng`, `chioma.okonkwo@nexusfinance.ng`, `finance@nexusfinance.ng`, `depthead@nexusfinance.ng`, `inactive@nexusfinance.ng`).

---

## 10. Verification & Test Alignment

The designed Express server architecture directly addresses the E2E test suites in `tests/`:

| Test Suite / Assertion | Requirement | Architecture Component |
|---|---|---|
| `auth-rbac.test.ts:139-148` | Fail-secure error response envelopes include `correlationId` and security headers | `errorHandler.ts` & `securityHeaders.ts` |
| `audit-security.test.ts:65-79` | Fail-secure error sanitizer never exposes internal stack traces | `errorHandler.ts` |
| `audit-security.test.ts:81-88` | Security headers enforced on every HTTP response (`nosniff`, `DENY`, `HSTS`) | `securityHeaders.ts` |
| `auth-rbac.test.ts:9-19` | Session cookie `nexus_session` issued with HttpOnly/SameSite | `cookieParser.ts` & `auth.routes.ts` |
| `auth-rbac-boundaries.test.ts:9-14` | Login with empty credentials returns 400 `VALIDATION_ERROR` | `validate.ts` & `errorHandler.ts` |
| `auth-rbac-boundaries.test.ts:16-28` | Incorrect password or unknown user returns 401 `INVALID_CREDENTIALS` | `errorHandler.ts` |
| `auth-rbac-boundaries.test.ts:30-35` | Deactivated user returns 403 `ACCOUNT_INACTIVE` | `errorHandler.ts` |
| `expense-boundaries.test.ts:109-110` | 10MB payload size limit enforcement returns 413 `PAYLOAD_TOO_LARGE` | `express.json({ limit: '10mb' })` |
| `TEST_INFRA.md:168` | Direct live server test execution via `API_BASE_URL="http://127.0.0.1:3001"` | `index.ts` running on port 3001 |

### Verification Command
Once implemented by the worker, the server can be booted and verified with:
```powershell
# Terminal 1: Start Express server
cd update
npx tsx server/index.ts

# Terminal 2: Run complete 122-test E2E suite against live Express server
$env:API_BASE_URL="http://127.0.0.1:3001"
node tests/testRunner.ts
```

---

## 11. Implementation Action Plan for Workers

1. **Step 1: Configuration & Utilities**:
   - Create `update/server/config/index.ts` and `update/server/utils/errors.ts`.
2. **Step 2: Core Middleware Suite**:
   - Implement `correlationId.ts`, `securityHeaders.ts`, `cors.ts`, `cookieParser.ts`, and `rateLimiter.ts`.
3. **Step 3: Error Sanitizer & Diagnostics**:
   - Implement `errorHandler.ts`, `notFoundHandler.ts`, and `routes/health.routes.ts`.
4. **Step 4: Application Assembly & Master Router**:
   - Implement `update/server/app.ts` and `update/server/routes/index.ts`.
5. **Step 5: Process Bootstrap & Signal Handling**:
   - Implement `update/server/index.ts`.
6. **Step 6: Package Script Update**:
   - Add `"start:server": "tsx server/index.ts"` and `"dev:server": "tsx watch server/index.ts"` to `update/package.json`.
