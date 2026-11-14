# Task Assignment: Workforce Hierarchy & Merkle Audit Challenger (Milestone 5)

**Agent ID**: `challenger_m5_2`
**Role**: `teamwork_challenger`
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m5_2`

## Mission
Perform empirical adversarial testing and boundary challenge on the Workforce Directory, Org Hierarchy, Role Administration, and Merkle Audit Log Verification implemented in Milestone 5 (Features 17 & 18 in PROJECT.md).

## Mandatory First Step
Read `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.

## Also Read
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m5_r2\handoff.md`
- `update/server/controllers/employeeController.ts`, `adminController.ts`
- `update/server/routes/employees.routes.ts`, `admin.routes.ts`
- `update/server/audit/merkleTree.ts`

## Key Challenge Vectors
1. **Hierarchy Cycle Prevention**: Attempt setting `managerId === employeeId` — verify HTTP 422 `SELF_REPORTING_PROHIBITED`. Attempt cyclic assignment (e.g. A reports to B, B reports to C, C assigned to report to A) — verify HTTP 422 `CYCLIC_REPORTING_DETECTED`.
2. **Super-Admin Protection**: Attempt demoting or deactivating the last remaining active `ADMIN` (`usr-admin-01`) — verify HTTP 403 `CANNOT_DEMOTE_LAST_ADMIN`.
3. **Workforce Directory Robustness**: Test pagination boundaries (page 0, negative limits, extreme offsets), SQL/script injection in search queries, malformed NUBAN account lengths.
4. **Merkle Audit Integrity**: Test tamper detection: verify `GET /api/v1/admin/audit-logs/verify` returns `{ valid: true }`, and verify that modifying any historic block hash invalidates the Merkle root and returns `{ valid: false, compromisedId }`.
5. Run empirical test suites:
   `node --test tests/e2e/tier1-features/workforce-directory.test.ts tests/e2e/tier2-boundaries/admin-boundaries.test.ts tests/e2e/tier3-combinations/employee-lifecycle-combinations.test.ts tests/e2e/tier4-scenarios/workforce-restructuring-rollover.test.ts`
   `node tests/testRunner.ts`

## Deliverables
- Deliver `challenge.md` and `handoff.md` in your working directory with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
- Send completion message to parent (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`).

## 2026-11-10T08:44:19Z
You are challenger_m5_2, Workforce Hierarchy & Merkle Audit Challenger for Milestone 5.
Your working directory is: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m5_2

