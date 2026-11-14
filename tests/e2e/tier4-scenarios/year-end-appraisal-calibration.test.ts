import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 4 Scenario: Multi-Employee Year-End Appraisal Calibration & Rating Distribution', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const mgrClient = await createAuthenticatedClient('manager');
  const emp1Client = await createAuthenticatedClient('employee');
  const emp2Client = await createAuthenticatedClient('chioma');

  // Setup sub for Chioma in referenceServer
  const refServer = (adminClient as any).refServer;
  if (refServer) {
    refServer.appraisalSubmissions.set('sub-chioma-2026', {
      id: 'sub-chioma-2026',
      cycleId: 'cycle-fy-2026',
      employeeId: 'emp-employee-02',
      managerId: 'emp-manager-01',
      status: 'NOT_STARTED',
      goals: [
        { goalId: 'g1', title: 'Credit Underwriting Volume', weightage: 50 },
        { goalId: 'g2', title: 'Documentation Compliance', weightage: 50 }
      ]
    });
  }

  // 1. Employee 1 (Oluwaseun) submits self-appraisal
  await emp1Client.put('/api/v1/appraisals/submissions/sub-emp-01-2026/self', {
    goals: [
      { goalId: 'goal-1', selfRating: 4.8 },
      { goalId: 'goal-2', selfRating: 4.4 }
    ],
    employeeComments: 'Exceeded all credit performance goals.'
  });

  // 2. Employee 2 (Chioma) submits self-appraisal
  await emp2Client.put('/api/v1/appraisals/submissions/sub-chioma-2026/self', {
    goals: [
      { goalId: 'g1', selfRating: 3.8 },
      { goalId: 'g2', selfRating: 3.8 }
    ],
    employeeComments: 'Met core job expectations consistently.'
  });

  // 3. Manager Ibrahim reviews both direct reports
  await mgrClient.put('/api/v1/appraisals/submissions/sub-emp-01-2026/manager', {
    goals: [
      { goalId: 'goal-1', managerRating: 4.6 },
      { goalId: 'goal-2', managerRating: 4.4 }
    ],
    competencyScore: 4.5,
    managerSummaryFeedback: 'Exceptional underwriter.'
  });

  await mgrClient.put('/api/v1/appraisals/submissions/sub-chioma-2026/manager', {
    goals: [
      { goalId: 'g1', managerRating: 3.6 },
      { goalId: 'g2', managerRating: 4.0 }
    ],
    competencyScore: 3.8,
    managerSummaryFeedback: 'Good solid contributor.'
  });

  // 4. HR Committee Calibration
  // Calibrate Oluwaseun to 4.6 (Grade A)
  const cal1 = await adminClient.post('/api/v1/appraisals/submissions/sub-emp-01-2026/calibrate', {
    finalCalibratedScore: 4.6
  });
  assert.equal(cal1.status, 200);
  assert.equal(cal1.body.data.finalCalibratedScore, 4.6);
  assert.equal(cal1.body.data.status, 'COMPLETED');

  // Calibrate Chioma to 3.8 (Grade B)
  const cal2 = await adminClient.post('/api/v1/appraisals/submissions/sub-chioma-2026/calibrate', {
    finalCalibratedScore: 3.8
  });
  assert.equal(cal2.status, 200);
  assert.equal(cal2.body.data.finalCalibratedScore, 3.8);
  assert.equal(cal2.body.data.status, 'COMPLETED');

  // 5. Both staff acknowledge their completed appraisal
  const ack1 = await emp1Client.post('/api/v1/appraisals/submissions/sub-emp-01-2026/acknowledge');
  assert.equal(ack1.status, 200);
  assert.ok(ack1.body.data.acknowledgedAt);

  const ack2 = await emp2Client.post('/api/v1/appraisals/submissions/sub-chioma-2026/acknowledge');
  assert.equal(ack2.status, 200);
  assert.ok(ack2.body.data.acknowledgedAt);
});
