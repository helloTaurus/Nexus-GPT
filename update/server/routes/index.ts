import { Router } from 'express';
import { healthRouter } from './health.routes.ts';
import { authRouter } from './auth.routes.ts';
import { portalRouter } from './portal.routes.ts';
import { employeesRouter } from './employees.routes.ts';
import { adminRouter } from './admin.routes.ts';
import { leavesRouter } from './leaves.routes.ts';
import { expensesRouter } from './expenses.routes.ts';
import { appraisalsRouter } from './appraisals.routes.ts';
import { attendanceRouter } from './attendance.routes.ts';

export const apiV1Router = Router();

apiV1Router.use('/', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/portal', portalRouter);
apiV1Router.use('/employees', employeesRouter);
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/leaves', leavesRouter);
apiV1Router.use('/expenses', expensesRouter);
apiV1Router.use('/appraisals', appraisalsRouter);
apiV1Router.use('/attendance', attendanceRouter);
