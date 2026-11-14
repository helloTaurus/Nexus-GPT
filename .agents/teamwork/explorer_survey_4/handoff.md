# Handoff Report: Requirement R1 (Functional Staff Clock-In & Attendance Tracking)

**Agent**: `explorer_survey_4`  
**Date**: November 11, 2026  
**Type**: Hard Handoff (Investigation & Survey Complete)  
**Target Recipient**: Orchestrator / Implementer Track  

---

## 1. Observation

1. **StaffDashboardPage.tsx Implementation**:
   - Location: `update/src/pages/portal/StaffDashboardPage.tsx`
   - Lines 43–45:
     ```tsx
     const [clockedIn, setClockedIn] = useState(false);
     const [clockTime, setClockTime] = useState<string | null>(null);
     ```
   - Lines 52–62:
     ```tsx
     const handleToggleClock = () => {
       if (!clockedIn) {
         setClockedIn(true);
         setClockTime(
           new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
         );
       } else {
         setClockedIn(false);
         setClockTime(null);
       }
     };
     ```
   - Lines 159–166:
     ```tsx
     <Button
       variant={clockedIn ? 'danger' : 'success'}
       size="md"
       onClick={handleToggleClock}
       leftIcon={<Clock className="w-4 h-4" />}
     >
       {clockedIn ? `Clock Out (In at ${clockTime})` : 'Clock In for Today'}
     </Button>
     ```
   - Observed behavior: Button state is purely in-memory React component state. There is no API call, no backend persistence, no daily hours calculation, no resumption schedule evaluation, and state resets upon browser refresh.

2. **Backend Server Absence of Attendance Endpoints**:
   - Search path: `update/server/`
   - Results from ripgrep search for `attendance` across all server files (`update/server/**/*.{ts,json}`): `No results found`.
   - Inspection of `update/server/routes/index.ts`:
     ```ts
     apiV1Router.use('/', healthRouter);
     apiV1Router.use('/auth', authRouter);
     apiV1Router.use('/portal', portalRouter);
     apiV1Router.use('/employees', employeesRouter);
     apiV1Router.use('/admin', adminRouter);
     apiV1Router.use('/leaves', leavesRouter);
     apiV1Router.use('/expenses', expensesRouter);
     apiV1Router.use('/appraisals', appraisalsRouter);
     ```
     Observed behavior: No attendance route or controller is registered or present.

3. **Backend Persistence Architecture**:
   - Files: `update/server/repositories/store/AtomicJsonStore.ts` and `update/server/repositories/dataStore.ts`.
   - Mechanism: Entities are stored as JSON files (`update/server/data/*.json`) managed by `AtomicJsonStore<T extends { id: string }>` using transactional file writes and mutex locking (`withLock`).
   - Audit logging: Handled via `AuditService` (`update/server/services/auditService.ts`) appending structured records to `data/audit_logs.jsonl`.

4. **Frontend API & Offline Architecture**:
   - Files: `update/src/lib/api.ts` and `update/src/lib/clientStore.ts`.
   - Pattern: `api.ts` executes HTTP requests to `/api/v1/*` with automatic session credentials and falls back to `clientStore.ts` (persisting to `localStorage`) when the server is unreachable. Neither `api.ts` nor `clientStore.ts` contains attendance methods.

5. **Test Harness & Oracle Architecture**:
   - Files: `tests/fixtures/referenceServer.ts`, `tests/helpers/testHarness.ts`.
   - The test harness supports dual execution against either a live URL (`API_BASE_URL`) or an in-memory `ReferenceServer`. Attendance is currently unrepresented in `ReferenceServer`.

---

## 2. Logic Chain

1. **Premise 1 (From Observation 1)**: The staff clock-in button on `StaffDashboardPage.tsx` is completely decoupled from any persistent data store and does not calculate daily hours worked or track schedule resumption.
2. **Premise 2 (From Observation 2 & 3)**: The backend architecture in `update/server/` requires each functional domain to follow the Repository/Controller/Router pattern with an `AtomicJsonStore` backing file in `update/server/data/`.
3. **Premise 3 (From Observation 4)**: The frontend API layer requires an `api.attendance` client and corresponding `clientStore` fallback methods to maintain offline and demo compatibility without runtime errors.
4. **Deduction 1 (Backend Requirement)**: To satisfy R1, the backend requires:
   - `AttendanceRecord` and `AttendanceSession` data contracts in `update/server/repositories/types.ts`.
   - `attendance.json` store initialized in `DataStore` via `AttendanceRepository`.
   - Express router mounted at `apiV1Router.use('/attendance', attendanceRouter)`.
   - Controller endpoints: `GET /api/v1/attendance/today`, `POST /api/v1/attendance/clock-in`, `POST /api/v1/attendance/clock-out`, and `GET /api/v1/attendance/history`.
   - Zod validation schemas in `update/server/schemas/attendanceSchemas.ts`.
   - Audit trail logging via `AuditService` (`STAFF_CLOCKED_IN`, `STAFF_CLOCKED_OUT`).
5. **Deduction 2 (Resumption Schedule Logic)**:
   - For standard workdays (Monday through Friday), the system must evaluate clock-in time against the standard 8:00 AM WAT (`08:00`) resumption mark and 5:00 PM WAT (`17:00`) close mark. Clocking in $\le$ 08:00 (or $\le$ 08:15 grace) evaluates to `ON_TIME`. Clocking in $>$ 08:15 evaluates to `LATE` with calculated late minutes.
   - For weekend days (Saturday and Sunday), `isWeekend = true`, `resumptionStatus = 'WEEKEND_DUTY'`. Late flags are not applied; instead, all hours worked are tracked and categorized as weekend shift duty.
6. **Deduction 3 (Daily Hours & Session Math)**:
   - An employee may have multiple sessions per day (e.g., clocking out for lunch).
   - Daily hours worked = sum of completed session durations + active session elapsed duration.
   - Timestamps must be stored in UTC ISO 8601 (`new Date().toISOString()`), and calendar day comparisons must be localized to Nigerian Timezone (`Africa/Lagos`, UTC+1).
7. **Deduction 4 (Frontend UI Requirement)**:
   - `StaffDashboardPage.tsx` must fetch `api.attendance.getToday()` on mount, restoring active session and cumulative daily hours.
   - The clock button must display live status (`Clock In for Today` vs `Clock Out (In at HH:MM)`), trigger `api.attendance.clockIn()` and `clockOut()`, and include loading spinners.
   - A dedicated Attendance & Resumption indicator on the dashboard must display today's accumulated work time, live ticking active counter, and resumption status badge (`On Time`, `Late Resumption`, or `Weekend Shift`).

---

## 3. Caveats

1. **Timezone Configuration**: System servers running in other timezones (e.g., UTC or US/Pacific) must explicitly calculate calendar dates and 8:00 AM/5:00 PM thresholds using `Intl.DateTimeFormat` with `timeZone: 'Africa/Lagos'` rather than local machine time to ensure Nigerian business schedule accuracy.
2. **Long-Running Open Sessions**: If an employee leaves without clocking out (e.g., sessions open > 16 hours), a safety cap or automatic session close rule at 23:59:59 WAT should be considered to prevent skewed hours.
3. **Zero-Data Purge Interaction (R2)**: When Requirement R2 purges dummy data, the new `attendance.json` file should start empty (`[]`) so zero attendance records exist until freshly created by staff.

---

## 4. Conclusion

Requirement R1 is completely specified and architecturally mapped. The feature can be implemented cleanly by introducing the attendance repository and controller in the backend, adding `api.attendance` and `clientStore` fallbacks on the frontend, and upgrading `StaffDashboardPage.tsx` to display real-time persistent attendance states and schedule tracking.

### Exact Files to Modify / Create
1. **Backend**:
   - `update/server/repositories/types.ts` (Modify: add attendance types)
   - `update/server/repositories/attendanceRepository.ts` (Create: repository logic)
   - `update/server/repositories/dataStore.ts` (Modify: initialize `attendance` store)
   - `update/server/schemas/attendanceSchemas.ts` (Create: Zod schemas)
   - `update/server/controllers/attendanceController.ts` (Create: API handlers + audit)
   - `update/server/routes/attendance.routes.ts` (Create: Express router)
   - `update/server/routes/index.ts` (Modify: mount `/attendance`)
2. **Frontend**:
   - `update/src/lib/attendanceTypes.ts` (Create: TypeScript interfaces)
   - `update/src/lib/api.ts` (Modify: add `api.attendance` namespace)
   - `update/src/lib/clientStore.ts` (Modify: add offline demo store methods)
   - `update/src/pages/portal/StaffDashboardPage.tsx` (Modify: wire live data, timer, resumption badge)
3. **Tests & Oracles**:
   - `tests/fixtures/referenceServer.ts` (Modify: add attendance route handlers)
   - `tests/e2e/tier1-features/attendance.test.ts` (Create: automated verification tests)

---

## 5. Verification Method

1. **Independent File Inspection**:
   - Inspect `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_survey_4\analysis.md` for full technical schemas and calculation specifications.
2. **Automated Test Command**:
   - Run `npx tsx --test tests/e2e/tier1-features/attendance.test.ts`
3. **Integration API Verification**:
   - Authenticate with `employee@nexusfinance.ng` / `EmployeePassword123!`.
   - Call `POST /api/v1/attendance/clock-in`: Verify `200/201` response with ISO timestamp, `resumptionStatus: "ON_TIME"` (if weekday $\le$ 08:00/08:15) or `"WEEKEND_DUTY"` (if Saturday/Sunday).
   - Call `GET /api/v1/attendance/today`: Verify `clockedIn: true` and active session persistence.
   - Call `POST /api/v1/attendance/clock-out`: Verify `200` response, duration calculation, and updated `totalMinutesWorked`.
4. **UI Dashboard Verification**:
   - Open Staff Dashboard in browser, click Clock In, verify button updates and timer starts.
   - Reload browser page, verify clock-in state and elapsed time remain active.
   - Click Clock Out, verify daily hours update and status returns to clocked out.
