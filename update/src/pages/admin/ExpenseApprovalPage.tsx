import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Check,
  X,
  CurrencyNgn,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  WarningCircle,
  ShieldCheck,
  ArrowRight,
  FilePdf,
  Image as ImageIcon,
  Buildings,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button, Card, Badge, Modal, Drawer, Input, Skeleton } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type {
  ExpenseReportRecord,
  ExpenseReportStatus,
} from '../../lib/expenseTypes';

export interface ExpenseApprovalPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const ExpenseApprovalPage: React.FC<ExpenseApprovalPageProps> = ({
  currentPath = '/admin/expense-approvals',
  onNavigate,
}) => {
  // Current user session
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [scope, setScope] = useState<'team' | 'all'>('team');
  const [statusFilter, setStatusFilter] = useState<
    'ACTION_REQUIRED' | 'PENDING' | 'READY_DISBURSE' | 'PAID' | 'REJECTED' | 'ALL'
  >('ACTION_REQUIRED');

  // Reports data
  const [reports, setReports] = useState<ExpenseReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inspection Drawer
  const [inspectingReport, setInspectingReport] = useState<ExpenseReportRecord | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Modals
  const [actionModalType, setActionModalType] = useState<
    'APPROVE' | 'REJECT' | 'REVISION' | 'DISBURSE' | null
  >(null);
  const [targetReport, setTargetReport] = useState<ExpenseReportRecord | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [disbursementRef, setDisbursementRef] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Load user profile & session
  useEffect(() => {
    api.auth
      .me()
      .then((res: any) => {
        const user = res.user || res.data?.user || res;
        setCurrentUser(user);
        if (user.role === 'ADMIN') {
          setScope('all');
        } else {
          setScope('team');
        }
      })
      .catch(() => {
        // Fallback user if me() fails in offline mode
        setCurrentUser({ id: 'emp-admin-01', role: 'ADMIN' });
      });
  }, []);

  // Fetch reports based on scope
  const fetchReports = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.expenses.getReports(scope);
      setReports(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve approval pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [scope]);

  // Current user ID for self-approval prohibition
  const currentUserId = currentUser?.profile?.id || currentUser?.id || '';
  const isAdminOrFinance = currentUser?.role === 'ADMIN';

  // Filtered reports list
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'ACTION_REQUIRED') {
        return ['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'APPROVED'].includes(
          r.status
        );
      }
      if (statusFilter === 'PENDING') {
        return ['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC'].includes(
          r.status
        );
      }
      if (statusFilter === 'READY_DISBURSE') return r.status === 'APPROVED';
      if (statusFilter === 'PAID') return r.status === 'PAID';
      if (statusFilter === 'REJECTED') {
        return r.status === 'REJECTED' || r.status === 'REVISION_REQUESTED';
      }
      return true;
    });
  }, [reports, statusFilter]);

  // Open action modal helper
  const openActionModal = (
    report: ExpenseReportRecord,
    type: 'APPROVE' | 'REJECT' | 'REVISION' | 'DISBURSE'
  ) => {
    setTargetReport(report);
    setActionModalType(type);
    setActionComments('');
    setModalError(null);
    if (type === 'DISBURSE') {
      setDisbursementRef(`NIBSS-ACH-${Date.now().toString().slice(-6)}`);
      setPaidDate(new Date().toISOString().split('T')[0]);
    }
  };

  // Execute approval / rejection / revision
  const handleExecuteReview = async () => {
    if (!targetReport || !actionModalType) return;

    if (actionModalType === 'REJECT' && !actionComments.trim()) {
      setModalError('A rejection reason is mandatory.');
      return;
    }
    if (actionModalType === 'REVISION' && !actionComments.trim()) {
      setModalError('Please specify the revisions required from the staff member.');
      return;
    }

    setIsProcessing(true);
    setModalError(null);

    try {
      const actionParam =
        actionModalType === 'APPROVE'
          ? 'APPROVE'
          : actionModalType === 'REJECT'
          ? 'REJECT'
          : 'REQUEST_REVISION';

      await api.expenses.reviewReport(targetReport.id, actionParam, actionComments.trim());

      setActionModalType(null);
      setTargetReport(null);
      if (inspectingReport && inspectingReport.id === targetReport.id) {
        setInspectingReport(null);
      }
      await fetchReports();
    } catch (err: any) {
      setModalError(err.message || 'Review action failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute disbursement
  const handleExecuteDisburse = async () => {
    if (!targetReport) return;
    if (!disbursementRef.trim()) {
      setModalError('Disbursement reference number is required.');
      return;
    }

    setIsProcessing(true);
    setModalError(null);

    try {
      await api.expenses.disburseReport(targetReport.id, {
        disbursementReference: disbursementRef.trim(),
        paidDate: paidDate || new Date().toISOString().split('T')[0],
      });

      setActionModalType(null);
      setTargetReport(null);
      if (inspectingReport && inspectingReport.id === targetReport.id) {
        setInspectingReport(null);
      }
      await fetchReports();
    } catch (err: any) {
      setModalError(err.message || 'Disbursement execution failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper for lifecycle badges
  const renderStatusBadge = (status: ExpenseReportStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="approved">Settled / Disbursed</Badge>;
      case 'APPROVED':
        return <Badge variant="brand">Ready for Disbursal</Badge>;
      case 'PENDING_DEPT_HEAD':
        return <Badge variant="pending">Dept Head Sign-Off</Badge>;
      case 'PENDING_EXEC':
        return <Badge variant="pending">Executive Approval</Badge>;
      case 'SUBMITTED':
      case 'PENDING_LINE_MANAGER':
        return <Badge variant="pending">Line Manager Review</Badge>;
      case 'REVISION_REQUESTED':
        return <Badge variant="draft">Revision Requested</Badge>;
      case 'REJECTED':
        return <Badge variant="rejected">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <AdminLayout currentPath={currentPath} onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
              Expense Claims &amp; Disbursement Queue
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Multi-tier workflow management: Line Manager Review &rarr; Dept Head Escalation &rarr; NIBSS Direct Disbursement.
            </p>
          </div>

          {/* Scope Toggle for Admin */}
          {isAdminOrFinance && (
            <div className="flex items-center gap-1 p-1 bg-subtle rounded-[7px] border border-rule text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setScope('team')}
                className={`px-3 py-1.5 rounded-[5px] transition-colors cursor-pointer select-none ${
                  scope === 'team'
                    ? 'bg-surface text-ink shadow-xs border border-rule'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Team Queue
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 rounded-[5px] transition-colors cursor-pointer select-none ${
                  scope === 'all'
                    ? 'bg-surface text-ink shadow-xs border border-rule'
                    : 'text-muted hover:text-ink'
                }`}
              >
                All Corporate Claims
              </button>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-[7px] bg-danger/10 border border-danger/25 text-danger text-sm flex items-center gap-2">
            <WarningCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Claims Table Card */}
        <Card variant="surface" padding="none">
          {/* Header & Sub-filters */}
          <div className="p-4 sm:p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand" />
              <h3 className="text-base font-semibold text-ink font-display">
                Active Financial Disbursement Pipeline
              </h3>
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1 p-1 bg-subtle rounded-[7px] border border-rule text-xs font-semibold overflow-x-auto">
              {(
                [
                  ['ACTION_REQUIRED', 'Action Required'],
                  ['PENDING', 'Under Review'],
                  ['READY_DISBURSE', 'Ready for Disbursal'],
                  ['PAID', 'Settled & Paid'],
                  ['REJECTED', 'Rejected'],
                  ['ALL', 'All Claims'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatusFilter(val)}
                  className={`px-3 py-1.5 rounded-[5px] transition-colors cursor-pointer select-none whitespace-nowrap ${
                    statusFilter === val
                      ? 'bg-surface text-ink shadow-xs border border-rule'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rule bg-subtle/50 text-[11px] font-semibold text-muted uppercase tracking-wider font-sans">
                  <th className="py-3.5 px-4 sm:px-6">Claim Reference</th>
                  <th className="py-3.5 px-4 sm:px-6">Staff Member</th>
                  <th className="py-3.5 px-4 sm:px-6">Purpose &amp; Summary</th>
                  <th className="py-3.5 px-4 sm:px-6">Submitted Date</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Total Value</th>
                  <th className="py-3.5 px-4 sm:px-6">Lifecycle Stage</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-sm">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-24" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-32" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-44" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-20" /></td>
                      <td className="py-4 px-4 sm:px-6 text-right"><Skeleton className="h-5 w-24 ml-auto" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-28" /></td>
                      <td className="py-4 px-4 sm:px-6 text-center"><Skeleton className="h-5 w-28 mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted font-sans">
                      <Receipt className="w-10 h-10 mx-auto text-muted/40 mb-2" />
                      <p className="text-sm font-medium text-ink">No claims in this approval queue</p>
                      <p className="text-xs text-muted mt-1">
                        All claims matching this filter have been processed or none have been submitted.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const isSelfClaim =
                      report.employeeId === currentUserId ||
                      (currentUser && report.employeeId === currentUser.id);

                    const canApprove =
                      !isSelfClaim &&
                      ['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC'].includes(
                        report.status
                      );

                    const canDisburse =
                      isAdminOrFinance && report.status === 'APPROVED';

                    return (
                      <tr
                        key={report.id}
                        className="hover:bg-subtle/50 transition-colors group cursor-pointer"
                        onClick={() => setInspectingReport(report)}
                      >
                        <td className="py-4 px-4 sm:px-6 font-semibold text-ink font-display">
                          {report.reportNumber || report.id}
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <div className="font-medium text-ink">{report.employeeName || report.employeeId}</div>
                          {report.department && (
                            <div className="text-xs text-muted mt-0.5">{report.department}</div>
                          )}
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <div className="font-medium text-ink line-clamp-1">{report.title}</div>
                          <div className="text-xs text-muted line-clamp-1 mt-0.5">
                            {report.items?.length || 1} line item{(report.items?.length || 1) > 1 ? 's' : ''}
                            {report.purpose ? ` • ${report.purpose}` : ''}
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-xs text-muted font-mono-nums">
                          {report.submittedAt ? report.submittedAt.split('T')[0] : '—'}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right font-semibold text-ink font-display tabular-nums">
                          ₦{(Number(report.totalAmount) || 0).toLocaleString('en-NG', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          {renderStatusBadge(report.status)}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {isSelfClaim ? (
                              <span
                                className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                title="Self-Approval Prohibited under SEI CERT & OWASP guidelines"
                              >
                                Self-Claim
                              </span>
                            ) : canApprove ? (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => openActionModal(report, 'APPROVE')}
                                  title="Approve / Escalate"
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openActionModal(report, 'REVISION')}
                                  title="Request Revision"
                                >
                                  Revision
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => openActionModal(report, 'REJECT')}
                                  title="Reject Claim"
                                >
                                  Reject
                                </Button>
                              </>
                            ) : canDisburse ? (
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => openActionModal(report, 'DISBURSE')}
                                title="Execute Direct NIBSS Disbursal"
                              >
                                Disburse
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Eye className="w-4 h-4" />}
                                onClick={() => setInspectingReport(report)}
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Claim Breakdown Inspection Drawer */}
        <Drawer
          isOpen={!!inspectingReport}
          onClose={() => setInspectingReport(null)}
          title={inspectingReport?.reportNumber || 'Expense Claim Inspection'}
          description="Detailed line items, policy flags, and receipt inspection."
        >
          {inspectingReport && (
            <div className="space-y-6 text-sm font-sans">
              {/* Self-Approval Warning Callout */}
              {(inspectingReport.employeeId === currentUserId ||
                (currentUser && inspectingReport.employeeId === currentUser.id)) && (
                <div className="p-3 rounded-[7px] bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <WarningCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Self-Approval Prohibited: You cannot approve or disburse your own expense claims.
                  </span>
                </div>
              )}

              {/* Status & Amount Summary */}
              <div className="p-4 rounded-[12px] bg-subtle border border-rule flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Claim Status
                  </div>
                  <div className="mt-1">{renderStatusBadge(inspectingReport.status)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Total Value
                  </div>
                  <div className="text-xl font-bold text-ink font-display tabular-nums mt-0.5">
                    ₦{(Number(inspectingReport.totalAmount) || 0).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              {/* Employee & Purpose */}
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-semibold text-muted uppercase">Staff Member:</span>
                  <p className="text-sm font-medium text-ink">
                    {inspectingReport.employeeName || inspectingReport.employeeId}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted uppercase">Claim Title:</span>
                  <p className="text-sm font-medium text-ink">{inspectingReport.title}</p>
                </div>
                {inspectingReport.purpose && (
                  <div>
                    <span className="text-xs font-semibold text-muted uppercase">
                      Operational Justification:
                    </span>
                    <p className="text-xs text-muted">{inspectingReport.purpose}</p>
                  </div>
                )}
                {inspectingReport.disbursementReference && (
                  <div>
                    <span className="text-xs font-semibold text-muted uppercase">
                      NIBSS Payment Reference:
                    </span>
                    <p className="text-xs font-mono font-bold text-brand">
                      {inspectingReport.disbursementReference}
                    </p>
                  </div>
                )}
                {inspectingReport.rejectionReason && (
                  <div className="p-3 rounded-[7px] bg-danger/10 border border-danger/20 text-danger text-xs">
                    <span className="font-semibold block mb-0.5">Reviewer Feedback:</span>
                    {inspectingReport.rejectionReason}
                  </div>
                )}
              </div>

              {/* Line Items Repeater */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider border-b border-rule pb-1.5">
                  Itemized Breakdown ({inspectingReport.items?.length || 0})
                </h4>
                {inspectingReport.items?.map((it, i) => (
                  <div key={i} className="p-3.5 rounded-[7px] bg-subtle/50 border border-rule space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{it.merchantName}</span>
                      <span className="font-bold text-ink tabular-nums">
                        ₦{(Number(it.amount) || 0).toLocaleString('en-NG', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted flex items-center justify-between">
                      <span>Date: {it.dateIncurred}</span>
                      {it.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptUrl(it.receiptUrl!)}
                          className="text-brand hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Inspect Receipt</span>
                        </button>
                      ) : (
                        <span className="text-muted/60">No receipt attached</span>
                      )}
                    </div>
                    {it.description && <p className="text-xs text-muted">{it.description}</p>}
                    {it.flags?.includes('WEEKEND_EXPENSE') && (
                      <span className="inline-block text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        Weekend Expenditure
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Quick Actions in Drawer */}
              {!(
                inspectingReport.employeeId === currentUserId ||
                (currentUser && inspectingReport.employeeId === currentUser.id)
              ) && (
                <div className="pt-4 border-t border-rule space-y-2">
                  {['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC'].includes(
                    inspectingReport.status
                  ) && (
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="primary"
                        onClick={() => openActionModal(inspectingReport, 'APPROVE')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openActionModal(inspectingReport, 'REVISION')}
                      >
                        Revision
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => openActionModal(inspectingReport, 'REJECT')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {isAdminOrFinance && inspectingReport.status === 'APPROVED' && (
                    <Button
                      variant="success"
                      className="w-full"
                      onClick={() => openActionModal(inspectingReport, 'DISBURSE')}
                    >
                      Execute NIBSS Disbursal
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </Drawer>

        {/* Action Modal (Approve, Reject, Revision, Disburse) */}
        <Modal
          isOpen={!!actionModalType}
          onClose={() => {
            if (!isProcessing) {
              setActionModalType(null);
              setTargetReport(null);
            }
          }}
          title={
            actionModalType === 'APPROVE'
              ? 'Approve Expense Claim'
              : actionModalType === 'REJECT'
              ? 'Reject Expense Claim'
              : actionModalType === 'REVISION'
              ? 'Request Revision from Employee'
              : 'Execute Direct Bank Disbursal'
          }
          maxWidth={actionModalType === 'DISBURSE' ? 'lg' : 'md'}
        >
          {targetReport && (
            <div className="space-y-4 font-sans text-sm">
              {modalError && (
                <div className="p-3 rounded-[7px] bg-danger/10 border border-danger/25 text-danger text-xs flex items-center gap-2">
                  <WarningCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Summary Strip */}
              <div className="p-3 rounded-[7px] bg-subtle border border-rule flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted font-display font-semibold">
                    {targetReport.reportNumber}
                  </span>
                  <p className="text-xs text-ink font-medium mt-0.5 line-clamp-1">
                    {targetReport.title}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-ink font-display tabular-nums">
                    ₦{(Number(targetReport.totalAmount) || 0).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* APPROVAL DETAILS */}
              {actionModalType === 'APPROVE' && (
                <div className="space-y-3">
                  {targetReport.totalAmount > 50000 &&
                  (targetReport.status === 'SUBMITTED' ||
                    targetReport.status === 'PENDING_LINE_MANAGER') ? (
                    <div className="p-3 rounded-[7px] bg-brand/10 border border-brand/20 text-brand text-xs flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                      <span>
                        Note: Because this claim exceeds ₦50,000.00, approval will escalate it to the
                        Department Head for secondary sign-off.
                      </span>
                    </div>
                  ) : targetReport.totalAmount > 250000 &&
                    targetReport.status === 'PENDING_DEPT_HEAD' ? (
                    <div className="p-3 rounded-[7px] bg-brand/10 border border-brand/20 text-brand text-xs flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                      <span>
                        Note: Because this claim exceeds ₦250,000.00, approval will escalate it to the
                        Managing Director / Executive tier for sign-off.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-[7px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span>
                        This approval gives final corporate sign-off, queueing this claim for NIBSS
                        reimbursement disbursement.
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Reviewer Notes / Comments (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={actionComments}
                      onChange={(e) => setActionComments(e.target.value)}
                      placeholder="Verified operational receipts and policy compliance..."
                      className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-1/3"
                      onClick={() => setActionModalType(null)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-2/3"
                      isLoading={isProcessing}
                      onClick={handleExecuteReview}
                    >
                      Confirm Approval
                    </Button>
                  </div>
                </div>
              )}

              {/* REJECT DETAILS */}
              {actionModalType === 'REJECT' && (
                <div className="space-y-3">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Reason for Rejection <span className="text-danger">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={actionComments}
                      onChange={(e) => setActionComments(e.target.value)}
                      placeholder="Specify non-compliance, missing invoice, or budget unavailability..."
                      className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus:border-danger"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-1/3"
                      onClick={() => setActionModalType(null)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="w-2/3"
                      isLoading={isProcessing}
                      onClick={handleExecuteReview}
                    >
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              )}

              {/* REVISION DETAILS */}
              {actionModalType === 'REVISION' && (
                <div className="space-y-3">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Revision Instructions for Staff <span className="text-danger">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={actionComments}
                      onChange={(e) => setActionComments(e.target.value)}
                      placeholder="Specify required corrections (e.g. clearer receipt scan, correct merchant name)..."
                      className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-1/3"
                      onClick={() => setActionModalType(null)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-2/3"
                      isLoading={isProcessing}
                      onClick={handleExecuteReview}
                    >
                      Send Revision Request
                    </Button>
                  </div>
                </div>
              )}

              {/* DISBURSE DETAILS */}
              {actionModalType === 'DISBURSE' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-[7px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                    <Buildings className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">
                        Direct Bank Settlement Rail (NIBSS ACH)
                      </span>
                      <span>
                        Executing disbursement settles this reimbursement claim against the corporate treasury account.
                      </span>
                    </div>
                  </div>

                  <Input
                    label="NIBSS Payment / Transaction Reference"
                    value={disbursementRef}
                    onChange={(e) => setDisbursementRef(e.target.value)}
                    required
                  />

                  <Input
                    label="Settlement Date"
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    required
                  />

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-1/3"
                      onClick={() => setActionModalType(null)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      className="w-2/3"
                      isLoading={isProcessing}
                      onClick={handleExecuteDisburse}
                    >
                      Execute NIBSS Disbursal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Receipt Document Preview Modal */}
        <Modal
          isOpen={!!previewReceiptUrl}
          onClose={() => setPreviewReceiptUrl(null)}
          title="Verified Receipt Document Inspection"
          maxWidth="2xl"
        >
          {previewReceiptUrl && (
            <div className="space-y-4">
              {previewReceiptUrl.endsWith('.pdf') ? (
                <div className="w-full h-96 bg-subtle rounded-[7px] flex flex-col items-center justify-center p-6 border border-rule">
                  <FilePdf className="w-16 h-16 text-danger mb-3" weight="fill" />
                  <p className="text-sm font-semibold text-ink">PDF Document Attached</p>
                  <p className="text-xs text-muted mt-1 text-center max-w-sm">
                    PDF files cannot be rendered directly inline in this browser sandbox. You can preview or download below.
                  </p>
                  <a
                    href={previewReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 px-4 py-2 rounded-[7px] bg-brand text-white text-xs font-semibold hover:opacity-90 inline-flex items-center gap-2"
                  >
                    <span>Open PDF in New Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/5 dark:bg-black/30 rounded-[7px] p-2">
                  <img
                    src={previewReceiptUrl}
                    alt="Receipt Preview"
                    className="max-w-full max-h-[60vh] object-contain rounded"
                  />
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
};
