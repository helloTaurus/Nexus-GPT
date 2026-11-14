# Milestone 3 Iteration 2 Review Report: Full-Stack & State Machine Invariants

**Reviewer**: `reviewer_m3_r2_2` (Full-Stack & State Machine Invariants Reviewer)  
**Parent Agent**: `parent` (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`)  
**Date**: 2026-11-10T02:50:00Z  
**Verdict**: **REQUEST_CHANGES**

---

## Executive Summary

The Milestone 3 remediation performed by `worker_m3_r2` successfully fixed the core terminal state guards and balance ledger protection in `update/server/controllers/leaveController.ts`, resolved the `zod.ts` schema engine crashes, and wired zero-trust `.strict()` schema validation across all leave routes. 

However, during independent full-stack verification, the adversarial stress suite (`node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts`) failed with exit code 1 (44/45 passed, 1 failed). The failure was traced to test 5.2 lacking idempotency due to a hardcoded email (`tari.test@nexusfinance.ng`) mutating `update/server/data/users.json`, while `resetTestState()` omits user repository resets. On any subsequent execution, employee onboarding returns HTTP 409 `DUPLICATE_EMAIL`, leaving the user without leave balances and crashing test 5.2 with an unhandled `TypeError`.

All other verification gates passed cleanly:
- Frontend Integrity Suite (`m3-frontend-integrity.test.ts`): **12/12 PASSED**
- Baseline E2E Verification Runner (`testRunner.ts`): **122/122 PASSED**
- Client Production Build (`npm --prefix update run build`): **0 ERRORS**
- Server State Machine Guards in `leaveController.ts`: **VERIFIED & SECURE**

---

## 1. State Machine & Ledger Invariant Review

### 1.1 `cancelLeaveRequestHandler` Terminal Guards (`update/server/controllers/leaveController.ts:355-395`)
- **Inspection**:
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
- **Finding**: Cancelling requests with status `REJECTED` or `CANCELLED` is strictly blocked with HTTP 400 `INVALID_STATE_TRANSITION`.
- **Retroactive Guard**: Correctly preserves `if (leaveReq.startDate < today && leaveReq.status === 'APPROVED')` returning HTTP 400 `PAST_LEAVE_CANNOT_BE_CANCELLED`.
- **Balance Restoration**:
  - `SUBMITTED`: decrements `pendingDays`, restoring `availableDays`.
  - `APPROVED`: decrements `usedDays`, restoring `availableDays`.
  - Terminal status updated to `CANCELLED`.
- **Verdict**: **COMPLIANT**

### 1.2 `reviewLeaveRequestHandler` Terminal Guards (`update/server/controllers/leaveController.ts:270-309`)
- **Inspection**:
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
- **Finding**: Reviews on non-`SUBMITTED` requests (`APPROVED`, `REJECTED`, or `CANCELLED`) are strictly blocked with HTTP 409 `ALREADY_DECIDED`.
- **Ledger Invariant Protection**:
  - Prevents negative `pendingDays` (formerly triggered on duplicate approval).
  - Prevents duplicate `usedDays` inflation.
  - Prevents ghost `availableDays` inflation beyond statutory quota (formerly triggered on duplicate rejection).
  - Prevents zombie request resurrection from `CANCELLED` back to `APPROVED`.
- **Verdict**: **COMPLIANT**

---

## 2. Findings

### [Major] Finding 1: Adversarial Stress Test Suite Exits with Code 1 on Repeated Execution Due to User Store Bleed in Test 5.2

- **Where**: `tests/adversarial/m3-leave-invariants-stress.test.ts:919-951` and `tests/adversarial/m3-leave-invariants-stress.test.ts:184-187`
- **What**:
  Executing `node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts` fails with exit code 1:
  ```
  ✖ 5.2: Non-reporting manager authorization: Manager cannot approve report from another chain (403) (105.9108ms)
    TypeError: Cannot read properties of undefined (reading 'id')
        at TestContext.<anonymous> (tests/adversarial/m3-leave-invariants-stress.test.ts:941:41)
  ```
  Total: 45 tests, 44 pass, 1 fail.
- **Why**:
  1. Test 5.2 onboards employee Tari using a static email:
     ```ts
     await adminClient.post('/api/v1/employees', {
       firstName: 'Tari',
       lastName: 'Briggs',
       email: 'tari.test@nexusfinance.ng',
       ...
     });
     ```
     This persists a record to `update/server/data/users.json`.
  2. The test suite's `resetTestState()` function only resets `leaves` and `audit`:
     ```ts
     async function resetTestState(): Promise<void> {
       await getDataStore().leaves.reset();
       await getDataStore().audit.reset();
     }
     ```
     It does not call `getDataStore().users.reset()`.
  3. When the test suite runs a second time, `POST /api/v1/employees` encounters the existing user in `users.json` and rejects with HTTP 409 `DUPLICATE_EMAIL`.
  4. Because employee creation failed, Tari's leave balances are never initialized in `leave_balances.json` (which was reset to default seed balances).
  5. Subsequent `tariClient.post('/api/v1/leaves/requests', ...)` returns HTTP 404 `BALANCE_NOT_FOUND`.
  6. Line 941 evaluates `submitRes.body.data.id` where `submitRes.body.data` is `undefined`, crashing the test with `TypeError`.
- **Suggesting Fix**:
  In `tests/adversarial/m3-leave-invariants-stress.test.ts`:
  1. In test 5.2, generate a dynamic unique email per run:
     ```ts
     const uniqueEmail = `tari.${Date.now()}.${Math.floor(Math.random() * 10000)}@nexusfinance.ng`;
     ```
     And create a separate client for Tari (`const tariClient = new ExpressClient(); await tariClient.login(uniqueEmail, ...);`).
  2. Alternatively/additionally, call `await getDataStore().users.reset()` in `resetTestState()`.
  3. Restore `update/server/data/users.json` to default clean seed records.

---

## 3. Verified Claims

| Claim / Requirement | Verification Command / Method | Result | Notes |
|---|---|---|---|
| `cancelLeaveRequestHandler` rejects non-SUBMITTED/non-APPROVED with 400 `INVALID_STATE_TRANSITION` | Inspected `leaveController.ts:355` & verified via Sub-tests 6.6 | **PASS** | Correctly stops cancellation of rejected and cancelled leaves |
| `reviewLeaveRequestHandler` rejects non-SUBMITTED with 409 `ALREADY_DECIDED` | Inspected `leaveController.ts:270` & verified via Sub-tests 6.7, 6.8, 6.9 | **PASS** | Eliminates double deduction, negative pending balance, quota inflation, and zombie states |
| Frontend Integrity Suite (12/12 tests) | `node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-frontend-integrity.test.ts` | **PASS (12/12)** | Zero loose files, credentials include, strict NUBAN/BVN/NIN validation |
| Baseline E2E Suite (122/122 tests) | `node tests/testRunner.ts` | **PASS (122/122)** | All 22 test files across Tiers 1-4 pass natively in 10.2s |
| Production Client Build (0 errors) | `npm --prefix update run build` | **PASS (0 errors)** | 6669 modules transformed, built in 4.04s |
| Schema Strictness & Native Types | `z.boolean` and `z.union` imports and `.strict()` validation | **PASS** | Unknown and tampered keys rejected with 400 `VALIDATION_ERROR` |
| Adversarial Stress Suite (45/45 tests) | `node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts` | **FAIL (44/45)** | Passes 45/45 on clean seed DB; fails on subsequent runs due to user store state bleed in test 5.2 |

---

## 4. Integrity Analysis

No integrity violations detected:
- No hardcoded test outputs or dummy facade implementations.
- `update/server/controllers/leaveController.ts` implements real, robust state-machine logic.
- `worker_m3_r2` ran against the real Express application `createApp()` and repository layer.
- The failure in test 5.2 is a test fixture state-leak issue, not intentional circumvention.

---

## 5. Review Verdict

**VERDICT: REQUEST_CHANGES**

**Required Changes**:
1. Fix test 5.2 in `tests/adversarial/m3-leave-invariants-stress.test.ts` to ensure idempotency across consecutive runs (e.g., dynamic email `tari.${Date.now()}@nexusfinance.ng` and separate client instance, or user store reset).
2. Clean `update/server/data/users.json` to restore seed user data.
3. Verify that `node ./update/node_modules/tsx/dist/cli.mjs --test tests/adversarial/m3-leave-invariants-stress.test.ts` passes 45/45 consecutively multiple times.
