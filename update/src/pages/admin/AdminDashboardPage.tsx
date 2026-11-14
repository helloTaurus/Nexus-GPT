import React, { useEffect, useState } from 'react';
import {
  UsersThree,
  CalendarCheck,
  Receipt,
  Star,
  ShieldCheck,
  CheckCircle,
  Plus,
  ArrowRight,
  Spinner,
  WarningCircle,
} from '@phosphor-icons/react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button, Card, Badge } from '../../components/ui';
import { api } from '../../lib/api';
import type { AdminMetricsData } from '../../lib/workforceTypes';

export interface AdminDashboardPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
  userRole?: string;
  userName?: string;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  currentPath = '/admin/dashboard',
  onNavigate,
  userRole,
  userName,
}) => {
  const [metrics, setMetrics] = useState<AdminMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadMetrics() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await api.admin.getMetrics();
        if (mounted) setMetrics(data);
      } catch (err: any) {
        if (mounted) setErrorMsg(err?.message || 'Failed to load dashboard metrics');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadMetrics();
    return () => { mounted = false; };
  }, []);

  const m = metrics;
  const totalWorkforce = m?.totalWorkforce ?? 0;
  const activeStaff = m?.activeStaff ?? 0;
  const staffOnLeave = m?.staffOnLeave ?? 0;
  const pendingLeavesCount = m?.pendingLeavesCount ?? 0;
  const expenseQueueCount = m?.expenseQueueCount ?? 0;
  const expenseQueueTotal = m?.expenseQueueTotalAmount ?? 0;
  const activeCycle = m?.activeAppraisalCycle ?? null;
  const reviewQueue = m?.pendingReviewQueue ?? [];
  const auditLogs = m?.recentAuditLogs ?? [];

  return (
    <AdminLayout currentPath={currentPath} onNavigate={onNavigate} userRole={userRole} userName={userName}>
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-[12px] bg-gradient-to-br from-surface to-surface border border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-brand bg-accent-soft px-2.5 py-0.5 rounded border border-brand/25">
              Executive Governance
            </span>
            <span className="text-xs text-muted font-mono-nums">Abuja Central Office</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            HRMS &amp; Operations Control Console
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Global workforce management, multi-tier approvals, policy calibration, and security audit log streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => onNavigate('/admin/audit-logs')}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Audit Trail
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('/admin/employees')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Staff
          </Button>
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted py-2">
          <Spinner className="w-4 h-4 animate-spin" />
          <span>Loading live metrics…</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-[7px] bg-[#FFEDEF] text-[#B52F38] text-xs font-medium flex items-center gap-2 border border-[#FFACA9]">
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 Executive Metric Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 – Workforce */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/admin/employees')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total Workforce
            </span>
            <div className="w-8 h-8 rounded-[7px] bg-accent-soft text-brand flex items-center justify-center">
              <UsersThree className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-ink font-display font-mono-nums">
            {loading ? '—' : totalWorkforce}
          </div>
          <div className="text-xs text-[#007B58] dark:text-[#69D3B0] font-semibold mt-2">
            {loading ? '—' : `${activeStaff} Active • ${staffOnLeave} on Leave`}
          </div>
        </Card>

        {/* Metric 2 – Pending Leaves */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/admin/leave-approvals')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Pending Leaves
            </span>
            <div className="w-8 h-8 rounded-[7px] bg-[#FFF8E6] dark:bg-[#3B3222] text-[#865600] dark:text-[#F3CE87] flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-ink font-display font-mono-nums">
            {loading ? '—' : pendingLeavesCount}
          </div>
          <div className="text-xs text-[#865600] dark:text-[#F3CE87] font-semibold mt-2">
            {pendingLeavesCount === 0 ? 'No pending leave requests' : 'Requires Manager Review'}
          </div>
        </Card>

        {/* Metric 3 – Expense Queue */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/admin/expense-approvals')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Expense Claims Queue
            </span>
            <div className="w-8 h-8 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-ink font-display font-mono-nums">
            {loading ? '—' : expenseQueueCount === 0 ? '₦0.00' : `₦${expenseQueueTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-xs text-brand font-semibold mt-2">
            {loading ? '—' : expenseQueueCount === 0 ? 'No claims queued' : `${expenseQueueCount} ${expenseQueueCount === 1 ? 'Claim' : 'Claims'} Queued for Review`}
          </div>
        </Card>

        {/* Metric 4 – Appraisal Cycle */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/admin/appraisals')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Active Appraisal Cycle
            </span>
            <div className="w-8 h-8 rounded-[7px] bg-accent-soft text-brand flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-semibold text-ink font-display">
            {loading ? '—' : activeCycle ? activeCycle.title : 'No Active Cycle'}
          </div>
          <div className="text-xs text-muted mt-2">
            {loading ? '—' : activeCycle ? `${activeCycle.completionRate}% Submissions Completed` : 'Create a cycle in Appraisal Calibration'}
          </div>
        </Card>
      </div>

      {/* Two Column Grid: Pending Action Queue & DevSecOps Event Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approval Action Queue */}
        <Card variant="surface" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand" />
              <span>Pending Executive Review Queue</span>
            </h3>
            <button
              onClick={() => onNavigate('/admin/leave-approvals')}
              className="text-xs text-brand font-semibold hover:underline cursor-pointer"
            >
              Open Full Queue
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {loading ? (
              <div className="flex items-center gap-2 text-muted py-4">
                <Spinner className="w-3 h-3 animate-spin" />
                <span>Loading queue…</span>
              </div>
            ) : reviewQueue.length === 0 ? (
              <div className="p-4 rounded-[7px] bg-subtle border border-rule text-center text-muted">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-[#007B58]" />
                <div className="font-semibold text-ink text-sm">All caught up!</div>
                <div className="text-[11px] mt-1">No pending leave or expense approvals.</div>
              </div>
            ) : (
              reviewQueue.slice(0, 5).map((item) => (
                <div key={item.id} className="p-3.5 rounded-[7px] bg-subtle border border-rule flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink truncate">{item.title}</div>
                    <div className="text-[11px] text-muted mt-0.5 truncate">{item.subtitle}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={item.type === 'LEAVE' ? 'pending' : 'brand'} size="sm">
                      {item.type === 'LEAVE' ? 'Leave' : 'Expense'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => onNavigate(item.link)}>
                      Review
                    </Button>
                  </div>
                </div>
              ))
            )}
            {reviewQueue.length > 5 && (
              <button
                onClick={() => onNavigate('/admin/leave-approvals')}
                className="w-full text-center text-xs text-brand font-semibold py-2 hover:underline flex items-center justify-center gap-1"
              >
                View {reviewQueue.length - 5} more <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </Card>

        {/* DevSecOps Immutable Event Stream */}
        <Card variant="surface" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>DevSecOps Audit Event Stream</span>
            </h3>
            <button
              onClick={() => onNavigate('/admin/audit-logs')}
              className="text-xs text-brand font-semibold hover:underline cursor-pointer"
            >
              All Security Logs
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {loading ? (
              <div className="flex items-center gap-2 text-muted py-4">
                <Spinner className="w-3 h-3 animate-spin" />
                <span>Loading audit stream…</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-4 rounded-[7px] bg-subtle border border-rule text-center text-muted">
                <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-brand" />
                <div className="font-semibold text-ink text-sm">Audit Stream Empty</div>
                <div className="text-[11px] mt-1">No recorded security events yet.</div>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-[7px] bg-subtle border border-rule font-mono-nums">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-brand">{log.action}</span>
                    <span className="text-muted">{new Date(log.timestamp).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} WAT</span>
                  </div>
                  <div className="text-ink font-sans mt-1 truncate">
                    Actor: <span className="font-semibold">{log.actorEmail}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};
