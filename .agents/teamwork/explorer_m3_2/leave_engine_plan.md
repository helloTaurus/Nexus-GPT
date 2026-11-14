# Leave Rules Engine, Nigerian Holiday Calendar & Workflow Blueprint (M3)

## 1. Executive Summary & Architecture Overview
This technical blueprint specifies the architecture, business logic, statutory compliance rules, and state machine invariants for **Milestone 3: Staff Portal Core & Leave Management Suite** (Features F04, F05, F06, F12, F13).

The leave subsystem provides zero-overdraft balance protection, Nigerian gazetted public holiday exclusions, automatic weekend filtering, doctor certificate enforcement, double-booking prevention, real-time balance reservation/deduction, and hierarchical role-based review queues with immutable audit logging.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Nexus Finance Leave Suite                       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────┐                           ┌─────────────────────┐
│  Employee Portal     │                           │  Admin/Manager      │
│  StaffLeavePage.tsx  │                           │  LeaveApprovalPage  │
└──────────┬───────────┘                           └──────────┬──────────┘
           │ (REST / JSON)                                    │
           ▼                                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Express 4 API Routes Layer                       │
│    GET /balances   GET/POST /calculate   GET/POST /requests           │
│    POST/PATCH /requests/:id/action       POST /requests/:id/cancel     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌────────────────────┐   ┌─────────────────────┐
│ Zero-Trust Schemas  │   │ Leave Rules Engine │   │ Immutable Audit     │
│ (leaveSchemas.ts)   │   │ - Nigerian Cal 2026│   │ Service             │
│ - Zod Validation    │   │ - Working-Day Calc │   │ (auditService.ts)   │
│ - Strict Filtering  │   │ - Overdraft Guard  │   │ - LEAVE_SUBMITTED   │
└─────────────────────┘   │ - Collision Guard  │   │ - LEAVE_APPROVED    │
                          └──────────┬─────────┘   │ - LEAVE_REJECTED    │
                                     │             │ - LEAVE_CANCELLED   │
                                     ▼             └─────────────────────┘
                          ┌────────────────────┐
                          │ LeaveRepository    │
                          │ - leave_balances   │
                          │ - leave_requests   │
                          └────────────────────┘
```

---

## 2. Feature Inventory Mapping (M3)

| Feature | Title | Description | Primary Endpoints | Target Components |
|---|---|---|---|---|
| **F04** | Leave Balances & Entitlements | Real-time entitlement tracking across 6 leave types with fiscal year quotas and carry-overs | `GET /api/v1/leaves/balances` | `StaffLeavePage.tsx` (Quota Cards) |
| **F05** | Leave Application Submission | Date range selection, working-day calculation excluding weekends & Nigerian holidays, balance reservation | `POST /api/v1/leaves/requests`<br>`POST /api/v1/leaves/calculate` | `StaffLeavePage.tsx` (Apply Drawer) |
| **F06** | Leave History & Status Tracking | Real-time status badges, request cancellation, manager comments display | `GET /api/v1/leaves/requests?scope=mine`<br>`POST /api/v1/leaves/requests/:id/cancel` | `StaffLeavePage.tsx` (History Table) |
| **F12** | Leave Policy & Rules Engine | Zero-overdraft balance protection, policy rules (sick notes, casual cap), Nigerian gazetted holiday exclusion | Stateless calculator & backend validation pipeline | `leaveRepository.ts`<br>`leaveController.ts` |
| **F13** | Leave Approval/Rejection Workflow | Multi-tier manager approval queue, rejection reason logging, reservation release, self-approval guard | `GET /api/v1/leaves/requests?scope=team`<br>`PATCH /api/v1/leaves/requests/:id/action` | `LeaveApprovalPage.tsx` |

---

## 3. The 6 Leave Types & Policy Rules Master Matrix

The system tracks entitlements for fiscal year 2026 across 6 statutory and company leave types:

| # | Leave Type ID | Display Name | Code | Annual Quota | Max Consecutive | Rollover Allowed? | Max Carry-Over | Medical Note / Attachment Rule |
|---|---|---|---|---|---|---|---|---|
| 1 | `lt-annual` | Annual Leave | `ANNUAL` | **20.0 days** | No cap | **Yes** | **5.0 days** | Not required |
| 2 | `lt-sick` | Sick Leave | `SICK` | **12.0 days** | No cap | No | 0 days | **Required if > 2 working days** |
| 3 | `lt-casual` | Casual Leave | `CASUAL` | **5.0 days** | **2 working days** | No | 0 days | Not required |
| 4 | `lt-maternity` | Maternity Leave | `MATERNITY` | **84.0 days** *(see Note)* | No cap | No | 0 days | Certificate required |
| 5 | `lt-paternity` | Paternity Leave | `PATERNITY` | **10.0 days** | No cap | No | 0 days | Birth certificate required |
| 6 | `lt-bereavement` | Bereavement Leave | `BEREAVEMENT` | **5.0 days** | No cap | No | 0 days | Not required |

> **Reconciliation Note on Maternity Leave Quota**:
> The dispatch prompt references Maternity (60d), while `seedData.ts` and `leave_balances.json` initialize `84.0` days. In Nigerian law (*Labour Act CAP L1 LFN 2004, section 54*), statutory maternity entitlement is 12 calendar weeks (84 days). The tests (`leave-balances.test.ts`) assert the existence of `lt-maternity` in the 6 leave types docket, and specific numerical checks for Annual (20), Sick (12), Casual (5). To remain compliant with both `seedData.ts` and statutory standards, `allocatedDays: 84.0` is maintained in seed stores, while allowing configurable annual allocation per employee on onboarding (`initialAnnualLeaveDays`).

---

## 4. Nigerian 2026 Gazetted Public Holiday Calendar & Working Day Algorithm

### 4.1 Statutory Gazetted Holidays for FY 2026
In compliance with Federal Republic of Nigeria Public Holidays declarations:

| ID | Holiday Name | ISO Date | Day of Week | Statutory Rationale |
|---|---|---|---|---|
| `hol-01` | New Year's Day | `2026-01-01` | Thursday | First day of civil year |
| `hol-02` | Eid al-Fitr Day 1 | `2026-03-20` | Friday | End of Ramadan (Islamic Lunar Calendar) |
| `hol-03` | Eid al-Fitr Day 2 | `2026-03-21` | Saturday | Feast of Breaking the Fast |
| `hol-04` | Good Friday | `2026-04-03` | Friday | Christian Paschal Triduum |
| `hol-05` | Easter Monday | `2026-04-06` | Monday | Easter holiday |
| `hol-06` | Workers' Day | `2026-05-01` | Friday | International Workers' Day / May Day |
| `hol-07` | Eid al-Kabir Day 1 | `2026-05-27` | Wednesday | Feast of Sacrifice (Eid al-Adha) |
| `hol-08` | Eid al-Kabir Day 2 | `2026-05-28` | Thursday | Second day of Feast of Sacrifice |
| `hol-09` | Democracy Day | `2026-06-12` | Friday | Commemoration of June 12, 1993 election |
| `hol-10` | Independence Day | `2026-10-01` | Thursday | 66th National Independence Anniversary |
| `hol-11` | Christmas Day | `2026-12-25` | Friday | Feast of the Nativity |
| `hol-12` | Boxing Day (Observed) | `2026-12-28` | Monday | Observed holiday (as Dec 26 falls on Saturday) |

### 4.2 Net Working Day Calculation Algorithm
Calculations run strictly in UTC to prevent client/server timezone slippage:

```typescript
public calculateNetWorkingDays(
  startDateStr: string,
  endDateStr: string,
  isHalfDay: boolean = false
): { workingDays: number; calendarDays: number; holidaysEncountered: string[] } {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    throw new Error('Invalid date range');
  }

  const holidayDates = new Set(SEED_NIGERIAN_HOLIDAYS_2026.map(h => h.date));
  const holidaysEncountered: string[] = [];
  let workingDays = 0;
  let calendarDays = 0;

  const current = new Date(start);
  while (current <= end) {
    calendarDays++;
    const dayOfWeek = current.getUTCDay(); // 0 is Sunday, 6 is Saturday
    const dateIso = current.toISOString().split('T')[0];

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend — strictly excluded
    } else if (holidayDates.has(dateIso)) {
      // Gazetted statutory holiday — excluded from balance deduction
      holidaysEncountered.push(dateIso);
    } else {
      // Eligible business working day
      workingDays += isHalfDay ? 0.5 : 1.0;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return { workingDays, calendarDays, holidaysEncountered };
}
```

---

## 5. Specification of the 12 Leave Invariants

Every invariant has strict status codes, error codes, and assertions verified in tests:

### Invariant 1: Entitlement Quota Structure
- **Condition**: Initial balance for seed employees includes 6 leave types with correct default allocations.
- **Verification**: `GET /api/v1/leaves/balances` returns 6 records. Annual = 20.0, Sick = 12.0, Casual = 5.0, Maternity = 84.0, Paternity = 10.0, Bereavement = 5.0.

### Invariant 2: Weekend & Statutory Holiday Filtering
- **Condition**: Dates on Saturdays, Sundays, and 2026 gazetted holidays deduct 0 working days.
- **Verification**: `POST /api/v1/leaves/calculate` with `2026-04-30` to `2026-05-04` returns `workingDays: 2.0` and `holidaysEncountered: ['2026-05-01']`.

### Invariant 3: Inverted Date Range Guard
- **Condition**: `startDate > endDate` or unparseable date strings.
- **HTTP Code**: `400 Bad Request`
- **Error Payload**: `{ success: false, error: { code: 'INVALID_DATE_RANGE', message: 'End date cannot be earlier than start date', correlationId } }`

### Invariant 4: Zero Working Days Guard
- **Condition**: The selected date span contains only Saturdays, Sundays, or holidays (`workingDays <= 0`).
- **HTTP Code**: `400 Bad Request`
- **Error Payload**: `{ success: false, error: { code: 'ZERO_WORKING_DAYS', message: 'Selected period contains 0 net working days (all weekends or holidays)', correlationId } }`

### Invariant 5: Zero-Overdraft Balance Protection
- **Condition**: `workingDays > balance.availableDays`. Available days is calculated strictly as:
  $$\text{availableDays} = (\text{allocatedDays} + \text{carriedOverDays}) - \text{usedDays} - \text{pendingDays}$$
- **HTTP Code**: `409 Conflict`
- **Error Payload**: `{ success: false, error: { code: 'INSUFFICIENT_LEAVE_BALANCE', message: 'Insufficient leave balance: Requested X days, available Y days', correlationId } }`

### Invariant 6: Double-Booking / Collision Guard
- **Condition**: Active request exists for the employee (`status === 'SUBMITTED' || status === 'APPROVED'`) where:
  $$\text{reqStart} \le \text{exEnd} \quad \text{and} \quad \text{reqEnd} \ge \text{exStart}$$
- **HTTP Code**: `409 Conflict`
- **Error Payload**: `{ success: false, error: { code: 'DATE_OVERLAP', message: 'Date range overlaps with existing leave request LR-XXXX-XXXX', correlationId } }`
- **Note**: Cancelled or rejected requests do NOT block new applications.

### Invariant 7: Sick Leave Medical Note Enforcement
- **Condition**: `leaveTypeId === 'lt-sick'` AND `workingDays > 2` AND `!attachmentUrl`.
- **HTTP Code**: `422 Unprocessable Entity`
- **Error Payload**: `{ success: false, error: { code: 'MEDICAL_NOTE_REQUIRED', message: 'Doctor certificate required for sick leave exceeding 2 consecutive working days', correlationId } }`
- **Note**: Sick leave of 1.0 or 2.0 working days does NOT require an attachment.

### Invariant 8: Casual Leave Consecutive Limit Enforcement
- **Condition**: `leaveTypeId === 'lt-casual'` AND `workingDays > 2`.
- **HTTP Code**: `422 Unprocessable Entity`
- **Error Payload**: `{ success: false, error: { code: 'POLICY_LIMIT_EXCEEDED', message: 'Casual leave cannot exceed 2 consecutive working days', correlationId } }`

### Invariant 9: Real-Time Balance Reservation & State Transition
- **On Submission**:
  - `balance.pendingDays += workingDays`
  - `balance.availableDays = (allocated + carriedOver) - used - pending`
  - `status: 'SUBMITTED'`
  - Emits audit log: `LEAVE_SUBMITTED`
- **On Manager Approval**:
  - `balance.pendingDays -= totalDays`
  - `balance.usedDays += totalDays`
  - `balance.availableDays` unchanged (already decremented at reservation)
  - `status: 'APPROVED'`
  - Emits audit log: `LEAVE_APPROVED`
- **On Manager Rejection**:
  - `balance.pendingDays -= totalDays`
  - `balance.availableDays = (allocated + carriedOver) - used - pending` (restored)
  - `status: 'REJECTED'`
  - Emits audit log: `LEAVE_REJECTED`

### Invariant 10: Request Cancellation & Past Leave Guard
- **Authorization**: Only requesting employee or Admin can cancel. (Other employee attempt -> `403 FORBIDDEN`).
- **Retroactive Guard**: If `leaveReq.startDate < today && leaveReq.status === 'APPROVED'`:
  - **HTTP Code**: `400 Bad Request`
  - **Error Payload**: `{ success: false, error: { code: 'PAST_LEAVE_CANNOT_BE_CANCELLED', message: 'Cannot retroactively cancel past leave. Contact HR Administrator', correlationId } }`
- **Restoration**:
  - If `status === 'SUBMITTED'`: `balance.pendingDays -= totalDays`
  - If `status === 'APPROVED'`: `balance.usedDays -= totalDays`
  - `balance.availableDays` restored.
  - `status: 'CANCELLED'`
  - Emits audit log: `LEAVE_CANCELLED`

### Invariant 11: Self-Approval Prohibition
- **Condition**: Approver user ID matches applicant employee ID (`leaveReq.employeeId === user.profile.id`).
- **HTTP Code**: `403 Forbidden`
- **Error Payload**: `{ success: false, error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'Self-approval prohibited', correlationId } }`

### Invariant 12: Hierarchical Scope & Reporting Line Authorization
- **Line Manager Authority**:
  - Manager can only review requests where `leaveReq.assignedApproverId === user.profile.id`.
  - Out-of-chain review attempt -> `403 FORBIDDEN` (`Not authorized to review this leave request`).
  - Admin (`user.role === 'ADMIN'`) has global approval authority.
- **Peer Balance Privacy**:
  - Regular employee viewing another employee's balances -> `403 FORBIDDEN` (`Cannot view peer leave balances`).
- **Queue Query Scopes (`GET /api/v1/leaves/requests?scope=...`)**:
  - `scope=mine`: own requests for any authenticated user.
  - `scope=team`: direct report requests for Manager/Admin. Regular employee attempt -> `403 FORBIDDEN` (`Employees cannot view team approval queue`).
  - `scope=all`: all company requests for Admin. Non-admin attempt -> `403 FORBIDDEN` (`Admin role required to view all company requests`).

---

## 6. Leave Request Lifecycle State Machine

```
              ┌───────────────┐
              │ Initial State │
              └───────┬───────┘
                      │ POST /leaves/requests
                      ▼
              ┌───────────────┐
       ┌─────►│   SUBMITTED   │◄──────────────────────┐
       │      │ (pendingDays) │                       │
       │      └───────┬───────┘                       │
       │              │                               │
       │ POST cancel  ├───────────────┐ PATCH action  │
       │ (Restores    │ PATCH action  │ (Restores     │
       │  pending)    │ (Converts to  │  pending)     │
       ▼              ▼  usedDays)    ▼               │
┌─────────────┐ ┌─────────────┐ ┌────────────┐        │
│  CANCELLED  │ │  APPROVED   │ │  REJECTED  │        │
└─────────────┘ └──────┬──────┘ └────────────┘        │
                       │                              │
                       │ POST cancel (if future date) │
                       │ (Restores usedDays)          │
                       └──────────────────────────────┘
```

---

## 7. API Interface Contract Specification

### 7.1 GET `/api/v1/leaves/balances`
- **Auth**: `requireAuth`
- **Query Params**: `employeeId?: string`
- **Access**:
  - Regular employee: only own profile ID.
  - Manager / Admin: own or any subordinate ID.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "emp-employee-01_lt-annual_2026",
      "employeeId": "emp-employee-01",
      "leaveTypeId": "lt-annual",
      "fiscalYear": 2026,
      "allocatedDays": 20.0,
      "carriedOverDays": 0,
      "accruedDays": 20.0,
      "usedDays": 0,
      "pendingDays": 0,
      "availableDays": 20.0
    }
  ]
}
```

### 7.2 POST / GET `/api/v1/leaves/calculate`
- **Auth**: Public or Authenticated
- **Body / Query**:
```json
{
  "startDate": "2026-04-30",
  "endDate": "2026-05-04",
  "isHalfDay": false
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "workingDays": 2.0,
  "calendarDays": 5,
  "holidaysEncountered": ["2026-05-01"]
}
```

### 7.3 GET `/api/v1/leaves/requests`
- **Auth**: `requireAuth`
- **Query Params**: `scope?: 'mine' | 'team' | 'all'` (default `'mine'`)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "lr-9a8b7c6d",
      "requestNumber": "LR-2026-4821",
      "employeeId": "emp-employee-01",
      "leaveTypeId": "lt-annual",
      "startDate": "2026-06-01",
      "endDate": "2026-06-03",
      "isHalfDay": false,
      "totalDays": 3.0,
      "reason": "Family vacation",
      "status": "SUBMITTED",
      "assignedApproverId": "emp-manager-01",
      "submittedAt": "2026-06-01T08:00:00.000Z"
    }
  ]
}
```

### 7.4 POST `/api/v1/leaves/requests`
- **Auth**: `requireAuth`
- **Payload Schema**:
```json
{
  "leaveTypeId": "lt-annual",
  "startDate": "2026-06-01",
  "endDate": "2026-06-03",
  "isHalfDay": false,
  "reason": "Family vacation in Calabar",
  "attachmentUrl": "https://storage.nexusfinance.ng/receipts/doc.pdf"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "lr-9a8b7c6d",
    "requestNumber": "LR-2026-4821",
    "employeeId": "emp-employee-01",
    "leaveTypeId": "lt-annual",
    "startDate": "2026-06-01",
    "endDate": "2026-06-03",
    "isHalfDay": false,
    "totalDays": 3.0,
    "reason": "Family vacation in Calabar",
    "status": "SUBMITTED",
    "assignedApproverId": "emp-manager-01",
    "submittedAt": "2026-11-10T02:00:00.000Z"
  }
}
```

### 7.5 PATCH / POST `/api/v1/leaves/requests/:id/action` (also `/review`)
- **Auth**: `requireAuth`
- **Payload Schema**:
```json
{
  "action": "APPROVE",
  "decisionReason": "Approved. Enjoy your time off!"
}
```
*(Accepts both `action` or `decision` with values `'APPROVE' | 'REJECT' | 'Approved' | 'Rejected'`, and reason via `decisionReason` or `comment`)*.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "lr-9a8b7c6d",
    "status": "APPROVED",
    "decidedAt": "2026-11-10T02:15:00.000Z",
    "decisionReason": "Approved. Enjoy your time off!"
  }
}
```

### 7.6 POST `/api/v1/leaves/requests/:id/cancel`
- **Auth**: `requireAuth`
- **Payload Schema**:
```json
{
  "reason": "Plans cancelled"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "lr-9a8b7c6d",
    "status": "CANCELLED"
  }
}
```

---

## 8. Zero-Trust Schema Validation Blueprint (`leaveSchemas.ts`)

To enforce NIST SSDF and OWASP A04 (Insecure Design) compliance, worker_m3 should introduce `update/server/schemas/leaveSchemas.ts`:

```typescript
import { z } from './zod.ts';

export const calculateLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  isHalfDay: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional()
}).strict();

export const submitLeaveRequestSchema = z.object({
  leaveTypeId: z.enum([
    'lt-annual',
    'lt-sick',
    'lt-casual',
    'lt-maternity',
    'lt-paternity',
    'lt-bereavement'
  ]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
  isHalfDay: z.boolean().optional().default(false),
  attachmentUrl: z.string().url().optional()
}).strict();

export const reviewLeaveRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'Approved', 'Rejected']).optional(),
  decision: z.enum(['APPROVE', 'REJECT', 'Approved', 'Rejected']).optional(),
  decisionReason: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(500).optional()
}).refine(data => data.action !== undefined || data.decision !== undefined, {
  message: 'Action or decision is required'
});

export const cancelLeaveRequestSchema = z.object({
  reason: z.string().trim().max(500).optional()
});
```

---

## 9. Frontend Integration Blueprint (`StaffLeavePage` & `LeaveApprovalPage`)

### 9.1 `StaffLeavePage.tsx` Dynamic Wiring
Currently, `StaffLeavePage.tsx` contains static state. Worker_m3 should integrate:
1. **Dynamic Quota Cards**:
   - Call `GET /api/v1/leaves/balances`.
   - Render 4 primary cards:
     - Annual Leave: `${availableDays} / ${allocatedDays + carriedOverDays} Days`
     - Sick / Medical: `${availableDays} / ${allocatedDays} Days`
     - Casual Emergency: `${availableDays} / ${allocatedDays} Days`
     - Paternity / Maternity / Bereavement: `${availableDays} Days Entitled`
   - Progress bar fill: `width: ${(availableDays / allocatedDays) * 100}%`.
2. **Dynamic Leave Application Drawer**:
   - Leave Category Dropdown populated with dynamic balances:
     - `lt-annual`: "Annual Vacation Leave (${annual.availableDays} Days Left)"
     - `lt-sick`: "Medical / Sick Leave (${sick.availableDays} Days Left)"
     - `lt-casual`: "Casual Emergency (${casual.availableDays} Days Left)"
     - `lt-paternity`: "Paternity Leave (${paternity.availableDays} Days Left)"
     - `lt-maternity`: "Maternity Leave (${maternity.availableDays} Days Left)"
     - `lt-bereavement`: "Bereavement Leave (${bereavement.availableDays} Days Left)"
   - Interactive date selection triggers `/api/v1/leaves/calculate` debounced:
     - Displays net working days, calendar days, and holidays encountered.
     - Displays real-time warning if `workingDays > availableDays`.
     - Displays medical note upload field when `leaveTypeId === 'lt-sick'` and `workingDays > 2`.
     - Displays policy limit error if `leaveTypeId === 'lt-casual'` and `workingDays > 2`.
   - On submit: Calls `POST /api/v1/leaves/requests`. Re-fetches balances and updates history table.
3. **Leave History Table & Cancellation**:
   - Call `GET /api/v1/leaves/requests?scope=mine`.
   - Display columns: Request ID, Category, Date Range, Working Days, Reason, Status badge.
   - For rows with `status === 'SUBMITTED'` or (upcoming future `APPROVED`), provide an actionable **Cancel** button calling `POST /api/v1/leaves/requests/:id/cancel`.

### 9.2 `LeaveApprovalPage.tsx` Dynamic Wiring
1. **Manager Queue Loading**:
   - Call `GET /api/v1/leaves/requests?scope=team` (or `scope=all` if admin).
   - Display applicant employee name, department, leave category, duration, working days, reason.
2. **Review Modal & Action Dispatch**:
   - Click "Approve":
     - Calls `PATCH /api/v1/leaves/requests/:id/action` with `{ action: 'APPROVE', decisionReason: comment || 'Approved' }`.
   - Click "Reject":
     - Opens prompt/modal requiring rejection reason (e.g., "Critical quarterly audit coverage").
     - Calls `PATCH /api/v1/leaves/requests/:id/action` with `{ action: 'REJECT', decisionReason: reason }`.
   - Updates local table state and decrements pending actions badge.

---

## 10. Step-by-Step Implementation Guide for Worker M3

### Step 1: Schemas & Routing Hardening
1. Add `update/server/schemas/leaveSchemas.ts` with strict input validation for `/calculate`, `/requests`, `/review`, `/cancel`.
2. Export from `update/server/schemas/index.ts`.
3. Add `validateBody` and `validateQuery` to `update/server/routes/leaves.routes.ts`.

### Step 2: Seed & Data Store Validation
1. Verify `update/server/data/leave_balances.json` contains consistent records for all seed users (`usr-admin-01`, `usr-manager-01`, `usr-employee-01`, `usr-employee-02`, `usr-depthead-01`, `usr-finance-01`).
2. Verify `leaveRepository.ts` initialization ensures newly onboarded employees receive default 2026 balances with initial annual quota parameter.

### Step 3: Frontend Staff Portal (`StaffLeavePage.tsx`)
1. Implement `useEffect` fetching `/api/v1/leaves/balances` and `/api/v1/leaves/requests?scope=mine`.
2. Implement date change handler calling `/api/v1/leaves/calculate`.
3. Bind form submission to `POST /api/v1/leaves/requests`.
4. Add cancel button invoking `POST /api/v1/leaves/requests/:id/cancel`.
5. Integrate skeleton loaders during data fetch for perceived performance compliance.

### Step 4: Frontend Admin Portal (`LeaveApprovalPage.tsx`)
1. Implement `useEffect` fetching `/api/v1/leaves/requests?scope=team`.
2. Implement approval handler invoking `PATCH /api/v1/leaves/requests/:id/action` with `action: 'APPROVE'`.
3. Implement rejection modal capturing mandatory rejection explanation.

### Step 5: Regression & Boundary Verification
1. Run `node tests/testRunner.ts` to ensure 100% of 122 tests pass without regressions.
2. Verify all 4 tiers of E2E leave tests pass against both in-memory reference and live Express server.

---

## 11. Verification Matrix

| Test Suite File | Covered Features & Invariants | Test Count | Pass Criteria |
|---|---|---|---|
| `tests/e2e/tier1-features/leave-balances.test.ts` | F04: Initial quotas (20, 12, 5), peer privacy guard, admin/manager scope, holiday calculator | 8 tests | 100% Pass |
| `tests/e2e/tier1-features/leave-application.test.ts` | F05, F06, F13: Submission, reservation, history view, cancellation, approval, rejection | 6 tests | 100% Pass |
| `tests/e2e/tier2-boundaries/leave-boundaries.test.ts` | F12: Overdraft guard, inverted dates, weekend only, double-booking, sick notes, casual limits, self-approval guard, past cancellation | 10 tests | 100% Pass |
| `tests/e2e/tier3-combinations/leave-workflow-combinations.test.ts` | Complete leave lifecycles, rejection restoration, approved cancellation, concurrent request math | 4 tests | 100% Pass |
| `tests/e2e/tier4-scenarios/workforce-restructuring-rollover.test.ts` | Fiscal year rollover carry-over cap (5.0 days max) and manager re-assignment | 1 test | 100% Pass |
| `tests/e2e/tier4-scenarios/complete-employee-lifecycle.test.ts` | End-to-end onboarding, profile update, leave application, approval, and balance check | 1 test | 100% Pass |
