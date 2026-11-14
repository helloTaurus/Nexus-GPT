# Nexus Finance — Milestone 5: Appraisal & Admin UI Portal Specification & Plan

**Document Version**: 1.0.0  
**Author**: `explorer_m5_3_r2` (Milestone 5 Exploration Subagent)  
**Target Milestone**: Milestone 5: Performance Appraisals & Administrative Management (Features 10, 11, 16, 17, 18, 19, 20, 21)  
**Parent Agent**: `f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`  
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_3_r2`

---

## 1. Executive Summary & Problem Boundary

Milestone 5 completes the core enterprise capabilities of Nexus Finance (replicating Zoho People) by delivering:
1. **Staff Performance Appraisals** (`/portal/appraisals`): Self-review against 70/30 weighted KRA and Competency rubrics, 5-point rating scales, real-time score calculation preview, and outcome acknowledgment.
2. **Appraisal Calibration Grid & Executive Governance** (`/admin/appraisals`): Multi-tier distribution metrics, bell-curve comparison (Actual vs Target), direct reports appraisal queue for managers, administrative score calibration, and cycle scheduling.
3. **Workforce Directory & Administrative RBAC** (`/admin/employees`): Searchable and filterable employee directory, department pill filters, card/table view toggle, interactive organizational hierarchy tree view, employee provisioning, role assignment, and account status control.
4. **DevSecOps Immutable Security Audit Logs** (`/admin/audit-logs`): Tabular ledger of SHA-256 Merkle-linked audit records, multi-parameter filtering, cryptographic chain inspection drawer, and live cryptographic ledger integrity verification badge.

This document establishes the exhaustive architecture, client API additions, domain type definitions, component hierarchy, interactive state specifications, and verification strategies required for the implementer agent.

---

## 2. Existing Implementations Gap Analysis

Detailed line-by-line inspection of current files in `update/src/pages/` revealed significant architectural and feature gaps:

| Page / File | Current Implementation Status | Identified Deficits & Required Additions |
| :--- | :--- | :--- |
| **`StaffAppraisalsPage.tsx`** (Lines 1–167) | Static mock state (`ratings`, `selfComments`, `isSaved`). Hardcoded 4 KRAs. Static 4-stage bar. | **1.** No real API integration (`GET /appraisals/submissions/me`, `PUT /appraisals/submissions/:id/self`, `POST /appraisals/submissions/:id/acknowledge`).<br>**2.** Missing Competency evaluation cards (only KRAs are present, violating the 70/30 institutional score model).<br>**3.** No live 70/30 composite score preview with formula visualization.<br>**4.** No 5-point rating rubric indicator badges (1=Unsatisfactory to 5=Outstanding).<br>**5.** Static stepper bar does not react to submission status (`NOT_STARTED` -> `SELF_SUBMITTED` -> `CALIBRATION_PENDING` -> `COMPLETED`).<br>**6.** Missing manager feedback and calibrated outcome view when appraisal is finalized. |
| **`AppraisalCalibrationPage.tsx`** (Lines 1–85) | Minimal 85 lines. Only 4 static summary cards (Tiers 1–4) and static circular text. | **1.** No interactive distribution chart / bell-curve comparing Actual Headcount % vs Target Allocation %.<br>**2.** No employee submissions table for managers and calibration committee (`GET /appraisals/submissions/team`).<br>**3.** Missing Calibration Drawer/Modal to view employee ratings, manager scores, and input final calibrated score (`POST /appraisals/submissions/:id/calibrate`).<br>**4.** No cycle scheduling / creation drawer (`POST /appraisals/cycles`).<br>**5.** No CSV scorecard export functionality. |
| **`EmployeeDirectoryPage.tsx`** (Lines 1–343) | Hardcoded array of 6 employees in local state. Table view only. Basic text search & select dropdown. | **1.** Not connected to real backend API (`GET /employees`, `POST /employees`, `PATCH /employees/:id`).<br>**2.** Missing Department quick-filter pills (only a native `<select>` exists).<br>**3.** Missing Card Grid View toggle (table only).<br>**4.** Missing Org Chart Hierarchy Tree View toggle.<br>**5.** Edit Employee modal is non-functional (pencil icon has empty handler).<br>**6.** No account deactivation / status toggling (`PATCH /employees/:id` with `status: 'INACTIVE'`).<br>**7.** No pagination controls. |
| **`AuditLogsPage.tsx`** (Lines 1–157) | Hardcoded array of 5 log entries. Simple action filter. Table view only. | **1.** Not connected to real backend API (`GET /admin/audit-logs`).<br>**2.** Missing Live Cryptographic Merkle / Hash Chain Integrity status badge.<br>**3.** Missing "Run Tamper Audit" verification button with live status indicator.<br>**4.** Missing full text search (actor email, IP, target resource) and severity level filters.<br>**5.** Missing cryptographic inspection drawer to view full `stateDiff` JSON, SHA-256 block hash, and `previousHash` linkage. |
| **`api.ts`** (Lines 1–218) | Contains profile, leaves, auth, and expenses endpoints. | **Completely lacks `appraisals`, `employees` (workforce), and `auditLogs` endpoint bindings.** |
| **Domain Types** (`src/lib/`) | Only `leaveTypes.ts` and `expenseTypes.ts` exist. | **`appraisalTypes.ts` and `workforceTypes.ts` do not exist yet and must be created.** |

---

## 3. Design System & Token Specifications

All M5 UI components must strictly adhere to the project's design tokens and geometric rules defined in `DESIGN-SYSTEM.md`, `nexus-tokens.css`, and `nexus-system.css`:

```css
/* Color Palette */
--nx-button: #0D51B2;          /* Sapphire Action Primary */
--nx-button-hover: #093F8D;    /* Sapphire Hover */
--nx-green: #007B58;           /* Emerald Positive Status (Light) */
--nx-green-dark: #69D3B0;      /* Emerald Positive Status (Dark) */
--nx-canvas: #F7F8FA / #0D1624;
--nx-surface: #FFFFFF / #121E2E;
--nx-subtle: #EDF2F6 / #192A3E;
--nx-ink: #101E30 / #F3F6FA;
--nx-muted: #526174 / #B3BFD0;
--nx-rule: #DCE3EB / #34475D;
--nx-accent-soft: #EAF1FC / #1B304B;
--nx-warning: #865600 / #F3CE87;
--nx-danger: #B52F38 / #FFACA9;

/* Geometry & Radii */
--nx-radius-control: 7px;      /* Strictly 7px on all buttons, inputs, selects, pills */
--nx-radius-card: 12px;        /* Strictly 12px on all cards, panels, modals */

/* Motion System */
--nx-ease: cubic-bezier(0.22, 1, 0.36, 1);
/* Button Micro-interaction */
whileHover={{ scale: 1.015 }}
whileTap={{ scale: 0.985 }}
transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}

/* Typography */
Heading: "Bricolage Grotesque", sans-serif (class: font-display)
Body/Controls: "Instrument Sans", "DM Sans", sans-serif (class: font-sans)
Numbers & Monies: Tabular Numerals (class: font-mono-nums)
```

---

## 4. Domain Type Architecture

### 4.1 Appraisal Types (`update/src/lib/appraisalTypes.ts`)

```typescript
export type AppraisalStatus =
  | 'NOT_STARTED'
  | 'SELF_SUBMITTED'
  | 'CALIBRATION_PENDING'
  | 'COMPLETED';

export type AppraisalCycleStatus =
  | 'ACTIVE'
  | 'CALIBRATION'
  | 'COMPLETED'
  | 'CLOSED';

export type GoalCategory = 'KRA' | 'COMPETENCY';

export interface AppraisalGoal {
  goalId: string;
  title: string;
  description?: string;
  weightage: number; // e.g. 25 = 25% within category
  category?: GoalCategory;
  selfRating?: number; // 1.00 - 5.00
  selfComments?: string;
  managerRating?: number; // 1.00 - 5.00
  managerComments?: string;
}

export interface AppraisalSubmission {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
  designation?: string;
  managerId: string;
  managerName?: string;
  status: AppraisalStatus;
  selfScore?: number; // Calculated weighted score (1.00 - 5.00)
  managerScore?: number; // 70% KRA + 30% Competency (1.00 - 5.00)
  finalCalibratedScore?: number; // Committee calibrated score (1.00 - 5.00)
  employeeComments?: string;
  managerSummaryFeedback?: string;
  calibrationNotes?: string;
  acknowledgedAt?: string;
  goals: AppraisalGoal[];
}

export interface AppraisalCycle {
  id: string;
  title: string;
  cycleType: 'ANNUAL' | 'MID_YEAR' | 'PROBATION';
  fiscalYear: number;
  startDate: string;
  endDate: string;
  selfAppraisalDeadline: string;
  managerReviewDeadline: string;
  kraWeightagePercent?: number; // Default 70
  competencyWeightagePercent?: number; // Default 30
  status: AppraisalCycleStatus;
}

export interface SubmitSelfAppraisalPayload {
  goals: Array<{
    goalId: string;
    selfRating: number;
    selfComments?: string;
  }>;
  employeeComments?: string;
}

export interface SubmitManagerReviewPayload {
  goals: Array<{
    goalId: string;
    managerRating: number;
    managerComments?: string;
  }>;
  competencyScore?: number;
  managerSummaryFeedback?: string;
}

export interface CalibrateScorePayload {
  finalCalibratedScore: number;
  calibrationNotes?: string;
}

export interface CreateCyclePayload {
  title: string;
  cycleType: 'ANNUAL' | 'MID_YEAR' | 'PROBATION';
  fiscalYear: number;
  startDate: string;
  endDate: string;
  selfAppraisalDeadline: string;
  managerReviewDeadline: string;
  kraWeightagePercent?: number;
  competencyWeightagePercent?: number;
}

export interface RatingRubricTier {
  score: number;
  label: string;
  description: string;
  badgeVariant: 'rejected' | 'pending' | 'neutral' | 'brand' | 'approved';
}

export const RATING_RUBRIC_TIERS: RatingRubricTier[] = [
  {
    score: 1,
    label: 'Unsatisfactory',
    description: 'Consistently misses core SLAs and performance benchmarks.',
    badgeVariant: 'rejected',
  },
  {
    score: 2,
    label: 'Needs Improvement',
    description: 'Partially achieves commitments; requires targeted developmental coaching.',
    badgeVariant: 'pending',
  },
  {
    score: 3,
    label: 'Meets Expectations',
    description: 'Consistently delivers high-quality output aligned with institutional standards.',
    badgeVariant: 'neutral',
  },
  {
    score: 4,
    label: 'Exceeds Expectations',
    description: 'Surpasses targets, drives process efficiency, and demonstrates leadership.',
    badgeVariant: 'brand',
  },
  {
    score: 5,
    label: 'Outstanding',
    description: 'Exceptional institutional contributor; role model in innovation and underwriting.',
    badgeVariant: 'approved',
  },
];
```

---

### 4.2 Workforce & Administrative Types (`update/src/lib/workforceTypes.ts`)

```typescript
export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'TERMINATED';
export type EmploymentType = 'FULL_TIME' | 'CONTRACT' | 'PROBATION' | 'INTERN';

export interface EmployeeSummary {
  id: string; // emp-xxx
  userId?: string; // usr-xxx
  staffId: string; // NX-EMP-xxxx
  firstName: string;
  lastName: string;
  name?: string; // Derived firstName + lastName
  email?: string;
  phone?: string;
  departmentId: string;
  department: string;
  designationId: string;
  designation: string;
  managerId: string | null;
  managerName?: string;
  role: UserRole;
  status: UserStatus;
  hireDate: string;
  avatarUrl?: string;
}

export interface PaginatedEmployeesResponse {
  data: EmployeeSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface EmployeeQueryParams {
  search?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  designationId: string;
  managerId?: string | null;
  role?: UserRole;
  initialAnnualLeaveDays?: number;
  phone?: string;
  residentialAddress?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface UpdateEmployeePayload {
  departmentId?: string;
  designationId?: string;
  managerId?: string | null;
  role?: UserRole;
  status?: UserStatus;
}

export interface OrgHierarchyNode {
  employee: EmployeeSummary;
  directReports: OrgHierarchyNode[];
}
```

---

### 4.3 Audit Log Types (`update/src/lib/auditTypes.ts` or integrated in `workforceTypes.ts`)

```typescript
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  stateDiff: Record<string, unknown>;
  metadataDiff?: Record<string, unknown>;
  hash: string;
  previousHash: string;
}

export interface AuditLogFilterParams {
  action?: string;
  entityType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditIntegrityVerification {
  valid: boolean;
  compromisedId?: string;
  totalChecked: number;
  currentRootHash?: string;
  verifiedAt: string;
}
```

---

## 5. Client API Additions (`update/src/lib/api.ts`)

Add the following API modules to `update/src/lib/api.ts`:

```typescript
// 1. Appraisals Suite API Bindings
appraisals: {
  getCycles: (): Promise<AppraisalCycle[]> =>
    request<AppraisalCycle[]>('/appraisals/cycles'),

  createCycle: (payload: CreateCyclePayload): Promise<AppraisalCycle> =>
    request<AppraisalCycle>('/appraisals/cycles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMySubmission: (): Promise<AppraisalSubmission> =>
    request<AppraisalSubmission>('/appraisals/submissions/me'),

  getTeamSubmissions: (): Promise<AppraisalSubmission[]> =>
    request<AppraisalSubmission[]>('/appraisals/submissions/team'),

  getSubmissionById: (id: string): Promise<AppraisalSubmission> =>
    request<AppraisalSubmission>(`/appraisals/submissions/${id}`),

  submitSelfAppraisal: (
    submissionId: string,
    payload: SubmitSelfAppraisalPayload
  ): Promise<AppraisalSubmission> =>
    request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/self`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  submitManagerReview: (
    submissionId: string,
    payload: SubmitManagerReviewPayload
  ): Promise<AppraisalSubmission> =>
    request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/manager`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  calibrateScore: (
    submissionId: string,
    payload: CalibrateScorePayload
  ): Promise<AppraisalSubmission> =>
    request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/calibrate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  acknowledgeOutcome: (submissionId: string): Promise<AppraisalSubmission> =>
    request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/acknowledge`, {
      method: 'POST',
    }),
},

// 2. Workforce Directory & RBAC API Bindings
employees: {
  list: (params?: EmployeeQueryParams): Promise<PaginatedEmployeesResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.departmentId && params.departmentId !== 'All') {
      searchParams.set('departmentId', params.departmentId);
    }
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return request<PaginatedEmployeesResponse>(`/employees${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<EmployeeSummary> =>
    request<EmployeeSummary>(`/employees/${id}`),

  create: (payload: CreateEmployeePayload): Promise<EmployeeSummary> =>
    request<EmployeeSummary>('/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateEmployeePayload): Promise<EmployeeSummary> =>
    request<EmployeeSummary>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getDirectReports: (managerId: string): Promise<EmployeeSummary[]> =>
    request<EmployeeSummary[]>(`/employees/${managerId}/reports`),
},

// 3. DevSecOps Audit Log Stream API Bindings
auditLogs: {
  list: (params?: AuditLogFilterParams): Promise<AuditLogEntry[]> => {
    const searchParams = new URLSearchParams();
    if (params?.action && params.action !== 'All') searchParams.set('action', params.action);
    if (params?.entityType) searchParams.set('entityType', params.entityType);
    if (params?.actorId) searchParams.set('actorId', params.actorId);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    const qs = searchParams.toString();
    return request<AuditLogEntry[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
}
```

---

## 6. Page-by-Page Interactive Blueprint

### 6.1 `StaffAppraisalsPage.tsx` (Staff Self-Service)

#### Visual Layout & Information Hierarchy:
1. **Header Banner**:
   - Title: "Performance Appraisals & Reviews".
   - Subtitle: "Evaluate annual KRA commitments against the 70/30 institutional score model."
   - Active Cycle Badge: Displaying Cycle Title (`Q4 2026 Annual Performance Cycle`) and Status (`Open`).
   - Employee Submission Status Badge (`NOT_STARTED` [Neutral], `SELF_SUBMITTED` [Brand], `CALIBRATION_PENDING` [Pending Amber], `COMPLETED` [Emerald Approved]).

2. **Dynamic 4-Stage Stepper**:
   - Stage 1: **Self-Appraisal Form** (Active if `NOT_STARTED`; Completed checkmark if `SELF_SUBMITTED`+).
   - Stage 2: **Line Manager Evaluation** (Pending / In-Review).
   - Stage 3: **HR Calibration Committee** (Pending / Calibrating).
   - Stage 4: **Scorecard Release & Acknowledgment** (Finalized score unlocked).
   - Completed stages show an Emerald `#007B58` checkmark; active stage highlights with Sapphire `#0D51B2` accent; future stages remain subtle.

3. **Live 70/30 Composite Scorecard Preview**:
   - Card displaying real-time calculated metrics:
     - **KRA Weighted Score (70%)**: `Σ (Rating_i * (Weight_i / 100)) * 0.70`
     - **Competency Weighted Score (30%)**: `Σ (Rating_c * (Weight_c / 100)) * 0.30`
     - **Total Composite Projected Score**: `KRA_Score + Competency_Score` (out of 5.00)
     - Progress Bar: Width percentage `(Composite / 5.0) * 100%`, color-coded by tier.
     - Tier Indicator Badge: Unsatisfactory (<2.0), Needs Improvement (2.0-2.99), Meets (3.0-3.74), Exceeds (3.75-4.49), Outstanding (>=4.50).

4. **KRA Commitments Section (70% Weight)**:
   - Evaluates operational deliverables (e.g. Underwriting Quality 30%, Regulatory Compliance 25%, Delinquency Containment 25%, Process Automation 20%).
   - Each goal card features:
     - Title, weight badge (e.g. `30% Weight`), detailed description.
     - 1–5 Interactive Score Buttons:
       - Selected score button has `bg-action text-on-action shadow-sm`.
       - Non-selected buttons have `bg-subtle hover:bg-accent-soft text-muted hover:text-brand border border-rule`.
     - Active rating indicator badge displaying rubric label and description below buttons.
     - Goal-specific reflection notes textarea (`selfComments`).

5. **Institutional Core Competencies Section (30% Weight)**:
   - Core cultural behaviors:
     - `COMP-1`: Ethical Rigor & Regulatory Compliance (40% of Competency).
     - `COMP-2`: Cross-Functional Collaboration & Service Excellence (30% of Competency).
     - `COMP-3`: Technical Innovation & Continuous Improvement (30% of Competency).
   - Interactive 1–5 score picker matching KRA cards.

6. **Executive Reflection & Narrative**:
   - Textarea for high-level employee achievements, portfolio performance metrics, and growth objectives.
   - Character count and auto-save draft indicator.

7. **Action Toolbar**:
   - `Save Evaluation Draft`: Persists to local state / draft buffer.
   - `Submit Self-Appraisal`: Triggers modal confirmation, validates that all KRAs and Competencies have ratings >= 1.0, calls `api.appraisals.submitSelfAppraisal()`, locks editability.
   - When status is `COMPLETED`: Shows "Acknowledge Final Appraisal Scorecard" button triggering `api.appraisals.acknowledgeOutcome()`.

---

### 6.2 `AppraisalCalibrationPage.tsx` (Admin & Manager Calibration Grid)

#### Visual Layout & Information Hierarchy:
1. **Executive Cycle Governance Header**:
   - Cycle Title, Fiscal Year badge, and Cycle Phase indicator (`Active Self-Appraisal` vs `Manager Scoring` vs `Calibration Committee In Session`).
   - "Create New Appraisal Cycle" button opening Cycle Provisioning Modal.

2. **Institutional Calibration Bell-Curve / Distribution Cards**:
   - 4 Tiers:
     - **Tier 1 (Exceeds Expectations, 4.50 - 5.00)**: Target 15%, Actual Staff Count, Actual %.
     - **Tier 2 (Strong Performer, 3.75 - 4.49)**: Target 45%, Actual Staff Count, Actual %.
     - **Tier 3 (Meets Expectations, 3.00 - 3.74)**: Target 30%, Actual Staff Count, Actual %.
     - **Tier 4 (Needs Improvement, < 3.00)**: Target 10%, Actual Staff Count, Actual %.
   - Comparative Progress Bars: Visual horizontal bars displaying Actual % overlaying Target % threshold indicator to visually highlight curve skew (e.g., if Tier 1 is at 25% vs target 15%).

3. **Submissions Review & Calibration Table**:
   - Scope Switcher: Tabs for `Action Required (Calibration Pending)` | `All Submissions` | `Completed`.
   - Search bar by Staff Name or ID.
   - Department filter dropdown.
   - Table Columns:
     - `Staff Member`: Name, corporate email, avatar.
     - `Staff ID`: e.g. `NX-EMP-0142` (mono-nums).
     - `Department`: e.g. `Credit Risk & Underwriting`.
     - `Self Score`: e.g. `4.25` (mono-nums).
     - `Manager Score`: e.g. `4.10` (70/30 weighted, mono-nums).
     - `Calibrated Score`: Calibrated value or `Pending Lock`.
     - `Status Badge`: `SELF_SUBMITTED`, `CALIBRATION_PENDING`, `COMPLETED`.
     - `Actions`: "Calibrate Score" button (opening drawer).

4. **Calibration Committee Drawer**:
   - Slide-over drawer displaying:
     - Staff profile summary (Role, Department, Hire Date).
     - Side-by-side comparison table of Employee Self-Score vs Manager Score per goal.
     - Manager's qualitative feedback summary.
     - **Interactive Calibration Control**:
       - Slider (range: 1.00 to 5.00, step: 0.05).
       - Numeric input box synced with slider.
       - Grade preview pill: `Grade A (Exceeds)` / `Grade B (Strong)` / `Grade C (Meets)` / `Grade D (Improvement)`.
       - Justification notes textarea (recorded in immutable audit log).
       - Button: "Lock Final Calibrated Score" -> calls `api.appraisals.calibrateScore()`.

5. **Cycle Provisioning Modal (`POST /appraisals/cycles`)**:
   - Form fields: Title, Cycle Type, Fiscal Year, Start Date, End Date, Self Deadline, Manager Review Deadline.
   - 70/30 weightage sliders with validation ensuring `kraWeight + compWeight === 100`.

---

### 6.3 `EmployeeDirectoryPage.tsx` (Workforce Directory & RBAC)

#### Visual Layout & Information Hierarchy:
1. **Header Toolbar**:
   - Page Title: "Workforce Directory & RBAC".
   - Subtitle: "Manage employee records, organizational departments, and three-tier role-based access permissions."
   - Quick Stat: Total Headcount badge (e.g. `142 Personnel`).
   - Primary Action: "Add New Employee" button (opens Provisioning Modal).

2. **Interactive Search & Department Pills Bar**:
   - Search input with MagnifyingGlass icon: Instant filter across First Name, Last Name, Staff ID, Corporate Email.
   - **Clickable Department Pills Strip**:
     - Horizontal pill row: `[All Departments]` | `[Executive Governance]` | `[Credit Risk & Underwriting]` | `[Operations & Service]` | `[Technology Infrastructure]`.
     - Active pill styled with `bg-action text-on-action shadow-sm rounded-[7px]`.
     - Inactive pills styled with `bg-subtle text-muted hover:text-ink hover:bg-accent-soft rounded-[7px] border border-rule`.
   - **View Mode Toggle**:
     - Segmented control toggling: `Table View` | `Card Grid View` | `Org Hierarchy Tree`.

3. **View 1: Directory Table View**:
   - Columns:
     - `Staff Member`: Name + corporate email.
     - `Staff ID`: Monospaced tabular numeral.
     - `Department`: Department name.
     - `Designation`: Job title.
     - `System RBAC`: Role badge:
       - `Admin`: Sapphire soft badge (`bg-accent-soft text-brand border border-brand/30`).
       - `Manager`: Warm amber badge (`bg-[#FFF8E6] text-[#865600]`).
       - `Employee`: Neutral subtle badge (`bg-subtle text-muted border border-rule`).
     - `Status`: Badge (`Active` [Emerald] | `Inactive` / `On Leave` [Amber/Danger]).
     - `Actions`:
       - Edit button (pencil icon) -> opens Edit Employee Modal.
       - Status toggle button (lock/unlock icon) -> deactivates/reactivates employee.

4. **View 2: Card Grid View**:
   - Responsive grid (1 col mobile, 2 col sm, 3 col lg, 4 col xl).
   - 12px rounded cards with:
     - Avatar circle with initials.
     - Name and monospaced Staff ID.
     - Designation and Department.
     - Role chip and Status badge.
     - Email and Phone icon links.
     - Edit button on card footer.

5. **View 3: Interactive Org Hierarchy Tree**:
   - Visual organizational chart displaying reporting relationships:
     - **Level 1**: Executive Governance (Managing Director & CEO).
     - **Level 2**: Group Heads & C-Suite (Chief Risk Officer, Chief Service Officer, Head IT & Innovation).
     - **Level 3**: Department Managers & Team Leads.
     - **Level 4**: Senior Officers, Underwriters, and Analysts.
   - Collapsible nodes with direct report headcount pills (`e.g. 4 reports`).
   - Clicking a node highlights their direct report subtree.

6. **Provision New Employee Profile Modal (`POST /employees`)**:
   - First Name & Last Name inputs.
   - Corporate Email input (with validation for `@nexus.ng` or `@nexusfinance.ng`).
   - Department select (`Credit Risk & Underwriting`, `Operations & Service`, `Technology Infrastructure`, `Executive Governance`).
   - Designation select (e.g. `Credit Risk Analyst`, `Senior Underwriter`, `Chief Risk Officer`).
   - Reporting Manager select (populates from current Managers/Admins).
   - RBAC Role select (`Employee`, `Manager`, `Admin`).
   - Nigerian Banking Details (optional during initial onboard, validates 10-digit NUBAN).
   - Initial Annual Leave Quota (default 20.0 days).
   - "Provision Staff Record" primary button.

7. **Edit Employee Profile Modal (`PATCH /employees/:id`)**:
   - Department update, Designation update, Reporting Manager reassignment.
   - Role promotion/demotion dropdown.
   - Account Status toggle (`ACTIVE` | `INACTIVE`).
   - Displays last updated timestamp and user identity.

8. **Pagination Controls**:
   - Showing items `(page - 1) * limit + 1` to `min(page * limit, total)` of `total`.
   - Previous / Next buttons, page numbers with active sapphire styling.

---

### 6.4 `AuditLogsPage.tsx` (DevSecOps Immutable Security Audit Logs)

#### Visual Layout & Information Hierarchy:
1. **Header Banner**:
   - Title: "DevSecOps Immutable Security Audit Logs".
   - Subtitle: "Append-only tamper-evident security audit trail conforming to NIST SP 800-218 and OWASP A09."
   - Total Events Logged counter.

2. **Live Cryptographic Merkle / Hash Chain Integrity Badge**:
   - Prominent header card / badge:
     - **Status**:
       - If valid: Emerald green badge with `ShieldCheck` icon:  
         `● Cryptographic Ledger Integrity: VERIFIED (100% Tamper-Proof) — [Total Blocks: N]`
       - If compromised: Red danger badge with `WarningCircle` icon:  
         `▲ TAMPER DETECTED: Corrupted Block ID [aud-xxxx] — Chain Link Broken`
     - **Head Block SHA-256 Hash**: Truncated hash badge with copy button (e.g. `8ab8...12fe`).
     - **Action**: "Run Cryptographic Tamper Audit" button:
       - Runs in-process / client-side verification over the SHA-256 chain: checks `entry.previousHash === prev.hash` and recalculates `crypto.subtle.digest('SHA-256')` or SHA-256 payload.
       - Spinner during check, displays "Audit Complete: All N blocks verified intact" with timestamp.

3. **Multi-Parameter Search & Filter Controls**:
   - Search input: Real-time search by Actor Email, IP Address, or Resource ID.
   - Action Category filter select:
     - `All Actions`
     - `AUTH` (Login, Logout, Session Expiry)
     - `LEAVE` (Leave Submission, Approval, Rejection, Balance Reserve)
     - `EXPENSE` (Expense Claim, Receipt Upload, Manager Approval, Disbursement)
     - `APPRAISAL` (Cycle Created, Self Submitted, Manager Reviewed, Calibrated, Acknowledged)
     - `EMPLOYEE` (Onboarded, Updated, Role Assigned, Deactivated)
     - `SETTINGS` (Policy Changes, Thresholds)
   - Severity Level filter pills: `All` | `INFO` | `WARN` | `ERROR`.

4. **Immutable Ledger Stream Table**:
   - Columns:
     - `Event ID`: e.g. `AUD-9912` / `aud-7b2a` (monospaced brand sapphire).
     - `Timestamp`: WAT formatted date and time.
     - `Event Action`: Color-coded action chip (e.g. `APPRAISAL_CALIBRATED`, `LEAVE_APPROVED`).
     - `Actor / IP`: Actor email + Client IP address.
     - `Target Entity`: Resource ID (e.g. `USER:NX-EMP-0142`, `SUB:sub-emp-01`).
     - `SHA-256 Short Hash`: Truncated block hash (e.g. `c4f9...81ab`).
     - `Details & Delta`: Summary string or preview of mutations.
     - `Inspect Action`: Eye / MagnifyingGlass icon button opening Forensics Drawer.

5. **Cryptographic Forensics Drawer**:
   - Deep inspection drawer displaying:
     - Full Event Metadata: Actor ID, Email, IP Address, User-Agent, Correlation ID.
     - **Cryptographic Hash Chain Linkage**:
       - `Current Block SHA-256 Hash`: Full 64-character hex string.
       - `Previous Block SHA-256 Hash`: Full 64-character hex string (linked to parent).
       - Chain status: "Linked & Verified".
     - **State Mutation Delta (`stateDiff`)**:
       - Formatted JSON tree viewer displaying exact modified attributes (e.g. `{ selfScore: 4.25, status: "SELF_SUBMITTED" }`).

---

## 7. Component Layout & Directory Structure Compliance

In strict adherence to the project guidelines:
- **Zero loose files in `src/components/`**: All reusable components are organized into subdirectories (`ui/`, `layout/`, `features/`).
- Page files reside strictly within `src/pages/portal/` and `src/pages/admin/`.
- No metadata files (`AGENTS.md`, `GEMINI.md`) or source code files are placed in `.agents/teamwork/`.

### Component Directory Mapping:
```
update/src/
├── lib/
│   ├── api.ts                  # Extended with appraisals, employees, auditLogs
│   ├── appraisalTypes.ts       # Domain types for performance appraisal cycles & scoring
│   ├── workforceTypes.ts       # Domain types for directory, RBAC, and org tree
│   ├── leaveTypes.ts           # Existing leave types
│   └── expenseTypes.ts         # Existing expense types
├── pages/
│   ├── portal/
│   │   └── StaffAppraisalsPage.tsx       # Upgraded appraisal form with live 70/30 preview & rubrics
│   └── admin/
│       ├── AppraisalCalibrationPage.tsx  # Upgraded calibration grid, distribution chart & review table
│       ├── EmployeeDirectoryPage.tsx     # Upgraded directory with pills, card/table/tree view, edit modal
│       └── AuditLogsPage.tsx             # Upgraded ledger with live Merkle integrity badge & drawer
└── components/
    ├── ui/                     # Badge, Button, Card, Drawer, Modal, Input, Tabs, Skeleton
    ├── layout/                 # Sidebar, PortalLayout, AdminLayout, Navbar, Footer
    └── features/               # Domain feature components
```

---

## 8. Step-by-Step Implementation Roadmap for Engineering Track

The implementation should proceed in four sequential phases:

### Phase 1: Domain Types & API Client Infrastructure
1. Create `update/src/lib/appraisalTypes.ts` with all appraisal models, rubric tiers, and payload contracts.
2. Create `update/src/lib/workforceTypes.ts` with employee directory models, RBAC roles, pagination, and org hierarchy interfaces.
3. Update `update/src/lib/api.ts` to export `api.appraisals`, `api.employees`, and `api.auditLogs`.
4. Verify TypeScript compilation: run `npx tsc --noEmit` to ensure clean type contracts.

### Phase 2: Staff Appraisals Self-Service Page (`StaffAppraisalsPage.tsx`)
1. Integrate data fetching with `api.appraisals.getMySubmission()` and `api.appraisals.getCycles()`.
2. Implement KRA scoring cards and Competency scoring cards with 1–5 score picker buttons and rubric descriptions.
3. Build the live 70/30 composite score calculation preview widget with progress bar and tier badges.
4. Implement draft persistence and submission confirmation modal calling `api.appraisals.submitSelfAppraisal()`.
5. Implement outcome scorecard view and employee acknowledgment button calling `api.appraisals.acknowledgeOutcome()`.

### Phase 3: Workforce Directory & RBAC Administration (`EmployeeDirectoryPage.tsx`)
1. Integrate `api.employees.list()` with search and department filtering.
2. Build interactive department filter pills strip with active selection styling.
3. Build Card Grid view and Table view toggle.
4. Build Org Hierarchy Tree view with collapsible reporting lines.
5. Implement Provision Staff Record modal calling `api.employees.create()`.
6. Implement Edit Staff modal calling `api.employees.update()` (role, department, designation, manager).
7. Implement account deactivation action.

### Phase 4: Appraisal Calibration & DevSecOps Audit Logs
1. **`AppraisalCalibrationPage.tsx`**:
   - Fetch active cycle and team submissions via `api.appraisals.getTeamSubmissions()`.
   - Render the 4-tier distribution summary cards and comparative bell-curve bar visualizer.
   - Render the submissions table with status filtering.
   - Build the Calibration Drawer with score slider (1.00–5.00) and submit to `api.appraisals.calibrateScore()`.
2. **`AuditLogsPage.tsx`**:
   - Fetch logs via `api.auditLogs.list()`.
   - Implement the Live Cryptographic Merkle / Hash Chain Integrity badge and audit verification runner.
   - Build search bar and action/severity filters.
   - Build Forensics Drawer for inspecting `stateDiff`, `hash`, and `previousHash`.

---

## 9. Verification & Testing Strategy

Independent verification of the implemented features must be confirmed against the project test suite and static analysis:

1. **TypeScript Type Safety**:
   ```bash
   npx tsc --noEmit
   ```
   Must compile with 0 type errors across all new files and modified pages.

2. **Milestone 5 E2E Feature Tests**:
   ```bash
   node --loader tsx tests/testRunner.ts --tier1
   ```
   Verify specific passing suites:
   - `tests/e2e/tier1-features/appraisals.test.ts` (F10, F16, F17, F18)
   - `tests/e2e/tier1-features/workforce-directory.test.ts` (F11, F19, F20)
   - `tests/e2e/tier1-features/audit-security.test.ts` (F21, F24, F25)

3. **Multi-Step Scenario & Calibration Tests**:
   ```bash
   node --loader tsx tests/testRunner.ts --tier4
   ```
   Verify passing suites:
   - `tests/e2e/tier4-scenarios/year-end-appraisal-calibration.test.ts`
   - `tests/e2e/tier4-scenarios/workforce-restructuring-rollover.test.ts`

4. **Adversarial Cryptographic Integrity & Concurrency**:
   ```bash
   node --loader tsx tests/adversarial/m2-concurrency-audit-stress.test.ts
   ```
   Confirms SHA-256 hash chaining, previousHash links, tamper detection on manipulated logs, and concurrency invariants.

5. **Visual & Design Token Spot-Check**:
   - Sapphire `#0D51B2` action buttons with 7px radius.
   - Emerald `#007B58` positive badges.
   - 12px card radius and `--nx-ease` motion transitions.
   - Clean balance between Bricolage Grotesque headings and Instrument Sans body text.
