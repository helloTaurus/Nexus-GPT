## 2026-11-10T01:50:56Z
You are worker_m3, the Full-Stack Implementation Worker for Milestone 3 (Staff Portal Core & Leave Management Suite).

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md`
Also read PROJECT.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md`

Read the 3 Explorer Blueprints before starting:
1. `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m3_1\profile_kyc_plan.md`
2. `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m3_2\leave_engine_plan.md`
3. `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m3_3\portal_ui_plan.md`

Working Directory:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m3`

WRITE OWNERSHIP (Exclusively owned by you):
- `update/src/lib/` (`api.ts`, `leaveTypes.ts`)
- `update/src/pages/portal/` (`StaffProfilePage.tsx`, `StaffLeavePage.tsx`, `StaffDashboardPage.tsx`)
- `update/src/pages/admin/` (`LeaveApprovalPage.tsx`)
- `update/server/` (`schemas/leaveSchemas.ts`, and any necessary refinements to controllers/routes/repositories)
DO NOT write to any other pages or components.
CRITICAL CONSTRAINT: ZERO loose files in `update/src/components/` root.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL ENVIRONMENT RULES:
- NEVER set BypassSandbox: true in run_command. All commands must use default sandbox permissions.
- In this environment, inter-process TCP socket connections on loopback (`connect EACCES 127.0.0.1:3001`) fail without elevated permissions. Test suites and backend verification use in-process dispatch (`testHarness.ts` / direct Express dispatch) which executes the entire middleware pipeline with 100% fidelity.
- Update your progress.md regularly with timestamped progress.

IMPLEMENTATION MISSION:
1. Backend Schema & Refinement:
   - Ensure `update/server/schemas/leaveSchemas.ts` exists and validates all leave payloads (`startDate`, `endDate`, `leaveTypeId`, `reason`, `isHalfDay`, `comments`, `status`) strictly.
   - Verify that all 12 leave invariants in `leaveController.ts` and `leaveRepository.ts` function correctly (zero-overdraft balance protection, Nigerian 2026 public holiday calendar, weekend exclusion, double-booking guard, real-time pending balance deduction, self-approval prohibition, manager reporting chain authorization, peer balance privacy, cancellation lifecycle).

2. Frontend Client API & Type Definitions:
   - Create `update/src/lib/api.ts` providing strongly-typed client helper functions for auth, profile, and leave endpoints with `credentials: 'include'` so HttpOnly cookies are automatically sent.
   - Create `update/src/lib/leaveTypes.ts` with TypeScript interfaces for LeaveBalance, LeaveRequest, LeaveType, WorkingDaysResult, etc.

3. Frontend StaffProfilePage (`update/src/pages/portal/StaffProfilePage.tsx`):
   - Wire to `/api/v1/portal/profile` on mount using `credentials: 'include'`.
   - Support updating allowed fields (phone, bankName, nubanAccount, bvn, nin, emergencyContact).
   - Enforce 10-digit Nigerian NUBAN validation before submission.
   - Display restricted employment fields (salary, title, role, department, staffId) as clean read-only fields.
   - Provide loading skeleton states, validation error alerts with correlation IDs, and success feedback.

4. Frontend StaffLeavePage (`update/src/pages/portal/StaffLeavePage.tsx`):
   - Fetch real balances on mount (`/api/v1/leaves/balances`) and render all 6 leave types (Annual 20d, Sick 12d, Casual 5d, Maternity 84d, Paternity 10d, Bereavement 5d) with live progress bars and Nexus color tokens.
   - Leave Application Drawer: on date picker change, dynamically calculate working days via `/api/v1/leaves/calculate` (or client holiday/weekend engine), displaying Nigerian holiday banners, zero-overdraft warning banners, casual leave limit notices (> 2d), and medical certificate attachment notice for sick leave (> 2d).
   - Real leave application submission with instant optimistic or refreshed balance reservation.
   - Leave requests history table with filter tabs (`All`, `Pending`, `Approved`, `Rejected`), status badges (`Badge`), and cancellation modal triggering `/api/v1/leaves/requests/:id/cancel` which restores available balance.

5. Frontend LeaveApprovalPage (`update/src/pages/admin/LeaveApprovalPage.tsx`):
   - Fetch leave requests with scope selection (`scope=team` for managers, `scope=all` for admins).
   - Review modal with employee balance impact preview, manager comments textarea, self-approval prevention guard, and approve/reject triggers calling `/api/v1/leaves/requests/:id/action` or `/review`.

6. Frontend StaffDashboardPage (`update/src/pages/portal/StaffDashboardPage.tsx`):
   - Display real live annual leave balance metrics, upcoming 2026 Nigerian gazetted public holidays widget, and recent leave activity stream.

7. Visual & Architectural Integrity:
   - Tokens: Sapphire `#0D51B2`, Canvas `#0D1624`/`#F7F8FA`, Surface `#121E2E`/`#FFFFFF`, Emerald `#007B58`/`#69D3B0`, 7px control radius, 12px card radius, Bricolage Grotesque & Instrument/DM Sans typography, `--nx-ease` motion.
   - Clean Architecture: 0 loose files in `update/src/components/`.

8. Verification & Handoff:
   - Run type check & production build: `npm --prefix update run build` (must succeed with 0 errors).
   - Run leave and profile tests:
     * `node --test tests/e2e/tier1-features/profile.test.ts`
     * `node --test tests/e2e/tier1-features/leave-balances.test.ts`
     * `node --test tests/e2e/tier1-features/leave-application.test.ts`
     * `node --test tests/e2e/tier2-boundaries/leave-boundaries.test.ts`
     * `node --test tests/e2e/tier3-combinations/leave-workflow-combinations.test.ts`
   - Run the complete 122-test E2E test suite:
     * `node tests/testRunner.ts` (122/122 must pass).
   - Author a complete, self-contained `handoff.md` with verbatim test execution logs, logic chain, and modified files list. Send completion message to orchestrator.
