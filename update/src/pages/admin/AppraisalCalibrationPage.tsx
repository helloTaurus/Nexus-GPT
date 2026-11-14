import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Trophy,
  ChartBar,
  UsersThree,
  CheckCircle,
  Plus,
  MagnifyingGlass,
  Sliders,
  FileArrowDown,
  X,
  WarningCircle,
  CalendarCheck
} from '@phosphor-icons/react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type {
  AppraisalCycle,
  AppraisalSubmission,
  CreateCyclePayload,
  CalibrateScorePayload
} from '../../lib/appraisalTypes';

export interface AppraisalCalibrationPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const AppraisalCalibrationPage: React.FC<AppraisalCalibrationPageProps> = ({
  currentPath = '/admin/appraisals',
  onNavigate,
}) => {
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<AppraisalCycle | null>(null);
  const [submissions, setSubmissions] = useState<AppraisalSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  // Modal / Drawer state
  const [selectedSubmission, setSelectedSubmission] = useState<AppraisalSubmission | null>(null);
  const [calibrationScore, setCalibrationScore] = useState<number>(4.2);
  const [calibrationNotes, setCalibrationNotes] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);

  // New Cycle Modal state
  const [isNewCycleOpen, setIsNewCycleOpen] = useState(false);
  const [newCycle, setNewCycle] = useState<CreateCyclePayload>({
    title: 'Q4 2026 Annual Performance Cycle',
    cycleType: 'ANNUAL',
    fiscalYear: 2026,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    selfAppraisalDeadline: '2026-11-15',
    managerReviewDeadline: '2026-11-30',
    kraWeightagePercent: 70,
    competencyWeightagePercent: 30,
  });
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);

  // Initial Data Fetching
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [cyclesData, subsData] = await Promise.allSettled([
        api.appraisals.getCycles(),
        api.appraisals.getTeamSubmissions(),
      ]);

      if (cyclesData.status === 'fulfilled' && cyclesData.value.length > 0) {
        setCycles(cyclesData.value);
        const active = cyclesData.value.find((c) => c.status === 'ACTIVE') || cyclesData.value[0];
        setActiveCycle(active);
      }

      if (subsData.status === 'fulfilled') {
        setSubmissions(subsData.value);
      } else {
        // Fallback seed team submissions if empty in-memory
        setSubmissions([
          {
            id: 'sub-emp-01-2026',
            cycleId: 'cycle-annual-2026',
            employeeId: 'emp-employee-01',
            employeeName: 'Oluwaseun Bakare',
            employeeEmail: 'employee@nexusfinance.ng',
            department: 'Credit Risk & Underwriting',
            designation: 'Risk Analyst',
            managerId: 'emp-manager-01',
            managerName: 'Ibrahim Danladi',
            status: 'CALIBRATION_PENDING',
            selfScore: 4.25,
            managerScore: 4.10,
            managerSummaryFeedback: 'Demonstrated superior underwriting accuracy and turnaround times. Recommending Grade A promotion.',
            goals: [],
          },
          {
            id: 'sub-emp-02-2026',
            cycleId: 'cycle-annual-2026',
            employeeId: 'emp-employee-02',
            employeeName: 'Chioma Okonkwo',
            employeeEmail: 'chioma.okonkwo@nexusfinance.ng',
            department: 'Credit Risk & Underwriting',
            designation: 'Credit Underwriter',
            managerId: 'emp-manager-01',
            managerName: 'Ibrahim Danladi',
            status: 'CALIBRATION_PENDING',
            selfScore: 3.90,
            managerScore: 3.80,
            managerSummaryFeedback: 'Solid portfolio performance, met all target disbursement limits.',
            goals: [],
          },
          {
            id: 'sub-emp-03-2026',
            cycleId: 'cycle-annual-2026',
            employeeId: 'emp-depthead-01',
            employeeName: 'David Nwokeukwu',
            employeeEmail: 'depthead@nexusfinance.ng',
            department: 'Credit Risk & Underwriting',
            designation: 'Head of Underwriting',
            managerId: 'emp-admin-01',
            managerName: 'Henrietta Okolo',
            status: 'COMPLETED',
            selfScore: 4.75,
            managerScore: 4.60,
            finalCalibratedScore: 4.65,
            calibrationNotes: 'Executive governance confirmed Grade A outstanding contribution.',
            goals: [],
          },
          {
            id: 'sub-emp-04-2026',
            cycleId: 'cycle-annual-2026',
            employeeId: 'emp-finance-01',
            employeeName: 'Amina Bello',
            employeeEmail: 'finance@nexusfinance.ng',
            department: 'Finance & Accounts',
            designation: 'Senior Accountant',
            managerId: 'emp-admin-01',
            managerName: 'Henrietta Okolo',
            status: 'COMPLETED',
            selfScore: 3.50,
            managerScore: 3.45,
            finalCalibratedScore: 3.50,
            calibrationNotes: 'Meets expectations in financial reconciliations and auditing.',
            goals: [],
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load calibration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute distribution tiers from current submissions
  const distributionStats = useMemo(() => {
    const total = submissions.length || 1;
    let t1 = 0; // >= 4.5
    let t2 = 0; // 3.8 - 4.49
    let t3 = 0; // 3.0 - 3.79
    let t4 = 0; // < 3.0

    for (const s of submissions) {
      const score = s.finalCalibratedScore ?? s.managerScore ?? s.selfScore ?? 3.5;
      if (score >= 4.5) t1++;
      else if (score >= 3.8) t2++;
      else if (score >= 3.0) t3++;
      else t4++;
    }

    return [
      {
        name: 'Exceeds Expectations (Tier 1)',
        scoreRange: '4.50 – 5.00',
        count: t1,
        actualPercent: Math.round((t1 / total) * 100),
        targetPercent: 15,
        badge: 'approved' as const,
        grade: 'Grade A',
      },
      {
        name: 'Strong Performer (Tier 2)',
        scoreRange: '3.80 – 4.49',
        count: t2,
        actualPercent: Math.round((t2 / total) * 100),
        targetPercent: 48,
        badge: 'brand' as const,
        grade: 'Grade B',
      },
      {
        name: 'Meets Expectations (Tier 3)',
        scoreRange: '3.00 – 3.79',
        count: t3,
        actualPercent: Math.round((t3 / total) * 100),
        targetPercent: 31,
        badge: 'neutral' as const,
        grade: 'Grade C',
      },
      {
        name: 'Needs Improvement (Tier 4)',
        scoreRange: '1.00 – 2.99',
        count: t4,
        actualPercent: Math.round((t4 / total) * 100),
        targetPercent: 6,
        badge: 'rejected' as const,
        grade: 'Grade D',
      },
    ];
  }, [submissions]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const name = (sub.employeeName || sub.employeeId).toLowerCase();
      const email = (sub.employeeEmail || '').toLowerCase();
      const id = sub.employeeId.toLowerCase();
      const matchesSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase()) || id.includes(search.toLowerCase());
      const matchesDept = filterDept === 'All' || sub.department === filterDept;

      let matchesStatus = true;
      if (statusTab === 'PENDING') {
        matchesStatus = sub.status === 'CALIBRATION_PENDING';
      } else if (statusTab === 'COMPLETED') {
        matchesStatus = sub.status === 'COMPLETED';
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [submissions, search, filterDept, statusTab]);

  const handleOpenCalibration = (sub: AppraisalSubmission) => {
    setSelectedSubmission(sub);
    const initialScore = sub.finalCalibratedScore ?? sub.managerScore ?? sub.selfScore ?? 4.0;
    setCalibrationScore(initialScore);
    setCalibrationNotes(sub.calibrationNotes || '');
  };

  const handleSaveCalibration = async () => {
    if (!selectedSubmission) return;
    setIsCalibrating(true);
    setErrorMsg(null);
    try {
      const updated = await api.appraisals.calibrateScore(selectedSubmission.id, {
        finalCalibratedScore: Number(calibrationScore.toFixed(2)),
        calibrationNotes,
      });

      setSubmissions((prev) =>
        prev.map((s) => (s.id === selectedSubmission.id ? { ...s, ...updated } : s))
      );
      setSelectedSubmission(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to calibrate score');
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCycle.kraWeightagePercent! + newCycle.competencyWeightagePercent! !== 100) {
      setErrorMsg('KRA and Competency weightages must total exactly 100%');
      return;
    }

    setIsCreatingCycle(true);
    setErrorMsg(null);
    try {
      const created = await api.appraisals.createCycle(newCycle);
      setCycles((prev) => [created, ...prev]);
      setActiveCycle(created);
      setIsNewCycleOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create new cycle');
    } finally {
      setIsCreatingCycle(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Staff Name', 'Employee ID', 'Email', 'Department', 'Self Score', 'Manager Score', 'Final Calibrated Score', 'Status'];
    const rows = filteredSubmissions.map((s) => [
      s.employeeName || s.employeeId,
      s.employeeId,
      s.employeeEmail || '',
      s.department || '',
      s.selfScore ?? '',
      s.managerScore ?? '',
      s.finalCalibratedScore ?? '',
      s.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_appraisal_calibration_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const departments = Array.from(new Set(submissions.map((s) => s.department).filter(Boolean)));

  return (
    <AdminLayout currentPath={currentPath} onNavigate={onNavigate}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Performance Appraisal &amp; Calibration Grid
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Executive performance normalization, 70/30 KRA scoring aggregation, and corporate cycle governance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="pending" size="md">
            {activeCycle?.title || 'Q4 2026 Annual Performance Cycle'}
          </Badge>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewCycleOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New Cycle
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-[7px] bg-[#FFEDEF] text-[#B52F38] text-xs font-medium flex items-center gap-2 border border-[#FFACA9]">
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Calibration Distribution Grid (4 Tiers with Bell-Curve Visualizer) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {distributionStats.map((tier) => (
          <Card key={tier.name} variant="surface" padding="md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {tier.name}
              </span>
              <Badge variant={tier.badge} size="sm">
                {tier.grade}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-semibold text-ink font-display font-mono-nums">
                {tier.count}
              </span>
              <span className="text-xs text-muted">Staff ({tier.actualPercent}%)</span>
            </div>

            <div className="mt-2 text-[10px] text-muted font-mono-nums">
              Score Range: {tier.scoreRange}
            </div>

            {/* Comparative Bar: Actual vs Target */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[10px] text-muted">
                <span>Actual: {tier.actualPercent}%</span>
                <span>Target: {tier.targetPercent}%</span>
              </div>
              <div className="w-full bg-subtle h-2 rounded-full overflow-hidden border border-rule relative">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    tier.actualPercent > tier.targetPercent + 10
                      ? 'bg-amber-500'
                      : tier.actualPercent < tier.targetPercent - 10
                      ? 'bg-blue-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, tier.actualPercent))}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Governance & Submissions Queue */}
      <Card variant="surface" padding="none">
        <div className="p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
              <ChartBar className="w-5 h-5 text-brand" />
              <span>Direct Reports Appraisal &amp; Calibration Queue</span>
            </h3>
            <p className="text-xs text-muted">
              Review and calibrate 70/30 composite scores submitted by line managers across corporate divisions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              leftIcon={<FileArrowDown className="w-4 h-4" />}
            >
              Export Scorecards (CSV)
            </Button>
          </div>
        </div>

        {/* Filter Controls & Tabs */}
        <div className="p-4 border-b border-rule flex flex-col md:flex-row items-center justify-between gap-4 bg-subtle/30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusTab('ALL')}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-colors cursor-pointer ${
                statusTab === 'ALL'
                  ? 'bg-action text-on-action shadow-sm'
                  : 'bg-subtle text-muted hover:text-ink border border-rule'
              }`}
            >
              All Submissions ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('PENDING')}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-colors cursor-pointer ${
                statusTab === 'PENDING'
                  ? 'bg-action text-on-action shadow-sm'
                  : 'bg-subtle text-muted hover:text-ink border border-rule'
              }`}
            >
              Calibration Pending ({submissions.filter((s) => s.status === 'CALIBRATION_PENDING').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('COMPLETED')}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-colors cursor-pointer ${
                statusTab === 'COMPLETED'
                  ? 'bg-action text-on-action shadow-sm'
                  : 'bg-subtle text-muted hover:text-ink border border-rule'
              }`}
            >
              Finalized ({submissions.filter((s) => s.status === 'COMPLETED').length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <MagnifyingGlass className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff name or ID..."
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule pl-9 pr-3.5 py-1.5 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              />
            </div>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="rounded-[7px] bg-subtle text-ink border border-rule px-3 py-1.5 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-subtle text-muted uppercase text-[10px] tracking-wider border-b border-rule">
              <tr>
                <th className="py-3 px-6 font-semibold">Staff Member</th>
                <th className="py-3 px-6 font-semibold">Staff ID</th>
                <th className="py-3 px-6 font-semibold">Department</th>
                <th className="py-3 px-6 font-semibold">Self Score</th>
                <th className="py-3 px-6 font-semibold">Manager Score (70/30)</th>
                <th className="py-3 px-6 font-semibold">Calibrated Score</th>
                <th className="py-3 px-6 font-semibold">Status</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-ink">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No appraisal submissions match the specified criteria.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-subtle/50 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-ink">{sub.employeeName || sub.employeeId}</div>
                      <div className="text-[11px] text-muted">{sub.employeeEmail || `${sub.employeeId}@nexusfinance.ng`}</div>
                    </td>
                    <td className="py-3.5 px-6 font-mono-nums font-semibold text-brand">
                      {sub.employeeId}
                    </td>
                    <td className="py-3.5 px-6">{sub.department || 'Operations'}</td>
                    <td className="py-3.5 px-6 font-mono-nums">
                      {sub.selfScore ? `${sub.selfScore.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-6 font-mono-nums font-semibold">
                      {sub.managerScore ? `${sub.managerScore.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3.5 px-6 font-mono-nums font-bold text-emerald-700">
                      {sub.finalCalibratedScore ? `${sub.finalCalibratedScore.toFixed(2)}` : 'Pending Lock'}
                    </td>
                    <td className="py-3.5 px-6">
                      <Badge
                        variant={
                          sub.status === 'COMPLETED'
                            ? 'approved'
                            : sub.status === 'CALIBRATION_PENDING'
                            ? 'pending'
                            : sub.status === 'SELF_SUBMITTED'
                            ? 'brand'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {sub.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenCalibration(sub)}
                        leftIcon={<Sliders className="w-3.5 h-3.5" />}
                      >
                        Calibrate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Calibration Review Drawer / Modal */}
      {selectedSubmission && (
        <Modal
          isOpen={Boolean(selectedSubmission)}
          onClose={() => setSelectedSubmission(null)}
          title="Executive Score Calibration Determination"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-[7px] bg-subtle border border-rule space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink text-sm">
                  {selectedSubmission.employeeName || selectedSubmission.employeeId}
                </span>
                <Badge variant="brand" size="sm">{selectedSubmission.employeeId}</Badge>
              </div>
              <div className="text-muted">
                {selectedSubmission.department} &bull; Manager: {selectedSubmission.managerName || 'Assigned Lead'}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rule font-mono-nums">
                <div>
                  <span className="text-[10px] text-muted uppercase block">Self-Appraisal Score:</span>
                  <span className="font-bold text-ink">{selectedSubmission.selfScore ?? '—'} / 5.00</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted uppercase block">Manager 70/30 Composite:</span>
                  <span className="font-bold text-brand">{selectedSubmission.managerScore ?? '—'} / 5.00</span>
                </div>
              </div>
            </div>

            {selectedSubmission.managerSummaryFeedback && (
              <div className="p-3 rounded-[7px] bg-accent-soft text-brand text-xs space-y-1">
                <span className="font-semibold block">Manager Qualitative Feedback:</span>
                <p className="leading-relaxed">{selectedSubmission.managerSummaryFeedback}</p>
              </div>
            )}

            {/* Interactive Calibration Controls */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-ink">Calibrated Score Target (1.00 - 5.00):</label>
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono-nums text-base text-brand">
                    {calibrationScore.toFixed(2)}
                  </span>
                  <Badge
                    variant={
                      calibrationScore >= 4.5
                        ? 'approved'
                        : calibrationScore >= 3.8
                        ? 'brand'
                        : calibrationScore >= 3.0
                        ? 'neutral'
                        : 'rejected'
                    }
                    size="sm"
                  >
                    {calibrationScore >= 4.5
                      ? 'Grade A (Exceeds)'
                      : calibrationScore >= 3.8
                      ? 'Grade B (Strong)'
                      : calibrationScore >= 3.0
                      ? 'Grade C (Meets)'
                      : 'Grade D (Improvement)'}
                  </Badge>
                </div>
              </div>

              <input
                type="range"
                min="1.00"
                max="5.00"
                step="0.05"
                value={calibrationScore}
                onChange={(e) => setCalibrationScore(parseFloat(e.target.value))}
                className="w-full accent-action cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink block">
                Executive Calibration Notes (Audit Trail Mandate):
              </label>
              <textarea
                rows={3}
                value={calibrationNotes}
                onChange={(e) => setCalibrationNotes(e.target.value)}
                placeholder="Detail committee rationale, bell-curve alignment, or performance improvement recommendations..."
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-rule">
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveCalibration}
                disabled={isCalibrating}
                leftIcon={<CheckCircle className="w-4 h-4" />}
              >
                {isCalibrating ? 'Locking Score...' : 'Lock Final Calibrated Score'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Cycle Modal */}
      <Modal
        isOpen={isNewCycleOpen}
        onClose={() => setIsNewCycleOpen(false)}
        title="Schedule Corporate Appraisal Cycle"
      >
        <form onSubmit={handleCreateCycle} className="space-y-3.5 text-xs font-sans">
          <div>
            <label className="font-semibold text-ink block mb-1">Cycle Title</label>
            <Input
              value={newCycle.title}
              onChange={(e) => setNewCycle({ ...newCycle, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Cycle Type</label>
              <select
                value={newCycle.cycleType}
                onChange={(e) => setNewCycle({ ...newCycle, cycleType: e.target.value as any })}
                className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-2 text-xs"
              >
                <option value="ANNUAL">Annual Review</option>
                <option value="MID_YEAR">Mid-Year Performance</option>
                <option value="PROBATION">Probation Sign-Off</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-ink block mb-1">Fiscal Year</label>
              <Input
                type="number"
                value={newCycle.fiscalYear}
                onChange={(e) => setNewCycle({ ...newCycle, fiscalYear: parseInt(e.target.value) || 2026 })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Start Date</label>
              <Input
                type="date"
                value={newCycle.startDate}
                onChange={(e) => setNewCycle({ ...newCycle, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="font-semibold text-ink block mb-1">End Date</label>
              <Input
                type="date"
                value={newCycle.endDate}
                onChange={(e) => setNewCycle({ ...newCycle, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">Self-Review Deadline</label>
              <Input
                type="date"
                value={newCycle.selfAppraisalDeadline}
                onChange={(e) => setNewCycle({ ...newCycle, selfAppraisalDeadline: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="font-semibold text-ink block mb-1">Manager Review Deadline</label>
              <Input
                type="date"
                value={newCycle.managerReviewDeadline}
                onChange={(e) => setNewCycle({ ...newCycle, managerReviewDeadline: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="p-3 rounded-[7px] bg-subtle border border-rule grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-ink block mb-1">KRA Weight (%)</label>
              <Input
                type="number"
                value={newCycle.kraWeightagePercent}
                onChange={(e) =>
                  setNewCycle({
                    ...newCycle,
                    kraWeightagePercent: parseInt(e.target.value) || 70,
                    competencyWeightagePercent: 100 - (parseInt(e.target.value) || 70),
                  })
                }
                min={0}
                max={100}
                required
              />
            </div>
            <div>
              <label className="font-semibold text-ink block mb-1">Competency Weight (%)</label>
              <Input
                type="number"
                value={newCycle.competencyWeightagePercent}
                readOnly
                className="opacity-70"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-rule">
            <Button variant="outline" onClick={() => setIsNewCycleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isCreatingCycle}>
              {isCreatingCycle ? 'Initializing Cycle...' : 'Launch Cycle'}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};
