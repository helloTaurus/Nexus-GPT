import type { Request, Response } from 'express';
import {
  getAuditService,
  getSettingsRepository,
  getUserRepository,
  getLeaveRepository,
  getExpenseRepository,
  getAppraisalRepository
} from '../repositories/dataStore.ts';
import { MerkleTree } from '../audit/merkleTree.ts';

export async function getAdminMetricsHandler(req: Request, res: Response): Promise<void> {
  const userRepo = getUserRepository();
  const leaveRepo = getLeaveRepository();
  const expenseRepo = getExpenseRepository();
  const appraisalRepo = getAppraisalRepository();
  const auditService = getAuditService();

  // 1. Workforce metrics
  // If only superadmin exists, totalWorkforce = 0 (per user's request: "Let them all read zero... I want to be the one creating data using Add Staff")
  const allUsers = userRepo.findAll({ limit: 1000 }).profiles;
  const nonAdminStaff = allUsers.filter(u => u.id !== 'emp-superadmin-01' && u.staffId !== 'NX-ADM-0001');
  const totalWorkforce = nonAdminStaff.length;
  const activeStaff = nonAdminStaff.filter(u => u.status === 'ACTIVE').length;

  // 2. Staff on leave today & pending leaves
  const todayStr = new Date().toISOString().split('T')[0];
  const allLeaveRequests = leaveRepo.findRequests({ all: true });
  const staffOnLeave = allLeaveRequests.filter(
    r => r.status === 'APPROVED' && r.startDate <= todayStr && r.endDate >= todayStr
  ).length;
  const pendingLeaves = allLeaveRequests.filter(r => r.status === 'SUBMITTED');
  const pendingLeavesCount = pendingLeaves.length;

  // 3. Expense claims queue
  const allExpenseReports = expenseRepo.findReports({ all: true });
  const queuedExpenses = allExpenseReports.filter(r =>
    ['PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC', 'SUBMITTED', 'PENDING_FINANCE'].includes(r.status)
  );
  const expenseQueueCount = queuedExpenses.length;
  const expenseQueueTotalAmount = queuedExpenses.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  // 4. Appraisal cycle
  const cycles = appraisalRepo.findCycles();
  const activeCycle = cycles.find(c => c.status === 'ACTIVE') || null;
  let appraisalMetrics: {
    id: string;
    title: string;
    fiscalYear: number;
    completionRate: number;
  } | null = null;

  if (activeCycle) {
    const submissions = appraisalRepo.findSubmissions({ cycleId: activeCycle.id });
    const completed = submissions.filter(s => ['COMPLETED', 'ACKNOWLEDGED'].includes(s.status)).length;
    const rate = submissions.length > 0 ? Math.round((completed / submissions.length) * 100) : 0;
    appraisalMetrics = {
      id: activeCycle.id,
      title: activeCycle.title,
      fiscalYear: activeCycle.fiscalYear,
      completionRate: rate
    };
  }

  // 5. Pending review queue (combined leave + expenses)
  const pendingReviewQueue: Array<{
    id: string;
    type: 'LEAVE' | 'EXPENSE';
    title: string;
    subtitle: string;
    amount?: number;
    days?: number;
    status: string;
    createdAt: string;
    link: string;
  }> = [
    ...pendingLeaves.map(r => {
      const emp = allUsers.find(u => u.id === r.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : (r.employeeId || 'Staff Member');
      return {
        id: r.id,
        type: 'LEAVE' as const,
        title: `${empName} • Leave Request (${r.days} Days)`,
        subtitle: `${emp?.department || 'Department'} • ${r.startDate} to ${r.endDate}`,
        days: r.days,
        status: r.status,
        createdAt: r.createdAt,
        link: '/admin/leave-approvals'
      };
    }),
    ...queuedExpenses.map(e => ({
      id: e.id,
      type: 'EXPENSE' as const,
      title: `${e.employeeName} • Expense Claim (₦${Number(e.totalAmount).toLocaleString('en-NG', { minimumFractionDigits: 2 })})`,
      subtitle: `${e.purpose || e.title} • ${e.reportNumber}`,
      amount: e.totalAmount,
      status: e.status,
      createdAt: e.submittedAt,
      link: '/admin/expense-approvals'
    }))
  ];

  // 6. Recent audit logs
  const logs = auditService.getAll();
  const recentAuditLogs = logs.slice(0, 5).map(l => ({
    id: l.id,
    action: l.action,
    actorEmail: l.actorEmail || 'system',
    timestamp: l.timestamp,
    summary: `Entity: ${l.entityType} (${l.entityId})`
  }));

  res.status(200).json({
    success: true,
    data: {
      totalWorkforce,
      activeStaff,
      staffOnLeave,
      pendingLeavesCount,
      expenseQueueCount,
      expenseQueueTotalAmount,
      activeAppraisalCycle: appraisalMetrics,
      pendingReviewQueue,
      recentAuditLogs
    }
  });
}

export async function getAuditLogsHandler(req: Request, res: Response): Promise<void> {
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
  const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;

  const auditService = getAuditService();
  let logs = auditService.getAll();

  if (action && action !== 'All') logs = logs.filter(l => l.action === action);
  if (entityType) logs = logs.filter(l => l.entityType === entityType);
  if (actorId) logs = logs.filter(l => l.actorId === actorId || (l.actorEmail && l.actorEmail.toLowerCase().includes(actorId.toLowerCase())));
  if (entityId) logs = logs.filter(l => l.entityId === entityId);
  if (startDate) {
    const s = new Date(startDate).getTime();
    logs = logs.filter(l => new Date(l.timestamp).getTime() >= s);
  }
  if (endDate) {
    const e = new Date(endDate).getTime();
    logs = logs.filter(l => new Date(l.timestamp).getTime() <= e);
  }
  if (search) {
    logs = logs.filter(l =>
      l.action.toLowerCase().includes(search) ||
      (l.actorEmail && l.actorEmail.toLowerCase().includes(search)) ||
      (l.ipAddress && l.ipAddress.toLowerCase().includes(search)) ||
      l.entityId.toLowerCase().includes(search) ||
      l.id.toLowerCase().includes(search)
    );
  }

  const total = logs.length;
  let paginatedLogs = logs;
  if (page !== undefined && limit !== undefined) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const startIndex = (safePage - 1) * safeLimit;
    paginatedLogs = logs.slice(startIndex, startIndex + safeLimit);
  }

  res.status(200).json({
    success: true,
    data: paginatedLogs,
    pagination: {
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) || 1 : 1
    }
  });
}

export async function verifyAuditLogsHandler(_req: Request, res: Response): Promise<void> {
  const auditService = getAuditService();
  const integrity = auditService.verifyIntegrity();
  const logs = auditService.getAll();
  const merkleTree = new MerkleTree(logs);
  const merkleRoot = merkleTree.getRoot();
  const lastHash = logs.length > 0 ? logs[0].hash : '0000000000000000000000000000000000000000000000000000000000000000';

  res.status(200).json({
    success: true,
    data: {
      valid: integrity.valid,
      compromisedId: integrity.compromisedId,
      totalChecked: integrity.totalChecked,
      merkleRoot,
      lastHash,
      verifiedAt: new Date().toISOString()
    }
  });
}

export async function getSettingsHandler(_req: Request, res: Response): Promise<void> {
  const settingsRepo = getSettingsRepository();
  const settings = settingsRepo.getSettings();
  res.status(200).json({
    success: true,
    data: settings
  });
}

export async function updateSettingsHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const settingsRepo = getSettingsRepository();
  const updated = await settingsRepo.updateSettings(req.body);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'SETTINGS_UPDATED',
    entityType: 'SystemSettings',
    entityId: 'settings',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: req.body
  });

  res.status(200).json({
    success: true,
    data: updated
  });
}
