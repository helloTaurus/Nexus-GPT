import { z } from './zod.ts';

// Nigerian 10-digit NUBAN account number regex
export const NUBAN_REGEX = /^\d{10}$/;

export const nubanSchema = z.string()
  .trim()
  .regex(NUBAN_REGEX, { message: 'Nigerian NUBAN account number must be exactly 10 digits' });

export const BVN_NIN_REGEX = /^\d{11}$/;

/**
 * Profile Update Schema
 * Only permits updating editable personal and reimbursement fields.
 * Restricted fields (salary, title, role, staffId, designation) must NOT be permitted for employee edits.
 */
export const updateProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  residentialAddress: z.string().trim().max(255).optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  emergencyContactRelationship: z.string().trim().max(50).optional(),
  bankName: z.string().trim().max(100).optional(),
  bankAccountNumber: nubanSchema.optional(),
  bankAccountName: z.string().trim().max(100).optional(),
  bvn: z.string().trim().regex(BVN_NIN_REGEX, { message: 'BVN must be exactly 11 digits' }).optional(),
  nin: z.string().trim().regex(BVN_NIN_REGEX, { message: 'NIN must be exactly 11 digits' }).optional()
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

