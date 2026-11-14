## 2026-11-10T00:13:27Z
You are worker_m2 (Milestone 2 Backend & DevSecOps Implementation Worker).
Your working directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m2

MANDATORY FIRST STEP: Read the following specification files:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\TEST_INFRA.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_1\server_architecture_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_2\schemas_auth_rbac_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_3\store_audit_plan.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\fixtures\seedData.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\fixtures\referenceServer.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You own `update/server/**` exclusively, plus optionally adding a `"server"` start script in `update/package.json`.
You MUST NOT edit files in `tests/**` or `update/src/components/**`.

Your objective for Milestone 2:
Implement the complete, production-grade Express backend service in `update/server/` adhering to the 3 explorer architecture blueprints:
1. `update/server/app.ts` & `update/server/index.ts`:
   - Express server listening on `process.env.PORT || 3001`
   - Signal-trapped graceful shutdown (SIGINT, SIGTERM, uncaught exceptions)
   - Middleware order: Correlation ID generator (`corr_${uuid}`) -> Security Headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`) -> CORS allowlist with `credentials: true` -> Body parser & Cookie parser (`nexus_session`) -> Rate Limiter (bypassed in `NODE_ENV === 'test'`) -> Routes -> 404 handler -> Fail-Secure Error Sanitizer (RFC 7807 problem details, correlation ID, zero stack trace leak).
2. `update/server/middleware/`:
   - `securityHeaders.ts`: Enforce nosniff, DENY, HSTS.
   - `cors.ts`: Allow frontend origins with credentials.
   - `errorHandler.ts`: Fail-secure error handler emitting `{ success: false, error: { code, message, correlationId } }` with correlationId starting with `corr_`.
   - `validate.ts`: Zod validation middleware rejecting extra fields (`.strict()`), mapping 10-digit NUBAN errors to `422 INVALID_NUBAN`, weak passwords to `422 WEAK_PASSWORD`, and restricted fields (`salary`, `role`, `staffId`, `title`) to `403 FORBIDDEN`.
   - `auth.ts`: Extract `nexus_session` cookie or Bearer token, validate session expiry (30m rolling, 8h max), check active status (`403 ACCOUNT_INACTIVE`), inject `req.user`.
   - `rbac.ts`: Enforce role access (`EMPLOYEE`, `MANAGER`, `ADMIN`), IDOR protection, direct reports lookup, and self-approval prevention (`403 SELF_APPROVAL_PROHIBITED`).
3. `update/server/schemas/`:
   - Auth schemas (`loginSchema`, `passwordRecoveryRequestSchema`, `passwordRecoveryVerifySchema`).
   - Profile schemas (`updateProfileSchema` with 10-digit NUBAN regex `/^\d{10}$/`).
4. `update/server/repositories/` & `update/server/services/passwordService.ts`:
   - Atomic file-locked JSON repository store with FIFO write mutex, atomic temp-file rename, and fsync durability.
   - Seed data initialization conforming to `tests/fixtures/seedData.ts` (Admin, Manager, Dept Head, Employees, Finance, Inactive) with Scrypt deterministic hashing and `crypto.timingSafeEqual`.
5. `update/server/services/auditService.ts`:
   - Immutable security audit logging with append-only JSONL, SHA-256 hash chaining, recording `actorId`, `action`, `entityType`, `entityId`, `ipAddress`, `userAgent`, `metadataDiff`, and ISO timestamp.
6. `update/server/controllers/` & `update/server/routes/`:
   - `GET /api/v1/health`: public health status.
   - `POST /api/v1/auth/login`: verifies credentials, sets HttpOnly `nexus_session` cookie, logs `AUTH_LOGIN_SUCCESS`, returns user docket.
   - `POST /api/v1/auth/logout`: revokes session, clears `nexus_session` cookie (`Max-Age=0`), logs `AUTH_LOGOUT`.
   - `GET /api/v1/auth/me`: returns authenticated user profile.
   - `POST /api/v1/auth/recover/request`: OTP request (supports test token `123456`).
   - `POST /api/v1/auth/recover/verify`: verifies OTP, updates password with length check.
   - `GET /api/v1/portal/profile`: returns employee profile docket.
   - `PATCH /api/v1/portal/profile`: updates allowed fields with NUBAN check and audit log.
   - `GET /api/v1/employees/:id/reports`: returns direct reports for managers.
   - `GET /api/v1/admin/audit-logs`: admin-only audit log query with action/entityType filtering.

Verification Requirements:
1. Verify the server boots cleanly: `npx tsx update/server/index.ts` (or background test startup).
2. Run live E2E tests:
   `powershell -Command "$env:API_BASE_URL='http://127.0.0.1:3001'; node tests/testRunner.ts"`
3. Run the specific auth and security suites:
   `node --test tests/e2e/tier1-features/auth-rbac.test.ts`
   `node --test tests/e2e/tier1-features/audit-security.test.ts`
   `node --test tests/e2e/tier1-features/profile.test.ts`
   `node --test tests/e2e/tier2-boundaries/auth-rbac-boundaries.test.ts`
4. Verify the client still builds cleanly: `npm --prefix update run build`.

Document all files created, verification commands executed, and exact test results in:
`c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m2\handoff.md`.
Notify the orchestrator via send_message when complete.
