import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 2 Boundary: Login with empty email and password string returns 400', async () => {
  const client = await createTestClient();
  const res = await client.login('', '');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('Tier 2 Boundary: Login with incorrect password returns 401 Unauthorized', async () => {
  const client = await createTestClient();
  const res = await client.login('employee@nexusfinance.ng', 'TotallyWrongPassword!');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
});

test('Tier 2 Boundary: Login with non-existent user email returns 401 Unauthorized', async () => {
  const client = await createTestClient();
  const res = await client.login('nonexistent.user@nexusfinance.ng', 'SomePassword123!');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
});

test('Tier 2 Boundary: Login attempt on suspended/deactivated account returns 403 Forbidden', async () => {
  const client = await createTestClient();
  const res = await client.login('inactive@nexusfinance.ng', 'InactivePassword123!');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'ACCOUNT_INACTIVE');
});

test('Tier 2 Boundary: Unauthenticated request without session cookie to portal returns 401', async () => {
  const client = await createTestClient();
  const res = await client.get('/api/v1/portal/profile');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('Tier 2 Boundary: Request with spoofed/tampered session cookie returns 401', async () => {
  const client = await createTestClient();
  client.setCookie('nexus_session', 'spoofed_token_00000000000000000000000000');
  const res = await client.get('/api/v1/portal/profile');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('Tier 2 Boundary: Staff role cannot access administrative audit logs (403 Forbidden)', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/admin/audit-logs');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Tier 2 Boundary: Staff role cannot access system configuration settings (403 Forbidden)', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/admin/settings');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Tier 2 Boundary: Staff role cannot mutate restricted fields (salary, title, role) on profile', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.patch('/api/v1/portal/profile', {
    salary: 25000000,
    title: 'Executive Director'
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Tier 2 Boundary: Password reset with invalid or expired OTP returns 400', async () => {
  const client = await createTestClient();
  const res = await client.post('/api/v1/auth/recover/verify', {
    email: 'employee@nexusfinance.ng',
    token: '999999', // Wrong OTP
    newPassword: 'BrandNewValidPass123!'
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_OTP');
});

test('Tier 2 Boundary: Password reset with weak password (< 8 chars) returns 422', async () => {
  const client = await createTestClient();
  await client.post('/api/v1/auth/recover/request', { email: 'employee@nexusfinance.ng' });

  const res = await client.post('/api/v1/auth/recover/verify', {
    email: 'employee@nexusfinance.ng',
    token: '123456',
    newPassword: 'short' // 5 chars, under 8 chars
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'WEAK_PASSWORD');
});

test('Tier 2 Boundary: Authenticated change-password rejects wrong current password (401) and weak/same password (422)', async () => {
  const empClient = await createAuthenticatedClient('employee');

  const wrongCurr = await empClient.post('/api/v1/auth/change-password', {
    currentPassword: 'WrongCurrentPassword!',
    newPassword: 'ValidNewPassword2026!'
  });
  assert.equal(wrongCurr.status, 401);
  assert.equal(wrongCurr.body.error.code, 'INVALID_CURRENT_PASSWORD');

  const weakNew = await empClient.post('/api/v1/auth/change-password', {
    currentPassword: 'EmployeePassword123!',
    newPassword: 'short'
  });
  assert.equal(weakNew.status, 422);
  assert.equal(weakNew.body.error.code, 'WEAK_PASSWORD');

  const sameNew = await empClient.post('/api/v1/auth/change-password', {
    currentPassword: 'EmployeePassword123!',
    newPassword: 'EmployeePassword123!'
  });
  assert.equal(sameNew.status, 422);
  assert.equal(sameNew.body.error.code, 'SAME_PASSWORD');
});

test('Tier 2 Boundary: Non-admin roles cannot reset employee passwords (403) and weak/unknown admin resets fail securely', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');
  const adminClient = await createAuthenticatedClient('admin');

  const empAttempt = await empClient.post('/api/v1/employees/emp-employee-02/reset-password', {
    newPassword: 'HackedPassword2026!'
  });
  assert.equal(empAttempt.status, 403);
  assert.equal(empAttempt.body.error.code, 'FORBIDDEN');

  const mgrAttempt = await mgrClient.post('/api/v1/employees/emp-employee-02/reset-password', {
    newPassword: 'HackedPassword2026!'
  });
  assert.equal(mgrAttempt.status, 403);
  assert.equal(mgrAttempt.body.error.code, 'FORBIDDEN');

  const weakAttempt = await adminClient.post('/api/v1/employees/emp-employee-02/reset-password', {
    newPassword: '12345'
  });
  assert.equal(weakAttempt.status, 422);
  assert.equal(weakAttempt.body.error.code, 'WEAK_PASSWORD');

  const missingAttempt = await adminClient.post('/api/v1/employees/emp-ghost-404/reset-password', {
    newPassword: 'ValidPassword2026!'
  });
  assert.equal(missingAttempt.status, 404);
  assert.equal(missingAttempt.body.error.code, 'NOT_FOUND');
});
