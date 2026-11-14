# Technical Architecture, Tech Stack & DevSecOps Survey Report
**Project:** Nexus Finance — Production HRMS & Expense Management Suite (Zoho People Reverse-Engineering)  
**Agent:** explorer_survey_3 (System Architecture, Tech Stack & DevSecOps Explorer)  
**Date:** 2026-11-09  
**Status:** Complete Architectural & Security Survey  

---

## 1. Executive Summary & System Survey

This survey delivers the definitive architectural blueprint, technical stack selection, and DevSecOps security framework evaluation for transforming Nexus Finance from a demonstration prototype into an enterprise-grade, production-hardened platform. The target system incorporates a modern public marketing suite seamlessly integrated with a comprehensive, first-principles reverse-engineered HRMS and expense suite (replicating Zoho People) covering:
1. **Self-Service Staff Portal**: Profile management, live leave balance tracking, appraisal status.
2. **Leave Management Engine**: Multi-tier request submission, policy rules, manager approval/rejection workflows, and automated balance accrual/deduction.
3. **Expense Management & Reimbursement**: Multi-category filing, receipt document attachment, manager verification, financial controller reimbursement approval.
4. **Appraisals & Performance Review**: 360 review cycles, KPI evaluation forms, rating matrix, and historical review tracking.
5. **Administrative HRMS & Governance**: Employee directory, department structuring, role-based access control (RBAC), and immutable security audit logs.

### Key Survey Findings
- **Workspace Toolchain**: Node.js `v24.14.0`, npm `11.9.0`, Git `2.53.0.windows.2` on Windows 11. Modern runtime capabilities include native test running (`node:test`), high-performance cryptographic primitives (`node:crypto`), and ES module support.
- **Existing Assets (`update/`)**: Configured with Vite 8.3.0, React 19.0.1, Tailwind CSS v4.3.3 (`@tailwindcss/vite`), Phosphor Icons (`@phosphor-icons/react` 2.1.10), Lucide Icons (`lucide-react` 0.546.0), Motion/Framer Motion (`motion` 12.23.24), and Express 4.21.2 in `package-lock.json`.
- **Architectural Violation in Baseline Code**: In `update/src/components/`, full page templates (`AboutUsPage.tsx`, `BlogPage.tsx`, `CareersPage.tsx`, `CmsPortal.tsx`, `GalleryPage.tsx`, `ProductDetailPage.tsx`) are dumped into the components folder alongside small reusable controls (`Navbar.tsx`, `Footer.tsx`). This directly violates the hard project requirement: *"Pages must be nested within the pages folder, separated cleanly from reusable UI components."*
- **DevSecOps Critical Vulnerability in Legacy Demo**: Legacy `CmsPortal.tsx` utilizes client-side authentication stored in `sessionStorage` and `localStorage`, with simple SHA-256 client-side hashing without salts or server validation. This represents severe Broken Access Control (OWASP A01), Cryptographic Failure (OWASP A02), and Improper Privilege Management (CWE-269). A complete server-side zero-trust security architecture is required.

---

## 2. Workspace Environment & Baseline Inventory

| Component | Detected Version / Specification | Architectural Role & Compatibility |
|---|---|---|
| **Node.js** | `v24.14.0` | Production runtime. Native support for `node:test`, `node:crypto`, ES modules, fetch API, and modern V8 performance optimizations. |
| **npm** | `11.9.0` | Package manager supporting lockfileVersion 3, workspace monorepo semantics, and deterministic dependency resolution. |
| **Frontend Framework** | React `19.0.1` + React DOM `19.0.1` | Modern concurrent rendering, enhanced action hooks, optimal server/client separation. |
| **Build Tooling** | Vite `8.3.0` + `@vitejs/plugin-react` `6.1.1` | Ultra-fast HMR (<50ms), ESM bundler with Rollup output optimization. |
| **Styling** | Tailwind CSS `4.3.3` + `@tailwindcss/vite` | Modern CSS-in-CSS engine utilizing `@theme inline` variables, zero-runtime overhead, tokens in `nexus-tokens.css`. |
| **Motion Library** | `motion` `12.23.24` (Motion.dev / Framer Motion) | Production declarative animation library supporting GPU-accelerated micro-interactions, layout transitions, and reduced motion. |
| **Iconography** | `@phosphor-icons/react` `2.1.10` + `lucide-react` `0.546.0` | Phosphor Icons (regular outline weight, 16-20px) matching the established Nexus Finance brand standards. |
| **Backend Runtime** | Express `4.21.2` + `tsx` `4.21.0` | High-throughput, battle-tested HTTP engine with native TypeScript execution via `tsx` without pre-compilation lag. |

### Baseline Architectural Gap Analysis
1. **Flat Component Hierarchy**: Existing `update/src/components` conflates monolithic page views with atomic UI controls.
   - *Remediation*: Reorganize into `src/pages/` (page views organized by domain: `public/`, `portal/`, `admin/`, `auth/`) and `src/components/` (pure reusable presentation and feature widgets: `ui/`, `layout/`, `features/`).
2. **Absence of Server-Side State & Logic**: Existing application runs entirely in the browser using memory and `localStorage`.
   - *Remediation*: Implement layered server architecture (`server/`) with domain models, services, repositories, controllers, and middleware.
3. **Absence of Role-Based Access Control**:
   - *Remediation*: Implement multi-tier RBAC (`employee`, `manager`, `hr_admin`, `finance_admin`, `master_admin`) with cryptographic session validation.

---

## 3. Platform URL Topography & Routing Conventions

To ensure clean domain separation between public visitors, internal employees, and administrative personnel, the system adopts standard semantic routing conventions:

```
nexus-finance/
├── Public Domain (Unrestricted / Informational)
│   ├── /                         -> Landing Page (Hero, Value Prop, Yield, Calculator, Testimonials, FAQ)
│   ├── /about                    -> Corporate Background, Leadership & Vision
│   ├── /products                 -> Financial Products Catalog
│   ├── /products/:slug           -> Product Detail (SureMoney, Asset-Backed Lending, Wealth Yield)
│   ├── /careers                  -> Open Positions & Job Application Dialog
│   ├── /blog                     -> Financial Insights & Articles
│   ├── /blog/:id                 -> Blog Article Reader
│   └── /gallery                  -> Media & Corporate Showcase
│
├── Authentication & Session Lifecycle (/auth/*)
│   ├── /auth/login               -> Unified Secure Login (Staff, Managers, Administrators)
│   ├── /auth/forgot-password     -> Password Reset Request
│   └── /auth/reset-password      -> Cryptographic Token Reset Handler
│
├── Employee Self-Service Portal (/portal/*) — Requires Role: employee+
│   ├── /portal/dashboard         -> Employee Summary: Leave Balance, Quick Actions, Pending Tasks
│   ├── /portal/profile           -> Self-Service Profile: Contact Info, Bank Details, Emergency Contacts
│   ├── /portal/leave             -> Leave Management: Balance View, Application Form, History
│   ├── /portal/expenses          -> Expense Claims: Claim Submission, Receipt Upload, Status Tracker
│   └── /portal/appraisals        -> Performance Reviews: Self-Appraisal Submission, Manager Feedback
│
├── Administrative & HRMS Management (/admin/*) — Requires Role: manager / hr_admin / finance_admin / master_admin
│   ├── /admin/dashboard          -> Executive Overview: Workforce Metrics, Pending Approvals, Burn Rate
│   ├── /admin/employees          -> Employee Directory: New Onboarding, Role Assignment, Dep't Tree
│   ├── /admin/leave-approvals    -> Leave Approval Queue: Calendar Heatmap, Approve/Reject Actions
│   ├── /admin/expense-approvals  -> Expense Verification: Financial Audit Trail, Reimbursement Authorization
│   ├── /admin/appraisals         -> Appraisal Cycles: KPI Setup, Rating Aggregation, Review Cycles
│   ├── /admin/roles              -> Security Governance: RBAC Permission Matrix Configuration
│   └── /admin/audit-logs         -> DevSecOps Audit Trail: Immutable System & Security Event Log
│
└── Backend REST API Surface (/api/v1/*) — Zero-Trust Validated
    ├── /api/v1/auth/*            -> POST /login, POST /logout, GET /me, POST /refresh
    ├── /api/v1/portal/*          -> GET/POST /leave, GET/POST /expenses, GET/PUT /profile, GET /appraisals
    └── /api/v1/admin/*           -> GET/POST /employees, PATCH /leave/:id, PATCH /expenses/:id, GET /audit-logs
```

---

## 4. Technical Stack Recommendation & Clean Architecture

### Stack Evaluation: Full-Stack Comparison

| Evaluation Metric | Next.js (App / Pages Router) | React 19 + Vite 8 + Express (Recommended) | Remix / React Router v7 |
|---|---|---|---|
| **Alignment with Existing Codebase** | Low: Requires converting Vite config, Tailwind v4 integration changes, asset relocation | **Immediate 100% Fit**: Codebase already contains Vite 8, React 19, Tailwind v4, Express in lockfile | Moderate: Requires new project scaffolding and route module structure |
| **Pages Directory Constraint** | Pages router has `pages/`, App router enforces `app/` | **Full Compliance**: Native `src/pages/` structure separated cleanly from `src/components/` | Moderate: Uses `routes/` convention |
| **DevSecOps Middleware Control** | Complex: Next.js middleware runs on Edge runtime with limited Node.js crypto/buffer APIs | **Total Control**: Express middleware pipeline supports complete Helmet, CSRF, Rate Limiting, RBAC | Good: Action/Loader functions, but less transparent security pipeline |
| **Startup Speed & Dev Ergonomics** | Moderate: Webpack/Turbopack compilation overhead | **Ultra-Fast**: Sub-second startup via `tsx`, instant ESM bundling via Vite | Moderate: Vite-based Remix is fast, but heavier setup |
| **Verification & Testing** | Difficult opaque-box testing without heavy Next server mocks | **Seamless**: Express routes can be tested natively via `supertest` and `node:test` without spinning up browsers | Moderate |

### Recommended Stack: React 19 + Vite 8 + Express Full-Stack Clean Architecture

We recommend a **Dual-Tier Clean Architecture** running either in unified mode (Vite dev proxy routing `/api` requests to Express on port 3001) or standalone production mode (Express serving the optimized Vite dist assets and handling `/api` requests).

```
Nexus-Finance-Complete-Style-Update/
├── src/                                  # Frontend Presentation Layer (React 19 + Vite 8)
│   ├── pages/                            # HARD CONSTRAINT: Page views strictly in pages/
│   │   ├── public/                       # Public Marketing & Information Pages
│   │   │   ├── HomePage.tsx
│   │   │   ├── AboutPage.tsx
│   │   │   ├── ProductsPage.tsx
│   │   │   ├── ProductDetailPage.tsx
│   │   │   ├── CareersPage.tsx
│   │   │   ├── BlogPage.tsx
│   │   │   └── GalleryPage.tsx
│   │   ├── portal/                       # Employee Self-Service HRMS Pages
│   │   │   ├── StaffDashboardPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── LeaveRequestsPage.tsx
│   │   │   ├── ExpenseClaimsPage.tsx
│   │   │   └── AppraisalsPage.tsx
│   │   ├── admin/                        # Administrative & HR Governance Pages
│   │   │   ├── AdminDashboardPage.tsx
│   │   │   ├── EmployeeDirectoryPage.tsx
│   │   │   ├── LeaveApprovalPage.tsx
│   │   │   ├── ExpenseApprovalPage.tsx
│   │   │   ├── PerformanceReviewPage.tsx
│   │   │   └── AuditLogsPage.tsx
│   │   └── auth/                         # Authentication & Security Recovery Pages
│   │       ├── LoginPage.tsx
│   │       └── ForgotPasswordPage.tsx
│   │
│   ├── components/                       # Reusable UI & Layout Components ONLY
│   │   ├── ui/                           # Atomic Primitives (Button, Modal, Input, Badge, Table, Card)
│   │   ├── layout/                       # Structural Wrappers (Navbar, Footer, PortalLayout, AdminLayout)
│   │   └── features/                     # Domain Widgets (InteractiveCalculator, TrustMarquee, Hero, Bento)
│   │
│   ├── context/                          # Client State Contexts (AuthContext, ThemeContext, ToastContext)
│   ├── hooks/                            # Custom React Hooks (useAuth, useLeave, useExpenses, useReducedMotion)
│   ├── services/                         # Client API HTTP Clients (typed fetch wrappers)
│   ├── types/                            # Shared Client/Server Domain Interfaces
│   ├── index.css                         # Tailwind v4 import and @theme inline declarations
│   ├── nexus-tokens.css                  # Color palette design tokens (Light/Dark contracts)
│   ├── nexus-layout.css                  # Core layout and container geometries
│   ├── nexus-system.css                  # Editorial typography scale and button standards
│   └── main.tsx                          # Client SPA entry point
│
├── server/                               # Backend Application Layer (Express Clean Architecture)
│   ├── domain/                           # Business Domain Models & Entities
│   │   ├── Employee.ts
│   │   ├── LeaveRequest.ts
│   │   ├── ExpenseClaim.ts
│   │   ├── PerformanceReview.ts
│   │   ├── UserSession.ts
│   │   └── AuditLogEntry.ts
│   │
│   ├── schemas/                          # Zero-Trust Zod Validation Schemas
│   │   ├── auth.schema.ts
│   │   ├── leave.schema.ts
│   │   ├── expense.schema.ts
│   │   ├── appraisal.schema.ts
│   │   └── employee.schema.ts
│   │
│   ├── repositories/                     # Data Access Layer (ACID Parameterized Storage)
│   │   ├── IEmployeeRepository.ts
│   │   ├── ILeaveRepository.ts
│   │   ├── IExpenseRepository.ts
│   │   ├── IAppraisalRepository.ts
│   │   ├── IAuditRepository.ts
│   │   └── jsonStore/                    # Robust atomic file-locked JSON/SQLite repository
│   │
│   ├── services/                         # Core Business Logic & State Transition Rules
│   │   ├── AuthService.ts
│   │   ├── LeaveService.ts
│   │   ├── ExpenseService.ts
│   │   ├── AppraisalService.ts
│   │   └── AuditService.ts
│   │
│   ├── controllers/                      # HTTP Handlers (Transforms HTTP req/res to Domain Logic)
│   │   ├── AuthController.ts
│   │   ├── PortalController.ts
│   │   └── AdminController.ts
│   │
│   ├── middleware/                       # DevSecOps Defensive Middleware Stack
│   │   ├── validateSchema.ts             # Zod input validation guard
│   │   ├── requireAuth.ts                # Cryptographic session validator
│   │   ├── requireRole.ts                # Strict RBAC permission barrier
│   │   ├── securityHeaders.ts            # Helmet-grade CSP, HSTS, X-Frame-Options
│   │   ├── rateLimiter.ts                # Brute-force & DoS mitigation
│   │   ├── csrfProtection.ts             # SameSite + anti-CSRF token check
│   │   └── errorHandler.ts               # Fail-secure global exception handler
│   │
│   └── app.ts / server.ts                # Express application bootstrapping
│
└── tests/                                # E2E & Security Verification Suites
    ├── api/                              # Track 1: API & Security Integration Tests
    └── e2e/                              # Track 2: End-to-End Workflow & Opaque-Box Tests
```

---

## 5. Typography & Motion Design System Architecture

### Typography Specifications
In strict adherence to `update/docs/DESIGN-SYSTEM.md` and requirement R2:
- **Headings Font**: `Bricolage Grotesque`
  - Font weights: `500` for `<h2>`, `<h3>`; `600` for `<h1>` and main page titles (`.nx-page-title`).
  - Letter spacing: `-0.05em` for display titles; `-0.04em` to `-0.035em` for section titles (`.nx-section-title`).
  - Avoid font weights `700–900` to maintain refined editorial balance.
  - Scale: Page titles clamp from `36px` to `64px`; section titles clamp from `30px` to `50px`.
- **Body & Controls Font**: `Instrument Sans` (with `DM Sans` as cross-platform system fallback).
  - Font weights: `400` for body paragraphs; `600` for controls, interactive buttons, badges, and table headers.
  - Line height: `1.6` for general copy; `1.65` for small/subtle text.
- **Tabular Figures for Financial Accuracy**:
  - All currency balances, loan calculator outputs, yield percentages, and leave balance numbers must use `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) to prevent optical jitter during live updates.

### Motion Design System (`motion` / Framer Motion 12)
1. **Micro-Interactions**:
   - Buttons and interactive cards feature subtle feedback: `whileHover={{ scale: 1.015 }}` and `whileTap={{ scale: 0.985 }}`.
   - Form inputs emphasize focus with smooth 150ms border-color transitions matching `--nx-blue` (`#0D51B2`).
2. **Contextual Navigation Transitions**:
   - Route and modal transitions leverage `<AnimatePresence mode="wait">`.
   - Motion curve: `transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}` matching the design system standard `--nx-ease: cubic-bezier(0.22, 1, 0.36, 1)`.
   - Directional sliding on step flows (e.g. Leave application: Step 1 Dates -> Step 2 Type -> Step 3 Confirmation).
3. **Natural Easing & Physics**:
   - Zero linear motion. All animations utilize the cubic bezier easing curve `[0.22, 1, 0.36, 1]`.
4. **Perceived Performance & Skeletons**:
   - Data-heavy views (Leave History table, Expense List, Employee Directory) render animated pulse skeletons (`bg-subtle animate-pulse rounded-md`) before data arrives, eliminating jarring content shifts (CLS = 0).
5. **Reduced Motion Accessibility**:
   - Strict adherence to `prefers-reduced-motion: reduce`:
   ```typescript
   import { useReducedMotion } from 'motion/react';
   // In components:
   const shouldReduceMotion = useReducedMotion();
   const animation = shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
   ```

---

## 6. DevSecOps & Security Frameworks Evaluation

As Principal DevSecOps Engineer and Secure Coding Architect, we evaluate the five mandated security frameworks and define concrete mitigation implementations across the entire codebase.

```
+----------------------------------------------------------------------------------------------------+
|                                    DEFENSE-IN-DEPTH ARCHITECTURE                                   |
+----------------------------------------------------------------------------------------------------+
| Layer 1: Network & Boundary       | Strict CORS, Rate Limiting (5 auth req/15min), IP tracking    |
| Layer 2: HTTP Security Headers    | Helmet: CSP (script-src 'self'), HSTS, X-Frame-Options: DENY   |
| Layer 3: Transport & Cookies      | TLS enforcement, HttpOnly, Secure, SameSite=Strict cookies     |
| Layer 4: Input Schema Barrier     | Zero-Trust Zod validation on ALL payloads, params & queries   |
| Layer 5: Authoritative RBAC       | Server-side role & ownership verification (No client trust)   |
| Layer 6: Business Invariants      | State machine guards (e.g. balance deduction, no self-approval)|
| Layer 7: Parameterized Storage    | Prepared queries / zero SQL/NoSQL injection string building   |
| Layer 8: Fail-Secure Error Model  | Sanitized error envelopes, zero stack trace/schema leakage     |
| Layer 9: Security Audit Logging   | Immutable append-only audit trail for all mutations & auth     |
+----------------------------------------------------------------------------------------------------+
```

### Framework 1: OWASP Top 10 (2021/2025)

| OWASP Vulnerability | Risk Scenario in HRMS / Expense System | Concrete Architectural Mitigation |
|---|---|---|
| **A01: Broken Access Control** | An employee alters the URL parameter `GET /api/portal/expenses/exp-99` to read or approve another colleague's claim (IDOR). | **Centralized RBAC & Tenancy Enforcement**: The `requireAuth` middleware injects `req.user`. Controller asserts `expense.employeeId === req.user.id || ['manager', 'finance_admin', 'admin'].includes(req.user.role)`. If false, fails immediately with `403 Forbidden`. |
| **A02: Cryptographic Failures** | Plaintext password storage or weak client-side SHA-256 hashing (as observed in legacy `CmsPortal.tsx`). | **Argon2id / Bcrypt Password Hashing**: Server-side hashing utilizing `bcryptjs` with cost factor 12 (or native `crypto.scrypt`/Argon2). Session tokens use high-entropy cryptographically secure random bytes (`crypto.randomBytes(32)`). Cookies set with `HttpOnly; Secure; SameSite=Strict; Path=/`. |
| **A03: Injection (SQLi / NoSQLi)** | Malicious SQL string in leave reason or expense note (`' OR 1=1 --`). | **Parameterized Queries & Invariant Storage**: All database interactions use prepared statements with strict parameter binding. Direct string interpolation or query concatenation is strictly prohibited by architectural linting. |
| **A04: Insecure Design** | Employee submits negative expense claim (`-₦50,000`) or applies for negative leave days to inflate balance. | **Domain Invariants**: Zod schemas enforce `amount > 0` and `days > 0`. Business domain layer checks `currentBalance >= requestedDays` before creating a pending leave record. |
| **A05: Security Misconfiguration** | Uncaught exception emits Node stack trace or internal database column names to client. | **Fail-Secure Global Error Handler**: Global middleware catches all errors. Client receives `{ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Reference: req_uuid' } }`. Internal details logged strictly to server stdout/audit files. |
| **A06: Vulnerable Components** | Outdated NPM dependencies with known CVEs. | **Lockfile Pinning & CI Audit**: `npm audit --omit=dev` integrated into build gate. Only lockfile-pinned dependencies permitted. |
| **A07: Identification & Auth Failures** | Brute-force credential stuffing against `/api/auth/login`. | **Adaptive Rate Limiting & Timing-Safe Comparison**: Express rate limiter limits login attempts to 5 per 15-minute window per IP. Password comparison uses `crypto.timingSafeEqual` to neutralize side-channel timing attacks. |
| **A08: Software & Data Integrity** | Unsafe deserialization of receipt attachments or JSON payloads. | **Strict Schema Ingestion**: JSON parsing followed immediately by Zod `.safeParse()`. No `eval()`, `Function()`, or unsafe object reconstruction. |
| **A09: Security Logging & Monitoring** | Unauthorized access attempts or balance changes occur without detection. | **Immutable Audit Log**: Every authentication, leave state change, and expense approval writes an event to an append-only audit trail (`server/logs/audit.log`) with timestamp, actor ID, IP, target ID, and before/after delta. |
| **A10: SSRF** | User provides arbitrary URL to download expense receipt. | **Restricted Upload Handling**: Receipts are uploaded via standard multipart form data, validated for image MIME types (`image/jpeg`, `image/png`, `application/pdf`), and stored locally; outbound URL fetching is prohibited. |

---

### Framework 2: NIST SSDF (SP 800-218) — Produce Well-Secured Software

The platform adheres directly to NIST SP 800-218 guidelines:
1. **PW.1 (Design Software to Meet Security Requirements)**:
   - Threat boundaries are established at the API gateway: all traffic crossing from client to server is untrusted.
   - Segregation of duties: Managers can approve leave but cannot modify expense payment schedules; finance controllers can reimburse expenses but cannot alter appraisal scores.
2. **PW.4 (Reuse Existing, Well-Secured Software)**:
   - Rely on Node's native `node:crypto` for cryptographic random generation and hashing rather than unvetted third-party algorithms.
   - Use standard Express and Zod libraries.
3. **PW.5 (Adhere to Secure Coding Practices)**:
   - TypeScript strict mode enabled (`"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`).
   - Immutable data structures for financial records (expense records once paid cannot be deleted, only adjusted via compensating entries).
4. **PW.6 (Configure Software with Secure Defaults)**:
   - Closed-by-default routing: All API routes reject requests unless the route is explicitly declared in the public routes whitelist.
   - Strict session timeout: Inactive sessions expire after 30 minutes; session rotation on privilege escalation.

---

### Framework 3: SEI CERT Coding Standards

Application of SEI CERT principles for JavaScript/TypeScript:
- **Rule IDS00-J / IDS01 (Input Validation)**: All input strings are trimmed and normalized (`NFKC`). Length limits strictly bounded:
  - Email: max 128 characters, RFC 5322 regex validation.
  - Names: max 80 characters, alphanumeric + standard name punctuation.
  - Expense titles: max 120 characters; descriptions max 1000 characters.
  - Numbers: checked with `Number.isFinite()` to prevent `NaN` or `Infinity` injections.
- **Rule IDS03 (Do Not Log Unsanitized User Input)**: Log injection (CRLF in user input altering log files) is eliminated by stripping `\r` and `\n` characters before writing to audit logs.
- **Rule ERR00 (Fail-Safe Defaults)**: If any authorization middleware encounters a database timeout or parse error, it defaults to **DENY ACCESS** (`403 Forbidden`).
- **Memory Safety & Prototype Pollution Protection**: Object deserialization does not permit `__proto__`, `constructor`, or `prototype` keys. Zod schemas strictly filter undeclared fields (`z.object({...}).strict()`).

---

### Framework 4: CWE / SANS Top 25 Most Dangerous Weaknesses

| CWE Identifier | Description | Elimination Strategy |
|---|---|---|
| **CWE-79** | Cross-Site Scripting (XSS) | React 19 JSX output encoding by default; strict prohibition of `dangerouslySetInnerHTML`; Content-Security-Policy header restricting script execution to `'self'`. |
| **CWE-89** | SQL / Query Injection | Strict parameterization on all persistence queries; zero string concatenation. |
| **CWE-269** | Improper Privilege Management | Authoritative server-side RBAC guard (`requireRole(['admin', 'hr'])`) evaluated on every request prior to controller execution. |
| **CWE-352** | Cross-Site Request Forgery (CSRF) | SameSite=Strict cookies combined with custom header validation (`X-Requested-With: XMLHttpRequest` or anti-CSRF token) on all mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`). |
| **CWE-502** | Deserialization of Untrusted Data | Payload size limited to 1MB (`express.json({ limit: '1mb' })`); payloads validated against typed Zod schemas. |
| **CWE-787** | Out-of-Bounds Write / Buffer Flaws | Strict size boundaries on file uploads (max 5MB for receipts); memory-safe Node buffer streams. |
| **CWE-287** | Improper Authentication | Session IDs generated with 256-bit entropy (`crypto.randomBytes(32).toString('hex')`); passwords hashed with Bcrypt/Argon2 with work factor 12. |

---

### Framework 5: Microsoft Security Development Lifecycle (SDL)

1. **Principle of Least Privilege (PoLP)**:
   - Database operations execute using scoped data access modules that only query the required tables.
   - Users operate in scoped roles: Standard employees have zero access to administrative mutation endpoints.
2. **Attack Surface Reduction (ASR)**:
   - HTTP methods restricted strictly to `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. `TRACE` and `TRACK` methods return `405 Method Not Allowed`.
   - Express server banner suppressed (`app.disable('x-powered-by')`).
   - Debug endpoints disabled in production builds.
3. **Defense-in-Depth**:
   - Each endpoint requires 3 distinct defensive gates:
     1. Network & Rate Limiter Gate
     2. Authentication & RBAC Gate
     3. Zod Input Schema Gate

---

## 7. Zero-Trust Input Schema Design (Zod Architecture)

Every inbound HTTP request must be validated against a pre-compiled Zod schema before entering controller logic. If validation fails, the server terminates the request immediately with `400 Bad Request` and sanitized validation issues.

### Concrete Production Schemas

```typescript
// server/schemas/auth.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(128),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().length(64, 'Invalid reset token format'),
  newPassword: z.string()
    .min(10, 'Password must be at least 10 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
}).strict();

// server/schemas/leave.schema.ts
export const createLeaveRequestSchema = z.object({
  leaveType: z.enum(['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'compassionate']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  daysCount: z.number().positive().max(60, 'Single leave application cannot exceed 60 days'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  relieverEmployeeId: z.string().uuid().optional(),
}).strict().refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date cannot be earlier than start date',
  path: ['endDate'],
});

export const updateLeaveStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewComments: z.string().trim().max(500).optional(),
}).strict();

// server/schemas/expense.schema.ts
export const createExpenseClaimSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.enum(['travel', 'meals', 'lodging', 'office_supplies', 'telecom', 'training', 'other']),
  amount: z.number().positive('Expense amount must be positive').max(10_000_000, 'Amount exceeds threshold'),
  currency: z.literal('NGN').default('NGN'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  merchantName: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(1000).optional(),
  receiptUrl: z.string().url().max(500).optional(),
}).strict();

export const updateExpenseStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'REIMBURSED']),
  approvalNotes: z.string().trim().max(500).optional(),
  reimbursementReference: z.string().trim().max(100).optional(),
}).strict();

// server/schemas/employee.schema.ts
export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(128),
  department: z.enum(['Engineering', 'Finance', 'Credit & Risk', 'Human Resources', 'Operations', 'Executive']),
  jobTitle: z.string().trim().min(2).max(80),
  role: z.enum(['employee', 'manager', 'hr_admin', 'finance_admin', 'master_admin']).default('employee'),
  dateOfJoining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  annualLeaveAllowance: z.number().int().min(0).max(40).default(20),
  monthlySalary: z.number().positive().optional(),
}).strict();
```

---

## 8. Secure Authentication & Session Architecture

### Session Management Flow
```
[Client Browser]
       │
       │  1. POST /api/v1/auth/login (email, password)
       ▼
[Rate Limiter & Zod Validation Middleware]
       │
       │  2. Validate payload schema & check IP rate limit
       ▼
[Auth Service & Bcrypt Verification]
       │
       │  3. Verify password hash using crypto.timingSafeEqual
       ▼
[Session Generator]
       │
       │  4. Generate 256-bit secure session ID
       │  5. Persist Session { id, userId, role, expiresAt, ip, userAgent }
       ▼
[Set-Cookie Response]
       │
       │  Set-Cookie: nx_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
       ▼
[Client Browser Authenticated State]
```

### Cookie Security Flags
- **`HttpOnly`**: Set to `true`. JavaScript running in the browser cannot read the cookie document object, preventing token theft via XSS.
- **`Secure`**: Set to `true` (in production / HTTPS). Transmitted only over encrypted channels.
- **`SameSite=Strict`**: Cookie is only sent in first-party contexts, mitigating CSRF attacks.
- **`Path=/`**: Scoped to the application root.

---

## 9. Fail-Secure Error Handling Architecture

To neutralize CWE-209 (Information Exposure Through an Error Message) and OWASP A05 (Security Misconfiguration), the platform implements an authoritative fail-secure error architecture.

### Standardized Error Envelope
All client error responses strictly follow this format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data failed validation requirements.",
    "correlationId": "corr_c8b7f14e-4f2a-463e-9087-321a4f02863a",
    "details": [
      {
        "field": "endDate",
        "message": "End date cannot be earlier than start date"
      }
    ]
  }
}
```

### Error Handler Implementation

```typescript
// server/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import crypto from 'node:crypto';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = `corr_${crypto.randomUUID()}`;

  // Log internal trace securely to server log (not client)
  console.error(`[ERROR] [${correlationId}] ${req.method} ${req.originalUrl}:`, err);

  // 1. Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted request data failed schema validation.',
        correlationId,
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  // 2. Handle Known Operational Domain Errors
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const safeMessage = statusCode === 500
    ? 'An unexpected error occurred while processing your request. Please contact support with the correlation ID.'
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: safeMessage,
      correlationId,
    },
  });
}
```

---

## 10. E2E & Verification Strategy

We propose a **Dual-Track Verification Strategy** to validate both security boundaries and complete user workflows.

### Track 1: API & Security Integration Test Suite
Executed directly in Node.js 24 using native test runner (`node:test` or `vitest`) with `supertest`:
1. **Authentication Barrier Tests**:
   - Verify unauthenticated requests to `/api/portal/*` and `/api/admin/*` receive `401 Unauthorized`.
   - Verify non-admin users attempting to access `/api/admin/*` receive `403 Forbidden`.
   - Verify rate limiting triggers `429 Too Many Requests` after 5 failed login attempts.
2. **Schema Invariant Tests**:
   - Verify negative expense amounts (`-100`) return `400 Bad Request` with field error.
   - Verify leave end date prior to start date is rejected.
   - Verify SQL injection payloads (`' OR 1=1 --`) in search/filter params are safely treated as literal strings and do not cause syntax errors or leaks.
3. **Business Logic & State Transitions**:
   - Verify employee applying for 5 days of leave deducts 5 days from pending balance.
   - Verify manager approving leave transitions state from `PENDING` to `APPROVED`.
   - Verify manager rejecting leave restores leave balance.
   - Verify self-approval is blocked (a manager cannot approve their own expense claim).

### Track 2: Opaque-Box E2E Workflow Testing
Simulated browser end-to-end testing:
1. **Staff Portal Workflow**:
   - Employee logs in -> Redirected to `/portal/dashboard`.
   - Navigates to `/portal/leave` -> Views current balance (e.g., 20 days).
   - Submits 3-day annual leave request -> Success toast appears, pending leave list updates.
2. **Manager Approval Workflow**:
   - Manager logs in -> Navigates to `/admin/leave-approvals`.
   - Sees pending request from employee -> Clicks 'Approve' with comment.
   - Request status updates to 'APPROVED'.
3. **Expense Filing & Reimbursement Workflow**:
   - Employee submits ₦45,000 travel expense with receipt.
   - Manager approves -> Finance admin marks as 'REIMBURSED' with reference code.
   - Audit trail registers all 3 actions with actor timestamps.
4. **Visual Layout & Responsive Check**:
   - Verification across 320px (mobile), 768px (tablet), and 1280px (desktop).
   - Tabular numerals verified on all financial figures.

---

## 11. Implementation Roadmap & Architectural Directives

For the engineering team entering Phase 1 and Phase 2:
1. **Scaffold Directory Layout**:
   - Create `src/pages/` containing `public/`, `portal/`, `admin/`, and `auth/`.
   - Cleanly segregate reusable controls in `src/components/ui/`, `src/components/layout/`, and `src/components/features/`.
2. **Initialize Server Engine**:
   - Implement `server/` with Express, Helmet, Cookie-Parser, Zod schemas, and parameterized storage.
3. **Configure Build & Test Scripts**:
   - Script for concurrent dev: `"dev": "vite"` + `"server": "tsx watch server/server.ts"`.
   - Script for tests: `"test": "tsx --test tests/**/*.test.ts"`.
4. **DevSecOps Checklist**:
   - Ensure all routes enforce Zod validation.
   - Verify password hashing uses Bcrypt with 12 rounds.
   - Validate that no stack traces leak in error responses.

---
*Report produced by explorer_survey_3 (System Architecture, Tech Stack & DevSecOps Explorer).*
