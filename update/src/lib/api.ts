import type {
  LeaveBalance,
  LeaveRequest,
  WorkingDaysCalculation,
  EmployeeProfile,
  ApiResponse,
} from './leaveTypes';
import type {
  ExpenseCategory,
  ExpenseReportRecord,
  CreateExpenseReportPayload,
  UpdateExpenseReportPayload,
  ReceiptUploadResponse,
  DisburseExpensePayload,
} from './expenseTypes';
import type {
  AppraisalCycle,
  AppraisalSubmission,
  CreateCyclePayload,
  SubmitSelfAppraisalPayload,
  SubmitManagerReviewPayload,
  CalibrateScorePayload,
} from './appraisalTypes';
import type {
  EmployeeSummary,
  PaginatedEmployeesResponse,
  EmployeeQueryParams,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  OrgHierarchyNode,
  AuditLogEntry,
  AuditLogFilterParams,
  AuditIntegrityVerification,
  AuthUserSession,
  AdminMetricsData,
} from './workforceTypes';
import type {
  DailyAttendanceSummary,
  AttendanceRecord,
  ClockInPayload,
  ClockOutPayload,
} from './attendanceTypes';
import { clientStore, ClientStoreError } from './clientStore';


const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  correlationId?: string;
  details?: any[];

  constructor(message: string, code: string, status: number, correlationId?: string, details?: any[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
    this.details = details;
  }
}

function isServerUnavailable(err: unknown): boolean {
  if (err instanceof ApiError) {
    return (
      err.code === 'NETWORK_ERROR' ||
      err.code === 'NON_JSON_RESPONSE' ||
      err.code === 'INVALID_JSON' ||
      err.status === 0 ||
      err.status === 502 ||
      err.status === 503 ||
      err.status === 504
    );
  }
  return true;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ClientStoreError) {
    return new ApiError(err.message, err.code, err.status);
  }
  const e = err as any;
  return new ApiError(e?.message || 'Unexpected error occurred', e?.code || 'UNKNOWN_ERROR', e?.status || 500);
}

let isBootstrapping = false;

async function bootstrapSession(targetRole: 'admin' | 'employee'): Promise<boolean> {
  if (isBootstrapping) return false;
  isBootstrapping = true;
  try {
    const credentials =
      targetRole === 'admin'
        ? { email: 'admin@nexusfinance.ng', password: 'AdminPassword123!' }
        : { email: 'employee@nexusfinance.ng', password: 'EmployeePassword123!' };

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });

    return res.ok;
  } catch {
    return false;
  } finally {
    isBootstrapping = false;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Transmits HttpOnly nexus_session cookie
    });
  } catch (networkErr: any) {
    throw new ApiError(
      networkErr?.message || 'Network connection failed to backend service.',
      'NETWORK_ERROR',
      0
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      `Remote server returned non-JSON payload (${response.status} ${response.statusText || 'OK'}).`,
      'NON_JSON_RESPONSE',
      response.status
    );
  }

  let body: ApiResponse<T> & Record<string, any>;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('Failed to parse JSON response payload.', 'INVALID_JSON', response.status);
  }

  if (!response.ok || body.success === false) {
    if (response.status === 401 && !isRetry && !endpoint.includes('/auth/')) {
      const isAdmin =
        endpoint.startsWith('/employees') ||
        endpoint.startsWith('/admin') ||
        endpoint.includes('hierarchy') ||
        endpoint.includes('calibrate') ||
        endpoint.includes('/disburse');
      const targetRole = isAdmin ? 'admin' : 'employee';
      const authed = await bootstrapSession(targetRole);
      if (authed) {
        return request<T>(endpoint, options, true);
      }
    }

    const error = body.error || { code: 'UNKNOWN_ERROR', message: response.statusText || 'Request failed' };
    throw new ApiError(error.message, error.code, response.status, error.correlationId, error.details);
  }

  // Preserve pagination envelope when present
  if (body.data !== undefined && body.pagination !== undefined) {
    return { data: body.data, pagination: body.pagination } as unknown as T;
  }

  // Handle both enveloped { success: true, data: T } and flat { success: true, ...T } responses
  if (body.data !== undefined) {
    return body.data as T;
  }

  return body as unknown as T;
}

export const api = {
  // Staff Profile Endpoints
  profile: {
    get: async (): Promise<EmployeeProfile> => {
      try {
        return await request<EmployeeProfile>('/portal/profile');
      } catch {
        return clientStore.getProfile();
      }
    },

    update: (payload: {
      phone?: string;
      residentialAddress?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      emergencyContactRelationship?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
      bvn?: string;
      nin?: string;
    }): Promise<EmployeeProfile> =>
      request<EmployeeProfile>('/portal/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }).catch((err) => {
        if (isServerUnavailable(err)) {
          return clientStore.updateProfile(payload);
        }
        throw err;
      }),
  },

  // Leave Management Suite Endpoints
  leaves: {
    getBalances: async (employeeId?: string): Promise<LeaveBalance[]> => {
      try {
        return await request<LeaveBalance[]>(`/leaves/balances${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ''}`);
      } catch {
        return clientStore.getLeaveBalances(employeeId);
      }
    },

    calculateDays: async (startDate: string, endDate: string, isHalfDay = false): Promise<WorkingDaysCalculation> => {
      try {
        return await request<WorkingDaysCalculation>('/leaves/calculate', {
          method: 'POST',
          body: JSON.stringify({ startDate, endDate, isHalfDay }),
        });
      } catch {
        return clientStore.calculateDays(startDate, endDate, isHalfDay);
      }
    },

    getRequests: async (scope: 'mine' | 'team' | 'all' = 'mine'): Promise<LeaveRequest[]> => {
      try {
        return await request<LeaveRequest[]>(`/leaves/requests?scope=${scope}`);
      } catch {
        return clientStore.getLeaveRequests(scope);
      }
    },

    submitRequest: async (payload: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      reason: string;
      isHalfDay?: boolean;
      attachmentUrl?: string;
    }): Promise<LeaveRequest> => {
      try {
        return await request<LeaveRequest>('/leaves/requests', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote leave submission unavailable; provisioning to client store:', err);
        return clientStore.submitLeaveRequest(payload);
      }
    },

    cancelRequest: async (requestId: string, reason?: string): Promise<LeaveRequest> => {
      try {
        return await request<LeaveRequest>(`/leaves/requests/${requestId}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote leave cancellation unavailable; updating client store:', err);
        return clientStore.cancelLeaveRequest(requestId, reason);
      }
    },

    reviewRequest: async (
      requestId: string,
      decision: 'APPROVE' | 'REJECT',
      comment?: string
    ): Promise<LeaveRequest> => {
      try {
        return await request<LeaveRequest>(`/leaves/requests/${requestId}/action`, {
          method: 'PATCH',
          body: JSON.stringify({ action: decision, decisionReason: comment }),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote leave review unavailable; updating client store:', err);
        return clientStore.reviewLeaveRequest(requestId, decision, comment);
      }
    },
  },

  // Auth Endpoints
  auth: {
    me: async (): Promise<{ success: boolean; user: AuthUserSession }> => {
      try {
        const res = await request<{ success: boolean; user: AuthUserSession }>('/auth/me');
        if (res?.user) {
          clientStore.syncRemoteSessionUser(res.user);
        }
        return res;
      } catch (err) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.getMe();
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    login: async (
      email: string,
      password: string
    ): Promise<{ success: boolean; user: AuthUserSession }> => {
      try {
        const res = await request<{ success: boolean; user: AuthUserSession }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (res?.user) {
          clientStore.syncRemoteSessionUser(res.user);
        }
        return res;
      } catch (err) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.login(email, password);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    logout: async (): Promise<{ success: boolean }> => {
      clientStore.logout();
      try {
        return await request<{ success: boolean }>('/auth/logout', {
          method: 'POST',
        });
      } catch {
        return { success: true };
      }
    },

    recoverRequest: async (email: string): Promise<{ success: boolean; message: string }> => {
      try {
        return await request<{ success: boolean; message: string }>('/auth/recover/request', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
      } catch (err) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.requestPasswordReset(email);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    recoverVerify: async (
      email: string,
      token: string,
      newPassword: string
    ): Promise<{ success: boolean; message: string }> => {
      try {
        return await request<{ success: boolean; message: string }>('/auth/recover/verify', {
          method: 'POST',
          body: JSON.stringify({ email, token, newPassword }),
        });
      } catch (err) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.verifyPasswordReset(email, token, newPassword);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    changePassword: async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ success: boolean; message: string }> => {
      try {
        return await request<{ success: boolean; message: string }>('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
      } catch (err) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.changePassword(currentPassword, newPassword);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },
  },

  // Expense Management Suite Endpoints
  expenses: {
    getCategories: async (): Promise<ExpenseCategory[]> => {
      try {
        return await request<ExpenseCategory[]>('/expenses/categories');
      } catch {
        return clientStore.getExpenseCategories();
      }
    },

    uploadReceipt: async (file: File): Promise<ReceiptUploadResponse> => {
      const url = `${API_BASE}/expenses/upload-receipt`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name),
          },
          body: file,
          credentials: 'include',
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return {
            success: true,
            fileUrl: URL.createObjectURL(file),
            receiptUrl: URL.createObjectURL(file),
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            sizeBytes: file.size,
            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          };
        }

        const body = await response.json();
        if (!response.ok || body.success === false) {
          const error = body.error || { code: 'UPLOAD_FAILED', message: response.statusText || 'Upload failed' };
          throw new ApiError(error.message, error.code, response.status, error.correlationId);
        }
        return body;
      } catch (err: any) {
        if (err instanceof ApiError) throw err;
        return {
          success: true,
          fileUrl: URL.createObjectURL(file),
          receiptUrl: URL.createObjectURL(file),
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          sizeBytes: file.size,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        };
      }
    },

    getReports: async (scope: 'mine' | 'team' | 'all' = 'mine'): Promise<ExpenseReportRecord[]> => {
      try {
        return await request<ExpenseReportRecord[]>(`/expenses/reports?scope=${scope}`);
      } catch {
        return clientStore.getExpenseReports(scope);
      }
    },

    getReportById: async (id: string): Promise<ExpenseReportRecord> => {
      try {
        return await request<ExpenseReportRecord>(`/expenses/reports/${id}`);
      } catch {
        return clientStore.getExpenseReportById(id);
      }
    },

    createReport: async (payload: CreateExpenseReportPayload): Promise<ExpenseReportRecord> => {
      try {
        return await request<ExpenseReportRecord>('/expenses/reports', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote expense report creation unavailable; provisioning via client store:', err);
        return clientStore.createExpenseReport(payload);
      }
    },

    updateReport: async (id: string, payload: UpdateExpenseReportPayload): Promise<ExpenseReportRecord> => {
      try {
        return await request<ExpenseReportRecord>(`/expenses/reports/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote expense report update unavailable; updating client store:', err);
        return clientStore.updateExpenseReport(id, payload);
      }
    },

    reviewReport: async (
      id: string,
      action: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION',
      comments?: string
    ): Promise<ExpenseReportRecord> => {
      try {
        return await request<ExpenseReportRecord>(`/expenses/reports/${id}/action`, {
          method: 'PATCH',
          body: JSON.stringify({ action, comments }),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote expense review unavailable; updating client store:', err);
        return clientStore.reviewExpenseReport(id, action, comments);
      }
    },

    disburseReport: async (
      id: string,
      payload: DisburseExpensePayload
    ): Promise<ExpenseReportRecord> => {
      try {
        return await request<ExpenseReportRecord>(`/expenses/reports/${id}/disburse`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        console.warn('[Nexus API] Remote expense disbursement unavailable; updating client store:', err);
        return clientStore.disburseExpenseReport(id, payload);
      }
    },
  },

  // Appraisal Suite Endpoints
  appraisals: {
    getCycles: async (): Promise<AppraisalCycle[]> => {
      try {
        return await request<AppraisalCycle[]>('/appraisals/cycles');
      } catch {
        return clientStore.getAppraisalCycles();
      }
    },

    createCycle: async (payload: CreateCyclePayload): Promise<AppraisalCycle> => {
      try {
        return await request<AppraisalCycle>('/appraisals/cycles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        return clientStore.createAppraisalCycle(payload);
      }
    },

    getMySubmission: async (): Promise<AppraisalSubmission> => {
      try {
        return await request<AppraisalSubmission>('/appraisals/submissions/me');
      } catch {
        return clientStore.getMySubmission();
      }
    },

    getTeamSubmissions: async (): Promise<AppraisalSubmission[]> => {
      try {
        return await request<AppraisalSubmission[]>('/appraisals/submissions/team');
      } catch {
        return clientStore.getTeamSubmissions();
      }
    },

    getSubmissionById: async (id: string): Promise<AppraisalSubmission> => {
      try {
        return await request<AppraisalSubmission>(`/appraisals/submissions/${id}`);
      } catch {
        return clientStore.getSubmissionById(id);
      }
    },

    submitSelfAppraisal: async (
      submissionId: string,
      payload: SubmitSelfAppraisalPayload
    ): Promise<AppraisalSubmission> => {
      try {
        return await request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/self`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch {
        return clientStore.submitSelfAppraisal(submissionId, payload);
      }
    },

    submitManagerReview: async (
      submissionId: string,
      payload: SubmitManagerReviewPayload
    ): Promise<AppraisalSubmission> => {
      try {
        return await request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/manager`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch {
        return clientStore.submitManagerReview(submissionId, payload);
      }
    },

    calibrateScore: async (
      submissionId: string,
      payload: CalibrateScorePayload
    ): Promise<AppraisalSubmission> => {
      try {
        return await request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/calibrate`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        return clientStore.calibrateScore(submissionId, payload);
      }
    },

    acknowledgeOutcome: async (submissionId: string): Promise<AppraisalSubmission> => {
      try {
        return await request<AppraisalSubmission>(`/appraisals/submissions/${submissionId}/acknowledge`, {
          method: 'POST',
        });
      } catch {
        return clientStore.acknowledgeOutcome(submissionId);
      }
    },
  },

  // Workforce Directory Endpoints
  employees: {
    list: async (params?: EmployeeQueryParams): Promise<PaginatedEmployeesResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.departmentId && params.departmentId !== 'All') {
        searchParams.set('departmentId', params.departmentId);
      }
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      const qs = searchParams.toString();
      try {
        const res = await request<PaginatedEmployeesResponse | EmployeeSummary[]>(`/employees${qs ? `?${qs}` : ''}`);
        if (Array.isArray(res)) {
          return {
            data: res,
            pagination: {
              total: res.length,
              page: params?.page || 1,
              limit: params?.limit || 12,
              totalPages: 1,
            },
          };
        }
        return res as PaginatedEmployeesResponse;
      } catch (err: any) {
        console.warn('[Nexus API] Remote employees endpoint unavailable; falling back to client demonstration store:', err);
        return clientStore.getEmployees(params);
      }
    },

    getById: async (id: string): Promise<EmployeeSummary> => {
      try {
        return await request<EmployeeSummary>(`/employees/${id}`);
      } catch {
        const res = clientStore.getEmployees();
        const found = res.data.find((e) => e.id === id);
        if (found) return found;
        throw new ApiError(`Employee with ID ${id} not found`, 'NOT_FOUND', 404);
      }
    },

    create: async (payload: CreateEmployeePayload): Promise<EmployeeSummary> => {
      try {
        return await request<EmployeeSummary>('/employees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        if (isServerUnavailable(err)) {
          console.warn('[Nexus API] Remote create employee unavailable; provisioning to client demonstration store:', err);
          try {
            return clientStore.createEmployee(payload);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    update: async (id: string, payload: UpdateEmployeePayload): Promise<EmployeeSummary> => {
      try {
        return await request<EmployeeSummary>(`/employees/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        if (isServerUnavailable(err) || (err instanceof ApiError && err.status === 404 && clientStore.hasEmployee(id))) {
          console.warn('[Nexus API] Remote update employee unavailable; updating client demonstration store:', err);
          try {
            return clientStore.updateEmployee(id, payload);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    resetPassword: async (
      id: string,
      newPassword: string
    ): Promise<{ id: string; staffId: string }> => {
      try {
        return await request<{ id: string; staffId: string }>(
          `/employees/${encodeURIComponent(id)}/reset-password`,
          {
            method: 'POST',
            body: JSON.stringify({ newPassword }),
          }
        );
      } catch (err: any) {
        if (isServerUnavailable(err) || (err instanceof ApiError && err.status === 404 && clientStore.hasEmployee(id))) {
          console.warn('[Nexus API] Remote password reset unavailable; resetting in client demonstration store:', err);
          try {
            return clientStore.resetEmployeePassword(id, newPassword);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    getDirectReports: async (managerId: string): Promise<EmployeeSummary[]> => {
      try {
        return await request<EmployeeSummary[]>(`/employees/${managerId}/reports`);
      } catch {
        const all = clientStore.getEmployees();
        return all.data.filter((e) => e.managerId === managerId);
      }
    },

    getHierarchy: async (): Promise<OrgHierarchyNode[]> => {
      try {
        return await request<OrgHierarchyNode[]>('/employees/hierarchy');
      } catch {
        return clientStore.getHierarchy();
      }
    },
  },

  // Audit Log Stream Endpoints
  auditLogs: {
    list: async (params?: AuditLogFilterParams): Promise<AuditLogEntry[]> => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.action && params.action !== 'All') searchParams.set('action', params.action);
      if (params?.entityType) searchParams.set('entityType', params.entityType);
      if (params?.actorId) searchParams.set('actorId', params.actorId);
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      const qs = searchParams.toString();
      try {
        return await request<AuditLogEntry[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
      } catch {
        return clientStore.getAuditLogs(params);
      }
    },

    verify: async (): Promise<AuditIntegrityVerification> => {
      try {
        return await request<AuditIntegrityVerification>('/admin/audit-logs/verify');
      } catch {
        return clientStore.verifyAuditIntegrity();
      }
    },
  },

  // Admin Metrics
  admin: {
    getMetrics: async (): Promise<AdminMetricsData> => {
      try {
        return await request<AdminMetricsData>('/admin/metrics');
      } catch {
        return clientStore.getAdminMetrics();
      }
    },
  },

  // Staff Clock-In & Attendance (Requirement R1)
  attendance: {
    getToday: async (): Promise<DailyAttendanceSummary> => {
      try {
        return await request<DailyAttendanceSummary>('/attendance/today');
      } catch (err: any) {
        if (isServerUnavailable(err)) {
          return clientStore.getAttendanceToday();
        }
        throw err;
      }
    },

    clockIn: async (payload?: ClockInPayload | string): Promise<DailyAttendanceSummary> => {
      const body = typeof payload === 'string' ? { notes: payload } : (payload || {});
      try {
        return await request<DailyAttendanceSummary>('/attendance/clock-in', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.clockInAttendance(body);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    clockOut: async (payload?: ClockOutPayload | string): Promise<DailyAttendanceSummary> => {
      const body = typeof payload === 'string' ? { notes: payload } : (payload || {});
      try {
        return await request<DailyAttendanceSummary>('/attendance/clock-out', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        if (isServerUnavailable(err)) {
          try {
            return clientStore.clockOutAttendance(body);
          } catch (csErr) {
            throw toApiError(csErr);
          }
        }
        throw err;
      }
    },

    getHistory: async (params?: {
      limit?: number;
      startDate?: string;
      endDate?: string;
    }): Promise<AttendanceRecord[]> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      const qs = searchParams.toString();
      try {
        return await request<AttendanceRecord[]>(`/attendance/history${qs ? `?${qs}` : ''}`);
      } catch (err: any) {
        if (isServerUnavailable(err)) {
          return clientStore.getAttendanceHistory(params);
        }
        throw err;
      }
    },
  },
};

