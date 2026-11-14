# Specification: Requirement R3 — Recruitment & Talent Pool Management

**Project:** Nexus Finance — Production HRMS & Expense Management Suite  
**Author:** `spec_miner_survey_6` (Teamwork Specification Miner)  
**Date:** November 11, 2026  
**Status:** Authoritative Specification Document  
**Target Codebase Paths:**
- Frontend: `update/src/pages/public/CareersPage.tsx`, `update/src/components/features/JobApplyModal.tsx`, `update/src/pages/admin/TalentManagementPage.tsx`, `update/src/components/layout/Sidebar.tsx`, `update/src/App.tsx`, `update/src/lib/api.ts`
- Backend: `update/server/routes/recruitment.routes.ts`, `update/server/controllers/recruitmentController.ts`, `update/server/schemas/recruitmentSchemas.ts`, `update/server/repositories/applicationRepository.ts`, `update/server/repositories/dataStore.ts`, `update/server/repositories/types.ts`
- Storage: `update/server/uploads/resumes/`
- Data: `update/server/data/applications.json`, `update/server/data/job_openings.json`

---

## 1. Executive Summary & Objective

Requirement R3 mandates a production-grade **Recruitment & Talent Pool Management** system:
1. **Public Careers Page**:
   - Enables applicants to apply for active job listings (`JobOpening`) as well as submit general / speculative applications when no current opening matches their profile.
   - Provides an intuitive, responsive application modal with live file attachment capabilities.
2. **Document File Upload Architecture**:
   - Handles binary document uploads (`PDF` and `DOCX`) stored locally in the server's filesystem (`update/server/uploads/resumes/`).
   - Implements strict zero-trust security: magic-byte signature validation, 10MB payload size ceiling, cryptographic SHA-256 integrity verification, sanitized UUID-based disk filenames (preventing path traversal and file-overwrite attacks), and immutable audit logging.
   - Provides a secure static/download route with strict HTTP response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Disposition`) protected by administrative role-based access control.
3. **Administrative Talent Management Portal**:
   - Dedicated administrative view (`TalentManagementPage.tsx`) accessible via `/admin/talents`.
   - Complete candidate pipeline tracking: filtering by application type (job-specific vs. general submission), job opening, candidate status, and search keywords.
   - In-app CV preview modal (inline PDF viewer / DOCX download prompt), application status transitions, recruiter notes, and one-click conversion to staff onboarding.
4. **Backend Architecture & Data Persistence**:
   - RESTful API endpoints matching established zero-trust architectural conventions (`express.raw`, Zod schema validation, generic fail-secure errors, correlation IDs).
   - Atomic disk persistence via `AtomicJsonStore` adhering to Requirement R2 zero-state requirements (starts empty at 0 records until created/submitted).

---

## 2. Current State Analysis & Gap Assessment

### 2.1 Frontend Careers Page (`update/src/pages/public/CareersPage.tsx`)
- **Current implementation**:
  - Displays job openings read from `localStorage` (`nexus_career_openings_v1`) or hardcoded seed in `update/src/data/careersData.ts`.
  - Has a "Read More" modal for job details and a button to trigger `JobApplyModal` passing `job={applyJob}`.
  - Section for speculative applications ("Don't see your exact role listed?") only has a raw `mailto:support@nexusfinance.com` link.
- **Identified Gaps**:
  - No way to submit a general speculative application through the web interface.
  - `JobApplyModal.tsx` requires a non-null `job` prop and returns `null` if `job === null`.
  - In `JobApplyModal.tsx`, the resume field is merely a text input for a URL ("Resume / CV Link (Google Drive / Dropbox)"), NOT a real file upload input.
  - Form submission uses a dummy `setTimeout` (800ms) and does not call any backend API.
  - No connection to server data or persistent state.

### 2.2 Backend File Upload Infrastructure (`update/server/`)
- **Current implementation**:
  - `update/server/app.ts` configures `express.raw({ limit: '10mb', ... })` for non-JSON content types.
  - `update/server/controllers/expenseController.ts` implements receipt uploads (`/api/v1/expenses/upload-receipt`) supporting PNG, JPEG, and PDF.
  - There is NO resume upload controller or storage directory for recruitment documents.
- **Identified Gaps**:
  - `expenseController` only validates images and PDFs; it explicitly rejects PKZip archives, meaning **DOCX files are currently rejected**!
  - No recruitment routes (`recruitment.routes.ts`) or candidate application data models exist in `update/server/routes/` or `update/server/repositories/`.
  - No resume directory (`update/server/uploads/resumes/`) exists yet.

### 2.3 Administrative Console (`update/src/pages/admin/`)
- **Current implementation**:
  - `Sidebar.tsx` lists: Executive Dashboard, Workforce Directory, Leave Approvals, Expense Reimbursements, Appraisal Calibration, Audit Logs.
  - `App.tsx` routes to these administrative pages but has no route for talents or recruitment.
- **Identified Gaps**:
  - No `TalentManagementPage.tsx` exists.
  - No sidebar link for Talent Pool / Recruitment.
  - Administrators cannot view candidate applications, inspect candidate CVs, or update application status.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| F01 | Recruitment / Public | Active Job Postings Fetch | Public endpoint to retrieve active job openings with department filtering | Query: `?department=...` | HTTP 200: `{ success: true, data: JobOpeningRecord[] }` | HTTP 500: Generic error envelope | Analysis of `careersData.ts` & `CareersPage.tsx` |
| F02 | Recruitment / Public | Single Job Opening Detail | Retrieve single job opening specification by ID | Route param: `id` (e.g. `job-1`) | HTTP 200: `{ success: true, data: JobOpeningRecord }` | HTTP 404: `NOT_FOUND` if ID does not exist | `CareersPage.tsx` Read More modal contract |
| F03 | Recruitment / Public | Job-Specific Application Submission | Candidate submits an application linked to an active job opening | JSON payload: applicant info, `jobOpeningId`, resume metadata | HTTP 201: `{ success: true, data: { id, applicationNumber, ... } }` | HTTP 400: `VALIDATION_ERROR` for missing fields or invalid format | Requirement R3 & `JobApplyModal.tsx` |
| F04 | Recruitment / Public | General / Speculative Application Submission | Candidate submits an application to the general talent pool when no specific opening matches | JSON payload: applicant info, `jobOpeningId: null`, `preferredDepartment`, resume metadata | HTTP 201: `{ success: true, data: { id, applicationNumber, type: 'GENERAL_SUBMISSION', ... } }` | HTTP 400: `VALIDATION_ERROR` | Requirement R3 & Speculative section in `CareersPage.tsx` |
| F05 | File Upload / Security | Document File Upload (PDF/DOCX) | Public endpoint to upload applicant resume document buffer (raw binary or multipart) | Request body: Raw binary Buffer, `Content-Type`, `X-File-Name` | HTTP 201: `{ success: true, fileUrl, resumeUrl, fileName, mimeType, sizeBytes, sha256 }` | HTTP 415 if not PDF/DOCX; HTTP 413 if >10MB; HTTP 400 if empty | Requirement R3 & `m4-receipt-security.test.ts` |
| F06 | File Upload / Security | Magic-Byte Inspection (PDF) | Validates PDF header signature `%PDF` (`0x25, 0x50, 0x44, 0x46`) regardless of client header | Binary buffer | MIME confirmed as `application/pdf` | HTTP 415 `UNSUPPORTED_MEDIA_TYPE` | Requirement R3 & CWE-434 mitigation |
| F07 | File Upload / Security | Magic-Byte Inspection (DOCX) | Validates PKZip header `0x50, 0x4B, 0x03, 0x04` and verifies Office Open XML markers (`[Content_Types].xml` or `word/`) | Binary buffer | MIME confirmed as `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | HTTP 415 `UNSUPPORTED_MEDIA_TYPE` if plain zip or non-DOCX | Requirement R3 & Office Open XML standard |
| F08 | File Upload / Security | Safe UUID Filename Sanitization | Generates non-guessable `${UUID}.${ext}` disk filename, isolating physical storage from untrusted client strings | Client filename & detected MIME type | Sanitized disk path: `uploads/resumes/${UUID}.${ext}` | Path traversal impossible (CWE-22 mitigated) | `expenseController.ts` & DevSecOps standards |
| F09 | File Upload / Security | SHA-256 Cryptographic Hash & Audit Trail | Computes SHA-256 hash of disk buffer and records immutable audit log event `RESUME_UPLOADED` | File buffer, client IP, user agent | Stored hash string & audit log entry | Cryptographic verification failure on tampering | OWASP A09 & `AuditService` |
| F10 | Document Serving / Admin | Secure Resume Document Preview/Download | Administrative endpoint to retrieve uploaded CV files with defense-in-depth headers | Route param: `filename`; query: `?download=true` | HTTP 200: Raw file stream with `nosniff`, `SAMEORIGIN`, `Content-Disposition` | HTTP 401 unauthenticated; HTTP 403 non-admin; HTTP 404 not found | Requirement R3 & `m4-receipt-security.test.ts` Vector 5 |
| F11 | Document Serving / Security | Path Traversal Neutralization | Blocks `../`, `..\`, URL-encoded `%2e%2e`, and absolute system paths on resume download route | Malformed filename | HTTP 404 / 403; zero filesystem leakage | CWE-22 / CWE-23 mitigation | `expenseController.ts` & Vector 4 tests |
| F12 | Admin / Talent Area | Talent Pool Candidate List | Administrative endpoint to list applications with filtering, sorting, and pagination | Query: `type`, `status`, `jobOpeningId`, `search`, `page`, `limit` | HTTP 200: `{ success: true, data: CandidateApplicationRecord[], meta: { total, ... } }` | HTTP 401 unauthenticated; HTTP 403 non-admin | Requirement R3 & `TalentManagementPage.tsx` |
| F13 | Admin / Talent Area | Candidate Application Detail | Retrieve complete candidate application profile and review history | Route param: `id` | HTTP 200: `{ success: true, data: CandidateApplicationRecord }` | HTTP 404: `NOT_FOUND` | `TalentManagementPage.tsx` Detail Drawer |
| F14 | Admin / Talent Area | Application Status Transition | Update application status (`UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `OFFERED`, `REJECTED`, `CONVERTED`) | Body: `{ status, notes?, rejectionReason? }` | HTTP 200: `{ success: true, data: CandidateApplicationRecord }` | HTTP 400: `VALIDATION_ERROR` for illegal status transitions | Recruitment workflow requirements |
| F15 | Admin / Talent Area | Convert Candidate to Employee | Fast-track candidate onboarding by converting application data into employee directory record | Application ID | HTTP 200: `{ success: true, data: { employeeId, ... } }` | HTTP 400 if already converted or missing required fields | Synergy with `EmployeeDirectoryPage.tsx` |
| F16 | UI / Navigation | Admin Navigation Integration | Integrates Recruitment & Talent Pool into sidebar and routing table | Route: `/admin/talents` | Rendered `TalentManagementPage` within `AdminLayout` | Redirect to login if unauthenticated | `Sidebar.tsx` & `App.tsx` |
| F17 | Data Persistence | Atomic Persistence & Zero-State Metrics | Stores applications in `update/server/data/applications.json` with initial zero-state (0 records) | Data mutations | Atomic JSON file write via `AtomicJsonStore` | Fail-safe write lock with temporary swap file | Requirement R2 & R3 |

---

## 4. Edge Cases & Boundary Conditions

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| E01 | File Upload | Shell script or executable disguised with `.pdf` extension | Magic byte check fails (`%PDF` missing). Returns HTTP 415 `UNSUPPORTED_MEDIA_TYPE`. File is never written to disk. |
| E02 | File Upload | Valid PNG or JPEG image uploaded to resume endpoint | Rejected with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`. Resumes strictly enforce PDF and DOCX document formats. |
| E03 | File Upload | Arbitrary ZIP archive (e.g. `test.zip`) renamed to `resume.docx` | Starts with PKZip magic bytes `50 4B 03 04`, but secondary inspection fails to locate `[Content_Types].xml` or `word/`. Rejected with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`. |
| E04 | File Upload | Truncated document header (e.g. 2 bytes `25 50`) | Rejected with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`. |
| E05 | File Upload | Zero-byte empty payload (`Content-Length: 0`) | Rejected with HTTP 400 `VALIDATION_ERROR` ("No file payload received"). |
| E06 | File Upload | File exactly 10MB (10,485,760 bytes) | Accepted with HTTP 201 Created. Disk stat confirms exactly 10,485,760 bytes. |
| E07 | File Upload | File 10MB + 1 byte (10,485,761 bytes) | Rejected with HTTP 413 `PAYLOAD_TOO_LARGE`. |
| E08 | File Upload | Malicious filename with traversal characters (e.g. `../../etc/passwd.pdf` or `C:\boot.ini`) | Client filename is ignored for disk storage. File is saved under random UUID (`${crypto.randomUUID()}.pdf`). Stored original name is sanitized with `path.basename`. |
| E09 | File Download | Path traversal `/api/v1/recruitment/resumes/../../package.json` | Path sanitization strips `..`. Returns HTTP 404 `NOT_FOUND` ("Resume document not found"). Internal server paths are NEVER leaked. |
| E10 | File Download | Unauthenticated GET request to `/api/v1/recruitment/resumes/:filename` | Returns HTTP 401 `UNAUTHORIZED`. Candidate resumes contain sensitive PII and are restricted to HR administrators. |
| E11 | File Download | Standard Employee role (non-admin/non-manager) requests resume | Returns HTTP 403 `FORBIDDEN`. Only `ADMIN` or `MANAGER` roles are permitted. |
| E12 | File Download | Request with query `?download=true` | Returns HTTP 200 with header `Content-Disposition: attachment; filename="Candidate_CV.pdf"`. Default without parameter returns `Content-Disposition: inline`. |
| E13 | Application Submission | Missing mandatory contact fields (`email`, `phone`, `fullName`) | Rejected with HTTP 400 `VALIDATION_ERROR` detailing specific field errors. |
| E14 | Application Submission | Malformed email address (e.g. `invalid-email-string`) | Rejected with HTTP 400 `VALIDATION_ERROR`. |
| E15 | Application Submission | Job-specific application referencing deleted or non-existent `jobOpeningId` | Rejected with HTTP 400 `VALIDATION_ERROR` ("Referenced job opening does not exist"). |
| E16 | Application Submission | General speculative submission with `jobOpeningId: null` or `"general"` | Accepted with HTTP 201 Created. Categorized as `type: 'GENERAL_SUBMISSION'`, `jobTitle: 'General Talent Pool'`. |
| E17 | Zero-State Metric | Fresh installation or purged state | Administrative dashboard and talent pool reflect exactly `0` total applications. Zero-state UI displays informative empty state illustration and guidance. |
| E18 | Status Transition | Attempting to set illegal status string (e.g. `status: "RANDOM_STRING"`) | Rejected with HTTP 400 `VALIDATION_ERROR`. Enforces strict enum: `NEW`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `OFFERED`, `REJECTED`, `CONVERTED`. |

---

## 5. Candidate Application Submission Workflow

### 5.1 Dual Application Modes
1. **Specific Job Listing Application**:
   - Initiated from: Clicking "Apply for this Position" in the Careers Page openings list or from within the Job Details Modal.
   - Context: Pre-populates the job title, job opening ID, department, and location.
   - Categorized as: `type: 'SPECIFIC_JOB'`.
2. **General / Speculative Submission (Talent Pool)**:
   - Initiated from: Clicking "Join Our Talent Pool" / "Submit Speculative CV" in the speculative section at the bottom of the Careers Page.
   - Context: `jobOpeningId` is `null` or omitted; applicant selects a `preferredDepartment` (Credit Risk, Fintech & Engineering, Institutional Sales, Operations, Finance & Administration) and target role.
   - Categorized as: `type: 'GENERAL_SUBMISSION'`.

### 5.2 Application Form Fields & Validation Rules

| Field Name | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `fullName` | `string` | Yes | 2 to 100 characters, trimmed | Candidate's legal full name |
| `email` | `string` | Yes | Valid RFC 5322 email regex, normalized lowercase | Primary candidate email for communications |
| `phone` | `string` | Yes | Valid phone format (e.g. `+234 803 000 0000`, 7-20 digits) | Primary candidate contact telephone number |
| `jobOpeningId` | `string \| null` | Conditional | Valid existing job opening ID if specific; `null` or empty if general | Linkage to `JobOpening` entity |
| `jobTitle` | `string` | Yes | 2 to 100 characters | Job title applied for (or "General Talent Pool") |
| `preferredDepartment` | `string` | Optional | Max 100 characters | Target operational area for general submissions |
| `linkedinUrl` | `string` | Optional | Valid HTTP/HTTPS URL, max 255 chars | Professional LinkedIn profile link |
| `portfolioUrl` | `string` | Optional | Valid HTTP/HTTPS URL, max 255 chars | GitHub, Behance, or personal website link |
| `yearsOfExperience` | `number \| string` | Optional | Non-negative integer (0-50) or formatted string | Total relevant industry experience |
| `coverNote` | `string` | Optional | Max 2000 characters | Personal statement, accomplishments, pitch |
| `resumeFile` | `File` | Yes | PDF or DOCX file, size <= 10MB | Candidate curriculum vitae / resume document |

### 5.3 UX & Interaction Architecture (`JobApplyModal.tsx`)
1. **Interactive File Upload Zone**:
   - Replaces the legacy URL text input with a drag-and-drop file upload target.
   - Accepts `.pdf` and `.docx` extensions (`accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"`).
   - Displays real-time upload progress, file size, format badge (`[PDF]` / `[DOCX]`), and remove/replace action.
2. **Submission Flow**:
   - Step 1: Upload resume file via `api.recruitment.uploadResume(file)` -> returns file metadata and SHA-256 hash.
   - Step 2: Submit application payload via `api.recruitment.submitApplication(payload)`.
   - Step 3: Transition modal state to success screen displaying:
     - Checkmark animation (using phosphor `CheckCircle`).
     - "Application Transmitted" headline.
     - Generated application tracking number (e.g. `APP-2026-0042`).
     - Confirmation message stating human capital team review timeline.
3. **Modal Dialog Accessibility**:
   - Uses `useDialogFocus` hook, `role="dialog"`, `aria-modal="true"`, `aria-labelledby="job-application-title"`.
   - Keyboard navigation: Escape key closes modal; Tab keys trapped within active dialog.

---

## 6. Document File Upload & Security Architecture

### 6.1 Two-Stage Upload Pipeline
```
[ Browser / Client ]
        │
        │ 1. POST /api/v1/recruitment/upload-resume (Binary Buffer)
        ▼
[ Express Router: recruitment.routes.ts ]
        │
        │ express.raw({ limit: '10mb' }) parses buffer
        ▼
[ Controller: recruitmentController.ts ]
        │
        ├─► Size Check: Buffer.length <= 10,485,760 bytes (else HTTP 413)
        ├─► Non-Empty Check: Buffer.length > 0 (else HTTP 400)
        ├─► Magic-Byte Inspection:
        │     ├─ [25 50 44 46] (%PDF) -> application/pdf (.pdf)
        │     ├─ [50 4B 03 04] + Office Open XML check -> application/vnd.openxmlformats... (.docx)
        │     └─ Disallowed -> HTTP 415 UNSUPPORTED_MEDIA_TYPE
        ├─► Generate UUID: const fileId = crypto.randomUUID()
        ├─► Safe Disk Name: const diskFileName = `${fileId}.${ext}`
        ├─► Compute SHA-256: crypto.createHash('sha256').update(buffer).digest('hex')
        ├─► Write to Local Disk: update/server/uploads/resumes/${diskFileName}
        ├─► Record Audit Log: AuditService.record({ action: 'RESUME_UPLOADED', ... })
        ▼
[ Response HTTP 201 Created: { fileUrl, resumeUrl, fileName, mimeType, sizeBytes, sha256 } ]
```

### 6.2 Magic Byte Signature Matrix

| Format | Magic Bytes (Hex) | ASCII / Signature | Secondary Verification | Detected MIME Type | Allowed? |
|---|---|---|---|---|---|
| **PDF** | `25 50 44 46` | `%PDF` | Header check `buffer.slice(0, 4)` | `application/pdf` | **YES** |
| **DOCX** | `50 4B 03 04` | `PK\x03\x04` | Buffer contains `[Content_Types].xml` or `word/` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | **YES** |
| **DOC (Legacy)** | `D0 CF 11 E0 A1 B1 1A E1` | OLE Compound Doc | Disallowed (vulnerable to macro exploits) | `application/msword` | **NO** (415) |
| **Plain ZIP** | `50 4B 03 04` | `PK\x03\x04` | Lacks Office Open XML internal structures | `application/zip` | **NO** (415) |
| **PNG** | `89 50 4E 47` | `.PNG` | Disallowed for resume document uploads | `image/png` | **NO** (415) |
| **JPEG** | `FF D8 FF` | `ÿØÿ` | Disallowed for resume document uploads | `image/jpeg` | **NO** (415) |
| **Executable** | `4D 5A` | `MZ` (PE Executable) | Malware vector | `application/x-msdownload` | **NO** (415) |
| **Shell Script** | `23 21` | `#!/bin/...` | Exploit attempt | `text/x-shellscript` | **NO** (415) |
| **HTML / SVG** | `3C 68 74 6D` / `3C 73 76 67` | `<htm` / `<svg` | XSS vector | `text/html` / `image/svg+xml` | **NO** (415) |

### 6.3 DOCX Deep Inspection Algorithm
To distinguish a legitimate Word document from an arbitrary ZIP archive containing malicious scripts:
```ts
function detectDocumentMime(buffer: Buffer): { mimeType: string; ext: string } | null {
  // 1. PDF Verification
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mimeType: 'application/pdf', ext: 'pdf' };
  }

  // 2. DOCX Verification (PKZip signature: 50 4B 03 04)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // Search for Office Open XML signature markers within first 4KB of zip central directory / local headers
    const probeWindow = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('binary');
    const isDocx =
      probeWindow.includes('[Content_Types].xml') ||
      probeWindow.includes('word/') ||
      probeWindow.includes('_rels/.rels');

    if (isDocx) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: 'docx',
      };
    }
  }

  return null;
}
```

### 6.4 Path Traversal Defense on Serving Route (`CWE-22 / CWE-23`)
The resume retrieval handler guarantees that no request can escape the upload directory:
```ts
export async function getResumeHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const filename = path.basename(req.params.filename);

  await ensureUploadDir();
  const resolvedPath = path.resolve(RESUME_UPLOAD_DIR, filename);

  // Strict boundary assertion
  if (!resolvedPath.startsWith(path.resolve(RESUME_UPLOAD_DIR))) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid file reference', correlationId }
    });
    return;
  }

  try {
    const fileBuffer = await fs.readFile(resolvedPath);
    let mimeType = 'application/octet-stream';
    if (filename.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (filename.endsWith('.docx')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    const isDownload = req.query.download === 'true';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=3600, no-transform');
    res.setHeader(
      'Content-Disposition',
      isDownload ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
    );

    res.status(200).send(fileBuffer);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resume document not found', correlationId }
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve resume document', correlationId }
    });
  }
}
```

---

## 7. Administrative Talent Area UI & Interaction Specification

### 7.1 Route & Layout Placement
- **URL Path**: `/admin/talents` (alias `/admin/recruitment`).
- **Sidebar Integration**:
  - Inserted into `adminNav` array in `Sidebar.tsx`:
    ```ts
    { label: 'Recruitment & Talents', path: '/admin/talents', icon: Briefcase }
    ```
- **Page Component**: `update/src/pages/admin/TalentManagementPage.tsx`.
- **Layout Shell**: Wraps inside `AdminLayout`, providing consistent institutional header, user profile initials, and dark/light theme persistence.

### 7.2 UI Structure & Components
1. **Executive Banner**:
   - Header badge: `Talent Acquisition & Recruitment Desk`.
   - Title: "Curriculum Vitae & Candidate Pipeline".
   - Subtitle: "Review applications, assess candidates, inspect CVs, and onboard new talent into the workforce."
   - Quick action buttons: "Refresh Pipeline", "Filter by Opening".
2. **Metric Summary Cards (4 Stat Pillars)**:
   - **Total Applications**: Real-time counter of all applications (starts at 0).
   - **Job-Specific Applications**: Count of applications tied to specific postings.
   - **General Talent Pool**: Count of speculative submissions.
   - **Shortlisted / In Review**: Count of candidates currently advancing through evaluation.
3. **Filter & Search Toolbar**:
   - Search input: instant client/server filtering by candidate name, email, phone, or job title.
   - Type filter pills: `All Applications`, `Job Postings`, `General Submissions`.
   - Status dropdown: `All Statuses`, `NEW`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `OFFERED`, `REJECTED`, `CONVERTED`.
   - Department filter dropdown.
4. **Talent Pipeline Data Table**:
   - Table columns:
     - `Candidate`: Name, Email, Phone, Submission timestamp.
     - `Position / Pool`: Position title badge or "General Pool" badge with department.
     - `Experience`: Years of experience and profile links (LinkedIn, Portfolio).
     - `CV Document`: `[PDF]` / `[DOCX]` badge, file size, "Preview" button, and "Download" button.
     - `Status`: Color-coded status badge (`NEW` = brand, `UNDER_REVIEW` = amber, `SHORTLISTED` = purple, `OFFERED` = emerald, `REJECTED` = rose, `CONVERTED` = green).
     - `Actions`: Action menu with "View Details", "Change Status", and "Convert to Staff".
5. **Candidate Review & CV Modal**:
   - Large modal drawer (max-w-4xl) containing:
     - Full applicant biographical details, contact info, and cover note.
     - Embedded Document Viewer:
       - For PDF: `<iframe src="/api/v1/recruitment/resumes/:filename" className="w-full h-[550px] rounded-lg border border-rule" />`.
       - For DOCX: Document download prompt with metadata summary card, SHA-256 fingerprint, and "Open / Download Word Document" button.
     - Status transition action bar: "Move to Under Review", "Shortlist Candidate", "Schedule Interview", "Reject Application", "Convert to Staff Member".
     - Recruiter notes log: append notes with timestamp and reviewer email.

---

## 8. Backend API Contracts & Interface Definitions

### 8.1 Public Endpoints (Applicant Facing)

#### 8.1.1 `GET /api/v1/recruitment/jobs`
- **Description**: Returns all active job openings for the careers page.
- **Access**: Public (no auth required).
- **Query Parameters**:
  - `department` (optional string): Filter by department name.
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "job-1",
        "title": "Senior Credit Underwriter (Public Sector)",
        "department": "Credit Risk & Underwriting",
        "type": "Full-Time (Onsite)",
        "location": "Abuja Head Office (NICON Insurance Building)",
        "salaryRange": "₦7.5M - ₦11.0M Gross Annual",
        "experience": "Minimum 5 years",
        "description": "We are seeking an experienced credit risk professional...",
        "responsibilities": ["Analyze borrower financial profiles...", "..."],
        "requirements": ["B.Sc. in Finance...", "..."],
        "isActive": true
      }
    ]
  }
  ```

#### 8.1.2 `POST /api/v1/recruitment/upload-resume`
- **Description**: Upload candidate resume document (PDF or DOCX).
- **Access**: Public.
- **Request Headers**:
  - `Content-Type`: `application/pdf` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (or `application/octet-stream`)
  - `X-File-Name`: URL-encoded original filename (e.g. `Amina_Bello_Resume.pdf`)
- **Request Body**: Raw binary buffer (up to 10MB).
- **Success Response (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "fileUrl": "/api/v1/recruitment/resumes/c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
    "resumeUrl": "/api/v1/recruitment/resumes/c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
    "fileName": "c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
    "originalFileName": "Amina_Bello_Resume.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 204850,
    "sha256": "4a7d1ed414474e4033ac29ccb8653d9b168e404b95247a37a6d89be7c37f4b32"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "No file payload received" } }`
  - `413 Payload Too Large`: `{ "success": false, "error": { "code": "PAYLOAD_TOO_LARGE", "message": "File size exceeds maximum 10MB limit" } }`
  - `415 Unsupported Media Type`: `{ "success": false, "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "Disallowed file format. Only PDF and DOCX document files are permitted." } }`

#### 8.1.3 `POST /api/v1/recruitment/applications`
- **Description**: Submits candidate application details linked to the uploaded resume.
- **Access**: Public.
- **Request Headers**: `Content-Type: application/json`
- **Request Body Schema**:
  ```json
  {
    "fullName": "Amina Bello",
    "email": "amina.bello@example.com",
    "phone": "+234 803 123 4567",
    "jobOpeningId": "job-1",
    "jobTitle": "Senior Credit Underwriter (Public Sector)",
    "preferredDepartment": "Credit Risk & Underwriting",
    "linkedinUrl": "https://linkedin.com/in/aminabello",
    "portfolioUrl": "https://aminabello.dev",
    "yearsOfExperience": 6,
    "coverNote": "Senior credit risk specialist with comprehensive knowledge of Remita and IPPIS payroll flows.",
    "resumeFileUrl": "/api/v1/recruitment/resumes/c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
    "resumeDiskFileName": "c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
    "resumeOriginalFileName": "Amina_Bello_Resume.pdf",
    "resumeMimeType": "application/pdf",
    "resumeSizeBytes": 204850,
    "resumeSha256": "4a7d1ed414474e4033ac29ccb8653d9b168e404b95247a37a6d89be7c37f4b32"
  }
  ```
- **Success Response (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "app_9f2b8c12",
      "applicationNumber": "APP-2026-0001",
      "type": "SPECIFIC_JOB",
      "fullName": "Amina Bello",
      "email": "amina.bello@example.com",
      "phone": "+234 803 123 4567",
      "jobOpeningId": "job-1",
      "jobTitle": "Senior Credit Underwriter (Public Sector)",
      "status": "NEW",
      "submittedAt": "2026-11-11T17:45:00.000Z"
    }
  }
  ```

---

### 8.2 Administrative Endpoints (HR & Governance Facing)

#### 8.2.1 `GET /api/v1/recruitment/applications`
- **Description**: Returns paginated, filtered candidate applications.
- **Access**: Restricted (`requireAuth`, `requireRole('ADMIN', 'MANAGER')`).
- **Query Parameters**:
  - `type` (optional): `SPECIFIC_JOB` | `GENERAL_SUBMISSION`
  - `status` (optional): `NEW` | `UNDER_REVIEW` | `SHORTLISTED` | `INTERVIEW_SCHEDULED` | `OFFERED` | `REJECTED` | `CONVERTED`
  - `jobOpeningId` (optional): string
  - `search` (optional): candidate name, email, or telephone substring
  - `page` (optional integer, default 1)
  - `limit` (optional integer, default 50)
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "app_9f2b8c12",
        "applicationNumber": "APP-2026-0001",
        "type": "SPECIFIC_JOB",
        "jobOpeningId": "job-1",
        "jobTitle": "Senior Credit Underwriter (Public Sector)",
        "preferredDepartment": "Credit Risk & Underwriting",
        "fullName": "Amina Bello",
        "email": "amina.bello@example.com",
        "phone": "+234 803 123 4567",
        "linkedinUrl": "https://linkedin.com/in/aminabello",
        "portfolioUrl": "https://aminabello.dev",
        "yearsOfExperience": 6,
        "coverNote": "Senior credit risk specialist...",
        "resumeFileUrl": "/api/v1/recruitment/resumes/c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
        "resumeDiskFileName": "c9bf9e57-1685-4c89-bafb-ff5af830be8a.pdf",
        "resumeOriginalFileName": "Amina_Bello_Resume.pdf",
        "resumeMimeType": "application/pdf",
        "resumeSizeBytes": 204850,
        "resumeSha256": "4a7d1ed414474e4033ac29ccb8653d9b168e404b95247a37a6d89be7c37f4b32",
        "status": "NEW",
        "adminNotes": [],
        "submittedAt": "2026-11-11T17:45:00.000Z",
        "updatedAt": "2026-11-11T17:45:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
  }
  ```

#### 8.2.2 `GET /api/v1/recruitment/applications/:id`
- **Description**: Retrieves full candidate application record by ID.
- **Access**: Restricted (`requireAuth`, `requireRole('ADMIN', 'MANAGER')`).
- **Success Response (HTTP 200)**: `{ "success": true, "data": CandidateApplicationRecord }`
- **Error (HTTP 404)**: `{ "success": false, "error": { "code": "NOT_FOUND", "message": "Candidate application not found" } }`

#### 8.2.3 `PATCH /api/v1/recruitment/applications/:id/status`
- **Description**: Updates candidate evaluation status and appends reviewer feedback notes.
- **Access**: Restricted (`requireAuth`, `requireRole('ADMIN', 'MANAGER')`).
- **Request Body Schema**:
  ```json
  {
    "status": "SHORTLISTED",
    "note": "Candidate holds 6 years credit experience; schedule initial stage technical interview.",
    "rejectionReason": null
  }
  ```
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "app_9f2b8c12",
      "status": "SHORTLISTED",
      "adminNotes": [
        "Candidate holds 6 years credit experience; schedule initial stage technical interview. [by admin@nexusfinance.ng at 2026-11-11T18:00:00.000Z]"
      ],
      "reviewedBy": "usr_admin_001",
      "reviewedAt": "2026-11-11T18:00:00.000Z",
      "updatedAt": "2026-11-11T18:00:00.000Z"
    }
  }
  ```

#### 8.2.4 `GET /api/v1/recruitment/resumes/:filename` (and `/uploads/resumes/:filename`)
- **Description**: Securely serves the attached resume document.
- **Access**: Restricted (`requireAuth`, `requireRole('ADMIN', 'MANAGER')`).
- **Query Parameter**: `download=true` forces download attachment header.
- **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`
  - `Cache-Control: private, max-age=3600, no-transform`
  - `Content-Disposition: inline; filename="Candidate_CV.pdf"` (or `attachment` if `?download=true`)

#### 8.2.5 `POST /api/v1/recruitment/applications/:id/convert-to-employee`
- **Description**: Converts a hired applicant into an active employee record in `update/server/data/users.json`.
- **Access**: Restricted (`requireAuth`, `requireRole('ADMIN')`).
- **Request Body**:
  ```json
  {
    "designation": "Senior Credit Underwriter",
    "department": "Credit Risk & Underwriting",
    "employmentType": "FULL_TIME",
    "salaryNGN": 8500000,
    "initialRole": "EMPLOYEE"
  }
  ```
- **Success Response (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "applicationId": "app_9f2b8c12",
      "createdUserId": "usr_emp_0143",
      "staffId": "NX-EMP-0143",
      "email": "amina.bello@example.com",
      "status": "CONVERTED"
    }
  }
  ```

---

## 9. Data Models & Repository Architecture

### 9.1 TypeScript Definitions (`update/server/repositories/types.ts`)
```ts
export type ApplicationType = 'SPECIFIC_JOB' | 'GENERAL_SUBMISSION';

export type ApplicationStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'OFFERED'
  | 'REJECTED'
  | 'CONVERTED';

export interface CandidateApplicationRecord {
  id: string; // e.g. "app_uuid"
  applicationNumber: string; // e.g. "APP-2026-0001"
  type: ApplicationType;
  jobOpeningId: string | null;
  jobTitle: string;
  preferredDepartment?: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  yearsOfExperience?: number | string;
  coverNote?: string;
  resumeFileUrl: string;
  resumeDiskFileName: string;
  resumeOriginalFileName: string;
  resumeMimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  resumeSizeBytes: number;
  resumeSha256: string;
  status: ApplicationStatus;
  adminNotes?: string[];
  rejectionReason?: string;
  submittedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface JobOpeningRecord {
  id: string;
  title: string;
  department: string;
  type: string;
  location: string;
  salaryRange: string;
  experience?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 9.2 ApplicationRepository Implementation
- Utilizes `AtomicJsonStore<CandidateApplicationRecord>` located at `update/server/data/applications.json`.
- Adheres to Requirement R2 zero-state:
  ```ts
  const applicationStore = new AtomicJsonStore<CandidateApplicationRecord>(
    path.join(this.dataDir, 'applications.json'),
    () => [] // Defaults to strictly empty array
  );
  ```
- Methods:
  - `createApplication(data: Omit<CandidateApplicationRecord, 'id' | 'applicationNumber' | 'status' | 'submittedAt' | 'updatedAt'>): Promise<CandidateApplicationRecord>`
  - `getApplicationById(id: string): CandidateApplicationRecord | null`
  - `listApplications(filters?: ApplicationFilterParams): { records: CandidateApplicationRecord[]; total: number }`
  - `updateApplicationStatus(id: string, status: ApplicationStatus, note?: string, actorEmail?: string): Promise<CandidateApplicationRecord | null>`
  - `countApplications(): { total: number; specific: number; general: number; shortlisted: number }`

---

## 10. DevSecOps & Security Threat Modeling

| Framework Reference | Threat / Risk | Mitigating Architecture |
|---|---|---|
| **CWE-434 (Unrestricted Upload)** | Attacker uploads web shell (`.php`, `.sh`, `.exe`) disguised as resume | Strict magic-byte inspection: only `%PDF` (`25 50 44 46`) and DOCX Open XML PKZip (`50 4B 03 04` with `word/` or `[Content_Types].xml`) are accepted. MIME headers from client are disregarded. |
| **CWE-22 / CWE-23 (Path Traversal)** | Attacker inputs `../../etc/passwd` in filename or download parameter | 1. Uploaded files are renamed to cryptographically random UUIDs (`${fileId}.${ext}`). Client filename is NEVER used as disk path.<br>2. Download route runs `path.basename` and asserts `resolvedPath.startsWith(uploadDir)`. |
| **CWE-400 (Denial of Service)** | Attacker floods upload endpoint with 100MB+ files to exhaust server disk/RAM | Payload size strictly bounded by `express.raw({ limit: '10mb' })` and explicit buffer check (`buffer.length <= 10 * 1024 * 1024`). Returns HTTP 413 `PAYLOAD_TOO_LARGE`. |
| **CWE-79 (Cross-Site Scripting)** | Malicious HTML/SVG file executed in browser when viewing resume | 1. HTML and SVG signatures are rejected with 415.<br>2. Serving route sends `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`, preventing execution of embedded scripts. |
| **CWE-269 / OWASP A01 (Broken Access Control)** | Unauthenticated user downloads candidate CVs or views applicant personal data | Public endpoints are limited to job listing retrieval and submission. All candidate lists, review statuses, and CV download endpoints enforce `requireAuth` and `requireRole('ADMIN', 'MANAGER')`. |
| **CWE-353 / NIST SSDF (Integrity)** | File tampering or corruption in storage | SHA-256 cryptographic digest is calculated immediately on receipt and stored in the application record. An immutable audit log entry is recorded with hash verification. |

---

## 11. Automated Test Suite Specification

### 11.1 Tier 1: Feature Verification (`tests/e2e/tier1-features/recruitment.test.ts`)
1. **Public Job Listings Retrieval**:
   - `GET /api/v1/recruitment/jobs` returns HTTP 200 with list of active jobs.
2. **Resume PDF Upload (Happy Path)**:
   - `POST /api/v1/recruitment/upload-resume` with `createValidPdfBuffer()` returns HTTP 201 Created with valid `fileUrl`, `fileName` ending in `.pdf`, and matching SHA-256.
3. **Resume DOCX Upload (Happy Path)**:
   - `POST /api/v1/recruitment/upload-resume` with valid DOCX buffer returns HTTP 201 Created with `mimeType: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
4. **Job-Specific Application Submission**:
   - `POST /api/v1/recruitment/applications` with valid applicant info and `jobOpeningId: 'job-1'` returns HTTP 201 Created with `type: 'SPECIFIC_JOB'`.
5. **General Speculative Application Submission**:
   - `POST /api/v1/recruitment/applications` with `jobOpeningId: null` returns HTTP 201 Created with `type: 'GENERAL_SUBMISSION'`.
6. **Admin Applications List Retrieval**:
   - Logged-in admin user calls `GET /api/v1/recruitment/applications` and receives HTTP 200 with the submitted applications.
7. **Admin Application Status Transition**:
   - Admin calls `PATCH /api/v1/recruitment/applications/:id/status` to change status from `NEW` to `SHORTLISTED`. Returns HTTP 200 with updated status.
8. **Admin Resume Document Download**:
   - Admin calls `GET /api/v1/recruitment/resumes/:filename?download=true`. Returns HTTP 200 with matching file bytes and `Content-Disposition: attachment`.

### 11.2 Tier 2: Boundary & Corner Cases (`tests/e2e/tier2-boundaries/recruitment-boundaries.test.ts`)
1. **Empty File Payload**:
   - `POST /api/v1/recruitment/upload-resume` with 0-byte buffer returns HTTP 400 `VALIDATION_ERROR`.
2. **Payload Size Limits**:
   - Exact 10MB payload succeeds (HTTP 201).
   - 10MB + 1 byte payload returns HTTP 413 `PAYLOAD_TOO_LARGE`.
3. **Missing Mandatory Fields**:
   - Missing `fullName` or `email` or `phone` returns HTTP 400 with specific error details.
4. **Invalid Email Address**:
   - `email: "not-an-email"` returns HTTP 400 `VALIDATION_ERROR`.
5. **Invalid Status Transition**:
   - `status: "INVALID_STATUS"` returns HTTP 400 `VALIDATION_ERROR`.

### 11.3 Tier 3: Adversarial & DevSecOps Suite (`tests/adversarial/recruitment-security.test.ts`)
1. **Magic-Byte Spoofing**:
   - Shell script disguised with `Content-Type: application/pdf` returns HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.
   - Executable (`4D 5A`) disguised as docx returns HTTP 415.
   - Arbitrary ZIP archive without Office Open XML markers returns HTTP 415.
   - PNG image disguised as PDF returns HTTP 415.
2. **Path Traversal Attacks**:
   - `GET /api/v1/recruitment/resumes/../../package.json` returns HTTP 404/403 without file content leakage.
   - URL-encoded `..%2F..%2Fpackage.json` returns HTTP 404/403 without leak.
3. **RBAC & Authentication Boundaries**:
   - Unauthenticated `GET /api/v1/recruitment/applications` returns HTTP 401 `UNAUTHORIZED`.
   - Employee role `GET /api/v1/recruitment/applications` returns HTTP 403 `FORBIDDEN`.
   - Unauthenticated `GET /api/v1/recruitment/resumes/:filename` returns HTTP 401 `UNAUTHORIZED`.
4. **Header Invariants**:
   - Resume download response must include `X-Content-Type-Options: nosniff`.
   - Resume download response must include `X-Frame-Options: SAMEORIGIN`.
   - Byte-for-byte binary equality between uploaded file and downloaded file.

---

## 12. Verification & Implementation Guidance

To verify this specification during implementation:
1. Verify `update/server/uploads/resumes/` directory is initialized.
2. Check `AtomicJsonStore` initializes `update/server/data/applications.json` with an empty array `[]` on fresh bootstrap.
3. Run `npx tsx --test tests/e2e/tier1-features/recruitment.test.ts` (or live test runner).
4. Run `npx tsx --test tests/adversarial/recruitment-security.test.ts`.
5. Run the frontend build `npm run build` inside `update/` to confirm zero TypeScript compilation errors.
