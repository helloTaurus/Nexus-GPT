## 2026-11-10T00:06:13Z
You are explorer_m2_2 (Zero-Trust Schemas & Auth/RBAC Explorer).
Your working directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_2

MANDATORY FIRST STEP: Read the following reference files:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\TEST_INFRA.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\auth-session.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier1-features\devsecops-security.test.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\e2e\tier2-boundary\auth-security-boundary.test.ts

Your mission for Milestone 2 (DevSecOps Foundation, Zero-Trust Schemas & Auth/RBAC Backend Service):
1. Design the comprehensive Zero-Trust input validation system using Zod in update/server/schemas/:
   - Auth schemas: loginSchema (email, password format & length), register/user schema.
   - Profile schemas: updateProfileSchema (emergencyContact, bankDetails, phone, etc.).
   - Reject unmapped / extraneous keys (.strict() or stripped).
   - Sanitize against injection attacks (SEI CERT & CWE-79 / CWE-89).
2. Design the authentication and session middleware in update/server/middleware/auth.ts:
   - Secure HttpOnly, SameSite=Strict/Lax cookie management (`nexus_session`).
   - Session verification and expiry handling (30m inactivity, 8h absolute expiry).
   - Password verification using Bcrypt / Argon2 with salt rounds >= 12.
3. Design the RBAC authorization middleware in update/server/middleware/rbac.ts:
   - Role hierarchy and permissions: Employee, Manager, Admin, Executive.
   - Route protection guards requiring specific roles or resource ownership (prohibiting IDOR / CWE-862).
4. Design the Auth Controller in update/server/controllers/authController.ts:
   - POST /api/v1/auth/login
   - POST /api/v1/auth/logout
   - GET /api/v1/auth/me
   - GET /api/v1/portal/profile
   - PUT /api/v1/portal/profile
5. Produce a comprehensive report in:
   c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_m2_2\schemas_auth_rbac_plan.md
6. Write handoff.md in your working directory and notify the parent orchestrator via send_message. Do NOT implement code directly.
