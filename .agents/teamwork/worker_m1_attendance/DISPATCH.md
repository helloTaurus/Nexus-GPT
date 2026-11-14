## 2026-11-11T16:55:03Z
[Message] timestamp=2026-11-11T16:55:03Z sender=720fc276-ee7f-4514-a823-d8d263957cfa priority=MESSAGE_PRIORITY_HIGH content=You are worker_m1_attendance, a teamwork_worker subagent.

Your working directory is:
c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m1_attendance

You MUST read the original request file at:
c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md

You MUST read the detailed technical analysis and specifications prepared by the explorer at:
c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_survey_4\analysis.md
and
c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_survey_4\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Implement Requirement R1 (Functional Staff Clock-In & Attendance Tracking):
1. **Backend Attendance Architecture (`update/server/`)**:
   - `update/server/repositories/types.ts`: Define `AttendanceSession`, `AttendanceRecord`, `ClockInPayload`, `AttendanceSummary` interfaces.
   - `update/server/repositories/attendanceRepository.ts`: Create `AttendanceRepository` implementing atomic persistence via `AtomicJsonStore` targeting `update/server/data/attendance.json` with multi-session support, session calculations, and query filters.
   - `update/server/repositories/dataStore.ts`: Instantiate and expose `attendanceRepository`.
   - `update/server/schemas/attendanceSchemas.ts`: Create zero-trust Zod validation schemas for clock-in/out endpoints.
   - `update/server/controllers/attendanceController.ts`: Implement handlers for:
     * `POST /api/v1/attendance/clock-in`: Verify user authenticated, prevent double clock-in, evaluate resumption status (Monday–Friday: standard 8:00 AM – 5:00 PM WAT, `ON_TIME` if <= 08:00/08:15 grace, else `LATE`; Saturday/Sunday: `WEEKEND_DUTY` shift hours), append active session, record audit log (`STAFF_CLOCKED_IN`).
     * `POST /api/v1/attendance/clock-out`: Verify active session exists, calculate elapsed minutes, update record total minutes worked, record audit log (`STAFF_CLOCKED_OUT`).
     * `GET /api/v1/attendance/today`: Return today's attendance state (`clockedIn`, `activeSession`, `totalMinutesWorked`, `resumptionStatus`).
     * `GET /api/v1/attendance/history`: Return user's attendance records.
   - `update/server/routes/attendance.routes.ts`: Register router with `requireAuth` middleware.
   - `update/server/routes/index.ts`: Mount `attendanceRouter` at `apiV1Router.use('/attendance', attendanceRouter)`.

2. **Frontend Attendance Integration (`update/src/`)**:
   - `update/src/lib/attendanceTypes.ts`: Define frontend TypeScript interfaces.
   - `update/src/lib/api.ts`: Add `attendance` namespace under `api` with `clockIn`, `clockOut`, `getToday`, `getHistory`.
   - `update/src/lib/clientStore.ts`: Add offline fallback methods for attendance (`clockIn`, `clockOut`, `getToday`, `getHistory`) to ensure seamless demo and offline support.
   - `update/src/pages/portal/StaffDashboardPage.tsx`:
     * Wire up real clock-in/out button with persistent state from `api.attendance.getToday()`.
     * Live active timer display when clocked in.
     * Daily hours worked display (e.g. `X hrs Y mins`).
     * Resumption status badge (`On Time`, `Late Resumption`, `Weekend Duty`).
     * Loading state during API mutation.

3. **Automated Testing & In-Process Harness**:
   - `tests/fixtures/referenceServer.ts`: Add attendance endpoints to the in-process mock server so tests run hermetically.
   - `tests/e2e/tier1-features/attendance.test.ts`: Create comprehensive automated tests covering:
     * Weekday clock-in on-time vs late resumption.
     * Weekend duty tracking (Saturday / Sunday).
     * Multiple clock-in / clock-out sessions per day accumulating hours.
     * Persistence across queries.
     * Double clock-in / clock-out rejection.
   - Run tests using the project's test runner: `npx tsx tests/testRunner.ts` or `node tests/testRunner.ts` (or `npx tsx --test tests/e2e/tier1-features/attendance.test.ts`).
   - Run the frontend build: `npm --prefix update run build` to verify clean TypeScript compilation.

Output requirements:
- Write your implementation report to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m1_attendance\report.md`.
- Write your 5-component handoff to `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m1_attendance\handoff.md`.
- Send a completion message via send_message to the parent orchestrator with your results and test outcomes.
