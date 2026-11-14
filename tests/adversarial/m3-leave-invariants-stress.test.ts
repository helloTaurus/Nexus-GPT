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
        // preserve string
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

  async request(method: string, path: string, options: { body?: any; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...options.headers };
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers['cookie'] = cookieHeader;
    }
    const res = await invokeExpress(expressApp, method, path, { headers, body: options.body });
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
  await getDataStore().leaves.reset();
  await getDataStore().audit.reset();
  const allUsers = getDataStore().users.getAllUsers();
  for (const user of allUsers) {
    if (!SEED_USER_IDS.has(user.id)) {
      await getDataStore().users.delete(user.id);
    }
  }
}

describe('Milestone 3 Adversarial Stress Suite: Leave Rules Engine, Invariants & Workflows', () => {
  before(async () => {
    await initializeDataStore();
    expressApp = createApp();
    // Warm up session cache for seed roles
    for (const role of ['admin', 'manager', 'employee', 'chioma'] as SeedUserKey[]) {
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
  // VECTOR 1: ZERO-OVERDRAFT BOUNDARY PROTECTION
  // =========================================================================
  describe('Vector 1: Zero-Overdraft Boundary Protection', () => {
    test('1.1: Exact balance exhaustion: Employee with 20d quota requests exactly 20 working days', async () => {
      const client = await createAuthenticatedClient('employee');

      // Verify baseline: 20 available, 0 pending, 0 used
      const initBalRes = await client.get('/api/v1/leaves/balances');
      const initAnnual = initBalRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(initAnnual.availableDays, 20.0);
      assert.equal(initAnnual.pendingDays, 0);

      // August 2026: Aug 3 (Mon) to Aug 28 (Fri) = 4 full weeks * 5 days = 20 working days (no holidays in August)
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-08-03',
        endDate: '2026-08-28',
        reason: 'Full annual leave allocation exhaustion'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.totalDays, 20.0);
      assert.equal(res.body.data.status, 'SUBMITTED');

      // Verify exact 0 available balance
      const postBalRes = await client.get('/api/v1/leaves/balances');
      const postAnnual = postBalRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(postAnnual.availableDays, 0.0);
      assert.equal(postAnnual.pendingDays, 20.0);
      assert.equal(postAnnual.usedDays, 0);
    });

    test('1.2: Zero-overdraft rejection: Subsequent request for 1d when available is 0 must reject with 409', async () => {
      const client = await createAuthenticatedClient('employee');

      // Exhaust all 20 days
      const exhaustRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-08-03',
        endDate: '2026-08-28',
        reason: 'Exhaust all 20 days'
      });
      assert.equal(exhaustRes.status, 201);

      // Attempt requesting 1 additional working day (Monday Sep 7)
      const overdraftRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-09-07',
        endDate: '2026-09-07',
        reason: 'One extra day beyond quota'
      });

      assert.equal(overdraftRes.status, 409);
      assert.equal(overdraftRes.body.error.code, 'INSUFFICIENT_LEAVE_BALANCE');
      assert.ok(overdraftRes.body.error.message.includes('Insufficient leave balance'));
    });

    test('1.3: Fractional overdraft rejection: 0.5d half-day request on 0 available balance rejects with 409', async () => {
      const client = await createAuthenticatedClient('employee');

      // Exhaust all 20 days
      await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-08-03',
        endDate: '2026-08-28',
        reason: 'Exhaust full allocation'
      });

      // Attempt 0.5 half-day request
      const halfDayRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-09-07',
        endDate: '2026-09-07',
        isHalfDay: true,
        reason: 'Just half day off'
      });

      assert.equal(halfDayRes.status, 409);
      assert.equal(halfDayRes.body.error.code, 'INSUFFICIENT_LEAVE_BALANCE');
    });

    test('1.4: Massive overdraft rejection: Requesting 100 days when quota is 20d rejects with 409', async () => {
      const client = await createAuthenticatedClient('employee');

      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-01',
        endDate: '2026-10-30',
        reason: 'Gigantic sabbatical'
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INSUFFICIENT_LEAVE_BALANCE');
    });

    test('1.5: Incremental quota exhaustion: 10d + 9d + 1d succeeds, 4th request for 1d rejects with 409', async () => {
      const client = await createAuthenticatedClient('employee');

      // Step 1: 10 working days (June 1 to June 15: June 12 is Democracy Day)
      const res1 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        reason: 'Batch 1 (10 days)'
      });
      assert.equal(res1.status, 201);
      assert.equal(res1.body.data.totalDays, 10.0);

      // Step 2: 9 working days (July 6 to July 16)
      const res2 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-06',
        endDate: '2026-07-16',
        reason: 'Batch 2 (9 days)'
      });
      assert.equal(res2.status, 201);
      assert.equal(res2.body.data.totalDays, 9.0);

      // Remaining available should now be exactly 1.0 day
      let balRes = await client.get('/api/v1/leaves/balances');
      let annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 1.0);
      assert.equal(annual.pendingDays, 19.0);

      // Step 3: Exactly 1 working day (July 20 Mon)
      const res3 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-20',
        endDate: '2026-07-20',
        reason: 'Batch 3 (1 day)'
      });
      assert.equal(res3.status, 201);
      assert.equal(res3.body.data.totalDays, 1.0);

      // Now available is exactly 0.0
      balRes = await client.get('/api/v1/leaves/balances');
      annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 0.0);
      assert.equal(annual.pendingDays, 20.0);

      // Step 4: 1 more day must fail with 409
      const res4 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-27',
        endDate: '2026-07-27',
        reason: 'Batch 4 (overdraft attempt)'
      });
      assert.equal(res4.status, 409);
      assert.equal(res4.body.error.code, 'INSUFFICIENT_LEAVE_BALANCE');
    });

    test('1.6: Boundary check across other leave types (Casual leave 5d quota exhaustion)', async () => {
      const client = await createAuthenticatedClient('employee');

      // Casual leave policy max 2 consecutive days per application.
      // Req 1: 2 days (July 6-7)
      const req1 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-06',
        endDate: '2026-07-07',
        reason: 'Casual errand 1'
      });
      assert.equal(req1.status, 201);

      // Req 2: 2 days (July 13-14)
      const req2 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-13',
        endDate: '2026-07-14',
        reason: 'Casual errand 2'
      });
      assert.equal(req2.status, 201);

      // Available casual days: 5 - 4 = 1 day left
      const balRes = await client.get('/api/v1/leaves/balances');
      const casual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-casual');
      assert.equal(casual.availableDays, 1.0);
      assert.equal(casual.pendingDays, 4.0);

      // Attempt requesting 2 days: exceeds 1 available day -> 409 INSUFFICIENT_LEAVE_BALANCE
      const req3 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-20',
        endDate: '2026-07-21',
        reason: 'Casual errand 3 exceeding remaining 1 day'
      });
      assert.equal(req3.status, 409);
      assert.equal(req3.body.error.code, 'INSUFFICIENT_LEAVE_BALANCE');
    });
  });

  // =========================================================================
  // VECTOR 2: EXACT HOLIDAY AND WEEKEND EXCLUSION MATHEMATICS
  // =========================================================================
  describe('Vector 2: Exact Holiday and Weekend Exclusion Mathematics', () => {
    test('2.1: Spans Christmas (Dec 25) & Boxing Day (Dec 28 observed): Dec 24 (Thu) to Dec 29 (Tue) yields 2 working days', async () => {
      const client = await createAuthenticatedClient('employee');

      // Dec 24: Thu (working)
      // Dec 25: Fri (Christmas Day - holiday)
      // Dec 26: Sat (weekend)
      // Dec 27: Sun (weekend)
      // Dec 28: Mon (Boxing Day observed - holiday)
      // Dec 29: Tue (working)
      // Total calendar days = 6, Working days = 2
      const calcRes = await client.post('/api/v1/leaves/calculate', {
        startDate: '2026-12-24',
        endDate: '2026-12-29',
        isHalfDay: false
      });

      assert.equal(calcRes.status, 200);
      assert.equal(calcRes.body.workingDays, 2.0);
      assert.equal(calcRes.body.calendarDays, 6);
      assert.deepEqual(calcRes.body.holidaysEncountered, ['2026-12-25', '2026-12-28']);

      // Submitting request consumes exactly 2 days
      const reqRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-12-24',
        endDate: '2026-12-29',
        reason: 'Christmas bridging holiday'
      });
      assert.equal(reqRes.status, 201);
      assert.equal(reqRes.body.data.totalDays, 2.0);
    });

    test('2.2: Spans New Year: Jan 1 (Thu, holiday) to Jan 2 (Fri, working) yields exactly 1 working day', async () => {
      const client = await createAuthenticatedClient('employee');

      const calcRes = await client.post('/api/v1/leaves/calculate', {
        startDate: '2026-01-01',
        endDate: '2026-01-02'
      });

      assert.equal(calcRes.status, 200);
      assert.equal(calcRes.body.workingDays, 1.0);
      assert.equal(calcRes.body.calendarDays, 2);
      assert.deepEqual(calcRes.body.holidaysEncountered, ['2026-01-01']);

      // Request on ONLY Jan 1 (holiday) must reject with 400 ZERO_WORKING_DAYS
      const onlyHolidayRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        reason: 'Only New Year day'
      });
      assert.equal(onlyHolidayRes.status, 400);
      assert.equal(onlyHolidayRes.body.error.code, 'ZERO_WORKING_DAYS');
    });

    test('2.3: Spans Independence Day: Sep 30 (Wed) to Oct 2 (Fri) yields exactly 2 working days', async () => {
      const client = await createAuthenticatedClient('employee');

      // Sep 30: Wed (working)
      // Oct 01: Thu (Independence Day - holiday)
      // Oct 02: Fri (working)
      const calcRes = await client.post('/api/v1/leaves/calculate', {
        startDate: '2026-09-30',
        endDate: '2026-10-02'
      });

      assert.equal(calcRes.status, 200);
      assert.equal(calcRes.body.workingDays, 2.0);
      assert.equal(calcRes.body.calendarDays, 3);
      assert.deepEqual(calcRes.body.holidaysEncountered, ['2026-10-01']);

      // Request on ONLY Oct 1 must return 400 ZERO_WORKING_DAYS
      const singleDayRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        reason: 'Independence Day request'
      });
      assert.equal(singleDayRes.status, 400);
      assert.equal(singleDayRes.body.error.code, 'ZERO_WORKING_DAYS');
    });

    test('2.4: Period spanning only holidays and weekends returns 400 ZERO_WORKING_DAYS', async () => {
      const client = await createAuthenticatedClient('employee');

      // Dec 25 (Fri) to Dec 28 (Mon) - all 4 days are Christmas, weekend, Boxing Day
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-12-25',
        endDate: '2026-12-28',
        reason: 'All holiday period'
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'ZERO_WORKING_DAYS');
      assert.ok(res.body.error.message.includes('0 net working days'));
    });

    test('2.5: Leave application spanning only weekends returns 400 ZERO_WORKING_DAYS', async () => {
      const client = await createAuthenticatedClient('employee');

      // Saturday 2026-06-06 to Sunday 2026-06-07
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-06',
        endDate: '2026-06-07',
        reason: 'Weekend getaway'
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'ZERO_WORKING_DAYS');
    });

    test('2.6: Inverted date boundaries (endDate < startDate) returns 400 INVALID_DATE_RANGE', async () => {
      const client = await createAuthenticatedClient('employee');

      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-15',
        endDate: '2026-06-10',
        reason: 'Inverted dates'
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_DATE_RANGE');

      // Same check on calculate endpoint
      const calcRes = await client.post('/api/v1/leaves/calculate', {
        startDate: '2026-06-15',
        endDate: '2026-06-10'
      });
      assert.equal(calcRes.status, 400);
      assert.equal(calcRes.body.error.code, 'INVALID_DATE_RANGE');
    });

    test('2.7: Half-day calculation with holiday exclusion calculates 0.5 per working day', async () => {
      const client = await createAuthenticatedClient('employee');

      // Sep 30 to Oct 2 (2 working days). With isHalfDay = true -> 1.0 day total
      const calcRes = await client.post('/api/v1/leaves/calculate', {
        startDate: '2026-09-30',
        endDate: '2026-10-02',
        isHalfDay: true
      });

      assert.equal(calcRes.status, 200);
      assert.equal(calcRes.body.workingDays, 1.0);
      assert.equal(calcRes.body.calendarDays, 3);
    });

    test('2.8: GET and POST /leaves/calculate yield consistent parity', async () => {
      const client = await createAuthenticatedClient('employee');

      const postRes = await client.post('/api/v1/leaves/calculate', {
        startDate: '2026-10-05',
        endDate: '2026-10-09',
        isHalfDay: false
      });

      const getRes = await client.get('/api/v1/leaves/calculate?startDate=2026-10-05&endDate=2026-10-09&isHalfDay=false');

      assert.equal(postRes.status, 200);
      assert.equal(getRes.status, 200);
      assert.equal(postRes.body.workingDays, getRes.body.workingDays);
      assert.equal(postRes.body.calendarDays, getRes.body.calendarDays);
    });
  });

  // =========================================================================
  // VECTOR 3: DOUBLE-BOOKING COLLISIONS
  // =========================================================================
  describe('Vector 3: Double-Booking Collisions', () => {
    test('3.1: Exact overlap: Same user submitting identical dates rejects with 409 DATE_OVERLAP', async () => {
      const client = await createAuthenticatedClient('employee');

      // First booking: June 8 to June 11 (Mon-Thu)
      const firstRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'First booking'
      });
      assert.equal(firstRes.status, 201);

      // Exact identical dates
      const secondRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Exact duplicate booking'
      });
      assert.equal(secondRes.status, 409);
      assert.equal(secondRes.body.error.code, 'DATE_OVERLAP');
    });

    test('3.2: Partial overlap (head): Request starting before and ending inside existing booking rejects with 409', async () => {
      const client = await createAuthenticatedClient('employee');

      // Existing: June 8 to June 11
      await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Base booking'
      });

      // New: June 4 to June 9 (overlaps June 8-9)
      const overlapRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-04',
        endDate: '2026-06-09',
        reason: 'Head overlapping booking'
      });
      assert.equal(overlapRes.status, 409);
      assert.equal(overlapRes.body.error.code, 'DATE_OVERLAP');
    });

    test('3.3: Partial overlap (tail): Request starting inside and ending after existing booking rejects with 409', async () => {
      const client = await createAuthenticatedClient('employee');

      // Existing: June 8 to June 11
      await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Base booking'
      });

      // New: June 10 to June 16 (overlaps June 10-11)
      const overlapRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-10',
        endDate: '2026-06-16',
        reason: 'Tail overlapping booking'
      });
      assert.equal(overlapRes.status, 409);
      assert.equal(overlapRes.body.error.code, 'DATE_OVERLAP');
    });

    test('3.4: Enclosing and contained overlaps reject with 409 DATE_OVERLAP', async () => {
      const client = await createAuthenticatedClient('employee');

      // Existing: June 8 to June 11
      await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Base booking'
      });

      // Contained: June 9 to June 10 (inside base)
      const subsetRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-09',
        endDate: '2026-06-10',
        reason: 'Subset booking'
      });
      assert.equal(subsetRes.status, 409);
      assert.equal(subsetRes.body.error.code, 'DATE_OVERLAP');

      // Enclosing: June 1 to June 19 (enclosing base)
      const supersetRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-01',
        endDate: '2026-06-19',
        reason: 'Superset booking'
      });
      assert.equal(supersetRes.status, 409);
      assert.equal(supersetRes.body.error.code, 'DATE_OVERLAP');
    });

    test('3.5: Adjacent non-overlapping bookings succeed (both preceding and following weeks)', async () => {
      const client = await createAuthenticatedClient('employee');

      // Base booking: June 8 (Mon) to June 11 (Thu)
      const baseRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Middle week booking'
      });
      assert.equal(baseRes.status, 201);

      // Preceding week: June 1 (Mon) to June 5 (Fri) -> immediately adjacent
      const prevRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        reason: 'Preceding week'
      });
      assert.equal(prevRes.status, 201);

      // Following week: June 15 (Mon) to June 19 (Fri) -> immediately adjacent
      const nextRes = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-15',
        endDate: '2026-06-19',
        reason: 'Following week'
      });
      assert.equal(nextRes.status, 201);
    });

    test('3.6: Rebooking dates of a CANCELLED request succeeds without conflict', async () => {
      const client = await createAuthenticatedClient('employee');

      // Book June 8 to June 11
      const res1 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Trip to be cancelled'
      });
      assert.equal(res1.status, 201);
      const reqId = res1.body.data.id;

      // Cancel the booking
      const cancelRes = await client.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
        reason: 'Plans changed'
      });
      assert.equal(cancelRes.status, 200);

      // Rebook the exact same dates: June 8 to June 11 -> must succeed!
      const res2 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-08',
        endDate: '2026-06-11',
        reason: 'Rebooked after cancellation'
      });
      assert.equal(res2.status, 201);
      assert.equal(res2.body.data.status, 'SUBMITTED');
    });

    test('3.7: Rebooking dates of a REJECTED request succeeds without conflict', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Book July 6 to July 9
      const res1 = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-06',
        endDate: '2026-07-09',
        reason: 'Initial leave request'
      });
      assert.equal(res1.status, 201);
      const reqId = res1.body.data.id;

      // Manager rejects
      await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
        action: 'REJECT',
        decisionReason: 'Needs rescheduling'
      });

      // Employee re-applies for the same dates after discussion
      const res2 = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-06',
        endDate: '2026-07-09',
        reason: 'Resubmitted after discussion'
      });
      assert.equal(res2.status, 201);
      assert.equal(res2.body.data.status, 'SUBMITTED');
    });

    test('3.8: Distinct employees can book identical dates without interference', async () => {
      const emp1 = await createAuthenticatedClient('employee');
      const emp2 = await createAuthenticatedClient('chioma');

      // Emp1 books July 6 to July 10
      const res1 = await emp1.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-06',
        endDate: '2026-07-10',
        reason: 'Emp1 vacation'
      });
      assert.equal(res1.status, 201);

      // Emp2 (Chioma) books the exact same dates: July 6 to July 10
      const res2 = await emp2.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-06',
        endDate: '2026-07-10',
        reason: 'Chioma vacation'
      });
      assert.equal(res2.status, 201);
    });
  });

  // =========================================================================
  // VECTOR 4: POLICY LIMITS & MEDICAL NOTE COMPLIANCE
  // =========================================================================
  describe('Vector 4: Policy Limits & Medical Note Compliance', () => {
    test('4.1: Sick leave <= 2 consecutive working days without medical certificate succeeds', async () => {
      const client = await createAuthenticatedClient('employee');

      // Exactly 2 days: July 6 (Mon) to July 7 (Tue)
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-sick',
        startDate: '2026-07-06',
        endDate: '2026-07-07',
        reason: 'Mild migraine, resting at home'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.totalDays, 2.0);
      assert.equal(res.body.data.status, 'SUBMITTED');
    });

    test('4.2: Sick leave > 2 consecutive working days without medical certificate rejects with 422', async () => {
      const client = await createAuthenticatedClient('employee');

      // 3 days: July 6 (Mon) to July 8 (Wed)
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-sick',
        startDate: '2026-07-06',
        endDate: '2026-07-08',
        reason: 'Severe malaria'
        // No attachmentUrl provided
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'MEDICAL_NOTE_REQUIRED');
      assert.ok(res.body.error.message.includes('Doctor certificate required'));
    });

    test('4.3: Sick leave > 2 consecutive working days WITH medical certificate attachment succeeds', async () => {
      const client = await createAuthenticatedClient('employee');

      // 5 working days: July 6 to July 10 WITH attachment
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-sick',
        startDate: '2026-07-06',
        endDate: '2026-07-10',
        reason: 'Hospitalized for appendectomy',
        attachmentUrl: 'https://docs.nexusfinance.ng/medical/hospital_cert_0042.pdf'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.totalDays, 5.0);
      assert.equal(res.body.data.attachmentUrl, 'https://docs.nexusfinance.ng/medical/hospital_cert_0042.pdf');
    });

    test('4.4: Casual leave <= 2 consecutive working days succeeds', async () => {
      const client = await createAuthenticatedClient('employee');

      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-13',
        endDate: '2026-07-14',
        reason: 'Urgent family matter'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.totalDays, 2.0);
    });

    test('4.5: Casual leave > 2 consecutive working days returns 422 POLICY_LIMIT_EXCEEDED', async () => {
      const client = await createAuthenticatedClient('employee');

      // 3 consecutive working days: July 13 to July 15
      const res = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-13',
        endDate: '2026-07-15',
        reason: 'Personal errands'
      });

      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'POLICY_LIMIT_EXCEEDED');
      assert.ok(res.body.error.message.includes('Casual leave cannot exceed 2 consecutive working days'));
    });

    test('4.6: Multiple non-consecutive casual leaves (2d + 2d) within quota both succeed', async () => {
      const client = await createAuthenticatedClient('employee');

      const res1 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-06',
        endDate: '2026-07-07',
        reason: 'Errand week 1'
      });
      assert.equal(res1.status, 201);

      const res2 = await client.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-casual',
        startDate: '2026-07-20',
        endDate: '2026-07-21',
        reason: 'Errand week 3'
      });
      assert.equal(res2.status, 201);
    });
  });

  // =========================================================================
  // VECTOR 5: AUTHORIZATION, SELF-APPROVAL & PRIVACY INVARIANTS
  // =========================================================================
  describe('Vector 5: Authorization, Self-Approval & Privacy Invariants', () => {
    test('5.1: Self-approval prohibition: Manager cannot approve their own leave request (403)', async () => {
      const mgrClient = await createAuthenticatedClient('manager');

      // Manager submits leave request
      const submitRes = await mgrClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-08-10',
        endDate: '2026-08-14',
        reason: 'Manager vacation'
      });
      assert.equal(submitRes.status, 201);
      const reqId = submitRes.body.data.id;

      // Manager attempts self-approval
      const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
        action: 'APPROVE',
        decisionReason: 'Self approved'
      });

      assert.equal(approveRes.status, 403);
      assert.equal(approveRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
    });

    test('5.2: Non-reporting manager authorization: Manager cannot approve report from another chain (403)', async () => {
      const adminClient = await createAuthenticatedClient('admin');
      const uniqueEmail = `tari.${Date.now()}_${Math.floor(Math.random() * 10000)}@nexusfinance.ng`;

      // Create new staff Tari under DeptHead
      const createRes = await adminClient.post('/api/v1/employees', {
        firstName: 'Tari',
        lastName: 'Briggs',
        email: uniqueEmail,
        departmentId: 'dept-ops',
        designationId: 'des-se',
        managerId: 'emp-depthead-01'
      });
      assert.equal(createRes.status, 201);

      // Tari submits leave
      const tariClient = new ExpressClient();
      const loginRes = await tariClient.login(uniqueEmail, 'TemporaryPass123!');
      assert.equal(loginRes.status, 200);

      const submitRes = await tariClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-09-01',
        endDate: '2026-09-04',
        reason: 'Tari off days'
      });
      assert.equal(submitRes.status, 201);
      const reqId = submitRes.body.data.id;

      // Manager Ibrahim (dept-credit) attempts to approve Tari's leave
      const mgrClient = await createAuthenticatedClient('manager');
      const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
        action: 'APPROVE'
      });

      assert.equal(approveRes.status, 403);
      assert.equal(approveRes.body.error.code, 'FORBIDDEN');
    });

    test('5.3: Peer balance privacy: Regular employee querying peer leave balance receives 403 FORBIDDEN', async () => {
      const empClient = await createAuthenticatedClient('employee');

      // Query admin leave balance
      const res = await empClient.get('/api/v1/leaves/balances?employeeId=emp-admin-01');

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
      assert.ok(res.body.error.message.includes('Cannot view peer leave balances'));
    });

    test('5.4: Team queue privacy: Regular employee querying team approval queue receives 403 FORBIDDEN', async () => {
      const empClient = await createAuthenticatedClient('employee');

      const res = await empClient.get('/api/v1/leaves/requests?scope=team');

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('5.5: Enterprise queue privacy: Manager querying all company leaves (scope=all) receives 403 FORBIDDEN', async () => {
      const mgrClient = await createAuthenticatedClient('manager');

      const res = await mgrClient.get('/api/v1/leaves/requests?scope=all');

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('5.6: Cross-employee cancellation guard: Employee cannot cancel peer leave request (403 FORBIDDEN)', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const chiomaClient = await createAuthenticatedClient('chioma');

      // Chioma submits leave
      const submitRes = await chiomaClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-07-06',
        endDate: '2026-07-10',
        reason: 'Chioma leave'
      });
      const reqId = submitRes.body.data.id;

      // Regular employee attempts to cancel Chioma's request
      const cancelRes = await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
        reason: 'Malicious cancellation attempt'
      });

      assert.equal(cancelRes.status, 403);
      assert.equal(cancelRes.body.error.code, 'FORBIDDEN');
    });

    test('5.7: Admin override: Admin can approve report leave in emergency', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const adminClient = await createAuthenticatedClient('admin');

      // Employee submits leave
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-02',
        endDate: '2026-11-06',
        reason: 'Annual trip'
      });
      const reqId = submitRes.body.data.id;

      // Admin approves directly
      const approveRes = await adminClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
        action: 'APPROVE',
        decisionReason: 'Executive administrative approval'
      });

      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.status, 'APPROVED');
    });
  });

  // =========================================================================
  // VECTOR 6: LIFECYCLE STATE MACHINE TRANSITIONS & BALANCE RESTORATION
  // =========================================================================
  describe('Vector 6: Lifecycle State Machine Transitions & Balance Restoration', () => {
    test('6.1: Submission -> Cancellation: Cancellation of SUBMITTED request releases pending balance back to available', async () => {
      const empClient = await createAuthenticatedClient('employee');

      // Initial: 20 available, 0 pending, 0 used
      let bal = await empClient.get('/api/v1/leaves/balances');
      let annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 20.0);
      assert.equal(annual.pendingDays, 0);

      // Submit 4 days (Nov 16-19)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-16',
        endDate: '2026-11-19',
        reason: 'Upcoming travel'
      });
      const reqId = submitRes.body.data.id;

      // Pending reserved: available = 16, pending = 4
      bal = await empClient.get('/api/v1/leaves/balances');
      annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 16.0);
      assert.equal(annual.pendingDays, 4.0);

      // Cancel SUBMITTED request
      const cancelRes = await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
        reason: 'Travel cancelled'
      });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.data.status, 'CANCELLED');

      // Balance completely released
      bal = await empClient.get('/api/v1/leaves/balances');
      annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 20.0);
      assert.equal(annual.pendingDays, 0);
      assert.equal(annual.usedDays, 0);
    });

    test('6.2: Submission -> Manager Rejection: Rejection releases pending balance back to available', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit 3 days (Nov 23-25)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        reason: 'Trip to Abuja'
      });
      const reqId = submitRes.body.data.id;

      // Manager rejects
      const rejectRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
        action: 'REJECT',
        decisionReason: 'Departmental coverage required'
      });
      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.body.data.status, 'REJECTED');

      // Balance completely released
      const bal = await empClient.get('/api/v1/leaves/balances');
      const annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 20.0);
      assert.equal(annual.pendingDays, 0);
      assert.equal(annual.usedDays, 0);
    });

    test('6.3: Submission -> Manager Approval: Approval converts pending balance to used balance', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit 5 days (Nov 16-20)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-16',
        endDate: '2026-11-20',
        reason: 'Approved annual break'
      });
      const reqId = submitRes.body.data.id;

      // Manager approves
      const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
        action: 'APPROVE',
        decisionReason: 'Approved by line manager'
      });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.status, 'APPROVED');

      // Balance converted: pending = 0, used = 5, available = 15
      const bal = await empClient.get('/api/v1/leaves/balances');
      const annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.pendingDays, 0);
      assert.equal(annual.usedDays, 5.0);
      assert.equal(annual.availableDays, 15.0);
    });

    test('6.4: Approved leave cancellation: Employee cancels future approved leave, restoring used balance', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit future leave in December (Dec 7 to Dec 11 = 5 working days)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-12-07',
        endDate: '2026-12-11',
        reason: 'December vacation'
      });
      const reqId = submitRes.body.data.id;

      // Manager approves
      await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'APPROVE' });

      // Employee cancels future approved leave
      const cancelRes = await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
        reason: 'Emergency cancellation'
      });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.data.status, 'CANCELLED');

      // Used days restored back to available
      const bal = await empClient.get('/api/v1/leaves/balances');
      const annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.usedDays, 0);
      assert.equal(annual.pendingDays, 0);
      assert.equal(annual.availableDays, 20.0);
    });

    test('6.5: Retroactive cancellation of past leave is rejected with 400', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit past leave (Jan 5 to Jan 7, 2026)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-01-05',
        endDate: '2026-01-07',
        reason: 'Past leave'
      });
      const reqId = submitRes.body.data.id;

      // Manager approves
      await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'APPROVE' });

      // Attempt cancellation of past leave
      const cancelRes = await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
        reason: 'Retroactive cancel attempt'
      });

      assert.equal(cancelRes.status, 400);
      assert.equal(cancelRes.body.error.code, 'PAST_LEAVE_CANNOT_BE_CANCELLED');
    });

    test('6.6: Cancellation of already REJECTED leave is rejected with 400 INVALID_STATE_TRANSITION', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit leave
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        reason: 'Leave to be rejected'
      });
      const reqId = submitRes.body.data.id;

      // Manager rejects
      await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'REJECT' });

      // Attempt cancelling the already REJECTED leave - must be rejected with 400 INVALID_STATE_TRANSITION
      const cancelRes = await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
        reason: 'Cancelling rejected leave'
      });

      assert.equal(cancelRes.status, 400, 'Cancellation of rejected leave must return 400 Bad Request');
      assert.equal(cancelRes.body.error.code, 'INVALID_STATE_TRANSITION');
      assert.ok(cancelRes.body.error.message.includes("Cannot cancel leave request in 'REJECTED' state"));
    });

    test('6.7: Re-reviewing already APPROVED leave is rejected with 409 ALREADY_DECIDED', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit 3 days (Nov 23-25)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        reason: 'Leave for double review check'
      });
      const reqId = submitRes.body.data.id;

      // First Approval: pending 3 -> 0, used 0 -> 3, available 17 -> 17
      const firstApprove = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'APPROVE' });
      assert.equal(firstApprove.status, 200);

      let bal = await empClient.get('/api/v1/leaves/balances');
      let annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.pendingDays, 0);
      assert.equal(annual.usedDays, 3.0);
      assert.equal(annual.availableDays, 17.0);

      // Re-review (second APPROVE action) must reject with 409 ALREADY_DECIDED
      const secondApprove = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'APPROVE' });
      assert.equal(secondApprove.status, 409, 'Duplicate approval on decided request must return 409 Conflict');
      assert.equal(secondApprove.body.error.code, 'ALREADY_DECIDED');

      // Confirms pendingDays and usedDays ledger balances were preserved without corruption
      bal = await empClient.get('/api/v1/leaves/balances');
      annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.pendingDays, 0, 'Pending days remain 0 without negative corruption');
      assert.equal(annual.usedDays, 3.0, 'Used days remain 3.0 without duplication');
      assert.equal(annual.availableDays, 17.0, 'Available days remain intact at 17.0');
    });

    test('6.8: Re-rejecting already REJECTED leave is rejected with 409 ALREADY_DECIDED preventing balance inflation', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit 3 days (Nov 23-25)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        reason: 'Leave for double rejection check'
      });
      const reqId = submitRes.body.data.id;

      // First Rejection: restores balance to 20 available, 0 pending, 0 used
      await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'REJECT' });

      let bal = await empClient.get('/api/v1/leaves/balances');
      let annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.availableDays, 20.0);
      assert.equal(annual.pendingDays, 0);

      // Re-rejection (second REJECT action) must reject with 409 ALREADY_DECIDED
      const secondReject = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'REJECT' });
      assert.equal(secondReject.status, 409, 'Duplicate rejection on decided request must return 409 Conflict');
      assert.equal(secondReject.body.error.code, 'ALREADY_DECIDED');

      // Confirms balance is not inflated beyond quota
      bal = await empClient.get('/api/v1/leaves/balances');
      annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.pendingDays, 0, 'Pending days remain 0');
      assert.equal(annual.availableDays, 20.0, 'Available days stay at statutory quota of 20.0');
    });

    test('6.9: Approving a CANCELLED request is rejected with 409 ALREADY_DECIDED preventing zombie state', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // Submit 4 days (Nov 16-19)
      const submitRes = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-11-16',
        endDate: '2026-11-19',
        reason: 'Trip cancelled by employee'
      });
      const reqId = submitRes.body.data.id;

      // Employee cancels
      await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, { reason: 'Cancelled' });

      // Manager attempts to approve the CANCELLED request
      const reviewRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'APPROVE' });
      assert.equal(reviewRes.status, 409, 'Review of cancelled request must return 409 Conflict');
      assert.equal(reviewRes.body.error.code, 'ALREADY_DECIDED');

      // Confirms ledger balances remain pristine
      const bal = await empClient.get('/api/v1/leaves/balances');
      const annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
      assert.equal(annual.pendingDays, 0, 'Pending days remain 0');
      assert.equal(annual.usedDays, 0, 'Used days remain 0');
      assert.equal(annual.availableDays, 20.0, 'Available days remain 20.0');
    });

    test('6.10: Zero-trust schema validation strictly rejects payloads with unknown or tampered keys (400 VALIDATION_ERROR)', async () => {
      const empClient = await createAuthenticatedClient('employee');
      const mgrClient = await createAuthenticatedClient('manager');

      // 1. Calculate endpoint rejects extraneous keys
      const badCalc = await empClient.post('/api/v1/leaves/calculate', {
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        maliciousExtraProp: 'injected_value'
      });
      assert.equal(badCalc.status, 400);
      assert.equal(badCalc.body.error.code, 'VALIDATION_ERROR');

      // 2. Submit endpoint rejects extraneous keys
      const badSubmit = await empClient.post('/api/v1/leaves/requests', {
        leaveTypeId: 'lt-annual',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        reason: 'Valid vacation reason',
        unrecognizedKey: 'attack_vector'
      });
      assert.equal(badSubmit.status, 400);
      assert.equal(badSubmit.body.error.code, 'VALIDATION_ERROR');

      // 3. Review endpoint rejects extraneous keys
      const badReview = await mgrClient.patch('/api/v1/leaves/requests/lr-nonexistent/action', {
        action: 'APPROVE',
        escalatePrivilege: true
      });
      assert.equal(badReview.status, 400);
      assert.equal(badReview.body.error.code, 'VALIDATION_ERROR');

      // 4. Cancel endpoint rejects extraneous keys
      const badCancel = await empClient.post('/api/v1/leaves/requests/lr-nonexistent/cancel', {
        reason: 'Valid cancel reason',
        tamperField: 999
      });
      assert.equal(badCancel.status, 400);
      assert.equal(badCancel.body.error.code, 'VALIDATION_ERROR');
    });
  });
});
