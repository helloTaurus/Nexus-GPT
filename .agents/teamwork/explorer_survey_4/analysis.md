# Technical Investigation Report: Requirement R1 (Functional Staff Clock-In & Attendance Tracking)

**Investigator**: `explorer_survey_4`  
**Date**: November 11, 2026  
**Project**: Nexus Finance — HRMS & Expense Management Suite  
**Scope**: Requirement R1 (Functional Staff Clock-In & Attendance Tracking) across Frontend (`update/src/`), Backend (`update/server/`), and Test Suite (`tests/`)

---

## 1. Executive Summary

Requirement R1 mandates making the clock-in button on `StaffDashboardPage` fully functional with backend persistence, daily hours tracking, standard resumption hours (8:00 AM to 5:00 PM, Monday through Friday), and tracked weekend hours on Saturday and Sunday.

The investigation revealed:
1. **Frontend Current State**: `StaffDashboardPage.tsx` (lines 43-62, 158-166) uses purely local, ephemeral React `useState(false)`. Clicking the button merely flips a boolean in memory and formats a local time string. It makes zero API requests, does not persist across page reloads, does not calculate or display daily hours worked, and does not track resumption schedule adherence.
2. **Backend Current State**: There is **no attendance support** anywhere in `update/server/`. No attendance routes, controllers, repository, data models, or stored JSON files exist. The system stores user records, leaves, expenses, and appraisals using atomic, file-locked JSON files (`AtomicJsonStore<T>`) in `update/server/data/`.
3. **Architecture Fit**: Attendance must be integrated cleanly into the existing full-stack clean architecture:
   - An `AttendanceRecord` and `AttendanceSession` data model in `update/server/repositories/types.ts`.
   - An `attendance.json` store managed by `AtomicJsonStore<AttendanceRecord>` in `DataStore` (`update/server/repositories/dataStore.ts`).
   - A dedicated `AttendanceRepository` (`update/server/repositories/attendanceRepository.ts`).
   - Zod validation schemas (`update/server/schemas/attendanceSchemas.ts`).
   - Express controller (`update/server/controllers/attendanceController.ts`) and routes (`update/server/routes/attendance.routes.ts`) mounted at `/api/v1/attendance`.
   - Immutable audit logging via `AuditService` (`STAFF_CLOCKED_IN`, `STAFF_CLOCKED_OUT`).
   - Frontend integration in `api.ts`, offline demonstration persistence in `clientStore.ts`, and full reactive live-timer UI on `StaffDashboardPage.tsx`.

---

## 2. Current State Inspection

### 2.1 Frontend Inspection: `StaffDashboardPage.tsx`
- **Location**: `update/src/pages/portal/StaffDashboardPage.tsx`
- **Current Clock-In Implementation**:
  ```tsx
  // Lines 43-45
  const [clockedIn, setClockedIn] = useState(false);
  const [clockTime, setClockTime] = useState<string | null>(null);

  // Lines 52-62
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

  // Lines 159-166
  <Button
    variant={clockedIn ? 'danger' : 'success'}
    size="md"
    onClick={handleToggleClock}
    leftIcon={<Clock className="w-4 h-4" />}
  >
    {clockedIn ? `Clock Out (In at ${clockTime})` : 'Clock In for Today'}
  </Button>
  ```
- **Observed Deficiencies**:
  - **No Persistence**: State is lost immediately when the user refreshes, navigates away, or logs back in.
  - **No API Interaction**: Zero network calls to the backend.
  - **No Daily Hours Calculation**: No tracking of cumulative minutes or hours worked for the current day.
  - **No Active Timer**: When clocked in, there is no real-time ticking indicator showing elapsed duration.
  - **No Resumption Schedule Tracking**: Does not evaluate whether clock-in occurred before or after standard resumption (8:00 AM WAT), nor does it track Saturday/Sunday shifts.
  - **No Session History**: If an employee clocks out for lunch, their prior clock-in information is wiped out (`setClockTime(null)`).

### 2.2 Backend Inspection: `update/server/`
- **Repository Architecture**:
  The backend uses the repository pattern (`update/server/repositories/`):
  - `AtomicJsonStore<T extends { id: string }>` handles concurrent file writes with unique temp files, OS buffer sync (`handle.sync()`), and atomic rename retry backoff.
  - Central singleton `DataStore` (`update/server/repositories/dataStore.ts`) initializes all stores (`users`, `sessions`, `passwordResets`, `leaves`, `expenses`, `appraisals`, `settings`, `audit`).
  - Data files are stored in `update/server/data/*.json`.
- **Existing Routes in `update/server/routes/index.ts`**:
  - `/api/v1/auth`, `/api/v1/portal`, `/api/v1/employees`, `/api/v1/admin`, `/api/v1/leaves`, `/api/v1/expenses`, `/api/v1/appraisals`.
  - **No attendance routes exist**.
- **Audit Logging**:
  - `AuditService` (`update/server/services/auditService.ts`) writes structured JSON lines to `data/audit_logs.jsonl` with actor, action, entity, timestamp, IP, and state diff.
  - Attendance clock-in and clock-out events currently lack audit logging.

---

## 3. Domain Model & Business Logic Requirements

### 3.1 Attendance Data Contracts & Schema
An attendance record tracks an employee's activity for a specific calendar date in West Africa Time (`Africa/Lagos`, UTC+1). Within each day, multiple sessions (clock-in / clock-out pairs) can occur.

```typescript
export type ResumptionStatus = 
  | 'ON_TIME'         // Clocked in on or before 08:00 AM (or within grace period)
  | 'GRACE_PERIOD'    // Clocked in between 08:01 AM and 08:15 AM
  | 'LATE'            // Clocked in after 08:15 AM on a weekday
  | 'WEEKEND_DUTY'    // Clocked in on Saturday or Sunday
  | 'NOT_RESUMED';    // Has not clocked in today

export type AttendanceStatus = 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ABSENT';

export interface AttendanceSession {
  id: string;              // Unique session ID (UUID)
  clockIn: string;         // ISO 8601 UTC timestamp (e.g., "2026-11-11T07:55:00.000Z")
  clockOut: string | null; // ISO 8601 UTC timestamp or null if ongoing
  durationMinutes: number; // Completed duration in minutes (0 if active)
  notes?: string;
}

export interface AttendanceRecord {
  id: string;              // Unique record ID (e.g., "att_usr-emp-001_2026-11-11")
  userId: string;          // UserAccount.id
  employeeId: string;      // EmployeeProfile.id
  staffId: string;         // e.g., "NX-1042"
  date: string;            // YYYY-MM-DD in Africa/Lagos
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  isWeekend: boolean;      // true if Saturday or Sunday
  schedule: {
    expectedStart: string | null; // "08:00" for Mon-Fri; null for Sat-Sun
    expectedEnd: string | null;   // "17:00" for Mon-Fri; null for Sat-Sun
    standardHours: number;        // 9 for Mon-Fri (8:00 to 17:00); 0 for weekend
  };
  resumptionStatus: ResumptionStatus;
  firstClockIn: string | null;    // ISO timestamp of earliest clock-in for the day
  lastClockOut: string | null;    // ISO timestamp of most recent clock-out
  lateMinutes: number;            // Minutes late beyond 08:00 AM (0 if on time or weekend)
  totalMinutesWorked: number;     // Sum of completed session durations
  totalHoursWorked: number;       // totalMinutesWorked / 60 (rounded to 2 decimal places)
  status: AttendanceStatus;
  sessions: AttendanceSession[];
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Daily Hours Worked Calculation
1. **Completed Sessions**:
   $$\text{durationMinutes} = \max\left(0, \operatorname{round}\left(\frac{\text{clockOutMs} - \text{clockInMs}}{60000}\right)\right)$$
2. **Active (Ongoing) Session**:
   $$\text{activeElapsedMinutes} = \max\left(0, \operatorname{round}\left(\frac{\text{nowMs} - \text{activeClockInMs}}{60000}\right)\right)$$
3. **Total Work Time for Today**:
   $$\text{totalTodayMinutes} = \sum_{\text{completed}} \text{durationMinutes} + (\text{isClockedIn} \mathbin{?} \text{activeElapsedMinutes} : 0)$$
   $$\text{totalTodayHours} = \operatorname{round}\left(\frac{\text{totalTodayMinutes}}{60}, 2\right)$$
4. **Human-Readable Formatting**:
   - Hours and minutes: `${Math.floor(totalTodayMinutes / 60)}h ${totalTodayMinutes % 60}m` (e.g. `8h 15m` or `0h 42m`).
   - Live dashboard display dynamically updates the ticking active session every second or minute while clocked in.

### 3.3 Resumption Schedule Tracking Rules
- **Timezone**: Africa/Lagos (WAT, UTC+1).
- **Monday through Friday (Standard Schedule)**:
  - Standard Resumption: **8:00 AM WAT** (`08:00`).
  - Standard Close: **5:00 PM WAT** (`17:00`).
  - Total Standard Shift: 9 hours.
  - Evaluation of `firstClockIn` (evaluated once on initial clock-in of the day):
    - If clock-in time $\le$ 08:00 WAT $\rightarrow$ `resumptionStatus = 'ON_TIME'`, `lateMinutes = 0`.
    - If clock-in time between 08:01 and 08:15 WAT $\rightarrow$ `resumptionStatus = 'GRACE_PERIOD'`, `lateMinutes = clockInMinutes - 480`.
    - If clock-in time $>$ 08:15 WAT $\rightarrow$ `resumptionStatus = 'LATE'`, `lateMinutes = clockInMinutes - 480`.
- **Saturday and Sunday (Weekend Duty Tracking)**:
  - `isWeekend = true`.
  - `schedule = { expectedStart: null, expectedEnd: null, standardHours: 0 }`.
  - `resumptionStatus = 'WEEKEND_DUTY'`, `lateMinutes = 0`.
  - No late penalty is ever assessed for weekend work.
  - All hours worked on weekends are tracked and recorded in the database, enabling weekend duty tracking and overtime verification.

### 3.4 Edge Cases & Defensive Invariant Protection

| # | Edge Case | Business Invariant & Technical Handling |
|---|---|---|
| **E1** | **Double Clock-In** | If a user calls `POST /attendance/clock-in` while `status === 'CLOCKED_IN'`, the server returns `409 Conflict` with code `ALREADY_CLOCKED_IN`. Button is disabled on client while request is in-flight. |
| **E2** | **Double Clock-Out** | If a user calls `POST /attendance/clock-out` while `status !== 'CLOCKED_IN'`, the server returns `409 Conflict` with code `NOT_CLOCKED_IN`. |
| **E3** | **Multiple Clock-Ins/Outs per Day** | An employee clocking out for lunch/break and clocking back in: appends a new `AttendanceSession` to `record.sessions`. `firstClockIn` remains fixed at the morning arrival timestamp (preserving resumption punctuality). Total daily minutes is the sum of all completed sessions plus the current session. |
| **E4** | **Page Reload / Browser Restart** | On page mount, `StaffDashboardPage` invokes `api.attendance.getToday()`. If an active session exists, the UI immediately restores `clockedIn = true`, sets clock-in time, and restarts the live ticking timer from the session's `clockIn` timestamp. |
| **E5** | **Clock-Out Across Midnight** | If an employee clocks in at 22:00 on Friday and clocks out at 02:00 on Saturday, timestamps are stored as complete UTC ISO strings. Millisecond difference correctly computes the 4-hour duration across the midnight boundary. The session is attached to the day of inception. Sessions open longer than 16 hours without clock-out can be flagged for manager regularization. |
| **E6** | **Server Offline / Demo Mode Fallback** | If the Express backend is unreachable (`502/503/network error`), `api.ts` gracefully falls back to `clientStore.ts`. `clientStore` implements identical clock-in/out logic backed by `localStorage` (`nexus_finance_hrms_attendance_<userId>`). |
| **E7** | **Concurrency & Race Conditions** | `AtomicJsonStore.withLock()` ensures file operations are serialized so rapid clicks or concurrent browser tabs cannot corrupt `attendance.json`. |

---

## 4. API Endpoints & Data Contracts

All endpoints live under `/api/v1/attendance` and require session authentication (`requireAuth`).

### 4.1 `GET /api/v1/attendance/today`
Returns the current authenticated user's attendance status, active session, daily hours, and resumption schedule information for today.

- **Request**:
  - Headers: `Cookie: nexus_session=...` or `Authorization: Bearer ...`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "date": "2026-11-11",
      "dayOfWeek": "WEDNESDAY",
      "isWeekend": false,
      "status": "CLOCKED_IN",
      "clockedIn": true,
      "activeSession": {
        "id": "7bfa50f8-c2b6-4b2a-bf35-a6e5b4ff1a10",
        "clockIn": "2026-11-11T07:54:30.000Z",
        "clockOut": null,
        "durationMinutes": 0
      },
      "firstClockIn": "2026-11-11T07:54:30.000Z",
      "lastClockOut": null,
      "schedule": {
        "expectedStart": "08:00",
        "expectedEnd": "17:00",
        "standardHours": 9
      },
      "resumptionStatus": "ON_TIME",
      "lateMinutes": 0,
      "completedMinutesWorked": 0,
      "totalMinutesWorked": 245,
      "totalHoursWorked": 4.08,
      "formattedTimeWorked": "4h 05m",
      "sessions": [
        {
          "id": "7bfa50f8-c2b6-4b2a-bf35-a6e5b4ff1a10",
          "clockIn": "2026-11-11T07:54:30.000Z",
          "clockOut": null,
          "durationMinutes": 0
        }
      ]
    }
  }
  ```

### 4.2 `POST /api/v1/attendance/clock-in`
Clocks in the current employee for today.

- **Request Body** (optional):
  ```json
  {
    "notes": "Arrived at Abuja Head Office"
  }
  ```
- **Response `200 OK` (or `201 Created`)**:
  Returns updated today's attendance summary (same structure as `GET /attendance/today`).
- **Error `409 Conflict`**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ALREADY_CLOCKED_IN",
      "message": "Employee is already clocked in with an active session",
      "correlationId": "corr_..."
    }
  }
  ```

### 4.3 `POST /api/v1/attendance/clock-out`
Clocks out the current employee from their active session.

- **Request Body** (optional):
  ```json
  {
    "notes": "Signing off for the day"
  }
  ```
- **Response `200 OK`**:
  Returns updated today's attendance summary with closed session and updated `totalMinutesWorked` / `totalHoursWorked`.
- **Error `409 Conflict`**:
  ```json
  {
    "success": false,
    "error": {
      "code": "NOT_CLOCKED_IN",
      "message": "No active clock-in session found to clock out",
      "correlationId": "corr_..."
    }
  }
  ```

### 4.4 `GET /api/v1/attendance/history`
Returns historical attendance records for the authenticated staff member.

- **Query Parameters**: `?limit=14&startDate=2026-11-01&endDate=2026-11-30`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "att_usr-emp-001_2026-11-11",
        "date": "2026-11-11",
        "dayOfWeek": "WEDNESDAY",
        "isWeekend": false,
        "resumptionStatus": "ON_TIME",
        "firstClockIn": "2026-11-11T07:54:30.000Z",
        "lastClockOut": "2026-11-11T17:02:15.000Z",
        "totalMinutesWorked": 547,
        "totalHoursWorked": 9.12,
        "sessions": [...]
      }
    ]
  }
  ```

---

## 5. UI/UX Design & Dashboard Integration Specification

In `update/src/pages/portal/StaffDashboardPage.tsx`:

### 5.1 Quick Action Header Integration
Replace the existing dummy button with:
1. **Clock In / Out Button**:
   - When not clocked in:
     - Button variant: `success` (`bg-success text-white`)
     - Label: `"Clock In for Today"`
     - Subtitle/tooltip: `"Standard shift: 8:00 AM – 5:00 PM"` (or `"Weekend shift tracked"`)
   - When clocked in:
     - Button variant: `danger` (`bg-danger text-white`)
     - Label: `"Clock Out (In at 07:54 AM)"`
   - During API call: `isLoading={isClockSubmitting}`, `disabled={isClockSubmitting}`.
2. **Resumption Status & Shift Badge**:
   - Mon–Fri:
     - If `resumptionStatus === 'ON_TIME'`: Emerald badge (`bg-[#E6F7F1] text-[#007B58] border border-[#007B58]/20`) with text `"Resumed On Time (07:54 AM)"`.
     - If `resumptionStatus === 'LATE'`: Amber badge (`bg-[#FFF8E6] text-[#865600] border border-[#865600]/20`) with text `"Late Resumption (+24m)"`.
     - If `resumptionStatus === 'NOT_RESUMED'`: Subtle badge `"Shift: 08:00 – 17:00"`.
   - Sat–Sun:
     - Sapphire badge (`bg-accent-soft text-brand border border-brand/20`) with text `"Weekend Shift (Tracked)"`.

### 5.2 Today's Hours Worked Display Widget
Add an Attendance metric widget / card on `StaffDashboardPage`:
- **Title**: `"Today's Work Hours"` (with `<Clock />` Phosphor icon).
- **Primary Metric**:
  - Large tabular numeral: e.g. `"4h 15m"` (or live elapsed seconds if active).
  - Active indicator: Green pulsing dot when currently clocked in (`"Active session running"`).
- **Subtext**:
  - When clocked in: `"First in: 07:54 AM • Target: 17:00 Close"`.
  - When clocked out: `"Daily total: 8h 15m (1 session)"`.
  - On weekends: `"Weekend Duty: 4h 30m logged"`.

---

## 6. Implementation Files Inventory

### 6.1 Backend Files to Create/Modify
1. **`update/server/repositories/types.ts`** (Modify):
   - Add `AttendanceSession`, `AttendanceRecord`, `ResumptionStatus`, `AttendanceStatus`, and `DailyAttendanceSummary` interfaces.
2. **`update/server/repositories/attendanceRepository.ts`** (Create):
   - Encapsulates `AtomicJsonStore<AttendanceRecord>`.
   - Handles `clockIn()`, `clockOut()`, `getTodayRecord()`, `getHistory()`, and calculation logic (8:00 AM - 5:00 PM standard vs weekend).
3. **`update/server/repositories/dataStore.ts`** (Modify):
   - Instantiate `AttendanceRepository` with `path.join(this.dataDir, 'attendance.json')`.
   - Export `getAttendanceRepository()`.
   - Add to `initialize()` and `reset()`.
4. **`update/server/schemas/attendanceSchemas.ts`** (Create):
   - Zod schemas for clock-in/out body payload (optional notes/location).
5. **`update/server/controllers/attendanceController.ts`** (Create):
   - Handlers for `clockInHandler`, `clockOutHandler`, `getTodayAttendanceHandler`, `getAttendanceHistoryHandler`.
   - Dispatches audit logs via `getAuditService().record()`.
6. **`update/server/routes/attendance.routes.ts`** (Create):
   - Express router for attendance endpoints protected with `requireAuth`.
7. **`update/server/routes/index.ts`** (Modify):
   - Mount router at `apiV1Router.use('/attendance', attendanceRouter);`.

### 6.2 Frontend Files to Create/Modify
1. **`update/src/lib/attendanceTypes.ts`** (Create):
   - TypeScript interfaces mirroring backend contracts.
2. **`update/src/lib/api.ts`** (Modify):
   - Add `api.attendance` namespace:
     - `getToday: () => Promise<DailyAttendanceSummary>`
     - `clockIn: (notes?: string) => Promise<DailyAttendanceSummary>`
     - `clockOut: (notes?: string) => Promise<DailyAttendanceSummary>`
     - `getHistory: (params?: { limit?: number }) => Promise<AttendanceRecord[]>`
3. **`update/src/lib/clientStore.ts`** (Modify):
   - Implement offline demonstration store methods for attendance with `localStorage` persistence.
4. **`update/src/pages/portal/StaffDashboardPage.tsx`** (Modify):
   - Wire `api.attendance.getToday()` on component mount.
   - Wire `api.attendance.clockIn()` and `api.attendance.clockOut()` to the button.
   - Add real-time live ticking timer (interval updating elapsed minutes/seconds).
   - Display daily hours worked, resumption status badge, and schedule details (8:00 AM - 5:00 PM Mon-Fri vs Weekend).

### 6.3 Test Files to Create/Modify
1. **`tests/fixtures/referenceServer.ts`** (Modify):
   - Add in-memory attendance store map and endpoint handlers (`/api/v1/attendance/*`) to maintain 100% oracle test compatibility.
2. **`tests/e2e/tier1-features/attendance.test.ts`** (Create):
   - Comprehensive test suite covering:
     - Successful clock-in creates session with ISO timestamp and user persistence.
     - Rejection of duplicate clock-in (`409 Conflict`).
     - Successful clock-out calculates session duration and total daily hours.
     - Rejection of clock-out when not clocked in (`409 Conflict`).
     - Multiple sessions in one day calculate correct cumulative hours.
     - Resumption schedule: Weekday 8:00 AM timeliness vs Weekend duty tracking.
     - Persistence: reload via `GET /attendance/today` returns stored state.

---

## 7. Verification Method

Once implemented, the feature can be verified through:
1. **Automated E2E Test Execution**:
   - Run `node --test tests/e2e/tier1-features/attendance.test.ts` or `tsx tests/testRunner.ts`.
2. **Direct API Verification via curl or TestClient**:
   - `POST /api/v1/auth/login` (obtain session cookie).
   - `GET /api/v1/attendance/today` $\rightarrow$ verifies initial un-clocked state.
   - `POST /api/v1/attendance/clock-in` $\rightarrow$ verifies session creation, ISO timestamp, and `ON_TIME` / `WEEKEND_DUTY` flag.
   - `GET /api/v1/attendance/today` $\rightarrow$ verifies state persistence.
   - `POST /api/v1/attendance/clock-out` $\rightarrow$ verifies session closure, duration calculation, and daily hours summation.
3. **UI Dashboard Verification**:
   - Launch Vite dev runner and open `http://localhost:5173/portal/dashboard`.
   - Verify initial load retrieves live attendance status.
   - Click "Clock In for Today", observe button changes to danger "Clock Out (In at ...)", timer starts ticking, and resumption badge appears.
   - Refresh the browser, verify clock-in state and elapsed time persist.
   - Click "Clock Out", verify daily hours update and status returns to clocked out.
