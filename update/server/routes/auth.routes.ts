import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  recoverRequestHandler,
  recoverVerifyHandler,
  changePasswordHandler
} from '../controllers/authController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { authLoginLimiter } from '../middleware/rateLimiter.ts';
import { validateBody } from '../middleware/validate.ts';
import {
  loginSchema,
  passwordRecoveryRequestSchema,
  passwordRecoveryVerifySchema,
  changePasswordSchema
} from '../schemas/authSchemas.ts';

export const authRouter = Router();

authRouter.post('/login', authLoginLimiter, validateBody(loginSchema), loginHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', requireAuth, meHandler);
authRouter.post('/recover/request', authLoginLimiter, validateBody(passwordRecoveryRequestSchema), recoverRequestHandler);
authRouter.post('/recover/verify', validateBody(passwordRecoveryVerifySchema), recoverVerifyHandler);
authRouter.post('/change-password', requireAuth, validateBody(changePasswordSchema), changePasswordHandler);
