import { z } from './zod.ts';

export const clockInSchema = z.object({
  notes: z.string().trim().max(500).optional(),
  timestamp: z.string().optional()
}).strict().optional();

export const clockOutSchema = z.object({
  notes: z.string().trim().max(500).optional(),
  timestamp: z.string().optional()
}).strict().optional();

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
