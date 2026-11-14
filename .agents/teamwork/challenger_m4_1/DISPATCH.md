# DISPATCH: challenger_m4_1 (Expense Invariants & State Machine Challenger)

## Mission
You are `challenger_m4_1`. Adversarially stress-test the expense engine, multi-tier state machine transitions, policy thresholds, and boundary conditions for Milestone 4.

## Input Files to Read
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\helpers\testClient.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\expenses.test.ts

## Adversarial Challenge Plan
Write and execute an adversarial test file (e.g., `tests/adversarial/m4-expense-invariants-stress.test.ts`) that executes in-process via `createApp()` and asserts:
1. **Multi-Tier Escalation Invariants**:
   - Report $\le$ 50k: Manager approval transitions directly to `APPROVED`.
   - Report 75k (> 50k and $\le$ 250k): Manager approval transitions to `PENDING_DEPT_HEAD`. Non-dept-head manager cannot approve; Dept Head approval transitions to `APPROVED`.
   - Report 300k (> 250k): Dept Head approval transitions to `PENDING_EXEC`. Non-executive manager cannot approve; Admin/Executive approval transitions to `APPROVED`.
2. **Terminal State Immutability**:
   - Re-reviewing `PAID` report returns HTTP 409 `ALREADY_DECIDED`.
   - Re-reviewing `REJECTED` report returns HTTP 409 `ALREADY_DECIDED`.
   - Disbursing an unapproved or already paid report returns HTTP 409 `NOT_APPROVED` / `ALREADY_DECIDED`.
3. **Authorization & Privacy**:
   - Self-approval prohibition: Manager submitting their own report cannot approve it (HTTP 403 `SELF_APPROVAL_PROHIBITED`).
   - Cross-employee unauthorized editing: Employee B cannot `PUT /reports/:id` on Employee A's report (HTTP 403 `FORBIDDEN`).
   - Non-admin disbursement attempt: Regular manager or employee cannot disburse (HTTP 403 `FORBIDDEN`).
4. **Boundary & Zero-Trust Inputs**:
   - Zero, negative, and NaN amounts return HTTP 400 `INVALID_AMOUNT`.
   - Unrecognized payload keys on submit/update/action return HTTP 400 `VALIDATION_ERROR`.
   - Single item > 5,000 NGN without receipt returns HTTP 422 `RECEIPT_REQUIRED`.
   - Category ceiling exceedance returns HTTP 422 `CATEGORY_LIMIT_EXCEEDED`.
5. Ensure 100% test idempotency (clean teardown, no residual dirty state in json files).

Deliver `challenge.md` and hard handoff `handoff.md` with explicit verdict (APPROVE or REQUEST_CHANGES). Send completion message to parent.
NOTE: Run tests with default sandbox permissions (`BypassSandbox: false`).

## 2026-11-10T03:37:33Z
You are challenger_m4_1 (Expense Invariants & State Machine Challenger).

Working Directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m4_1

Read before starting:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m4_1\DISPATCH.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md

Challenge tasks:
Write and execute an adversarial test suite (e.g. `tests/adversarial/m4-expense-invariants-stress.test.ts`) that runs in-process via `createApp()` and tests:
1. Multi-tier escalation invariants: <=50k approved by manager; 75k requires dept head; 300k requires executive.
2. Terminal state immutability: re-reviewing PAID/REJECTED returns 409 ALREADY_DECIDED; unapproved disbursement returns 409 NOT_APPROVED.
3. Authorization & privacy: self-approval returns 403 SELF_APPROVAL_PROHIBITED; cross-employee editing returns 403; non-admin disburse returns 403.
4. Boundaries: amount <= 0 returns 400 INVALID_AMOUNT; item > 5000 without receipt returns 422 RECEIPT_REQUIRED; category ceiling returns 422 CATEGORY_LIMIT_EXCEEDED; unrecognized keys return 400 VALIDATION_ERROR.
5. Idempotent execution (clean teardown after tests).

Deliver `challenge.md` and hard handoff `handoff.md` with explicit verdict (APPROVE or REQUEST_CHANGES). Send completion message to parent.
NOTE: Run all tests with default sandbox permissions (`BypassSandbox: false`). In-process Express dispatch only.

