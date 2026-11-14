import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F04: Employee retrieves initial leave balances for fiscal year 2026', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/leaves/balances');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 6, 'Expected 6 leave types');

  const types = res.body.data.map((b: any) => b.leaveTypeId);
  assert.ok(types.includes('lt-annual'));
  assert.ok(types.includes('lt-sick'));
  assert.ok(types.includes('lt-casual'));
  assert.ok(types.includes('lt-maternity'));
  assert.ok(types.includes('lt-paternity'));
  assert.ok(types.includes('lt-bereavement'));
});

test('F04: Entitlement quotas match policy standards (Annual 20, Sick 12, Casual 5)', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/leaves/balances');

  const annual = res.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.allocatedDays, 20.0);
  assert.equal(annual.usedDays, 0);
  assert.equal(annual.pendingDays, 0);
  assert.equal(annual.availableDays, 20.0);

  const sick = res.body.data.find((b: any) => b.leaveTypeId === 'lt-sick');
  assert.equal(sick.allocatedDays, 12.0);
  assert.equal(sick.availableDays, 12.0);

  const casual = res.body.data.find((b: any) => b.leaveTypeId === 'lt-casual');
  assert.equal(casual.allocatedDays, 5.0);
  assert.equal(casual.availableDays, 5.0);
});

test('F04: Manager queries direct report leave balances', async () => {
  const managerClient = await createAuthenticatedClient('manager');
  const res = await managerClient.get('/api/v1/leaves/balances?employeeId=emp-employee-01');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  const annual = res.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.availableDays, 20.0);
});

test('F04: Admin queries any employee leave balance docket', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.get('/api/v1/leaves/balances?employeeId=emp-employee-02');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  const annual = res.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.allocatedDays, 20.0);
});

test('F12: Stateless working days calculator computes net working days over regular week', async () => {
  const client = await createAuthenticatedClient('employee');
  // Monday 2026-02-02 to Friday 2026-02-06 (no holidays) = 5 working days
  const res = await client.post('/api/v1/leaves/calculate', {
    startDate: '2026-02-02',
    endDate: '2026-02-06'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.workingDays, 5.0);
  assert.equal(res.body.calendarDays, 5);
  assert.equal(res.body.holidaysEncountered.length, 0);
});

test('F12: Weekend days (Saturday & Sunday) excluded from working day calculation', async () => {
  const client = await createAuthenticatedClient('employee');
  // Friday 2026-02-06 to Tuesday 2026-02-10 (Fri, Sat, Sun, Mon, Tue = 5 calendar days, 3 working days)
  const res = await client.post('/api/v1/leaves/calculate', {
    startDate: '2026-02-06',
    endDate: '2026-02-10'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.workingDays, 3.0);
  assert.equal(res.body.calendarDays, 5);
});

test('F12: Nigerian gazetted statutory public holidays excluded from working day calculation', async () => {
  const client = await createAuthenticatedClient('employee');
  // Workers Day: 2026-05-01 (Friday) - 1 holiday
  // Range: Thursday 2026-04-30 to Monday 2026-05-04
  // Thu (work), Fri (Workers Day), Sat (weekend), Sun (weekend), Mon (work) -> 2 working days
  const res = await client.post('/api/v1/leaves/calculate', {
    startDate: '2026-04-30',
    endDate: '2026-05-04'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.workingDays, 2.0);
  assert.ok(res.body.holidaysEncountered.includes('2026-05-01'));
});

test('F12: Independence Day (2026-10-01) excluded from working day count', async () => {
  const client = await createAuthenticatedClient('employee');
  // Oct 1 2026 is Thursday (Independence Day)
  // Range: 2026-09-30 (Wed) to 2026-10-02 (Fri) = 3 calendar days, 2 working days
  const res = await client.post('/api/v1/leaves/calculate', {
    startDate: '2026-09-30',
    endDate: '2026-10-02'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.workingDays, 2.0);
  assert.ok(res.body.holidaysEncountered.includes('2026-10-01'));
});

test('F12: Half-day calculation accumulates 0.5 per working day', async () => {
  const client = await createAuthenticatedClient('employee');
  // 1 working day with isHalfDay = true -> 0.5 working days
  const res = await client.post('/api/v1/leaves/calculate', {
    startDate: '2026-02-02',
    endDate: '2026-02-02',
    isHalfDay: true
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.workingDays, 0.5);
});
