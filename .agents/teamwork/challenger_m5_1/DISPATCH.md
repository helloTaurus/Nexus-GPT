# Task Assignment: Appraisal Invariants & Edge-Case Challenger (Milestone 5)

**Agent ID**: `challenger_m5_1`
**Role**: `teamwork_challenger`
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m5_1`

## Mission
Perform empirical adversarial testing and edge-case boundary challenge on the Appraisal Engine and Evaluation Workflows implemented in Milestone 5 (Features 15 & 16 in PROJECT.md).

## Mandatory First Step
Read `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.

## Also Read
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m5_r2\handoff.md`
- `update/server/controllers/appraisalController.ts`
- `update/server/routes/appraisals.routes.ts`
- `update/server/schemas/appraisalSchemas.ts`

## Key Challenge Vectors
1. **Rubric Boundaries**: Attempt out-of-bounds ratings (< 1.00 or > 5.00, negative ratings, non-numeric ratings, NaN, extreme floats) — verify HTTP 422 `INVALID_RATING`.
2. **Weight Invariants**: Attempt creating cycle with weights != 100% (e.g. 70 + 20 = 90%, 60 + 50 = 110%) — verify HTTP 422 `INVALID_WEIGHTAGES`.
3. **State Machine Invariants**: Attempt skipping steps (e.g. calibrating when submission is `NOT_STARTED`, self-submitting when already `SELF_SUBMITTED`, calibrating already `COMPLETED` submission) — verify HTTP 409 `INVALID_STATE` or `ALREADY_DECIDED`.
4. **Authorization & Privacy**: Verify peer manager cannot evaluate unassigned employee (403 `FORBIDDEN`), peer employee cannot acknowledge another employee's review (403 `FORBIDDEN`), non-admin cannot calibrate or create cycles (403 `FORBIDDEN`).
5. **Scoring Formula Precision**: Stress test composite scoring: verify `(4.25 * 0.70) + (4.5 * 0.30) = 4.325` evaluates to `4.32` without floating-point overflow or precision errors.
6. Run empirical test suites:
   `node --test tests/e2e/tier1-features/appraisals.test.ts tests/e2e/tier2-boundaries/appraisal-boundaries.test.ts tests/e2e/tier3-combinations/appraisal-workflow-combinations.test.ts tests/e2e/tier4-scenarios/year-end-appraisal-calibration.test.ts`
   `node tests/testRunner.ts`

## Deliverables
- Deliver `challenge.md` and `handoff.md` in your working directory with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.

## 2026-11-10T08:44:18Z
You are challenger_m5_1, Appraisal Invariants & Edge-Case Challenger for Milestone 5.
Your working directory is: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m5_1

MANDATORY FIRST STEP: Read c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Also read:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m5_1\DISPATCH.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m5_r2\handoff.md
- update/server/controllers/appraisalController.ts
- update/server/routes/appraisals.routes.ts
- update/server/schemas/appraisalSchemas.ts

Follow all challenge vectors in DISPATCH.md (rubric boundaries, weight invariants, state machine transitions, authorization/privacy, IEEE 754 precision).
Run empirical test suites:
1. node --test tests/e2e/tier1-features/appraisals.test.ts tests/e2e/tier2-boundaries/appraisal-boundaries.test.ts tests/e2e/tier3-combinations/appraisal-workflow-combinations.test.ts tests/e2e/tier4-scenarios/year-end-appraisal-calibration.test.ts
2. node tests/testRunner.ts

Deliver challenge.md and handoff.md with explicit verdict: APPROVE or REQUEST_CHANGES.
Send completion message to parent using send_message.
Note: Windows sandbox restricts loopback socket binding; run tests in-process. Do not modify implementation code.
