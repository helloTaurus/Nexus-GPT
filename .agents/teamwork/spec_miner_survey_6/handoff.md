# Handoff Report: Requirement R3 — Recruitment & Talent Pool Management

**Agent:** `spec_miner_survey_6`  
**Milestone:** Survey & Specification Phase  
**Timestamp:** 2026-11-11T16:50:00Z  
**Type:** Hard Handoff  

---

## 1. Observation

1. **Frontend Careers Page & Job Data**:
   - `update/src/pages/public/CareersPage.tsx` lines 27–37 loads openings from `localStorage.getItem('nexus_career_openings_v1')` falling back to `JOB_OPENINGS` in `update/src/data/careersData.ts`.
   - In `update/src/pages/public/CareersPage.tsx` lines 352–372, the speculative application section ("Don't see your exact role listed?") contains only a raw mailto link: `<a href="mailto:support@nexusfinance.com?subject=Speculative%20Application%20-%20Nexus%20Finance">`.
   - In `update/src/components/features/JobApplyModal.tsx` line 23: `if (!job) return null;` — modal immediately unmounts if no job is selected.
   - In `update/src/components/features/JobApplyModal.tsx` lines 149–162, resume submission is merely a text input: `Resume / CV Link (Google Drive / Dropbox) *`, rather than a binary file upload component.
   - In `update/src/components/features/JobApplyModal.tsx` lines 25–32, form submission is simulated with a dummy timer:
     ```ts
     const handleSubmit = (e: React.FormEvent) => {
       e.preventDefault();
       setSubmitting(true);
       setTimeout(() => {
         setSubmitting(false);
         setSubmitted(true);
       }, 800);
     };
     ```
2. **Backend Upload Architecture & Dependencies**:
   - `update/package.json` lines 14–26 lists `express: ^4.21.2`, with **no multer or multipart parsing library** installed.
   - `update/server/app.ts` lines 32–40 parses non-JSON request bodies using native Express raw parser:
     ```ts
     app.use(
       express.raw({
         limit: '10mb',
         type: (req) => {
           const ct = req.headers['content-type'];
           return ct ? !ct.includes('application/json') && !ct.includes('application/x-www-form-urlencoded') : false;
         }
       })
     );
     ```
   - In `update/server/controllers/expenseController.ts` lines 58–73, magic byte checks support PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), and PDF (`25 50 44 46`), but reject all ZIP files (`50 4B 03 04`) with 415 `UNSUPPORTED_MEDIA_TYPE`. Because DOCX files are PKZip archives, DOCX is currently rejected.
   - In `update/server/uploads/`, only `receipts/` exists; no `resumes/` directory exists.
   - In `update/src/lib/api.ts` lines 420–431, `expenses.uploadReceipt` transmits binary `body: file` via `fetch` with `credentials: 'include'` and `Content-Type: file.type`.
3. **Administrative Area & Navigation**:
   - `update/src/components/layout/Sidebar.tsx` lines 48–55 defines `adminNav`:
     ```ts
     const adminNav = [
       { label: 'Executive Dashboard', path: '/admin/dashboard', icon: DiamondsFour },
       { label: 'Workforce Directory', path: '/admin/employees', icon: UsersThree },
       { label: 'Leave Approvals Queue', path: '/admin/leave-approvals', icon: CheckCircle },
       { label: 'Expense Reimbursements', path: '/admin/expense-approvals', icon: Receipt },
       { label: 'Appraisal Calibration', path: '/admin/appraisals', icon: Star },
       { label: 'DevSecOps Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck },
     ];
     ```
     There is no recruitment or talent pool route in `adminNav`.
   - `update/src/App.tsx` lines 41–75 (`AppRoute` union) and lines 135–164 (hash-routing resolver) contain no route handler for `/admin/talents` or `/admin/recruitment`.
   - `update/src/pages/admin/` contains: `AdminDashboardPage.tsx`, `AppraisalCalibrationPage.tsx`, `AuditLogsPage.tsx`, `CmsPortalPage.tsx`, `EmployeeDirectoryPage.tsx`, `ExpenseApprovalPage.tsx`, `LeaveApprovalPage.tsx`. No talent management page exists.
4. **Backend Repositories & Data Persistence**:
   - `update/server/repositories/types.ts` has no data models for candidate applications or talent pool records.
   - `update/server/repositories/dataStore.ts` manages persistence via `AtomicJsonStore` for users, sessions, leaves, expenses, appraisals, and settings, but has no `applicationRepository`.
   - Requirement R2 mandates a complete data purge where dashboard counts initialize at zero.

---

## 2. Logic Chain

1. **Application Submission Gap**:
   - From Observation 1 (`CareersPage.tsx` line 365 having only a mailto link, and `JobApplyModal.tsx` having line 23 `if (!job) return null`), candidates currently cannot submit general speculative applications via the frontend interface.
   - From Observation 1 (lines 149–162 of `JobApplyModal.tsx`), applicants can only input a URL string to external cloud storage, violating Requirement R3 which requires accepting document file uploads (PDF/DOCX) stored locally on the server.
   - Therefore, `JobApplyModal.tsx` must be refactored to support:
     a) Both specific job openings (`job !== null`) and general talent pool submissions (`job === null` or speculative mode).
     b) A real file upload component accepting PDF and DOCX documents with drag-and-drop and size validation.
     c) Real API submission via `api.recruitment.uploadResume` and `api.recruitment.submitApplication`.

2. **Upload Handling Architecture**:
   - From Observation 2 (`package.json` lacking `multer`, and `app.ts` providing `express.raw({ limit: '10mb' })`), adding multer is unnecessary and would introduce third-party dependency overhead. The established pattern in `expenseController.ts` and `api.ts` is direct binary upload via `express.raw`.
   - From Observation 2 (DOCX being PKZip format `50 4B 03 04`), the backend upload validator must specifically recognize PKZip headers that contain Office Open XML markers (`[Content_Types].xml` or `word/`) as valid `application/vnd.openxmlformats-officedocument.wordprocessingml.document` with `.docx` extension, while continuing to accept `%PDF` (`25 50 44 46`) and rejecting executables, scripts, raw images, and non-DOCX archives.
   - Files must be stored in `update/server/uploads/resumes/` under non-guessable `${UUID}.${ext}` filenames, with SHA-256 integrity computation and audit log recording.

3. **Secure Document Serving & Defense-in-Depth**:
   - From Observation 2 (`expenseController.ts` lines 130–176 and `tests/adversarial/m4-receipt-security.test.ts`), file retrieval must be guarded against directory traversal (CWE-22) using `path.basename` and `path.resolve` boundary checks, and restricted via `requireAuth` and `requireRole('ADMIN', 'MANAGER')`.
   - Download headers must include `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Content-Disposition` (inline for preview, attachment for `?download=true`).

4. **Admin Talent Management Portal**:
   - From Observation 3 (`adminNav` missing recruitment, and `pages/admin/` lacking a talent management page), a new page `TalentManagementPage.tsx` must be created and registered at route `/admin/talents`.
   - The page must provide candidate filtering (by application type, job, status), search, inline CV preview modal (PDF iframe or DOCX download prompt), status transition actions, and an onboarding conversion action that maps candidate details to `EmployeeDirectoryPage`.

5. **Data Architecture & Zero-State Compliance**:
   - From Observation 4 (`dataStore.ts` using `AtomicJsonStore` and Requirement R2 requiring zero metrics), `applications.json` must initialize as an empty array `[]`.
   - A dedicated `CandidateApplicationRecord` entity and `ApplicationRepository` must be wired into `DataStore`.

---

## 3. Caveats

- **Legacy DOC (`.doc`) Format**: The specification intentionally restricts Word documents to modern Office Open XML (`.docx`, PKZip based) and disallows legacy binary compound document `.doc` (`D0 CF 11 E0`) to eliminate OLE macro exploit vectors.
- **Client Storage Fallback**: In case the backend Express server is offline during frontend-only development mode (`npm run dev`), `api.ts` and `clientStore.ts` should provide local storage fallback mocking for recruitment, identical to the pattern used across leave and expense modules.
- **Zero-State Initial Count**: Under Requirement R2, `applications.json` must initialize with zero dummy records (`[]`) so all counters read 0 until fresh applications are submitted.

---

## 4. Conclusion

Requirement R3 (Recruitment & Talent Pool Management) is fully specified across all architectural tiers:
1. **Frontend**: `CareersPage.tsx` enhanced with speculative application trigger; `JobApplyModal.tsx` upgraded to dual-mode (specific job + general submission) with drag-and-drop PDF/DOCX file attachment; `TalentManagementPage.tsx` created for HR administration with full filtering, status tracking, and embedded CV inspection.
2. **Navigation & Routes**: `/admin/talents` registered in `App.tsx` and linked via `Sidebar.tsx` under Executive Governance.
3. **Backend File Architecture**: Public upload endpoint `POST /api/v1/recruitment/upload-resume` utilizing `express.raw` (zero third-party dependencies), magic-byte inspection (PDF `%PDF` and DOCX PKZip Open XML), 10MB limit, `${UUID}.${ext}` disk naming in `update/server/uploads/resumes/`, SHA-256 computation, and immutable audit logging.
4. **Download & Access Security**: `GET /api/v1/recruitment/resumes/:filename` protected by admin RBAC, strict path traversal neutralization, and `nosniff`/`SAMEORIGIN` headers.
5. **Data Persistence**: `AtomicJsonStore<CandidateApplicationRecord>` persisted in `update/server/data/applications.json` starting at zero records.

---

## 5. Verification Method

1. **Authoritative Specification Document**:
   - Inspect `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\spec_miner_survey_6\spec.md`.
2. **Type Checking & Build Verification**:
   - Run `npm run build` in `update/` to verify frontend TypeScript compilation.
   - Run `npx tsc --noEmit` on backend server files in `update/server/`.
3. **End-to-End Test Execution**:
   - Run Node.js test runner against recruitment test suites:
     `npx tsx --test tests/e2e/tier1-features/recruitment.test.ts`
     `npx tsx --test tests/adversarial/recruitment-security.test.ts`
4. **Invalidation Conditions**:
   - The specification is invalidated if:
     - DOCX uploads are rejected or incorrectly handled as generic zip archives.
     - Shell scripts or executables disguised with `.pdf` or `.docx` extensions pass validation.
     - Unauthenticated requests can access candidate CV documents.
     - General submissions fail when `jobOpeningId` is null.
     - Filesystem directory traversal (`/../`) is permitted on resume endpoints.
