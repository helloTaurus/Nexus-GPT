import test, { describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import crypto from 'node:crypto';
import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getDataStore } from '../../update/server/repositories/dataStore.ts';
import { SEED_USERS } from '../fixtures/seedData.ts';
import type { SeedUserKey } from '../helpers/testHarness.ts';
import {
  createValidPngBuffer,
  createValidPdfBuffer,
  createDisallowedExeBuffer,
  createDisallowedScriptBuffer,
  createOversizedBuffer
} from '../fixtures/mockFiles.ts';

process.env.DISABLE_RATE_LIMIT = 'true';

let expressApp: any = null;

function invokeExpress(
  app: any,
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    rawBuffer?: Buffer;
    contentType?: string;
  } = {}
): Promise<{ status: number; headers: Record<string, any>; body: any; rawBody: string }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;

    let payload: Buffer | string = '';
    const headers = options.headers || {};
    const ip = `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    headers['x-forwarded-for'] = ip;

    if (options.rawBuffer) {
      payload = options.rawBuffer;
      headers['content-type'] = options.contentType || 'application/octet-stream';
      headers['content-length'] = payload.length.toString();
    } else if (options.body !== undefined) {
      payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
      headers['content-length'] = Buffer.byteLength(payload).toString();
    }

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    const res = new ServerResponse(req);
    let resData: Buffer[] = [];

    res.write = function (chunk: any) {
      if (chunk) {
        resData.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    } as any;

    res.end = function (chunk: any) {
      if (chunk) {
        resData.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const fullBuffer = Buffer.concat(resData);
      const strData = fullBuffer.toString('utf-8');
      let parsedBody: any = strData;
      try {
        parsedBody = JSON.parse(strData);
      } catch {
        parsedBody = fullBuffer;
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
        rawBody: strData
      });
      return res;
    } as any;

    if (payload) {
      req.push(payload);
      req.push(null);
    } else {
      req.push(null);
    }

    app(req, res);
  });
}

class ExpressClient {
  public cookieJar: Map<string, string> = new Map();

  public getCookie(name: string): string | undefined {
    return this.cookieJar.get(name);
  }

  private extractCookies(setCookieHeader?: string | string[]) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const header of headers) {
      const parts = header.split(';')[0].trim();
      const eqIdx = parts.indexOf('=');
      if (eqIdx !== -1) {
        const name = parts.slice(0, eqIdx).trim();
        const val = parts.slice(eqIdx + 1).trim();
        if (val) {
          this.cookieJar.set(name, val);
        } else {
          this.cookieJar.delete(name);
        }
      }
    }
  }

  private buildCookieHeader(): string {
    const pairs: string[] = [];
    for (const [k, v] of this.cookieJar.entries()) {
      pairs.push(`${k}=${v}`);
    }
    return pairs.join('; ');
  }

  async request(
    method: string,
    path: string,
    options: { body?: any; rawBuffer?: Buffer; contentType?: string; headers?: Record<string, string> } = {}
  ) {
    const headers: Record<string, string> = { ...options.headers };
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers['cookie'] = cookieHeader;
    }
    const res = await invokeExpress(expressApp, method, path, {
      headers,
      body: options.body,
      rawBuffer: options.rawBuffer,
      contentType: options.contentType
    });
    if (res.headers['set-cookie']) {
      this.extractCookies(res.headers['set-cookie']);
    }
    return {
      status: res.status,
      headers: new Headers(res.headers as any),
      rawText: res.rawBody,
      body: res.body
    };
  }

  async get(path: string, options: any = {}) {
    return this.request('GET', path, options);
  }

  async post(path: string, body?: any, options: any = {}) {
    return this.request('POST', path, { ...options, body });
  }

  async put(path: string, body?: any, options: any = {}) {
    return this.request('PUT', path, { ...options, body });
  }

  async patch(path: string, body?: any, options: any = {}) {
    return this.request('PATCH', path, { ...options, body });
  }

  async upload(path: string, buffer: Buffer, contentType: string) {
    return this.request('POST', path, { rawBuffer: buffer, contentType });
  }

  async login(email: string, pass: string) {
    this.cookieJar.clear();
    const res = await this.post('/api/v1/auth/login', { email, password: pass });
    return res;
  }
}

const USER_CREDENTIALS: Record<SeedUserKey, { email: string; pass: string }> = {
  admin: { email: 'admin@nexusfinance.ng', pass: 'AdminPassword123!' },
  manager: { email: 'manager@nexusfinance.ng', pass: 'ManagerPassword123!' },
  employee: { email: 'employee@nexusfinance.ng', pass: 'EmployeePassword123!' },
  chioma: { email: 'chioma.okonkwo@nexusfinance.ng', pass: 'ChiomaPassword123!' },
  finance: { email: 'finance@nexusfinance.ng', pass: 'FinancePassword123!' },
  depthead: { email: 'depthead@nexusfinance.ng', pass: 'DeptHeadPassword123!' },
  inactive: { email: 'inactive@nexusfinance.ng', pass: 'InactivePassword123!' }
};

const sessionCookieCache: Partial<Record<SeedUserKey, string>> = {};

async function createAuthenticatedClient(role: SeedUserKey = 'employee'): Promise<ExpressClient> {
  const client = new ExpressClient();
  const cached = sessionCookieCache[role];
  if (cached) {
    client.cookieJar.set('nexus_session', cached);
    return client;
  }
  const creds = USER_CREDENTIALS[role];
  const res = await client.login(creds.email, creds.pass);
  if (res.status !== 200) {
    throw new Error(`Failed to authenticate as ${role}: status ${res.status} - ${JSON.stringify(res.body)}`);
  }
  const sessionToken = client.getCookie('nexus_session');
  if (sessionToken) {
    sessionCookieCache[role] = sessionToken;
  }
  return client;
}

describe('Milestone 4 Adversarial Stress Suite: Expense Reimbursement Suite & Zero-Trust Invariants', () => {
  before(async () => {
    await initializeDataStore();
    expressApp = createApp();
  });

  beforeEach(async () => {
    const store = getDataStore();
    await store.reset();
    for (const k of Object.keys(sessionCookieCache) as SeedUserKey[]) {
      delete sessionCookieCache[k];
    }
  });

  describe('Vector 1: Zero-Trust Zod .strict() Schema Enforcement', () => {
    test('1.1: Rejects payload with unrecognized top-level key (400 VALIDATION_ERROR)', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Valid Title',
        items: [{ categoryId: 'cat-office', amount: 3000, description: 'Pens' }],
        maliciousExtraField: 'exploit_test'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(JSON.stringify(res.body).includes('Unrecognized key'));
    });

    test('1.2: Rejects payload with unrecognized key inside item in items array', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Valid Title',
        items: [
          {
            categoryId: 'cat-office',
            amount: 3000,
            description: 'Paper',
            injectedField: 'hack'
          }
        ]
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(JSON.stringify(res.body).includes('Unrecognized key'));
    });

    test('1.3: Rejects PUT /reports/:id with unrecognized key', async () => {
      const client = await createAuthenticatedClient('employee');
      const createRes = await client.post('/api/v1/expenses/reports', {
        title: 'Original Title',
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      assert.equal(createRes.status, 201);
      const repId = createRes.body.data.id;

      const putRes = await client.put(`/api/v1/expenses/reports/${repId}`, {
        title: 'New Title',
        unauthorizedBonusField: 'illegal'
      });
      assert.equal(putRes.status, 400);
      assert.equal(putRes.body.error.code, 'VALIDATION_ERROR');
    });

    test('1.4: Rejects review action with unrecognized key', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Claim',
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      const repId = rep.body.data.id;

      const actRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, {
        action: 'APPROVE',
        extraFieldPayload: 'not_allowed'
      });
      assert.equal(actRes.status, 400);
      assert.equal(actRes.body.error.code, 'VALIDATION_ERROR');
    });

    test('1.5: Rejects disburse payload with unrecognized key', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Office Claim',
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disbRes = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'REF-12345',
        illegalField: 'tamper'
      });
      assert.equal(disbRes.status, 400);
      assert.equal(disbRes.body.error.code, 'VALIDATION_ERROR');
    });

    test('1.6: Rejects empty items array with 400 VALIDATION_ERROR', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Empty Items Report',
        items: []
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('1.7: Rejects missing title with 400 VALIDATION_ERROR', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('1.8: Rejects malformed date format (non YYYY-MM-DD)', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Bad Date',
        items: [{ categoryId: 'cat-office', amount: 3000, dateIncurred: '12/31/2026' }]
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('Vector 2: Multi-Tier Escalation Hierarchy & State Machine Integrity', () => {
    test('2.1: Tier 1 (<= 50,000 NGN): Line Manager approval transitions directly to APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Low Value Expense',
        items: [{ categoryId: 'cat-office', amount: 45000, receiptUrl: '/uploads/receipts/valid.pdf' }]
      });
      assert.equal(rep.status, 201);
      const repId = rep.body.data.id;

      const appRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(appRes.status, 200);
      assert.equal(appRes.body.data.status, 'APPROVED');
      assert.equal(appRes.body.data.currentApproverId, 'emp-finance-01');
    });

    test('2.2: Tier 2 (> 50,000 NGN, <= 250,000 NGN): Manager escalates to PENDING_DEPT_HEAD', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Mid Value Expense',
        items: [
          {
            categoryId: 'cat-ops',
            amount: 80000,
            receiptUrl: '/uploads/receipts/valid.pdf'
          }
        ]
      });
      assert.equal(rep.status, 201);
      const repId = rep.body.data.id;

      // 1. Manager approves -> PENDING_DEPT_HEAD
      const mgrApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(mgrApp.status, 200);
      assert.equal(mgrApp.body.data.status, 'PENDING_DEPT_HEAD');
      assert.equal(mgrApp.body.data.currentApproverId, 'emp-depthead-01');

      // 2. Dept head approves -> APPROVED
      const deptApp = await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(deptApp.status, 200);
      assert.equal(deptApp.body.data.status, 'APPROVED');
      assert.equal(deptApp.body.data.currentApproverId, 'emp-finance-01');
    });

    test('2.3: Tier 3 (> 250,000 NGN): Manager -> PENDING_DEPT_HEAD -> DeptHead -> PENDING_EXEC -> Admin -> APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');
      const admin = await createAuthenticatedClient('admin');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Executive Level Expense',
        items: [
          {
            categoryId: 'cat-train',
            amount: 300000,
            receiptUrl: '/uploads/receipts/exec-train.pdf'
          }
        ]
      });
      assert.equal(rep.status, 201);
      const repId = rep.body.data.id;
      assert.equal(rep.body.data.totalAmount, 300000);

      // 1. Line Manager approves -> PENDING_DEPT_HEAD
      const mgrApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(mgrApp.status, 200);
      assert.equal(mgrApp.body.data.status, 'PENDING_DEPT_HEAD');

      // 2. Dept Head approves -> PENDING_EXEC
      const deptApp = await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(deptApp.status, 200);
      assert.equal(deptApp.body.data.status, 'PENDING_EXEC');
      assert.equal(deptApp.body.data.currentApproverId, 'emp-admin-01');

      // 3. Admin / Exec approves -> APPROVED
      const adminApp = await admin.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(adminApp.status, 200);
      assert.equal(adminApp.body.data.status, 'APPROVED');
    });

    test('2.4: Premature disbursement on PENDING_DEPT_HEAD returns 409 NOT_APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Mid Claim',
        items: [{ categoryId: 'cat-ops', amount: 80000, receiptUrl: '/uploads/receipts/test.pdf' }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      // Finance tries to disburse while still PENDING_DEPT_HEAD
      const disbRes = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'PREMATURE-01'
      });
      assert.equal(disbRes.status, 409);
      assert.equal(disbRes.body.error.code, 'NOT_APPROVED');
    });

    test('2.5: Premature disbursement on PENDING_EXEC returns 409 NOT_APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'High Claim',
        items: [{ categoryId: 'cat-train', amount: 300000, receiptUrl: '/uploads/receipts/test.pdf' }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      // Finance tries to disburse while still PENDING_EXEC
      const disbRes = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'PREMATURE-02'
      });
      assert.equal(disbRes.status, 409);
      assert.equal(disbRes.body.error.code, 'NOT_APPROVED');
    });
  });

  describe('Vector 3: Terminal State Immutability & Re-decision Rejection', () => {
    test('3.1: Already PAID report rejects re-approval (409 ALREADY_DECIDED)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Terminal Test',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, { disbursementReference: 'DISB-PAID-01' });

      // Attempt to re-approve
      const reApprove = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(reApprove.status, 409);
      assert.equal(reApprove.body.error.code, 'ALREADY_DECIDED');
    });

    test('3.2: Already PAID report rejects rejection (409 ALREADY_DECIDED)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Terminal Test 2',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, { disbursementReference: 'DISB-PAID-02' });

      // Attempt to reject
      const reReject = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'REJECT' });
      assert.equal(reReject.status, 409);
      assert.equal(reReject.body.error.code, 'ALREADY_DECIDED');
    });

    test('3.3: Already REJECTED report rejects re-approval (409 ALREADY_DECIDED)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Rejected Report',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'REJECT' });

      // Attempt to re-approve
      const reApprove = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(reApprove.status, 409);
      assert.equal(reApprove.body.error.code, 'ALREADY_DECIDED');
    });

    test('3.4: Already APPROVED report rejects duplicate approval (409 ALREADY_DECIDED)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Double Approval Test',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const dupApprove = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(dupApprove.status, 409);
      assert.equal(dupApprove.body.error.code, 'ALREADY_DECIDED');
    });

    test('3.5: Cannot edit APPROVED or PAID report via PUT (409 CANNOT_EDIT)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Edit Guard Test',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const editRes = await emp.put(`/api/v1/expenses/reports/${repId}`, {
        title: 'Mutated Title'
      });
      assert.equal(editRes.status, 409);
      assert.equal(editRes.body.error.code, 'CANNOT_EDIT');
    });
  });

  describe('Vector 4: Category Policy & Input Boundary Invariants', () => {
    test('4.1: Expense item with zero amount returns 400 INVALID_AMOUNT', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Zero Claim',
        items: [{ categoryId: 'cat-office', amount: 0 }]
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_AMOUNT');
    });

    test('4.2: Expense item with negative amount returns 400 INVALID_AMOUNT', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Negative Claim',
        items: [{ categoryId: 'cat-office', amount: -2500 }]
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_AMOUNT');
    });

    test('4.3: Missing receipt for item > NGN 5,000 returns 422 RECEIPT_REQUIRED', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Missing Receipt Claim',
        items: [{ categoryId: 'cat-hosp', amount: 15000 }]
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'RECEIPT_REQUIRED');
    });

    test('4.4: Item <= NGN 5,000 without receipt succeeds (201 Created)', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Under Threshold Claim',
        items: [{ categoryId: 'cat-office', amount: 4800 }]
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });

    test('4.5: Single item exceeding category limit returns 422 CATEGORY_LIMIT_EXCEEDED', async () => {
      const client = await createAuthenticatedClient('employee');
      // cat-telco limit is 30,000 NGN
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Excessive Telco',
        items: [{ categoryId: 'cat-telco', amount: 35000, receiptUrl: '/uploads/receipts/rec.pdf' }]
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'CATEGORY_LIMIT_EXCEEDED');
    });

    test('4.6: Unknown categoryId returns 404 CATEGORY_NOT_FOUND', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Bogus Category',
        items: [{ categoryId: 'cat-nonexistent', amount: 2000 }]
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'CATEGORY_NOT_FOUND');
    });
  });

  describe('Vector 5: Authorization, Self-Approval & Privacy Invariants', () => {
    test('5.1: Self-approval prohibition returns 403 SELF_APPROVAL_PROHIBITED', async () => {
      const mgr = await createAuthenticatedClient('manager');
      const rep = await mgr.post('/api/v1/expenses/reports', {
        title: 'Manager Own Claim',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      assert.equal(rep.status, 201);
      const repId = rep.body.data.id;

      const approveRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(approveRes.status, 403);
      assert.equal(approveRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
    });

    test('5.2: Self-rejection prohibition returns 403 SELF_APPROVAL_PROHIBITED', async () => {
      const mgr = await createAuthenticatedClient('manager');
      const rep = await mgr.post('/api/v1/expenses/reports', {
        title: 'Manager Own Claim 2',
        items: [{ categoryId: 'cat-office', amount: 5000 }]
      });
      const repId = rep.body.data.id;

      const rejRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'REJECT' });
      assert.equal(rejRes.status, 403);
      assert.equal(rejRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
    });

    test('5.3: Editing another employee report returns 403 FORBIDDEN', async () => {
      const emp1 = await createAuthenticatedClient('employee');
      const emp2 = await createAuthenticatedClient('chioma');

      const rep = await emp1.post('/api/v1/expenses/reports', {
        title: 'Emp 1 Claim',
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      const repId = rep.body.data.id;

      const editRes = await emp2.put(`/api/v1/expenses/reports/${repId}`, {
        title: 'Hacked Title'
      });
      assert.equal(editRes.status, 403);
      assert.equal(editRes.body.error.code, 'FORBIDDEN');
    });

    test('5.4: Regular employee cannot trigger disbursement (403 FORBIDDEN)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Disburse Test',
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disb = await emp.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'ILLEGAL-01'
      });
      assert.equal(disb.status, 403);
      assert.equal(disb.body.error.code, 'FORBIDDEN');
    });

    test('5.5: Non-admin manager cannot trigger disbursement (403 FORBIDDEN)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Disburse Manager Test',
        items: [{ categoryId: 'cat-office', amount: 3000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disb = await mgr.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'ILLEGAL-02'
      });
      assert.equal(disb.status, 403);
      assert.equal(disb.body.error.code, 'FORBIDDEN');
    });

    test('5.6: Scope=team query blocked for regular employee (403 FORBIDDEN)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const res = await emp.get('/api/v1/expenses/reports?scope=team');
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('5.7: Scope=all query blocked for regular employee and manager (403 FORBIDDEN)', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const resEmp = await emp.get('/api/v1/expenses/reports?scope=all');
      assert.equal(resEmp.status, 403);

      const resMgr = await mgr.get('/api/v1/expenses/reports?scope=all');
      assert.equal(resMgr.status, 403);
    });
  });

  describe('Vector 6: Receipt Document Security & Traversal Neutralization', () => {
    test('6.1: Uploading executable (MZ header) returns 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const client = await createAuthenticatedClient('employee');
      const exeBuffer = createDisallowedExeBuffer();
      const res = await client.upload('/api/v1/expenses/upload-receipt', exeBuffer, 'application/x-msdownload');
      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('6.2: Uploading shell script returns 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const client = await createAuthenticatedClient('employee');
      const scriptBuffer = createDisallowedScriptBuffer();
      const res = await client.upload('/api/v1/expenses/upload-receipt', scriptBuffer, 'text/x-shellscript');
      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    test('6.3: Uploading oversized payload (> 10MB) returns 413 PAYLOAD_TOO_LARGE', async () => {
      const client = await createAuthenticatedClient('employee');
      const hugeBuffer = createOversizedBuffer();
      const res = await client.upload('/api/v1/expenses/upload-receipt', hugeBuffer, 'application/pdf');
      assert.equal(res.status, 413);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
    });

    test('6.4: Uploading valid PNG returns 201, SHA-256 and secure URL', async () => {
      const client = await createAuthenticatedClient('employee');
      const pngBuffer = createValidPngBuffer();
      const res = await client.upload('/api/v1/expenses/upload-receipt', pngBuffer, 'image/png');
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.sha256);
      assert.equal(res.body.mimeType, 'image/png');
      assert.ok(res.body.receiptUrl.endsWith('.png'));
    });

    test('6.5: Directory traversal in receipt download is blocked (403/404)', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.get('/api/v1/expenses/receipts/..%2f..%2fetc%2fpasswd');
      // Express or handler returns 403 or 404
      assert.ok(res.status === 403 || res.status === 404);
    });

    test('6.6: Receipt download returns security headers (nosniff, SAMEORIGIN)', async () => {
      const client = await createAuthenticatedClient('employee');
      const png = createValidPngBuffer();
      const uploadRes = await client.upload('/api/v1/expenses/upload-receipt', png, 'image/png');
      const fileName = uploadRes.body.fileUrl.split('/').pop();

      const dlRes = await client.get(`/api/v1/expenses/receipts/${fileName}`);
      assert.equal(dlRes.status, 200);
      assert.equal(dlRes.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(dlRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    });
  });

  describe('Vector 7: Revision Request & Resubmission Lifecycle', () => {
    test('7.1: Submit -> Revision Requested -> Edit -> Resubmit -> Approve', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      // 1. Submit
      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Initial Title',
        items: [{ categoryId: 'cat-office', amount: 3500, description: 'Folders' }]
      });
      const repId = rep.body.data.id;
      assert.equal(rep.body.data.status, 'SUBMITTED');

      // 2. Request Revision
      const revRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, {
        action: 'REQUEST_REVISION',
        comments: 'Clarify project purpose'
      });
      assert.equal(revRes.status, 200);
      assert.equal(revRes.body.data.status, 'REVISION_REQUESTED');

      // 3. Employee edits and updates
      const editRes = await emp.put(`/api/v1/expenses/reports/${repId}`, {
        title: 'Clarified Title: Project Nexus Phase 2'
      });
      assert.equal(editRes.status, 200);
      assert.equal(editRes.body.data.status, 'SUBMITTED');
      assert.equal(editRes.body.data.title, 'Clarified Title: Project Nexus Phase 2');

      // 4. Line manager approves
      const finalApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, {
        action: 'APPROVE'
      });
      assert.equal(finalApp.status, 200);
      assert.equal(finalApp.body.data.status, 'APPROVED');
    });
  });
});
