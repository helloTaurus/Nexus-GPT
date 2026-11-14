import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  stateDiff: Record<string, unknown>;
  metadataDiff: Record<string, unknown>;
  hash: string;
  previousHash: string;
}

export interface AuditLogFilter {
  action?: string;
  entityType?: string;
  actorId?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

import { fileURLToPath } from 'node:url';

export class AuditService {
  private logFilePath: string;
  private inMemoryLogs: AuditLogEntry[] = [];
  private lastHash: string = '0000000000000000000000000000000000000000000000000000000000000000';
  private writeMutex: Promise<void> = Promise.resolve();

  constructor(storageDir?: string) {
    const resolvedDir = storageDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
    this.logFilePath = path.join(resolvedDir, 'audit_logs.jsonl');
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });

    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      this.inMemoryLogs = [];

      for (const line of lines) {
        try {
          const entry: AuditLogEntry = JSON.parse(line);
          this.inMemoryLogs.unshift(entry); // Newest first
          this.lastHash = entry.hash;
        } catch {
          // Skip malformed trailing line if crash occurred mid-write
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Failed to load audit logs: ${err.message}`);
      }
    }
  }

  private calculateHash(entry: Omit<AuditLogEntry, 'hash'>): string {
    const payload = `${entry.previousHash}|${entry.id}|${entry.timestamp}|${entry.actorId || 'null'}|${entry.action}|${entry.entityType}|${entry.entityId}|${JSON.stringify(entry.stateDiff)}`;
    return crypto.createHash('sha256').update(payload, 'utf-8').digest('hex');
  }

  public async record(params: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
    stateDiff?: Record<string, unknown>;
    metadataDiff?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    let release: () => void;
    const nextMutex = new Promise<void>(res => { release = res; });
    const currentMutex = this.writeMutex;
    this.writeMutex = nextMutex;
    await currentMutex;

    try {
      const id = `aud-${crypto.randomUUID()}`;
      const timestamp = new Date().toISOString();
      const diff = params.stateDiff || params.metadataDiff || {};

      const baseEntry: Omit<AuditLogEntry, 'hash'> = {
        id,
        actorId: params.actorId || null,
        actorEmail: params.actorEmail || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'UnknownClient',
        timestamp,
        stateDiff: diff,
        metadataDiff: diff, // Dual compatibility for test fixtures and spec
        previousHash: this.lastHash
      };

      const hash = this.calculateHash(baseEntry);
      const fullEntry: AuditLogEntry = { ...baseEntry, hash };

      // Append to file (immutability)
      await fs.appendFile(this.logFilePath, JSON.stringify(fullEntry) + '\n', 'utf-8');

      // Update state
      this.lastHash = hash;
      this.inMemoryLogs.unshift(fullEntry);

      return fullEntry;
    } finally {
      release!();
    }
  }

  public query(filter: AuditLogFilter = {}): {
    data: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    let results = [...this.inMemoryLogs];

    if (filter.action) {
      results = results.filter(l => l.action === filter.action);
    }
    if (filter.entityType) {
      results = results.filter(l => l.entityType === filter.entityType);
    }
    if (filter.actorId) {
      results = results.filter(l => l.actorId === filter.actorId);
    }
    if (filter.entityId) {
      results = results.filter(l => l.entityId === filter.entityId);
    }
    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      results = results.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      results = results.filter(l => new Date(l.timestamp).getTime() <= end);
    }

    const total = results.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, filter.limit || 100);
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = results.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages
    };
  }

  public getAll(): AuditLogEntry[] {
    return [...this.inMemoryLogs];
  }

  public verifyIntegrity(): { valid: boolean; compromisedId?: string; totalChecked: number } {
    const ascending = [...this.inMemoryLogs].reverse();
    let expectedPrevious = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const entry of ascending) {
      if (entry.previousHash !== expectedPrevious) {
        return { valid: false, compromisedId: entry.id, totalChecked: ascending.length };
      }
      const recalculated = this.calculateHash(entry);
      if (recalculated !== entry.hash) {
        return { valid: false, compromisedId: entry.id, totalChecked: ascending.length };
      }
      expectedPrevious = entry.hash;
    }

    return { valid: true, totalChecked: ascending.length };
  }

  public async reset(): Promise<void> {
    let release: () => void;
    const nextMutex = new Promise<void>(res => { release = res; });
    const currentMutex = this.writeMutex;
    this.writeMutex = nextMutex;
    await currentMutex;

    try {
      this.inMemoryLogs = [];
      this.lastHash = '0000000000000000000000000000000000000000000000000000000000000000';
      await fs.writeFile(this.logFilePath, '', 'utf-8');
    } finally {
      release!();
    }
  }
}
