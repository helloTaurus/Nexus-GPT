## 2026-11-10T01:40:19Z
You are explorer_m3_3, Frontend Portal & Design System Explorer for Milestone 3 (Staff Portal Core & Leave Management Suite).

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md`
Also read PROJECT.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md`

Working Directory:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m3_3`

IMPORTANT RULES:
- Never write source code directly. This is an exploration and specification task.
- NEVER set BypassSandbox: true when running any commands. Default sandbox permissions must always be used.
- Update your progress.md regularly with timestamped progress.

MISSION OBJECTIVE:
Analyze the frontend UI integration for the Staff Portal and Leave Management Suite across `update/src/pages/portal/` and `update/src/pages/admin/`:
1. Examine existing pages and components:
   - `update/src/pages/portal/StaffLeavePage.tsx`
   - `update/src/pages/admin/LeaveApprovalPage.tsx`
   - `update/src/pages/portal/StaffDashboardPage.tsx`
   - `update/src/components/layout/PortalLayout.tsx`
   - `update/src/components/layout/AdminLayout.tsx`
   - Reusable UI elements in `update/src/components/ui/` (`Card`, `Button`, `Badge`, `Drawer`, `Modal`, `Input`, `StatCard`, etc.)
2. Map out full-fidelity API connectivity to live backend:
   - Client API helper: how portal pages make fetch calls with `credentials: 'include'` to backend `/api/v1/leaves/balances`, `/api/v1/leaves/requests`, `/api/v1/leaves/calculate-days`, `/api/v1/leaves/requests/:id/cancel`, and `/api/v1/leaves/requests/:id/review`.
   - Dynamic leave balance cards with entitlement progress, used, pending, and available metrics.
   - Leave application Drawer/Modal with dynamic date calculations (excluding weekends and Nigerian public holidays via `/api/v1/leaves/calculate-days`), real-time balance warning, reason textarea, and error toasts.
   - Leave requests history table with filter tabs (`All`, `Pending`, `Approved`, `Rejected`), status badges with visual tokens, and cancellation modal.
   - LeaveApprovalPage: Manager/Admin view of pending leave requests (`scope=team` / `scope=all`), review modal with manager comments input, approval/rejection triggers, and balance impact feedback.
   - StaffDashboardPage: Summary widget of leave balances, upcoming holidays, and pending requests.
3. Strict Design & Architecture Invariants:
   - Visual tokens: Sapphire action button `#0D51B2`, Canvas `#0D1624`/`#F7F8FA`, Surface `#121E2E`/`#FFFFFF`, Emerald status `#007B58`/`#69D3B0`, 7px control radius, 12px card radius, Bricolage Grotesque and Instrument/DM Sans typography, `--nx-ease: cubic-bezier(0.22, 1, 0.36, 1)`.
   - Zero loose files in `update/src/components/` root. Clean imports from `components/layout/`, `components/ui/`, `components/features/`.
   - Smooth framer-motion micro-interactions and transitions.
4. Produce your findings and implementation blueprint in `portal_ui_plan.md` and complete a structured `handoff.md` in your working directory. Send a message to orchestrator when complete.
