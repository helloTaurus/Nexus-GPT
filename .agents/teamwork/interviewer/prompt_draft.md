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
