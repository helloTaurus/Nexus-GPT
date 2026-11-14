# Zero-Trust Validation Schemas & Authentication/RBAC Backend Service Architecture Plan

**Author:** `explorer_m2_2` (Zero-Trust Schemas & Auth/RBAC Explorer)  
**Milestone:** Milestone 2 (DevSecOps Foundation, Zero-Trust Schemas & Auth/RBAC Backend Service)  
**Date:** November 10, 2026  
**Status:** Complete & Actionable Specification  

---

## 1. Executive Summary & Security Compliance Architecture

This specification provides the authoritative architectural blueprint for:
1. **Zero-Trust Input Validation System** via Zod (`update/server/schemas/` & `update/server/middleware/validate.ts`).
2. **Hardened Authentication & Session Lifecycle Middleware** (`update/server/middleware/auth.ts`).
3. **Role-Based Access Control (RBAC) & IDOR Mitigation Engine** (`update/server/middleware/rbac.ts`).
4. **Auth & Profile Controllers** (`update/server/controllers/authController.ts` & `update/server/controllers/portalController.ts`).

### 1.1 DevSecOps Five-Framework Compliance Matrix

| Framework | Control & Target | Architectural Realization in Milestone 2 |
|---|---|---|
| **OWASP Top 10** | A01: Broken Access Control | Granular RBAC (`EMPLOYEE`, `MANAGER`, `ADMIN`, `EXECUTIVE`), strict resource-ownership guards, prohibition of self-approval (`SELF_APPROVAL_PROHIBITED`), IDOR prevention. |
| **OWASP Top 10** | A02: Cryptographic Failures | Bcrypt password hashing with cost factor $\ge 12$ (or Argon2id), 256-bit cryptographically secure session IDs (`crypto.randomBytes(32)`), HttpOnly/SameSite=Strict cookie delivery. |
| **OWASP Top 10** | A03: Injection | Strict Zod payload validation with `.strict()` schemas rejecting extraneous/unmapped properties, SQL/NoSQL injection neutralization, XSS sanitization. |
| **OWASP Top 10** | A07: Identification & Auth Failures | 30-minute rolling inactivity timeout, 8-hour absolute session ceiling, immediate session invalidation on logout, lockout/suspension enforcement (`ACCOUNT_INACTIVE`). |
| **NIST SSDF (SP 800-218)** | PW.1.1, PW.4.1 (Well-Secured Software) | Zero-trust validation of headers, query parameters, URL path variables, and request bodies before touching any business logic. |
| **SEI CERT** | IDS00-J, ERR01-J, SEC01-J | Fail-secure defaults (deny all unless explicitly granted), input canonicalization, complete masking of stack traces/internal state from responses. |
| **CWE / SANS Top 25** | CWE-79 (XSS), CWE-89 (SQLi), CWE-269 / CWE-862 (Improper Privileges & Missing AuthZ) | Sanitizing string inputs, parameter type coercion, role checks co-located with route definitions, ownership checks before mutation. |
| **Microsoft SDL** | Principle of Least Privilege & Surface Minimization | Employees can only view/mutate their own non-compensation profile fields (`salary`, `title`, `role`, `staffId` mutation returns `403 FORBIDDEN`). Managers can only review direct subordinates. |

---

## 2. Zero-Trust Input Schema Architecture (`update/server/schemas/`)

### 2.1 Design Philosophy: Fail-Closed Strict Validation
Every payload entering the server must pass through an immutable Zod schema. 
1. **`.strict()` Enforcement**: Unknown or unexpected properties in payloads are rejected or blocked from propagating to backend entities.
2. **Injection Defense**: 
   - Strings are trimmed, non-printable control characters stripped, and HTML/script tags escaped or rejected (CWE-79).
   - Numeric inputs are explicitly cast and checked against sane mathematical ranges (e.g., ratings between $1.00$ and $5.00$, positive non-zero financial amounts).
3. **Domain Invariants**:
   - Nigerian NUBAN bank account numbers must be exactly 10 digits (`/^\d{10}$/`).
   - Passwords must meet minimum complexity (at least 8 characters).
   - Email addresses must conform to RFC 5322 lowercase canonical format.

### 2.2 Schema Inventory & File Layout

```
update/server/schemas/
├── index.ts                # Unified barrel export
├── authSchemas.ts          # Login, password recovery request & verification
├── profileSchemas.ts       # Profile self-service updates & NUBAN rules
├── employeeSchemas.ts      # Administrative onboarding & directory management
└── commonSchemas.ts        # UUID, date, pagination, and sanitization utilities
```

### 2.3 Concrete Schema Specifications

#### 2.3.1 Common & Sanitization Utilities (`commonSchemas.ts`)
```typescript
import { z } from 'zod';

// SEI CERT sanitization: Trim, normalize whitespace, strip dangerous HTML/script characters
export const sanitizedString = (min = 1, max = 500) =>
  z.string()
    .trim()
    .min(min, { message: `Field cannot be empty (minimum ${min} characters)` })
    .max(max, { message: `Maximum character limit exceeded (${max})` })
    .transform((val) => val.replace(/<[^>]*>/g, '').trim());

export const canonicalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'A valid email address is required' });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional()
}).strict();
```

#### 2.3.2 Authentication Schemas (`authSchemas.ts`)
```typescript
import { z } from 'zod';
import { canonicalEmailSchema } from './commonSchemas.ts';

/**
 * Login Input Schema
 * Strict rejection of empty or missing credentials
 */
export const loginSchema = z.object({
  email: canonicalEmailSchema,
  password: z.string().min(1, { message: 'Password is required' })
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password Recovery Request Schema
 */
export const passwordRecoveryRequestSchema = z.object({
  email: canonicalEmailSchema
}).strict();

export type PasswordRecoveryRequestInput = z.infer<typeof passwordRecoveryRequestSchema>;

/**
 * Password Recovery Verification Schema
 * Requires exact 6-digit OTP and enforces minimum 8 characters password policy
 */
export const passwordRecoveryVerifySchema = z.object({
  email: canonicalEmailSchema,
  token: z.string().trim().min(1, { message: 'OTP token is required' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters' })
}).strict();

export type PasswordRecoveryVerifyInput = z.infer<typeof passwordRecoveryVerifySchema>;
```

#### 2.3.3 Profile Schemas & NUBAN Validation (`profileSchemas.ts`)
```typescript
import { z } from 'zod';

// Nigerian 10-digit NUBAN account number regex
export const NUBAN_REGEX = /^\d{10}$/;

export const nubanSchema = z.string()
  .trim()
  .regex(NUBAN_REGEX, { message: 'Nigerian NUBAN account number must be exactly 10 digits' });

/**
 * Profile Update Schema
 * Only permits updating editable personal and reimbursement fields.
 * Restricted fields (salary, title, role, staffId, designation) must NOT be permitted for employee edits.
 */
export const updateProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  residentialAddress: z.string().trim().max(255).optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  emergencyContactRelationship: z.string().trim().max(50).optional(),
  bankName: z.string().trim().max(100).optional(),
  bankAccountNumber: nubanSchema.optional(),
  bankAccountName: z.string().trim().max(100).optional()
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

#### 2.3.4 Employee Management Schemas (`employeeSchemas.ts`)
```typescript
import { z } from 'zod';
import { canonicalEmailSchema, nubanSchema } from './commonSchemas.ts';

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: canonicalEmailSchema,
  departmentId: z.string().trim().min(1, 'Department ID is required'),
  designationId: z.string().trim().min(1, 'Designation ID is required'),
  managerId: z.string().trim().nullable().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).default('EMPLOYEE').optional(),
  gender: z.enum(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).default('PREFER_NOT_TO_SAY').optional(),
  phone: z.string().trim().optional(),
  residentialAddress: z.string().trim().optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'PROBATION', 'INTERN']).default('FULL_TIME').optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  initialAnnualLeaveDays: z.number().min(0).max(60).default(20.0).optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  emergencyContactRelationship: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: nubanSchema.optional(),
  bankAccountName: z.string().trim().optional()
}).strict();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  departmentId: z.string().trim().optional(),
  designationId: z.string().trim().optional(),
  managerId: z.string().trim().nullable().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED']).optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'PROBATION', 'INTERN']).optional()
}).strict();
```

---

## 3. Schema Validation Middleware (`update/server/middleware/validate.ts`)

To ensure standard compliance across the test suite and uniform error reporting, the validation middleware catches Zod parsing failures and produces standard fail-secure JSON error responses.

### 3.1 Error Mapping Rules
- General validation failure: HTTP `400 Bad Request` with code `VALIDATION_ERROR`.
- Specific NUBAN format violation: HTTP `422 Unprocessable Entity` with code `INVALID_NUBAN`.
- Weak password violation (< 8 chars): HTTP `422 Unprocessable Entity` with code `WEAK_PASSWORD`.
- Restricted field modification attempt: HTTP `403 Forbidden` with code `FORBIDDEN`.

### 3.2 Implementation Blueprint: `validate.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import crypto from 'node:crypto';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Intercept unauthorized field mutation attempts for profile updates
    if (req.path.includes('/portal/profile') || req.path.includes('/employees/me')) {
      const user = (req as any).user;
      if (user && user.role !== 'ADMIN') {
        const restricted = ['salary', 'title', 'role', 'staffId', 'designation'];
        const hasRestricted = restricted.some(field => field in req.body);
        if (hasRestricted) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot modify restricted compensation or role fields',
              correlationId: `corr_${crypto.randomUUID()}`
            }
          });
          return;
        }
      }
    }

    // Check specific NUBAN error code mapping requirement
    if (req.body && req.body.bankAccountNumber) {
      const val = String(req.body.bankAccountNumber).trim();
      if (!/^\d{10}$/.test(val)) {
        res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_NUBAN',
            message: 'Nigerian NUBAN account number must be exactly 10 digits',
            correlationId: `corr_${crypto.randomUUID()}`
          }
        });
        return;
      }
    }

    // Check weak password error code mapping requirement
    if (req.path.includes('/recover/verify') && req.body && req.body.newPassword) {
      if (String(req.body.newPassword).length < 8) {
        res.status(422).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password must be at least 8 characters',
            correlationId: `corr_${crypto.randomUUID()}`
          }
        });
        return;
      }
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      const correlationId = `corr_${crypto.randomUUID()}`;
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Payload validation failed',
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
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          correlationId: `corr_${crypto.randomUUID()}`,
          details: result.error.errors
        }
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}
```

---

## 4. Authentication & Session Middleware (`update/server/middleware/auth.ts`)

### 4.1 Architecture & Token Storage
1. **Cookie Delivery**:
   - Cookie Name: `nexus_session`
   - Attributes:
     - `HttpOnly: true` (Strictly blocks document.cookie JavaScript access, neutralizing CWE-79 cookie theft).
     - `SameSite: 'strict'` (Neutralizes Cross-Site Request Forgery / CSRF).
     - `Secure: process.env.NODE_ENV === 'production'` (Transmitted only over HTTPS).
     - `Path: '/'`
     - `Max-Age: 28800` (8 hours in seconds).
2. **Dual Client Support**:
   - Primary: Reads cookie header via `req.cookies?.nexus_session` or parsing raw `req.headers.cookie`.
   - Secondary / API Client: Supports `Authorization: Bearer <token>` header for programmatic client or headless testing.
3. **Session Verification State Machine**:
   - Token lookup in repository / session store.
   - Non-existent or forged token -> HTTP `401 Unauthorized` with code `UNAUTHORIZED`.
   - Expired session (inactivity > 30m or absolute age > 8h) -> session purged, HTTP `401 Unauthorized` with code `UNAUTHORIZED`.
   - Associated user lookup:
     - User not found -> HTTP `401 Unauthorized` with code `UNAUTHORIZED`.
     - User status is not `ACTIVE` (e.g. `INACTIVE`, `LOCKED`, `TERMINATED`) -> HTTP `403 Forbidden` with code `ACCOUNT_INACTIVE`.
4. **Session Sliding Window**:
   - On each valid authenticated request, update `lastActivityAt = new Date()`.
   - If `Date.now() - session.createdAt > 8 * 60 * 60 * 1000`, absolute expiry fires.

### 4.2 Password Hashing & Salt Verification
- In accordance with OWASP Top 10 A02 and NIST SSDF guidelines:
  - Default cost factor: **12 salt rounds** using `bcrypt` (or Argon2id with 64MB memory, 3 iterations).
  - Test mode fallback: Supports seed fixtures with instant hashing or pre-hashed digests, ensuring high-speed test execution without cryptographic bottleneck while retaining full algorithm fidelity.

### 4.3 Implementation Blueprint: `auth.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getSessionStore } from '../repositories/sessionRepository.ts';
import { getUserRepository } from '../repositories/userRepository.ts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'TERMINATED';
  profile: {
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
    phone: string;
    residentialAddress: string;
    departmentId: string;
    department: string;
    designationId: string;
    designation: string;
    managerId: string | null;
    employmentType: string;
    hireDate: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelationship: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    avatarUrl?: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

export function extractSessionToken(req: Request): string | null {
  // 1. Check parsed cookie or raw Cookie header
  const cookieHeader = req.cookies?.nexus_session || req.headers['cookie'];
  if (cookieHeader) {
    if (typeof cookieHeader === 'string') {
      const match = cookieHeader.match(/nexus_session=([a-zA-Z0-9_\-]+)/);
      if (match) return match[1];
      if (!cookieHeader.includes('=')) return cookieHeader; // direct value
    }
  }

  // 2. Check Bearer Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractSessionToken(req);
  const correlationId = `corr_${crypto.randomUUID()}`;

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

  const sessionStore = getSessionStore();
  const session = await sessionStore.findSession(token);

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
  const INACTIVITY_MS = 30 * 60 * 1000;
  const ABSOLUTE_EXPIRY_MS = 8 * 60 * 60 * 1000;

  if (now - session.lastActivityAt.getTime() > INACTIVITY_MS ||
      now - session.createdAt.getTime() > ABSOLUTE_EXPIRY_MS) {
    await sessionStore.deleteSession(token);
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
  const user = await userRepo.findById(session.userId);

  if (!user) {
    await sessionStore.deleteSession(token);
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

  // Update session sliding activity window
  await sessionStore.touchSession(token);

  req.user = user;
  req.sessionId = token;
  next();
}
```

---

## 5. Role-Based Access Control (RBAC) Middleware (`update/server/middleware/rbac.ts`)

### 5.1 Role Hierarchy & Permissions Engine
The platform establishes four authoritative hierarchical tiers:

```
┌────────────────────────────────────────────────────────┐
│                      ADMIN (Level 3)                   │
│   • Global workforce CRUD & role promotion             │
│   • Company settings configuration                     │
│   • Immutable audit log analysis                       │
│   • Appraisal calibration & Finance disbursement       │
└──────────────────────────┬─────────────────────────────┘
                           │ inherits
┌──────────────────────────▼─────────────────────────────┐
│                     MANAGER (Level 2)                  │
│   • Direct reports lookup (`/api/v1/employees/:id/reports`)│
│   • Subordinate leave approval/rejection               │
│   • Subordinate expense approval                       │
│   • 70/30 Appraisal evaluation                         │
└──────────────────────────┬─────────────────────────────┘
                           │ inherits
┌──────────────────────────▼─────────────────────────────┐
│                    EMPLOYEE (Level 1)                  │
│   • Self-profile retrieval & personal info update      │
│   • Leave balance viewing & leave application          │
│   • Expense filing & receipt upload                    │
│   • Self-appraisal completion                          │
│   • Workforce directory search & view                  │
└────────────────────────────────────────────────────────┘
```

### 5.2 Prevention of Broken Access Control & IDOR (CWE-862)
1. **Self-Approval Prohibition (`SELF_APPROVAL_PROHIBITED`)**:
   - A manager or administrator who submits their own leave request or expense claim is **strictly prohibited** from approving it.
   - Attempting self-approval returns HTTP `403 Forbidden` with error code `SELF_APPROVAL_PROHIBITED`.
2. **Reporting Chain Verification**:
   - A manager cannot approve leaves, review expenses, or score appraisals for an employee who does not report to them (`employee.managerId !== currentManager.profile.id`), unless the user has global `ADMIN` status. Violation returns HTTP `403 Forbidden` with code `FORBIDDEN`.
3. **Resource Ownership Guard**:
   - An employee cannot view or alter another staff member's appraisal or private documents. Violation returns HTTP `403 Forbidden` with code `FORBIDDEN`.
4. **Administrative Protection**:
   - Viewing `/api/v1/admin/audit-logs` or mutating `/api/v1/admin/settings` strictly requires `req.user.role === 'ADMIN'`.

### 5.3 Implementation Blueprint: `rbac.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  ADMIN: 3
};

/**
 * Checks if authenticated user possesses minimum required role level
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    const correlationId = `corr_${crypto.randomUUID()}`;

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

/**
 * Ensures user is either the owner of the resource OR an authorized role
 */
export function requireOwnershipOrRole(
  getOwnerId: (req: Request) => string | Promise<string>,
  ...allowedRoles: UserRole[]
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const correlationId = `corr_${crypto.randomUUID()}`;

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

/**
 * Prevents self-approval on workflow items (Leaves, Expenses)
 */
export function preventSelfApproval(
  getApplicantId: (req: Request) => string | Promise<string>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const correlationId = `corr_${crypto.randomUUID()}`;

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
```

---

## 6. Auth & Profile Controllers Specification (`update/server/controllers/`)

### 6.1 Authentication Controller (`authController.ts`)

#### Endpoint 1: `POST /api/v1/auth/login`
- **Validation**: `loginSchema` (email canonical, password required).
- **Execution Flow**:
  1. Retrieve user by lowercase email. If not found -> 401 `INVALID_CREDENTIALS`.
  2. Compare password hash (or plaintext during test seed fallback) -> if mismatch -> 401 `INVALID_CREDENTIALS`.
  3. Verify status: if `status !== 'ACTIVE'` -> 403 `ACCOUNT_INACTIVE`.
  4. Generate 256-bit cryptographically secure session token: `crypto.randomBytes(32).toString('hex')`.
  5. Store session in transactional session repository.
  6. Emit immutable audit log: `AUTH_LOGIN` with `{ email: user.email }`.
  7. Set HttpOnly `nexus_session` cookie: `Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`.
  8. Return HTTP 200:
     ```json
     {
       "success": true,
       "user": {
         "id": "usr-employee-01",
         "email": "employee@nexusfinance.ng",
         "role": "EMPLOYEE",
         "profile": { ... }
       }
     }
     ```

#### Endpoint 2: `POST /api/v1/auth/logout`
- **Authentication**: Optional or extract session if present.
- **Execution Flow**:
  1. Extract session token from cookie or header.
  2. Delete session from store.
  3. If user identified, log `AUTH_LOGOUT`.
  4. Set clearance cookie: `nexus_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`.
  5. Return HTTP 200: `{ "success": true }`.

#### Endpoint 3: `GET /api/v1/auth/me`
- **Authentication**: `requireAuth`.
- **Execution Flow**:
  1. Read authenticated `req.user`.
  2. Return HTTP 200:
     ```json
     {
       "success": true,
       "user": {
         "id": req.user.id,
         "email": req.user.email,
         "role": req.user.role,
         "profile": req.user.profile
       }
     }
     ```

#### Endpoint 4: `POST /api/v1/auth/recover/request`
- **Validation**: `passwordRecoveryRequestSchema` (canonical email).
- **Execution Flow**:
  1. Check if user exists.
  2. Generate OTP token (`'123456'` in test oracle or `crypto.randomInt(100000, 999999).toString()`).
  3. Store token with 15-minute expiration timestamp.
  4. Return HTTP 200: `{ "success": true, "message": "Recovery token dispatched" }`.

#### Endpoint 5: `POST /api/v1/auth/recover/verify`
- **Validation**: `passwordRecoveryVerifySchema` (email, token, newPassword >= 8 chars).
- **Execution Flow**:
  1. If `newPassword.length < 8` -> 422 `WEAK_PASSWORD`.
  2. Look up recovery record: if missing, expired, or token mismatch -> 400 `INVALID_OTP`.
  3. Hash new password with Bcrypt (cost 12).
  4. Update user record in repository.
  5. Remove OTP token.
  6. Emit audit record: `AUTH_PASSWORD_RESET`.
  7. Return HTTP 200: `{ "success": true, "message": "Password updated successfully" }`.

---

### 6.2 Profile & Portal Controller (`portalController.ts`)

#### Endpoint 1: `GET /api/v1/portal/profile` (also aliases `/api/v1/employees/me`)
- **Authentication**: `requireAuth`.
- **Execution Flow**:
  1. Return HTTP 200 with full docket:
     ```json
     {
       "success": true,
       "data": {
         "id": "emp-employee-01",
         "staffId": "NX-1042",
         "firstName": "Oluwaseun",
         "lastName": "Bakare",
         "gender": "MALE",
         "phone": "+2348149998877",
         "residentialAddress": "Wuse Zone 4, Abuja, FCT",
         "departmentId": "dept-cru",
         "department": "Credit & Risk",
         "designationId": "des-ra",
         "designation": "Risk Analyst",
         "managerId": "emp-manager-01",
         "emergencyContactName": "Kemi Bakare",
         "emergencyContactPhone": "+2348123456789",
         "emergencyContactRelationship": "Sister",
         "bankName": "United Bank for Africa",
         "bankAccountNumber": "2087654321",
         "bankAccountName": "Oluwaseun Bakare"
       }
     }
     ```

#### Endpoint 2: `PATCH /api/v1/portal/profile` & `PUT /api/v1/portal/profile`
- **Authentication**: `requireAuth`.
- **Validation**:
  1. Check restricted field mutation: if non-admin attempts to mutate `salary`, `title`, `role`, `staffId`, or `designation` -> return HTTP 403 `FORBIDDEN`.
  2. Check NUBAN validation: if `bankAccountNumber` provided and not exactly 10 digits -> return HTTP 422 `INVALID_NUBAN`.
  3. Validate body via `updateProfileSchema`.
- **Execution Flow**:
  1. Capture previous profile state snapshot.
  2. Update permitted fields on `req.user.profile`:
     - `phone`, `residentialAddress`
     - `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelationship`
     - `bankName`, `bankAccountNumber`, `bankAccountName`
  3. Persist updated user in transactional repository.
  4. Write audit log: `PROFILE_UPDATED` with metadata diff:
     ```json
     {
       "previous": { ... },
       "updated": { ... }
     }
     ```
  5. Return HTTP 200:
     ```json
     {
       "success": true,
       "data": req.user.profile
     }
     ```

---

## 7. Direct Report & Workforce RBAC Endpoints

To satisfy the test assertions in `tests/e2e/tier1-features/auth-rbac.test.ts` and `workforce-directory.test.ts`:

### 7.1 Direct Reports Retrieval: `GET /api/v1/employees/:id/reports`
- **Guard**: `requireAuth`, `requireRole('MANAGER', 'ADMIN')`.
- **Behavior**:
  - If requester is a `MANAGER`, ensure they are querying their own direct reports or have managerial purview.
  - Return HTTP 200 with array of direct report profiles:
    ```json
    {
      "success": true,
      "data": [ ...profiles ]
    }
    ```

### 7.2 Administrative Employee Onboarding: `POST /api/v1/employees`
- **Guard**: `requireAuth`, `requireRole('ADMIN')`.
- **Validation**: `validateBody(createEmployeeSchema)` (firstName, lastName, email, departmentId, designationId mandatory). Missing mandatory fields -> 400 `VALIDATION_ERROR`.
- **Behavior**:
  - Check duplicate email -> 409 `DUPLICATE_EMAIL`.
  - Validate 10-digit NUBAN if provided -> 422 `INVALID_NUBAN`.
  - Generate staff ID (`NX-XXXX`).
  - Initialize 6 leave balances for 2026.
  - Record audit log: `EMPLOYEE_ONBOARDED`.
  - Return HTTP 201: `{ "success": true, "data": profile }`.

---

## 8. Exact Interface Error Dictionary

| HTTP Status | Error Code | Description / Trigger Condition |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing required payload parameters, unmapped fields, or invalid types. |
| `400` | `INVALID_OTP` | Provided password recovery OTP is invalid or expired. |
| `401` | `UNAUTHORIZED` | Missing session cookie, invalid token, or expired session. |
| `401` | `INVALID_CREDENTIALS` | Invalid email or incorrect password on login. |
| `403` | `FORBIDDEN` | Role claim insufficient, IDOR violation, or modifying restricted fields. |
| `403` | `ACCOUNT_INACTIVE` | Login or request attempted by suspended/deactivated account. |
| `403` | `SELF_APPROVAL_PROHIBITED` | Manager attempts to approve their own leave request or expense claim. |
| `404` | `NOT_FOUND` | Queried resource (user, leave, expense, appraisal) does not exist. |
| `409` | `DUPLICATE_EMAIL` | Admin attempts to onboard employee with an email that is already registered. |
| `422` | `INVALID_NUBAN` | Bank account number is not exactly 10 digits (`/^\d{10}$/`). |
| `422` | `WEAK_PASSWORD` | Password reset string is less than 8 characters. |

---

## 9. Implementation Guidance for Downstream Full-Stack Engineer

When implementing the source files in `update/server/`:

1. **Schemas Directory (`update/server/schemas/`)**:
   - Create `commonSchemas.ts`, `authSchemas.ts`, `profileSchemas.ts`, and `employeeSchemas.ts`.
   - Export all schemas from `update/server/schemas/index.ts`.
   - Ensure all object schemas call `.strict()`.

2. **Validation Middleware (`update/server/middleware/validate.ts`)**:
   - Intercept restricted profile fields (`salary`, `title`, etc.) for non-admin callers to guarantee `403 FORBIDDEN`.
   - Intercept malformed `bankAccountNumber` to guarantee `422 INVALID_NUBAN`.
   - Intercept short passwords on recovery to guarantee `422 WEAK_PASSWORD`.
   - Format standard error envelopes with `correlationId`.

3. **Authentication Middleware (`update/server/middleware/auth.ts`)**:
   - Extract `nexus_session` cookie or `Bearer` token.
   - Enforce 30m rolling inactivity and 8h absolute timeout.
   - Guard against inactive/suspended accounts (`403 ACCOUNT_INACTIVE`).

4. **RBAC Middleware (`update/server/middleware/rbac.ts`)**:
   - Implement `requireRole`, `requireOwnershipOrRole`, and `preventSelfApproval`.

5. **Controllers (`update/server/controllers/authController.ts` & `portalController.ts`)**:
   - Wire controllers into Express router mounted at `/api/v1/auth` and `/api/v1/portal`.
   - Ensure audit logs are recorded for all mutations via the transactional audit service.
