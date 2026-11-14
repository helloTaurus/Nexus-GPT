import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class AtomicJsonStore<T extends { id: string }> {
  private inMemoryCache: Map<string, T> = new Map();
  private writeLock: Promise<void> = Promise.resolve();
  private initialized: boolean = false;

  constructor(
    public readonly filePath: string,
    private readonly defaultSeedFactory: () => T[]
  ) {}

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const records: T[] = JSON.parse(data);
      this.inMemoryCache.clear();
      for (const item of records) {
        this.inMemoryCache.set(item.id, item);
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        const initial = this.defaultSeedFactory();
        this.inMemoryCache.clear();
        for (const item of initial) {
          this.inMemoryCache.set(item.id, item);
        }
        await this.persistToDisk();
      } else {
        throw new Error(`Failed to load store at ${this.filePath}: ${err.message}`);
      }
    }
    this.initialized = true;
  }

  public async withLock<R>(operation: () => Promise<R>): Promise<R> {
    let release: () => void;
    const nextLock = new Promise<void>(resolve => { release = resolve; });
    const currentLock = this.writeLock;
    this.writeLock = nextLock;
    await currentLock;
    try {
      return await operation();
    } finally {
      release!();
    }
  }

  private async persistToDisk(): Promise<void> {
    const tempPath = `${this.filePath}.tmp.${crypto.randomUUID()}`;
    const serialized = JSON.stringify(Array.from(this.inMemoryCache.values()), null, 2);

    // 1. Write to unique temporary file
    await fs.writeFile(tempPath, serialized, 'utf-8');

    // 2. Force OS buffer flush (Durability)
    try {
      const handle = await fs.open(tempPath, 'r+');
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch {
      // Fallback if open/sync not supported on target filesystem
    }

    // 3. Atomic rename with Windows retry backoff (Atomicity)
    let retries = 5;
    while (retries > 0) {
      try {
        await fs.rename(tempPath, this.filePath);
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) {
          try { await fs.unlink(tempPath); } catch {}
          throw err;
        }
        await new Promise(res => setTimeout(res, 20));
      }
    }
  }

  public getAll(): T[] {
    return Array.from(this.inMemoryCache.values());
  }

  public getById(id: string): T | undefined {
    return this.inMemoryCache.get(id);
  }

  public find(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.inMemoryCache.values()) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  public filter(predicate: (item: T) => boolean): T[] {
    const results: T[] = [];
    for (const item of this.inMemoryCache.values()) {
      if (predicate(item)) results.push(item);
    }
    return results;
  }

  public async save(entity: T): Promise<T> {
    return this.withLock(async () => {
      this.inMemoryCache.set(entity.id, entity);
      await this.persistToDisk();
      return entity;
    });
  }

  public async saveMany(entities: T[]): Promise<T[]> {
    return this.withLock(async () => {
      for (const e of entities) {
        this.inMemoryCache.set(e.id, e);
      }
      await this.persistToDisk();
      return entities;
    });
  }

  public async delete(id: string): Promise<boolean> {
    return this.withLock(async () => {
      const existed = this.inMemoryCache.delete(id);
      if (existed) {
        await this.persistToDisk();
      }
      return existed;
    });
  }

  public async reset(): Promise<void> {
    return this.withLock(async () => {
      const initial = this.defaultSeedFactory();
      this.inMemoryCache.clear();
      for (const item of initial) {
        this.inMemoryCache.set(item.id, item);
      }
      await this.persistToDisk();
    });
  }
}
