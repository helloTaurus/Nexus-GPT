import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type { LeaveBalanceRecord, LeaveRequestRecord } from './types.ts';
import { SEED_LEAVE_TYPES, SEED_NIGERIAN_HOLIDAYS_2026 } from '../../../tests/fixtures/seedData.ts';
import crypto from 'node:crypto';

export class LeaveRepository {
  constructor(
    private balanceStore: AtomicJsonStore<LeaveBalanceRecord>,
    private requestStore: AtomicJsonStore<LeaveRequestRecord>
  ) {}

  public static createDefaultSeedBalances(): LeaveBalanceRecord[] {
    return [];
  }

  public async initialize(): Promise<void> {
    await this.balanceStore.initialize();
    await this.requestStore.initialize();
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

  public findBalances(employeeId: string, fiscalYear = 2026): LeaveBalanceRecord[] {
    return this.balanceStore.filter(b => b.employeeId === employeeId && b.fiscalYear === fiscalYear);
  }

  public findBalance(employeeId: string, leaveTypeId: string, fiscalYear = 2026): LeaveBalanceRecord | null {
    return (
      this.balanceStore.find(
        b => b.employeeId === employeeId && b.leaveTypeId === leaveTypeId && b.fiscalYear === fiscalYear
      ) || null
    );
  }

  public async saveBalance(balance: LeaveBalanceRecord): Promise<LeaveBalanceRecord> {
    return this.balanceStore.save(balance);
  }

  public async initializeEmployeeBalances(employeeId: string, initialAnnualLeaveDays = 20.0, fiscalYear = 2026): Promise<void> {
    const newBalances: LeaveBalanceRecord[] = [];
    for (const lt of SEED_LEAVE_TYPES) {
      const quota = lt.id === 'lt-annual' ? initialAnnualLeaveDays : lt.annualQuota;
      newBalances.push({
        id: `${employeeId}_${lt.id}_${fiscalYear}`,
        employeeId,
        leaveTypeId: lt.id,
        fiscalYear,
        allocatedDays: quota,
        carriedOverDays: 0,
        accruedDays: quota,
        usedDays: 0,
        pendingDays: 0,
        availableDays: quota
      });
    }
    await this.balanceStore.saveMany(newBalances);
  }

  public findRequests(filter: { employeeId?: string; approverId?: string; all?: boolean } = {}): LeaveRequestRecord[] {
    if (filter.all) {
      return this.requestStore.getAll();
    }
    if (filter.approverId) {
      return this.requestStore.filter(r => r.assignedApproverId === filter.approverId);
    }
    if (filter.employeeId) {
      return this.requestStore.filter(r => r.employeeId === filter.employeeId);
    }
    return this.requestStore.getAll();
  }

  public findRequestById(id: string): LeaveRequestRecord | null {
    return this.requestStore.getById(id) || null;
  }

  public async createRequest(request: LeaveRequestRecord): Promise<LeaveRequestRecord> {
    return this.requestStore.save(request);
  }

  public async updateRequest(id: string, updates: Partial<LeaveRequestRecord>): Promise<LeaveRequestRecord> {
    const req = this.findRequestById(id);
    if (!req) throw new Error(`Leave request not found: ${id}`);
    Object.assign(req, updates);
    await this.requestStore.save(req);
    return req;
  }

  public async reset(): Promise<void> {
    await this.balanceStore.reset();
    await this.requestStore.reset();
  }
}
