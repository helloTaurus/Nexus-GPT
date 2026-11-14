import { Router } from 'express';
import {
  getTodayAttendanceHandler,
  clockInHandler,
  clockOutHandler,
  getAttendanceHistoryHandler
} from '../controllers/attendanceController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { clockInSchema, clockOutSchema } from '../schemas/attendanceSchemas.ts';

export const attendanceRouter = Router();

attendanceRouter.get('/today', requireAuth, getTodayAttendanceHandler);
attendanceRouter.post('/clock-in', requireAuth, validateBody(clockInSchema), clockInHandler);
attendanceRouter.post('/clock-out', requireAuth, validateBody(clockOutSchema), clockOutHandler);
attendanceRouter.get('/history', requireAuth, getAttendanceHistoryHandler);
