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
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(10).optional()
}).strict();

export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters' })
}).strict();

export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
