import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';
import { createValidPngBuffer } from '../../fixtures/mockFiles.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 3 Combination: Multi-Tier Expense Approval Flow (Total > 50k NGN: Manager -> Dept Head -> Finance -> Paid)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');
  const deptHeadClient = await createAuthenticatedClient('depthead');
  const finClient = await createAuthenticatedClient('finance');
  const adminClient = await createAuthenticatedClient('admin');

  // 1. Upload receipt
  const receiptRes = await empClient.upload('/api/v1/expenses/upload-receipt', createValidPngBuffer(), 'image/png');
  const receiptUrl = receiptRes.body.fileUrl;

  // 2. Submit report total = 85,000 NGN (> 50,000 NGN, triggers Dept Head approval tier)
  const submitRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Regional Credit Due Diligence Trip',
    purpose: 'Site inspection in Kaduna',
    items: [
      {
        categoryId: 'cat-trav',
        merchantName: 'Abuja-Kaduna Rail Service',
        amount: 25000,
        receiptUrl,
        description: 'First class return tickets'
      },
      {
        categoryId: 'cat-hosp',
        merchantName: 'Asaa Pyramid Hotel',
        amount: 60000,
        receiptUrl,
        description: 'Lodging 2 nights'
      }
    ]
  });
  assert.equal(submitRes.status, 201);
  const reportId = submitRes.body.data.id;
  assert.equal(submitRes.body.data.totalAmount, 85000);
  assert.equal(submitRes.body.data.status, 'SUBMITTED');

  // 3. Line Manager reviews and approves -> Escalates to PENDING_DEPT_HEAD
  const mgrApproveRes = await mgrClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'APPROVE',
    comments: 'Line manager verified expenses. Forwarded for Dept Head sign-off.'
  });
  assert.equal(mgrApproveRes.status, 200);
  assert.equal(mgrApproveRes.body.data.status, 'PENDING_DEPT_HEAD');

  // 4. Dept Head reviews and gives final approval -> transitions to APPROVED
  const deptApproveRes = await deptHeadClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'APPROVE',
    comments: 'Department budget available. Approved.'
  });
  assert.equal(deptApproveRes.status, 200);
  assert.equal(deptApproveRes.body.data.status, 'APPROVED');

  // 5. Finance confirms disbursement
  const disburseRes = await finClient.post(`/api/v1/expenses/reports/${reportId}/disburse`, {
    disbursementReference: 'CBN-ACH-2026-778811',
    paidDate: '2026-11-20'
  });
  assert.equal(disburseRes.status, 200);
  assert.equal(disburseRes.body.data.status, 'PAID');
  assert.equal(disburseRes.body.data.disbursementReference, 'CBN-ACH-2026-778811');

  // 6. Verify full audit trail
  const auditRes = await adminClient.get('/api/v1/admin/audit-logs?entityType=ExpenseReport');
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'EXPENSE_SUBMITTED' && l.entityId === reportId));
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'EXPENSE_APPROVED' && l.entityId === reportId));
  assert.ok(auditRes.body.data.some((l: any) => l.action === 'EXPENSE_DISBURSED' && l.entityId === reportId));
});

test('Tier 3 Combination: Expense Revision Request Lifecycle (Submit -> Revision Requested -> Edit -> Resubmit -> Approve)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');

  // 1. Submit claim
  const submitRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Client Lunch Meetings',
    purpose: 'Outreach',
    items: [
      {
        categoryId: 'cat-hosp',
        merchantName: 'Restaurant',
        amount: 4500,
        description: 'Snacks'
      }
    ]
  });
  const reportId = submitRes.body.data.id;

  // 2. Manager requests revision
  const revRes = await mgrClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'REQUEST_REVISION',
    comments: 'Please update report title with client company name'
  });
  assert.equal(revRes.status, 200);
  assert.equal(revRes.body.data.status, 'REVISION_REQUESTED');

  // 3. Employee edits title and resubmits
  const editRes = await empClient.put(`/api/v1/expenses/reports/${reportId}`, {
    title: 'Client Lunch Meeting: Dangote Micro-Credit Cooperative'
  });
  assert.equal(editRes.status, 200);
  assert.equal(editRes.body.data.title, 'Client Lunch Meeting: Dangote Micro-Credit Cooperative');
  assert.equal(editRes.body.data.status, 'SUBMITTED');

  // 4. Manager reviews and approves
  const finalApprove = await mgrClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'APPROVE',
    comments: 'Updated title verified. Approved.'
  });
  assert.equal(finalApprove.status, 200);
  assert.equal(finalApprove.body.data.status, 'APPROVED');
});
