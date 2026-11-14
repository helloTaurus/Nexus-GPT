import { Router } from 'express';
import {
  getLeaveBalancesHandler,
  calculateLeaveDaysHandler,
  getLeaveRequestsHandler,
  submitLeaveRequestHandler,
  reviewLeaveRequestHandler,
  cancelLeaveRequestHandler
} from '../controllers/leaveController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import {
  calculateLeaveSchema,
  submitLeaveRequestSchema,
  reviewLeaveRequestSchema,
  cancelLeaveRequestSchema
} from '../schemas/index.ts';

export const leavesRouter = Router();

leavesRouter.get('/balances', requireAuth, getLeaveBalancesHandler);
leavesRouter.get('/calculate', calculateLeaveDaysHandler);
leavesRouter.post('/calculate', validateBody(calculateLeaveSchema), calculateLeaveDaysHandler);
leavesRouter.get('/requests', requireAuth, getLeaveRequestsHandler);
leavesRouter.post('/requests', requireAuth, validateBody(submitLeaveRequestSchema), submitLeaveRequestHandler);
leavesRouter.patch('/requests/:id/action', requireAuth, validateBody(reviewLeaveRequestSchema), reviewLeaveRequestHandler);
leavesRouter.post('/requests/:id/action', requireAuth, validateBody(reviewLeaveRequestSchema), reviewLeaveRequestHandler);
leavesRouter.patch('/requests/:id/review', requireAuth, validateBody(reviewLeaveRequestSchema), reviewLeaveRequestHandler);
leavesRouter.post('/requests/:id/review', requireAuth, validateBody(reviewLeaveRequestSchema), reviewLeaveRequestHandler);
leavesRouter.post('/requests/:id/cancel', requireAuth, validateBody(cancelLeaveRequestSchema), cancelLeaveRequestHandler);
