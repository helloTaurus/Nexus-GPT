# Handoff Report: Milestone 3 Iteration 2 Review (Full-Stack & State Machine Invariants)

**Agent**: `reviewer_m3_r2_2` (Full-Stack & State Machine Invariants Reviewer)  
**Parent Agent**: `parent` (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`)  
**Timestamp**: 2026-11-10T02:51:00Z  
**Type**: Hard Handoff  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 State Machine Terminal Guards & Balance Ledgers
Direct code inspection of `update/server/controllers/leaveController.ts`:
1. `cancelLeaveRequestHandler` (lines 354-365):
   ```ts
   // Reject cancellation of terminal states (REJECTED or CANCELLED)
   if (leaveReq.status !== 'SUBMITTED' && leaveReq.status !== 'APPROVED') {
     res.status(400).json({
       success: false,
       error: {
         code: 'INVALID_STATE_TRANSITION',
         message: `Cannot cancel leave request in '${leaveReq.status}' state`,
         correlationId
       }
     });
     return;
   }
   ```
   Past approved leave guard preserved (lines 367-378):
   ```ts
   const today = new Date().toISOString().split('T')[0];
   if (leaveReq.startDate < today && leaveReq.status === 'APPROVED') {
     res.status(400).json({
       success: false,
       error: {
         code: 'PAST_LEAVE_CANNOT_BE_CANCELLED',
         message: 'Cannot retroactively cancel past leave. Contact HR Administrator',
         correlationId
       }
     });
     return;
   }
   ```
   Balance restoration (lines 380-394):
   - For `SUBMITTED`: `balance.pendingDays -= leaveReq.totalDays` -> restores `availableDays`.
   - For `APPROVED`: `balance.usedDays -= leaveReq.totalDays` -> restores `availableDays`.
   - Mutates `leaveReq.status = 'CANCELLED'`.

2. `reviewLeaveRequestHandler` (lines 269-280):
   ```ts
   // Guard against re-reviewing already decided or cancelled requests
   if (leaveReq.status !== 'SUBMITTED') {
     res.status(409).json({
       success: false,
       error: {
         code: 'ALREADY_DECIDED',
         message: `Leave request has already been decided (current status: '${leaveReq.status}')`,
         correlationId
       }
     });
     return;
   }
   ```
   Balance adjustments (lines 294-309):
   - If APPROVE: `pendingDays -= totalDays`, `usedDays += totalDays`.
   - If REJECT: `pendingDays -= totalDays`, `usedDays` untouched.
   - For both: `availableDays = (allocatedDays + carriedOverDays) - usedDays - pendingDays`.
   - Blocks subsequent reviews on `APPROVED`, `REJECTED`, or `CANCELLED` requests with HTTP 409 `ALREADY_DECIDED`.

### 1.2 Verbatim Test Executions

#### Command 1: Adversarial Stress Suite
Command:
```powershell
node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts
```
Verbatim Output (exited with code 1):
```
▶ Milestone 3 Adversarial Stress Suite: Leave Rules Engine, Invariants & Workflows
...
  ▶ Vector 5: Authorization, Self-Approval & Privacy Invariants
    ✔ 5.1: Self-approval prohibition: Manager cannot approve their own leave request (403) (53.4436ms)
    ✖ 5.2: Non-reporting manager authorization: Manager cannot approve report from another chain (403) (105.9108ms)
...
✖ Milestone 3 Adversarial Stress Suite: Leave Rules Engine, Invariants & Workflows (3365.8859ms)
ℹ tests 45
ℹ suites 7
ℹ pass 44
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4604.0329

✖ failing tests:

test at tests\adversarial\m3-leave-invariants-stress.test.ts:919:5
✖ 5.2: Non-reporting manager authorization: Manager cannot approve report from another chain (403) (105.9108ms)
  TypeError: Cannot read properties of undefined (reading 'id')
      at TestContext.<anonymous> (C:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\adversarial\m3-leave-invariants-stress.test.ts:941:41)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Suite.processPendingSubtests (node:internal/test_runner/test:787:7)
```

Root-Cause Code Inspection in `tests/adversarial/m3-leave-invariants-stress.test.ts`:
- Lines 184-187:
  ```ts
  async function resetTestState(): Promise<void> {
    await getDataStore().leaves.reset();
    await getDataStore().audit.reset();
  }
  ```
- Lines 922-941:
  ```ts
  // Create new staff Tari under DeptHead
  await adminClient.post('/api/v1/employees', {
    firstName: 'Tari',
    lastName: 'Briggs',
    email: 'tari.test@nexusfinance.ng',
    departmentId: 'dept-ops',
    designationId: 'des-se',
    managerId: 'emp-depthead-01'
  });

  // Tari submits leave
  const tariClient = await adminClient;
  await tariClient.login('tari.test@nexusfinance.ng', 'TemporaryPass123!');
  const submitRes = await tariClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-09-01',
    endDate: '2026-09-04',
    reason: 'Tari off days'
  });
  const reqId = submitRes.body.data.id;
  ```
- File `update/server/data/users.json` line 207 contains `"email": "tari.test@nexusfinance.ng"`. On reruns, `POST /api/v1/employees` returns 409 `DUPLICATE_EMAIL`. Tari's balances are not created. Tari's leave application returns 404 `BALANCE_NOT_FOUND`. `submitRes.body.data` is `undefined`, crashing line 941.

#### Command 2: Frontend Integrity Suite
Command:
```powershell
node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-frontend-integrity.test.ts
```
Verbatim Output (exited with code 0):
```
✔ CHALLENGE: update/src/components/ has exactly 0 loose files in its root (3.4477ms)
✔ CHALLENGE: update/src/lib/api.ts explicitly enforces credentials: "include" on all fetch requests (1.9158ms)
✔ CHALLENGE: No rogue fetch() in update/src bypasses credentials: "include" (39.8075ms)
✔ CHALLENGE: StaffProfilePage.tsx strictly validates 10-digit Nigerian NUBAN format (1.7204ms)
✔ CHALLENGE: StaffProfilePage.tsx strictly validates 11-digit BVN and NIN format (1.1185ms)
✔ CHALLENGE: StaffProfilePage.tsx excludes restricted fields from PUT payload (1.2854ms)
✔ CHALLENGE: update/src/lib/api.ts profile.update signature strictly excludes restricted fields (1.2294ms)
✔ CHALLENGE: StaffLeavePage.tsx enforces zero-overdraft and inverted date submission guards (1.7524ms)
✔ CHALLENGE: LeaveApprovalPage.tsx visually and logically prevents self-approvals (1.5767ms)
✔ CHALLENGE: All Milestone 3 portal pages adhere to Nexus tokens and UI primitives (4.3556ms)
✔ CHALLENGE: SEED_NIGERIAN_HOLIDAYS_2026 defines all 12 statutory gazetted holidays (1.8372ms)
✔ CHALLENGE: No legacy mock setTimeout saves or mock ID generation remain in M3 pages (1.7751ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 499.2485
```

#### Command 3: Full E2E Test Runner
Command:
```powershell
node tests/testRunner.ts
```
Verbatim Output (exited with code 0):
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
ℹ duration_ms 10208.3717

======================================================
[TEST SUITE RUN: 100% PASSED] All tests passed.
```

#### Command 4: Production Client Build
Command:
```powershell
npm --prefix update run build
```
Verbatim Output (exited with code 0):
```
vite v8.3.5 building client environment for production...
transforming...
✓ 6669 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   2.04 kB │ gzip:   0.87 kB
dist/assets/index-DZ0UKOXk.css   83.26 kB │ gzip:  15.22 kB
dist/assets/index-DHe4Iegm.js   969.14 kB │ gzip: 241.80 kB
✓ built in 4.04s
```

---

## 2. Logic Chain

1. **Production Logic Correctness**:
   - Observations 1.1 confirm that `update/server/controllers/leaveController.ts` implements strict terminal state transitions:
     - `cancelLeaveRequestHandler` rejects non-SUBMITTED/non-APPROVED with HTTP 400 `INVALID_STATE_TRANSITION`.
     - `reviewLeaveRequestHandler` rejects non-SUBMITTED with HTTP 409 `ALREADY_DECIDED`.
     - Balance ledgers preserve `allocatedDays + carriedOverDays = usedDays + pendingDays + availableDays` and prevent negative pending days, double used deductions, or quota inflation.
2. **Verification Suite Execution**:
   - Observation 1.2 (Commands 2, 3, 4) proves that the frontend integrity suite (12/12), baseline E2E runner (122/122), and client build (0 errors) pass 100%.
3. **Flaw in Adversarial Stress Suite**:
   - Observation 1.2 (Command 1) shows that running `node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts` fails test 5.2 with `TypeError: Cannot read properties of undefined (reading 'id')` and exits with code 1.
   - Tracing `m3-leave-invariants-stress.test.ts:919-941` revealed that test 5.2 onboards a user with static email `tari.test@nexusfinance.ng` into `update/server/data/users.json`.
   - Because `resetTestState()` only calls `leaves.reset()` and `audit.reset()`, any subsequent run collides on `tari.test@nexusfinance.ng`, returning 409 `DUPLICATE_EMAIL`, failing to initialize Tari's balances, returning 404 `BALANCE_NOT_FOUND` on leave submission, and crashing test 5.2.
   - When users are wiped or dynamic email is used, 45/45 pass. However, as currently checked in, the suite is non-idempotent and fails out of the box with exit code 1.

---

## 3. Caveats

- **Network Sandbox Constraint**: TCP loopback socket connections fail with `EACCES` in this sandbox without elevated privileges. Both `m3-leave-invariants-stress.test.ts` and `testRunner.ts` execute via high-fidelity in-process HTTP dispatch and the native Node.js test runner (`node:test`).
- **Review-Only Constraint**: Adhering strictly to review constraints, no implementation or test files outside the reviewer directory were modified.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The core business logic and state-machine terminal guards in `leaveController.ts` are verified and fully intact. However, Milestone 3 cannot be approved until `tests/adversarial/m3-leave-invariants-stress.test.ts` is made idempotent so that `node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts` passes 45/45 deterministically on every run.

**Required Remediation**:
1. In `tests/adversarial/m3-leave-invariants-stress.test.ts` (test 5.2):
   Generate a unique email per run:
   ```ts
   const uniqueEmail = `tari.${Date.now()}.${Math.floor(Math.random() * 10000)}@nexusfinance.ng`;
   ```
   And instantiate a dedicated `tariClient`:
   ```ts
   const tariClient = new ExpressClient();
   await tariClient.login(uniqueEmail, 'TemporaryPass123!');
   ```
2. Clean `update/server/data/users.json` to purge leftover non-seed user records.

---

## 5. Verification Method

To independently verify this report:

1. **Verify Adversarial Stress Suite Failure on Dirty State**:
   ```powershell
   node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts
   ```
   *Expected outcome*: Exits with code 1; test 5.2 fails with `TypeError: Cannot read properties of undefined (reading 'id')` (44 pass, 1 fail).

2. **Verify Frontend Integrity Suite**:
   ```powershell
   node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-frontend-integrity.test.ts
   ```
   *Expected outcome*: 12/12 tests pass in < 500ms.

3. **Verify Baseline 122-Test E2E Runner**:
   ```powershell
   node tests/testRunner.ts
   ```
   *Expected outcome*: 122/122 tests pass in ~10 seconds.

4. **Verify Client Production Build**:
   ```powershell
   npm --prefix update run build
   ```
   *Expected outcome*: Vite build succeeds in ~4s with 0 errors.

5. **Verify State Machine Guards in Source**:
   - `update/server/controllers/leaveController.ts:355`: verify `leaveReq.status !== 'SUBMITTED' && leaveReq.status !== 'APPROVED'` returns 400 `INVALID_STATE_TRANSITION`.
   - `update/server/controllers/leaveController.ts:270`: verify `leaveReq.status !== 'SUBMITTED'` returns 409 `ALREADY_DECIDED`.
