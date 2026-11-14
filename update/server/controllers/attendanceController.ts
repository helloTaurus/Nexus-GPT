import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getAttendanceRepository, getAuditService } from '../repositories/dataStore.ts';

export async function getTodayAttendanceHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const attendanceRepo = getAttendanceRepository();
  const record = attendanceRepo.getTodayRecord(user.id);
  const summary = attendanceRepo.buildSummary(record);

  res.status(200).json({
    success: true,
    data: summary
  });
}

export async function clockInHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const attendanceRepo = getAttendanceRepository();

  try {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    const timestamp = typeof req.body?.timestamp === 'string' ? req.body.timestamp : undefined;

    const result = await attendanceRepo.clockIn(user, notes, timestamp);

    const auditService = getAuditService();
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'STAFF_CLOCKED_IN',
      entityType: 'AttendanceRecord',
      entityId: result.record.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      stateDiff: {
        sessionId: result.session.id,
        clockIn: result.session.clockIn,
        resumptionStatus: result.record.resumptionStatus,
        dayOfWeek: result.record.dayOfWeek,
        isWeekend: result.record.isWeekend
      }
    });

    res.status(200).json({
      success: true,
      data: result.summary
    });
  } catch (err: any) {
    if (err.code === 'ALREADY_CLOCKED_IN') {
      res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_CLOCKED_IN',
          message: err.message || 'Employee is already clocked in with an active session',
          correlationId
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'CLOCK_IN_FAILED',
        message: 'Failed to record clock-in session',
        correlationId
      }
    });
  }
}

export async function clockOutHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const attendanceRepo = getAttendanceRepository();

  try {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    const timestamp = typeof req.body?.timestamp === 'string' ? req.body.timestamp : undefined;

    const result = await attendanceRepo.clockOut(user, notes, timestamp);

    const auditService = getAuditService();
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'STAFF_CLOCKED_OUT',
      entityType: 'AttendanceRecord',
      entityId: result.record.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      stateDiff: {
        sessionId: result.session.id,
        clockOut: result.session.clockOut,
        durationMinutes: result.session.durationMinutes,
        totalMinutesWorked: result.record.totalMinutesWorked
      }
    });

    res.status(200).json({
      success: true,
      data: result.summary
    });
  } catch (err: any) {
    if (err.code === 'NOT_CLOCKED_IN') {
      res.status(409).json({
        success: false,
        error: {
          code: 'NOT_CLOCKED_IN',
          message: err.message || 'No active clock-in session found to clock out',
          correlationId
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'CLOCK_OUT_FAILED',
        message: 'Failed to record clock-out session',
        correlationId
      }
    });
  }
}

export async function getAttendanceHistoryHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const attendanceRepo = getAttendanceRepository();

  const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

  const records = attendanceRepo.getHistory(user.id, {
    limit: !isNaN(Number(limitParam)) ? limitParam : undefined,
    startDate,
    endDate
  });

  res.status(200).json({
    success: true,
    data: records
  });
}
