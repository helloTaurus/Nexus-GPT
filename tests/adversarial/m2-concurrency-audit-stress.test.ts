import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { AtomicJsonStore } from '../../update/server/repositories/store/AtomicJsonStore.ts';
import { AuditService } from '../../update/server/services/auditService.ts';
import { createApp } from '../../update/server/app.ts';
import { initializeDataStore, getDataStore } from '../../update/server/repositories/dataStore.ts';
import { getAuditLogsHandler } from '../../update/server/controllers/adminController.ts';
import { createAuthenticatedClient } from '../helpers/testHarness.ts';

const TEST_WORK_DIR = path.resolve('tests', 'tmp_stress_workspace');

interface TestRecord {
  id: string;
  counter: number;
  label: string;
  updatedAt: string;
}

// In-process Express invocation helper with zero TCP socket overhead
function invokeExpress(
  app: any,
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; headers: Record<string, any>; body: any }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;

    const payload = options.body !== undefined ? JSON.stringify(options.body) : '';
    const headers = options.headers || {};

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }
    if (payload) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = Buffer.byteLength(payload).toString();
    }

    const res = new ServerResponse(req);
    let resData = '';

    res.write = function (chunk: any) {
      if (chunk) resData += chunk.toString();
      return true;
    } as any;

    res.end = function (chunk: any) {
      if (chunk) resData += chunk.toString();
      let parsed: any;
      try {
        parsed = JSON.parse(resData);
      } catch {
        parsed = resData;
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsed
      });
      return this;
    } as any;

    app.handle(req, res);

    if (payload) {
      req.push(payload);
    }
    req.push(null);
  });
}

describe('M2 Adversarial Challenge: Transactional Concurrency & Audit Integrity', () => {
  before(async () => {
    await fs.mkdir(TEST_WORK_DIR, { recursive: true });
  });

  after(async () => {
    try {
      await fs.rm(TEST_WORK_DIR, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================================================
  // SECTION 1: AtomicJsonStore Concurrency & FIFO Mutex Stress-Testing
  // ==========================================================================
  describe('1. AtomicJsonStore Concurrency & FIFO Mutex', () => {
    test('1.1: 100 rapid concurrent save mutations to distinct records produce zero lost updates or corruption', async () => {
      const storeFile = path.join(TEST_WORK_DIR, 'store_concurrent_100.json');
      const store = new AtomicJsonStore<TestRecord>(storeFile, () => []);
      await store.initialize();

      const CONCURRENCY = 100;
      const tasks = Array.from({ length: CONCURRENCY }, (_, i) => {
        return store.save({
          id: `rec-${i}`,
          counter: i,
          label: `Label ${i}`,
          updatedAt: new Date().toISOString()
        });
      });

      const results = await Promise.all(tasks);
      assert.equal(results.length, CONCURRENCY, 'All 100 save promises must resolve');

      // Verify in-memory state
      const inMemoryAll = store.getAll();
      assert.equal(inMemoryAll.length, CONCURRENCY, 'In-memory cache must hold all 100 records');

      // Verify on-disk file
      const rawDisk = await fs.readFile(storeFile, 'utf-8');
      let parsedDisk: TestRecord[];
      assert.doesNotThrow(() => {
        parsedDisk = JSON.parse(rawDisk);
      }, 'On-disk file must be valid JSON');

      assert.equal(parsedDisk!.length, CONCURRENCY, 'On-disk file must have all 100 records');

      // Verify no orphaned temp files
      const dirFiles = await fs.readdir(TEST_WORK_DIR);
      const tmpFiles = dirFiles.filter((f) => f.includes('store_concurrent_100.json.tmp'));
      assert.equal(tmpFiles.length, 0, 'No temporary files should be orphaned after concurrent writes');
    });

    test('1.2: Rapid concurrent mutations to the SAME record: FIFO write mutex prevents race conditions and corrupted JSON', async () => {
      const storeFile = path.join(TEST_WORK_DIR, 'store_same_record_mutations.json');
      const store = new AtomicJsonStore<TestRecord>(storeFile, () => [
        { id: 'shared-rec', counter: 0, label: 'Initial', updatedAt: new Date().toISOString() }
      ]);
      await store.initialize();

      const MUTATIONS = 50;
      // 50 concurrent callers attempting to overwrite the SAME record concurrently
      const tasks = Array.from({ length: MUTATIONS }, (_, i) => {
        return store.save({
          id: 'shared-rec',
          counter: i + 1,
          label: `Mutation-${i + 1}`,
          updatedAt: new Date().toISOString()
        });
      });

      const savedResults = await Promise.all(tasks);
      assert.equal(savedResults.length, MUTATIONS, 'All 50 concurrent mutations must resolve');

      // Check on-disk file integrity
      const rawDisk = await fs.readFile(storeFile, 'utf-8');
      let diskRecords: TestRecord[];
      assert.doesNotThrow(() => {
        diskRecords = JSON.parse(rawDisk);
      }, 'Disk file must remain strictly valid uncorrupted JSON after 50 concurrent overwrites');

      assert.equal(diskRecords!.length, 1, 'Only the single shared record must exist');
      assert.equal(diskRecords![0].id, 'shared-rec');

      // In-memory record must match on-disk record
      const inMemory = store.getById('shared-rec')!;
      assert.equal(inMemory.id, 'shared-rec');
      assert.equal(inMemory.counter, diskRecords![0].counter, 'In-memory and on-disk counters must be in sync');
      assert.equal(inMemory.label, diskRecords![0].label, 'In-memory and on-disk labels must be in sync');
    });

    test('1.3: Architectural stress discovery: nested withLock inside withLock exhibits non-reentrant deadlock', async () => {
      const storeFile = path.join(TEST_WORK_DIR, 'store_reentrancy_test.json');
      const store = new AtomicJsonStore<TestRecord>(storeFile, () => []);
      await store.initialize();

      // We test whether calling store.save() (which acquires withLock) from inside an outer store.withLock() deadlocks
      let deadlockDetected = false;

      const deadlockPromise = store.withLock(async () => {
        // Attempting to call store.save inside an active withLock
        return store.save({
          id: 'nested-1',
          counter: 1,
          label: 'Nested',
          updatedAt: new Date().toISOString()
        });
      });

      const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => {
        setTimeout(() => resolve('TIMEOUT'), 400);
      });

      const outcome = await Promise.race([deadlockPromise, timeoutPromise]);
      if (outcome === 'TIMEOUT') {
        deadlockDetected = true;
      }

      assert.equal(
        deadlockDetected,
        true,
        'EMPIRICAL CONFIRMATION: withLock is non-reentrant; nested acquisition causes deadlock as predicted'
      );
    });

    test('1.4: Mutex recovery: rejected operation in withLock does not deadlock subsequent operations', async () => {
      const storeFile = path.join(TEST_WORK_DIR, 'store_mutex_fault.json');
      const store = new AtomicJsonStore<TestRecord>(storeFile, () => []);
      await store.initialize();

      // Launch an operation that intentionally throws
      const failingOp = store.withLock(async () => {
        throw new Error('Simulated operational failure inside lock');
      });

      await assert.rejects(failingOp, /Simulated operational failure/);

      // Subsequent operation must NOT deadlock
      let subsequentSuccess = false;
      const subsequentOp = await store.withLock(async () => {
        subsequentSuccess = true;
        return { ok: true };
      });

      assert.ok(subsequentSuccess, 'Lock must be freed after error');
      assert.equal(subsequentOp.ok, true);

      // Subsequent save must also work seamlessly
      const saved = await store.save({
        id: 'recovery-1',
        counter: 999,
        label: 'Post-fault record',
        updatedAt: new Date().toISOString()
      });
      assert.equal(saved.id, 'recovery-1');
      assert.equal(store.getById('recovery-1')?.counter, 999);
    });

    test('1.5: Concurrent mixed workload (save, delete, saveMany, filter) maintains consistency', async () => {
      const storeFile = path.join(TEST_WORK_DIR, 'store_mixed_workload.json');
      const store = new AtomicJsonStore<TestRecord>(storeFile, () => []);
      await store.initialize();

      // Seed 20 items
      await store.saveMany(
        Array.from({ length: 20 }, (_, i) => ({
          id: `init-${i}`,
          counter: i,
          label: `Seed ${i}`,
          updatedAt: new Date().toISOString()
        }))
      );

      // Rapid concurrent mix: 20 saves, 10 deletes, 20 queries
      const mixedOps: Promise<any>[] = [];

      for (let i = 0; i < 20; i++) {
        mixedOps.push(
          store.save({
            id: `new-${i}`,
            counter: i * 10,
            label: `New ${i}`,
            updatedAt: new Date().toISOString()
          })
        );
      }

      for (let i = 0; i < 10; i++) {
        mixedOps.push(store.delete(`init-${i}`));
      }

      for (let i = 0; i < 20; i++) {
        mixedOps.push(
          Promise.resolve().then(() => {
            return store.filter((r) => r.counter > 5);
          })
        );
      }

      await Promise.all(mixedOps);

      // Disk file must be completely valid and consistent
      const diskData: TestRecord[] = JSON.parse(await fs.readFile(storeFile, 'utf-8'));
      const inMemoryData = store.getAll();

      assert.equal(diskData.length, inMemoryData.length, 'Disk and memory record counts must match');

      // Deleted items 0-9 must not exist
      for (let i = 0; i < 10; i++) {
        assert.equal(store.getById(`init-${i}`), undefined, `init-${i} should be deleted`);
      }
      // Remaining items 10-19 must exist
      for (let i = 10; i < 20; i++) {
        assert.ok(store.getById(`init-${i}`), `init-${i} must exist`);
      }
      // New items 0-19 must exist
      for (let i = 0; i < 20; i++) {
        assert.ok(store.getById(`new-${i}`), `new-${i} must exist`);
      }
    });
  });

  // ==========================================================================
  // SECTION 2: Audit Service Hash Chaining, Immutability & Tamper Detection
  // ==========================================================================
  describe('2. Audit Service SHA-256 Hash Chain & Tamper Detection', () => {
    test('2.1: 50 concurrent audit record calls build an unbroken SHA-256 Merkle chain', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_concurrent');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      const TOTAL = 50;
      const tasks = Array.from({ length: TOTAL }, (_, i) => {
        return audit.record({
          actorId: `emp-${i % 5}`,
          actorEmail: `emp${i % 5}@nexusfinance.ng`,
          action: i % 2 === 0 ? 'LEAVE_SUBMITTED' : 'EXPENSE_FILED',
          entityType: i % 2 === 0 ? 'LeaveRequest' : 'ExpenseReport',
          entityId: `ent-${i}`,
          ipAddress: `192.168.1.${10 + (i % 20)}`,
          userAgent: 'NexusStressTester/1.0',
          stateDiff: { iteration: i, timestamp: Date.now() }
        });
      });

      const entries = await Promise.all(tasks);
      assert.equal(entries.length, TOTAL);

      // Verify integrity method passes
      const integrity = audit.verifyIntegrity();
      assert.equal(integrity.valid, true, 'Audit log integrity check must pass for concurrent writes');
      assert.equal(integrity.totalChecked, TOTAL, `Must have verified all ${TOTAL} records`);

      // Independently verify SHA-256 chain directly from disk
      const logFile = path.join(auditDir, 'audit_logs.jsonl');
      const lines = (await fs.readFile(logFile, 'utf-8')).trim().split('\n');
      assert.equal(lines.length, TOTAL, 'Disk JSONL file must have exactly 50 lines');

      let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
      for (let i = 0; i < lines.length; i++) {
        const item = JSON.parse(lines[i]);
        assert.equal(item.previousHash, prevHash, `Line ${i} previousHash must match preceding hash`);

        // Recalculate hash
        const payload = `${item.previousHash}|${item.id}|${item.timestamp}|${item.actorId || 'null'}|${item.action}|${item.entityType}|${item.entityId}|${JSON.stringify(item.stateDiff)}`;
        const expectedHash = crypto.createHash('sha256').update(payload, 'utf-8').digest('hex');
        assert.equal(item.hash, expectedHash, `Line ${i} SHA-256 hash must match independently computed hash`);

        prevHash = item.hash;
      }
    });

    test('2.2: Tamper Detection: modifying a record payload on disk causes verifyIntegrity() to detect corruption', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_tamper_payload');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      // Record 5 entries
      for (let i = 0; i < 5; i++) {
        await audit.record({
          actorId: `emp-${i}`,
          action: 'PROFILE_UPDATED',
          entityType: 'UserProfile',
          entityId: `prof-${i}`,
          stateDiff: { salary: 100000 + i * 10000 }
        });
      }

      // Initial integrity is valid
      assert.equal(audit.verifyIntegrity().valid, true);

      // SIMULATE ATTACK: Adversary alters salary in record index 2 directly in audit_logs.jsonl
      const logFile = path.join(auditDir, 'audit_logs.jsonl');
      const rawContent = await fs.readFile(logFile, 'utf-8');
      const lines = rawContent.trim().split('\n');

      const targetEntry = JSON.parse(lines[2]);
      const compromisedId = targetEntry.id;
      // Tamper: elevate salary
      targetEntry.stateDiff = { salary: 99999999 };
      lines[2] = JSON.stringify(targetEntry);

      await fs.writeFile(logFile, lines.join('\n') + '\n', 'utf-8');

      // Re-initialize a new AuditService instance loading from the tampered disk file
      const auditPostTamper = new AuditService(auditDir);
      await auditPostTamper.initialize();

      const check = auditPostTamper.verifyIntegrity();
      assert.equal(check.valid, false, 'Tampered file must fail integrity check');
      assert.equal(check.compromisedId, compromisedId, 'Compromised ID must point to altered record');
    });

    test('2.3: Tamper Detection: line deletion from audit_logs.jsonl breaks previousHash chain', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_tamper_deletion');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      for (let i = 0; i < 6; i++) {
        await audit.record({
          actorId: `emp-${i}`,
          action: `ACTION_${i}`,
          entityType: 'Record',
          entityId: `rec-${i}`,
          stateDiff: { step: i }
        });
      }

      // SIMULATE ATTACK: Cover tracks by deleting line 2 (the 3rd entry)
      const logFile = path.join(auditDir, 'audit_logs.jsonl');
      const rawContent = await fs.readFile(logFile, 'utf-8');
      const lines = rawContent.trim().split('\n');

      const deletedEntry = JSON.parse(lines[2]);
      const successorEntry = JSON.parse(lines[3]); // Will fail because previousHash points to deletedEntry
      lines.splice(2, 1);

      await fs.writeFile(logFile, lines.join('\n') + '\n', 'utf-8');

      const auditPostTamper = new AuditService(auditDir);
      await auditPostTamper.initialize();

      const check = auditPostTamper.verifyIntegrity();
      assert.equal(check.valid, false, 'Deletion must break integrity chain');
      assert.equal(check.compromisedId, successorEntry.id, 'Successor entry must be flagged as corrupted link');
    });

    test('2.4: Tamper Detection: line insertion triggers hash discrepancy', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_tamper_insertion');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      for (let i = 0; i < 4; i++) {
        await audit.record({
          actorId: `emp-${i}`,
          action: `LOG_${i}`,
          entityType: 'Item',
          entityId: `id-${i}`,
          stateDiff: { index: i }
        });
      }

      // SIMULATE ATTACK: Insert a forged log entry between line 1 and 2
      const logFile = path.join(auditDir, 'audit_logs.jsonl');
      const lines = (await fs.readFile(logFile, 'utf-8')).trim().split('\n');

      const forgedEntry = {
        id: 'aud-forged-entry',
        actorId: 'attacker',
        actorEmail: 'attacker@evil.com',
        action: 'PRIVILEGE_ESCALATION',
        entityType: 'UserRole',
        entityId: 'admin',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.68.0',
        timestamp: new Date().toISOString(),
        stateDiff: { role: 'ADMIN' },
        metadataDiff: { role: 'ADMIN' },
        previousHash: JSON.parse(lines[1]).hash,
        hash: 'forged_fake_hash_123456789'
      };

      lines.splice(2, 0, JSON.stringify(forgedEntry));
      await fs.writeFile(logFile, lines.join('\n') + '\n', 'utf-8');

      const auditPostTamper = new AuditService(auditDir);
      await auditPostTamper.initialize();

      const check = auditPostTamper.verifyIntegrity();
      assert.equal(check.valid, false, 'Inserted entry must invalidate audit trail');
      assert.equal(check.compromisedId, 'aud-forged-entry');
    });

    test('2.5: Tamper Detection: forged hash on altered entry still caught by downstream previousHash', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_tamper_rehash');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      for (let i = 0; i < 4; i++) {
        await audit.record({
          actorId: `emp-${i}`,
          action: `MUTATION_${i}`,
          entityType: 'Entity',
          entityId: `e-${i}`,
          stateDiff: { val: i }
        });
      }

      // SIMULATE ATTACK: Attacker modifies line 1 AND correctly recalculates line 1's hash
      const logFile = path.join(auditDir, 'audit_logs.jsonl');
      const lines = (await fs.readFile(logFile, 'utf-8')).trim().split('\n');

      const entry1 = JSON.parse(lines[1]);
      entry1.action = 'UNAUTHORIZED_MUTATION';
      const payload1 = `${entry1.previousHash}|${entry1.id}|${entry1.timestamp}|${entry1.actorId}|${entry1.action}|${entry1.entityType}|${entry1.entityId}|${JSON.stringify(entry1.stateDiff)}`;
      entry1.hash = crypto.createHash('sha256').update(payload1, 'utf-8').digest('hex');
      lines[1] = JSON.stringify(entry1);

      // Note: Line 2 still contains the OLD hash of entry1 as its previousHash
      const entry2 = JSON.parse(lines[2]);

      await fs.writeFile(logFile, lines.join('\n') + '\n', 'utf-8');

      const auditPostTamper = new AuditService(auditDir);
      await auditPostTamper.initialize();

      const check = auditPostTamper.verifyIntegrity();
      assert.equal(check.valid, false, 'Chain must be detected as invalid');
      assert.equal(check.compromisedId, entry2.id, 'Downstream entry 2 must fail on previousHash mismatch');
    });

    test('2.6: Strict append-only disk guarantee: older file prefix remains byte-for-byte identical', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_append_only');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      for (let i = 0; i < 5; i++) {
        await audit.record({
          actorId: 'admin',
          action: `STEP_${i}`,
          entityType: 'System',
          entityId: `sys-${i}`,
          stateDiff: { phase: i }
        });
      }

      const logFile = path.join(auditDir, 'audit_logs.jsonl');
      const initialBytes = await fs.readFile(logFile);

      // Append 5 more records
      for (let i = 5; i < 10; i++) {
        await audit.record({
          actorId: 'admin',
          action: `STEP_${i}`,
          entityType: 'System',
          entityId: `sys-${i}`,
          stateDiff: { phase: i }
        });
      }

      const subsequentBytes = await fs.readFile(logFile);
      assert.ok(subsequentBytes.length > initialBytes.length, 'File size must grow strictly');

      // The prefix of subsequentBytes must exactly equal initialBytes
      const prefix = subsequentBytes.subarray(0, initialBytes.length);
      assert.deepEqual(prefix, initialBytes, 'Existing log entries must never be modified or rewritten in place');
    });
  });

  // ==========================================================================
  // SECTION 3: Audit Query Filtering & Admin Endpoint Access Controls
  // ==========================================================================
  describe('3. Audit Query Filtering & Endpoint Verification', () => {
    test('3.1: AuditService.query() strictly filters by action, entityType, actorId, and date bounds', async () => {
      const auditDir = path.join(TEST_WORK_DIR, 'audit_query_filtering');
      const audit = new AuditService(auditDir);
      await audit.initialize();

      await audit.record({
        actorId: 'emp-1',
        action: 'AUTH_LOGIN',
        entityType: 'UserSession',
        entityId: 'sess-1',
        stateDiff: { ip: '1.1.1.1' }
      });
      await audit.record({
        actorId: 'emp-1',
        action: 'LEAVE_SUBMITTED',
        entityType: 'LeaveRequest',
        entityId: 'leave-1',
        stateDiff: { days: 3 }
      });
      await audit.record({
        actorId: 'mgr-1',
        action: 'LEAVE_APPROVED',
        entityType: 'LeaveRequest',
        entityId: 'leave-1',
        stateDiff: { approver: 'mgr-1' }
      });
      await audit.record({
        actorId: 'emp-2',
        action: 'EXPENSE_FILED',
        entityType: 'ExpenseReport',
        entityId: 'exp-1',
        stateDiff: { amount: 15000 }
      });

      // Filter by action
      const actionRes = audit.query({ action: 'LEAVE_APPROVED' });
      assert.equal(actionRes.total, 1);
      assert.equal(actionRes.data[0].action, 'LEAVE_APPROVED');

      // Filter by entityType
      const entityRes = audit.query({ entityType: 'LeaveRequest' });
      assert.equal(entityRes.total, 2);
      for (const log of entityRes.data) {
        assert.equal(log.entityType, 'LeaveRequest');
      }

      // Filter by actorId
      const actorRes = audit.query({ actorId: 'emp-1' });
      assert.equal(actorRes.total, 2);

      // Filter by non-existent action
      const emptyRes = audit.query({ action: 'NON_EXISTENT_ACTION' });
      assert.equal(emptyRes.total, 0);
      assert.equal(emptyRes.data.length, 0);

      // Combined filter
      const combinedRes = audit.query({ action: 'LEAVE_SUBMITTED', entityType: 'LeaveRequest' });
      assert.equal(combinedRes.total, 1);
      assert.equal(combinedRes.data[0].entityId, 'leave-1');
    });

    test('3.2: getAuditLogsHandler controller strictly handles query params for action and entityType', async () => {
      const storeDir = path.join(TEST_WORK_DIR, 'controller_data');
      await initializeDataStore(storeDir);
      const audit = getDataStore().audit;

      await audit.record({
        actorId: 'u-1',
        action: 'SYSTEM_CONFIG_UPDATED',
        entityType: 'SystemSettings',
        entityId: 'settings',
        stateDiff: { setting: 'value' }
      });
      await audit.record({
        actorId: 'u-2',
        action: 'LEAVE_SUBMITTED',
        entityType: 'LeaveRequest',
        entityId: 'req-10',
        stateDiff: { days: 2 }
      });

      // Invoke getAuditLogsHandler with query filter
      let responseStatus = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (payload: any) => {
          responseBody = payload;
          return mockRes;
        }
      };

      // 1. Filter by action
      await getAuditLogsHandler(
        { query: { action: 'SYSTEM_CONFIG_UPDATED' } } as any,
        mockRes
      );
      assert.equal(responseStatus, 200);
      assert.ok(responseBody.success);
      assert.ok(responseBody.data.length >= 1);
      for (const entry of responseBody.data) {
        assert.equal(entry.action, 'SYSTEM_CONFIG_UPDATED');
      }

      // 2. Filter by entityType
      await getAuditLogsHandler(
        { query: { entityType: 'LeaveRequest' } } as any,
        mockRes
      );
      assert.equal(responseStatus, 200);
      for (const entry of responseBody.data) {
        assert.equal(entry.entityType, 'LeaveRequest');
      }

      // 3. Filter with non-existent query
      await getAuditLogsHandler(
        { query: { action: 'NON_EXISTENT' } } as any,
        mockRes
      );
      assert.equal(responseStatus, 200);
      assert.equal(responseBody.data.length, 0);
    });

    test('3.3: In-process test harness verifies audit log RBAC and query filtering', async () => {
      // 1. Admin client can query audit logs
      const adminClient = await createAuthenticatedClient('admin');
      const res = await adminClient.get('/api/v1/admin/audit-logs');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));

      // 2. Filter by action
      const filterRes = await adminClient.get('/api/v1/admin/audit-logs?action=AUTH_LOGIN');
      assert.equal(filterRes.status, 200);
      for (const log of filterRes.body.data) {
        assert.equal(log.action, 'AUTH_LOGIN');
      }

      // 3. Employee role is blocked (403 Forbidden)
      const empClient = await createAuthenticatedClient('employee');
      const empRes = await empClient.get('/api/v1/admin/audit-logs');
      assert.equal(empRes.status, 403);

      // 4. Manager role is blocked (403 Forbidden)
      const mgrClient = await createAuthenticatedClient('manager');
      const mgrRes = await mgrClient.get('/api/v1/admin/audit-logs');
      assert.equal(mgrRes.status, 403);
    });
  });
});
