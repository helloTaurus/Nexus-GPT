export type AppraisalStatus =
  | 'NOT_STARTED'
  | 'SELF_SUBMITTED'
  | 'CALIBRATION_PENDING'
  | 'COMPLETED';

export type AppraisalCycleStatus =
  | 'ACTIVE'
  | 'CALIBRATION'
  | 'COMPLETED'
  | 'CLOSED';

export type GoalCategory = 'KRA' | 'COMPETENCY';

export interface AppraisalGoal {
  goalId: string;
  title: string;
  description?: string;
  weightage: number; // e.g. 25 = 25% within category
  category?: GoalCategory;
  selfRating?: number; // 1.00 - 5.00
  selfComments?: string;
  managerRating?: number; // 1.00 - 5.00
  managerComments?: string;
}

export interface AppraisalSubmission {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
  designation?: string;
  managerId: string;
  managerName?: string;
  status: AppraisalStatus;
  selfScore?: number; // Calculated weighted score (1.00 - 5.00)
  managerScore?: number; // 70% KRA + 30% Competency (1.00 - 5.00)
  finalCalibratedScore?: number; // Committee calibrated score (1.00 - 5.00)
  employeeComments?: string;
  managerSummaryFeedback?: string;
  calibrationNotes?: string;
  acknowledgedAt?: string;
  goals: AppraisalGoal[];
}

export interface AppraisalCycle {
  id: string;
  title: string;
  cycleType: 'ANNUAL' | 'MID_YEAR' | 'PROBATION';
  fiscalYear: number;
  startDate: string;
  endDate: string;
  selfAppraisalDeadline: string;
  managerReviewDeadline: string;
  kraWeightagePercent?: number; // Default 70
  competencyWeightagePercent?: number; // Default 30
  status: AppraisalCycleStatus;
}

export interface SubmitSelfAppraisalPayload {
  goals: Array<{
    goalId: string;
    selfRating: number;
    selfComments?: string;
  }>;
  employeeComments?: string;
}

export interface SubmitManagerReviewPayload {
  goals: Array<{
    goalId: string;
    managerRating: number;
    managerComments?: string;
  }>;
  competencyScore?: number;
  managerSummaryFeedback?: string;
}

export interface CalibrateScorePayload {
  finalCalibratedScore: number;
  calibrationNotes?: string;
}

export interface CreateCyclePayload {
  title: string;
  cycleType: 'ANNUAL' | 'MID_YEAR' | 'PROBATION';
  fiscalYear: number;
  startDate: string;
  endDate: string;
  selfAppraisalDeadline: string;
  managerReviewDeadline: string;
  kraWeightagePercent?: number;
  competencyWeightagePercent?: number;
}

export interface RatingRubricTier {
  score: number;
  label: string;
  description: string;
  badgeVariant: 'rejected' | 'pending' | 'neutral' | 'brand' | 'approved';
}

export const RATING_RUBRIC_TIERS: RatingRubricTier[] = [
  {
    score: 1,
    label: 'Unsatisfactory',
    description: 'Consistently misses core SLAs and performance benchmarks.',
    badgeVariant: 'rejected',
  },
  {
    score: 2,
    label: 'Needs Improvement',
    description: 'Partially achieves commitments; requires targeted developmental coaching.',
    badgeVariant: 'pending',
  },
  {
    score: 3,
    label: 'Meets Expectations',
    description: 'Consistently delivers high-quality output aligned with institutional standards.',
    badgeVariant: 'neutral',
  },
  {
    score: 4,
    label: 'Exceeds Expectations',
    description: 'Surpasses targets, drives process efficiency, and demonstrates leadership.',
    badgeVariant: 'brand',
  },
  {
    score: 5,
    label: 'Outstanding',
    description: 'Exceptional institutional contributor; role model in innovation and underwriting.',
    badgeVariant: 'approved',
  },
];
