import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type { PasswordResetToken } from './types.ts';

export class PasswordResetRepository {
  constructor(private store: AtomicJsonStore<PasswordResetToken>) {}

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public async saveToken(email: string, token: string, ttlMinutes = 15): Promise<PasswordResetToken> {
    const canonical = email.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const record: PasswordResetToken = {
      id: canonical,
      email: canonical,
      token,
      expiresAt
    };
    return this.store.save(record);
  }

  public findValidToken(email: string, token: string): PasswordResetToken | null {
    const canonical = email.trim().toLowerCase();
    const record = this.store.getById(canonical);
    if (!record) return null;
    if (record.token !== token) return null;
    if (new Date(record.expiresAt) < new Date()) return null;
    return record;
  }

  public async consumeToken(email: string): Promise<boolean> {
    const canonical = email.trim().toLowerCase();
    return this.store.delete(canonical);
  }

  public async reset(): Promise<void> {
    await this.store.reset();
  }
}
