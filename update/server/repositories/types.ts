export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'TERMINATED';

export interface EmployeeProfile {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
  phone: string;
  residentialAddress: string;
  departmentId: string;
  department: string;
  designationId: string;
  designation: string;
  managerId: string | null;
  employmentType: 'FULL_TIME' | 'CONTRACT' | 'PROBATION' | 'INTERN';
  hireDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bvn?: string;
  nin?: string;
  avatarUrl?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  profile: EmployeeProfile;
}

export interface UserSession {
  id: string; // token
  userId: string;
  createdAt: string; // ISO
  lastActivityAt: string; // ISO
  expiresAt: string; // ISO
  ipAddress: string;
  userAgent: string;
}

export interface PasswordResetToken {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
}

export interface LeaveBalanceRecord {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fiscalYear: number;
  allocatedDays: number;
  carriedOverDays: number;
  accruedDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export interface LeaveRequestRecord {
  id: string;
  requestNumber: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  assignedApproverId: string;
  decisionReason?: string;
  submittedAt: string;
  decidedAt?: string;
}

export interface ExpenseItemRecord {
  id: string;
  categoryId: string;
  dateIncurred: string;
  merchantName: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptFileName?: string;
}

export interface ExpenseReportRecord {
  id: string;
  reportNumber: string;
  employeeId: string;
  title: string;
  purpose: string;
  currency: string;
  totalAmount: number;
  status: 'SUBMITTED' | 'PENDING_LINE_MANAGER' | 'PENDING_DEPT_HEAD' | 'PENDING_EXEC' | 'APPROVED' | 'PAID' | 'REJECTED' | 'REVISION_REQUESTED';
  items: ExpenseItemRecord[];
  submittedAt: string;
  approvedAt?: string;
  paidAt?: string;
  disbursementReference?: string;
  currentApproverId?: string;
  rejectionReason?: string;
}

export interface AppraisalGoalRecord {
  goalId: string;
  title: string;
  weightage: number;
  selfRating?: number;
  selfComments?: string;
  managerRating?: number;
  managerComments?: string;
}

export interface AppraisalCycleRecord {
  id: string;
  title: string;
  cycleType: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  selfAppraisalDeadline: string;
  managerReviewDeadline: string;
  status: 'ACTIVE' | 'CALIBRATION' | 'COMPLETED' | 'CLOSED';
}

export interface AppraisalSubmissionRecord {
  id: string;
  cycleId: string;
  employeeId: string;
  managerId: string;
  status: 'NOT_STARTED' | 'SELF_SUBMITTED' | 'CALIBRATION_PENDING' | 'COMPLETED';
  selfScore?: number;
  managerScore?: number;
  finalCalibratedScore?: number;
  employeeComments?: string;
  managerSummaryFeedback?: string;
  acknowledgedAt?: string;
  goals: AppraisalGoalRecord[];
}

export interface SystemSettingsRecord {
  id: string;
  fiscalYear: number;
  maxCarryOverAnnualLeave: number;
  receiptEnforcementThresholdNGN: number;
  expenseManagerThresholdNGN: number;
  expenseExecutiveThresholdNGN: number;
  [key: string]: unknown;
}

export type ResumptionStatus =
  | 'ON_TIME'
  | 'GRACE_PERIOD'
  | 'LATE'
  | 'WEEKEND_DUTY'
  | 'NOT_RESUMED';

export type AttendanceStatus = 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ABSENT';

export interface AttendanceSession {
  id: string;
  clockIn: string;
  clockOut: string | null;
  durationMinutes: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  employeeId: string;
  staffId: string;
  date: string;
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

