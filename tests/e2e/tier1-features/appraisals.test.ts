import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F16: Admin creates new appraisal cycle with fiscal year and deadlines', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.post('/api/v1/appraisals/cycles', {
    title: 'H1 2026 Mid-Year Appraisal Cycle',
    cycleType: 'MID_YEAR',
    fiscalYear: 2026,
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    selfAppraisalDeadline: '2026-06-15',
    managerReviewDeadline: '2026-06-25',
    kraWeightagePercent: 70,
    competencyWeightagePercent: 30
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.title, 'H1 2026 Mid-Year Appraisal Cycle');
  assert.equal(res.body.data.status, 'ACTIVE');
});

test('F16: List appraisal cycles returns active corporate cycles', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/appraisals/cycles');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.some((c: any) => c.fiscalYear === 2026));
});

test('F10: Employee retrieves active review form with assigned KRA goals', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/appraisals/submissions/me');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.employeeId, 'emp-employee-01');
  assert.equal(res.body.data.status, 'NOT_STARTED');
  assert.equal(res.body.data.goals.length, 2);
  assert.equal(res.body.data.goals[0].weightage, 50);
});

test('F10: Employee submits self-appraisal ratings (1-5 scale) and reflection notes', async () => {
  const client = await createAuthenticatedClient('employee');
  const formRes = await client.get('/api/v1/appraisals/submissions/me');
  const subId = formRes.body.data.id;

  const res = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: [
      { goalId: 'goal-1', selfRating: 4.5, selfComments: 'Kept 30-day PAR at 1.8%, beating the 2.5% target.' },
      { goalId: 'goal-2', selfRating: 4.0, selfComments: 'All underwriting compliance reviews closed within 36 hours.' }
    ],
    employeeComments: 'Exceeded credit quality targets for H1.'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'SELF_SUBMITTED');
  // Weighted: (4.5 * 0.5) + (4.0 * 0.5) = 4.25
  assert.equal(res.body.data.selfScore, 4.25);
});

test('F17: Manager retrieves team appraisal queue and submits evaluation with 70/30 weighted formula', async () => {
  // 1. Employee submits
  const empClient = await createAuthenticatedClient('employee');
  const formRes = await empClient.get('/api/v1/appraisals/submissions/me');
  const subId = formRes.body.data.id;
  await empClient.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: [
      { goalId: 'goal-1', selfRating: 4.0 },
      { goalId: 'goal-2', selfRating: 4.0 }
    ]
  });

  // 2. Manager reviews
  const mgrClient = await createAuthenticatedClient('manager');
  const teamSubs = await mgrClient.get('/api/v1/appraisals/submissions/team');
  assert.equal(teamSubs.status, 200);
  assert.ok(teamSubs.body.data.some((s: any) => s.id === subId));

  // KRA 1 (weight 50%): rating 4.0 -> 2.0
  // KRA 2 (weight 50%): rating 4.0 -> 2.0
  // KRA Score = 4.0. Competency Score = 4.0
  // Overall = (4.0 * 0.70) + (4.0 * 0.30) = 4.00
  const reviewRes = await mgrClient.put(`/api/v1/appraisals/submissions/${subId}/manager`, {
    goals: [
      { goalId: 'goal-1', managerRating: 4.0, managerComments: 'Strong credit portfolio management.' },
      { goalId: 'goal-2', managerRating: 4.0, managerComments: 'Turnaround speed verified.' }
    ],
    competencyScore: 4.0,
    managerSummaryFeedback: 'Outstanding contribution this cycle.'
  });

  assert.equal(reviewRes.status, 200);
  assert.equal(reviewRes.body.data.status, 'CALIBRATION_PENDING');
  assert.equal(reviewRes.body.data.managerScore, 4.0);
});

test('F18: Admin calibrates final score and employee acknowledges outcome', async () => {
  // Setup: Employee self-submits -> Manager evaluates
  const empClient = await createAuthenticatedClient('employee');
  const formRes = await empClient.get('/api/v1/appraisals/submissions/me');
  const subId = formRes.body.data.id;
  await empClient.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
  });

  const mgrClient = await createAuthenticatedClient('manager');
  await mgrClient.put(`/api/v1/appraisals/submissions/${subId}/manager`, {
    goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
  });

  // Admin calibration committee locks final score to 4.2
  const adminClient = await createAuthenticatedClient('admin');
  const calRes = await adminClient.post(`/api/v1/appraisals/submissions/${subId}/calibrate`, {
    finalCalibratedScore: 4.2
  });

  assert.equal(calRes.status, 200);
  assert.equal(calRes.body.data.status, 'COMPLETED');
  assert.equal(calRes.body.data.finalCalibratedScore, 4.2);

  // Employee acknowledges
  const ackRes = await empClient.post(`/api/v1/appraisals/submissions/${subId}/acknowledge`);
  assert.equal(ackRes.status, 200);
  assert.ok(ackRes.body.data.acknowledgedAt);
});
