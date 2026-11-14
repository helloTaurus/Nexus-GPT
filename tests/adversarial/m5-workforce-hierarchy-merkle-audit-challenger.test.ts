import test, { describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import crypto from 'node:crypto';

import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getDataStore } from '../../update/server/repositories/dataStore.ts';
import { MerkleTree } from '../../update/server/audit/merkleTree.ts';
import type { AuditLogEntry } from '../../update/server/services/auditService.ts';
import { SEED_USERS } from '../fixtures/seedData.ts';
import type { SeedUserKey } from '../helpers/testHarness.ts';

process.env.DISABLE_RATE_LIMIT = 'true';

let expressApp: any = null;

function invokeExpress(
  app: any,
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
    ip?: string;
  } = {}
): Promise<{ status: number; headers: Record<string, any>; body: any; rawBody: string }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;

    const payload = options.body !== undefined ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
    const headers = options.headers || {};
    const ip = options.ip || `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    headers['x-forwarded-for'] = ip;

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }
    if (payload && !req.headers['content-type']) {
      req.headers['content-type'] = 'application/json';
    }
    if (payload) {
      req.headers['content-length'] = Buffer.byteLength(payload).toString();
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
    options: {
      body?: any;
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
      body: options.body
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

async function createAuthenticatedClient(role: SeedUserKey = 'employee'): Promise<ExpressClient> {
  const client = new ExpressClient();
  const creds = USER_CREDENTIALS[role];
  const res = await client.login(creds.email, creds.pass);
  if (res.status !== 200) {
    throw new Error(`Failed to authenticate as ${role}: status ${res.status} - ${JSON.stringify(res.body)}`);
  }
  return client;
}

async function resetTestState(): Promise<void> {
  const store = getDataStore();
  await store.reset();
}

describe('Challenger M5-2: Empirical Stress-Testing of Hierarchy, Super-Admin Protection, Directory & Merkle Audit', () => {
  before(async () => {
    await initializeDataStore();
    expressApp = createApp();
  });

  beforeEach(async () => {
    await resetTestState();
  });

  // =========================================================================
  // Challenge Vector 1: Hierarchy Cycle Prevention & Invariant Verification
  // =========================================================================
  describe('Challenge Vector 1: Hierarchy Cycle Prevention & Invariant Verification', () => {
    test('1.1: Rejects self-reporting (managerId === employee profile.id) with HTTP 422 SELF_REPORTING_PROHIBITED', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.put('/api/v1/employees/emp-manager-01', {
        managerId: 'emp-manager-01'
      });

      assert.equal(res.status, 422, 'Expected HTTP 422 Unprocessable Entity');
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SELF_REPORTING_PROHIBITED');
      assert.match(res.body.error.message, /cannot report to themselves/i);
    });

    test('1.2: Rejects self-reporting when managerId === user.id with HTTP 422 SELF_REPORTING_PROHIBITED', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.put('/api/v1/employees/emp-manager-01', {
        managerId: 'usr-manager-01'
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'SELF_REPORTING_PROHIBITED');
    });

    test('1.3: Rejects self-reporting when managerId === staffId (NX-0105) with HTTP 422 SELF_REPORTING_PROHIBITED', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.put('/api/v1/employees/emp-manager-01', {
        managerId: 'NX-0105'
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'SELF_REPORTING_PROHIBITED');
    });

    test('1.4: Rejects direct 2-node cyclic reporting (A -> B, B -> A) with HTTP 422 CYCLIC_REPORTING_DETECTED', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // emp-employee-01 currently reports to emp-manager-01
      // Attempt setting emp-manager-01's manager to emp-employee-01
      const res = await adminClient.put('/api/v1/employees/emp-manager-01', {
        managerId: 'emp-employee-01'
      });

      assert.equal(res.status, 422, 'Expected HTTP 422 Unprocessable Entity for direct cycle');
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CYCLIC_REPORTING_DETECTED');
      assert.match(res.body.error.message, /circular dependency/i);
    });

    test('1.5: Rejects 3-node cyclic reporting (A -> B -> C, C -> A) with HTTP 422 CYCLIC_REPORTING_DETECTED', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // Chain setup:
      // emp-employee-02 (Chioma) reports to emp-manager-01 (Ibrahim)
      // emp-manager-01 reports to emp-depthead-01 (Soludo)
      const setupRes = await adminClient.put('/api/v1/employees/emp-manager-01', {
        managerId: 'emp-depthead-01'
      });
      assert.equal(setupRes.status, 200);

      // Now attempt assigning emp-depthead-01 to report to emp-employee-02 (Chioma)
      // Cycle: Chioma -> Ibrahim -> Soludo -> Chioma
      const res = await adminClient.put('/api/v1/employees/emp-depthead-01', {
        managerId: 'emp-employee-02'
      });

      assert.equal(res.status, 422, 'Expected HTTP 422 for 3-node cycle');
      assert.equal(res.body.error.code, 'CYCLIC_REPORTING_DETECTED');
      assert.match(res.body.error.message, /circular dependency/i);
    });

    test('1.6: Rejects 4-node extended cyclic reporting (A -> B -> C -> D, D -> A) with HTTP 422 CYCLIC_REPORTING_DETECTED', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // Onboard a new employee D
      const onboardD = await adminClient.post('/api/v1/employees', {
        firstName: 'Daniel',
        lastName: 'Ekanem',
        email: 'daniel.ekanem@nexusfinance.ng',
        departmentId: 'dept-eng',
        designationId: 'des-se',
        managerId: 'emp-employee-01'
      });
      assert.equal(onboardD.status, 201);
      const empDId = onboardD.body.data.id;

      // Onboard new employee E reporting to D
      const onboardE = await adminClient.post('/api/v1/employees', {
        firstName: 'Esther',
        lastName: 'Udoh',
        email: 'esther.udoh@nexusfinance.ng',
        departmentId: 'dept-eng',
        designationId: 'des-se',
        managerId: empDId
      });
      assert.equal(onboardE.status, 201);
      const empEId = onboardE.body.data.id;

      // Chain: empE -> empD -> emp-employee-01 -> emp-manager-01
      // Attempt assigning emp-manager-01 to report to empE
      const res = await adminClient.put('/api/v1/employees/emp-manager-01', {
        managerId: empEId
      });

      assert.equal(res.status, 422, 'Expected HTTP 422 for 4-node cycle');
      assert.equal(res.body.error.code, 'CYCLIC_REPORTING_DETECTED');
    });

    test('1.7: Rejects assignment of an inactive employee as manager with HTTP 422 MANAGER_INACTIVE', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // emp-inactive-01 has status 'INACTIVE'
      const res = await adminClient.put('/api/v1/employees/emp-employee-01', {
        managerId: 'emp-inactive-01'
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'MANAGER_INACTIVE');
      assert.match(res.body.error.message, /inactive/i);
    });

    test('1.8: Rejects assignment of non-existent manager ID with HTTP 404 NOT_FOUND', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.put('/api/v1/employees/emp-employee-01', {
        managerId: 'emp-phantom-999'
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    test('1.9: Allows valid non-cyclic manager reassignment with HTTP 200', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // Reassign Chioma from emp-manager-01 to emp-depthead-01 (valid active manager)
      const res = await adminClient.put('/api/v1/employees/emp-employee-02', {
        managerId: 'emp-depthead-01'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.managerId, 'emp-depthead-01');
    });

    test('1.10: Allows unsetting manager (managerId: null) with HTTP 200', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.put('/api/v1/employees/emp-employee-02', {
        managerId: null
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.managerId, null);
    });

    test('1.11: GET /api/v1/employees/hierarchy produces recursive valid OrgChartNode tree without infinite loop', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.get('/api/v1/employees/hierarchy');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Expected hierarchy array');
      assert.ok(res.body.data.length > 0, 'Expected root nodes');

      function assertTreeValid(node: any, seen: Set<string>) {
        assert.ok(!seen.has(node.id), `Cycle encountered in hierarchy output at ${node.id}`);
        seen.add(node.id);
        assert.ok(node.firstName);
        assert.ok(node.lastName);
        assert.ok(node.staffId);
        assert.ok(Array.isArray(node.subordinates));
        assert.equal(node.directReportsCount, node.subordinates.length);
        for (const sub of node.subordinates) {
          assertTreeValid(sub, new Set(seen));
        }
      }

      for (const root of res.body.data) {
        assertTreeValid(root, new Set());
      }
    });
  });

  // =========================================================================
  // Challenge Vector 2: Super-Admin Protection Invariants
  // =========================================================================
  describe('Challenge Vector 2: Super-Admin Protection Invariants', () => {
    test('2.1: Allows demoting an ADMIN when multiple active ADMINs exist', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // In seed, usr-finance-01 and usr-admin-01 are both ADMINs
      const res = await adminClient.put('/api/v1/employees/emp-finance-01', {
        role: 'MANAGER'
      });

      assert.equal(res.status, 200, 'Expected demotion of secondary admin to succeed');
      assert.equal(res.body.data.id, 'emp-finance-01');
    });

    test('2.2: Blocks demoting the sole remaining active ADMIN (usr-admin-01) with HTTP 403 CANNOT_DEMOTE_LAST_ADMIN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // Demote usr-finance-01 first so usr-admin-01 is the sole remaining active ADMIN
      const demoteFinance = await adminClient.put('/api/v1/employees/emp-finance-01', {
        role: 'MANAGER'
      });
      assert.equal(demoteFinance.status, 200);

      // Now attempt demoting usr-admin-01 to EMPLOYEE
      const demoteAdminEmp = await adminClient.put('/api/v1/employees/emp-admin-01', {
        role: 'EMPLOYEE'
      });

      assert.equal(demoteAdminEmp.status, 403, 'Expected 403 Forbidden when demoting sole active admin');
      assert.equal(demoteAdminEmp.body.success, false);
      assert.equal(demoteAdminEmp.body.error.code, 'CANNOT_DEMOTE_LAST_ADMIN');
      assert.match(demoteAdminEmp.body.error.message, /sole remaining system administrator/i);

      // Also attempt demoting usr-admin-01 to MANAGER
      const demoteAdminMgr = await adminClient.put('/api/v1/employees/emp-admin-01', {
        role: 'MANAGER'
      });
      assert.equal(demoteAdminMgr.status, 403);
      assert.equal(demoteAdminMgr.body.error.code, 'CANNOT_DEMOTE_LAST_ADMIN');
    });

    test('2.3: Blocks deactivating (status: INACTIVE) the sole remaining active ADMIN with HTTP 403 CANNOT_DEMOTE_LAST_ADMIN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      // Demote secondary admin
      await adminClient.put('/api/v1/employees/emp-finance-01', { role: 'MANAGER' });

      // Attempt deactivating sole remaining admin
      const res = await adminClient.put('/api/v1/employees/emp-admin-01', {
        status: 'INACTIVE'
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'CANNOT_DEMOTE_LAST_ADMIN');
    });

    test('2.4: Blocks terminating (status: TERMINATED) the sole remaining active ADMIN with HTTP 403 CANNOT_DEMOTE_LAST_ADMIN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.put('/api/v1/employees/emp-finance-01', { role: 'MANAGER' });

      const res = await adminClient.put('/api/v1/employees/emp-admin-01', {
        status: 'TERMINATED'
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'CANNOT_DEMOTE_LAST_ADMIN');
    });

    test('2.5: Blocks locking (status: LOCKED) the sole remaining active ADMIN with HTTP 403 CANNOT_DEMOTE_LAST_ADMIN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.put('/api/v1/employees/emp-finance-01', { role: 'MANAGER' });

      const res = await adminClient.put('/api/v1/employees/emp-admin-01', {
        status: 'LOCKED'
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'CANNOT_DEMOTE_LAST_ADMIN');
    });

    test('2.6: Permits updating non-privilege metadata (phone, address, names) on the sole active ADMIN with HTTP 200', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.put('/api/v1/employees/emp-finance-01', { role: 'MANAGER' });

      const res = await adminClient.put('/api/v1/employees/emp-admin-01', {
        phone: '+2348099998888',
        residentialAddress: 'Aso Rock Presidential Villa, Abuja'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.phone, '+2348099998888');
      assert.equal(res.body.data.residentialAddress, 'Aso Rock Presidential Villa, Abuja');
    });

    test('2.7: Allows role/status changes on former sole admin after onboarding a second active ADMIN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.put('/api/v1/employees/emp-finance-01', { role: 'MANAGER' });

      // Onboard a new active ADMIN
      const onboardRes = await adminClient.post('/api/v1/employees', {
        firstName: 'Kafayat',
        lastName: 'Oladipo',
        email: 'kafayat.admin@nexusfinance.ng',
        role: 'ADMIN',
        departmentId: 'dept-exec',
        designationId: 'des-md'
      });
      assert.equal(onboardRes.status, 201);

      // Now 2 active admins exist again. Demoting usr-admin-01 must succeed!
      const res = await adminClient.put('/api/v1/employees/emp-admin-01', {
        role: 'MANAGER'
      });

      assert.equal(res.status, 200);
    });
  });

  // =========================================================================
  // Challenge Vector 3: Workforce Directory Boundary & Input Robustness
  // =========================================================================
  describe('Challenge Vector 3: Workforce Directory Boundary & Input Robustness', () => {
    test('3.1: Handles page=0 and negative limit gracefully by falling back to safe defaults', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.get('/api/v1/employees?page=0&limit=-5');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.pagination.page, 1, 'Page 0 should fall back to page 1');
      assert.ok(res.body.pagination.limit >= 1, 'Negative limit should fall back to default limit >= 1');
      assert.ok(Array.isArray(res.body.data));
    });

    test('3.2: Handles extreme pagination offset (page=99999) by returning empty array with valid metadata', async () => {
      const client = await createAuthenticatedClient('employee');
      const res = await client.get('/api/v1/employees?page=99999&limit=10');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.page, 99999);
      assert.ok(res.body.pagination.total > 0);
    });

    test('3.3: Resists XSS injection payloads in directory search query parameter', async () => {
      const client = await createAuthenticatedClient('employee');
      const xssPayload = encodeURIComponent("<script>alert('XSS')</script><img src=x onerror=alert(1)>");
      const res = await client.get(`/api/v1/employees?search=${xssPayload}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('3.4: Resists SQL injection patterns in directory search query parameter', async () => {
      const client = await createAuthenticatedClient('employee');
      const sqliPayload = encodeURIComponent("' UNION SELECT * FROM users WHERE '1'='1 --");
      const res = await client.get(`/api/v1/employees?search=${sqliPayload}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('3.5: Enforces exact 10-digit NUBAN on onboarding: rejects 9 digits with HTTP 422 INVALID_NUBAN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/employees', {
        firstName: 'Test',
        lastName: 'Nuban',
        email: 'test.nuban9@nexusfinance.ng',
        departmentId: 'dept-eng',
        designationId: 'des-se',
        bankAccountNumber: '123456789' // 9 digits
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'INVALID_NUBAN');
      assert.match(res.body.error.message, /10 digits/i);
    });

    test('3.6: Enforces exact 10-digit NUBAN on onboarding: rejects 11 digits with HTTP 422 INVALID_NUBAN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/employees', {
        firstName: 'Test',
        lastName: 'Nuban',
        email: 'test.nuban11@nexusfinance.ng',
        departmentId: 'dept-eng',
        designationId: 'des-se',
        bankAccountNumber: '12345678901' // 11 digits
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'INVALID_NUBAN');
    });

    test('3.7: Enforces exact 10-digit NUBAN on onboarding: rejects alphanumeric strings with HTTP 422 INVALID_NUBAN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/employees', {
        firstName: 'Test',
        lastName: 'Nuban',
        email: 'test.nubanalpha@nexusfinance.ng',
        departmentId: 'dept-eng',
        designationId: 'des-se',
        bankAccountNumber: '12345ABCDE' // 10 chars, but alphanumeric
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'INVALID_NUBAN');
    });

    test('3.8: Enforces exact 10-digit NUBAN on employee profile update with HTTP 422 INVALID_NUBAN', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.put('/api/v1/employees/emp-employee-01', {
        bankAccountNumber: '000111' // 6 digits
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'INVALID_NUBAN');
    });

    test('3.9: Accepts valid 10-digit NUBAN string on onboarding and profile update with HTTP 200/201', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const onboardRes = await adminClient.post('/api/v1/employees', {
        firstName: 'Valid',
        lastName: 'Nuban',
        email: 'valid.nuban@nexusfinance.ng',
        departmentId: 'dept-eng',
        designationId: 'des-se',
        bankAccountNumber: '0123456789'
      });
      assert.equal(onboardRes.status, 201);
      assert.equal(onboardRes.body.data.bankAccountNumber, '0123456789');

      const updateRes = await adminClient.put('/api/v1/employees/emp-employee-01', {
        bankAccountNumber: '9876543210'
      });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.bankAccountNumber, '9876543210');
    });
  });

  // =========================================================================
  // Challenge Vector 4: Merkle Audit Integrity & Cryptographic Tamper Detection
  // =========================================================================
  describe('Challenge Vector 4: Merkle Audit Integrity & Cryptographic Tamper Detection', () => {
    test('4.1: GET /api/v1/admin/audit-logs/verify returns valid: true on intact ledger', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.get('/api/v1/admin/audit-logs/verify');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.valid, true);
      assert.equal(res.body.data.compromisedId, undefined);
      assert.ok(typeof res.body.data.merkleRoot === 'string');
      assert.equal(res.body.data.merkleRoot.length, 64, 'SHA-256 Merkle root must be 64 hex characters');
      assert.ok(res.body.data.totalChecked >= 0);
    });

    test('4.2: Tamper simulation: altering historic block hash in audit log causes verify to return valid: false and identifies compromisedId', async () => {
      const adminClient = await createAuthenticatedClient('admin');

      // Record several operations to build an audit trail
      await adminClient.put('/api/v1/employees/emp-employee-01', { phone: '+2348011112222' });
      await adminClient.put('/api/v1/employees/emp-employee-02', { phone: '+2348022223333' });

      // Check intact state first
      const beforeRes = await adminClient.get('/api/v1/admin/audit-logs/verify');
      assert.equal(beforeRes.body.data.valid, true);
      const initialRoot = beforeRes.body.data.merkleRoot;

      // Tamper: simulate forensic database alteration on an in-memory audit log entry
      const auditService = getDataStore().audit;
      const logs = auditService.getAll();
      assert.ok(logs.length >= 2, 'Expected multiple audit log records');

      const targetEntry = logs[logs.length - 1]; // Tamper earliest entry
      const originalHash = targetEntry.hash;
      targetEntry.hash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      // Verify endpoint now detects the compromise
      const tamperedRes = await adminClient.get('/api/v1/admin/audit-logs/verify');
      assert.equal(tamperedRes.status, 200);
      assert.equal(tamperedRes.body.data.valid, false, 'Tampered ledger must return valid: false');
      assert.equal(tamperedRes.body.data.compromisedId, targetEntry.id);
      assert.notEqual(tamperedRes.body.data.merkleRoot, initialRoot, 'Tampered Merkle root must differ');
    });

    test('4.3: Tamper simulation: altering stateDiff payload changes leaf hash and invalidates hash chain integrity', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.put('/api/v1/employees/emp-employee-01', { phone: '+2348033334444' });

      const auditService = getDataStore().audit;
      const logs = auditService.getAll();
      const targetEntry = logs[0];

      // Mutate stateDiff directly
      targetEntry.stateDiff = { maliciousPayload: 'UNAUTHORIZED_ADMIN_GRANT' };

      const verifyRes = await adminClient.get('/api/v1/admin/audit-logs/verify');
      assert.equal(verifyRes.body.data.valid, false, 'Payload alteration must fail integrity verification');
      assert.equal(verifyRes.body.data.compromisedId, targetEntry.id);
    });

    test('4.4: MerkleTree class: empty record list returns standard zero-hash root', () => {
      const tree = new MerkleTree([]);
      assert.equal(tree.getRoot(), '0000000000000000000000000000000000000000000000000000000000000000');
    });

    test('4.5: MerkleTree class: single leaf tree correctly computes root and valid proof', () => {
      const dummyEntry: AuditLogEntry = {
        id: 'aud-001',
        actorId: 'usr-admin-01',
        action: 'TEST',
        entityType: 'Test',
        entityId: 't1',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
        stateDiff: {},
        metadataDiff: {},
        hash: 'abc123hash',
        previousHash: '0000'
      };

      const tree = new MerkleTree([dummyEntry]);
      const root = tree.getRoot();
      const expectedLeaf = crypto.createHash('sha256').update(dummyEntry.hash, 'utf-8').digest('hex');
      assert.equal(root, expectedLeaf);

      const proof = tree.getProof(0);
      assert.equal(proof.length, 0); // single leaf has 0 steps
      const verified = MerkleTree.verifyProof(expectedLeaf, proof, root);
      assert.equal(verified, true);
    });

    test('4.6: MerkleTree class: 2-leaf balanced tree computes root and valid proofs', () => {
      const makeEntry = (id: string, hash: string): AuditLogEntry => ({
        id,
        actorId: 'usr-1',
        action: 'ACT',
        entityType: 'ENT',
        entityId: id,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
        stateDiff: {},
        metadataDiff: {},
        hash,
        previousHash: '00'
      });

      const e1 = makeEntry('1', 'hash-one');
      const e2 = makeEntry('2', 'hash-two');

      const tree = new MerkleTree([e1, e2]);
      const root = tree.getRoot();

      const leaf1 = crypto.createHash('sha256').update(e1.hash, 'utf-8').digest('hex');
      const leaf2 = crypto.createHash('sha256').update(e2.hash, 'utf-8').digest('hex');
      const expectedRoot = crypto.createHash('sha256').update(leaf1 + leaf2, 'utf-8').digest('hex');

      assert.equal(root, expectedRoot);

      // Verify proof for leaf 0
      const proof0 = tree.getProof(0);
      assert.equal(proof0.length, 1);
      assert.equal(proof0[0].position, 'right');
      assert.equal(proof0[0].hash, leaf2);
      assert.equal(MerkleTree.verifyProof(leaf1, proof0, root), true);

      // Verify proof for leaf 1
      const proof1 = tree.getProof(1);
      assert.equal(proof1.length, 1);
      assert.equal(proof1[0].position, 'left');
      assert.equal(proof1[0].hash, leaf1);
      assert.equal(MerkleTree.verifyProof(leaf2, proof1, root), true);
    });

    test('4.7: MerkleTree class: 3-leaf odd-sized tree duplicates odd leaf and verifies proofs for all leaves', () => {
      const makeEntry = (id: string): AuditLogEntry => ({
        id,
        actorId: 'usr-1',
        action: 'ACT',
        entityType: 'ENT',
        entityId: id,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
        stateDiff: {},
        metadataDiff: {},
        hash: `hash-${id}`,
        previousHash: '00'
      });

      const records = [makeEntry('1'), makeEntry('2'), makeEntry('3')];
      const tree = new MerkleTree(records);
      const root = tree.getRoot();

      for (let i = 0; i < records.length; i++) {
        const leafHash = crypto.createHash('sha256').update(records[i].hash, 'utf-8').digest('hex');
        const proof = tree.getProof(i);
        const valid = MerkleTree.verifyProof(leafHash, proof, root);
        assert.equal(valid, true, `Proof verification failed for leaf index ${i} in 3-leaf tree`);
      }
    });

    test('4.8: MerkleTree class: verifies proofs across odd and even tree sizes (4, 5, 7, 8, 16 leaves)', () => {
      const sizes = [4, 5, 7, 8, 16];

      for (const size of sizes) {
        const records: AuditLogEntry[] = Array.from({ length: size }, (_, i) => ({
          id: `aud-${i}`,
          actorId: `usr-${i}`,
          action: 'LOG',
          entityType: 'Record',
          entityId: `rec-${i}`,
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          timestamp: new Date().toISOString(),
          stateDiff: {},
          metadataDiff: {},
          hash: `leaf-hash-${i}-${crypto.randomUUID()}`,
          previousHash: '00'
        }));

        const tree = new MerkleTree(records);
        const root = tree.getRoot();
        assert.equal(root.length, 64);

        for (let i = 0; i < size; i++) {
          const leafHash = crypto.createHash('sha256').update(records[i].hash, 'utf-8').digest('hex');
          const proof = tree.getProof(i);
          const valid = MerkleTree.verifyProof(leafHash, proof, root);
          assert.equal(valid, true, `Proof failed for leaf ${i} of size ${size}`);
        }
      }
    });

    test('4.9: MerkleTree class: verifyProof returns false if leaf hash is modified', () => {
      const records: AuditLogEntry[] = Array.from({ length: 4 }, (_, i) => ({
        id: `aud-${i}`,
        actorId: `usr-${i}`,
        action: 'LOG',
        entityType: 'Record',
        entityId: `rec-${i}`,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
        stateDiff: {},
        metadataDiff: {},
        hash: `leaf-hash-${i}`,
        previousHash: '00'
      }));

      const tree = new MerkleTree(records);
      const root = tree.getRoot();
      const proof = tree.getProof(1);

      const corruptedLeafHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const valid = MerkleTree.verifyProof(corruptedLeafHash, proof, root);
      assert.equal(valid, false, 'Corrupted leaf hash must fail verification');
    });

    test('4.10: MerkleTree class: verifyProof returns false if proof step is corrupted', () => {
      const records: AuditLogEntry[] = Array.from({ length: 4 }, (_, i) => ({
        id: `aud-${i}`,
        actorId: `usr-${i}`,
        action: 'LOG',
        entityType: 'Record',
        entityId: `rec-${i}`,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
        stateDiff: {},
        metadataDiff: {},
        hash: `leaf-hash-${i}`,
        previousHash: '00'
      }));

      const tree = new MerkleTree(records);
      const root = tree.getRoot();
      const proof = tree.getProof(0);
      const originalLeaf = crypto.createHash('sha256').update(records[0].hash, 'utf-8').digest('hex');

      // Corrupt the proof step hash
      proof[0].hash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      const valid = MerkleTree.verifyProof(originalLeaf, proof, root);
      assert.equal(valid, false, 'Corrupted proof step must fail verification');
    });

    test('4.11: MerkleTree class: verifyProof returns false if root hash does not match', () => {
      const records: AuditLogEntry[] = Array.from({ length: 4 }, (_, i) => ({
        id: `aud-${i}`,
        actorId: `usr-${i}`,
        action: 'LOG',
        entityType: 'Record',
        entityId: `rec-${i}`,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        timestamp: new Date().toISOString(),
        stateDiff: {},
        metadataDiff: {},
        hash: `leaf-hash-${i}`,
        previousHash: '00'
      }));

      const tree = new MerkleTree(records);
      const originalLeaf = crypto.createHash('sha256').update(records[0].hash, 'utf-8').digest('hex');
      const proof = tree.getProof(0);

      const fakeRoot = 'badc0ffeedeadbeefbadc0ffeedeadbeefbadc0ffeedeadbeefbadc0ffeedead';
      const valid = MerkleTree.verifyProof(originalLeaf, proof, fakeRoot);
      assert.equal(valid, false, 'Invalid root must fail verification');
    });
  });
});
