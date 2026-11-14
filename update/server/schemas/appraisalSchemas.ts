import { z, ZodType, type Issue } from './zod.ts';
import { ZodArray } from './expenseSchemas.ts';

// ---------------------------------------------------------------------------
// 1. Appraisal Cycle Creation Schema
// ---------------------------------------------------------------------------
export const appraisalCycleTypeEnum = z.enum([
  'ANNUAL',
  'MID_YEAR',
  'PROBATION',
  'QUARTERLY'
]);

export const createCycleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  cycleType: appraisalCycleTypeEnum.optional(),
  fiscalYear: z.number().min(2020).max(2100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  selfAppraisalDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Self-appraisal deadline must be in YYYY-MM-DD format').optional(),
  managerReviewDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Manager review deadline must be in YYYY-MM-DD format').optional(),
  kraWeightagePercent: z.number().min(0).max(100).optional(),
  competencyWeightagePercent: z.number().min(0).max(100).optional()
}).strict();

// ---------------------------------------------------------------------------
// 2. Goal Self-Rating Input Schema
// ---------------------------------------------------------------------------
export const goalSelfRatingInputSchema = z.object({
  goalId: z.string().trim().min(1, 'Goal ID is required'),
  selfRating: z.number(), // 1.00-5.00 bound enforced in controller with 422 INVALID_RATING
  selfComments: z.string().trim().max(2000).optional()
}).strict();

export const submitSelfAppraisalSchema = z.object({
  goals: new ZodArray(goalSelfRatingInputSchema).min(1, 'Goal ratings are required'),
  employeeComments: z.string().trim().max(2000).optional()
}).strict();

export const selfAppraisalSchema = submitSelfAppraisalSchema;

// ---------------------------------------------------------------------------
// 3. Goal Manager-Rating Input Schema
// ---------------------------------------------------------------------------
export const goalManagerRatingInputSchema = z.object({
  goalId: z.string().trim().min(1, 'Goal ID is required'),
  managerRating: z.number(), // 1.00-5.00 bound enforced in controller with 422 INVALID_RATING
  managerComments: z.string().trim().max(2000).optional()
}).strict();

export const submitManagerReviewSchema = z.object({
  goals: new ZodArray(goalManagerRatingInputSchema).min(1, 'Manager ratings are required'),
  competencyScore: z.number().optional(),
  managerSummaryFeedback: z.string().trim().max(2000).optional()
}).strict();

export const managerReviewSchema = submitManagerReviewSchema;

// ---------------------------------------------------------------------------
// 4. Calibration Schema
// ---------------------------------------------------------------------------
export const calibrateScoreSchema = z.object({
  finalCalibratedScore: z.number(), // 1.00-5.00 bound enforced in controller with 422 INVALID_RATING
  calibrationNotes: z.string().trim().max(2000).optional()
}).strict();

// ---------------------------------------------------------------------------
// 5. Acknowledgment Schema
// ---------------------------------------------------------------------------
export const acknowledgeOutcomeSchema = z.object({
  feedback: z.string().trim().max(2000).optional()
}).strict().optional();

export const acknowledgeSchema = acknowledgeOutcomeSchema;

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------
export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type SubmitSelfAppraisalInput = z.infer<typeof submitSelfAppraisalSchema>;
export type SubmitManagerReviewInput = z.infer<typeof submitManagerReviewSchema>;
export type CalibrateScoreInput = z.infer<typeof calibrateScoreSchema>;
export type AcknowledgeOutcomeInput = z.infer<typeof acknowledgeOutcomeSchema>;
