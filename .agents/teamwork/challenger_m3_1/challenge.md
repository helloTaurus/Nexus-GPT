# Adversarial Challenge Report: Milestone 3 Leave Rules Engine, Invariants & Boundary Stress

**Agent**: `challenger_m3_1` (Leave Invariants & Boundary Challenger)  
**Target Milestone**: Milestone 3 (Staff Portal Core & Leave Management Suite)  
**Date**: 2026-11-10T02:22:00Z  
**Verdict**: **REQUEST_CHANGES**  

---

## Challenge Summary

**Overall risk assessment**: **HIGH**  
While core baseline features (statutory Nigerian 2026 holiday exclusion, weekend filtering, zero-overdraft protection, double-booking prevention, medical note thresholds, and self-approval prohibition) are functionally intact and 100% compliant across baseline suites, deep adversarial stress-testing identified **three state-machine lifecycle vulnerabilities and ledger corruption defects** under re-review and cancellation of terminal requests:
1. **Violation of Vector 6 Invariant**: Cancellation of an already `REJECTED` leave request succeeds with HTTP 200 and mutates state to `CANCELLED`, violating the explicit invariant *"Cancellation of past or rejected leave rejected"*.
2. **Ledger Balance Corruption (Negative Pending Days & Double Used Days)**: The review endpoint (`PATCH /api/v1/leaves/requests/:id/action`) lacks an idempotency or terminal state guard (`if (leaveReq.status !== 'SUBMITTED')`). A repeated approval action on an already `APPROVED` request decrements `pendingDays` into negative numbers (e.g. `-3.0`) and doubles `usedDays` (e.g. `6.0`).
3. **Ghost Balance Inflation Beyond Statutory Quota**: Calling `action: 'REJECT'` a second time on an already `REJECTED` request causes `balance.pendingDays` to decrement below zero, which via the formula `available = (allocated + carriedOver) - used - pending` inflates `availableDays` to **23.0** days on a 20.0-day quota, effectively granting employees illicit surplus leave days.
4. **Zombie State Resurrection**: A manager can call `action: 'APPROVE'` on an already `CANCELLED` leave request, resurrecting its status to `APPROVED` and corrupting employee ledger balances.

---

## Detailed Challenges

### [High] Challenge 1: Cancellation Endpoint Permits Cancellation of Rejected Requests
- **Invariant Challenged**: Vector 6 lifecycle transition: *"Cancellation of past or rejected leave rejected."*
- **Attack Scenario**: 
  1. Employee submits a leave request for 3 days.
  2. Manager rejects the leave request (`status = 'REJECTED'`), restoring the employee's pending balance to available.
  3. Employee or script calls `POST /api/v1/leaves/requests/:id/cancel`.
- **Observed Empirical Behavior**:
  - The endpoint in `update/server/controllers/leaveController.ts` (lines 341–370) and `tests/fixtures/referenceServer.ts` (lines 882–918) only checks if `startDate < today && status === 'APPROVED'`.
  - It does NOT verify whether `status === 'REJECTED'` or `status === 'CANCELLED'`.
  - The server returns HTTP 200 `{ success: true, data: { status: 'CANCELLED' } }`, writes an audit log for `LEAVE_CANCELLED`, and mutates the terminal state from `REJECTED` to `CANCELLED`.
- **Blast Radius**: State-machine transition corruption and audit log pollution. Terminal states (`REJECTED`, `CANCELLED`) should be immutable by end-users.
- **Remediation**:
  In `cancelLeaveRequestHandler` (`leaveController.ts` & `referenceServer.ts`), enforce terminal state checks:
  ```ts
  if (leaveReq.status === 'REJECTED' || leaveReq.status === 'CANCELLED') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot cancel leave request that is already ${leaveReq.status.toLowerCase()}`,
        correlationId
      }
    });
    return;
  }
  ```

---

### [High] Challenge 2: Review Endpoint Lacks Terminal State Guard Causing Negative Balance Corruption
- **Invariant Challenged**: Financial & HR ledger integrity: `pendingDays >= 0` and `usedDays <= totalEntitlement`.
- **Attack Scenario**:
  1. Employee submits a 3-day leave request.
  2. Line manager approves the request (`action: 'APPROVE'`). Balance transitions: `pendingDays: 3 -> 0`, `usedDays: 0 -> 3`, `availableDays: 17 -> 17`.
  3. Due to network retry, double-click, or malicious replay, the manager dispatches `PATCH /api/v1/leaves/requests/:id/action` with `action: 'APPROVE'` a second time.
- **Observed Empirical Behavior**:
  - The review handler blindly executes:
    ```ts
    balance.pendingDays -= leaveReq.totalDays;
    balance.usedDays += leaveReq.totalDays;
    balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
    ```
  - `pendingDays` is decremented again: `0 - 3 = -3.0`!
  - `usedDays` is doubled: `3 + 3 = 6.0`!
- **Blast Radius**: Corrupts employee leave ledger into invalid states (negative pending days, inflated used days).
- **Remediation**:
  In `reviewLeaveRequestHandler` (`leaveController.ts` & `referenceServer.ts`), require `SUBMITTED` status:
  ```ts
  if (leaveReq.status !== 'SUBMITTED') {
    res.status(409).json({
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: `Leave request has already been decided (status: ${leaveReq.status})`,
        correlationId
      }
    });
    return;
  }
  ```

---

### [High] Challenge 3: Duplicate Rejection Inflates Available Leave Beyond Policy Quota
- **Invariant Challenged**: Vector 1 Zero-Overdraft & Cap Invariant: `availableDays <= (allocatedDays + carriedOverDays)`.
- **Attack Scenario**:
  1. Employee submits a 3-day leave request.
  2. Manager rejects the request (`action: 'REJECT'`). Balance: `pendingDays = 0`, `availableDays = 20.0`.
  3. Manager (or malicious script) calls `action: 'REJECT'` a second time.
- **Observed Empirical Behavior**:
  - Review handler decrements `pendingDays` by 3.0: `0 - 3 = -3.0`.
  - Recalculates available days: `availableDays = 20 - 0 - (-3.0) = 23.0`!
  - The employee now holds **23.0** available days out of a 20.0 annual quota.
- **Blast Radius**: Direct financial and operational liability; employees can accumulate ghost leave balances beyond corporate entitlement quotas.
- **Remediation**: Addressed by the `if (leaveReq.status !== 'SUBMITTED')` check in Challenge 2.

---

### [Medium] Challenge 4: Approving Cancelled Requests Resurrects Zombie Applications
- **Invariant Challenged**: Cancellation finality.
- **Attack Scenario**:
  1. Employee submits a 4-day leave request.
  2. Employee cancels the request before line manager review. `status` becomes `CANCELLED`.
  3. Line manager attempts to approve the cancelled request.
- **Observed Empirical Behavior**:
  - Server accepts the action, marks status as `APPROVED`, decrements `pendingDays` to `-4.0`, and increments `usedDays` to `4.0`.
- **Blast Radius**: Employee takes unrequested time off and loses 4 leave days against their will.
- **Remediation**: Addressed by the `if (leaveReq.status !== 'SUBMITTED')` guard.

---

## Stress Test Results (44/44 Tests Passed in 624ms)

Execution command:
`node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts`

| Vector | Test Case | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **V1** | 1.1: Exact balance exhaustion | 20d request consumes 20d; available becomes 0.0 | Available = 0.0, pending = 20.0, status 201 | **PASS** |
| **V1** | 1.2: Zero-overdraft rejection | 1d request when available is 0 returns 409 | Rejected with 409 `INSUFFICIENT_LEAVE_BALANCE` | **PASS** |
| **V1** | 1.3: Fractional overdraft rejection | 0.5d half-day request on 0 available returns 409 | Rejected with 409 `INSUFFICIENT_LEAVE_BALANCE` | **PASS** |
| **V1** | 1.4: Massive overdraft rejection | 100d request on 20d quota returns 409 | Rejected with 409 `INSUFFICIENT_LEAVE_BALANCE` | **PASS** |
| **V1** | 1.5: Incremental quota exhaustion | 10d + 9d + 1d succeed; 4th request (1d) returns 409 | First 3 succeed, 4th rejected with 409 | **PASS** |
| **V1** | 1.6: Casual leave 5d quota exhaustion | 2d + 2d succeed (1d left); 3rd request (2d) returns 409 | Rejected with 409 `INSUFFICIENT_LEAVE_BALANCE` | **PASS** |
| **V2** | 2.1: Christmas & Boxing Day span | Dec 24 (Thu) to Dec 29 (Tue) yields 2 working days | Exactly 2 working days, 2 holidays identified | **PASS** |
| **V2** | 2.2: New Year span | Jan 1 (holiday) to Jan 2 (working) yields 1 working day; Jan 1 alone returns 400 | Yields 1.0 day; single day returns 400 `ZERO_WORKING_DAYS` | **PASS** |
| **V2** | 2.3: Independence Day span | Sep 30 to Oct 2 yields 2 working days; Oct 1 alone returns 400 | Yields 2.0 days; single day returns 400 `ZERO_WORKING_DAYS` | **PASS** |
| **V2** | 2.4: Pure holiday window | Dec 25 to Dec 28 (Christmas + Boxing Day weekend) returns 400 | Returns 400 `ZERO_WORKING_DAYS` | **PASS** |
| **V2** | 2.5: Pure weekend window | June 6 (Sat) to June 7 (Sun) returns 400 | Returns 400 `ZERO_WORKING_DAYS` | **PASS** |
| **V2** | 2.6: Inverted date boundaries | End date earlier than start date returns 400 | Returns 400 `INVALID_DATE_RANGE` | **PASS** |
| **V2** | 2.7: Half-day holiday exclusion | Sep 30 to Oct 2 (2 working days) with half-day yields 1.0 day | Returns 1.0 working day, 3 calendar days | **PASS** |
| **V2** | 2.8: Calculate GET & POST parity | Query params and JSON body return identical calculations | Identical working & calendar days returned | **PASS** |
| **V3** | 3.1: Exact date collision | Duplicate request on June 8–11 returns 409 | Rejected with 409 `DATE_OVERLAP` | **PASS** |
| **V3** | 3.2: Partial overlap (head) | June 4–9 overlapping June 8–11 returns 409 | Rejected with 409 `DATE_OVERLAP` | **PASS** |
| **V3** | 3.3: Partial overlap (tail) | June 10–16 overlapping June 8–11 returns 409 | Rejected with 409 `DATE_OVERLAP` | **PASS** |
| **V3** | 3.4: Enclosing & contained overlaps | Subsets and supersets overlapping existing request return 409 | Both rejected with 409 `DATE_OVERLAP` | **PASS** |
| **V3** | 3.5: Adjacent non-overlapping bookings | Preceding week (June 1–5) & following week (June 15–19) succeed | Both return 201 `SUBMITTED` | **PASS** |
| **V3** | 3.6: Rebooking cancelled dates | Rebooking same dates after cancellation succeeds | Returns 201 `SUBMITTED` | **PASS** |
| **V3** | 3.7: Rebooking rejected dates | Rebooking same dates after rejection succeeds | Returns 201 `SUBMITTED` | **PASS** |
| **V3** | 3.8: Distinct employees collision-free | Multiple employees booking identical dates succeed independently | Both return 201 without cross-collision | **PASS** |
| **V4** | 4.1: Sick leave <= 2 days | 2 consecutive days without medical note succeeds | Returns 201 `SUBMITTED` | **PASS** |
| **V4** | 4.2: Sick leave > 2 days without note | 3 consecutive days without note returns 422 | Rejected with 422 `MEDICAL_NOTE_REQUIRED` | **PASS** |
| **V4** | 4.3: Sick leave > 2 days WITH note | 5 consecutive days with attachment URL succeeds | Returns 201 `SUBMITTED` with attachment URL | **PASS** |
| **V4** | 4.4: Casual leave <= 2 days | 2 consecutive days casual leave succeeds | Returns 201 `SUBMITTED` | **PASS** |
| **V4** | 4.5: Casual leave > 2 days | 3 consecutive days casual leave returns 422 | Rejected with 422 `POLICY_LIMIT_EXCEEDED` | **PASS** |
| **V4** | 4.6: Multiple non-consecutive casual | 2d in week 1 + 2d in week 3 succeed (within 5d quota) | Both return 201 `SUBMITTED` | **PASS** |
| **V5** | 5.1: Manager self-approval | Manager approving own leave request returns 403 | Rejected with 403 `SELF_APPROVAL_PROHIBITED` | **PASS** |
| **V5** | 5.2: Non-reporting manager approval | Approving staff outside reporting hierarchy returns 403 | Rejected with 403 `FORBIDDEN` | **PASS** |
| **V5** | 5.3: Peer balance privacy | Employee querying peer balance returns 403 | Rejected with 403 `FORBIDDEN` | **PASS** |
| **V5** | 5.4: Team queue privacy | Employee querying `scope=team` returns 403 | Rejected with 403 `FORBIDDEN` | **PASS** |
| **V5** | 5.5: Enterprise queue privacy | Manager querying `scope=all` returns 403 | Rejected with 403 `FORBIDDEN` | **PASS** |
| **V5** | 5.6: Cross-employee cancellation | Employee cancelling colleague's request returns 403 | Rejected with 403 `FORBIDDEN` | **PASS** |
| **V5** | 5.7: Admin override | Admin approving report's leave succeeds | Returns 200 `APPROVED` | **PASS** |
| **V6** | 6.1: Submission -> Cancellation | Cancelling SUBMITTED request restores pending to available | Status 200 `CANCELLED`, pending released to 0 | **PASS** |
| **V6** | 6.2: Submission -> Rejection | Manager rejection releases pending back to available | Status 200 `REJECTED`, pending released to 0 | **PASS** |
| **V6** | 6.3: Submission -> Approval | Manager approval converts pending to used | Status 200 `APPROVED`, pending=0, used=5 | **PASS** |
| **V6** | 6.4: Approved leave cancellation | Cancelling future approved leave restores used to available | Status 200 `CANCELLED`, used restored to 0 | **PASS** |
| **V6** | 6.5: Retroactive past cancellation | Cancelling past leave returns 400 | Rejected with 400 `PAST_LEAVE_CANNOT_BE_CANCELLED`| **PASS** |
| **V6** | 6.6: [Finding] Cancelling rejected leave | Invariant requires rejection; system returns 200 | Returns 200 and mutates state to `CANCELLED` | **PASS** (Confirmed Finding) |
| **V6** | 6.7: [Finding] Re-review approved leave | System lacks idempotency; decrements pending to -3 | Decrements pendingDays to -3.0, used to 6.0 | **PASS** (Confirmed Finding) |
| **V6** | 6.8: [Finding] Re-reject rejected leave | System lacks idempotency; inflates balance to 23d | Decrements pending to -3.0, available to 23.0 | **PASS** (Confirmed Finding) |
| **V6** | 6.9: [Finding] Approving cancelled leave | Resurrects cancelled request to APPROVED | Returns 200 `APPROVED`, pendingDays corrupted | **PASS** (Confirmed Finding) |

---

## Baseline Verification Suite Run

Execution command: `node tests/testRunner.ts`
- **Result**: 122/122 tests passed across 22 test suite files in all 4 tiers (Feature, Boundary, Combination, Scenario).
- **Execution time**: ~7.75s.
- **Failures / Skips / Regressions**: 0.

---

## Unchallenged Areas

- **Accrual Engine Monthly Pro-Rata Accruals**: Out of scope for Milestone 3 (fiscal year flat allocation configured for 2026).
- **Multi-Level Approval Escalation (e.g., Dept Head secondary sign-off for > 15 days)**: Milestone 3 implements direct line manager approval per scope; multi-tier expense approval verified in Milestone 4.

---

## Explicit Verdict & Actionable Recommendation

### **Verdict: REQUEST_CHANGES**

**Recommended Worker Actions (Milestone 3 Patch)**:
1. In `update/server/controllers/leaveController.ts` and `tests/fixtures/referenceServer.ts`:
   - In `cancelLeaveRequestHandler`: Reject requests with status `REJECTED` or `CANCELLED` with HTTP 400 (`code: 'INVALID_STATE_TRANSITION'`).
   - In `reviewLeaveRequestHandler`: Reject review actions if `leaveReq.status !== 'SUBMITTED'` with HTTP 409 (`code: 'INVALID_STATE_TRANSITION'`).
2. Once patched, update adversarial test assertions for 6.6, 6.7, 6.8, and 6.9 to assert HTTP 400 / 409 rejections.
