# Milestone 3 Technical Specification: Staff Portal Core & Leave Management Suite UI Integration

**Author**: `explorer_m3_3` (Frontend Portal & Design System Explorer)  
**Target Milestone**: Milestone 3 (Staff Portal Core & Leave Management Suite)  
**Scope**: `update/src/pages/portal/StaffLeavePage.tsx`, `update/src/pages/admin/LeaveApprovalPage.tsx`, `update/src/pages/portal/StaffDashboardPage.tsx`, `update/src/lib/api.ts`, and Design System Integration  
**Date**: November 10, 2026  

---

## 1. Executive Summary & Diagnostic Findings

An exhaustive exploration of the Nexus Finance frontend codebase (`update/src/`) and live backend API services (`update/server/`) revealed the following critical state:

1. **Frontend Disconnection from Live Backend**:
   - The frontend pages currently maintain hardcoded local state (`useState`) with simulated timeouts (`setTimeout`).
   - No client-side HTTP/API client helper exists in `update/src/lib/`.
   - Form submissions generate mock IDs (`LV-2026-00...`) instead of transmitting validated payloads to `/api/v1/leaves/requests`.
2. **Leave Balance Inconsistencies**:
   - `StaffLeavePage.tsx` renders 4 hardcoded cards with inaccurate entitlements (e.g., Annual Leave shows 18 / 24 Days instead of the 20-day policy standard defined in `SEED_LEAVE_TYPES`).
   - Missing 2 official leave types: Maternity Leave (84 days) and Bereavement Leave (5 days).
3. **Stateless Working Days & Holiday Engine Unutilized**:
   - The backend features a working days calculation engine (`leaveRepo.calculateNetWorkingDays` via `POST /api/v1/leaves/calculate`) that accurately excludes weekends (Saturdays & Sundays) and 2026 Nigerian gazetted public holidays (Workers' Day, Democracy Day, Eid, Independence Day, Christmas, etc.).
   - The frontend leave drawer currently provides no dynamic working day computation, no holiday banners, and no client-side overdraft warnings.
4. **Unimplemented Review Modal in LeaveApprovalPage**:
   - `LeaveApprovalPage.tsx` declares `reviewModalItem` and `comment` state (lines 67–68), but the `Modal` component is never rendered. Approvals currently mutate local array state with no backend synchronization (`PATCH /api/v1/leaves/requests/:id/action`).
5. **Missing Request Cancellation Flow**:
   - `StaffLeavePage.tsx` has no cancellation triggers or confirmation modal for `SUBMITTED` requests to release reserved `pendingDays` back to `availableDays`.
6. **Strict Invariant Adherence**:
   - The design tokens in `nexus-tokens.css` (Sapphire `#0D51B2`, Emerald `#007B58`/`#69D3B0`, Canvas `#0D1624`/`#F7F8FA`, Surface `#121E2E`/`#FFFFFF`, 7px control radius, 12px card radius, Bricolage Grotesque, Instrument/DM Sans, `--nx-ease`) and the strict rule of **zero loose files in `update/src/components/` root** are confirmed.

---

## 2. Architecture & File Topology

```
update/
├── src/
│   ├── lib/
│   │   ├── api.ts                   # NEW: Strongly typed fetch client with credentials: 'include'
│   │   └── leaveTypes.ts            # NEW: Domain interfaces matching backend JSON schemas
│   ├── components/
│   │   ├── layout/                  # PortalLayout, AdminLayout, Sidebar, Navbar, Footer
│   │   ├── ui/                      # Atoms: Button, Card, Badge, Drawer, Modal, Input, Tabs, Skeleton
│   │   └── features/                # Domain-specific compound cards & widgets
│   ├── pages/
│   │   ├── portal/
│   │   │   ├── StaffDashboardPage.tsx # Live annual balance, upcoming statutory holidays, recent leaves
│   │   │   ├── StaffLeavePage.tsx     # 6 dynamic quota cards, dynamic calculation drawer, filtered history
│   │   │   └── StaffProfilePage.tsx   # KYC & Banking details (explorer_m3_1)
│   │   └── admin/
│   │       └── LeaveApprovalPage.tsx  # Manager/Admin approval queue with ReviewModal & comments
```

> **Strict Component Architecture Rule**: Never place loose files in `update/src/components/`. All reusable UI must reside in `components/ui/`, `components/layout/`, or `components/features/`.

---

## 3. Client API Helper Specification (`update/src/lib/api.ts`)

Portal pages must execute API requests with `credentials: 'include'` so that the browser transmits the HttpOnly `nexus_session` cookie established during login.

### 3.1 Type Definitions (`update/src/lib/leaveTypes.ts`)

```typescript
export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string; // 'lt-annual' | 'lt-sick' | 'lt-casual' | 'lt-maternity' | 'lt-paternity' | 'lt-bereavement'
  fiscalYear: number;
  allocatedDays: number;
  carriedOverDays: number;
  accruedDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export interface LeaveRequest {
  id: string;
  requestNumber: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isHalfDay: boolean;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  assignedApproverId: string;
  submittedAt: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface WorkingDaysCalculation {
  workingDays: number;
  calendarDays: number;
  holidaysEncountered: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    correlationId?: string;
  };
}
```

### 3.2 API Client Implementation (`update/src/lib/api.ts`)

```typescript
import type { LeaveBalance, LeaveRequest, WorkingDaysCalculation, ApiResponse } from './leaveTypes';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  correlationId?: string;

  constructor(message: string, code: string, status: number, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // MANDATORY: Sends HttpOnly nexus_session cookie
  });

  const body: ApiResponse<T> & Record<string, any> = await response.json().catch(() => ({
    success: false,
    error: { code: 'INVALID_JSON', message: 'Failed to parse response payload' },
  }));

  if (!response.ok || body.success === false) {
    const error = body.error || { code: 'UNKNOWN_ERROR', message: response.statusText };
    throw new ApiError(error.message, error.code, response.status, error.correlationId);
  }

  // Handle both standard { success: true, data: T } and flat responses like { success: true, workingDays: ... }
  return (body.data !== undefined ? body.data : body) as T;
}

export const api = {
  // Leaves Endpoints
  leaves: {
    getBalances: (employeeId?: string): Promise<LeaveBalance[]> =>
      request<LeaveBalance[]>(`/leaves/balances${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ''}`),

    calculateDays: (startDate: string, endDate: string, isHalfDay = false): Promise<WorkingDaysCalculation> =>
      request<WorkingDaysCalculation>('/leaves/calculate', {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate, isHalfDay }),
      }),

    getRequests: (scope: 'mine' | 'team' | 'all' = 'mine'): Promise<LeaveRequest[]> =>
      request<LeaveRequest[]>(`/leaves/requests?scope=${scope}`),

    submitRequest: (payload: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      reason: string;
      isHalfDay?: boolean;
      attachmentUrl?: string;
    }): Promise<LeaveRequest> =>
      request<LeaveRequest>('/leaves/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    cancelRequest: (requestId: string, reason?: string): Promise<LeaveRequest> =>
      request<LeaveRequest>(`/leaves/requests/${requestId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    reviewRequest: (
      requestId: string,
      decision: 'APPROVE' | 'REJECT',
      comment?: string
    ): Promise<LeaveRequest> =>
      request<LeaveRequest>(`/leaves/requests/${requestId}/action`, {
        method: 'PATCH',
        body: JSON.stringify({ action: decision, decisionReason: comment }),
      }),
  },

  // Auth / Profile Endpoints
  auth: {
    me: () => request<any>('/auth/me'),
    getProfile: () => request<any>('/portal/profile'),
  },
};
```

---

## 4. Component Implementation Specifications

### 4.1 Dynamic Leave Balance Cards (`StaffLeavePage.tsx`)

#### Policy Standard Quotas (from `SEED_LEAVE_TYPES`)
| Leave Type | Code | Allocated Days | Carry-Over Allowed | Key Policy Limit |
|---|---|---|---|---|
| Annual Vacation | `lt-annual` | 20.0 | Yes (up to 5.0d) | Standard annual allocation |
| Sick / Medical | `lt-sick` | 12.0 | No | Doctor's note required if > 2 consecutive days |
| Casual Emergency | `lt-casual` | 5.0 | No | Maximum 2 consecutive days per filing |
| Maternity Leave | `lt-maternity` | 84.0 | No | Full term maternity allocation |
| Paternity Leave | `lt-paternity` | 10.0 | No | 10 working days |
| Bereavement Leave | `lt-bereavement` | 5.0 | No | Immediate family bereavement |

#### UI Presentation & Visual Tokens
- **Grid Layout**: 6 responsive cards (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4`).
- **Surface**: `bg-surface border border-rule rounded-[12px] p-5 shadow-sm`.
- **Metrics Display**:
  - Available Days: `text-3xl font-semibold text-ink font-display font-mono-nums`.
  - Quota Denominator: `text-xs text-muted font-sans` (`/ {allocatedDays} Days`).
  - Progress Bar: `h-1.5 w-full bg-subtle rounded-full overflow-hidden mt-3`.
  - Progress Fill: `width: ${(availableDays / allocatedDays) * 100}%`.
    - Annual: `bg-[#0D51B2]` (brand sapphire)
    - Sick: `bg-[#007B58] dark:bg-[#69D3B0]` (emerald)
    - Casual: `bg-[#865600] dark:bg-[#F3CE87]` (warning amber)
    - Maternity/Paternity: `bg-[#0D51B2]` (sapphire)
    - Bereavement: `bg-muted`
  - Sub-Metrics: `flex justify-between text-[11px] text-muted mt-2 font-mono-nums`.
    - Left: `{usedDays}d used`
    - Right: `{pendingDays > 0 ? `${pendingDays}d pending` : '0 pending'}`

#### Loading Skeleton State
When `isLoadingBalances` is true, render 6 `<Skeleton height={110} className="rounded-[12px]" />` elements.

---

### 4.2 Leave Application Drawer with Dynamic Date Engine (`StaffLeavePage.tsx`)

#### State Management
```typescript
const [drawerOpen, setDrawerOpen] = useState(false);
const [leaveTypeId, setLeaveTypeId] = useState('lt-annual');
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [isHalfDay, setIsHalfDay] = useState(false);
const [reason, setReason] = useState('');
const [attachmentUrl, setAttachmentUrl] = useState('');

// Dynamic Calculation Engine State
const [isCalculating, setIsCalculating] = useState(false);
const [calcResult, setCalcResult] = useState<WorkingDaysCalculation | null>(null);
const [calcError, setCalcError] = useState<string | null>(null);

// Form Submission State
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitError, setSubmitError] = useState<string | null>(null);
const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
```

#### Real-Time Date Calculation Trigger
```typescript
useEffect(() => {
  if (!startDate || !endDate) {
    setCalcResult(null);
    setCalcError(null);
    return;
  }

  if (endDate < startDate) {
    setCalcError('End date cannot be earlier than start date.');
    setCalcResult(null);
    return;
  }

  let isCurrent = true;
  setIsCalculating(true);
  setCalcError(null);

  api.leaves.calculateDays(startDate, endDate, isHalfDay)
    .then((result) => {
      if (!isCurrent) return;
      setCalcResult(result);
      if (result.workingDays === 0) {
        setCalcError('The selected period contains 0 net working days (all weekends or public holidays).');
      }
    })
    .catch((err: any) => {
      if (!isCurrent) return;
      setCalcError(err.message || 'Error calculating working days.');
      setCalcResult(null);
    })
    .finally(() => {
      if (isCurrent) setIsCalculating(false);
    });

  return () => { isCurrent = false; };
}, [startDate, endDate, isHalfDay]);
```

#### Dynamic Form Warnings & Badges
1. **Public Holiday Exclusion Notification**:
   ```tsx
   {calcResult && calcResult.holidaysEncountered.length > 0 && (
     <div className="p-3 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border border-[#007B58]/20 text-xs flex items-center gap-2">
       <CheckCircle className="w-4 h-4 shrink-0" />
       <span>
         Gazetted Nigerian holiday detected ({calcResult.holidaysEncountered.join(', ')}). Excluded from quota deduction!
       </span>
     </div>
   )}
   ```
2. **Zero-Overdraft Warning Banner**:
   ```tsx
   {calcResult && activeBalance && calcResult.workingDays > activeBalance.availableDays && (
     <div className="p-3 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs flex items-center gap-2">
       <XCircle className="w-4 h-4 shrink-0" />
       <span>
         Insufficient balance: Requested <strong>{calcResult.workingDays} days</strong> exceeds available <strong>{activeBalance.availableDays} days</strong>.
       </span>
     </div>
   )}
   ```
3. **Casual Leave Limit Warning (> 2 Consecutive Working Days)**:
   ```tsx
   {leaveTypeId === 'lt-casual' && calcResult && calcResult.workingDays > 2 && (
     <div className="p-3 rounded-[7px] bg-[#FFF8E6] dark:bg-[#3B3222] text-[#865600] dark:text-[#F3CE87] border border-[#865600]/20 text-xs flex items-center gap-2">
       <Info className="w-4 h-4 shrink-0" />
       <span>Policy Notice: Casual leave cannot exceed 2 consecutive working days.</span>
     </div>
   )}
   ```
4. **Sick Leave Medical Certificate Requirement (> 2 Consecutive Working Days)**:
   ```tsx
   {leaveTypeId === 'lt-sick' && calcResult && calcResult.workingDays > 2 && (
     <div className="space-y-1.5">
       <div className="p-3 rounded-[7px] bg-accent-soft text-brand border border-brand/20 text-xs flex items-center gap-2">
         <Info className="w-4 h-4 shrink-0" />
         <span>Doctor's certificate mandatory for sick leave exceeding 2 consecutive working days.</span>
       </div>
       <Input
         label="Medical Certificate Document URL / Reference"
         placeholder="e.g. https://portal.nexusfinance.ng/uploads/med-cert-442.pdf"
         value={attachmentUrl}
         onChange={(e) => setAttachmentUrl(e.target.value)}
         required
       />
     </div>
   )}
   ```

#### Submission Execution
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitError(null);

  if (!calcResult || calcResult.workingDays <= 0) {
    setSubmitError('Please specify a valid date range with at least 1 working day.');
    return;
  }

  const activeBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);
  if (activeBalance && calcResult.workingDays > activeBalance.availableDays) {
    setSubmitError(`Insufficient balance. You only have ${activeBalance.availableDays} days available.`);
    return;
  }

  setIsSubmitting(true);
  try {
    const newReq = await api.leaves.submitRequest({
      leaveTypeId,
      startDate,
      endDate,
      reason,
      isHalfDay,
      attachmentUrl: attachmentUrl || undefined,
    });

    // 1. Prepend to requests list
    setRequests((prev) => [newReq, ...prev]);

    // 2. Refresh balances to reflect pending reservation
    const updatedBalances = await api.leaves.getBalances();
    setBalances(updatedBalances);

    // 3. Close Drawer & reset form
    setDrawerOpen(false);
    setStartDate('');
    setEndDate('');
    setReason('');
    setAttachmentUrl('');
    setCalcResult(null);

    // 4. Success Toast
    setToast({
      type: 'success',
      message: `Leave request ${newReq.requestNumber} (${newReq.totalDays} days) submitted for manager review.`,
    });
  } catch (err: any) {
    setSubmitError(err.message || 'Failed to submit leave request.');
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### 4.3 Leave Requests History Table with Filter Tabs & Cancellation Modal (`StaffLeavePage.tsx`)

#### Filter Tabs Specification
Use the reusable `Tabs` component:
```typescript
const filterTabs = [
  { id: 'all', label: 'All Requests', count: requests.length },
  { id: 'pending', label: 'Pending Review', count: requests.filter((r) => r.status === 'SUBMITTED').length },
  { id: 'approved', label: 'Approved', count: requests.filter((r) => r.status === 'APPROVED').length },
  { id: 'rejected', label: 'Rejected', count: requests.filter((r) => r.status === 'REJECTED').length },
];
```

#### Status Badge Visual Token Mapping
```typescript
const renderStatusBadge = (status: LeaveRequest['status']) => {
  switch (status) {
    case 'APPROVED':
      return <Badge variant="approved" size="sm">Approved</Badge>;
    case 'SUBMITTED':
      return <Badge variant="pending" size="sm">Pending Review</Badge>;
    case 'REJECTED':
      return <Badge variant="rejected" size="sm">Rejected</Badge>;
    case 'CANCELLED':
      return <Badge variant="neutral" size="sm">Cancelled</Badge>;
  }
};
```

#### Cancellation Flow & Modal
```typescript
const [cancelModalItem, setCancelModalItem] = useState<LeaveRequest | null>(null);
const [cancelReason, setCancelReason] = useState('');
const [isCancelling, setIsCancelling] = useState(false);

const handleConfirmCancel = async () => {
  if (!cancelModalItem) return;
  setIsCancelling(true);
  try {
    const updatedReq = await api.leaves.cancelRequest(cancelModalItem.id, cancelReason);
    setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
    
    // Refresh balances to reflect released pendingDays
    const updatedBalances = await api.leaves.getBalances();
    setBalances(updatedBalances);

    setCancelModalItem(null);
    setCancelReason('');
    setToast({
      type: 'success',
      message: `Request ${updatedReq.requestNumber} cancelled. ${updatedReq.totalDays} working days restored to balance.`,
    });
  } catch (err: any) {
    alert(err.message || 'Failed to cancel leave request.');
  } finally {
    setIsCancelling(false);
  }
};
```

Modal markup:
```tsx
<Modal
  isOpen={!!cancelModalItem}
  onClose={() => setCancelModalItem(null)}
  title="Cancel Leave Request"
  description={`Release reserved time-off for ${cancelModalItem?.requestNumber}`}
  maxWidth="md"
>
  <div className="space-y-4">
    <div className="p-3 rounded-[7px] bg-subtle border border-rule text-xs space-y-1">
      <div className="flex justify-between">
        <span className="text-muted">Total Reserved Days:</span>
        <span className="font-bold font-mono-nums text-ink">{cancelModalItem?.totalDays} Working Days</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Duration:</span>
        <span className="font-mono-nums text-ink">{cancelModalItem?.startDate} &rarr; {cancelModalItem?.endDate}</span>
      </div>
    </div>

    <p className="text-xs text-muted">
      Cancelling this request will immediately release all reserved days back into your available leave quota.
    </p>

    <div className="space-y-1.5 text-left">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
        Reason for Cancellation (Optional)
      </label>
      <input
        type="text"
        value={cancelReason}
        onChange={(e) => setCancelReason(e.target.value)}
        placeholder="e.g. Shifted vacation dates, project deadline"
        className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      />
    </div>

    <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule">
      <Button variant="ghost" onClick={() => setCancelModalItem(null)}>
        Keep Request
      </Button>
      <Button variant="danger" onClick={handleConfirmCancel} isLoading={isCancelling}>
        Confirm Cancellation
      </Button>
    </div>
  </div>
</Modal>
```

---

### 4.4 Manager & Admin Approval Console (`LeaveApprovalPage.tsx`)

#### Scope & Query Parameter Invariants
- **Manager View**: `api.leaves.getRequests('team')`
  - Fetches leave requests assigned to the logged-in line manager (`assignedApproverId === user.profile.id`).
- **Admin View**: `api.leaves.getRequests('all')`
  - HR & System Admins can review all company leave filings.
  - Provide a scope toggle (`Team Queue` vs `All Enterprise Submissions`).

#### Review Modal with Balance Impact Feedback
```typescript
const [reviewModalItem, setReviewModalItem] = useState<LeaveRequest | null>(null);
const [employeeBalance, setEmployeeBalance] = useState<LeaveBalance | null>(null);
const [comment, setComment] = useState('');
const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
const [decisionError, setDecisionError] = useState<string | null>(null);

// Fetch employee's specific balance on modal open
useEffect(() => {
  if (!reviewModalItem) {
    setEmployeeBalance(null);
    return;
  }
  api.leaves.getBalances(reviewModalItem.employeeId)
    .then((bals) => {
      const match = bals.find((b) => b.leaveTypeId === reviewModalItem.leaveTypeId);
      setEmployeeBalance(match || null);
    })
    .catch(() => setEmployeeBalance(null));
}, [reviewModalItem]);

const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
  if (!reviewModalItem) return;
  setIsSubmittingDecision(true);
  setDecisionError(null);

  try {
    const updated = await api.leaves.reviewRequest(reviewModalItem.id, decision, comment);
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setReviewModalItem(null);
    setComment('');
  } catch (err: any) {
    setDecisionError(err.message || 'Failed to record decision.');
  } finally {
    setIsSubmittingDecision(false);
  }
};
```

Modal Body Render:
```tsx
<Modal
  isOpen={!!reviewModalItem}
  onClose={() => setReviewModalItem(null)}
  title="Review Leave Application"
  description={`Application Dossier: ${reviewModalItem?.requestNumber}`}
  maxWidth="lg"
>
  <div className="space-y-4">
    {decisionError && (
      <div className="p-3 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs">
        {decisionError}
      </div>
    )}

    {/* Staff Dossier Snapshot */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-[7px] bg-subtle border border-rule text-xs font-sans">
      <div>
        <span className="text-muted block text-[10px] uppercase font-semibold">Staff Member</span>
        <span className="font-semibold text-ink">{reviewModalItem?.employeeName || reviewModalItem?.employeeId}</span>
      </div>
      <div>
        <span className="text-muted block text-[10px] uppercase font-semibold">Category</span>
        <span className="font-semibold text-ink">{reviewModalItem?.leaveTypeId}</span>
      </div>
      <div>
        <span className="text-muted block text-[10px] uppercase font-semibold">Duration</span>
        <span className="font-mono-nums font-semibold text-ink">{reviewModalItem?.startDate} &rarr; {reviewModalItem?.endDate}</span>
      </div>
      <div>
        <span className="text-muted block text-[10px] uppercase font-semibold">Working Days</span>
        <span className="font-bold text-ink font-mono-nums">{reviewModalItem?.totalDays} Days</span>
      </div>
    </div>

    {/* Handover & Reason */}
    <div className="p-3.5 rounded-[7px] bg-subtle border border-rule text-xs">
      <span className="text-muted block text-[10px] uppercase font-semibold mb-1">Stated Reason</span>
      <p className="text-ink leading-relaxed">{reviewModalItem?.reason}</p>
    </div>

    {/* Balance Impact Calculation Feedback */}
    {employeeBalance && (
      <div className="p-3 rounded-[7px] bg-accent-soft text-brand text-xs border border-brand/20 space-y-1">
        <div className="font-semibold uppercase tracking-wider text-[10px]">Entitlement Ledger Impact</div>
        <div className="flex justify-between font-mono-nums">
          <span>Allocated: {employeeBalance.allocatedDays}d</span>
          <span>Used: {employeeBalance.usedDays}d</span>
          <span>Pending: {employeeBalance.pendingDays}d</span>
          <span className="font-bold">Available: {employeeBalance.availableDays}d</span>
        </div>
      </div>
    )}

    {/* Self-Approval Prohibition Warning */}
    {/* If currentUser.profile.id === reviewModalItem.employeeId, show warning */}
    
    {/* Manager Comment Box */}
    <div className="space-y-1.5 text-left">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
        Manager Comment / Decision Reason
      </label>
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Enter operational handover confirmation or reason for rejection..."
        className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      />
    </div>

    {/* Modal Actions */}
    <div className="flex items-center justify-between pt-3 border-t border-rule">
      <Button variant="ghost" onClick={() => setReviewModalItem(null)}>
        Dismiss
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          onClick={() => handleDecision('REJECT')}
          isLoading={isSubmittingDecision}
          leftIcon={<X className="w-4 h-4" />}
        >
          Reject Leave
        </Button>
        <Button
          variant="success"
          onClick={() => handleDecision('APPROVE')}
          isLoading={isSubmittingDecision}
          leftIcon={<Check className="w-4 h-4" />}
        >
          Approve Leave
        </Button>
      </div>
    </div>
  </div>
</Modal>
```

---

### 4.5 Staff Dashboard Integration (`StaffDashboardPage.tsx`)

1. **Annual Leave Metric Card**:
   - Fetch `api.leaves.getBalances()` on mount.
   - Extract `lt-annual` balance record:
     - Available Days count: `{annualBalance.availableDays}`
     - Denominator: `/ {annualBalance.allocatedDays} Days Available`
     - Progress bar fill: `width: ${(annualBalance.availableDays / annualBalance.allocatedDays) * 100}%`
     - Subtitle: `{annualBalance.pendingDays} days pending approval`
2. **Upcoming Statutory Public Holidays Widget**:
   - Static or fetched array of Nigerian 2026 gazetted public holidays:
     - New Year's Day (`2026-01-01`)
     - Eid al-Fitr (`2026-03-20`, `2026-03-21`)
     - Good Friday (`2026-04-03`)
     - Easter Monday (`2026-04-06`)
     - Workers' Day (`2026-05-01`)
     - Eid al-Kabir (`2026-05-27`, `2026-05-28`)
     - Democracy Day (`2026-06-12`)
     - Independence Day (`2026-10-01`)
     - Christmas Day (`2026-12-25`)
     - Boxing Day (`2026-12-28`)
   - Calculate next upcoming holiday relative to current date and display in a card:
     - e.g., "Next Statutory Holiday: Workers' Day (May 01, 2026) — Public Holiday".
3. **Recent Leave Submissions Stream**:
   - Fetch `api.leaves.getRequests('mine')`.
   - Display the 3 most recent requests with real statuses (`SUBMITTED`, `APPROVED`, `REJECTED`).

---

## 5. Design System Invariants & Token Conformance Checklist

| Token Element | Light Mode | Dark Mode | CSS Variable / Utility |
|---|---|---|---|
| Canvas Background | `#F7F8FA` | `#0D1624` | `bg-canvas`, `--nx-canvas` |
| Surface Background | `#FFFFFF` | `#121E2E` | `bg-surface`, `--nx-surface` |
| Subtle Element | `#EDF2F6` | `#192A3E` | `bg-subtle`, `--nx-subtle` |
| Primary Ink (Text) | `#101E30` | `#F3F6FA` | `text-ink`, `--nx-ink` |
| Muted Text | `#526174` | `#B3BFD0` | `text-muted`, `--nx-muted` |
| Border Rule | `#DCE3EB` | `#34475D` | `border-rule`, `--nx-rule` |
| Sapphire Action Button | `#0D51B2` | `#0D51B2` | `bg-action`, hover: `bg-action-hover` (`#093F8D`) |
| Emerald Status (Success) | `#007B58` | `#69D3B0` | `bg-success`, `text-[#007B58]` / `text-[#69D3B0]` |
| Danger Status | `#B52F38` | `#FFACA9` | `bg-danger`, `text-[#B52F38]` / `text-[#FFACA9]` |
| Warning Status | `#865600` | `#F3CE87` | `bg-warning`, `text-[#865600]` / `text-[#F3CE87]` |
| Control Radius | `7px` | `7px` | `rounded-[7px]`, `--nx-radius-control` |
| Card Radius | `12px` | `12px` | `rounded-[12px]`, `--nx-radius-card` |
| Typography: Display | Bricolage Grotesque | Bricolage Grotesque | `font-display` |
| Typography: Body & Tables | Instrument Sans / DM Sans | Instrument Sans / DM Sans | `font-sans`, numbers `font-mono-nums` |
| Motion Easing Curve | `cubic-bezier(0.22, 1, 0.36, 1)` | `cubic-bezier(0.22, 1, 0.36, 1)` | `--nx-ease` |

---

## 6. Implementation Action Plan for `worker_m3`

1. **Step 1: Create Client API Helper**
   - File: `update/src/lib/api.ts`
   - File: `update/src/lib/leaveTypes.ts`
   - Implements fetch wrapper with `credentials: 'include'` and methods for `getBalances`, `calculateDays`, `getRequests`, `submitRequest`, `cancelRequest`, `reviewRequest`.
2. **Step 2: Upgrade `StaffLeavePage.tsx`**
   - Connect to `api.leaves.getBalances()` and render 6 live leave balance cards with progress bars.
   - Connect Drawer date inputs to `api.leaves.calculateDays(startDate, endDate, isHalfDay)` with debounce and render Nigerian holiday badges and overdraft warnings.
   - Connect form submission to `api.leaves.submitRequest(...)` with error toasts.
   - Implement `Tabs` (`all`, `pending`, `approved`, `rejected`) on request history table.
   - Implement Cancellation `Modal` with `api.leaves.cancelRequest(...)`.
3. **Step 3: Upgrade `LeaveApprovalPage.tsx`**
   - Connect to `api.leaves.getRequests('team')` (or `'all'` for admins).
   - Implement `Modal` for reviewing requests with employee balance impact feedback and comments textarea.
   - Enforce self-approval guard (disable approval if request belongs to current manager).
   - Connect approve/reject buttons to `api.leaves.reviewRequest(...)`.
4. **Step 4: Upgrade `StaffDashboardPage.tsx`**
   - Connect Annual Leave balance card to live data.
   - Connect Recent Leave Submissions list to live requests.
   - Add Upcoming Statutory Public Holidays widget.
5. **Step 5: Verification & Layout Compliance**
   - Verify zero loose files in `update/src/components/`.
   - Run Vite build (`npm run build`) to ensure TypeScript compilation.
   - Run test suite (`npm run test`) to ensure all boundary, feature, and workflow tests pass 100%.
