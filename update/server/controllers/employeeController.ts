import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { getUserRepository, getLeaveRepository, getSessionRepository, getAuditService } from '../repositories/dataStore.ts';
import { PasswordService } from '../services/passwordService.ts';
import { SEED_DEPARTMENTS, SEED_DESIGNATIONS } from '../../../tests/fixtures/seedData.ts';
import type { UserAccount, EmployeeProfile } from '../repositories/types.ts';

export interface OrgChartNode {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  email?: string;
  department: string;
  designation: string;
  role: string;
  avatarUrl?: string;
  directReportsCount: number;
  subordinates: OrgChartNode[];
}

function validateHierarchyAssignment(
  userRepo: ReturnType<typeof getUserRepository>,
  targetUser: UserAccount,
  newManagerId: string | null
): { code?: string; message?: string; statusCode?: number } | null {
  if (!newManagerId) {
    return null;
  }

  // 1. Self-reporting check (Invariant H1)
  if (
    newManagerId === targetUser.id ||
    newManagerId === targetUser.profile.id ||
    newManagerId === targetUser.profile.staffId
  ) {
    return {
      statusCode: 422,
      code: 'SELF_REPORTING_PROHIBITED',
      message: 'An employee cannot report to themselves'
    };
  }

  // 2. Manager existence & status check (Invariant H2)
  const managerUser = userRepo.findById(newManagerId);
  if (!managerUser) {
    return {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Assigned manager with ID '${newManagerId}' does not exist`
    };
  }

  if (managerUser.status !== 'ACTIVE') {
    return {
      statusCode: 422,
      code: 'MANAGER_INACTIVE',
      message: 'Cannot assign an inactive or terminated employee as manager'
    };
  }

  // 3. Cyclic loop detection: Traverse upstream from proposed manager (Invariant H3)
  const visited = new Set<string>();
  visited.add(targetUser.id);
  visited.add(targetUser.profile.id);
  if (targetUser.profile.staffId) visited.add(targetUser.profile.staffId);

  let current: UserAccount | null = managerUser;
  while (current && current.profile.managerId) {
    const nextManagerId = current.profile.managerId;

    if (visited.has(nextManagerId)) {
      return {
        statusCode: 422,
        code: 'CYCLIC_REPORTING_DETECTED',
        message: `Cyclic reporting loop detected: assigning '${targetUser.profile.firstName} ${targetUser.profile.lastName}' to '${managerUser.profile.firstName} ${managerUser.profile.lastName}' creates a circular dependency.`
      };
    }

    visited.add(current.id);
    visited.add(current.profile.id);
    if (current.profile.staffId) visited.add(current.profile.staffId);
    current = userRepo.findById(nextManagerId);
  }

  return null;
}

export async function getEmployeesHandler(req: Request, res: Response): Promise<void> {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = parseInt(String(req.query.limit || '10'), 10);

  const userRepo = getUserRepository();
  const result = userRepo.findAll({ search, departmentId, page, limit });

  res.status(200).json({
    success: true,
    data: result.profiles,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }
  });
}

export async function createEmployeeHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const user = req.user!;
  const body = req.body;

  if (!body.firstName || !body.lastName || !body.email || !body.departmentId || !body.designationId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Mandatory onboarding fields missing', correlationId }
    });
    return;
  }

  const userRepo = getUserRepository();
  const existing = userRepo.findByEmail(body.email);
  if (existing) {
    res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_EMAIL', message: 'An employee with this email already exists', correlationId }
    });
    return;
  }

  if (body.bankAccountNumber && !/^\d{10}$/.test(String(body.bankAccountNumber).trim())) {
    res.status(422).json({
      success: false,
      error: { code: 'INVALID_NUBAN', message: 'Nigerian NUBAN account number must be exactly 10 digits', correlationId }
    });
    return;
  }

  if (body.managerId) {
    const managerUser = userRepo.findById(body.managerId);
    if (!managerUser) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Assigned manager with ID '${body.managerId}' not found`, correlationId }
      });
      return;
    }
    if (managerUser.status !== 'ACTIVE') {
      res.status(422).json({
        success: false,
        error: { code: 'MANAGER_INACTIVE', message: 'Assigned manager is inactive', correlationId }
      });
      return;
    }
  }

  const newUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;
  const newEmpId = `emp-${crypto.randomUUID().slice(0, 8)}`;
  const staffId = `NX-${Math.floor(1000 + Math.random() * 9000)}`;
  const suppliedPass = typeof body.password === 'string' ? body.password.trim() : '';
  if (suppliedPass.length > 0 && suppliedPass.length < 8) {
    res.status(422).json({
      success: false,
      error: { code: 'WEAK_PASSWORD', message: 'Initial password must be at least 8 characters', correlationId }
    });
    return;
  }
  const rawPass = suppliedPass || 'TemporaryPass123!';
  const passwordHash = PasswordService.hashPassword(rawPass);

  const departmentName = SEED_DEPARTMENTS.find(d => d.id === body.departmentId)?.name || 'General';
  const designationTitle = SEED_DESIGNATIONS.find(d => d.id === body.designationId)?.title || 'Officer';

  const newAccount: UserAccount = {
    id: newUserId,
    email: body.email.toLowerCase(),
    passwordHash,
    role: body.role || 'EMPLOYEE',
    status: 'ACTIVE',
    profile: {
      id: newEmpId,
      staffId,
      firstName: body.firstName,
      lastName: body.lastName,
      gender: body.gender || 'PREFER_NOT_TO_SAY',
      phone: body.phone || '+2348000000000',
      residentialAddress: body.residentialAddress || 'Abuja, Nigeria',
      departmentId: body.departmentId,
      department: departmentName,
      designationId: body.designationId,
      designation: designationTitle,
      managerId: body.managerId || null,
      employmentType: body.employmentType || 'FULL_TIME',
      hireDate: body.hireDate || new Date().toISOString().split('T')[0],
      emergencyContactName: body.emergencyContactName || 'Emergency Contact',
      emergencyContactPhone: body.emergencyContactPhone || '+2348000000001',
      emergencyContactRelationship: body.emergencyContactRelationship || 'Next of Kin',
      bankName: body.bankName || 'Zenith Bank',
      bankAccountNumber: body.bankAccountNumber || '0123456789',
      bankAccountName: `${body.firstName} ${body.lastName}`
    }
  };

  await userRepo.create(newAccount);

  // Initialize leave balances for 2026
  const initialQuota = body.initialAnnualLeaveDays !== undefined ? body.initialAnnualLeaveDays : 20.0;
  const leaveRepo = getLeaveRepository();
  await leaveRepo.initializeEmployeeBalances(newEmpId, initialQuota, 2026);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'EMPLOYEE_ONBOARDED',
    entityType: 'EmployeeProfile',
    entityId: newEmpId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      staffId,
      email: body.email
    }
  });

  res.status(201).json({
    success: true,
    data: {
      ...newAccount.profile,
      role: newAccount.role,
      status: newAccount.status
    }
  });
}

export async function getEmployeeByIdHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const empId = req.params.id;

  if (empId === 'me') {
    res.status(200).json({
      success: true,
      data: {
        ...req.user!.profile,
        email: req.user!.email,
        role: req.user!.role,
        status: req.user!.status
      }
    });
    return;
  }

  const userRepo = getUserRepository();
  const targetUser = userRepo.findById(empId) || userRepo.findByStaffId(empId);

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Employee record not found', correlationId }
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      ...targetUser.profile,
      role: targetUser.role,
      status: targetUser.status
    }
  });
}

export async function updateEmployeeHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const empId = req.params.id;
  const user = req.user!;
  const body = req.body;

  const userRepo = getUserRepository();
  const targetUser = userRepo.findById(empId);

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Employee record not found', correlationId }
    });
    return;
  }

  // 1. Super-admin protection: prevent demoting or deactivating the last active ADMIN
  if (targetUser.role === 'ADMIN') {
    const isDemoting = body.role && body.role !== 'ADMIN';
    const isDeactivating = body.status && body.status !== 'ACTIVE';
    if (isDemoting || isDeactivating) {
      const allUsers = (userRepo as any).store.getAll() as UserAccount[];
      const activeAdmins = allUsers.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE');
      const isTargetActiveAdmin = activeAdmins.some(a => a.id === targetUser.id || a.profile.id === targetUser.profile.id);
      if (isTargetActiveAdmin && activeAdmins.length <= 1) {
        res.status(403).json({
          success: false,
          error: {
            code: 'CANNOT_DEMOTE_LAST_ADMIN',
            message: 'Cannot demote or deactivate the sole remaining system administrator',
            correlationId
          }
        });
        return;
      }
    }
  }

  // 2. Reporting hierarchy validation (self-reporting & cyclic loop detection)
  if (body.managerId !== undefined && body.managerId !== targetUser.profile.managerId) {
    const hierarchyError = validateHierarchyAssignment(userRepo, targetUser, body.managerId);
    if (hierarchyError) {
      res.status(hierarchyError.statusCode || 422).json({
        success: false,
        error: {
          code: hierarchyError.code || 'VALIDATION_ERROR',
          message: hierarchyError.message || 'Invalid manager assignment',
          correlationId
        }
      });
      return;
    }
    targetUser.profile.managerId = body.managerId;
  }

  if (body.role) targetUser.role = body.role;
  if (body.status) targetUser.status = body.status;
  if (body.departmentId) {
    targetUser.profile.departmentId = body.departmentId;
    const foundDept = SEED_DEPARTMENTS.find(d => d.id === body.departmentId);
    if (foundDept) targetUser.profile.department = foundDept.name;
  }
  if (body.designationId) {
    targetUser.profile.designationId = body.designationId;
    const foundDes = SEED_DESIGNATIONS.find(d => d.id === body.designationId);
    if (foundDes) targetUser.profile.designation = foundDes.title;
  }
  if (body.firstName) targetUser.profile.firstName = body.firstName;
  if (body.lastName) targetUser.profile.lastName = body.lastName;
  if (body.phone) targetUser.profile.phone = body.phone;
  if (body.residentialAddress) targetUser.profile.residentialAddress = body.residentialAddress;
  if (body.emergencyContactName) targetUser.profile.emergencyContactName = body.emergencyContactName;
  if (body.emergencyContactPhone) targetUser.profile.emergencyContactPhone = body.emergencyContactPhone;
  if (body.emergencyContactRelationship) targetUser.profile.emergencyContactRelationship = body.emergencyContactRelationship;
  if (body.bankName) targetUser.profile.bankName = body.bankName;
  if (body.bankAccountNumber) targetUser.profile.bankAccountNumber = body.bankAccountNumber;
  if (body.bankAccountName) targetUser.profile.bankAccountName = body.bankAccountName;
  if (body.employmentType) targetUser.profile.employmentType = body.employmentType;

  await userRepo.update(targetUser.id, targetUser);

  const auditService = getAuditService();
  await auditService.record({
    actorId: user.id,
    actorEmail: user.email,
    action: 'EMPLOYEE_UPDATED',
    entityType: 'EmployeeProfile',
    entityId: targetUser.profile.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: body
  });

  res.status(200).json({
    success: true,
    data: {
      ...targetUser.profile,
      role: targetUser.role,
      status: targetUser.status
    }
  });
}

export async function resetEmployeePasswordHandler(req: Request, res: Response): Promise<void> {
  const correlationId = req.correlationId || `corr_${crypto.randomUUID()}`;
  const empId = req.params.id;
  const adminUser = req.user!;
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'New password is required', correlationId }
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(422).json({
      success: false,
      error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters', correlationId }
    });
    return;
  }

  const userRepo = getUserRepository();
  const targetUser = userRepo.findById(empId) || userRepo.findByStaffId(empId);

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Employee record not found', correlationId }
    });
    return;
  }

  const passwordHash = PasswordService.hashPassword(newPassword);
  await userRepo.update(targetUser.id, { passwordHash });

  // Revoke existing sessions of the target account (keep admin's active session if resetting self)
  const excludeToken = targetUser.id === adminUser.id ? req.sessionId : undefined;
  await getSessionRepository().deleteByUserId(targetUser.id, excludeToken);

  const auditService = getAuditService();
  await auditService.record({
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    action: 'ADMIN_PASSWORD_RESET',
    entityType: 'UserAccount',
    entityId: targetUser.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    stateDiff: {
      staffId: targetUser.profile.staffId,
      targetEmail: targetUser.email,
      method: 'ADMIN_RESET'
    }
  });

  res.status(200).json({
    success: true,
    message: 'Employee password reset successfully',
    data: {
      id: targetUser.profile.id,
      staffId: targetUser.profile.staffId
    }
  });
}

export async function getDirectReportsHandler(req: Request, res: Response): Promise<void> {
  const managerEmpId = req.params.id;
  const userRepo = getUserRepository();
  const subordinates = userRepo.findDirectReports(managerEmpId);

  res.status(200).json({
    success: true,
    data: subordinates
  });
}

export async function getHierarchyHandler(_req: Request, res: Response): Promise<void> {
  const userRepo = getUserRepository();
  const allUsers = (userRepo as any).store.getAll() as UserAccount[];

  const userMap = new Map<string, UserAccount>();
  const childrenMap = new Map<string, string[]>();

  for (const u of allUsers) {
    userMap.set(u.profile.id, u);
    userMap.set(u.id, u);
  }

  for (const u of allUsers) {
    if (u.profile.managerId) {
      const list = childrenMap.get(u.profile.managerId) || [];
      list.push(u.profile.id);
      childrenMap.set(u.profile.managerId, list);
    }
  }

  function buildNode(user: UserAccount, visited = new Set<string>()): OrgChartNode {
    if (visited.has(user.profile.id)) {
      return {
        id: user.profile.id,
        staffId: user.profile.staffId,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        email: user.email,
        department: user.profile.department,
        designation: user.profile.designation,
        role: user.role,
        avatarUrl: (user.profile as any).avatarUrl,
        directReportsCount: 0,
        subordinates: []
      };
    }

    visited.add(user.profile.id);
    const childIds = childrenMap.get(user.profile.id) || [];
    const subordinates: OrgChartNode[] = [];

    for (const cId of childIds) {
      const childUser = userMap.get(cId);
      if (childUser && childUser.status !== 'TERMINATED') {
        subordinates.push(buildNode(childUser, new Set(visited)));
      }
    }

    return {
      id: user.profile.id,
      staffId: user.profile.staffId,
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      email: user.email,
      department: user.profile.department,
      designation: user.profile.designation,
      role: user.role,
      avatarUrl: (user.profile as any).avatarUrl,
      directReportsCount: subordinates.length,
      subordinates
    };
  }

  // Root nodes are users who have no manager, or their manager is not in userMap
  const rootUsers = allUsers.filter(u => {
    if (u.status === 'TERMINATED') return false;
    if (!u.profile.managerId) return true;
    return !userMap.has(u.profile.managerId);
  });

  const hierarchy: OrgChartNode[] = rootUsers.map(u => buildNode(u));

  res.status(200).json({
    success: true,
    data: hierarchy
  });
}
