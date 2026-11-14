import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarCheck,
  Check,
  X,
  ChatCenteredText,
  CheckCircle,
  Clock,
  ArrowClockwise,
  WarningCircle,
  Eye,
  FileText,
  ShieldWarning,
  User,
} from '@phosphor-icons/react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button, Card, Badge, Modal, Skeleton } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type { LeaveRequest, LeaveBalance } from '../../lib/leaveTypes';

export interface LeaveApprovalPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const LeaveApprovalPage: React.FC<LeaveApprovalPageProps> = ({
  currentPath = '/admin/leave-approvals',
  onNavigate,
}) => {
  const [scope, setScope] = useState<'team' | 'all'>('team');
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('MANAGER');

  // Review Modal State
  const [reviewModalItem, setReviewModalItem] = useState<LeaveRequest | null>(null);
  const [employeeBalance, setEmployeeBalance] = useState<LeaveBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch current user details on mount
  useEffect(() => {
    api.auth
      .me()
      .then((res: any) => {
        const u = res?.user || res?.data || res;
        if (u) {
          setCurrentUserId(u.profile?.id || u.id);
          setCurrentUserRole(u.role || 'MANAGER');
        }
      })
      .catch(() => {
        // Fallback: regular flow continues
      });
  }, []);

  // Fetch requests based on scope
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const data = await api.leaves.getRequests(scope);
      setItems(data);
    } catch (err: any) {
      if (err.status === 401) {
        onNavigate('/auth/login');
        return;
      }
      setToast({
        type: 'error',
        message: err.message || 'Failed to fetch approval queue from server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [scope]);

  // Fetch balance impact when modal opens
  useEffect(() => {
    if (!reviewModalItem) {
      setEmployeeBalance(null);
      return;
    }

    let isCurrent = true;
    setIsLoadingBalance(true);
    api.leaves
      .getBalances(reviewModalItem.employeeId)
      .then((bals) => {
        if (!isCurrent) return;
        const match = bals.find((b) => b.leaveTypeId === reviewModalItem.leaveTypeId);
        setEmployeeBalance(match || null);
      })
      .catch(() => {
        if (isCurrent) setEmployeeBalance(null);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingBalance(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [reviewModalItem]);

  const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!reviewModalItem) return;
    setIsSubmittingDecision(true);
    setDecisionError(null);

    try {
      const updated = await api.leaves.reviewRequest(
        reviewModalItem.id,
        decision,
        comment.trim() || (decision === 'APPROVE' ? 'Approved by Line Manager' : 'Operational requirements')
      );

      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setToast({
        type: 'success',
        message: `Leave application ${updated.requestNumber || updated.id} marked as ${updated.status}.`,
      });
      setReviewModalItem(null);
      setComment('');
    } catch (err: any) {
      setDecisionError(err.message || 'Failed to record leave decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const isSelf = reviewModalItem && currentUserId && reviewModalItem.employeeId === currentUserId;

  const renderBadge = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="approved" size="sm">Approved</Badge>;
      case 'SUBMITTED':
        return <Badge variant="pending" size="sm">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge variant="rejected" size="sm">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const pendingCount = items.filter((i) => i.status === 'SUBMITTED').length;

  return (
    <AdminLayout currentPath={currentPath} onNavigate={onNavigate}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Leave Requests Approval Queue
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Departmental line manager and HR administrator approval console with entitlement ledger verification.
          </p>
        </div>

        {/* Scope Selector Controls */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-[7px] border border-rule bg-subtle p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setScope('team')}
              className={`px-3 py-1.5 rounded-[5px] transition-colors cursor-pointer ${
                scope === 'team'
                  ? 'bg-surface text-brand shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Direct Reports (Team)
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-[5px] transition-colors cursor-pointer ${
                scope === 'all'
                  ? 'bg-surface text-brand shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Enterprise Submissions (All)
            </button>
          </div>

          <Button
            variant="ghost"
            size="md"
            onClick={fetchRequests}
            leftIcon={<ArrowClockwise className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-[7px] text-xs font-semibold flex items-center justify-between gap-2.5 shadow-sm border ${
              toast.type === 'success'
                ? 'bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border-[#007B58]/30'
                : 'bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border-[#B52F38]/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-[#007B58] dark:text-[#69D3B0]" weight="fill" />
              ) : (
                <WarningCircle className="w-5 h-5 shrink-0 text-[#B52F38] dark:text-[#FFACA9]" weight="fill" />
              )}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-muted hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Requests Table */}
      <Card variant="surface" padding="none">
        <div className="p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-brand" />
            <span>
              {scope === 'team' ? 'Direct Reports Review Queue' : 'All Enterprise Submissions Queue'}
            </span>
          </h3>
          <span className="text-xs text-muted font-mono-nums">
            {pendingCount} pending review &bull; {items.length} total filings
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-subtle text-muted uppercase text-[10px] tracking-wider border-b border-rule">
              <tr>
                <th className="py-3 px-6 font-semibold">Staff Member</th>
                <th className="py-3 px-6 font-semibold">Category</th>
                <th className="py-3 px-6 font-semibold">Duration Range</th>
                <th className="py-3 px-6 font-semibold">Working Days</th>
                <th className="py-3 px-6 font-semibold">Stated Reason</th>
                <th className="py-3 px-6 font-semibold">Status</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-ink">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-4 px-6">
                      <Skeleton height={20} />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No leave applications currently awaiting review in this scope.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSubmitted = item.status === 'SUBMITTED';

                  return (
                    <tr key={item.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-ink">
                          {item.employeeName || item.employeeId}
                        </div>
                        <div className="text-[11px] text-muted">
                          {item.department || 'Credit & Risk Operations'}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-medium">
                        {item.leaveTypeId}
                      </td>
                      <td className="py-3.5 px-6 font-mono-nums text-muted">
                        {item.startDate} &rarr; {item.endDate}
                      </td>
                      <td className="py-3.5 px-6 font-bold font-mono-nums text-ink">
                        {item.totalDays} Days
                      </td>
                      <td className="py-3.5 px-6 text-muted max-w-xs truncate" title={item.reason}>
                        {item.reason}
                      </td>
                      <td className="py-3.5 px-6">
                        {renderBadge(item.status)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {isSubmitted ? (
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setReviewModalItem(item);
                                setComment('');
                                setDecisionError(null);
                              }}
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              Review Dossier
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted font-mono-nums">
                            {item.status === 'APPROVED' ? 'Decided (Approved)' : item.status === 'REJECTED' ? 'Decided (Rejected)' : 'Closed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Dossier Modal */}
      <Modal
        isOpen={!!reviewModalItem}
        onClose={() => setReviewModalItem(null)}
        title="Review Leave Application"
        description={`Application Dossier: ${reviewModalItem?.requestNumber || reviewModalItem?.id}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {decisionError && (
            <div className="p-3 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs flex items-center gap-2">
              <WarningCircle className="w-4 h-4 shrink-0" />
              <span>{decisionError}</span>
            </div>
          )}

          {/* Self-Approval Warning */}
          {isSelf && (
            <div className="p-3.5 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/30 text-xs flex items-start gap-2.5">
              <ShieldWarning className="w-5 h-5 shrink-0 mt-0.5 text-danger" weight="fill" />
              <div>
                <strong className="block font-semibold">Self-Approval Prohibited</strong>
                <span>
                  Under company corporate governance and RBAC policy, managers cannot authorize their own leave filings. Your application must be reviewed by your supervisor or HR Administrator.
                </span>
              </div>
            </div>
          )}

          {/* Staff Dossier Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-[7px] bg-subtle border border-rule text-xs font-sans">
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Staff Member</span>
              <span className="font-semibold text-ink">{reviewModalItem?.employeeName || reviewModalItem?.employeeId}</span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Category</span>
              <span className="font-semibold text-ink">{reviewModalItem?.leaveTypeId}</span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Duration</span>
              <span className="font-mono-nums font-semibold text-ink">
                {reviewModalItem?.startDate} &rarr; {reviewModalItem?.endDate}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[10px] uppercase font-semibold">Working Days</span>
              <span className="font-bold text-ink font-mono-nums">{reviewModalItem?.totalDays} Days</span>
            </div>
          </div>

          {/* Stated Reason & Handover Commitments */}
          <div className="p-3.5 rounded-[7px] bg-subtle border border-rule text-xs">
            <span className="text-muted block text-[10px] uppercase font-semibold mb-1">
              Stated Reason &amp; Handover Notes
            </span>
            <p className="text-ink leading-relaxed whitespace-pre-wrap">{reviewModalItem?.reason}</p>
          </div>

          {/* Medical Certificate Attachment */}
          {reviewModalItem?.attachmentUrl && (
            <div className="p-3 rounded-[7px] bg-accent-soft text-brand text-xs border border-brand/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Supporting Medical Certificate Attached</span>
              </div>
              <a
                href={reviewModalItem.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline hover:text-brand-dark"
              >
                Inspect Document &rarr;
              </a>
            </div>
          )}

          {/* Entitlement Ledger Impact Calculation */}
          <div className="p-3 rounded-[7px] bg-subtle text-ink text-xs border border-rule space-y-1.5 font-sans">
            <div className="font-semibold uppercase tracking-wider text-[10px] text-muted flex items-center justify-between">
              <span>Entitlement Ledger Impact</span>
              {isLoadingBalance && <Clock className="w-3.5 h-3.5 animate-spin text-brand" />}
            </div>

            {employeeBalance ? (
              <div className="grid grid-cols-4 gap-2 text-center pt-1 font-mono-nums">
                <div className="p-2 rounded bg-surface border border-rule/50">
                  <span className="text-[10px] text-muted block uppercase">Allocated</span>
                  <span className="font-bold text-ink">{employeeBalance.allocatedDays}d</span>
                </div>
                <div className="p-2 rounded bg-surface border border-rule/50">
                  <span className="text-[10px] text-muted block uppercase">Used</span>
                  <span className="font-bold text-ink">{employeeBalance.usedDays}d</span>
                </div>
                <div className="p-2 rounded bg-surface border border-rule/50">
                  <span className="text-[10px] text-muted block uppercase">Pending</span>
                  <span className="font-bold text-ink">{employeeBalance.pendingDays}d</span>
                </div>
                <div className="p-2 rounded bg-accent-soft border border-brand/25">
                  <span className="text-[10px] text-brand block uppercase font-semibold">Available</span>
                  <span className="font-bold text-brand">{employeeBalance.availableDays}d</span>
                </div>
              </div>
            ) : (
              <span className="text-muted text-[11px] italic">
                {isLoadingBalance ? 'Querying employee entitlement records...' : 'Balance ledger record unavailable.'}
              </span>
            )}
          </div>

          {/* Manager Comment Box */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Manager Decision Comment / Audit Notes
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter operational handover confirmation or reason for rejection..."
              className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand placeholder:text-muted/60"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-rule">
            <Button variant="ghost" onClick={() => setReviewModalItem(null)}>
              Dismiss
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                onClick={() => handleDecision('REJECT')}
                isLoading={isSubmittingDecision}
                disabled={Boolean(isSelf)}
                leftIcon={<X className="w-4 h-4" />}
              >
                Reject Leave
              </Button>
              <Button
                variant="success"
                onClick={() => handleDecision('APPROVE')}
                isLoading={isSubmittingDecision}
                disabled={Boolean(isSelf)}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Approve Leave
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};
