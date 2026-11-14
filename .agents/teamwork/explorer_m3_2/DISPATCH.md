## 2026-11-10T01:40:11Z
You are explorer_m3_2, Leave Rules & Workflow Explorer for Milestone 3 (Staff Portal Core & Leave Management Suite).

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md`
Also read PROJECT.md at:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md`

Working Directory:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m3_2`

IMPORTANT RULES:
- Never write source code directly. This is an exploration and specification task.
- NEVER set BypassSandbox: true when running any commands. Default sandbox permissions must always be used.
- Update your progress.md regularly with timestamped progress.

MISSION OBJECTIVE:
Analyze the Leave Rules Engine, Nigerian Holiday Calendar, and Workflow Invariants (Features F04, F05, F06, F12, F13) to deliver a complete technical blueprint for worker_m3:
1. Examine backend leave endpoints, repositories, and logic:
   - `update/server/controllers/leaveController.ts`
   - `update/server/repositories/leaveRepository.ts`
   - `update/server/routes/leaves.routes.ts`
   - `update/server/data/leave_balances.json`
   - `update/server/data/leave_requests.json`
2. Examine tests verifying leave management:
   - `tests/e2e/tier1-features/leave-balances.test.ts`
   - `tests/e2e/tier1-features/leave-application.test.ts`
   - `tests/e2e/tier2-boundaries/leave-boundaries.test.ts`
   - `tests/e2e/tier3-combinations/leave-workflow-combinations.test.ts`
3. Verify every invariant:
   - 6 leave types: Annual (20d), Sick (12d), Casual (5d), Maternity (60d), Paternity (10d), Bereavement (5d).
   - Nigerian 2026 gazetted public holidays list & weekend exclusion (Saturdays/Sundays excluded from working day count).
   - Zero-overdraft balance protection (request exceeding available balance rejected with 409 INSUFFICIENT_LEAVE_BALANCE).
   - End date before start date rejected with 400 INVALID_DATE_RANGE.
   - Spanning only weekends/holidays rejected with 400 ZERO_WORKING_DAYS.
   - Double-booking guard (overlapping active requests rejected with 409 CONFLICT).
   - Real-time balance deduction: pendingDays increases immediately upon submission, reducing availableDays.
   - Request cancellation: employee can cancel SUBMITTED request, releasing reserved pendingDays back to availableDays.
   - Review workflow: manager/admin reviews request (`status: 'Approved'` or `'Rejected'`). On approval: pendingDays converts to usedDays. On rejection: pendingDays released.
   - Self-approval prohibition: manager cannot approve/reject their own leave request (403 SELF_APPROVAL_PROHIBITED).
   - Hierarchical scope: employee sees own requests; manager sees direct reports (`scope=team`); admin sees all (`scope=all`).
4. Identify any discrepancies or edge-case handling needed for backend or frontend integration.
5. Produce your findings and implementation blueprint in `leave_engine_plan.md` and complete a structured `handoff.md` in your working directory. Send a message to orchestrator when complete.
