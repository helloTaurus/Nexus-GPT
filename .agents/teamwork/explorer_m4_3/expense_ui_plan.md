# Comprehensive Frontend Expense Portal & Approval UI Implementation Plan

## 1. Executive Summary & Problem Scope

### 1.1 Objective
Deliver a production-grade, zero-trust, enterprise-ready frontend architecture for the **Expense Reimbursement & Receipt Management Suite (Milestone M4)**. This specification covers:
1. **Employee Expense Portal (`StaffExpensesPage.tsx`)**: Self-service filing of multi-item expense reports, real-time corporate policy validation, file upload dropzone for magic-byte verified receipts, and real-time lifecycle tracking.
2. **Management & Finance Approval Portal (`ExpenseApprovalPage.tsx`)**: Multi-tier review queue (Line Manager &rarr; Department Head &rarr; Financial Controller), receipt inspection drawer/modal, self-approval prohibition, and NIBSS-compliant disbursement execution.
3. **API Client & Type Definitions (`api.ts` & `expenseTypes.ts`)**: Strongly-typed request/response models, binary receipt streaming, error sanitization, and seamless integration with existing auth sessions.
4. **Design System & Motion Compliance**: Strict adherence to Nexus sapphire `#0D51B2`, emerald `#007B58`, 7px control radius, 12px card radius, `Bricolage Grotesque` and `DM Sans` typography, `--nx-ease` motion curves, and 0 loose files in `update/src/components/` root.

---

### 1.2 Current State vs. Target State Gap Analysis

| Aspect | Current Implementation | Target Production State |
| :--- | :--- | :--- |
| **Data Source** | Hardcoded mock array in `useState` with simulated `setTimeout` | Real async fetch from `/api/v1/expenses/reports`, `/api/v1/expenses/categories`, and `/api/v1/portal/profile` with fallback resilience |
| **Claim Model** | Flat, single-expense form (1 category, 1 amount, 1 merchant) | **Multi-item Expense Reports**: Header (`title`, `purpose`, `currency`) + itemized array (`items: ExpenseItemRecord[]`) matching backend |
| **Receipt Handling** | Static visual box without click/drag handlers or network upload | Interactive dropzone: client magic-byte pre-check, size guard (<= 10MB), binary streaming to `POST /api/v1/expenses/upload-receipt`, preview badge |
| **Policy Enforcement** | None (submits any amount without receipt or ceiling validation) | Real-time warnings: mandatory receipt > ₦5,000, category ceiling check, weekend/holiday warning, multi-tier escalation notice (> ₦50,000) |
| **Approval Flow** | Linear state cycling on click (`handleAdvanceState`) | Multi-tier RBAC workflow: Line Manager (`APPROVE` / `REJECT` / `REQUEST_REVISION`), Dept Head escalation, Finance Disbursal modal |
| **Self-Approval Guard**| None (user can click approve on any item) | Strict check (`report.employeeId === currentUserId`) disabling action with explicit security callout |
| **Receipt Inspection** | None (receipt modal state exists but never opens or renders content) | High-fidelity slide-over Drawer with item breakdown, zoomable image preview (PNG/JPEG) and embedded PDF viewer |
| **Bank Rail Integration**| Static text "Guaranty Trust Bank / 0142998812" | Dynamically populated from `api.profile.get()` displaying employee's verified NUBAN bank rail and account name |

---

## 2. Type System Specification (`update/src/lib/expenseTypes.ts`)

A dedicated type definition file must be created at `update/src/lib/expenseTypes.ts` to mirror backend records and maintain separation of concerns.

```typescript
/**
 * Expense Categories seeded in corporate policy
 */
export type ExpenseCategoryId =
  | 'cat-trav'    // Travel & Mileage (Ceiling: 200,000 NGN)
  | 'cat-hosp'    // Client Hospitality & Sales (Ceiling: 150,000 NGN)
  | 'cat-office'  // Office Supplies & Stationeries (Ceiling: 50,000 NGN)
  | 'cat-telco'   // Internet & Telecommunications (Ceiling: 30,000 NGN)
  | 'cat-train'   // Training & Professional Development (Ceiling: 500,000 NGN)
  | 'cat-ops';    // Branch Petty Operations (Ceiling: 100,000 NGN)

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  maxSingleLimit: number;
  receiptRequired: boolean;
  receiptThreshold: number; // 5000 NGN
}

/**
 * Line item inside an expense report
 */
export interface ExpenseItemRecord {
  id: string;
  categoryId: string;
  categoryName?: string;
  dateIncurred: string; // YYYY-MM-DD
  merchantName: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptFileName?: string;
}

export interface ExpenseItemInput {
  categoryId: string;
  dateIncurred: string;
  merchantName: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptFileName?: string;
}

/**
 * Multi-tier workflow status
 */
export type ExpenseReportStatus =
  | 'SUBMITTED'
  | 'PENDING_LINE_MANAGER'
  | 'PENDING_DEPT_HEAD'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'REVISION_REQUESTED';

export interface ExpenseReportRecord {
  id: string;
  reportNumber: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  title: string;
  purpose: string;
  currency: string; // 'NGN'
  totalAmount: number;
  status: ExpenseReportStatus;
  items: ExpenseItemRecord[];
  submittedAt: string;
  approvedAt?: string;
  paidAt?: string;
  disbursementReference?: string;
  currentApproverId?: string;
  rejectionReason?: string;
}

export interface CreateExpenseReportPayload {
  title: string;
  purpose?: string;
  currency?: string;
  items: ExpenseItemInput[];
}

export interface UpdateExpenseReportPayload {
  title?: string;
  purpose?: string;
  items?: ExpenseItemInput[];
}

export interface ReceiptUploadResponse {
  success: boolean;
  fileUrl: string;
  receiptUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DisburseExpensePayload {
  disbursementReference: string;
  paidDate?: string;
}
```

---

## 3. API Client Integration (`update/src/lib/api.ts`)

Update `update/src/lib/api.ts` to export an `expenses` sub-namespace.

### 3.1 Binary Upload Implementation
The Express backend configures `express.raw({ limit: '10mb', type: (req) => !isJson(req) })`.
When uploading files, the client transmits raw binary `ArrayBuffer` with the exact MIME type (`image/png`, `image/jpeg`, `application/pdf`), matching what `uploadReceiptHandler` expects:

```typescript
// Add to update/src/lib/api.ts:
expenses: {
  // Retrieve expense category master list with ceilings and thresholds
  getCategories: (): Promise<ExpenseCategory[]> =>
    request<ExpenseCategory[]>('/expenses/categories'),

  // Raw binary upload with magic-byte pre-validation
  uploadReceipt: async (file: File): Promise<ReceiptUploadResponse> => {
    const url = `${API_BASE}/expenses/upload-receipt`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
      credentials: 'include', // transmits HttpOnly session cookie
    });

    const body = await response.json().catch(() => ({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Failed to parse receipt upload response' },
    }));

    if (!response.ok || body.success === false) {
      const error = body.error || { code: 'UPLOAD_FAILED', message: response.statusText };
      throw new ApiError(error.message, error.code, response.status, error.correlationId);
    }

    return body;
  },

  // List reports with scope: 'mine' (staff), 'team' (manager), or 'all' (admin)
  getReports: (scope: 'mine' | 'team' | 'all' = 'mine'): Promise<ExpenseReportRecord[]> =>
    request<ExpenseReportRecord[]>(`/expenses/reports?scope=${scope}`),

  // Retrieve single report details
  getReportById: (id: string): Promise<ExpenseReportRecord> =>
    request<ExpenseReportRecord>(`/expenses/reports/${id}`),

  // Submit new multi-item expense report
  submitReport: (payload: CreateExpenseReportPayload): Promise<ExpenseReportRecord> =>
    request<ExpenseReportRecord>('/expenses/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Edit / resubmit report (e.g. after revision requested)
  updateReport: (id: string, payload: UpdateExpenseReportPayload): Promise<ExpenseReportRecord> =>
    request<ExpenseReportRecord>(`/expenses/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Review report: Approve, Reject, or Request Revision
  reviewReport: (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION',
    comments?: string
  ): Promise<ExpenseReportRecord> =>
    request<ExpenseReportRecord>(`/expenses/reports/${id}/action`, {
      method: 'PATCH',
      body: JSON.stringify({ action, comments }),
    }),

  // Disburse approved report (Admin / Finance role only)
  disburseReport: (
    id: string,
    payload: DisburseExpensePayload
  ): Promise<ExpenseReportRecord> =>
    request<ExpenseReportRecord>(`/expenses/reports/${id}/disburse`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
```

---

## 4. Staff Expense Portal Specification (`StaffExpensesPage.tsx`)

### 4.1 Page Layout & Information Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│ StaffExpensesPage (PortalLayout)                                       │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Header: Title, Description, [ + File New Expense Claim ] Button    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│ │ Total Reimbursed │  │ Pending Pipeline │  │ Disbursal Bank Rail  │ │
│ │ ₦485,000.00      │  │ ₦45,000.00       │  │ Zenith Bank (NUBAN)  │ │
│ │ 3 Claims Settled │  │ 1 Under Review   │  │ Direct NIBSS ACH     │ │
│ └──────────────────┘  └──────────────────┘  └──────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Filing History & Pipeline Status (Card)                            │ │
│ │ [ Tabs: All (4) | Pending (1) | Approved (1) | Paid (2) ]          │ │
│ │ ────────────────────────────────────────────────────────────────── │ │
│ │ Table: Claim ID | Purpose | Items | Date | Amount | Stage | Action │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Dynamic KPI Calculations
1. **Total Reimbursed YTD**: Sum of `totalAmount` for all reports where `status === 'PAID'`.
2. **Pending Approval Queue**: Sum of `totalAmount` for reports where `status` is in `['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD']`.
3. **Disbursal Bank Rail**: Retrieved live from `api.profile.get()`, rendering:
   - Bank Name (e.g. `Zenith Bank`, `Guaranty Trust Bank`)
   - NUBAN Account Number (masked: `***1234` or full 10-digit)
   - Account Name (verified matching employee name)

### 4.3 Multi-Item Expense Filing Drawer (`Drawer`)
The drawer slides in from the right (`width: max-w-xl` on desktop). It includes:
1. **Report Header Section**:
   - `Report Title` (e.g., "Kano Regional Command Audit Transit & Logistics")
   - `Business Purpose / Justification` (e.g., "Field audit of credit facilities in Kano State")
2. **Line Items Repeater**:
   - Item Card with index badge (`Item #1`, `Item #2`).
   - `Category Select`: Populated dynamically from `api.expenses.getCategories()`.
   - `Date Incurred`: `<input type="date" />`.
   - `Merchant / Vendor`: Text input (e.g., "Air Peace Nigeria", "Transcorp Hilton").
   - `Amount (₦)`: Tabular number input with live subtotaling.
   - `Business Description`: Notes on operational necessity.
   - `Receipt Dropzone`:
     - File input supporting `.pdf`, `.png`, `.jpg`, `.jpeg`.
     - Drag-and-drop state (`isDragging`).
     - Progress spinner during upload.
     - Uploaded state displaying: File icon, filename, file size in KB, and delete button.
   - `Remove Item` button (visible when items count > 1).
3. **"Add Another Line Item" Button**:
   - Outlined button with `Plus` icon to append a new item row.
4. **Summary & Escalation Callout Bar**:
   - Live Total Claim Amount: `₦{sum.toLocaleString()}.00`.
   - Escalation Flag: If total > ₦50,000, display an informational banner:
     *"Claims exceeding ₦50,000.00 require secondary escalation to your Department Head."*
5. **Drawer Actions**:
   - `Cancel` button (closes drawer, resets state or confirms discard).
   - `Submit for Manager Review` button (primary action with spinner).

---

## 5. Policy Rules & Violation Warning System

The frontend must provide immediate, deterministic feedback before network round-trips:

### 5.1 Rules Matrix

| Rule ID | Policy Constraint | Trigger Condition | Visual UI Feedback | Enforcement Level |
| :--- | :--- | :--- | :--- | :--- |
| **POL-01** | Mandatory Receipt Threshold | Line item `amount > 5,000 NGN` and `!receiptUrl` | Amber callout banner on the item: *"Receipt mandatory for claims > ₦5,000.00"* | **Blocking**: Submit button disabled with tooltip explanation |
| **POL-02** | Category Single Limit | Line item `amount > category.maxSingleLimit` | Red error text: *"Exceeds category ceiling of ₦{limit.toLocaleString()}.00"* | **Blocking**: Form validation error halts submission |
| **POL-03** | Zero or Negative Amount | Line item `amount <= 0` or NaN | Red input outline and error message: *"Amount must be greater than zero"* | **Blocking**: Cannot submit non-positive amounts |
| **POL-04** | Weekend / Gazetted Holiday | `dateIncurred` is Sat/Sun or matches `SEED_NIGERIAN_HOLIDAYS_2026` | Blue info badge: *"Incurred on weekend/holiday. Ensure justification is detailed."* | **Advisory (Soft)**: Allows submission with warning |
| **POL-05** | Multi-Tier Escalation | Total report amount `> 50,000 NGN` | Informational banner in drawer summary: *"Requires Department Head review tier"* | **Advisory**: Explains workflow path to user |
| **POL-06** | Magic-Byte MIME Validation | File uploaded does not match PNG/JPEG/PDF headers | Error toast: *"Unsupported format. Only PNG, JPEG, and PDF are permitted."* | **Blocking**: File rejected before sending |
| **POL-07** | 10MB File Size Limit | Uploaded file size `> 10 * 1024 * 1024` bytes | Error message: *"File exceeds maximum 10MB limit"* | **Blocking**: Prevents 413 error |

---

## 6. Management & Finance Approval UI Specification (`ExpenseApprovalPage.tsx`)

### 6.1 Review Queue Layout & Scope Toggling
1. **Scope Toggle & Tab Filter**:
   - Segmented control / Tabs:
     - `Team Claims Queue` (`scope=team`, default for Managers).
     - `All Corporate Claims` (`scope=all`, visible for Admins / Finance Controllers).
   - Status sub-filters:
     - `Action Required` (`status === 'SUBMITTED' | 'PENDING_DEPT_HEAD' | 'APPROVED'`).
     - `Under Review` (`status === 'PENDING_DEPT_HEAD'`).
     - `Ready for Disbursal` (`status === 'APPROVED'`).
     - `Disbursed & Closed` (`status === 'PAID'`).
     - `Rejected` (`status === 'REJECTED'`).

### 6.2 Table Columns
- **Claim ID & Report Number**: e.g., `EXP-2026-0089` (tabular numerals, bold).
- **Staff Member**: Name, Staff ID, and Department.
- **Claim Purpose & Title**: Primary expenditure goal.
- **Item Count & Categories**: e.g. "3 items (Travel, Meals)".
- **Date Submitted**: Formatted date.
- **Total Amount**: Formatted NGN (e.g., `₦85,000.00`).
- **Workflow Lifecycle Badge**:
  - `SUBMITTED`: Badge variant `pending` ("1. Line Manager Review").
  - `PENDING_DEPT_HEAD`: Badge variant `pending` ("2. Dept Head Sign-Off").
  - `APPROVED`: Badge variant `brand` ("3. Ready for Disbursal").
  - `PAID`: Badge variant `approved` ("4. Disbursed via NIBSS").
  - `REJECTED`: Badge variant `rejected` ("Rejected").
  - `REVISION_REQUESTED`: Badge variant `draft` ("Revision Requested").
- **Actions**:
  - `Inspect / Review` button (Eye icon).
  - Quick action buttons based on user role and claim state.

### 6.3 Self-Approval Prohibition Guard (OWASP / SEI CERT)
If `claim.employeeId === currentUserId`:
- Review action buttons are disabled.
- An alert badge is displayed:
  *"Self-Approval Prohibited: You cannot review or disburse your own expense claim."*

### 6.4 Receipt & Breakdown Inspection Drawer (`Drawer`)
Clicking on any claim opens an Inspection Drawer containing:
1. **Claim Header**: Report Number, Employee Profile, Date Submitted, Current Lifecycle Stage.
2. **Itemized Table**:
   - Category, Date, Merchant, Amount, Description.
   - Attached Receipt thumbnail with "View Receipt" button.
3. **Interactive Receipt Viewer Component**:
   - For images (PNG/JPEG): Modal or side-panel image display with zoom controls.
   - For PDFs: Embedded PDF viewer or direct secure preview link.
4. **Approval Action Toolbar**:
   - `Approve`: Triggers Approval Confirmation Modal.
   - `Request Revision`: Triggers Revision Feedback Modal (prompting for comments).
   - `Reject`: Triggers Rejection Modal (requires explicit reason).
   - `Disburse`: Active only for Admin / Finance role when status is `APPROVED`.

### 6.5 Approval, Rejection & Revision Modals
1. **Approval Modal**:
   - Displays claim summary.
   - Note indicating if this approval completes the review or escalates to Dept Head (> ₦50k).
   - Optional reviewer comments.
2. **Rejection Modal**:
   - Mandatory textarea: "Reason for Rejection".
   - Confirm Reject button (`variant="danger"`).
3. **Request Revision Modal**:
   - Mandatory textarea: "Changes requested from employee".
   - Confirm button (`variant="secondary"`).
4. **Finance Disbursal Modal (`Modal maxWidth="lg"`)**:
   - Only accessible when `status === 'APPROVED'`.
   - Employee Beneficiary Details:
     - Employee Name: e.g., "Oluwaseun Bakare"
     - Bank Name: e.g., "United Bank for Africa"
     - NUBAN Account: `2087654321`
   - Disbursal Reference Input: Pre-filled with `NIBSS-ACH-${Date.now().toString().slice(-6)}` or editable.
   - Paid Date: Defaults to current date (`YYYY-MM-DD`).
   - "Execute NIBSS Disbursal" button (`variant="success"`).

---

## 7. Design System & Motion Specification

### 7.1 Visual Tokens Alignment
- **Backgrounds**: Canvas `var(--nx-canvas)` (`#0D1624` dark, `#F7F8FA` light), Surface `var(--nx-surface)` (`#121E2E` dark, `#FFFFFF` light), Subtle `var(--nx-subtle)` (`#192A3E` dark, `#EDF2F6` light).
- **Actions & Brand**: Action `var(--nx-button)` (`#0D51B2`), Action Hover `var(--nx-button-hover)` (`#093F8D`), Brand Blue `var(--nx-blue)` (`#8AB8FF` dark, `#0D51B2` light).
- **Status Accents**:
  - Settled / Approved: Emerald `#007B58` (light) / `#69D3B0` (dark).
  - Pending / Warning: Amber `#865600` (light) / `#F3CE87` (dark).
  - Rejected / Danger: Crimson `#B52F38` (light) / `#FFACA9` (dark).
- **Radii**: Controls `rounded-[7px]`, Cards/Modals `rounded-[12px]`.
- **Typography**: Headings use `font-display` (`Bricolage Grotesque`), Body text uses `font-sans` (`DM Sans` / `Instrument Sans`), Financial amounts use `font-mono-nums tabular-nums`.

### 7.2 Motion & Micro-Interactions
- Motion curves: `transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}` (`--nx-ease`).
- Drawer sheet slide-in from right: `initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}`.
- Modal dialog scale-fade: `initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}`.
- Table rows hover feedback: `hover:bg-subtle/50 transition-colors`.
- Loading states: Replaced with `<Skeleton />` pulse loaders to prevent content layout shifts.

### 7.3 Component Hygiene
- Zero loose files in `update/src/components/` root.
- All new reusable subcomponents (if needed) placed in `update/src/components/features/` or `update/src/components/ui/`.

---

## 8. Detailed Implementation Roadmap

### Phase 1: Domain Types & API Client Extension
1. Create `update/src/lib/expenseTypes.ts` with all models, enums, payloads, and interfaces.
2. Extend `update/src/lib/api.ts` with `api.expenses` methods (`getCategories`, `uploadReceipt`, `getReports`, `getReportById`, `submitReport`, `updateReport`, `reviewReport`, `disburseReport`).

### Phase 2: Employee Expense Portal (`StaffExpensesPage.tsx`)
1. Implement async state hooks (`isLoading`, `reports`, `categories`, `userProfile`, `activeTab`).
2. Add multi-item filing state (`items: ExpenseItemInput[]`, `title`, `purpose`).
3. Build the receipt upload dropzone with client magic-byte validation and progress indicator.
4. Integrate real-time policy rules: > ₦5k receipt requirement, category ceilings, weekend/holiday warnings.
5. Connect dynamic KPI strip to verified profile bank details and settled claims totals.
6. Connect `handleSubmit` to `api.expenses.submitReport()`.

### Phase 3: Approval & Disbursal Portal (`ExpenseApprovalPage.tsx`)
1. Implement scope toggling (`scope=team` vs `scope=all`) and status filtering tabs.
2. Wire real report fetching via `api.expenses.getReports(scope)`.
3. Implement self-approval prohibition check against current user session (`api.auth.me()`).
4. Build Receipt Inspection Drawer with zoomable image and PDF viewer.
5. Implement Action Modals:
   - Manager/Dept Head Approval modal.
   - Rejection modal with mandatory comment.
   - Revision request modal.
   - Finance Disbursal modal with NIBSS reference input and beneficiary bank summary.
6. Wire review actions to `api.expenses.reviewReport()` and `api.expenses.disburseReport()`.

### Phase 4: Verification & E2E Alignment
1. Verify TypeScript compiles without errors.
2. Verify visual token compliance (7px/12px radii, sapphire/emerald colors, font pairings).
3. Test against end-to-end scenarios (Tiers 1-4).
