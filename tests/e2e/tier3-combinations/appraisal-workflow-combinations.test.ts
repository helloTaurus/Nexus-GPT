import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 3 Combination: Complete Performance Appraisal Pipeline (Cycle -> Self-Review -> Manager Review -> Calibration -> Sign-Off)', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');

  // 1. HR Admin creates appraisal cycle
  const cycleRes = await adminClient.post('/api/v1/appraisals/cycles', {
    title: 'FY 2026 Comprehensive Annual Evaluation',
    cycleType: 'ANNUAL',
    fiscalYear: 2026,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    selfAppraisalDeadline: '2026-11-30',
    managerReviewDeadline: '2026-12-15',
    kraWeightagePercent: 70,
    competencyWeightagePercent: 30
  });
  assert.equal(cycleRes.status, 201);

  // 2. Employee fetches active review form
  const formRes = await empClient.get('/api/v1/appraisals/submissions/me');
  assert.equal(formRes.status, 200);
  const subId = formRes.body.data.id;
  assert.equal(formRes.body.data.status, 'NOT_STARTED');

  // 3. Employee completes self-appraisal
  const selfRes = await empClient.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: [
      { goalId: 'goal-1', selfRating: 4.8, selfComments: 'NPL portfolio maintained at 1.5%.' },
      { goalId: 'goal-2', selfRating: 4.2, selfComments: '98% of turnaround times met SLA.' }
    ],
    employeeComments: 'Exceeded all key targets for credit risk assessment.'
  });
  assert.equal(selfRes.status, 200);
  assert.equal(selfRes.body.data.status, 'SELF_SUBMITTED');
  // (4.8 * 0.5) + (4.2 * 0.5) = 4.5
  assert.equal(selfRes.body.data.selfScore, 4.5);

  // 4. Line Manager evaluates employee
  const mgrRes = await mgrClient.put(`/api/v1/appraisals/submissions/${subId}/manager`, {
    goals: [
      { goalId: 'goal-1', managerRating: 4.5, managerComments: 'Exceptional NPL control.' },
      { goalId: 'goal-2', managerRating: 4.0, managerComments: 'Reliable turnaround speed.' }
    ],
    competencyScore: 4.5,
    managerSummaryFeedback: 'Promising candidate for Senior Underwriter position.'
  });
  assert.equal(mgrRes.status, 200);
  assert.equal(mgrRes.body.data.status, 'CALIBRATION_PENDING');
  // KRA: (4.5*0.5) + (4.0*0.5) = 4.25
  // Overall: (4.25 * 0.70) + (4.5 * 0.30) = 4.32
  assert.equal(mgrRes.body.data.managerScore, 4.32);

  // 5. HR Calibration committee calibrates score to 4.35 (Grade B/A border)
  const calRes = await adminClient.post(`/api/v1/appraisals/submissions/${subId}/calibrate`, {
    finalCalibratedScore: 4.35
  });
  assert.equal(calRes.status, 200);
  assert.equal(calRes.body.data.status, 'COMPLETED');
  assert.equal(calRes.body.data.finalCalibratedScore, 4.35);

  // 6. Employee acknowledges final calibrated appraisal
  const ackRes = await empClient.post(`/api/v1/appraisals/submissions/${subId}/acknowledge`);
  assert.equal(ackRes.status, 200);
  assert.ok(ackRes.body.data.acknowledgedAt);

  // 7. Verify Audit Trail records all steps
  const auditRes = await adminClient.get('/api/v1/admin/audit-logs?entityType=AppraisalSubmission');
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'APPRAISAL_SELF_SUBMITTED'));
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'APPRAISAL_MANAGER_SUBMITTED'));
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'APPRAISAL_CALIBRATED'));
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'APPRAISAL_ACKNOWLEDGED'));
});
