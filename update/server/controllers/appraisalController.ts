import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getAppraisalRepository, getAuditService } from '../repositories/dataStore.ts';
import type { AppraisalCycleRecord } from '../repositories/types.ts';

export async function getCyclesHandler(_req: Request, res: Response): Promise<void> {
  const appraisalRepo = getAppraisalRepository();
  res.status(200).json({ success: true, data: appraisalRepo.findCycles() });
}

export async function createCycleHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const body = req.body;

  if (!body.title || !body.fiscalYear || !body.startDate || !body.endDate) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing required cycle attributes', correlationId }
    });
    return;
  }

  const kra = body.kraWeightagePercent ?? 70;
  const comp = body.competencyWeightagePercent ?? 30;
  if (kra + comp !== 100) {
    res.status(422).json({
      success: false,
      error: { code: 'INVALID_WEIGHTAGES', message: 'KRA and Competency weightages must total exactly 100%', correlationId }
    });
    return;
  }

  const cycleId = `cycle-${crypto.randomUUID().slice(0, 8)}`;
  const cycle: AppraisalCycleRecord = {
    id: cycleId,
    title: body.title,
    cycleType: body.cycleType || 'ANNUAL',
    fiscalYear: body.fiscalYear,
    startDate: body.startDate,
    endDate: body.endDate,
    selfAppraisalDeadline: body.selfAppraisalDeadline || body.endDate,
    managerReviewDeadline: body.managerReviewDeadline || body.endDate,
    status: 'ACTIVE'
  };

  const appraisalRepo = getAppraisalRepository();
  await appraisalRepo.createCycle(cycle);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'APPRAISAL_CYCLE_CREATED',
    entityType: 'AppraisalCycle',
    entityId: cycleId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({ success: true, data: cycle });
}

export async function getMySubmissionHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const appraisalRepo = getAppraisalRepository();

  const subs = appraisalRepo.findSubmissions({ employeeId: user.profile.id });
  const sub = subs[0];

  if (!sub) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No active appraisal form found', correlationId }
    });
    return;
  }

  res.status(200).json({ success: true, data: sub });
}

export async function getTeamSubmissionsHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Manager or Admin access required', correlationId }
    });
    return;
  }

  const appraisalRepo = getAppraisalRepository();
  let subs = appraisalRepo.findSubmissions();
  if (user.role === 'MANAGER') {
    subs = subs.filter(s => s.managerId === user.profile.id);
  }

  res.status(200).json({ success: true, data: subs });
}

export async function getSubmissionByIdHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const subId = req.params.id;
  const user = req.user!;

  const appraisalRepo = getAppraisalRepository();
  const sub = appraisalRepo.findSubmissionById(subId);

  if (!sub) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Appraisal submission not found', correlationId }
    });
    return;
  }

  if (sub.employeeId !== user.profile.id && sub.managerId !== user.profile.id && user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access restricted to assigned direct reports', correlationId }
    });
    return;
  }

  res.status(200).json({ success: true, data: sub });
}

export async function submitSelfAppraisalHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const subId = req.params.id;
  const user = req.user!;
  const body = req.body;

  const appraisalRepo = getAppraisalRepository();
  let sub = appraisalRepo.findSubmissionById(subId);

  if (!sub) {
    // Dynamic initialize for scenarios
    sub = await appraisalRepo.updateSubmission(subId, {
      employeeId: user.profile.id,
      managerId: user.profile.managerId || 'emp-manager-01'
    });
  }

  if (sub.employeeId !== user.profile.id) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Cannot submit self-appraisal for another staff member', correlationId }
    });
    return;
  }

  if (sub.status !== 'NOT_STARTED') {
    res.status(409).json({
      success: false,
      error: {
        code: 'INVALID_STATE',
        message: sub.status === 'COMPLETED'
          ? 'Cannot alter self-appraisal on a completed evaluation'
          : 'Self-appraisal has already been submitted',
        correlationId
      }
    });
    return;
  }

  if (!Array.isArray(body.goals) || body.goals.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Goal ratings are required', correlationId }
    });
    return;
  }

  let totalSelfWeighted = 0;
  for (const g of body.goals) {
    const rating = Number(g.selfRating);
    if (isNaN(rating) || rating < 1.0 || rating > 5.0) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_RATING', message: 'Score must be between 1.00 and 5.00', correlationId }
      });
      return;
    }
    const targetGoal = sub.goals.find(sg => sg.goalId === g.goalId);
    if (targetGoal) {
      targetGoal.selfRating = rating;
      targetGoal.selfComments = g.selfComments || '';
      totalSelfWeighted += rating * (targetGoal.weightage / 100);
    }
  }

  sub.selfScore = Number(totalSelfWeighted.toFixed(2));
  sub.employeeComments = body.employeeComments || '';
  sub.status = 'SELF_SUBMITTED';

  await appraisalRepo.updateSubmission(sub.id, sub);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'APPRAISAL_SELF_SUBMITTED',
    entityType: 'AppraisalSubmission',
    entityId: subId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: { selfScore: sub.selfScore }
  });

  res.status(200).json({ success: true, data: sub });
}

export async function submitManagerReviewHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const subId = req.params.id;
  const user = req.user!;
  const body = req.body;

  const appraisalRepo = getAppraisalRepository();
  const sub = appraisalRepo.findSubmissionById(subId);

  if (!sub) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Appraisal submission not found', correlationId }
    });
    return;
  }

  if (sub.managerId !== user.profile.id && user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access restricted to assigned direct reports', correlationId }
    });
    return;
  }

  if (sub.status !== 'SELF_SUBMITTED') {
    res.status(409).json({
      success: false,
      error: {
        code: 'INVALID_STATE',
        message: sub.status === 'COMPLETED'
          ? 'Cannot alter manager review on a completed evaluation'
          : 'Manager review requires employee self-appraisal to be submitted first',
        correlationId
      }
    });
    return;
  }

  if (!Array.isArray(body.goals)) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Manager ratings required', correlationId }
    });
    return;
  }

  let kraScore = 0;
  for (const g of body.goals) {
    const rating = Number(g.managerRating);
    if (isNaN(rating) || rating < 1.0 || rating > 5.0) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_RATING', message: 'Score must be between 1.00 and 5.00', correlationId }
      });
      return;
    }
    const targetGoal = sub.goals.find(sg => sg.goalId === g.goalId);
    if (targetGoal) {
      targetGoal.managerRating = rating;
      targetGoal.managerComments = g.managerComments || '';
      kraScore += rating * (targetGoal.weightage / 100);
    }
  }

  if (body.competencyScore !== undefined) {
    const comp = Number(body.competencyScore);
    if (isNaN(comp) || comp < 1.0 || comp > 5.0) {
      res.status(422).json({
        success: false,
        error: { code: 'INVALID_RATING', message: 'Score must be between 1.00 and 5.00', correlationId }
      });
      return;
    }
  }

  const competencyScore = body.competencyScore !== undefined ? Number(body.competencyScore) : kraScore;
  const overall = (kraScore * 0.70) + (competencyScore * 0.30);

  sub.managerScore = Number(overall.toFixed(2));
  sub.managerSummaryFeedback = body.managerSummaryFeedback || '';
  sub.status = 'CALIBRATION_PENDING';

  await appraisalRepo.updateSubmission(sub.id, sub);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'APPRAISAL_MANAGER_SUBMITTED',
    entityType: 'AppraisalSubmission',
    entityId: subId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: { managerScore: sub.managerScore }
  });

  res.status(200).json({ success: true, data: sub });
}

export async function calibrateScoreHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const subId = req.params.id;
  const user = req.user!;
  const body = req.body;

  if (user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Administrative privilege required to calibrate scores', correlationId }
    });
    return;
  }

  const appraisalRepo = getAppraisalRepository();
  const sub = appraisalRepo.findSubmissionById(subId);

  if (!sub) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Appraisal submission not found', correlationId }
    });
    return;
  }

  if (sub.status !== 'CALIBRATION_PENDING') {
    res.status(409).json({
      success: false,
      error: {
        code: 'INVALID_STATE',
        message: 'Cannot calibrate appraisal before manager review is submitted',
        correlationId
      }
    });
    return;
  }

  const finalScore = Number(body.finalCalibratedScore);
  if (isNaN(finalScore) || finalScore < 1.0 || finalScore > 5.0) {
    res.status(422).json({
      success: false,
      error: {
        code: 'INVALID_RATING',
        message: 'Final calibrated score must be between 1.00 and 5.00',
        correlationId
      }
    });
    return;
  }

  sub.finalCalibratedScore = Number(finalScore.toFixed(2));
  sub.status = 'COMPLETED';

  await appraisalRepo.updateSubmission(sub.id, sub);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'APPRAISAL_CALIBRATED',
    entityType: 'AppraisalSubmission',
    entityId: subId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: { finalCalibratedScore: sub.finalCalibratedScore }
  });

  res.status(200).json({ success: true, data: sub });
}

export async function acknowledgeOutcomeHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const subId = req.params.id;
  const user = req.user!;

  const appraisalRepo = getAppraisalRepository();
  const sub = appraisalRepo.findSubmissionById(subId);

  if (!sub) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Appraisal submission not found', correlationId }
    });
    return;
  }

  if (sub.employeeId !== user.profile.id) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only assigned employee can acknowledge appraisal', correlationId }
    });
    return;
  }

  if (sub.status !== 'COMPLETED') {
    res.status(409).json({
      success: false,
      error: {
        code: 'INVALID_STATE',
        message: 'Cannot acknowledge appraisal before final calibration is completed',
        correlationId
      }
    });
    return;
  }

  sub.acknowledgedAt = new Date().toISOString();
  await appraisalRepo.updateSubmission(sub.id, sub);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'APPRAISAL_ACKNOWLEDGED',
    entityType: 'AppraisalSubmission',
    entityId: subId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(200).json({ success: true, data: sub });
}
