# Hard Handoff Report: Frontend Expense Portal & Approval UI

## 1. Observation
1. **Current `StaffExpensesPage.tsx` State**:
   - Location: `update/src/pages/portal/StaffExpensesPage.tsx:24-61`.
   - The page uses hardcoded in-memory claims:
     ```typescript
     const [claims, setClaims] = useState([
       { id: 'EXP-2026-0089', title: 'Kano Regional Command Audit Transit', category: 'Travel & Transit', date: '2026-11-05', amount: '₦45,000.00', status: 'pending' as const, stage: 'Pending Manager Review' },
       ...
     ]);
     ```
   - Filing form is a single-item mock submission at lines 63-85 (`setTimeout(..., 600)`), ignoring the multi-item report architecture required by backend tests (`items: ExpenseItemRecord[]`).
   - The receipt upload zone at lines 247-257 is purely cosmetic (`<div className="p-6 border-2 border-dashed...">Click or drag file to attach</div>`) with no `<input type="file" />` element, no drag-and-drop listener, and no network upload.
   - Bank rail KPI card at lines 134-142 is hardcoded to "Guaranty Trust Bank / 0142998812" instead of reading from `api.profile.get()`.

2. **Current `ExpenseApprovalPage.tsx` State**:
   - Location: `update/src/pages/admin/ExpenseApprovalPage.tsx:26-57`.
   - Uses hardcoded claims (`EXP-2026-0089`, `EXP-2026-0091`, `EXP-2026-0092`).
   - `handleAdvanceState` at lines 61-71 advances state linearly in memory (`pending` &rarr; `manager_approved` &rarr; `finance_verified` &rarr; `disbursed`) without calling any backend endpoint.
   - Self-approval check is absent: line manager could approve their own claim, violating OWASP and server rules (`report.employeeId === user.profile.id`).
   - `receiptModal` state exists at line 59 (`const [receiptModal, setReceiptModal] = useState<ExpenseApprovalItem | null>(null);`) but is never displayed or triggered anywhere in the JSX.
   - Scope filter (`team` vs `all`) is absent.

3. **Current `api.ts` State**:
   - Location: `update/src/lib/api.ts:59-140`.
   - Exports `profile`, `leaves`, and `auth` namespaces only.
   - Contains **zero** expense methods. There is no `api.expenses` object.

4. **Backend Contract Alignment**:
   - Routes: `update/server/routes/expenses.routes.ts:14-19`:
     - `GET /api/v1/expenses/categories`
     - `POST /api/v1/expenses/upload-receipt` (Raw binary stream, validates PNG/JPEG/PDF magic bytes, max 10MB)
     - `GET /api/v1/expenses/reports?scope=mine|team|all`
     - `POST /api/v1/expenses/reports` (Payload: `{ title, purpose?, currency?, items: [...] }`)
     - `PATCH /api/v1/expenses/reports/:id/action` (Payload: `{ action: 'APPROVE'|'REJECT'|'REQUEST_REVISION', comments?: string }`)
     - `POST /api/v1/expenses/reports/:id/disburse` (Payload: `{ disbursementReference, paidDate? }`)
   - Category Ceilings & Rules (`tests/fixtures/seedData.ts:102-109`):
     - Travel: max ₦200,000; Hospitality: max ₦150,000; Office: max ₦50,000; Telecom: max ₦30,000; Training: max ₦500,000; Operations: max ₦100,000.
     - Receipt mandatory for any item exceeding ₦5,000.00 (`receiptThreshold: 5000`).
   - Multi-tier Escalation Rule (`update/server/controllers/expenseController.ts:310-317`):
     - Claims with `totalAmount > 50,000 NGN` reviewed by line manager escalate to `PENDING_DEPT_HEAD` (`currentApproverId = 'emp-depthead-01'`) before reaching `APPROVED`.

5. **UI Primitives & Component Layout**:
   - UI atoms in `update/src/components/ui/`: `Button`, `Input`, `Badge`, `Card`, `Modal`, `Drawer`, `Skeleton`, `Tabs`.
   - Layout components in `update/src/components/layout/`: `PortalLayout`, `AdminLayout`, `Sidebar`.
   - Exactly zero loose files in `update/src/components/` root.

---

## 2. Logic Chain
1. *From Observation 3 & 4*: The backend exposes complete endpoints for categories, receipt upload, report creation, review, and disbursement, but `update/src/lib/api.ts` has no corresponding methods. Therefore, frontend pages cannot communicate with the backend until an `expenses` namespace is added to `api.ts` alongside a dedicated `expenseTypes.ts` domain model.
2. *From Observation 4 (Raw binary upload)*: `update/server/app.ts:33-40` configures `express.raw()` for non-JSON content. Therefore, `api.expenses.uploadReceipt` must stream the raw `File` binary body with its MIME `Content-Type` header (instead of standard JSON), enabling magic-byte validation on the server.
3. *From Observation 1*: `StaffExpensesPage.tsx` currently only submits a single item, whereas the backend schema rejects submissions without an `items` array. Therefore, the filing form in `StaffExpensesPage.tsx` must be refactored into a multi-item report builder supporting dynamic addition and removal of line items with subtotaling.
4. *From Observation 4 (Policy Thresholds)*: The backend returns 422 `RECEIPT_REQUIRED` when `amount > 5000` without a receipt, and 422 `CATEGORY_LIMIT_EXCEEDED` when an item exceeds its ceiling. Therefore, `StaffExpensesPage.tsx` must implement client-side reactive policy evaluation to provide instant visual warnings and prevent invalid submissions.
5. *From Observation 2 & 4 (Self-Approval & Multi-Tier Workflow)*: The server rejects self-approval with 403 `SELF_APPROVAL_PROHIBITED` and restricts disbursement to `APPROVED` reports by Admins. Therefore, `ExpenseApprovalPage.tsx` must inspect the active session identity via `api.auth.me()`, disable approve buttons on self-claims, display the receipt preview drawer, and restrict disbursement execution to Admin/Finance users on approved claims.
6. *From Observation 5 & Design Tokens*: All screens must maintain strict visual consistency: Sapphire `#0D51B2`, Emerald `#007B58`, 7px control radius, 12px card radius, `Bricolage Grotesque` / `DM Sans` fonts, `--nx-ease` motion, and zero loose files in `components/`.

---

## 3. Caveats
- **Read-Only Scope**: In accordance with the prompt constraints, this explorer performed no modifications to production source code or test files. All designs, contracts, and code structures are documented in `expense_ui_plan.md` for the implementing agent.
- **Backend Route Additions**: While `tests/fixtures/referenceServer.ts` supports `GET /api/v1/expenses/reports/:id` and `PUT /api/v1/expenses/reports/:id`, the live Express route in `update/server/routes/expenses.routes.ts` currently omits explicit routes for single-report retrieval and update. The implementing team should verify if the backend agent has added or will add these two endpoints.
- **Offline / Server-Unreachable Resilience**: Like `StaffLeavePage.tsx`, the frontend expense pages should maintain fallback mock state if the server is unreachable during local client development.

---

## 4. Conclusion
The frontend expense pages (`StaffExpensesPage.tsx` and `ExpenseApprovalPage.tsx`) require a complete refactor from static mock prototypes into fully integrated, typed, enterprise-grade components. The detailed architectural plan in `expense_ui_plan.md` outlines every interface, API method, policy validator, drawer layout, receipt inspection flow, and modal needed to achieve 100% compliance with Zoho People capabilities and the E2E verification suites.

---

## 5. Verification Method
1. **File Inspection**:
   - Review architectural blueprint: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_3\expense_ui_plan.md`.
   - Inspect existing mock pages:
     - `update/src/pages/portal/StaffExpensesPage.tsx`
     - `update/src/pages/admin/ExpenseApprovalPage.tsx`
   - Inspect existing API client:
     - `update/src/lib/api.ts`
2. **E2E Test Execution**:
   - Run existing E2E test suites covering expenses:
     ```bash
     node --test tests/e2e/tier1-features/expenses.test.ts
     node --test tests/e2e/tier2-boundaries/expense-boundaries.test.ts
     node --test tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts
     node --test tests/e2e/tier4-scenarios/multi-item-expense-reimbursement.test.ts
     ```
3. **Invalidation Conditions**:
   - Any proposed change introducing loose files to `update/src/components/` root.
   - Any implementation allowing submission of an expense claim > ₦5,000 without a receipt.
   - Any implementation allowing a line manager to approve their own expense claim.
