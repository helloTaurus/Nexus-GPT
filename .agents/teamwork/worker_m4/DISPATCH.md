# DISPATCH: worker_m4 (Milestone 4 Implementation Worker)

## Role & Mission
You are `worker_m4` (Milestone 4 Implementation Worker). Your mission is to implement the complete full-stack Expense Reimbursement Suite & Receipt Management module adhering strictly to the architecture and plans established by `explorer_m4_1`, `explorer_m4_2`, and `explorer_m4_3`.

## Input Plans to Read
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\expense_engine_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_2\receipt_upload_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_2\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_3\expense_ui_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_3\handoff.md

## Implementation Requirements

### 1. Backend Implementation
1. **`update/server/schemas/expenseSchemas.ts`**:
   - Create comprehensive strict Zod schemas with `.strict()` for:
     - `expenseItemInputSchema`: categoryId, description, amount (z.number()), receiptUrl (optional/string), date (string), invoiceNumber (optional).
     - `submitExpenseReportSchema`: title, purpose (optional), currency (optional, default 'NGN'), items (array of items).
     - `updateExpenseReportSchema`: title (optional), purpose (optional), items (optional array).
     - `reviewExpenseReportSchema`: action (enum: APPROVE, REJECT, REQUEST_REVISION), comments (optional).
     - `disburseExpenseReportSchema`: disbursementReference (string), paidDate (optional string).
   - Export all schemas and re-export in `update/server/schemas/index.ts`.
2. **`update/server/repositories/types.ts`**:
   - Update `ExpenseReportRecord['status']` union to include `'PENDING_EXEC'`.
3. **`update/server/controllers/expenseController.ts`**:
   - Receipt Upload:
     - Validate magic bytes for PNG (`0x89 0x50 0x4E 0x47`), JPEG (`0xFF 0xD8 0xFF`), and PDF (`0x25 0x50 0x44 0x46`). Reject others with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.
     - File size > 10MB returns HTTP 413 `PAYLOAD_TOO_LARGE`.
     - Ensure directory `update/server/uploads/receipts/` exists; write buffer to `${fileId}.${ext}`.
     - Compute SHA-256 hash and log audit event via `AuditService.record(...)`.
     - Return `{ success: true, fileUrl, receiptUrl, fileName, mimeType, sizeBytes, sha256 }`.
   - Add `getReceiptHandler`:
     - Serves file from `update/server/uploads/receipts/` with sanitized filename and `X-Content-Type-Options: nosniff`.
   - Submit Report:
     - Reject amount <= 0 with HTTP 400 `INVALID_AMOUNT`.
     - Enforce mandatory receipt for any item with amount > 5,000 NGN returning HTTP 422 `RECEIPT_REQUIRED`.
     - Enforce category ceiling check returning HTTP 422 `CATEGORY_LIMIT_EXCEEDED` if ceiling exceeded.
     - Flag weekend dates in policy violations.
   - Add `getExpenseReportByIdHandler` (`GET /reports/:id`).
   - Add `updateExpenseReportHandler` (`PUT /reports/:id`):
     - Only allows editing if status is `SUBMITTED` or `REVISION_REQUESTED`; otherwise returns HTTP 409 `CANNOT_EDIT`.
   - Review Report:
     - Self-approval check: if `report.employeeId === user.profile.id` return HTTP 403 `SELF_APPROVAL_PROHIBITED`.
     - Terminal immutability: if status is `PAID`, `REJECTED`, or `APPROVED` return HTTP 409 `ALREADY_DECIDED`.
     - Handle actions: `APPROVE`, `REJECT`, `REQUEST_REVISION`.
     - Dynamic threshold escalation:
       - Manager approval: if `totalAmount > 50,000 NGN`, transitions to `PENDING_DEPT_HEAD` (`currentApproverId = 'emp-depthead-01'`); else transitions to `APPROVED`.
       - Dept Head approval: if `totalAmount > 250,000 NGN`, transitions to `PENDING_EXEC` (`currentApproverId = 'emp-admin-01'`); else transitions to `APPROVED`.
       - Executive / Admin approval: transitions to `APPROVED`.
   - Disburse Report:
     - If `report.status !== 'APPROVED'`, returns HTTP 409 `NOT_APPROVED`.
     - Transitions status to `PAID`, sets `disbursedAt`, `disbursedBy`, `disbursementReference`.
4. **`update/server/routes/expenses.routes.ts`**:
   - Mount routes:
     - `GET /categories` -> `getCategoriesHandler`
     - `POST /upload-receipt` -> `uploadReceiptHandler`
     - `GET /receipts/:filename` -> `getReceiptHandler`
     - `GET /reports` -> `getExpenseReportsHandler`
     - `POST /reports` -> `validateBody(submitExpenseReportSchema)`, `submitExpenseReportHandler`
     - `GET /reports/:id` -> `getExpenseReportByIdHandler`
     - `PUT /reports/:id` -> `validateBody(updateExpenseReportSchema)`, `updateExpenseReportHandler`
     - `PATCH /reports/:id/action` -> `validateBody(reviewExpenseReportSchema)`, `reviewExpenseReportHandler`
     - `POST /reports/:id/action` -> `validateBody(reviewExpenseReportSchema)`, `reviewExpenseReportHandler`
     - `POST /reports/:id/disburse` -> `validateBody(disburseExpenseReportSchema)`, `disburseExpenseReportHandler`

### 2. Frontend Implementation
1. **`update/src/lib/expenseTypes.ts`**:
   - Create TypeScript interfaces for expense items, reports, categories, and actions.
2. **`update/src/lib/api.ts`**:
   - Implement `api.expenses` namespace methods (`getCategories`, `getReports`, `getReportById`, `createReport`, `updateReport`, `uploadReceipt` via raw binary stream, `reviewReport`, `disburseReport`).
3. **`update/src/pages/portal/StaffExpensesPage.tsx`**:
   - Implement multi-item report builder, dynamic line-item addition/removal, live subtotaling, receipt upload dropzone with client pre-check, reactive policy validation warnings (>5,000 NGN receipt required, weekend flags), live KPI cards from `api.profile.get()`, and filterable claim history.
4. **`update/src/pages/admin/ExpenseApprovalPage.tsx`**:
   - Implement live multi-tier approval queue (`scope=team` vs `scope=all`), self-approval disabling guard (`report.employeeId === currentUserId`), receipt preview drawer, approve/reject/revision modal, and finance disbursement actions for Admin/Finance roles.
5. **Clean Architecture Constraint**:
   - Exactly ZERO loose files in `update/src/components/` root.
   - Adhere strictly to Nexus design tokens: Sapphire `#0D51B2`, Emerald `#007B58`, 7px control radius, 12px card radius, `Bricolage Grotesque` and `DM Sans` typography, `--nx-ease` animations.

### 3. Verification Commands (Run in PowerShell with BypassSandbox: false)
- Run expense E2E test suites:
  `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier1-features/expenses.test.ts`
  `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier2-boundaries/expense-boundaries.test.ts`
  `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts`
  `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier4-scenarios/multi-item-expense-reimbursement.test.ts`
- Run master E2E test runner:
  `node tests/testRunner.ts` (122/122 passed, 100%)
- Run client production build:
  `npm --prefix update run build` (0 errors)

Deliver hard handoff report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md`.

## 2026-11-10T03:22:22Z
You are worker_m4 (Milestone 4 Implementation Worker).

Working Directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4

You MUST read the following files before starting:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\DISPATCH.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\expense_engine_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_2\receipt_upload_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_3\expense_ui_plan.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive File Ownership:
Backend:
- `update/server/schemas/expenseSchemas.ts`
- `update/server/schemas/index.ts`
- `update/server/repositories/types.ts`
- `update/server/controllers/expenseController.ts`
- `update/server/routes/expenses.routes.ts`
Frontend:
- `update/src/lib/expenseTypes.ts`
- `update/src/lib/api.ts`
- `update/src/pages/portal/StaffExpensesPage.tsx`
- `update/src/pages/admin/ExpenseApprovalPage.tsx`

Tasks:
1. Implement backend schemas in `expenseSchemas.ts` with strict Zod `.strict()` validation, update `types.ts` with `'PENDING_EXEC'`, implement all controller logic (409 NOT_APPROVED on unapproved disburse, 403 SELF_APPROVAL_PROHIBITED, 409 ALREADY_DECIDED, 400 INVALID_AMOUNT, REQUEST_REVISION, dynamic multi-tier thresholds <=50k / <=250k / >250k, magic-byte upload with SHA-256 and disk persistence to `update/server/uploads/receipts/`, receipt preview route, `GET /reports/:id`, `PUT /reports/:id`), and mount in `expenses.routes.ts` with `validateBody`.
2. Implement frontend `expenseTypes.ts`, `api.ts` expense methods, rewrite `StaffExpensesPage.tsx` and `ExpenseApprovalPage.tsx` with live API wiring, receipt previews, multi-tier approvals, policy warnings, and Nexus design tokens. Exactly ZERO loose files in `components/` root.
3. Verification:
   - `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier1-features/expenses.test.ts`
   - `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier2-boundaries/expense-boundaries.test.ts`
   - `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts`
   - `node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier4-scenarios/multi-item-expense-reimbursement.test.ts`
   - `node tests/testRunner.ts` (122/122 passed, 100%)
   - `npm --prefix update run build` (0 errors)
4. Deliver hard handoff report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md` and send completion message to parent.

NOTE: Run all commands with default sandbox permissions (`BypassSandbox: false`). Do not use loopback TCP sockets; in-process Express dispatch is already used in test helpers.

