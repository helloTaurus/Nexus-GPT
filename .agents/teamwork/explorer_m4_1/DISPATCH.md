# DISPATCH: explorer_m4_1 (Backend Expense Engine & Multi-Tier Approval Explorer)

## Objective
Investigate backend expense filing, multi-tier approval rules, policy checks, disbursement workflow, and API routes for Milestone 4 (Expense Reimbursement Suite).

## Input Files to Read
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\routes\expenses.routes.ts (if exists)
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\controllers\expenseController.ts (if exists)
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\services\expenseService.ts (if exists)
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\schemas\expenseSchemas.ts (if exists)
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\expense-filing.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\expense-approval.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier2-boundaries\expense-boundaries.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier3-combinations\expense-workflow-combinations.test.ts

## Investigation Questions
1. What are the exact requirements and expected payloads for filing an expense claim (categories, currency, line items, receipt references, descriptions)?
2. How is the multi-tier approval threshold hierarchy specified (Manager <= 50,000 NGN, Dept Head <= 250,000 NGN, Executive > 250,000 NGN, Finance disbursement)?
3. What are the policy violation rules (mandatory receipt for single item > NGN 5,000, weekend flag, duplicate invoice detection)?
4. What are the allowed state machine transitions (SUBMITTED -> PENDING_MGR -> PENDING_DEPTHEAD -> PENDING_EXEC -> APPROVED -> PAID, or REJECTED), terminal state guards, and error responses?
5. What Zod schemas are required with `.strict()` for zero-trust validation?

## Deliverables
- Deliver detailed analysis report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\expense_engine_plan.md`
- Deliver hard handoff report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\handoff.md`
- Send completion message to parent.


## 2026-11-10T03:10:07Z
You are explorer_m4_1 (Backend Expense Engine & Multi-Tier Approval Explorer).

Working Directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1

Read the following before starting:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\DISPATCH.md

Objective:
Investigate the backend expense filing rules, multi-tier approval thresholds (<=50k manager, <=250k depthead, >250k exec, finance disbursement), policy violation rules (mandatory receipt > 5k NGN, weekend expense, duplicate invoices), state transitions, error responses, and Zod schemas with `.strict()`.
Check existing files:
- `update/server/routes/expenses.routes.ts`
- `update/server/controllers/expenseController.ts`
- `update/server/services/expenseService.ts`
- `update/server/schemas/expenseSchemas.ts`
- `tests/e2e/tier1-features/expense-filing.test.ts`
- `tests/e2e/tier1-features/expense-approval.test.ts`
- `tests/e2e/tier2-boundaries/expense-boundaries.test.ts`
- `tests/e2e/tier3-combinations/expense-workflow-combinations.test.ts`

Deliverables:
- Write detailed plan to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\expense_engine_plan.md`
- Write hard handoff to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_1\handoff.md`
- Send completion message to parent.
NOTE: Read-only exploration. Do NOT edit source code or test files. Default sandbox permissions (BypassSandbox: false).
