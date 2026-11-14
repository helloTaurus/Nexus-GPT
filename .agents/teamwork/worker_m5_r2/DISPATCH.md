# Task Assignment: Milestone 5 Implementation Worker (Replacement)

**Agent ID**: `worker_m5_r2`
**Role**: `teamwork_worker`
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m5_r2`

## Mission
Execute full implementation of Milestone 5: Performance Appraisals & Administrative Management (Features 10, 11, 15, 16, 17, 18, 19, 20, 21 in PROJECT.md).

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Files to Read First
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md` (Verbatim user requirements)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md` (Master project specification & design tokens)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_1_r2\appraisal_engine_plan.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_1_r2\handoff.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_2_r2\workforce_hierarchy_plan.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_2_r2\handoff.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_3_r2\appraisal_admin_ui_plan.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_3_r2\handoff.md`

## Write Ownership (Files You Own Exclusively)
- `update/server/schemas/appraisalSchemas.ts` (create)
- `update/server/schemas/adminSchemas.ts` (create)
- `update/server/schemas/index.ts`
- `update/server/routes/appraisals.routes.ts`
- `update/server/routes/employees.routes.ts`
- `update/server/routes/admin.routes.ts`
- `update/server/controllers/appraisalController.ts`
- `update/server/controllers/employeeController.ts`
- `update/server/controllers/adminController.ts`
- `update/server/audit/merkleTree.ts` (create)
- `update/src/lib/appraisalTypes.ts` (create)
- `update/src/lib/workforceTypes.ts` (create)
- `update/src/lib/api.ts`
- `update/src/pages/portal/StaffAppraisalsPage.tsx`
- `update/src/pages/admin/AppraisalCalibrationPage.tsx`
- `update/src/pages/admin/EmployeeDirectoryPage.tsx`
- `update/src/pages/admin/AuditLogsPage.tsx`

## Key Implementation Objectives
1. **Backend Schemas & Validation**:
   - Create `appraisalSchemas.ts` with `.strict()` schemas: `createCycleSchema`, `selfAppraisalSchema`, `managerReviewSchema`, `calibrateScoreSchema`, `acknowledgeSchema`. Export in `schemas/index.ts`.
   - Create `adminSchemas.ts` with `.strict()` validation for settings and audit queries. Export in `schemas/index.ts`.
   - Wire `validateBody` middleware in `appraisals.routes.ts`, `employees.routes.ts`, `admin.routes.ts`.
2. **Backend Appraisal Controller**:
   - Enforce IEEE 754 precision rounding rule: `Number(overall.toFixed(2))` so `(4.25 * 0.70) + (4.5 * 0.30) = 4.325` evaluates to `4.32`.
   - Maintain error codes: 400 `VALIDATION_ERROR`, 422 `INVALID_RATING`, 422 `INVALID_WEIGHTAGES`, 409 `INVALID_STATE`, 403 `FORBIDDEN`.
3. **Backend Workforce Controller & Hierarchy**:
   - Enforce self-reporting check: reject `managerId === employeeId` with 422 `SELF_REPORTING_PROHIBITED`.
   - Enforce cyclic reporting check: recursive upstream traversal to reject reporting cycles with 422 `CYCLIC_REPORTING_DETECTED`.
   - Enforce super-admin protection: prevent demoting or deactivating the last active `ADMIN` with 403 `CANNOT_DEMOTE_LAST_ADMIN`.
   - Add `GET /api/v1/employees/hierarchy` returning recursive `OrgChartNode[]`.
4. **Backend Merkle Audit Service**:
   - Implement `update/server/audit/merkleTree.ts` with binary Merkle tree logic over SHA-256 block leaf hashes.
   - Wire `GET /api/v1/admin/audit-logs/verify` returning cryptographic verification status and Merkle root.
5. **Frontend Client API & Types**:
   - Create `update/src/lib/appraisalTypes.ts` and `update/src/lib/workforceTypes.ts`.
   - Extend `update/src/lib/api.ts` with `api.appraisals`, `api.employees`, and `api.auditLogs`.
6. **Frontend UI Pages**:
   - Fully implement and wire:
     - `StaffAppraisalsPage.tsx`: KRA scoring cards, competency scoring (70/30 weightage), 5-point rating rubric, live composite score preview, self-appraisal submission, acknowledgment.
     - `AppraisalCalibrationPage.tsx`: 4-tier distribution cards, comparative bell-curve bar visualizer, direct reports review queue, calibration drawer.
     - `EmployeeDirectoryPage.tsx`: Search bar, department pills strip, table/card/org-tree toggles, employee provisioning modal, edit modal.
     - `AuditLogsPage.tsx`: Tabular ledger, full-text & severity filters, SHA-256 forensics drawer, live cryptographic Merkle integrity verification badge.
   - Adhere strictly to Visual Tokens: Sapphire `#0D51B2`, Canvas `#0D1624`/`#F7F8FA`, Surface `#121E2E`/`#FFFFFF`, Emerald `#007B58`/`#69D3B0`, 7px control radius, 12px card radius, Bricolage Grotesque & Instrument/DM Sans typography, `--nx-ease` motion.
   - Ensure EXACTLY 0 loose files in `update/src/components/` root.

## Verification Commands to Execute Before Handoff
1. `node --test tests/e2e/tier1-features/appraisals.test.ts tests/e2e/tier2-boundaries/appraisal-boundaries.test.ts tests/e2e/tier3-combinations/appraisal-workflow-combinations.test.ts tests/e2e/tier4-scenarios/year-end-appraisal-calibration.test.ts`
2. `node --test tests/e2e/tier1-features/workforce-directory.test.ts tests/e2e/tier2-boundaries/admin-boundaries.test.ts tests/e2e/tier3-combinations/employee-lifecycle-combinations.test.ts tests/e2e/tier4-scenarios/workforce-restructuring-rollover.test.ts`
3. `node tests/testRunner.ts` (Must pass 122/122 tests)
4. `npm --prefix update run build` (Must pass with 0 errors)

Deliver `handoff.md` with verbatim command outputs and send a completion message back to parent (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`).
