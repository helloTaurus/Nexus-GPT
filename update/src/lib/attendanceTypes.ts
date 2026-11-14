export type ResumptionStatus =
  | 'ON_TIME'
  | 'GRACE_PERIOD'
  | 'LATE'
  | 'WEEKEND_DUTY'
  | 'NOT_RESUMED';

export type AttendanceStatus = 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ABSENT';

export interface AttendanceSession {
  id: string;
  clockIn: string; // ISO 8601 UTC
  clockOut: string | null;
  durationMinutes: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  employeeId: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  isWeekend: boolean;
  schedule: {
    expectedStart: string | null;
    expectedEnd: string | null;
    standardHours: number;
  };
  resumptionStatus: ResumptionStatus;
  firstClockIn: string | null;
  lastClockOut: string | null;
  lateMinutes: number;
  totalMinutesWorked: number;
  totalHoursWorked: number;
  status: AttendanceStatus;
  sessions: AttendanceSession[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyAttendanceSummary {
  date: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  isWeekend: boolean;
  status: AttendanceStatus;
  clockedIn: boolean;
  activeSession: AttendanceSession | null;
  firstClockIn: string | null;
  lastClockOut: string | null;
  schedule: {
    expectedStart: string | null;
    expectedEnd: string | null;
    standardHours: number;
  };
  resumptionStatus: ResumptionStatus;
  lateMinutes: number;
  completedMinutesWorked: number;
  totalMinutesWorked: number;
  totalHoursWorked: number;
  formattedTimeWorked: string;
  sessions: AttendanceSession[];
}

export interface ClockInPayload {
  notes?: string;
  timestamp?: string;
}

export interface ClockOutPayload {
  notes?: string;
  timestamp?: string;
}
