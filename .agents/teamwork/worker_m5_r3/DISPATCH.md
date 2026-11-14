# Task Assignment: Milestone 5 Remediation Worker (worker_m5_r3)

**Milestone**: Milestone 5 Remediation — Performance Appraisal State Machine Preconditions & Weight Invariant Defaults  
**Role**: `worker`  
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m5_r3`  
**Parent Orchestrator**: `f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`  

---

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

---

## Context & Objectives
In Milestone 5 Gate Iteration 1, adversarial challenger `challenger_m5_1` performed white-box stress testing with `tests/adversarial/m5-appraisal-invariants-challenger.test.ts`. 26/31 tests passed, but 5 tests failed revealing critical-to-medium state machine precondition gaps and weightage default handling:

1. **State Machine Immutability & Lifecycle Preconditions**:
   - `submitSelfAppraisalHandler`: When `sub.status !== 'NOT_STARTED'` (e.g. `SELF_SUBMITTED` or `COMPLETED`), it must reject with HTTP 409 `INVALID_STATE` (preventing double-submission and preventing regression of finalized `COMPLETED` reviews).
   - `submitManagerReviewHandler`: When `sub.status !== 'SELF_SUBMITTED'` (e.g. `COMPLETED` or `NOT_STARTED`), it must reject with HTTP 409 `INVALID_STATE` (preventing mutation/regression of finalized reviews).
   - `acknowledgeOutcomeHandler`: When `sub.status !== 'COMPLETED'`, it must reject with HTTP 409 `INVALID_STATE` (cannot acknowledge prior to committee calibration).
2. **Cycle Creation Weightage Defaults**:
   - `createCycleHandler`: Must evaluate default weights:
     `const kra = body.kraWeightagePercent ?? 70;`
     `const comp = body.competencyWeightagePercent ?? 30;`
     `if (kra + comp !== 100)` -> HTTP 422 `INVALID_WEIGHTAGES`.
3. **Reference Server Synchronization**:
   - Mirror these guards and checks in `tests/fixtures/referenceServer.ts`.

---

## Files to Inspect & Modify
1. Read `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m5_1\challenge.md` and `handoff.md` for exact failure points and code snippets.
2. Read `tests/adversarial/m5-appraisal-invariants-challenger.test.ts` lines 450–600.
3. Modify `update/server/controllers/appraisalController.ts`.
4. Modify `tests/fixtures/referenceServer.ts`.

---

## Mandatory Verification Commands
Run in PowerShell / bash (without BypassSandbox):
1. Adversarial harness:
   `npx --prefix update tsx --test tests/adversarial/m5-appraisal-invariants-challenger.test.ts`
   **Target**: 31/31 passing tests (0 failures).
2. Appraisals baseline E2E:
   `node --test tests/e2e/tier1-features/appraisals.test.ts tests/e2e/tier2-boundaries/appraisal-boundaries.test.ts tests/e2e/tier3-combinations/appraisal-workflow-combinations.test.ts tests/e2e/tier4-scenarios/year-end-appraisal-calibration.test.ts`
   **Target**: 16/16 passing tests (0 failures).
3. Full system E2E test runner:
   `node tests/testRunner.ts`
   **Target**: 122/122 passing tests (100% pass rate).
4. Client production build:
   `npm --prefix update run build`
   **Target**: Client build completes with 0 errors.

---

## Output Deliverables
1. Write `progress.md` tracking each step and execution command.
2. Write `handoff.md` with 5 sections: Observation, Logic Chain, Caveats, Conclusion (Verdict: DONE), Verification Method.
3. Send completion message to parent orchestrator.

## 2026-11-10T09:01:14Z
[Message] timestamp=2026-11-10T09:01:14Z sender=f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8 priority=MESSAGE_PRIORITY_HIGH content=You are worker_m5_r3, Milestone 5 Remediation Worker for the Nexus Finance HRMS & Expense Suite project.
Task: Remediate the 4 state machine precondition and cycle weightage issues identified by challenger_m5_1.
