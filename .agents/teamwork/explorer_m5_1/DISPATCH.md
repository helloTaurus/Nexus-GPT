# Task Assignment: Appraisal Engine & Scoring Specification Explorer

**Agent ID**: `explorer_m5_1`
**Role**: `teamwork_explorer`
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_1`

## Mission
Investigate the backend architecture, schema design, and state machine invariants for Milestone 5: Performance Appraisal Cycles, KRA & Competency Weighting Engine, and Evaluation Workflows (Features 15 & 16 in PROJECT.md).

## Input Files to Read
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md` (Verbatim user requirements)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md` (Master project specification)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\appraisals.test.ts` (Appraisal E2E test requirements)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\testRunner.ts` (Runner wiring)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\controllers\` and `update\server\routes\` (Existing server patterns)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\repositories\types.ts` and `store.ts` (Data stores)

## Key Technical Objectives
1. Detail the appraisal cycle lifecycle: DRAFT -> ACTIVE -> SELF_REVIEW -> MANAGER_REVIEW -> CALIBRATION -> CLOSED.
2. Define the scoring engine: 70% KRA weight, 30% Competency weight (or configurable), 5-point rating rubric (1.0 to 5.0 with 0.1 precision), weighted sum calculation, band assignment (e.g. Needs Improvement, Meets Expectations, Exceeds Expectations, Outstanding).
3. Specify Zod schemas (`appraisalSchemas.ts`) with `.strict()` validation, negative/zero score rejection, and range checks [1.0, 5.0].
4. Specify authorization rules: employees can only submit self-ratings during SELF_REVIEW, managers can only evaluate direct reports during MANAGER_REVIEW, only ADMIN/HR can calibrate or close cycles.
5. Define data model and repository storage in `update/server/repositories/` (e.g., `appraisalCycles.json`, `appraisals.json`).

## Output Requirements
- Deliver `appraisal_engine_plan.md` in your working directory.
- Deliver `handoff.md` following standard format (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send completion message to parent (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`).


## 2026-11-10T04:05:23Z
You are explorer_m5_1, an exploration subagent for Milestone 5: Appraisal Engine & Scoring Specification.
Your working directory is: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_1

MANDATORY FIRST STEP: Read c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Also read:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_1\DISPATCH.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\appraisals.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\testRunner.ts
- Existing server controllers, schemas, and routes in c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\

Follow all Teamwork agent protocols:
1. Initialize BRIEFING.md and progress.md in your working directory. Keep progress.md updated.
2. Investigate the appraisal lifecycle (DRAFT -> ACTIVE -> SELF_REVIEW -> MANAGER_REVIEW -> CALIBRATION -> CLOSED).
3. Investigate the scoring engine: 70% KRA, 30% Competency, 5-point rating rubric (1.0 to 5.0), band categorization.
4. Investigate Zod schemas (`appraisalSchemas.ts`) with `.strict()` validation, boundary constraints, and zero-trust sanitization.
5. Investigate RBAC authorization rules: self-appraisal submission restricted to self during SELF_REVIEW, manager appraisal restricted to direct manager during MANAGER_REVIEW, calibration/closure restricted to ADMIN.
6. Deliver `appraisal_engine_plan.md` and `handoff.md` in your working directory.
7. Send a concise completion message back to parent using send_message.

Note: Windows sandbox restricts loopback TCP binding; any test runs should be in-process or static inspection. Do not modify implementation code files.
