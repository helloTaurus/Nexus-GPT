import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getExpenseRepository, getAuditService } from '../repositories/dataStore.ts';
import type { ExpenseItemRecord, ExpenseReportRecord } from '../repositories/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '../uploads/receipts');

async function ensureUploadDir(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // Directory already exists or created concurrently
  }
}

export async function getCategoriesHandler(_req: Request, res: Response): Promise<void> {
  const expenseRepo = getExpenseRepository();
  res.status(200).json({ success: true, data: expenseRepo.getCategories() });
}

export async function uploadReceiptHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;

  let buffer: Buffer | null = null;
  if (Buffer.isBuffer(req.body)) {
    buffer = req.body;
  } else if (req.body && Buffer.isBuffer(req.body.buffer)) {
    buffer = req.body.buffer;
  } else if (typeof req.body === 'string') {
    buffer = Buffer.from(req.body, 'utf-8');
  }

  if (!buffer || buffer.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No file payload received', correlationId }
    });
    return;
  }

  if (buffer.length > 10 * 1024 * 1024) {
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'File size exceeds maximum 10MB limit', correlationId }
    });
    return;
  }

  let mimeType = 'application/octet-stream';
  let isAllowed = false;

  // PNG: 89 50 4E 47
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    mimeType = 'image/png';
    isAllowed = true;
  }
  // JPEG: FF D8 FF
  else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    mimeType = 'image/jpeg';
    isAllowed = true;
  }
  // PDF: %PDF (25 50 44 46)
  else if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    mimeType = 'application/pdf';
    isAllowed = true;
  }

  if (!isAllowed) {
    res.status(415).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Disallowed file format. Only PDF, JPEG, and PNG are permitted.',
        correlationId
      }
    });
    return;
  }

  const fileId = crypto.randomUUID();
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const diskFileName = `${fileId}.${ext}`;
  const fileUrl = `/uploads/receipts/${diskFileName}`;

  // Persist file buffer to disk
  await ensureUploadDir();
  const diskPath = path.join(UPLOAD_DIR, diskFileName);
  await fs.writeFile(diskPath, buffer);

  // Compute SHA-256 cryptographic hash
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Record audit log
  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'RECEIPT_UPLOADED',
    entityType: 'ReceiptDocument',
    entityId: fileId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      fileId,
      fileName: `receipt_${diskFileName}`,
      fileUrl,
      mimeType,
      sizeBytes: buffer.length,
      sha256
    }
  });

  res.status(201).json({
    success: true,
    fileUrl,
    receiptUrl: fileUrl,
    fileName: `receipt_${diskFileName}`,
    mimeType,
    sizeBytes: buffer.length,
    sha256
  });
}

export async function getReceiptHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const filename = path.basename(req.params.filename);

  // Prevent directory traversal attacks
  await ensureUploadDir();
  const resolvedPath = path.resolve(UPLOAD_DIR, filename);
  if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid file reference', correlationId }
    });
    return;
  }

  try {
    const fileBuffer = await fs.readFile(resolvedPath);
    let mimeType = 'application/octet-stream';
    if (filename.endsWith('.png')) mimeType = 'image/png';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (filename.endsWith('.pdf')) mimeType = 'application/pdf';

    const isDownload = req.query.download === 'true';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'private, max-age=3600, no-transform');
    res.setHeader(
      'Content-Disposition',
      isDownload ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
    );

    res.status(200).send(fileBuffer);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Receipt document not found', correlationId }
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve receipt document', correlationId }
    });
  }
}

export async function getExpenseReportsHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const scope = typeof req.query.scope === 'string' ? req.query.scope : 'mine';
  const expenseRepo = getExpenseRepository();

  if (scope === 'team') {
    if (user.role === 'EMPLOYEE') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Employees cannot view team expense approvals', correlationId }
      });
      return;
    }
    const reports = expenseRepo.findReports({ approverId: user.profile.id });
    res.status(200).json({ success: true, data: reports });
    return;
  }

  if (scope === 'all') {
    if (user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required to view all corporate expense reports', correlationId }
      });
      return;
    }
    const reports = expenseRepo.findReports({ all: true });
    res.status(200).json({ success: true, data: reports });
    return;
  }

  const reports = expenseRepo.findReports({ employeeId: user.profile.id });
  res.status(200).json({ success: true, data: reports });
}

export async function getExpenseReportByIdHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const repId = req.params.id;
  const expenseRepo = getExpenseRepository();
  const report = expenseRepo.findReportById(repId);

  if (!report) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Expense report not found', correlationId }
    });
    return;
  }

  res.status(200).json({ success: true, data: report });
}

export async function submitExpenseReportHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const body = req.body;

  if (!body.title || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Report title and itemized expenses are required', correlationId }
    });
    return;
  }

  const expenseRepo = getExpenseRepository();
  let totalAmount = 0;
  const validatedItems: ExpenseItemRecord[] = [];

  for (const item of body.items) {
    const amt = Number(item.amount);
    if (isNaN(amt) || amt <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Expense item amount must be a positive number', correlationId }
      });
      return;
    }

    const category = expenseRepo.findCategoryByIdOrCode(item.categoryId);
    if (!category) {
      res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: `Expense category ${item.categoryId} not found`, correlationId }
      });
      return;
    }

    if (amt > category.maxSingleLimit) {
      res.status(422).json({
        success: false,
        error: {
          code: 'CATEGORY_LIMIT_EXCEEDED',
          message: `Item amount ${amt} exceeds maximum single limit of ${category.maxSingleLimit} NGN for ${category.name}`,
          correlationId
        }
      });
      return;
    }

    if (amt > category.receiptThreshold && (!item.receiptUrl || item.receiptUrl.trim() === '')) {
      res.status(422).json({
        success: false,
        error: {
          code: 'RECEIPT_REQUIRED',
          message: `Receipt document is mandatory for expense claims exceeding NGN 5,000 (Item: ${item.description || item.merchantName || category.name})`,
          correlationId
        }
      });
      return;
    }

    const itemDate = item.dateIncurred || item.expenseDate || new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date(itemDate).getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    totalAmount += amt;
    validatedItems.push({
      id: `item-${crypto.randomUUID().slice(0, 8)}`,
      categoryId: category.id,
      dateIncurred: itemDate,
      merchantName: item.merchantName || item.merchant || 'Merchant',
      amount: amt,
      description: item.description || '',
      receiptUrl: item.receiptUrl,
      receiptFileName: item.receiptFileName,
      ...(isWeekend ? { isWeekend: true, flags: ['WEEKEND_EXPENSE'] } : {})
    });
  }

  const repId = `exp-${crypto.randomUUID().slice(0, 8)}`;
  const reportNumber = `EXP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const currentApproverId = user.profile.managerId || 'emp-manager-01';

  const report: ExpenseReportRecord = {
    id: repId,
    reportNumber,
    employeeId: user.profile.id,
    title: body.title,
    purpose: body.purpose || body.title,
    currency: body.currency || 'NGN',
    totalAmount,
    status: 'SUBMITTED',
    items: validatedItems,
    currentApproverId,
    submittedAt: new Date().toISOString()
  };

  await expenseRepo.createReport(report);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'EXPENSE_SUBMITTED',
    entityType: 'ExpenseReport',
    entityId: repId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      reportNumber,
      totalAmount,
      itemCount: validatedItems.length
    }
  });

  res.status(201).json({ success: true, data: report });
}

export async function updateExpenseReportHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const repId = req.params.id;
  const user = req.user!;
  const body = req.body;

  const expenseRepo = getExpenseRepository();
  const report = expenseRepo.findReportById(repId);

  if (!report) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Expense report not found', correlationId }
    });
    return;
  }

  if (report.employeeId !== user.profile.id) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Cannot edit reports of other employees', correlationId }
    });
    return;
  }

  if (report.status !== 'REVISION_REQUESTED' && report.status !== 'SUBMITTED') {
    res.status(409).json({
      success: false,
      error: { code: 'CANNOT_EDIT', message: 'Only reports pending review or in revision can be edited', correlationId }
    });
    return;
  }

  if (body.title) report.title = body.title;
  if (body.purpose) report.purpose = body.purpose;
  if (body.currency) report.currency = body.currency;

  if (Array.isArray(body.items) && body.items.length > 0) {
    let totalAmount = 0;
    const validatedItems: ExpenseItemRecord[] = [];

    for (const item of body.items) {
      const amt = Number(item.amount);
      if (isNaN(amt) || amt <= 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Expense item amount must be a positive number', correlationId }
        });
        return;
      }

      const category = expenseRepo.findCategoryByIdOrCode(item.categoryId);
      if (!category) {
        res.status(404).json({
          success: false,
          error: { code: 'CATEGORY_NOT_FOUND', message: `Expense category ${item.categoryId} not found`, correlationId }
        });
        return;
      }

      if (amt > category.maxSingleLimit) {
        res.status(422).json({
          success: false,
          error: {
            code: 'CATEGORY_LIMIT_EXCEEDED',
            message: `Item amount ${amt} exceeds maximum single limit of ${category.maxSingleLimit} NGN for ${category.name}`,
            correlationId
          }
        });
        return;
      }

      if (amt > category.receiptThreshold && (!item.receiptUrl || item.receiptUrl.trim() === '')) {
        res.status(422).json({
          success: false,
          error: {
            code: 'RECEIPT_REQUIRED',
            message: `Receipt document is mandatory for expense claims exceeding NGN 5,000 (Item: ${item.description || item.merchantName || category.name})`,
            correlationId
          }
        });
        return;
      }

      totalAmount += amt;
      validatedItems.push({
        id: item.id || `item-${crypto.randomUUID().slice(0, 8)}`,
        categoryId: category.id,
        dateIncurred: item.dateIncurred || item.expenseDate || new Date().toISOString().split('T')[0],
        merchantName: item.merchantName || item.merchant || 'Merchant',
        amount: amt,
        description: item.description || '',
        receiptUrl: item.receiptUrl,
        receiptFileName: item.receiptFileName
      });
    }

    report.items = validatedItems;
    report.totalAmount = totalAmount;
  }

  // When edited, status resets to SUBMITTED
  report.status = 'SUBMITTED';
  await expenseRepo.updateReport(report.id, report);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'EXPENSE_UPDATED',
    entityType: 'ExpenseReport',
    entityId: repId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      title: report.title,
      totalAmount: report.totalAmount,
      status: report.status
    }
  });

  res.status(200).json({ success: true, data: report });
}

export async function reviewExpenseReportHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const repId = req.params.id;
  const user = req.user!;
  const body = req.body;

  const expenseRepo = getExpenseRepository();
  const report = expenseRepo.findReportById(repId);

  if (!report) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Expense report not found', correlationId }
    });
    return;
  }

  // Self-approval prohibition
  if (report.employeeId === user.profile.id) {
    res.status(403).json({
      success: false,
      error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'Self-approval is strictly prohibited', correlationId }
    });
    return;
  }

  // 1. Enforce that regular employees cannot review or approve expense claims (OWASP A01 / CWE-269)
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Employees are not authorized to review or approve expense claims', correlationId }
    });
    return;
  }

  // 2. Enforce multi-tier escalation authorization invariants (CWE-863)
  if (report.status === 'PENDING_DEPT_HEAD') {
    if (user.profile.id !== report.currentApproverId && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Department Head or Admin authorization required for this escalation tier', correlationId }
      });
      return;
    }
  }

  if (report.status === 'PENDING_EXEC') {
    if (user.role !== 'ADMIN' && user.profile.id !== report.currentApproverId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Executive or Admin authorization required for this escalation tier', correlationId }
      });
      return;
    }
  }

  const action = body.action || body.decision || body.status;
  if (!action) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Action is required', correlationId }
    });
    return;
  }

  // Terminal state immutability check
  if (report.status === 'PAID' || report.status === 'REJECTED') {
    res.status(409).json({
      success: false,
      error: { code: 'ALREADY_DECIDED', message: 'Claim has already reached terminal state and cannot be modified', correlationId }
    });
    return;
  }

  if (report.status === 'APPROVED' && (action === 'APPROVE' || action === 'ManagerApproved')) {
    res.status(409).json({
      success: false,
      error: { code: 'ALREADY_DECIDED', message: 'Expense claim has already been approved', correlationId }
    });
    return;
  }

  if (action === 'REJECT' || action === 'Rejected') {
    report.status = 'REJECTED';
    report.rejectionReason = body.rejectionReason || body.comments || body.comment || 'Rejected';
    await expenseRepo.updateReport(report.id, report);

    const auditService = getAuditService();
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'EXPENSE_REJECTED',
      entityType: 'ExpenseReport',
      entityId: repId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      stateDiff: { approverId: user.profile.id, reason: report.rejectionReason }
    });

    res.status(200).json({ success: true, data: report });
    return;
  }

  if (action === 'REQUEST_REVISION' || action === 'REVISION_REQUESTED') {
    report.status = 'REVISION_REQUESTED';
    report.rejectionReason = body.rejectionReason || body.comments || body.comment || 'Revision requested';
    await expenseRepo.updateReport(report.id, report);

    const auditService = getAuditService();
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'EXPENSE_REVISION_REQUESTED',
      entityType: 'ExpenseReport',
      entityId: repId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      stateDiff: { approverId: user.profile.id, comments: body.comments || body.comment }
    });

    res.status(200).json({ success: true, data: report });
    return;
  }

  if (action === 'APPROVE' || action === 'ManagerApproved') {
    // Dynamic multi-tier escalation hierarchy:
    // Manager review tier: if totalAmount > 50k NGN -> PENDING_DEPT_HEAD, else -> APPROVED
    // Dept Head review tier: if totalAmount > 250k NGN -> PENDING_EXEC, else -> APPROVED
    // Exec / Admin review tier: -> APPROVED
    if (report.status === 'SUBMITTED' || report.status === 'PENDING_LINE_MANAGER') {
      if (report.totalAmount > 50000) {
        report.status = 'PENDING_DEPT_HEAD';
        report.currentApproverId = 'emp-depthead-01';
      } else {
        report.status = 'APPROVED';
        report.approvedAt = new Date().toISOString();
        report.currentApproverId = 'emp-finance-01';
      }
    } else if (report.status === 'PENDING_DEPT_HEAD') {
      if (report.totalAmount > 250000) {
        report.status = 'PENDING_EXEC';
        report.currentApproverId = 'emp-admin-01';
      } else {
        report.status = 'APPROVED';
        report.approvedAt = new Date().toISOString();
        report.currentApproverId = 'emp-finance-01';
      }
    } else {
      report.status = 'APPROVED';
      report.approvedAt = new Date().toISOString();
      report.currentApproverId = 'emp-finance-01';
    }

    await expenseRepo.updateReport(report.id, report);

    const auditService = getAuditService();
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'EXPENSE_APPROVED',
      entityType: 'ExpenseReport',
      entityId: repId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      stateDiff: { approverId: user.profile.id, newStatus: report.status, comments: body.comments || body.comment }
    });

    res.status(200).json({ success: true, data: report });
    return;
  }

  res.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: `Unknown action ${action}`, correlationId }
  });
}

export async function disburseExpenseReportHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const repId = req.params.id;
  const user = req.user!;
  const body = req.body;

  if (user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Finance administrator privilege required for disbursement', correlationId }
    });
    return;
  }

  const expenseRepo = getExpenseRepository();
  const report = expenseRepo.findReportById(repId);

  if (!report) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Expense report not found', correlationId }
    });
    return;
  }

  if (report.status !== 'APPROVED') {
    res.status(409).json({
      success: false,
      error: { code: 'NOT_APPROVED', message: 'Cannot disburse unapproved expense claim', correlationId }
    });
    return;
  }

  report.status = 'PAID';
  report.paidAt = body.paidDate || new Date().toISOString();
  report.disbursementReference = body.disbursementReference || `DISB-${Math.floor(100000 + Math.random() * 900000)}`;

  await expenseRepo.updateReport(report.id, report);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'EXPENSE_DISBURSED',
    entityType: 'ExpenseReport',
    entityId: repId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      disbursementReference: report.disbursementReference,
      amount: report.totalAmount,
      paidDate: report.paidAt
    }
  });

  res.status(200).json({ success: true, data: report });
}
