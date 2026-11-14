# Handoff Report — explorer_m4_2 (Receipt Upload & Magic-Byte MIME Validation)

## 1. Observation

1. **Test Suite Specifications for F08**:
   - In `tests/fixtures/mockFiles.ts` (lines 1-40), test buffers are defined:
     - `createValidPngBuffer()`: Starts with `0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a` followed by chunk `0x49, 0x48, 0x44, 0x52` (`IHDR`).
     - `createValidJpegBuffer()`: Starts with `0xff, 0xd8, 0xff, 0xe0` followed by `JFIF` header.
     - `createValidPdfBuffer()`: Starts with `Buffer.from('%PDF-1.4\n1 0 obj\n...')`.
     - `createDisallowedExeBuffer()`: Starts with `0x4d, 0x5a` (MZ header).
     - `createDisallowedScriptBuffer()`: Starts with `Buffer.from('#!/bin/bash\n...')`.
     - `createOversizedBuffer()`: `Buffer.alloc(10.5 * 1024 * 1024, 0xaa)`.
   - In `tests/e2e/tier1-features/expenses.test.ts` (lines 24-44):
     - `F08: Upload receipt with valid PNG magic-bytes returns file URL`:
       ```typescript
       const res = await client.upload('/api/v1/expenses/upload-receipt', pngBuffer, 'image/png');
       assert.equal(res.status, 201);
       assert.equal(res.body.success, true);
       assert.equal(res.body.mimeType, 'image/png');
       assert.ok(res.body.fileUrl.endsWith('.png'));
       ```
     - `F08: Upload receipt with valid PDF magic-bytes returns file URL`:
       ```typescript
       const res = await client.upload('/api/v1/expenses/upload-receipt', pdfBuffer, 'application/pdf');
       assert.equal(res.status, 201);
       assert.equal(res.body.success, true);
       assert.equal(res.body.mimeType, 'application/pdf');
       assert.ok(res.body.fileUrl.endsWith('.pdf'));
       ```
   - In `tests/e2e/tier2-boundaries/expense-boundaries.test.ts` (lines 91-116):
     - Disallowed MZ binary returns HTTP 415 and `error.code: 'UNSUPPORTED_MEDIA_TYPE'`.
     - Disallowed shell script returns HTTP 415 and `error.code: 'UNSUPPORTED_MEDIA_TYPE'`.
     - Oversized buffer (> 10MB) returns HTTP 413 and `error.code: 'PAYLOAD_TOO_LARGE'`.
     - Item exceeding NGN 5,000 without `receiptUrl` returns HTTP 422 and `error.code: 'RECEIPT_REQUIRED'`.

2. **Test Harness & Dispatch Mechanism**:
   - In `tests/helpers/testClient.ts` (lines 172-174):
     ```typescript
     public async upload<T = any>(path: string, buffer: Buffer, contentType: string = 'application/octet-stream', headers: Record<string, string> = {}) {
       return this.request<T>('POST', path, { rawBuffer: buffer, contentType, headers });
     }
     ```
     `TestClient` transmits the raw buffer directly in the request body with the specified `Content-Type`.

3. **Current Express Server Implementation**:
   - In `update/server/app.ts` (lines 33-40):
     ```typescript
     app.use(
       express.raw({
         limit: '10mb',
         type: (req) => {
           const ct = req.headers['content-type'];
           return ct ? !ct.includes('application/json') && !ct.includes('application/x-www-form-urlencoded') : false;
         }
       })
     );
     ```
   - In `update/server/controllers/expenseController.ts` (lines 11-82):
     - `uploadReceiptHandler` validates magic bytes in memory:
       - PNG (`0x89, 0x50, 0x4e, 0x47`) -> `image/png`
       - JPEG (`0xff, 0xd8, 0xff`) -> `image/jpeg`
       - PDF (`0x25, 0x50, 0x44, 0x46`) -> `application/pdf`
       - Else -> 415 `UNSUPPORTED_MEDIA_TYPE`
     - File size check (> 10MB) -> 413 `PAYLOAD_TOO_LARGE`
     - Generates UUID `fileId` and returns 201:
       ```json
       {
         "success": true,
         "fileUrl": "/uploads/receipts/${fileId}.${ext}",
         "receiptUrl": "/uploads/receipts/${fileId}.${ext}",
         "fileName": "receipt_${fileId}.${ext}",
         "mimeType": "...",
         "sizeBytes": buffer.length
       }
       ```
     - **Deficiency Observed**: Lines 70-82 **do not write the file buffer to disk**, do not calculate SHA-256 hash, and do not record an audit log event.
     - **Deficiency Observed**: No directory `update/server/uploads/receipts` exists.
     - **Deficiency Observed**: In `update/server/routes/expenses.routes.ts`, there is no route for downloading or previewing uploaded receipts (`GET /receipts/:filename` or `GET /uploads/receipts/:filename`).
     - **Deficiency Observed**: Missing routes `GET /reports/:id` and `PUT /reports/:id` in `update/server/routes/expenses.routes.ts`.

4. **Reference Server Baseline**:
   - In `tests/fixtures/referenceServer.ts` (lines 927-981), in-memory handling passes 100% of the 122 tests executed via `node tests/testRunner.ts`.

---

## 2. Logic Chain

1. **From Observation 1 & 2**:
   The E2E test suite validates the contract `POST /api/v1/expenses/upload-receipt`. Uploads are tested by posting binary buffers with varying content types. Valid PNG and PDF buffers return 201 with matching extensions; executables and shell scripts return 415; files > 10MB return 413. Therefore, any backend implementation must support raw binary ingestion at `/api/v1/expenses/upload-receipt` and enforce these exact status codes and error keys.

2. **From Observation 3**:
   While `update/server/controllers/expenseController.ts` currently implements the in-memory validation checks and returns the correct JSON envelope, it discards the buffer after the request completes. If an employee or manager accesses the URL returned in `fileUrl` (`/uploads/receipts/<uuid>.<ext>`), Express has no handler or file on disk to serve, resulting in a 404 error.

3. **From DevSecOps & Security Requirements (ORIGINAL_REQUEST.md & PROJECT.md)**:
   Under OWASP Top 10, CWE-22, CWE-434, and NIST SSDF:
   - File storage must use nonces/UUIDs rather than user-supplied filenames to prevent path traversal and script execution.
   - Files must be stored outside web roots and marked non-executable.
   - Uploaded files must have an immutable cryptographic checksum (SHA-256) calculated and recorded in the audit trail to ensure tamper detection and non-repudiation.
   - Serving uploaded documents must enforce `X-Content-Type-Options: nosniff` and controlled `Content-Disposition` to eliminate Stored XSS and MIME sniffing attacks.

4. **Synthesis & Conclusion**:
   The backend requires:
   - A dedicated `ReceiptService` that writes validated files to `update/server/uploads/receipts/` using UUID filenames.
   - Calculation of SHA-256 checksum and integration with `AuditService.record()`.
   - A secure download/preview route (`GET /api/v1/expenses/receipts/:filename` and route alias `/uploads/receipts/:filename`).
   - Adding missing `GET /reports/:id` and `PUT /reports/:id` routes in `expenses.routes.ts`.

---

## 3. Caveats

- **No Caveats** regarding the core test suite requirements: the contracts and assertions in `expenses.test.ts` and `expense-boundaries.test.ts` are unambiguous and verified.
- **Assumptions**:
  - The live Express server will run with local filesystem permissions to create and write to `update/server/uploads/receipts/`.
  - For browser clients submitting via standard multipart forms, the controller buffer extraction handles both raw binary bodies and buffer wrappers.

---

## 4. Conclusion

The receipt upload architecture is well-specified by the test suite and reference server. The production Express backend requires transitioning the current in-memory stub in `expenseController.ts` into a fully persistent, secure storage service:
1. Validate magic bytes against allowed PNG (`0x89 0x50 0x4E 0x47`), JPEG (`0xFF 0xD8 0xFF`), and PDF (`0x25 0x50 0x44 0x46`) signatures.
2. Reject executables, scripts, and non-whitelisted formats with HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.
3. Enforce the 10MB ceiling at both the Express body parser and controller levels with HTTP 413 `PAYLOAD_TOO_LARGE`.
4. Persist files to `update/server/uploads/receipts/${fileId}.${extension}` using cryptographically random UUIDs.
5. Compute the SHA-256 digest of the payload and commit it to `AuditService` under action `RECEIPT_UPLOADED`.
6. Bind secure download/preview endpoints with `X-Content-Type-Options: nosniff` and RBAC guards.
7. Add missing routes (`GET /reports/:id` and `PUT /reports/:id`) in `expenses.routes.ts`.

All architecture specifications, algorithms, and proposed code implementations are detailed in `receipt_upload_plan.md`.

---

## 5. Verification Method

1. **Native Test Suite Execution**:
   ```powershell
   node tests/testRunner.ts
   ```
   Must produce `[TEST SUITE RUN: 100% PASSED] All tests passed` across all 122 tests.

2. **Targeted Expense Suite Verification**:
   ```powershell
   node --test tests/e2e/tier1-features/expenses.test.ts
   node --test tests/e2e/tier2-boundaries/expense-boundaries.test.ts
   ```

3. **Disk Persistence & Hash Verification**:
   Inspect `update/server/uploads/receipts/` after an upload to confirm the physical file exists, is non-zero in size, and that `crypto.createHash('sha256').update(fileBuffer).digest('hex')` matches the hash in `audit_logs.jsonl`.
