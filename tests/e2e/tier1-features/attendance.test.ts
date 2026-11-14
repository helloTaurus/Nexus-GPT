import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('R1 Attendance: Weekday on-time clock-in before 08:00 WAT sets ON_TIME resumption status', async () => {
  const client = await createAuthenticatedClient('employee');

  // Wednesday at 07:50 AM WAT (UTC+1 is 06:50 UTC)
  const clockInTime = '2026-11-11T06:50:00.000Z';
  const res = await client.post('/api/v1/attendance/clock-in', {
    timestamp: clockInTime,
    notes: 'Arrived early at Abuja HQ'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.clockedIn, true);
  assert.equal(res.body.data.resumptionStatus, 'ON_TIME');
  assert.equal(res.body.data.lateMinutes, 0);
  assert.equal(res.body.data.isWeekend, false);
  assert.equal(res.body.data.schedule.expectedStart, '08:00');
  assert.equal(res.body.data.schedule.expectedEnd, '17:00');
  assert.equal(res.body.data.schedule.standardHours, 9);
  assert.ok(res.body.data.activeSession);
  assert.equal(res.body.data.activeSession.clockIn, clockInTime);
});

test('R1 Attendance: Weekday clock-in within 15-minute grace period (up to 08:15 WAT) evaluates to ON_TIME', async () => {
  const client = await createAuthenticatedClient('employee');

  // Wednesday at 08:12 AM WAT (UTC+1 is 07:12 UTC)
  const clockInTime = '2026-11-11T07:12:00.000Z';
  const res = await client.post('/api/v1/attendance/clock-in', {
    timestamp: clockInTime,
    notes: 'Traffic at Central Business District, within 15m grace'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.resumptionStatus, 'ON_TIME');
  assert.equal(res.body.data.lateMinutes, 0);
});

test('R1 Attendance: Weekday clock-in after 08:15 WAT sets LATE resumption status and calculates late minutes', async () => {
  const client = await createAuthenticatedClient('employee');

  // Wednesday at 08:45 AM WAT (UTC+1 is 07:45 UTC) -> 45 minutes late from 08:00
  const clockInTime = '2026-11-11T07:45:00.000Z';
  const res = await client.post('/api/v1/attendance/clock-in', {
    timestamp: clockInTime,
    notes: 'Vehicle breakdown on airport road'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.resumptionStatus, 'LATE');
  assert.equal(res.body.data.lateMinutes, 45);
});

test('R1 Attendance: Weekend clock-in evaluates to WEEKEND_DUTY with zero late penalty', async () => {
  const client = await createAuthenticatedClient('employee');

  // Saturday 2026-11-14 at 10:30 AM WAT (UTC+1 is 09:30 UTC)
  const clockInTime = '2026-11-14T09:30:00.000Z';
  const res = await client.post('/api/v1/attendance/clock-in', {
    timestamp: clockInTime,
    notes: 'Weekend server migration duty'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.isWeekend, true);
  assert.equal(res.body.data.dayOfWeek, 'SATURDAY');
  assert.equal(res.body.data.resumptionStatus, 'WEEKEND_DUTY');
  assert.equal(res.body.data.lateMinutes, 0);
  assert.equal(res.body.data.schedule.expectedStart, null);
});

test('R1 Attendance: Clock-out calculates session elapsed duration and total daily hours worked', async () => {
  const client = await createAuthenticatedClient('employee');

  const inTime = '2026-11-11T07:00:00.000Z'; // 08:00 WAT
  const outTime = '2026-11-11T16:00:00.000Z'; // 17:00 WAT (9 hours = 540 minutes)

  await client.post('/api/v1/attendance/clock-in', { timestamp: inTime });

  const outRes = await client.post('/api/v1/attendance/clock-out', {
    timestamp: outTime,
    notes: 'Completed full working day'
  });

  assert.equal(outRes.status, 200);
  assert.equal(outRes.body.success, true);
  assert.equal(outRes.body.data.clockedIn, false);
  assert.equal(outRes.body.data.activeSession, null);
  assert.equal(outRes.body.data.completedMinutesWorked, 540);
  assert.equal(outRes.body.data.totalMinutesWorked, 540);
  assert.equal(outRes.body.data.totalHoursWorked, 9.0);
  assert.equal(outRes.body.data.formattedTimeWorked, '9h 00m');
  assert.equal(outRes.body.data.firstClockIn, inTime);
  assert.equal(outRes.body.data.lastClockOut, outTime);
});

test('R1 Attendance: Multiple sessions in one day correctly accumulate total daily hours', async () => {
  const client = await createAuthenticatedClient('employee');

  // Morning session: 08:00 WAT to 12:30 WAT (4.5 hours = 270 minutes)
  const session1In = '2026-11-11T07:00:00.000Z';
  const session1Out = '2026-11-11T11:30:00.000Z';

  await client.post('/api/v1/attendance/clock-in', { timestamp: session1In, notes: 'Morning block' });
  const out1Res = await client.post('/api/v1/attendance/clock-out', { timestamp: session1Out, notes: 'Lunch break' });
  assert.equal(out1Res.body.data.totalMinutesWorked, 270);

  // Afternoon session: 13:30 WAT to 17:30 WAT (4 hours = 240 minutes)
  const session2In = '2026-11-11T12:30:00.000Z';
  const session2Out = '2026-11-11T16:30:00.000Z';

  await client.post('/api/v1/attendance/clock-in', { timestamp: session2In, notes: 'Afternoon block' });
  const out2Res = await client.post('/api/v1/attendance/clock-out', { timestamp: session2Out, notes: 'End of day' });

  // Total daily hours: 270 + 240 = 510 minutes = 8.5 hours
  assert.equal(out2Res.body.data.totalMinutesWorked, 510);
  assert.equal(out2Res.body.data.totalHoursWorked, 8.5);
  assert.equal(out2Res.body.data.formattedTimeWorked, '8h 30m');
  assert.equal(out2Res.body.data.sessions.length, 2);
  assert.equal(out2Res.body.data.firstClockIn, session1In); // morning first arrival preserved!
  assert.equal(out2Res.body.data.lastClockOut, session2Out);
});

test('R1 Attendance: Double clock-in without clocking out returns 409 Conflict', async () => {
  const client = await createAuthenticatedClient('employee');

  const firstIn = await client.post('/api/v1/attendance/clock-in', {
    timestamp: '2026-11-11T07:00:00.000Z'
  });
  assert.equal(firstIn.status, 200);

  const duplicateIn = await client.post('/api/v1/attendance/clock-in', {
    timestamp: '2026-11-11T07:05:00.000Z'
  });
  assert.equal(duplicateIn.status, 409);
  assert.equal(duplicateIn.body.success, false);
  assert.equal(duplicateIn.body.error.code, 'ALREADY_CLOCKED_IN');
});

test('R1 Attendance: Clock-out when not clocked in returns 409 Conflict', async () => {
  const client = await createAuthenticatedClient('employee');

  const rogueClockOut = await client.post('/api/v1/attendance/clock-out', {
    timestamp: '2026-11-11T12:00:00.000Z'
  });
  assert.equal(rogueClockOut.status, 409);
  assert.equal(rogueClockOut.body.success, false);
  assert.equal(rogueClockOut.body.error.code, 'NOT_CLOCKED_IN');
});

test('R1 Attendance: Persistence across GET /today and GET /history', async () => {
  const client = await createAuthenticatedClient('employee');

  const inTime = '2026-11-11T07:00:00.000Z';
  await client.post('/api/v1/attendance/clock-in', { timestamp: inTime, notes: 'Persistence check' });

  // Query today state
  const todayRes = await client.get('/api/v1/attendance/today');
  assert.equal(todayRes.status, 200);
  assert.equal(todayRes.body.success, true);
  assert.equal(todayRes.body.data.clockedIn, true);
  assert.equal(todayRes.body.data.firstClockIn, inTime);
  assert.ok(todayRes.body.data.activeSession);

  // Query history
  const historyRes = await client.get('/api/v1/attendance/history');
  assert.equal(historyRes.status, 200);
  assert.ok(Array.isArray(historyRes.body.data));
  assert.ok(historyRes.body.data.length >= 1);
  assert.equal(historyRes.body.data[0].date, '2026-11-11');
});

test('R1 Attendance: Clock-in and clock-out trigger audit log records', async () => {
  const client = await createAuthenticatedClient('employee');
  const adminClient = await createAuthenticatedClient('admin');

  await client.post('/api/v1/attendance/clock-in', {
    timestamp: '2026-11-11T07:00:00.000Z'
  });
  await client.post('/api/v1/attendance/clock-out', {
    timestamp: '2026-11-11T16:00:00.000Z'
  });

  const auditRes = await adminClient.get('/api/v1/admin/audit-logs');
  assert.equal(auditRes.status, 200);

  const clockedInLog = auditRes.body.data.find((l: any) => l.action === 'STAFF_CLOCKED_IN');
  const clockedOutLog = auditRes.body.data.find((l: any) => l.action === 'STAFF_CLOCKED_OUT');

  assert.ok(clockedInLog, 'Expected STAFF_CLOCKED_IN audit log entry');
  assert.ok(clockedOutLog, 'Expected STAFF_CLOCKED_OUT audit log entry');
  assert.equal(clockedInLog.entityType, 'AttendanceRecord');
  assert.equal(clockedOutLog.entityType, 'AttendanceRecord');
});
