# E2E Test Infrastructure Specification & Architecture Document (TEST_INFRA.md)
**Project:** Nexus Finance — Production HRMS & Expense Management Suite (Zoho People Replication)  
**Author:** `e2e_test_writer_1` (E2E Testing Track Architect & Writer)  
**Date:** November 10, 2026  
**Status:** Complete & Authoritative  

---

## 1. Executive Summary & Testing Philosophy

This document defines the architecture, execution protocol, and test design for the comprehensive, opaque-box, requirement-driven End-to-End (E2E) Verification Suite of Nexus Finance HRMS.

The test suite operates strictly on **opaque-box principles**:
- **Requirement-Driven**: Every test assertion is derived directly from the authoritative Functional Specification (`functional_spec.md`) and Master Architecture Contract (`PROJECT.md`), never from internal implementation quirks.
- **Zero-Implementation Coupling**: Tests interact exclusively with external interfaces: HTTP REST API endpoints (`/api/v1/*`), HTTP status codes, JSON payload contracts, and HTTP `Set-Cookie` session headers.
- **Progressive Testability & Zero-Network Resilience**: The test harness supports dual-mode operation:
  1. **In-Process Reference Oracle**: Natively executes against an in-process specification reference server with zero TCP network socket overhead, ensuring 100% deterministic, ultra-fast test execution in sandboxed environments without requiring elevated network permissions.
  2. **Live Server Integration**: Seamlessly targets any live running Express server via the `API_BASE_URL` environment variable (e.g. `API_BASE_URL=http://localhost:3001`), verifying actual production server builds without modifying a single test line.

---

## 2. Toolchain & Runner Configuration

The test infrastructure leverages modern Node.js 24 runtime features:
- **Test Runner**: Native Node.js Test Runner (`node:test`, `node:test/reporters`).
- **Assertion Library**: Native Node.js Strict Assertions (`node:assert/strict`).
- **TypeScript Support**: Native Node.js 24 TypeScript type stripping (`node --test`), with full fallback compatibility for `npx tsx --test`.
- **Zero Third-Party Test Dependencies**: Eliminates test runner installation overhead, version drift, and external registry vulnerability vectors.

---

## 3. Directory Layout & Suite Hierarchy

```
tests/
├── fixtures/
│   ├── seedData.ts                       # Standard test users, roles, leave quotas, expense categories, Nigerian 2026 statutory holidays
│   ├── mockFiles.ts                      # Binary buffers: valid PNG, JPEG, PDF and invalid EXE (MZ header), shell scripts, oversized buffers
│   └── referenceServer.ts                # Authoritative in-memory specification reference oracle
├── helpers/
│   ├── testClient.ts                     # Opaque-box HTTP client with automated cookie jar session tracking
│   └── testHarness.ts                    # Server lifecycle manager, dual-mode target resolver, and database state reset
├── e2e/
│   ├── tier1-features/                   # Tier 1: Feature Coverage (Happy Path Verification)
│   │   ├── auth-rbac.test.ts             # F01, F02, F24, F25 (Login, session cookies, RBAC, error envelope)
│   │   ├── profile.test.ts               # F03 (Staff profile self-service, NUBAN, emergency contacts)
│   │   ├── leave-balances.test.ts        # F04, F12 (Leave balances, quotas, working-day math, holiday exclusions)
│   │   ├── leave-application.test.ts     # F05, F06, F13 (Submission, reservation, approval, rejection, cancellation)
│   │   ├── expenses.test.ts              # F07, F08, F09, F14, F15 (Filing, receipts, history, approval, payout)
│   │   ├── appraisals.test.ts            # F10, F16, F17, F18 (Cycles, self-review, manager 70/30 score, calibration)
│   │   ├── workforce-directory.test.ts   # F11, F19, F20 (Directory search, admin onboarding, role administration)
│   │   ├── audit-security.test.ts        # F21, F24, F25 (Immutable audit trail, schema validation, security headers)
│   │   └── architecture-design.test.ts   # F22, F23, F26 (Clean layout, design tokens, typography, test harness)
│   │
│   ├── tier2-boundaries/                 # Tier 2: Boundary & Corner Cases
│   │   ├── auth-rbac-boundaries.test.ts  # Empty inputs, wrong passwords, deactivated accounts, non-permitted field edits
│   │   ├── leave-boundaries.test.ts      # Zero-overdraft, inverted dates, weekend-only, double-booking, sick leave doctor note gate, self-approval
│   │   ├── expense-boundaries.test.ts    # Zero/negative amounts, >5k NGN receipt gate, category caps, invalid MIME EXE, 10MB limit, self-approval
│   │   ├── appraisal-boundaries.test.ts  # Rating bounds 1.0-5.0, weightage sum != 100%, peer manager denial, premature calibration
│   │   └── admin-boundaries.test.ts      # Onboarding missing fields, duplicate emails, invalid NUBAN, non-admin settings edits
│   │
│   ├── tier3-combinations/               # Tier 3: Cross-Feature Combinations
│   │   ├── leave-workflow-combinations.test.ts      # Full lifecycle: submit -> reserve -> approve -> deduct -> audit; cancellation; concurrent math
│   │   ├── expense-workflow-combinations.test.ts    # Multi-tier escalation (>50k NGN to Dept Head), revision requested lifecycle
│   │   ├── appraisal-workflow-combinations.test.ts  # Complete review pipeline: cycle -> self-score -> manager 70/30 -> calibration -> sign-off
│   │   └── employee-lifecycle-combinations.test.ts  # Onboard -> default balances -> profile -> promotion to manager -> deactivation
│   │
│   └── tier4-scenarios/                  # Tier 4: Real-World Scenarios
│       ├── complete-employee-lifecycle.test.ts       # Multi-month simulation: Amara Okafor onboarding to senior promotion
│       ├── multi-item-expense-reimbursement.test.ts  # 5-item Abuja branch overhaul with multi-tier routing & First Bank batch payout
│       ├── year-end-appraisal-calibration.test.ts    # Multi-employee calibration grid (Grade A to Grade D PIP) with committee sign-off
│       └── workforce-restructuring-rollover.test.ts  # Fiscal year-end rollover capped at 5 days + departmental transfer
│
└── testRunner.ts                         # Standalone runner with formatted output reporting across all 4 tiers
```

---

## 4. Test Tiers & Systematic Coverage Inventory

### Tier 1: Feature Coverage (65 Tests)
Validates the primary functional behavior (happy path) for all 26 features defined in `PROJECT.md`:
- **Auth & RBAC**: Login for Employee, Manager, Admin; session cookie issuance; logout; recovery OTP dispatch & verification; endpoint authorization guards; fail-secure envelopes.
- **Profile Self-Service**: Contact details, residential address, emergency contact, 10-digit NUBAN bank accounts.
- **Leave Balances**: 6 statutory leave types (Annual 20, Sick 12, Casual 5, Maternity 84, Paternity 10, Bereavement 5); working days excluding weekends and statutory Nigerian gazetted holidays (New Year, Workers' Day, Independence Day, Christmas, etc.); half-day calculations.
- **Leave Application**: Submission; real-time balance reservation; manager approval; manager rejection; employee cancellation.
- **Expenses**: Category limits; receipt uploads (PNG, PDF); multi-item filing; manager sign-off; finance disbursement with bank references.
- **Appraisals**: Review cycle creation; self-evaluations (1-5 scale); manager scoring with 70/30 formula; HR calibration; employee acknowledgment.
- **Workforce Directory & Governance**: Search by name; filter by department; pagination; admin onboarding with staff ID; role promotion; account deactivation.
- **Security & Scaffolding**: Structured audit trail; Zod schema enforcement; security headers (nosniff, DENY, HSTS); clean architecture directory structure; official design tokens (Sapphire `#0D51B2`, Emerald `#007B58`, Ink, Canvas).

### Tier 2: Boundary & Corner Cases (45 Tests)
Exhaustively stresses boundary conditions, defensive gates, and security invariants:
- **Authentication**: Empty credentials; non-existent emails; incorrect passwords; suspended/inactive accounts; missing or spoofed cookies; weak reset passwords (<8 characters); invalid OTPs.
- **Leave Boundaries**:
  - Zero-overdraft protection (`409 Conflict` when requested > available).
  - Inverted calendar dates (`400 Bad Request` when endDate < startDate).
  - Zero working days (`400 Bad Request` when spanning exclusively weekends/holidays).
  - Double-booking guard (`409 Conflict` for overlapping date intervals).
  - Medical certificate gate (`422 Unprocessable Entity` for Sick Leave > 2 days without document).
  - Casual leave consecutive day ceiling (`422 Unprocessable Entity` for > 2 days).
  - Self-approval prohibition (`403 Forbidden` when manager attempts to approve own leave).
  - Hierarchical guard (`403 Forbidden` when manager attempts to approve leave for staff not in their reporting tree).
  - Retroactive cancellation gate (`400 Bad Request` when attempting to cancel approved past leave).
- **Expense Boundaries**:
  - Zero and negative amounts (`400 Bad Request`).
  - Mandatory receipt threshold (`422 Unprocessable Entity` for items > 5,000 NGN without receipt).
  - Category single-item limits (`422 Unprocessable Entity` when amount exceeds category ceiling).
  - Disallowed file formats (`415 Unsupported Media Type` for executable MZ headers and shell scripts).
  - Payload size limits (`413 Payload Too Large` for uploads > 10MB).
  - Self-approval prohibition (`403 Forbidden` when manager attempts to approve own claim).
  - Premature disbursement block (`409 Conflict` when claim is not in `APPROVED` status).
  - Unprivileged disbursement block (`403 Forbidden` for non-finance users).
- **Appraisal Boundaries**:
  - Score range enforcement (`422 Unprocessable Entity` for ratings < 1.00 or > 5.00).
  - Weightage sum validation (`422 Unprocessable Entity` if KRA + Competency weight != 100%).
  - Peer manager access restriction (`403 Forbidden` for evaluating unassigned staff).
  - Premature calibration guard (`409 Conflict` when calibrating before manager review).
  - Colleague acknowledgment guard (`403 Forbidden`).
- **Admin Boundaries**:
  - Mandatory onboarding fields; duplicate email rejection (`409 Conflict`); malformed NUBAN (<10 digits); non-existent employee lookups (`404 Not Found`); unauthorized policy configuration (`403 Forbidden`).

### Tier 3: Cross-Feature Combinations (8 Comprehensive Workflows)
Validates pairwise module interactions, compound state transitions, and audit logs:
1. `Leave Submission -> Balance Reservation -> Manager Approval -> Balance Deduction -> Audit Trail`.
2. `Leave Submission -> Balance Reservation -> Manager Rejection -> Balance Restoration -> Audit Trail`.
3. `Leave Submission -> Approval -> Cancellation -> Balance Restored`.
4. `Compound Concurrent Requests`: Multiple non-overlapping leave requests reserving balance concurrently, with separate approval/rejection outcomes.
5. `Multi-Tier Expense Reimbursement`: Receipt upload -> submission (>50k NGN) -> Line Manager approval -> escalation to Dept Head -> final approval -> Finance disbursement -> audit trail.
6. `Expense Revision Request Flow`: Submission -> Manager revision request -> claim editing -> re-submission -> final approval.
7. `Performance Appraisal Review Pipeline`: Cycle initiation -> self-appraisal -> manager 70/30 scoring -> committee calibration -> employee acknowledgment.
8. `Employee Onboarding & Promotion Pipeline`: Onboard new hire -> initialize leave quotas -> profile setup -> promotion to Manager role -> reassignment of direct reports -> account deactivation.

### Tier 4: Real-World Scenarios (4 Extensive Multi-Step Simulations)
1. **Complete Employee Lifecycle**: End-to-end journey of Amara Okafor from admin onboarding, profile completion, first leave application, Lagos due diligence fieldwork with expense receipts, manager and finance reimbursement, performance evaluation with Grade A calibration, and subsequent promotion.
2. **Complex Multi-Item Expense Reimbursement**: 5-line-item branch overhaul claim for NGN 182,700 combining generator maintenance, broadband telco, water supplies, and security guards, demonstrating receipt validation, threshold escalation to Dept Head, and First Bank batch payment sign-off.
3. **Year-End Appraisal Calibration Grid**: Simultaneous review cycle for multiple employees (Oluwaseun, Chioma) with diverse scoring, HR calibration adjustments (Grade A to Grade B), and dual employee sign-off.
4. **Fiscal Year Rollover & Corporate Restructuring**: Annual leave carry-over capped at 5.0 days, transfer of staff across departments, and automatic updating of manager approval permissions.

---

## 5. Execution Reference & Commands

The test suite can be executed with a single command from the project root:

### Primary Command:
```powershell
node tests/testRunner.ts
```

### Alternative Commands:
```powershell
# Run all tests using Node.js native test runner:
node --test "tests/e2e/**/*.test.ts"

# Run tests via tsx (when tsx is available):
npx tsx tests/testRunner.ts
# or
npx tsx --test "tests/e2e/**/*.test.ts"

# Run a specific test tier:
node --test "tests/e2e/tier1-features/*.test.ts"
node --test "tests/e2e/tier2-boundaries/*.test.ts"
node --test "tests/e2e/tier3-combinations/*.test.ts"
node --test "tests/e2e/tier4-scenarios/*.test.ts"

# Run against a live running Express server:
$env:API_BASE_URL="http://127.0.0.1:3001"; node tests/testRunner.ts
```

---

## 6. Traceability Matrix

| Feature | Feature Name | Tier 1 Suite | Tier 2 Suite | Tier 3 Suite | Tier 4 Scenario |
|---|---|---|---|---|---|
| **F01** | Secure Authentication & Sessions | `auth-rbac.test.ts` | `auth-rbac-boundaries.test.ts` | All suites | `complete-employee-lifecycle.test.ts` |
| **F02** | Role-Based Access Control (RBAC) | `auth-rbac.test.ts` | `auth-rbac-boundaries.test.ts` | All suites | `complete-employee-lifecycle.test.ts` |
| **F03** | Staff Profile Self-Service | `profile.test.ts` | `auth-rbac-boundaries.test.ts` | `employee-lifecycle-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F04** | Leave Balances & Entitlements | `leave-balances.test.ts` | `leave-boundaries.test.ts` | `leave-workflow-combinations.test.ts` | `workforce-restructuring-rollover.test.ts` |
| **F05** | Leave Application Submission | `leave-application.test.ts` | `leave-boundaries.test.ts` | `leave-workflow-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F06** | Leave History & Status Tracking | `leave-application.test.ts` | `leave-boundaries.test.ts` | `leave-workflow-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F07** | Itemized Expense Filing | `expenses.test.ts` | `expense-boundaries.test.ts` | `expense-workflow-combinations.test.ts` | `multi-item-expense-reimbursement.test.ts` |
| **F08** | Expense Receipt Upload & MIME | `expenses.test.ts` | `expense-boundaries.test.ts` | `expense-workflow-combinations.test.ts` | `multi-item-expense-reimbursement.test.ts` |
| **F09** | Expense Claim History & Tracking | `expenses.test.ts` | `expense-boundaries.test.ts` | `expense-workflow-combinations.test.ts` | `multi-item-expense-reimbursement.test.ts` |
| **F10** | Appraisal Self-Evaluation | `appraisals.test.ts` | `appraisal-boundaries.test.ts` | `appraisal-workflow-combinations.test.ts` | `year-end-appraisal-calibration.test.ts` |
| **F11** | Staff Directory View | `workforce-directory.test.ts` | `admin-boundaries.test.ts` | `employee-lifecycle-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F12** | Leave Policy & Rules Engine | `leave-balances.test.ts` | `leave-boundaries.test.ts` | `leave-workflow-combinations.test.ts` | `workforce-restructuring-rollover.test.ts` |
| **F13** | Leave Approval/Rejection Workflow | `leave-application.test.ts` | `leave-boundaries.test.ts` | `leave-workflow-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F14** | Expense Rules & Categorization | `expenses.test.ts` | `expense-boundaries.test.ts` | `expense-workflow-combinations.test.ts` | `multi-item-expense-reimbursement.test.ts` |
| **F15** | Expense Multi-Tier Approval | `expenses.test.ts` | `expense-boundaries.test.ts` | `expense-workflow-combinations.test.ts` | `multi-item-expense-reimbursement.test.ts` |
| **F16** | Appraisal Cycles & Template Master | `appraisals.test.ts` | `appraisal-boundaries.test.ts` | `appraisal-workflow-combinations.test.ts` | `year-end-appraisal-calibration.test.ts` |
| **F17** | Manager Appraisal Evaluation Form | `appraisals.test.ts` | `appraisal-boundaries.test.ts` | `appraisal-workflow-combinations.test.ts` | `year-end-appraisal-calibration.test.ts` |
| **F18** | Appraisal Calibration Grid | `appraisals.test.ts` | `appraisal-boundaries.test.ts` | `appraisal-workflow-combinations.test.ts` | `year-end-appraisal-calibration.test.ts` |
| **F19** | Admin Employee Management | `workforce-directory.test.ts` | `admin-boundaries.test.ts` | `employee-lifecycle-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F20** | Role & Permission Administration | `workforce-directory.test.ts` | `admin-boundaries.test.ts` | `employee-lifecycle-combinations.test.ts` | `complete-employee-lifecycle.test.ts` |
| **F21** | Immutable Security Audit Logging | `audit-security.test.ts` | `auth-rbac-boundaries.test.ts` | All combination suites | `complete-employee-lifecycle.test.ts` |
| **F22** | Clean Architecture Scaffolding | `architecture-design.test.ts` | N/A | N/A | Project Repository Structure |
| **F23** | Exact Design Replication & Motion | `architecture-design.test.ts` | N/A | N/A | Design Tokens & Motion Specs |
| **F24** | Zero-Trust Input Schema Validation | `auth-rbac.test.ts`, `audit-security.test.ts` | All boundary suites | All combination suites | All scenario suites |
| **F25** | Fail-Secure Error Handling & Headers| `auth-rbac.test.ts`, `audit-security.test.ts` | All boundary suites | All combination suites | All scenario suites |
| **F26** | Automated E2E & Verification Suite | `architecture-design.test.ts`, `testRunner.ts` | Full suite execution | Full suite execution | Full suite execution |
