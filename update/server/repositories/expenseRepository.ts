import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type { ExpenseReportRecord } from './types.ts';
import { SEED_EXPENSE_CATEGORIES, type SeedExpenseCategory } from '../../../tests/fixtures/seedData.ts';

export class ExpenseRepository {
  constructor(private reportStore: AtomicJsonStore<ExpenseReportRecord>) {}

  public async initialize(): Promise<void> {
    await this.reportStore.initialize();
  }

  public getCategories(): SeedExpenseCategory[] {
    return SEED_EXPENSE_CATEGORIES;
  }

  public findCategoryByIdOrCode(idOrCode: string): SeedExpenseCategory | undefined {
    return SEED_EXPENSE_CATEGORIES.find(c => c.id === idOrCode || c.code === idOrCode);
  }

  public findReports(filter: { employeeId?: string; approverId?: string; all?: boolean } = {}): ExpenseReportRecord[] {
    if (filter.all) {
      return this.reportStore.getAll();
    }
    if (filter.approverId) {
      return this.reportStore.filter(r => r.currentApproverId === filter.approverId);
    }
    if (filter.employeeId) {
      return this.reportStore.filter(r => r.employeeId === filter.employeeId);
    }
    return this.reportStore.getAll();
  }

  public findReportById(id: string): ExpenseReportRecord | null {
    return this.reportStore.getById(id) || null;
  }

  public async createReport(report: ExpenseReportRecord): Promise<ExpenseReportRecord> {
    return this.reportStore.save(report);
  }

  public async updateReport(id: string, updates: Partial<ExpenseReportRecord>): Promise<ExpenseReportRecord> {
    const report = this.findReportById(id);
    if (!report) throw new Error(`Expense report not found: ${id}`);
    Object.assign(report, updates);
    await this.reportStore.save(report);
    return report;
  }

  public async reset(): Promise<void> {
    await this.reportStore.reset();
  }
}
