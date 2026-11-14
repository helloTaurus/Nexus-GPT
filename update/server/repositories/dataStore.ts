import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import { UserRepository } from './userRepository.ts';
import { SessionRepository } from './sessionRepository.ts';
import { PasswordResetRepository } from './passwordResetRepository.ts';
import { LeaveRepository } from './leaveRepository.ts';
import { ExpenseRepository } from './expenseRepository.ts';
import { AppraisalRepository } from './appraisalRepository.ts';
import { SettingsRepository } from './settingsRepository.ts';
import { AttendanceRepository } from './attendanceRepository.ts';
import { AuditService } from '../services/auditService.ts';
import type {
  UserAccount,
  UserSession,
  PasswordResetToken,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  ExpenseReportRecord,
  AppraisalCycleRecord,
  AppraisalSubmissionRecord,
  SystemSettingsRecord,
  AttendanceRecord
} from './types.ts';

export class DataStore {
  private static instance: DataStore | null = null;

  public users!: UserRepository;
  public sessions!: SessionRepository;
  public passwordResets!: PasswordResetRepository;
  public leaves!: LeaveRepository;
  public expenses!: ExpenseRepository;
  public appraisals!: AppraisalRepository;
  public settings!: SettingsRepository;
  public attendance!: AttendanceRepository;
  public audit!: AuditService;

  private isInitialized = false;

  constructor(private dataDir: string) {
    const userStore = new AtomicJsonStore<UserAccount>(
      path.join(this.dataDir, 'users.json'),
      () => UserRepository.createDefaultSeed()
    );
    this.users = new UserRepository(userStore);

    const sessionStore = new AtomicJsonStore<UserSession>(
      path.join(this.dataDir, 'sessions.json'),
      () => []
    );
    this.sessions = new SessionRepository(sessionStore);

    const resetStore = new AtomicJsonStore<PasswordResetToken>(
      path.join(this.dataDir, 'password_resets.json'),
      () => []
    );
    this.passwordResets = new PasswordResetRepository(resetStore);

    const balanceStore = new AtomicJsonStore<LeaveBalanceRecord>(
      path.join(this.dataDir, 'leave_balances.json'),
      () => LeaveRepository.createDefaultSeedBalances()
    );
    const requestStore = new AtomicJsonStore<LeaveRequestRecord>(
      path.join(this.dataDir, 'leave_requests.json'),
      () => []
    );
    this.leaves = new LeaveRepository(balanceStore, requestStore);

    const expenseReportStore = new AtomicJsonStore<ExpenseReportRecord>(
      path.join(this.dataDir, 'expense_reports.json'),
      () => []
    );
    this.expenses = new ExpenseRepository(expenseReportStore);

    const cycleStore = new AtomicJsonStore<AppraisalCycleRecord>(
      path.join(this.dataDir, 'appraisal_cycles.json'),
      () => AppraisalRepository.createDefaultSeedCycles()
    );
    const subStore = new AtomicJsonStore<AppraisalSubmissionRecord>(
      path.join(this.dataDir, 'appraisal_submissions.json'),
      () => AppraisalRepository.createDefaultSeedSubmissions()
    );
    this.appraisals = new AppraisalRepository(cycleStore, subStore);

    const settingsStore = new AtomicJsonStore<SystemSettingsRecord>(
      path.join(this.dataDir, 'settings.json'),
      () => SettingsRepository.createDefaultSeedSettings()
    );
    this.settings = new SettingsRepository(settingsStore);

    const attendanceStore = new AtomicJsonStore<AttendanceRecord>(
      path.join(this.dataDir, 'attendance.json'),
      () => []
    );
    this.attendance = new AttendanceRepository(attendanceStore);

    this.audit = new AuditService(this.dataDir);
  }

  public static getInstance(dataDir?: string): DataStore {
    if (!DataStore.instance) {
      const resolvedDir = dataDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
      DataStore.instance = new DataStore(resolvedDir);
    }
    return DataStore.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await Promise.all([
      this.users.initialize(),
      this.sessions.initialize(),
      this.passwordResets.initialize(),
      this.leaves.initialize(),
      this.expenses.initialize(),
      this.appraisals.initialize(),
      this.settings.initialize(),
      this.attendance.initialize(),
      this.audit.initialize()
    ]);
    this.isInitialized = true;
  }

  public async reset(): Promise<void> {
    await Promise.all([
      this.users.reset(),
      this.sessions.reset(),
      this.passwordResets.reset(),
      this.leaves.reset(),
      this.expenses.reset(),
      this.appraisals.reset(),
      this.settings.reset(),
      this.attendance.reset(),
      this.audit.reset()
    ]);
  }
}

export async function initializeDataStore(dataDir?: string): Promise<DataStore> {
  const store = DataStore.getInstance(dataDir);
  await store.initialize();
  return store;
}

export async function closeDataStore(): Promise<void> {
  // Graceful flush handles can be finalized here
}

export function getDataStore(): DataStore {
  return DataStore.getInstance();
}

export function getUserRepository(): UserRepository {
  return getDataStore().users;
}

export function getSessionStore(): SessionRepository {
  return getDataStore().sessions;
}

export function getSessionRepository(): SessionRepository {
  return getDataStore().sessions;
}

export function getPasswordResetRepository(): PasswordResetRepository {
  return getDataStore().passwordResets;
}

export function getLeaveRepository(): LeaveRepository {
  return getDataStore().leaves;
}

export function getExpenseRepository(): ExpenseRepository {
  return getDataStore().expenses;
}

export function getAppraisalRepository(): AppraisalRepository {
  return getDataStore().appraisals;
}

export function getSettingsRepository(): SettingsRepository {
  return getDataStore().settings;
}

export function getAttendanceRepository(): AttendanceRepository {
  return getDataStore().attendance;
}

export function getAuditService(): AuditService {
  return getDataStore().audit;
}

