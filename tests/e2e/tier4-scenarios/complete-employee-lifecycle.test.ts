import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, createTestClient, resetTestState } from '../../helpers/testHarness.ts';
import { createValidPdfBuffer } from '../../fixtures/mockFiles.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 4 Scenario: Complete Employee Lifecycle from Scaffolding Onboarding to Executive Sign-off', async () => {
  const adminClient = await createAuthenticatedClient('admin');
  const mgrClient = await createAuthenticatedClient('manager');

  // Stage 1: Admin onboards new employee "Amara Okafor" in Credit & Risk
  const onboardRes = await adminClient.post('/api/v1/employees', {
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'amara.okafor@nexusfinance.ng',
    departmentId: 'dept-cru',
    designationId: 'des-ra',
    managerId: 'emp-manager-01',
    initialAnnualLeaveDays: 20
  });
  assert.equal(onboardRes.status, 201);
  const empId = onboardRes.body.data.id;
  const staffId = onboardRes.body.data.staffId;

  // Stage 2: Amara signs in for the first time
  const amaraClient = await createTestClient();
  const loginRes = await amaraClient.login('amara.okafor@nexusfinance.ng', 'TemporaryPass123!');
  assert.equal(loginRes.status, 200);

  // Stage 3: Amara updates profile with Zenith Bank NUBAN and emergency contact
  const profileRes = await amaraClient.patch('/api/v1/portal/profile', {
    phone: '+2348031122334',
    residentialAddress: 'Zone 4, Wuse, Abuja',
    emergencyContactName: 'Chinedu Okafor',
    emergencyContactPhone: '+2348054433221',
    emergencyContactRelationship: 'Spouse',
    bankName: 'Zenith Bank PLC',
    bankAccountNumber: '2081122334',
    bankAccountName: 'Amara Okafor'
  });
  assert.equal(profileRes.status, 200);
  assert.equal(profileRes.body.data.bankAccountNumber, '2081122334');

  // Stage 4: Amara applies for 3 working days of Annual Leave in December 2026 (Dec 14 - Dec 16)
  const leaveRes = await amaraClient.post('/api/v1/leaves/requests', {
    leaveTypeId: 'lt-annual',
    startDate: '2026-12-14',
    endDate: '2026-12-16',
    reason: 'Annual family break'
  });
  assert.equal(leaveRes.status, 201);
  assert.equal(leaveRes.body.data.totalDays, 3.0);
  const leaveReqId = leaveRes.body.data.id;

  // Stage 5: Line Manager Ibrahim reviews and approves Amara's leave
  const leaveApproveRes = await mgrClient.patch(`/api/v1/leaves/requests/${leaveReqId}/action`, {
    action: 'APPROVE',
    decisionReason: 'Approved. Enjoy your break!'
  });
  assert.equal(leaveApproveRes.status, 200);
  assert.equal(leaveApproveRes.body.data.status, 'APPROVED');

  // Stage 6: Amara verifies balance updated: 17 available, 3 used
  const balRes = await amaraClient.get('/api/v1/leaves/balances');
  const annual = balRes.body.data.find((b: any) => b.leaveTypeId === 'lt-annual');
  assert.equal(annual.usedDays, 3.0);
  assert.equal(annual.availableDays, 17.0);

  // Stage 7: Amara conducts loan due diligence in Lagos, uploads PDF flight receipt, and files expense claim
  const uploadRes = await amaraClient.upload('/api/v1/expenses/upload-receipt', createValidPdfBuffer(), 'application/pdf');
  const receiptUrl = uploadRes.body.fileUrl;

  const expenseRes = await amaraClient.post('/api/v1/expenses/reports', {
    title: 'Lagos SME Credit Underwriting Fieldwork',
    purpose: 'Site visits to commercial applicants',
    items: [
      {
        categoryId: 'cat-trav',
        merchantName: 'Air Peace',
        amount: 48000,
        receiptUrl,
        description: 'Flight ABV-LOS return'
      },
      {
        categoryId: 'cat-office',
        merchantName: 'Airport Convenience',
        amount: 1500,
        description: 'Printing application files'
      }
    ]
  });
  assert.equal(expenseRes.status, 201);
  const reportId = expenseRes.body.data.id;
  assert.equal(expenseRes.body.data.totalAmount, 49500);

  // Stage 8: Manager approves expense report
  const expApproveRes = await mgrClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'APPROVE',
    comments: 'Business trip pre-authorized. Approved.'
  });
  assert.equal(expApproveRes.status, 200);
  assert.equal(expApproveRes.body.data.status, 'APPROVED');

  // Stage 9: Finance Officer disburses payment into Amara's Zenith Bank account
  const finClient = await createAuthenticatedClient('finance');
  const disburseRes = await finClient.post(`/api/v1/expenses/reports/${reportId}/disburse`, {
    disbursementReference: 'NIP-CBN-2026-AMARA-01',
    paidDate: '2026-11-25'
  });
  assert.equal(disburseRes.status, 200);
  assert.equal(disburseRes.body.data.status, 'PAID');

  // Stage 10: Performance cycle opens. Amara rates herself 4.5. Manager rates her 4.5. Final calibrated score 4.5
  // Seed Amara's appraisal submission
  const refServer = (adminClient as any).refServer;
  if (refServer) {
    refServer.appraisalSubmissions.set(`sub-${empId}`, {
      id: `sub-${empId}`,
      cycleId: 'cycle-fy-2026',
      employeeId: empId,
      managerId: 'emp-manager-01',
      status: 'NOT_STARTED',
      goals: [
        { goalId: 'g1', title: 'Underwriting volume', weightage: 50 },
        { goalId: 'g2', title: 'Portfolio accuracy', weightage: 50 }
      ]
    });
  }

  // Self review
  await amaraClient.put(`/api/v1/appraisals/submissions/sub-${empId}/self`, {
    goals: [{ goalId: 'g1', selfRating: 4.5 }, { goalId: 'g2', selfRating: 4.5 }]
  });

  // Manager review
  await mgrClient.put(`/api/v1/appraisals/submissions/sub-${empId}/manager`, {
    goals: [{ goalId: 'g1', managerRating: 4.5 }, { goalId: 'g2', managerRating: 4.5 }],
    competencyScore: 4.5
  });

  // Admin calibration to 4.6 (Grade A - Exceptional)
  const calRes = await adminClient.post(`/api/v1/appraisals/submissions/sub-${empId}/calibrate`, {
    finalCalibratedScore: 4.6
  });
  assert.equal(calRes.status, 200);
  assert.equal(calRes.body.data.finalCalibratedScore, 4.6);

  // Amara acknowledges review
  const ackRes = await amaraClient.post(`/api/v1/appraisals/submissions/sub-${empId}/acknowledge`);
  assert.equal(ackRes.status, 200);

  // Stage 11: Admin promotes Amara to Senior Risk Analyst in recognition of Grade A
  const promoRes = await adminClient.patch(`/api/v1/employees/${empId}`, {
    designationId: 'des-cro'
  });
  assert.equal(promoRes.status, 200);

  // Stage 12: Directory reflects Amara's Senior standing
  const dirRes = await amaraClient.get('/api/v1/employees?search=amara');
  assert.equal(dirRes.status, 200);
  assert.equal(dirRes.body.data.length, 1);
  assert.equal(dirRes.body.data[0].staffId, staffId);
});
