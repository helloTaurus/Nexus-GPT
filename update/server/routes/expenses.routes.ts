import { Router } from 'express';
import {
  getCategoriesHandler,
  uploadReceiptHandler,
  getReceiptHandler,
  getExpenseReportsHandler,
  getExpenseReportByIdHandler,
  submitExpenseReportHandler,
  updateExpenseReportHandler,
  reviewExpenseReportHandler,
  disburseExpenseReportHandler
} from '../controllers/expenseController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import {
  submitExpenseReportSchema,
  updateExpenseReportSchema,
  reviewExpenseReportSchema,
  disburseExpenseReportSchema
} from '../schemas/expenseSchemas.ts';

export const expensesRouter = Router();

// 1. Categories
expensesRouter.get('/categories', getCategoriesHandler);

// 2. Receipt upload and preview/download
expensesRouter.post('/upload-receipt', requireAuth, uploadReceiptHandler);
expensesRouter.get('/receipts/:filename', requireAuth, getReceiptHandler);
expensesRouter.get('/uploads/receipts/:filename', requireAuth, getReceiptHandler);

// 3. Expense reports CRUD
expensesRouter.get('/reports', requireAuth, getExpenseReportsHandler);
expensesRouter.post('/reports', requireAuth, validateBody(submitExpenseReportSchema), submitExpenseReportHandler);
expensesRouter.get('/reports/:id', requireAuth, getExpenseReportByIdHandler);
expensesRouter.put('/reports/:id', requireAuth, validateBody(updateExpenseReportSchema), updateExpenseReportHandler);

// 4. Approval and review workflows (support PATCH and POST aliases)
expensesRouter.patch('/reports/:id/action', requireAuth, validateBody(reviewExpenseReportSchema), reviewExpenseReportHandler);
expensesRouter.post('/reports/:id/action', requireAuth, validateBody(reviewExpenseReportSchema), reviewExpenseReportHandler);
expensesRouter.patch('/reports/:id/review', requireAuth, validateBody(reviewExpenseReportSchema), reviewExpenseReportHandler);
expensesRouter.post('/reports/:id/review', requireAuth, validateBody(reviewExpenseReportSchema), reviewExpenseReportHandler);

// 5. Finance disbursement
expensesRouter.post('/reports/:id/disburse', requireAuth, validateBody(disburseExpenseReportSchema), disburseExpenseReportHandler);
