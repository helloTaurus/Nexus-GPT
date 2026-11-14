import React, { useState, useEffect, useMemo } from 'react';
import {
  UsersThree,
  Plus,
  MagnifyingGlass,
  Funnel,
  PencilSimple,
  CheckCircle,
  X,
  ShieldCheck,
  Table,
  SquaresFour,
  TreeStructure,
  Lock,
  LockOpen,
  EnvelopeSimple,
  Phone,
  WarningCircle,
  CaretDown,
  CaretRight,
  Key,
  Eye,
  EyeSlash,
  Copy,
  ArrowsClockwise
} from '@phosphor-icons/react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type {
  EmployeeSummary,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  OrgHierarchyNode,
  UserRole,
  UserStatus
} from '../../lib/workforceTypes';

export interface EmployeeDirectoryPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const EmployeeDirectoryPage: React.FC<EmployeeDirectoryPageProps> = ({
  currentPath = '/admin/employees',
  onNavigate,
}) => {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [hierarchy, setHierarchy] = useState<OrgHierarchyNode[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS' | 'TREE'>('TABLE');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeSummary | null>(null);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<EmployeeSummary | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [showOnboardingPassword, setShowOnboardingPassword] = useState(false);

  // Admin Reset Password Modal State
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminNewPassword, setShowAdminNewPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [copiedTempPass, setCopiedTempPass] = useState(false);

  // Expanded nodes for Tree View
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // New Employee Form State
  const [newEmployee, setNewEmployee] = useState<CreateEmployeePayload>({
    firstName: '',
    lastName: '',
    email: '',
    departmentId: 'dept-cru',
    designationId: 'des-ra',
    managerId: null,
    role: 'EMPLOYEE',
    initialAnnualLeaveDays: 20.0,
    phone: '+2348000000000',
    residentialAddress: 'Victoria Island, Lagos',
    bankName: 'Zenith Bank',
    bankAccountNumber: '0123456789',
    password: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Department definitions
  const departments = [
    { id: 'All', name: 'All Departments' },
    { id: 'dept-cru', name: 'Credit Risk & Underwriting' },
    { id: 'dept-exec', name: 'Executive Governance' },
    { id: 'dept-ops', name: 'Operations & Service' },
    { id: 'dept-eng', name: 'Engineering & Technology' },
    { id: 'dept-fin', name: 'Finance & Accounts' },
  ];

  // Fetch employees
  const loadEmployees = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.employees.list({
        search: search.trim() || undefined,
        departmentId: selectedDept !== 'All' ? selectedDept : undefined,
        page,
        limit,
      });

      if (Array.isArray(res)) {
        setEmployees(res);
        setTotalCount(res.length);
      } else if (res && Array.isArray(res.data)) {
        setEmployees(res.data);
        setTotalCount(res.pagination?.total ?? res.data.length);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // Fetch hierarchy tree
  const loadHierarchy = async () => {
    try {
      const tree = await api.employees.getHierarchy();
      if (Array.isArray(tree)) {
        setHierarchy(tree);
        // Expand root nodes by default
        const initialExpanded: Record<string, boolean> = {};
        for (const root of tree) {
          initialExpanded[root.id] = true;
        }
        setExpandedNodes(initialExpanded);
      }
    } catch {
      // Hierarchy endpoint fallback
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [search, selectedDept, page]);

  useEffect(() => {
    if (viewMode === 'TREE') {
      loadHierarchy();
    }
  }, [viewMode]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedPass = (newEmployee.password || '').trim();
    if (trimmedPass.length > 0 && trimmedPass.length < 8) {
      setAddModalError('Initial portal password must be at least 8 characters long.');
      return;
    }

    setIsCreating(true);
    try {
      const payload: CreateEmployeePayload = {
        ...newEmployee,
        email: newEmployee.email.trim().toLowerCase(),
      };
      if (trimmedPass) {
        payload.password = trimmedPass;
      } else {
        delete payload.password;
      }

      const created = await api.employees.create(payload);
      setIsAddModalOpen(false);
      setShowOnboardingPassword(false);
      setNewEmployee({
        firstName: '',
        lastName: '',
        email: '',
        departmentId: 'dept-cru',
        designationId: 'des-ra',
        managerId: null,
        role: 'EMPLOYEE',
        initialAnnualLeaveDays: 20.0,
        phone: '+2348000000000',
        residentialAddress: 'Victoria Island, Lagos',
        bankName: 'Zenith Bank',
        bankAccountNumber: '0123456789',
        password: '',
      });
      if (created) {
        setEmployees((prev) => [created, ...prev.filter((empItem) => empItem.id !== created.id)]);
        setTotalCount((prev) => prev + 1);
        setSuccessMsg(
          trimmedPass
            ? `Onboarded ${created.firstName} ${created.lastName} (${created.staffId}) with the configured initial portal password.`
            : `Onboarded ${created.firstName} ${created.lastName} (${created.staffId}). Default portal password is TemporaryPass123! until updated by the user or an Admin.`
        );
      }
      loadEmployees();
      if (viewMode === 'TREE') loadHierarchy();
    } catch (err: any) {
      setAddModalError(err.message || 'Failed to onboard employee');
    } finally {
      setIsCreating(false);
    }
  };

  const openResetPasswordModal = (emp: EmployeeSummary) => {
    setResetPasswordEmployee(emp);
    setAdminNewPassword('');
    setAdminConfirmPassword('');
    setShowAdminNewPassword(false);
    setShowAdminConfirmPassword(false);
    setResetModalError(null);
    setCopiedTempPass(false);
  };

  const closeResetPasswordModal = () => {
    setResetPasswordEmployee(null);
    setAdminNewPassword('');
    setAdminConfirmPassword('');
    setShowAdminNewPassword(false);
    setShowAdminConfirmPassword(false);
    setResetModalError(null);
    setCopiedTempPass(false);
  };

  const generateSecureTempPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const pool = upper + lower + digits + symbols;
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    const chars = [
      upper[bytes[0] % upper.length],
      lower[bytes[1] % lower.length],
      digits[bytes[2] % digits.length],
      symbols[bytes[3] % symbols.length],
    ];
    for (let i = 4; i < 12; i++) {
      chars.push(pool[bytes[i] % pool.length]);
    }
    const shuffleBytes = new Uint32Array(chars.length);
    crypto.getRandomValues(shuffleBytes);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = shuffleBytes[i] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const generated = chars.join('');
    setAdminNewPassword(generated);
    setAdminConfirmPassword(generated);
    setShowAdminNewPassword(true);
    setShowAdminConfirmPassword(true);
    setResetModalError(null);
    setCopiedTempPass(false);
  };

  const handleCopyTempPassword = async () => {
    if (!adminNewPassword) return;
    try {
      await navigator.clipboard.writeText(adminNewPassword);
      setCopiedTempPass(true);
      setTimeout(() => setCopiedTempPass(false), 2500);
    } catch {
      // ignore clipboard permission denied in restricted frames
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordEmployee) return;
    setResetModalError(null);

    if (adminNewPassword.length < 8) {
      setResetModalError('New password must be at least 8 characters long.');
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setResetModalError('Password confirmation does not match the new password.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const target = resetPasswordEmployee;
      await api.employees.resetPassword(target.id, adminNewPassword);
      closeResetPasswordModal();
      setSuccessMsg(
        `Password reset for ${target.firstName} ${target.lastName} (${target.staffId}) and all prior active sessions were revoked.`
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        setResetModalError(err.correlationId ? `${err.message} (${err.correlationId})` : err.message);
      } else {
        setResetModalError(err?.message || 'Failed to reset employee password.');
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await api.employees.update(editingEmployee.id, {
        departmentId: editingEmployee.departmentId,
        designationId: editingEmployee.designationId,
        managerId: editingEmployee.managerId,
        role: editingEmployee.role,
        status: editingEmployee.status,
      });
      setEditingEmployee(null);
      loadEmployees();
      if (viewMode === 'TREE') loadHierarchy();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update employee');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (emp: EmployeeSummary) => {
    const nextStatus: UserStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.employees.update(emp.id, { status: nextStatus });
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: nextStatus } : e))
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to toggle account status');
    }
  };

  const toggleNodeExpanded = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Recursive Tree Node Component
  const renderTreeNode = (node: OrgHierarchyNode, depth = 0) => {
    const isExpanded = Boolean(expandedNodes[node.id]);
    const hasChildren = node.subordinates && node.subordinates.length > 0;

    return (
      <div key={node.id} className="select-none font-sans" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="flex items-center gap-3 py-2 px-3 my-1 rounded-[7px] bg-subtle/60 hover:bg-subtle border border-rule transition-colors">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNodeExpanded(node.id)}
              className="p-1 rounded text-muted hover:text-brand cursor-pointer"
            >
              {isExpanded ? <CaretDown className="w-4 h-4" /> : <CaretRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div className="w-8 h-8 rounded-full bg-accent-soft text-brand font-bold text-xs flex items-center justify-center shrink-0">
            {node.firstName[0]}
            {node.lastName[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-ink truncate">
                {node.firstName} {node.lastName}
              </span>
              <span className="text-[10px] font-mono-nums text-muted">{node.staffId}</span>
              <span
                className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                  node.role === 'ADMIN'
                    ? 'bg-accent-soft text-brand border border-brand/30'
                    : node.role === 'MANAGER'
                    ? 'bg-[#FFF8E6] text-[#865600]'
                    : 'bg-subtle text-muted border border-rule'
                }`}
              >
                {node.role}
              </span>
            </div>
            <div className="text-[11px] text-muted truncate">
              {node.designation} &bull; {node.department}
            </div>
          </div>

          {hasChildren && (
            <Badge variant="brand" size="sm">
              {node.subordinates.length} Direct Report{node.subordinates.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l-2 border-brand/20 ml-3 pl-1">
            {node.subordinates.map((sub) => renderTreeNode(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout currentPath={currentPath} onNavigate={onNavigate}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Workforce Directory &amp; RBAC
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Manage employee records, organizational departments, and three-tier role-based access permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="md">
            Total Staff: {totalCount}
          </Badge>
          <Button
            variant="primary"
            onClick={() => {
              setErrorMsg(null);
              setAddModalError(null);
              setSuccessMsg(null);
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Employee
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] text-xs font-medium flex items-center justify-between gap-2 border border-[#007B58]/30">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" weight="fill" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-[7px] bg-[#FFEDEF] text-[#B52F38] text-xs font-medium flex items-center gap-2 border border-[#FFACA9]">
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Interactive Department Pills Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {departments.map((dept) => {
          const isActive = selectedDept === dept.id;
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => {
                setSelectedDept(dept.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-[7px] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer select-none ${
                isActive
                  ? 'bg-action text-on-action shadow-sm'
                  : 'bg-subtle text-muted hover:text-ink hover:bg-accent-soft border border-rule'
              }`}
            >
              {dept.name}
            </button>
          );
        })}
      </div>

      {/* Filter, Search & View Toggle Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <MagnifyingGlass className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by staff name, ID, or corporate email..."
            className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 pl-9 pr-3.5 py-2 text-xs sm:text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          />
        </div>

        {/* View Mode Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-[7px] bg-subtle border border-rule self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            className={`p-1.5 rounded-[5px] text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'TABLE' ? 'bg-surface text-brand font-semibold shadow-xs' : 'text-muted hover:text-ink'
            }`}
            title="Table View"
          >
            <Table className="w-4 h-4" />
            <span className="hidden md:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CARDS')}
            className={`p-1.5 rounded-[5px] text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'CARDS' ? 'bg-surface text-brand font-semibold shadow-xs' : 'text-muted hover:text-ink'
            }`}
            title="Card Grid View"
          >
            <SquaresFour className="w-4 h-4" />
            <span className="hidden md:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('TREE')}
            className={`p-1.5 rounded-[5px] text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'TREE' ? 'bg-surface text-brand font-semibold shadow-xs' : 'text-muted hover:text-ink'
            }`}
            title="Org Hierarchy Tree"
          >
            <TreeStructure className="w-4 h-4" />
            <span className="hidden md:inline">Org Chart</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'TABLE' && (
        <Card variant="surface" padding="none">
          <div className="p-6 border-b border-rule flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
              <UsersThree className="w-4 h-4 text-brand" />
              <span>Employee Directory Ledger</span>
            </h3>
            <span className="text-xs text-muted font-mono-nums">
              Showing {employees.length} of {totalCount} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-subtle text-muted uppercase text-[10px] tracking-wider border-b border-rule">
                <tr>
                  <th className="py-3 px-6 font-semibold">Staff Member</th>
                  <th className="py-3 px-6 font-semibold">Staff ID</th>
                  <th className="py-3 px-6 font-semibold">Department</th>
                  <th className="py-3 px-6 font-semibold">Designation</th>
                  <th className="py-3 px-6 font-semibold">System RBAC</th>
                  <th className="py-3 px-6 font-semibold">Status</th>
                  <th className="py-3 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-ink">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted">
                      No employees found matching the active criteria.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent-soft text-brand font-bold text-xs flex items-center justify-center shrink-0">
                            {emp.firstName?.[0] || 'E'}
                            {emp.lastName?.[0] || ''}
                          </div>
                          <div>
                            <div className="font-semibold text-ink">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-[11px] text-muted">{emp.email || `${emp.staffId.toLowerCase()}@nexusfinance.ng`}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono-nums font-semibold text-brand">
                        {emp.staffId}
                      </td>
                      <td className="py-3.5 px-6">{emp.department}</td>
                      <td className="py-3.5 px-6 text-muted">{emp.designation}</td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                            emp.role === 'ADMIN'
                              ? 'bg-accent-soft text-brand border border-brand/30'
                              : emp.role === 'MANAGER'
                              ? 'bg-[#FFF8E6] text-[#865600]'
                              : 'bg-subtle text-muted border border-rule'
                          }`}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <Badge variant={emp.status === 'ACTIVE' ? 'approved' : 'rejected'} size="sm">
                          {emp.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(emp)}
                            className="p-1.5 rounded-[7px] text-muted hover:text-brand hover:bg-subtle transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openResetPasswordModal(emp)}
                            className="p-1.5 rounded-[7px] text-muted hover:text-brand hover:bg-subtle transition-colors cursor-pointer"
                            title="Reset Employee Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(emp)}
                            className="p-1.5 rounded-[7px] text-muted hover:text-brand hover:bg-subtle transition-colors cursor-pointer"
                            title={emp.status === 'ACTIVE' ? 'Deactivate Account' : 'Reactivate Account'}
                          >
                            {emp.status === 'ACTIVE' ? (
                              <Lock className="w-4 h-4 text-amber-600" />
                            ) : (
                              <LockOpen className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-rule flex items-center justify-between text-xs font-sans">
              <span className="text-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* View 2: Card Grid View */}
      {viewMode === 'CARDS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map((emp) => (
            <Card key={emp.id} variant="surface" padding="md" className="flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-full bg-accent-soft text-brand font-bold text-sm flex items-center justify-center shrink-0">
                    {emp.firstName?.[0] || 'E'}
                    {emp.lastName?.[0] || ''}
                  </div>
                  <Badge variant={emp.status === 'ACTIVE' ? 'approved' : 'rejected'} size="sm">
                    {emp.status}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-ink font-display">
                    {emp.firstName} {emp.lastName}
                  </h4>
                  <div className="text-[11px] font-mono-nums text-brand font-semibold">{emp.staffId}</div>
                  <div className="text-xs text-muted mt-1">{emp.designation}</div>
                  <div className="text-[11px] text-muted">{emp.department}</div>
                </div>

                <div className="pt-2 border-t border-rule space-y-1 text-[11px] text-muted">
                  <div className="flex items-center gap-1.5 truncate">
                    <EnvelopeSimple className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{emp.email || `${emp.staffId.toLowerCase()}@nexusfinance.ng`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{emp.phone || '+2348000000000'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between">
                <span
                  className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                    emp.role === 'ADMIN'
                      ? 'bg-accent-soft text-brand'
                      : emp.role === 'MANAGER'
                      ? 'bg-[#FFF8E6] text-[#865600]'
                      : 'bg-subtle text-muted'
                  }`}
                >
                  {emp.role}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openResetPasswordModal(emp)}>
                    Reset PW
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingEmployee(emp)}>
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View 3: Org Hierarchy Tree View */}
      {viewMode === 'TREE' && (
        <Card variant="surface" padding="md">
          <div className="mb-4 pb-3 border-b border-rule flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
                <TreeStructure className="w-5 h-5 text-brand" />
                <span>Organizational Reporting Hierarchy</span>
              </h3>
              <p className="text-xs text-muted">
                Executive governance DAG tree. Click expandable nodes to inspect direct reporting subtrees.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadHierarchy}>
              Refresh Hierarchy
            </Button>
          </div>

          <div className="space-y-1">
            {hierarchy.length === 0 ? (
              <div className="py-8 text-center text-muted text-xs">
                Loading organizational chart hierarchy...
              </div>
            ) : (
              hierarchy.map((root) => renderTreeNode(root, 0))
            )}
          </div>
        </Card>
      )}

      {/* Add Employee Provisioning Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddModalError(null);
          setShowOnboardingPassword(false);
        }}
        title="Onboard New Employee Record"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-xs font-sans">
          {addModalError && (
            <div className="p-3 rounded-[7px] bg-[#FFEDEF] text-[#B52F38] text-xs font-medium flex items-center gap-2 border border-[#FFACA9]">
              <WarningCircle className="w-4 h-4 shrink-0" />
              <span>{addModalError}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">First Name</label>
              <Input
                value={newEmployee.firstName}
                onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="font-semibold text-ink block mb-1">Last Name</label>
              <Input
                value={newEmployee.lastName}
                onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">Corporate Email Address</label>
            <Input
              type="email"
              placeholder="e.g. employee@nexusfinance.ng"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Department</label>
              <select
                value={newEmployee.departmentId}
                onChange={(e) => setNewEmployee({ ...newEmployee, departmentId: e.target.value })}
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
              >
                <option value="dept-cru">Credit Risk &amp; Underwriting</option>
                <option value="dept-exec">Executive Governance</option>
                <option value="dept-ops">Operations &amp; Service</option>
                <option value="dept-eng">Engineering &amp; Technology</option>
                <option value="dept-fin">Finance &amp; Accounts</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Designation</label>
              <select
                value={newEmployee.designationId}
                onChange={(e) => setNewEmployee({ ...newEmployee, designationId: e.target.value })}
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
              >
                <option value="des-ra">Risk Analyst</option>
                <option value="des-cu">Credit Underwriter</option>
                <option value="des-se">Software Engineer</option>
                <option value="des-em">Engineering Manager</option>
                <option value="des-cso">Chief Service Officer</option>
                <option value="des-cro">Chief Risk Officer</option>
                <option value="des-md">Managing Director &amp; CEO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">System RBAC Role</label>
              <select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as any })}
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
              >
                <option value="EMPLOYEE">Employee (Self-Service)</option>
                <option value="MANAGER">Manager (Approval Queue)</option>
                <option value="ADMIN">Administrator (Full Access)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Initial Annual Leave (Days)</label>
              <Input
                type="number"
                value={newEmployee.initialAnnualLeaveDays}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, initialAnnualLeaveDays: parseFloat(e.target.value) || 20 })
                }
                min={0}
                max={60}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Bank Name</label>
              <Input
                value={newEmployee.bankName}
                onChange={(e) => setNewEmployee({ ...newEmployee, bankName: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold text-ink block mb-1">NUBAN Account (10 Digits)</label>
              <Input
                value={newEmployee.bankAccountNumber}
                onChange={(e) => setNewEmployee({ ...newEmployee, bankAccountNumber: e.target.value })}
                maxLength={10}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-ink block mb-1">
              Initial Portal Password <span className="text-muted font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <input
                type={showOnboardingPassword ? 'text' : 'password'}
                placeholder="Defaults to TemporaryPass123! if left blank"
                value={newEmployee.password || ''}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3 py-2 text-xs pr-9 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              />
              <button
                type="button"
                onClick={() => setShowOnboardingPassword(!showOnboardingPassword)}
                className="absolute right-2.5 top-2 text-muted hover:text-ink cursor-pointer"
                aria-label={showOnboardingPassword ? 'Hide initial password' : 'Show initial password'}
              >
                {showOnboardingPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Minimum 8 characters when specified. Staff can reset or change their password anytime via login OTP or My Profile.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-rule">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isCreating}>
              {isCreating ? 'Provisioning Account...' : 'Provision Staff Record'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <Modal
          isOpen={Boolean(editingEmployee)}
          onClose={() => setEditingEmployee(null)}
          title={`Edit Employee: ${editingEmployee.firstName} ${editingEmployee.lastName}`}
        >
          <form onSubmit={handleUpdateEmployee} className="space-y-3.5 text-xs font-sans">
            <div className="p-3 rounded-[7px] bg-subtle border border-rule text-xs space-y-1">
              <div className="font-semibold text-ink font-mono-nums">Staff ID: {editingEmployee.staffId}</div>
              <div className="text-muted">{editingEmployee.email}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-ink block mb-1">Department</label>
                <select
                  value={editingEmployee.departmentId}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, departmentId: e.target.value })}
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
                >
                  <option value="dept-cru">Credit Risk &amp; Underwriting</option>
                  <option value="dept-exec">Executive Governance</option>
                  <option value="dept-ops">Operations &amp; Service</option>
                  <option value="dept-eng">Engineering &amp; Technology</option>
                  <option value="dept-fin">Finance &amp; Accounts</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Designation</label>
                <select
                  value={editingEmployee.designationId}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, designationId: e.target.value })}
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
                >
                  <option value="des-ra">Risk Analyst</option>
                  <option value="des-cu">Credit Underwriter</option>
                  <option value="des-se">Software Engineer</option>
                  <option value="des-em">Engineering Manager</option>
                  <option value="des-cso">Chief Service Officer</option>
                  <option value="des-cro">Chief Risk Officer</option>
                  <option value="des-md">Managing Director &amp; CEO</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-ink block mb-1">RBAC Role</label>
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as any })}
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Account Status</label>
                <select
                  value={editingEmployee.status}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value as any })}
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="LOCKED">LOCKED</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-rule">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Key className="w-3.5 h-3.5" />}
                onClick={() => {
                  const target = editingEmployee;
                  setEditingEmployee(null);
                  openResetPasswordModal(target);
                }}
              >
                Reset Password
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditingEmployee(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isUpdating}>
                  {isUpdating ? 'Saving Changes...' : 'Save Employee Profile'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Admin Reset Employee Password Modal */}
      {resetPasswordEmployee && (
        <Modal
          isOpen={Boolean(resetPasswordEmployee)}
          onClose={closeResetPasswordModal}
          title={`Reset Password: ${resetPasswordEmployee.firstName} ${resetPasswordEmployee.lastName}`}
        >
          <form onSubmit={handleAdminResetPassword} className="space-y-3.5 text-xs font-sans">
            <div className="p-3 rounded-[7px] bg-subtle border border-rule text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink font-mono-nums">
                  Staff ID: {resetPasswordEmployee.staffId}
                </span>
                <span className="text-[10px] uppercase font-bold text-brand">
                  {resetPasswordEmployee.role}
                </span>
              </div>
              <div className="text-muted">
                {resetPasswordEmployee.email || `${resetPasswordEmployee.staffId.toLowerCase()}@nexusfinance.ng`}
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300 pt-1">
                Applying a new password will immediately revoke active sign-in sessions for this account.
              </div>
            </div>

            {resetModalError && (
              <div className="p-3 rounded-[7px] bg-[#FFEDEF] text-[#B52F38] text-xs font-medium flex items-center gap-2 border border-[#FFACA9]">
                <WarningCircle className="w-4 h-4 shrink-0" />
                <span>{resetModalError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-ink">New Password</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={generateSecureTempPassword}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    <ArrowsClockwise className="w-3 h-3" />
                    <span>Generate Secure</span>
                  </button>
                  {adminNewPassword && (
                    <button
                      type="button"
                      onClick={handleCopyTempPassword}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedTempPass ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  type={showAdminNewPassword ? 'text' : 'password'}
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3 py-2 text-xs pr-9 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminNewPassword(!showAdminNewPassword)}
                  className="absolute right-2.5 top-2 text-muted hover:text-ink cursor-pointer"
                  aria-label={showAdminNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showAdminNewPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showAdminConfirmPassword ? 'text' : 'password'}
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule hover:border-brand/40 px-3 py-2 text-xs pr-9 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminConfirmPassword(!showAdminConfirmPassword)}
                  className="absolute right-2.5 top-2 text-muted hover:text-ink cursor-pointer"
                  aria-label={showAdminConfirmPassword ? 'Hide confirmation' : 'Show confirmation'}
                >
                  {showAdminConfirmPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {adminConfirmPassword.length > 0 && adminConfirmPassword !== adminNewPassword && (
                <p className="text-[11px] text-danger mt-1 font-medium">Passwords do not match</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-rule">
              <Button variant="outline" onClick={closeResetPasswordModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isResettingPassword}
                leftIcon={<Key className="w-3.5 h-3.5" />}
              >
                {isResettingPassword ? 'Resetting Password...' : 'Confirm Password Reset'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
};
