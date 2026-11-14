# DISPATCH: explorer_m4_3 (Frontend Expense Portal & Approval UI Explorer)

## Objective
Investigate the React frontend pages, UI components, API client methods, and design system integration for employee expense filing (`StaffExpensesPage.tsx`) and management approval (`ExpenseApprovalPage.tsx`).

## Input Files to Read
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\portal\StaffExpensesPage.tsx
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\admin\ExpenseApprovalPage.tsx
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\lib\api.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\components\ui\ (buttons, badges, modals, drawers, tables)

## Investigation Questions
1. What is the current implementation of `StaffExpensesPage.tsx` and `ExpenseApprovalPage.tsx`? Are they mock-based or wired to real endpoints?
2. What API methods are needed in `update/src/lib/api.ts` (e.g., `expenses.list()`, `expenses.create()`, `expenses.uploadReceipt()`, `expenses.review()`, `expenses.disburse()`)?
3. How should the expense filing form/modal be structured (title, category dropdown, amount in NGN, date, description, line items, receipt file upload dropzone)?
4. How should policy violation warnings (missing receipt for >5000 NGN, weekend expense, excessive amounts) be presented to the user?
5. How should `ExpenseApprovalPage.tsx` render the multi-tier review queue, receipt preview drawer, approve/reject modal, and finance disbursement actions?
6. Ensure strict compliance with Nexus visual tokens (Sapphire `#0D51B2`, Emerald status `#007B58`, 7px control radius, 12px card radius, Bricolage Grotesque / DM Sans fonts) and zero loose files in `components/`.

## Deliverables
- Deliver detailed analysis report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_3\expense_ui_plan.md`
- Deliver hard handoff report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m4_3\handoff.md`
- Send completion message to parent.


## 2026-11-10T03:10:19Z
From: f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8
Objective:
Investigate React frontend pages, UI components, API client methods, and design system integration for employee expense filing (`StaffExpensesPage.tsx`) and management approval (`ExpenseApprovalPage.tsx`).
Deliverables:
- `expense_ui_plan.md`
- `handoff.md`
- completion message to parent.
