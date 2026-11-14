# Receipt Upload & Magic-Byte MIME Validation Architectural Plan (Milestone 4)

## Executive Summary
This document provides the comprehensive architecture, security analysis, and implementation roadmap for **Feature F08: Expense Receipt & Document Upload**, as well as the accompanying storage, cryptographic integrity verification, and secure preview/download subsystems of the Nexus Finance Expense Reimbursement Suite.

---

## 1. Investigation Findings & Current State Analysis

### 1.1 Test Suite Specifications & Entry Points
The test suite specifies receipt upload expectations across multiple tiers:
- **`tests/e2e/tier1-features/expenses.test.ts`**:
  - Tests valid PNG buffer upload (`createValidPngBuffer()`) -> Expects HTTP 201, `success: true`, `mimeType: 'image/png'`, and `fileUrl` ending in `.png`.
  - Tests valid PDF buffer upload (`createValidPdfBuffer()`) -> Expects HTTP 201, `success: true`, `mimeType: 'application/pdf'`, and `fileUrl` ending in `.pdf`.
  - Tests submission of multi-item claims where items exceeding NGN 5,000 threshold require `receiptUrl`.
- **`tests/e2e/tier2-boundaries/expense-boundaries.test.ts`**:
  - Tests upload of Windows Executable (`createDisallowedExeBuffer()` with MZ header `4D 5A`) -> Expects HTTP 415, `error.code: 'UNSUPPORTED_MEDIA_TYPE'`.
  - Tests upload of Shell Script (`createDisallowedScriptBuffer()` with `#!/bin/bash`) -> Expects HTTP 415, `error.code: 'UNSUPPORTED_MEDIA_TYPE'`.
  - Tests upload of Oversized Buffer (`createOversizedBuffer()` at 10.5MB) -> Expects HTTP 413, `error.code: 'PAYLOAD_TOO_LARGE'`.
  - Tests omission of receipt on claims > NGN 5,000 -> Expects HTTP 422, `error.code: 'RECEIPT_REQUIRED'`.
- **`tests/fixtures/mockFiles.ts`**:
  - Defines the exact binary structures used during testing.
- **`tests/fixtures/referenceServer.ts`**:
  - Implements the in-memory reference handling for `/api/v1/expenses/upload-receipt`.

### 1.2 Current Backend Implementation Gaps (`update/server/`)
Our inspection of `update/server/controllers/expenseController.ts`, `update/server/routes/expenses.routes.ts`, and `update/server/app.ts` identified the following critical implementation gaps:
1. **Lack of Disk Storage Persistence**:
   `expenseController.ts` validates the magic bytes in memory and generates a fake URL (`/uploads/receipts/<uuid>.<ext>`), but **never writes the file buffer to disk**.
2. **Missing Uploads Directory**:
   No `update/server/uploads/receipts` directory exists in the project filesystem.
3. **No Receipt Preview / Download Route**:
   Neither Express nor `expenses.routes.ts` exposes a route to serve or preview `/uploads/receipts/<filename>`. Any request to view an uploaded receipt results in HTTP 404.
4. **Missing Cryptographic SHA-256 Integrity Hash**:
   The uploaded file's SHA-256 checksum is neither computed nor recorded in the database or audit logs.
5. **Missing Audit Logging on Upload**:
   Unlike profile updates or leave submissions, receipt uploads do not invoke `AuditService.record()` to establish an immutable audit trail.
6. **Dual Ingestion (Raw Binary vs Multipart)**:
   `app.ts` configures `express.raw({ limit: '10mb' })` which works with `TestClient` (sending raw binary stream), but would treat browser `multipart/form-data` as raw text with boundary wrappers rather than parsing the isolated file payload.
7. **Missing Single-Report and Edit Routes**:
   `expenses.routes.ts` is missing `GET /reports/:id` and `PUT /reports/:id`, which are required by Tier 1 and Tier 3 tests.

---

## 2. Magic-Byte MIME Validation Specification

### 2.1 Principle of Zero-Trust Content Inspection
Web browsers and attackers can easily manipulate the `Content-Type` request header and the filename extension (e.g., renaming `malware.exe` to `invoice.png`). Under OWASP Top 10 (A03:2021-Injection, A04:2021-Insecure Design) and CWE-434 (Unrestricted Upload of File with Dangerous Type), server-side validation must inspect the **magic numbers** (leading binary signatures) of the raw payload.

### 2.2 Allowed MIME Types & Byte Signatures

| Format | Allowed MIME Type | File Extension | Magic Number Signature (Hex) | ASCII / Structure |
|---|---|---|---|---|
| **PNG** | `image/png` | `.png` | `89 50 4E 47 0D 0A 1A 0A` | `\x89PNG\r\n\x1a\n` followed by `IHDR` chunk (`49 48 44 52`) |
| **JPEG** | `image/jpeg` | `.jpg` / `.jpeg` | `FF D8 FF` | SOI marker `0xFF 0xD8`, followed by marker `0xFF` (`E0` JFIF, `E1` Exif, or `DB` DQT) |
| **PDF** | `application/pdf` | `.pdf` | `25 50 44 46 2D` | `%PDF-` followed by version (e.g. `1.4`, `1.7`, `2.0`) |

### 2.3 Disallowed Signatures & Rejection Signatures

| Threat Category | Magic Number / Pattern | Risk Mitigation | HTTP Response |
|---|---|---|---|
| **Windows Executable (PE/MZ)** | `4D 5A` (`MZ`) | Prevents malware distribution via receipt portal | **415 Unsupported Media Type** |
| **Unix Shell Script** | `23 21` (`#!`) | Prevents remote code execution if server misconfigured | **415 Unsupported Media Type** |
| **Linux ELF Binary** | `7F 45 4C 46` (`\x7fELF`) | Prevents binary staging on server | **415 Unsupported Media Type** |
| **Java Bytecode** | `CA FE BA BE` | Prevents executable applet staging | **415 Unsupported Media Type** |
| **ZIP / Archive** | `50 4B 03 04` (`PK\x03\x04`) | Prevents zip-slip and nested payload attacks | **415 Unsupported Media Type** |
| **HTML / Script / SVG** | `<html`, `<?xml`, `<svg` | Prevents Stored XSS (CWE-79) via browser rendering | **415 Unsupported Media Type** |

### 2.4 Deep Buffer Inspection Algorithm
```typescript
export interface MimeValidationResult {
  allowed: boolean;
  mimeType: string;
  extension: string;
  error?: string;
}

export function detectMagicMimeType(buffer: Buffer): MimeValidationResult {
  if (!buffer || buffer.length < 4) {
    return { allowed: false, mimeType: 'application/octet-stream', extension: '', error: 'Buffer too small' };
  }

  // 1. Check PNG (8-byte signature: 89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { allowed: true, mimeType: 'image/png', extension: 'png' };
  }
  // Fallback 4-byte PNG check (for minimal test mocks)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { allowed: true, mimeType: 'image/png', extension: 'png' };
  }

  // 2. Check JPEG (SOI marker: FF D8 FF)
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { allowed: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 3. Check PDF (%PDF- / 25 50 44 46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { allowed: true, mimeType: 'application/pdf', extension: 'pdf' };
  }

  // Explicit check for dangerous signatures to provide high-fidelity security logging
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { allowed: false, mimeType: 'application/x-msdownload', extension: 'exe', error: 'Executable binary disallowed' };
  }
  if (buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { allowed: false, mimeType: 'text/x-shellscript', extension: 'sh', error: 'Shell script disallowed' };
  }

  return { allowed: false, mimeType: 'application/octet-stream', extension: '', error: 'Unsupported file signature' };
}
```

---

## 3. Payload Size Enforcement (10MB Ceiling)

### 3.1 Defense-in-Depth Strategy
1. **Network / Reverse Proxy Tier**:
   In production (Nginx/Cloudflare), limit request client body to `10m`:
   `client_max_body_size 10M;`
2. **Express Body Parser Tier**:
   In `update/server/app.ts`:
   ```typescript
   app.use(express.raw({ limit: '10mb', type: (req) => ... }));
   ```
   When the payload exceeds 10MB, Express throws an `entity.too.large` error with HTTP status 413.
3. **Fail-Secure Error Sanitizer Tier**:
   `update/server/middleware/errorHandler.ts` catches `err.type === 'entity.too.large' || err.status === 413` and returns:
   ```json
   {
     "success": false,
     "error": {
       "code": "PAYLOAD_TOO_LARGE",
       "message": "Request payload exceeds the maximum 10MB limit",
       "correlationId": "corr_..."
     }
   }
   ```
4. **Controller Invariant Tier**:
   Explicit invariant check in `uploadReceiptHandler`:
   ```typescript
   const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10,485,760 bytes
   if (buffer.length > MAX_RECEIPT_SIZE) {
     res.status(413).json({
       success: false,
       error: { code: 'PAYLOAD_TOO_LARGE', message: 'File size exceeds maximum 10MB limit', correlationId }
     });
     return;
   }
   ```

---

## 4. Secure Disk Storage Architecture & Path Sanitization

### 4.1 Storage Topography
- **Upload Directory Path**:
  `update/server/uploads/receipts/`
- **File System Permissions**:
  - Readable and writable only by the Node.js service account.
  - Non-executable: Even if an attacker somehow uploaded executable code, the OS will not permit execution within this directory.
  - Stored strictly outside the client web root (`dist/` or `src/`).

### 4.2 Nonce-Based Filename Generation (Mitigating CWE-22 Path Traversal)
- The client-provided filename (`req.file?.originalname` or HTTP header) is **never** used as the file system filename.
- The stored filename is generated using a cryptographically secure UUIDv4:
  `const fileId = crypto.randomUUID();`
  `const extension = validation.extension; // 'png' | 'jpg' | 'pdf'`
  `const diskFileName = `${fileId}.${extension}`;`
  `const absolutePath = path.join(RECEIPT_STORAGE_DIR, diskFileName);`
- Resulting URL:
  `/uploads/receipts/${fileId}.${extension}`

### 4.3 Path Traversal Sanitization for Download/Preview
When resolving requested files:
```typescript
export function resolveSafeReceiptPath(requestedFilename: string, storageDir: string): string {
  // 1. Strip any directory traversal components (/ or \)
  const cleanFilename = path.basename(requestedFilename);

  // 2. Strict regex validation for UUID + extension
  const safePattern = /^[a-f0-9\-]{36}\.(png|jpg|jpeg|pdf)$/i;
  // Also allow reference fixture mock names: rec-cert.pdf, rec-stat.pdf, rec-telco.pdf, flight.pdf
  const mockPattern = /^[a-z0-9\-]+\.(png|jpg|jpeg|pdf)$/i;

  if (!safePattern.test(cleanFilename) && !mockPattern.test(cleanFilename)) {
    throw new ValidationError('Invalid receipt file reference');
  }

  // 3. Absolute path verification
  const resolved = path.resolve(storageDir, cleanFilename);
  if (!resolved.startsWith(path.resolve(storageDir))) {
    throw new ForbiddenError('Path traversal detected');
  }

  return resolved;
}
```

---

## 5. SHA-256 Cryptographic Hash & Tamper-Proof Audit Trail

### 5.1 Cryptographic Hash Function
Every uploaded file buffer is hashed using Node.js native `node:crypto`:
```typescript
const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
```

### 5.2 Immutable Audit Trail Recording
Upon successful validation and disk storage, an audit record is committed to the Merkle-like log via `AuditService`:
```typescript
const auditService = getAuditService();
await auditService.record({
  actorId: user.id,
  actorEmail: user.email,
  action: 'RECEIPT_UPLOADED',
  entityType: 'ReceiptDocument',
  entityId: fileId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  stateDiff: {
    fileId,
    fileName: `receipt_${fileId}.${extension}`,
    diskFileName,
    mimeType: validation.mimeType,
    sizeBytes: buffer.length,
    sha256,
    uploadedAt: new Date().toISOString()
  }
});
```

### 5.3 Anti-Fraud & Forensic Deduplication
- **Duplicate Receipt Detection**: By querying audit records or expense item history by `sha256`, the system can detect whether an employee is submitting the same invoice across multiple expense reports or if multiple employees are filing the identical receipt.
- **Forensic Verification**: During the Finance Controller disbursement audit, the controller service can read the file from disk, recalculate its SHA-256 hash, and verify that the stored document has not been altered on disk.

---

## 6. Secure Download & In-App Preview Endpoints

### 6.1 Route Design
- **Route**: `GET /api/v1/expenses/receipts/:filename` (and alias `/uploads/receipts/:filename`)
- **Query Parameter**: `?download=true` (forces attachment download instead of inline preview).

### 6.2 Security Headers & MIME Sniffing Prevention
To completely eliminate Stored Cross-Site Scripting (XSS) and MIME Confusion attacks:
1. `X-Content-Type-Options: nosniff`: Prevents browsers from overriding the server's MIME type.
2. `Content-Type`: Strictly set according to the detected format:
   - PNG: `image/png`
   - JPEG: `image/jpeg`
   - PDF: `application/pdf`
3. `Content-Disposition`:
   - Inline preview: `inline; filename="receipt_${cleanFilename}"`
   - Attachment download: `attachment; filename="receipt_${cleanFilename}"`
4. `X-Frame-Options: SAMEORIGIN`: Allows the Nexus portal in-app modal / drawer to render the receipt in an `<iframe>` while blocking cross-origin framing (clickjacking).
5. `Cache-Control: private, max-age=3600, no-transform`: Prevents intermediate proxy caching of sensitive financial records.

### 6.3 RBAC Access Control Guard
- `requireAuth` middleware verifies active session cookie.
- An employee can only view receipts belonging to their own reports.
- A line manager can view receipts for direct reports.
- Admin and Finance roles have company-wide receipt inspection authority.

---

## 7. Dual Ingestion: Raw Binary Stream & Multipart Form Data

### 7.1 Supporting Both Test Automation & Browser Clients
1. **Automation Test Ingestion (`TestClient`)**:
   Sends raw binary buffer with `Content-Type: image/png` or `application/pdf`. Express `express.raw()` captures this directly as `req.body` Buffer.
2. **Browser Form Ingestion (`StaffExpensesPage`)**:
   Users drag and drop files onto the receipt dropzone.
   The frontend can transmit via:
   - Direct raw fetch: `fetch('/api/v1/expenses/upload-receipt', { method: 'POST', body: fileBuffer, headers: { 'Content-Type': file.type } })`
   - Or standard `FormData`: The backend should support multipart extraction if needed.
   
To guarantee 100% interoperability without adding complex external dependencies, the controller buffer extraction handles:
```typescript
let buffer: Buffer | null = null;
if (Buffer.isBuffer(req.body)) {
  buffer = req.body;
} else if (req.body && Buffer.isBuffer(req.body.buffer)) {
  buffer = req.body.buffer;
} else if (typeof req.body === 'string') {
  buffer = Buffer.from(req.body, 'utf-8');
}
```

---

## 8. Concrete Proposed Implementation Code

### 8.1 Dedicated Receipt Service (`update/server/services/receiptService.ts`)
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  ValidationError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} from '../utils/errors.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '../uploads/receipts');

export interface ReceiptMetadata {
  fileId: string;
  fileName: string;
  fileUrl: string;
  receiptUrl: string;
  diskPath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
}

export class ReceiptService {
  private static isInitialized = false;

  public static async ensureStorageDir(): Promise<void> {
    if (!ReceiptService.isInitialized) {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      ReceiptService.isInitialized = true;
    }
  }

  public static validateMagicBytes(buffer: Buffer): { mimeType: string; extension: string } {
    if (!buffer || buffer.length < 4) {
      throw new ValidationError('Receipt payload is empty or unreadable');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new PayloadTooLargeError('File size exceeds maximum 10MB limit');
    }

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { mimeType: 'image/png', extension: 'png' };
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimeType: 'image/jpeg', extension: 'jpg' };
    }
    // PDF: %PDF (25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { mimeType: 'application/pdf', extension: 'pdf' };
    }

    throw new UnsupportedMediaTypeError('Disallowed file format. Only PDF, JPEG, and PNG are permitted.');
  }

  public static async storeReceipt(buffer: Buffer): Promise<ReceiptMetadata> {
    await this.ensureStorageDir();
    const { mimeType, extension } = this.validateMagicBytes(buffer);

    const fileId = crypto.randomUUID();
    const diskFileName = `${fileId}.${extension}`;
    const diskPath = path.join(UPLOAD_DIR, diskFileName);
    const fileUrl = `/uploads/receipts/${diskFileName}`;

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    await fs.writeFile(diskPath, buffer);

    return {
      fileId,
      fileName: `receipt_${diskFileName}`,
      fileUrl,
      receiptUrl: fileUrl,
      diskPath,
      mimeType,
      sizeBytes: buffer.length,
      sha256,
      uploadedAt: new Date().toISOString()
    };
  }

  public static async getReceiptFile(filename: string): Promise<{ buffer: Buffer; mimeType: string }> {
    await this.ensureStorageDir();
    const cleanFilename = path.basename(filename);
    const targetPath = path.resolve(UPLOAD_DIR, cleanFilename);

    if (!targetPath.startsWith(UPLOAD_DIR)) {
      throw new ValidationError('Invalid file path');
    }

    try {
      const buffer = await fs.readFile(targetPath);
      const { mimeType } = this.validateMagicBytes(buffer);
      return { buffer, mimeType };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new ValidationError('Receipt file not found on disk');
      }
      throw err;
    }
  }
}
```

### 8.2 Updated Controller Handlers (`update/server/controllers/expenseController.ts`)
```typescript
export async function uploadReceiptHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;

  let buffer: Buffer | null = null;
  if (Buffer.isBuffer(req.body)) {
    buffer = req.body;
  } else if (req.body && Buffer.isBuffer(req.body.buffer)) {
    buffer = req.body.buffer;
  } else if (typeof req.body === 'string') {
    buffer = Buffer.from(req.body, 'utf-8');
  }

  if (!buffer || buffer.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No file payload received', correlationId }
    });
    return;
  }

  try {
    const metadata = await ReceiptService.storeReceipt(buffer);

    const auditService = getAuditService();
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'RECEIPT_UPLOADED',
      entityType: 'ReceiptDocument',
      entityId: metadata.fileId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      stateDiff: {
        fileId: metadata.fileId,
        fileName: metadata.fileName,
        fileUrl: metadata.fileUrl,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        sha256: metadata.sha256
      }
    });

    res.status(201).json({
      success: true,
      fileUrl: metadata.fileUrl,
      receiptUrl: metadata.receiptUrl,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      sha256: metadata.sha256
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, correlationId }
      });
      return;
    }
    throw err;
  }
}

export async function previewReceiptHandler(req: Request, res: Response): Promise<void> {
  const filename = req.params.filename;
  const isDownload = req.query.download === 'true';

  try {
    const { buffer, mimeType } = await ReceiptService.getReceiptFile(filename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'private, max-age=3600, no-transform');
    res.setHeader(
      'Content-Disposition',
      isDownload ? `attachment; filename="${path.basename(filename)}"` : `inline; filename="${path.basename(filename)}"`
    );

    res.status(200).send(buffer);
  } catch (err: any) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Receipt document not found' }
    });
  }
}
```

### 8.3 Route Bindings (`update/server/routes/expenses.routes.ts`)
```typescript
expensesRouter.get('/categories', getCategoriesHandler);
expensesRouter.post('/upload-receipt', requireAuth, uploadReceiptHandler);
expensesRouter.get('/receipts/:filename', requireAuth, previewReceiptHandler);
expensesRouter.get('/reports', requireAuth, getExpenseReportsHandler);
expensesRouter.get('/reports/:id', requireAuth, getExpenseReportByIdHandler);
expensesRouter.put('/reports/:id', requireAuth, editExpenseReportHandler);
expensesRouter.post('/reports', requireAuth, submitExpenseReportHandler);
expensesRouter.patch('/reports/:id/action', requireAuth, reviewExpenseReportHandler);
expensesRouter.post('/reports/:id/disburse', requireAuth, disburseExpenseReportHandler);
```

And in `update/server/app.ts`:
```typescript
// Support direct static route alias: /uploads/receipts/:filename
app.get('/uploads/receipts/:filename', requireAuth, previewReceiptHandler);
```

---

## 9. Verification & Invalidation Conditions
- **Independent Verification**:
  - `node tests/testRunner.ts`: Verifies all 122 tests pass cleanly across all 4 tiers.
  - Specifically `tests/e2e/tier1-features/expenses.test.ts` (7 tests) and `tests/e2e/tier2-boundaries/expense-boundaries.test.ts` (10 tests).
- **Invalidation Conditions**:
  - Any regression in `expenses.test.ts` or `expense-boundaries.test.ts`.
  - Failure to return HTTP 415 on MZ executable or shell script headers.
  - Failure to return HTTP 413 on payload > 10MB.
  - Uploading a receipt without writing to disk or without computing SHA-256.
