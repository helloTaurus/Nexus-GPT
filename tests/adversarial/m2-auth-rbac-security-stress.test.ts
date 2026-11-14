import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import crypto from 'node:crypto';

import { createApp } from '../../update/server/app.ts';
import {
  initializeDataStore,
  getUserRepository,
  getSessionRepository,
  getLeaveRepository,
  getExpenseRepository
} from '../../update/server/repositories/dataStore.ts';
import { PasswordService } from '../../update/server/services/passwordService.ts';
import { createRateLimiter } from '../../update/server/middleware/rateLimiter.ts';
import { updateProfileSchema } from '../../update/server/schemas/profileSchemas.ts';
import { loginSchema } from '../../update/server/schemas/authSchemas.ts';
import { SEED_USERS } from '../fixtures/seedData.ts';

// In-process Express invocation helper with zero TCP socket overhead
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

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }
    if (options.ip) {
      req.headers['x-forwarded-for'] = options.ip;
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

describe('Milestone 2 Adversarial Stress Suite: Auth, Session & Security Invariants', () => {
  let app: any;
  let employeeCookie: string;
  let managerCookie: string;
  let adminCookie: string;

  before(async () => {
    await initializeDataStore();
    app = createApp();

    // Authenticate and cache session cookies with distinct IPs to prevent test rate limiting
    const empRes = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
      body: { email: 'employee@nexusfinance.ng', password: 'EmployeePassword123!' },
      ip: '10.0.1.1'
    });
    assert.equal(empRes.status, 200, `Employee login failed: ${JSON.stringify(empRes.body)}`);
    employeeCookie = String(empRes.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];

    const mgrRes = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
      body: { email: 'manager@nexusfinance.ng', password: 'ManagerPassword123!' },
      ip: '10.0.1.2'
    });
    assert.equal(mgrRes.status, 200, `Manager login failed: ${JSON.stringify(mgrRes.body)}`);
    managerCookie = String(mgrRes.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];

    const admRes = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
      body: { email: 'admin@nexusfinance.ng', password: 'AdminPassword123!' },
      ip: '10.0.1.3'
    });
    assert.equal(admRes.status, 200, `Admin login failed: ${JSON.stringify(admRes.body)}`);
    adminCookie = String(admRes.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];
  });

  // =========================================================================
  // VECTOR 1: Malformed & Tampered Cookies and Session Invariants
  // =========================================================================
  describe('Vector 1: Malformed & Tampered Cookies / Session Invariants', () => {
    test('1.1: Request without any session cookie returns 401 UNAUTHORIZED', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.ok(res.body.error.correlationId);
    });

    test('1.2: Request with garbage session token returns 401 UNAUTHORIZED', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: 'nexus_session=completely_bogus_token_hex_999999' }
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    test('1.3: Request with empty cookie value returns 401 UNAUTHORIZED', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: 'nexus_session=' }
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    test('1.4: Request with directory traversal characters in cookie returns 401 UNAUTHORIZED without path leakage', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: 'nexus_session=../../../../../../etc/passwd' }
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.ok(!res.rawBody.includes('passwd'));
    });

    test('1.5: Tampered session token (1-character modification of valid session) returns 401 UNAUTHORIZED', async () => {
      const tampered = (employeeCookie[0] === 'a' ? 'b' : 'a') + employeeCookie.slice(1);
      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: `nexus_session=${tampered}` }
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    test('1.6: Revoked session cannot be reused after /logout', async () => {
      // Create a dedicated session for logout test
      const tempLogin = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: { email: 'chioma.okonkwo@nexusfinance.ng', password: 'ChiomaPassword123!' },
        ip: '10.0.2.1'
      });
      assert.equal(tempLogin.status, 200);
      const tempCookie = String(tempLogin.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];

      // Verify active
      const meRes = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: `nexus_session=${tempCookie}` }
      });
      assert.equal(meRes.status, 200);

      // Perform logout
      const logoutRes = await invokeExpress(app, 'POST', '/api/v1/auth/logout', {
        headers: { cookie: `nexus_session=${tempCookie}` }
      });
      assert.equal(logoutRes.status, 200);

      // Attempt re-use of revoked token
      const reuseRes = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: `nexus_session=${tempCookie}` }
      });
      assert.equal(reuseRes.status, 401);
      assert.equal(reuseRes.body.error.code, 'UNAUTHORIZED');
    });

    test('1.7: Expired session (rolling inactivity > 30 minutes) is rejected and purged', async () => {
      // Create a dedicated session to age
      const tempLogin = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: { email: 'finance@nexusfinance.ng', password: 'FinancePassword123!' },
        ip: '10.0.2.2'
      });
      assert.equal(tempLogin.status, 200);
      const tempCookie = String(tempLogin.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];

      const sessionRepo = getSessionRepository();
      const session = sessionRepo.findByToken(tempCookie);
      assert.ok(session);

      // Artificially age lastActivityAt by 35 minutes
      const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      session.lastActivityAt = thirtyFiveMinsAgo;
      await (sessionRepo as any).store.save(session);

      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: `nexus_session=${tempCookie}` }
      });
      assert.equal(res.status, 401);
      assert.ok(res.body.error.message.includes('expired'));

      // Verify session was purged from store
      assert.equal(sessionRepo.findByToken(tempCookie), null);
    });

    test('1.8: Absolute session expiry (> 8 hours) rejects session even if active', async () => {
      const tempLogin = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: { email: 'depthead@nexusfinance.ng', password: 'DeptHeadPassword123!' },
        ip: '10.0.2.3'
      });
      assert.equal(tempLogin.status, 200);
      const tempCookie = String(tempLogin.headers['set-cookie']).match(/nexus_session=([^;]+)/)![1];

      const sessionRepo = getSessionRepository();
      const session = sessionRepo.findByToken(tempCookie);
      assert.ok(session);

      // Artificially age createdAt by 8.5 hours while lastActivityAt is current
      const eightHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
      session.createdAt = eightHoursAgo;
      session.lastActivityAt = new Date().toISOString();
      await (sessionRepo as any).store.save(session);

      const res = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { cookie: `nexus_session=${tempCookie}` }
      });
      assert.equal(res.status, 401);
      assert.ok(res.body.error.message.includes('expired'));
    });

    test('1.9: Valid session for suspended / deactivated user returns 403 ACCOUNT_INACTIVE', async () => {
      const inactiveUser = SEED_USERS.find(u => u.status === 'INACTIVE');
      assert.ok(inactiveUser);

      const loginRes = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: { email: inactiveUser.email, password: inactiveUser.password },
        ip: '10.0.2.4'
      });
      assert.equal(loginRes.status, 403);
      assert.equal(loginRes.body.error.code, 'ACCOUNT_INACTIVE');
    });

    test('1.10: Bearer token header works as alternative to cookie but invalid token is rejected', async () => {
      // Valid Bearer token
      const validRes = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { authorization: `Bearer ${employeeCookie}` }
      });
      assert.equal(validRes.status, 200);

      // Invalid Bearer token
      const invalidRes = await invokeExpress(app, 'GET', '/api/v1/auth/me', {
        headers: { authorization: `Bearer invalid_${employeeCookie}` }
      });
      assert.equal(invalidRes.status, 401);
    });
  });

  // =========================================================================
  // VECTOR 2: Brute-Force & Credential Stuffing & Rate Limiting
  // =========================================================================
  describe('Vector 2: Brute-Force, Rate Limiting & Credential Stuffing', () => {
    test('2.1: RateLimiter blocks excessive requests after window maximum and returns 429', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 3,
        message: 'Too many authentication attempts'
      });

      const responses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const req: any = { headers: {}, ip: '192.168.10.50' };
        let statusCode = 200;
        const res: any = {
          setHeader: () => {},
          status: (code: number) => { statusCode = code; return res; },
          json: () => {}
        };
        limiter(req, res, () => {});
        responses.push(statusCode);
      }

      assert.deepEqual(responses, [200, 200, 200, 429, 429]);
    });

    test('2.2: RateLimiter sets standardized headers: RateLimit-Limit, Remaining, Reset', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        message: 'Rate limit'
      });

      const setHeaders: Record<string, any> = {};
      const req: any = { headers: {}, ip: '10.20.30.40' };
      const res: any = {
        setHeader: (k: string, v: any) => { setHeaders[k] = v; },
        status: () => res,
        json: () => {}
      };
      limiter(req, res, () => {});

      assert.equal(setHeaders['RateLimit-Limit'], 5);
      assert.equal(setHeaders['RateLimit-Remaining'], 4);
      assert.ok(setHeaders['RateLimit-Reset'] > 0);
    });

    test('2.3: [Vulnerability Finding] RateLimiter blindly trusts client X-Forwarded-For header allowing bypass', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 2,
        message: 'Rate limited'
      });

      // An attacker rotates X-Forwarded-For header to bypass the 2-request limit
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const req: any = {
          headers: { 'x-forwarded-for': `198.51.100.${i}` },
          ip: '127.0.0.1'
        };
        let statusCode = 200;
        const res: any = {
          setHeader: () => {},
          status: (code: number) => { statusCode = code; return res; },
          json: () => {}
        };
        limiter(req, res, () => {});
        statuses.push(statusCode);
      }

      // Without reverse-proxy trust validation, all 5 requests pass (all 200)
      assert.deepEqual(statuses, [200, 200, 200, 200, 200]);
    });

    test('2.4: Credential stuffing returns uniform 401 INVALID_CREDENTIALS for both wrong password and unknown email', async () => {
      // Test 1: Existing user with wrong password
      const wrongPassRes = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: { email: 'employee@nexusfinance.ng', password: 'WrongPassword999!' },
        ip: '10.0.3.1'
      });
      assert.equal(wrongPassRes.status, 401);
      assert.equal(wrongPassRes.body.error.code, 'INVALID_CREDENTIALS');
      assert.equal(wrongPassRes.body.error.message, 'Invalid email or password');

      // Test 2: Non-existent user
      const unknownUserRes = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: { email: 'ghost_staff_not_real@nexusfinance.ng', password: 'WrongPassword999!' },
        ip: '10.0.3.2'
      });
      assert.equal(unknownUserRes.status, 401);
      assert.equal(unknownUserRes.body.error.code, 'INVALID_CREDENTIALS');
      assert.equal(unknownUserRes.body.error.message, 'Invalid email or password');

      // Verified: error response envelopes are completely identical (no user enumeration via error message)
      assert.equal(wrongPassRes.body.error.code, unknownUserRes.body.error.code);
      assert.equal(wrongPassRes.body.error.message, unknownUserRes.body.error.message);
    });
  });

  // =========================================================================
  // VECTOR 3: Privilege Escalation & RBAC Boundary Attacks
  // =========================================================================
  describe('Vector 3: Privilege Escalation & RBAC Authorization Invariants', () => {
    test('3.1: Vertical Escalation: Unprivileged employee accessing /api/v1/admin/audit-logs is rejected with 403', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/admin/audit-logs', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('3.2: Vertical Escalation: Manager accessing /api/v1/admin/audit-logs is rejected with 403', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/admin/audit-logs', {
        headers: { cookie: `nexus_session=${managerCookie}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('3.3: Vertical Escalation: Employee accessing /api/v1/admin/settings is rejected with 403', async () => {
      const res = await invokeExpress(app, 'GET', '/api/v1/admin/settings', {
        headers: { cookie: `nexus_session=${employeeCookie}` }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('3.4: Vertical Escalation: Employee attempting POST /api/v1/employees is rejected with 403', async () => {
      const res = await invokeExpress(app, 'POST', '/api/v1/employees', {
        headers: { cookie: `nexus_session=${employeeCookie}` },
        body: {
          firstName: 'Attacker',
          lastName: 'Injected',
          email: 'attacker@nexusfinance.ng',
          departmentId: 'dept-cru',
          designationId: 'des-ra'
        }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('3.5: Vertical Escalation: Manager attempting POST /api/v1/employees is rejected with 403', async () => {
      const res = await invokeExpress(app, 'POST', '/api/v1/employees', {
        headers: { cookie: `nexus_session=${managerCookie}` },
        body: {
          firstName: 'ManagerHire',
          lastName: 'Unauthorized',
          email: 'mgr.hire@nexusfinance.ng',
          departmentId: 'dept-cru',
          designationId: 'des-ra'
        }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    test('3.6: Privilege Escalation: Employee attempting to modify restricted profile fields (salary, role, title) is rejected with 403', async () => {
      const res = await invokeExpress(app, 'PUT', '/api/v1/portal/profile', {
        headers: { cookie: `nexus_session=${employeeCookie}` },
        body: {
          role: 'ADMIN',
          salary: 50000000,
          title: 'Managing Director'
        }
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
      assert.ok(res.body.error.message.includes('restricted'));
    });

    test('3.7: Self-Approval Prohibition: Manager cannot approve their own leave request (403 SELF_APPROVAL_PROHIBITED)', async () => {
      // Submit leave as manager with random dates to avoid DATE_OVERLAP
      const randDay = Math.floor(10 + Math.random() * 15);
      const submitRes = await invokeExpress(app, 'POST', '/api/v1/leaves/requests', {
        headers: { cookie: `nexus_session=${managerCookie}` },
        body: {
          leaveTypeId: 'lt-annual',
          startDate: `2026-11-${randDay}`,
          endDate: `2026-11-${randDay}`,
          reason: 'Manager vacation'
        }
      });
      assert.equal(submitRes.status, 201);
      const leaveId = submitRes.body.data.id;

      // Attempt self-approval
      const approveRes = await invokeExpress(app, 'PATCH', `/api/v1/leaves/requests/${leaveId}/action`, {
        headers: { cookie: `nexus_session=${managerCookie}` },
        body: {
          action: 'APPROVE',
          decisionReason: 'Self-approval exploit attempt'
        }
      });
      assert.equal(approveRes.status, 403);
      assert.equal(approveRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
    });

    test('3.8: Self-Approval Prohibition: Manager cannot approve their own expense report (403 SELF_APPROVAL_PROHIBITED)', async () => {
      // Submit expense claim as manager
      const submitRes = await invokeExpress(app, 'POST', '/api/v1/expenses/reports', {
        headers: { cookie: `nexus_session=${managerCookie}` },
        body: {
          title: 'Manager Offsite Lunch',
          currency: 'NGN',
          items: [
            {
              categoryId: 'cat-hosp',
              amount: 4500,
              merchantName: 'Local Kitchen'
            }
          ]
        }
      });
      assert.equal(submitRes.status, 201);
      const reportId = submitRes.body.data.id;

      // Attempt self-approval via /action
      const reviewRes = await invokeExpress(app, 'PATCH', `/api/v1/expenses/reports/${reportId}/action`, {
        headers: { cookie: `nexus_session=${managerCookie}` },
        body: {
          action: 'APPROVE',
          comments: 'Self-approving my claim'
        }
      });
      assert.equal(reviewRes.status, 403);
      assert.equal(reviewRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
    });

    test('3.9: Hierarchical Guard: Manager cannot review leave for employees outside their reporting hierarchy', async () => {
      const leaveRepo = getLeaveRepository();

      // Create a foreign request assigned to emp-depthead-01
      const foreignReqId = `lr-foreign-${crypto.randomUUID().slice(0, 6)}`;
      await leaveRepo.createRequest({
        id: foreignReqId,
        requestNumber: 'LR-FOREIGN-01',
        employeeId: 'emp-depthead-01',
        leaveTypeId: 'lt-annual',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        isHalfDay: false,
        totalDays: 3,
        reason: 'Dept head leave',
        status: 'SUBMITTED',
        assignedApproverId: 'emp-admin-01',
        submittedAt: new Date().toISOString()
      });

      const reviewRes = await invokeExpress(app, 'PATCH', `/api/v1/leaves/requests/${foreignReqId}/action`, {
        headers: { cookie: `nexus_session=${managerCookie}` },
        body: { action: 'APPROVE' }
      });
      assert.equal(reviewRes.status, 403);
      assert.equal(reviewRes.body.error.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // VECTOR 4: Timing Attack Verification on Password Verification
  // =========================================================================
  describe('Vector 4: Timing Attack Verification & Password Security', () => {
    test('4.1: PasswordService uses deterministic Scrypt hashing with cryptographic salt', () => {
      const hash1 = PasswordService.hashPassword('SecretPassword123!');
      const hash2 = PasswordService.hashPassword('SecretPassword123!');

      // Hashes must have unique salts even for identical passwords
      assert.notEqual(hash1, hash2);
      assert.ok(hash1.startsWith('$scrypt$N=16384,r=8,p=1$'));
      assert.ok(hash2.startsWith('$scrypt$N=16384,r=8,p=1$'));

      // Both must verify correctly
      assert.equal(PasswordService.verifyPassword('SecretPassword123!', hash1), true);
      assert.equal(PasswordService.verifyPassword('SecretPassword123!', hash2), true);
      assert.equal(PasswordService.verifyPassword('WrongPassword!', hash1), false);
    });

    test('4.2: PasswordService gracefully rejects corrupt hash strings without unhandled exceptions', () => {
      assert.equal(PasswordService.verifyPassword('test', ''), false);
      assert.equal(PasswordService.verifyPassword('test', '$scrypt$invalid_parts'), false);
      assert.equal(PasswordService.verifyPassword('test', '$scrypt$N=16384,r=8,p=1$short'), false);
      assert.equal(PasswordService.verifyPassword('test', 'not_a_hash'), false);
    });

    test('4.3: [Empirical Finding] Timing attack measurement: Scrypt verification constant-time check & side-channel analysis', async () => {
      // 1. PasswordService constant-time verification check
      const hash = PasswordService.hashPassword('BenchmarkPassword123!');
      const validStart = performance.now();
      const validRes = PasswordService.verifyPassword('BenchmarkPassword123!', hash);
      const validDuration = performance.now() - validStart;
      assert.equal(validRes, true);

      const invalidStart = performance.now();
      const invalidRes = PasswordService.verifyPassword('WrongPasswordLength!', hash);
      const invalidDuration = performance.now() - invalidStart;
      assert.equal(invalidRes, false);

      // Scrypt duration is dominated by derivation (~50-80ms), verifying computation occurred
      assert.ok(validDuration > 10, 'Expected Scrypt compute duration > 10ms');
      assert.ok(invalidDuration > 10, 'Expected Scrypt compute duration > 10ms');

      // 2. Login endpoint timing disparity measurement (using fresh IPs to bypass limiter)
      const existingDurations: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await invokeExpress(app, 'POST', '/api/v1/auth/login', {
          body: { email: 'employee@nexusfinance.ng', password: 'WrongPassword123!' },
          ip: `10.0.4.${i}`
        });
        existingDurations.push(performance.now() - start);
      }

      const nonExistingDurations: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await invokeExpress(app, 'POST', '/api/v1/auth/login', {
          body: { email: `nonexistent_${Date.now()}_${i}@nexusfinance.ng`, password: 'WrongPassword123!' },
          ip: `10.0.5.${i}`
        });
        nonExistingDurations.push(performance.now() - start);
      }

      const avgExisting = existingDurations.reduce((a, b) => a + b, 0) / existingDurations.length;
      const avgNonExisting = nonExistingDurations.reduce((a, b) => a + b, 0) / nonExistingDurations.length;

      // Disparity ratio confirms side-channel presence for user enumeration (CWE-208)
      const disparityRatio = avgExisting / Math.max(avgNonExisting, 0.1);
      assert.ok(disparityRatio > 3, `Expected timing disparity ratio > 3x, observed ${disparityRatio.toFixed(1)}x`);
    });
  });

  // =========================================================================
  // VECTOR 5: Schema Fuzzing, Injection & Prototype Pollution
  // =========================================================================
  describe('Vector 5: Schema Fuzzing, Injection Strings & Prototype Pollution', () => {
    test('5.1: SQL Injection payloads in login fields are rejected by schema or safely handled without 500 errors', async () => {
      const sqlPayloads = [
        "' OR '1'='1",
        "' OR 1=1--",
        "admin'--",
        "admin'/*",
        "'; DROP TABLE users; --"
      ];

      for (let i = 0; i < sqlPayloads.length; i++) {
        const payload = sqlPayloads[i];
        const res = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
          body: { email: payload, password: 'password' },
          ip: `10.0.6.${i}`
        });
        // Must be rejected by email schema (400) or invalid credentials (401), NEVER 500
        assert.ok([400, 401].includes(res.status), `Unexpected status ${res.status} for payload: ${payload}`);
        assert.equal(res.body.success, false);
      }
    });

    test('5.2: Prototype Pollution payload in updateProfileSchema is stripped and cannot pollute Object.prototype', () => {
      const pollutedKey = `polluted_${crypto.randomUUID().replace(/-/g, '')}`;
      const payload = JSON.parse(`{
        "__proto__": { "${pollutedKey}": true },
        "phone": "+2348011223344"
      }`);

      const result = updateProfileSchema.safeParse(payload);
      assert.equal(result.success, true);
      assert.equal(result.data.phone, '+2348011223344');

      // Crucial assertion: Object.prototype must NOT be polluted
      assert.equal((Object.prototype as any)[pollutedKey], undefined);
      assert.equal(({} as any)[pollutedKey], undefined);
    });

    test('5.3: [Vulnerability Finding] Constructor prototype property bypass in ZodObject.strict()', () => {
      // In JS, ('constructor' in this.shape) evaluates to true because of Object.prototype.constructor.
      // Therefore, ZodObject strict check does not flag 'constructor' as an unrecognized key!
      const payload = {
        constructor: {
          prototype: { adminPolluted: true }
        }
      };

      const result = updateProfileSchema.safeParse(payload);
      // Because ('constructor' in this.shape) is true, strict validation does not flag it as an issue
      // However, output is built only from Object.entries(this.shape), so constructor is omitted from data.
      assert.equal(result.success, true);
      assert.equal((result.data as any).constructor, Object.prototype.constructor);
      // Verify no prototype pollution occurred
      assert.equal(({} as any).adminPolluted, undefined);
    });

    test('5.4: NUBAN account number format strictly rejects non-digit and malformed strings (422 INVALID_NUBAN)', async () => {
      const invalidNubans = [
        '123456789',           // 9 digits
        '12345678901',         // 11 digits
        '12345abcde',         // alphanumeric
        '<script>12</script>', // XSS
        '-123456789'          // negative
      ];

      for (const nuban of invalidNubans) {
        const res = await invokeExpress(app, 'PUT', '/api/v1/portal/profile', {
          headers: { cookie: `nexus_session=${employeeCookie}` },
          body: { bankAccountNumber: nuban }
        });
        assert.equal(res.status, 422, `Expected 422 for NUBAN ${nuban}, got ${res.status}`);
        assert.equal(res.body.error.code, 'INVALID_NUBAN');
      }
    });

    test('5.5: Password recovery verification strictly rejects weak passwords (<8 chars) with 422 WEAK_PASSWORD', async () => {
      const res = await invokeExpress(app, 'POST', '/api/v1/auth/recover/verify', {
        body: {
          email: 'employee@nexusfinance.ng',
          token: '123456',
          newPassword: 'short' // 5 chars (< 8)
        }
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'WEAK_PASSWORD');
    });

    test('5.6: Deeply nested JSON object is handled securely without crash or stack overflow', async () => {
      let deep: any = { value: 'leaf' };
      for (let i = 0; i < 30; i++) {
        deep = { nested: deep };
      }

      const res = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: deep,
        ip: '10.0.7.1'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('5.7: Type confusion payload (arrays or integers instead of strings) is safely caught by Zod schema', async () => {
      const res = await invokeExpress(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: ['admin@nexusfinance.ng'],
          password: 12345678
        },
        ip: '10.0.7.2'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });
});
