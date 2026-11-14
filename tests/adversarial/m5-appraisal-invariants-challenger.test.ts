import test, { describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getDataStore } from '../../update/server/repositories/dataStore.ts';
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
  await getDataStore().appraisals.reset();
  await getDataStore().audit.reset();
  const allUsers = getDataStore().users.getAllUsers();
  for (const user of allUsers) {
    if (!SEED_USER_IDS.has(user.id)) {
      await getDataStore().users.delete(user.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Adversarial Challenger Suite: Milestone 5 Appraisal Invariants & Edge Cases
// ---------------------------------------------------------------------------

describe('Challenger M5-1: Comprehensive Empirical Stress Testing of Appraisal Invariants', () => {

  before(async () => {
    await initializeDataStore();
    expressApp = createApp();
    for (const role of ['admin', 'manager', 'employee', 'chioma', 'depthead'] as SeedUserKey[]) {
      await createAuthenticatedClient(role);
    }
  });

  beforeEach(async () => {
    await resetTestState();
  });

  after(async () => {
    await resetTestState();
  });

  // =========================================================================
  // VECTOR 1: RUBRIC BOUNDARIES & INPUT SANITIZATION
  // =========================================================================
  describe('Vector 1: Rubric Boundaries (1.00 - 5.00 Rating Scale)', () => {

    test('1.1: Self-appraisal: Lower boundary violations (< 1.00) return 422 INVALID_RATING', async () => {
      const client = await createAuthenticatedClient('employee');
      const form = await client.get('/api/v1/appraisals/submissions/me');
      const subId = form.body.data.id;

      const invalidRatings = [0.99, 0.5, 0.0, -0.01, -1.0, -100, -99999];
      for (const badRating of invalidRatings) {
        const res = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
          goals: [
            { goalId: 'goal-1', selfRating: badRating },
            { goalId: 'goal-2', selfRating: 3.0 }
          ]
        });
        assert.equal(res.status, 422, `Expected 422 for selfRating=${badRating}, got ${res.status}`);
        assert.equal(res.body.error.code, 'INVALID_RATING');
        assert.ok(res.body.error.message.includes('between 1.00 and 5.00'));
      }
    });

    test('1.2: Self-appraisal: Upper boundary violations (> 5.00) return 422 INVALID_RATING', async () => {
      const client = await createAuthenticatedClient('employee');
      const form = await client.get('/api/v1/appraisals/submissions/me');
      const subId = form.body.data.id;

      const invalidRatings = [5.01, 5.0001, 5.5, 6.0, 10.0, 100.0, 99999];
      for (const badRating of invalidRatings) {
        const res = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
          goals: [
            { goalId: 'goal-1', selfRating: badRating },
            { goalId: 'goal-2', selfRating: 3.0 }
          ]
        });
        assert.equal(res.status, 422, `Expected 422 for selfRating=${badRating}, got ${res.status}`);
        assert.equal(res.body.error.code, 'INVALID_RATING');
      }
    });

    test('1.3: Self-appraisal: Exact boundary limits (1.00 and 5.00) succeed with 200', async () => {
      const client = await createAuthenticatedClient('employee');
      const form = await client.get('/api/v1/appraisals/submissions/me');
      const subId = form.body.data.id;

      const resMin = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
        goals: [
          { goalId: 'goal-1', selfRating: 1.0 },
          { goalId: 'goal-2', selfRating: 1.0 }
        ]
      });
      assert.equal(resMin.status, 200);
      assert.equal(resMin.body.data.selfScore, 1.0);

      await resetTestState();

      const resMax = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
        goals: [
          { goalId: 'goal-1', selfRating: 5.0 },
          { goalId: 'goal-2', selfRating: 5.0 }
        ]
      });
      assert.equal(resMax.status, 200);
      assert.equal(resMax.body.data.selfScore, 5.0);
    });

    test('1.4: Manager Review: Goal rating boundary violations (< 1.00 or > 5.00) return 422', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });

      const mgrClient = await createAuthenticatedClient('manager');

      const badRatings = [0.0, 0.999, -5.0, 5.001, 7.5, 100];
      for (const badRating of badRatings) {
        const res = await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
          goals: [
            { goalId: 'goal-1', managerRating: badRating },
            { goalId: 'goal-2', managerRating: 4.0 }
          ],
          competencyScore: 4.0
        });
        assert.equal(res.status, 422, `Expected 422 for managerRating=${badRating}, got ${res.status}`);
        assert.equal(res.body.error.code, 'INVALID_RATING');
      }
    });

    test('1.5: Manager Review: Competency score boundary violations (< 1.00 or > 5.00) return 422', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });

      const mgrClient = await createAuthenticatedClient('manager');

      const badScores = [0.99, 0.0, -1.0, 5.01, 6.0, 50.0];
      for (const badScore of badScores) {
        const res = await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
          goals: [
            { goalId: 'goal-1', managerRating: 4.0 },
            { goalId: 'goal-2', managerRating: 4.0 }
          ],
          competencyScore: badScore
        });
        assert.equal(res.status, 422, `Expected 422 for competencyScore=${badScore}, got ${res.status}`);
        assert.equal(res.body.error.code, 'INVALID_RATING');
      }
    });

    test('1.6: Calibration: Out-of-bounds final score (< 1.00 or > 5.00) returns 422', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      const mgrClient = await createAuthenticatedClient('manager');
      await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
      });

      const adminClient = await createAuthenticatedClient('admin');
      const badScores = [0.99, 0.0, -2.5, 5.001, 5.5, 10.0];
      for (const badScore of badScores) {
        const res = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
          finalCalibratedScore: badScore
        });
        assert.equal(res.status, 422, `Expected 422 for calibrate=${badScore}, got ${res.status}`);
        assert.equal(res.body.error.code, 'INVALID_RATING');
      }
    });

    test('1.7: Zero-trust schema validation: Unrecognized keys or bad types return 400 VALIDATION_ERROR', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const res = await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 'not-a-number' }],
        extraMaliciousField: 'payload-injection'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // VECTOR 2: WEIGHT INVARIANTS (100% SUM CONSTRAINTS)
  // =========================================================================
  describe('Vector 2: Weight Invariants (Cycle Provisioning & Goal Weightages)', () => {

    test('2.1: Cycle creation: Under-allocated weightages (sum < 100%) return 422 INVALID_WEIGHTAGES', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const imbalancedPairs = [
        { kra: 70, comp: 20 },  // 90%
        { kra: 50, comp: 40 },  // 90%
        { kra: 0, comp: 0 },    // 0%
        { kra: 30, comp: 30 }   // 60%
      ];

      for (const pair of imbalancedPairs) {
        const res = await adminClient.post('/api/v1/appraisals/cycles', {
          title: `Imbalanced Cycle ${pair.kra}-${pair.comp}`,
          fiscalYear: 2026,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          kraWeightagePercent: pair.kra,
          competencyWeightagePercent: pair.comp
        });
        assert.equal(res.status, 422, `Expected 422 for kra=${pair.kra}, comp=${pair.comp}`);
        assert.equal(res.body.error.code, 'INVALID_WEIGHTAGES');
        assert.ok(res.body.error.message.includes('100%'));
      }
    });

    test('2.2: Cycle creation: Over-allocated weightages (sum > 100%) return 422 INVALID_WEIGHTAGES', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const overPairs = [
        { kra: 60, comp: 50 },  // 110%
        { kra: 70, comp: 40 },  // 110%
        { kra: 80, comp: 30 },  // 110%
        { kra: 100, comp: 10 }  // 110%
      ];

      for (const pair of overPairs) {
        const res = await adminClient.post('/api/v1/appraisals/cycles', {
          title: `Over-allocated Cycle ${pair.kra}-${pair.comp}`,
          fiscalYear: 2026,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          kraWeightagePercent: pair.kra,
          competencyWeightagePercent: pair.comp
        });
        assert.equal(res.status, 422, `Expected 422 for kra=${pair.kra}, comp=${pair.comp}`);
        assert.equal(res.body.error.code, 'INVALID_WEIGHTAGES');
      }
    });

    test('2.3: Cycle creation: Floating-point weightages totaling exactly 100% succeed', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/appraisals/cycles', {
        title: 'Precision Float Cycle 70.5 + 29.5',
        fiscalYear: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        kraWeightagePercent: 70.5,
        competencyWeightagePercent: 29.5
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });

    test('2.4: Cycle creation: Negative weights rejected by schema with 400', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/appraisals/cycles', {
        title: 'Negative Weight Cycle',
        fiscalYear: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        kraWeightagePercent: -10,
        competencyWeightagePercent: 110
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('2.5: Cycle creation: Single weightage provisioned (e.g. kra=80, comp omitted) must enforce 100% sum invariant (422)', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/appraisals/cycles', {
        title: 'Single Weight Bypass Cycle',
        fiscalYear: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        kraWeightagePercent: 80
      });
      assert.equal(res.status, 422, `Expected 422 INVALID_WEIGHTAGES for single weightage kra=80 without comp, got ${res.status}`);
      assert.equal(res.body.error.code, 'INVALID_WEIGHTAGES');
    });
  });

  // =========================================================================
  // VECTOR 3: STATE MACHINE INVARIANTS & LIFECYCLE TRANSITIONS
  // =========================================================================
  describe('Vector 3: State Machine Invariants & Lifecycle Transitions', () => {

    test('3.1: Premature calibration at NOT_STARTED status returns 409 INVALID_STATE', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.0
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATE');
      assert.ok(res.body.error.message.includes('before manager review'));
    });

    test('3.2: Premature calibration at SELF_SUBMITTED status returns 409 INVALID_STATE', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });

      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.0
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });

    test('3.3: Post-completion calibration attempt returns 409 INVALID_STATE', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      const mgrClient = await createAuthenticatedClient('manager');
      await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
      });
      const adminClient = await createAuthenticatedClient('admin');
      const calRes1 = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.5
      });
      assert.equal(calRes1.status, 200);
      assert.equal(calRes1.body.data.status, 'COMPLETED');

      // Attempt second calibration on already COMPLETED submission
      const calRes2 = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.8
      });
      assert.equal(calRes2.status, 409, `Expected 409 on re-calibration of COMPLETED appraisal, got ${calRes2.status}`);
      assert.equal(calRes2.body.error.code, 'INVALID_STATE');
    });

    test('3.4: Re-submitting self-appraisal when already SELF_SUBMITTED returns 409 INVALID_STATE (DISPATCH Vector 3)', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const firstRes = await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      assert.equal(firstRes.status, 200);

      // Attempt second self-submission
      const secondRes = await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 5.0 }, { goalId: 'goal-2', selfRating: 5.0 }]
      });
      assert.equal(secondRes.status, 409, `Expected 409 on re-submitting already submitted appraisal, got ${secondRes.status}`);
      assert.equal(secondRes.body.error.code, 'INVALID_STATE');
    });

    test('3.5: Re-submitting self-appraisal when already COMPLETED returns 409 INVALID_STATE', async () => {
      // Advance to COMPLETED
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      const mgrClient = await createAuthenticatedClient('manager');
      await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
      });
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.5
      });

      // Employee tries to re-submit self appraisal on COMPLETED review
      const res = await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 2.0 }, { goalId: 'goal-2', selfRating: 2.0 }]
      });
      assert.equal(res.status, 409, `Expected 409 on self-submission against COMPLETED appraisal, got ${res.status}`);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });

    test('3.6: Manager review on already COMPLETED appraisal returns 409 INVALID_STATE', async () => {
      // Advance to COMPLETED
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      const mgrClient = await createAuthenticatedClient('manager');
      await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
      });
      const adminClient = await createAuthenticatedClient('admin');
      await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.5
      });

      // Manager tries to re-review COMPLETED submission
      const res = await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 2.0 }, { goalId: 'goal-2', managerRating: 2.0 }]
      });
      assert.equal(res.status, 409, `Expected 409 on manager review against COMPLETED appraisal, got ${res.status}`);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });

    test('3.7: Premature outcome acknowledgment prior to calibration completion returns 409 INVALID_STATE', async () => {
      // Sub-emp-01-2026 is in NOT_STARTED state
      const empClient = await createAuthenticatedClient('employee');
      const res = await empClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/acknowledge');
      assert.equal(res.status, 409, `Expected 409 on premature outcome acknowledgment, got ${res.status}`);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });
  });

  // =========================================================================
  // VECTOR 4: AUTHORIZATION, RBAC & PRIVACY BOUNDARIES
  // =========================================================================
  describe('Vector 4: Authorization & Privacy Boundary Enforcement', () => {

    test('4.1: Unassigned manager cannot view appraisal form (403 FORBIDDEN)', async () => {
      const deptHeadClient = await createAuthenticatedClient('depthead');
      const res = await deptHeadClient.get('/api/v1/appraisals/submissions/sub-emp-01-2026');
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
      assert.ok(res.body.error.message.includes('assigned direct reports'));
    });

    test('4.2: Unassigned manager cannot submit manager review (403 FORBIDDEN)', async () => {
      const deptHeadClient = await createAuthenticatedClient('depthead');
      const res = await deptHeadClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('4.3: Employee cannot submit self-appraisal for a colleague (403 FORBIDDEN)', async () => {
      const chiomaClient = await createAuthenticatedClient('chioma');
      const res = await chiomaClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
      assert.ok(res.body.error.message.includes('another staff member'));
    });

    test('4.4: Employee cannot acknowledge appraisal of a colleague (403 FORBIDDEN)', async () => {
      const chiomaClient = await createAuthenticatedClient('chioma');
      const res = await chiomaClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/acknowledge');
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
      assert.ok(res.body.error.message.includes('Only assigned employee'));
    });

    test('4.5: Non-admin roles (Employee, Manager) cannot calibrate appraisal scores (403 FORBIDDEN)', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });
      const mgrClient = await createAuthenticatedClient('manager');
      await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
      });

      // Employee tries to calibrate
      const empCalRes = await empClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.5
      });
      assert.equal(empCalRes.status, 403);
      assert.equal(empCalRes.body.error.code, 'FORBIDDEN');

      // Manager tries to calibrate
      const mgrCalRes = await mgrClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
        finalCalibratedScore: 4.5
      });
      assert.equal(mgrCalRes.status, 403);
      assert.equal(mgrCalRes.body.error.code, 'FORBIDDEN');
    });

    test('4.6: Non-admin roles cannot create appraisal cycles (403 FORBIDDEN)', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const empRes = await empClient.post('/api/v1/appraisals/cycles', {
        title: 'Unauthorized Cycle',
        fiscalYear: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31'
      });
      assert.equal(empRes.status, 403);

      const mgrClient = await createAuthenticatedClient('manager');
      const mgrRes = await mgrClient.post('/api/v1/appraisals/cycles', {
        title: 'Unauthorized Cycle By Manager',
        fiscalYear: 2026,
        startDate: '2026-01-01',
        endDate: '2026-12-31'
      });
      assert.equal(mgrRes.status, 403);
    });

    test('4.7: Employee role cannot access team appraisal queue (403 FORBIDDEN)', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const res = await empClient.get('/api/v1/appraisals/submissions/team');
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('4.8: Unauthenticated requests are rejected with 401 UNAUTHORIZED', async () => {
      const anonClient = new ExpressClient();

      const endpoints = [
        { method: 'get', path: '/api/v1/appraisals/submissions/me' },
        { method: 'get', path: '/api/v1/appraisals/submissions/team' },
        { method: 'get', path: '/api/v1/appraisals/submissions/sub-emp-01-2026' }
      ];

      for (const ep of endpoints) {
        const res = await (anonClient as any)[ep.method](ep.path);
        assert.equal(res.status, 401, `Expected 401 for ${ep.method.toUpperCase()} ${ep.path}, got ${res.status}`);
        assert.equal(res.body.error.code, 'UNAUTHORIZED');
      }
    });
  });

  // =========================================================================
  // VECTOR 5: SCORING FORMULA PRECISION & IEEE 754 FLOATING POINT ARITHMETIC
  // =========================================================================
  describe('Vector 5: Scoring Formula Precision & IEEE 754 Floating-Point Arithmetic', () => {

    test('5.1: Verified formula precision: (4.25 * 0.70) + (4.5 * 0.30) evaluates to exactly 4.32', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const form = await empClient.get('/api/v1/appraisals/submissions/me');
      const subId = form.body.data.id;

      await empClient.put(`/api/v1/appraisals/submissions/${subId}/self`, {
        goals: [
          { goalId: 'goal-1', selfRating: 4.8 },
          { goalId: 'goal-2', selfRating: 4.2 }
        ]
      });

      const mgrClient = await createAuthenticatedClient('manager');
      const mgrRes = await mgrClient.put(`/api/v1/appraisals/submissions/${subId}/manager`, {
        goals: [
          { goalId: 'goal-1', managerRating: 4.5 },
          { goalId: 'goal-2', managerRating: 4.0 }
        ],
        competencyScore: 4.5,
        managerSummaryFeedback: 'IEEE 754 Precision Validation Test'
      });

      assert.equal(mgrRes.status, 200);
      assert.equal(mgrRes.body.data.managerScore, 4.32);
    });

    test('5.2: Extreme rating combinations maintain 1.00 and 5.00 bounds', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 1.0 }, { goalId: 'goal-2', selfRating: 1.0 }]
      });

      const mgrClient = await createAuthenticatedClient('manager');

      const resLow = await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [
          { goalId: 'goal-1', managerRating: 1.0 },
          { goalId: 'goal-2', managerRating: 1.0 }
        ],
        competencyScore: 1.0
      });
      assert.equal(resLow.status, 200);
      assert.equal(resLow.body.data.managerScore, 1.00);

      await resetTestState();
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 5.0 }, { goalId: 'goal-2', selfRating: 5.0 }]
      });

      const resHigh = await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [
          { goalId: 'goal-1', managerRating: 5.0 },
          { goalId: 'goal-2', managerRating: 5.0 }
        ],
        competencyScore: 5.0
      });
      assert.equal(resHigh.status, 200);
      assert.equal(resHigh.body.data.managerScore, 5.00);
    });

    test('5.3: Omitting competencyScore cleanly defaults to kraScore without drift', async () => {
      const empClient = await createAuthenticatedClient('employee');
      await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
        goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
      });

      const mgrClient = await createAuthenticatedClient('manager');

      const res = await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
        goals: [
          { goalId: 'goal-1', managerRating: 3.5 },
          { goalId: 'goal-2', managerRating: 4.5 }
        ]
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.managerScore, 4.00);
    });

    test('5.4: High-precision fractional scores produce round-safe 2-decimal outputs', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const form = await empClient.get('/api/v1/appraisals/submissions/me');
      const subId = form.body.data.id;

      const selfRes = await empClient.put(`/api/v1/appraisals/submissions/${subId}/self`, {
        goals: [
          { goalId: 'goal-1', selfRating: 4.33 },
          { goalId: 'goal-2', selfRating: 3.67 }
        ]
      });
      assert.equal(selfRes.status, 200);
      assert.equal(selfRes.body.data.selfScore, 4.00);
    });
  });

});
