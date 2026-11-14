import test, { describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getDataStore } from '../../update/server/repositories/dataStore.ts';
import { SEED_USERS } from '../fixtures/seedData.ts';
import type { SeedUserKey } from '../helpers/testHarness.ts';
import {
  createValidPngBuffer,
  createValidJpegBuffer,
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
    ip?: string;
  } = {}
): Promise<{ status: number; headers: Record<string, any>; body: any; rawBody: string }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;

    const headers: Record<string, string> = { ...options.headers };
    const ip = options.ip || `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    headers['x-forwarded-for'] = ip;

    let payloadBuffer: Buffer | null = null;
    if (options.rawBuffer) {
      payloadBuffer = options.rawBuffer;
      if (options.contentType) {
        headers['content-type'] = options.contentType;
      }
    } else if (options.body !== undefined) {
      const payloadStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      payloadBuffer = Buffer.from(payloadStr, 'utf-8');
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }

    if (payloadBuffer) {
      headers['content-length'] = payloadBuffer.length.toString();
    }

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    const res = new ServerResponse(req);
    let resData = '';

    res.write = function (chunk: any) {
      if (chunk) resData += chunk.toString();
      return true;
    } as any;

    res.end = function (chunk: any) {
      if (chunk) resData += chunk.toString();
      let parsedBody: any = resData;
      try {
        parsedBody = JSON.parse(resData);
      } catch {
        // preserve raw
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
        rawBody: resData
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
    options: {
      body?: any;
      rawBuffer?: Buffer;
      contentType?: string;
      headers?: Record<string, string>;
    } = {}
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

  async delete(path: string, options: any = {}) {
    return this.request('DELETE', path, options);
  }

  async upload(path: string, rawBuffer: Buffer, contentType: string, options: any = {}) {
    return this.request('POST', path, { ...options, rawBuffer, contentType });
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

const SEED_USER_IDS = new Set(SEED_USERS.map(u => u.id));

async function resetTestState(): Promise<void> {
  await getDataStore().expenses.reset();
  await getDataStore().audit.reset();
  const allUsers = getDataStore().users.getAllUsers();
  for (const user of allUsers) {
    if (!SEED_USER_IDS.has(user.id)) {
      await getDataStore().users.delete(user.id);
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../../update/server/uploads/receipts');

async function cleanUploadDir(): Promise<void> {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    for (const f of files) {
      if (f !== '.gitkeep') {
        await fs.unlink(path.join(UPLOAD_DIR, f)).catch(() => {});
      }
    }
  } catch {
    // upload dir might not exist yet
  }
}

describe('Challenger M4-1: In-Depth Empirical Stress Testing of Expense Invariants & State Machine', () => {
  before(async () => {
    await initializeDataStore();
    expressApp = createApp();
    for (const role of ['admin', 'manager', 'employee', 'chioma', 'finance', 'depthead'] as SeedUserKey[]) {
      await createAuthenticatedClient(role);
    }
  });

  beforeEach(async () => {
    await resetTestState();
  });

  after(async () => {
    await resetTestState();
    await cleanUploadDir();
  });

  // =========================================================================
  // VECTOR 1: MULTI-TIER ESCALATION INVARIANTS & THRESHOLD BEHAVIORS
  // =========================================================================
  describe('Vector 1: Multi-Tier Escalation Invariants', () => {
    test('1.1: Report <= 50,000 NGN: Line manager approval transitions directly to APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Team Stationery Order',
        items: [{ categoryId: 'cat-office', merchantName: 'Office World', amount: 48000, receiptUrl: '/uploads/receipts/pens.pdf', description: 'Pens, pads' }]
      });
      assert.equal(rep.status, 201);
      const repId = rep.body.data.id;

      const approveRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.status, 'APPROVED');
      assert.ok(approveRes.body.data.approvedAt);
      assert.equal(approveRes.body.data.currentApproverId, 'emp-finance-01');
    });

    test('1.2: Report 75,000 NGN: Manager approval escalates to PENDING_DEPT_HEAD', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Branch Audit Travel',
        items: [
          {
            categoryId: 'cat-trav',
            merchantName: 'Train Service',
            amount: 75000,
            receiptUrl: '/uploads/receipts/rail.pdf',
            description: 'Tickets'
          }
        ]
      });
      assert.equal(rep.status, 201);
      const repId = rep.body.data.id;

      const mgrApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(mgrApp.status, 200);
      assert.equal(mgrApp.body.data.status, 'PENDING_DEPT_HEAD');
      assert.equal(mgrApp.body.data.currentApproverId, 'emp-depthead-01');
    });

    test('1.3: Report 75,000 NGN: Dept Head approval transitions PENDING_DEPT_HEAD to APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Branch Operations Upgrade',
        items: [{ categoryId: 'cat-ops', merchantName: 'Store', amount: 75000, receiptUrl: '/uploads/receipts/hw.pdf' }]
      });
      const repId = rep.body.data.id;

      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      const deptApp = await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(deptApp.status, 200);
      assert.equal(deptApp.body.data.status, 'APPROVED');
      assert.equal(deptApp.body.data.currentApproverId, 'emp-finance-01');
    });

    test('1.4: Report 300,000 NGN: Escalation path SUBMITTED -> PENDING_DEPT_HEAD -> PENDING_EXEC -> APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');
      const admin = await createAuthenticatedClient('admin');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Advanced Risk Training',
        items: [
          {
            categoryId: 'cat-train',
            merchantName: 'Risk Institute',
            amount: 300000,
            receiptUrl: '/uploads/receipts/train.pdf',
            description: 'Annual certification course'
          }
        ]
      });
      const repId = rep.body.data.id;

      // Tier 1: Line Manager
      const mgrApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(mgrApp.status, 200);
      assert.equal(mgrApp.body.data.status, 'PENDING_DEPT_HEAD');
      assert.equal(mgrApp.body.data.currentApproverId, 'emp-depthead-01');

      // Tier 2: Dept Head
      const deptApp = await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(deptApp.status, 200);
      assert.equal(deptApp.body.data.status, 'PENDING_EXEC');
      assert.equal(deptApp.body.data.currentApproverId, 'emp-admin-01');

      // Tier 3: Admin / Executive
      const adminApp = await admin.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(adminApp.status, 200);
      assert.equal(adminApp.body.data.status, 'APPROVED');
      assert.equal(adminApp.body.data.currentApproverId, 'emp-finance-01');
    });

    test('1.5: Regular employee review returns 403 FORBIDDEN', async () => {
      // Stress-test whether regular employee can approve another employee's claim
      const emp1 = await createAuthenticatedClient('employee');
      const emp2 = await createAuthenticatedClient('chioma');

      const rep = await emp1.post('/api/v1/expenses/reports', {
        title: 'Peer Approval Probe',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 5000 }]
      });
      const repId = rep.body.data.id;

      // Chioma (an EMPLOYEE) attempts to approve Bakare's report
      const peerApprove = await emp2.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(peerApprove.status, 403);
      assert.equal(peerApprove.body.error?.code, 'FORBIDDEN');
    });

    test('1.6: Non-dept-head manager approving report at PENDING_DEPT_HEAD returns 403 FORBIDDEN', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Dept Head Probe',
        items: [{ categoryId: 'cat-ops', merchantName: 'Store', amount: 80000, receiptUrl: '/uploads/receipts/rec.pdf' }]
      });
      const repId = rep.body.data.id;
      // Escalate to PENDING_DEPT_HEAD
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      // Regular line manager (not emp-depthead-01) tries to approve again while in PENDING_DEPT_HEAD
      const mgrSecondApprove = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(mgrSecondApprove.status, 403);
      assert.equal(mgrSecondApprove.body.error?.code, 'FORBIDDEN');
    });

    test('1.7: Non-executive manager approving report at PENDING_EXEC returns 403 FORBIDDEN', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Exec Probe',
        items: [{ categoryId: 'cat-train', merchantName: 'Store', amount: 300000, receiptUrl: '/uploads/receipts/rec.pdf' }]
      });
      const repId = rep.body.data.id;
      // Escalate to PENDING_DEPT_HEAD then PENDING_EXEC
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      // Regular line manager tries to approve while in PENDING_EXEC
      const mgrExecApprove = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(mgrExecApprove.status, 403);
      assert.equal(mgrExecApprove.body.error?.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // VECTOR 2: TERMINAL STATE IMMUTABILITY & PREMATURE DISBURSEMENT GUARDS
  // =========================================================================
  describe('Vector 2: Terminal State Immutability', () => {
    test('2.1: Re-reviewing PAID report returns 409 ALREADY_DECIDED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Paid Claim Test',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, { disbursementReference: 'DISB-001' });

      const reApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(reApp.status, 409);
      assert.equal(reApp.body.error.code, 'ALREADY_DECIDED');

      const reRej = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'REJECT' });
      assert.equal(reRej.status, 409);
      assert.equal(reRej.body.error.code, 'ALREADY_DECIDED');
    });

    test('2.2: Re-reviewing REJECTED report returns 409 ALREADY_DECIDED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Rejected Claim Test',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'REJECT' });

      const reApp = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(reApp.status, 409);
      assert.equal(reApp.body.error.code, 'ALREADY_DECIDED');
    });

    test('2.3: Disbursing an unapproved SUBMITTED report returns 409 NOT_APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Unapproved Claim',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;

      const disb = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'PREMATURE-REF'
      });
      assert.equal(disb.status, 409);
      assert.equal(disb.body.error.code, 'NOT_APPROVED');
    });

    test('2.4: Disbursing an unapproved PENDING_DEPT_HEAD report returns 409 NOT_APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Pending Dept Head Claim',
        items: [{ categoryId: 'cat-ops', merchantName: 'Store', amount: 75000, receiptUrl: '/uploads/receipts/rec.pdf' }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disb = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'PREMATURE-REF-2'
      });
      assert.equal(disb.status, 409);
      assert.equal(disb.body.error.code, 'NOT_APPROVED');
    });

    test('2.5: Disbursing an unapproved PENDING_EXEC report returns 409 NOT_APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const dept = await createAuthenticatedClient('depthead');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Pending Exec Claim',
        items: [{ categoryId: 'cat-train', merchantName: 'Store', amount: 300000, receiptUrl: '/uploads/receipts/rec.pdf' }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await dept.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disb = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'PREMATURE-REF-3'
      });
      assert.equal(disb.status, 409);
      assert.equal(disb.body.error.code, 'NOT_APPROVED');
    });

    test('2.6: Disbursing an already PAID report returns 409 NOT_APPROVED', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Double Disburse Claim',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, { disbursementReference: 'DISB-FIRST' });

      const secondDisb = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'DISB-SECOND'
      });
      assert.equal(secondDisb.status, 409);
      assert.equal(secondDisb.body.error.code, 'NOT_APPROVED');
    });
  });

  // =========================================================================
  // VECTOR 3: AUTHORIZATION & PRIVACY
  // =========================================================================
  describe('Vector 3: Authorization & Privacy', () => {
    test('3.1: Self-approval returns 403 SELF_APPROVAL_PROHIBITED', async () => {
      const mgr = await createAuthenticatedClient('manager');
      const rep = await mgr.post('/api/v1/expenses/reports', {
        title: 'Manager Own Claim',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;

      const appRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });
      assert.equal(appRes.status, 403);
      assert.equal(appRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
    });

    test('3.2: Cross-employee editing returns 403 FORBIDDEN', async () => {
      const emp1 = await createAuthenticatedClient('employee');
      const emp2 = await createAuthenticatedClient('chioma');

      const rep = await emp1.post('/api/v1/expenses/reports', {
        title: 'Bakare Claim',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;

      const editRes = await emp2.put(`/api/v1/expenses/reports/${repId}`, {
        title: 'Chioma Injected Edit'
      });
      assert.equal(editRes.status, 403);
      assert.equal(editRes.body.error.code, 'FORBIDDEN');
    });

    test('3.3: Non-admin disbursement attempt by employee returns 403 FORBIDDEN', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Claim For Disburse',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disbRes = await emp.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'EMP-ILLEGAL'
      });
      assert.equal(disbRes.status, 403);
      assert.equal(disbRes.body.error.code, 'FORBIDDEN');
    });

    test('3.4: Non-admin disbursement attempt by manager returns 403 FORBIDDEN', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Claim For Disburse Mgr',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 4000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disbRes = await mgr.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'MGR-ILLEGAL'
      });
      assert.equal(disbRes.status, 403);
      assert.equal(disbRes.body.error.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // VECTOR 4: BOUNDARIES & ZERO-TRUST INPUTS
  // =========================================================================
  describe('Vector 4: Boundaries & Zero-Trust Inputs', () => {
    test('4.1: Amount <= 0 returns 400 INVALID_AMOUNT', async () => {
      const client = await createAuthenticatedClient('employee');

      const zeroRes = await client.post('/api/v1/expenses/reports', {
        title: 'Zero Amount',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 0 }]
      });
      assert.equal(zeroRes.status, 400);
      assert.equal(zeroRes.body.error.code, 'INVALID_AMOUNT');

      const negRes = await client.post('/api/v1/expenses/reports', {
        title: 'Negative Amount',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: -1000 }]
      });
      assert.equal(negRes.status, 400);
      assert.equal(negRes.body.error.code, 'INVALID_AMOUNT');
    });

    test('4.2: Item > 5,000 NGN without receipt returns 422 RECEIPT_REQUIRED', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Missing Receipt Above 5k',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 5001 }]
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'RECEIPT_REQUIRED');
    });

    test('4.3: Category ceiling exceedance returns 422 CATEGORY_LIMIT_EXCEEDED', async () => {
      const client = await createAuthenticatedClient('employee');
      // cat-telco ceiling is 30,000 NGN
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Exceeding Ceiling',
        items: [{ categoryId: 'cat-telco', merchantName: 'MTN', amount: 35000, receiptUrl: '/uploads/receipts/mtn.pdf' }]
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'CATEGORY_LIMIT_EXCEEDED');
    });

    test('4.4: Unrecognized keys on submit return 400 VALIDATION_ERROR', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Unrecognized Key Test',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 3000 }],
        unrecognizedKey: 'injected_field'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('4.5: Unrecognized keys on item return 400 VALIDATION_ERROR', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.post('/api/v1/expenses/reports', {
        title: 'Unrecognized Item Key Test',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 3000, unknownItemKey: true }]
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('4.6: Unrecognized keys on update return 400 VALIDATION_ERROR', async () => {
      const client = await createAuthenticatedClient('employee');
      const createRes = await client.post('/api/v1/expenses/reports', {
        title: 'Normal Claim',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 3000 }]
      });
      const repId = createRes.body.data.id;

      const editRes = await client.put(`/api/v1/expenses/reports/${repId}`, {
        title: 'Updated Title',
        unknownUpdateKey: 123
      });
      assert.equal(editRes.status, 400);
      assert.equal(editRes.body.error.code, 'VALIDATION_ERROR');
    });

    test('4.7: Unrecognized keys on review action return 400 VALIDATION_ERROR', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Action Strictness',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 3000 }]
      });
      const repId = rep.body.data.id;

      const actRes = await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, {
        action: 'APPROVE',
        unknownActionKey: 'bad'
      });
      assert.equal(actRes.status, 400);
      assert.equal(actRes.body.error.code, 'VALIDATION_ERROR');
    });

    test('4.8: Unrecognized keys on disbursement return 400 VALIDATION_ERROR', async () => {
      const emp = await createAuthenticatedClient('employee');
      const mgr = await createAuthenticatedClient('manager');
      const fin = await createAuthenticatedClient('finance');

      const rep = await emp.post('/api/v1/expenses/reports', {
        title: 'Disburse Strictness',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 3000 }]
      });
      const repId = rep.body.data.id;
      await mgr.patch(`/api/v1/expenses/reports/${repId}/action`, { action: 'APPROVE' });

      const disbRes = await fin.post(`/api/v1/expenses/reports/${repId}/disburse`, {
        disbursementReference: 'REF-VALID',
        unknownDisburseKey: 'bad'
      });
      assert.equal(disbRes.status, 400);
      assert.equal(disbRes.body.error.code, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // VECTOR 5: IDEMPOTENT EXECUTION & CLEAN TEARDOWN
  // =========================================================================
  describe('Vector 5: Idempotent Execution & Clean Teardown', () => {
    test('5.1: Datastore reset leaves zero dirty state in JSON files', async () => {
      const emp = await createAuthenticatedClient('employee');
      await emp.post('/api/v1/expenses/reports', {
        title: 'Teardown Claim 1',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 2000 }]
      });
      await emp.post('/api/v1/expenses/reports', {
        title: 'Teardown Claim 2',
        items: [{ categoryId: 'cat-office', merchantName: 'Store', amount: 3000 }]
      });

      await resetTestState();
      const listRes = await emp.get('/api/v1/expenses/reports?scope=mine');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.length, 0);

      const allRes = await (await createAuthenticatedClient('admin')).get('/api/v1/expenses/reports?scope=all');
      assert.equal(allRes.status, 200);
      assert.equal(allRes.body.data.length, 0);
    });
  });
});
