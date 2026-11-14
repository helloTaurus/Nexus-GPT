# Project: Nexus Finance HRMS & Expense Suite (Zoho People Replication)

## Architecture
- **Architecture Pattern**: Full-Stack Clean Architecture with modular service layers and strict boundary separation.
- **Client**: React 19 + Vite 8 + Tailwind CSS v4 + Motion (`motion/react`).
- **Client Routing & Scaffolding**: Strictly nested within `src/pages/` (`public/`, `portal/`, `admin/`, `auth/`), cleanly isolated from reusable UI primitives in `src/components/` (`ui/`, `layout/`, `features/`).
- **Server**: Express 4 with TypeScript (`tsx`), modular controllers, zero-trust schema validation middleware (Zod), RBAC guards, and fail-secure error handlers.
- **Persistence & Data Access**: Transactional Repository pattern backed by atomic, file-locked JSON/SQLite storage (`server/data/`), completely eliminating SQL injection vectors and avoiding heavy external database dependencies.
- **Typography**: `Bricolage Grotesque` (headings, display) and `Instrument Sans` / `DM Sans` (body, tables, controls). Tabular numerals for monetary figures.
- **Color System & Design Tokens**: Nexus sapphire action (`#0D51B2`), canvas (`#F7F8FA`/`#0D1624`), surface (`#FFFFFF`/`#121E2E`), ink (`#101E30`/`#F3F6FA`), positive status emerald (`#007B58`/`#69D3B0`), 7px control radius, 12px card radius, 4px grid rhythm.
- **Motion System**: `--nx-ease: cubic-bezier(0.22, 1, 0.36, 1)`, micro-interactions, contextual navigation transitions, skeleton loaders.
- **DevSecOps Frameworks**:
  1. OWASP Top 10 (Strict parameterization, Bcrypt/Argon2 password hashing, secure HttpOnly/SameSite cookies, no credential leaks).
  2. NIST SSDF (SP 800-218) (Produce Well-Secured Software, zero-trust validation, secure defaults).
  3. SEI CERT (Defensive input/state handling, memory safety, fail-safe defaults).
  4. CWE / SANS Top 25 (Neutralize CWE-79 XSS, CWE-89 SQLi, CWE-269 privilege escalation, CWE-434 unrestricted uploads).
  5. Microsoft SDL (Principle of least privilege, minimal attack surface, sanitized error masking).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F01: Secure Authentication & Sessions | Server-side password hashing (Bcrypt/Argon2), secure HttpOnly & SameSite=Strict cookies, session validation | M2 | R5 / spec_miner / explorer_3 |
| 2 | F02: Role-Based Access Control (RBAC) | Three-tier authorization (`Employee`, `Manager`, `Admin`) with server-side endpoint guards | M2 | R4 / R5 / spec_miner |
| 3 | F03: Staff Profile Self-Service | Employee personal info, emergency contacts, Nigerian NUBAN banking details | M3 | R4 / spec_miner |
| 4 | F04: Leave Balances & Entitlements | Real-time entitlement tracking across 6 leave types (Annual, Sick, Casual, Maternity, Paternity, Bereavement) | M3 | R4 / spec_miner |
| 5 | F05: Leave Application Submission | Date range selection, working-day calculation excluding weekends & Nigerian holidays, balance reservation | M3 | R4 / spec_miner |
| 6 | F06: Leave History & Status Tracking | Real-time status badges, request cancellation, manager comments display | M3 | R4 / spec_miner |
| 7 | F07: Itemized Expense Filing | Multi-item expense report creation, category allocation, currency handling | M4 | R4 / spec_miner |
| 8 | F08: Expense Receipt & Document Upload | File upload with magic-byte MIME validation, size enforcement (10MB limit), secure storage | M4 | R4 / R5 / spec_miner |
| 9 | F09: Expense Claim History & Tracking | Multi-stage lifecycle tracking (Submitted -> Manager Approved -> Finance Verified -> Disbursed) | M4 | R4 / spec_miner |
| 10 | F10: Appraisal Self-Evaluation | Employee self-review against 70/30 weighted KRA/Competency goals, 5-point rating scale | M5 | R4 / spec_miner |
| 11 | F11: Staff Directory View | Searchable, paginated directory of colleagues with department, designation, and contact info | M5 | R4 / spec_miner |
| 12 | F12: Leave Policy & Rules Engine | Zero-overdraft balance protection, policy accrual rules, Nigerian gazetted holiday exclusion | M3 | R4 / spec_miner |
| 13 | F13: Leave Approval/Rejection Workflow | Multi-tier manager approval queue, rejection reason logging, balance reservation release | M3 | R4 / spec_miner |
| 14 | F14: Expense Rules & Categorization Engine | Category thresholds, mandatory receipt enforcement (> NGN 5,000), policy validation | M4 | R4 / spec_miner |
| 15 | F15: Expense Multi-Tier Approval Workflow | Manager review, finance verification, disbursement queue, self-approval prohibition | M4 | R4 / spec_miner |
| 16 | F16: Appraisal Cycles & Template Master | Cycle scheduling, deadline enforcement, template configuration | M5 | R4 / spec_miner |
| 17 | F17: Manager Appraisal Evaluation Form | 1-on-1 manager scoring rubric, competency assessment, qualitative feedback | M5 | R4 / spec_miner |
| 18 | F18: Appraisal Status & Calibration Grid | Administrative performance distribution grid, cycle finalization | M5 | R4 / spec_miner |
| 19 | F19: Administrative Employee Management | Full CRUD on employee directory, department/designation assignments, reporting hierarchy | M5 | R4 / spec_miner |
| 20 | F20: Role & Permission Administration | Role assignment, user account activation/deactivation, access level adjustments | M5 | R4 / spec_miner |
| 21 | F21: Immutable Security Audit Logging | Structured audit trail logging user, action, entity, timestamp, IP, UA, and state diff | M2 | R5 / spec_miner / explorer_3 |
| 22 | F22: Clean Architecture Scaffolding | Restructure project: `src/pages/` separate from `src/components/`, layout templates, routing | M1 | R1 / R2 / explorer_3 |
| 23 | F23: Exact Design Replication & Motion | Tokens, typography, Bricolage Grotesque, Instrument Sans, `--nx-ease` motion, skeleton loaders | M1 | R2 / R3 / explorer_1 |
| 24 | F24: Zero-Trust Input Schema Validation | Comprehensive Zod schemas for all payload, query, and param inputs | M2 | R5 / explorer_3 |
| 25 | F25: Fail-Secure Error Handling & Headers | Sanitized error responses, helmet/CORS security headers, internal correlation IDs | M2 | R5 / explorer_3 |
| 26 | F26: Automated E2E & Verification Suite | Opaque-box E2E test suite (Tiers 1-4) and Tier 5 adversarial hardening | M6 | R5 / Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Scaffolding, Pages Restructure & Design System | Scaffolding dedicated `src/pages/` (`public/`, `portal/`, `admin/`, `auth/`), separating reusable `src/components/`, integrating Bricolage Grotesque & Instrument Sans, motion system, public routes | none | DONE |
| 2 | M2: DevSecOps Foundation, Zero-Trust Schemas & Auth/RBAC | Express backend, Zod validation middleware, Bcrypt password hashing, HttpOnly cookies, RBAC authorization guards, immutable audit log, fail-secure error handlers | M1 | DONE |
| 3 | M3: Staff Portal & Leave Management Suite | Employee self-service profile, leave balance engine, leave request filing, manager approval/rejection workflows, holiday exclusion logic, UI pages | M2 | DONE |
| 4 | M4: Expense Reimbursement & Receipt Management | Expense report filing, category allocation, receipt upload with MIME validation, multi-tier approval & reimbursement queue, UI pages | M2 | DONE |
| 5 | M5: Performance Appraisals & Administrative Management | Appraisal cycles, self & manager evaluations, workforce directory CRUD, reporting hierarchy, role administration, UI pages | M3, M4 | DONE |
| 6 | M6: Pass 100% E2E Test Suite & Adversarial Hardening | Pass 100% of Tiers 1-4 E2E tests published by E2E Testing Track, followed by Phase 2 adversarial coverage hardening (Tier 5) and forensic audit | M5, TEST_READY | IN_PROGRESS |

## Interface Contracts

### Client ↔ Server Auth & Session Contract
- `POST /api/v1/auth/login`: `{ email: string, password: string }` -> Sets HttpOnly `nexus_session` cookie; returns `{ user: { id, email, role, firstName, lastName, designation, department } }`
- `POST /api/v1/auth/logout`: Clears `nexus_session` cookie; returns `{ success: true }`
- `GET /api/v1/auth/me`: Returns current authenticated user profile and roles
- `GET /api/v1/portal/profile`: Returns full employee profile, emergency contacts, bank details
- `PUT /api/v1/portal/profile`: Validated update to employee personal info

### Leaves Service Contract
- `GET /api/v1/leaves/balances`: Returns `LeaveBalance[]` (entitled, used, pending, available)
- `POST /api/v1/leaves/requests`: Validated `{ leaveTypeId, startDate, endDate, reason }` -> Deducts pendingDays, creates `LeaveRequest` with status `Pending`
- `GET /api/v1/leaves/requests`: Returns user's leave requests (or direct reports if Manager, all if Admin)
- `POST /api/v1/leaves/requests/:id/review`: Validated `{ decision: 'Approved' | 'Rejected', comment?: string }` -> Updates state, adjusts balances, writes audit log

### Expenses Service Contract
- `GET /api/v1/expenses/reports`: Returns user's expense reports
- `POST /api/v1/expenses/reports`: Validated `{ title, description, items: [{ categoryId, amount, currency, expenseDate, merchant, receiptUrl? }] }`
- `POST /api/v1/expenses/upload-receipt`: Multipart file upload -> Validates magic bytes, stores receipt, returns `{ receiptUrl, filename }`
- `POST /api/v1/expenses/reports/:id/review`: Validated `{ decision: 'ManagerApproved' | 'Rejected' | 'FinanceDisbursed', comment?: string }`

### Appraisals & Admin Contract
- `GET /api/v1/appraisals/my-reviews`: Returns current active cycle and employee review forms
- `POST /api/v1/appraisals/submissions`: Validated `{ cycleId, ratings: [{ kraId, score, comment }], selfOverallRating, selfComments }`
- `GET /api/v1/admin/employees`: Searchable, paginated employee directory
- `POST /api/v1/admin/employees`: Validated employee creation schema
- `PUT /api/v1/admin/employees/:id`: Validated employee profile/role update

## Code Layout
```
update/
├── docs/
│   └── DESIGN-SYSTEM.md
├── server/
│   ├── index.ts                     # Express application entry point
│   ├── config/                      # Environment and security configuration
│   ├── middleware/
│   │   ├── auth.ts                  # Session & JWT HttpOnly cookie validator
│   │   ├── rbac.ts                  # Role-based access control guard
│   │   ├── validate.ts              # Zod schema validation middleware
│   │   └── errorHandler.ts          # Fail-secure error sanitizer
│   ├── schemas/                     # Zero-trust Zod schemas (auth, leaves, expenses, appraisals)
│   ├── repositories/                # Transactional data store repository interfaces & implementation
│   ├── services/                    # Domain business logic (leaves, expenses, appraisals, auth)
│   ├── controllers/                 # Route handlers
│   └── data/                        # File-locked JSON/SQLite transactional database store
├── src/
│   ├── main.tsx                     # React client entry point
│   ├── App.tsx                      # App root router
│   ├── index.css                    # Tailwind semantic layer
│   ├── nexus-tokens.css             # Official design tokens (dark/light)
│   ├── nexus-system.css             # Typographic & geometric rules
│   ├── pages/                       # Dedicated pages directory (MANDATORY CONSTRAINT)
│   │   ├── public/                  # Landing, Products, About, Careers, Blog, Gallery
│   │   ├── auth/                    # Login, Register
│   │   ├── portal/                  # Staff Portal (Dashboard, Profile, Leaves, Expenses, Appraisals)
│   │   └── admin/                   # Admin Portal (Workforce, Leave Approvals, Expense Queue, Calibration)
│   ├── components/                  # Pure reusable UI components
│   │   ├── ui/                      # Atoms: Button, Input, Modal, Badge, Drawer, Card, Skeleton
│   │   ├── layout/                  # Navbar, Sidebar, Footer, PortalLayout, AdminLayout
│   │   └── features/                # Reusable domain cards: LeaveCard, ExpenseRow, RatingSlider
│   └── lib/                         # Client utilities: api client, auth context, motion variants
└── tests/
    ├── e2e/                         # Opaque-box E2E test suites (Tiers 1-4)
    ├── adversarial/                 # Tier 5 white-box stress & security tests
    └── testRunner.ts                # Native test runner configuration
```
