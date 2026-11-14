# Handoff Report: Requirement R2 Survey (Data Purge & Zero-State Dashboard Metrics)

**Agent ID**: `explorer_survey_5`  
**Parent Agent**: `720fc276-ee7f-4514-a823-d8d263957cfa`  
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_survey_5`  
**Date**: 2026-11-11  

---

## 1. Observation

Direct observations from the local codebase:

1. **Hardcoded Metrics in Admin Dashboard**:
   - `update/src/pages/admin/AdminDashboardPage.tsx` lines 83–88:
     ```tsx
     <div className="text-3xl font-semibold text-ink font-display font-mono-nums">
       142
     </div>
     <div className="text-xs text-[#007B58] dark:text-[#69D3B0] font-semibold mt-2">
       138 Active • 4 on Leave
     </div>
     ```
   - Lines 101–103: Pending Leaves displays verbatim `"7"`.
   - Lines 119–123: Expense Claims Queue displays verbatim `"₦340,500.00"` and `"5 Claims Queued for Review"`.
   - Lines 137–141: Active Appraisal Cycle displays verbatim `"Q4 2026 Cycle"` and `"72% Submissions Completed"`.
   - Lines 163–199: Pending action queue lists mock individuals: `"Bisi Adeleke • Annual Leave (4 Days)"`, `"Chidi Okoye • Expense Claim (₦82,000.00)"`, `"Fatima Haruna • Medical Leave (2 Days)"`.
   - Lines 217–247: DevSecOps Event Stream lists mock events for `"david.alabi@nexus.ng"`, `"EXP-2026-0089"`, and `"LV-2026-0041"`.

2. **Hardcoded Metrics in Staff Dashboard**:
   - `update/src/pages/portal/StaffDashboardPage.tsx` lines 253–259:
     ```tsx
     <span className="text-2xl sm:text-3xl font-semibold text-ink font-display font-mono-nums">
       ₦485,000.00
     </span>
     <p className="text-xs text-muted mt-2">
       3 claims disbursed via NIBSS; 1 pending review (₦45,000.00).
     </p>
     ```
   - Lines 124–127: Defaults `availableDays` to 20 if `annualBalance` is null:
     ```ts
     const availableDays = annualBalance ? annualBalance.availableDays : 20;
     ```
   - Lines 380–418: Recent Expense Reimbursements list has 3 static mock cards (`EXP-2026-0089`, `EXP-2026-0074`, `EXP-2026-0061`).

3. **ClientStore Auto-Repopulation Traps**:
   - `update/src/lib/clientStore.ts` lines 927–931:
     ```ts
     let list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
     if (!Array.isArray(list) || list.length === 0) {
       list = INITIAL_EMPLOYEES;
       setStored('employees', list);
     }
     ```
   - Lines 1247–1251:
     ```ts
     let list = getStored<ExpenseReportRecord[]>('expense_reports', INITIAL_EXPENSE_REPORTS);
     if (!Array.isArray(list) || list.length === 0) {
       list = INITIAL_EXPENSE_REPORTS;
       setStored('expense_reports', list);
     }
     ```
   - Lines 228–361: `INITIAL_EMPLOYEES` defines 7 mock staff accounts (`emp-exec-01`, `emp-admin-01`, `emp-manager-01`, `emp-depthead-01`, `emp-finance-01`, `emp-employee-01`, `emp-employee-02`).
   - Lines 397–458: `INITIAL_EXPENSE_REPORTS` defines `exp-rep-001` and `exp-rep-002`.
   - Lines 461–489: `INITIAL_LEAVE_BALANCES` and `INITIAL_LEAVE_REQUESTS` define leave records for `emp-employee-01`.

4. **Backend Seed Coupling**:
   - `update/server/repositories/userRepository.ts` lines 4, 9–18:
     ```ts
     import { SEED_USERS } from '../../../tests/fixtures/seedData.ts';
     ...
     public static createDefaultSeed(): UserAccount[] {
       return SEED_USERS.map(u => ({ ... }));
     }
     ```
   - `update/server/repositories/leaveRepository.ts` lines 3, 12–30: Seeds balances for all `SEED_USERS` (42 records).
   - `update/server/repositories/appraisalRepository.ts` lines 26–48: Seeds `sub-emp-01-2026` for `emp-employee-01`.
   - `update/server/config/env.ts` lines 1–8: No definition or binding for `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, or `SUPERADMIN_NAME`.

5. **Appraisal Calibration Page Fallback**:
   - `update/src/pages/admin/AppraisalCalibrationPage.tsx` lines 86–154: If `subsData` is empty/rejected, it injects 4 mock submissions into component state.

---

## 2. Logic Chain

1. **From Observation 1**: Because `AdminDashboardPage.tsx` has raw JSX numeric text (`142`, `7`, `₦340,500.00`) and never fetches from any endpoint, even if the backend database were completely empty, the dashboard would continue displaying 142 employees and ₦340,500 in expense claims. Therefore, the dashboard must be refactored to fetch live metrics via `api` and calculate zero states.
2. **From Observation 2**: In `StaffDashboardPage.tsx`, fallback logic defaults leave to 20 instead of 0, and expenses/appraisals are static JSX. Therefore, `StaffDashboardPage.tsx` must be connected to live endpoints (`api.leaves.getBalances()`, `api.expenses.getReports('mine')`, `api.appraisals.getMySubmission()`), and compute zero if no records exist.
3. **From Observation 3**: Because `clientStore.ts` checks `if (list.length === 0)` and re-saves `INITIAL_EMPLOYEES` and `INITIAL_EXPENSE_REPORTS`, any attempt to clear data from the frontend will be immediately undone by this re-population logic. Therefore, these check-and-populate blocks must be removed, and `INITIAL_EMPLOYEES` must be reduced strictly to the single superadmin.
4. **From Observation 4**: In the backend, `userRepository.ts` seeds 7 dummy users and `leaveRepository.ts` seeds 42 balance records whenever data store files are initialized. To enforce Requirement R2's data purge and single superadmin requirement, `UserRepository.createDefaultSeed()` must construct only 1 user (the superadmin), dynamically configured via `envConfig.SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, and `SUPERADMIN_NAME`.
5. **From Observation 4 & Route Analysis**: The backend currently lacks an endpoint that aggregates dashboard counters. Adding `GET /api/v1/admin/metrics` allows `AdminDashboardPage` to receive real counts (`totalWorkforce`, `activeStaff`, `staffOnLeave`, `pendingLeavesCount`, `expenseQueueCount`, `expenseQueueTotalAmount`) and verify that they strictly equal 0 in zero-state.
6. **From Creation Flow Analysis**:
   - Adding a staff via `POST /api/v1/employees` increments `totalWorkforce` from 0 to 1 and generates balances.
   - Filing an expense via `POST /api/v1/expenses/reports` increments `expenseQueueCount` from 0 to 1 and increments `expenseQueueTotalAmount`.
   - Applying for leave via `POST /api/v1/leaves/requests` increments `pendingLeavesCount` from 0 to 1.
   - Creating an appraisal cycle via `POST /api/v1/appraisals/cycles` updates the active cycle.
   Thus, dashboard metrics will dynamically increment from 0 up upon creating fresh records.

---

## 3. Caveats

1. **Superadmin Counting in Total Workforce**: Depending on business rules, `totalWorkforce` may either represent total non-admin workforce (which is `0` when only superadmin exists) or total registered users (which is `1` when superadmin exists). The investigation recommends displaying `0` for regular workforce (or `0 Staff • 1 Admin`), which directly satisfies the prompt specification: *"metrics (such as total workforce, active staff, staff on leave, pending leaves, and expense claims queue) must accurately reflect zero when no records exist"*.
2. **Existing Automated Test Suites**: The repository has 33+ tests in `tests/` that reference `SEED_USERS` and dummy credentials (`tests/helpers/testHarness.ts`). The default superadmin email (`admin@nexusfinance.ng`) and password (`AdminPassword123!`) preserve backward compatibility for existing admin test suites while purging other accounts. Test cases verifying dummy employees (`usr-employee-01`) should either create employees dynamically via the `POST /employees` flow or be scoped to tests using `referenceServer.ts`.

---

## 4. Conclusion

Requirement R2 requires coordinated changes across 14 identified files:
1. **Config & Environment**: Add `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, and `SUPERADMIN_NAME` in `update/server/config/env.ts` and `.env` with default values (`admin@nexusfinance.ng`, `AdminPassword123!`, `Super Administrator`).
2. **Backend Seed Purge**: Refactor `userRepository.ts` to seed only the configured superadmin, `leaveRepository.ts` to seed only superadmin (or empty), and `appraisalRepository.ts` to seed empty submissions `[]`.
3. **Backend Metrics API**: Implement `GET /api/v1/admin/metrics` in `update/server/controllers/adminController.ts` and `update/server/routes/admin.routes.ts` returning zero-safe aggregated metrics.
4. **Frontend ClientStore Purge**: Remove auto-repopulation traps in `clientStore.ts`, set `INITIAL_EMPLOYEES` to single superadmin, set initial expenses, leaves, and appraisal submissions to empty arrays `[]`.
5. **Dashboard Refactoring**: Refactor `AdminDashboardPage.tsx` and `StaffDashboardPage.tsx` to bind dynamic state from `api` calls with fallback to `0` (never `null`, `undefined`, `NaN`, or mock strings). Remove mock arrays from `AppraisalCalibrationPage.tsx`.

---

## 5. Verification Method

To independently verify:

1. **Verify Source Files & Lines**:
   - Inspect `update/src/pages/admin/AdminDashboardPage.tsx` lines 83–144 to confirm static mock numbers.
   - Inspect `update/src/lib/clientStore.ts` lines 928–931 and lines 1248–1250 to confirm auto-repopulation traps.
   - Inspect `update/server/repositories/userRepository.ts` lines 9–18 to confirm `SEED_USERS` seeding.

2. **Verify Execution & Zero-State Metrics** (Once Implemented):
   - Start backend: `npm run server` (or `tsx server/index.ts`) in `update/`.
   - Start frontend: `npm run dev` in `update/`.
   - Log in with `admin@nexusfinance.ng` / `AdminPassword123!`.
   - Navigate to `/#/admin/dashboard`:
     - Assert Total Workforce displays `0`.
     - Assert Pending Leaves displays `0`.
     - Assert Expense Claims Queue displays `₦0.00`.
     - Assert Active Appraisal Cycle displays `No Active Cycle` (or 0 Submissions).
   - Attempt login with `employee@nexusfinance.ng` / `EmployeePassword123!`:
     - Assert response status is `401 Unauthorized` (purged).

3. **Verify Creation Flows & Metric Incrementation**:
   - Navigate to `/#/admin/employees` -> Click "Add New Staff" -> Onboard new employee.
   - Return to `/#/admin/dashboard` -> Assert Total Workforce increments to `1`.
   - Log in as the new employee -> Navigate to `/#/portal/expenses` -> File expense for ₦25,000.
   - Log in as Admin -> Navigate to `/#/admin/dashboard` -> Assert Expense Claims Queue displays `1` claim and `₦25,000.00`.
   - Log in as employee -> Navigate to `/#/portal/leave` -> Submit leave request for 3 days.
   - Log in as Admin -> Navigate to `/#/admin/dashboard` -> Assert Pending Leaves displays `1`.

4. **Automated Test Run**:
   - Run: `npx tsx tests/testRunner.ts`
