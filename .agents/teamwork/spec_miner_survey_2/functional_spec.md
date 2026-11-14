# Nexus Finance HRMS & Expense Management System
## Functional Specification Document (FSD) & Zoho People Feature Parity Inventory

**Document Reference**: SPEC-HRMS-NEXUS-2026-V1  
**Author**: `spec_miner_survey_2` (Specification Miner & Zoho People Domain Specialist)  
**Target Milestone**: Survey & Functional Architecture Phase  
**Integrity Mode**: Demo & First-Principles Implementation  
**Status**: Authoritative Functional Specification  
**Date**: November 9, 2026  

---

## 1. Executive Summary & Domain Topography

### 1.1 Organizational Profile
Nexus Finance is a high-growth, technology-enabled microfinance and cooperative liquidity institution headquartered in Abuja, Nigeria (2nd Floor, Right Wing, NICON Insurance Building, Central Business District). Regulated under the National Cooperative Financing Agency and the Abuja Cooperative Federation, Nexus Finance operates specialized credit facilities (Suremoney Payday Loans, Nexus Credit, Cash-for-Car, NWEL Women Empowerment, Travel Financing, Invoice Discounting, Shop-Owned SME Loans, and Gold-for-Cash).

To sustain rapid growth and maintain institutional governance, Nexus Finance requires an enterprise-grade, internal Human Resource Management System (HRMS) and Expense Management Suite that reverse-engineers and replicates the core operational capabilities of **Zoho People** and **Zoho Expense**.

### 1.2 Dual-Portal Topography
The platform delivers two distinct operational experiences sharing a unified, secure backend:
1. **Staff Portal (Employee Self-Service - ESS)**: Designed for desktop and mobile web viewports. Provides staff with self-service identity management, real-time leave entitlement tracking, intuitive leave application, end-to-end expense claim filing with document uploads, and annual/probationary performance appraisal workflows.
2. **Admin Portal (Human Capital & Operations Hub)**: Designed for HR Executives, Department Heads, and System Administrators. Provides complete workforce directory management, role-based access control (RBAC), multi-level approval queues for leave and expense dockets, appraisal cycle configuration, and immutable system audit logging.

---

## 2. Features Discovered & Mapped

The following feature inventory maps discovered requirements from the Nexus Finance workspace, codebase templates, and authoritative Zoho People product workflows:

### Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth & RBAC | Multi-Role Authentication | Secure credential authentication supporting Employee, Manager, and Admin roles with session tokens | Email, password, role claim | Auth token/cookie, user session profile, authorized portal routes | 401 Unauthorized for invalid credentials; 403 Forbidden for unauthorized portal route | Zoho People Auth & CmsPortal baseline |
| 2 | Auth & RBAC | Password Recovery Flow | Time-limited 6-digit cryptographic token dispatch and password reset | Registered email address, 6-digit OTP, new password (min 8 chars) | Verification confirmation, session invalidation, password update | 400 Bad Request for expired or mismatched OTP; 422 for weak password | CmsPortal recovery flow & Security standard |
| 3 | Staff Portal | Personal Profile Self-Service | Employee self-view of personal, employment, and banking disbursement details | User ID, editable profile fields (Phone, Address, Emergency Contact) | Comprehensive Employee Profile object | 403 Forbidden when attempting to edit non-permitted fields (Salary, Title, Role) | Zoho People ESS & Leadership Section |
| 4 | Staff Portal | Emergency Contact Management | Maintenance of primary and secondary next-of-kin contacts for staff safety | Contact name, relationship, phone number, physical address | Updated emergency contact record | 400 Bad Request if mandatory phone or relationship is missing | Zoho People Employee Record Spec |
| 5 | Staff Portal | Banking Disbursement Details | Secure recording of Nigerian bank account details (NUBAN) for salary and expense reimbursement | Bank name, 10-digit NUBAN account number, account name | Validated banking docket attached to profile | 422 Unprocessable Entity if account number is not exactly 10 digits | Nigerian Banking Standards & Expense Payout |
| 6 | Leave Mgmt | Leave Balance Tracking | Real-time calculation of allocated, accrued, utilized, pending, and available days per leave type | Employee ID, fiscal year | Array of LeaveBalance objects with numeric balances | 404 Not Found if employee balance docket is uninitialized | Zoho People Time Off Tracker |
| 7 | Leave Mgmt | Leave Request Submission | Employee application for time off with automatic working-day computation | Leave Type ID, Start Date, End Date, Reason, Half-Day flag, Attachment (optional/required) | Created LeaveRequest docket in `PENDING_MANAGER` state | 400 Bad Request if dates are invalid, in past, or overlap with existing leave; 409 if balance insufficient | Zoho People Leave Application Engine |
| 8 | Leave Mgmt | Working Day & Holiday Calculation | Engine calculating net business days excluding weekends (Sat/Sun) and Nigerian statutory public holidays | Start Date, End Date | Net working days (integer or half-day float) | 400 if Start Date > End Date | Statutory Nigerian Gazette & Zoho Holiday Calendar |
| 9 | Leave Mgmt | Medical Certificate Attachment | Mandatory file upload for Sick Leave exceeding 2 consecutive working days | File binary (PDF/PNG/JPG, max 5MB) | Stored attachment URL and audit metadata | 422 Unprocessable Entity if file missing when consecutive sick days > 2 | Zoho People Policy Rule & Corporate Governance |
| 10 | Leave Mgmt | Multi-Tier Manager Approval | Line Manager review, approval, or rejection of subordinate leave requests | Leave Request ID, Action (`APPROVE` / `REJECT`), Comments | Updated LeaveRequest status (`APPROVED` or `REJECTED`), notifications dispatched | 403 Forbidden if approver is not designated manager; 409 if request already finalized | Zoho People Approval Workflow |
| 11 | Leave Mgmt | Leave Request Cancellation | Employee self-cancellation of pending or upcoming approved leaves | Leave Request ID, Cancellation Reason | Status updated to `CANCELLED`, utilized/reserved days restored to balance | 400 Bad Request if leave has already commenced or concluded | Zoho People Cancellation Workflow |
| 12 | Expense Mgmt | Multi-Item Expense Filing | Filing of reimbursement claims containing multiple itemized expenses | Title, Purpose, Category ID, Date Incurred, Merchant, Amount (NGN), Tax, Receipt Upload | Created ExpenseReport in `DRAFT` or `SUBMITTED` state | 400 Bad Request for zero or negative amount; 422 if mandatory receipt missing | Zoho Expense Claim Workflow |
| 13 | Expense Mgmt | Expense Category Allocation | Categorization of claims across predefined corporate accounts (Travel, Client Hospitality, Supplies, Telecoms) | Category ID, Item Details | Categorized ledger entry linked to budget head | 404 Not Found if category is deactivated or invalid | Zoho Expense Category Policy |
| 14 | Expense Mgmt | Receipt Document Validation | Cryptographic verification and secure storage of expense receipts | File upload (PDF, JPEG, PNG, max 10MB) | Sanitized attachment path, MIME type, virus-clean flag | 415 Unsupported Media Type if executable or forbidden extension; 413 if > 10MB | DevSecOps File Security & OWASP Top 10 |
| 15 | Expense Mgmt | Tiered Financial Approval Flow | Dynamic routing based on total claim amount (Manager -> Dept Head -> Finance/MD) | Expense Report ID, Approver Role, Action (`APPROVE`, `REJECT`, `REQUEST_REVISION`) | State transition, automated balance transfer docket | 403 Forbidden if approval threshold exceeds user authorization limit | Zoho Expense Multi-Level Approvals |
| 16 | Expense Mgmt | Reimbursement Disbursement | Finance officer sign-off and marking of expense claims as disbursed | Expense Report ID, Payment Reference, Bank Transfer Date | Status updated to `PAID`, disbursement timestamp recorded | 409 Conflict if claim has not received all prior approvals | Corporate Financial Accounting Controls |
| 17 | Appraisals | Appraisal Cycle Master | Admin creation and scheduling of performance evaluation periods (Annual, Mid-Year, Probation) | Cycle Name, Type, Fiscal Year, Start Date, End Date, Deadlines | Created AppraisalCycle docket in `ACTIVE` state | 400 Bad Request if date bounds overlap with concurrent cycle | Zoho People Performance Review Cycles |
| 18 | Appraisals | Goal & KRA Template Assignment | Role-based assignment of Key Result Areas (KRAs) and measurable goals with percentage weights | Role ID / Department ID, KRA titles, weights, target metrics | Template linked to all matching employee dockets | 422 Unprocessable Entity if sum of KRA weights != 100% | Zoho People Goals & KRA Framework |
| 19 | Appraisals | Staff Self-Appraisal Submission | Employee self-scoring (1-5 scale) against KRAs, core values, and qualitative reflections | Cycle ID, KRA Ratings, Evidence Notes, Self Strengths/Growth areas | AppraisalSubmission updated to `SELF_SUBMITTED` | 400 Bad Request if rating outside 1.0-5.0 range; 403 if cycle deadline passed | Zoho People Self-Evaluation Form |
| 20 | Appraisals | Manager Evaluation & Scoring | Manager assessment, score verification, 1-on-1 feedback, and recommended rating | Submission ID, Manager Ratings, Qualitative Feedback, Training Plan | AppraisalSubmission updated to `MANAGER_REVIEWED` | 403 Forbidden if user is not designated manager | Zoho People Manager Assessment Flow |
| 21 | Appraisals | Score Calibration & Sign-Off | Committee calibration and employee final acknowledgment of appraisal outcome | Submission ID, Final Calibrated Score, Employee Signature/Ack | Appraisal status transitioned to `COMPLETED` | 409 Conflict if manager review is pending | Zoho People Calibration & Closing |
| 22 | Administration | Workforce Directory Management | Comprehensive employee directory with search, department filtering, and pagination | Query string, Department ID, Status filter, Page, Limit | Paginated list of EmployeeSummary objects | 400 Bad Request on malformed query | Zoho People Employee Directory |
| 23 | Administration | Employee Onboarding / Creation | Admin onboarding of new staff member with auto-generated Staff ID and initial leave allocation | First Name, Last Name, Email, Department, Designation, Manager ID, Hire Date | Created UserAccount, EmployeeProfile, and initialized LeaveBalances | 409 Conflict if email or Staff ID already exists | Core HR Administration Engine |
| 24 | Administration | Organizational Hierarchy Tree | Visual reporting hierarchy showing direct reports, team sizes, and management chains | Department ID or Root Manager ID | Recursive tree structure of nodes (Managers & Reports) | 404 Not Found if root entity does not exist | Zoho People Organization Tree |
| 25 | Administration | System Configuration & Policies | HR Admin configuration of leave type quotas, fiscal periods, and expense ceilings | Config key-value pairs, leave policy quotas, rollover limits | Persisted SystemSettings dictionary | 403 Forbidden for non-Admin roles | Zoho People System Settings |
| 26 | Administration | Immutable Audit Trail Logging | Automated, tamper-resistant logging of all state mutations, approvals, and security events | Actor ID, Action, Entity Type, Entity ID, IP Address, Timestamp, Payload Diff | Searchable AuditLog stream | 500 if audit record fails to persist (fail-secure) | DevSecOps NIST SP 800-218 & SEI CERT |

---

## 3. Edge Cases & Boundary Behaviors

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | Leave Balance | Employee requests 5 days Annual Leave with exactly 3.5 days available | Validation engine rejects submission with `409 Conflict` ("Insufficient leave balance: Requested 5.0 days, available 3.5 days"). No overdraft allowed without explicit HR override. |
| 2 | Leave Application | Employee applies for leave spanning Saturday, Sunday, and Christmas Day (Federal Public Holiday) | Date calculation engine detects non-working days; deducts only legitimate business days from balance. Example: Friday to Tuesday (5 calendar days) with weekend and Monday holiday = 2 working days deducted. |
| 3 | Leave Application | Employee submits overlapping leave request for dates already covered by a pending or approved request | System checks date ranges; throws `409 Conflict` ("Date range overlaps with existing leave request [LR-2026-0042]"). |
| 4 | Leave Approval | Line Manager attempts to approve their own personal leave request | Access control engine intercepts action; blocks with `403 Forbidden` ("Self-approval prohibited"). The request automatically routes to Department Head or Managing Director. |
| 5 | Leave Cancellation | Employee attempts to cancel an approved leave that occurred 3 days in the past | Engine blocks cancellation with `400 Bad Request` ("Cannot retroactively cancel past leave. Contact HR Administrator"). |
| 6 | Expense Filing | Employee submits expense claim item for NGN 75,000 without uploading a receipt file | Validator rejects item with `422 Unprocessable Entity` ("Receipt document is mandatory for expense claims exceeding NGN 5,000"). |
| 7 | Expense Upload | User uploads a file named `invoice.pdf.exe` or a file with spoofed MIME type | Sanitization pipeline inspects file signature magic bytes; rejects file with `415 Unsupported Media Type` ("Disallowed file format"). Prevents payload execution. |
| 8 | Expense Routing | Employee submits expense claim of NGN 350,000 | Multi-tier state engine sets initial approval stage to Line Manager. Upon manager approval, status transitions to `PENDING_DEPT_HEAD`, then `PENDING_EXECUTIVE` (MD sign-off required for > NGN 250,000). |
| 9 | Appraisal Cycle | Employee submits self-appraisal with a goal rating of 5.8 on a 1-5 scale | Schema validator intercepts with `422 Unprocessable Entity` ("Score must be between 1.00 and 5.00"). |
| 10 | Appraisal Cycle | HR attempts to publish appraisal template where KRA weightages sum to 95% | Template validation engine rejects publication with `422 Unprocessable Entity` ("KRA weightages must total exactly 100%. Current sum: 95%"). |
| 11 | Appraisal Access | Manager attempts to view peer manager's appraisal form or unassigned department staff | RBAC policy engine evaluates relationship; returns `403 Forbidden` ("Access restricted to assigned direct reports"). |
| 12 | Employee Status | Admin marks employee status as `TERMINATED` or `RESIGNED` | Session manager terminates all active sessions, revokes JWT tokens, auto-rejects pending leave/expense requests, and preserves historical audit logs. |

---

## 4. Role-Based Access Control (RBAC) Specification

Nexus Finance HRMS enforces a strict Principle of Least Privilege (PoLP) across all modules:

### 4.1 Role Definitions
- **`Employee` (Staff)**: Default role for all employees. Can view/edit own profile (restricted fields), view own leave balances, submit leave requests, cancel own pending leaves, create/submit expense reports, perform self-appraisals, and search the public staff directory.
- **`Manager` (Supervisor)**: Inherits all `Employee` capabilities. Can view assigned direct reports, approve/reject subordinate leave requests, approve/reject subordinate expense claims (up to NGN 50,000), submit manager appraisal reviews, and view the team leave calendar.
- **`Admin` (HR Administrator / Superuser)**: Master administrative role. Full CRUD access over Employee Directory, Leave Policies, Holiday Calendars, Expense Categories, Disbursement Dockets, Appraisal Cycles, and System Configurations. Can override approval blocks and access system-wide audit logs.

### 4.2 Comprehensive Permission Matrix

| Resource | Action | Employee | Manager | Admin |
|----------|--------|----------|---------|-------|
| **User / Profile** | View Own Profile | Allow | Allow | Allow |
| | Edit Own Non-Sensitive Fields | Allow | Allow | Allow |
| | Edit Own Salary / Title / Role | Deny | Deny | Allow |
| | View Direct Reports Profiles | Deny | Allow | Allow |
| | View All Employee Profiles | Partial (Directory) | Partial (Directory) | Allow (Full) |
| | Create / Deactivate Employee | Deny | Deny | Allow |
| **Leave Management** | View Own Leave Balances | Allow | Allow | Allow |
| | View Team Leave Calendar | Deny | Allow | Allow |
| | Submit Leave Request | Allow | Allow | Allow |
| | Cancel Own Pending Leave | Allow | Allow | Allow |
| | Approve / Reject Team Leave | Deny | Allow (Reports) | Allow (All) |
| | Configure Leave Policies | Deny | Deny | Allow |
| | Manage Holiday Calendar | Deny | Deny | Allow |
| **Expense System** | View Own Claims | Allow | Allow | Allow |
| | Submit Expense Claim | Allow | Allow | Allow |
| | Edit / Delete Draft Claim | Allow | Allow | Allow |
| | Approve / Reject Team Claim | Deny | Allow (<= 50k NGN) | Allow (All) |
| | Finance Payout / Disbursement | Deny | Deny | Allow (Finance) |
| | Manage Expense Categories | Deny | Deny | Allow |
| **Appraisals** | Submit Self-Appraisal | Allow | Allow | Allow |
| | View Own Completed Appraisal | Allow | Allow | Allow |
| | Submit Manager Evaluation | Deny | Allow (Reports) | Allow (All) |
| | Create / Close Review Cycle | Deny | Deny | Allow |
| | Calibrate & Finalize Scores | Deny | Deny | Allow |
| **System & Security** | View Audit Logs | Deny | Deny | Allow |
| | Configure System Settings | Deny | Deny | Allow |

---

## 5. Domain Entities, Data Models & Relationships

### 5.1 Entity Relationship Overview
```
+------------------+         1:1          +--------------------+
|   UserAccount    | ------------------- |  EmployeeProfile   |
+------------------+                      +--------------------+
        |                                           | 1:N
        |                                           +--------------------+
        | 1:N                                       | LeaveBalance       |
        +-------------------------+                 +--------------------+
        |                         |                 | 1:N
+---------------+         +---------------+         +--------------------+
| LeaveRequest  |         | ExpenseReport |         | LeaveRequest       |
+---------------+         +---------------+         +--------------------+
        | 1:N                     | 1:N             | 1:N
+---------------+         +---------------+         +--------------------+
| ApprovalAudit |         | ExpenseItem   |         | ExpenseReport      |
+---------------+         +---------------+         +--------------------+
                                  | 1:N             | 1:N
                          +---------------+         +--------------------+
                          | ApprovalAudit |         | AppraisalSubmiss.  |
                          +---------------+         +--------------------+
```

### 5.2 Detailed Entity Definitions & Field Schemas

#### Entity 1: `UserAccount`
Represents authentication credentials and security state.
- `id` (UUID, Primary Key)
- `email` (String, Unique, Valid Email Format, Indexed)
- `passwordHash` (String, Argon2id or Bcrypt hash, Salted)
- `role` (Enum: `'EMPLOYEE'`, `'MANAGER'`, `'ADMIN'`)
- `status` (Enum: `'ACTIVE'`, `'INACTIVE'`, `'LOCKED'`, `'TERMINATED'`)
- `failedLoginAttempts` (Integer, Default 0)
- `lockoutUntil` (Timestamp, Nullable)
- `lastLoginAt` (Timestamp, Nullable)
- `passwordChangedAt` (Timestamp, Default now)
- `createdAt` (Timestamp, Default now)
- `updatedAt` (Timestamp, Default now)

#### Entity 2: `EmployeeProfile`
Comprehensive HR record mirroring Zoho People core employee profile.
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key -> `UserAccount.id`, Unique)
- `staffId` (String, Unique, Pattern: `NX-[0-9]{4}`, e.g., `NX-1042`)
- `firstName` (String, Min 2, Max 50 chars)
- `lastName` (String, Min 2, Max 50 chars)
- `middleName` (String, Optional)
- `gender` (Enum: `'MALE'`, `'FEMALE'`, `'PREFER_NOT_TO_SAY'`)
- `dateOfBirth` (Date, ISO 8601, Staff must be >= 18 years)
- `phone` (String, Nigerian E.164 format: `+234...`)
- `personalEmail` (String, Email, Optional)
- `avatarUrl` (String, URL or relative asset path)
- `departmentId` (UUID, Foreign Key -> `Department.id`)
- `designationId` (UUID, Foreign Key -> `Designation.id`)
- `managerId` (UUID, Foreign Key -> `EmployeeProfile.id`, Nullable for MD)
- `employmentType` (Enum: `'FULL_TIME'`, `'CONTRACT'`, `'PROBATION'`, `'INTERN'`)
- `employmentStatus` (Enum: `'ACTIVE'`, `'ON_LEAVE'`, `'PROBATION'`, `'RESIGNED'`, `'TERMINATED'`)
- `hireDate` (Date, ISO 8601)
- `confirmationDate` (Date, Nullable)
- `residentialAddress` (String, Max 255 chars)
- `emergencyContactName` (String, Required)
- `emergencyContactPhone` (String, Required)
- `emergencyContactRelationship` (String, Required)
- `bankName` (String, Commercial Bank Name)
- `bankAccountNumber` (String, 10-digit NUBAN)
- `bankAccountName` (String, Verified account name)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

#### Entity 3: `Department` & `Designation`
Organizational structure units.
- `Department`: `id` (UUID), `name` (String, Unique), `code` (String, e.g., `CRU`, `OPS`, `ENG`, `SALES`, `EXEC`), `headId` (UUID, FK -> `EmployeeProfile.id`, Nullable), `description` (String)
- `Designation`: `id` (UUID), `title` (String), `departmentId` (UUID, FK -> `Department.id`), `level` (Integer, 1 to 10), `minSalary` (Decimal), `maxSalary` (Decimal)

#### Entity 4: `LeaveType` & `LeavePolicy`
Defines statutory and corporate leave rules.
- `id` (UUID, Primary Key)
- `name` (String, e.g., `'Annual Leave'`, `'Sick Leave'`, `'Casual Leave'`, `'Maternity Leave'`, `'Paternity Leave'`, `'Bereavement Leave'`)
- `code` (String, Unique, e.g., `'ANNUAL'`, `'SICK'`, `'CASUAL'`, `'MATERNITY'`, `'PATERNITY'`, `'BEREAVEMENT'`)
- `description` (String)
- `annualQuota` (Float, Standard entitlement days, e.g., Annual: 20.0, Sick: 12.0, Casual: 5.0, Maternity: 84.0, Paternity: 10.0, Bereavement: 5.0)
- `accrualFrequency` (Enum: `'ANNUAL_GRANT'`, `'MONTHLY_ACCRUAL'`)
- `maxConsecutiveDays` (Integer, Nullable, e.g., Casual: 2)
- `minNoticeDays` (Integer, e.g., Annual: 5, Casual: 0, Maternity: 30)
- `requiresAttachment` (Boolean, Default false)
- `attachmentThresholdDays` (Integer, e.g., Sick: 2, meaning > 2 days requires doctor certificate)
- `genderRestriction` (Enum: `'ALL'`, `'FEMALE_ONLY'`, `'MALE_ONLY'`)
- `allowCarryOver` (Boolean, Default true)
- `maxCarryOverDays` (Float, e.g., 5.0)
- `isActive` (Boolean, Default true)

#### Entity 5: `LeaveBalance`
Maintains individual annual entitlements and running balances.
- `id` (UUID, Primary Key)
- `employeeId` (UUID, Foreign Key -> `EmployeeProfile.id`)
- `leaveTypeId` (UUID, Foreign Key -> `LeaveType.id`)
- `fiscalYear` (Integer, e.g., 2026)
- `allocatedDays` (Float, Base policy entitlement)
- `carriedOverDays` (Float, Rollover from prior year)
- `accruedDays` (Float, Accrued to current date)
- `usedDays` (Float, Completed/approved leaves)
- `pendingDays` (Float, Reserved for pending applications)
- `availableDays` (Float, Computed: `(allocatedDays + carriedOverDays) - usedDays - pendingDays`)
- `updatedAt` (Timestamp)
- *Constraint: Unique index on (`employeeId`, `leaveTypeId`, `fiscalYear`)*

#### Entity 6: `LeaveRequest`
The core leave application docket.
- `id` (UUID, Primary Key)
- `requestNumber` (String, Unique, Pattern: `LR-YYYY-[0-9]{4}`, e.g., `LR-2026-0038`)
- `employeeId` (UUID, Foreign Key -> `EmployeeProfile.id`)
- `leaveTypeId` (UUID, Foreign Key -> `LeaveType.id`)
- `startDate` (Date, ISO 8601)
- `endDate` (Date, ISO 8601)
- `isHalfDay` (Boolean, Default false)
- `halfDayPeriod` (Enum: `'FIRST_HALF'`, `'SECOND_HALF'`, Nullable)
- `totalDays` (Float, Calculated net working days)
- `reason` (String, Min 5, Max 500 chars)
- `contactAddressWhileAway` (String, Optional)
- `emergencyPhoneWhileAway` (String, Optional)
- `attachmentUrl` (String, Nullable, Medical/Birth cert path)
- `status` (Enum: `'DRAFT'`, `'SUBMITTED'`, `'APPROVED'`, `'REJECTED'`, `'CANCELLED'`)
- `assignedApproverId` (UUID, Foreign Key -> `EmployeeProfile.id`)
- `submittedAt` (Timestamp)
- `decidedAt` (Timestamp, Nullable)
- `decisionReason` (String, Nullable)

#### Entity 7: `HolidayCalendar`
Maintains national public holidays and custom corporate closures.
- `id` (UUID, Primary Key)
- `name` (String, e.g., `'New Year'`, `'Workers Day'`, `'Democracy Day'`, `'Independence Day'`, `'Eid al-Fitr'`, `'Christmas Day'`)
- `date` (Date, ISO 8601)
- `fiscalYear` (Integer)
- `isRecurring` (Boolean, Default false)
- `description` (String, Optional)

#### Entity 8: `ExpenseCategory`
Standardized corporate expense ledger heads.
- `id` (UUID, Primary Key)
- `name` (String, e.g., `'Travel & Mileage'`, `'Client Hospitality & Sales'`, `'Office Supplies & Stationeries'`, `'Internet & Telecommunications'`, `'Training & Professional Development'`, `'Branch Petty Operations'`)
- `code` (String, Unique, e.g., `'EXP-TRAV'`, `'EXP-HOSP'`, `'EXP-OFFICE'`, `'EXP-TELCO'`, `'EXP-TRAIN'`, `'EXP-OPS'`)
- `maxSingleLimit` (Decimal, Max single item limit in NGN, e.g., 200,000.00)
- `receiptRequired` (Boolean, Default true)
- `receiptThreshold` (Decimal, e.g., 5,000.00 NGN)
- `isActive` (Boolean, Default true)

#### Entity 9: `ExpenseReport` & `ExpenseItem`
Container claim docket and individual itemized expenses.
- `ExpenseReport`:
  - `id` (UUID, Primary Key)
  - `reportNumber` (String, Unique, Pattern: `EXP-YYYY-[0-9]{4}`)
  - `employeeId` (UUID, Foreign Key -> `EmployeeProfile.id`)
  - `title` (String, Min 3, Max 100 chars, e.g., `'Abuja Central Branch Outreach Week 2'`)
  - `purpose` (String, Max 500 chars)
  - `currency` (String, Default `'NGN'`)
  - `totalAmount` (Decimal, Computed sum of items)
  - `status` (Enum: `'DRAFT'`, `'SUBMITTED'`, `'PENDING_LINE_MANAGER'`, `'PENDING_DEPT_HEAD'`, `'PENDING_EXECUTIVE'`, `'APPROVED'`, `'PAID'`, `'REJECTED'`, `'REVISION_REQUESTED'`)
  - `currentApproverId` (UUID, FK -> `EmployeeProfile.id`, Nullable)
  - `submittedAt` (Timestamp, Nullable)
  - `approvedAt` (Timestamp, Nullable)
  - `paidAt` (Timestamp, Nullable)
  - `disbursementReference` (String, Nullable)
- `ExpenseItem`:
  - `id` (UUID, Primary Key)
  - `reportId` (UUID, Foreign Key -> `ExpenseReport.id`)
  - `categoryId` (UUID, Foreign Key -> `ExpenseCategory.id`)
  - `dateIncurred` (Date, ISO 8601)
  - `merchantName` (String, Min 2, Max 100 chars)
  - `amount` (Decimal, Numeric > 0)
  - `taxAmount` (Decimal, Default 0.00)
  - `description` (String, Min 3, Max 255 chars)
  - `receiptUrl` (String, Mandatory if amount > threshold)
  - `receiptFileName` (String, Original upload name)
  - `createdAt` (Timestamp)

#### Entity 10: `AppraisalCycle` & `AppraisalTemplate`
Defines institutional performance governance periods and review metrics.
- `AppraisalCycle`:
  - `id` (UUID, Primary Key)
  - `title` (String, e.g., `'FY 2026 Annual Performance Review'`, `'H1 2026 Mid-Year Appraisal'`)
  - `cycleType` (Enum: `'ANNUAL'`, `'MID_YEAR'`, `'PROBATION_90_DAY'`)
  - `fiscalYear` (Integer)
  - `startDate` (Date)
  - `endDate` (Date)
  - `selfAppraisalDeadline` (Date)
  - `managerReviewDeadline` (Date)
  - `status` (Enum: `'DRAFT'`, `'ACTIVE'`, `'IN_REVIEW'`, `'CALIBRATION'`, `'CLOSED'`)
  - `createdAt` (Timestamp)
- `AppraisalTemplate`:
  - `id` (UUID, Primary Key)
  - `name` (String, e.g., `'Credit Risk & Underwriting Template'`, `'Branch Operations Template'`)
  - `departmentId` (UUID, FK -> `Department.id`, Nullable for global)
  - `kraWeightagePercent` (Integer, Default 70)
  - `competencyWeightagePercent` (Integer, Default 30)
  - `sections` (JSON array of sections, questions, and rating rubrics)

#### Entity 11: `AppraisalSubmission` & `AppraisalGoalKRA`
The live review evaluation form for an individual staff member.
- `AppraisalSubmission`:
  - `id` (UUID, Primary Key)
  - `cycleId` (UUID, Foreign Key -> `AppraisalCycle.id`)
  - `templateId` (UUID, Foreign Key -> `AppraisalTemplate.id`)
  - `employeeId` (UUID, Foreign Key -> `EmployeeProfile.id`)
  - `managerId` (UUID, Foreign Key -> `EmployeeProfile.id`)
  - `selfScore` (Float, 1.00 to 5.00, Nullable until submitted)
  - `managerScore` (Float, 1.00 to 5.00, Nullable until reviewed)
  - `finalCalibratedScore` (Float, 1.00 to 5.00, Nullable until calibrated)
  - `status` (Enum: `'NOT_STARTED'`, `'SELF_IN_PROGRESS'`, `'SELF_SUBMITTED'`, `'MANAGER_REVIEW_IN_PROGRESS'`, `'MANAGER_SUBMITTED'`, `'CALIBRATION_PENDING'`, `'COMPLETED'`)
  - `selfSubmittedAt` (Timestamp, Nullable)
  - `managerSubmittedAt` (Timestamp, Nullable)
  - `acknowledgedAt` (Timestamp, Nullable)
  - `employeeComments` (String, Nullable)
  - `managerSummaryFeedback` (String, Nullable)
  - `developmentPlan` (Text, Strengths, training needs, next goals)
- `AppraisalGoalKRA`:
  - `id` (UUID, Primary Key)
  - `submissionId` (UUID, Foreign Key -> `AppraisalSubmission.id`)
  - `title` (String, e.g., `'Credit Quality & NPL Ratio Suppression'`)
  - `description` (String)
  - `weightage` (Integer, Percentage 1-100)
  - `targetMetric` (String, e.g., `'Maintain 30-day PAR under 2.5%'`)
  - `selfRating` (Float, 1.0 to 5.0)
  - `selfComments` (String)
  - `managerRating` (Float, 1.0 to 5.0, Nullable)
  - `managerComments` (String, Nullable)

#### Entity 12: `AuditLog`
Immutable security and compliance log.
- `id` (UUID, Primary Key)
- `actorId` (UUID, Foreign Key -> `UserAccount.id`, Nullable for system actions)
- `action` (String, e.g., `'AUTH_LOGIN'`, `'LEAVE_SUBMITTED'`, `'LEAVE_APPROVED'`, `'EXPENSE_SUBMITTED'`, `'EXPENSE_DISBURSED'`, `'PROFILE_UPDATED'`)
- `entityType` (String, e.g., `'LeaveRequest'`, `'ExpenseReport'`, `'EmployeeProfile'`)
- `entityId` (UUID, Target primary key)
- `ipAddress` (String, Client IPv4/IPv6)
- `userAgent` (String)
- `metadataDiff` (JSON, Detailed previous and new state snapshot)
- `timestamp` (Timestamp, Default now)

---

## 6. State Machines & Workflow Automation

### 6.1 Leave Request State Machine
```
       +--------------+
       |    DRAFT     |
       +--------------+
              |
         submit() [Reserves days in LeaveBalance.pendingDays]
              v
       +--------------+
  +--->|  SUBMITTED   | (Pending Manager Review)
  |    +--------------+
  |      |          |
  | reject()      approve() [Transfers pendingDays -> usedDays]
  | [Restores        v
  |  balance]  +--------------+
  |      |     |   APPROVED   |
  |      v     +--------------+
  |  +-------+        |
  |  |REJECTED        | cancel() [Only before startDate; restores usedDays]
  |  +-------+        v
  |            +--------------+
  |            |  CANCELLED   |
  |            +--------------+
  |
  +-- withdraw() [Prior to manager review; restores pendingDays]
```

#### Transition Guards:
1. `DRAFT -> SUBMITTED`:
   - Guard 1: `totalDays <= availableDays`.
   - Guard 2: No overlapping requests in `SUBMITTED` or `APPROVED` status.
   - Action: `LeaveBalance.pendingDays += totalDays`.
2. `SUBMITTED -> APPROVED`:
   - Guard: Actor must be `assignedApproverId` or `Admin`.
   - Action: `LeaveBalance.pendingDays -= totalDays`; `LeaveBalance.usedDays += totalDays`.
3. `SUBMITTED -> REJECTED`:
   - Action: `LeaveBalance.pendingDays -= totalDays` (Restores balance).
4. `APPROVED -> CANCELLED`:
   - Guard: `CurrentDate < StartDate`.
   - Action: `LeaveBalance.usedDays -= totalDays` (Restores balance).

---

### 6.2 Expense Claim State Machine
```
   +--------------+
   |    DRAFT     |
   +--------------+
          | submit() [Validates receipts & totals]
          v
   +-----------------------+
   | PENDING_LINE_MANAGER  |
   +-----------------------+
     |         |
     | reject()| approve()
     |         +-------------------------------------+
     |         |                                     |
     |         | Total <= 50k NGN                    | Total > 50k NGN
     |         v                                     v
     |   +-------------------+              +-------------------+
     |   |  PENDING_FINANCE  |              | PENDING_DEPT_HEAD |
     |   +-------------------+              +-------------------+
     |         |                                     |
     |         | approve()                           | approve()
     |         |                                     v
     |         |                            +-------------------+
     |         |                            | PENDING_EXECUTIVE | (> 250k NGN)
     |         |                            +-------------------+
     |         |                                     | approve()
     |         +------------------+------------------+
     |                            |
     |                            v
     |                    +---------------+
     |                    |   APPROVED    |
     |                    +---------------+
     |                            | disburse() [Records payment ref]
     |                            v
     |                    +---------------+
     |                    |     PAID      |
     |                    +---------------+
     |
     v
+----------+
| REJECTED |  (or REVISION_REQUESTED -> Returns to employee for edit)
+----------+
```

---

### 6.3 Appraisal Review State Machine
```
       +-----------------------+
       |      NOT_STARTED      |
       +-----------------------+
                   | start()
                   v
       +-----------------------+
       |   SELF_IN_PROGRESS    |
       +-----------------------+
                   | submitSelf() [Validates 100% goal completion]
                   v
       +-----------------------+
       |    SELF_SUBMITTED     |
       +-----------------------+
                   | beginManagerReview()
                   v
       +-----------------------+
       |   MANAGER_REVIEWING   |
       +-----------------------+
                   | submitManager() [Computes weighted score]
                   v
       +-----------------------+
       |  CALIBRATION_PENDING  | (HR Committee Calibration)
       +-----------------------+
                   | calibrateAndPublish()
                   v
       +-----------------------+
       |      COMPLETED        | (Staff Acknowledged)
       +-----------------------+
```

---

## 7. Business Logic & Validation Engine Rules

### 7.1 Working Days Calculation Algorithm
When evaluating leave requests:
1. Generate sequence of calendar dates from `startDate` to `endDate` (inclusive).
2. For each date:
   - Check day of week: If Saturday (6) or Sunday (0), exclude from count.
   - Check `HolidayCalendar`: If date matches an active public holiday in the current fiscal year, exclude from count.
   - If `isHalfDay` is true, add `0.5` to working days accumulator.
   - Otherwise, add `1.0` to working days accumulator.
3. Return `totalDays`. Must be > 0.0.

### 7.2 Appraisal Scoring Formula
Appraisal performance rating operates on a 5-point scale:
- $Score_{KRA} = \sum_{i=1}^{n} \left( Rating_{i} \times \frac{Weightage_{i}}{100} \right)$
- $Score_{Competency} = \frac{1}{m} \sum_{j=1}^{m} Rating_{j}$
- $OverallScore = (Score_{KRA} \times 0.70) + (Score_{Competency} \times 0.30)$
- **Rating Tier Rubric**:
  - `4.50 - 5.00`: Grade A — Exceptional / Exceeds Benchmark
  - `3.50 - 4.49`: Grade B — Commendable / Meets High Standards
  - `2.75 - 3.49`: Grade C — Satisfactory / Standard Core Performance
  - `2.00 - 2.74`: Grade D — Needs Targeted Improvement / PIP Candidate
  - `1.00 - 1.99`: Grade E — Unsatisfactory / Performance Intervention

---

## 8. RESTful API Specification

All endpoints are prefixed with `/api/v1` and strictly enforce server-side schema validation (via Zod), JSON request bodies, and secure session/cookie authorization.

### 8.1 Authentication & Session
- `POST /api/v1/auth/login`: Authenticate staff or admin; issues HttpOnly cookie.
  - Body: `{ email, password }`
  - Returns: `{ user: { id, email, role, profile: { id, staffId, firstName, lastName, department, designation, avatarUrl } } }`
- `POST /api/v1/auth/logout`: Revoke active session token.
- `GET /api/v1/auth/me`: Inspect current authenticated user and role claims.
- `POST /api/v1/auth/recover/request`: Trigger 6-digit recovery OTP to registered email.
  - Body: `{ email }`
- `POST /api/v1/auth/recover/verify`: Complete password reset.
  - Body: `{ email, token, newPassword }`

### 8.2 Employee Directory & Profiles
- `GET /api/v1/employees`: Search and list employee directory.
  - Query: `search`, `departmentId`, `status`, `page`, `limit`
  - Returns: `{ data: EmployeeSummary[], pagination: { total, page, limit, totalPages } }`
- `GET /api/v1/employees/:id`: Retrieve comprehensive profile docket.
- `PATCH /api/v1/employees/:id`: Update personal details (Staff: contact info only; Admin: full record).
  - Body: `{ phone?, residentialAddress?, emergencyContactName?, emergencyContactPhone?, emergencyContactRelationship?, bankName?, bankAccountNumber?, bankAccountName? }`
- `POST /api/v1/employees`: Admin onboarding of new staff member.
  - Body: `{ firstName, lastName, email, departmentId, designationId, managerId?, hireDate, employmentType, initialAnnualLeaveDays? }`
- `GET /api/v1/employees/:id/reports`: List direct subordinates for an assigned manager.

### 8.3 Leave Management
- `GET /api/v1/leaves/balances`: Retrieve authenticated user's current leave balances for the fiscal year.
  - Returns: `LeaveBalance[]`
- `GET /api/v1/leaves/balances/:employeeId`: Admin/Manager retrieval of staff balance docket.
- `POST /api/v1/leaves/calculate`: Stateless preview of net working days between two dates.
  - Body: `{ startDate, endDate, isHalfDay? }`
  - Returns: `{ workingDays, calendarDays, holidaysEncountered: string[] }`
- `GET /api/v1/leaves/requests`: List leave applications.
  - Query: `scope` (`'mine'` | `'team'` | `'all'`), `status`, `leaveTypeId`, `year`
  - Returns: `LeaveRequest[]`
- `POST /api/v1/leaves/requests`: Submit a new leave application.
  - Body: `{ leaveTypeId, startDate, endDate, isHalfDay?, halfDayPeriod?, reason, attachmentUrl?, emergencyPhoneWhileAway? }`
  - Returns: `LeaveRequest` (Created with status `SUBMITTED`)
- `PATCH /api/v1/leaves/requests/:id/action`: Manager or Admin approval/rejection.
  - Body: `{ action: 'APPROVE' | 'REJECT', decisionReason? }`
  - Returns: `LeaveRequest`
- `POST /api/v1/leaves/requests/:id/cancel`: Employee cancellation of upcoming leave.
  - Body: `{ reason }`
- `GET /api/v1/leaves/calendar`: Team calendar view of scheduled absences.
  - Query: `month`, `year`, `departmentId`

### 8.4 Expense Reimbursement
- `GET /api/v1/expenses/categories`: List active corporate expense categories and limits.
- `GET /api/v1/expenses/reports`: List expense claims.
  - Query: `scope` (`'mine'` | `'team'` | `'all'`), `status`, `page`, `limit`
  - Returns: `ExpenseReport[]`
- `GET /api/v1/expenses/reports/:id`: Retrieve detailed claim with itemized receipts.
- `POST /api/v1/expenses/reports`: Create a new draft expense claim.
  - Body: `{ title, purpose, items: [{ categoryId, dateIncurred, merchantName, amount, taxAmount?, description, receiptUrl? }] }`
- `PUT /api/v1/expenses/reports/:id`: Update draft or revision-requested expense claim.
- `POST /api/v1/expenses/reports/:id/submit`: Submit claim into approval queue.
- `PATCH /api/v1/expenses/reports/:id/action`: Approver action.
  - Body: `{ action: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION', comments? }`
- `POST /api/v1/expenses/reports/:id/disburse`: Finance officer disbursement confirmation.
  - Body: `{ disbursementReference, paidDate }`
- `POST /api/v1/expenses/upload-receipt`: Secure multipart receipt upload.
  - Payload: File (PDF, PNG, JPG, max 10MB)
  - Returns: `{ fileUrl, fileName, mimeType, sizeBytes }`

### 8.5 Appraisals & Performance
- `GET /api/v1/appraisals/cycles`: List appraisal cycles.
  - Query: `status`
- `POST /api/v1/appraisals/cycles`: Admin creation of new appraisal cycle.
  - Body: `{ title, cycleType, fiscalYear, startDate, endDate, selfAppraisalDeadline, managerReviewDeadline }`
- `GET /api/v1/appraisals/submissions/me`: Retrieve current employee's active appraisal form.
- `GET /api/v1/appraisals/submissions/team`: Manager list of team appraisals.
- `GET /api/v1/appraisals/submissions/:id`: Retrieve specific appraisal docket.
- `PUT /api/v1/appraisals/submissions/:id/self`: Submit self-appraisal ratings and reflections.
  - Body: `{ goals: [{ goalId, selfRating, selfComments }], employeeComments, developmentPlan? }`
- `PUT /api/v1/appraisals/submissions/:id/manager`: Submit manager evaluation.
  - Body: `{ goals: [{ goalId, managerRating, managerComments }], managerSummaryFeedback, trainingRecommendations? }`
- `POST /api/v1/appraisals/submissions/:id/acknowledge`: Staff acknowledgment of final rating.

### 8.6 System Administration & Audit
- `GET /api/v1/admin/audit-logs`: Search immutable audit logs.
  - Query: `actorId`, `action`, `startDate`, `endDate`, `page`, `limit`
- `GET /api/v1/admin/settings`: View system policy configuration.
- `PATCH /api/v1/admin/settings`: Update corporate policies.

---

## 9. User Interface & Screen Inventory

### 9.1 Staff Portal (Employee Self-Service)
1. **Staff Home / Dashboard (`/staff`)**:
   - Welcome banner with greeting, date, and quick action cards ("Apply for Leave", "Submit Expense Claim", "View Profile").
   - At-a-glance status chips: Available Annual Leave Balance, Pending Expense Claims Total (NGN), Active Appraisal Status.
   - Quick leave summary card displaying current absence calendar and pending approval badges.
   - Recent activity stream showing latest status changes on submitted items.
2. **My Profile (`/staff/profile`)**:
   - Employee portrait, staff ID tag, corporate email, department, designation, and reporting manager chip.
   - Tabbed layout: "Personal Information", "Job & Hierarchy", "Banking & Reimbursement", "Emergency Contacts".
   - In-place edit drawer for editable fields with instant validation feedback.
3. **Leave Management Hub (`/staff/leaves`)**:
   - Entitlement stat cards: Annual Leave, Sick Leave, Casual Leave with circular progress rings indicating used vs available days.
   - "Apply for Leave" modal with interactive date range picker, automatic working-day counter, half-day toggle, reason textarea, and medical upload slot.
   - Filterable table of past and pending leave applications with color-coded status badges (`Approved` = emerald, `Pending` = amber/sapphire, `Rejected` = rose).
   - "Cancel Request" action trigger on pending or upcoming dockets.
4. **Expense Reimbursement Hub (`/staff/expenses`)**:
   - Expense summary metrics: Total Claimed (YTD), Pending Approval (NGN), Reimbursed / Paid (NGN).
   - "New Expense Report" multi-step dialog: Report Header -> Add Itemized Expenses -> Upload Receipts (drag-and-drop) -> Review & Submit.
   - History list of claims with expandable item drawer showing merchant names, dates, amounts, and thumbnail view of uploaded receipts.
5. **Performance & Appraisal Center (`/staff/appraisals`)**:
   - Active review cycle card with deadline countdown timer.
   - Interactive self-appraisal form: Goal/KRA cards with 5-star or 1-to-5 segmented slider rating, evidence text input, and overall self-reflection.
   - Historical review archive showing prior cycle final calibrated ratings and manager feedback.
6. **Workforce Directory (`/staff/directory`)**:
   - Company-wide staff directory cards featuring avatars, job titles, department tags, and quick email links.

### 9.2 Admin Portal (HR & Operations Management)
1. **Admin Master Dashboard (`/admin`)**:
   - Executive operational KPI grid: Total Headcount, Active Staff on Leave Today, Pending Leave Approvals Queue, Pending Expense Payout Queue (NGN), Active Appraisal Cycle Progress.
   - Quick Approval Queue: Unified inbox where managers and admins can review and action subordinate leave and expense submissions in one click.
2. **Employee Workforce Directory (`/admin/employees`)**:
   - Data table with search, department filtering, status filters (`Active`, `Probation`, `Terminated`).
   - "Onboard New Employee" modal dialog.
   - Employee Detail Dossier: Full administrative view with tabs for Profile, Leave Balance Adjustments, Expense History, and Appraisal History.
3. **Leave Administration & Approvals (`/admin/leaves`)**:
   - Approval Inbox with split-pane preview: Left side list of pending leave requests; Right side details (employee record, leave balance impact, working days calculation, medical certificate preview, Approve/Reject buttons with reason prompt).
   - Leave Policy Configuration table: Set annual quotas, accrual rules, and carry-over limits.
   - Holiday Calendar Manager: Add/remove federal public holidays and bank holidays.
4. **Expense Review & Finance Disbursement Queue (`/admin/expenses`)**:
   - Finance approval docket: View receipts in high-resolution lightbox, verify line-item amounts, check category allocation, and approve/reject claims.
   - Disbursement Batching Docket: Export approved claims, mark claims as `Disbursed` / `Paid`, and record bank transaction reference numbers.
5. **Appraisal Cycle Master & Score Calibration (`/admin/appraisals`)**:
   - Cycle Lifecycle Manager: Create new cycle, configure deadlines, assign review templates to departments.
   - Calibration Grid: Departmental score matrix comparing self-ratings vs manager ratings with bell-curve distribution visualizer and final calibration lock.
6. **Security & Audit Logs (`/admin/audit-logs`)**:
   - Live stream of immutable audit logs with filtering by actor, action type, and date range.

---

## 10. Design System & Motion Specification

In strict compliance with the Nexus Finance Design System and App Motion Design guidelines:
- **Typography**:
  - Headings & Page Titles: `Bricolage Grotesque` (Font weights 500, 600).
  - Body Text, Controls, Forms: `Instrument Sans` / `DM Sans` (Font weights 400, 600).
  - Numeric & Monetary Values: Tabular numerals for financial alignment (`font-variant-numeric: tabular-nums`).
- **Color Palette**:
  - `Canvas`: `#F7F8FA` (Light) / `#0D1624` (Dark)
  - `Surface`: `#FFFFFF` (Light) / `#121E2E` (Dark)
  - `Secondary Surface`: `#EDF2F6` (Light) / `#192A3E` (Dark)
  - `Brand Sapphire` (Primary Action & Selection): `#0D51B2` (Light) / `#8AB8FF` (Dark)
  - `Restrained Emerald` (Positive Financial & Approval Status): `#007B58` (Light) / `#69D3B0` (Dark)
  - `Ink` (Primary Text): `#101E30` (Light) / `#F3F6FA` (Dark)
  - `Muted` (Secondary Text): `#526174` (Light) / `#B3BFD0` (Dark)
- **Geometry & Rhythm**:
  - 4px baseline grid rhythm.
  - Cards: `12px` border radius (`rounded-xl`), subtle border `border-rule`.
  - Buttons and Form Controls: `7px` to `8px` border radius.
- **Motion Principles**:
  - Micro-interactions: Instant visual feedback on button clicks, toggle switches, and tab selections.
  - Contextual Transitions: Seamless modal entry (`fade-in`, scale `0.98 -> 1.00`), drawer slides, and tab switching via `framer-motion` / `motion`.
  - Natural Easing: Cubic-bezier easing (`easeOut`, `cubic-bezier(0.16, 1, 0.3, 1)`) rather than linear motion.
  - Perceived Performance: Skeleton loaders and progressive loading states for data retrieval across profile, leaves, and expenses.

---

## 11. Security, DevSecOps & Compliance Traceability

The HRMS functional design directly integrates the five required security frameworks:
1. **OWASP Top 10**:
   - Broken Access Control: Zero client-side authorization trusts; all endpoints enforce server-side RBAC and verify ownership/reporting hierarchy.
   - Injection: Complete separation of parameters via schema-validated ORM models.
   - Cryptographic Failures: Passwords hashed using Argon2id with unique salt; session cookies set with `HttpOnly`, `SameSite=Strict`, `Secure`.
2. **NIST SSDF (SP 800-218)**:
   - Produce Well-Secured Software: All inputs validated through Zod schemas before hitting business logic.
   - Secure Defaults: Strict principle of least privilege, default-deny authorization on all management routes.
3. **SEI CERT Coding Standards**:
   - Boundary checks on array bounds and numeric ranges (ratings 1-5, days > 0, currency amounts > 0).
   - Fail-safe defaults: Any unexpected runtime error aborts transaction and returns generic sanitized error message without leaking stack traces.
4. **CWE / SANS Top 25**:
   - Neutralizes CWE-79 (XSS) via React automatic escaping and strict input sanitization.
   - Neutralizes CWE-89 (SQLi) via parameterized ORM access.
   - Neutralizes CWE-269 (Improper Privilege Management) via server-side role and hierarchical checks.
   - Neutralizes CWE-434 (Unrestricted File Upload) via MIME-type verification, extension whitelisting (PDF, JPG, PNG only), and size limits (10MB).
5. **Microsoft Security Development Lifecycle (SDL)**:
   - Attack surface reduction: Sensitive employee compensation, bank details, and appraisal scores restricted to authorized role holders.
   - Tamper-evident logging: Immutable audit trail records actor, IP, timestamp, and payload changes.

---

## 12. Verification & Acceptance Criteria Matrix

| Verification Item | Acceptance Test Criteria | Target Result |
|-------------------|--------------------------|---------------|
| **V-01: Profile Self-Service** | Authenticated employee navigates to `/staff/profile`, updates phone number and emergency contact, and refreshes page. | Changes persist and are reflected in database. Attempting to modify salary or title via payload returns `403 Forbidden`. |
| **V-02: Leave Calculation** | Request leave from Friday Dec 18 to Tuesday Dec 22 (inclusive of Saturday/Sunday). | Engine computes exactly 3 working days (Fri, Mon, Tue). Saturday and Sunday are excluded. |
| **V-03: Holiday Exclusion** | Request leave spanning a documented Nigerian public holiday (e.g. Oct 1). | Public holiday is excluded from deduction. System displays holiday badge in breakdown. |
| **V-04: Balance Deduction** | Employee applies for 3 days leave. Leave balance before: 20 available. | Immediately upon submission, available balance drops to 17 (3 in pending). Upon approval, used becomes 3, pending becomes 0, available remains 17. Upon rejection, available restores to 20. |
| **V-05: Double Booking Guard** | Apply for leave overlapping with an existing pending/approved leave request. | Validator intercepts and rejects with `409 Conflict`. |
| **V-06: Self-Approval Guard** | Manager applies for leave; attempts to approve own request via API. | System returns `403 Forbidden` ("Self-approval prohibited"). |
| **V-07: Medical Note Enforcement** | Apply for Sick Leave for 3 consecutive working days without attaching document. | Submission fails with `422 Unprocessable Entity` ("Doctor certificate required for sick leave > 2 days"). |
| **V-08: Expense Receipt Gate** | Submit expense item for NGN 25,000 without receipt upload. | Submission rejected with `422 Unprocessable Entity` ("Receipt required for expenses > 5,000 NGN"). |
| **V-09: Multi-Tier Expense Approval** | Employee submits NGN 180,000 expense claim. | Routes first to Line Manager (`PENDING_LINE_MANAGER`). Upon approval, automatically routes to Department Head (`PENDING_DEPT_HEAD`). |
| **V-10: Finance Payout Sign-off** | Finance officer reviews approved claim, inputs transaction reference `TRX-998822`, and clicks Disburse. | Status updates to `PAID`, disbursement reference recorded, employee notified. |
| **V-11: Appraisal Weightage Check** | Admin creates appraisal template with KRA weights totaling 85%. | Template creation rejected with `422 Unprocessable Entity` ("Weights must equal 100%"). |
| **V-12: Appraisal Score Calibration** | Employee completes self-appraisal (4.2); Manager completes review (3.8). Committee calibrates to 3.9 and publishes. | Final score locked at 3.9; status transitions to `COMPLETED`; employee can view and acknowledge. |
| **V-13: Audit Trail Immutability** | Perform leave approval, expense reimbursement, and profile edit. Inspect `/api/v1/admin/audit-logs`. | All three events recorded with actor ID, IP address, exact timestamp, and state diff. |

---

*End of Functional Specification Document*
