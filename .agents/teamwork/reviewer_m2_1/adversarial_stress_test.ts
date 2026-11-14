import assert from 'node:assert/strict';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import express from '../../../update/node_modules/express/index.js';
import { createApp } from '../../../update/server/app.ts';
import { correlationIdMiddleware } from '../../../update/server/middleware/correlationId.ts';
import { securityHeadersMiddleware } from '../../../update/server/middleware/securityHeaders.ts';
import { errorHandler } from '../../../update/server/middleware/errorHandler.ts';
import {
  initializeDataStore,
  closeDataStore,
  getUserRepository,
  getAuditService
} from '../../../update/server/repositories/dataStore.ts';

// In-memory mock request dispatcher
function dispatchExpress(app: any, options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  return new Promise((resolve) => {
    const postData = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';

    const socket = new PassThrough();
    (socket as any).remoteAddress = '192.168.1.50';
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
      const headers = res.getHeaders() as Record<string, string>;
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

    app(req, res);

    if (postData) {
      req.push(postData);
    }
    req.push(null);
  });
}

async function runAdversarialTests() {
  console.log('=== STARTING ADVERSARIAL STRESS TESTING ===');

  await initializeDataStore();
  const app = createApp();

  // STRESS TEST 1: Fail-Secure 500 Error Sanitization
  console.log('Stress Test 1: Fail-Secure Error Sanitization (Inject internal failure)');
  const errorTestApp = express();
  errorTestApp.use(correlationIdMiddleware);
  errorTestApp.use(securityHeadersMiddleware);
  errorTestApp.get('/explode', () => {
    const sensitiveError = new Error('Database connection failed at /var/secret/db.sqlite: syntax error near "SELECT * FROM passwords"');
    sensitiveError.stack = 'Error: SecretStack\n at Database.query (/internal/server/secret/db.ts:42:15)\n at Repository.find (/internal/server/secret/repo.ts:99:20)';
    throw sensitiveError;
  });
  errorTestApp.use(errorHandler);

  const errRes = await dispatchExpress(errorTestApp, {
    method: 'GET',
    url: '/explode'
  });

  assert.equal(errRes.status, 500, `Expected 500 status, got ${errRes.status}`);
  assert.equal(errRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(errRes.headers['x-frame-options'], 'DENY');
  assert.ok(errRes.headers['x-correlation-id'], 'Must have X-Correlation-ID header');
  assert.ok(String(errRes.headers['x-correlation-id']).startsWith('corr_'), 'Correlation ID must start with corr_');

  const errBodyStr = JSON.stringify(errRes.body);
  assert.equal(errRes.body.success, false);
  assert.equal(errRes.body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(errRes.body.error.message, 'An unexpected internal server error occurred');
  assert.equal(errRes.body.error.correlationId, errRes.headers['x-correlation-id']);

  // ZERO Stack Trace or Internal Path Disclosure Check
  assert.ok(!errBodyStr.includes('SecretStack'), 'Security Violation: Internal stack trace leaked to client!');
  assert.ok(!errBodyStr.includes('/var/secret'), 'Security Violation: Internal filesystem path leaked to client!');
  assert.ok(!errBodyStr.includes('sqlite'), 'Security Violation: Database engine info leaked to client!');
  assert.ok(!errBodyStr.includes('passwords'), 'Security Violation: Query schema leaked to client!');
  assert.ok(!errBodyStr.includes('at Database.query'), 'Security Violation: Stack frames leaked to client!');
  console.log('  PASSED: Zero internal leakage confirmed on unhandled 500 error');

  // STRESS TEST 2: CORS Attack from Untrusted Origin
  console.log('Stress Test 2: CORS from Untrusted Origin (https://evil-attacker.com)');
  const corsEvilRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/health',
    headers: {
      origin: 'https://evil-attacker.com'
    }
  });
  assert.notEqual(corsEvilRes.headers['access-control-allow-origin'], 'https://evil-attacker.com',
    'CORS Violation: Untrusted origin was echoed in Access-Control-Allow-Origin');
  assert.equal(corsEvilRes.headers['access-control-allow-credentials'], undefined,
    'CORS Violation: Credentials allowed for untrusted origin');
  console.log('  PASSED: CORS strictly rejects untrusted origins');

  // STRESS TEST 3: CORS from Legitimate Whitelisted Origin
  console.log('Stress Test 3: CORS from Whitelisted Origin (http://localhost:5173)');
  const corsGoodRes = await dispatchExpress(app, {
    method: 'GET',
    url: '/api/v1/health',
    headers: {
      origin: 'http://localhost:5173'
    }
  });
  assert.equal(corsGoodRes.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(corsGoodRes.headers['access-control-allow-credentials'], 'true');
  console.log('  PASSED: CORS properly enables whitelisted origin with credentials');

  // STRESS TEST 4: Suspended / Deactivated Account Gate
  console.log('Stress Test 4: Suspended / Deactivated Account Gate');
  const inactiveLogin = await dispatchExpress(app, {
    method: 'POST',
    url: '/api/v1/auth/login',
    body: {
      email: 'inactive@nexusfinance.ng',
      password: 'InactivePassword123!'
    }
  });
  assert.equal(inactiveLogin.status, 403, `Expected 403 for inactive user, got ${inactiveLogin.status}`);
  assert.equal(inactiveLogin.body.error.code, 'ACCOUNT_INACTIVE');
  console.log('  PASSED: Inactive account blocked from authenticating');

  // STRESS TEST 5: Malformed JSON Syntax Handling
  console.log('Stress Test 5: Malformed JSON Syntax Handling (CWE-20)');
  const malformedRes = await dispatchExpress(app, {
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    body: '{"email": "admin@nexusfinance.ng", password: invalid_json_syntax'
  });
  assert.equal(malformedRes.status, 400, `Expected 400 for malformed JSON, got ${malformedRes.status}`);
  assert.equal(malformedRes.body.error.code, 'VALIDATION_ERROR');
  assert.ok(String(malformedRes.body.error.correlationId).startsWith('corr_'));
  console.log('  PASSED: Malformed JSON safely caught without crashing');

  // STRESS TEST 6: Audit Service Hash Chaining Non-Repudiation
  console.log('Stress Test 6: Audit Service Merkle Hash Chaining Integrity');
  const auditService = getAuditService();
  const integrity = auditService.verifyIntegrity();
  assert.equal(integrity.valid, true, `Audit trail corrupted! Compromised id: ${integrity.compromisedId}`);
  assert.ok(integrity.totalChecked > 0, 'Audit entries must be checked');
  console.log(`  PASSED: Audit trail integrity confirmed across ${integrity.totalChecked} immutable entries`);

  await closeDataStore();
  console.log('=== ALL ADVERSARIAL STRESS TESTS COMPLETED SUCCESSFULLY ===');
}

runAdversarialTests().catch(err => {
  console.error('FATAL STRESS TEST ERROR:', err);
  process.exit(1);
});
