# Adversarial Challenge Report: Milestone 3 Frontend React & API Integration

**Agent**: `challenger_m3_2` (EMPIRICAL CHALLENGER — critic & specialist)  
**Target Milestone**: Milestone 3 (Staff Portal Core & Leave Management Suite)  
**Date**: 2026-11-10T02:13:00Z  
**Verdict**: **APPROVE**  

---

## Challenge Summary

**Overall risk assessment**: **LOW**  
All architectural constraints, zero-trust client invariants, design tokens, and API integration boundaries implemented by `worker_m3` have been empirically validated through code inspection, production bundling, and automated adversarial testing.

---

## Challenges & Stress Observations

### [Low] Challenge 1: Redundant Defense-in-Depth for Client-Side Self-Approval Handler
- **Assumption challenged**: Line managers are prevented from approving their own leave requests exclusively through UI button disabling (`disabled={Boolean(isSelf)}`).
- **Attack scenario**: A malicious line manager with DevTools could inspect the DOM and remove the `disabled` HTML attribute from the "Approve Leave" button, subsequently invoking `handleDecision('APPROVE')`.
- **Blast radius**: None in practice. The backend endpoint `PATCH /api/v1/leaves/requests/:id/action` enforces `SELF_APPROVAL_PROHIBITED` (HTTP 403), returning an unbypassable zero-trust error that `handleDecision` catches and displays in `decisionError`.
- **Mitigation**: Add a redundant procedural guard directly in `handleDecision`:
  ```ts
  if (isSelf) {
    setDecisionError('Self-approval is strictly prohibited by corporate governance.');
    return;
  }
  ```

### [Low] Challenge 2: Flaky Date Selection in Legacy M2 Adversarial Test
- **Assumption challenged**: Generating random days (`Math.floor(10 + Math.random() * 15)`) for leave start/end dates in test harnesses will always produce valid working days.
- **Attack scenario**: In `tests/adversarial/m2-auth-rbac-security-stress.test.ts` (test 3.7), dates fell on weekend days (e.g. Saturday 2026-11-14 or Sunday 2026-11-15). M3's working-day engine accurately rejected the application with HTTP 400 (`ZERO_WORKING_DAYS`), failing test 3.7's expectation of HTTP 201.
- **Blast radius**: Isolated to the legacy M2 stress file. The canonical test suite (`tests/e2e/tier2-boundaries/leave-boundaries.test.ts`) anchors dates to confirmed Monday–Wednesday slots (`2026-08-10` to `2026-08-12`) and passes 100%.
- **Mitigation**: Ensure future test harnesses explicitly anchor test dates to verified non-holiday business days.

### [Low] Challenge 3: Monolithic Production Bundle Size
- **Assumption challenged**: Emitting a single un-chunked bundle is acceptable for production delivery.
- **Attack scenario**: The production client bundle is 969.14 kB (241.80 kB gzip). Users on high-latency mobile networks in Nigeria could experience slower initial page load.
- **Blast radius**: Performance and perceived load time, not functional correctness.
- **Mitigation**: In Milestone 6 optimization, configure route-based code splitting using `React.lazy()` for `/portal/*`, `/admin/*`, and `/auth/*` paths.

---

## Stress Test Results

| Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **Clean Components Root** | Exactly 0 loose files in `update/src/components/` root | 0 files found (only `ui/`, `layout/`, `features/` subdirectories) | **PASS** |
| **HttpOnly Cookie Transmission** | `api.ts` enforces `credentials: 'include'` on all requests | Line 38 of `update/src/lib/api.ts` enforces `credentials: 'include'` | **PASS** |
| **Rogue Fetch Detection** | Zero direct `fetch()` calls outside `update/src/lib/api.ts` | 0 rogue fetches in entire `update/src` codebase | **PASS** |
| **10-Digit NUBAN Validation** | Strictly 10 numeric digits accepted; non-digits stripped; <10 or >10 rejected | `/^\d{10}$/` strictly enforced; `replace(/\D/g, '').slice(0, 10)` active | **PASS** |
| **11-Digit BVN/NIN Validation** | Strictly 11 numeric digits accepted; non-digits and improper lengths rejected | `/^\d{11}$/` strictly enforced on both BVN and NIN fields | **PASS** |
| **Restricted Fields Exclusion** | `salary`, `title`, `role`, `staffId` excluded from PUT payload & types | Strictly excluded from `handleSave` payload and `api.profile.update` TypeScript signature | **PASS** |
| **Leave Inverted Dates Guard** | `endDate < startDate` blocks calculation and submission | Shows banner "End date cannot be earlier than start date" and blocks submission | **PASS** |
| **Leave Zero-Overdraft Guard** | `workingDays > availableDays` blocks submission | Shows overdraft warning banner and returns error "Insufficient balance" | **PASS** |
| **Casual Leave 2-Day Policy** | `workingDays > 2` for casual leave blocks submission | Shows policy warning banner and returns error "Casual leave cannot exceed 2 days" | **PASS** |
| **Sick Leave Medical Note Policy** | `workingDays > 2` requires medical certificate attachment | Renders attachment URL input and enforces mandatory document reference | **PASS** |
| **Self-Approval Prohibition** | Line manager cannot approve own leave request | Visual banner displayed, Approve & Reject buttons disabled, backend returns 403 | **PASS** |
| **Design System & Token Adherence** | All M3 pages use Nexus tokens (`border-rule`, `font-display`, `bg-subtle`, UI atoms) | All 4 M3 pages utilize UI components, layouts, and tokens | **PASS** |
| **Statutory 2026 Nigerian Holidays**| Calendar includes 12 gazetted Nigerian statutory public holidays | Full calendar defined in `SEED_NIGERIAN_HOLIDAYS_2026` and integrated in Dashboard & Leaves | **PASS** |
| **Elimination of Mock Logic** | Zero `setTimeout` saves or simulated `LV-2026-` IDs | Verified 0 mock saves, live API dispatch across all pages | **PASS** |
| **Vite Bundle Emission** | `npm --prefix update run build` builds clean production bundle | Exited with code 0 in 6.01s; emitted `dist/assets/index-DHe4Iegm.js` and CSS | **PASS** |
| **Adversarial Test Suite** | `tests/adversarial/m3-frontend-integrity.test.ts` passes 100% | 12/12 tests passed (0 failures) | **PASS** |
| **Baseline Test Suite** | `node tests/testRunner.ts` passes 100% | 122/122 tests passed (0 failures across all 4 tiers) | **PASS** |

---

## Unchallenged Areas

- **Hardware Multi-Factor Authentication (WebAuthn)**: Out of scope for Milestone 3 (auth core verified in M2).
- **Direct Receipt File Upload to Cloud Storage**: Belongs to Milestone 4 (Expense Reimbursement & Receipt Management Suite).

---

## Explicit Verdict

**APPROVE**  
Milestone 3 frontend architecture and API integration meet all technical, security, and design criteria.
