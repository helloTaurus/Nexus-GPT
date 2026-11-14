import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F01: Employee login returns 200, user profile, and session cookie', async () => {
  const client = await createTestClient();
  const res = await client.login('employee@nexusfinance.ng', 'EmployeePassword123!');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.email, 'employee@nexusfinance.ng');
  assert.equal(res.body.user.role, 'EMPLOYEE');
  assert.equal(res.body.user.profile.staffId, 'NX-1042');
  assert.ok(client.cookieJar.has('nexus_session'), 'Expected nexus_session cookie');
});

test('F01: Manager login returns 200 and MANAGER role claim', async () => {
  const client = await createTestClient();
  const res = await client.login('manager@nexusfinance.ng', 'ManagerPassword123!');

  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'MANAGER');
  assert.equal(res.body.user.profile.department, 'Credit & Risk');
});

test('F01: Admin login returns 200 and ADMIN role claim', async () => {
  const client = await createTestClient();
  const res = await client.login('admin@nexusfinance.ng', 'AdminPassword123!');

  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'ADMIN');
  assert.equal(res.body.user.profile.staffId, 'NX-0001');
});

test('F01: User logout revokes session and clears session cookie', async () => {
  const client = await createAuthenticatedClient('employee');
  const logoutRes = await client.logout();

  assert.equal(logoutRes.status, 200);
  assert.equal(logoutRes.body.success, true);

  const meRes = await client.get('/api/v1/auth/me');
  assert.equal(meRes.status, 401);
});

test('F01: Session token validation via GET /api/v1/auth/me preserves authenticated identity', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/auth/me');

  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'employee@nexusfinance.ng');
  assert.equal(res.body.user.profile.firstName, 'Oluwaseun');
});

test('F01: Password recovery request dispatches OTP token', async () => {
  const client = await createTestClient();
  const res = await client.post('/api/v1/auth/recover/request', {
    email: 'employee@nexusfinance.ng'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('F01: Password recovery verification with valid OTP updates password and allows login', async () => {
  const client = await createTestClient();
  await client.post('/api/v1/auth/recover/request', { email: 'employee@nexusfinance.ng' });

  const resetRes = await client.post('/api/v1/auth/recover/verify', {
    email: 'employee@nexusfinance.ng',
    token: '123456',
    newPassword: 'BrandNewPassword2026!'
  });
  assert.equal(resetRes.status, 200);

  const oldLoginRes = await client.login('employee@nexusfinance.ng', 'EmployeePassword123!');
  assert.equal(oldLoginRes.status, 401);

  const loginRes = await client.login('employee@nexusfinance.ng', 'BrandNewPassword2026!');
  assert.equal(loginRes.status, 200);
});

test('F01: Newly created employee logs in, resets own password via OTP recovery, and changes password in portal', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const onboardRes = await adminClient.post('/api/v1/employees', {
    firstName: 'Kolawole',
    lastName: 'Adebayo',
    email: 'kolawole.adebayo@nexusfinance.ng',
    departmentId: 'dept-cru',
    designationId: 'des-ra',
    managerId: 'emp-manager-01'
  });
  assert.equal(onboardRes.status, 201);

  const userClient = await createTestClient();
  const initialLogin = await userClient.login('kolawole.adebayo@nexusfinance.ng', 'TemporaryPass123!');
  assert.equal(initialLogin.status, 200);

  // Step 1: Authenticated self-service password change
  const changeRes = await userClient.post('/api/v1/auth/change-password', {
    currentPassword: 'TemporaryPass123!',
    newPassword: 'KolaCustomPass2026!'
  });
  assert.equal(changeRes.status, 200);
  assert.equal(changeRes.body.success, true);

  // Verify old password fails and new password logs in
  const staleLogin = await (await createTestClient()).login('kolawole.adebayo@nexusfinance.ng', 'TemporaryPass123!');
  assert.equal(staleLogin.status, 401);

  const freshLogin = await userClient.login('kolawole.adebayo@nexusfinance.ng', 'KolaCustomPass2026!');
  assert.equal(freshLogin.status, 200);

  // Step 2: Self-service OTP recovery flow
  await userClient.post('/api/v1/auth/recover/request', { email: 'kolawole.adebayo@nexusfinance.ng' });
  const recoverVerifyRes = await userClient.post('/api/v1/auth/recover/verify', {
    email: 'kolawole.adebayo@nexusfinance.ng',
    token: '123456',
    newPassword: 'KolaRecovered2026!'
  });
  assert.equal(recoverVerifyRes.status, 200);

  const afterRecoverLogin = await (await createTestClient()).login('kolawole.adebayo@nexusfinance.ng', 'KolaRecovered2026!');
  assert.equal(afterRecoverLogin.status, 200);
});

test('F20: Admin resets created employee password and revokes prior user sessions', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const onboardRes = await adminClient.post('/api/v1/employees', {
    firstName: 'Tunde',
    lastName: 'Bello',
    email: 'tunde.bello@nexusfinance.ng',
    departmentId: 'dept-ops',
    designationId: 'des-se',
    password: 'InitialTundePass1!'
  });
  assert.equal(onboardRes.status, 201);
  const empId = onboardRes.body.data.id;

  const userClient = await createTestClient();
  const initialLogin = await userClient.login('tunde.bello@nexusfinance.ng', 'InitialTundePass1!');
  assert.equal(initialLogin.status, 200);

  // Admin resets password
  const resetRes = await adminClient.post(`/api/v1/employees/${empId}/reset-password`, {
    newPassword: 'AdminIssuedPass2026!'
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // Prior session should now be revoked
  const meRes = await userClient.get('/api/v1/auth/me');
  assert.equal(meRes.status, 401);

  // Old password rejected, new password works
  const oldLogin = await (await createTestClient()).login('tunde.bello@nexusfinance.ng', 'InitialTundePass1!');
  assert.equal(oldLogin.status, 401);

  const newLogin = await (await createTestClient()).login('tunde.bello@nexusfinance.ng', 'AdminIssuedPass2026!');
  assert.equal(newLogin.status, 200);
});

test('F02: Role guard permits employee to access own profile at /api/v1/portal/profile', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/portal/profile');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.staffId, 'NX-1042');
});

test('F02: Role guard rejects unprivileged employee accessing administrative employee creation', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/employees', {
    firstName: 'Illegal',
    lastName: 'Entry',
    email: 'illegal@nexusfinance.ng',
    departmentId: 'dept-eng',
    designationId: 'des-se'
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('F02: Manager can retrieve direct reports at /api/v1/employees/:id/reports', async () => {
  const managerClient = await createAuthenticatedClient('manager');
  const res = await managerClient.get('/api/v1/employees/emp-manager-01/reports');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 2, 'Expected manager to have direct reports');
});

test('F02: Manager role guard blocks access to administrative audit logs', async () => {
  const managerClient = await createAuthenticatedClient('manager');
  const res = await managerClient.get('/api/v1/admin/audit-logs');

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('F02: Admin role has full access to administrative audit logs', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.get('/api/v1/admin/audit-logs');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test('F24: Schema rejection on missing login credentials', async () => {
  const client = await createTestClient();
  const res = await client.post('/api/v1/auth/login', {});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('F25: Fail-secure error response envelopes include correlationId and security headers', async () => {
  const client = await createTestClient();
  const res = await client.get('/api/v1/auth/me');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.correlationId.startsWith('corr_'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
});
