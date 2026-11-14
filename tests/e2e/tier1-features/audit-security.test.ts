import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F21: System writes audit log entry upon state mutations', async () => {
  const empClient = await createAuthenticatedClient('employee');
  await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-01',
    endDate: '2026-06-02',
    reason: 'Audit log verification test'
  });

  const adminClient = await createAuthenticatedClient('admin');
  const auditRes = await adminClient.get('/api/v1/admin/audit-logs');

  assert.equal(auditRes.status, 200);
  assert.ok(Array.isArray(auditRes.body.data));

  const entry = auditRes.body.data.find((l: any) => l.action === 'LEAVE_SUBMITTED');
  assert.ok(entry, 'Expected LEAVE_SUBMITTED audit log');
  assert.equal(entry.entityType, 'LeaveRequest');
  assert.ok(entry.timestamp);
  assert.ok(entry.ipAddress);
  assert.ok(entry.userAgent);
});

test('F21: Audit logs filterable by action and entity type', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const filteredRes = await adminClient.get('/api/v1/admin/audit-logs?action=AUTH_LOGIN');

  assert.equal(filteredRes.status, 200);
  assert.ok(Array.isArray(filteredRes.body.data));
  for (const log of filteredRes.body.data) {
    assert.equal(log.action, 'AUTH_LOGIN');
  }
});

test('F24: Zero-trust schema validator rejects unexpected payload properties', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const res = await empClient.patch('/api/v1/portal/profile', {
    salary: 5000000,
    role: 'ADMIN'
  });

  // Rejection due to unauthorized field modification attempt
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('F24: Schema validator enforces NUBAN account number format (must be 10 digits)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const res = await empClient.patch('/api/v1/portal/profile', {
    bankAccountNumber: '123' // Invalid short length
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'INVALID_NUBAN');
});

test('F25: Fail-secure error sanitizer never exposes internal stack traces to client', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-10',
    endDate: '2026-06-01', // End date earlier than start date
    reason: 'Test'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.correlationId);
  assert.equal(typeof res.body.error.correlationId, 'string');
  assert.ok(!JSON.stringify(res.body).includes('at Object.'), 'Stack trace should not leak');
});

test('F25: Security headers enforced on every HTTP response', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/portal/profile');

  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok(res.headers.get('strict-transport-security')?.includes('max-age=31536000'));
});
