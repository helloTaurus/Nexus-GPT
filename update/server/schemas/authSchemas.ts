import { z } from './zod.ts';
import { canonicalEmailSchema } from './commonSchemas.ts';

/**
 * Login Input Schema
 * Strict rejection of empty or missing credentials
 */
export const loginSchema = z.object({
  email: canonicalEmailSchema,
  password: z.string().min(1, { message: 'Password is required' })
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password Recovery Request Schema
 */
export const passwordRecoveryRequestSchema = z.object({
  email: canonicalEmailSchema
}).strict();

export type PasswordRecoveryRequestInput = z.infer<typeof passwordRecoveryRequestSchema>;

/**
 * Password Recovery Verification Schema
 * Requires exact OTP and enforces minimum 8 characters password policy
 */
export const passwordRecoveryVerifySchema = z.object({
  email: canonicalEmailSchema,
  token: z.string().trim().min(1, { message: 'OTP token is required' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters' })
}).strict();

export type PasswordRecoveryVerifyInput = z.infer<typeof passwordRecoveryVerifySchema>;

/**
 * Authenticated Self-Service Password Change Schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters' })
}).strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

