# Milestone 5: Workforce Directory, Org Hierarchy & System Audit Architecture Plan

**Author**: `explorer_m5_2_r2` (Milestone 5 Exploration Track)  
**Date**: 2026-11-10  
**Target Milestone**: Milestone 5 — Performance Appraisals & Administrative Management  
**Key Features**:
- **F11**: Staff Directory View (Search, Department Filter, Pagination, Profile Retrieval)
- **F19**: Administrative Employee Management (Full CRUD, NX-ID Auto-generation, Leave Balance Seeding, Reporting Hierarchy)
- **F20**: Role & Permission Administration (Role Assignment, Promotion/Demotion, Super-Admin Protection, Deactivation Lifecycle)
- **F21**: Immutable Security Audit Trail & Merkle Tree Integrity Verification

---

## 1. Executive Summary & Current State Analysis

### 1.1 Architectural Context
Under Clean Architecture guidelines (`PROJECT.md`), the Nexus Finance Workforce & Administration suite operates as a dual-surface portal:
1. **Public Staff Directory (`/api/v1/employees`)**: Searchable, paginated directory accessible to all authenticated users for colleague discovery and collaboration.
2. **Administrative Management (`/api/v1/employees/*`, `/api/v1/admin/*`)**: High-privilege domain restricted to `ADMIN` (and `MANAGER` for subordinate trees), enforcing OWASP Top 10 Broken Access Control prevention, NIST SP 800-218 zero-trust validation, SEI CERT memory safety, and Microsoft SDL principle of least privilege.

### 1.2 Comparison: In-Process Reference Server vs. Express Implementation
An audit of `tests/fixtures/referenceServer.ts` versus `update/server/` reveals the following status:

| Feature / Behavior | `referenceServer.ts` | `update/server/` (Current) | Status / Action Needed |
|---|---|---|---|
| `GET /api/v1/employees` (search, dept, page, limit) | Implemented (lines 515-546) | Implemented (`employeeController.ts`) | **Gap**: `userRepository.ts` does not match `email` on search queries. |
| `POST /api/v1/employees` (onboarding, NX-ID, leave seed) | Implemented (lines 548-630) | Implemented (`employeeController.ts`) | **Needs validation**: Strict Zod schema enforcement; manager existence check. |
| `PATCH /api/v1/employees/:id` (role, dept, manager) | Implemented (lines 632-666) | Implemented (`employeeController.ts`) | **Deficiency**: Lacks self-reporting & cyclic hierarchy cycle detection. |
| `GET /api/v1/employees/:id/reports` (direct reports) | Implemented (lines 668-679) | Implemented (`employeeController.ts`) | RBAC guard in `employees.routes.ts` requires `MANAGER` or `ADMIN`. Verified. |
| Org Chart Tree Endpoint (`/hierarchy` or `/tree`) | Not explicitly exposed | Not implemented in Express | **Required**: Add recursive hierarchy tree endpoint for visual org chart. |
| Super-Admin Demotion/Deactivation Protection | Partial | Missing | **Security flaw**: Last active Admin can be demoted/deactivated. Needs protection. |
| `GET /api/v1/admin/audit-logs` (filters) | Implemented (lines 1401-1415) | Implemented (`adminController.ts`) | **Deficiency**: Controller bypasses `auditService.query()` pagination metadata. |
| Merkle Tree Integrity Verification | Not in reference server | `AuditService` has linear SHA-256 chain | **Missing**: Dedicated `MerkleTree` class and `/admin/audit-logs/verify` endpoint. |
| Zod Schemas (`adminSchemas.ts`) | N/A | Missing | **Missing**: Must implement `adminSchemas.ts` with `.strict()`. |

---

## 2. Workforce Directory CRUD Specification

### 2.1 Endpoint Catalog
```
GET    /api/v1/employees             - Public/Staff Directory query (Search, Department, Pagination)
GET    /api/v1/employees/me          - Authenticated user's profile shortcut
GET    /api/v1/employees/:id         - Specific employee profile by ID
POST   /api/v1/employees             - Admin onboarding of new staff member
PATCH  /api/v1/employees/:id         - Admin update of employee record (title, role, dept, manager, status)
PUT    /api/v1/employees/:id         - Complete admin record replacement
GET    /api/v1/employees/:id/reports - Query direct subordinates of a manager
GET    /api/v1/employees/hierarchy   - Query full corporate organizational hierarchy tree
```

### 2.2 Directory Search, Filter & Pagination Details (`GET /api/v1/employees`)
- **Access**: Any authenticated role (`EMPLOYEE`, `MANAGER`, `ADMIN`).
- **Query Parameters**:
  - `search` (`string`, optional): Case-insensitive substring match against `firstName`, `lastName`, `staffId`, and `email`.
  - `departmentId` (`string`, optional): Exact match filter against employee's department ID (`dept-eng`, `dept-cru`, etc.).
  - `role` (`string`, optional): Role filter (`EMPLOYEE`, `MANAGER`, `ADMIN`).
  - `status` (`string`, optional): Defaults to all or `ACTIVE`.
  - `page` (`integer`, optional, default `1`): 1-indexed pagination page.
  - `limit` (`integer`, optional, default `10`): Items per page (clamped between 1 and 100).
- **Directory Privacy**:
  - The public directory summary returns `EmployeeProfile` records.
  - As verified in test `workforce-directory.test.ts` line 64, directory summary masks private email or excludes confidential compensation/banking data (`salary`, `bvn`, `nin`, `bankAccountNumber`).
- **Response Format**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "emp-employee-01",
        "staffId": "NX-1042",
        "firstName": "Oluwaseun",
        "lastName": "Bakare",
        "departmentId": "dept-cru",
        "department": "Credit & Risk",
        "designationId": "des-ra",
        "designation": "Risk Analyst",
        "managerId": "emp-manager-01",
        "employmentType": "FULL_TIME",
        "phone": "+2348149998877",
        "avatarUrl": "..."
      }
    ],
    "pagination": {
      "total": 6,
      "page": 1,
      "limit": 2,
      "totalPages": 3
    }
  }
  ```

### 2.3 Single Profile Retrieval (`GET /api/v1/employees/:id`)
- Supports resolving either `empId` (e.g. `emp-employee-01`), `userId` (e.g. `usr-employee-01`), or alias `me`.
- If employee does not exist: Returns HTTP 404 with standard envelope:
  ```json
  {
    "success": false,
    "error": {
      "code": "NOT_FOUND",
      "message": "Employee record not found",
      "correlationId": "corr_..."
    }
  }
  ```

### 2.4 Administrative Onboarding (`POST /api/v1/employees`)
1. **Access Control**: Strict `ADMIN` role required. Non-admin calls are rejected with HTTP 403 `FORBIDDEN`.
2. **Validation Rules**:
   - `firstName`, `lastName`, `email`, `departmentId`, `designationId` are strictly required. Missing fields return HTTP 400 `VALIDATION_ERROR`.
   - `email`: Canonical format validated (`canonicalEmailSchema`). If an existing user has the same email, reject with HTTP 409 `DUPLICATE_EMAIL`.
   - `bankAccountNumber`: If provided, must strictly match 10-digit NUBAN (`/^\d{10}$/`). Invalid format returns HTTP 422 `INVALID_NUBAN`.
   - `managerId`: If provided, manager must exist in active state (see Section 3.2).
3. **Identifier Generation**:
   - `id`: Unique UUID-based profile ID (e.g. `emp-xxxxxx`).
   - `staffId`: Generates unique prefix format `NX-XXXX` (where XXXX is a unique 4-digit code).
4. **Credential Setup**:
   - Creates accompanying `UserAccount` with hashed password (defaulting to `TemporaryPass123!` or custom).
   - Status defaults to `ACTIVE`.
5. **Initial Leave Quota Initialization**:
   - Accepts `initialAnnualLeaveDays` (default `20.0`).
   - Seeds leave balances for all standard leave types (`lt-annual`, `lt-sick`, `lt-casual`, `lt-maternity`, `lt-paternity`, `lt-bereavement`) for the current fiscal year (2026).
6. **Audit Emission**:
   - Records `EMPLOYEE_ONBOARDED` in the immutable audit log with metadata diff.
7. **HTTP Status**: Returns HTTP 201 Created.

---

## 3. Reporting Hierarchy & Org Chart Logic

### 3.1 Hierarchy Invariants
In a sound enterprise HRMS, the reporting hierarchy must form a Directed Acyclic Graph (DAG) and, specifically, a set of rooted trees (where each employee has at most one direct manager).

The hierarchy enforces three critical invariants:
1. **Invariant H1: No Self-Reporting**. An employee cannot be their own manager:
   $$\forall e \in \text{Employees}, \quad e.\text{managerId} \neq e.\text{id} \land e.\text{managerId} \neq e.\text{profile.id}$$
2. **Invariant H2: Valid Manager Existence**. If a manager is assigned, that manager record must exist and must be in an `ACTIVE` state:
   $$e.\text{managerId} \neq \text{null} \implies \exists m \in \text{Employees} : m.\text{id} = e.\text{managerId} \land m.\text{status} = \text{'ACTIVE'}$$
3. **Invariant H3: No Cyclic Reporting Loops**. A manager assignment must never create a directed cycle (e.g. $A \to B \to A$ or $A \to B \to C \to A$):
   $$\forall k \ge 1, \quad \text{Manager}^k(e) \neq e$$

### 3.2 Cycle Detection Algorithm
When updating an employee's manager ($E$ reassigned to $M$), perform cycle detection before persisting:

```typescript
export function validateHierarchyAssignment(
  userRepo: UserRepository,
  employeeId: string,
  newManagerId: string | null
): void {
  if (!newManagerId) {
    return; // Removing manager or setting to top-level root is always cycle-free
  }

  const targetUser = userRepo.findById(employeeId);
  if (!targetUser) {
    throw new Error('NOT_FOUND: Target employee does not exist');
  }

  // 1. Self-reporting check
  if (
    newManagerId === targetUser.id ||
    newManagerId === targetUser.profile.id ||
    newManagerId === targetUser.profile.staffId
  ) {
    const err = new Error('An employee cannot report to themselves');
    (err as any).code = 'SELF_REPORTING_PROHIBITED';
    (err as any).statusCode = 400;
    throw err;
  }

  // 2. Manager existence & status check
  const managerUser = userRepo.findById(newManagerId);
  if (!managerUser) {
    const err = new Error(`Assigned manager with ID '${newManagerId}' does not exist`);
    (err as any).code = 'INVALID_MANAGER';
    (err as any).statusCode = 400;
    throw err;
  }

  if (managerUser.status !== 'ACTIVE') {
    const err = new Error('Cannot assign an inactive or terminated employee as manager');
    (err as any).code = 'MANAGER_INACTIVE';
    (err as any).statusCode = 400;
    throw err;
  }

  // 3. Cyclic loop detection: Traverse upstream from proposed manager
  const visited = new Set<string>();
  visited.add(targetUser.id);
  visited.add(targetUser.profile.id);

  let current: UserAccount | null = managerUser;
  while (current && current.profile.managerId) {
    const nextManagerId = current.profile.managerId;

    if (visited.has(nextManagerId)) {
      const err = new Error(
        `Cyclic reporting loop detected: assigning '${targetUser.profile.firstName} ${targetUser.profile.lastName}' to '${managerUser.profile.firstName} ${managerUser.profile.lastName}' creates a circular dependency.`
      );
      (err as any).code = 'CYCLIC_REPORTING_DETECTED';
      (err as any).statusCode = 400;
      throw err;
    }

    visited.add(current.id);
    visited.add(current.profile.id);
    current = userRepo.findById(nextManagerId);
  }
}
```

### 3.3 Direct Reports Query (`GET /api/v1/employees/:id/reports`)
- **Access Guard**: `requireRole('MANAGER', 'ADMIN')`.
- Returns an array of `EmployeeProfile` where `profile.managerId === req.params.id`.
- Used by managers to evaluate leaves, manage expenses, and track team appraisal progress.

### 3.4 Organizational Chart Tree (`GET /api/v1/employees/hierarchy`)
- Generates a nested hierarchy representation:
  ```typescript
  export interface OrgChartNode {
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    email?: string;
    department: string;
    designation: string;
    role: string;
    avatarUrl?: string;
    directReportsCount: number;
    subordinates: OrgChartNode[];
  }
  ```
- **Assembly Logic**:
  1. Fetch all users from `UserRepository`.
  2. Index all profiles by `id` and `profile.id`.
  3. Group child IDs by `managerId`.
  4. Identify root nodes (`managerId === null` or manager ID not in active user set).
  5. Recursively build `OrgChartNode` trees.

---

## 4. Role Administration & Security Boundaries

### 4.1 Role Hierarchy & Permissions
The system enforces a 3-tier Role-Based Access Control model:

```
[EMPLOYEE]  --> Self-service profile, leave application, expense filing, self appraisal
     │
     ▼ (Promote)
[MANAGER]   --> Above + Direct reports review (/reports), leave approvals, expense approvals, manager appraisal
     │
     ▼ (Promote)
[ADMIN]     --> Above + Workforce CRUD, role modification, fiscal settings, audit log inspection & Merkle verification
```

### 4.2 Promotion & Demotion Rules
- **Admin Restriction**: Only authenticated `ADMIN` users can mutate roles. Any attempt by `EMPLOYEE` or `MANAGER` returns HTTP 403 `FORBIDDEN`.
- **Promotion to Manager**:
  - Updating `role: 'MANAGER'` unlocks manager endpoints (e.g. `/api/v1/employees/:id/reports`).
  - As tested in `workforce-directory.test.ts` lines 80-92, upon promotion, the employee can query direct reports and review subordinates' requests.
- **Super-Admin Protection**:
  - The system must prevent demoting or deactivating the primary administrative account (`usr-admin-01` / `admin@nexusfinance.ng`), or reducing the active admin count below 1.
  - Attempting to demote or deactivate the last remaining admin will be rejected with HTTP 400:
    ```json
    {
      "success": false,
      "error": {
        "code": "CANNOT_DEMOTE_LAST_ADMIN",
        "message": "Cannot demote or deactivate the sole remaining system administrator"
      }
    }
    ```

### 4.3 Employee Account Deactivation Lifecycle
- Triggered by `PATCH /api/v1/employees/:id` with `{ status: 'INACTIVE' }` or `'TERMINATED'`.
- **Immediate Invalidation**:
  1. Active user sessions associated with the user ID are revoked.
  2. Future login attempts via `POST /api/v1/auth/login` fail with HTTP 403:
     ```json
     {
       "success": false,
       "error": {
         "code": "ACCOUNT_INACTIVE",
         "message": "Account is suspended or deactivated"
       }
     }
     ```
  3. Deactivated staff cannot be assigned as approvers for new leaves or expenses.
  4. Historical leave and expense records are preserved for immutable audit integrity.

---

## 5. System Audit Log Viewer & Merkle Tree Integrity

### 5.1 Tamper-Evident Audit Architecture
The Nexus Finance audit subsystem records every security-sensitive mutation (OWASP A09 & NIST SSDF compliance):
- `AUTH_LOGIN`, `AUTH_LOGOUT`
- `EMPLOYEE_ONBOARDED`, `EMPLOYEE_UPDATED`
- `LEAVE_SUBMITTED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`
- `EXPENSE_SUBMITTED`, `EXPENSE_APPROVED`, `EXPENSE_PAID`, `EXPENSE_REJECTED`
- `APPRAISAL_SUBMITTED`, `APPRAISAL_CALIBRATED`, `APPRAISAL_ACKNOWLEDGED`
- `SETTINGS_UPDATED`

Each log record includes:
- `id`: Unique identifier (`aud-UUID`).
- `actorId`: User ID or `'null'` for system daemon.
- `action`: Specific state action.
- `entityType`: Target entity (e.g. `EmployeeProfile`, `LeaveRequest`).
- `entityId`: Unique ID of target entity.
- `timestamp`: ISO-8601 UTC timestamp.
- `ipAddress`, `userAgent`: Network origin.
- `stateDiff`: Structured delta before/after mutation.
- `previousHash`: SHA-256 hash of preceding audit entry.
- `hash`: SHA-256 cryptographic hash of current block.

### 5.2 Merkle Tree Implementation (`update/server/audit/merkleTree.ts`)
While linear hash chaining guarantees sequential immutability, a Merkle Tree allows:
1. Compact cryptographic commitment (a single 32-byte Merkle root summarizing the entire log ledger).
2. Efficient verification of individual entries without parsing the entire log history ($O(\log N)$ inclusion proof).

#### Cryptographic Specification:
- **Leaf Hash**: For audit record $i$:
  $$\text{Leaf}_i = \text{SHA256}(\text{record}_i.\text{hash})$$
- **Node Combination**: For left child $L$ and right child $R$:
  $$\text{Parent}(L, R) = \text{SHA256}(L + R)$$
- **Odd Sibling Rule**: If a level has an odd number of nodes, duplicate the final node before hashing.

```typescript
import crypto from 'node:crypto';
import type { AuditLogEntry } from '../services/auditService.ts';

export interface MerkleProofStep {
  position: 'left' | 'right';
  hash: string;
}

export class MerkleTree {
  private leaves: string[] = [];
  private layers: string[][] = [];

  constructor(records: AuditLogEntry[]) {
    this.build(records);
  }

  private hashPair(left: string, right: string): string {
    return crypto.createHash('sha256').update(left + right, 'utf-8').digest('hex');
  }

  private build(records: AuditLogEntry[]): void {
    if (records.length === 0) {
      this.leaves = [];
      this.layers = [['0000000000000000000000000000000000000000000000000000000000000000']];
      return;
    }

    // Leaf nodes are the SHA256 of the audit entry hash
    this.leaves = records.map(r =>
      crypto.createHash('sha256').update(r.hash, 'utf-8').digest('hex')
    );

    this.layers = [this.leaves];

    let currentLayer = this.leaves;
    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left; // Duplicate odd leaf
        nextLayer.push(this.hashPair(left, right));
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  public getRoot(): string {
    if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
      return '0000000000000000000000000000000000000000000000000000000000000000';
    }
    return this.layers[this.layers.length - 1][0];
  }

  public getProof(leafIndex: number): MerkleProofStep[] {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Invalid leaf index: ${leafIndex}`);
    }

    const proof: MerkleProofStep[] = [];
    let idx = leafIndex;

    for (let layerIdx = 0; layerIdx < this.layers.length - 1; layerIdx++) {
      const layer = this.layers[layerIdx];
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1 < layer.length ? idx + 1 : idx;

      proof.push({
        position: isRight ? 'left' : 'right',
        hash: layer[siblingIdx]
      });

      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  public static verifyProof(leafHash: string, proof: MerkleProofStep[], root: string): boolean {
    let currentHash = leafHash;

    for (const step of proof) {
      if (step.position === 'left') {
        currentHash = crypto.createHash('sha256').update(step.hash + currentHash, 'utf-8').digest('hex');
      } else {
        currentHash = crypto.createHash('sha256').update(currentHash + step.hash, 'utf-8').digest('hex');
      }
    }

    return currentHash === root;
  }
}
```

### 5.3 Audit Log Controller Endpoints
1. `GET /api/v1/admin/audit-logs`:
   - Enforces query filtering (`action`, `entityType`, `actorId`, `entityId`, `startDate`, `endDate`).
   - Returns paginated JSON: `{ success: true, data: [...], pagination: { total, page, limit, totalPages } }`.
2. `GET /api/v1/admin/audit-logs/verify`:
   - Runs `auditService.verifyIntegrity()` (linear chain validation) AND generates the current `MerkleTree` root.
   - Response envelope:
     ```json
     {
       "success": true,
       "data": {
         "valid": true,
         "totalChecked": 128,
         "merkleRoot": "a7b3c9...",
         "lastHash": "f8e4d2...",
         "verifiedAt": "2026-11-10T07:45:00.000Z"
       }
     }
     ```

---

## 6. Zero-Trust Zod Validation Schemas Specification

All payload, query, and parameter schemas must enforce `.strict()` to prevent prototype pollution and parameter injection (OWASP A08 & NIST SSDF).

### 6.1 `employeeSchemas.ts`
```typescript
import { z } from './zod.ts';
import { canonicalEmailSchema } from './commonSchemas.ts';
import { nubanSchema } from './profileSchemas.ts';

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: canonicalEmailSchema,
  departmentId: z.string().trim().min(1, 'Department ID is required'),
  designationId: z.string().trim().min(1, 'Designation ID is required'),
  managerId: z.string().trim().nullable().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).default('EMPLOYEE').optional(),
  gender: z.enum(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).default('PREFER_NOT_TO_SAY').optional(),
  phone: z.string().trim().optional(),
  residentialAddress: z.string().trim().optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'PROBATION', 'INTERN']).default('FULL_TIME').optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD').optional(),
  initialAnnualLeaveDays: z.number().min(0).max(60).default(20.0).optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  emergencyContactRelationship: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: nubanSchema.optional(),
  bankAccountName: z.string().trim().optional(),
  password: z.string().optional()
}).strict();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  departmentId: z.string().trim().optional(),
  designationId: z.string().trim().optional(),
  managerId: z.string().trim().nullable().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED']).optional(),
  employmentType: z.enum(['FULL_TIME', 'CONTRACT', 'PROBATION', 'INTERN']).optional(),
  phone: z.string().trim().optional(),
  residentialAddress: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  emergencyContactRelationship: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: nubanSchema.optional(),
  bankAccountName: z.string().trim().optional()
}).strict();

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const employeeQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED']).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional()
}).strict();

export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
```

### 6.2 `adminSchemas.ts`
```typescript
import { z } from './zod.ts';

export const updateSettingsSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2050).optional(),
  maxCarryOverAnnualLeave: z.number().min(0).max(30).optional(),
  receiptEnforcementThresholdNGN: z.number().min(0).optional(),
  expenseManagerThresholdNGN: z.number().min(0).optional(),
  expenseExecutiveThresholdNGN: z.number().min(0).optional()
}).strict();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const auditLogQuerySchema = z.object({
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  actorId: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Date must be ISO-8601 or YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Date must be ISO-8601 or YYYY-MM-DD').optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional()
}).strict();

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

export const roleAssignmentSchema = z.object({
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN'])
}).strict();

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;

export const statusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED'])
}).strict();

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
```

---

## 7. Step-by-Step Implementation Roadmap for Workers

### Step 1: Create Zero-Trust Schemas
1. Create `update/server/schemas/adminSchemas.ts` containing `updateSettingsSchema`, `auditLogQuerySchema`, `roleAssignmentSchema`, `statusUpdateSchema`.
2. Update `update/server/schemas/employeeSchemas.ts` to include `employeeQuerySchema` and optional extended fields on `updateEmployeeSchema`.
3. Export them from `update/server/schemas/index.ts`.

### Step 2: Implement Hierarchy Cycle Prevention
1. In `update/server/repositories/userRepository.ts`:
   - Enhance `findAll()` to include `email.toLowerCase().includes(q)` in search filter.
   - Add helper `findManagerChain(employeeId: string): string[]`.
2. In `update/server/controllers/employeeController.ts`:
   - In `updateEmployeeHandler` and `createEmployeeHandler`:
     - Validate self-reporting: reject if `managerId === empId` (HTTP 400 `SELF_REPORTING_PROHIBITED`).
     - Validate manager exists and is active (HTTP 400 `INVALID_MANAGER`).
     - Detect cyclic reporting loops by traversing upstream (HTTP 400 `CYCLIC_REPORTING_DETECTED`).
     - Protect super-admin: reject demoting or deactivating `usr-admin-01` or last active admin (HTTP 400 `CANNOT_DEMOTE_LAST_ADMIN`).

### Step 3: Implement Merkle Tree & Audit Verification
1. Create `update/server/audit/merkleTree.ts` with `MerkleTree` class supporting leaf hashing, tree construction, root computation, proof extraction, and static proof verification.
2. In `update/server/controllers/adminController.ts`:
   - Update `getAuditLogsHandler` to utilize `auditService.query()` with pagination metadata `{ total, page, limit, totalPages }`.
   - Add `verifyAuditLogsHandler`: returns `{ valid, totalChecked, merkleRoot, lastHash, verifiedAt }`.
3. In `update/server/routes/admin.routes.ts`:
   - Bind `GET /api/v1/admin/audit-logs/verify` with `requireAuth` and `requireRole('ADMIN')`.

### Step 4: Add Org Chart Tree Endpoint
1. In `update/server/controllers/employeeController.ts`:
   - Add `getOrgChartHierarchyHandler`: recursively builds `OrgChartNode[]` tree from roots.
2. In `update/server/routes/employees.routes.ts`:
   - Bind `GET /hierarchy` (or `GET /org-chart`) with `requireAuth`.

### Step 5: Frontend UI Wiring
1. In `update/src/pages/admin/EmployeeDirectoryPage.tsx`:
   - Wire live fetching from `GET /api/v1/employees` with search and department filtering.
   - Wire `POST /api/v1/employees` on modal submit.
2. In `update/src/pages/admin/AuditLogsPage.tsx`:
   - Wire live fetching from `GET /api/v1/admin/audit-logs`.
   - Add "Verify Merkle Integrity" button calling `GET /api/v1/admin/audit-logs/verify` and displaying cryptographic verification status badge.

---

## 8. Verification Matrix & Commands

| Target Suite | Test File | Key Test Cases | Verification Command |
|---|---|---|---|
| Tier 1 Features | `tests/e2e/tier1-features/workforce-directory.test.ts` | Search, dept filter, pagination, onboarding, promotion, deactivation | `node --test tests/e2e/tier1-features/workforce-directory.test.ts` |
| Tier 1 Security | `tests/e2e/tier1-features/audit-security.test.ts` | State mutation audit logging, action filtering, zero-trust rejection | `node --test tests/e2e/tier1-features/audit-security.test.ts` |
| Tier 2 Boundaries | `tests/e2e/tier2-boundaries/admin-boundaries.test.ts` | Missing fields (400), duplicate email (409), invalid NUBAN (422), non-existent employee (404), RBAC guard (403) | `node --test tests/e2e/tier2-boundaries/admin-boundaries.test.ts` |
| Tier 3 Combinations | `tests/e2e/tier3-combinations/employee-lifecycle-combinations.test.ts` | Onboard -> Leave Seed -> Profile -> Promotion -> Subordinate review -> Deactivation | `node --test tests/e2e/tier3-combinations/employee-lifecycle-combinations.test.ts` |
| Tier 4 Scenarios | `tests/e2e/tier4-scenarios/workforce-restructuring-rollover.test.ts` | Manager reassignment, leave approval authority shift to new manager | `node --test tests/e2e/tier4-scenarios/workforce-restructuring-rollover.test.ts` |
| Tier 4 Scenarios | `tests/e2e/tier4-scenarios/complete-employee-lifecycle.test.ts` | End-to-end employee lifecycle across onboarding, leave, expense, appraisal, promotion | `node --test tests/e2e/tier4-scenarios/complete-employee-lifecycle.test.ts` |
