import assert from 'node:assert/strict';
import { getLagosDateTime } from '../../../update/server/repositories/attendanceRepository.ts';
import { AttendanceRepository } from '../../../update/server/repositories/attendanceRepository.ts';
import { AtomicJsonStore } from '../../../update/server/repositories/store/AtomicJsonStore.ts';
import type { AttendanceRecord, UserAccount } from '../../../update/server/repositories/types.ts';
import path from 'node:path';
import fs from 'node:fs';

console.log('--- AUDITOR EMPIRICAL STRESS TEST ---');

// 1. Timezone and schedule boundary checks
const t0800 = getLagosDateTime(new Date('2026-11-11T07:00:00Z')); // 08:00 WAT
console.log('t0800:', t0800);
assert.equal(t0800.hours, 8);
assert.equal(t0800.minutes, 0);
assert.equal(t0800.totalMinutes, 480);
assert.equal(t0800.isWeekend, false);

const t0815 = getLagosDateTime(new Date('2026-11-11T07:15:00Z')); // 08:15 WAT (grace limit)
console.log('t0815:', t0815);
assert.equal(t0815.hours, 8);
assert.equal(t0815.minutes, 15);
assert.equal(t0815.totalMinutes, 495);

const t0816 = getLagosDateTime(new Date('2026-11-11T07:16:00Z')); // 08:16 WAT (1 min past grace)
console.log('t0816:', t0816);
assert.equal(t0816.totalMinutes, 496);

const tSunday = getLagosDateTime(new Date('2026-11-15T09:00:00Z')); // Sunday 10:00 WAT
console.log('tSunday:', tSunday);
assert.equal(tSunday.dayOfWeek, 'SUNDAY');
assert.equal(tSunday.isWeekend, true);

// 2. Attendance repository logic with temporary store
const tempStorePath = path.resolve('./.agents/teamwork/auditor_m1_phase2_1/temp_attendance.json');
if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);

const store = new AtomicJsonStore<AttendanceRecord>(tempStorePath, () => []);
const repo = new AttendanceRepository(store);

const mockUser: UserAccount = {
  id: 'auditor-test-emp',
  email: 'emp@test.local',
  role: 'STAFF',
  passwordHash: '',
  profile: {
    id: 'emp-auditor',
    staffId: 'NX-9999',
    firstName: 'Auditor',
    lastName: 'Test',
    email: 'emp@test.local',
    phone: '08012345678',
    department: 'Quality Assurance',
    designation: 'Integrity Specialist',
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
    workLocation: 'Abuja Head Office',
    joinDate: '2026-01-01',
    salary: 500000,
    currency: 'NGN',
    bankDetails: { bankName: 'Access', accountNumber: '0123456789', accountName: 'Auditor' },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

async function run() {
  await repo.initialize();

  // Test 1: Clock in at 08:15 WAT (grace period)
  const inGrace = await repo.clockIn(mockUser, 'Grace period test', '2026-11-11T07:15:00Z');
  assert.equal(inGrace.record.resumptionStatus, 'ON_TIME');
  assert.equal(inGrace.record.lateMinutes, 0);

  // Test 2: Double clock in rejection
  let doubleInRejected = false;
  try {
    await repo.clockIn(mockUser, 'Double in', '2026-11-11T07:20:00Z');
  } catch (err: any) {
    if (err.code === 'ALREADY_CLOCKED_IN') doubleInRejected = true;
  }
  assert.equal(doubleInRejected, true, 'Double clock-in must throw ALREADY_CLOCKED_IN');

  // Test 3: Active session calculation while clocked in
  const midDaySummary = repo.buildSummary(inGrace.record, new Date('2026-11-11T09:15:00Z')); // 2 hours later
  console.log('midDaySummary active elapsed:', midDaySummary.totalMinutesWorked, midDaySummary.formattedTimeWorked);
  assert.equal(midDaySummary.totalMinutesWorked, 120);
  assert.equal(midDaySummary.formattedTimeWorked, '2h 00m');

  // Test 4: Clock out at 12:15 WAT (5 hours = 300 minutes)
  const out1 = await repo.clockOut(mockUser, 'Lunch break', '2026-11-11T11:15:00Z');
  assert.equal(out1.record.status, 'CLOCKED_OUT');
  assert.equal(out1.record.totalMinutesWorked, 240); // 07:15 to 11:15 UTC = 4 hours = 240 mins
  assert.equal(out1.summary.formattedTimeWorked, '4h 00m');

  // Test 5: Clock in again at 13:00 WAT (session 2)
  const in2 = await repo.clockIn(mockUser, 'Afternoon session', '2026-11-11T12:00:00Z');
  assert.equal(in2.record.sessions.length, 2);
  assert.equal(in2.record.resumptionStatus, 'ON_TIME', 'Morning resumption punctuality must not be overwritten');

  // Test 6: Clock out at 17:00 WAT (session 2 = 4 hours = 240 minutes)
  const out2 = await repo.clockOut(mockUser, 'End of day', '2026-11-11T16:00:00Z');
  assert.equal(out2.record.sessions.length, 2);
  assert.equal(out2.record.totalMinutesWorked, 480); // 240 + 240 = 480 mins = 8 hours
  assert.equal(out2.record.totalHoursWorked, 8.0);
  assert.equal(out2.summary.formattedTimeWorked, '8h 00m');

  // Test 7: Sunday weekend shift
  const sundayUser: UserAccount = { ...mockUser, id: 'sunday-user' };
  const sundayIn = await repo.clockIn(sundayUser, 'Sunday duty', '2026-11-15T09:00:00Z');
  assert.equal(sundayIn.record.isWeekend, true);
  assert.equal(sundayIn.record.dayOfWeek, 'SUNDAY');
  assert.equal(sundayIn.record.resumptionStatus, 'WEEKEND_DUTY');
  assert.equal(sundayIn.record.lateMinutes, 0);

  // Clean up temp store
  if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath);

  console.log('ALL EMPIRICAL INTEGRITY TESTS PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('STRESS TEST FAILED:', err);
  process.exit(1);
});
