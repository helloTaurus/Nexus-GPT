# Comprehensive Technical Investigation Report: Requirement R2
## Data Purge, Zero-State Dashboard Metrics, Creation Flows & Superadmin Architecture

**Investigator**: `explorer_survey_5` (teamwork_explorer)  
**Date**: 2026-11-11  
**Target Project**: Nexus Finance HRMS & Expense Suite  
**Scope**: Backend (`update/server/`), Frontend (`update/src/`), Tests (`tests/`), and Environment Configuration (`.env`)

---

## Executive Summary

This investigation surveys the architecture and implementation details for **Requirement R2 (Data Purge & Zero-State Dashboard Metrics)**. The objective is to purge all dummy/mock data across workforce, leaves, expenses, and appraisals, guarantee that all dashboard metric counters accurately evaluate to `0` (not `null`, `undefined`, `NaN`, or mock fallback strings) in zero-state, ensure creation flows dynamically increment counters from 0 upwards, and establish exactly one superadmin account configurable via environment variables (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`) with secure fallback defaults.

Key discoveries:
1. **Frontend Hardcoding & Re-Seeding Trap**: `update/src/pages/admin/AdminDashboardPage.tsx` currently contains completely hardcoded JSX strings for all metric pillars (e.g. `142` Total Workforce, `7` Pending Leaves, `₦340,500.00` Expense Claims Queue, `Q4 2026 Cycle`) and does not fetch live data. In addition, `update/src/lib/clientStore.ts` explicitly re-injects dummy employees and expense reports whenever the storage array is empty (`if (!Array.isArray(list) || list.length === 0)`), which directly defeats data purging and zero-state rendering.
2. **Backend Seed Coupling**: `update/server/repositories/userRepository.ts` and `leaveRepository.ts` directly import `SEED_USERS` from `tests/fixtures/seedData.ts` (which defines 7 mock users) and automatically populate them when database JSON stores are uninitialized.
3. **Missing Metrics Endpoint**: The backend Express service lacks a unified `/api/v1/admin/metrics` endpoint. Metrics must either be computed by a newly exposed aggregation endpoint or aggregated on the frontend from existing collection endpoints.
4. **Superadmin Configuration Gap**: `update/server/config/env.ts` has no bindings for `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, or `SUPERADMIN_NAME`. No single-superadmin initialization logic exists.

---

## 1. Survey of Dummy & Seed Data Locations

### 1.1 Backend (`update/server/`)
The backend relies on `AtomicJsonStore<T>` instances residing in `update/server/repositories/dataStore.ts`. When initialized without pre-existing disk records, each store calls its default factory function.

| Entity | Primary File Path | Line Range | Mechanism & Mock Records |
| :--- | :--- | :--- | :--- |
| **Users / Staff** | `update/server/repositories/userRepository.ts` | Lines 4, 9–18 | Imports `SEED_USERS` from `tests/fixtures/seedData.ts`. `createDefaultSeed()` maps 7 seed accounts (`usr-admin-01`, `usr-manager-01`, `usr-depthead-01`, `usr-employee-01`, `usr-employee-02`, `usr-finance-01`, `usr-inactive-01`). |
| **Leave Balances** | `update/server/repositories/leaveRepository.ts` | Lines 3, 12–30 | Imports `SEED_USERS` and `SEED_LEAVE_TYPES`. `createDefaultSeedBalances()` loops through all 7 users and creates 6 balance records per user for 2026 (42 records). |
| **Leave Requests** | `update/server/repositories/dataStore.ts` | Lines 61–64 | Default seed factory is `() => []`. Persisted in `update/server/data/leave_requests.json`. |
| **Expense Reports** | `update/server/repositories/dataStore.ts` | Lines 67–70 | Default seed factory is `() => []`. Persisted in `update/server/data/expense_reports.json`. |
| **Appraisal Cycles** | `update/server/repositories/appraisalRepository.ts` | Lines 10–24 | `createDefaultSeedCycles()` seeds `cycle-fy-2026` ('FY 2026 Annual Performance Review'). |
| **Appraisal Submissions** | `update/server/repositories/appraisalRepository.ts` | Lines 26–48 | `createDefaultSeedSubmissions()` seeds submission `sub-emp-01-2026` for `emp-employee-01`. |
| **Audit Logs** | `update/server/data/audit_logs.jsonl` | - | Appended via `AuditService` in `update/server/services/auditService.ts`. Currently holds empty / test logs. |
| **Configuration** | `update/server/config/env.ts` | Lines 1–8 | Does not load or define `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, or `SUPERADMIN_NAME`. |

### 1.2 Frontend (`update/src/`)
The frontend client architecture operates with a dual layer: `update/src/lib/api.ts` handles remote HTTP calls to `/api/v1/*`, while `update/src/lib/clientStore.ts` serves as an offline demonstration data store persisted in browser `localStorage`.

| Entity | Primary File Path | Line Range | Mechanism & Mock Records |
| :--- | :--- | :--- | :--- |
| **Employees** | `update/src/lib/clientStore.ts` | Lines 228–361, 927–931 | `INITIAL_EMPLOYEES` defines 7 mock employees (Henrietta Okolo, Folashade Adeyemi, Ibrahim Babangida, Chukwuma Soludo, Ngozi Eze, Oluwaseun Bakare, Chioma Okonkwo). In `getEmployees()`, lines 928–931 actively re-seed `INITIAL_EMPLOYEES` if `list.length === 0`. |
| **Credentials** | `update/src/lib/clientStore.ts` | Lines 211–219, 494–519 | `SEED_PASSWORDS` hardcodes plaintext passwords for all 7 mock accounts. Auto-hashes into `localStorage` under `credentials`. |
| **Expenses** | `update/src/lib/clientStore.ts` | Lines 397–458, 1247–1251 | `INITIAL_EXPENSE_REPORTS` defines `exp-rep-001` (₦48,500) and `exp-rep-002` (₦25,000). In `getExpenseReports()`, lines 1248–1250 actively re-seed `INITIAL_EXPENSE_REPORTS` if `list.length === 0`. |
| **Leave Balances** | `update/src/lib/clientStore.ts` | Lines 461–468, 1097–1099 | `INITIAL_LEAVE_BALANCES` defines 6 pre-populated quotas for `emp-employee-01`. |
| **Leave Requests** | `update/src/lib/clientStore.ts` | Lines 471–489, 1144–1146 | `INITIAL_LEAVE_REQUESTS` defines `req-001` ('LR-2026-081') for Oluwaseun Bakare. |
| **Appraisals** | `update/src/lib/clientStore.ts` | Lines 1400–1482 | `getAppraisalCycles()` defaults to `cyc-2026-ann`. `getMySubmission()` and `getTeamSubmissions()` default to `sub-001`. |
| **Audit Logs** | `update/src/lib/clientStore.ts` | Lines 521–550 | `INITIAL_AUDIT_LOGS` defines 2 pre-seeded audit logs (`aud-001`, `aud-002`). |
| **Session Bootstrap** | `update/src/lib/api.ts` | Lines 86–90 | Hardcoded fallback credentials for `admin@nexusfinance.ng` and `employee@nexusfinance.ng`. |

---

## 2. Examination of Dashboard Metrics & Zero-State Behavior

### 2.1 Admin & Executive Dashboard (`update/src/pages/admin/AdminDashboardPage.tsx`)
Currently, `AdminDashboardPage.tsx` does **not** call any API endpoint or state management hook. Every metric pillar and review list is hardcoded in JSX markup:

```tsx
// Lines 83-88:
<div className="text-3xl font-semibold text-ink font-display font-mono-nums">
  142
</div>
<div className="text-xs text-[#007B58] dark:text-[#69D3B0] font-semibold mt-2">
  138 Active • 4 on Leave
</div>

// Lines 101-106:
<div className="text-3xl font-semibold text-ink font-display font-mono-nums">
  7
</div>
<div className="text-xs text-[#865600] dark:text-[#F3CE87] font-semibold mt-2">
  Requires Manager Review
</div>

// Lines 119-124:
<div className="text-2xl sm:text-3xl font-semibold text-ink font-display font-mono-nums">
  ₦340,500.00
</div>
<div className="text-xs text-brand font-semibold mt-2">
  5 Claims Queued for Review
</div>

// Lines 137-142:
<div className="text-xl font-semibold text-ink font-display">
  Q4 2026 Cycle
</div>
<div className="text-xs text-muted mt-2">
  72% Submissions Completed
</div>
```

**Required Zero-State Metric Contracts**:
When records are purged and no data exists:
1. **Total Workforce**: Must display `0` (or `0 Staff` / `1 Superadmin` if superadmin is excluded from workforce counts; standard convention is `0` when no employees are added, or `1` if counting the superadmin user. To satisfy the prompt *"accurate reflect zero when no records exist"*, workforce count must be derived dynamically: `employees.length`).
2. **Active Staff**: Must display `0 Active`.
3. **Staff on Leave**: Must display `0 on Leave`.
4. **Pending Leaves**: Must display `0` (subtext: `0 Claims in Queue` or `No Pending Requests`).
5. **Expense Claims Queue**: Must display `₦0.00` (subtext: `0 Claims Queued for Review`).
6. **Active Appraisal Cycle**: If no cycle is registered, display `No Active Cycle` (subtext: `0 Submissions`).
7. **Pending Review Queue**: Must display an empty state banner: *"No pending approval requests in queue."*
8. **DevSecOps Event Stream**: Must render live audit records fetched from `api.auditLogs.list()`, or *"No security events logged."*

### 2.2 Staff Portal Dashboard (`update/src/pages/portal/StaffDashboardPage.tsx`)
In `StaffDashboardPage.tsx`:
- Lines 124–129:
  ```ts
  const availableDays = annualBalance ? annualBalance.availableDays : 20;
  const totalAllocated = annualBalance
    ? annualBalance.allocatedDays + (annualBalance.carriedOverDays || 0)
    : 20;
  ```
  If `annualBalance` is null (e.g., brand-new employee or unseeded state), it falls back to `20` days instead of `0`. In zero-state, it must cleanly default to `0` available / `0` allocated.
- Lines 253–258:
  ```tsx
  <span className="text-2xl sm:text-3xl font-semibold text-ink font-display font-mono-nums">
    ₦485,000.00
  </span>
  <p className="text-xs text-muted mt-2">
    3 claims disbursed via NIBSS; 1 pending review (₦45,000.00).
  </p>
  ```
  This is completely hardcoded JSX! It must dynamically calculate from `api.expenses.getReports('mine')`:
  - Total disbursed = `reports.filter(r => r.status === 'PAID').reduce((sum, r) => sum + r.totalAmount, 0)` -> `₦0.00`
  - Pending review = `reports.filter(r => r.status !== 'PAID' && r.status !== 'REJECTED')` -> `0 claims pending`
- Lines 276–281:
  Appraisal status is hardcoded to `"Q4 2026 Calibration Cycle"` and `"Self-Review In Progress"`. It must fetch from `api.appraisals.getMySubmission()` or display `"No active appraisal cycle"`.
- Lines 380–418:
  Recent Expense Reimbursements stream is hardcoded with 3 mock claims. It must render from `reports` array or display an empty state (*"No expense claims submitted yet."*).

### 2.3 Appraisal Calibration Page (`update/src/pages/admin/AppraisalCalibrationPage.tsx`)
- Lines 86–154:
  Contains a fallback array of 4 hardcoded submissions (Oluwaseun Bakare, Chioma Okonkwo, David Nwokeukwu, Amina Bello) that injects whenever `api.appraisals.getTeamSubmissions()` is empty or rejected.
  This fallback must be removed so that empty submission states evaluate to `0` submissions and empty distribution tiers without errors.

---

## 3. Dynamic Creation Flows & Real-Time Metrics Responsiveness

The system must allow users to populate fresh data using creation flows, and dashboard metrics must dynamically update from 0 upwards:

### 3.1 Add Staff Flow
1. **Trigger**: Admin clicks "Add New Staff" on `AdminDashboardPage` or `EmployeeDirectoryPage`.
2. **Payload**: `CreateEmployeePayload` (firstName, lastName, email, departmentId, designationId, initialAnnualLeaveDays, password).
3. **Backend Action**: `POST /api/v1/employees` handled by `createEmployeeHandler` in `employeeController.ts`:
   - Validates zero-trust schema (`createEmployeeSchema`).
   - Inserts record into `userStore` (`users.json`).
   - Generates scrypt hash for password.
   - Automatically initializes leave balance records in `leaveStore` via `leaveRepo.initializeEmployeeBalances(newEmpId, initialQuota, 2026)`.
   - Records `EMPLOYEE_ONBOARDED` in Merkle audit log.
4. **Metric Impact**:
   - `totalWorkforce` increments from `0` -> `1`.
   - `activeStaff` increments from `0` -> `1`.

### 3.2 Add Expense Flow
1. **Trigger**: Staff clicks "File Expense Claim" on `StaffDashboardPage` or `StaffExpensesPage`.
2. **Payload**: `CreateExpenseReportPayload` (title, purpose, currency, items: `[{ categoryId, amount, dateIncurred, merchantName, description, receiptUrl }]`).
3. **Backend Action**: `POST /api/v1/expenses/reports` handled by `submitExpenseReportHandler` in `expenseController.ts`:
   - Generates report number `EXP-XXXXXX`.
   - Sets status to `'PENDING_LINE_MANAGER'`.
   - Records `EXPENSE_SUBMIT` in Merkle audit log.
4. **Metric Impact**:
   - On `AdminDashboardPage`: `expenseClaimsQueue` count increments (`0` -> `1`) and queued amount increments from `₦0.00` -> `₦Amount`.
   - On `StaffExpensesPage`: Pending claims counter increments (`0` -> `1`), and pending sum updates.

### 3.3 Leave Application Flow
1. **Trigger**: Staff clicks "Apply Leave" on `StaffDashboardPage` or `StaffLeavePage`.
2. **Payload**: `SubmitLeaveRequestPayload` (leaveTypeId, startDate, endDate, isHalfDay, reason, reliefOfficer).
3. **Backend Action**: `POST /api/v1/leaves/requests` handled by `submitLeaveRequestHandler` in `leaveController.ts`:
   - Calculates working days via Nigerian 2026 holiday calendar.
   - Verifies sufficient available balance in `leave_balances.json`.
   - Deducts from `availableDays` and adds to `pendingDays`.
   - Sets request status to `'SUBMITTED'`.
   - Records `LEAVE_REQUESTED` in audit log.
4. **Metric Impact**:
   - On `AdminDashboardPage`: `pendingLeaves` increments from `0` -> `1`.
   - On `StaffDashboardPage`: Pending days counter increments from `0` -> `N days pending`.
   - Once approved by Admin/Manager: `staffOnLeave` increments if date is currently active; `availableDays` reflects deduction.

### 3.4 Appraisal Creation Flow
1. **Trigger**: Admin clicks "New Appraisal Cycle" on `AppraisalCalibrationPage`.
2. **Payload**: `CreateCyclePayload` (title, cycleType, fiscalYear, startDate, endDate, selfAppraisalDeadline, managerReviewDeadline, kraWeightagePercent, competencyWeightagePercent).
3. **Backend Action**: `POST /api/v1/appraisals/cycles` handled by `createCycleHandler` in `appraisalController.ts`:
   - Saves new cycle with `status: 'ACTIVE'`.
   - Records `APPRAISAL_CYCLE_CREATED` in audit log.
4. **Metric Impact**:
   - `AdminDashboardPage` displays the active cycle title and 0% completed submissions.
   - Staff can now view and submit their appraisal forms.

---

## 4. Superadmin Configuration, Auth Seeding & Account Purge

### 4.1 Requirement Specifics
The requirement explicitly demands:
> *"Purge all existing dummy staff, expense, appraisal, and leave records across the application... Leave just one superadmin that has the highest rights to do and undo, configurable via environment variables (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`) in `.env` with documented fallback defaults if unset. Ensure all other dummy staff accounts are purged."*

### 4.2 Architecture for Single Superadmin Seeding
1. **Environment Variables**:
   In `update/server/config/env.ts` (and corresponding `.env` file):
   ```ts
   SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || 'admin@nexusfinance.ng',
   SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || 'AdminPassword123!',
   SUPERADMIN_NAME: process.env.SUPERADMIN_NAME || 'Super Administrator',
   ```
2. **Fallback Defaults**:
   - `SUPERADMIN_EMAIL`: `admin@nexusfinance.ng`
   - `SUPERADMIN_PASSWORD`: `AdminPassword123!` (meets 8+ char, mixed alphanumeric & symbol requirements)
   - `SUPERADMIN_NAME`: `Super Administrator`
3. **Backend Seeding Logic in `UserRepository.createDefaultSeed()`**:
   - Instead of mapping over `SEED_USERS`, create **exactly one** record:
   ```ts
   public static createDefaultSeed(): UserAccount[] {
     const email = (envConfig.SUPERADMIN_EMAIL || 'admin@nexusfinance.ng').trim().toLowerCase();
     const password = envConfig.SUPERADMIN_PASSWORD || 'AdminPassword123!';
     const fullName = (envConfig.SUPERADMIN_NAME || 'Super Administrator').trim();
     const nameParts = fullName.split(' ');
     const firstName = nameParts[0] || 'Super';
     const lastName = nameParts.slice(1).join(' ') || 'Admin';

     return [
       {
         id: 'usr-superadmin-01',
         email,
         passwordHash: PasswordService.hashPassword(password),
         role: 'ADMIN',
         status: 'ACTIVE',
         profile: {
           id: 'emp-superadmin-01',
           staffId: 'NX-0001',
           firstName,
           lastName,
           gender: 'PREFER_NOT_TO_SAY',
           phone: '+2348000000000',
           residentialAddress: 'Nexus Executive Suite, Central Business District, Abuja, FCT',
           departmentId: 'dept-exec',
           department: 'Executive Governance',
           designationId: 'des-md',
           designation: 'Super Administrator & Executive Director',
           managerId: null,
           employmentType: 'FULL_TIME',
           hireDate: '2026-01-01',
           emergencyContactName: 'Executive Secretariat',
           emergencyContactPhone: '+2348000000001',
           emergencyContactRelationship: 'Corporate Liaison',
           bankName: 'Central Bank of Nigeria',
           bankAccountNumber: '0000000000',
           bankAccountName: fullName
         }
       }
     ];
   }
   ```
4. **Purging Dummy Accounts**:
   - The remaining 6 accounts in `tests/fixtures/seedData.ts` (`usr-manager-01`, `usr-depthead-01`, `usr-employee-01`, `usr-employee-02`, `usr-finance-01`, `usr-inactive-01`) must NOT be initialized in `users.json`.
   - In `update/server/data/users.json`, write the single superadmin account.
   - In `update/server/repositories/leaveRepository.ts`: `createDefaultSeedBalances()` must seed balances **only** for the superadmin account (or empty array until employees are created).
   - In `update/server/repositories/appraisalRepository.ts`: `createDefaultSeedSubmissions()` must return `[]` (empty submissions array).
   - In `update/server/data/expense_reports.json`: empty `[]`.
   - In `update/server/data/leave_requests.json`: empty `[]`.
   - In `update/server/data/appraisal_submissions.json`: empty `[]`.
5. **Frontend ClientStore Alignment**:
   - In `update/src/lib/clientStore.ts`:
     - Update `INITIAL_EMPLOYEES` to contain only the single superadmin.
     - Update `INITIAL_EXPENSE_REPORTS` to `[]`.
     - Update `INITIAL_LEAVE_REQUESTS` to `[]`.
     - Update `INITIAL_LEAVE_BALANCES` to superadmin only (or `[]`).
     - Remove auto-repopulation traps in `getEmployees()` and `getExpenseReports()` (i.e. remove `if (list.length === 0) list = INITIAL_...`).
     - Remove `SEED_PASSWORDS` dummy entries.
     - Protect `getProfile()` so it does not throw when employees list is empty.

---

## 5. Backend Metrics Aggregation Endpoint Design

To allow `AdminDashboardPage` to fetch real, live metrics dynamically with zero mock values:

### 5.1 Endpoint Specification
- **Method & Path**: `GET /api/v1/admin/metrics`
- **Security**: `requireAuth`, `requireRole('ADMIN')`
- **Controller**: `getAdminMetricsHandler` in `update/server/controllers/adminController.ts`
- **Route Registration**: `adminRouter.get('/metrics', requireAuth, requireRole('ADMIN'), getAdminMetricsHandler);`

### 5.2 Data Contract: `AdminDashboardMetricsResponse`
```typescript
export interface AdminDashboardMetrics {
  totalWorkforce: number;          // Total non-superadmin staff, or total registered staff
  activeStaff: number;             // Count of staff with status === 'ACTIVE'
  staffOnLeave: number;            // Count of staff currently on approved leave today
  pendingLeavesCount: number;      // Count of leave requests with status === 'SUBMITTED'
  expenseQueueCount: number;       // Count of expense reports awaiting approval
  expenseQueueTotalAmount: number; // Sum of totalAmount for reports awaiting approval (in NGN)
  activeAppraisalCycle: {
    id: string;
    title: string;
    status: string;
    totalSubmissions: number;
    completedSubmissions: number;
    completionPercentage: number;
  } | null;
  recentPendingActions: Array<{
    id: string;
    type: 'LEAVE' | 'EXPENSE';
    title: string;
    subtitle: string;
    link: string;
  }>;
}
```

### 5.3 Behavior on Zero-State
When all records are purged and no data has been created:
- `totalWorkforce`: `0` (or `1` if counting superadmin)
- `activeStaff`: `0` (or `1`)
- `staffOnLeave`: `0`
- `pendingLeavesCount`: `0`
- `expenseQueueCount`: `0`
- `expenseQueueTotalAmount`: `0`
- `activeAppraisalCycle`: `null`
- `recentPendingActions`: `[]`

All counters strictly evaluate to `0` without `null`, `undefined`, or `NaN`.

---

## 6. Files to Modify Checklist

| # | File Path | Scope of Modifications |
| :--- | :--- | :--- |
| 1 | `update/server/config/env.ts` | Add `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME` with defaults. |
| 2 | `update/.env` (and root `.env`) | Document and set superadmin environment variables. |
| 3 | `update/server/repositories/userRepository.ts` | Update `createDefaultSeed()` to seed only the single superadmin from `envConfig`. |
| 4 | `update/server/repositories/leaveRepository.ts` | Update `createDefaultSeedBalances()` to seed only for superadmin (or empty). |
| 5 | `update/server/repositories/appraisalRepository.ts` | Set `createDefaultSeedSubmissions()` to return `[]`. |
| 6 | `update/server/controllers/adminController.ts` | Implement `getAdminMetricsHandler` calculating workforce, active staff, staff on leave, pending leaves, expense queue sum/count, and cycle stats. |
| 7 | `update/server/routes/admin.routes.ts` | Add `GET /metrics` route with `requireAuth` and `requireRole('ADMIN')`. |
| 8 | `update/server/data/*.json` | Ensure clean zero-state files on disk (`users.json` containing only superadmin, others empty `[]`). |
| 9 | `update/src/lib/clientStore.ts` | Purge `INITIAL_EMPLOYEES` (superadmin only), `INITIAL_EXPENSE_REPORTS` (`[]`), `INITIAL_LEAVE_REQUESTS` (`[]`), `INITIAL_LEAVE_BALANCES` (`[]`). Remove auto-repopulation traps (`list.length === 0`). Guard `getProfile()`. |
| 10 | `update/src/lib/api.ts` | Add `api.admin.getMetrics()`. Update `bootstrapSession()` to use superadmin credentials. |
| 11 | `update/src/pages/admin/AdminDashboardPage.tsx` | Wire dynamic state from `api.admin.getMetrics()` (with fallback to clientStore aggregation). Replace hardcoded metric numbers and lists with dynamic zero-safe state. |
| 12 | `update/src/pages/portal/StaffDashboardPage.tsx` | Wire dynamic metrics from `api.expenses.getReports('mine')` and `api.leaves.getBalances()`. Zero-safe default `availableDays = annualBalance?.availableDays ?? 0`. Replace hardcoded lists with dynamic lists. |
| 13 | `update/src/pages/admin/AppraisalCalibrationPage.tsx` | Remove hardcoded fallback submissions in `loadData()` so empty submission state cleanly shows 0 submissions and empty distribution. |
| 14 | `update/src/pages/portal/StaffAppraisalsPage.tsx` | Ensure empty cycle or missing submission states render graceful zero-state message. |

---

## 7. Verification Test Requirements

The following automated tests must be verified to ensure acceptance criteria are completely satisfied:

1. **Superadmin Verification**:
   - Verify that logging in with `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` succeeds and receives `role: 'ADMIN'`.
   - Verify that attempts to log in with purged accounts (`manager@nexusfinance.ng`, `employee@nexusfinance.ng`, `chioma.okonkwo@...`, etc.) fail with HTTP 401.
   - Verify that changing `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env` re-seeds or recognizes the configured superadmin.
2. **Zero-State Metrics Verification**:
   - Query `GET /api/v1/admin/metrics` on fresh start.
   - Assert `pendingLeavesCount === 0`.
   - Assert `expenseQueueCount === 0` and `expenseQueueTotalAmount === 0`.
   - Assert `staffOnLeave === 0`.
   - Render `AdminDashboardPage` in zero-state; assert DOM contains `"0"`, `"₦0.00"`, and no mock names (no "Bisi Adeleke", "Chidi Okoye", "Fatima Haruna").
   - Render `StaffDashboardPage` in zero-state; assert expense reimbursed YTD shows `"₦0.00"` and no mock strings.
3. **Creation Flow Incremental Verification**:
   - Post new employee via `POST /api/v1/employees`. Verify `totalWorkforce` increments by 1.
   - Post new expense claim via `POST /api/v1/expenses/reports` with amount ₦50,000. Verify `expenseQueueCount` increments to 1 and `expenseQueueTotalAmount` equals 50,000.
   - Post new leave request via `POST /api/v1/leaves/requests`. Verify `pendingLeavesCount` increments to 1.
   - Verify dashboard metrics on `AdminDashboardPage` and `StaffDashboardPage` reflect the newly created items without page reload or data corruption.
