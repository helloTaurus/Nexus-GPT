import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getAuditService } from '../../update/server/repositories/dataStore.ts';
import {
  createValidPngBuffer,
  createValidJpegBuffer,
  createValidPdfBuffer,
  createDisallowedExeBuffer,
  createDisallowedScriptBuffer,
  createOversizedBuffer
} from '../fixtures/mockFiles.ts';

process.env.DISABLE_RATE_LIMIT = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../update/server/uploads/receipts');
const AUDIT_LOG_FILE = path.resolve(__dirname, '../../update/server/data/audit_logs.jsonl');

const trackedFiles = new Set<string>();

function invokeExpress(
  app: any,
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    rawBuffer?: Buffer;
    ip?: string;
  } = {}
): Promise<{ status: number; headers: Record<string, any>; body: any; rawBody: string; rawBuffer: Buffer }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;

    const headers = options.headers || {};
    const ip = options.ip || `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    headers['x-forwarded-for'] = ip;

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    let payloadBuffer: Buffer | null = null;
    if (options.rawBuffer) {
      payloadBuffer = options.rawBuffer;
    } else if (Buffer.isBuffer(options.body)) {
      payloadBuffer = options.body;
    } else if (options.body !== undefined) {
      const jsonStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      payloadBuffer = Buffer.from(jsonStr, 'utf-8');
      if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/json';
      }
    }

    if (payloadBuffer) {
      req.headers['content-length'] = payloadBuffer.length.toString();
    }

    const res = new ServerResponse(req);
    const resChunks: Buffer[] = [];

    res.write = function (chunk: any) {
      if (chunk) {
        resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    } as any;

    res.end = function (chunk: any) {
      if (chunk) {
        resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBuffer = Buffer.concat(resChunks);
      const rawBody = rawBuffer.toString('utf-8');
      let parsedBody: any = rawBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        // keep string/binary
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
        rawBody,
        rawBuffer
      });
      return res;
    } as any;

    if (payloadBuffer) {
      req.push(payloadBuffer);
      req.push(null);
    } else {
      req.push(null);
    }

    app(req, res);
  });
}

function createExact10MbPdfBuffer(): Buffer {
  const targetSize = 10 * 1024 * 1024; // 10,485,760 bytes
  const buf = Buffer.alloc(targetSize);
  const header = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  header.copy(buf, 0);
  buf.fill(0x25, header.length); // fill with '%' comment characters
  return buf;
}

function create10MbPlusOneBuffer(): Buffer {
  const targetSize = 10 * 1024 * 1024 + 1; // 10,485,761 bytes
  const buf = Buffer.alloc(targetSize);
  const header = Buffer.from('%PDF-1.4\n');
  header.copy(buf, 0);
  return buf;
}

describe('Milestone 4 Adversarial Stress Suite: Receipt Upload & Document Security', () => {
  let app: any;
  let employeeCookie: string;
  let managerCookie: string;

  before(async () => {
    await initializeDataStore();
    app = createApp();

    // Authenticate employee
    const empLogin = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
      body: { email: 'employee@nexusfinance.ng', password: 'EmployeePassword123!' },
      ip: '10.0.4.1'
    });
    assert.equal(empLogin.status, 200, `Employee login failed: ${JSON.stringify(empLogin.body)}`);
    employeeCookie = String(empLogin.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];

    // Authenticate manager
    const mgrLogin = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
      body: { email: 'manager@nexusfinance.ng', password: 'ManagerPassword123!' },
      ip: '10.0.4.2'
    });
    assert.equal(mgrLogin.status, 200, `Manager login failed: ${JSON.stringify(mgrLogin.body)}`);
    managerCookie = String(mgrLogin.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];
  });

  after(async () => {
    // Teardown: delete all files tracked during test runs
    for (const filePath of trackedFiles) {
      try {
        await fs.unlink(filePath);
      } catch {
        // file already removed or missing
      }
    }
    trackedFiles.clear();
  });

  // =========================================================================
  // Vector 1: Magic-Byte MIME Enforcement & Zero-Trust Inspection (CWE-434)
  // =========================================================================
  describe('Vector 1: Magic-Byte MIME Enforcement & Zero-Trust Header Inspection', () => {
    test('1.1: Legitimate PNG magic bytes (89 50 4E 47) accepted with HTTP 201', async () => {
      const pngBuffer = createValidPngBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: pngBuffer
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.mimeType, 'image/png');
      assert.ok(res.body.fileUrl.endsWith('.png'));
      assert.ok(res.body.receiptUrl.endsWith('.png'));
      assert.ok(res.body.fileName.endsWith('.png'));
      assert.equal(res.body.sizeBytes, pngBuffer.length);

      const diskPath = path.join(UPLOAD_DIR, path.basename(res.body.fileUrl));
      trackedFiles.add(diskPath);
    });

    test('1.2: Legitimate JPEG magic bytes (FF D8 FF) accepted with HTTP 201', async () => {
      const jpegBuffer = createValidJpegBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/jpeg'
        },
        rawBuffer: jpegBuffer
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.mimeType, 'image/jpeg');
      assert.ok(res.body.fileUrl.endsWith('.jpg'));
      assert.ok(res.body.receiptUrl.endsWith('.jpg'));
      assert.ok(res.body.fileName.endsWith('.jpg'));
      assert.equal(res.body.sizeBytes, jpegBuffer.length);

      const diskPath = path.join(UPLOAD_DIR, path.basename(res.body.fileUrl));
      trackedFiles.add(diskPath);
    });

    test('1.3: Legitimate PDF magic bytes (25 50 44 46) accepted with HTTP 201', async () => {
      const pdfBuffer = createValidPdfBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: pdfBuffer
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.mimeType, 'application/pdf');
      assert.ok(res.body.fileUrl.endsWith('.pdf'));
      assert.ok(res.body.receiptUrl.endsWith('.pdf'));
      assert.ok(res.body.fileName.endsWith('.pdf'));
      assert.equal(res.body.sizeBytes, pdfBuffer.length);

      const diskPath = path.join(UPLOAD_DIR, path.basename(res.body.fileUrl));
      trackedFiles.add(diskPath);
    });

    test('1.4: Spoofed Content-Type: Shell script disguised as image/png is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const scriptBuffer = createDisallowedScriptBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: scriptBuffer
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.5: Spoofed Content-Type: PE executable binary (4D 5A) disguised as image/jpeg is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const exeBuffer = createDisallowedExeBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/jpeg'
        },
        rawBuffer: exeBuffer
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.6: Spoofed Content-Type: HTML payload disguised as application/pdf is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html><html><head><script>alert("XSS")</script></head><body>evil</body></html>');
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: htmlBuffer
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.7: Disallowed graphic format: GIF89a (47 49 46 38) disguised as image/png is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: gifBuffer
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.8: Disallowed archive format: ZIP header (50 4B 03 04) disguised as application/pdf is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: zipBuffer
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.9: Truncated header (1 byte 0x89) with image/png is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const truncBuffer = Buffer.from([0x89]);
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: truncBuffer
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.10: Truncated JPEG header (2 bytes FF D8) is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const truncJpeg = Buffer.from([0xff, 0xd8]);
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/jpeg'
        },
        rawBuffer: truncJpeg
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.11: Truncated PDF header (3 bytes %PD = 25 50 44) is rejected with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const truncPdf = Buffer.from([0x25, 0x50, 0x44]);
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: truncPdf
      });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('1.12: Zero-byte / empty file payload is rejected with 400 VALIDATION_ERROR', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: emptyBuffer
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('1.13: Zero-trust magic byte precedence: Valid PNG uploaded with application/pdf header is detected as image/png', async () => {
      const pngBuffer = createValidPngBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: pngBuffer
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.mimeType, 'image/png'); // Detected from magic bytes, not spoofed header
      assert.ok(res.body.fileUrl.endsWith('.png'));

      const diskPath = path.join(UPLOAD_DIR, path.basename(res.body.fileUrl));
      trackedFiles.add(diskPath);
    });
  });

  // =========================================================================
  // Vector 2: File Size Limits & Boundary Enforcement (CWE-400 / CWE-770)
  // =========================================================================
  describe('Vector 2: File Size Limits & Boundary Enforcement', () => {
    test('2.1: Exactly 10MB (10,485,760 bytes) valid payload passes with HTTP 201', async () => {
      const exact10Mb = createExact10MbPdfBuffer();
      assert.equal(exact10Mb.length, 10 * 1024 * 1024);

      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: exact10Mb
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.sizeBytes, 10 * 1024 * 1024);
      assert.equal(res.body.mimeType, 'application/pdf');

      const diskPath = path.join(UPLOAD_DIR, path.basename(res.body.fileUrl));
      trackedFiles.add(diskPath);

      // Verify physical disk size
      const stat = await fs.stat(diskPath);
      assert.equal(stat.size, 10 * 1024 * 1024);
    });

    test('2.2: 10MB + 1 byte (10,485,761 bytes) is rejected with HTTP 413 PAYLOAD_TOO_LARGE', async () => {
      const plusOne = create10MbPlusOneBuffer();
      assert.equal(plusOne.length, 10 * 1024 * 1024 + 1);

      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: plusOne
      });

      assert.equal(res.status, 413);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
    });

    test('2.3: 10.5MB (11,010,048 bytes) mockFiles.createOversizedBuffer is rejected with HTTP 413 PAYLOAD_TOO_LARGE', async () => {
      const oversized = createOversizedBuffer();
      assert.equal(oversized.length, 10.5 * 1024 * 1024);

      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/octet-stream'
        },
        rawBuffer: oversized
      });

      assert.equal(res.status, 413);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
    });

    test('2.4: 10.5MB file with valid PDF magic bytes is rejected with HTTP 413 PAYLOAD_TOO_LARGE', async () => {
      const oversizedPdf = Buffer.alloc(Math.floor(10.5 * 1024 * 1024));
      Buffer.from('%PDF-1.4\n').copy(oversizedPdf, 0);

      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: oversizedPdf
      });

      assert.equal(res.status, 413);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
    });
  });

  // =========================================================================
  // Vector 3: Disk Storage, SHA-256 Integrity & Immutable Audit Trail (CWE-353)
  // =========================================================================
  describe('Vector 3: Disk Storage, Cryptographic SHA-256 & Audit Log Integrity', () => {
    test('3.1: Physical file exists on disk in update/server/uploads/receipts/', async () => {
      const pngBuffer = createValidPngBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: pngBuffer
      });

      assert.equal(res.status, 201);
      const filename = path.basename(res.body.fileUrl);
      const diskPath = path.join(UPLOAD_DIR, filename);
      trackedFiles.add(diskPath);

      const stat = await fs.stat(diskPath);
      assert.ok(stat.isFile());
      assert.equal(stat.size, pngBuffer.length);
    });

    test('3.2: Recomputing SHA-256 of physical file on disk matches upload response sha256', async () => {
      const pdfBuffer = createValidPdfBuffer();
      const expectedHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: pdfBuffer
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.sha256, expectedHash);

      const filename = path.basename(res.body.fileUrl);
      const diskPath = path.join(UPLOAD_DIR, filename);
      trackedFiles.add(diskPath);

      const diskBuffer = await fs.readFile(diskPath);
      const diskHash = crypto.createHash('sha256').update(diskBuffer).digest('hex');
      assert.equal(diskHash, expectedHash);
      assert.equal(diskHash, res.body.sha256);
    });

    test('3.3: SHA-256 and metadata recorded in update/server/data/audit_logs.jsonl', async () => {
      const jpegBuffer = createValidJpegBuffer();
      const expectedHash = crypto.createHash('sha256').update(jpegBuffer).digest('hex');

      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/jpeg'
        },
        rawBuffer: jpegBuffer
      });

      assert.equal(res.status, 201);
      const filename = path.basename(res.body.fileUrl);
      const fileId = filename.replace(/\.[^.]+$/, '');
      const diskPath = path.join(UPLOAD_DIR, filename);
      trackedFiles.add(diskPath);

      // Verify in audit_logs.jsonl file on disk
      const auditLogContent = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
      const lines = auditLogContent.trim().split('\n');
      const matchingLine = lines.map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).find(e => e && e.action === 'RECEIPT_UPLOADED' && (e.entityId === fileId || e.stateDiff?.sha256 === expectedHash));

      assert.ok(matchingLine, 'Audit log entry for RECEIPT_UPLOADED must exist');
      assert.equal(matchingLine.action, 'RECEIPT_UPLOADED');
      assert.equal(matchingLine.entityType, 'ReceiptDocument');
      assert.equal(matchingLine.stateDiff.sha256, expectedHash);
      assert.equal(matchingLine.stateDiff.sizeBytes, jpegBuffer.length);
      assert.equal(matchingLine.stateDiff.mimeType, 'image/jpeg');
    });

    test('3.4: AuditService hash chain integrity remains valid after receipt upload', async () => {
      const auditService = getAuditService();
      const integrity = auditService.verifyIntegrity();
      assert.equal(integrity.valid, true, `Audit log hash chain compromised: ${integrity.compromisedId}`);
      assert.ok(integrity.totalChecked > 0);
    });
  });

  // =========================================================================
  // Vector 4: Path Traversal Prevention on Download Endpoints (CWE-22 / CWE-23)
  // =========================================================================
  describe('Vector 4: Path Traversal Prevention on Download Endpoints', () => {
    test('4.1: Direct path traversal /receipts/../../package.json is blocked (404/403/400)', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/../../package.json', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('"name": "nexus-finance"'), 'Must not leak package.json');
    });

    test('4.2: URL-encoded traversal /receipts/..%2F..%2Fpackage.json is blocked without file leak', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/..%2F..%2Fpackage.json', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('"name": "nexus-finance"'));
    });

    test('4.3: Double URL-encoded traversal /receipts/%252e%252e%252fpackage.json is blocked', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/%252e%252e%252fpackage.json', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('"name": "nexus-finance"'));
    });

    test('4.4: Windows backslash traversal /receipts/..%5C..%5Cpackage.json is blocked', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/..%5C..%5Cpackage.json', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('"name": "nexus-finance"'));
    });

    test('4.5: Redundant slashes traversal /receipts/....//....//package.json is blocked', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/....//....//package.json', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('"name": "nexus-finance"'));
    });

    test('4.6: Absolute path traversal attempt /receipts/C:%5CWindows%5Cwin.ini is blocked', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/C:%5CWindows%5Cwin.ini', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('[fonts]'));
    });

    test('4.7: Alias download route /uploads/receipts/../../package.json is blocked', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/uploads/receipts/../../package.json', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404, got ${res.status}`);
      assert.ok(!res.rawBody.includes('"name": "nexus-finance"'));
    });

    test('4.8: Non-existent receipt file returns 404 NOT_FOUND without internal path leak', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/nonexistent-receipt-9999.png', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.ok(!res.rawBody.includes('c:\\'), 'Must not leak internal filesystem path');
      assert.ok(!res.rawBody.includes('/Users/'), 'Must not leak internal filesystem path');
    });
  });

  // =========================================================================
  // Vector 5: Download Security Headers & Preview Invariants (OWASP A05)
  // =========================================================================
  describe('Vector 5: Download Security Headers & Preview Invariants', () => {
    let testPngFilename: string;
    let testPdfFilename: string;

    before(async () => {
      // Upload PNG for header checks
      const pngBuffer = createValidPngBuffer();
      const resPng = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: pngBuffer
      });
      testPngFilename = path.basename(resPng.body.fileUrl);
      trackedFiles.add(path.join(UPLOAD_DIR, testPngFilename));

      // Upload PDF for header checks
      const pdfBuffer = createValidPdfBuffer();
      const resPdf = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'application/pdf'
        },
        rawBuffer: pdfBuffer
      });
      testPdfFilename = path.basename(resPdf.body.fileUrl);
      trackedFiles.add(path.join(UPLOAD_DIR, testPdfFilename));
    });

    test('5.1: Valid receipt download includes X-Content-Type-Options: nosniff header', async () => {
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/receipts/${testPngFilename}`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });

    test('5.2: Content-Type header matches file format image/png', async () => {
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/receipts/${testPngFilename}`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'image/png');
    });

    test('5.3: Content-Type header matches file format application/pdf', async () => {
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/receipts/${testPdfFilename}`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
    });

    test('5.4: Default preview mode returns Content-Disposition: inline', async () => {
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/receipts/${testPngFilename}`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.ok(String(res.headers['content-disposition']).includes('inline'));
      assert.ok(String(res.headers['content-disposition']).includes(testPngFilename));
    });

    test('5.5: Download query parameter ?download=true returns Content-Disposition: attachment', async () => {
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/receipts/${testPngFilename}?download=true`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.ok(String(res.headers['content-disposition']).includes('attachment'));
      assert.ok(String(res.headers['content-disposition']).includes(testPngFilename));
    });

    test('5.6: Downloaded file content matches original uploaded bytes byte-for-byte', async () => {
      const originalPdf = createValidPdfBuffer();
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/receipts/${testPdfFilename}`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.rawBuffer.length, originalPdf.length);
      assert.ok(res.rawBuffer.equals(originalPdf), 'Downloaded binary must equal uploaded buffer');
    });

    test('5.7: Alias route /uploads/receipts/:filename serves identical content with nosniff header', async () => {
      const originalPdf = createValidPdfBuffer();
      const res = await invokeExpress(app, 'GET', `/api/v1/expenses/uploads/receipts/${testPdfFilename}`, {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.ok(res.rawBuffer.equals(originalPdf));
    });
  });

  // =========================================================================
  // Vector 6: Authorization & RBAC Invariants (OWASP A01)
  // =========================================================================
  describe('Vector 6: Authentication & Session Verification on Receipt Endpoints', () => {
    test('6.1: Unauthenticated POST /upload-receipt returns 401 UNAUTHORIZED', async () => {
      const pngBuffer = createValidPngBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: { 'content-type': 'image/png' },
        rawBuffer: pngBuffer
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    test('6.2: Unauthenticated GET /receipts/:filename returns 401 UNAUTHORIZED', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/expenses/receipts/dummy.png');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    test('6.3: Upload with forged / invalid session cookie returns 401 UNAUTHORIZED', async () => {
      const pngBuffer = createValidPngBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: 'nexus_session=tampered_forged_session_token_12345',
          'content-type': 'image/png'
        },
        rawBuffer: pngBuffer
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });
  });

  // =========================================================================
  // Vector 7: Idempotency & Teardown Verification
  // =========================================================================
  describe('Vector 7: Idempotent Execution & Cleanup Invariants', () => {
    test('7.1: Ephemeral test upload is deleted cleanly without leaving disk artifacts', async () => {
      const pngBuffer = createValidPngBuffer();
      const res = await invokeExpress(app, 'POST', '/api/v1/expenses/upload-receipt', {
        headers: {
          cookie: `nexus_session=${employeeCookie}`,
          'content-type': 'image/png'
        },
        rawBuffer: pngBuffer
      });

      assert.equal(res.status, 201);
      const filename = path.basename(res.body.fileUrl);
      const diskPath = path.join(UPLOAD_DIR, filename);

      // Verify file exists
      assert.ok(await fs.stat(diskPath).then(() => true).catch(() => false));

      // Delete file immediately
      await fs.unlink(diskPath);

      // Verify file is gone
      const existsAfter = await fs.stat(diskPath).then(() => true).catch(() => false);
      assert.equal(existsAfter, false, 'File must be completely unlinked from disk');
    });
  });
});
