import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  CheckCircle,
  Clock,
  Trophy,
  CaretRight,
  Sparkle,
  ShieldCheck,
  UserCheck,
  FloppyDisk,
  WarningCircle,
  ArrowRight
} from '@phosphor-icons/react';
import { PortalLayout } from '../../components/layout/PortalLayout';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import {
  type AppraisalSubmission,
  type AppraisalCycle,
  type AppraisalGoal,
  RATING_RUBRIC_TIERS
} from '../../lib/appraisalTypes';

export interface StaffAppraisalsPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

interface InstitutionalGoal {
  id: string;
  category: 'KRA' | 'COMPETENCY';
  title: string;
  weightage: number; // percentage within category
  description: string;
}

const INSTITUTIONAL_KRAS: InstitutionalGoal[] = [
  {
    id: 'kra-1',
    category: 'KRA',
    title: 'Operational Speed & Underwriting Quality (30% Weight)',
    weightage: 30,
    description: 'Render credit decisions within SLA while adhering strictly to KYC and credit bureau scoring standards.',
  },
  {
    id: 'kra-2',
    category: 'KRA',
    title: 'Regulatory & Risk Compliance (25% Weight)',
    weightage: 25,
    description: 'Zero breaches of Central Bank guidelines, NDPR data privacy standards, or AML/CFT identity protocols.',
  },
  {
    id: 'kra-3',
    category: 'KRA',
    title: 'Delinquency Containment & Recovery Support (25% Weight)',
    weightage: 25,
    description: 'Maintain assigned portfolio performing status above 98.0% and coordinate early alerts with Remediation.',
  },
  {
    id: 'kra-4',
    category: 'KRA',
    title: 'Innovation & Process Automation (20% Weight)',
    weightage: 20,
    description: 'Contribute iterative improvements to applicant scoring matrices and departmental knowledge bases.',
  },
];

const INSTITUTIONAL_COMPETENCIES: InstitutionalGoal[] = [
  {
    id: 'comp-1',
    category: 'COMPETENCY',
    title: 'Ethical Rigor & Regulatory Compliance (40% Weight)',
    weightage: 40,
    description: 'Demonstrates exemplary ethical integrity, risk transparency, and proactive internal audit cooperation.',
  },
  {
    id: 'comp-2',
    category: 'COMPETENCY',
    title: 'Cross-Functional Collaboration & Service Excellence (30% Weight)',
    weightage: 30,
    description: 'Works harmoniously across credit operations, branch network, and executive underwriting committees.',
  },
  {
    id: 'comp-3',
    category: 'COMPETENCY',
    title: 'Technical Innovation & Continuous Improvement (30% Weight)',
    weightage: 30,
    description: 'Adopts digital tools rapidly and advocates for algorithmic and automated credit enhancement pipelines.',
  },
];

export const StaffAppraisalsPage: React.FC<StaffAppraisalsPageProps> = ({
  currentPath = '/portal/appraisals',
  onNavigate,
}) => {
  const [submission, setSubmission] = useState<AppraisalSubmission | null>(null);
  const [cycle, setCycle] = useState<AppraisalCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [ratings, setRatings] = useState<Record<string, number>>({
    'kra-1': 4,
    'kra-2': 5,
    'kra-3': 4,
    'kra-4': 4,
    'comp-1': 5,
    'comp-2': 4,
    'comp-3': 4,
  });

  const [comments, setComments] = useState<Record<string, string>>({});
  const [selfComments, setSelfComments] = useState(
    'Maintained portfolio NPL ratio strictly at 1.1% over the past two quarters while accelerating average loan appraisal turnaround from 15 minutes to 7 minutes flat.'
  );

  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledgedSuccess, setAcknowledgedSuccess] = useState(false);

  // Load active cycle and employee submission from backend
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [cyclesRes, subRes] = await Promise.allSettled([
          api.appraisals.getCycles(),
          api.appraisals.getMySubmission(),
        ]);

        if (!isMounted) return;

        if (cyclesRes.status === 'fulfilled' && cyclesRes.value.length > 0) {
          const active = cyclesRes.value.find((c) => c.status === 'ACTIVE') || cyclesRes.value[0];
          setCycle(active);
        }

        if (subRes.status === 'fulfilled') {
          const sub = subRes.value;
          setSubmission(sub);
          if (sub.employeeComments) setSelfComments(sub.employeeComments);

          // Populate existing ratings if available
          if (sub.goals && sub.goals.length > 0) {
            const loadedRatings: Record<string, number> = {};
            const loadedComments: Record<string, string> = {};
            for (const g of sub.goals) {
              if (g.selfRating) loadedRatings[g.goalId] = g.selfRating;
              if (g.selfComments) loadedComments[g.goalId] = g.selfComments;
            }
            setRatings((prev) => ({ ...prev, ...loadedRatings }));
            setComments((prev) => ({ ...prev, ...loadedComments }));
          }
        }
      } catch (err: any) {
        if (isMounted) setErrorMsg(err.message || 'Failed to load appraisal data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRatingChange = (id: string, score: number) => {
    if (submission && submission.status !== 'NOT_STARTED') return; // Read-only once submitted
    setRatings((prev) => ({ ...prev, [id]: score }));
  };

  const handleCommentChange = (id: string, text: string) => {
    if (submission && submission.status !== 'NOT_STARTED') return;
    setComments((prev) => ({ ...prev, [id]: text }));
  };

  // Live 70/30 composite score calculations
  const { kraScore, compScore, compositeScore, performanceTier } = useMemo(() => {
    let kraSum = 0;
    for (const kra of INSTITUTIONAL_KRAS) {
      const score = ratings[kra.id] || 4;
      kraSum += score * (kra.weightage / 100);
    }

    let compSum = 0;
    for (const comp of INSTITUTIONAL_COMPETENCIES) {
      const score = ratings[comp.id] || 4;
      compSum += score * (comp.weightage / 100);
    }

    const kraWeighted = Number((kraSum * 0.7).toFixed(2));
    const compWeighted = Number((compSum * 0.3).toFixed(2));
    const overall = Number(((kraSum * 0.7) + (compSum * 0.3)).toFixed(2));

    let tierLabel = 'Tier 3: Meets Expectations';
    let tierVariant: 'approved' | 'brand' | 'neutral' | 'rejected' = 'neutral';
    if (overall >= 4.5) {
      tierLabel = 'Tier 1: Outstanding (Exceeds Expectations)';
      tierVariant = 'approved';
    } else if (overall >= 3.8) {
      tierLabel = 'Tier 2: Strong Performer';
      tierVariant = 'brand';
    } else if (overall < 3.0) {
      tierLabel = 'Tier 4: Needs Improvement';
      tierVariant = 'rejected';
    }

    return {
      kraScore: Number(kraSum.toFixed(2)),
      compScore: Number(compSum.toFixed(2)),
      compositeScore: overall,
      performanceTier: { label: tierLabel, variant: tierVariant },
    };
  }, [ratings]);

  const handleSaveDraft = () => {
    setIsSaved(true);
    try {
      localStorage.setItem('nexus_appraisal_draft', JSON.stringify({ ratings, comments, selfComments }));
    } catch {
      // Storage unavailable fallback
    }
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSubmitSelfAppraisal = async () => {
    if (!submission) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Build goal ratings array matching submission goal IDs or institutional fallback
      const payloadGoals = INSTITUTIONAL_KRAS.map((k) => ({
        goalId: k.id,
        selfRating: ratings[k.id] || 4,
        selfComments: comments[k.id] || '',
      }));

      const updated = await api.appraisals.submitSelfAppraisal(submission.id, {
        goals: payloadGoals,
        employeeComments: selfComments,
      });

      setSubmission(updated);
      setIsConfirmModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit self-appraisal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!submission) return;
    setIsAcknowledging(true);
    try {
      const updated = await api.appraisals.acknowledgeOutcome(submission.id);
      setSubmission(updated);
      setAcknowledgedSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to acknowledge outcome');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const currentStatus = submission?.status || 'NOT_STARTED';
  const isLocked = currentStatus !== 'NOT_STARTED';

  return (
    <PortalLayout currentPath={currentPath} onNavigate={onNavigate}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
            Performance Appraisals &amp; Reviews
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Institutional 70/30 weighted performance model: 70% Key Result Areas &bull; 30% Core Competencies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={currentStatus === 'COMPLETED' ? 'approved' : currentStatus === 'CALIBRATION_PENDING' ? 'pending' : 'brand'} size="md">
            {cycle?.title || 'Q4 2026 Annual Performance Cycle'}
          </Badge>
          <Badge
            variant={
              currentStatus === 'COMPLETED'
                ? 'approved'
                : currentStatus === 'CALIBRATION_PENDING'
                ? 'pending'
                : currentStatus === 'SELF_SUBMITTED'
                ? 'brand'
                : 'neutral'
            }
            size="md"
          >
            {currentStatus === 'COMPLETED'
              ? 'Finalized'
              : currentStatus === 'CALIBRATION_PENDING'
              ? 'In Calibration'
              : currentStatus === 'SELF_SUBMITTED'
              ? 'Manager Review Pending'
              : 'Self-Review Open'}
          </Badge>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-[7px] bg-[#FFEDEF] text-[#B52F38] text-xs font-medium flex items-center gap-2 border border-[#FFACA9]">
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dynamic 4-Stage Stepper Bar */}
      <Card variant="surface" padding="md">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
          {/* Stage 1 */}
          <div
            className={`p-3 rounded-[7px] border transition-colors ${
              currentStatus !== 'NOT_STARTED'
                ? 'bg-[#EBF7F2] border-[#69D3B0] text-[#007B58]'
                : 'bg-accent-soft border-brand/25 text-brand'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider">Stage 1</span>
              {currentStatus !== 'NOT_STARTED' && <CheckCircle className="w-4 h-4 text-[#007B58]" />}
            </div>
            <div className="font-semibold mt-0.5">Self-Appraisal Form</div>
            <div className="text-[10px] text-muted">
              {currentStatus !== 'NOT_STARTED' ? 'Submitted' : 'In Progress (Active)'}
            </div>
          </div>

          {/* Stage 2 */}
          <div
            className={`p-3 rounded-[7px] border transition-colors ${
              currentStatus === 'CALIBRATION_PENDING' || currentStatus === 'COMPLETED'
                ? 'bg-[#EBF7F2] border-[#69D3B0] text-[#007B58]'
                : currentStatus === 'SELF_SUBMITTED'
                ? 'bg-accent-soft border-brand/25 text-brand'
                : 'bg-subtle text-muted border-rule'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider">Stage 2</span>
              {(currentStatus === 'CALIBRATION_PENDING' || currentStatus === 'COMPLETED') && (
                <CheckCircle className="w-4 h-4 text-[#007B58]" />
              )}
            </div>
            <div className="font-semibold mt-0.5 text-ink">Manager Evaluation</div>
            <div className="text-[10px] text-muted">
              {currentStatus === 'NOT_STARTED'
                ? 'Awaiting Self-Review'
                : currentStatus === 'SELF_SUBMITTED'
                ? 'In Review by Manager'
                : 'Scoring Complete'}
            </div>
          </div>

          {/* Stage 3 */}
          <div
            className={`p-3 rounded-[7px] border transition-colors ${
              currentStatus === 'COMPLETED'
                ? 'bg-[#EBF7F2] border-[#69D3B0] text-[#007B58]'
                : currentStatus === 'CALIBRATION_PENDING'
                ? 'bg-[#FFF8E6] border-[#F3CE87] text-[#865600]'
                : 'bg-subtle text-muted border-rule'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider">Stage 3</span>
              {currentStatus === 'COMPLETED' && <CheckCircle className="w-4 h-4 text-[#007B58]" />}
            </div>
            <div className="font-semibold mt-0.5 text-ink">HR Calibration Committee</div>
            <div className="text-[10px] text-muted">
              {currentStatus === 'CALIBRATION_PENDING'
                ? 'Session in Progress'
                : currentStatus === 'COMPLETED'
                ? 'Ratings Calibrated'
                : 'Scheduled Post-Review'}
            </div>
          </div>

          {/* Stage 4 */}
          <div
            className={`p-3 rounded-[7px] border transition-colors ${
              submission?.acknowledgedAt
                ? 'bg-[#EBF7F2] border-[#69D3B0] text-[#007B58]'
                : currentStatus === 'COMPLETED'
                ? 'bg-accent-soft border-brand/25 text-brand'
                : 'bg-subtle text-muted border-rule'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider">Stage 4</span>
              {submission?.acknowledgedAt && <CheckCircle className="w-4 h-4 text-[#007B58]" />}
            </div>
            <div className="font-semibold mt-0.5 text-ink">Scorecard Release</div>
            <div className="text-[10px] text-muted">
              {submission?.acknowledgedAt
                ? 'Signed & Acknowledged'
                : currentStatus === 'COMPLETED'
                ? 'Ready for Sign-Off'
                : 'Year-End Finalization'}
            </div>
          </div>
        </div>
      </Card>

      {/* Live 70/30 Composite Scorecard Preview Card */}
      <Card variant="surface" padding="md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand" />
              <h3 className="text-base font-semibold text-ink font-display">
                Live Composite Performance Scorecard (70/30 Model)
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Composite rating combines KRA operational commitments (70% weight) with behavioral and organizational competencies (30% weight) on a 5.00 continuous scale.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-2.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">KRA Component (70%)</span>
                <span className="text-lg font-bold text-ink font-mono-nums">{kraScore} / 5.00</span>
                <span className="text-[10px] text-muted block">Weighted: {(kraScore * 0.7).toFixed(2)} pts</span>
              </div>
              <div className="p-2.5 rounded-[7px] bg-subtle border border-rule">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">Competency (30%)</span>
                <span className="text-lg font-bold text-ink font-mono-nums">{compScore} / 5.00</span>
                <span className="text-[10px] text-muted block">Weighted: {(compScore * 0.3).toFixed(2)} pts</span>
              </div>
              <div className="p-2.5 rounded-[7px] bg-accent-soft border border-brand/20 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-semibold text-brand uppercase tracking-wider block">Projected Composite</span>
                <span className="text-lg font-bold text-brand font-mono-nums">{compositeScore} / 5.00</span>
                <span className="text-[10px] text-brand/80 block">Formula: 70/30 Weighted</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-72 shrink-0 space-y-3 p-4 rounded-[12px] bg-subtle border border-rule">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Score Benchmark</span>
              <Badge variant={performanceTier.variant} size="sm">
                {performanceTier.label.split(':')[0]}
              </Badge>
            </div>

            <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-rule">
              <div
                className="h-full bg-action transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, (compositeScore / 5) * 100))}%` }}
              />
            </div>

            <p className="text-[11px] text-muted">
              {performanceTier.label} &bull; Mapped against institutional bell-curve standards.
            </p>
          </div>
        </div>
      </Card>

      {/* Final Outcome Card (When Completed) */}
      {currentStatus === 'COMPLETED' && (
        <Card variant="surface" padding="md" className="border-l-4 border-l-emerald-600">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#007B58]" />
                <h3 className="text-base font-semibold text-ink font-display">
                  Official Performance Evaluation Outcome
                </h3>
              </div>
              <Badge variant="approved" size="md">
                Final Calibrated Score: {submission?.finalCalibratedScore ?? compositeScore} / 5.00
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div className="p-3 rounded-[7px] bg-subtle border border-rule space-y-1">
                <span className="font-semibold text-ink block">Manager Evaluation &amp; Summary</span>
                <p className="text-muted leading-relaxed">
                  {submission?.managerSummaryFeedback || 'Consistently met quarterly underwriting SLA targets while demonstrating disciplined compliance.'}
                </p>
                <div className="pt-1 text-[11px] font-mono-nums text-brand">
                  Manager Score: {submission?.managerScore ?? '4.20'} / 5.00
                </div>
              </div>

              <div className="p-3 rounded-[7px] bg-subtle border border-rule space-y-1">
                <span className="font-semibold text-ink block">Calibration Committee Determination</span>
                <p className="text-muted leading-relaxed">
                  {submission?.calibrationNotes || 'Score calibrated and approved by the Executive Governance Committee for annual merit review.'}
                </p>
                <div className="pt-1 text-[11px] font-mono-nums text-emerald-700">
                  Approved Grade: {submission?.finalCalibratedScore && submission.finalCalibratedScore >= 4.5 ? 'Grade A (Outstanding)' : 'Grade B (Strong Performer)'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-rule">
              {submission?.acknowledgedAt ? (
                <div className="flex items-center gap-2 text-xs text-[#007B58] font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>Acknowledged &amp; Signed on {new Date(submission.acknowledgedAt).toLocaleDateString()}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-muted">
                    Please review your evaluation outcome and sign off to complete the review cycle.
                  </span>
                  <Button
                    variant="primary"
                    onClick={handleAcknowledge}
                    disabled={isAcknowledging}
                    leftIcon={<UserCheck className="w-4 h-4" />}
                  >
                    {isAcknowledging ? 'Recording Sign-Off...' : 'Acknowledge Final Scorecard'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Section 1: Key Result Areas (KRAs) - 70% Weight */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink font-display">
              Section 1: Key Result Areas (KRAs) &bull; 70% Weight
            </h3>
            <p className="text-xs text-muted">
              Rate your individual contributions against institutional credit and underwriting targets.
            </p>
          </div>
          <Badge variant="brand" size="sm">70% Total Weight</Badge>
        </div>

        {INSTITUTIONAL_KRAS.map((kra) => {
          const activeRating = ratings[kra.id] || 4;
          const tier = RATING_RUBRIC_TIERS.find((t) => t.score === activeRating);

          return (
            <Card key={kra.id} variant="surface" padding="md">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-ink font-display">{kra.title}</h4>
                      <Badge variant="neutral" size="sm">{kra.weightage}% Weight</Badge>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{kra.description}</p>
                  </div>

                  {/* 1-5 Score Picker Buttons */}
                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted mr-1">Rating:</span>
                      {[1, 2, 3, 4, 5].map((score) => {
                        const isSelected = activeRating === score;
                        return (
                          <button
                            key={score}
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleRatingChange(kra.id, score)}
                            className={`w-9 h-9 rounded-[7px] text-xs font-bold transition-all select-none font-mono-nums ${
                              isLocked ? 'cursor-not-allowed opacity-80 ' : 'cursor-pointer '
                            }${
                              isSelected
                                ? 'bg-action text-on-action shadow-sm'
                                : 'bg-subtle hover:bg-accent-soft text-muted hover:text-brand border border-rule'
                            }`}
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                    {tier && (
                      <span className="text-[11px] font-medium text-brand">
                        {tier.label} ({tier.score}.00)
                      </span>
                    )}
                  </div>
                </div>

                {/* Self Reflection textarea */}
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">
                    Accomplishment Notes / Context (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={comments[kra.id] || ''}
                    onChange={(e) => handleCommentChange(kra.id, e.target.value)}
                    placeholder="Enter specific achievements, metrics, or portfolio impact..."
                    className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-1.5 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-70"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Section 2: Core Behavioral Competencies - 30% Weight */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink font-display">
              Section 2: Organizational Competencies &bull; 30% Weight
            </h3>
            <p className="text-xs text-muted">
              Evaluate ethical rigor, collaboration, and continuous operational improvement.
            </p>
          </div>
          <Badge variant="brand" size="sm">30% Total Weight</Badge>
        </div>

        {INSTITUTIONAL_COMPETENCIES.map((comp) => {
          const activeRating = ratings[comp.id] || 4;
          const tier = RATING_RUBRIC_TIERS.find((t) => t.score === activeRating);

          return (
            <Card key={comp.id} variant="surface" padding="md">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-ink font-display">{comp.title}</h4>
                      <Badge variant="neutral" size="sm">{comp.weightage}% of Competency</Badge>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{comp.description}</p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted mr-1">Rating:</span>
                      {[1, 2, 3, 4, 5].map((score) => {
                        const isSelected = activeRating === score;
                        return (
                          <button
                            key={score}
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleRatingChange(comp.id, score)}
                            className={`w-9 h-9 rounded-[7px] text-xs font-bold transition-all select-none font-mono-nums ${
                              isLocked ? 'cursor-not-allowed opacity-80 ' : 'cursor-pointer '
                            }${
                              isSelected
                                ? 'bg-action text-on-action shadow-sm'
                                : 'bg-subtle hover:bg-accent-soft text-muted hover:text-brand border border-rule'
                            }`}
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                    {tier && (
                      <span className="text-[11px] font-medium text-brand">
                        {tier.label} ({tier.score}.00)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={comments[comp.id] || ''}
                    onChange={(e) => handleCommentChange(comp.id, e.target.value)}
                    placeholder="Provide evidence of leadership, collaboration, or ethics..."
                    className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3 py-1.5 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-70"
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Self-Appraisal Executive Narrative */}
      <Card variant="surface" padding="md">
        <h4 className="text-sm font-semibold text-ink font-display mb-2">
          Self-Evaluation Narrative &amp; Major Institutional Achievements
        </h4>
        <textarea
          rows={4}
          disabled={isLocked}
          value={selfComments}
          onChange={(e) => setSelfComments(e.target.value)}
          placeholder="Summarize key milestones, underwriting volumes, loan recoveries, and personal growth targets..."
          className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-xs sm:text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand leading-relaxed disabled:opacity-70"
        />

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {isLocked
              ? 'Self-evaluation is locked and submitted for line manager review.'
              : 'Auto-saved draft &bull; Visible only to you until submitted.'}
          </span>

          {!isLocked && (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleSaveDraft} leftIcon={<FloppyDisk className="w-4 h-4" />}>
                {isSaved ? 'Draft Saved Locally!' : 'Save Draft'}
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsConfirmModalOpen(true)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Submit Self-Appraisal
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Submit Self-Appraisal Form"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Are you sure you want to finalize and submit your self-appraisal ratings? Once submitted, your scores will lock and advance to your line manager for review.
          </p>

          <div className="p-3 rounded-[7px] bg-accent-soft text-brand text-xs space-y-1">
            <div className="font-semibold">Projected Submission Summary:</div>
            <div>&bull; KRA Operational Score (70%): <span className="font-mono-nums font-bold">{kraScore}</span> / 5.00</div>
            <div>&bull; Competency Score (30%): <span className="font-mono-nums font-bold">{compScore}</span> / 5.00</div>
            <div>&bull; Overall Composite Rating: <span className="font-mono-nums font-bold">{compositeScore}</span> / 5.00</div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitSelfAppraisal}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting Form...' : 'Confirm & Submit to Manager'}
            </Button>
          </div>
        </div>
      </Modal>
    </PortalLayout>
  );
};
