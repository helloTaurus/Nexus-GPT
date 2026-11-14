## 2026-11-10T00:06:05Z
You are explorer_m2_1 (Server Architecture & Express Middleware Explorer).
Your working directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_1

MANDATORY FIRST STEP: Read the following reference files:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\TEST_INFRA.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\testRunner.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\fixtures\referenceServer.ts (inspect how the test suite expects the server to boot, port defaults, health endpoints, CORS, cookies, and shutdown)

Your mission for Milestone 2 (DevSecOps Foundation, Zero-Trust Schemas & Auth/RBAC Backend Service):
1. Design the Express application architecture for update/server/:
   - update/server/index.ts: Express server startup, port resolution (process.env.PORT || 3001), graceful shutdown, JSON parser, cookie-parser, CORS configuration (origin allowlist, credentials: true), helmet security headers (CSP, HSTS, frameguard, XSS filter).
   - Health and diagnostics endpoints: GET /api/v1/health returning status, uptime, timestamp.
   - update/server/middleware/errorHandler.ts: Fail-secure error sanitizer complying with OWASP A09 & Microsoft SDL (never leak stack traces or internal paths to clients; generate unique error correlation IDs; return standardized RFC 7807 problem details or { error: string, code: string, correlationId: string }).
   - Rate limiting middleware: protection against brute-force and credential stuffing on /api/v1/auth/login.
2. Coordinate with explorer_m2_2 (schemas & auth) and explorer_m2_3 (repositories & audit service).
3. Produce a comprehensive report in:
   c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_1\server_architecture_plan.md
4. Write handoff.md in your working directory and notify the parent orchestrator via send_message. Do NOT implement code directly.
