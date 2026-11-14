import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';
import { createValidPdfBuffer, createValidPngBuffer } from '../../fixtures/mockFiles.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 4 Scenario: Complex Multi-Item Branch Operations Reimbursement with Threshold Escalation', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const mgrClient = await createAuthenticatedClient('manager');
  const deptHeadClient = await createAuthenticatedClient('depthead');
  const finClient = await createAuthenticatedClient('finance');

  // 1. Upload receipt 1 (PDF for Generator Service)
  const pdfRes = await empClient.upload('/api/v1/expenses/upload-receipt', createValidPdfBuffer(), 'application/pdf');
  const genReceiptUrl = pdfRes.body.fileUrl;

  // 2. Upload receipt 2 (PNG for Telecom Broadband)
  const pngRes = await empClient.upload('/api/v1/expenses/upload-receipt', createValidPngBuffer(), 'image/png');
  const telcoReceiptUrl = pngRes.body.fileUrl;

  // 3. Upload receipt 3 (PDF for Security)
  const secRes = await empClient.upload('/api/v1/expenses/upload-receipt', createValidPdfBuffer(), 'application/pdf');
  const secReceiptUrl = secRes.body.fileUrl;

  // 4. Submit 5-item report
  const submitRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Abuja Central Branch Operations & Facility Overhaul',
    purpose: 'Quarterly facility maintenance and routine operations',
    items: [
      {
        categoryId: 'cat-ops',
        merchantName: 'Mikano Power Generators Abuja',
        amount: 95000, // Within 100,000 max single limit for cat-ops
        receiptUrl: genReceiptUrl,
        description: 'Diesel fuel and 250-hour scheduled generator service'
      },
      {
        categoryId: 'cat-telco',
        merchantName: 'Spectranet 4G LTE',
        amount: 12000,
        receiptUrl: telcoReceiptUrl,
        description: 'Branch enterprise broadband monthly package'
      },
      {
        categoryId: 'cat-ops',
        merchantName: 'Nestle Waters Nigeria',
        amount: 4500, // Under 5,000 threshold
        description: '10 water dispenser refill bottles'
      },
      {
        categoryId: 'cat-hosp',
        merchantName: 'Apex Security Guards Ltd',
        amount: 68000,
        receiptUrl: secReceiptUrl,
        description: 'Monthly physical security post allowance'
      },
      {
        categoryId: 'cat-office',
        merchantName: 'Commercial Stationery Hub',
        amount: 3200, // Under 5,000 threshold
        description: 'Calculators and ledger books'
      }
    ]
  });

  assert.equal(submitRes.status, 201);
  const report = submitRes.body.data;
  const reportId = report.id;
  // Total: 95000 + 12000 + 4500 + 68000 + 3200 = 182,700 NGN
  assert.equal(report.totalAmount, 182700);
  assert.equal(report.items.length, 5);
  assert.equal(report.status, 'SUBMITTED');

  // 5. Line Manager reviews and approves -> Multi-tier escalation to PENDING_DEPT_HEAD (> 50,000 NGN)
  const mgrApprove = await mgrClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'APPROVE',
    comments: 'Line review confirmed generator and guard costs are standard. Escalated to Ops Director.'
  });
  assert.equal(mgrApprove.status, 200);
  assert.equal(mgrApprove.body.data.status, 'PENDING_DEPT_HEAD');

  // 6. Department Head approves -> transitions to APPROVED
  const deptApprove = await deptHeadClient.patch(`/api/v1/expenses/reports/${reportId}/action`, {
    action: 'APPROVE',
    comments: 'Operational budget approved.'
  });
  assert.equal(deptApprove.status, 200);
  assert.equal(deptApprove.body.data.status, 'APPROVED');

  // 7. Finance controller verifies receipts and disburses
  const disburseRes = await finClient.post(`/api/v1/expenses/reports/${reportId}/disburse`, {
    disbursementReference: 'FBN-TRX-884129-BATCH-09',
    paidDate: '2026-11-28'
  });
  assert.equal(disburseRes.status, 200);
  assert.equal(disburseRes.body.data.status, 'PAID');
  assert.equal(disburseRes.body.data.disbursementReference, 'FBN-TRX-884129-BATCH-09');

  // 8. Employee verifies claim status is PAID
  const empCheck = await empClient.get(`/api/v1/expenses/reports/${reportId}`);
  assert.equal(empCheck.status, 200);
  assert.equal(empCheck.body.data.status, 'PAID');
  assert.equal(empCheck.body.data.totalAmount, 182700);
});
