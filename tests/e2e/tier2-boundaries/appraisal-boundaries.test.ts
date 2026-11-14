import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 2 Boundary: Self-appraisal score below 1.00 returns 422 Unprocessable Entity', async () => {
  const client = await createAuthenticatedClient('employee');
  const formRes = await client.get('/api/v1/appraisals/submissions/me');
  const subId = formRes.body.data.id;

  const res = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: [
      { goalId: 'goal-1', selfRating: 0.5 }, // Below 1.00 minimum
      { goalId: 'goal-2', selfRating: 3.0 }
    ]
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'INVALID_RATING');
  assert.ok(res.body.error.message.includes('between 1.00 and 5.00'));
});

test('Tier 2 Boundary: Self-appraisal score above 5.00 (e.g. 5.8) returns 422', async () => {
  const client = await createAuthenticatedClient('employee');
  const formRes = await client.get('/api/v1/appraisals/submissions/me');
  const subId = formRes.body.data.id;

  const res = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: [
      { goalId: 'goal-1', selfRating: 5.8 }, // Above 5.00 maximum
      { goalId: 'goal-2', selfRating: 4.0 }
    ]
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'INVALID_RATING');
});

test('Tier 2 Boundary: Submitting self-appraisal with empty goals array returns 400', async () => {
  const client = await createAuthenticatedClient('employee');
  const formRes = await client.get('/api/v1/appraisals/submissions/me');
  const subId = formRes.body.data.id;

  const res = await client.put(`/api/v1/appraisals/submissions/${subId}/self`, {
    goals: []
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('Tier 2 Boundary: Cycle creation with weightages not totaling 100% returns 422', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const res = await adminClient.post('/api/v1/appraisals/cycles', {
    title: 'Imbalanced Cycle',
    fiscalYear: 2026,
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    kraWeightagePercent: 70,
    competencyWeightagePercent: 20 // 70 + 20 = 90% != 100%
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'INVALID_WEIGHTAGES');
  assert.ok(res.body.error.message.includes('must total exactly 100%'));
});

test('Tier 2 Boundary: Peer manager cannot review appraisal of unassigned staff (403 Forbidden)', async () => {
  // Employee 1 reports to manager 1 (Ibrahim). DeptHead attempts to evaluate Employee 1.
  const deptHeadClient = await createAuthenticatedClient('depthead');
  const formRes = await deptHeadClient.get('/api/v1/appraisals/submissions/sub-emp-01-2026');
  assert.equal(formRes.status, 403);
  assert.equal(formRes.body.error.code, 'FORBIDDEN');

  const reviewRes = await deptHeadClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
    goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
  });
  assert.equal(reviewRes.status, 403);
});

test('Tier 2 Boundary: Score calibration prior to manager evaluation returns 409 Conflict', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  // sub-emp-01-2026 is still in NOT_STARTED status
  const calRes = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
    finalCalibratedScore: 4.0
  });

  assert.equal(calRes.status, 409);
  assert.equal(calRes.body.error.code, 'INVALID_STATE');
});

test('Tier 2 Boundary: Score calibration with rating > 5.0 returns 422', async () => {
  // Advance to CALIBRATION_PENDING
  const empClient = await createAuthenticatedClient('employee');
  await empClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
    goals: [{ goalId: 'goal-1', selfRating: 4.0 }, { goalId: 'goal-2', selfRating: 4.0 }]
  });
  const mgrClient = await createAuthenticatedClient('manager');
  await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
    goals: [{ goalId: 'goal-1', managerRating: 4.0 }, { goalId: 'goal-2', managerRating: 4.0 }]
  });

  // Admin attempts to calibrate with 6.5
  const adminClient = await createAuthenticatedClient('admin');
  const calRes = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
    finalCalibratedScore: 6.5
  });

  assert.equal(calRes.status, 422);
  assert.equal(calRes.body.error.code, 'INVALID_RATING');
});

test('Tier 2 Boundary: Employee cannot acknowledge appraisal of a colleague (403 Forbidden)', async () => {
  const chiomaClient = await createAuthenticatedClient('chioma');
  // Chioma attempts to acknowledge Employee 1's appraisal
  const res = await chiomaClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/acknowledge');

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});
