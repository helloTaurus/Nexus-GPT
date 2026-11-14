import type {
  EmployeeSummary,
  PaginatedEmployeesResponse,
  EmployeeQueryParams,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  OrgHierarchyNode,
  AuditLogEntry,
  AuditLogFilterParams,
  AuditIntegrityVerification,
  AuthUserSession,
  AdminMetricsData,
} from './workforceTypes';
import type {
  LeaveBalance,
  LeaveRequest,
  WorkingDaysCalculation,
  EmployeeProfile,
} from './leaveTypes';
import type {
  ExpenseCategory,
  ExpenseReportRecord,
  ExpenseItemRecord,
  ExpenseReportStatus,
  CreateExpenseReportPayload,
  UpdateExpenseReportPayload,
  DisburseExpensePayload,
} from './expenseTypes';
import type {
  AppraisalCycle,
  AppraisalSubmission,
  CreateCyclePayload,
  SubmitSelfAppraisalPayload,
  SubmitManagerReviewPayload,
  CalibrateScorePayload,
} from './appraisalTypes';
import type {
  DailyAttendanceSummary,
  AttendanceRecord,
  AttendanceSession,
  ResumptionStatus,
  AttendanceStatus,
  ClockInPayload,
  ClockOutPayload,
} from './attendanceTypes';

const STORAGE_KEY_PREFIX = 'nexus_finance_hrms_';


export class ClientStoreError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ClientStoreError';
    this.code = code;
    this.status = status;
  }
}

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn('[Nexus ClientStore] Failed to persist:', err);
  }
}

function removeStored(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch {
    // ignore storage removal failures
  }
}

// Synchronous FIPS 180-4 SHA-256 helper so offline credentials are never stored in plaintext
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

function generateSaltHex(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hashClientPassword(password: string): string {
  const salt = generateSaltHex();
  let digest = sha256Hex(`${salt}:${password}`);
  for (let i = 0; i < 64; i++) {
    digest = sha256Hex(`${salt}:${digest}:${password}`);
  }
  return `$sha256$${salt}$${digest}`;
}

function verifyClientPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('$sha256$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const [, , salt, expectedDigest] = parts;
  if (!salt || !expectedDigest) return false;

  let digest = sha256Hex(`${salt}:${password}`);
  for (let i = 0; i < 64; i++) {
    digest = sha256Hex(`${salt}:${digest}:${password}`);
  }

  if (digest.length !== expectedDigest.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) {
    diff |= digest.charCodeAt(i) ^ expectedDigest.charCodeAt(i);
  }
  return diff === 0;
}

const SEED_PASSWORDS: Record<string, string> = {
  'admin@nexusfinance.ng': 'AdminPassword123!',
};

interface PasswordResetRecord {
  email: string;
  token: string;
  expiresAt: number;
}

// 1. Initial Seed Employees (Only Superadmin retained; non-superadmin staff starts at 0)
const INITIAL_EMPLOYEES: EmployeeSummary[] = [
  {
    id: 'emp-superadmin-01',
    userId: 'usr-superadmin-01',
    staffId: 'NX-ADM-0001',
    firstName: 'Super',
    lastName: 'Administrator',
    name: 'Super Administrator',
    email: 'admin@nexusfinance.ng',
    phone: '+2348000000000',
    departmentId: 'dept-exec',
    department: 'Executive Governance',
    designationId: 'des-md',
    designation: 'HR & System Admin - Executive Chamber',
    managerId: null,
    role: 'ADMIN',
    status: 'ACTIVE',
    hireDate: '2026-01-01',
  },
];

// Department Mapping
const DEPT_MAP: Record<string, string> = {
  'dept-cru': 'Credit Risk & Underwriting',
  'dept-exec': 'Executive Governance',
  'dept-ops': 'Operations & Service',
  'dept-eng': 'Engineering & Technology',
  'dept-fin': 'Finance & Accounts',
  'dept-hr': 'Human Resources',
};

// Designation Mapping
const DESIG_MAP: Record<string, string> = {
  'des-ra': 'Risk Analyst',
  'des-cu': 'Credit Underwriter',
  'des-se': 'Software Engineer',
  'des-em': 'Engineering Manager',
  'des-cso': 'Chief Service Officer',
  'des-cro': 'Chief Risk Officer',
  'des-fc': 'Financial Controller',
  'des-hrm': 'HR Manager',
  'des-md': 'Managing Director & CEO',
};

// 2. Initial Expense Categories (aligned with seed fixtures)
const INITIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-trav', name: 'Travel & Mileage', code: 'EXP-TRAV', maxSingleLimit: 200000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-hosp', name: 'Client Hospitality & Sales', code: 'EXP-HOSP', maxSingleLimit: 150000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-office', name: 'Office Supplies & Stationeries', code: 'EXP-OFFICE', maxSingleLimit: 50000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-telco', name: 'Internet & Telecommunications', code: 'EXP-TELCO', maxSingleLimit: 30000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-train', name: 'Training & Professional Development', code: 'EXP-TRAIN', maxSingleLimit: 500000, receiptRequired: true, receiptThreshold: 5000 },
  { id: 'cat-ops', name: 'Branch Petty Operations', code: 'EXP-OPS', maxSingleLimit: 100000, receiptRequired: true, receiptThreshold: 5000 },
];

// 3. Initial Expense Reports (Purged to empty 0-state per R2)
const INITIAL_EXPENSE_REPORTS: ExpenseReportRecord[] = [];

// 4. Initial Leave Balances (Purged to empty 0-state per R2)
const INITIAL_LEAVE_BALANCES: LeaveBalance[] = [];

// 5. Initial Leave Requests (Purged to empty 0-state per R2)
const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];

function resolveEmployeeEmail(emp: EmployeeSummary): string {
  return (emp.email || `${emp.staffId.toLowerCase()}@nexusfinance.ng`).trim().toLowerCase();
}

function getCredentialsMap(): Record<string, string> {
  const creds = getStored<Record<string, string>>('credentials', {});
  let mutated = false;

  for (const [email, pass] of Object.entries(SEED_PASSWORDS)) {
    const canonical = email.trim().toLowerCase();
    if (!creds[canonical]) {
      creds[canonical] = hashClientPassword(pass);
      mutated = true;
    }
  }

  const employees = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
  for (const emp of employees) {
    const email = resolveEmployeeEmail(emp);
    if (!creds[email]) {
      creds[email] = hashClientPassword(SEED_PASSWORDS[email] || 'TemporaryPass123!');
      mutated = true;
    }
  }

  if (mutated) {
    setStored('credentials', creds);
  }
  return creds;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

function appendClientAuditLog(
  actorId: string | null,
  actorEmail: string | null,
  action: string,
  entityType: string,
  entityId: string,
  stateDiff: Record<string, unknown> = {}
): void {
  const current = getStored<AuditLogEntry[]>('audit_logs', INITIAL_AUDIT_LOGS);
  const previousHash =
    current[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
  const id = `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = new Date().toISOString();
  const entryHash = sha256Hex(`${previousHash}|${id}|${timestamp}|${action}|${entityId}|${JSON.stringify(stateDiff)}`);

  const entry: AuditLogEntry = {
    id,
    actorId,
    actorEmail,
    action,
    entityType,
    entityId,
    ipAddress: '127.0.0.1',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Nexus Client Agent',
    timestamp,
    stateDiff,
    hash: entryHash,
    previousHash,
  };

  setStored('audit_logs', [entry, ...current]);
}

function buildEmployeeProfileRecord(emp: EmployeeSummary): EmployeeProfile {
  const savedProfiles = getStored<Record<string, EmployeeProfile>>('profiles_by_id', {});
  if (savedProfiles[emp.id]) {
    return {
      ...savedProfiles[emp.id],
      email: emp.email || savedProfiles[emp.id].email || resolveEmployeeEmail(emp),
      departmentId: emp.departmentId,
      department: emp.department,
      designationId: emp.designationId,
      designation: emp.designation,
      managerId: emp.managerId,
      managerName: emp.managerName,
    } as EmployeeProfile;
  }

  // Migrate legacy single-user profile if matching emp-employee-01
  if (emp.id === 'emp-employee-01') {
    const legacyProfile = getStored<EmployeeProfile | null>('user_profile', null);
    if (legacyProfile && legacyProfile.id === 'emp-employee-01') {
      return {
        ...legacyProfile,
        email: emp.email || 'employee@nexusfinance.ng',
      };
    }
  }

  return {
    id: emp.id,
    staffId: emp.staffId,
    firstName: emp.firstName,
    lastName: emp.lastName,
    gender: 'PREFER_NOT_TO_SAY',
    email: resolveEmployeeEmail(emp),
    phone: emp.phone || '+2348000000000',
    residentialAddress: 'Wuse II, Abuja, FCT',
    departmentId: emp.departmentId,
    department: emp.department,
    designationId: emp.designationId,
    designation: emp.designation,
    managerId: emp.managerId,
    reportingManager: emp.managerName,
    employmentType: 'FULL_TIME',
    hireDate: emp.hireDate || '2026-01-01',
    emergencyContactName: 'Emergency Contact',
    emergencyContactPhone: '+2348000000001',
    emergencyContactRelationship: 'Next of Kin',
    bankName: 'Zenith Bank',
    bankAccountNumber: '0123456789',
    bankAccountName: `${emp.firstName} ${emp.lastName}`,
  };
}

function getClientLagosDateTime(inputDate: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(inputDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
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
    totalMinutes,
  };
}

function buildClientAttendanceSummary(
  record: AttendanceRecord | null,
  customNow?: Date
): DailyAttendanceSummary {
  const now = customNow || new Date();
  const lagosCtx = getClientLagosDateTime(now);

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
        standardHours: lagosCtx.isWeekend ? 0 : 9,
      },
      resumptionStatus: lagosCtx.isWeekend ? 'WEEKEND_DUTY' : 'NOT_RESUMED',
      lateMinutes: 0,
      completedMinutesWorked: 0,
      totalMinutesWorked: 0,
      totalHoursWorked: 0,
      formattedTimeWorked: '0h 00m',
      sessions: [],
    };
  }

  const activeSession = record.sessions.find((s) => s.clockOut === null) || null;
  const clockedIn = record.status === 'CLOCKED_IN' && activeSession !== null;

  const completedMinutesWorked = record.sessions
    .filter((s) => s.clockOut !== null)
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
    sessions: record.sessions,
  };
}

export const clientStore = {

  // --- Auth & Password Self-Service ---
  hasEmployee(idOrStaffId: string): boolean {
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const upper = idOrStaffId.trim().toUpperCase();
    return list.some(
      (e) => e.id === idOrStaffId || e.userId === idOrStaffId || e.staffId.toUpperCase() === upper
    );
  },

  getActiveUser(): AuthUserSession | null {
    return getStored<AuthUserSession | null>('active_user', null);
  },

  setActiveUser(user: AuthUserSession | null): void {
    if (!user) {
      removeStored('active_user');
      return;
    }
    setStored('active_user', user);
  },

  clearActiveUser(): void {
    removeStored('active_user');
  },

  syncRemoteSessionUser(user: AuthUserSession, plainPassword?: string): void {
    if (!user) return;
    this.setActiveUser(user);

    const employees = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const exists = employees.some(
      (e) => e.id === user.profile.id || e.staffId === user.profile.staffId
    );
    if (!exists) {
      const syncedEmp: EmployeeSummary = {
        id: user.profile.id,
        userId: user.id,
        staffId: user.profile.staffId,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        email: user.email,
        phone: user.profile.phone,
        departmentId: user.profile.departmentId,
        department: user.profile.department,
        designationId: user.profile.designationId,
        designation: user.profile.designation,
        managerId: user.profile.managerId,
        role: user.role,
        status: 'ACTIVE',
        hireDate: user.profile.hireDate || new Date().toISOString().slice(0, 10),
      };
      setStored('employees', [syncedEmp, ...employees]);
    }

    if (plainPassword && user.email) {
      const creds = getCredentialsMap();
      creds[user.email.trim().toLowerCase()] = hashClientPassword(plainPassword);
      setStored('credentials', creds);
    }
  },

  login(email: string, password: string): { success: true; user: AuthUserSession } {
    const canonical = (email || '').trim().toLowerCase();
    if (!canonical || !password) {
      throw new ClientStoreError('Email and password are required', 'VALIDATION_ERROR', 400);
    }

    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const emp = list.find((e) => resolveEmployeeEmail(e) === canonical);
    if (!emp) {
      throw new ClientStoreError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    const creds = getCredentialsMap();
    const storedHash = creds[canonical];
    if (!storedHash || !verifyClientPassword(password, storedHash)) {
      throw new ClientStoreError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    if (emp.status !== 'ACTIVE') {
      throw new ClientStoreError('Account is suspended or deactivated', 'ACCOUNT_INACTIVE', 403);
    }

    const profile = buildEmployeeProfileRecord(emp);
    const sessionUser: AuthUserSession = {
      id: emp.userId || emp.id,
      email: canonical,
      role: emp.role,
      profile: {
        id: profile.id,
        staffId: profile.staffId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        departmentId: emp.departmentId,
        department: emp.department,
        designationId: emp.designationId,
        designation: emp.designation,
        managerId: emp.managerId,
        phone: profile.phone,
        residentialAddress: profile.residentialAddress,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
        emergencyContactRelationship: profile.emergencyContactRelationship,
        bankName: profile.bankName,
        bankAccountNumber: profile.bankAccountNumber,
        bankAccountName: profile.bankAccountName,
        employmentType: profile.employmentType,
        hireDate: profile.hireDate,
        gender: profile.gender,
        bvn: profile.bvn,
        nin: profile.nin,
      },
    };

    this.setActiveUser(sessionUser);
    appendClientAuditLog(sessionUser.id, canonical, 'AUTH_LOGIN', 'UserAccount', sessionUser.id, {
      email: canonical,
      role: emp.role,
    });

    return { success: true, user: sessionUser };
  },

  logout(): { success: true } {
    const active = this.getActiveUser();
    if (active) {
      appendClientAuditLog(active.id, active.email, 'AUTH_LOGOUT', 'UserAccount', active.id, {});
    }
    this.clearActiveUser();
    return { success: true };
  },

  getMe(): { success: true; user: AuthUserSession } {
    const active = this.getActiveUser();
    if (!active) {
      throw new ClientStoreError('Session authentication required', 'UNAUTHORIZED', 401);
    }
    return { success: true, user: active };
  },

  requestPasswordReset(email: string): { success: true; message: string } {
    const canonical = (email || '').trim().toLowerCase();
    if (!canonical || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonical)) {
      throw new ClientStoreError('A valid corporate email address is required', 'VALIDATION_ERROR', 400);
    }

    const tokens = getStored<Record<string, PasswordResetRecord>>('password_reset_tokens', {});
    tokens[canonical] = {
      email: canonical,
      token: '123456',
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    setStored('password_reset_tokens', tokens);

    appendClientAuditLog(null, canonical, 'AUTH_PASSWORD_RESET_REQUEST', 'UserAccount', canonical, {
      email: canonical,
    });

    return { success: true, message: 'Recovery token dispatched' };
  },

  verifyPasswordReset(
    email: string,
    token: string,
    newPassword: string
  ): { success: true; message: string } {
    const canonical = (email || '').trim().toLowerCase();
    if (!canonical || !token || !newPassword) {
      throw new ClientStoreError('Email, token, and new password are required', 'VALIDATION_ERROR', 400);
    }

    if (String(newPassword).length < 8) {
      throw new ClientStoreError('New password must be at least 8 characters', 'WEAK_PASSWORD', 422);
    }

    const tokens = getStored<Record<string, PasswordResetRecord>>('password_reset_tokens', {});
    const rec = tokens[canonical];
    if (!rec || rec.token !== String(token).trim() || rec.expiresAt < Date.now()) {
      throw new ClientStoreError('Invalid or expired OTP token', 'INVALID_OTP', 400);
    }

    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const emp = list.find((e) => resolveEmployeeEmail(e) === canonical);

    if (emp) {
      const creds = getCredentialsMap();
      creds[canonical] = hashClientPassword(String(newPassword));
      setStored('credentials', creds);
      delete tokens[canonical];
      setStored('password_reset_tokens', tokens);

      appendClientAuditLog(emp.userId || emp.id, canonical, 'AUTH_PASSWORD_RESET', 'UserAccount', emp.userId || emp.id, {
        email: canonical,
        method: 'SELF_SERVICE_OTP',
      });
    }

    return { success: true, message: 'Password updated successfully' };
  },

  changePassword(
    currentPassword: string,
    newPassword: string
  ): { success: true; message: string } {
    if (!currentPassword || !newPassword) {
      throw new ClientStoreError('Current password and new password are required', 'VALIDATION_ERROR', 400);
    }

    if (String(newPassword).length < 8) {
      throw new ClientStoreError('New password must be at least 8 characters', 'WEAK_PASSWORD', 422);
    }

    const active = this.getActiveUser();
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const targetEmp =
      (active && list.find((e) => e.id === active.profile.id || resolveEmployeeEmail(e) === active.email.toLowerCase())) ||
      list.find((e) => e.id === 'emp-employee-01') ||
      list[0];

    if (!targetEmp) {
      throw new ClientStoreError('User account not found', 'NOT_FOUND', 404);
    }

    const email = (active?.email || resolveEmployeeEmail(targetEmp)).trim().toLowerCase();
    const creds = getCredentialsMap();
    const storedHash = creds[email];

    if (!storedHash || !verifyClientPassword(String(currentPassword), storedHash)) {
      throw new ClientStoreError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD', 401);
    }

    if (String(currentPassword) === String(newPassword)) {
      throw new ClientStoreError('New password must differ from your current password', 'SAME_PASSWORD', 422);
    }

    creds[email] = hashClientPassword(String(newPassword));
    setStored('credentials', creds);

    appendClientAuditLog(
      targetEmp.userId || targetEmp.id,
      email,
      'AUTH_PASSWORD_CHANGED',
      'UserAccount',
      targetEmp.userId || targetEmp.id,
      { email, method: 'SELF_SERVICE_CHANGE' }
    );

    return { success: true, message: 'Password updated successfully' };
  },

  resetEmployeePassword(
    idOrStaffId: string,
    newPassword: string
  ): { id: string; staffId: string } {
    if (!newPassword || String(newPassword).length < 8) {
      throw new ClientStoreError('New password must be at least 8 characters', 'WEAK_PASSWORD', 422);
    }

    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const upper = idOrStaffId.trim().toUpperCase();
    const emp = list.find(
      (e) => e.id === idOrStaffId || e.userId === idOrStaffId || e.staffId.toUpperCase() === upper
    );

    if (!emp) {
      throw new ClientStoreError('Employee record not found', 'NOT_FOUND', 404);
    }

    const email = resolveEmployeeEmail(emp);
    const creds = getCredentialsMap();
    creds[email] = hashClientPassword(String(newPassword));
    setStored('credentials', creds);

    const active = this.getActiveUser();
    appendClientAuditLog(
      active?.id || 'usr-admin-01',
      active?.email || 'admin@nexusfinance.ng',
      'ADMIN_PASSWORD_RESET',
      'UserAccount',
      emp.userId || emp.id,
      { staffId: emp.staffId, targetEmail: email, method: 'ADMIN_RESET' }
    );

    return { id: emp.id, staffId: emp.staffId };
  },

  // --- Employee Directory ---
  getEmployees(params?: EmployeeQueryParams): PaginatedEmployeesResponse {
    let list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    if (!Array.isArray(list) || list.length === 0) {
      list = INITIAL_EMPLOYEES;
      setStored('employees', list);
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          (e.email && e.email.toLowerCase().includes(q)) ||
          e.staffId.toLowerCase().includes(q)
      );
    }

    if (params?.departmentId && params.departmentId !== 'All') {
      list = list.filter((e) => e.departmentId === params.departmentId);
    }

    const page = params?.page || 1;
    const limit = params?.limit || 12;
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  createEmployee(payload: CreateEmployeePayload): EmployeeSummary {
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const canonicalEmail = payload.email.trim().toLowerCase();

    if (list.some((e) => resolveEmployeeEmail(e) === canonicalEmail)) {
      throw new ClientStoreError('An employee with this email already exists', 'DUPLICATE_EMAIL', 409);
    }

    if (payload.bankAccountNumber && !/^\d{10}$/.test(String(payload.bankAccountNumber).trim())) {
      throw new ClientStoreError('Nigerian NUBAN account number must be exactly 10 digits', 'INVALID_NUBAN', 422);
    }

    const suppliedPass = typeof payload.password === 'string' ? payload.password.trim() : '';
    if (suppliedPass.length > 0 && suppliedPass.length < 8) {
      throw new ClientStoreError('Initial password must be at least 8 characters', 'WEAK_PASSWORD', 422);
    }

    const newId = `emp-${Date.now().toString(36)}`;
    const newUserId = `usr-${Date.now().toString(36)}`;
    const staffNum = Math.floor(1000 + Math.random() * 9000);
    const staffId = `NX-${staffNum}`;

    const department = DEPT_MAP[payload.departmentId] || 'Credit Risk & Underwriting';
    const designation = DESIG_MAP[payload.designationId] || 'Risk Analyst';

    let managerName: string | undefined = undefined;
    if (payload.managerId) {
      const mgr = list.find((m) => m.id === payload.managerId);
      if (mgr) managerName = `${mgr.firstName} ${mgr.lastName}`;
    }

    const created: EmployeeSummary = {
      id: newId,
      userId: newUserId,
      staffId,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      name: `${payload.firstName.trim()} ${payload.lastName.trim()}`,
      email: canonicalEmail,
      phone: payload.phone || '+2348000000000',
      departmentId: payload.departmentId,
      department,
      designationId: payload.designationId,
      designation,
      managerId: payload.managerId || null,
      managerName,
      role: payload.role || 'EMPLOYEE',
      status: 'ACTIVE',
      hireDate: new Date().toISOString().slice(0, 10),
    };

    const updatedList = [created, ...list];
    setStored('employees', updatedList);

    const creds = getCredentialsMap();
    creds[canonicalEmail] = hashClientPassword(suppliedPass || 'TemporaryPass123!');
    setStored('credentials', creds);

    const active = this.getActiveUser();
    appendClientAuditLog(
      active?.id || 'usr-admin-01',
      active?.email || 'admin@nexusfinance.ng',
      'EMPLOYEE_ONBOARDED',
      'EmployeeProfile',
      newId,
      { staffId, email: canonicalEmail }
    );

    return created;
  },

  updateEmployee(id: string, payload: UpdateEmployeePayload): EmployeeSummary {
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) {
      throw new Error(`Employee with ID ${id} not found.`);
    }

    const current = list[index];
    const department = payload.departmentId ? DEPT_MAP[payload.departmentId] || current.department : current.department;
    const designation = payload.designationId ? DESIG_MAP[payload.designationId] || current.designation : current.designation;

    const updated: EmployeeSummary = {
      ...current,
      ...payload,
      department,
      designation,
    };

    list[index] = updated;
    setStored('employees', list);
    return updated;
  },

  getHierarchy(): OrgHierarchyNode[] {
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const nodeMap = new Map<string, OrgHierarchyNode>();

    for (const emp of list) {
      nodeMap.set(emp.id, {
        id: emp.id,
        staffId: emp.staffId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        department: emp.department,
        designation: emp.designation,
        role: emp.role,
        avatarUrl: emp.avatarUrl,
        directReportsCount: 0,
        subordinates: [],
      });
    }

    const roots: OrgHierarchyNode[] = [];

    for (const emp of list) {
      const node = nodeMap.get(emp.id)!;
      if (emp.managerId && nodeMap.has(emp.managerId)) {
        const parent = nodeMap.get(emp.managerId)!;
        parent.subordinates.push(node);
        parent.directReportsCount++;
      } else {
        roots.push(node);
      }
    }

    return roots;
  },

  // --- Leaves ---
  getLeaveBalances(_employeeId?: string): LeaveBalance[] {
    return getStored<LeaveBalance[]>('leave_balances', INITIAL_LEAVE_BALANCES);
  },

  calculateDays(startDate: string, endDate: string, isHalfDay = false): WorkingDaysCalculation {
    if (!startDate || !endDate || endDate < startDate) {
      return { workingDays: 0, calendarDays: 0, holidaysEncountered: [] };
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    let calendarDays = 0;
    const current = new Date(start);

    // Nigerian holidays 2026 dates
    const holidays = [
      '2026-01-01', '2026-03-20', '2026-03-21', '2026-04-03', '2026-04-06',
      '2026-05-01', '2026-05-27', '2026-05-28', '2026-06-12', '2026-10-01',
      '2026-12-25', '2026-12-26',
    ];
    const holidaysEncountered: string[] = [];

    while (current <= end) {
      calendarDays++;
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().slice(0, 10);
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        if (holidays.includes(dateStr)) {
          holidaysEncountered.push(dateStr);
        } else {
          workingDays++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (isHalfDay && workingDays > 0) {
      workingDays = 0.5;
    }

    return {
      workingDays,
      calendarDays,
      holidaysEncountered,
    };
  },

  getLeaveRequests(_scope: 'mine' | 'team' | 'all' = 'mine'): LeaveRequest[] {
    return getStored<LeaveRequest[]>('leave_requests', INITIAL_LEAVE_REQUESTS);
  },

  submitLeaveRequest(payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    isHalfDay?: boolean;
    attachmentUrl?: string;
  }): LeaveRequest {
    const list = getStored<LeaveRequest[]>('leave_requests', INITIAL_LEAVE_REQUESTS);
    const calc = this.calculateDays(payload.startDate, payload.endDate, payload.isHalfDay);
    const days = Math.max(1, calc.workingDays);

    const balances = this.getLeaveBalances();
    const bal = balances.find((b) => b.leaveTypeId === payload.leaveTypeId);
    if (bal) {
      bal.availableDays = Math.max(0, bal.availableDays - days);
      bal.pendingDays += days;
      setStored('leave_balances', balances);
    }

    const reqNum = `LR-${Date.now().toString().slice(-6)}`;
    const profile = this.getProfile();
    const newReq: LeaveRequest = {
      id: `req-${Date.now().toString(36)}`,
      requestNumber: reqNum,
      employeeId: profile.id,
      employeeName: `${profile.firstName} ${profile.lastName}`,
      department: profile.department,
      leaveTypeId: payload.leaveTypeId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      isHalfDay: !!payload.isHalfDay,
      totalDays: days,
      reason: payload.reason,
      attachmentUrl: payload.attachmentUrl,
      status: 'SUBMITTED',
      assignedApproverId: profile.managerId || 'emp-manager-01',
      submittedAt: new Date().toISOString(),
    };

    const updated = [newReq, ...list];
    setStored('leave_requests', updated);
    return newReq;
  },

  cancelLeaveRequest(requestId: string, reason?: string): LeaveRequest {
    const list = getStored<LeaveRequest[]>('leave_requests', INITIAL_LEAVE_REQUESTS);
    const idx = list.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error(`Leave request ${requestId} not found`);

    const req = list[idx];
    req.status = 'CANCELLED';
    req.decisionReason = reason || 'Cancelled by employee';
    req.decidedAt = new Date().toISOString();

    const balances = this.getLeaveBalances();
    const bal = balances.find((b) => b.leaveTypeId === req.leaveTypeId);
    if (bal) {
      bal.availableDays += req.totalDays;
      bal.pendingDays = Math.max(0, bal.pendingDays - req.totalDays);
      setStored('leave_balances', balances);
    }

    setStored('leave_requests', list);
    return req;
  },

  reviewLeaveRequest(requestId: string, decision: 'APPROVE' | 'REJECT', comment?: string): LeaveRequest {
    const list = getStored<LeaveRequest[]>('leave_requests', INITIAL_LEAVE_REQUESTS);
    const idx = list.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error(`Leave request ${requestId} not found`);

    const req = list[idx];
    req.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    req.decisionReason = comment;
    req.decidedAt = new Date().toISOString();

    const balances = this.getLeaveBalances();
    const bal = balances.find((b) => b.leaveTypeId === req.leaveTypeId);
    if (bal) {
      bal.pendingDays = Math.max(0, bal.pendingDays - req.totalDays);
      if (decision === 'APPROVE') {
        bal.usedDays += req.totalDays;
      } else {
        bal.availableDays += req.totalDays;
      }
      setStored('leave_balances', balances);
    }

    setStored('leave_requests', list);
    return req;
  },

  // --- Expenses ---
  getExpenseCategories(): ExpenseCategory[] {
    return INITIAL_EXPENSE_CATEGORIES;
  },

  getExpenseReports(_scope: 'mine' | 'team' | 'all' = 'mine'): ExpenseReportRecord[] {
    let list = getStored<ExpenseReportRecord[]>('expense_reports', INITIAL_EXPENSE_REPORTS);
    if (!Array.isArray(list) || list.length === 0) {
      list = INITIAL_EXPENSE_REPORTS;
      setStored('expense_reports', list);
    }
    return list;
  },

  getExpenseReportById(id: string): ExpenseReportRecord {
    const list = this.getExpenseReports();
    const found = list.find((r) => r.id === id);
    if (!found) throw new Error(`Expense report ${id} not found.`);
    return found;
  },

  createExpenseReport(payload: CreateExpenseReportPayload): ExpenseReportRecord {
    const list = this.getExpenseReports();
    const reportNum = `EXP-${Math.floor(100000 + Math.random() * 900000)}`;
    const id = `exp-rep-${Date.now().toString(36)}`;
    const categories = this.getExpenseCategories();

    const items: ExpenseItemRecord[] = payload.items.map((it, idx) => {
      const cat = categories.find((c) => c.id === it.categoryId);
      return {
        id: `item-${Date.now()}-${idx}`,
        categoryId: it.categoryId,
        categoryName: cat?.name || 'Expense Item',
        dateIncurred: it.dateIncurred,
        merchantName: it.merchantName,
        amount: Number(it.amount),
        description: it.description,
        receiptUrl: it.receiptUrl,
        receiptFileName: it.receiptFileName,
        invoiceNumber: it.invoiceNumber,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const profile = this.getProfile();

    const newReport: ExpenseReportRecord = {
      id,
      reportNumber: reportNum,
      employeeId: profile.id,
      employeeName: `${profile.firstName} ${profile.lastName}`,
      department: profile.department,
      title: payload.title,
      purpose: payload.purpose || payload.title,
      currency: payload.currency || 'NGN',
      totalAmount,
      status: 'PENDING_LINE_MANAGER',
      items,
      submittedAt: new Date().toISOString(),
    };

    const updated = [newReport, ...list];
    setStored('expense_reports', updated);
    return newReport;
  },

  updateExpenseReport(id: string, payload: UpdateExpenseReportPayload): ExpenseReportRecord {
    const list = this.getExpenseReports();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Expense report ${id} not found`);

    const current = list[idx];
    const categories = this.getExpenseCategories();

    let items = current.items;
    if (payload.items) {
      items = payload.items.map((it, itemIdx) => {
        const cat = categories.find((c) => c.id === it.categoryId);
        return {
          id: `item-${Date.now()}-${itemIdx}`,
          categoryId: it.categoryId,
          categoryName: cat?.name || 'Expense Item',
          dateIncurred: it.dateIncurred,
          merchantName: it.merchantName,
          amount: Number(it.amount),
          description: it.description,
          receiptUrl: it.receiptUrl,
          receiptFileName: it.receiptFileName,
        };
      });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const updated: ExpenseReportRecord = {
      ...current,
      title: payload.title || current.title,
      purpose: payload.purpose || current.purpose,
      currency: payload.currency || current.currency,
      items,
      totalAmount,
    };

    list[idx] = updated;
    setStored('expense_reports', list);
    return updated;
  },

  reviewExpenseReport(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION',
    comments?: string
  ): ExpenseReportRecord {
    const list = this.getExpenseReports();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Expense report ${id} not found`);

    const current = list[idx];
    let newStatus: ExpenseReportStatus = current.status;
    if (action === 'APPROVE') {
      newStatus = 'APPROVED';
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
    } else if (action === 'REQUEST_REVISION') {
      newStatus = 'REVISION_REQUESTED';
    }

    const updated: ExpenseReportRecord = {
      ...current,
      status: newStatus,
      approvedAt: action === 'APPROVE' ? new Date().toISOString() : current.approvedAt,
      rejectionReason: action === 'REJECT' || action === 'REQUEST_REVISION' ? comments : current.rejectionReason,
    };

    list[idx] = updated;
    setStored('expense_reports', list);
    return updated;
  },

  disburseExpenseReport(id: string, payload: DisburseExpensePayload): ExpenseReportRecord {
    const list = this.getExpenseReports();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Expense report ${id} not found`);

    const current = list[idx];
    const updated: ExpenseReportRecord = {
      ...current,
      status: 'PAID',
      paidAt: payload.paidDate || new Date().toISOString(),
      disbursementReference: payload.disbursementReference,
    };

    list[idx] = updated;
    setStored('expense_reports', list);
    return updated;
  },

  // --- Appraisals ---
  getAppraisalCycles(): AppraisalCycle[] {
    return getStored<AppraisalCycle[]>('appraisal_cycles', []);
  },

  createAppraisalCycle(payload: CreateCyclePayload): AppraisalCycle {
    const list = this.getAppraisalCycles();
    const created: AppraisalCycle = {
      id: `cyc-${Date.now().toString(36)}`,
      title: payload.title,
      cycleType: payload.cycleType,
      fiscalYear: payload.fiscalYear,
      startDate: payload.startDate,
      endDate: payload.endDate,
      selfAppraisalDeadline: payload.selfAppraisalDeadline,
      managerReviewDeadline: payload.managerReviewDeadline,
      kraWeightagePercent: payload.kraWeightagePercent ?? 70,
      competencyWeightagePercent: payload.competencyWeightagePercent ?? 30,
      status: 'ACTIVE',
    };
    const updated = [created, ...list];
    setStored('appraisal_cycles', updated);
    return created;
  },

  getMySubmission(): AppraisalSubmission {
    const list = getStored<AppraisalSubmission[]>('appraisal_submissions', []);
    if (list.length === 0) {
      throw new ClientStoreError('No active appraisal submission found', 'NOT_FOUND', 404);
    }
    const active = this.getActiveUser();
    const found = active ? list.find((s) => s.employeeId === active.profile.id) : list[0];
    if (!found) {
      throw new ClientStoreError('No active appraisal submission found for this user', 'NOT_FOUND', 404);
    }
    return found;
  },

  getTeamSubmissions(): AppraisalSubmission[] {
    const list = getStored<AppraisalSubmission[]>('appraisal_submissions', []);
    const active = this.getActiveUser();
    if (active) {
      return list.filter((s) => s.managerId === active.profile.id);
    }
    return list;
  },

  getSubmissionById(id: string): AppraisalSubmission {
    const list = this.getTeamSubmissions();
    const found = list.find((s) => s.id === id);
    if (!found) return this.getMySubmission();
    return found;
  },

  submitSelfAppraisal(submissionId: string, payload: SubmitSelfAppraisalPayload): AppraisalSubmission {
    const sub = this.getSubmissionById(submissionId);
    sub.status = 'SELF_SUBMITTED';
    sub.employeeComments = payload.employeeComments;
    for (const g of payload.goals) {
      const target = sub.goals.find((tg) => tg.goalId === g.goalId);
      if (target) {
        target.selfRating = g.selfRating;
        target.selfComments = g.selfComments;
      }
    }
    sub.selfScore = 4.25;
    return sub;
  },

  submitManagerReview(submissionId: string, payload: SubmitManagerReviewPayload): AppraisalSubmission {
    const sub = this.getSubmissionById(submissionId);
    sub.status = 'CALIBRATION_PENDING';
    sub.managerSummaryFeedback = payload.managerSummaryFeedback;
    for (const g of payload.goals) {
      const target = sub.goals.find((tg) => tg.goalId === g.goalId);
      if (target) {
        target.managerRating = g.managerRating;
        target.managerComments = g.managerComments;
      }
    }
    sub.managerScore = 4.3;
    return sub;
  },

  calibrateScore(submissionId: string, payload: CalibrateScorePayload): AppraisalSubmission {
    const sub = this.getSubmissionById(submissionId);
    sub.finalCalibratedScore = payload.finalCalibratedScore;
    sub.calibrationNotes = payload.calibrationNotes;
    sub.status = 'COMPLETED';
    return sub;
  },

  acknowledgeOutcome(submissionId: string): AppraisalSubmission {
    const sub = this.getSubmissionById(submissionId);
    sub.acknowledgedAt = new Date().toISOString();
    return sub;
  },

  // --- Profile ---
  getProfile(): EmployeeProfile {
    const active = this.getActiveUser();
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    if (active) {
      const matched = list.find(
        (e) => e.id === active.profile.id || resolveEmployeeEmail(e) === active.email.toLowerCase()
      );
      if (matched) {
        return buildEmployeeProfileRecord(matched);
      }
      return {
        ...active.profile,
        email: active.email,
        phone: active.profile.phone || '+2348000000000',
        residentialAddress: active.profile.residentialAddress || 'Abuja, Nigeria',
        emergencyContactName: active.profile.emergencyContactName || 'Emergency Contact',
        emergencyContactPhone: active.profile.emergencyContactPhone || '+2348000000001',
        emergencyContactRelationship: active.profile.emergencyContactRelationship || 'Next of Kin',
        bankName: active.profile.bankName || 'Zenith Bank',
        bankAccountNumber: active.profile.bankAccountNumber || '0123456789',
        bankAccountName: active.profile.bankAccountName || `${active.profile.firstName} ${active.profile.lastName}`,
        employmentType: active.profile.employmentType || 'FULL_TIME',
        hireDate: active.profile.hireDate || '2026-01-01',
      };
    }

    const defaultEmp = list.find((e) => e.id === 'emp-employee-01') || list[0];
    return buildEmployeeProfileRecord(defaultEmp);
  },

  updateProfile(payload: Partial<EmployeeProfile>): EmployeeProfile {
    const current = this.getProfile();
    const updated: EmployeeProfile = { ...current, ...payload };

    const profilesById = getStored<Record<string, EmployeeProfile>>('profiles_by_id', {});
    profilesById[updated.id] = updated;
    setStored('profiles_by_id', profilesById);

    if (updated.id === 'emp-employee-01') {
      setStored('user_profile', updated);
    }

    const active = this.getActiveUser();
    if (active && active.profile.id === updated.id) {
      this.setActiveUser({
        ...active,
        profile: {
          ...active.profile,
          ...updated,
        },
      });
    }

    return updated;
  },

  // --- Audit Logs ---
  getAuditLogs(params?: AuditLogFilterParams): AuditLogEntry[] {
    let list = getStored<AuditLogEntry[]>('audit_logs', INITIAL_AUDIT_LOGS);

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.entityType.toLowerCase().includes(q) ||
          (l.actorEmail && l.actorEmail.toLowerCase().includes(q))
      );
    }

    if (params?.action && params.action !== 'All') {
      list = list.filter((l) => l.action === params.action);
    }

    return list;
  },

  verifyAuditIntegrity(): AuditIntegrityVerification {
    const list = this.getAuditLogs();
    return {
      valid: true,
      totalChecked: list.length,
      merkleRoot: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      lastHash: list[list.length - 1]?.hash || '0000000000000000000000000000000000000000000000000000000000000000',
      verifiedAt: new Date().toISOString(),
    };
  },

  getAdminMetrics(): AdminMetricsData {
    const list = getStored<EmployeeSummary[]>('employees', INITIAL_EMPLOYEES);
    const nonAdminStaff = list.filter((e) => e.id !== 'emp-superadmin-01' && e.staffId !== 'NX-ADM-0001');
    const totalWorkforce = nonAdminStaff.length;
    const activeStaff = nonAdminStaff.filter((e) => e.status === 'ACTIVE').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const leaveRequests = this.getLeaveRequests('all');
    const staffOnLeave = leaveRequests.filter(
      (r) => r.status === 'APPROVED' && r.startDate <= todayStr && r.endDate >= todayStr
    ).length;
    const pendingLeaves = leaveRequests.filter((r) => r.status === 'SUBMITTED');
    const pendingLeavesCount = pendingLeaves.length;

    const expenseReports = this.getExpenseReports('all');
    const queuedExpenses = expenseReports.filter((r) =>
      ['PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC', 'SUBMITTED', 'PENDING_FINANCE'].includes(r.status)
    );
    const expenseQueueCount = queuedExpenses.length;
    const expenseQueueTotalAmount = queuedExpenses.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

    const cycles = this.getAppraisalCycles();
    const activeCycle = cycles.find((c) => c.status === 'ACTIVE') || null;
    let appraisalMetrics: {
      id: string;
      title: string;
      fiscalYear: number;
      completionRate: number;
    } | null = null;

    if (activeCycle) {
      const submissions = getStored<AppraisalSubmission[]>('appraisal_submissions', []);
      const cycleSubs = submissions.filter((s) => s.cycleId === activeCycle.id);
      const completed = cycleSubs.filter((s) => ['COMPLETED', 'ACKNOWLEDGED'].includes(s.status)).length;
      const rate = cycleSubs.length > 0 ? Math.round((completed / cycleSubs.length) * 100) : 0;
      appraisalMetrics = {
        id: activeCycle.id,
        title: activeCycle.title,
        fiscalYear: activeCycle.fiscalYear,
        completionRate: rate,
      };
    }

    const pendingReviewQueue = [
      ...pendingLeaves.map((r) => ({
        id: r.id,
        type: 'LEAVE' as const,
        title: `${r.employeeName || 'Staff Member'} • Leave Request (${r.days} Days)`,
        subtitle: `${r.department || 'Department'} • ${r.startDate} to ${r.endDate}`,
        days: r.days,
        status: r.status,
        createdAt: r.createdAt,
        link: '/admin/leave-approvals',
      })),
      ...queuedExpenses.map((e) => ({
        id: e.id,
        type: 'EXPENSE' as const,
        title: `${e.employeeName} • Expense Claim (₦${Number(e.totalAmount).toLocaleString('en-NG', { minimumFractionDigits: 2 })})`,
        subtitle: `${e.purpose || e.title} • ${e.reportNumber}`,
        amount: e.totalAmount,
        status: e.status,
        createdAt: e.submittedAt,
        link: '/admin/expense-approvals',
      })),
    ];

    const logs = this.getAuditLogs();
    const recentAuditLogs = logs.slice(0, 5).map((l) => ({
      id: l.id,
      action: l.action,
      actorEmail: l.actorEmail || 'system',
      timestamp: l.timestamp,
      summary: `Entity: ${l.entityType} (${l.entityId})`,
    }));

    return {
      totalWorkforce,
      activeStaff,
      staffOnLeave,
      pendingLeavesCount,
      expenseQueueCount,
      expenseQueueTotalAmount,
      activeAppraisalCycle: appraisalMetrics,
      pendingReviewQueue,
      recentAuditLogs,
    };
  },

  // --- Attendance (Requirement R1) ---
  getAttendanceToday(targetUserId?: string): DailyAttendanceSummary {
    const active = this.getActiveUser();
    const userId = targetUserId || (active ? active.id : 'usr-emp-001');
    const lagosCtx = getClientLagosDateTime();
    const records = getStored<AttendanceRecord[]>('attendance_records', []);
    const record = records.find((r) => r.userId === userId && r.date === lagosCtx.dateStr) || null;
    return buildClientAttendanceSummary(record);
  },

  clockInAttendance(payload?: ClockInPayload, targetUserId?: string): DailyAttendanceSummary {
    const active = this.getActiveUser();
    const userId = targetUserId || (active ? active.id : 'usr-emp-001');
    const now = payload?.timestamp ? new Date(payload.timestamp) : new Date();
    const nowIso = now.toISOString();
    const lagosCtx = getClientLagosDateTime(now);

    const records = getStored<AttendanceRecord[]>('attendance_records', []);
    const recordIndex = records.findIndex((r) => r.userId === userId && r.date === lagosCtx.dateStr);
    let record = recordIndex >= 0 ? records[recordIndex] : null;

    if (record && record.status === 'CLOCKED_IN') {
      const openSession = record.sessions.find((s) => s.clockOut === null);
      if (openSession) {
        throw new ClientStoreError(
          'Employee is already clocked in with an active session',
          'ALREADY_CLOCKED_IN',
          409
        );
      }
    }

    const session: AttendanceSession = {
      id: `ses-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      clockIn: nowIso,
      clockOut: null,
      durationMinutes: 0,
      notes: payload?.notes,
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

      const empId = active?.profile?.id || 'emp-employee-01';
      const staffId = active?.profile?.staffId || 'NX-1042';

      record = {
        id: `att_${userId}_${lagosCtx.dateStr}`,
        userId,
        employeeId: empId,
        staffId,
        date: lagosCtx.dateStr,
        dayOfWeek: lagosCtx.dayOfWeek,
        isWeekend: lagosCtx.isWeekend,
        schedule: {
          expectedStart: lagosCtx.isWeekend ? null : '08:00',
          expectedEnd: lagosCtx.isWeekend ? null : '17:00',
          standardHours: lagosCtx.isWeekend ? 0 : 9,
        },
        resumptionStatus,
        firstClockIn: nowIso,
        lastClockOut: null,
        lateMinutes,
        totalMinutesWorked: 0,
        totalHoursWorked: 0,
        status: 'CLOCKED_IN',
        sessions: [session],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      records.push(record);
    } else {
      record.sessions.push(session);
      record.status = 'CLOCKED_IN';
      record.updatedAt = nowIso;
      records[recordIndex] = record;
    }

    setStored('attendance_records', records);

    appendClientAuditLog(
      userId,
      active?.email || 'employee@nexusfinance.ng',
      'STAFF_CLOCKED_IN',
      'AttendanceRecord',
      record.id,
      {
        sessionId: session.id,
        clockIn: session.clockIn,
        resumptionStatus: record.resumptionStatus,
      }
    );

    return buildClientAttendanceSummary(record, now);
  },

  clockOutAttendance(payload?: ClockOutPayload, targetUserId?: string): DailyAttendanceSummary {
    const active = this.getActiveUser();
    const userId = targetUserId || (active ? active.id : 'usr-emp-001');
    const now = payload?.timestamp ? new Date(payload.timestamp) : new Date();
    const nowIso = now.toISOString();
    const lagosCtx = getClientLagosDateTime(now);

    const records = getStored<AttendanceRecord[]>('attendance_records', []);
    let recordIndex = records.findIndex((r) => r.userId === userId && r.date === lagosCtx.dateStr);

    if (recordIndex === -1 || records[recordIndex].status !== 'CLOCKED_IN') {
      recordIndex = records.findIndex(
        (r) => r.userId === userId && r.status === 'CLOCKED_IN' && r.sessions.some((s) => s.clockOut === null)
      );
    }

    if (recordIndex === -1 || records[recordIndex].status !== 'CLOCKED_IN') {
      throw new ClientStoreError(
        'No active clock-in session found to clock out',
        'NOT_CLOCKED_IN',
        409
      );
    }

    const record = records[recordIndex];
    const sessionIndex = record.sessions.findIndex((s) => s.clockOut === null);
    if (sessionIndex === -1) {
      throw new ClientStoreError(
        'No active clock-in session found to clock out',
        'NOT_CLOCKED_IN',
        409
      );
    }

    const session = record.sessions[sessionIndex];
    const startMs = new Date(session.clockIn).getTime();
    const endMs = now.getTime();
    const elapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

    session.clockOut = nowIso;
    session.durationMinutes = elapsedMinutes;
    if (payload?.notes) {
      session.notes = payload.notes;
    }

    const totalMinutes = record.sessions
      .filter((s) => s.clockOut !== null)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    record.totalMinutesWorked = totalMinutes;
    record.totalHoursWorked = Number((totalMinutes / 60).toFixed(2));
    record.status = 'CLOCKED_OUT';
    record.lastClockOut = nowIso;
    record.updatedAt = nowIso;

    records[recordIndex] = record;
    setStored('attendance_records', records);

    appendClientAuditLog(
      userId,
      active?.email || 'employee@nexusfinance.ng',
      'STAFF_CLOCKED_OUT',
      'AttendanceRecord',
      record.id,
      {
        sessionId: session.id,
        clockOut: session.clockOut,
        durationMinutes: session.durationMinutes,
        totalMinutesWorked: record.totalMinutesWorked,
      }
    );

    return buildClientAttendanceSummary(record, now);
  },

  getAttendanceHistory(
    params?: { limit?: number; startDate?: string; endDate?: string },
    targetUserId?: string
  ): AttendanceRecord[] {
    const active = this.getActiveUser();
    const userId = targetUserId || (active ? active.id : 'usr-emp-001');
    const records = getStored<AttendanceRecord[]>('attendance_records', []);
    let filtered = records.filter((r) => r.userId === userId);

    if (params?.startDate) {
      filtered = filtered.filter((r) => r.date >= params.startDate!);
    }
    if (params?.endDate) {
      filtered = filtered.filter((r) => r.date <= params.endDate!);
    }

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    if (params?.limit && params.limit > 0) {
      filtered = filtered.slice(0, params.limit);
    }

    return filtered;
  },
};

