import { Router } from 'express';
import {
  getCyclesHandler,
  createCycleHandler,
  getMySubmissionHandler,
  getTeamSubmissionsHandler,
  getSubmissionByIdHandler,
  submitSelfAppraisalHandler,
  submitManagerReviewHandler,
  calibrateScoreHandler,
  acknowledgeOutcomeHandler
} from '../controllers/appraisalController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { requireRole } from '../middleware/rbac.ts';
import { validateBody } from '../middleware/validate.ts';
import {
  createCycleSchema,
  submitSelfAppraisalSchema,
  submitManagerReviewSchema,
  calibrateScoreSchema,
  acknowledgeOutcomeSchema
} from '../schemas/appraisalSchemas.ts';

export const appraisalsRouter = Router();

appraisalsRouter.get('/cycles', requireAuth, getCyclesHandler);
appraisalsRouter.post('/cycles', requireAuth, requireRole('ADMIN'), validateBody(createCycleSchema), createCycleHandler);
appraisalsRouter.get('/submissions/me', requireAuth, getMySubmissionHandler);
appraisalsRouter.get('/submissions/team', requireAuth, requireRole('MANAGER', 'ADMIN'), getTeamSubmissionsHandler);
appraisalsRouter.get('/submissions/:id', requireAuth, getSubmissionByIdHandler);
appraisalsRouter.put('/submissions/:id/self', requireAuth, validateBody(submitSelfAppraisalSchema), submitSelfAppraisalHandler);
appraisalsRouter.put('/submissions/:id/manager', requireAuth, validateBody(submitManagerReviewSchema), submitManagerReviewHandler);
appraisalsRouter.post('/submissions/:id/calibrate', requireAuth, requireRole('ADMIN'), validateBody(calibrateScoreSchema), calibrateScoreHandler);
appraisalsRouter.post('/submissions/:id/acknowledge', requireAuth, validateBody(acknowledgeOutcomeSchema), acknowledgeOutcomeHandler);
