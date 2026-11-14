## 2026-11-10T01:40:03Z

You are explorer_m3_1, Staff Profile & KYC Specification Explorer for Milestone 3 (Staff Portal Core & Leave Management Suite).

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md`
Also read PROJECT.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md`

Working Directory:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m3_1`

IMPORTANT RULES:
- Never write source code directly. This is an exploration and specification task.
- NEVER set BypassSandbox: true when running any commands. Default sandbox permissions must always be used.
- Update your progress.md regularly with timestamped progress.

MISSION OBJECTIVE:
Analyze the Staff Profile Self-Service and Nigerian KYC / Banking functionality (Feature F03) to deliver a complete technical blueprint for worker_m3:
1. Examine backend profile endpoints and schemas:
   - `update/server/controllers/portalController.ts`
   - `update/server/routes/portal.routes.ts`
   - `update/server/schemas/profileSchemas.ts`
   - `update/server/repositories/userRepository.ts`
2. Examine tests verifying profile:
   - `tests/e2e/tier1-features/profile.test.ts`
   - `tests/e2e/tier2-boundaries/auth-rbac-boundaries.test.ts` (specifically profile restricted field tests)
3. Examine frontend profile page:
   - `update/src/pages/portal/StaffProfilePage.tsx`
4. Document the exact data contract:
   - Readable vs restricted fields (restricted fields like salary, title, role, department cannot be edited by employee).
   - Updatable fields: phone, bankName, nubanAccount (must be 10 digits), bvn, nin, emergencyContact (name, phone, relationship).
   - How the frontend should fetch the profile on mount (`GET /api/v1/portal/profile`) with `credentials: 'include'`.
   - How the frontend should submit updates (`PUT /api/v1/portal/profile`).
   - Loading skeletons, validation errors, and success notifications adhering to Nexus design tokens (Sapphire #0D51B2, Emerald #007B58, Bricolage Grotesque, Instrument/DM Sans).
5. Produce your findings and implementation blueprint in `profile_kyc_plan.md` and complete a structured `handoff.md` in your working directory. Send a message to orchestrator when complete.
