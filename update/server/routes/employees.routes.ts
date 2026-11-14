import { Router } from 'express';
import {
  getEmployeesHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  updateEmployeeHandler,
  resetEmployeePasswordHandler,
  getDirectReportsHandler,
  getHierarchyHandler
} from '../controllers/employeeController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { requireRole } from '../middleware/rbac.ts';
import { validateBody } from '../middleware/validate.ts';
import { createEmployeeSchema, updateEmployeeSchema, adminResetPasswordSchema } from '../schemas/employeeSchemas.ts';

export const employeesRouter = Router();

employeesRouter.get('/', requireAuth, getEmployeesHandler);
employeesRouter.get('/hierarchy', requireAuth, getHierarchyHandler);
employeesRouter.post('/', requireAuth, requireRole('ADMIN'), validateBody(createEmployeeSchema), createEmployeeHandler);
employeesRouter.get('/me', requireAuth, getEmployeeByIdHandler);
employeesRouter.get('/:id', requireAuth, getEmployeeByIdHandler);
employeesRouter.patch('/:id', requireAuth, requireRole('ADMIN'), validateBody(updateEmployeeSchema), updateEmployeeHandler);
employeesRouter.put('/:id', requireAuth, requireRole('ADMIN'), validateBody(updateEmployeeSchema), updateEmployeeHandler);
employeesRouter.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), validateBody(adminResetPasswordSchema), resetEmployeePasswordHandler);
employeesRouter.get('/:id/reports', requireAuth, requireRole('MANAGER', 'ADMIN'), getDirectReportsHandler);
