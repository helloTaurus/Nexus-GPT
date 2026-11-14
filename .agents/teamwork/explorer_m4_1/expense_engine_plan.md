# Comprehensive Engineering Plan: Backend Expense Engine & Multi-Tier Approval (Milestone 4)

## Executive Summary
This document provides the definitive architectural blueprint and implementation specification for Milestone 4 (Expense Reimbursement & Receipt Management Suite), focusing on the backend expense engine, zero-trust Zod schemas, policy validation engine, multi-tier escalation hierarchy, and state machine transition guards.

All specifications have been verified against existing opaque-box E2E suites (`expenses.test.ts`, `expense-boundaries.test.ts`, `expense-workflow-combinations.test.ts`, `multi-item-expense-reimbursement.test.ts`), the reference server, and DevSecOps security frameworks.

---

## 1. Domain Model & System Architecture

### 1.1 Architecture Topology
Following Clean Architecture and project conventions (`PROJECT.md`):
```
update/server/
├── routes/
│   └── expenses.routes.ts        # Express router mounted at /api/v1/expenses
├── controllers/
│   └── expenseController.ts      # HTTP request/response handling, status code mapping
├── services/
│   └── expenseService.ts         # Pure domain business logic, policy engine, escalation rules
├── schemas/
│   └── expenseSchemas.ts         # Zero-trust Zod schemas with .strict()
├── repositories/
│   ├── expenseRepository.ts      # Persistence layer backed by AtomicJsonStore
│   └── types.ts                  # Domain TypeScript interfaces
└── data/
    ├── expense_reports.json      # File-locked JSON store
    └── settings.json             # System-wide threshold configurations
```

### 1.2 Data Types (`update/server/repositories/types.ts`)
```typescript
export type ExpenseStatus =
  | 'SUBMITTED'
  | 'PENDING_LINE_MANAGER'
  | 'PENDING_DEPT_HEAD'
  | 'PENDING_EXEC'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'REVISION_REQUESTED';

export interface ExpenseItemRecord {
  id: string;
  categoryId: string;
  dateIncurred: string;          // YYYY-MM-DD
  merchantName: string;
  amount: number;                // Positive NGN
  description?: string;
  receiptUrl?: string;           // Mandatory if amount > 5,000 NGN
  receiptFileName?: string;
  invoiceNumber?: string;
  isWeekend?: boolean;           // Policy violation flag
  flags?: string[];              // e.g. ['WEEKEND_EXPENSE']
}

export interface ExpenseReportRecord {
  id: string;                    // exp-<uuid>
  reportNumber: string;          // EXP-2026-XXXX
  employeeId: string;            // emp-xxx
  title: string;
  purpose: string;
  currency: string;              // 'NGN'
  totalAmount: number;
  status: ExpenseStatus;
  items: ExpenseItemRecord[];
  currentApproverId?: string;
  rejectionReason?: string;
  disbursementReference?: string;
  policyViolations?: string[];
  submittedAt: string;           // ISO timestamp
  approvedAt?: string;           // ISO timestamp
  paidAt?: string;               // ISO timestamp
}
```

---

## 2. API Contracts & Route Specifications

Base Route: `/api/v1/expenses`

### 2.1 Route Definition Matrix
| Method | Path | Auth / Role | Validator | Description |
|---|---|---|---|---|
| `GET` | `/categories` | Public / Auth | None | List 6 corporate expense categories & limits |
| `POST` | `/upload-receipt` | `requireAuth` | Magic-byte MIME + 10MB limit | Upload receipt document (PNG, JPEG, PDF) |
| `GET` | `/reports` | `requireAuth` | `validateQuery(expenseQuerySchema)` | List reports (`scope=mine`, `team`, `all`) |
| `POST` | `/reports` | `requireAuth` | `validateBody(submitExpenseReportSchema)` | File itemized expense report |
| `GET` | `/reports/:id` | `requireAuth` | None (UUID param) | Retrieve single report detail by ID |
| `PUT` | `/reports/:id` | `requireAuth` | `validateBody(updateExpenseReportSchema)` | Edit report in `REVISION_REQUESTED` or `SUBMITTED` |
| `PATCH` | `/reports/:id/action` | `requireAuth` | `validateBody(reviewExpenseReportSchema)` | Review/Approve/Reject/Request Revision |
| `POST` | `/reports/:id/action` | `requireAuth` | `validateBody(reviewExpenseReportSchema)` | Review alias (POST support) |
| `PATCH` | `/reports/:id/review` | `requireAuth` | `validateBody(reviewExpenseReportSchema)` | Review alias (contract parity) |
| `POST` | `/reports/:id/review` | `requireAuth` | `validateBody(reviewExpenseReportSchema)` | Review alias (contract parity) |
| `POST` | `/reports/:id/disburse`| `requireAuth` (Admin) | `validateBody(disburseExpenseReportSchema)` | Disburse approved claim |

---

## 3. Zero-Trust Zod Schemas (`update/server/schemas/expenseSchemas.ts`)

Zero-trust input hygiene strictly requires `.strict()` on all schemas to neutralize mass-assignment and prototype pollution vulnerabilities.

```typescript
import { z } from './zod.ts';

export const expenseCategoryEnum = z.enum([
  'cat-trav',
  'cat-hosp',
  'cat-office',
  'cat-telco',
  'cat-train',
  'cat-ops',
  'EXP-TRAV',
  'EXP-HOSP',
  'EXP-OFFICE',
  'EXP-TELCO',
  'EXP-TRAIN',
  'EXP-OPS'
]);

export const expenseItemInputSchema = z.object({
  categoryId: z.string().trim().min(1, 'Expense category is required'),
  amount: z.number({ required_error: 'Item amount is required' }),
  merchantName: z.string().trim().min(1, 'Merchant name is required').optional(),
  merchant: z.string().trim().min(1).optional(),
  dateIncurred: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date incurred must be YYYY-MM-DD').optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expense date must be YYYY-MM-DD').optional(),
  description: z.string().trim().max(1000).optional(),
  receiptUrl: z.string().trim().optional(),
  receiptFileName: z.string().trim().optional(),
  invoiceNumber: z.string().trim().max(100).optional()
}).strict();

export const submitExpenseReportSchema = z.object({
  title: z.string().trim().min(1, 'Report title is required').max(200, 'Title cannot exceed 200 characters'),
  purpose: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(1000).optional(),
  currency: z.string().trim().length(3).default('NGN').optional(),
  items: z.array(expenseItemInputSchema).min(1, 'At least one itemized expense is required')
}).strict();

export const updateExpenseReportSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  purpose: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(1000).optional(),
  currency: z.string().trim().length(3).optional(),
  items: z.array(expenseItemInputSchema).min(1).optional()
}).strict();

export const reviewExpenseReportSchema = z.object({
  action: z.enum([
    'APPROVE',
    'REJECT',
    'REQUEST_REVISION',
    'REVISION_REQUESTED',
    'ManagerApproved',
    'Rejected'
  ]).optional(),
  decision: z.enum([
    'APPROVE',
    'REJECT',
    'REQUEST_REVISION',
    'REVISION_REQUESTED',
    'ManagerApproved',
    'Rejected'
  ]).optional(),
  status: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUESTED']).optional(),
  comments: z.string().trim().max(1000).optional(),
  comment: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional()
}).strict();

export const disburseExpenseReportSchema = z.object({
  disbursementReference: z.string().trim().min(1, 'Disbursement reference is required').max(100),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paid date must be YYYY-MM-DD').optional()
}).strict();

export const expenseQuerySchema = z.object({
  scope: z.enum(['mine', 'team', 'all']).optional(),
  status: z.string().optional(),
  limit: z.union([z.number(), z.string().transform(v => parseInt(v, 10))]).optional(),
  offset: z.union([z.number(), z.string().transform(v => parseInt(v, 10))]).optional()
}).strict();
```

---

## 4. Policy Violation & Categorization Rules Engine

### 4.1 Corporate Expense Categories & Ceilings
From `SEED_EXPENSE_CATEGORIES`:
| Category ID | Code | Name | Max Single Limit | Receipt Threshold |
|---|---|---|---|---|
| `cat-trav` | `EXP-TRAV` | Travel & Mileage | 200,000 NGN | 5,000 NGN |
| `cat-hosp` | `EXP-HOSP` | Client Hospitality & Sales | 150,000 NGN | 5,000 NGN |
| `cat-office` | `EXP-OFFICE` | Office Supplies & Stationeries | 50,000 NGN | 5,000 NGN |
| `cat-telco` | `EXP-TELCO` | Internet & Telecommunications | 30,000 NGN | 5,000 NGN |
| `cat-train` | `EXP-TRAIN` | Training & Professional Development | 500,000 NGN | 5,000 NGN |
| `cat-ops` | `EXP-OPS` | Branch Petty Operations | 100,000 NGN | 5,000 NGN |

### 4.2 Policy Rules Specification
1. **Rule 1: Positive Amount Enforcement**
   - Condition: `amount <= 0 || isNaN(amount)`
   - Error: HTTP `400 Bad Request`
   - Response: `{ success: false, error: { code: 'INVALID_AMOUNT', message: 'Expense item amount must be a positive number' } }`

2. **Rule 2: Category Limit Enforcement**
   - Condition: `amount > category.maxSingleLimit`
   - Error: HTTP `422 Unprocessable Entity`
   - Response: `{ success: false, error: { code: 'CATEGORY_LIMIT_EXCEEDED', message: 'Item amount ${amt} exceeds maximum single limit of ${category.maxSingleLimit} NGN for ${category.name}' } }`

3. **Rule 3: Mandatory Receipt Enforcement**
   - Condition: `amount > 5,000 NGN` AND `(!receiptUrl || receiptUrl.trim() === '')`
   - Error: HTTP `422 Unprocessable Entity`
   - Response: `{ success: false, error: { code: 'RECEIPT_REQUIRED', message: 'Receipt document is mandatory for expense claims exceeding NGN 5,000 (Item: ${item.description || item.merchantName})' } }`

4. **Rule 4: Weekend Expense Detection (Warning / Flag)**
   - Condition: `new Date(item.dateIncurred).getUTCDay() === 0 || new Date(item.dateIncurred).getUTCDay() === 6`
   - Action: Non-blocking warning flag. Sets `item.isWeekend = true`, appends `'WEEKEND_EXPENSE'` to item flags, and appends `'WEEKEND_EXPENSE'` to report `policyViolations`. Approvers are alerted in the approval queue.

5. **Rule 5: Duplicate Invoice & Receipt Detection**
   - Condition:
     - Duplicate receipt file: A receipt URL has already been attached to an existing, non-rejected report.
     - Duplicate claim: The same employee submits the same merchant, same date, and same amount across reports.
   - Action: If an identical receipt is reused on an active claim, reject with HTTP `409 Conflict` (`code: 'DUPLICATE_INVOICE'`). If internal duplicate detected in draft, flag for review.

---

## 5. Multi-Tier Approval State Machine

### 5.1 Threshold Hierarchy
Threshold configurations are retrieved from `settings.json` / `settingsRepository`:
- Manager Threshold: **50,000 NGN**
- Executive Threshold: **250,000 NGN**

```
                     ┌──────────────────┐
                     │    SUBMITTED     │
                     └─────────┬────────┘
                               │
                       Line Manager Review
                               │
               ┌───────────────┴───────────────┐
      total <= 50,000 NGN              total > 50,000 NGN
               │                               │
               ▼                               ▼
       ┌───────────────┐             ┌──────────────────┐
       │   APPROVED    │             │ PENDING_DEPT_HEAD│
       └───────┬───────┘             └─────────┬────────┘
               │                               │
               │                        Dept Head Review
               │                               │
               │               ┌───────────────┴───────────────┐
               │      total <= 250,000 NGN             total > 250,000 NGN
               │               │                               │
               │               ▼                               ▼
               │       ┌───────────────┐             ┌──────────────────┐
               │       │   APPROVED    │             │   PENDING_EXEC   │
               │       └───────┬───────┘             └─────────┬────────┘
               │               │                               │
               │               │                        Executive Review
               │               │                               │
               │               │                               ▼
               │               │                     ┌──────────────────┐
               │               │                     │     APPROVED     │
               │               │                     └─────────┬────────┘
               │               │                               │
               └───────────────┼───────────────────────────────┘
                               │
                        Finance Review
                               │
                               ▼
                       ┌────────────────┐
                       │      PAID      │
                       └────────────────┘
```

### 5.2 Approver Role Assignment
- **Level 1 (Line Manager)**:
  - User ID: `user.profile.managerId || 'emp-manager-01'`
  - Reviews claims at status `SUBMITTED`.
  - Claim `<= 50,000 NGN`: Transitions to `APPROVED` (assigns `emp-finance-01`).
  - Claim `> 50,000 NGN`: Transitions to `PENDING_DEPT_HEAD` (assigns `emp-depthead-01`).
- **Level 2 (Department Head)**:
  - User ID: `emp-depthead-01` (Chukwuma Soludo, Operations Director) or Admin.
  - Reviews claims at status `PENDING_DEPT_HEAD`.
  - Claim `<= 250,000 NGN`: Transitions to `APPROVED` (assigns `emp-finance-01`).
  - Claim `> 250,000 NGN`: Transitions to `PENDING_EXEC` (assigns `emp-admin-01`).
- **Level 3 (Executive / Managing Director)**:
  - User ID: `emp-admin-01` (Folashade Adeyemi) or Admin.
  - Reviews claims at status `PENDING_EXEC`.
  - Transitions to `APPROVED` (assigns `emp-finance-01`).
- **Level 4 (Finance Disbursement)**:
  - User ID: `emp-finance-01` (Ngozi Eze, Financial Controller, role `ADMIN`).
  - Disburses claims at status `APPROVED` via `POST /disburse`.
  - Transitions to `PAID`.

### 5.3 Revision & Rejection Sub-flows
- **Request Revision (`action === 'REQUEST_REVISION'` or `'REVISION_REQUESTED'`)**:
  - Approver requests edits or clarifications.
  - Status becomes: `REVISION_REQUESTED`.
  - Employee edits report via `PUT /reports/:id`.
  - Status automatically resets to: `SUBMITTED`.
- **Rejection (`action === 'REJECT'`)**:
  - Approver enters comments/rejectionReason.
  - Status becomes terminal: `REJECTED`.

---

## 6. Terminal State & Security Guards

1. **Self-Approval Prohibition**:
   - `if (report.employeeId === user.profile.id)` -> Returns `403 Forbidden` with `code: 'SELF_APPROVAL_PROHIBITED'`.
   - Verified in `m2-auth-rbac-security-stress.test.ts:479` and `expense-boundaries.test.ts:118`.
2. **Terminal State Immutability**:
   - If `report.status === 'PAID'` or `report.status === 'REJECTED'`:
     Any further review action returns `409 Conflict` with `code: 'ALREADY_DECIDED'`.
   - If `report.status === 'APPROVED'` and review action is `APPROVE`:
     Returns `409 Conflict` with `code: 'ALREADY_DECIDED'`.
3. **Premature Disbursement Guard**:
   - If `report.status !== 'APPROVED'`:
     `POST /disburse` returns `409 Conflict` with `code: 'NOT_APPROVED'`.
     *(Note: Existing code erroneously returned `INVALID_STATE`, failing boundary tests).*
4. **Disbursement Authorization Guard**:
   - Only users with `user.role === 'ADMIN'` (Finance controller) may trigger disbursement.
   - Non-admins return `403 Forbidden` with `code: 'FORBIDDEN'`.
5. **Report Modification Guard**:
   - `PUT /reports/:id` is only permitted when:
     - `report.employeeId === user.profile.id` (otherwise `403 FORBIDDEN`).
     - `report.status === 'REVISION_REQUESTED' || report.status === 'SUBMITTED'` (otherwise `409 CANNOT_EDIT`).
6. **Listing Scope Guard**:
   - `scope === 'team'`: Disallowed for `role === 'EMPLOYEE'` -> returns `403 FORBIDDEN`.
   - `scope === 'all'`: Disallowed for non-`ADMIN` -> returns `403 FORBIDDEN`.

---

## 7. Audit Logging Invariants

Every state-mutating operation records a structured, immutable audit log entry via `getAuditService().record(...)`:
| Event Action | Trigger | Entity Type | State Diff Captured |
|---|---|---|---|
| `EXPENSE_SUBMITTED` | `POST /reports` | `ExpenseReport` | `reportNumber`, `totalAmount`, `itemCount` |
| `EXPENSE_APPROVED` | `PATCH /action` (Approve) | `ExpenseReport` | `approverId`, `newStatus`, `comments` |
| `EXPENSE_REJECTED` | `PATCH /action` (Reject) | `ExpenseReport` | `approverId`, `reason` |
| `EXPENSE_REVISION_REQUESTED` | `PATCH /action` (Revision) | `ExpenseReport` | `approverId`, `comments` |
| `EXPENSE_UPDATED` | `PUT /reports/:id` | `ExpenseReport` | `updatedFields` |
| `EXPENSE_DISBURSED` | `POST /disburse` | `ExpenseReport` | `disbursementReference`, `amount`, `paidDate` |

---

## 8. Defect Catalog & Remediation Instructions for Worker

| Defect # | Location | Description | Required Fix |
|---|---|---|---|
| **D1** | `update/server/routes/expenses.routes.ts` | Missing `GET /reports/:id` route | Add `expensesRouter.get('/reports/:id', requireAuth, getExpenseReportByIdHandler);` |
| **D2** | `update/server/routes/expenses.routes.ts` | Missing `PUT /reports/:id` route | Add `expensesRouter.put('/reports/:id', requireAuth, validateBody(updateExpenseReportSchema), updateExpenseReportHandler);` |
| **D3** | `update/server/routes/expenses.routes.ts` | Missing Zod schema validation middleware | Mount `validateBody(submitExpenseReportSchema)` on `POST /reports`, `validateBody(reviewExpenseReportSchema)` on review routes, and `validateBody(disburseExpenseReportSchema)` on `/disburse` |
| **D4** | `update/server/controllers/expenseController.ts:370` | Premature disbursement returns `INVALID_STATE` instead of `NOT_APPROVED` | Change error code to `'NOT_APPROVED'` |
| **D5** | `update/server/controllers/expenseController.ts:288` | Rejection of `REQUEST_REVISION` action | Support both `action === 'REQUEST_REVISION'` and `action === 'REVISION_REQUESTED'` |
| **D6** | `update/server/controllers/expenseController.ts:310` | Hardcoded `user.profile.id === 'emp-manager-01'` and missing executive tier (> 250k NGN) | Implement generic status & threshold check: Level 1 (<=50k -> APPROVED, >50k -> PENDING_DEPT_HEAD), Level 2 (<=250k -> APPROVED, >250k -> PENDING_EXEC), Level 3 (-> APPROVED) |
| **D7** | `update/server/controllers/expenseController.ts` | Missing terminal state guards in `reviewExpenseReportHandler` | Check if report is already in terminal state (`PAID`, `REJECTED`, or `APPROVED` re-approval) and return `409 ALREADY_DECIDED` |
| **D8** | `update/server/schemas/` | Missing `expenseSchemas.ts` | Create `update/server/schemas/expenseSchemas.ts` with `.strict()` and export in `update/server/schemas/index.ts` |
| **D9** | `update/server/services/` | Missing `expenseService.ts` | Create `update/server/services/expenseService.ts` encapsulating multi-tier calculations and policy checks |
| **D10** | `update/server/repositories/types.ts:106` | Missing `'PENDING_EXEC'` in `ExpenseReportRecord['status']` union | Add `'PENDING_EXEC'` to the status type |

---

## 9. Verification & Test Strategy
The worker can independently verify the implementation with:
1. Native E2E Test Suite:
   ```powershell
   npx tsx --test tests/e2e/tier1-features/expenses.test.ts
   npx tsx --test tests/e2e/tier2-boundaries/expense-boundaries.test.ts
   npx tsx --test tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts
   npx tsx --test tests/e2e/tier4-scenarios/multi-item-expense-reimbursement.test.ts
   ```
2. Full E2E Test Runner:
   ```powershell
   npx tsx tests/testRunner.ts
   ```
3. Adversarial Security Regression Suite:
   ```powershell
   npx tsx --test tests/adversarial/m2-auth-rbac-security-stress.test.ts
   ```
4. Client Production Build:
   ```powershell
   cd update; npm run build
   ```
