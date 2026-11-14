# DISPATCH: reviewer_m4_2 (Frontend Expense Portal & Design Token Reviewer)

## Mission
You are `reviewer_m4_2`. Review the frontend implementation of Milestone 4 (`StaffExpensesPage.tsx` and `ExpenseApprovalPage.tsx`) for architecture compliance, live API integration, self-approval guards, receipt preview, and design token fidelity.

## Input Files to Read
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\portal\StaffExpensesPage.tsx
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\admin\ExpenseApprovalPage.tsx
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\lib\api.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\lib\expenseTypes.ts

## Verification Tasks
1. Verify `update/src/components/` root contains EXACTLY 0 loose files (only `features/`, `layout/`, `ui/` subdirectories).
2. Inspect `StaffExpensesPage.tsx`:
   - Live API wiring via `api.expenses.getReports({ scope: 'mine' })` and `api.expenses.getCategories()`.
   - Multi-item dynamic report builder (add/remove line items, live subtotaling).
   - Receipt upload dropzone with client-side magic-byte pre-check.
   - Reactive policy validation warnings (>5k NGN receipt required, weekend flags).
   - Bank rail KPI card wired to `api.profile.get()`.
3. Inspect `ExpenseApprovalPage.tsx`:
   - Multi-tier approval queue with scope switching (`scope=team` vs `scope=all`).
   - Self-approval disabled guard (`report.employeeId === currentUserId`).
   - Interactive receipt preview drawer/modal.
   - Actions for Approve, Reject, Request Revision, and Finance Disbursement.
4. Verify design tokens:
   - Sapphire `#0D51B2`, Emerald status `#007B58`, 7px control radius, 12px card radius, Bricolage Grotesque and DM Sans typography.
5. Run production client build:
   - `npm --prefix update run build` (must pass with 0 errors).
6. Deliver `review.md` and hard handoff `handoff.md` with explicit verdict (APPROVE or REQUEST_CHANGES). Send completion message to parent.
NOTE: Run commands with default sandbox permissions (`BypassSandbox: false`).

## 2026-11-10T03:37:24Z
[Message] timestamp=2026-11-10T03:37:24Z sender=f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8 priority=MESSAGE_PRIORITY_HIGH content=You are reviewer_m4_2 (Frontend Expense Portal & Design Token Reviewer).
Working Directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\reviewer_m4_2
