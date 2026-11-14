import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 2 Boundary: Employee onboarding with missing required fields returns 400', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.post('/api/v1/employees', {
    firstName: 'Incomplete'
    // Missing lastName, email, departmentId, designationId
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('Tier 2 Boundary: Duplicate employee email registration returns 409 Conflict', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  // Attempt to onboard an employee with existing email (employee@nexusfinance.ng)
  const res = await adminClient.post('/api/v1/employees', {
    firstName: 'Duplicate',
    lastName: 'User',
    email: 'employee@nexusfinance.ng',
    departmentId: 'dept-eng',
    designationId: 'des-se'
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DUPLICATE_EMAIL');
});

test('Tier 2 Boundary: Employee onboarding with malformed NUBAN (<10 digits) returns 422', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.post('/api/v1/employees', {
    firstName: 'Segun',
    lastName: 'Arinze',
    email: 'segun.arinze@nexusfinance.ng',
    departmentId: 'dept-ops',
    designationId: 'des-se',
    bankAccountNumber: '12345' // Only 5 digits
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'INVALID_NUBAN');
});

test('Tier 2 Boundary: Querying non-existent employee ID returns 404 Not Found', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.get('/api/v1/employees/emp-ghost-9999');

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('Tier 2 Boundary: Non-admin role attempting to mutate system settings returns 403 Forbidden', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const res = await empClient.patch('/api/v1/admin/settings', {
    maxCarryOverAnnualLeave: 20.0
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Tier 2 Boundary: Manager role attempting to mutate system settings returns 403 Forbidden', async () => {
  const mgrClient = await createAuthenticatedClient('manager');
  const res = await mgrClient.patch('/api/v1/admin/settings', {
    receiptEnforcementThresholdNGN: 100000.0
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});
