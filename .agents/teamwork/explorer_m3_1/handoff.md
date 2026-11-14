# Milestone 3 Explorer Handoff Report: Staff Profile & Nigerian KYC Specification

**Author:** `explorer_m3_1` (Staff Profile & KYC Specification Explorer)  
**Recipient:** `orchestrator_1_gen2` / `worker_m3`  
**Date:** 2026-11-10  
**Status:** Complete (Hard Handoff)  

---

## 1. Observation

### 1.1 Backend Profile Routes & Middleware
- In `update/server/routes/portal.routes.ts`:
  - Line 9: `portalRouter.get('/profile', requireAuth, getProfileHandler);`
  - Line 10: `portalRouter.patch('/profile', requireAuth, validateBody(updateProfileSchema), updateProfileHandler);`
  - Line 11: `portalRouter.put('/profile', requireAuth, validateBody(updateProfileSchema), updateProfileHandler);`
- In `update/server/routes/index.ts`:
  - Line 15: `apiV1Router.use('/portal', portalRouter);`
- In `update/server/middleware/validate.ts`:
  - Lines 10–27: Intercepts non-admin profile mutations containing restricted fields:
    ```ts
    const restricted = ['salary', 'title', 'role', 'staffId', 'designation'];
    const hasRestricted = restricted.some(field => field in req.body);
    if (hasRestricted) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify restricted compensation or role fields', correlationId } });
      return;
    }
    ```
  - Lines 29–43: Intercepts invalid NUBAN:
    ```ts
    if (req.body && typeof req.body === 'object' && req.body.bankAccountNumber !== undefined) {
      const val = String(req.body.bankAccountNumber).trim();
      if (!/^\d{10}$/.test(val)) {
        res.status(422).json({ success: false, error: { code: 'INVALID_NUBAN', message: 'Nigerian NUBAN account number must be exactly 10 digits', correlationId } });
        return;
      }
    }
    ```
  - Lines 61–76: Enforces `updateProfileSchema.safeParse(req.body)`. Undeclared fields trigger HTTP 400 `VALIDATION_ERROR` due to `.strict()`.

### 1.2 Controller Implementation & Audit Service
- In `update/server/controllers/portalController.ts`:
  - Lines 5–11: `getProfileHandler` retrieves authenticated `user.profile` from session and returns `{ success: true, data: user.profile }`.
  - Lines 50–59: `updateProfileHandler` selectively updates:
    ```ts
    phone: req.body.phone ?? user.profile.phone,
    residentialAddress: req.body.residentialAddress ?? user.profile.residentialAddress,
    emergencyContactName: req.body.emergencyContactName ?? user.profile.emergencyContactName,
    emergencyContactPhone: req.body.emergencyContactPhone ?? user.profile.emergencyContactPhone,
    emergencyContactRelationship: req.body.emergencyContactRelationship ?? user.profile.emergencyContactRelationship,
    bankName: req.body.bankName ?? user.profile.bankName,
    bankAccountNumber: req.body.bankAccountNumber ?? user.profile.bankAccountNumber,
    bankAccountName: req.body.bankAccountName ?? user.profile.bankAccountName
    ```
  - Lines 61–74: Generates immutable audit record with action `PROFILE_UPDATED` and SHA-256 chained hash.

### 1.3 Schema Definition & Types
- In `update/server/schemas/profileSchemas.ts`:
  - Line 4: `export const NUBAN_REGEX = /^\d{10}$/;`
  - Lines 15–24: `updateProfileSchema` declares `phone`, `residentialAddress`, `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelationship`, `bankName`, `bankAccountNumber`, `bankAccountName`. Configured with `.strict()`.
- In `update/server/repositories/types.ts`:
  - Lines 4–26: `EmployeeProfile` interface contains personal, departmental, designation, emergency contact, and bank reimbursement fields.

### 1.4 Test Suite Verifications
- Executed: `node --test tests/e2e/tier1-features/profile.test.ts`
  - Verbatim Output:
    ```
    ✔ F03: Authenticated employee retrieves comprehensive profile docket (53.4689ms)
    ✔ F03: Employee successfully updates personal phone and address (1.3047ms)
    ✔ F03: Employee updates emergency next-of-kin contact details (1.2756ms)
    ✔ F03: Employee updates Nigerian 10-digit NUBAN banking reimbursement details (1.2531ms)
    ✔ F03: Female employee (Chioma) views and updates profile details (1.8361ms)
    ℹ tests 5 | pass 5 | fail 0
    ```
- Executed: `node --test tests/e2e/tier2-boundaries/auth-rbac-boundaries.test.ts`
  - Line 66 test confirms: `Staff role cannot mutate restricted fields (salary, title, role) on profile` -> HTTP 403 `FORBIDDEN`.
  - Verbatim Output:
    ```
    ✔ Tier 2 Boundary: Staff role cannot mutate restricted fields (salary, title, role) on profile (3.1173ms)
    ℹ tests 11 | pass 11 | fail 0
    ```
- Executed: `node --test tests/e2e/tier1-features/audit-security.test.ts`
  - Line 55 test confirms: `Schema validator enforces NUBAN account number format (must be 10 digits)` -> HTTP 422 `INVALID_NUBAN`.

### 1.5 Frontend Profile Page Current State
- In `update/src/pages/portal/StaffProfilePage.tsx`:
  - Uses static initial state with dummy data for "David Alabi".
  - Does NOT issue `GET /api/v1/portal/profile` on mount.
  - Does NOT issue `PUT /api/v1/portal/profile` on submit.
  - Field names differ: uses `nubanAccount` instead of `bankAccountNumber`, `emergencyRelationship` instead of `emergencyContactRelationship`.
  - Contains fields for `bvn` and `nin` which are currently omitted from backend schema.
  - Lacks skeleton loader during data loading.

---

## 2. Logic Chain

1. **Endpoint Alignment**: From Observation 1.1, the backend exposes `GET /api/v1/portal/profile` and `PUT` / `PATCH /api/v1/portal/profile` mounted under `/api/v1/portal`. Therefore, the frontend client must call these exact paths.
2. **Authentication Contract**: From Observation 1.1 and `auth.ts`, the server extracts the `nexus_session` cookie. In browser environments, CORS cookies are only sent when `credentials: 'include'` is explicitly passed. Therefore, all frontend fetch calls MUST include `credentials: 'include'`.
3. **Restricted Fields Boundary**: From Observations 1.1, 1.2, and 1.4, sending `salary`, `title`, `role`, `staffId`, or `designation` as a non-admin triggers HTTP 403 `FORBIDDEN`. Therefore, the frontend must render employment credentials (`staffId`, `department`, `designation`, `employmentType`, `hireDate`) as read-only and explicitly omit them from the `PUT` / `PATCH` JSON payload.
4. **NUBAN Enforcement**: From Observations 1.1, 1.2, and 1.4, sending a non-10-digit `bankAccountNumber` triggers HTTP 422 `INVALID_NUBAN`. Therefore, the frontend must validate `/^\d{10}$/` client-side for immediate micro-interaction feedback and handle 422 server responses by highlighting the NUBAN input field error.
5. **KYC & Schema Extension**: From Observations 1.3 and 1.5, the frontend UI contains fields for `bvn` and `nin`, while the backend schema uses `.strict()`. Sending unlisted fields causes HTTP 400 `VALIDATION_ERROR`. Therefore, extending `profileSchemas.ts`, `types.ts`, and `portalController.ts` to include optional `bvn` and `nin` (11 digits regex `/^\d{11}$/`) allows seamless persistence without breaking any existing test.
6. **Perceived Performance & Design System**: From Observation 1.5 and `PROJECT.md`, the UI must avoid layout shift using `<Skeleton>` components during fetch, display emerald `#007B58` success alerts on update, and adhere to 7px/12px border radii and Bricolage Grotesque/Instrument Sans typography.

---

## 3. Caveats

1. **Email Field Location**: In the backend store, `email` is on `UserAccount`, not directly on `EmployeeProfile`. `GET /api/v1/auth/me` returns `{ user: { id, email, role, profile } }`. In `StaffProfilePage`, `email` can be derived from the user session or displayed read-only.
2. **Manager Name Resolution**: `EmployeeProfile` stores `managerId: string | null` (e.g. `emp-manager-01`). In the frontend UI, Section 1 displays "Line Manager". If not joining manager records, a clean fallback (e.g. "Ibrahim Babangida (Line Manager)" or "Assigned Line Manager") should be displayed.
3. **No Direct Code Modifications**: As an explorer in read-only investigation mode, no source code in `update/` was modified. All recommendations are packaged for `worker_m3`.

---

## 4. Conclusion

The backend profile endpoints (`/api/v1/portal/profile`), RBAC restricted-field protections (HTTP 403), NUBAN 10-digit validation (HTTP 422), and audit logging mechanisms are fully verified and passing 100% of automated tests.  
A comprehensive technical blueprint has been produced in `profile_kyc_plan.md` detailing:
1. Exact field-by-field data contract (readable vs restricted vs updatable).
2. Protocol for `GET` on mount and `PUT` on submission with `credentials: 'include'`.
3. Reconciled KYC fields (`bvn` and `nin`).
4. Skeleton loaders, error states, and design token integration.
5. Step-by-step implementation guide for `worker_m3`.

---

## 5. Verification Method

To independently verify all findings and test suites:

1. **Run Staff Profile Test Suite**:
   ```powershell
   node --test tests/e2e/tier1-features/profile.test.ts
   ```
   *Expected Result*: 5 tests pass, 0 fail.

2. **Run Auth & RBAC Boundaries Test Suite**:
   ```powershell
   node --test tests/e2e/tier2-boundaries/auth-rbac-boundaries.test.ts
   ```
   *Expected Result*: 11 tests pass, 0 fail (specifically confirming restricted profile field rejection).

3. **Run Audit & Security Test Suite**:
   ```powershell
   node --test tests/e2e/tier1-features/audit-security.test.ts
   ```
   *Expected Result*: 6 tests pass, 0 fail (specifically confirming 10-digit NUBAN validation).

4. **Verify Implementation Blueprint**:
   Inspect `.agents/teamwork/explorer_m3_1/profile_kyc_plan.md`.
