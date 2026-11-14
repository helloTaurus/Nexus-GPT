import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F11: Staff searches workforce directory by name query', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/employees?search=chioma');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].firstName, 'Chioma');
  assert.equal(res.body.data[0].lastName, 'Okonkwo');
});

test('F11: Staff filters workforce directory by department ID', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/employees?departmentId=dept-cru');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 3, 'Expected multiple Credit & Risk staff');
  for (const emp of res.body.data) {
    assert.equal(emp.departmentId, 'dept-cru');
  }
});

test('F11: Paginated directory response contains metadata and total counts', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/employees?page=1&limit=2');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.pagination.page, 1);
  assert.equal(res.body.pagination.limit, 2);
  assert.ok(res.body.pagination.total >= 6);
  assert.ok(res.body.pagination.totalPages >= 3);
});

test('F19: Admin onboards new employee with generated Staff ID and default leave allocation', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const onboardRes = await adminClient.post('/api/v1/employees', {
    firstName: 'Zainab',
    lastName: 'Aliyu',
    email: 'zainab.aliyu@nexusfinance.ng',
    departmentId: 'dept-eng',
    designationId: 'des-se',
    managerId: 'emp-depthead-01',
    initialAnnualLeaveDays: 20
  });

  assert.equal(onboardRes.status, 201);
  assert.ok(onboardRes.body.data.staffId.startsWith('NX-'));
  assert.equal(onboardRes.body.data.firstName, 'Zainab');
  assert.equal(onboardRes.body.data.department, 'Engineering');

  // Verify new employee appears in directory
  const dirRes = await adminClient.get('/api/v1/employees?search=zainab');
  assert.equal(dirRes.body.data.length, 1);
  assert.equal(dirRes.body.data[0].email, undefined); // directory summary masks private email if needed, or matches profile
});

test('F19: Admin updates employee department and designation', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const updateRes = await adminClient.patch('/api/v1/employees/emp-employee-01', {
    departmentId: 'dept-ops',
    designationId: 'des-em'
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.departmentId, 'dept-ops');
  assert.equal(updateRes.body.data.department, 'Operations');
  assert.equal(updateRes.body.data.designation, 'Engineering Manager');
});

test('F20: Admin promotes employee to Manager role', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const roleRes = await adminClient.patch('/api/v1/employees/emp-employee-01', {
    role: 'MANAGER'
  });

  assert.equal(roleRes.status, 200);

  // Verify employee can now query direct reports
  const empClient = await createAuthenticatedClient('employee');
  const reportsRes = await empClient.get('/api/v1/employees/emp-employee-01/reports');
  assert.equal(reportsRes.status, 200);
});

test('F20: Admin deactivates employee account, terminating active access', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const statusRes = await adminClient.patch('/api/v1/employees/emp-employee-01', {
    status: 'INACTIVE'
  });

  assert.equal(statusRes.status, 200);

  // Attempt login with deactivated credentials
  const client = await adminClient;
  const loginRes = await client.login('employee@nexusfinance.ng', 'EmployeePassword123!');
  assert.equal(loginRes.status, 403);
  assert.equal(loginRes.body.error.code, 'ACCOUNT_INACTIVE');
});
