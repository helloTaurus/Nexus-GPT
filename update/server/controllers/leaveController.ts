import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getLeaveRepository, getAuditService } from '../repositories/dataStore.ts';
import type { LeaveRequestRecord } from '../repositories/types.ts';

export async function getLeaveBalancesHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const targetEmpId = typeof req.query.employeeId === 'string' ? req.query.employeeId : user.profile.id;

  if (targetEmpId !== user.profile.id && user.role === 'EMPLOYEE') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Cannot view peer leave balances', correlationId }
    });
    return;
  }

  const leaveRepo = getLeaveRepository();
  const balances = leaveRepo.findBalances(targetEmpId, 2026);
  res.status(200).json({ success: true, data: balances });
}

export async function calculateLeaveDaysHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const reqStart = req.method === 'POST' ? req.body.startDate : req.query.startDate;
  const reqEnd = req.method === 'POST' ? req.body.endDate : req.query.endDate;
  const reqHalf = req.method === 'POST' ? !!req.body.isHalfDay : req.query.isHalfDay === 'true';

  if (!reqStart || !reqEnd) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Start date and end date are required', correlationId }
    });
    return;
  }

  const leaveRepo = getLeaveRepository();
  try {
    const result = leaveRepo.calculateNetWorkingDays(String(reqStart), String(reqEnd), reqHalf);
    res.status(200).json({ success: true, ...result });
  } catch {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DATE_RANGE', message: 'End date cannot be earlier than start date', correlationId }
    });
  }
}

export async function getLeaveRequestsHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const scope = typeof req.query.scope === 'string' ? req.query.scope : 'mine';
  const leaveRepo = getLeaveRepository();

  if (scope === 'team') {
    if (user.role === 'EMPLOYEE') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Employees cannot view team approval queue', correlationId }
      });
      return;
    }
    const requests = leaveRepo.findRequests({ approverId: user.profile.id });
    res.status(200).json({ success: true, data: requests });
    return;
  }

  if (scope === 'all') {
    if (user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required to view all company requests', correlationId }
      });
      return;
    }
    const requests = leaveRepo.findRequests({ all: true });
    res.status(200).json({ success: true, data: requests });
    return;
  }

  const requests = leaveRepo.findRequests({ employeeId: user.profile.id });
  res.status(200).json({ success: true, data: requests });
}

export async function submitLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const body = req.body;

  if (!body.leaveTypeId || !body.startDate || !body.endDate || !body.reason) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing required leave request fields', correlationId }
    });
    return;
  }

  const leaveRepo = getLeaveRepository();
  let netDaysCalc: { workingDays: number; calendarDays: number; holidaysEncountered: string[] };

  try {
    netDaysCalc = leaveRepo.calculateNetWorkingDays(body.startDate, body.endDate, !!body.isHalfDay);
  } catch {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DATE_RANGE', message: 'End date cannot be earlier than start date', correlationId }
    });
    return;
  }

  if (netDaysCalc.workingDays <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'ZERO_WORKING_DAYS',
        message: 'Selected period contains 0 net working days (all weekends or holidays)',
        correlationId
      }
    });
    return;
  }

  const balance = leaveRepo.findBalance(user.profile.id, body.leaveTypeId, 2026);
  if (!balance) {
    res.status(404).json({
      success: false,
      error: { code: 'BALANCE_NOT_FOUND', message: 'Leave balance record not found', correlationId }
    });
    return;
  }

  if (netDaysCalc.workingDays > balance.availableDays) {
    res.status(409).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_LEAVE_BALANCE',
        message: `Insufficient leave balance: Requested ${netDaysCalc.workingDays} days, available ${balance.availableDays} days`,
        correlationId
      }
    });
    return;
  }

  const existingReqs = leaveRepo
    .findRequests({ employeeId: user.profile.id })
    .filter(r => r.status === 'SUBMITTED' || r.status === 'APPROVED');

  const reqStart = new Date(body.startDate);
  const reqEnd = new Date(body.endDate);
  for (const ex of existingReqs) {
    const exStart = new Date(ex.startDate);
    const exEnd = new Date(ex.endDate);
    if (reqStart <= exEnd && reqEnd >= exStart) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DATE_OVERLAP',
          message: `Date range overlaps with existing leave request ${ex.requestNumber}`,
          correlationId
        }
      });
      return;
    }
  }

  if (body.leaveTypeId === 'lt-sick' && netDaysCalc.workingDays > 2 && !body.attachmentUrl) {
    res.status(422).json({
      success: false,
      error: {
        code: 'MEDICAL_NOTE_REQUIRED',
        message: 'Doctor certificate required for sick leave exceeding 2 consecutive working days',
        correlationId
      }
    });
    return;
  }

  if (body.leaveTypeId === 'lt-casual' && netDaysCalc.workingDays > 2) {
    res.status(422).json({
      success: false,
      error: {
        code: 'POLICY_LIMIT_EXCEEDED',
        message: 'Casual leave cannot exceed 2 consecutive working days',
        correlationId
      }
    });
    return;
  }

  balance.pendingDays += netDaysCalc.workingDays;
  balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
  await leaveRepo.saveBalance(balance);

  const reqId = `lr-${crypto.randomUUID().slice(0, 8)}`;
  const requestNumber = `LR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const assignedApproverId = user.profile.managerId || 'emp-admin-01';

  const leaveReq: LeaveRequestRecord = {
    id: reqId,
    requestNumber,
    employeeId: user.profile.id,
    leaveTypeId: body.leaveTypeId,
    startDate: body.startDate,
    endDate: body.endDate,
    isHalfDay: !!body.isHalfDay,
    totalDays: netDaysCalc.workingDays,
    reason: body.reason,
    attachmentUrl: body.attachmentUrl,
    status: 'SUBMITTED',
    assignedApproverId,
    submittedAt: new Date().toISOString()
  };

  await leaveRepo.createRequest(leaveReq);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'LEAVE_SUBMITTED',
    entityType: 'LeaveRequest',
    entityId: reqId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      requestNumber,
      totalDays: netDaysCalc.workingDays
    }
  });

  res.status(201).json({ success: true, data: leaveReq });
}

export async function reviewLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const reqId = req.params.id;
  const user = req.user!;
  const body = req.body;

  const leaveRepo = getLeaveRepository();
  const leaveReq = leaveRepo.findRequestById(reqId);

  if (!leaveReq) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Leave request not found', correlationId }
    });
    return;
  }

  // Self-approval prohibition
  if (leaveReq.employeeId === user.profile.id) {
    res.status(403).json({
      success: false,
      error: { code: 'SELF_APPROVAL_PROHIBITED', message: 'Self-approval prohibited', correlationId }
    });
    return;
  }

  if (leaveReq.assignedApproverId !== user.profile.id && user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not authorized to review this leave request', correlationId }
    });
    return;
  }

  // Guard against re-reviewing already decided or cancelled requests
  if (leaveReq.status !== 'SUBMITTED') {
    res.status(409).json({
      success: false,
      error: {
        code: 'ALREADY_DECIDED',
        message: `Leave request has already been decided (current status: '${leaveReq.status}')`,
        correlationId
      }
    });
    return;
  }

  const action = body.action || body.decision || body.status;
  if (action !== 'APPROVE' && action !== 'REJECT' && action !== 'Approved' && action !== 'Rejected') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Action must be APPROVE or REJECT', correlationId }
    });
    return;
  }

  const isApprove = String(action).toUpperCase().startsWith('APP');
  const balance = leaveRepo.findBalance(leaveReq.employeeId, leaveReq.leaveTypeId, 2026);

  if (isApprove) {
    leaveReq.status = 'APPROVED';
    if (balance) {
      balance.pendingDays -= leaveReq.totalDays;
      balance.usedDays += leaveReq.totalDays;
      balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
      await leaveRepo.saveBalance(balance);
    }
  } else {
    leaveReq.status = 'REJECTED';
    if (balance) {
      balance.pendingDays -= leaveReq.totalDays;
      balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
      await leaveRepo.saveBalance(balance);
    }
  }

  leaveReq.decidedAt = new Date().toISOString();
  leaveReq.decisionReason = body.decisionReason || body.comment || body.comments;
  await leaveRepo.updateRequest(leaveReq.id, leaveReq);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: isApprove ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    entityType: 'LeaveRequest',
    entityId: reqId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: { decision: leaveReq.status, reason: leaveReq.decisionReason }
  });

  res.status(200).json({ success: true, data: leaveReq });
}

export async function cancelLeaveRequestHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const reqId = req.params.id;
  const user = req.user!;

  const leaveRepo = getLeaveRepository();
  const leaveReq = leaveRepo.findRequestById(reqId);

  if (!leaveReq) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Leave request not found', correlationId }
    });
    return;
  }

  if (leaveReq.employeeId !== user.profile.id && user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Cannot cancel requests of other employees', correlationId }
    });
    return;
  }

  // Reject cancellation of terminal states (REJECTED or CANCELLED)
  if (leaveReq.status !== 'SUBMITTED' && leaveReq.status !== 'APPROVED') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot cancel leave request in '${leaveReq.status}' state`,
        correlationId
      }
    });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  if (leaveReq.startDate < today && leaveReq.status === 'APPROVED') {
    res.status(400).json({
      success: false,
      error: {
        code: 'PAST_LEAVE_CANNOT_BE_CANCELLED',
        message: 'Cannot retroactively cancel past leave. Contact HR Administrator',
        correlationId
      }
    });
    return;
  }

  const balance = leaveRepo.findBalance(leaveReq.employeeId, leaveReq.leaveTypeId, 2026);

  if (leaveReq.status === 'SUBMITTED') {
    if (balance) {
      balance.pendingDays -= leaveReq.totalDays;
      balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
      await leaveRepo.saveBalance(balance);
    }
  } else if (leaveReq.status === 'APPROVED') {
    if (balance) {
      balance.usedDays -= leaveReq.totalDays;
      balance.availableDays = (balance.allocatedDays + balance.carriedOverDays) - balance.usedDays - balance.pendingDays;
      await leaveRepo.saveBalance(balance);
    }
  }

  leaveReq.status = 'CANCELLED';
  await leaveRepo.updateRequest(leaveReq.id, leaveReq);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'LEAVE_CANCELLED',
    entityType: 'LeaveRequest',
    entityId: reqId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(200).json({ success: true, data: leaveReq });
}
