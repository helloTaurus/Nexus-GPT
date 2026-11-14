# Feature F03: Staff Profile Self-Service & Nigerian KYC Blueprint
**Milestone 3: Staff Portal Core & Leave Management Suite**  
**Author:** `explorer_m3_1` (Staff Profile & KYC Specification Explorer)  
**Target Implementer:** `worker_m3`  
**Date:** 2026-11-10  
**Status:** Ready for Implementation  

---

## 1. Executive Summary & Objective

Feature **F03 (Staff Profile Self-Service & Nigerian Banking / KYC Registry)** provides employees with a secure, responsive self-service portal to review their official employment credentials and maintain their personal contact records, emergency contacts (next of kin), and Nigerian NUBAN banking reimbursement details.

### Core Objectives:
1. Reconcile frontend mockup (`update/src/pages/portal/StaffProfilePage.tsx`) with the live Express backend endpoints (`GET /api/v1/portal/profile`, `PUT /api/v1/portal/profile`, `PATCH /api/v1/portal/profile`).
2. Enforce strict boundary controls: immutable/restricted employment fields (`staffId`, `department`, `designation`, `salary`, `role`, `title`) are read-only and never submitted for mutation by employees (which trigger HTTP 403 `FORBIDDEN`).
3. Enforce Nigerian NUBAN compliance: account numbers must be validated client-side and server-side to exactly 10 numeric digits, with server returning HTTP 422 `INVALID_NUBAN` if violated.
4. Support Nigerian KYC fields (`bvn` [11 digits] and `nin` [11 digits]) alongside settlement bank and emergency contacts.
5. Provide perceived performance and micro-interactions adhering to Nexus design tokens: loading skeletons during initial data retrieval, instant inline input error highlighting, emerald `#007B58` success notifications, sapphire `#0D51B2` action triggers, and `--nx-ease` motion curves.

---

## 2. Existing Codebase Audit & Inspection Findings

### 2.1 Backend Endpoints & Routing (`update/server/routes/portal.routes.ts`)
- Mounted at: `/api/v1/portal` (via `update/server/routes/index.ts` line 15: `apiV1Router.use('/portal', portalRouter)`).
- Endpoints:
  - `GET /api/v1/portal/profile`: Protected with `requireAuth` middleware. Invokes `getProfileHandler`.
  - `PATCH /api/v1/portal/profile`: Protected with `requireAuth`, validated with `validateBody(updateProfileSchema)`. Invokes `updateProfileHandler`.
  - `PUT /api/v1/portal/profile`: Protected with `requireAuth`, validated with `validateBody(updateProfileSchema)`. Invokes `updateProfileHandler`.
- Both `PUT` and `PATCH` are supported identically by the backend.

### 2.2 Controller Logic (`update/server/controllers/portalController.ts`)
- **`getProfileHandler`**:
  - Reads `req.user.profile` and returns HTTP 200:
    ```json
    { "success": true, "data": { ...user.profile } }
    ```
- **`updateProfileHandler`**:
  - Restricted Field Interception: If user role is NOT `ADMIN`, checking for `salary`, `title`, `role`, `staffId`, or `designation` in payload returns HTTP 403 `FORBIDDEN`.
  - NUBAN Validation: If `req.body.bankAccountNumber` is present, regex `/^\d{10}$/` is checked. If invalid, returns HTTP 422 `INVALID_NUBAN`.
  - Persistence: Calls `userRepo.updateProfile(user.id, updates)`.
  - Audit Trail: Calls `auditService.record({ action: 'PROFILE_UPDATED', entityType: 'EmployeeProfile', ... })` logging prior and updated diffs with SHA-256 integrity chaining.
  - Success Response: Returns HTTP 200 with updated `EmployeeProfile`.

### 2.3 Zero-Trust Validation Middleware (`update/server/middleware/validate.ts`)
- `validateBody` provides layered zero-trust protection:
  1. Intercepts non-admin profile mutations containing restricted fields (`['salary', 'title', 'role', 'staffId', 'designation']`) -> immediate HTTP 403 `FORBIDDEN`.
  2. Intercepts non-10-digit NUBAN (`bankAccountNumber`) -> immediate HTTP 422 `INVALID_NUBAN`.
  3. Executes `schema.safeParse(req.body)`. Because `updateProfileSchema` is `.strict()`, any undeclared payload properties trigger HTTP 400 `VALIDATION_ERROR`.

### 2.4 Profile Schema (`update/server/schemas/profileSchemas.ts`)
Current schema definition:
```ts
export const updateProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  residentialAddress: z.string().trim().max(255).optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  emergencyContactRelationship: z.string().trim().max(50).optional(),
  bankName: z.string().trim().max(100).optional(),
  bankAccountNumber: nubanSchema.optional(), // regex /^\d{10}$/
  bankAccountName: z.string().trim().max(100).optional()
}).strict();
```

### 2.5 Test Suite Verification
Both existing test suites pass 100%:
1. `tests/e2e/tier1-features/profile.test.ts`:
   - `F03: Authenticated employee retrieves comprehensive profile docket` (verifies `GET /api/v1/portal/profile`).
   - `F03: Employee successfully updates personal phone and address` (verifies `PATCH /api/v1/portal/profile`).
   - `F03: Employee updates emergency next-of-kin contact details` (verifies `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelationship`).
   - `F03: Employee updates Nigerian 10-digit NUBAN banking reimbursement details` (verifies `bankName`, `bankAccountNumber`, `bankAccountName`).
   - `F03: Female employee (Chioma) views and updates profile details`.
2. `tests/e2e/tier2-boundaries/auth-rbac-boundaries.test.ts`:
   - Line 66: `Staff role cannot mutate restricted fields (salary, title, role) on profile` -> asserts HTTP 403 `FORBIDDEN`.
   - Line 37: `Unauthenticated request without session cookie to portal returns 401`.
   - Line 44: `Request with spoofed/tampered session cookie returns 401`.
3. `tests/e2e/tier1-features/audit-security.test.ts`:
   - Line 55: `Schema validator enforces NUBAN account number format (must be 10 digits)` -> asserts HTTP 422 `INVALID_NUBAN`.

### 2.6 Frontend Status (`update/src/pages/portal/StaffProfilePage.tsx`)
- Currently static mockup using local React `useState` with hardcoded values for `David Alabi`.
- Form submit handler only sets a local timer and does not make network calls.
- Missing live fetching on mount (`GET /api/v1/portal/profile`).
- Missing server update dispatch (`PUT /api/v1/portal/profile`).
- Missing loading skeleton display while loading data.
- Missing field naming alignment:
  - Frontend currently uses `nubanAccount` while backend expects `bankAccountNumber`.
  - Frontend currently uses `emergencyRelationship` while backend expects `emergencyContactRelationship`.
  - Frontend has inputs for `bvn` and `nin`, but backend schema does not yet include `bvn` or `nin`.

---

## 3. The Exact Data Contract

### 3.1 Field Classification Table

| Field Name | Category | Type / Constraints | Backend Support | Editable by Employee? | Rationale & Security Rules |
|------------|----------|-------------------|-----------------|-----------------------|----------------------------|
| `id` | Identifier | `string` (UUID) | In `EmployeeProfile` | ❌ No | Internal profile primary key |
| `staffId` | Official Credential | `string` (e.g. `NX-1042`) | In `EmployeeProfile` | ❌ No | Unique company ID; 403 if sent |
| `firstName` | Official Credential | `string` (max 50) | In `EmployeeProfile` | ❌ No | HR master record; non-editable self-service |
| `lastName` | Official Credential | `string` (max 50) | In `EmployeeProfile` | ❌ No | HR master record; non-editable self-service |
| `gender` | Official Credential | `'MALE' \| 'FEMALE' \| 'PREFER_NOT_TO_SAY'` | In `EmployeeProfile` | ❌ No | Display only |
| `email` | Identity / Auth | `string` (email) | In `UserAccount` | ❌ No | Single sign-on corporate email; read-only |
| `department` | Employment Hierarchy | `string` (e.g. `Credit & Risk`) | In `EmployeeProfile` | ❌ No | Restricted; 403 if modified by employee |
| `departmentId` | Employment Hierarchy | `string` (e.g. `dept-cru`) | In `EmployeeProfile` | ❌ No | Administrative association |
| `designation` | Job Role | `string` (e.g. `Risk Analyst`) | In `EmployeeProfile` | ❌ No | Restricted; 403 if modified by employee |
| `designationId`| Job Role | `string` (e.g. `des-ra`) | In `EmployeeProfile` | ❌ No | Administrative association |
| `managerId` | Hierarchy | `string \| null` | In `EmployeeProfile` | ❌ No | Administrative hierarchy; display only |
| `employmentType` | Employment | `'FULL_TIME' \| 'CONTRACT' \| 'PROBATION' \| 'INTERN'` | In `EmployeeProfile` | ❌ No | HR contract type; display only |
| `hireDate` | Employment | `string` (ISO / YYYY-MM-DD) | In `EmployeeProfile` | ❌ No | Official hire date |
| `salary` | Compensation | `number` | Restricted | ❌ No | STRICTLY RESTRICTED. Non-admin edit -> 403 FORBIDDEN |
| `title` / `role` | Authority | `string` | Restricted | ❌ No | STRICTLY RESTRICTED. Non-admin edit -> 403 FORBIDDEN |
| **`phone`** | Contact | `string` (max 30) | Updatable | ✅ **Yes** | Personal mobile phone |
| **`residentialAddress`** | Contact | `string` (max 255) | Updatable | ✅ **Yes** | Nigerian physical residential address |
| **`bankName`** | Settlement Banking | `string` (max 100) | Updatable | ✅ **Yes** | Financial institution name |
| **`bankAccountNumber`** | Settlement Banking | `string` (exact 10 digits `/^\d{10}$/`) | Updatable | ✅ **Yes** | Nigerian NUBAN account (422 if invalid) |
| **`bankAccountName`** | Settlement Banking | `string` (max 100) | Updatable | ✅ **Yes** | Account name matching bank record |
| **`emergencyContactName`**| Emergency Contact | `string` (max 100) | Updatable | ✅ **Yes** | Next-of-kin full name |
| **`emergencyContactPhone`**| Emergency Contact | `string` (max 30) | Updatable | ✅ **Yes** | Next-of-kin emergency phone |
| **`emergencyContactRelationship`**| Emergency Contact | `string` (max 50) | Updatable | ✅ **Yes** | Kin relationship (Spouse, Sister, etc.) |
| **`bvn`** | Nigerian KYC | `string` (exact 11 digits `/^\d{11}$/`) | *Schema Extension* | ✅ **Yes** | Bank Verification Number |
| **`nin`** | Nigerian KYC | `string` (exact 11 digits `/^\d{11}$/`) | *Schema Extension* | ✅ **Yes** | National Identity Number |

---

## 4. End-to-End API Interaction Lifecycle

### 4.1 Profile Retrieval on Mount (`GET /api/v1/portal/profile`)
1. **Request Details**:
   - URL: `/api/v1/portal/profile`
   - Method: `GET`
   - Headers: `Accept: application/json`
   - Credentials: `credentials: 'include'` (transmits HttpOnly `nexus_session` cookie).
2. **Success Response (HTTP 200)**:
   ```json
   {
     "success": true,
     "data": {
       "id": "emp-employee-01",
       "staffId": "NX-1042",
       "firstName": "Oluwaseun",
       "lastName": "Bakare",
       "gender": "MALE",
       "phone": "+2348149998877",
       "residentialAddress": "Wuse Zone 4, Abuja, FCT",
       "departmentId": "dept-cru",
       "department": "Credit & Risk",
       "designationId": "des-ra",
       "designation": "Risk Analyst",
       "managerId": "emp-manager-01",
       "employmentType": "FULL_TIME",
       "hireDate": "2024-02-01",
       "emergencyContactName": "Kemi Bakare",
       "emergencyContactPhone": "+2348123456789",
       "emergencyContactRelationship": "Sister",
       "bankName": "United Bank for Africa",
       "bankAccountNumber": "2087654321",
       "bankAccountName": "Oluwaseun Bakare",
       "avatarUrl": "..."
     }
   }
   ```
3. **Session Expiry / Unauthenticated (HTTP 401)**:
   - If response status is 401 (`UNAUTHORIZED`), the frontend should redirect to `/auth/login` via `onNavigate('/auth/login')`.

### 4.2 Profile Update Submission (`PUT /api/v1/portal/profile`)
1. **Request Details**:
   - URL: `/api/v1/portal/profile`
   - Method: `PUT` (or `PATCH`)
   - Headers: `Content-Type: application/json`, `Accept: application/json`
   - Credentials: `credentials: 'include'`
   - Payload:
     ```json
     {
       "phone": "+2348123456789",
       "residentialAddress": "Plot 12, Gwarinpa Estate, Abuja",
       "emergencyContactName": "Dr. Tunde Bakare",
       "emergencyContactPhone": "+2348039876543",
       "emergencyContactRelationship": "Father",
       "bankName": "Access Bank PLC",
       "bankAccountNumber": "0123987456",
       "bankAccountName": "Oluwaseun T. Bakare",
       "bvn": "22240981923",
       "nin": "78192837482"
     }
     ```
   - **Crucial Rule**: The frontend must explicitly filter the payload to omit read-only fields (`staffId`, `firstName`, `lastName`, `email`, `department`, `designation`, `workLocation`, `salary`, `role`, `title`). Sending restricted fields will trigger HTTP 403 `FORBIDDEN`.
2. **Error Responses & Client Handling**:
   - **HTTP 422 `INVALID_NUBAN`**:
     ```json
     {
       "success": false,
       "error": {
         "code": "INVALID_NUBAN",
         "message": "Nigerian NUBAN account number must be exactly 10 digits",
         "correlationId": "corr_..."
       }
     }
     ```
     -> Action: Set `fieldErrors.bankAccountNumber = 'Nigerian NUBAN account number must be exactly 10 digits'`.
   - **HTTP 403 `FORBIDDEN`**:
     ```json
     {
       "success": false,
       "error": {
         "code": "FORBIDDEN",
         "message": "Cannot modify restricted compensation or role fields",
         "correlationId": "corr_..."
       }
     }
     ```
     -> Action: Set global error banner: "Permission Denied: Official employee records cannot be modified."
   - **HTTP 400 `VALIDATION_ERROR`**:
     -> Action: Map field-level validation messages or display global alert.

---

## 5. Technical Specification & Implementation Blueprint for `StaffProfilePage.tsx`

### 5.1 Component Architecture & State Machine

```
                                    +---------------------+
                                    |    Page Mounting    |
                                    +----------+----------+
                                               |
                                     (fetch GET /profile)
                                               |
                         +---------------------+---------------------+
                         |                                           |
                 [HTTP 200 OK]                                [HTTP 401 / Error]
                         |                                           |
           +-------------v-------------+                 +-----------v-----------+
           | State: Idle / Loaded       |                 | Redirect /auth/login  |
           | Skeletons Removed         |                 | or Global Error Alert |
           +-------------+-------------+                 +-----------------------+
                         |
                 (User Edits Form)
                         |
           +-------------v-------------+
           | Client-Side Validation    |
           | NUBAN regex: /^\d{10}$/   |
           +-------------+-------------+
                         |
                 (User Submits Form)
                         |
           +-------------v-------------+
           | State: isSubmitting = true|
           | (PUT /api/v1/portal/profile)
           +-------------+-------------+
                         |
            +------------+------------+
            |                         |
      [HTTP 200 OK]             [HTTP 422 / 403 / 400]
            |                         |
+-----------v-----------+       +-----v-----------------+
| isSaved = true        |       | isSubmitting = false  |
| Emerald Alert (3s)    |       | Field / Global Errors |
| isSubmitting = false  |       +-----------------------+
+-----------------------+
```

### 5.2 Form Fields Mapping & Structure

#### Section 1: Official Employment Credentials (Read-Only)
- Container: `<Card variant="surface" padding="md">`
- Header: Icon `<IdentificationCard className="w-5 h-5 text-brand" />` + Heading `Official Employment Credentials`
- Grid: 3 columns (`sm:grid-cols-3 gap-4`)
- Items (each styled in `p-3.5 rounded-[7px] bg-subtle border border-rule`):
  1. **Staff Identity**: `profile.staffId` (styled with `font-mono-nums font-bold text-ink`)
  2. **Designation**: `profile.designation` (`font-semibold text-ink`)
  3. **Department**: `profile.department` (`font-semibold text-ink`)
  4. **Employment Type**: `profile.employmentType` (e.g. `FULL_TIME`)
  5. **Hire Date**: `profile.hireDate` (`font-mono-nums`)
  6. **Line Manager**: Display manager or "HR Assigned"

#### Section 2: Personal & Contact Details (Partially Editable)
- Container: `<Card variant="surface" padding="md">`
- Header: Icon `<User className="w-5 h-5 text-brand" />` + Heading `Personal & Contact Details`
- Grid: 2 columns (`sm:grid-cols-2 gap-4`)
- Inputs:
  1. `First Name`: Disabled `<Input value={profile.firstName} disabled />`
  2. `Last Name`: Disabled `<Input value={profile.lastName} disabled />`
  3. `Email Address`: Disabled `<Input value={profile.email} leftIcon={<EnvelopeSimple />} disabled />`
  4. **`Phone Number`**: Editable `<Input value={formData.phone} onChange={...} leftIcon={<Phone />} error={fieldErrors.phone} required />`
  5. **`Residential Address`**: Editable (spanning 2 columns) `<Input value={formData.residentialAddress} onChange={...} placeholder="Plot, Street, District, City, State" required />`

#### Section 3: Nigerian NUBAN Settlement Bank (Editable with Strict Validation)
- Container: `<Card variant="surface" padding="md">`
- Header: Icon `<Bank className="w-5 h-5 text-brand" />` + Heading `Nigerian NUBAN Settlement Bank`
- Grid: 3 columns (`sm:grid-cols-3 gap-4`)
- Inputs:
  1. **`Financial Institution`**: Editable `<Input label="Bank Name" value={formData.bankName} onChange={...} placeholder="e.g. Access Bank PLC, GTBank" required />`
  2. **`10-Digit NUBAN Account`**: Editable `<Input label="10-Digit NUBAN Account" value={formData.bankAccountNumber} maxLength={10} onChange={handleNubanChange} error={fieldErrors.bankAccountNumber} className="font-mono-nums" required />`
     - Micro-interaction: Filter non-digit characters on input change.
     - Live validation: Validate `length === 10`.
  3. **`Account Name`**: Editable `<Input label="Account Name" value={formData.bankAccountName} onChange={...} placeholder="Account holder name" required />`
  4. **`Bank Verification Number (BVN)`**: Editable `<Input label="Bank Verification Number (BVN)" value={formData.bvn} maxLength={11} className="font-mono-nums" placeholder="11-digit BVN" />`
  5. **`National Identity Number (NIN)`**: Editable `<Input label="National Identity Number (NIN)" value={formData.nin} maxLength={11} className="font-mono-nums" placeholder="11-digit NIN" />`

#### Section 4: Emergency Contact & Next of Kin (Editable)
- Container: `<Card variant="surface" padding="md">`
- Header: Icon `<ShieldCheck className="w-5 h-5 text-brand" />` + Heading `Emergency Contact & Next of Kin`
- Grid: 3 columns (`sm:grid-cols-3 gap-4`)
- Inputs:
  1. **`Contact Full Name`**: `<Input label="Contact Full Name" value={formData.emergencyContactName} onChange={...} required />`
  2. **`Emergency Phone`**: `<Input label="Emergency Phone" value={formData.emergencyContactPhone} onChange={...} required />`
  3. **`Relationship`**: `<Input label="Relationship" value={formData.emergencyContactRelationship} onChange={...} placeholder="e.g. Spouse, Father, Sister" required />`

### 5.3 Loading Skeletons Specification
When `isLoadingProfile` is `true`:
- Replace input cards with `<Skeleton>` layouts matching the exact layout dimensions:
  - Header: `<Skeleton height={32} width="280px" />` and `<Skeleton height={16} width="400px" />`.
  - 4 Cards: Each card with `<Skeleton height={24} width="200px" className="mb-4" />` and grid of `<Skeleton height={44} />` inputs.
- Prevents Content Layout Shift (CLS) and provides immediate visual feedback.

### 5.4 Notifications & Feedback Design Tokens
1. **Success Notification**:
   - Trigger: Successful HTTP 200 response from `PUT /api/v1/portal/profile`.
   - Appearance: Card / Banner styled with:
     ```tsx
     <motion.div
       initial={{ opacity: 0, y: -8 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, y: -8 }}
       className="p-4 rounded-[7px] bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2.5 shadow-sm"
     >
       <CheckCircle className="w-5 h-5 shrink-0 text-success" weight="fill" />
       <span>Staff profile and Nigerian banking KYC details successfully updated and logged in the immutable audit registry.</span>
     </motion.div>
     ```
   - Automatically dismisses after 4 seconds, or when user begins editing again.
2. **Error Notification**:
   - Trigger: HTTP 422, 403, 400, or network error.
   - Appearance:
     ```tsx
     <div className="p-4 rounded-[7px] bg-danger-soft border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2.5">
       <WarningCircle className="w-5 h-5 shrink-0 text-danger" weight="fill" />
       <span>{errorMessage}</span>
     </div>
     ```
3. **Submit Button**:
   - Styled with Nexus Sapphire: `variant="primary"` (`bg-action hover:bg-action-hover text-on-action rounded-[7px]`).
   - Loading State: `isLoading={isSubmitting}` displays spinner and disables clicks.

---

## 6. Recommended Backend & Tooling Adjustments for `worker_m3`

### 6.1 Extend Schema to Persist `bvn` and `nin`
To support the Nigerian KYC requirements seamlessly without breaking tests:
1. In `update/server/schemas/profileSchemas.ts`:
   ```ts
   export const bvnNinRegex = /^\d{11}$/;

   export const updateProfileSchema = z.object({
     phone: z.string().trim().max(30).optional(),
     residentialAddress: z.string().trim().max(255).optional(),
     emergencyContactName: z.string().trim().max(100).optional(),
     emergencyContactPhone: z.string().trim().max(30).optional(),
     emergencyContactRelationship: z.string().trim().max(50).optional(),
     bankName: z.string().trim().max(100).optional(),
     bankAccountNumber: nubanSchema.optional(),
     bankAccountName: z.string().trim().max(100).optional(),
     bvn: z.string().trim().regex(bvnNinRegex, { message: 'BVN must be exactly 11 digits' }).optional(),
     nin: z.string().trim().regex(bvnNinRegex, { message: 'NIN must be exactly 11 digits' }).optional()
   }).strict();
   ```
2. In `update/server/repositories/types.ts`:
   Add `bvn?: string; nin?: string;` to `EmployeeProfile`.
3. In `update/server/controllers/portalController.ts`:
   In `updateProfileHandler`:
   ```ts
   const updatedProfile = await userRepo.updateProfile(user.id, {
     ...
     bvn: req.body.bvn ?? (user.profile as any).bvn,
     nin: req.body.nin ?? (user.profile as any).nin
   });
   ```
This ensures zero schema rejection when KYC BVN/NIN values are submitted.

### 6.2 Development Vite Proxy Configuration
In `update/vite.config.ts`, ensure proxy configuration is present for seamless local frontend API calls:
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true
    }
  }
}
```

---

## 7. Step-by-Step Execution Plan for `worker_m3`

1. **Step 1: Backend KYC Extension**:
   - Update `profileSchemas.ts`, `types.ts`, and `portalController.ts` to include optional `bvn` and `nin` (11 digits).
   - Re-run `node --test tests/e2e/tier1-features/profile.test.ts` and `node --test tests/e2e/tier1-features/audit-security.test.ts` to ensure 100% backward compatibility.
2. **Step 2: Update `StaffProfilePage.tsx`**:
   - Implement lifecycle `useEffect` calling `GET /api/v1/portal/profile` with `credentials: 'include'`.
   - Implement loading skeleton state while `isLoadingProfile` is active.
   - Populate read-only official employment credentials card with retrieved data (`staffId`, `department`, `designation`, `employmentType`, `hireDate`, `manager`).
   - Populate editable form fields (`phone`, `residentialAddress`, `bankName`, `bankAccountNumber`, `bankAccountName`, `bvn`, `nin`, `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelationship`).
   - Implement input sanitization and client-side NUBAN validation (`/^\d{10}$/`).
   - Implement form submit calling `PUT /api/v1/portal/profile` with `credentials: 'include'`.
   - Strip any restricted fields before dispatching payload.
   - Display emerald success alert on 200 OK; display inline and global errors on 422/403/400.
   - Forward authenticated `userName` and `staffId` to `<PortalLayout>`.
3. **Step 3: Verification**:
   - Run `node --test tests/e2e/tier1-features/profile.test.ts`.
   - Run `node --test tests/e2e/tier2-boundaries/auth-rbac-boundaries.test.ts`.
   - Build client via `npm --prefix update run build` to confirm zero TypeScript compilation errors.
