import { Router } from 'express';
import {
  getAdminMetricsHandler,
  getAuditLogsHandler,
  verifyAuditLogsHandler,
  getSettingsHandler,
  updateSettingsHandler
} from '../controllers/adminController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { requireRole } from '../middleware/rbac.ts';
import { validateBody } from '../middleware/validate.ts';
import { updateSettingsSchema } from '../schemas/adminSchemas.ts';

export const adminRouter = Router();

adminRouter.get('/metrics', requireAuth, requireRole('ADMIN'), getAdminMetricsHandler);
adminRouter.get('/audit-logs', requireAuth, requireRole('ADMIN'), getAuditLogsHandler);
adminRouter.get('/audit-logs/verify', requireAuth, requireRole('ADMIN'), verifyAuditLogsHandler);
adminRouter.get('/settings', requireAuth, requireRole('ADMIN'), getSettingsHandler);
adminRouter.patch('/settings', requireAuth, requireRole('ADMIN'), validateBody(updateSettingsSchema), updateSettingsHandler);
