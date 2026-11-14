import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 3 Combination: Complete Leave Lifecycle (Submission -> Reservation -> Approval -> Deduction -> Audit)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');
  const adminClient = await createAuthenticatedClient('admin');

  // 1. Initial State: 20 days available, 0 used, 0 pending
  const initBalRes = await empClient.get('/api/v1/leaves/balances');
  const initAnnual = initBalRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(initAnnual.availableDays, 20.0);
  assert.equal(initAnnual.pendingDays, 0);
  assert.equal(initAnnual.usedDays, 0);

  // 2. Submit 4 days leave (Monday 2026-11-16 to Thursday 2026-11-19)
  const submitRes = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-11-16',
    endDate: '2026-11-19',
    reason: 'Family wedding in Enugu'
  });
  assert.equal(submitRes.status, 201);
  const reqId = submitRes.body.data.id;

  // 3. Verify Balance Reservation: pending = 4, available = 16
  const postSubmitBal = await empClient.get('/api/v1/leaves/balances');
  const postSubmitAnnual = postSubmitBal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(postSubmitAnnual.pendingDays, 4.0);
  assert.equal(postSubmitAnnual.availableDays, 16.0);
  assert.equal(postSubmitAnnual.usedDays, 0);

  // 4. Manager reviews and approves
  const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
    action: 'APPROVE',
    decisionReason: 'Approved. Reliever assigned.'
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.data.status, 'APPROVED');

  // 5. Verify Balance Deduction: pending = 0, used = 4, available = 16
  const finalBal = await empClient.get('/api/v1/leaves/balances');
  const finalAnnual = finalBal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(finalAnnual.pendingDays, 0);
  assert.equal(finalAnnual.usedDays, 4.0);
  assert.equal(finalAnnual.availableDays, 16.0);

  // 6. Verify Audit Trail records both LEAVE_SUBMITTED and LEAVE_APPROVED
  const auditRes = await adminClient.get('/api/v1/admin/audit-logs');
  const submitLog = auditRes.body.data.find((l: any) => l.action === 'LEAVE_SUBMITTED' && l.entityId === reqId);
  const approveLog = auditRes.body.data.find((l: any) => l.action === 'LEAVE_APPROVED' && l.entityId === reqId);

  assert.ok(submitLog, 'Expected LEAVE_SUBMITTED audit log');
  assert.ok(approveLog, 'Expected LEAVE_APPROVED audit log');
});

test('Tier 3 Combination: Leave Rejection Flow (Submission -> Reservation -> Rejection -> Restoration -> Audit)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');
  const adminClient = await createAuthenticatedClient('admin');

  // 1. Submit 3 days leave (Nov 23 - Nov 25)
  const submitRes = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-11-23',
    endDate: '2026-11-25',
    reason: 'Personal time off'
  });
  const reqId = submitRes.body.data.id;

  // 2. Manager rejects request
  const rejectRes = await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
    action: 'REJECT',
    decisionReason: 'Staff coverage needed during month-end close'
  });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.data.status, 'REJECTED');

  // 3. Verify balance is completely restored
  const balRes = await empClient.get('/api/v1/leaves/balances');
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.usedDays, 0);
  assert.equal(annual.availableDays, 20.0);

  // 4. Verify LEAVE_REJECTED in audit log
  const auditRes = await adminClient.get('/api/v1/admin/audit-logs');
  const rejectLog = auditRes.body.data.find((l: any) => l.action === 'LEAVE_REJECTED' && l.entityId === reqId);
  assert.ok(rejectLog);
});

test('Tier 3 Combination: Approved Leave Cancellation Flow (Submission -> Approval -> Cancellation -> Restoration)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');

  // 1. Submit 5 days future leave in December (2026-12-07 to 2026-12-11)
  const submitRes = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-12-07',
    endDate: '2026-12-11',
    reason: 'December vacation'
  });
  const reqId = submitRes.body.data.id;

  // 2. Manager approves
  await mgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, { action: 'APPROVE' });

  // Verify deducted: used = 5, available = 15
  let bal = await empClient.get('/api/v1/leaves/balances');
  let annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.usedDays, 5.0);
  assert.equal(annual.availableDays, 15.0);

  // 3. Employee cancels upcoming approved leave
  const cancelRes = await empClient.post(`/api/v1/leaves/requests/${reqId}/cancel`, {
    reason: 'Flight cancelled by airline'
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.data.status, 'CANCELLED');

  // 4. Verify usedDays restored back to availableDays
  bal = await empClient.get('/api/v1/leaves/balances');
  annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.usedDays, 0);
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.availableDays, 20.0);
});

test('Tier 3 Combination: Concurrent Non-Overlapping Requests Balance Math', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');

  // Submit Request 1: 3 days (Nov 16 - Nov 18)
  const req1 = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-11-16',
    endDate: '2026-11-18',
    reason: 'Trip 1'
  });

  // Submit Request 2: 2 days (Nov 23 - Nov 24)
  const req2 = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-11-23',
    endDate: '2026-11-24',
    reason: 'Trip 2'
  });

  // Both should be reserved: pending = 3 + 2 = 5, available = 15
  let bal = await empClient.get('/api/v1/leaves/balances');
  let annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.pendingDays, 5.0);
  assert.equal(annual.availableDays, 15.0);

  // Manager approves Req 1, rejects Req 2
  await mgrClient.patch(`/api/v1/leaves/requests/${req1.body.data.id}/action`, { action: 'APPROVE' });
  await mgrClient.patch(`/api/v1/leaves/requests/${req2.body.data.id}/action`, { action: 'REJECT' });

  // Final balance: used = 3, pending = 0, available = 17
  bal = await empClient.get('/api/v1/leaves/balances');
  annual = bal.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.usedDays, 3.0);
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.availableDays, 17.0);
});
