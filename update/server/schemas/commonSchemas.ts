import { z } from './zod.ts';

// SEI CERT sanitization: Trim, normalize whitespace, strip dangerous HTML/script characters
export const sanitizedString = (min = 1, max = 500) =>
  z.string()
    .trim()
    .min(min, { message: `Field cannot be empty (minimum ${min} characters)` })
    .max(max, { message: `Maximum character limit exceeded (${max})` })
    .transform((val) => val.replace(/<[^>]*>/g, '').trim());

export const canonicalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'A valid email address is required' });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional()
}).strict();
