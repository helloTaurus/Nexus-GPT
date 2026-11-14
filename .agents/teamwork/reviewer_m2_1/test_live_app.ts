import assert from 'node:assert/strict';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import { createApp } from '../../../update/server/app.ts';
import { initializeDataStore, closeDataStore, getUserRepository } from '../../../update/server/repositories/dataStore.ts';

// In-memory mock request dispatcher for Express using Node http internals
function dispatchExpress(app: any, options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  return new Promise((resolve) => {
    const postData = options.body ? JSON.stringify(options.body) : '';

    const socket = new PassThrough();
    (socket as any).remoteAddress = '127.0.0.1';
    (socket as any).encrypted = false;

    const req = new http.IncomingMessage(socket as any);
    req.method = options.method.toUpperCase();
    req.url = options.url;
    req.headers = {
      host: '127.0.0.1',
      ...(options.headers || {})
    };
    if (postData && !req.headers['content-type']) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = Buffer.byteLength(postData).toString();
    }

    const res = new http.ServerResponse(req);
    const responseStream = new PassThrough();
    res.assignSocket(responseStream as any);

    let responseBuffer = '';
    responseStream.on('data', (chunk) => {
      responseBuffer += chunk.toString();
    });

    res.on('finish', () => {
      // Parse HTTP headers and body from responseStream buffer
      // res.getHeaders() returns headers map
      const headers = res.getHeaders() as Record<string, string>;
      
      // The body may be in responseBuffer after header section (\r\n\r\n)
      let bodyText = '';
      const splitIdx = responseBuffer.indexOf('\r\n\r\n');
      if (splitIdx !== -1) {
        bodyText = responseBuffer.slice(splitIdx + 4);
      } else {
        bodyText = responseBuffer;
      }

      let parsed: any = bodyText;
      try {
        parsed = JSON.parse(bodyText);
      } catch {}

      resolve({
        status: res.statusCode,
        headers,
        body: parsed
      });
    });

    // Invoke Express
    app(req, res);

    // Push body into request
    if (postData) {
      req.push(postData);
    }
    req.push(null);
  });
}

async function runTests() {
  console.log('--- Starting In-Process Express App Direct Dispatch Verification ---');

  await initializeDataStore();
  const userRepo = getUserRepository();
  const adminUser = userRepo.findByEmail('admin@nexusfinance.ng');
  assert.ok(adminUser, 'Admin user must exist in data store');

  const app = createApp();

  // TEST 1: Health endpoint & Security Headers
  console.log('Test 1: GET /api/v1/health & Security Headers');
  const healthRes = await dispatchExpress(app, { method: 'GET', url: '/api/v1/health' });
  assert.equal(healthRes.status, 200, `Health status should be 200, got ${healthRes.status}`);
  assert.equal(healthRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(healthRes.headers['x-frame-options'], 'DENY');
  assert.ok(String(healthRes.headers['strict-transport-security']).includes('max-age=31536000'));
  assert.ok(String(healthRes.headers['content-security-policy']).includes("default-src 'self'"));
  assert.ok(healthRes.headers['x-correlation-id'], 'Must have X-Correlation-ID header');
  assert.ok(String(healthRes.headers['x-correlation-id']).startsWith('corr_'), 'Correlation ID must start with corr_');
  console.log('  PASSED: Health endpoint and security headers verified');

  // TEST 2: Correlation ID incoming echo vs generate
  console.log('Test 2: Correlation ID validation and generation');
  const customCorr = 'corr_test-12345678-abcd';
  const corrRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/health',
    headers: { 'x-correlation-id': customCorr }
  });
  assert.equal(corrRes.headers['x-correlation-id'], customCorr, 'Must echo valid corr_ incoming header');

  const invalidCorr = 'malicious_non_corr_id';
  const invalidCorrRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/health',
    headers: { 'x-correlation-id': invalidCorr }
  });
  assert.ok(String(invalidCorrRes.headers['x-correlation-id']).startsWith('corr_'), 'Must sanitize non-corr_ header');
  assert.notEqual(invalidCorrRes.headers['x-correlation-id'], invalidCorr, 'Must NOT echo un-prefixed ID');
  console.log('  PASSED: Correlation ID security rules verified');

  // TEST 3: 404 Handler RFC 7807 compliance & Security Headers
  console.log('Test 3: 404 Handler RFC 7807 compliance');
  const notFoundRes = await dispatchExpress(app, { method: 'GET', url: '/api/v1/non-existent-endpoint-xyz' });
  assert.equal(notFoundRes.status, 404);
  assert.equal(notFoundRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(notFoundRes.headers['x-frame-options'], 'DENY');
  assert.ok(notFoundRes.body.error, '404 must return RFC 7807 problem details object');
  assert.equal(notFoundRes.body.error.code, 'NOT_FOUND');
  assert.ok(notFoundRes.body.error.correlationId);
  assert.ok(String(notFoundRes.body.error.correlationId).startsWith('corr_'));
  console.log('  PASSED: 404 handler verified');

  // TEST 4: Login & HttpOnly / SameSite=Strict Cookie
  console.log('Test 4: Login & Session Cookie');
  const loginRes = await dispatchExpress(app, {
    method: 'POST',
    url: '/api/v1/auth/login',
    body: {
      email: 'employee@nexusfinance.ng',
      password: 'EmployeePassword123!'
    }
  });
  assert.equal(loginRes.status, 200, `Login failed: ${JSON.stringify(loginRes.body)}`);
  assert.equal(loginRes.body.success, true);
  assert.equal(loginRes.body.user.email, 'employee@nexusfinance.ng');
  assert.equal(loginRes.body.user.role, 'EMPLOYEE');

  const setCookie = loginRes.headers['set-cookie'];
  assert.ok(setCookie, 'Set-Cookie header must be present on login');
  const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  assert.ok(cookieStr.includes('nexus_session='), 'Cookie name must be nexus_session');
  assert.ok(cookieStr.toLowerCase().includes('httponly'), 'Cookie must have HttpOnly');
  assert.ok(cookieStr.toLowerCase().includes('samesite=strict'), 'Cookie must have SameSite=Strict');
  console.log('  PASSED: Login and secure session cookie verified');

  // Extract session token
  const tokenMatch = cookieStr.match(/nexus_session=([^;]+)/);
  const sessionToken = tokenMatch ? tokenMatch[1] : '';
  assert.ok(sessionToken, 'Session token must be extractable');

  // TEST 5: Authenticated route with session cookie
  console.log('Test 5: Authenticated GET /api/v1/auth/me');
  const meRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      'cookie': `nexus_session=${sessionToken}`
    }
  });
  assert.equal(meRes.status, 200, `Me endpoint failed: ${JSON.stringify(meRes.body)}`);
  assert.equal(meRes.body.user.email, 'employee@nexusfinance.ng');
  console.log('  PASSED: Authenticated session verified');

  // TEST 6: RBAC endpoint guard
  console.log('Test 6: RBAC: Employee blocked from admin audit logs (403)');
  const rbacRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/admin/audit-logs',
    headers: {
      'cookie': `nexus_session=${sessionToken}`
    }
  });
  assert.equal(rbacRes.status, 403, `Expected 403, got ${rbacRes.status}`);
  assert.equal(rbacRes.body.error.code, 'FORBIDDEN');
  console.log('  PASSED: RBAC unauthorized guard verified');

  // TEST 7: Zero-trust input validation (NUBAN 10 digits check)
  console.log('Test 7: Zero-trust input validation: NUBAN account format');
  const nubanRes = await dispatchExpress(app, {
    method: 'PATCH',
    url: '/api/v1/portal/profile',
    headers: {
      'cookie': `nexus_session=${sessionToken}`
    },
    body: {
      bankAccountNumber: '12345' // Too short
    }
  });
  assert.equal(nubanRes.status, 422, `Expected 422, got ${nubanRes.status}`);
  assert.equal(nubanRes.body.error.code, 'INVALID_NUBAN');
  console.log('  PASSED: Zero-trust NUBAN validation verified');

  // TEST 8: Restricted profile field modification rejected with 403
  console.log('Test 8: Zero-trust field protection: salary/role tampering rejected with 403');
  const tamperedRes = await dispatchExpress(app, {
    method: 'PATCH',
    url: '/api/v1/portal/profile',
    headers: {
      'cookie': `nexus_session=${sessionToken}`
    },
    body: {
      salary: 99999999
    }
  });
  assert.equal(tamperedRes.status, 403, `Expected 403, got ${tamperedRes.status}`);
  assert.equal(tamperedRes.body.error.code, 'FORBIDDEN');
  console.log('  PASSED: Zero-trust restricted field protection verified');

  // TEST 9: Logout revokes session
  console.log('Test 9: Logout clears session');
  const logoutRes = await dispatchExpress(app, {
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: {
      'cookie': `nexus_session=${sessionToken}`
    }
  });
  assert.equal(logoutRes.status, 200);
  const logoutCookie = String(logoutRes.headers['set-cookie']);
  assert.ok(logoutCookie.includes('nexus_session=;'), 'Logout must clear cookie');
  assert.ok(logoutCookie.includes('Max-Age=0'), 'Logout must set Max-Age=0');

  // Try using old session token -> must be 401
  const meRevokedRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      'cookie': `nexus_session=${sessionToken}`
    }
  });
  assert.equal(meRevokedRes.status, 401, 'Old session token must be revoked');
  console.log('  PASSED: Logout revocation verified');

  await closeDataStore();
  console.log('--- ALL IN-PROCESS EXPRESS APP TESTS PASSED WITH 100% SUCCESS ---');
}

runTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
