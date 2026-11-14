import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 2 Boundary: Zero-overdraft protection rejects leave requests exceeding available balance', async () => {
  const client = await createAuthenticatedClient('employee');
  // Employee has 20 annual leave days. Request 25 working days.
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-01',
    endDate: '2026-07-06', // 26 working days
    reason: 'Extended sabbatical beyond entitlement'
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INSUFFICIENT_LEAVE_BALANCE');
  assert.ok(res.body.error.message.includes('Insufficient leave balance'));
});

test('Tier 2 Boundary: End date earlier than start date returns 400 Bad Request', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-15',
    endDate: '2026-06-10', // End date is 5 days before start
    reason: 'Inverted calendar dates'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_DATE_RANGE');
});

test('Tier 2 Boundary: Leave application spanning only weekends returns 400 (0 working days)', async () => {
  const client = await createAuthenticatedClient('employee');
  // 2026-06-06 is Saturday, 2026-06-07 is Sunday
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-06',
    endDate: '2026-06-07',
    reason: 'Weekend trip'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'ZERO_WORKING_DAYS');
});

test('Tier 2 Boundary: Double-booking guard rejects overlapping dates with existing request', async () => {
  const client = await createAuthenticatedClient('employee');
  // First request: June 8 to June 12
  const firstRes = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-08',
    endDate: '2026-06-12',
    reason: 'First booking'
  });
  assert.equal(firstRes.status, 201);

  // Second request: June 10 to June 15 (overlaps June 10-12)
  const overlapRes = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-06-10',
    endDate: '2026-06-15',
    reason: 'Overlapping second request'
  });

  assert.equal(overlapRes.status, 409);
  assert.equal(overlapRes.body.error.code, 'DATE_OVERLAP');
  assert.ok(overlapRes.body.error.message.includes('Date range overlaps'));
});

test('Tier 2 Boundary: Sick Leave exceeding 2 consecutive working days without medical certificate returns 422', async () => {
  const client = await createAuthenticatedClient('employee');
  // 3 consecutive working days (Monday to Wednesday)
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-sick',
    startDate: '2026-07-06',
    endDate: '2026-07-08',
    reason: 'Severe flu',
    // Missing attachmentUrl
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'MEDICAL_NOTE_REQUIRED');
  assert.ok(res.body.error.message.includes('Doctor certificate required'));
});

test('Tier 2 Boundary: Sick Leave up to 2 consecutive days allowed without medical certificate', async () => {
  const client = await createAuthenticatedClient('employee');
  // 2 working days (Monday to Tuesday)
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-sick',
    startDate: '2026-07-06',
    endDate: '2026-07-07',
    reason: 'Mild migraine'
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'SUBMITTED');
});

test('Tier 2 Boundary: Casual Leave exceeding 2 consecutive days returns 422 Policy Violation', async () => {
  const client = await createAuthenticatedClient('employee');
  // 3 working days of casual leave
  const res = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-casual',
    startDate: '2026-07-13',
    endDate: '2026-07-15',
    reason: 'Personal errands'
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'POLICY_LIMIT_EXCEEDED');
  assert.ok(res.body.error.message.includes('Casual leave cannot exceed 2 consecutive working days'));
});

test('Tier 2 Boundary: Self-approval prohibition prevents manager from approving own leave request', async () => {
  // Manager applies for leave
  const mgrClient = await createAuthenticatedClient('manager');
  const submitRes = await mgrClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    reason: 'Manager personal vacation'
  });
  assert.equal(submitRes.status, 201);

  // Manager attempts to approve own request
  const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${submitRes.body.data.id}/action`, {
    action: 'APPROVE',
    decisionReason: 'Self approving my own leave'
  });

  assert.equal(approveRes.status, 403);
  assert.equal(approveRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
});

test('Tier 2 Boundary: Manager cannot approve leave for staff not in their reporting chain', async () => {
  // Admin onboards an independent staff under DeptHead
  const adminClient = await createAuthenticatedClient('admin');
  const onboardRes = await adminClient.post('/api/v1/employees', {
    firstName: 'Tari',
    lastName: 'Briggs',
    email: 'tari.briggs@nexusfinance.ng',
    departmentId: 'dept-ops',
    designationId: 'des-se',
    managerId: 'emp-depthead-01'
  });

  // Tari submits leave
  const tariClient = await adminClient;
  const tariUser = await tariClient.login('tari.briggs@nexusfinance.ng', 'TemporaryPass123!');
  const submitRes = await tariClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    reason: 'Off days'
  });

  // Ibrahim (manager of Credit & Risk) attempts to approve Tari's leave
  const mgrClient = await createAuthenticatedClient('manager');
  const approveRes = await mgrClient.patch(`/api/v1/leaves/requests/${submitRes.body.data.id}/action`, {
    action: 'APPROVE'
  });

  assert.equal(approveRes.status, 403);
  assert.equal(approveRes.body.error.code, 'FORBIDDEN');
});

test('Tier 2 Boundary: Retroactive cancellation of past leave is rejected with 400', async () => {
  const client = await createAuthenticatedClient('employee');
  const submitRes = await client.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-01-05', // Past date
    endDate: '2026-01-07',
    reason: 'Past leave'
  });

  // Manager approves it
  const mgrClient = await createAuthenticatedClient('manager');
  await mgrClient.patch(`/api/v1/leaves/requests/${submitRes.body.data.id}/action`, { action: 'APPROVE' });

  // Employee attempts to cancel past leave
  const cancelRes = await client.post(`/api/v1/leaves/requests/${submitRes.body.data.id}/cancel`, {
    reason: 'Cancel past leave'
  });

  assert.equal(cancelRes.status, 400);
  assert.equal(cancelRes.body.error.code, 'PAST_LEAVE_CANNOT_BE_CANCELLED');
});
