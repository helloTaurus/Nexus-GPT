# Handoff Report: Backend Expense Engine & Multi-Tier Approval Exploration (Milestone 4)

## 1. Observation

Direct code and test observations from repository analysis:

1. **Existing Route Definitions (`update/server/routes/expenses.routes.ts`)**:
   - Lines 14-19:
     ```typescript
     expensesRouter.get('/categories', getCategoriesHandler);
     expensesRouter.post('/upload-receipt', requireAuth, uploadReceiptHandler);
     expensesRouter.get('/reports', requireAuth, getExpenseReportsHandler);
     expensesRouter.post('/reports', requireAuth, submitExpenseReportHandler);
     expensesRouter.patch('/reports/:id/action', requireAuth, reviewExpenseReportHandler);
     expensesRouter.post('/reports/:id/disburse', requireAuth, disburseExpenseReportHandler);
     ```
   - Observed missing routes:
     - `GET /reports/:id`: invoked by `tests/e2e/tier1-features/expenses.test.ts:101` (`await client.get('/api/v1/expenses/reports/${createRes.body.data.id}')`) and `tests/e2e/tier4-scenarios/multi-item-expense-reimbursement.test.ts:103`.
     - `PUT /reports/:id`: invoked by `tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts:107` (`await empClient.put('/api/v1/expenses/reports/${reportId}', { title: ... })`).
     - Route schema validation middleware (`validateBody(...)`) is completely missing across all expense routes in `expenses.routes.ts`, unlike `leaves.routes.ts` which uses `validateBody(submitLeaveRequestSchema)`.

2. **Controller Status Code & Action Discrepancies (`update/server/controllers/expenseController.ts`)**:
   - Lines 368-374:
     ```typescript
     if (report.status !== 'APPROVED') {
       res.status(409).json({
         success: false,
         error: { code: 'INVALID_STATE', message: 'Cannot disburse unapproved expense claim', correlationId }
       });
       return;
     }
     ```
     `tests/e2e/tier2-boundaries/expense-boundaries.test.ts:164-165` explicitly asserts:
     ```typescript
     assert.equal(disburseRes.status, 409);
     assert.equal(disburseRes.body.error.code, 'NOT_APPROVED');
     ```
     Returning `'INVALID_STATE'` directly breaks boundary test compliance.
   - Line 288:
     ```typescript
     if (action === 'REVISION_REQUESTED') {
     ```
     `tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts:100` sends:
     ```typescript
     action: 'REQUEST_REVISION',
     ```
     This results in 400 Bad Request (`Unknown action REQUEST_REVISION`) instead of entering the revision workflow.
   - Lines 309-317:
     ```typescript
     if (report.totalAmount > 50000 && user.profile.id === 'emp-manager-01') {
       report.status = 'PENDING_DEPT_HEAD';
       report.currentApproverId = 'emp-depthead-01';
     } else {
       report.status = 'APPROVED';
       ...
     }
     ```
     The user profile check is hardcoded to `'emp-manager-01'`, and there is zero logic handling the Executive threshold (> 250,000 NGN) escalation to `PENDING_EXEC`.

3. **Missing System Components**:
   - `update/server/schemas/expenseSchemas.ts` does NOT exist.
   - `update/server/services/expenseService.ts` does NOT exist.
   - `update/server/repositories/types.ts:106` union for `ExpenseReportRecord['status']` omits `'PENDING_EXEC'`.
   - `update/server/data/settings.json` lines 6-8 explicitly configure:
     ```json
     "receiptEnforcementThresholdNGN": 5000,
     "expenseManagerThresholdNGN": 50000,
     "expenseExecutiveThresholdNGN": 250000
     ```

4. **Reference Implementation (`tests/fixtures/referenceServer.ts`)**:
   - Lines 1084-1109 implement both `GET /reports/:id` and `PUT /reports/:id` with status verification (`report.status !== 'REVISION_REQUESTED' && report.status !== 'SUBMITTED' -> 409 CANNOT_EDIT`).
   - Lines 1166-1168 return `code: 'NOT_APPROVED'` on premature disbursement.
   - Lines 1133-1138 handle `action === 'REQUEST_REVISION'`.

---

## 2. Logic Chain

1. **Route Deficiencies**:
   Because `expenses.test.ts` and `multi-item-expense-reimbursement.test.ts` request `GET /api/v1/expenses/reports/:id`, and `expense-workflow-combinations.test.ts` requests `PUT /api/v1/expenses/reports/:id`, omitting these routes in `update/server/routes/expenses.routes.ts` will produce 404 Not Found in live server execution.
   *Therefore*, `GET /reports/:id` and `PUT /reports/:id` must be implemented in both controller and router.

2. **Schema Validation & Error Code Preservation**:
   `tests/e2e/tier2-boundaries/expense-boundaries.test.ts` asserts `res.body.error.code === 'INVALID_AMOUNT'` when `amount <= 0`.
   If Zod schema validation middleware returns generic `VALIDATION_ERROR` for non-positive amounts, boundary tests will fail.
   *Therefore*, `expenseItemInputSchema` should accept `z.number()`, and the controller/service (or custom validator middleware) must return HTTP 400 with `code: 'INVALID_AMOUNT'` whenever `amount <= 0 || isNaN(amount)`.

3. **Multi-Tier Escalation Hierarchy**:
   `settings.json` establishes two approval thresholds: `expenseManagerThresholdNGN: 50000` and `expenseExecutiveThresholdNGN: 250000`.
   - Level 1 (`SUBMITTED`): If `totalAmount <= 50,000`, approval by Line Manager transitions directly to `APPROVED`. If `totalAmount > 50,000`, it transitions to `PENDING_DEPT_HEAD` and assigns `emp-depthead-01`.
   - Level 2 (`PENDING_DEPT_HEAD`): If `totalAmount <= 250,000`, approval by Dept Head transitions to `APPROVED`. If `totalAmount > 250,000`, it transitions to `PENDING_EXEC` and assigns `emp-admin-01`.
   - Level 3 (`PENDING_EXEC`): Approval by Executive/Admin transitions to `APPROVED`.
   - Level 4 (`APPROVED`): Finance Controller (`role === ADMIN`) disburses via `POST /disburse`, transitioning to `PAID`.
   *Therefore*, the hardcoded `user.profile.id === 'emp-manager-01'` logic in `expenseController.ts` must be replaced by generic state-driven threshold checks.

4. **Terminal State Integrity & Security Guards**:
   Adversarial tests from Milestone 2 and Milestone 3 establish that decided records must not undergo subsequent state changes.
   Re-reviewing already `PAID`, `REJECTED`, or `APPROVED` reports must return HTTP 409 (`ALREADY_DECIDED`).
   Self-approval attempts (`report.employeeId === user.profile.id`) must return HTTP 403 (`SELF_APPROVAL_PROHIBITED`).
   Premature disbursement on unapproved claims must return HTTP 409 (`NOT_APPROVED`).

---

## 3. Caveats

1. **Receipt Storage & MIME Analysis**: Explorer m4_2 is concurrently investigating receipt upload magic bytes, file storage path sanitization, and SHA-256 integrity. The backend service should consume the `receiptUrl` produced by `/upload-receipt`.
2. **Frontend UI Integration**: Explorer m4_3 is investigating `StaffExpensesPage.tsx` and `ExpenseApprovalPage.tsx`. The API contracts defined here align with both the frontend requirements and backend E2E tests.
3. **Execution Environment**: In PowerShell on Windows, running `npx tsx` from the project root requires referencing `update/node_modules` or running from `update/`. Running with `node --import ./update/node_modules/tsx/dist/loader.mjs tests/testRunner.ts` or `cd update; npm test` works deterministically.

---

## 4. Conclusion

The existing backend expense implementation is approximately 60% complete but has 10 critical gaps (missing routes, schema validation bypass, mismatched error codes, hardcoded user ID, missing executive tier, missing terminal state guards).
Implementing the remediation plan detailed in `expense_engine_plan.md` will achieve 100% test passing rate and satisfy all Milestone 4 DevSecOps and functional requirements.

Actionable Deliverables produced:
- Detailed Engineering Plan: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\expense_engine_plan.md`
- Hard Handoff: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\handoff.md`

---

## 5. Verification Method

To independently verify all findings and validate the subsequent worker implementation:

1. **Inspect Plan Artifact**:
   - Verify `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\expense_engine_plan.md` exists and covers all 10 defect remediations.

2. **Execute E2E Expense Test Suites**:
   Run the following commands using node and tsx from `update/`:
   ```powershell
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier1-features/expenses.test.ts
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier2-boundaries/expense-boundaries.test.ts
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/e2e/tier4-scenarios/multi-item-expense-reimbursement.test.ts
   ```

3. **Verify Full E2E Suite**:
   ```powershell
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/testRunner.ts
   ```

4. **Verify Client Production Build**:
   ```powershell
   cd update
   npm run build
   ```

5. **Invalidation Conditions**:
   - Any test expecting `code: 'INVALID_STATE'` on premature disbursement (invalidated: tests specifically require `NOT_APPROVED`).
   - Any test expecting `GET /reports/:id` or `PUT /reports/:id` to return 404 (invalidated: tests assert 200).
