# Original User Request

## Approved Task Prompt — 2026-11-09T22:10:02Z

Coordinate execution through four departmental phases: (1) Executive & Product Strategy, (2) System Architecture & Stack Selection, (3) Full-Stack Engineering & Code Generation, and (4) QA Testing, Launch Preparation & Deployment, with the Principal DevSecOps Engineer and Secure Coding Architect evaluating security frameworks. Replicate the design exactly from the provided screenshot resources and reverse-engineer a production HRMS and expense suite (replicating Zoho People) from the ground up following first principles.

Working directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update
Integrity mode: demo
The team must NOT: copy code from existing open-source projects for core logic

## Reference Material
- Workspace screenshot resources: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update`
- Reference guide path: `c:\Users\Head IT Inovation\Desktop\Nexus guide`
- Core Principles of App Motion Design: micro-interactions, contextual transitions, natural easing, perceived performance (motion.dev/UI and framer-motion)
- Typography: Bricolage Grotesque and Instrument / DM Sans

## Requirements

### R1. Architecture Topography & Implementation Roadmap
Deliver a comprehensive architecture specification covering:
1. Domain & Architecture Topography: Determine platform URL/routing conventions for staff and administrative portals, lightweight server architecture, and modular backend service separation.
2. Technical Stack Recommendation: Evaluate and select a lightweight, production-grade stack following global best practices.
3. Module Breakdown & System Architecture: Reverse-engineer Zoho People core modules (Staff Portal, Leave Management, Expense System, Appraisals, Admin Management).
4. Implementation Roadmap: Phased execution plan from scaffolding to production readiness.

### R2. Project Initialization and Scaffolding
Initialize the project directory structure following clean architecture and best practices. Pages must be nested within the pages folder, separated cleanly from reusable UI components. Configure typography with Bricolage Grotesque and Instrument/DM Sans, and integrate motion libraries (framer-motion / motion.dev).

### R3. Exact Design Replication & Motion Design
Replicate the design from the provided screenshot resources without modifying layout or visual appearance. Incorporate the Core Principles of App Motion Design:
- Micro-interactions: Instant visual feedback for taps, toggles, form submissions
- Contextual Transitions: Smooth navigation guiding spatial hierarchy between screens
- Natural Easing: Smooth acceleration and deceleration curves rather than linear movement
- Perceived Performance: Skeleton screens, loading spinners, or progressive reveals

### R4. Functional HRMS & Expense Modules
Reverse-engineer and implement functional modules replicating Zoho People capabilities:
- Staff Portal: Self-service for personal profile information, leave balance tracking, and appraisal review
- Leave Management: Leave request submission, policy rules, and manager approval/rejection workflows
- Expense System: Expense filing, category allocation, receipt/document attachment, and reimbursement approval flows
- Appraisals & Performance: Review cycles, performance evaluation forms, and status tracking
- Administration: Employee directory management, role-based access control, and configuration settings

### R5. DevSecOps & Secure Coding Architecture
Before writing or modifying code, evaluate and apply five security frameworks:
1. OWASP Top 10: Eliminate injection via strict parameterization/ORM; prevent cryptographic failures (secure TLS, Bcrypt/Argon2 hashing, no hardcoded secrets); prevent broken access control.
2. NIST SSDF (SP 800-218): Adhere to Produce Well-Secured Software guidelines; enforce secure defaults; validate all third-party dependencies and inputs logically.
3. SEI CERT Coding Standards: Ensure robust memory/state management, fail-safe defaults, and boundary data sanitization.
4. CWE / SANS Top 25: Neutralize CWE-79 (XSS), CWE-89 (SQLi), and CWE-269 (Improper Privilege Management); prevent out-of-bounds write and deserialization flaws.
5. Microsoft Security Development Lifecycle (SDL): Apply Principle of Least Privilege across DB queries, APIs, and file systems; reduce attack surface.
Execution rules:
- Zero-Trust Input: Validate, sanitize, and type-check all payloads, headers, and URL parameters server-side using a validation schema before executing business logic.
- Error Handling: Fail securely. Catch all exceptions. Never leak stack traces, DB schemas, or internal logic to the client.
- Authentication/Authorization: Verify user role/identity on the server via secure, HttpOnly, SameSite cookies or signed JWTs prior to data retrieval or mutation.
Output requirement: Deliver the secure, production-ready code accompanied by a Security Audit & Patch Notes section detailing preemptively mitigated vulnerabilities referencing the specific frameworks.

## Acceptance Criteria

### Architecture & Scaffolding
- [ ] Architecture topography, technical stack rationale, module breakdown, and implementation roadmap documents are produced
- [ ] Project repository structure is initialized with pages nested within a dedicated pages directory, distinct from reusable components
- [ ] Typography is configured using Bricolage Grotesque and Instrument/DM Sans fonts

### Design & Motion
- [ ] Visual UI components and page layouts match the reference screenshots exactly
- [ ] Micro-interactions (taps, toggles, form states) provide instant visual feedback
- [ ] Contextual transitions and natural easing curves guide screen navigation
- [ ] Skeleton screens or loading spinners display during data retrieval

### HRMS Functionality
- [ ] Staff portal allows employees to view profile data, apply for leave, and view appraisal status
- [ ] Leave management handles submission, balance calculation, and approval/rejection state transitions
- [ ] Expense system handles expense submission, categorization, and review workflow
- [ ] Administrative views provide management of employee records and access controls

### Security & Verification
- [ ] All API endpoints enforce server-side schema validation and reject untyped or malformed inputs
- [ ] Database interactions utilize parameterized queries or ORM without raw query concatenation
- [ ] Passwords and secrets are protected using strong hashing (Argon2 or Bcrypt) and no hardcoded credentials exist
- [ ] Authentication uses server-validated HttpOnly/SameSite cookies or signed JWTs; unauthenticated or unauthorized access is rejected
- [ ] Error responses return generic user-friendly messages with no internal stack traces or database schema leakage
- [ ] Security Audit & Patch Notes document lists all mitigated vulnerabilities with framework references
- [ ] Automated tests verify core workflows (leave, expense, auth) and access control boundaries


## Approved Task Prompt — 2026-11-11T16:25:25Z

Make the clock-in button on StaffDashboardPage functional with persistence and daily hours tracking, purge all dummy staff and dashboard data across expenses, appraisals, and leaves so counts read zero until created, and create a dedicated talents/recruitment area for incoming CVs and career page submissions for production use.

Working directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update
Integrity mode: development

## Reference Material
- Architecture & DevSecOps standards: Zero-trust input validation, secure cookie/session auth, OWASP Top 10, NIST SSDF, fail-secure error handling, and security audit notes
- Design & styling: Replicate existing design, pages nested within pages folder, typography with Bricolage Grotesque and Instrument/DM Sans
- Codebase: Express backend in `update/server/`, React frontend in `update/src/`, automated tests in `tests/`

## Requirements

### R1. Functional Staff Clock-In & Attendance Tracking
Make the clock-in button on StaffDashboardPage fully functional. The system must store clock-in and clock-out events with timestamps, calculate and display the hours worked for the day, and support standard resumption hours (8:00 AM to 5:00 PM, Monday through Friday) as well as tracked hours on Saturday and Sunday following the existing application architecture.

### R2. Data Purge & Zero-State Dashboard Metrics
Purge all existing dummy staff, expense, appraisal, and leave records across the application. Executive and administrative dashboard metrics (such as total workforce, active staff, staff on leave, pending leaves, and expense claims queue) must accurately reflect zero when no records exist. Allow users to populate fresh data using Add Staff, Add Expense, and corresponding creation flows. Leave just one superadmin that has the highest rights to do and undo, configurable via environment variables (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`) in `.env` with documented fallback defaults if unset.

### R3. Recruitment & Talent Pool Management
Implement a dedicated talent area for managing recruitment and incoming CVs following the existing application structure. Enable applicants to submit CVs and application details via the careers page—both for specific job postings and general submissions when no listing matches. Accept document file uploads (such as PDF and DOCX) stored locally on the server with view and download links in the administrative talent area.

## Acceptance Criteria

### Staff Clock-In & Attendance
- [ ] Clocking in and clocking out persists timestamps to the backend data store
- [ ] Daily hours worked are accurately calculated and displayed on the staff dashboard
- [ ] Resumption schedule (8:00 AM to 5:00 PM, Monday to Friday) and weekend hours are properly tracked in attendance records

### Data Purge & Dashboards
- [ ] All pre-existing dummy staff, leave, expense, and appraisal records are purged from the system
- [ ] Executive and administrative dashboard counters display 0 when records are empty
- [ ] New staff, expense, appraisal, and leave entries can be created via their respective creation interfaces and update dashboard counts accordingly
- [ ] Exactly one superadmin account is configured with highest rights via `.env` variables (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`) or documented defaults

### Talent & Recruitment Area
- [ ] Careers page accepts candidate submissions for both open job listings and general applications
- [ ] Candidate CV document files (PDF/DOCX) are uploaded and saved locally to the server
- [ ] Talent pool interface allows administrators to view, review, and download candidate submissions and attached CV files

### Verification
- [ ] Automated tests using the repository's test framework verify clock-in tracking, data zero-states, and talent management features
