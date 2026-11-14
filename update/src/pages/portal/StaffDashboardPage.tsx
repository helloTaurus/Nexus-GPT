import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CalendarCheck,
  Receipt,
  Star,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle,
  ClockCountdown,
  CurrencyNgn,
  ShieldCheck,
  FileText,
  User,
  Calendar,
  Sparkle,
} from '@phosphor-icons/react';
import { PortalLayout } from '../../components/layout/PortalLayout';
import { Button, Card, Badge, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { clientStore } from '../../lib/clientStore';
import {
  SEED_NIGERIAN_HOLIDAYS_2026,
  type LeaveBalance,
  type LeaveRequest,
  type NigerianHoliday,
} from '../../lib/leaveTypes';
import type { DailyAttendanceSummary } from '../../lib/attendanceTypes';


export interface StaffDashboardPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
  userRole?: string;
  userName?: string;
}

export const StaffDashboardPage: React.FC<StaffDashboardPageProps> = ({
  currentPath = '/portal/dashboard',
  onNavigate,
  userRole: propUserRole,
  userName: propUserName,
}) => {
  const [attendance, setAttendance] = useState<DailyAttendanceSummary | null>(null);
  const [isClockSubmitting, setIsClockSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Server Data States
  const [isLoading, setIsLoading] = useState(true);
  const [annualBalance, setAnnualBalance] = useState<LeaveBalance | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  // Live active timer interval for clocked in state
  useEffect(() => {
    if (!attendance?.clockedIn || !attendance.activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(attendance.activeSession.clockIn).getTime();
    const updateElapsed = () => {
      const nowMs = Date.now();
      const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);
    return () => clearInterval(intervalId);
  }, [attendance?.clockedIn, attendance?.activeSession]);

  const handleToggleClock = async () => {
    if (isClockSubmitting) return;
    setIsClockSubmitting(true);
    try {
      if (!attendance?.clockedIn) {
        const updated = await api.attendance.clockIn();
        setAttendance(updated);
      } else {
        const updated = await api.attendance.clockOut();
        setAttendance(updated);
        setElapsedSeconds(0);
      }
    } catch (err) {
      console.error('[Staff Attendance] Clock action error:', err);
    } finally {
      setIsClockSubmitting(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([
      api.profile.get().catch(() => null),
      api.leaves.getBalances().catch(() => []),
      api.leaves.getRequests('mine').catch(() => []),
      api.attendance.getToday().catch(() => null),
    ])
      .then(([prof, balances, requests, todayAttendance]) => {
        if (!isCurrent) return;
        if (prof) setCurrentProfile(prof);
        if (todayAttendance) setAttendance(todayAttendance);

        const annual = balances.find((b: LeaveBalance) => b.leaveTypeId === 'lt-annual');
        if (annual) setAnnualBalance(annual);

        if (Array.isArray(requests)) {
          // Sort descending by submittedAt or ID
          const sorted = [...requests].sort((a, b) => {
            const timeA = new Date(a.submittedAt || 0).getTime();
            const timeB = new Date(b.submittedAt || 0).getTime();
            return timeB - timeA;
          });
          setRecentLeaves(sorted.slice(0, 3));
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);


  // Compute upcoming Nigerian public holiday for FY 2026
  const getNextHoliday = (): { holiday: NigerianHoliday; daysAway: number } => {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = SEED_NIGERIAN_HOLIDAYS_2026.filter((h) => h.date >= today);
    const target = upcoming.length > 0 ? upcoming[0] : SEED_NIGERIAN_HOLIDAYS_2026[0];

    const targetDate = new Date(target.date).getTime();
    const now = new Date(today).getTime();
    const diffDays = Math.max(0, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)));

    return { holiday: target, daysAway: diffDays };
  };

  const nextHolidayInfo = getNextHoliday();

  const activeUser = clientStore.getActiveUser();
  const displayName = currentProfile
    ? `${currentProfile.firstName} ${currentProfile.lastName}`
    : propUserName ||
      (activeUser ? `${activeUser.profile.firstName} ${activeUser.profile.lastName}` : 'Oluwaseun Bakare');
  const staffId = currentProfile?.staffId || activeUser?.profile.staffId || 'NX-1042';
  const department = currentProfile?.department || activeUser?.profile.department || 'Credit Risk & Underwriting';
  const designation = currentProfile?.designation || activeUser?.profile.designation || propUserRole || 'Credit Risk Officer';

  // Annual balance math
  const availableDays = annualBalance ? annualBalance.availableDays : 20;
  const totalAllocated = annualBalance
    ? annualBalance.allocatedDays + (annualBalance.carriedOverDays || 0)
    : 20;
  const pendingDays = annualBalance ? annualBalance.pendingDays : 0;
  const balancePct = Math.min(100, Math.max(0, (availableDays / (totalAllocated || 1)) * 100));

  // Attendance calculation & formatting
  const clockTime = attendance?.activeSession?.clockIn
    ? new Date(attendance.activeSession.clockIn).toLocaleTimeString('en-NG', {
        timeZone: 'Africa/Lagos',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const completedMinutes = attendance?.completedMinutesWorked ?? 0;
  const currentElapsedMinutes = attendance?.clockedIn ? Math.floor(elapsedSeconds / 60) : 0;
  const totalDailyMinutes = completedMinutes + currentElapsedMinutes;
  const totalDailyHours = Math.floor(totalDailyMinutes / 60);
  const totalDailyRemainingMins = totalDailyMinutes % 60;
  const formattedDailyHours = `${totalDailyHours}h ${String(totalDailyRemainingMins).padStart(2, '0')}m`;

  const activeHours = Math.floor(elapsedSeconds / 3600);
  const activeMinutes = Math.floor((elapsedSeconds % 3600) / 60);
  const activeSecs = elapsedSeconds % 60;
  const activeTimerDisplay = `${String(activeHours).padStart(2, '0')}:${String(activeMinutes).padStart(2, '0')}:${String(activeSecs).padStart(2, '0')}`;

  return (
    <PortalLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      userRole={designation}
      userName={displayName}
      staffId={staffId}
      department={department}
    >
      {/* Top Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-[12px] bg-gradient-to-br from-surface to-surface border border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-brand bg-accent-soft px-2.5 py-0.5 rounded border border-brand/25">
              Employee Self-Service
            </span>
            <span className="text-xs text-muted font-mono-nums">ID: {staffId}</span>

            {/* Resumption Schedule Badge */}
            {attendance?.resumptionStatus === 'ON_TIME' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] border border-[#007B58]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#007B58] dark:bg-[#69D3B0]" />
                On Time
              </span>
            )}
            {attendance?.resumptionStatus === 'LATE' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FFF8E6] dark:bg-[#3B3222] text-[#865600] dark:text-[#F3CE87] border border-[#865600]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#865600] dark:bg-[#F3CE87]" />
                Late Resumption (+{attendance.lateMinutes}m)
              </span>
            )}
            {attendance?.resumptionStatus === 'WEEKEND_DUTY' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-accent-soft text-brand border border-brand/20">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                Weekend Duty
              </span>
            )}
            {(!attendance?.resumptionStatus || attendance?.resumptionStatus === 'NOT_RESUMED') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-subtle text-muted border border-rule">
                {attendance?.isWeekend ? 'Weekend Duty Shift' : 'Shift: 8:00 AM – 5:00 PM'}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Welcome back, {displayName.split(' ')[0]}
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Department of {department} &bull; Abuja Head Office
          </p>
        </div>

        {/* Quick Action: Attendance Clock & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Live Attendance pill / daily hours summary */}
          <div className="flex items-center gap-2 bg-subtle/80 px-3 py-2 rounded-[8px] border border-rule text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                attendance?.clockedIn ? 'bg-[#007B58] animate-pulse' : 'bg-muted'
              }`}
            />
            <span className="font-semibold text-ink">
              {attendance?.clockedIn ? `Session: ${activeTimerDisplay}` : 'Off Duty'}
            </span>
            <span className="text-muted font-mono-nums">
              &bull; Today: {formattedDailyHours}
            </span>
          </div>

          <Button
            variant={attendance?.clockedIn ? 'danger' : 'success'}
            size="md"
            onClick={handleToggleClock}
            isLoading={isClockSubmitting}
            disabled={isClockSubmitting}
            leftIcon={<Clock className="w-4 h-4" />}
          >
            {attendance?.clockedIn
              ? `Clock Out (In at ${clockTime || 'Today'})`
              : 'Clock In for Today'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('/portal/leave')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Apply Leave
          </Button>
        </div>
      </div>


      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Live Annual Leave Balance */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/portal/leave')}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Annual Leave Balance
            </span>
            <div className="w-9 h-9 rounded-[7px] bg-accent-soft text-brand flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton height={36} className="mb-2" />
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-ink font-display font-mono-nums">
                  {availableDays}
                </span>
                <span className="text-xs text-muted">/ {totalAllocated} Days Available</span>
              </div>
              <div className="w-full bg-subtle rounded-full h-1.5 mt-4 overflow-hidden">
                <div
                  className="bg-[#0D51B2] h-full rounded-full transition-all duration-300"
                  style={{ width: `${balancePct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{pendingDays > 0 ? `${pendingDays}d pending approval` : '0 days pending'}</span>
                <span className="text-brand font-semibold flex items-center gap-1">
                  View balance &rarr;
                </span>
              </div>
            </>
          )}
        </Card>

        {/* Metric 2: Upcoming 2026 Nigerian Statutory Holiday Widget */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/portal/leave')}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Next Statutory Holiday
            </span>
            <div className="w-9 h-9 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold text-ink font-display truncate" title={nextHolidayInfo.holiday.name}>
              {nextHolidayInfo.holiday.name}
            </div>
            <div className="text-xs text-[#007B58] dark:text-[#69D3B0] font-semibold flex items-center gap-1">
              <Sparkle className="w-3.5 h-3.5" />
              <span>{nextHolidayInfo.holiday.dayOfWeek}, {nextHolidayInfo.holiday.date}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-rule text-xs text-muted flex items-center justify-between">
            <span className="font-mono-nums">{nextHolidayInfo.daysAway} days countdown</span>
            <span className="text-brand font-semibold">Exempt from quota &rarr;</span>
          </div>
        </Card>

        {/* Metric 3: Expenses Reimbursed */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/portal/expenses')}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Reimbursed YTD
            </span>
            <div className="w-9 h-9 rounded-[7px] bg-[#E6F7F1] dark:bg-[#16382F] text-[#007B58] dark:text-[#69D3B0] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-semibold text-ink font-display font-mono-nums">
              ₦485,000.00
            </span>
          </div>
          <p className="text-xs text-muted mt-2">
            3 claims disbursed via NIBSS; 1 pending review (₦45,000.00).
          </p>
          <div className="mt-3 text-brand text-xs font-semibold flex items-center gap-1">
            <span>Manage expense claims &rarr;</span>
          </div>
        </Card>

        {/* Metric 4: Appraisal Review */}
        <Card variant="interactive" padding="md" onClick={() => onNavigate('/portal/appraisals')}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Appraisal Status
            </span>
            <div className="w-9 h-9 rounded-[7px] bg-[#FFF8E6] dark:bg-[#3B3222] text-[#865600] dark:text-[#F3CE87] flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold text-ink font-display">
              Q4 2026 Calibration Cycle
            </div>
            <Badge variant="pending" size="sm">
              Self-Review In Progress
            </Badge>
          </div>
          <div className="mt-4 pt-3 border-t border-rule text-xs text-muted flex items-center justify-between">
            <span>Deadline: Nov 28, 2026</span>
            <span className="text-brand font-semibold">Open evaluation &rarr;</span>
          </div>
        </Card>
      </div>

      {/* Two Column Layout: Recent Leave & Expense Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leave Requests Stream */}
        <Card variant="surface" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-brand" />
              <span>Recent Leave Submissions</span>
            </h3>
            <button
              onClick={() => onNavigate('/portal/leave')}
              className="text-xs text-brand font-semibold hover:underline cursor-pointer"
            >
              View All &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-[7px] bg-subtle border border-rule">
                  <Skeleton height={20} />
                </div>
              ))
            ) : recentLeaves.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted space-y-2">
                <p>No leave requests filed yet for fiscal year 2026.</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('/portal/leave')}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  File Your First Leave
                </Button>
              </div>
            ) : (
              recentLeaves.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-[7px] bg-subtle border border-rule flex items-center justify-between transition-colors hover:bg-subtle/80"
                >
                  <div>
                    <div className="font-semibold text-xs text-ink">{req.leaveTypeId}</div>
                    <div className="text-[11px] text-muted font-mono-nums">
                      {req.startDate} &ndash; {req.endDate} ({req.totalDays} Working Days)
                    </div>
                  </div>
                  <Badge
                    variant={
                      req.status === 'APPROVED'
                        ? 'approved'
                        : req.status === 'SUBMITTED'
                        ? 'pending'
                        : req.status === 'REJECTED'
                        ? 'rejected'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {req.status === 'SUBMITTED'
                      ? 'Pending Review'
                      : req.status === 'APPROVED'
                      ? 'Approved'
                      : req.status === 'REJECTED'
                      ? 'Rejected'
                      : 'Cancelled'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Expense Claims Stream */}
        <Card variant="surface" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand" />
              <span>Recent Expense Reimbursements</span>
            </h3>
            <button
              onClick={() => onNavigate('/portal/expenses')}
              className="text-xs text-brand font-semibold hover:underline cursor-pointer"
            >
              View All &rarr;
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-[7px] bg-subtle border border-rule flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink">Kano Regional Command Audit Transit</div>
                <div className="text-[11px] text-muted font-mono-nums">EXP-2026-0089 &bull; Nov 05, 2026</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-ink font-mono-nums">₦45,000.00</div>
                <Badge variant="pending" size="sm">
                  Manager Review
                </Badge>
              </div>
            </div>

            <div className="p-3.5 rounded-[7px] bg-subtle border border-rule flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink">Office IT Consumables &amp; Token Cables</div>
                <div className="text-[11px] text-muted font-mono-nums">EXP-2026-0074 &bull; Oct 20, 2026</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-ink font-mono-nums">₦28,500.00</div>
                <Badge variant="approved" size="sm">
                  Disbursed
                </Badge>
              </div>
            </div>

            <div className="p-3.5 rounded-[7px] bg-subtle border border-rule flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink">Client Underwriting Hospitality Dinner</div>
                <div className="text-[11px] text-muted font-mono-nums">EXP-2026-0061 &bull; Oct 02, 2026</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-ink font-mono-nums">₦32,000.00</div>
                <Badge variant="approved" size="sm">
                  Disbursed
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
};
