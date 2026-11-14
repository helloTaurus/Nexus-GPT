export type ExpenseCategoryId =
  | 'cat-trav'
  | 'cat-hosp'
  | 'cat-office'
  | 'cat-telco'
  | 'cat-train'
  | 'cat-ops';

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  maxSingleLimit: number;
  receiptRequired: boolean;
  receiptThreshold: number;
}

export interface ExpenseItemRecord {
  id: string;
  categoryId: string;
  categoryName?: string;
  dateIncurred: string;
  merchantName: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptFileName?: string;
  invoiceNumber?: string;
  isWeekend?: boolean;
  flags?: string[];
}

export interface ExpenseItemInput {
  categoryId: string;
  dateIncurred: string;
  merchantName: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  receiptFileName?: string;
  invoiceNumber?: string;
}

export type ExpenseReportStatus =
  | 'SUBMITTED'
  | 'PENDING_LINE_MANAGER'
  | 'PENDING_DEPT_HEAD'
  | 'PENDING_EXEC'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'REVISION_REQUESTED';

export interface ExpenseReportRecord {
  id: string;
  reportNumber: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  title: string;
  purpose: string;
  currency: string;
  totalAmount: number;
  status: ExpenseReportStatus;
  items: ExpenseItemRecord[];
  submittedAt: string;
  approvedAt?: string;
  paidAt?: string;
  disbursementReference?: string;
  currentApproverId?: string;
  rejectionReason?: string;
}

export interface CreateExpenseReportPayload {
  title: string;
  purpose?: string;
  currency?: string;
  items: ExpenseItemInput[];
}

export interface UpdateExpenseReportPayload {
  title?: string;
  purpose?: string;
  currency?: string;
  items?: ExpenseItemInput[];
}

export interface ReceiptUploadResponse {
  success: boolean;
  fileUrl: string;
  receiptUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
}

export interface DisburseExpensePayload {
  disbursementReference: string;
  paidDate?: string;
}

export interface ReviewExpensePayload {
  action: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
  comments?: string;
}
