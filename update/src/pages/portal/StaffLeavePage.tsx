import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarCheck,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  Info,
  Calendar,
  X,
  FileText,
  Trash,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { PortalLayout } from '../../components/layout/PortalLayout';
import { Button, Card, Badge, Drawer, Modal, Input, Tabs, Skeleton } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type {
  LeaveBalance,
  LeaveRequest,
  WorkingDaysCalculation,
  LeaveTypeId,
} from '../../lib/leaveTypes';

export interface StaffLeavePageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

interface LeaveCategoryMeta {
  id: LeaveTypeId;
  label: string;
  defaultQuota: number;
  color: string;
  progressClass: string;
}

const LEAVE_CATEGORIES: LeaveCategoryMeta[] = [
  {
    id: 'lt-annual',
    label: 'Annual Leave',
    defaultQuota: 20,
    color: '#0D51B2',
    progressClass: 'bg-[#0D51B2]',
  },
  {
    id: 'lt-sick',
    label: 'Sick / Medical',
    defaultQuota: 12,
    color: '#007B58',
    progressClass: 'bg-[#007B58] dark:bg-[#69D3B0]',
  },
  {
    id: 'lt-casual',
    label: 'Casual Emergency',
    defaultQuota: 5,
    color: '#865600',
    progressClass: 'bg-[#865600] dark:bg-[#F3CE87]',
  },
  {
    id: 'lt-maternity',
    label: 'Maternity Leave',
    defaultQuota: 84,
    color: '#7C3AED',
    progressClass: 'bg-[#7C3AED]',
  },
  {
    id: 'lt-paternity',
    label: 'Paternity Leave',
    defaultQuota: 10,
    color: '#0D51B2',
    progressClass: 'bg-[#0D51B2]',
  },
  {
    id: 'lt-bereavement',
    label: 'Bereavement Leave',
    defaultQuota: 5,
    color: '#64748B',
    progressClass: 'bg-[#64748B]',
  },
];

export const StaffLeavePage: React.FC<StaffLeavePageProps> = ({
  currentPath = '/portal/leave',
  onNavigate,
}) => {
  // Page Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  // Filter Tab State
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Drawer & Form State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState<LeaveTypeId>('lt-annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reliefOfficer, setReliefOfficer] = useState('Bisi Adeleke (Credit Underwriter)');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Dynamic Date Calculation Engine State
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<WorkingDaysCalculation | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancelModalItem, setCancelModalItem] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Toast Banner State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initial Data Fetch
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedBalances, fetchedRequests] = await Promise.all([
        api.leaves.getBalances(),
        api.leaves.getRequests('mine'),
      ]);
      setBalances(fetchedBalances);
      setRequests(fetchedRequests);
    } catch (err: any) {
      if (err.status === 401) {
        onNavigate('/auth/login');
        return;
      }
      setToast({
        type: 'error',
        message: err.message || 'Failed to load leave records from server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-Time Date Calculation Trigger
  useEffect(() => {
    if (!startDate || !endDate) {
      setCalcResult(null);
      setCalcError(null);
      return;
    }

    if (endDate < startDate) {
      setCalcError('End date cannot be earlier than start date.');
      setCalcResult(null);
      return;
    }

    let isCurrent = true;
    setIsCalculating(true);
    setCalcError(null);

    api.leaves
      .calculateDays(startDate, endDate, isHalfDay)
      .then((result) => {
        if (!isCurrent) return;
        setCalcResult(result);
        if (result.workingDays === 0) {
          setCalcError('The selected period contains 0 net working days (all weekends or public holidays).');
        }
      })
      .catch((err: any) => {
        if (!isCurrent) return;
        setCalcError(err.message || 'Error calculating working days.');
        setCalcResult(null);
      })
      .finally(() => {
        if (isCurrent) setIsCalculating(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [startDate, endDate, isHalfDay]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!calcResult || calcResult.workingDays <= 0) {
      setSubmitError('Please specify a valid date range with at least 1 net working day.');
      return;
    }

    const activeBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);
    if (activeBalance && calcResult.workingDays > activeBalance.availableDays) {
      setSubmitError(
        `Insufficient balance. Requested ${calcResult.workingDays} working days exceeds your available quota of ${activeBalance.availableDays} days.`
      );
      return;
    }

    if (leaveTypeId === 'lt-casual' && calcResult.workingDays > 2) {
      setSubmitError('Policy limit violation: Casual leave cannot exceed 2 consecutive working days.');
      return;
    }

    if (leaveTypeId === 'lt-sick' && calcResult.workingDays > 2 && !attachmentUrl.trim()) {
      setSubmitError('Medical certificate is mandatory for sick leave exceeding 2 consecutive working days.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newReq = await api.leaves.submitRequest({
        leaveTypeId,
        startDate,
        endDate,
        reason: `${reason.trim()}${reliefOfficer ? ` [Relief: ${reliefOfficer}]` : ''}`,
        isHalfDay,
        attachmentUrl: attachmentUrl.trim() || undefined,
      });

      // Prepend to requests list
      setRequests((prev) => [newReq, ...prev]);

      // Refresh balances to reflect pending reservation
      const updatedBalances = await api.leaves.getBalances();
      setBalances(updatedBalances);

      // Close Drawer & Reset
      setDrawerOpen(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setAttachmentUrl('');
      setCalcResult(null);

      setToast({
        type: 'success',
        message: `Leave request ${newReq.requestNumber} (${newReq.totalDays} working days) submitted successfully for line manager review.`,
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancellation Execution
  const handleConfirmCancel = async () => {
    if (!cancelModalItem) return;
    setIsCancelling(true);
    try {
      const updatedReq = await api.leaves.cancelRequest(cancelModalItem.id, cancelReason);
      setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));

      // Refresh balances to reflect released days
      const updatedBalances = await api.leaves.getBalances();
      setBalances(updatedBalances);

      setCancelModalItem(null);
      setCancelReason('');
      setToast({
        type: 'success',
        message: `Leave request ${updatedReq.requestNumber} cancelled. ${updatedReq.totalDays} working days restored to your available quota.`,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to cancel leave request.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter requests according to active tab
  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return r.status === 'SUBMITTED';
    if (activeTab === 'approved') return r.status === 'APPROVED';
    if (activeTab === 'rejected') return r.status === 'REJECTED';
    return true;
  });

  const filterTabs = [
    { id: 'all', label: 'All Requests', count: requests.length },
    { id: 'pending', label: 'Pending Review', count: requests.filter((r) => r.status === 'SUBMITTED').length },
    { id: 'approved', label: 'Approved', count: requests.filter((r) => r.status === 'APPROVED').length },
    { id: 'rejected', label: 'Rejected', count: requests.filter((r) => r.status === 'REJECTED').length },
  ];

  const renderStatusBadge = (status: LeaveRequest['status']) => {
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

  const activeBalance = balances.find((b) => b.leaveTypeId === leaveTypeId);

  return (
    <PortalLayout currentPath={currentPath} onNavigate={onNavigate}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Leave &amp; Time-Off Management
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Track statutory entitlement quotas, calculate Nigerian working days, and file new time-off requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={fetchData}
            leftIcon={<ArrowClockwise className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setSubmitError(null);
              setDrawerOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            File New Leave Request
          </Button>
        </div>
      </div>

      {/* Global Toast Notification */}
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
                <XCircle className="w-5 h-5 shrink-0 text-[#B52F38] dark:text-[#FFACA9]" weight="fill" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6 Dynamic Leave Quota Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} variant="surface" padding="md">
                <Skeleton height={14} width="60%" className="mb-2" />
                <Skeleton height={32} width="80%" className="mb-3" />
                <Skeleton height={6} width="100%" />
              </Card>
            ))
          : LEAVE_CATEGORIES.map((cat) => {
              const record = balances.find((b) => b.leaveTypeId === cat.id);
              const totalQuota = record
                ? record.allocatedDays + (record.carriedOverDays || 0)
                : cat.defaultQuota;
              const available = record ? record.availableDays : totalQuota;
              const used = record ? record.usedDays : 0;
              const pending = record ? record.pendingDays : 0;
              const pct = Math.min(100, Math.max(0, (available / (totalQuota || 1)) * 100));

              return (
                <Card key={cat.id} variant="surface" padding="md" className="flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
                      {cat.label}
                    </span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-semibold text-ink font-display font-mono-nums">
                        {available}
                      </span>
                      <span className="text-xs text-muted">/ {totalQuota}d</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-subtle rounded-full h-1.5 mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${cat.progressClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Sub-Metrics Footer */}
                  <div className="flex justify-between text-[11px] text-muted mt-3 pt-2 border-t border-rule font-mono-nums">
                    <span>{used}d used</span>
                    <span>{pending > 0 ? `${pending}d pending` : '0 pending'}</span>
                  </div>
                </Card>
              );
            })}
      </div>

      {/* Leave Application History Table */}
      <Card variant="surface" padding="none">
        <div className="p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-brand" />
            <span>Leave Application History</span>
          </h3>
          <span className="text-xs text-muted font-mono-nums">
            {filteredRequests.length} records shown
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 pt-2 bg-surface">
          <Tabs
            tabs={filterTabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as any)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-subtle text-muted uppercase text-[10px] tracking-wider border-b border-rule">
              <tr>
                <th className="py-3 px-6 font-semibold">Request ID</th>
                <th className="py-3 px-6 font-semibold">Leave Category</th>
                <th className="py-3 px-6 font-semibold">Duration Range</th>
                <th className="py-3 px-6 font-semibold">Working Days</th>
                <th className="py-3 px-6 font-semibold">Reason</th>
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
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No leave applications found for this filter tab.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const categoryMeta = LEAVE_CATEGORIES.find((c) => c.id === req.leaveTypeId);
                  const isCancelable = req.status === 'SUBMITTED';

                  return (
                    <tr key={req.id} className="hover:bg-subtle/50 transition-colors">
                      <td className="py-3.5 px-6 font-mono-nums font-semibold text-ink">
                        {req.requestNumber || req.id}
                      </td>
                      <td className="py-3.5 px-6 font-medium">
                        {categoryMeta?.label || req.leaveTypeId}
                      </td>
                      <td className="py-3.5 px-6 font-mono-nums text-muted">
                        {req.startDate} &rarr; {req.endDate}
                      </td>
                      <td className="py-3.5 px-6 font-bold font-mono-nums">
                        {req.totalDays} Working Days
                      </td>
                      <td className="py-3.5 px-6 text-muted max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="py-3.5 px-6">
                        {renderStatusBadge(req.status)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {isCancelable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger hover:bg-danger/10 text-[11px]"
                            onClick={() => {
                              setCancelModalItem(req);
                              setCancelReason('');
                            }}
                          >
                            Cancel Request
                          </Button>
                        ) : req.status === 'CANCELLED' ? (
                          <span className="text-[11px] text-muted italic">Released</span>
                        ) : req.status === 'APPROVED' ? (
                          <span className="text-[11px] text-success font-medium">Authorized</span>
                        ) : (
                          <span className="text-[11px] text-muted italic">Closed</span>
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

      {/* Leave Application Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Apply for Time-Off"
        description="Submit your request to your line manager. Nigerian holidays and weekends are excluded."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Leave Category Selector */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Leave Category
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value as LeaveTypeId)}
              className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
            >
              {LEAVE_CATEGORIES.map((cat) => {
                const bal = balances.find((b) => b.leaveTypeId === cat.id);
                const avail = bal ? bal.availableDays : cat.defaultQuota;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({avail} Days Left)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          {/* Half-Day Checkbox */}
          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isHalfDay}
              onChange={(e) => setIsHalfDay(e.target.checked)}
              className="rounded-[4px] border-rule text-brand focus:ring-brand w-4 h-4 cursor-pointer"
            />
            <span>Apply as Half-Day Leave (0.5 working days per eligible business day)</span>
          </label>

          {/* Real-time Calculation Status & Notifications */}
          {isCalculating && (
            <div className="p-3 rounded-[7px] bg-subtle border border-rule text-xs text-muted flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-brand" />
              <span>Calculating net Nigerian working days...</span>
            </div>
          )}

          {calcError && (
            <div className="p-3 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{calcError}</span>
            </div>
          )}

          {calcResult && (
            <div className="p-3.5 rounded-[7px] bg-accent-soft border border-brand/25 text-xs text-ink space-y-1.5 font-sans">
              <div className="flex justify-between items-center font-bold">
                <span className="text-brand uppercase text-[10px] tracking-wider">Calculation Breakdown:</span>
                <span className="text-ink font-mono-nums">{calcResult.workingDays} Net Working Days</span>
              </div>
              <div className="text-muted text-[11px] flex justify-between">
                <span>Total Span: {calcResult.calendarDays} Calendar Days</span>
                <span>Weekends: Automatically Excluded</span>
              </div>
            </div>
          )}

          {/* Public Holiday Exclusion Notification */}
          {calcResult && calcResult.holidaysEncountered.length > 0 && (
            <div className="p-3 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border border-[#007B58]/20 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                Gazetted Nigerian holiday detected ({calcResult.holidaysEncountered.join(', ')}). Excluded from quota deduction!
              </span>
            </div>
          )}

          {/* Zero-Overdraft Warning Banner */}
          {calcResult && activeBalance && calcResult.workingDays > activeBalance.availableDays && (
            <div className="p-3 rounded-[7px] bg-[#FFEDEF] dark:bg-[#40262E] text-[#B52F38] dark:text-[#FFACA9] border border-[#B52F38]/20 text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>
                Insufficient balance: Requested <strong>{calcResult.workingDays} days</strong> exceeds available{' '}
                <strong>{activeBalance.availableDays} days</strong>.
              </span>
            </div>
          )}

          {/* Casual Leave Limit Warning (> 2 Consecutive Working Days) */}
          {leaveTypeId === 'lt-casual' && calcResult && calcResult.workingDays > 2 && (
            <div className="p-3 rounded-[7px] bg-[#FFF8E6] dark:bg-[#3B3222] text-[#865600] dark:text-[#F3CE87] border border-[#865600]/20 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>Policy Notice: Casual leave cannot exceed 2 consecutive working days.</span>
            </div>
          )}

          {/* Sick Leave Medical Certificate Requirement (> 2 Consecutive Working Days) */}
          {leaveTypeId === 'lt-sick' && calcResult && calcResult.workingDays > 2 && (
            <div className="space-y-1.5">
              <div className="p-3 rounded-[7px] bg-accent-soft text-brand border border-brand/20 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>Doctor's certificate mandatory for sick leave exceeding 2 consecutive working days.</span>
              </div>
              <Input
                label="Medical Certificate Document URL / Reference"
                placeholder="e.g. https://storage.nexusfinance.ng/uploads/med-cert-442.pdf"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                required
              />
            </div>
          )}

          {/* Relief / Handover Officer */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Relief / Handover Officer
            </label>
            <select
              value={reliefOfficer}
              onChange={(e) => setReliefOfficer(e.target.value)}
              className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
            >
              <option value="Bisi Adeleke (Credit Underwriter)">Bisi Adeleke (Credit Underwriter)</option>
              <option value="Chidi Okoye (Risk Analyst)">Chidi Okoye (Risk Analyst)</option>
              <option value="Fatima Haruna (Operations Desk)">Fatima Haruna (Operations Desk)</option>
              <option value="Tari Briggs (Software Engineer)">Tari Briggs (Software Engineer)</option>
            </select>
          </div>

          {/* Reason & Handover Commitments */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Reason &amp; Handover Notes
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the purpose of your leave and operational handover commitments..."
              className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand placeholder:text-muted/60"
              required
            />
          </div>

          {/* Drawer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-rule">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
            >
              Submit for Manager Approval
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={!!cancelModalItem}
        onClose={() => setCancelModalItem(null)}
        title="Cancel Leave Request"
        description={`Release reserved time-off for ${cancelModalItem?.requestNumber || cancelModalItem?.id}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-[7px] bg-subtle border border-rule text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Total Reserved Days:</span>
              <span className="font-bold font-mono-nums text-ink">{cancelModalItem?.totalDays} Working Days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Duration:</span>
              <span className="font-mono-nums text-ink">
                {cancelModalItem?.startDate} &rarr; {cancelModalItem?.endDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Category:</span>
              <span className="font-semibold text-ink">{cancelModalItem?.leaveTypeId}</span>
            </div>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Cancelling this request will immediately release all reserved days back into your available leave quota.
          </p>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Reason for Cancellation (Optional)
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Shifted vacation dates, project deadline"
              className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand placeholder:text-muted/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule">
            <Button variant="ghost" onClick={() => setCancelModalItem(null)}>
              Keep Request
            </Button>
            <Button variant="danger" onClick={handleConfirmCancel} isLoading={isCancelling}>
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </PortalLayout>
  );
};
