import { z } from './zod.ts';

export const leaveTypeIdSchema = z.enum([
  'lt-annual',
  'lt-sick',
  'lt-casual',
  'lt-maternity',
  'lt-paternity',
  'lt-bereavement'
]);

export const calculateLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  isHalfDay: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional()
}).strict();

export const submitLeaveRequestSchema = z.object({
  leaveTypeId: leaveTypeIdSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  reason: z.string().trim().min(1, 'Reason must not be empty').max(500),
  isHalfDay: z.boolean().optional(),
  attachmentUrl: z.string().optional()
}).strict();

export const reviewLeaveRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'Approved', 'Rejected']).optional(),
  decision: z.enum(['APPROVE', 'REJECT', 'Approved', 'Rejected']).optional(),
  status: z.enum(['APPROVED', 'REJECTED', 'Approved', 'Rejected']).optional(),
  decisionReason: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(500).optional(),
  comments: z.string().trim().max(500).optional()
}).strict();

export const cancelLeaveRequestSchema = z.object({
  reason: z.string().trim().max(500).optional()
}).strict();

export type CalculateLeaveInput = z.infer<typeof calculateLeaveSchema>;
export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;
export type CancelLeaveRequestInput = z.infer<typeof cancelLeaveRequestSchema>;
