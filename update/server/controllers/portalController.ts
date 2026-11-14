import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getUserRepository, getAuditService } from '../repositories/dataStore.ts';

export async function getProfileHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  res.status(200).json({
    success: true,
    data: {
      ...user.profile,
      email: user.email,
      role: user.role
    }
  });
}

export async function updateProfileHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;

  // Restricted field modification guard for non-admins
  if (user.role !== 'ADMIN') {
    if ('salary' in req.body || 'title' in req.body || 'role' in req.body || 'staffId' in req.body || 'designation' in req.body) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot modify restricted compensation or role fields',
          correlationId
        }
      });
      return;
    }
  }

  // NUBAN validation: exactly 10 digits
  if (req.body.bankAccountNumber) {
    if (!/^\d{10}$/.test(String(req.body.bankAccountNumber).trim())) {
      res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_NUBAN',
          message: 'Nigerian NUBAN account number must be exactly 10 digits',
          correlationId
        }
      });
      return;
    }
  }

  const prev = { ...user.profile };
  const userRepo = getUserRepository();

  const updatedProfile = await userRepo.updateProfile(user.id, {
    phone: req.body.phone ?? user.profile.phone,
    residentialAddress: req.body.residentialAddress ?? user.profile.residentialAddress,
    emergencyContactName: req.body.emergencyContactName ?? user.profile.emergencyContactName,
    emergencyContactPhone: req.body.emergencyContactPhone ?? user.profile.emergencyContactPhone,
    emergencyContactRelationship: req.body.emergencyContactRelationship ?? user.profile.emergencyContactRelationship,
    bankName: req.body.bankName ?? user.profile.bankName,
    bankAccountNumber: req.body.bankAccountNumber ?? user.profile.bankAccountNumber,
    bankAccountName: req.body.bankAccountName ?? user.profile.bankAccountName,
    bvn: req.body.bvn ?? user.profile.bvn,
    nin: req.body.nin ?? user.profile.nin
  });

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'PROFILE_UPDATED',
    entityType: 'EmployeeProfile',
    entityId: user.profile.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      previous: prev,
      updated: updatedProfile
    }
  });

  res.status(200).json({
    success: true,
    data: {
      ...updatedProfile,
      email: user.email,
      role: user.role
    }
  });
}
