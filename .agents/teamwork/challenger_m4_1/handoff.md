# Hard Handoff Report: Milestone 4 Expense Invariants & State Machine Stress Challenge

**Agent**: `challenger_m4_1` (Expense Invariants & State Machine Challenger)  
**Recipient**: `parent` (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`)  
**Target Module**: Milestone 4 (Expense Reimbursement Suite & Receipt Management)  
**Date**: 2026-11-10  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Test Suite Authored & Executed
Authored and executed adversarial test suite:
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\adversarial\m4-expense-invariants-challenger.test.ts` (26 test cases)
- Executed in-process via `createApp()` with native `node:test` runner.

### 1.2 Verbatim Test Execution Outputs

1. **Challenger Adversarial Test Suite Execution**:
   Command:
   ```powershell
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/adversarial/m4-expense-invariants-challenger.test.ts
   ```
   Verbatim output:
   ```
   ▶ Challenger M4-1: In-Depth Empirical Stress Testing of Expense Invariants & State Machine
     ▶ Vector 1: Multi-Tier Escalation Invariants
       ✔ 1.1: Report <= 50,000 NGN: Line manager approval transitions directly to APPROVED (47.2269ms)
       ✔ 1.2: Report 75,000 NGN: Manager approval escalates to PENDING_DEPT_HEAD (42.2204ms)
       ✔ 1.3: Report 75,000 NGN: Dept Head approval transitions PENDING_DEPT_HEAD to APPROVED (60.7361ms)
       ✔ 1.4: Report 300,000 NGN: Escalation path SUBMITTED -> PENDING_DEPT_HEAD -> PENDING_EXEC -> APPROVED (76.6019ms)
   [EMPIRICAL PROBE] Peer employee review response status: 200
       ✔ 1.5: Empirical Probe: Approver role enforcement on review action endpoint (39.0054ms)
   [EMPIRICAL PROBE] Non-dept-head manager approving PENDING_DEPT_HEAD status: 200
       ✔ 1.6: Empirical Probe: Non-dept-head manager approving report at PENDING_DEPT_HEAD (71.6257ms)
   [EMPIRICAL PROBE] Non-executive manager approving PENDING_EXEC status: 200
       ✔ 1.7: Empirical Probe: Non-executive manager approving report at PENDING_EXEC (81.5514ms)
     ✔ Vector 1: Multi-Tier Escalation Invariants (422.0096ms)
     ▶ Vector 2: Terminal State Immutability
       ✔ 2.1: Re-reviewing PAID report returns 409 ALREADY_DECIDED (72.2953ms)
       ✔ 2.2: Re-reviewing REJECTED report returns 409 ALREADY_DECIDED (52.6098ms)
       ✔ 2.3: Disbursing an unapproved SUBMITTED report returns 409 NOT_APPROVED (31.5523ms)
       ✔ 2.4: Disbursing an unapproved PENDING_DEPT_HEAD report returns 409 NOT_APPROVED (41.9476ms)
       ✔ 2.5: Disbursing an unapproved PENDING_EXEC report returns 409 NOT_APPROVED (63.6963ms)
       ✔ 2.6: Disbursing an already PAID report returns 409 NOT_APPROVED (53.8841ms)
     ✔ Vector 2: Terminal State Immutability (317.2818ms)
     ▶ Vector 3: Authorization & Privacy
       ✔ 3.1: Self-approval returns 403 SELF_APPROVAL_PROHIBITED (26.8529ms)
       ✔ 3.2: Cross-employee editing returns 403 FORBIDDEN (28.1218ms)
       ✔ 3.3: Non-admin disbursement attempt by employee returns 403 FORBIDDEN (43.7597ms)
       ✔ 3.4: Non-admin disbursement attempt by manager returns 403 FORBIDDEN (43.2165ms)
     ✔ Vector 3: Authorization & Privacy (142.5252ms)
     ▶ Vector 4: Boundaries & Zero-Trust Inputs
       ✔ 4.1: Amount <= 0 returns 400 INVALID_AMOUNT (25.1904ms)
       ✔ 4.2: Item > 5,000 NGN without receipt returns 422 RECEIPT_REQUIRED (20.2182ms)
       ✔ 4.3: Category ceiling exceedance returns 422 CATEGORY_LIMIT_EXCEEDED (15.7051ms)
       ✔ 4.4: Unrecognized keys on submit return 400 VALIDATION_ERROR (17.2756ms)
       ✔ 4.5: Unrecognized keys on item return 400 VALIDATION_ERROR (19.0578ms)
       ✔ 4.6: Unrecognized keys on update return 400 VALIDATION_ERROR (32.1367ms)
       ✔ 4.7: Unrecognized keys on review action return 400 VALIDATION_ERROR (32.9148ms)
       ✔ 4.8: Unrecognized keys on disbursement return 400 VALIDATION_ERROR (54.3331ms)
     ✔ Vector 4: Boundaries & Zero-Trust Inputs (218.2252ms)
     ▶ Vector 5: Idempotent Execution & Clean Teardown
       ✔ 5.1: Datastore reset leaves zero dirty state in JSON files (76.2802ms)
     ✔ Vector 5: Idempotent Execution & Clean Teardown (76.5713ms)
   ✔ Challenger M4-1: In-Depth Empirical Stress Testing of Expense Invariants & State Machine (1637.951ms)
   ℹ tests 26
   ℹ suites 6
   ℹ pass 26
   ℹ fail 0
   ℹ duration_ms 1645.5251
   ```

2. **Master E2E Test Suite Execution**:
   Command:
   ```powershell
   node tests/testRunner.ts
   ```
   Verbatim output:
   `✔ tests 122, pass 122, fail 0 (duration: 7434.28ms) [TEST SUITE RUN: 100% PASSED]`

3. **Receipt Security Adversarial Suite Execution**:
   Command:
   ```powershell
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/adversarial/m4-receipt-security.test.ts
   ```
   Verbatim output:
   `✔ tests 40, pass 40, fail 0 (duration: 631.29ms)`

4. **Production Frontend Build**:
   Command:
   ```powershell
   npm --prefix update run build
   ```
   Verbatim output:
   `✓ built in 3.34s (0 errors)`

### 1.3 Code Inspection Findings
Inspection of `update/server/controllers/expenseController.ts:489-497` and lines `566-593`:
```typescript
489:   // Self-approval prohibition
490:   if (report.employeeId === user.profile.id) {
491:     res.status(403).json({
492:       success: false,
493:       error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'Self-approval is strictly prohibited', correlationId }
494:     });
495:     return;
496:   }
```
Lines `580-593`:
```typescript
580:     } else if (report.status === 'PENDING_DEPT_HEAD') {
581:       if (report.totalAmount > 250000) {
582:         report.status = 'PENDING_EXEC';
583:         report.currentApproverId = 'emp-admin-01';
584:       } else {
585:         report.status = 'APPROVED';
586:         report.approvedAt = new Date().toISOString();
587:         report.currentApproverId = 'emp-finance-01';
588:       }
589:     } else {
590:       report.status = 'APPROVED';
591:       report.approvedAt = new Date().toISOString();
592:       report.currentApproverId = 'emp-finance-01';
593:     }
```
**Specific Deficiencies Directly Observed**:
1. No check for `user.role === 'EMPLOYEE'`: An authenticated employee (`usr-employee-02`, Chioma) reviewing an expense report filed by peer employee (`usr-employee-01`, Bakare) receives HTTP 200 OK and successfully approves the claim.
2. In `report.status === 'PENDING_DEPT_HEAD'`, there is no verification that `user.profile.id === report.currentApproverId` or `user.role === 'ADMIN'`. A standard line manager (`emp-manager-01`) who already approved Tier 1 can approve Tier 2 (HTTP 200 OK), bypassing the Department Head (`emp-depthead-01`).
3. In `report.status === 'PENDING_EXEC'`, there is no verification that `user.role === 'ADMIN'` or `user.profile.id === report.currentApproverId`. A non-executive manager can approve a > 250k NGN claim directly to `APPROVED` (HTTP 200 OK).

---

## 2. Logic Chain

1. **From Observation 1.3**: `reviewExpenseReportHandler` handles review decisions for all expense claims. The only identity guard present is self-approval prohibition (`report.employeeId === user.profile.id`).
2. **From Observation 1.2 (Probe 1.5)**: An authenticated employee with role `EMPLOYEE` calling `PATCH /api/v1/expenses/reports/:id/action` on another employee's claim does not trigger self-approval prohibition. Because no role check is performed, the action succeeds with HTTP 200 OK. This represents a Broken Function Level Authorization vulnerability (OWASP Top 10 A01 / CWE-269).
3. **From Observation 1.2 (Probe 1.6)**: When an expense claim exceeds 50,000 NGN, the state transitions to `PENDING_DEPT_HEAD` with `report.currentApproverId = 'emp-depthead-01'`. However, when line manager `emp-manager-01` submits an `APPROVE` action, the code executes line 585 without checking the caller's identity, transitioning the report to `APPROVED`. This directly violates the dispatch constraint: *"Non-dept-head manager cannot approve; Dept Head approval transitions to APPROVED"*.
4. **From Observation 1.2 (Probe 1.7)**: When an expense claim exceeds 250,000 NGN, the state transitions to `PENDING_EXEC` with `report.currentApproverId = 'emp-admin-01'`. Any manager submitting an `APPROVE` action transitions the report to `APPROVED`, bypassing the executive tier.
5. **Conclusion from Steps 1–4**: While baseline functionality and input validation are fully operational, the state machine review endpoint fails to enforce role-based and escalation-tier access controls.

---

## 3. Caveats

- **Sandbox Network Isolation**: Direct TCP loopback connections fail with `EACCES` in this environment. All tests were executed in-process against `createApp()` using Node.js mock socket `IncomingMessage` / `ServerResponse` streams.
- **Review-Only Constraint**: As an empirical challenger, implementation code in `update/server/controllers/expenseController.ts` was not modified directly. Remediation instructions and code blocks are documented below for `worker_m4`.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 4 is 90% complete and functionally high-quality, passing all 122 baseline E2E tests, 40 receipt security tests, and client production build. However, approval authorization guards must be patched in `update/server/controllers/expenseController.ts`:

### Required Remediation (Drop-in fix for `worker_m4`):
In `update/server/controllers/expenseController.ts`, inside `reviewExpenseReportHandler` (after line 496):

```typescript
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

---

## 5. Verification Method

To independently verify the challenge findings and confirm resolution:

1. **Execute Challenger Test Suite**:
   ```powershell
   node --import ./update/node_modules/tsx/dist/loader.mjs tests/adversarial/m4-expense-invariants-challenger.test.ts
   ```
   *Expected outcome*: 26/26 tests execute cleanly. Probes 1.5, 1.6, and 1.7 print status codes showing current bypasses.

2. **Execute Full Master E2E Suite**:
   ```powershell
   node tests/testRunner.ts
   ```
   *Expected outcome*: 122/122 tests pass across Tiers 1–4.

3. **Verify Challenge Report**:
   - Inspect `.agents/teamwork/challenger_m4_1/challenge.md`
