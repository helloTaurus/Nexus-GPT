export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'TERMINATED';
export type EmploymentType = 'FULL_TIME' | 'CONTRACT' | 'PROBATION' | 'INTERN';

export interface EmployeeSummary {
  id: string; // emp-xxx
  userId?: string; // usr-xxx
  staffId: string; // NX-xxxx
  firstName: string;
  lastName: string;
  name?: string; // Derived firstName + lastName
  email?: string;
  phone?: string;
  departmentId: string;
  department: string;
  designationId: string;
  designation: string;
  managerId: string | null;
  managerName?: string;
  role: UserRole;
  status: UserStatus;
  hireDate: string;
  avatarUrl?: string;
}

export interface PaginatedEmployeesResponse {
  data: EmployeeSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface EmployeeQueryParams {
  search?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  designationId: string;
  managerId?: string | null;
  role?: UserRole;
  initialAnnualLeaveDays?: number;
  phone?: string;
  residentialAddress?: string;
  bankName?: string;
  bankAccountNumber?: string;
  password?: string;
}

export interface AuthUserSession {
  id: string;
  email: string;
  role: UserRole;
  profile: {
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    departmentId: string;
    department: string;
    designationId: string;
    designation: string;
    managerId: string | null;
    phone?: string;
    residentialAddress?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    employmentType?: EmploymentType;
    hireDate?: string;
    gender?: 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
    bvn?: string;
    nin?: string;
  };
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string | null;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
  residentialAddress?: string;
}

export interface OrgHierarchyNode {
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
  subordinates: OrgHierarchyNode[];
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  stateDiff: Record<string, unknown>;
  metadataDiff?: Record<string, unknown>;
  hash: string;
  previousHash: string;
}

export interface AuditLogFilterParams {
  search?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditIntegrityVerification {
  valid: boolean;
  compromisedId?: string;
  totalChecked: number;
  merkleRoot?: string;
  lastHash?: string;
  verifiedAt: string;
}

export interface AdminMetricsData {
  totalWorkforce: number;
  activeStaff: number;
  staffOnLeave: number;
  pendingLeavesCount: number;
  expenseQueueCount: number;
  expenseQueueTotalAmount: number;
  activeAppraisalCycle: {
    id: string;
    title: string;
    fiscalYear: number;
    completionRate: number;
  } | null;
  pendingReviewQueue: Array<{
    id: string;
    type: 'LEAVE' | 'EXPENSE';
    title: string;
    subtitle: string;
    amount?: number;
    days?: number;
    status: string;
    createdAt: string;
    link: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    timestamp: string;
    summary: string;
  }>;
}
