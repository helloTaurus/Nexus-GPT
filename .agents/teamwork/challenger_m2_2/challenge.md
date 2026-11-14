# Milestone 2 Challenge Report: Transactional Concurrency & Audit Tamper-Resistance

**Author:** `challenger_m2_2` (Transactional Concurrency & Audit Tamper-Resistance Challenger)  
**Date:** November 10, 2026  
**Target:** Milestone 2 (`update/server/repositories/store/AtomicJsonStore.ts`, `update/server/services/auditService.ts`, `update/server/controllers/adminController.ts`)  
**Verdict:** **APPROVE (Robust)**

---

## Challenge Summary

**Overall risk assessment**: **LOW**

The persistence store (`AtomicJsonStore`) and audit logging subsystem (`AuditService`) in `update/server/` successfully survived rigorous empirical stress-testing across 14 adversarial scenarios, as well as the baseline 122 E2E test suite. 

The transactional engine demonstrates genuine ACID properties for file-based JSON storage:
1. **Concurrency Safety**: 100 rapid concurrent record saves resolved with zero dropped writes, zero JSON corruption, and zero orphaned temporary files.
2. **Same-Record Collision Safety**: 50 concurrent mutations targeting the identical record were serialized strictly by the FIFO write mutex; disk and in-memory caches remained 100% synchronized.
3. **Audit Trail Cryptographic Integrity**: The SHA-256 Merkle hash chain accurately detected every simulated tamper vector (in-place payload tampering, record deletion, record insertion, and downstream re-hash attacks).
4. **Append-Only Disk Guarantee**: Byte-level inspection confirmed that subsequent log entries grow the file strictly at the tail, preserving preceding bytes without in-place modification.
5. **Query Filtering & RBAC**: Admin audit queries correctly filter by `action` and `entityType`, while access is blocked with 401/403 for unauthenticated and unprivileged actors.

---

## Challenges

### [Medium] Challenge 1: Non-Reentrant Mutex Deadlock Hazard in AtomicJsonStore

- **Assumption challenged**: That callers or repositories can arbitrarily use `withLock` for composite multi-step transactions around store operations.
- **Attack scenario**: If a service or repository method wraps a business transaction in `await store.withLock(async () => { ... await store.save(record); })`, the operation deadlocks permanently. `store.save()` internally invokes `this.withLock()`, which awaits the outer lock before proceeding. Because `withLock` does not track lock ownership or AsyncLocalStorage context, it waits on its own unresolved outer promise.
- **Blast radius**: Complete process stall / request timeout for any endpoint executing a nested `withLock`.
- **Empirical test**: Scenario 1.3 in `tests/adversarial/m2-concurrency-audit-stress.test.ts` confirmed timeout/deadlock on nested lock acquisition within 400ms.
- **Mitigation / Architecture Note**: In the current codebase, repositories only call `store.save()`, `store.saveMany()`, or `store.delete()` directly without external `withLock` wrapping. Developers must be instructed never to wrap `save()`, `delete()`, or `saveMany()` inside an external `withLock()`. If re-entrant transactions are required in future milestones, `AtomicJsonStore` should track an `AsyncLocalStorage` transaction context to bypass inner lock acquisition when already held by the current async execution chain.

### [Low] Challenge 2: TypeScript Parameter Properties Incompatibility with Node 24 Strip-Only Mode

- **Assumption challenged**: That native Node.js 24 runner (`node --test`) can directly import `update/server/` files without compiler pre-processing.
- **Attack scenario**: Executing `node --test` directly against test files importing `AtomicJsonStore.ts` throws `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode` because Node 24's default type-stripper does not support constructor parameter properties (`public readonly filePath: string`).
- **Blast radius**: Test runners directly importing server source files fail unless using `--experimental-transform-types` or `tsx`. Production runtime is unaffected since `update/package.json` executes via `tsx`.
- **Empirical test**: Running `node --test tests/adversarial/m2-concurrency-audit-stress.test.ts` produced `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Adding `--experimental-transform-types` or using `tsx` executes cleanly with 100% pass rate.
- **Mitigation**: Standardize test invocation to `node --experimental-transform-types --test` when directly importing TypeScript server modules, or migrate constructor parameter properties to explicit property declarations in future cleanups.

---

## Stress Test Results

Test suite: `tests/adversarial/m2-concurrency-audit-stress.test.ts`  
Command: `node --experimental-transform-types --test tests/adversarial/m2-concurrency-audit-stress.test.ts`  
Output: **14 tests passed, 0 failed, duration: 2.73s**

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **1.1: 100 Concurrent Saves** | All 100 records saved; 0 lost updates; valid JSON on disk; 0 temp files leaked | 100 records in memory & disk; JSON parse verified; 0 temp files | **PASS** |
| **1.2: 50 Overwrites to Same Record** | Mutex serializes updates; valid JSON; memory and disk match | 1 single record on disk; valid JSON; memory counter matches disk | **PASS** |
| **1.3: Nested withLock Reentrancy** | Calling save() inside withLock() deadlocks | Timeout triggered at 400ms proving non-reentrancy | **PASS** (Confirmed) |
| **1.4: Mutex Recovery on Error** | Thrown error releases lock; subsequent operations proceed | Error rejected; lock released; subsequent save succeeded | **PASS** |
| **1.5: Mixed Workload (Save/Delete/Query)** | Consistent state; disk matches memory; deleted records absent | Disk and memory lengths equal; deletions and additions verified | **PASS** |
| **2.1: 50 Concurrent Audit Records** | Unbroken SHA-256 Merkle chain; verifyIntegrity() returns true | All 50 verified; independent disk hash re-computation matched | **PASS** |
| **2.2: Tamper Detection (Payload)** | Modifying salary in jsonl causes verifyIntegrity() to fail | `valid: false`, `compromisedId` points to altered entry | **PASS** |
| **2.3: Tamper Detection (Line Deletion)** | Deleting line breaks previousHash chain | `valid: false`, `compromisedId` points to successor entry | **PASS** |
| **2.4: Tamper Detection (Line Insertion)** | Inserting forged line breaks hash integrity | `valid: false`, `compromisedId` points to inserted entry | **PASS** |
| **2.5: Tamper Detection (Rehash Attack)** | Rehashed entry caught by downstream previousHash mismatch | `valid: false`, `compromisedId` points to downstream entry | **PASS** |
| **2.6: Append-Only Guarantee** | Older file prefix remains byte-for-byte identical after writes | `prefix === initialBytes` confirmed with Buffer equality | **PASS** |
| **3.1: AuditService.query() Filter** | Exact matching on action, entityType, actorId | Filtered arrays matched exact criteria; non-existent returned 0 | **PASS** |
| **3.2: Controller Query Handling** | Express handler extracts and applies query filters | `getAuditLogsHandler` returned filtered arrays for action/entityType | **PASS** |
| **3.3: RBAC & In-Process Test Harness** | Non-admins blocked (403); Admin allowed (200) | Admin 200, Employee 403, Manager 403, action filter verified | **PASS** |

### Baseline Verification Test Commands

1. `node --test tests/e2e/tier1-features/audit-security.test.ts`
   - Output: **6 tests passed, 0 failed, duration: 384ms**
2. `node tests/testRunner.ts`
   - Output: **122 tests passed across 22 suites (Tiers 1-4), 0 failed, duration: 7.28s**

---

## Unchallenged Areas

- **Disk Full / OS Out of Space (ENOSPC)**: Extreme filesystem out-of-disk condition was not simulated due to running in a non-virtualized Windows host filesystem.
- **Hardware Power Loss Mid-Sync**: Physical hardware cutoff during `handle.sync()` was not physically simulated, though unique temp-file naming (`${file}.tmp.${uuid}`) and atomic rename pattern are industry standard for surviving mid-write process crashes.

---

## Final Verdict

**APPROVE** — The Milestone 2 backend persistence and audit logging implementation is robust, secure, and ready for Milestone 3 integration.
