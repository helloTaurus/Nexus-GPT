# Handoff Report: Staff Portal & Leave Management Suite Frontend Architecture

**Author**: `explorer_m3_3` (Frontend Portal & Design System Explorer)  
**Recipient**: `orchestrator_1` / `worker_m3`  
**Milestone**: Milestone 3 (Staff Portal Core & Leave Management Suite)  
**Date**: November 10, 2026  

---

## 1. Observation

Direct code and environment observations:

1. **Disconnected Frontend Pages**:
   - `update/src/pages/portal/StaffLeavePage.tsx` (lines 23–54): Employs hardcoded initial state `requests` array and simulates submissions with `setTimeout` (lines 58–76). Generates client-side synthetic IDs (`LV-2026-00${requests.length + 42}`) instead of hitting `/api/v1/leaves/requests`.
   - `update/src/pages/admin/LeaveApprovalPage.tsx` (lines 28–65): Uses static `items` array. Lines 67–68 declare `const [reviewModalItem, setReviewModalItem] = useState<PendingLeaveItem | null>(null);` and `const [comment, setComment] = useState('');`, but no `<Modal>` is rendered anywhere in the component JSX.
   - `update/src/pages/portal/StaffDashboardPage.tsx` (lines 92–116 & lines 168–214): Hardcodes Annual Leave balance as `18 / 24 Days Available` with static recent leave submissions, completely uncoupled from live user quotas.

2. **Absence of Client API Client**:
   - In `update/src/`, no directory `update/src/lib/` or file `api.ts` exists.
   - Search across `update/src` for `fetch(` returned zero matches. All portal pages currently rely on local component state.

3. **Backend API Contracts & Endpoints**:
   - `update/server/routes/leaves.routes.ts` (lines 14–23): Exposes:
     - `GET /api/v1/leaves/balances` (protected by `requireAuth`)
     - `POST /api/v1/leaves/calculate` and `GET /api/v1/leaves/calculate` (public working day engine)
     - `GET /api/v1/leaves/requests` (supports `scope=mine`, `scope=team`, `scope=all`)
     - `POST /api/v1/leaves/requests` (validates leave submission and reserves balance)
     - `PATCH /api/v1/leaves/requests/:id/action` & `POST /api/v1/leaves/requests/:id/review` (review approval/rejection)
     - `POST /api/v1/leaves/requests/:id/cancel` (cancellation and balance release)
   - `update/server/middleware/cors.ts` (lines 13–18): Enforces `Access-Control-Allow-Credentials: true` and `Access-Control-Allow-Origin` matching `localhost`/`127.0.0.1`.
   - `update/server/controllers/authController.ts` (line 88): Sets HttpOnly `nexus_session` cookie on login.

4. **Entitlement Quotas & Holiday Engine**:
   - `tests/fixtures/seedData.ts` (lines 93–100): Confirms 6 official leave types with policy limits:
     - Annual: 20.0 days quota (`lt-annual`)
     - Sick: 12.0 days quota (`lt-sick`), doctor's note required if > 2 consecutive days
     - Casual: 5.0 days quota (`lt-casual`), max 2 consecutive days limit
     - Maternity: 84.0 days quota (`lt-maternity`)
     - Paternity: 10.0 days quota (`lt-paternity`)
     - Bereavement: 5.0 days quota (`lt-bereavement`)
   - `update/server/repositories/leaveRepository.ts` (lines 38–71): `calculateNetWorkingDays` excludes Saturdays, Sundays, and 12 gazetted Nigerian statutory public holidays in 2026 (Workers' Day, Democracy Day, Eid al-Fitr, Eid al-Kabir, Independence Day, Christmas, Boxing Day, etc.).

5. **Design System & Component Invariants**:
   - `update/src/nexus-tokens.css`: Canvas (`#0D1624`/`#F7F8FA`), Surface (`#121E2E`/`#FFFFFF`), Sapphire Action (`#0D51B2`, hover `#093F8D`), Emerald Status (`#007B58`/`#69D3B0`), Warning (`#865600`/`#F3CE87`), Danger (`#B52F38`/`#FFACA9`), control radius `7px`, card radius `12px`, ease curve `cubic-bezier(0.22, 1, 0.36, 1)`.
   - `update/src/components/`: Confirms zero loose files in root. Reusable elements strictly reside in `components/ui/`, `components/layout/`, and `components/features/`.

---

## 2. Logic Chain

1. **From Observation 2 & 3 to API Client Requirement**:  
   Because the backend mandates HttpOnly session cookies (`nexus_session`) and verified origins with `Access-Control-Allow-Credentials: true`, every frontend request must include `credentials: 'include'`. Because no HTTP client exists in `update/src/`, creating a centralized, strongly typed client `update/src/lib/api.ts` with error normalization is the foundational prerequisite before wiring up any UI components.

2. **From Observation 1 & 4 to Dynamic Balance Cards**:  
   Because `StaffLeavePage.tsx` currently displays 4 hardcoded cards with invalid quotas (18/24 days), it fails the 6-leave-type policy invariant (Annual 20d, Sick 12d, Casual 5d, Maternity 84d, Paternity 10d, Bereavement 5d). Connecting `StaffLeavePage` to `api.leaves.getBalances()` on mount will dynamically populate all 6 cards with live available, pending, and used numbers, entitlement progress bars, and token-compliant color themes.

3. **From Observation 1 & 4 to Date Engine & Form Feedback**:  
   Because the backend provides a working day calculator that filters weekends and Nigerian holidays, wiring `startDate`, `endDate`, and `isHalfDay` changes in the Drawer to `api.leaves.calculateDays` provides immediate real-time feedback: working days count, holiday notice banners, zero-overdraft warnings, casual leave limit notices (> 2d), and medical certificate attachment requirements for sick leave (> 2d).

4. **From Observation 1 & 3 to History Table & Cancellation**:  
   Because backend `/api/v1/leaves/requests/:id/cancel` releases reserved `pendingDays` back into `availableDays`, adding filter tabs (`All`, `Pending`, `Approved`, `Rejected`), status badges (`Badge`), and a cancellation confirmation modal (`Modal`) enables full-fidelity self-service lifecycle management.

5. **From Observation 1 & 3 to Manager/Admin Approval Modal**:  
   Because `LeaveApprovalPage.tsx` already has `reviewModalItem` and `comment` state declared, rendering a `<Modal>` with employee balance impact preview, manager comments textarea, self-approval prevention guard, and approve/reject triggers connected to `PATCH /api/v1/leaves/requests/:id/action` completes Feature F13 without architectural friction.

---

## 3. Caveats

1. **Expense and Appraisal Submissions**: While `StaffDashboardPage.tsx` displays expense and appraisal metric cards, those domain endpoints belong to Milestones 4 and 5; only leave-related metrics are wired to live data in M3.
2. **File Upload for Sick Leave Attachments**: The leave submission schema accepts an optional `attachmentUrl: string`. Full multipart binary upload is defined in M4 (Feature F08). For M3, a valid URL/string input is used.
3. **No Direct Code Modifications**: As an explorer in read-only mode, no production source code has been altered. The complete implementation guide and code blueprints are delivered in `portal_ui_plan.md`.

---

## 4. Conclusion

The Staff Portal and Leave Management frontend is structurally well-scaffolded but currently decoupled from the live backend engine. Implementation requires:
1. Creating `update/src/lib/api.ts` and `update/src/lib/leaveTypes.ts` with `credentials: 'include'`.
2. Upgrading `StaffLeavePage.tsx` with 6 dynamic leave balance cards, dynamic date calculation drawer with Nigerian holiday alerts, and filtered request history with cancellation modal.
3. Upgrading `LeaveApprovalPage.tsx` with scope selection (`scope=team` / `scope=all`), review modal with balance impact feedback, self-approval guard, and manager decision triggers.
4. Upgrading `StaffDashboardPage.tsx` with live annual leave metrics, upcoming statutory public holidays widget, and recent leave stream.

All design tokens, typography rules, layout hierarchies, and motion parameters have been verified and codified in `portal_ui_plan.md`.

---

## 5. Verification Method

To independently verify the implementation once `worker_m3` applies the blueprint:

1. **Type Check & Build**:
   ```bash
   cd update && npm run build
   ```
   *Expected result*: Zero TypeScript errors; Vite bundle emitted successfully.

2. **Automated E2E Suite Execution**:
   ```bash
   npx tsx tests/testRunner.ts
   ```
   *Expected result*: 100% pass across all Tier 1, 2, 3, and 4 test suites, specifically:
   - `tests/e2e/tier1-features/leave-balances.test.ts`
   - `tests/e2e/tier1-features/leave-application.test.ts`
   - `tests/e2e/tier2-boundaries/leave-boundaries.test.ts`
   - `tests/e2e/tier3-combinations/leave-workflow-combinations.test.ts`

3. **Browser Layout & Flow Inspection**:
   - Navigate to `/#/portal/leave`: verify 6 leave balance cards, file a leave request over May 01, 2026 (Workers' Day) to verify 1 holiday excluded, cancel a submitted request to verify pending days released.
   - Navigate to `/#/admin/leave-approvals`: verify team queue, open review modal, input manager comment, approve/reject request, verify balance impact.
   - Navigate to `/#/portal/dashboard`: verify dynamic Annual Leave card and upcoming Nigerian holiday banner.
4. **Invalidation Conditions**:
   - Any loose file created in `update/src/components/` root.
   - Any fetch call omitting `credentials: 'include'`.
   - Modifying visual tokens away from `#0D51B2`, `#007B58`, `#0D1624`/`#F7F8FA`, 7px/12px radius.
