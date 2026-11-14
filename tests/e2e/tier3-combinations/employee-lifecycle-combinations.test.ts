import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, createTestClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 3 Combination: Employee Lifecycle & Promotion Pipeline (Onboard -> Initial Balances -> Profile -> Promotion -> Subordinate Review -> Deactivation)', async () => {
  const adminClient = await createAuthenticatedClient('admin');

  // 1. Admin onboards new employee "Kelechi Nnamdi"
  const onboardRes = await adminClient.post('/api/v1/employees', {
    firstName: 'Kelechi',
    lastName: 'Nnamdi',
    email: 'kelechi.nnamdi@nexusfinance.ng',
    departmentId: 'dept-cru',
    designationId: 'des-ra',
    managerId: 'emp-manager-01',
    initialAnnualLeaveDays: 20
  });
  assert.equal(onboardRes.status, 201);
  const newEmpId = onboardRes.body.data.id;
  const staffId = onboardRes.body.data.staffId;

  // 2. Kelechi logs in with temporary password
  const client = await createTestClient();
  const loginRes = await client.login('kelechi.nnamdi@nexusfinance.ng', 'TemporaryPass123!');
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.user.profile.staffId, staffId);

  // 3. Kelechi verifies initial leave balance is exactly 20.0 days
  const balRes = await client.get('/api/v1/leaves/balances');
  assert.equal(balRes.status, 200);
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.availableDays, 20.0);
  assert.equal(annual.allocatedDays, 20.0);

  // 4. Kelechi completes personal banking information
  const updateRes = await client.patch('/api/v1/portal/profile', {
    bankName: 'Stanbic IBTC Bank',
    bankAccountNumber: '0098765432',
    bankAccountName: 'Kelechi Nnamdi',
    residentialAddress: 'Zone 5, Wuse, Abuja'
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.bankAccountNumber, '0098765432');

  // 5. Admin promotes Kelechi to Manager role and assigns new title
  const promoteRes = await adminClient.patch(`/api/v1/employees/${newEmpId}`, {
    role: 'MANAGER',
    designationId: 'des-cro'
  });
  assert.equal(promoteRes.status, 200);

  // 6. Admin reassigns Chioma to report to newly promoted Manager Kelechi
  await adminClient.patch('/api/v1/employees/emp-employee-02', {
    managerId: newEmpId
  });

  // 7. Verify Kelechi can now inspect direct reports
  const reportsRes = await client.get(`/api/v1/employees/${newEmpId}/reports`);
  assert.equal(reportsRes.status, 200);
  assert.ok(reportsRes.body.data.some((r: any) => r.id === 'emp-employee-02'));

  // 8. Admin deactivates Kelechi's account upon transfer
  const deactRes = await adminClient.patch(`/api/v1/employees/${newEmpId}`, {
    status: 'INACTIVE'
  });
  assert.equal(deactRes.status, 200);

  // 9. Login attempt is now rejected with 403 Forbidden
  const postDeactLogin = await client.login('kelechi.nnamdi@nexusfinance.ng', 'TemporaryPass123!');
  assert.equal(postDeactLogin.status, 403);
  assert.equal(postDeactLogin.body.error.code, 'ACCOUNT_INACTIVE');
});
