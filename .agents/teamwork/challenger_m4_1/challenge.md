# Adversarial Challenge Report: Milestone 4 Expense Engine & Multi-Tier State Machine

**Challenger**: `challenger_m4_1` (Expense Invariants & State Machine Challenger)  
**Target Module**: Milestone 4 (Expense Reimbursement Suite & Receipt Management)  
**Date**: 2026-11-10  
**Test Harnesses**:
- `tests/adversarial/m4-expense-invariants-challenger.test.ts` (26 test cases)
- `tests/adversarial/m4-expense-invariants-stress.test.ts` (38 test cases)
- `tests/adversarial/m4-receipt-security.test.ts` (40 test cases)
- `tests/testRunner.ts` (122 master E2E tests across Tiers 1–4)  
**Execution Environment**: In-process Express dispatch via `createApp()` (`BypassSandbox: false`)  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Challenge Summary

**Overall Risk Assessment**: **MEDIUM to HIGH**

While the core data flow, zero-trust Zod schema validation, category ceilings, receipt upload checks, and happy-path multi-tier escalation transitions (`SUBMITTED` &rarr; `PENDING_DEPT_HEAD` &rarr; `PENDING_EXEC` &rarr; `APPROVED` &rarr; `PAID`) are solidly implemented and pass 100% of baseline E2E tests, empirical stress testing revealed three authorization and governance flaws on the review action route (`/api/v1/expenses/reports/:id/action` / `review`):

1. **Peer Employee Approval Privilege Escalation (OWASP A01 / CWE-269)**:
   Any authenticated user with role `EMPLOYEE` can approve or reject another employee's corporate expense claims because `reviewExpenseReportHandler` only enforces `report.employeeId !== user.profile.id` (self-approval guard) and lacks a role check (`user.role === 'MANAGER' || user.role === 'ADMIN'`).
2. **Line Manager Approval Bypass of Department Head Tier (CWE-863)**:
   When a claim reaches `PENDING_DEPT_HEAD` (> 50,000 NGN), any manager—including the line manager who originally submitted or endorsed Tier 1—can submit a second `APPROVE` action and advance the claim directly to `APPROVED`, completely bypassing the assigned Department Head (`emp-depthead-01`).
3. **Manager Approval Bypass of Executive Tier (CWE-863)**:
   When a high-value claim reaches `PENDING_EXEC` (> 250,000 NGN), any manager can approve it to `APPROVED` without requiring Executive or Admin authorization (`emp-admin-01` or `user.role === 'ADMIN'`).

---

## 2. Challenges

### [High] Challenge 1: Peer Employee Approval Privilege Escalation (Broken Function Level Authorization)

- **Assumption Challenged**: That only managerial or administrative personnel can review, approve, or reject employee expense claims.
- **Attack Scenario**:
  Employee A (Bakare, `usr-employee-01`) files an expense report for 4,500 NGN. Employee B (Chioma, `usr-employee-02`, role: `EMPLOYEE`), with no managerial authority, sends a `PATCH /api/v1/expenses/reports/:id/action` with payload `{ action: 'APPROVE' }`.
  - Self-approval check evaluates: `report.employeeId ('emp-employee-01') === user.profile.id ('emp-employee-02')` &rarr; `false`.
  - No role guard exists on `expensesRouter.patch('/reports/:id/action', requireAuth, ...)` or inside `reviewExpenseReportHandler`.
- **Empirical Observation**:
  The server responds with **HTTP 200 OK** and transitions the report status directly to `APPROVED`.
- **Blast Radius**:
  Any employee can unilaterally approve claims submitted by peers, creating a severe internal collusion and fraud risk.
- **Mitigation**:
  Enforce role verification in `reviewExpenseReportHandler` or router middleware:
  ```typescript
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Employees are not authorized to review or approve expense claims', correlationId }
    });
    return;
  }
  ```

---

### [Medium] Challenge 2: Line Manager Approval Bypass of Department Head Escalation Tier

- **Assumption Challenged**: That an expense claim requiring Department Head sign-off (`> 50,000 NGN`) cannot be approved by a standard line manager.
- **Attack Scenario**:
  Employee files an 80,000 NGN claim. Line manager (`emp-manager-01`) approves it, escalating status to `PENDING_DEPT_HEAD` with `currentApproverId: 'emp-depthead-01'`. The line manager immediately submits another `PATCH /action` approval request.
  - In `reviewExpenseReportHandler`:
    ```typescript
    } else if (report.status === 'PENDING_DEPT_HEAD') {
      if (report.totalAmount > 250000) {
        report.status = 'PENDING_EXEC';
      } else {
        report.status = 'APPROVED';
      }
    }
    ```
- **Empirical Observation**:
  The handler does not verify whether `user.profile.id === report.currentApproverId` or `user.role === 'ADMIN'`. The line manager's second approval succeeds with **HTTP 200 OK**, marking the claim `APPROVED` without Department Head review.
- **Blast Radius**:
  Violation of corporate financial governance invariants and dispatch requirement ("Non-dept-head manager cannot approve; Dept Head approval transitions to `APPROVED`").
- **Mitigation**:
  Guard the `PENDING_DEPT_HEAD` transition:
  ```typescript
  if (report.status === 'PENDING_DEPT_HEAD') {
    if (user.profile.id !== report.currentApproverId && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Department Head or Admin authorization required for this escalation tier', correlationId }
      });
      return;
    }
  }
  ```

---

### [Medium] Challenge 3: Manager Approval Bypass of Executive Escalation Tier

- **Assumption Challenged**: That a high-value claim (`> 250,000 NGN`) requiring Executive sign-off cannot be approved by lower-tier managers.
- **Attack Scenario**:
  A 300,000 NGN claim is escalated to `PENDING_EXEC` (assigned to `emp-admin-01`). A standard manager (`emp-manager-01` or `emp-depthead-01`) submits a `PATCH /action` approval.
  - In `reviewExpenseReportHandler`:
    ```typescript
    } else {
      report.status = 'APPROVED';
      report.approvedAt = new Date().toISOString();
      report.currentApproverId = 'emp-finance-01';
    }
    ```
- **Empirical Observation**:
  The server responds with **HTTP 200 OK** and approves the 300k NGN claim without executive authorization.
- **Blast Radius**:
  High-value financial disbursements can occur without executive sign-off, violating corporate risk controls.
- **Mitigation**:
  Guard the `PENDING_EXEC` transition:
  ```typescript
  if (report.status === 'PENDING_EXEC') {
    if (user.role !== 'ADMIN' && user.profile.id !== report.currentApproverId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Executive or Admin authorization required for this escalation tier', correlationId }
      });
      return;
    }
  }
  ```

---

## 3. Stress Test Results Summary

| Vector / Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **V1.1**: Total $\le$ 50k NGN Line Manager Approval | HTTP 200 &rarr; `APPROVED` | HTTP 200 &rarr; `APPROVED` | **PASS** |
| **V1.2**: Total 75k NGN Manager Approval | HTTP 200 &rarr; `PENDING_DEPT_HEAD` | HTTP 200 &rarr; `PENDING_DEPT_HEAD` | **PASS** |
| **V1.3**: Total 75k NGN Dept Head Approval | HTTP 200 &rarr; `APPROVED` | HTTP 200 &rarr; `APPROVED` | **PASS** |
| **V1.4**: Total 300k NGN Full Multi-Tier Flow | Escalates to `PENDING_EXEC` then `APPROVED` | Escalates to `PENDING_EXEC` then `APPROVED` | **PASS** |
| **V1.5 (PROBE)**: Peer employee approves another employee's claim | Expected HTTP 403 `FORBIDDEN` | Returned HTTP 200 OK (State changed to `APPROVED`) | **VULNERABILITY FOUND** |
| **V1.6 (PROBE)**: Non-dept-head manager approves `PENDING_DEPT_HEAD` | Expected HTTP 403 `FORBIDDEN` | Returned HTTP 200 OK (State changed to `APPROVED`) | **VULNERABILITY FOUND** |
| **V1.7 (PROBE)**: Non-executive manager approves `PENDING_EXEC` | Expected HTTP 403 `FORBIDDEN` | Returned HTTP 200 OK (State changed to `APPROVED`) | **VULNERABILITY FOUND** |
| **V2.1**: Re-review `PAID` report | HTTP 409 `ALREADY_DECIDED` | HTTP 409 `ALREADY_DECIDED` | **PASS** |
| **V2.2**: Re-review `REJECTED` report | HTTP 409 `ALREADY_DECIDED` | HTTP 409 `ALREADY_DECIDED` | **PASS** |
| **V2.3**: Premature disbursement on `SUBMITTED` | HTTP 409 `NOT_APPROVED` | HTTP 409 `NOT_APPROVED` | **PASS** |
| **V2.4**: Premature disbursement on `PENDING_DEPT_HEAD` | HTTP 409 `NOT_APPROVED` | HTTP 409 `NOT_APPROVED` | **PASS** |
| **V2.5**: Premature disbursement on `PENDING_EXEC` | HTTP 409 `NOT_APPROVED` | HTTP 409 `NOT_APPROVED` | **PASS** |
| **V2.6**: Premature disbursement on `REVISION_REQUESTED` | HTTP 409 `NOT_APPROVED` | HTTP 409 `NOT_APPROVED` | **PASS** |
| **V2.7**: Duplicate disbursement on already `PAID` | HTTP 409 `NOT_APPROVED` | HTTP 409 `NOT_APPROVED` | **PASS** |
| **V2.8**: Edit `APPROVED`, `PAID`, or `REJECTED` report | HTTP 409 `CANNOT_EDIT` | HTTP 409 `CANNOT_EDIT` | **PASS** |
| **V3.1**: Manager self-approval of own report | HTTP 403 `SELF_APPROVAL_PROHIBITED` | HTTP 403 `SELF_APPROVAL_PROHIBITED` | **PASS** |
| **V3.2**: Admin self-approval of own report | HTTP 403 `SELF_APPROVAL_PROHIBITED` | HTTP 403 `SELF_APPROVAL_PROHIBITED` | **PASS** |
| **V3.3**: Cross-employee editing (`PUT /reports/:id`) | HTTP 403 `FORBIDDEN` | HTTP 403 `FORBIDDEN` | **PASS** |
| **V3.4**: Non-admin disbursement attempt by Employee | HTTP 403 `FORBIDDEN` | HTTP 403 `FORBIDDEN` | **PASS** |
| **V3.5**: Non-admin disbursement attempt by Manager | HTTP 403 `FORBIDDEN` | HTTP 403 `FORBIDDEN` | **PASS** |
| **V3.6**: Employee query `scope=team` or `scope=all` | HTTP 403 `FORBIDDEN` | HTTP 403 `FORBIDDEN` | **PASS** |
| **V4.1**: Item amount $\le$ 0 | HTTP 400 `INVALID_AMOUNT` | HTTP 400 `INVALID_AMOUNT` | **PASS** |
| **V4.2**: Item > 5,000 NGN without receipt | HTTP 422 `RECEIPT_REQUIRED` | HTTP 422 `RECEIPT_REQUIRED` | **PASS** |
| **V4.3**: Item $\le$ 5,000 NGN without receipt | HTTP 201 Created | HTTP 201 Created | **PASS** |
| **V4.4**: Item exceeding category ceiling | HTTP 422 `CATEGORY_LIMIT_EXCEEDED` | HTTP 422 `CATEGORY_LIMIT_EXCEEDED` | **PASS** |
| **V4.5**: Unknown category ID | HTTP 404 `CATEGORY_NOT_FOUND` | HTTP 404 `CATEGORY_NOT_FOUND` | **PASS** |
| **V4.6**: Unrecognized payload keys on Submit/Update/Action/Disburse | HTTP 400 `VALIDATION_ERROR` | HTTP 400 `VALIDATION_ERROR` | **PASS** |
| **V5.1**: Ephemeral test teardown | 0 lingering records in JSON store | 0 lingering records in JSON store | **PASS** |

---

## 4. Unchallenged Areas

- **Frontend React View Rendering**: Evaluated primarily through client production build (`npm --prefix update run build`), which compiled in 3.34s with 0 errors. UI-level DOM assertion is covered by reviewer/auditor agents.
- **Physical Network NIC/IP Spoofing**: In-process Express dispatch simulates IP via `x-forwarded-for`; raw TCP packet header forgery is out of scope for default sandbox permissions.

---

## 5. Remediation Plan for Worker

A single contiguous block edit in `update/server/controllers/expenseController.ts` in `reviewExpenseReportHandler` will completely resolve Challenges 1, 2, and 3:

```typescript
  // Self-approval prohibition
  if (report.employeeId === user.profile.id) {
    res.status(403).json({
      success: false,
      error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'Self-approval is strictly prohibited', correlationId }
    });
    return;
  }

  // 1. Enforce that regular employees cannot review or approve expense claims (OWASP A01 / CWE-269)
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Employees are not authorized to review or approve expense claims', correlationId }
    });
    return;
  }

  // 2. Enforce multi-tier escalation authorization invariants (CWE-863)
  if (report.status === 'PENDING_DEPT_HEAD') {
    if (user.profile.id !== report.currentApproverId && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Department Head or Admin authorization required for this escalation tier', correlationId }
      });
      return;
    }
  }

  if (report.status === 'PENDING_EXEC') {
    if (user.role !== 'ADMIN' && user.profile.id !== report.currentApproverId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Executive or Admin authorization required for this escalation tier', correlationId }
      });
      return;
    }
  }
```

Applying this patch will secure the review endpoint without breaking any existing E2E tests in `tests/testRunner.ts`.
