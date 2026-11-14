import crypto from 'node:crypto';
import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type {
  UserAccount,
  AttendanceRecord,
  AttendanceSession,
  DailyAttendanceSummary,
  ResumptionStatus,
  AttendanceStatus
} from './types.ts';

export interface LagosContext {
  dateStr: string; // "YYYY-MM-DD"
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  isWeekend: boolean;
  hours: number;
  minutes: number;
  totalMinutes: number; // minutes from midnight
  timeStr: string; // "HH:MM"
}

export function getLagosDateTime(inputDate: Date = new Date()): LagosContext {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(inputDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const weekday = (partMap.weekday || '').toUpperCase() as LagosContext['dayOfWeek'];
  let hours = parseInt(partMap.hour, 10);
  if (hours === 24) hours = 0;
  const minutes = parseInt(partMap.minute, 10);
  const isWeekend = weekday === 'SATURDAY' || weekday === 'SUNDAY';
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const totalMinutes = hours * 60 + minutes;

  return {
    dateStr,
    dayOfWeek: weekday,
    isWeekend,
    hours,
    minutes,
    totalMinutes,
    timeStr
  };
}

export class AttendanceRepository {
  constructor(private store: AtomicJsonStore<AttendanceRecord>) {}

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public async reset(): Promise<void> {
    await this.store.reset();
  }

  public getTodayRecord(userId: string, dateStr?: string): AttendanceRecord | null {
    const today = dateStr || getLagosDateTime().dateStr;
    const records = this.store.filter(r => r.userId === userId && r.date === today);
    return records.length > 0 ? records[0] : null;
  }

  public buildSummary(record: AttendanceRecord | null, customNow?: Date): DailyAttendanceSummary {
    const now = customNow || new Date();
    const lagosCtx = getLagosDateTime(now);

    if (!record) {
      return {
        date: lagosCtx.dateStr,
        dayOfWeek: lagosCtx.dayOfWeek,
        isWeekend: lagosCtx.isWeekend,
        status: 'CLOCKED_OUT',
        clockedIn: false,
        activeSession: null,
        firstClockIn: null,
        lastClockOut: null,
        schedule: {
          expectedStart: lagosCtx.isWeekend ? null : '08:00',
          expectedEnd: lagosCtx.isWeekend ? null : '17:00',
          standardHours: lagosCtx.isWeekend ? 0 : 9
        },
        resumptionStatus: lagosCtx.isWeekend ? 'WEEKEND_DUTY' : 'NOT_RESUMED',
        lateMinutes: 0,
        completedMinutesWorked: 0,
        totalMinutesWorked: 0,
        totalHoursWorked: 0,
        formattedTimeWorked: '0h 00m',
        sessions: []
      };
    }

    const activeSession = record.sessions.find(s => s.clockOut === null) || null;
    const clockedIn = record.status === 'CLOCKED_IN' && activeSession !== null;

    const completedMinutesWorked = record.sessions
      .filter(s => s.clockOut !== null)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    let activeElapsedMinutes = 0;
    if (clockedIn && activeSession) {
      const startMs = new Date(activeSession.clockIn).getTime();
      const currentMs = now.getTime();
      activeElapsedMinutes = Math.max(0, Math.round((currentMs - startMs) / 60000));
    }

    const totalMinutesWorked = completedMinutesWorked + activeElapsedMinutes;
    const totalHoursWorked = Number((totalMinutesWorked / 60).toFixed(2));
    const h = Math.floor(totalMinutesWorked / 60);
    const m = totalMinutesWorked % 60;
    const formattedTimeWorked = `${h}h ${String(m).padStart(2, '0')}m`;

    return {
      date: record.date,
      dayOfWeek: record.dayOfWeek,
      isWeekend: record.isWeekend,
      status: record.status,
      clockedIn,
      activeSession,
      firstClockIn: record.firstClockIn,
      lastClockOut: record.lastClockOut,
      schedule: record.schedule,
      resumptionStatus: record.resumptionStatus,
      lateMinutes: record.lateMinutes,
      completedMinutesWorked,
      totalMinutesWorked,
      totalHoursWorked,
      formattedTimeWorked,
      sessions: record.sessions
    };
  }

  public async clockIn(
    user: UserAccount,
    notes?: string,
    customTimestamp?: string
  ): Promise<{ record: AttendanceRecord; summary: DailyAttendanceSummary; session: AttendanceSession }> {
    return this.store.withLock(async () => {
      const now = customTimestamp ? new Date(customTimestamp) : new Date();
      if (isNaN(now.getTime())) {
        throw new Error('INVALID_TIMESTAMP');
      }
      const nowIso = now.toISOString();
      const lagosCtx = getLagosDateTime(now);

      const existingRecord = this.getTodayRecord(user.id, lagosCtx.dateStr);

      if (existingRecord && existingRecord.status === 'CLOCKED_IN') {
        const active = existingRecord.sessions.find(s => s.clockOut === null);
        if (active) {
          const err = new Error('Employee is already clocked in with an active session');
          (err as any).code = 'ALREADY_CLOCKED_IN';
          throw err;
        }
      }

      const newSession: AttendanceSession = {
        id: `ses-${crypto.randomUUID()}`,
        clockIn: nowIso,
        clockOut: null,
        durationMinutes: 0,
        notes: notes || undefined
      };

      let record: AttendanceRecord;

      if (!existingRecord) {
        let resumptionStatus: ResumptionStatus;
        let lateMinutes = 0;

        if (lagosCtx.isWeekend) {
          resumptionStatus = 'WEEKEND_DUTY';
          lateMinutes = 0;
        } else {
          // Standard schedule: 08:00 (480 mins). Grace period up to 08:15 (495 mins).
          if (lagosCtx.totalMinutes <= 495) {
            resumptionStatus = 'ON_TIME';
            lateMinutes = 0;
          } else {
            resumptionStatus = 'LATE';
            lateMinutes = lagosCtx.totalMinutes - 480;
          }
        }

        record = {
          id: `att_${user.id}_${lagosCtx.dateStr}`,
          userId: user.id,
          employeeId: user.profile.id,
          staffId: user.profile.staffId,
          date: lagosCtx.dateStr,
          dayOfWeek: lagosCtx.dayOfWeek,
          isWeekend: lagosCtx.isWeekend,
          schedule: {
            expectedStart: lagosCtx.isWeekend ? null : '08:00',
            expectedEnd: lagosCtx.isWeekend ? null : '17:00',
            standardHours: lagosCtx.isWeekend ? 0 : 9
          },
          resumptionStatus,
          firstClockIn: nowIso,
          lastClockOut: null,
          lateMinutes,
          totalMinutesWorked: 0,
          totalHoursWorked: 0,
          status: 'CLOCKED_IN',
          sessions: [newSession],
          createdAt: nowIso,
          updatedAt: nowIso
        };
      } else {
        record = existingRecord;
        record.sessions.push(newSession);
        record.status = 'CLOCKED_IN';
        record.updatedAt = nowIso;
      }

      await this.store.save(record);
      const summary = this.buildSummary(record, now);
      return { record, summary, session: newSession };
    });
  }

  public async clockOut(
    user: UserAccount,
    notes?: string,
    customTimestamp?: string
  ): Promise<{ record: AttendanceRecord; summary: DailyAttendanceSummary; session: AttendanceSession }> {
    return this.store.withLock(async () => {
      const now = customTimestamp ? new Date(customTimestamp) : new Date();
      if (isNaN(now.getTime())) {
        throw new Error('INVALID_TIMESTAMP');
      }
      const nowIso = now.toISOString();
      const lagosCtx = getLagosDateTime(now);

      // Find active record: either today's date or previous open session
      let record = this.getTodayRecord(user.id, lagosCtx.dateStr);

      if (!record || record.status !== 'CLOCKED_IN') {
        // Look for any open session across recent dates
        const openRecords = this.store.filter(
          r => r.userId === user.id && r.status === 'CLOCKED_IN' && r.sessions.some(s => s.clockOut === null)
        );
        if (openRecords.length > 0) {
          record = openRecords[openRecords.length - 1];
        }
      }

      if (!record || record.status !== 'CLOCKED_IN') {
        const err = new Error('No active clock-in session found to clock out');
        (err as any).code = 'NOT_CLOCKED_IN';
        throw err;
      }

      const activeSessionIndex = record.sessions.findIndex(s => s.clockOut === null);
      if (activeSessionIndex === -1) {
        const err = new Error('No active clock-in session found to clock out');
        (err as any).code = 'NOT_CLOCKED_IN';
        throw err;
      }

      const session = record.sessions[activeSessionIndex];
      const startMs = new Date(session.clockIn).getTime();
      const endMs = now.getTime();
      const elapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

      session.clockOut = nowIso;
      session.durationMinutes = elapsedMinutes;
      if (notes) {
        session.notes = notes;
      }

      const totalCompletedMinutes = record.sessions
        .filter(s => s.clockOut !== null)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

      record.totalMinutesWorked = totalCompletedMinutes;
      record.totalHoursWorked = Number((totalCompletedMinutes / 60).toFixed(2));
      record.status = 'CLOCKED_OUT';
      record.lastClockOut = nowIso;
      record.updatedAt = nowIso;

      await this.store.save(record);
      const summary = this.buildSummary(record, now);
      return { record, summary, session };
    });
  }

  public getHistory(
    userId: string,
    filter?: { limit?: number; startDate?: string; endDate?: string }
  ): AttendanceRecord[] {
    let records = this.store.filter(r => r.userId === userId);

    if (filter?.startDate) {
      records = records.filter(r => r.date >= filter.startDate!);
    }
    if (filter?.endDate) {
      records = records.filter(r => r.date <= filter.endDate!);
    }

    // Sort descending by date
    records.sort((a, b) => b.date.localeCompare(a.date));

    if (filter?.limit && filter.limit > 0) {
      records = records.slice(0, filter.limit);
    }

    return records;
  }
}
