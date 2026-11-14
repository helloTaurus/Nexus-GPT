import { z, ZodType, type Issue } from './zod.ts';

export class ZodArray<T> extends ZodType<T[]> {
  private minLength?: number;
  private minMessage?: string;

  constructor(private elementSchema: ZodType<T>) {
    super();
  }

  public min(length: number, message?: string): this {
    this.minLength = length;
    this.minMessage = message;
    return this;
  }

  _parse(val: any, path: (string | number)[]): { success: boolean; data?: T[]; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue, issues: [] };
      if (this.isOptional) return { success: true, data: undefined, issues: [] };
      return { success: false, issues: [{ path, message: 'Required array is missing' }] };
    }
    if (!Array.isArray(val)) {
      return { success: false, issues: [{ path, message: `Expected array, received ${typeof val}` }] };
    }
    if (this.minLength !== undefined && val.length < this.minLength) {
      return {
        success: false,
        issues: [{ path, message: this.minMessage || `Array must contain at least ${this.minLength} element(s)` }]
      };
    }
    const issues: Issue[] = [];
    const output: T[] = [];
    for (let i = 0; i < val.length; i++) {
      const res = this.elementSchema._parse(val[i], [...path, i]);
      if (!res.success) {
        issues.push(...res.issues);
      } else if (res.data !== undefined) {
        output.push(res.data as T);
      }
    }
    if (issues.length > 0) {
      return { success: false, issues };
    }
    return { success: true, data: output, issues: [] };
  }
}

export const expenseCategoryEnum = z.enum([
  'cat-trav',
  'cat-hosp',
  'cat-office',
  'cat-telco',
  'cat-train',
  'cat-ops',
  'EXP-TRAV',
  'EXP-HOSP',
  'EXP-OFFICE',
  'EXP-TELCO',
  'EXP-TRAIN',
  'EXP-OPS'
]);

export const expenseItemInputSchema = z.object({
  categoryId: z.string().trim().min(1, 'Expense category is required'),
  amount: z.number(),
  merchantName: z.string().trim().min(1).optional(),
  merchant: z.string().trim().min(1).optional(),
  dateIncurred: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date incurred must be YYYY-MM-DD').optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expense date must be YYYY-MM-DD').optional(),
  description: z.string().trim().max(1000).optional(),
  receiptUrl: z.string().trim().optional(),
  receiptFileName: z.string().trim().optional(),
  invoiceNumber: z.string().trim().max(100).optional()
}).strict();

export const submitExpenseReportSchema = z.object({
  title: z.string().trim().min(1, 'Report title is required').max(200, 'Title cannot exceed 200 characters'),
  purpose: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(1000).optional(),
  currency: z.string().trim().min(3).max(3).default('NGN').optional(),
  items: new ZodArray(expenseItemInputSchema).min(1, 'At least one itemized expense is required')
}).strict();

export const updateExpenseReportSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  purpose: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(1000).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  items: new ZodArray(expenseItemInputSchema).min(1).optional()
}).strict();

export const reviewExpenseReportSchema = z.object({
  action: z.enum([
    'APPROVE',
    'REJECT',
    'REQUEST_REVISION',
    'REVISION_REQUESTED',
    'ManagerApproved',
    'Rejected'
  ]).optional(),
  decision: z.enum([
    'APPROVE',
    'REJECT',
    'REQUEST_REVISION',
    'REVISION_REQUESTED',
    'ManagerApproved',
    'Rejected'
  ]).optional(),
  status: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'Approved', 'Rejected']).optional(),
  comments: z.string().trim().max(1000).optional(),
  comment: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(1000).optional()
}).strict();

export const disburseExpenseReportSchema = z.object({
  disbursementReference: z.string().trim().min(1, 'Disbursement reference is required').max(100),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paid date must be YYYY-MM-DD').optional()
}).strict();

export const expenseQuerySchema = z.object({
  scope: z.enum(['mine', 'team', 'all']).optional(),
  status: z.string().optional(),
  limit: z.union([z.number(), z.string().transform(v => parseInt(v, 10))]).optional(),
  offset: z.union([z.number(), z.string().transform(v => parseInt(v, 10))]).optional()
}).strict();

export type ExpenseItemInput = z.infer<typeof expenseItemInputSchema>;
export type SubmitExpenseReportInput = z.infer<typeof submitExpenseReportSchema>;
export type UpdateExpenseReportInput = z.infer<typeof updateExpenseReportSchema>;
export type ReviewExpenseReportInput = z.infer<typeof reviewExpenseReportSchema>;
export type DisburseExpenseReportInput = z.infer<typeof disburseExpenseReportSchema>;
export type ExpenseQueryInput = z.infer<typeof expenseQuerySchema>;
