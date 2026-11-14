# Milestone 2 Challenge Report: Authentication, Session Lifecycle & RBAC Security

**Challenger:** `challenger_m2_1` (Auth, Session & Security Challenger)  
**Date:** November 10, 2026  
**Target:** `update/server/` Express Backend  
**Verdict:** **APPROVE** (Robust Core Architecture with 3 Targeted Security Advisories)

---

## 1. Challenge Summary

**Overall Risk Assessment:** **MEDIUM** (Zero critical remote code execution, injection, or direct privilege escalation vulnerabilities; three security hardening findings identified in rate limiting, timing side-channel, and strict schema key validation).

The backend authentication, session lifecycle, and role-based access control (RBAC) foundation implemented in `update/server/` was empirically subjected to an exhaustive 33-vector adversarial stress test harness (`tests/adversarial/m2-auth-rbac-security-stress.test.ts`).

### Key Empirical Findings:
1. **Cookie & Session Invariants (PASSED - HIGH ROBUSTNESS)**:
   - Malformed, empty, garbage, and directory traversal tokens (`nexus_session=../../../../etc/passwd`) are strictly rejected with HTTP 401 `UNAUTHORIZED`.
   - 1-character tampered sessions are rejected with HTTP 401.
   - Revoked sessions are immediately expunged from `SessionRepository` and cannot be replayed after `/logout`.
   - Rolling inactivity timeout (30 minutes) and absolute session ceiling (8 hours) are rigorously enforced with automatic session purging.
   - Deactivated accounts with valid active session cookies are intercepted by `requireAuth` and rejected with HTTP 403 `ACCOUNT_INACTIVE`.
2. **Privilege Escalation & RBAC Boundaries (PASSED - HIGH ROBUSTNESS)**:
   - Strict vertical authorization prevents non-admins (`EMPLOYEE`, `MANAGER`, `FINANCE`) from accessing administrative audit logs (`/api/v1/admin/audit-logs`) and administrative settings (`/api/v1/admin/settings`) (HTTP 403 `FORBIDDEN`).
   - Unauthorized employee onboarding via `POST /api/v1/employees` is blocked for non-admins (HTTP 403 `FORBIDDEN`).
   - Attempts by unprivileged staff to mutate restricted fields (`salary`, `role`, `title`, `designation`, `staffId`) via `PUT /api/v1/portal/profile` are intercepted by both validation middleware and controller logic with HTTP 403 `FORBIDDEN`.
   - Hierarchical line-management guards prevent managers from reviewing leave for unassigned staff (HTTP 403 `FORBIDDEN`).
   - Self-approval prohibition is strictly enforced: managers cannot approve their own leave requests (HTTP 403 `SELF_APPROVAL_PROHIBITED`) nor their own expense reports (HTTP 403 `SELF_APPROVAL_PROHIBITED`).
3. **Password Cryptography & Salt Separation (PASSED - HIGH ROBUSTNESS)**:
   - `PasswordService` utilizes Scrypt deterministic key derivation (`N=16384, r=8, p=1`, 64-byte key) with unique 16-byte random hex salts.
   - Comparison uses `crypto.timingSafeEqual` preventing side-channel buffer comparison timing leaks.
4. **Zero-Trust Schemas & Prototype Pollution (PASSED - HIGH ROBUSTNESS)**:
   - Prototype pollution payloads (`{"__proto__": {"polluted": true}}`) are stripped cleanly without polluting `Object.prototype`.
   - SQL injection strings (`' OR 1=1--`, `UNION SELECT`) are neutralized by zero-trust schemas and transactional atomic JSON persistence.
   - Nigerian NUBAN 10-digit validation and password recovery length gates (minimum 8 characters) are strictly enforced (HTTP 422).

---

## 2. Adversarial Challenges & Findings

### [Medium] Challenge 1: Rate Limiter Blindly Trusts Untrusted `X-Forwarded-For` Header (CWE-290 / CWE-307)

- **Assumption Challenged:** The sliding-window rate limiter in `update/server/middleware/rateLimiter.ts` adequately protects `/api/v1/auth/login` from brute-force password guessing and credential stuffing.
- **Attack Scenario:**
  Line 37 of `update/server/middleware/rateLimiter.ts` extracts the client IP address as follows:
  ```typescript
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || '127.0.0.1';
  ```
  Because Express is not configured with a validated reverse-proxy configuration (`app.set('trust proxy', ...)`) and the middleware does not verify whether the incoming socket belongs to a trusted gateway, an adversary can spoof the `X-Forwarded-For` header with an arbitrary IP on each request (e.g. `X-Forwarded-For: 198.51.100.1`, `X-Forwarded-For: 198.51.100.2`, etc.).
- **Empirical Demonstration:**
  In `m2-auth-rbac-security-stress.test.ts` (Test 2.3), when sending 5 consecutive login attempts with rotated `X-Forwarded-For` headers, 100% of requests bypassed the 2-request limit and returned HTTP 200/next, whereas requests with a fixed IP were properly capped at HTTP 429.
- **Blast Radius:**
  High-volume distributed credential stuffing and OTP brute-force attacks against `/api/v1/auth/login` and `/api/v1/auth/recover/request` are possible without triggering the sliding-window block.
- **Mitigation:**
  1. Configure `app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])` in `update/server/app.ts`.
  2. Rely on `req.ip` populated by Express rather than raw `req.headers['x-forwarded-for']`.
  3. Implement account-level lockouts (e.g., locking a user account after 5 consecutive failed attempts regardless of originating IP).

---

### [Medium] Challenge 2: User Enumeration via Scrypt Timing Disparity (CWE-208)

- **Assumption Challenged:** Authentication failure responses do not leak whether an email address is registered on the system.
- **Attack Scenario:**
  In `update/server/controllers/authController.ts` lines 27-35:
  ```typescript
  const user = userRepo.findByEmail(String(email).toLowerCase());
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', correlationId }
    });
    return;
  }
  let isValid = PasswordService.verifyPassword(password, user.passwordHash);
  ```
  When the target user email does not exist, the controller exits immediately within ~1.0 ms. However, when the user email does exist, the controller executes `PasswordService.verifyPassword` which computes `crypto.scryptSync` taking ~50 to 80 ms of CPU time.
- **Empirical Demonstration:**
  In `m2-auth-rbac-security-stress.test.ts` (Test 4.3), automated timing benchmarks over multiple iterations yielded:
  - Average latency for registered user (wrong password): **72.44 ms**
  - Average latency for unregistered user: **1.05 ms**
  - Disparity ratio: **69.24x**
  An attacker measuring HTTP response round-trip latency can determine if an employee email is registered with >99% statistical confidence.
- **Blast Radius:**
  Automated workforce email enumeration and targeted phishing reconnaissance.
- **Mitigation:**
  When `findByEmail` returns null, execute a dummy password verification against a pre-computed dummy Scrypt hash (e.g. `PasswordService.verifyPassword(password, DUMMY_SCRYPT_HASH)`) before returning HTTP 401. This guarantees uniform latency (~70 ms) across all authentication outcomes.

---

### [Low] Challenge 3: Inherited Prototype Properties Bypass Strict Key Check in `ZodObject.strict()` (CWE-1385)

- **Assumption Challenged:** `ZodObject.strict()` rejects all unmodeled property keys passed in JSON request payloads.
- **Attack Scenario:**
  In `update/server/schemas/zod.ts` lines 306-312:
  ```typescript
  if (this.isStrict) {
    for (const k of Object.keys(val)) {
      if (!(k in this.shape)) {
        issues.push({ path: [...path, k], message: `Unrecognized key '${k}' in payload` });
      }
    }
  }
  ```
  The expression `!(k in this.shape)` checks the prototype chain of `this.shape`. Because `this.shape` is a plain JavaScript object, keys that exist on `Object.prototype` (such as `constructor`, `toString`, `valueOf`) evaluate to `true` for `k in this.shape`.
- **Empirical Demonstration:**
  In `m2-auth-rbac-security-stress.test.ts` (Test 5.3), passing `{ constructor: { prototype: { adminPolluted: true } } }` to `updateProfileSchema` was not flagged as an unrecognized key and `safeParse` returned `success: true`.
  *Note:* Because `ZodObject` constructs `result.data` using `Object.entries(this.shape)`, the unmodeled `constructor` property was dropped and never reached downstream handlers, successfully preventing prototype pollution. However, the schema validation did not return `success: false`.
- **Blast Radius:**
  Low; no state corruption or prototype pollution occurs, but strict validation fails to reject payloads with prototype property names.
- **Mitigation:**
  Replace `!(k in this.shape)` with `!Object.prototype.hasOwnProperty.call(this.shape, k)` or use `Object.create(null)` for schema definitions.

---

### [Low] Challenge 4: Unused Governance Middleware `preventSelfApproval` (CWE-1078)

- **Assumption Challenged:** Route definitions consistently enforce self-approval rules via reusable middleware.
- **Attack Scenario:**
  In `update/server/middleware/rbac.ts`, `preventSelfApproval` is exported, but grep analysis across `update/server/` reveals 0 usages in route files. Instead, self-approval prohibition was implemented imperatively inside `leaveController.ts` and `expenseController.ts`. In `appraisalController.ts`, `submitManagerReviewHandler` checks `sub.managerId !== user.profile.id && user.role !== 'ADMIN'`, which means an Admin evaluating direct reports is exempt from the line-manager check.
- **Blast Radius:**
  Inconsistency in policy enforcement across future endpoints if developers assume `preventSelfApproval` is mounted globally.
- **Mitigation:**
  Mount `preventSelfApproval` consistently in route pipeline definitions or consolidate authorization assertions in domain services.

---

## 3. Stress Test Results Summary

| Vector | Description | Target Endpoint / Module | Expected Behavior | Observed Behavior | Verdict |
|---|---|---|---|---|---|
| **1.1** | Missing session cookie | `GET /api/v1/auth/me` | 401 UNAUTHORIZED | 401 UNAUTHORIZED | **PASS** |
| **1.2** | Garbage token string | `GET /api/v1/auth/me` | 401 UNAUTHORIZED | 401 UNAUTHORIZED | **PASS** |
| **1.3** | Empty cookie value | `GET /api/v1/auth/me` | 401 UNAUTHORIZED | 401 UNAUTHORIZED | **PASS** |
| **1.4** | Directory traversal cookie | `GET /api/v1/auth/me` | 401 UNAUTHORIZED | 401 UNAUTHORIZED | **PASS** |
| **1.5** | 1-bit tampered token | `GET /api/v1/auth/me` | 401 UNAUTHORIZED | 401 UNAUTHORIZED | **PASS** |
| **1.6** | Replay of logged-out token | `GET /api/v1/auth/me` | 401 UNAUTHORIZED | 401 UNAUTHORIZED | **PASS** |
| **1.7** | Rolling inactivity timeout (>30m) | `GET /api/v1/auth/me` | 401 Session expired | 401 Session expired | **PASS** |
| **1.8** | Absolute session expiry (>8h) | `GET /api/v1/auth/me` | 401 Session expired | 401 Session expired | **PASS** |
| **1.9** | Inactive user session attempt | `POST /api/v1/auth/login` | 403 ACCOUNT_INACTIVE | 403 ACCOUNT_INACTIVE | **PASS** |
| **1.10** | Bearer token authorization | `GET /api/v1/auth/me` | 200 valid / 401 invalid | 200 valid / 401 invalid | **PASS** |
| **2.1** | Rate limit enforcement | `POST /api/v1/auth/login` | 429 TOO_MANY_REQUESTS | 429 TOO_MANY_REQUESTS | **PASS** |
| **2.2** | Rate limit headers | `createRateLimiter` | Headers populated | Headers populated | **PASS** |
| **2.3** | X-Forwarded-For IP spoofing | `createRateLimiter` | Enforce or detect spoofing | Bypassed via rotated header | **FAIL (Finding 1)** |
| **2.4** | Uniform auth error envelopes | `POST /api/v1/auth/login` | Identical 401 envelopes | Identical 401 envelopes | **PASS** |
| **3.1** | Employee accessing audit logs | `GET /api/v1/admin/audit-logs` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **3.2** | Manager accessing audit logs | `GET /api/v1/admin/audit-logs` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **3.3** | Employee accessing admin settings | `GET /api/v1/admin/settings` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **3.4** | Employee creating employee | `POST /api/v1/employees` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **3.5** | Manager creating employee | `POST /api/v1/employees` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **3.6** | Staff mutating restricted fields | `PUT /api/v1/portal/profile` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **3.7** | Manager leave self-approval | `PATCH /api/v1/leaves/requests/:id/action` | 403 SELF_APPROVAL_PROHIBITED | 403 SELF_APPROVAL_PROHIBITED | **PASS** |
| **3.8** | Manager expense self-approval | `PATCH /api/v1/expenses/reports/:id/action` | 403 SELF_APPROVAL_PROHIBITED | 403 SELF_APPROVAL_PROHIBITED | **PASS** |
| **3.9** | Cross-department manager approval | `PATCH /api/v1/leaves/requests/:id/action` | 403 FORBIDDEN | 403 FORBIDDEN | **PASS** |
| **4.1** | Scrypt salt uniqueness | `PasswordService.hashPassword` | Unique salts & hash format | Unique salts & hash format | **PASS** |
| **4.2** | Corrupted hash handling | `PasswordService.verifyPassword` | Returns false, no exception | Returns false, no exception | **PASS** |
| **4.3** | Constant-time login verification | `POST /api/v1/auth/login` | Latency parity (<1.5x) | 69.2x timing disparity | **FAIL (Finding 2)** |
| **5.1** | SQLi payloads in login fields | `POST /api/v1/auth/login` | 400 or 401 (no 500) | 400 or 401 (no 500) | **PASS** |
| **5.2** | Prototype pollution `__proto__` | `updateProfileSchema` | Stripped, Object clean | Stripped, Object clean | **PASS** |
| **5.3** | Prototype pollution `constructor` | `ZodObject.strict()` | 400 unrecognized key | Accepted (no pollution) | **FAIL (Finding 3)** |
| **5.4** | NUBAN format fuzzing | `PUT /api/v1/portal/profile` | 422 INVALID_NUBAN | 422 INVALID_NUBAN | **PASS** |
| **5.5** | Password reset length fuzzing | `POST /api/v1/auth/recover/verify` | 422 WEAK_PASSWORD | 422 WEAK_PASSWORD | **PASS** |
| **5.6** | 30-level nested object fuzzing | `POST /api/v1/auth/login` | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | **PASS** |
| **5.7** | Array/int type confusion | `POST /api/v1/auth/login` | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | **PASS** |

---

## 4. Unchallenged Areas

- **Frontend Client UI Components (`src/pages/*`)**: Scheduled for Milestone 3 (Staff Portal) and Milestone 4 (Expense Suite) integration; out of scope for Milestone 2 backend verification.
- **Physical Multi-Core Distributed Storage Clustering**: The system implements single-host file-locked transactional JSON storage (`AtomicJsonStore.ts`) in accordance with `PROJECT.md` design; distributed consensus engines (Raft/Paxos) were out of scope.

---

## 5. Explicit Recommendation

The Milestone 2 backend implementation is **APPROVED**. The core authentication, session management, and RBAC authorization engines exhibit high resilience against injection, privilege escalation, session forgery, and unauthorized state mutation. The 3 security advisories documented above are non-blocking for Milestone 3 progression and are scheduled for formal patch resolution during Milestone 6 Adversarial Hardening.
