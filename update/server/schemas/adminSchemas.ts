import { z } from './zod.ts';

// ---------------------------------------------------------------------------
// 1. System Settings Update Schema
// ---------------------------------------------------------------------------
export const updateSettingsSchema = z.object({
  fiscalYear: z.number().min(2020).max(2050).optional(),
  maxCarryOverAnnualLeave: z.number().min(0).max(30).optional(),
  receiptEnforcementThresholdNGN: z.number().min(0).optional(),
  expenseManagerThresholdNGN: z.number().min(0).optional(),
  expenseExecutiveThresholdNGN: z.number().min(0).optional()
}).strict();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ---------------------------------------------------------------------------
// 2. Audit Log Query Schema
// ---------------------------------------------------------------------------
export const auditLogQuerySchema = z.object({
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  actorId: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Date must be ISO-8601 or YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Date must be ISO-8601 or YYYY-MM-DD').optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(200).default(50).optional()
}).strict();

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

// ---------------------------------------------------------------------------
// 3. Role Assignment Schema
// ---------------------------------------------------------------------------
export const roleAssignmentSchema = z.object({
  role: z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN'])
}).strict();

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;

// ---------------------------------------------------------------------------
// 4. Status Update Schema
// ---------------------------------------------------------------------------
export const statusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED'])
}).strict();

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
