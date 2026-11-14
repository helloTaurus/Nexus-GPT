import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F05: Employee submits annual leave request for valid future working days', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-01',
    endDate: '2026-06-03', // 3 working days (Mon, Tue, Wed)
    reason: 'Family vacation in Calabar'
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'SUBMITTED');
  assert.equal(res.body.data.totalDays, 3.0);
  assert.equal(res.body.data.assignedApproverId, 'emp-manager-01');
});

test('F05: Pending days reserved and available days reduced immediately upon submission', async () => {
  const client = await createAuthenticatedClient('employee');
  await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    reason: 'Vacation'
  });

  const balRes = await client.get('/api/v1/leaves/balances');
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');

  assert.equal(annual.allocatedDays, 20.0);
  assert.equal(annual.pendingDays, 3.0);
  assert.equal(annual.usedDays, 0);
  assert.equal(annual.availableDays, 17.0);
});

test('F06: Employee views leave history containing newly submitted request', async () => {
  const client = await createAuthenticatedClient('employee');
  const submitRes = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-07-06',
    endDate: '2026-07-08',
    reason: 'Personal retreat'
  });

  const historyRes = await client.get('/api/v1/leaves/requests?scope=mine');
  assert.equal(historyRes.status, 200);
  assert.ok(Array.isArray(historyRes.body.data));

  const found = historyRes.body.data.find((r: any) => r.id === submitRes.body.data.id);
  assert.ok(found, 'Expected submitted leave request to be found in history');
  assert.equal(found.status, 'SUBMITTED');
  assert.equal(found.reason, 'Personal retreat');
});

test('F06: Employee cancels pending leave request, restoring balance', async () => {
  const client = await createAuthenticatedClient('employee');
  const submitRes = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-08-03',
    endDate: '2026-08-05', // 3 days
    reason: 'Trip planned'
  });

  const cancelRes = await client.post(`/api/v1/leaves/requests/${submitRes.body.data.id}/cancel`, {
    reason: 'Plans cancelled'
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.data.status, 'CANCELLED');

  // Verify balance fully restored
  const balRes = await client.get('/api/v1/leaves/balances');
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.availableDays, 20.0);
});

test('F13: Manager views team approval queue and approves leave request', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const submitRes = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-09-07',
    endDate: '2026-09-09', // 3 days
    reason: 'Annual family leave'
  });

  const mgrClient = await createAuthenticatedClient('manager');
  const teamReqs = await mgrClient.get('/api/v1/leaves/requests?scope=team');
  assert.equal(teamReqs.status, 200);
  assert.ok(teamReqs.body.data.some((r: any) => r.id === submitRes.body.data.id));

  const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${submitRes.body.data.id}/action`, {
    action: 'APPROVE',
    decisionReason: 'Approved. Enjoy your time off!'
  });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.data.status, 'APPROVED');

  // Verify pending converted to usedDays
  const balRes = await empClient.get('/api/v1/leaves/balances');
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.usedDays, 3.0);
  assert.equal(annual.availableDays, 17.0);
});

test('F13: Manager rejects leave request with logged reason and balance is restored', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const submitRes = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-09-14',
    endDate: '2026-09-16', // 3 days
    reason: 'Rest'
  });

  const mgrClient = await createAuthenticatedClient('manager');
  const rejectRes = await mgrClient.patch(`/api/v1/leaves/requests/${submitRes.body.data.id}/action`, {
    action: 'REJECT',
    decisionReason: 'Critical quarterly audit requires full underwriting staff on deck'
  });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.data.status, 'REJECTED');
  assert.ok(rejectRes.body.data.decisionReason.includes('Critical quarterly audit'));

  // Verify balance restored
  const balRes = await empClient.get('/api/v1/leaves/balances');
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.availableDays, 20.0);
});
