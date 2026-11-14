import test, { describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getDataStore } from '../../update/server/repositories/dataStore.ts';
import { AttendanceRepository, getLagosDateTime } from '../../update/server/repositories/attendanceRepository.ts';
import { AtomicJsonStore } from '../../update/server/repositories/store/AtomicJsonStore.ts';
import type { AttendanceRecord, UserAccount } from '../../update/server/repositories/types.ts';

process.env.DISABLE_RATE_LIMIT = 'true';

let expressApp: any = null;

// Helper to invoke Express app directly
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

    const headers: Record<string, string> = { ...options.headers };
    const ip = options.ip || `10.0.${Math.floor(1 + Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`;
    headers['x-forwarded-for'] = ip;

    let payloadBuffer: Buffer | null = null;
    if (options.body !== undefined) {
      const payloadStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      payloadBuffer = Buffer.from(payloadStr, 'utf-8');
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
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
      } catch {}
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

  async request(method: string, url: string, body?: any) {
    const headers: Record<string, string> = {};
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers['cookie'] = cookieHeader;
    }
    const res = await invokeExpress(expressApp, method, url, { headers, body });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      this.extractCookies(setCookie);
    }
    return res;
  }

  async login(email: string, password = 'EmployeePassword123!') {
    return this.request('POST', '/api/v1/auth/login', { email, password });
  }
}

describe('M1 Adversarial Challenge: Attendance & Staff Clock-In Tracking', () => {
  before(async () => {
    await initializeDataStore();
    expressApp = createApp();
  });

  // --------------------------------------------------------------------------
  // Dimension 1: CRITICAL DEADLOCK IN ATTENDANCE REPOSITORY
  // --------------------------------------------------------------------------
  test('CHALLENGE CRITICAL: AttendanceRepository.clockIn and clockOut deadlock due to non-reentrant AtomicJsonStore.withLock', async () => {
    const tempFilePath = path.resolve('tests', `tmp_deadlock_${crypto.randomUUID()}.json`);
    const store = new AtomicJsonStore<AttendanceRecord>(tempFilePath, () => []);
    await store.initialize();
    const repo = new AttendanceRepository(store);

    const dummyUser: UserAccount = {
      id: 'usr-deadlock-test',
      email: 'deadlock@nexusfinance.ng',
      passwordHash: 'dummy',
      role: 'STAFF',
      status: 'ACTIVE',
      profile: {
        id: 'emp-dl',
        staffId: 'NX-DL',
        department: 'Engineering',
        jobTitle: 'QA',
        dateOfJoining: '2026-01-01',
        employmentType: 'FULL_TIME',
        workLocation: 'Abuja HQ',
        managerId: null,
        avatarUrl: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // We test with a 1.5s timeout: if it hangs, it deadlocks!
    const deadlockPromise = repo.clockIn(dummyUser);
    const timeoutPromise = new Promise<'DEADLOCKED'>((resolve) => {
      setTimeout(() => resolve('DEADLOCKED'), 1500);
    });

    const result = await Promise.race([deadlockPromise, timeoutPromise]);
    
    // Cleanup temp file
    try { await fs.unlink(tempFilePath); } catch {}

    // Assert that it DID deadlock (confirming the vulnerability)
    assert.equal(
      result,
      'DEADLOCKED',
      'AttendanceRepository.clockIn MUST be confirmed to deadlock because store.withLock awaits store.save which also calls withLock!'
    );
  });

  // --------------------------------------------------------------------------
  // Dimension 2: Security & User Isolation
  // --------------------------------------------------------------------------
  test('CHALLENGE: Unauthenticated access to /api/v1/attendance/* is rejected with 401', async () => {
    const unauthClient = new ExpressClient();

    const todayRes = await unauthClient.request('GET', '/api/v1/attendance/today');
    assert.equal(todayRes.status, 401);
    assert.equal(todayRes.body.success, false);

    const clockInRes = await unauthClient.request('POST', '/api/v1/attendance/clock-in', { notes: 'Hack' });
    assert.equal(clockInRes.status, 401);

    const clockOutRes = await unauthClient.request('POST', '/api/v1/attendance/clock-out');
    assert.equal(clockOutRes.status, 401);

    const historyRes = await unauthClient.request('GET', '/api/v1/attendance/history');
    assert.equal(historyRes.status, 401);
  });

  test('CHALLENGE: User A cannot clock in or clock out for User B (User Isolation)', async () => {
    const clientA = new ExpressClient();
    await clientA.login('employee@nexusfinance.ng', 'EmployeePassword123!');

    // Try payload injection with targetUserId or userId
    const exploitPayload = {
      userId: 'usr-chioma-001',
      targetUserId: 'usr-chioma-001',
      employeeId: 'emp-chioma-01',
      notes: 'Attempting to clock in Chioma'
    };

    const res = await clientA.request('POST', '/api/v1/attendance/clock-in', exploitPayload);
    // Schema has .strict() so unknown fields like userId/targetUserId should be rejected with 400!
    assert.equal(res.status, 400, 'Strict schema validation should reject unrecognized properties');
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('CHALLENGE: Oversized notes (>500 chars) are strictly rejected with 400', async () => {
    const client = new ExpressClient();
    await client.login('employee@nexusfinance.ng', 'EmployeePassword123!');

    const hugeNotes = 'A'.repeat(501);
    const res = await client.request('POST', '/api/v1/attendance/clock-in', {
      notes: hugeNotes
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // --------------------------------------------------------------------------
  // Dimension 3: Malformed Timestamp Handling
  // --------------------------------------------------------------------------
  test('CHALLENGE: Invalid timestamp strings cause 500 CLOCK_IN_FAILED instead of 400 VALIDATION_ERROR', async () => {
    const client = new ExpressClient();
    await client.login('employee@nexusfinance.ng', 'EmployeePassword123!');

    const res = await client.request('POST', '/api/v1/attendance/clock-in', {
      timestamp: 'not-a-valid-date-string'
    });

    // In clockInSchema: `timestamp: z.string().optional()`.
    // Because it is NOT validated as an ISO datetime by Zod, the repository throws new Error('INVALID_TIMESTAMP')
    // which the controller catches and maps to 500 CLOCK_IN_FAILED!
    assert.ok(
      res.status === 500,
      `Expected status 500 due to unhandled INVALID_TIMESTAMP in controller, got ${res.status}`
    );
    assert.equal(res.body.error.code, 'CLOCK_IN_FAILED');
  });

  // --------------------------------------------------------------------------
  // Dimension 4: Persistence across restart in AtomicJsonStore
  // --------------------------------------------------------------------------
  test('CHALLENGE: AtomicJsonStore durability and reload across instances', async () => {
    const tempFilePath = path.resolve('tests', `tmp_persist_${crypto.randomUUID()}.json`);

    try {
      // Instance 1 writes record
      const store1 = new AtomicJsonStore<AttendanceRecord>(tempFilePath, () => []);
      await store1.initialize();
      const sampleRecord: AttendanceRecord = {
        id: 'att_test_1',
        userId: 'u1',
        employeeId: 'e1',
        staffId: 'NX-1',
        date: '2026-11-11',
        dayOfWeek: 'WEDNESDAY',
        isWeekend: false,
        schedule: { expectedStart: '08:00', expectedEnd: '17:00', standardHours: 9 },
        resumptionStatus: 'ON_TIME',
        firstClockIn: '2026-11-11T07:00:00.000Z',
        lastClockOut: null,
        lateMinutes: 0,
        totalMinutesWorked: 0,
        totalHoursWorked: 0,
        status: 'CLOCKED_IN',
        sessions: [{
          id: 's1',
          clockIn: '2026-11-11T07:00:00.000Z',
          clockOut: null,
          durationMinutes: 0
        }],
        createdAt: '2026-11-11T07:00:00.000Z',
        updatedAt: '2026-11-11T07:00:00.000Z'
      };

      await store1.save(sampleRecord);

      // Verify file exists on disk
      const fileData = await fs.readFile(tempFilePath, 'utf-8');
      const parsed = JSON.parse(fileData);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].id, 'att_test_1');

      // Instance 2 simulates server restart
      const store2 = new AtomicJsonStore<AttendanceRecord>(tempFilePath, () => []);
      await store2.initialize();
      const restored = store2.getById('att_test_1');
      assert.ok(restored);
      assert.equal(restored.status, 'CLOCKED_IN');
      assert.equal(restored.sessions[0].clockIn, '2026-11-11T07:00:00.000Z');
    } finally {
      try { await fs.unlink(tempFilePath); } catch {}
    }
  });

  // --------------------------------------------------------------------------
  // Dimension 5: High Volume Sessions and Total Minutes Worked Accuracy
  // --------------------------------------------------------------------------
  test('CHALLENGE: Calculation accuracy across 50 high-volume clock sessions', () => {
    const dummyStore = new AtomicJsonStore<AttendanceRecord>('', () => []);
    const repo = new AttendanceRepository(dummyStore);

    const baseRecord: AttendanceRecord = {
      id: 'att_high_vol',
      userId: 'u_vol',
      employeeId: 'e_vol',
      staffId: 'NX-VOL',
      date: '2026-11-11',
      dayOfWeek: 'WEDNESDAY',
      isWeekend: false,
      schedule: { expectedStart: '08:00', expectedEnd: '17:00', standardHours: 9 },
      resumptionStatus: 'ON_TIME',
      firstClockIn: '2026-11-11T07:00:00.000Z',
      lastClockOut: null,
      lateMinutes: 0,
      totalMinutesWorked: 0,
      totalHoursWorked: 0,
      status: 'CLOCKED_OUT',
      sessions: [],
      createdAt: '2026-11-11T07:00:00.000Z',
      updatedAt: '2026-11-11T07:00:00.000Z'
    };

    let expectedTotalMinutes = 0;
    // Add 50 sessions of varying durations (from 1 to 25 minutes)
    for (let i = 0; i < 50; i++) {
      const duration = (i % 25) + 1;
      expectedTotalMinutes += duration;
      baseRecord.sessions.push({
        id: `ses-${i}`,
        clockIn: new Date(1762848000000 + i * 3600000).toISOString(),
        clockOut: new Date(1762848000000 + i * 3600000 + duration * 60000).toISOString(),
        durationMinutes: duration
      });
    }

    baseRecord.totalMinutesWorked = expectedTotalMinutes;
    baseRecord.totalHoursWorked = Number((expectedTotalMinutes / 60).toFixed(2));

    const summary = repo.buildSummary(baseRecord);

    assert.equal(summary.completedMinutesWorked, expectedTotalMinutes);
    assert.equal(summary.totalMinutesWorked, expectedTotalMinutes);
    assert.equal(summary.totalHoursWorked, Number((expectedTotalMinutes / 60).toFixed(2)));
    const expectedHours = Math.floor(expectedTotalMinutes / 60);
    const expectedMins = expectedTotalMinutes % 60;
    assert.equal(summary.formattedTimeWorked, `${expectedHours}h ${String(expectedMins).padStart(2, '0')}m`);
  });

  // --------------------------------------------------------------------------
  // Dimension 6: Timezone & Punctuality Edge Cases (Africa/Lagos UTC+1)
  // --------------------------------------------------------------------------
  test('CHALLENGE: Boundary punctuality at exactly 08:15:00 vs 08:15:01 WAT', () => {
    // 08:15:00 WAT is 07:15:00 UTC
    const exactGraceEdge = new Date('2026-11-11T07:15:00.000Z');
    const ctxGrace = getLagosDateTime(exactGraceEdge);
    assert.equal(ctxGrace.totalMinutes, 495); // 8 * 60 + 15 = 495
    assert.equal(ctxGrace.totalMinutes <= 495, true, 'At 08:15:00 WAT, employee is still ON_TIME');

    // 08:15:01 WAT is 07:15:01 UTC -> seconds are ignored by totalMinutes (hours * 60 + minutes)
    const justPastGrace = new Date('2026-11-11T07:15:01.000Z');
    const ctxJustPast = getLagosDateTime(justPastGrace);
    assert.equal(ctxJustPast.totalMinutes, 495, 'totalMinutes truncates seconds so 08:15:01 still registers 495 mins');

    // 08:16:00 WAT is 07:16:00 UTC -> 496 mins -> LATE (+16m)
    const lateArrival = new Date('2026-11-11T07:16:00.000Z');
    const ctxLate = getLagosDateTime(lateArrival);
    assert.equal(ctxLate.totalMinutes, 496);
    assert.equal(ctxLate.totalMinutes - 480, 16, 'At 08:16:00 WAT, late minutes calculated from 08:00 (16m)');
  });
});
