import crypto from 'node:crypto';
import {
  SEED_USERS,
  SEED_LEAVE_TYPES,
  SEED_EXPENSE_CATEGORIES,
  SEED_NIGERIAN_HOLIDAYS_2026,
  SEED_DEPARTMENTS,
  SEED_DESIGNATIONS,
  type SeedUser
} from './seedData.ts';

export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  metadataDiff: Record<string, unknown>;
  timestamp: string;
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
  status: 'SUBMITTED' | 'PENDING_LINE_MANAGER' | 'PENDING_DEPT_HEAD' | 'APPROVED' | 'PAID' | 'REJECTED' | 'REVISION_REQUESTED';
  items: ExpenseItemRecord[];
  submittedAt: string;
  approvedAt?: string;
  paidAt?: string;
  disbursementReference?: string;
  currentApproverId?: string;
  rejectionReason?: string;
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
  goals: Array<{
    goalId: string;
    title: string;
    weightage: number;
    selfRating?: number;
    selfComments?: string;
    managerRating?: number;
    managerComments?: string;
  }>;
}

export type ResumptionStatus =
  | 'ON_TIME'
  | 'GRACE_PERIOD'
  | 'LATE'
  | 'WEEKEND_DUTY'
  | 'NOT_RESUMED';

export type AttendanceStatus = 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ABSENT';

export interface AttendanceSessionRecord {
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
  sessions: AttendanceSessionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyAttendanceSummary {
  date: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  isWeekend: boolean;
  status: AttendanceStatus;
  clockedIn: boolean;
  activeSession: AttendanceSessionRecord | null;
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
  sessions: AttendanceSessionRecord[];
}

export interface DirectResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export class ReferenceServer {
  // In-memory state
  public users: Map<string, SeedUser> = new Map();
  public sessions: Map<string, { userId: string; createdAt: Date }> = new Map();
  public passwordResetTokens: Map<string, { email: string; token: string; expiresAt: Date }> = new Map();
  public leaveBalances: Map<string, LeaveBalanceRecord> = new Map(); // key: `${employeeId}_${leaveTypeId}_${fiscalYear}`
  public leaveRequests: Map<string, LeaveRequestRecord> = new Map();
  public expenseReports: Map<string, ExpenseReportRecord> = new Map();
  public appraisalCycles: Map<string, AppraisalCycleRecord> = new Map();
  public appraisalSubmissions: Map<string, AppraisalSubmissionRecord> = new Map();
  public attendanceRecords: Map<string, AttendanceRecord> = new Map();
  public auditLogs: AuditLogRecord[] = [];
  public systemSettings: Record<string, unknown> = {
    fiscalYear: 2026,
    maxCarryOverAnnualLeave: 5.0,
    receiptEnforcementThresholdNGN: 5000.0,
    expenseManagerThresholdNGN: 50000.0,
    expenseExecutiveThresholdNGN: 250000.0
  };

  constructor() {
    this.resetState();
  }

  public resetState() {
    this.users.clear();
    this.sessions.clear();
    this.passwordResetTokens.clear();
    this.leaveBalances.clear();
    this.leaveRequests.clear();
    this.expenseReports.clear();
    this.appraisalCycles.clear();
    this.appraisalSubmissions.clear();
    this.attendanceRecords.clear();
    this.auditLogs = [];


    // Clone seed users
    for (const u of SEED_USERS) {
      this.users.set(u.id, JSON.parse(JSON.stringify(u)));
    }

    // Initialize 2026 leave balances for all seed users
    for (const u of this.users.values()) {
      for (const lt of SEED_LEAVE_TYPES) {
        const balKey = `${u.profile.id}_${lt.id}_2026`;
        this.leaveBalances.set(balKey, {
          id: `bal-${crypto.randomUUID().slice(0, 8)}`,
          employeeId: u.profile.id,
          leaveTypeId: lt.id,
          fiscalYear: 2026,
          allocatedDays: lt.annualQuota,
          carriedOverDays: 0,
          accruedDays: lt.annualQuota,
          usedDays: 0,
          pendingDays: 0,
          availableDays: lt.annualQuota
        });
      }
    }

    // Initialize default appraisal cycle
    const cycleId = 'cycle-fy-2026';
    this.appraisalCycles.set(cycleId, {
      id: cycleId,
      title: 'FY 2026 Annual Performance Review',
      cycleType: 'ANNUAL',
      fiscalYear: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      selfAppraisalDeadline: '2026-11-30',
      managerReviewDeadline: '2026-12-15',
      status: 'ACTIVE'
    });

    // Seed default submission for Employee 1
    const subId = 'sub-emp-01-2026';
    this.appraisalSubmissions.set(subId, {
      id: subId,
      cycleId,
      employeeId: 'emp-employee-01',
      managerId: 'emp-manager-01',
      status: 'NOT_STARTED',
      goals: [
        {
          goalId: 'goal-1',
          title: 'Credit Quality & NPL Suppression (< 2.5%)',
          weightage: 50
        },
        {
          goalId: 'goal-2',
          title: 'Portfolio Audit & Compliance Turnaround (< 48 hrs)',
          weightage: 50
        }
      ]
    });
  }

  public recordAuditLog(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'TestClient',
    metadataDiff: Record<string, unknown> = {}
  ) {
    const log: AuditLogRecord = {
      id: `aud-${crypto.randomUUID()}`,
      actorId,
      action,
      entityType,
      entityId,
      ipAddress,
      userAgent,
      metadataDiff,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
  }

  public calculateNetWorkingDays(startDateStr: string, endDateStr: string, isHalfDay: boolean = false): {
    workingDays: number;
    calendarDays: number;
    holidaysEncountered: string[];
  } {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      throw new Error('Invalid date range');
    }

    const holidayDates = new Set(SEED_NIGERIAN_HOLIDAYS_2026.map(h => h.date));
    const holidaysEncountered: string[] = [];
    let workingDays = 0;
    let calendarDays = 0;

    const current = new Date(start);
    while (current <= end) {
      calendarDays++;
      const dayOfWeek = current.getUTCDay(); // 0 is Sun, 6 is Sat
      const dateIso = current.toISOString().split('T')[0];

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend - skip
      } else if (holidayDates.has(dateIso)) {
        holidaysEncountered.push(dateIso);
      } else {
        workingDays += isHalfDay ? 0.5 : 1.0;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { workingDays, calendarDays, holidaysEncountered };
  }

  private makeError(statusCode: number, code: string, message: string, details?: unknown): DirectResponse {
    const correlationId = `corr_${crypto.randomUUID()}`;
    const payload: Record<string, unknown> = {
      success: false,
      error: {
        code,
        message,
        correlationId
      }
    };
    if (details) {
      (payload.error as Record<string, unknown>).details = details;
    }
    return {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      },
      body: payload
    };
  }

  private makeJson(statusCode: number, data: unknown, extraHeaders: Record<string, string> = {}): DirectResponse {
    return {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        ...extraHeaders
      },
      body: data
    };
  }

  private getSessionUserFromHeaders(headers: Record<string, string>): SeedUser | null {
    let token: string | undefined;

    const cookieHeader = headers['cookie'] || headers['Cookie'];
    if (cookieHeader) {
      const matches = cookieHeader.match(/nexus_session=([a-zA-Z0-9_\-]+)/);
      if (matches) {
        token = matches[1];
      }
    }

    if (!token && (headers['authorization'] || headers['Authorization'])) {
      const authHeader = headers['authorization'] || headers['Authorization'];
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    const user = this.users.get(session.userId);
    if (!user || user.status !== 'ACTIVE') return null;

    return user;
  }

  private getLagosDateTime(inputDate: Date = new Date()) {
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
    for (const p of parts) partMap[p.type] = p.value;
    const year = partMap.year;
    const month = partMap.month;
    const day = partMap.day;
    const weekday = (partMap.weekday || '').toUpperCase() as
      | 'MONDAY'
      | 'TUESDAY'
      | 'WEDNESDAY'
      | 'THURSDAY'
      | 'FRIDAY'
      | 'SATURDAY'
      | 'SUNDAY';
    let hours = parseInt(partMap.hour, 10);
    if (hours === 24) hours = 0;
    const minutes = parseInt(partMap.minute, 10);
    const isWeekend = weekday === 'SATURDAY' || weekday === 'SUNDAY';
    const dateStr = `${year}-${month}-${day}`;
    const totalMinutes = hours * 60 + minutes;

    return {
      dateStr,
      dayOfWeek: weekday,
      isWeekend,
      hours,
      minutes,
      totalMinutes
    };
  }

  private buildAttendanceSummary(record: AttendanceRecord | null, customNow?: Date): DailyAttendanceSummary {
    const now = customNow || new Date();
    const lagosCtx = this.getLagosDateTime(now);

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

  public async handleDirect(

    methodInput: string,
    fullPath: string,
    headers: Record<string, string> = {},
    body: any = {}
  ): Promise<DirectResponse> {
    const method = methodInput.toUpperCase();
    const [pathname, queryString] = fullPath.split('?');
    const searchParams = new URLSearchParams(queryString || '');

    const ip = headers['x-forwarded-for'] || '127.0.0.1';
    const ua = headers['user-agent'] || 'TestClient';

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & SESSION
    // -------------------------------------------------------------------------
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      if (!body.email || !body.password) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Email and password are required');
      }

      const user = Array.from(this.users.values()).find(
        u => u.email.toLowerCase() === String(body.email).toLowerCase()
      );

      if (!user || user.password !== body.password) {
        return this.makeError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      }

      if (user.status !== 'ACTIVE') {
        return this.makeError(403, 'ACCOUNT_INACTIVE', 'Account is suspended or deactivated');
      }

      const token = crypto.randomBytes(32).toString('hex');
      this.sessions.set(token, { userId: user.id, createdAt: new Date() });

      this.recordAuditLog(user.id, 'AUTH_LOGIN', 'UserAccount', user.id, ip, ua, { email: user.email });

      const cookie = `nexus_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
      return this.makeJson(
        200,
        {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            profile: user.profile
          }
        },
        { 'Set-Cookie': cookie }
      );
    }

    if (pathname === '/api/v1/auth/logout' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      const cookieHeader = headers['cookie'] || headers['Cookie'];
      let token: string | undefined;
      if (cookieHeader) {
        const m = cookieHeader.match(/nexus_session=([a-zA-Z0-9_\-]+)/);
        if (m) token = m[1];
      }
      if (token) this.sessions.delete(token);

      if (user) {
        this.recordAuditLog(user.id, 'AUTH_LOGOUT', 'UserAccount', user.id, ip, ua);
      }

      const clearCookie = `nexus_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
      return this.makeJson(200, { success: true }, { 'Set-Cookie': clearCookie });
    }

    if (pathname === '/api/v1/auth/me' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) {
        return this.makeError(401, 'UNAUTHORIZED', 'Session authentication required');
      }
      return this.makeJson(200, {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile
        }
      });
    }

    if (pathname === '/api/v1/auth/recover/request' && method === 'POST') {
      if (!body.email) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Email is required');
      }
      const token = '123456';
      this.passwordResetTokens.set(body.email.toLowerCase(), {
        email: body.email.toLowerCase(),
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });
      return this.makeJson(200, { success: true, message: 'Recovery token dispatched' });
    }

    if (pathname === '/api/v1/auth/recover/verify' && method === 'POST') {
      if (!body.email || !body.token || !body.newPassword) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Email, token, and new password are required');
      }
      if (String(body.newPassword).length < 8) {
        return this.makeError(422, 'WEAK_PASSWORD', 'New password must be at least 8 characters');
      }

      const rec = this.passwordResetTokens.get(body.email.toLowerCase());
      if (!rec || rec.token !== body.token || rec.expiresAt < new Date()) {
        return this.makeError(400, 'INVALID_OTP', 'Invalid or expired OTP token');
      }

      const user = Array.from(this.users.values()).find(
        u => u.email.toLowerCase() === body.email.toLowerCase()
      );
      if (user) {
        user.password = body.newPassword;
        this.passwordResetTokens.delete(body.email.toLowerCase());
        for (const [sessTok, sessVal] of this.sessions.entries()) {
          if (sessVal.userId === user.id) {
            this.sessions.delete(sessTok);
          }
        }
        this.recordAuditLog(user.id, 'AUTH_PASSWORD_RESET', 'UserAccount', user.id, ip, ua);
      }
      return this.makeJson(200, { success: true, message: 'Password updated successfully' });
    }

    if (pathname === '/api/v1/auth/change-password' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Session authentication required');

      if (!body.currentPassword || !body.newPassword) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Current password and new password are required');
      }
      if (String(body.newPassword).length < 8) {
        return this.makeError(422, 'WEAK_PASSWORD', 'New password must be at least 8 characters');
      }
      if (user.password !== body.currentPassword) {
        return this.makeError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
      }
      if (body.currentPassword === body.newPassword) {
        return this.makeError(422, 'SAME_PASSWORD', 'New password must differ from your current password');
      }

      user.password = String(body.newPassword);
      this.recordAuditLog(user.id, 'AUTH_PASSWORD_CHANGED', 'UserAccount', user.id, ip, ua, {
        email: user.email,
        method: 'SELF_SERVICE_CHANGE'
      });
      return this.makeJson(200, { success: true, message: 'Password updated successfully' });
    }

    // -------------------------------------------------------------------------
    // 2. STAFF PROFILE & DIRECTORY
    // -------------------------------------------------------------------------
    if ((pathname === '/api/v1/portal/profile' || pathname === '/api/v1/employees/me') && (method === 'GET' || method === 'PATCH' || method === 'PUT')) {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Session authentication required');

      if (method === 'GET') {
        return this.makeJson(200, { success: true, data: user.profile });
      }

      // Update profile
      if (user.role !== 'ADMIN') {
        if ('salary' in body || 'title' in body || 'role' in body || 'staffId' in body || 'designation' in body) {
          return this.makeError(403, 'FORBIDDEN', 'Cannot modify restricted compensation or role fields');
        }
      }

      if (body.bankAccountNumber) {
        if (!/^\d{10}$/.test(String(body.bankAccountNumber).trim())) {
          return this.makeError(422, 'INVALID_NUBAN', 'Nigerian NUBAN account number must be exactly 10 digits');
        }
      }

      const prev = { ...user.profile };
      Object.assign(user.profile, {
        phone: body.phone ?? user.profile.phone,
        residentialAddress: body.residentialAddress ?? user.profile.residentialAddress,
        emergencyContactName: body.emergencyContactName ?? user.profile.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone ?? user.profile.emergencyContactPhone,
        emergencyContactRelationship: body.emergencyContactRelationship ?? user.profile.emergencyContactRelationship,
        bankName: body.bankName ?? user.profile.bankName,
        bankAccountNumber: body.bankAccountNumber ?? user.profile.bankAccountNumber,
        bankAccountName: body.bankAccountName ?? user.profile.bankAccountName
      });

      this.recordAuditLog(user.id, 'PROFILE_UPDATED', 'EmployeeProfile', user.profile.id, ip, ua, {
        previous: prev,
        updated: user.profile
      });

      return this.makeJson(200, { success: true, data: user.profile });
    }

    if (pathname === '/api/v1/employees' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      const search = searchParams.get('search')?.toLowerCase() || '';
      const deptId = searchParams.get('departmentId');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '10', 10);

      let filtered = Array.from(this.users.values()).map(u => u.profile);
      if (search) {
        filtered = filtered.filter(
          p => p.firstName.toLowerCase().includes(search) ||
               p.lastName.toLowerCase().includes(search) ||
               p.staffId.toLowerCase().includes(search)
        );
      }
      if (deptId) {
        filtered = filtered.filter(p => p.departmentId === deptId);
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIdx = (page - 1) * limit;
      const data = filtered.slice(startIdx, startIdx + limit);

      return this.makeJson(200, {
        success: true,
        data,
        pagination: { total, page, limit, totalPages }
      });
    }

    if (pathname === '/api/v1/employees' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user || user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Administrative privilege required to onboard employees');
      }

      if (!body.firstName || !body.lastName || !body.email || !body.departmentId || !body.designationId) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Mandatory onboarding fields missing');
      }

      const existing = Array.from(this.users.values()).find(
        u => u.email.toLowerCase() === String(body.email).toLowerCase()
      );
      if (existing) {
        return this.makeError(409, 'DUPLICATE_EMAIL', 'An employee with this email already exists');
      }

      if (body.bankAccountNumber && !/^\d{10}$/.test(String(body.bankAccountNumber).trim())) {
        return this.makeError(422, 'INVALID_NUBAN', 'Nigerian NUBAN account number must be exactly 10 digits');
      }

      const suppliedPass = typeof body.password === 'string' ? body.password.trim() : '';
      if (suppliedPass.length > 0 && suppliedPass.length < 8) {
        return this.makeError(422, 'WEAK_PASSWORD', 'Initial password must be at least 8 characters');
      }

      const newUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;
      const newEmpId = `emp-${crypto.randomUUID().slice(0, 8)}`;
      const staffId = `NX-${Math.floor(1000 + Math.random() * 9000)}`;

      const newUser: SeedUser = {
        id: newUserId,
        email: body.email,
        password: suppliedPass || 'TemporaryPass123!',
        role: body.role || 'EMPLOYEE',
        status: 'ACTIVE',
        profile: {
          id: newEmpId,
          staffId,
          firstName: body.firstName,
          lastName: body.lastName,
          gender: body.gender || 'PREFER_NOT_TO_SAY',
          phone: body.phone || '+2348000000000',
          residentialAddress: body.residentialAddress || 'Abuja, Nigeria',
          departmentId: body.departmentId,
          department: SEED_DEPARTMENTS.find(d => d.id === body.departmentId)?.name || 'General',
          designationId: body.designationId,
          designation: SEED_DESIGNATIONS.find(d => d.id === body.designationId)?.title || 'Officer',
          managerId: body.managerId || null,
          employmentType: body.employmentType || 'FULL_TIME',
          hireDate: body.hireDate || new Date().toISOString().split('T')[0],
          emergencyContactName: body.emergencyContactName || 'Emergency Contact',
          emergencyContactPhone: body.emergencyContactPhone || '+2348000000001',
          emergencyContactRelationship: body.emergencyContactRelationship || 'Next of Kin',
          bankName: body.bankName || 'Zenith Bank',
          bankAccountNumber: body.bankAccountNumber || '0123456789',
          bankAccountName: `${body.firstName} ${body.lastName}`
        }
      };

      this.users.set(newUser.id, newUser);

      // Initialize leave balances for newly onboarded employee
      const initialQuota = body.initialAnnualLeaveDays !== undefined ? body.initialAnnualLeaveDays : 20.0;
      for (const lt of SEED_LEAVE_TYPES) {
        const balKey = `${newEmpId}_${lt.id}_2026`;
        const quota = lt.id === 'lt-annual' ? initialQuota : lt.annualQuota;
        this.leaveBalances.set(balKey, {
          id: `bal-${crypto.randomUUID().slice(0, 8)}`,
          employeeId: newEmpId,
          leaveTypeId: lt.id,
          fiscalYear: 2026,
          allocatedDays: quota,
          carriedOverDays: 0,
          accruedDays: quota,
          usedDays: 0,
          pendingDays: 0,
          availableDays: quota
        });
      }

      this.recordAuditLog(user.id, 'EMPLOYEE_ONBOARDED', 'EmployeeProfile', newEmpId, ip, ua, {
        staffId,
        email: body.email
      });

      return this.makeJson(201, { success: true, data: newUser.profile });
    }

    const empMatch = pathname.match(/^\/api\/v1\/employees\/([a-zA-Z0-9_\-]+)$/);
    if (empMatch) {
      const empId = empMatch[1];
      const targetUser = Array.from(this.users.values()).find(u => u.profile.id === empId || u.id === empId);
      if (!targetUser) {
        return this.makeError(404, 'NOT_FOUND', 'Employee record not found');
      }

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (method === 'GET') {
        return this.makeJson(200, { success: true, data: targetUser.profile });
      }

      if (method === 'PATCH' || method === 'PUT') {
        if (user.role !== 'ADMIN') {
          return this.makeError(403, 'FORBIDDEN', 'Administrative access required to update other employee records');
        }
        if (body.role) targetUser.role = body.role;
        if (body.status) targetUser.status = body.status;
        if (body.departmentId) {
          targetUser.profile.departmentId = body.departmentId;
          targetUser.profile.department = SEED_DEPARTMENTS.find(d => d.id === body.departmentId)?.name || targetUser.profile.department;
        }
        if (body.designationId) {
          targetUser.profile.designationId = body.designationId;
          targetUser.profile.designation = SEED_DESIGNATIONS.find(d => d.id === body.designationId)?.title || targetUser.profile.designation;
        }
        if (body.managerId !== undefined) targetUser.profile.managerId = body.managerId;

        this.recordAuditLog(user.id, 'EMPLOYEE_UPDATED', 'EmployeeProfile', targetUser.profile.id, ip, ua, body);
        return this.makeJson(200, { success: true, data: targetUser.profile });
      }
    }

    const resetPassMatch = pathname.match(/^\/api\/v1\/employees\/([a-zA-Z0-9_\-]+)\/reset-password$/);
    if (resetPassMatch && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Administrative privilege required to reset employee passwords');
      }
      if (!body.newPassword) {
        return this.makeError(400, 'VALIDATION_ERROR', 'New password is required');
      }
      if (String(body.newPassword).length < 8) {
        return this.makeError(422, 'WEAK_PASSWORD', 'New password must be at least 8 characters');
      }

      const empId = resetPassMatch[1];
      const targetUser = Array.from(this.users.values()).find(
        u => u.profile.id === empId || u.id === empId || u.profile.staffId.toUpperCase() === empId.toUpperCase()
      );
      if (!targetUser) {
        return this.makeError(404, 'NOT_FOUND', 'Employee record not found');
      }

      targetUser.password = String(body.newPassword);
      for (const [sessTok, sessVal] of this.sessions.entries()) {
        if (sessVal.userId === targetUser.id) {
          this.sessions.delete(sessTok);
        }
      }
      this.recordAuditLog(user.id, 'ADMIN_PASSWORD_RESET', 'UserAccount', targetUser.id, ip, ua, {
        staffId: targetUser.profile.staffId,
        targetEmail: targetUser.email,
        method: 'ADMIN_RESET'
      });

      return this.makeJson(200, {
        success: true,
        message: 'Employee password reset successfully',
        data: { id: targetUser.profile.id, staffId: targetUser.profile.staffId }
      });
    }

    const reportsMatch = pathname.match(/^\/api\/v1\/employees\/([a-zA-Z0-9_\-]+)\/reports$/);
    if (reportsMatch && method === 'GET') {
      const managerEmpId = reportsMatch[1];
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      const subordinates = Array.from(this.users.values())
        .filter(u => u.profile.managerId === managerEmpId)
        .map(u => u.profile);

      return this.makeJson(200, { success: true, data: subordinates });
    }

    // -------------------------------------------------------------------------
    // 3. LEAVE MANAGEMENT
    // -------------------------------------------------------------------------
    if (pathname === '/api/v1/leaves/balances' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      const targetEmpId = searchParams.get('employeeId') || user.profile.id;
      if (targetEmpId !== user.profile.id && user.role === 'EMPLOYEE') {
        return this.makeError(403, 'FORBIDDEN', 'Cannot view peer leave balances');
      }

      const balances = Array.from(this.leaveBalances.values()).filter(
        b => b.employeeId === targetEmpId && b.fiscalYear === 2026
      );
      return this.makeJson(200, { success: true, data: balances });
    }

    if (pathname === '/api/v1/leaves/calculate' && (method === 'POST' || method === 'GET')) {
      const reqStart = method === 'POST' ? body.startDate : searchParams.get('startDate');
      const reqEnd = method === 'POST' ? body.endDate : searchParams.get('endDate');
      const reqHalf = method === 'POST' ? !!body.isHalfDay : searchParams.get('isHalfDay') === 'true';

      if (!reqStart || !reqEnd) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Start date and end date are required');
      }

      try {
        const result = this.calculateNetWorkingDays(reqStart, reqEnd, reqHalf);
        return this.makeJson(200, { success: true, ...result });
      } catch {
        return this.makeError(400, 'INVALID_DATE_RANGE', 'End date cannot be earlier than start date');
      }
    }

    if (pathname === '/api/v1/leaves/requests' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      const scope = searchParams.get('scope') || 'mine';
      let requests = Array.from(this.leaveRequests.values());

      if (scope === 'mine') {
        requests = requests.filter(r => r.employeeId === user.profile.id);
      } else if (scope === 'team') {
        if (user.role === 'EMPLOYEE') {
          return this.makeError(403, 'FORBIDDEN', 'Employees cannot view team approval queue');
        }
        requests = requests.filter(r => r.assignedApproverId === user.profile.id);
      } else if (scope === 'all') {
        if (user.role !== 'ADMIN') {
          return this.makeError(403, 'FORBIDDEN', 'Admin role required to view all company requests');
        }
      }

      return this.makeJson(200, { success: true, data: requests });
    }

    if (pathname === '/api/v1/leaves/requests' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (!body.leaveTypeId || !body.startDate || !body.endDate || !body.reason) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Missing required leave request fields');
      }

      let netDaysCalc: { workingDays: number; calendarDays: number; holidaysEncountered: string[] };
      try {
        netDaysCalc = this.calculateNetWorkingDays(body.startDate, body.endDate, !!body.isHalfDay);
      } catch {
        return this.makeError(400, 'INVALID_DATE_RANGE', 'End date cannot be earlier than start date');
      }

      if (netDaysCalc.workingDays <= 0) {
        return this.makeError(400, 'ZERO_WORKING_DAYS', 'Selected period contains 0 net working days (all weekends or holidays)');
      }

      const balKey = `${user.profile.id}_${body.leaveTypeId}_2026`;
      const balance = this.leaveBalances.get(balKey);
      if (!balance) {
        return this.makeError(404, 'BALANCE_NOT_FOUND', 'Leave balance record not found');
      }

      if (netDaysCalc.workingDays > balance.availableDays) {
        return this.makeError(
          409,
          'INSUFFICIENT_LEAVE_BALANCE',
          `Insufficient leave balance: Requested ${netDaysCalc.workingDays} days, available ${balance.availableDays} days`
        );
      }

      const existingReqs = Array.from(this.leaveRequests.values()).filter(
        r => r.employeeId === user.profile.id && (r.status === 'SUBMITTED' || r.status === 'APPROVED')
      );
      const reqStart = new Date(body.startDate);
      const reqEnd = new Date(body.endDate);
      for (const ex of existingReqs) {
        const exStart = new Date(ex.startDate);
        const exEnd = new Date(ex.endDate);
        if (reqStart <= exEnd && reqEnd >= exStart) {
          return this.makeError(409, 'DATE_OVERLAP', `Date range overlaps with existing leave request ${ex.requestNumber}`);
        }
      }

      if (body.leaveTypeId === 'lt-sick' && netDaysCalc.workingDays > 2 && !body.attachmentUrl) {
        return this.makeError(422, 'MEDICAL_NOTE_REQUIRED', 'Doctor certificate required for sick leave exceeding 2 consecutive working days');
      }

      if (body.leaveTypeId === 'lt-casual' && netDaysCalc.workingDays > 2) {
        return this.makeError(422, 'POLICY_LIMIT_EXCEEDED', 'Casual leave cannot exceed 2 consecutive working days');
      }

      balance.pendingDays += netDaysCalc.workingDays;
      balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;

      const reqId = `lr-${crypto.randomUUID().slice(0, 8)}`;
      const requestNumber = `LR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const assignedApproverId = user.profile.managerId || 'emp-admin-01';

      const leaveReq: LeaveRequestRecord = {
        id: reqId,
        requestNumber,
        employeeId: user.profile.id,
        leaveTypeId: body.leaveTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        isHalfDay: !!body.isHalfDay,
        totalDays: netDaysCalc.workingDays,
        reason: body.reason,
        attachmentUrl: body.attachmentUrl,
        status: 'SUBMITTED',
        assignedApproverId,
        submittedAt: new Date().toISOString()
      };

      this.leaveRequests.set(reqId, leaveReq);
      this.recordAuditLog(user.id, 'LEAVE_SUBMITTED', 'LeaveRequest', reqId, ip, ua, {
        requestNumber,
        totalDays: netDaysCalc.workingDays
      });

      return this.makeJson(201, { success: true, data: leaveReq });
    }

    const leaveActionMatch = pathname.match(/^\/api\/v1\/leaves\/requests\/([a-zA-Z0-9_\-]+)\/(action|review)$/);
    if (leaveActionMatch && (method === 'PATCH' || method === 'POST')) {
      const reqId = leaveActionMatch[1];
      const leaveReq = this.leaveRequests.get(reqId);
      if (!leaveReq) return this.makeError(404, 'NOT_FOUND', 'Leave request not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (leaveReq.employeeId === user.profile.id) {
        return this.makeError(403, 'SELF_APPROVAL_PROHIBITED', 'Self-approval prohibited');
      }

      if (leaveReq.assignedApproverId !== user.profile.id && user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Not authorized to review this leave request');
      }

      const action = body.action || body.decision;
      if (action !== 'APPROVE' && action !== 'REJECT' && action !== 'Approved' && action !== 'Rejected') {
        return this.makeError(400, 'VALIDATION_ERROR', 'Action must be APPROVE or REJECT');
      }

      const isApprove = String(action).toUpperCase().startsWith('APP');
      const balKey = `${leaveReq.employeeId}_${leaveReq.leaveTypeId}_2026`;
      const balance = this.leaveBalances.get(balKey);

      if (isApprove) {
        leaveReq.status = 'APPROVED';
        if (balance) {
          balance.pendingDays -= leaveReq.totalDays;
          balance.usedDays += leaveReq.totalDays;
          balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
        }
      } else {
        leaveReq.status = 'REJECTED';
        if (balance) {
          balance.pendingDays -= leaveReq.totalDays;
          balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
        }
      }

      leaveReq.decidedAt = new Date().toISOString();
      leaveReq.decisionReason = body.decisionReason || body.comment;

      this.recordAuditLog(
        user.id,
        isApprove ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        'LeaveRequest',
        reqId,
        ip,
        ua,
        { decision: leaveReq.status, reason: leaveReq.decisionReason }
      );

      return this.makeJson(200, { success: true, data: leaveReq });
    }

    const leaveCancelMatch = pathname.match(/^\/api\/v1\/leaves\/requests\/([a-zA-Z0-9_\-]+)\/cancel$/);
    if (leaveCancelMatch && method === 'POST') {
      const reqId = leaveCancelMatch[1];
      const leaveReq = this.leaveRequests.get(reqId);
      if (!leaveReq) return this.makeError(404, 'NOT_FOUND', 'Leave request not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (leaveReq.employeeId !== user.profile.id && user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Cannot cancel requests of other employees');
      }

      const today = new Date().toISOString().split('T')[0];
      if (leaveReq.startDate < today && leaveReq.status === 'APPROVED') {
        return this.makeError(400, 'PAST_LEAVE_CANNOT_BE_CANCELLED', 'Cannot retroactively cancel past leave. Contact HR Administrator');
      }

      const balKey = `${leaveReq.employeeId}_${leaveReq.leaveTypeId}_2026`;
      const balance = this.leaveBalances.get(balKey);

      if (leaveReq.status === 'SUBMITTED') {
        if (balance) {
          balance.pendingDays -= leaveReq.totalDays;
          balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
        }
      } else if (leaveReq.status === 'APPROVED') {
        if (balance) {
          balance.usedDays -= leaveReq.totalDays;
          balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
        }
      }

      leaveReq.status = 'CANCELLED';
      this.recordAuditLog(user.id, 'LEAVE_CANCELLED', 'LeaveRequest', reqId, ip, ua);
      return this.makeJson(200, { success: true, data: leaveReq });
    }

    // -------------------------------------------------------------------------
    // 4. EXPENSE MANAGEMENT
    // -------------------------------------------------------------------------
    if (pathname === '/api/v1/expenses/categories' && method === 'GET') {
      return this.makeJson(200, { success: true, data: SEED_EXPENSE_CATEGORIES });
    }

    if (pathname === '/api/v1/expenses/upload-receipt' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      let buffer: Buffer;
      if (Buffer.isBuffer(body)) {
        buffer = body;
      } else if (body && body.buffer && Buffer.isBuffer(body.buffer)) {
        buffer = body.buffer;
      } else if (typeof body === 'string') {
        buffer = Buffer.from(body, 'utf-8');
      } else {
        return this.makeError(400, 'VALIDATION_ERROR', 'No file payload received');
      }

      if (buffer.length > 10 * 1024 * 1024) {
        return this.makeError(413, 'PAYLOAD_TOO_LARGE', 'File size exceeds maximum 10MB limit');
      }

      let mimeType = 'application/octet-stream';
      let isAllowed = false;

      // Check PNG: 89 50 4E 47
      if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        mimeType = 'image/png';
        isAllowed = true;
      }
      // Check JPEG: FF D8 FF
      else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        mimeType = 'image/jpeg';
        isAllowed = true;
      }
      // Check PDF: %PDF (25 50 44 46)
      else if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        mimeType = 'application/pdf';
        isAllowed = true;
      }

      if (!isAllowed) {
        return this.makeError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Disallowed file format. Only PDF, JPEG, and PNG are permitted.');
      }

      const fileId = crypto.randomUUID();
      const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
      const fileUrl = `/uploads/receipts/${fileId}.${ext}`;

      return this.makeJson(201, {
        success: true,
        fileUrl,
        receiptUrl: fileUrl,
        fileName: `receipt_${fileId}.${ext}`,
        mimeType,
        sizeBytes: buffer.length
      });
    }

    if (pathname === '/api/v1/expenses/reports' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      const scope = searchParams.get('scope') || 'mine';
      let reports = Array.from(this.expenseReports.values());

      if (scope === 'mine') {
        reports = reports.filter(r => r.employeeId === user.profile.id);
      } else if (scope === 'team') {
        if (user.role === 'EMPLOYEE') {
          return this.makeError(403, 'FORBIDDEN', 'Employees cannot view team expense approvals');
        }
        reports = reports.filter(r => r.currentApproverId === user.profile.id);
      } else if (scope === 'all') {
        if (user.role !== 'ADMIN') {
          return this.makeError(403, 'FORBIDDEN', 'Admin access required to view all corporate expense reports');
        }
      }

      return this.makeJson(200, { success: true, data: reports });
    }

    if (pathname === '/api/v1/expenses/reports' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (!body.title || !Array.isArray(body.items) || body.items.length === 0) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Report title and itemized expenses are required');
      }

      let totalAmount = 0;
      const validatedItems: ExpenseItemRecord[] = [];

      for (const item of body.items) {
        const amt = Number(item.amount);
        if (isNaN(amt) || amt <= 0) {
          return this.makeError(400, 'INVALID_AMOUNT', 'Expense item amount must be a positive number');
        }

        const category = SEED_EXPENSE_CATEGORIES.find(c => c.id === item.categoryId || c.code === item.categoryId);
        if (!category) {
          return this.makeError(404, 'CATEGORY_NOT_FOUND', `Expense category ${item.categoryId} not found`);
        }

        if (amt > category.maxSingleLimit) {
          return this.makeError(
            422,
            'CATEGORY_LIMIT_EXCEEDED',
            `Item amount ${amt} exceeds maximum single limit of ${category.maxSingleLimit} NGN for ${category.name}`
          );
        }

        if (amt > category.receiptThreshold && !item.receiptUrl) {
          return this.makeError(
            422,
            'RECEIPT_REQUIRED',
            `Receipt document is mandatory for expense claims exceeding NGN 5,000 (Item: ${item.description || item.merchantName})`
          );
        }

        totalAmount += amt;
        validatedItems.push({
          id: `item-${crypto.randomUUID().slice(0, 8)}`,
          categoryId: category.id,
          dateIncurred: item.dateIncurred || new Date().toISOString().split('T')[0],
          merchantName: item.merchantName || 'Merchant',
          amount: amt,
          description: item.description || '',
          receiptUrl: item.receiptUrl,
          receiptFileName: item.receiptFileName
        });
      }

      const reportId = `exp-${crypto.randomUUID().slice(0, 8)}`;
      const reportNumber = `EXP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const report: ExpenseReportRecord = {
        id: reportId,
        reportNumber,
        employeeId: user.profile.id,
        title: body.title,
        purpose: body.purpose || '',
        currency: 'NGN',
        totalAmount,
        status: 'SUBMITTED',
        items: validatedItems,
        currentApproverId: user.profile.managerId || 'emp-admin-01',
        submittedAt: new Date().toISOString()
      };

      this.expenseReports.set(reportId, report);
      this.recordAuditLog(user.id, 'EXPENSE_SUBMITTED', 'ExpenseReport', reportId, ip, ua, {
        reportNumber,
        totalAmount,
        itemCount: validatedItems.length
      });

      return this.makeJson(201, { success: true, data: report });
    }

    const expReportMatch = pathname.match(/^\/api\/v1\/expenses\/reports\/([a-zA-Z0-9_\-]+)$/);
    if (expReportMatch) {
      const reportId = expReportMatch[1];
      const report = this.expenseReports.get(reportId);
      if (!report) return this.makeError(404, 'NOT_FOUND', 'Expense report not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (method === 'GET') {
        return this.makeJson(200, { success: true, data: report });
      }

      if (method === 'PUT') {
        if (report.employeeId !== user.profile.id) {
          return this.makeError(403, 'FORBIDDEN', 'Cannot edit reports of other employees');
        }
        if (report.status !== 'REVISION_REQUESTED' && report.status !== 'SUBMITTED') {
          return this.makeError(409, 'CANNOT_EDIT', 'Only reports pending review or in revision can be edited');
        }
        if (body.title) report.title = body.title;
        if (body.purpose) report.purpose = body.purpose;
        report.status = 'SUBMITTED';
        return this.makeJson(200, { success: true, data: report });
      }
    }

    const expActionMatch = pathname.match(/^\/api\/v1\/expenses\/reports\/([a-zA-Z0-9_\-]+)\/(action|review)$/);
    if (expActionMatch && (method === 'PATCH' || method === 'POST')) {
      const reportId = expActionMatch[1];
      const report = this.expenseReports.get(reportId);
      if (!report) return this.makeError(404, 'NOT_FOUND', 'Expense report not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (report.employeeId === user.profile.id) {
        return this.makeError(403, 'SELF_APPROVAL_PROHIBITED', 'Self-approval prohibited');
      }

      const action = body.action || body.decision;

      if (action === 'REJECT') {
        report.status = 'REJECTED';
        report.rejectionReason = body.comments || body.comment;
        this.recordAuditLog(user.id, 'EXPENSE_REJECTED', 'ExpenseReport', reportId, ip, ua);
        return this.makeJson(200, { success: true, data: report });
      }

      if (action === 'REQUEST_REVISION') {
        report.status = 'REVISION_REQUESTED';
        report.rejectionReason = body.comments || body.comment;
        this.recordAuditLog(user.id, 'EXPENSE_REVISION_REQUESTED', 'ExpenseReport', reportId, ip, ua);
        return this.makeJson(200, { success: true, data: report });
      }

      if (action === 'APPROVE' || action === 'ManagerApproved') {
        if (report.totalAmount > 50000 && report.status === 'SUBMITTED') {
          report.status = 'PENDING_DEPT_HEAD';
          report.currentApproverId = 'emp-depthead-01';
        } else {
          report.status = 'APPROVED';
          report.approvedAt = new Date().toISOString();
        }
        this.recordAuditLog(user.id, 'EXPENSE_APPROVED', 'ExpenseReport', reportId, ip, ua, { newStatus: report.status });
        return this.makeJson(200, { success: true, data: report });
      }

      return this.makeError(400, 'VALIDATION_ERROR', 'Invalid expense action');
    }

    const expDisburseMatch = pathname.match(/^\/api\/v1\/expenses\/reports\/([a-zA-Z0-9_\-]+)\/disburse$/);
    if (expDisburseMatch && method === 'POST') {
      const reportId = expDisburseMatch[1];
      const report = this.expenseReports.get(reportId);
      if (!report) return this.makeError(404, 'NOT_FOUND', 'Expense report not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user || user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Finance controller / Admin role required to disburse claims');
      }

      if (report.status !== 'APPROVED') {
        return this.makeError(409, 'NOT_APPROVED', 'Cannot disburse expense claim that has not received final approval');
      }

      if (!body.disbursementReference) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Disbursement reference number is required');
      }

      report.status = 'PAID';
      report.disbursementReference = body.disbursementReference;
      report.paidAt = body.paidDate || new Date().toISOString();

      this.recordAuditLog(user.id, 'EXPENSE_DISBURSED', 'ExpenseReport', reportId, ip, ua, {
        disbursementReference: report.disbursementReference,
        amount: report.totalAmount
      });

      return this.makeJson(200, { success: true, data: report });
    }

    // -------------------------------------------------------------------------
    // 5. APPRAISALS & PERFORMANCE MANAGEMENT
    // -------------------------------------------------------------------------
    if (pathname === '/api/v1/appraisals/cycles' && method === 'GET') {
      return this.makeJson(200, { success: true, data: Array.from(this.appraisalCycles.values()) });
    }

    if (pathname === '/api/v1/appraisals/cycles' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user || user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Administrative privilege required to create appraisal cycles');
      }

      if (!body.title || !body.fiscalYear || !body.startDate || !body.endDate) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Missing required cycle attributes');
      }

      const kra = body.kraWeightagePercent ?? 70;
      const comp = body.competencyWeightagePercent ?? 30;
      if (kra + comp !== 100) {
        return this.makeError(422, 'INVALID_WEIGHTAGES', 'KRA and Competency weightages must total exactly 100%');
      }

      const cycleId = `cycle-${crypto.randomUUID().slice(0, 8)}`;
      const cycle: AppraisalCycleRecord = {
        id: cycleId,
        title: body.title,
        cycleType: body.cycleType || 'ANNUAL',
        fiscalYear: body.fiscalYear,
        startDate: body.startDate,
        endDate: body.endDate,
        selfAppraisalDeadline: body.selfAppraisalDeadline || body.endDate,
        managerReviewDeadline: body.managerReviewDeadline || body.endDate,
        status: 'ACTIVE'
      };

      this.appraisalCycles.set(cycleId, cycle);
      this.recordAuditLog(user.id, 'APPRAISAL_CYCLE_CREATED', 'AppraisalCycle', cycleId, ip, ua);
      return this.makeJson(201, { success: true, data: cycle });
    }

    if (pathname === '/api/v1/appraisals/submissions/me' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      const sub = Array.from(this.appraisalSubmissions.values()).find(
        s => s.employeeId === user.profile.id && s.cycleId === 'cycle-fy-2026'
      );
      if (!sub) return this.makeError(404, 'NOT_FOUND', 'No active appraisal form found');

      return this.makeJson(200, { success: true, data: sub });
    }

    if (pathname === '/api/v1/appraisals/submissions/team' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Manager or Admin access required');
      }

      const teamSubs = Array.from(this.appraisalSubmissions.values()).filter(
        s => s.managerId === user.profile.id || user.role === 'ADMIN'
      );
      return this.makeJson(200, { success: true, data: teamSubs });
    }

    const appSubMatch = pathname.match(/^\/api\/v1\/appraisals\/submissions\/([a-zA-Z0-9_\-]+)$/);
    if (appSubMatch && method === 'GET') {
      const subId = appSubMatch[1];
      const sub = this.appraisalSubmissions.get(subId);
      if (!sub) return this.makeError(404, 'NOT_FOUND', 'Appraisal submission not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');

      if (sub.employeeId !== user.profile.id && sub.managerId !== user.profile.id && user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Access restricted to assigned direct reports');
      }

      return this.makeJson(200, { success: true, data: sub });
    }

    const appSelfMatch = pathname.match(/^\/api\/v1\/appraisals\/submissions\/([a-zA-Z0-9_\-]+)\/self$/);
    if (appSelfMatch && method === 'PUT') {
      const subId = appSelfMatch[1];
      const sub = this.appraisalSubmissions.get(subId);
      if (!sub) return this.makeError(404, 'NOT_FOUND', 'Appraisal submission not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      if (sub.employeeId !== user.profile.id) {
        return this.makeError(403, 'FORBIDDEN', 'Cannot submit self-appraisal for another staff member');
      }

      if (sub.status !== 'NOT_STARTED') {
        return this.makeError(
          409,
          'INVALID_STATE',
          sub.status === 'COMPLETED'
            ? 'Cannot alter self-appraisal on a completed evaluation'
            : 'Self-appraisal has already been submitted'
        );
      }

      if (!Array.isArray(body.goals) || body.goals.length === 0) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Goal ratings are required');
      }

      let totalSelfWeighted = 0;
      for (const g of body.goals) {
        const rating = Number(g.selfRating);
        if (isNaN(rating) || rating < 1.0 || rating > 5.0) {
          return this.makeError(422, 'INVALID_RATING', 'Score must be between 1.00 and 5.00');
        }
        const targetGoal = sub.goals.find(sg => sg.goalId === g.goalId);
        if (targetGoal) {
          targetGoal.selfRating = rating;
          targetGoal.selfComments = g.selfComments || '';
          totalSelfWeighted += rating * (targetGoal.weightage / 100);
        }
      }

      sub.selfScore = Number(totalSelfWeighted.toFixed(2));
      sub.employeeComments = body.employeeComments || '';
      sub.status = 'SELF_SUBMITTED';

      this.recordAuditLog(user.id, 'APPRAISAL_SELF_SUBMITTED', 'AppraisalSubmission', subId, ip, ua, {
        selfScore: sub.selfScore
      });

      return this.makeJson(200, { success: true, data: sub });
    }

    const appMgrMatch = pathname.match(/^\/api\/v1\/appraisals\/submissions\/([a-zA-Z0-9_\-]+)\/manager$/);
    if (appMgrMatch && method === 'PUT') {
      const subId = appMgrMatch[1];
      const sub = this.appraisalSubmissions.get(subId);
      if (!sub) return this.makeError(404, 'NOT_FOUND', 'Appraisal submission not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      if (sub.managerId !== user.profile.id && user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Access restricted to assigned direct reports');
      }

      if (sub.status !== 'SELF_SUBMITTED') {
        return this.makeError(
          409,
          'INVALID_STATE',
          sub.status === 'COMPLETED'
            ? 'Cannot alter manager review on a completed evaluation'
            : 'Manager review requires employee self-appraisal to be submitted first'
        );
      }

      if (!Array.isArray(body.goals)) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Manager ratings required');
      }

      let kraScore = 0;
      for (const g of body.goals) {
        const rating = Number(g.managerRating);
        if (isNaN(rating) || rating < 1.0 || rating > 5.0) {
          return this.makeError(422, 'INVALID_RATING', 'Score must be between 1.00 and 5.00');
        }
        const targetGoal = sub.goals.find(sg => sg.goalId === g.goalId);
        if (targetGoal) {
          targetGoal.managerRating = rating;
          targetGoal.managerComments = g.managerComments || '';
          kraScore += rating * (targetGoal.weightage / 100);
        }
      }

      if (body.competencyScore !== undefined) {
        const comp = Number(body.competencyScore);
        if (isNaN(comp) || comp < 1.0 || comp > 5.0) {
          return this.makeError(422, 'INVALID_RATING', 'Score must be between 1.00 and 5.00');
        }
      }

      const competencyScore = body.competencyScore !== undefined ? Number(body.competencyScore) : kraScore;
      const overall = (kraScore * 0.70) + (competencyScore * 0.30);

      sub.managerScore = Number(overall.toFixed(2));
      sub.managerSummaryFeedback = body.managerSummaryFeedback || '';
      sub.status = 'CALIBRATION_PENDING';

      this.recordAuditLog(user.id, 'APPRAISAL_MANAGER_SUBMITTED', 'AppraisalSubmission', subId, ip, ua, {
        managerScore: sub.managerScore
      });

      return this.makeJson(200, { success: true, data: sub });
    }

    const appCalibrateMatch = pathname.match(/^\/api\/v1\/appraisals\/submissions\/([a-zA-Z0-9_\-]+)\/calibrate$/);
    if (appCalibrateMatch && method === 'POST') {
      const subId = appCalibrateMatch[1];
      const sub = this.appraisalSubmissions.get(subId);
      if (!sub) return this.makeError(404, 'NOT_FOUND', 'Appraisal submission not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user || user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Administrative privilege required to calibrate scores');
      }

      if (sub.status !== 'CALIBRATION_PENDING') {
        return this.makeError(409, 'INVALID_STATE', 'Cannot calibrate appraisal before manager review is submitted');
      }

      const finalScore = Number(body.finalCalibratedScore);
      if (isNaN(finalScore) || finalScore < 1.0 || finalScore > 5.0) {
        return this.makeError(422, 'INVALID_RATING', 'Final calibrated score must be between 1.00 and 5.00');
      }

      sub.finalCalibratedScore = Number(finalScore.toFixed(2));
      sub.status = 'COMPLETED';

      this.recordAuditLog(user.id, 'APPRAISAL_CALIBRATED', 'AppraisalSubmission', subId, ip, ua, {
        finalCalibratedScore: sub.finalCalibratedScore
      });

      return this.makeJson(200, { success: true, data: sub });
    }

    const appAckMatch = pathname.match(/^\/api\/v1\/appraisals\/submissions\/([a-zA-Z0-9_\-]+)\/acknowledge$/);
    if (appAckMatch && method === 'POST') {
      const subId = appAckMatch[1];
      const sub = this.appraisalSubmissions.get(subId);
      if (!sub) return this.makeError(404, 'NOT_FOUND', 'Appraisal submission not found');

      const user = this.getSessionUserFromHeaders(headers);
      if (!user) return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      if (sub.employeeId !== user.profile.id) {
        return this.makeError(403, 'FORBIDDEN', 'Only assigned employee can acknowledge appraisal');
      }

      if (sub.status !== 'COMPLETED') {
        return this.makeError(409, 'INVALID_STATE', 'Cannot acknowledge appraisal before final calibration is completed');
      }

      sub.acknowledgedAt = new Date().toISOString();
      this.recordAuditLog(user.id, 'APPRAISAL_ACKNOWLEDGED', 'AppraisalSubmission', subId, ip, ua);
      return this.makeJson(200, { success: true, data: sub });
    }

    // -------------------------------------------------------------------------
    // 5B. ATTENDANCE & TIME TRACKING (Requirement R1)
    // -------------------------------------------------------------------------
    if (pathname === '/api/v1/attendance/today' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) {
        return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const lagosCtx = this.getLagosDateTime();
      const recordKey = `${user.id}_${lagosCtx.dateStr}`;
      const record = this.attendanceRecords.get(recordKey) || null;
      const summary = this.buildAttendanceSummary(record);
      return this.makeJson(200, { success: true, data: summary });
    }

    if (pathname === '/api/v1/attendance/clock-in' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) {
        return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const now = body?.timestamp ? new Date(body.timestamp) : new Date();
      if (isNaN(now.getTime())) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Invalid timestamp provided');
      }
      const nowIso = now.toISOString();
      const lagosCtx = this.getLagosDateTime(now);
      const recordKey = `${user.id}_${lagosCtx.dateStr}`;

      let record = this.attendanceRecords.get(recordKey);
      if (record && record.status === 'CLOCKED_IN') {
        const active = record.sessions.find(s => s.clockOut === null);
        if (active) {
          return this.makeError(409, 'ALREADY_CLOCKED_IN', 'Employee is already clocked in with an active session');
        }
      }

      const newSession: AttendanceSessionRecord = {
        id: `ses-${crypto.randomUUID()}`,
        clockIn: nowIso,
        clockOut: null,
        durationMinutes: 0,
        notes: typeof body?.notes === 'string' ? body.notes : undefined
      };

      if (!record) {
        let resumptionStatus: ResumptionStatus;
        let lateMinutes = 0;

        if (lagosCtx.isWeekend) {
          resumptionStatus = 'WEEKEND_DUTY';
          lateMinutes = 0;
        } else {
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
        this.attendanceRecords.set(recordKey, record);
      } else {
        record.sessions.push(newSession);
        record.status = 'CLOCKED_IN';
        record.updatedAt = nowIso;
      }

      this.recordAuditLog(user.id, 'STAFF_CLOCKED_IN', 'AttendanceRecord', record.id, ip, ua, {
        sessionId: newSession.id,
        clockIn: newSession.clockIn,
        resumptionStatus: record.resumptionStatus,
        dayOfWeek: record.dayOfWeek,
        isWeekend: record.isWeekend
      });

      const summary = this.buildAttendanceSummary(record, now);
      return this.makeJson(200, { success: true, data: summary });
    }

    if (pathname === '/api/v1/attendance/clock-out' && method === 'POST') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) {
        return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const now = body?.timestamp ? new Date(body.timestamp) : new Date();
      if (isNaN(now.getTime())) {
        return this.makeError(400, 'VALIDATION_ERROR', 'Invalid timestamp provided');
      }
      const nowIso = now.toISOString();
      const lagosCtx = this.getLagosDateTime(now);
      const recordKey = `${user.id}_${lagosCtx.dateStr}`;

      let record = this.attendanceRecords.get(recordKey);
      if (!record || record.status !== 'CLOCKED_IN') {
        const openRecords = Array.from(this.attendanceRecords.values()).filter(
          r => r.userId === user.id && r.status === 'CLOCKED_IN' && r.sessions.some(s => s.clockOut === null)
        );
        if (openRecords.length > 0) {
          record = openRecords[openRecords.length - 1];
        }
      }

      if (!record || record.status !== 'CLOCKED_IN') {
        return this.makeError(409, 'NOT_CLOCKED_IN', 'No active clock-in session found to clock out');
      }

      const activeSessionIndex = record.sessions.findIndex(s => s.clockOut === null);
      if (activeSessionIndex === -1) {
        return this.makeError(409, 'NOT_CLOCKED_IN', 'No active clock-in session found to clock out');
      }

      const session = record.sessions[activeSessionIndex];
      const startMs = new Date(session.clockIn).getTime();
      const endMs = now.getTime();
      const elapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

      session.clockOut = nowIso;
      session.durationMinutes = elapsedMinutes;
      if (typeof body?.notes === 'string') {
        session.notes = body.notes;
      }

      const totalCompletedMinutes = record.sessions
        .filter(s => s.clockOut !== null)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

      record.totalMinutesWorked = totalCompletedMinutes;
      record.totalHoursWorked = Number((totalCompletedMinutes / 60).toFixed(2));
      record.status = 'CLOCKED_OUT';
      record.lastClockOut = nowIso;
      record.updatedAt = nowIso;

      this.recordAuditLog(user.id, 'STAFF_CLOCKED_OUT', 'AttendanceRecord', record.id, ip, ua, {
        sessionId: session.id,
        clockOut: session.clockOut,
        durationMinutes: session.durationMinutes,
        totalMinutesWorked: record.totalMinutesWorked
      });

      const summary = this.buildAttendanceSummary(record, now);
      return this.makeJson(200, { success: true, data: summary });
    }

    if (pathname === '/api/v1/attendance/history' && method === 'GET') {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user) {
        return this.makeError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const limitParam = searchParams.get('limit');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      let records = Array.from(this.attendanceRecords.values()).filter(r => r.userId === user.id);

      if (startDate) {
        records = records.filter(r => r.date >= startDate);
      }
      if (endDate) {
        records = records.filter(r => r.date <= endDate);
      }

      records.sort((a, b) => b.date.localeCompare(a.date));

      if (limitParam) {
        const lim = parseInt(limitParam, 10);
        if (!isNaN(lim) && lim > 0) {
          records = records.slice(0, lim);
        }
      }

      return this.makeJson(200, { success: true, data: records });
    }

    // -------------------------------------------------------------------------
    // 6. SYSTEM AUDIT & SETTINGS
    // -------------------------------------------------------------------------
    if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {

      const user = this.getSessionUserFromHeaders(headers);
      if (!user || user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Administrative privilege required to view audit logs');
      }

      const action = searchParams.get('action');
      const entityType = searchParams.get('entityType');

      let logs = [...this.auditLogs];
      if (action) logs = logs.filter(l => l.action === action);
      if (entityType) logs = logs.filter(l => l.entityType === entityType);

      return this.makeJson(200, { success: true, data: logs });
    }

    if (pathname === '/api/v1/admin/settings' && (method === 'GET' || method === 'PATCH')) {
      const user = this.getSessionUserFromHeaders(headers);
      if (!user || user.role !== 'ADMIN') {
        return this.makeError(403, 'FORBIDDEN', 'Administrative privilege required to view/edit settings');
      }

      if (method === 'GET') {
        return this.makeJson(200, { success: true, data: this.systemSettings });
      }

      Object.assign(this.systemSettings, body);
      this.recordAuditLog(user.id, 'SETTINGS_UPDATED', 'SystemSettings', 'settings', ip, ua, body);
      return this.makeJson(200, { success: true, data: this.systemSettings });
    }

    return this.makeError(404, 'ENDPOINT_NOT_FOUND', `Route ${method} ${pathname} not found`);
  }
}
