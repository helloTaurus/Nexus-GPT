# DISPATCH: challenger_m4_2 (Receipt Upload & Document Security Challenger)

## Mission
You are `challenger_m4_2`. Adversarially challenge the receipt upload endpoint, magic-byte validation, disk storage, SHA-256 integrity, path traversal prevention, and download/preview security.

## Input Files to Read
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\fixtures\mockFiles.ts
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\server\controllers\expenseController.ts

## Adversarial Challenge Plan
Write and execute an adversarial test file (e.g., `tests/adversarial/m4-receipt-security.test.ts`) that verifies:
1. **Magic-Byte MIME Enforcement**:
   - Forged MIME header: Uploading shell script with `Content-Type: image/png` is rejected with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.
   - Polyglot or binary disguised as PDF is rejected if magic bytes do not match.
   - Legitimate PNG, JPEG, and PDF uploads return HTTP 201 with matching file extensions.
2. **Payload Size Boundary**:
   - File of exactly 10MB succeeds.
   - File of 10.5MB is rejected with HTTP 413 `PAYLOAD_TOO_LARGE`.
3. **Disk Persistence & Cryptographic Hash**:
   - File actually exists on disk in `update/server/uploads/receipts/`.
   - Recomputing SHA-256 of the saved file matches the `sha256` in the upload response and in `audit_logs.jsonl`.
4. **Path Traversal & Download Protection**:
   - Requesting `GET /api/v1/expenses/receipts/../../package.json` returns HTTP 400 or 403 or 404 (traversal blocked).
   - Valid receipt download responds with `X-Content-Type-Options: nosniff`.
5. Ensure 100% test idempotency (clean teardown of uploaded test files).

Deliver `challenge.md` and hard handoff `handoff.md` with explicit verdict (APPROVE or REQUEST_CHANGES). Send completion message to parent.
NOTE: Run tests with default sandbox permissions (`BypassSandbox: false`).

## 2026-11-10T03:37:42Z
You are challenger_m4_2 (Receipt Upload & Document Security Challenger).

Working Directory: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m4_2

Read before starting:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\challenger_m4_2\DISPATCH.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m4\handoff.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\tests\fixtures\mockFiles.ts

Challenge tasks:
Write and execute an adversarial test suite (e.g. `tests/adversarial/m4-receipt-security.test.ts`) that verifies:
1. Magic-byte MIME enforcement: forged Content-Type (e.g. shell script disguised as PNG) returns 415 UNSUPPORTED_MEDIA_TYPE. Legitimate PNG, JPEG, PDF return 201.
2. File size limits: 10MB passes, 10.5MB returns 413 PAYLOAD_TOO_LARGE.
3. Disk storage & SHA-256 integrity: physical file saved in `update/server/uploads/receipts/`, SHA-256 matches audit log.
4. Path traversal prevention on download endpoint: `GET /receipts/../../` blocked. `X-Content-Type-Options: nosniff` header present.
5. Idempotent execution (clean teardown of uploaded test files).

Deliver `challenge.md` and hard handoff `handoff.md` with explicit verdict (APPROVE or REQUEST_CHANGES). Send completion message to parent.
NOTE: Run all tests with default sandbox permissions (`BypassSandbox: false`). In-process Express dispatch only.
