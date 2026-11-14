import { AtomicJsonStore } from './store/AtomicJsonStore.ts';
import type { UserSession } from './types.ts';

export class SessionRepository {
  constructor(private store: AtomicJsonStore<UserSession>) {}

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public async create(session: UserSession): Promise<UserSession> {
    return this.store.save(session);
  }

  public findByToken(token: string): UserSession | null {
    return this.store.getById(token) || null;
  }

  public async touchSession(token: string): Promise<void> {
    const session = this.findByToken(token);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
      await this.store.save(session);
    }
  }

  public async deleteByToken(token: string): Promise<boolean> {
    return this.store.delete(token);
  }

  public async deleteByUserId(userId: string, excludeToken?: string): Promise<void> {
    const sessions = this.store.filter(s => s.userId === userId);
    for (const s of sessions) {
      if (excludeToken && s.id === excludeToken) continue;
      await this.store.delete(s.id);
    }
  }

  public async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const sessions = this.store.getAll();
    let cleaned = 0;
    for (const s of sessions) {
      const exp = new Date(s.expiresAt).getTime();
      const lastAct = new Date(s.lastActivityAt).getTime();
      if (now > exp || now - lastAct > 30 * 60 * 1000) {
        await this.store.delete(s.id);
        cleaned++;
      }
    }
    return cleaned;
  }

  public async reset(): Promise<void> {
    await this.store.reset();
  }
}
