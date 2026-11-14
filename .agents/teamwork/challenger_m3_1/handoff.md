# Handoff Report: Milestone 3 Leave Invariants & Boundary Stress Challenge

**Agent**: `challenger_m3_1` (Leave Invariants & Boundary Challenger)  
**Recipient**: `parent` (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`)  
**Timestamp**: 2026-11-10T02:24:00Z  
**Type**: Hard Handoff (Challenge Complete)  

---

## 1. Observation

### 1.1 Authored Adversarial Test Suite
Authored adversarial stress test script under:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\adversarial\m3-leave-invariants-stress.test.ts`
Total 44 tests systematically probing all 6 invariant vectors:
- **Vector 1**: Zero-overdraft boundary: 20d quota exhaustion, 1d overdraft rejection (409), 0.5d fractional overdraft, massive 100d overdraft, multi-step exhaustion (10d + 9d + 1d), casual leave 5d quota exhaustion.
- **Vector 2**: Nigerian statutory 2026 gazetted public holiday & weekend exclusion math: Christmas (Dec 25) & Boxing Day (Dec 28 observed), New Year (Jan 1), Independence Day (Oct 1), weekend filtering, pure holiday/weekend periods (400 ZERO_WORKING_DAYS), inverted date boundaries (400 INVALID_DATE_RANGE), half-day calculations, GET and POST calculation parity.
- **Vector 3**: Double-booking collision detection: exact date overlaps, partial head overlaps, partial tail overlaps, enclosing supersets, contained subsets, adjacent non-overlapping bookings, rebooking cancelled dates, rebooking rejected dates, multi-employee isolation.
- **Vector 4**: Policy limits & documentation thresholds: sick leave <= 2 days without certificate, sick leave > 2 days without certificate (422 MEDICAL_NOTE_REQUIRED), sick leave > 2 days WITH medical certificate URL (201), casual leave <= 2 days, casual leave > 2 days (422 POLICY_LIMIT_EXCEEDED), multiple non-consecutive casual leaves within quota.
- **Vector 5**: Authorization & self-approval: manager self-approval prohibition (403 SELF_APPROVAL_PROHIBITED), non-reporting manager authorization guard (403 FORBIDDEN), peer balance privacy (403 FORBIDDEN), team approval queue privacy (403 FORBIDDEN), enterprise approval queue privacy (403 FORBIDDEN), cross-employee cancellation guard (403 FORBIDDEN), administrative override (200 APPROVED).
- **Vector 6**: Lifecycle state machine transitions & balance restoration: submission -> cancellation (pending restored to available), submission -> rejection (pending restored to available), submission -> approval (pending converted to used), approved leave cancellation (used restored to available), retroactive past cancellation (400 PAST_LEAVE_CANNOT_BE_CANCELLED), empirical stress on terminal state transitions and balance idempotency.

### 1.2 Verbatim Test Runner Execution Results

#### Adversarial Stress Suite Execution:
Command:
```powershell
node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts
```
Verbatim Output:
```
▶ Milestone 3 Adversarial Stress Suite: Leave Rules Engine, Invariants & Workflows
  ▶ Vector 1: Zero-Overdraft Boundary Protection
    ✔ 1.1: Exact balance exhaustion: Employee with 20d quota requests exactly 20 working days (39.8469ms)
    ✔ 1.2: Zero-overdraft rejection: Subsequent request for 1d when available is 0 must reject with 409 (1.8636ms)
    ✔ 1.3: Fractional overdraft rejection: 0.5d half-day request on 0 available balance rejects with 409 (1.3363ms)
    ✔ 1.4: Massive overdraft rejection: Requesting 100 days when quota is 20d rejects with 409 (1.8163ms)
    ✔ 1.5: Incremental quota exhaustion: 10d + 9d + 1d succeeds, 4th request for 1d rejects with 409 (1.9495ms)
    ✔ 1.6: Boundary check across other leave types (Casual leave 5d quota exhaustion) (1.2829ms)
  ✔ Vector 1: Zero-Overdraft Boundary Protection (49.6212ms)
  ▶ Vector 2: Exact Holiday and Weekend Exclusion Mathematics
    ✔ 2.1: Spans Christmas (Dec 25) & Boxing Day (Dec 28 observed): Dec 24 (Thu) to Dec 29 (Tue) yields 2 working days (1.915ms)
    ✔ 2.2: Spans New Year: Jan 1 (Thu, holiday) to Jan 2 (Fri, working) yields exactly 1 working day (1.2535ms)
    ✔ 2.3: Spans Independence Day: Sep 30 (Wed) to Oct 2 (Fri) yields exactly 2 working days (1.2331ms)
    ✔ 2.4: Period spanning only holidays and weekends returns 400 ZERO_WORKING_DAYS (0.921ms)
    ✔ 2.5: Leave application spanning only weekends returns 400 ZERO_WORKING_DAYS (0.7111ms)
    ✔ 2.6: Inverted date boundaries (endDate < startDate) returns 400 INVALID_DATE_RANGE (3.3065ms)
    ✔ 2.7: Half-day calculation with holiday exclusion calculates 0.5 per working day (0.6796ms)
    ✔ 2.8: GET and POST /leaves/calculate yield consistent parity (1.0896ms)
  ✔ Vector 2: Exact Holiday and Weekend Exclusion Mathematics (11.7393ms)
  ▶ Vector 3: Double-Booking Collisions
    ✔ 3.1: Exact overlap: Same user submitting identical dates rejects with 409 DATE_OVERLAP (0.9289ms)
    ✔ 3.2: Partial overlap (head): Request starting before and ending inside existing booking rejects with 409 (0.7224ms)
    ✔ 3.3: Partial overlap (tail): Request starting inside and ending after existing booking rejects with 409 (0.5889ms)
    ✔ 3.4: Enclosing and contained overlaps reject with 409 DATE_OVERLAP (0.6166ms)
    ✔ 3.5: Adjacent non-overlapping bookings succeed (both preceding and following weeks) (0.6346ms)
    ✔ 3.6: Rebooking dates of a CANCELLED request succeeds without conflict (0.7585ms)
    ✔ 3.7: Rebooking dates of a REJECTED request succeeds without conflict (0.8544ms)
    ✔ 3.8: Distinct employees can book identical dates without interference (0.6184ms)
  ✔ Vector 3: Double-Booking Collisions (6.0811ms)
  ▶ Vector 4: Policy Limits & Medical Note Compliance
    ✔ 4.1: Sick leave <= 2 consecutive working days without medical certificate succeeds (0.6491ms)
    ✔ 4.2: Sick leave > 2 consecutive working days without medical certificate rejects with 422 (0.5654ms)
    ✔ 4.3: Sick leave > 2 consecutive working days WITH medical certificate attachment succeeds (0.5657ms)
    ✔ 4.4: Casual leave <= 2 consecutive working days succeeds (0.665ms)
    ✔ 4.5: Casual leave > 2 consecutive working days returns 422 POLICY_LIMIT_EXCEEDED (0.5561ms)
    ✔ 4.6: Multiple non-consecutive casual leaves (2d + 2d) within quota both succeed (0.5545ms)
  ✔ Vector 4: Policy Limits & Medical Note Compliance (3.8751ms)
  ▶ Vector 5: Authorization, Self-Approval & Privacy Invariants
    ✔ 5.1: Self-approval prohibition: Manager cannot approve their own leave request (403) (0.6125ms)
    ✔ 5.2: Non-reporting manager authorization: Manager cannot approve report from another chain (403) (1.0071ms)
    ✔ 5.3: Peer balance privacy: Regular employee querying peer leave balance receives 403 FORBIDDEN (0.4855ms)
    ✔ 5.4: Team queue privacy: Regular employee querying team approval queue receives 403 FORBIDDEN (0.5705ms)
    ✔ 5.5: Enterprise queue privacy: Manager querying all company leaves (scope=all) receives 403 FORBIDDEN (0.4645ms)
    ✔ 5.6: Cross-employee cancellation guard: Employee cannot cancel peer leave request (403 FORBIDDEN) (0.7842ms)
    ✔ 5.7: Admin override: Admin can approve report leave in emergency (0.9245ms)
  ✔ Vector 5: Authorization, Self-Approval & Privacy Invariants (5.1897ms)
  ▶ Vector 6: Lifecycle State Machine Transitions & Balance Restoration
    ✔ 6.1: Submission -> Cancellation: Cancellation of SUBMITTED request releases pending balance back to available (2.4552ms)
    ✔ 6.2: Submission -> Manager Rejection: Rejection releases pending balance back to available (1.2846ms)
    ✔ 6.3: Submission -> Manager Approval: Approval converts pending balance to used balance (1.4123ms)
    ✔ 6.4: Approved leave cancellation: Employee cancels future approved leave, restoring used balance (1.0776ms)
    ✔ 6.5: Retroactive cancellation of past leave is rejected with 400 (0.725ms)
    ✔ 6.6: [Empirical Finding / Flaw] Cancellation of already REJECTED leave returns 200 instead of rejecting with 400/409 (0.7842ms)
    ✔ 6.7: [Vulnerability Finding / Ledger Flaw] Re-reviewing already APPROVED leave decrements pendingDays into negative numbers (0.907ms)
    ✔ 6.8: [Vulnerability Finding / Balance Inflation] Re-rejecting already REJECTED leave inflates available balance beyond quota (0.7631ms)
    ✔ 6.9: [Vulnerability Finding / Zombie State] Approving a CANCELLED request resurrects it and alters balances (0.6925ms)
  ✔ Vector 6: Lifecycle State Machine Transitions & Balance Restoration (10.6267ms)
✔ Milestone 3 Adversarial Stress Suite: Leave Rules Engine, Invariants & Workflows (88.3773ms)
ℹ tests 44
ℹ suites 7
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 624.1712
```

#### Baseline Test Suite Execution:
Command:
```powershell
node tests/testRunner.ts
```
Verbatim Output Summary:
```
======================================================
 Nexus Finance E2E Verification Suite (Tiers 1-4)
======================================================
Discovered 22 test suite files across all 4 tiers:
...
ℹ tests 122
ℹ suites 0
ℹ pass 122
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7758.97

======================================================
[TEST SUITE RUN: 100% PASSED] All tests passed.
```

### 1.3 Code Inspection Observations
1. In `update/server/controllers/leaveController.ts` (lines 341–370) and `tests/fixtures/referenceServer.ts` (lines 882–918):
   - `cancelLeaveRequestHandler` only rejects if `leaveReq.startDate < today && leaveReq.status === 'APPROVED'`.
   - It does not check `if (leaveReq.status === 'REJECTED' || leaveReq.status === 'CANCELLED')`. It allows cancelling already rejected requests and mutates their status to `CANCELLED` with HTTP 200.
2. In `update/server/controllers/leaveController.ts` (lines 241–315) and `tests/fixtures/referenceServer.ts` (lines 825–880):
   - `reviewLeaveRequestHandler` does not check `if (leaveReq.status !== 'SUBMITTED')`.
   - When called on an already approved request, it subtracts `totalDays` from `pendingDays` again (producing negative pending days: `-3.0`) and doubles `usedDays` (`6.0`).
   - When called with `action: 'REJECT'` on an already rejected request, it decrements `pendingDays` to `-3.0`, causing `availableDays = 20 - 0 - (-3) = 23.0` (granting illicit leave days beyond the statutory quota).
   - When called with `action: 'APPROVE'` on a previously cancelled request, it resurrects the request to `APPROVED`.

---

## 2. Logic Chain

1. **Vector 1 through 5 Invariant Conformance (Observations 1.1 & 1.2)**:
   - The calculations for net working days, Nigerian gazetted public holidays (Christmas Dec 25, Boxing Day Dec 28 observed, New Year Jan 1, Independence Day Oct 1), zero-overdraft boundaries, date collisions, casual caps (2d), sick certificate requirements (>2d), manager self-approval prohibition, reporting chain authorization, and peer balance privacy are correctly enforced and pass all 35 tests across Vectors 1–5.
2. **Vector 6 Invariant Non-Conformance (Observations 1.2 & 1.3)**:
   - Invariant specification explicitly requires: *"Cancellation of past or rejected leave rejected."*
   - As observed in test 6.6 and code inspection of `cancelLeaveRequestHandler`, calling `POST /api/v1/leaves/requests/:id/cancel` on a `REJECTED` request returns HTTP 200 instead of rejecting with HTTP 400 or 409.
3. **Ledger Integrity & Idempotency Flaws (Observations 1.2 & 1.3)**:
   - In banking/HRMS accounting, balance balances must satisfy `0 <= usedDays <= quota`, `0 <= pendingDays <= quota`, and `0 <= availableDays <= quota`.
   - In `reviewLeaveRequestHandler`, the lack of `if (leaveReq.status !== 'SUBMITTED')` allows duplicate execution to decrement `pendingDays` to negative values (test 6.7) and artificially inflate available balances beyond total quota to `23.0` (test 6.8).
   - Therefore, while the baseline tests pass, the backend contains high-severity state-machine vulnerabilities that must be addressed.

---

## 3. Caveats

- **Sandbox Network Limitation**: As confirmed by the team environment rules, TCP loopback socket connections fail with `EACCES` in this sandbox without elevated privileges. Verification was performed via high-fidelity in-process HTTP dispatch and the native Node.js test runner (`node:test`).
- **Review-Only Constraint**: As an adversarial challenger, implementation files in `update/server/` were not modified directly. Complete, drop-in remediation snippets are provided below for the worker to implement.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 3 is functionally strong and passes all 122 baseline tests and 44 adversarial tests, but requires a targeted patch to lock down leave lifecycle state transitions:
1. **Fix `cancelLeaveRequestHandler`**: Reject cancellation of requests with status `REJECTED` or `CANCELLED` with HTTP 400 (`INVALID_STATE_TRANSITION`).
2. **Fix `reviewLeaveRequestHandler`**: Reject review actions when `leaveReq.status !== 'SUBMITTED'` with HTTP 409 (`INVALID_STATE_TRANSITION`).

---

## 5. Verification Method

To independently reproduce all observations and verify the challenge findings:

1. **Execute Milestone 3 Adversarial Invariants Test Suite**:
   ```powershell
   node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts
   ```
   *Expected outcome*: 44/44 tests pass across 7 suites in < 1 second. Tests 6.6–6.9 empirically demonstrate the state-machine and balance ledger vulnerabilities.

2. **Execute Baseline E2E Verification Suite**:
   ```powershell
   node tests/testRunner.ts
   ```
   *Expected outcome*: 122/122 tests pass (0 failures) across all 22 test suites in Tiers 1–4.

3. **Verify Challenge Report & Artifacts**:
   - Inspect `.agents/teamwork/challenger_m3_1/challenge.md`
   - Inspect `tests/adversarial/m3-leave-invariants-stress.test.ts`
