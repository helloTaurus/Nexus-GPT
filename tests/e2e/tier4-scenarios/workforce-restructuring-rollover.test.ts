import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 4 Scenario: Fiscal Year Rollover Carry-Over Cap and Departmental Restructuring', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const empClient = await createAuthenticatedClient('employee');
  const oldMgrClient = await createAuthenticatedClient('manager');
  const newMgrClient = await createAuthenticatedClient('depthead');

  // Stage 1: Employee utilized 12 days of annual leave in 2026, leaving 8 unused days
  const refServer = (adminClient as any).refServer;
  if (refServer) {
    const bal2026 = refServer.leaveBalances.get('emp-employee-01_lt-annual_2026');
    if (bal2026) {
      bal2026.usedDays = 12.0;
      bal2026.availableDays = 8.0;
    }

    // Stage 2: Fiscal Year 2027 Rollover execution
    // Unused = 8.0, but max carry-over cap = 5.0 days
    // 2027 initial balance: allocated 20.0 + carriedOver 5.0 = 25.0 available
    const unusedDays = bal2026.availableDays;
    const cappedRollover = Math.min(unusedDays, 5.0); // Exactly 5.0

    refServer.leaveBalances.set('emp-employee-01_lt-annual_2027', {
      id: 'bal-emp-01-2027',
      employeeId: 'emp-employee-01',
      leaveTypeId: 'lt-annual',
      fiscalYear: 2027,
      allocatedDays: 20.0,
      carriedOverDays: cappedRollover,
      accruedDays: 20.0,
      usedDays: 0,
      pendingDays: 0,
      availableDays: 20.0 + cappedRollover
    });
  }

  // Stage 3: Corporate Restructuring — Admin reassigns employee from Credit & Risk to Operations
  const reassignRes = await adminClient.patch('/api/v1/employees/emp-employee-01', {
    departmentId: 'dept-ops',
    designationId: 'des-em',
    managerId: 'emp-depthead-01' // New manager is Chukwuma Soludo (DeptHead)
  });
  assert.equal(reassignRes.status, 200);
  assert.equal(reassignRes.body.data.departmentId, 'dept-ops');
  assert.equal(reassignRes.body.data.managerId, 'emp-depthead-01');

  // Stage 4: Employee applies for leave under new department structure
  const leaveRes = await empClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-12-21',
    endDate: '2026-12-23', // 3 working days
    reason: 'Pre-Christmas break'
  });
  assert.equal(leaveRes.status, 201);
  const reqId = leaveRes.body.data.id;
  assert.equal(leaveRes.body.data.assignedApproverId, 'emp-depthead-01');

  // Stage 5: Former Manager Ibrahim attempts to approve -> Rejected (403 Forbidden)
  const oldMgrAttempt = await oldMgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
    action: 'APPROVE'
  });
  assert.equal(oldMgrAttempt.status, 403);
  assert.equal(oldMgrAttempt.body.error.code, 'FORBIDDEN');

  // Stage 6: New Manager Chukwuma reviews and approves -> Succeeded (200 OK)
  const newMgrApprove = await newMgrClient.patch(`/api/v1/leaves/requests/${reqId}/action`, {
    action: 'APPROVE',
    decisionReason: 'Welcome to Operations team. Leave approved.'
  });
  assert.equal(newMgrApprove.status, 200);
  assert.equal(newMgrApprove.body.data.status, 'APPROVED');
});
