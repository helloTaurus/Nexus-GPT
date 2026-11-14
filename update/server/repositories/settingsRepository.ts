import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type { SystemSettingsRecord } from './types.ts';

export class SettingsRepository {
  constructor(private store: AtomicJsonStore<SystemSettingsRecord>) {}

  public static createDefaultSeedSettings(): SystemSettingsRecord[] {
    return [
      {
        id: 'settings',
        fiscalYear: 2026,
        maxCarryOverAnnualLeave: 5.0,
        receiptEnforcementThresholdNGN: 5000.0,
        expenseManagerThresholdNGN: 50000.0,
        expenseExecutiveThresholdNGN: 250000.0
      }
    ];
  }

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public getSettings(): SystemSettingsRecord {
    const s = this.store.getById('settings');
    if (!s) {
      return SettingsRepository.createDefaultSeedSettings()[0];
    }
    return s;
  }

  public async updateSettings(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord> {
    const s = this.getSettings();
    Object.assign(s, updates);
    await this.store.save(s);
    return s;
  }

  public async reset(): Promise<void> {
    await this.store.reset();
  }
}
