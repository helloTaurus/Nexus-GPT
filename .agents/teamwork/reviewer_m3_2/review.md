# Quality & Adversarial Review: Milestone 3 (Staff Portal Core & Leave Management Suite)

**Reviewer**: `reviewer_m3_2` (Frontend Portal Pages, Design System & UX Reviewer / Adversarial Critic)  
**Date**: 2026-11-10T02:10:00Z  
**Reviewed Artifacts**:
- `update/src/lib/api.ts`
- `update/src/lib/leaveTypes.ts`
- `update/src/pages/portal/StaffProfilePage.tsx`
- `update/src/pages/portal/StaffLeavePage.tsx`
- `update/src/pages/admin/LeaveApprovalPage.tsx`
- `update/src/pages/portal/StaffDashboardPage.tsx`
- Component directories: `update/src/components/{ui,layout,features}`
- Styling & Design Tokens: `update/src/nexus-tokens.css`, `update/src/nexus-system.css`, `update/src/index.css`

---

## 1. Review Summary

**Verdict**: **APPROVE**

Worker `worker_m3` has delivered an exemplary, fully functional, and architecturally compliant implementation of the Milestone 3 Staff Portal Core and Leave Management Suite.

### Key Highlights:
1. **Zero Loose Files in Components Root**: Verified that `update/src/components/` contains strictly 3 subdirectories (`ui/`, `layout/`, `features/`) and 0 loose files. All component imports across `src/pages/` strictly follow clean directory boundaries.
2. **HttpOnly Cookie Security**: `update/src/lib/api.ts` enforces `credentials: 'include'` on all client-server communications, guaranteeing seamless forwarding of the HttpOnly `nexus_session` cookie for authenticated session continuity.
3. **Rigorous Input Validation & Restricted Field Stripping**: Client-side forms strictly validate Nigerian 10-digit NUBAN account numbers, 11-digit BVN, and 11-digit NIN, and explicitly sanitize/strip restricted profile fields (`salary`, `title`, `role`, `staffId`, `department`, `designation`) before PUT dispatch, preventing 403 `FORBIDDEN` rejections.
4. **Real-Time Working Day Calculation & Policy Invariants**: Dynamic calculation endpoint `/api/v1/leaves/calculate` computes net working days excluding weekends and gazetted Nigerian public holidays (`SEED_NIGERIAN_HOLIDAYS_2026`). Real-time UI banners alert users to holiday exclusions, zero-overdraft balance limits, 2-day casual leave caps, and mandatory doctor's certificates for sick leave > 2 days.
5. **Self-Approval Prohibition Guard**: `LeaveApprovalPage.tsx` queries current user identity via `api.auth.me()`, compares against `reviewModalItem.employeeId`, displays a corporate governance warning banner, and disables approve/reject buttons when a manager attempts to self-approve.
6. **Design System & Visual Tokens**: 100% adherence to design tokens: Sapphire `#0D51B2`, Canvas `#0D1624`/`#F7F8FA`, Surface `#121E2E`/`#FFFFFF`, Emerald `#007B58`/`#69D3B0`, control radius `7px`, card radius `12px`, typography `Bricolage Grotesque` and `Instrument Sans` / `DM Sans`, and `--nx-ease` motion easing `cubic-bezier(0.22, 1, 0.36, 1)`. Loading skeletons and correlation ID error feedback are uniformly implemented.
7. **Verification & Integrity**: Production client build (`npm --prefix update run build`) completes cleanly with 0 errors in 4.66s. The full 122-test E2E verification suite passes 100% (122/122 passed). No hardcoded mock shortcuts, dummy facades, or integrity violations were detected.

---

## 2. Findings

### [Minor] Finding 1: Fallback Browser `alert()` in Leave Request Cancellation
- **What**: In `StaffLeavePage.tsx` line 284, if `api.leaves.cancelRequest` fails, the error is handled via native `alert(err.message || 'Failed to cancel leave request.')`.
- **Where**: `update/src/pages/portal/StaffLeavePage.tsx:284`
- **Why**: While fully functional and non-breaking, browser `alert()` modal dialogs slightly degrade UI elegance compared to the dismissible toast banner system used elsewhere across the page.
- **Suggestion**: In a future polish phase or Milestone 6 cleanup, replace `alert(...)` with `setToast({ type: 'error', message: err.message || 'Failed to cancel leave request.' })`.

---

## 3. Verified Claims

| # | Claim | Verification Method | Status |
|---|-------|---------------------|--------|
| 1 | Production client build passes with 0 errors | `npm --prefix update run build` executed directly in sandbox | **PASS** (Exit 0, 4.66s) |
| 2 | Component root contains zero loose files | Inspected directory tree with `list_dir` on `update/src/components` | **PASS** (3 dirs, 0 files) |
| 3 | Imports respect clean boundaries (`ui/`, `layout/`, `features/`, `lib/`) | Ripgrep audit of imports across `update/src/pages` | **PASS** (All match valid paths) |
| 4 | HttpOnly cookie transmission guaranteed | Inspected `update/src/lib/api.ts:38` (`credentials: 'include'`) | **PASS** |
| 5 | Client-side NUBAN validation & field stripping | Inspected `StaffProfilePage.tsx` lines 97-114, 157-187 | **PASS** (10-digit NUBAN, 11-digit BVN/NIN, stripped payload) |
| 6 | 6 statutory leave types represented | Inspected `StaffLeavePage.tsx:39-82` | **PASS** (Annual, Sick, Casual, Maternity, Paternity, Bereavement) |
| 7 | Dynamic working day engine with Nigerian holiday exclusion | Tested via in-process calculator and inspected `StaffLeavePage.tsx:159-197` | **PASS** (Calls `/leaves/calculate`, displays breakdown) |
| 8 | Self-approval prohibition UI guard | Inspected `LeaveApprovalPage.tsx:58-64, 148, 365-376, 482, 491` | **PASS** (Disables buttons & shows governance warning) |
| 9 | Visual design tokens and typography | Inspected `nexus-tokens.css`, `nexus-system.css`, `index.css`, `StaffLeavePage.tsx`, `StaffProfilePage.tsx` | **PASS** (All palette colors, radii, and fonts active) |
| 10| E2E test verification passes 100% | `node tests/testRunner.ts` executed directly in sandbox | **PASS** (122/122 passed, 0 failures) |

---

## 4. Adversarial Challenge & Attack Surface Analysis

### 4.1 Integrity & Cheating Inspection
- **Hardcoded test responses**: Checked `api.ts`, `StaffProfilePage.tsx`, `StaffLeavePage.tsx`, `LeaveApprovalPage.tsx`, `StaffDashboardPage.tsx`. No hardcoded dummy returns or bypassed logic were found. All network calls utilize the central fetch client.
- **Dummy or Facade Implementations**: Form submissions, balance refreshes, modal reviews, cancellation balance restorations, and dynamic calculations are genuine and mutate state across both client and server repositories.
- **Verification Fabrication**: Both `npm run build` and `node tests/testRunner.ts` were executed independently in real time and verified.

### 4.2 Stress Testing & Boundary Scenarios

| Scenario / Attack | Expected Behavior | Actual Behavior | Result |
|-------------------|-------------------|-----------------|--------|
| **Adversarial Input 1**: Inverted Date Selection (`endDate < startDate`) | Block calculation and prevent form submission | Form displays inline error: `"End date cannot be earlier than start date."` and disables calculation. | **PASS** |
| **Adversarial Input 2**: Zero Working Days Range (Selected dates are Saturday/Sunday) | Block application submission | Calculation detects 0 net days, displays warning banner, and blocks submission. | **PASS** |
| **Adversarial Input 3**: Insufficient Balance Overdraft Attempt | Block application submission | Real-time check compares `workingDays` against `activeBalance.availableDays` and displays zero-overdraft warning banner. | **PASS** |
| **Adversarial Input 4**: Casual Leave Policy Breach (> 2 days) | Surface policy violation notice and block submit | UI displays amber notice: `"Policy Notice: Casual leave cannot exceed 2 consecutive working days"` and aborts submission. | **PASS** |
| **Adversarial Input 5**: Sick Leave > 2 days without Medical Note | Require mandatory document URL before submission | UI displays doctor's certificate URL input and halts submission if empty. | **PASS** |
| **Adversarial Input 6**: Manager Self-Approval Attempt | Prevent approving or rejecting own leave | Button disabled (`disabled={Boolean(isSelf)}`), governance warning banner displayed, server rejects with 403. | **PASS** |
| **Adversarial Input 7**: Invalid NUBAN account entry (letters or != 10 digits) | Reject input and show inline error | `handleNubanChange` strips non-digits, slices to 10 chars, and validates `/^\d{10}$/`. | **PASS** |
| **Adversarial Input 8**: Restricted field injection in profile update | Exclude salary/role/title from payload | Payload constructor strictly whitelists 10 editable KYC fields, omitting all restricted properties. | **PASS** |
| **Adversarial Input 9**: Correlation ID exposure on API failure | Display correlation ID to user for support tracking | `ApiError` captures `correlationId` from server JSON envelope and renders it formatted with tabular numerals. | **PASS** |

---

## 5. Coverage Gaps & Unverified Items

- **Coverage Gaps**: None within the Milestone 3 scope. Milestones 4 and 5 components (Expenses & Appraisals) are currently placeheld on the Dashboard with static previews until their respective milestones are executed, which is expected and documented.
- **Unverified Items**: None. All assigned files, layouts, tokens, build outputs, and test suites were independently tested and verified.

---

## 6. Final Recommendation

The work produced by `worker_m3` meets all architectural standards, design specifications, and security requirements defined in `PROJECT.md` and `ORIGINAL_REQUEST.md`. Milestone 3 is approved for progression.
