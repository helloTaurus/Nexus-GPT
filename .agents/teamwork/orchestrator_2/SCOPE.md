# Scope: Phase 2 Feature Expansion (R1, R2, R3)

## Architecture
- **Architecture Pattern**: Full-Stack Clean Architecture following existing Express backend and React frontend.
- **Attendance Domain**: `AttendanceRepository` with atomic `attendance.json` persistence, standard WAT (8:00 AM – 5:00 PM) resumption evaluation, weekend duty tracking, daily accumulated hours calculation, and live-ticking UI in `StaffDashboardPage.tsx`.
- **Zero-State & Security Domain**: Purged dummy datasets in backend repositories (`userRepository`, `leaveRepository`, `appraisalRepository`) and frontend (`clientStore.ts`). Dynamic `GET /api/v1/admin/metrics` endpoint providing 0-safe counters. Single superadmin account configured via `.env` (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`) with fallback defaults (`admin@nexusfinance.ng`, `AdminPassword123!`, `Super Administrator`).
- **Talent & Recruitment Domain**: Candidate application management via `ApplicationRepository` with `applications.json` initialized to `[]`. Binary file upload via Express raw parser (`limit: 10mb`) validating PDF (`%PDF`) and DOCX (PKZip Open XML headers), local filesystem storage in `uploads/resumes/${UUID}.${ext}`, secure download/view endpoints, and new `/admin/talents` management portal with embedded CV preview.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F27: Clock-In & Attendance Persistence | Store clock-in and clock-out events with UTC ISO timestamps and user IDs in `attendance.json` | M1 | R1 |
| 2 | F28: Daily Hours & Resumption Engine | Calculate daily hours worked, evaluate standard 8:00 AM - 5:00 PM WAT resumption, track Saturday/Sunday weekend duty | M1 | R1 |
| 3 | F29: Data Purge & Single Superadmin | Purge all pre-existing dummy staff, leave, expense, and appraisal records; configure single superadmin via `.env` | M2 | R2 |
| 4 | F30: Zero-State Dashboard Metrics | Admin/Executive dashboards display 0 for empty counts; dynamic increment upon fresh record creation via Add Staff/Expense/Leave | M2 | R2 |
| 5 | F31: Dual-Mode Careers Application | Careers page accepts candidate submissions for open job listings and general talent pool submissions | M3 | R3 |
| 6 | F32: Document Upload Engine | Local filesystem storage for PDF & DOCX resumes with magic-byte validation and path-traversal protection | M3 | R3 |
| 7 | F33: Admin Talent Management Portal | Admin UI to view, review, filter, and download candidate submissions and attached CV documents | M3 | R3 |
| 8 | F34: Automated E2E Verification | Automated test suites verifying attendance persistence, zero-states, and talent management features | M4 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Staff Clock-In & Attendance Tracking | Backend attendance repository, controller, routes, Zod schemas, audit logging; frontend API, clientStore fallback, StaffDashboardPage live timer and hours | none | IN_PROGRESS |
| 2 | M2: Data Purge, Zero-State Metrics & Superadmin | Purge backend seed data, remove frontend auto-repopulation traps, configure single superadmin via `.env`, implement `GET /api/v1/admin/metrics`, bind dashboards to dynamic 0-safe metrics | none | PLANNED |
| 3 | M3: Recruitment & Talent Pool Management | Application repository, file upload endpoint for PDF/DOCX with magic byte checks, secure resume serving, public application submission, TalentManagementPage in admin portal | none | PLANNED |
| 4 | M4: Full E2E Integration & Verification Hardening | Automated E2E tests for attendance, data zero-states, and recruitment; adversarial security testing; full build and forensic audit | M1, M2, M3 | PLANNED |

## Interface Contracts

### M1 Attendance Contract
- `POST /api/v1/attendance/clock-in`: `{}` -> `{ record: AttendanceRecord, activeSession: AttendanceSession, message: string }`
- `POST /api/v1/attendance/clock-out`: `{}` -> `{ record: AttendanceRecord, completedSession: AttendanceSession, totalMinutesWorked: number }`
- `GET /api/v1/attendance/today`: Returns `{ clockedIn: boolean, activeSession: AttendanceSession | null, totalMinutesWorked: number, resumptionStatus: string, date: string }`
- `GET /api/v1/attendance/history`: Returns `{ records: AttendanceRecord[] }`

### M2 Metrics & Superadmin Contract
- `GET /api/v1/admin/metrics`: Returns `{ totalWorkforce: number, activeStaff: number, staffOnLeave: number, pendingLeavesCount: number, expenseQueueCount: number, expenseQueueTotalAmount: number, activeAppraisalCycle: { name: string, submissionRate: number } | null }`
- `.env` configuration: `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`

### M3 Recruitment & Talent Contract
- `POST /api/v1/recruitment/upload-resume`: Raw binary buffer upload with `Content-Type: application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document` -> `{ resumeUrl: string, filename: string, sha256: string }`
- `POST /api/v1/recruitment/applications`: `{ fullName, email, phone, location?, jobOpeningId?, department?, yearsOfExperience?, resumeUrl, portfolioUrl?, coverNote? }` -> `{ application: CandidateApplicationRecord }`
- `GET /api/v1/recruitment/applications`: (Admin) Returns `{ applications: CandidateApplicationRecord[], metrics: { total, new, underReview, shortlisted, hired } }`
- `PATCH /api/v1/recruitment/applications/:id/status`: (Admin) `{ status, notes? }`
- `GET /api/v1/recruitment/resumes/:filename`: (Admin) Secure stream download with anti-traversal validation and security headers

## Code Layout
```
update/
├── server/
│   ├── config/env.ts                        # Superadmin env variables
│   ├── routes/
│   │   ├── index.ts                         # Mount /attendance and /recruitment
│   │   ├── attendance.routes.ts             # Clock-in / clock-out router
│   │   ├── admin.routes.ts                  # GET /metrics router
│   │   └── recruitment.routes.ts            # Applications and upload router
│   ├── controllers/
│   │   ├── attendanceController.ts          # Attendance handler + schedule calculations
│   │   ├── adminController.ts               # Zero-safe metrics handler
│   │   └── recruitmentController.ts         # Applications and resume upload handler
│   ├── repositories/
│   │   ├── types.ts                         # Attendance & Application data contracts
│   │   ├── dataStore.ts                     # Register attendance & applications stores
│   │   ├── attendanceRepository.ts          # Attendance JSON transactional store
│   │   ├── applicationRepository.ts         # Applications JSON transactional store
│   │   ├── userRepository.ts                # Purged seed data (only superadmin)
│   │   ├── leaveRepository.ts               # Purged seed balances
│   │   └── appraisalRepository.ts           # Purged seed submissions
│   ├── schemas/
│   │   ├── attendanceSchemas.ts             # Zod validation for attendance
│   │   └── recruitmentSchemas.ts            # Zod validation for applications
│   └── uploads/
│       └── resumes/                         # Local storage for candidate CV documents
├── src/
│   ├── App.tsx                              # Route /admin/talents
│   ├── components/layout/Sidebar.tsx        # Add Talent Management nav link
│   ├── components/features/JobApplyModal.tsx# Binary drag-and-drop upload & general submissions
│   ├── lib/
│   │   ├── api.ts                           # api.attendance & api.recruitment namespaces
│   │   ├── clientStore.ts                   # Purge auto-repopulation traps, add fallback logic
│   │   └── attendanceTypes.ts               # Attendance TypeScript interfaces
│   └── pages/
│       ├── admin/
│       │   ├── AdminDashboardPage.tsx       # Dynamic metrics from /api/v1/admin/metrics
│       │   └── TalentManagementPage.tsx     # Admin talent portal with CV inspection
│       ├── portal/
│       │   └── StaffDashboardPage.tsx       # Functional clock-in button & live timer
│       └── public/
│           └── CareersPage.tsx              # General speculative application flow
└── tests/
    └── e2e/
        ├── tier1-features/
        │   ├── attendance.test.ts           # Verification for R1
        │   ├── zeroStateMetrics.test.ts     # Verification for R2
        │   └── recruitment.test.ts          # Verification for R3
        └── adversarial/
            └── recruitment-security.test.ts # Magic-byte, traversal & upload hardening
```
