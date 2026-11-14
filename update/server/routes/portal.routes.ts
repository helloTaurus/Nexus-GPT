import { Router } from 'express';
import { getProfileHandler, updateProfileHandler } from '../controllers/portalController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { updateProfileSchema } from '../schemas/profileSchemas.ts';

export const portalRouter = Router();

portalRouter.get('/profile', requireAuth, getProfileHandler);
portalRouter.patch('/profile', requireAuth, validateBody(updateProfileSchema), updateProfileHandler);
portalRouter.put('/profile', requireAuth, validateBody(updateProfileSchema), updateProfileHandler);
