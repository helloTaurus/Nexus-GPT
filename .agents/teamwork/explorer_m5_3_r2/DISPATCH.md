# Task Assignment: Appraisal & Admin UI Portal Explorer (Replacement)

**Agent ID**: `explorer_m5_3_r2`
**Role**: `teamwork_explorer`
**Working Directory**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m5_3_r2`

## Mission
Investigate the frontend portal and admin pages, interactive components, client API bindings, and design system fidelity for Milestone 5 (Features 15, 16, 17, 18).

## Input Files to Read
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md` (Verbatim user requirements)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md` (Master project specification & design tokens)
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\portal\StaffAppraisalsPage.tsx`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\admin\AppraisalCalibrationPage.tsx`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\admin\EmployeeDirectoryPage.tsx`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\admin\AuditLogsPage.tsx`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\lib\api.ts`
- `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\components\` (Ensure ZERO loose files in root)

## Key Technical Objectives
1. Inspect existing implementations of `StaffAppraisalsPage.tsx`, `AppraisalCalibrationPage.tsx`, `EmployeeDirectoryPage.tsx`, and `AuditLogsPage.tsx` to identify missing features or mock data that must be wired to real API endpoints.
2. Plan the UI for Appraisal: KRA cards with rating inputs (1-5), competency cards, weighted score preview (70% KRA + 30% Competency), feedback textareas, calibration bell-curve or rating distribution view for admins.
3. Plan the UI for Employee Directory: search bar, department pills, card view / table view toggle, org chart hierarchy tree view, edit employee modal.
4. Plan the UI for Audit Logs: tabular view of Merkle-hashed audit entries, filter by category/severity, live cryptographic integrity indicator badge (Verified / Tampered).
5. Ensure exact design token adherence: Sapphire action button `#0D51B2`, Emerald status `#007B58`, 7px control radius, 12px card radius, Bricolage Grotesque and Instrument/DM Sans typography, `--nx-ease` motion.
6. Plan client API additions in `update/src/lib/api.ts` and domain types in `update/src/lib/appraisalTypes.ts` and `workforceTypes.ts`.

## Output Requirements
- Deliver `appraisal_admin_ui_plan.md` in your working directory.
- Deliver `handoff.md` following standard format (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send completion message to parent (`f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8`).

## 2026-11-10T06:30:10Z
Received dispatch message:
Explorer subagent for Milestone 5: Appraisal & Admin UI Portal.
Investigate UI pages: StaffAppraisalsPage, AppraisalCalibrationPage, EmployeeDirectoryPage, AuditLogsPage.
Detail required interactive elements, API endpoints in api.ts, domain types, design token adherence.
Deliver appraisal_admin_ui_plan.md and handoff.md.
