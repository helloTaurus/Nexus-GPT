# DISPATCH: worker_m4_r2 (Milestone 4 Remediation Worker)

## Role & Mission
You are `worker_m4_r2` (Milestone 4 Remediation Worker). Your mission is to implement the authorization and escalation tier security guards in `update/server/controllers/expenseController.ts` identified by `challenger_m4_1`.

## Context & Input Files
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m4_1\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m4_1\challenge.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\adversarial\m4-expense-invariants-challenger.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\controllers\expenseController.ts

## Tasks Required
1. In `update/server/controllers/expenseController.ts`, inside `reviewExpenseReportHandler` (around line 496, right after self-approval prohibition):
   - Add role check: regular employees (`user.role === 'EMPLOYEE'`) cannot review or approve expense claims:
     ```typescript
     if (user.role === 'EMPLOYEE') {
       res.status(403).json({
         success: false,
         error: { code: 'FORBIDDEN', message: 'Employees are not authorized to review or approve expense claims', correlationId }
       });
       return;
     }
     ```
   - Add multi-tier approver check on `PENDING_DEPT_HEAD`:
     ```typescript
     if (report.status === 'PENDING_DEPT_HEAD') {
       if (user.profile.id !== report.currentApproverId && user.role !== 'ADMIN') {
         res.status(403).json({
           success: false,
           error: { code: 'FORBIDDEN', message: 'Department Head or Admin authorization required for this escalation tier', correlationId }
         });
         return;
       }
     }
     ```
   - Add multi-tier approver check on `PENDING_EXEC`:
     ```typescript
     if (report.status === 'PENDING_EXEC') {
       if (user.role !== 'ADMIN' && user.profile.id !== report.currentApproverId) {
         res.status(403).json({
           success: false,
           error: { code: 'FORBIDDEN', message: 'Executive or Admin authorization required for this escalation tier', correlationId }
         });
         return;
       }
     }
     ```
2. In `tests/adversarial/m4-expense-invariants-challenger.test.ts`:
   - Update tests 1.5, 1.6, and 1.7 to strictly assert status 403 and `code === 'FORBIDDEN'`:
     - Test 1.5: Regular employee review returns 403 `FORBIDDEN`.
     - Test 1.6: Non-dept-head manager approving report at `PENDING_DEPT_HEAD` returns 403 `FORBIDDEN`.
     - Test 1.7: Non-executive manager approving report at `PENDING_EXEC` returns 403 `FORBIDDEN`.
3. Verification:
   - Run challenger test suite:
     `node --import ./update/node_modules/tsx/dist/loader.mjs tests/adversarial/m4-expense-invariants-challenger.test.ts`
   - Run adversarial stress suite:
     `node --import ./update/node_modules/tsx/dist/loader.mjs tests/adversarial/m4-expense-invariants-stress.test.ts`
   - Run receipt security suite:
     `node --import ./update/node_modules/tsx/dist/loader.mjs tests/adversarial/m4-receipt-security.test.ts`
   - Run master E2E test runner:
     `node tests/testRunner.ts` (122/122 passed, 100%)
   - Run client production build:
     `npm --prefix update run build` (0 errors)
4. Deliver hard handoff report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4_r2\handoff.md`.
NOTE: Run all commands with default sandbox permissions (`BypassSandbox: false`).
