import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';
import { createValidPngBuffer, createValidPdfBuffer } from '../../fixtures/mockFiles.ts';

beforeEach(() => {
  resetTestState();
});

test('F07: Employee retrieves corporate expense categories and single-item limits', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/expenses/categories');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 6);

  const trav = res.body.data.find((c: any) => c.code === 'EXP-TRAV');
  assert.ok(trav);
  assert.equal(trav.maxSingleLimit, 200000);
  assert.equal(trav.receiptThreshold, 5000);
});

test('F08: Upload receipt with valid PNG magic-bytes returns file URL', async () => {
  const client = await createAuthenticatedClient('employee');
  const pngBuffer = createValidPngBuffer();
  const res = await client.upload('/api/v1/expenses/upload-receipt', pngBuffer, 'image/png');

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.mimeType, 'image/png');
  assert.ok(res.body.fileUrl.endsWith('.png'));
});

test('F08: Upload receipt with valid PDF magic-bytes returns file URL', async () => {
  const client = await createAuthenticatedClient('employee');
  const pdfBuffer = createValidPdfBuffer();
  const res = await client.upload('/api/v1/expenses/upload-receipt', pdfBuffer, 'application/pdf');

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.mimeType, 'application/pdf');
  assert.ok(res.body.fileUrl.endsWith('.pdf'));
});

test('F07 & F14: Submit multi-item expense claim with items below and above 5k NGN threshold', async () => {
  const client = await createAuthenticatedClient('employee');

  // Upload receipt for the >5k item
  const png = createValidPngBuffer();
  const uploadRes = await client.upload('/api/v1/expenses/upload-receipt', png, 'image/png');
  const receiptUrl = uploadRes.body.fileUrl;

  const res = await client.post('/api/v1/expenses/reports', {
    title: 'Client Outreach & Operations - Week 1',
    purpose: 'Customer visits in Maitama & office stationery',
    items: [
      {
        categoryId: 'cat-hosp',
        merchantName: 'Transcorp Hilton Coffee Lounge',
        amount: 18500, // > 5,000 NGN, requires receipt
        receiptUrl,
        description: 'Client lunch meeting with credit applicant'
      },
      {
        categoryId: 'cat-office',
        merchantName: 'Wuse Bookshop',
        amount: 3500, // <= 5,000 NGN, under threshold
        description: 'A4 printing paper'
      }
    ]
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.totalAmount, 22000);
  assert.equal(res.body.data.items.length, 2);
  assert.equal(res.body.data.status, 'SUBMITTED');
  assert.equal(res.body.data.currency, 'NGN');
});

test('F09: Employee lists expense reports and inspects claim details', async () => {
  const client = await createAuthenticatedClient('employee');
  const createRes = await client.post('/api/v1/expenses/reports', {
    title: 'Local Transport Claim',
    purpose: 'Commute between branches',
    items: [
      {
        categoryId: 'cat-trav',
        merchantName: 'Bolt Abuja',
        amount: 4500,
        description: 'Trip to Central Business District'
      }
    ]
  });

  const listRes = await client.get('/api/v1/expenses/reports?scope=mine');
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.some((r: any) => r.id === createRes.body.data.id));

  const getRes = await client.get(`/api/v1/expenses/reports/${createRes.body.data.id}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.data.title, 'Local Transport Claim');
});

test('F15: Manager reviews and approves expense claim <= 50,000 NGN directly to APPROVED', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const createRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Training Materials',
    purpose: 'Risk certification course guides',
    items: [
      {
        categoryId: 'cat-train',
        merchantName: 'Chartered Institute',
        amount: 45000,
        receiptUrl: '/uploads/receipts/rec-cert.pdf',
        description: 'Underwriting textbook'
      }
    ]
  });

  const mgrClient = await createAuthenticatedClient('manager');
  const approveRes = await mgrClient.patch(`/api/v1/expenses/reports/${createRes.body.data.id}/action`, {
    action: 'APPROVE',
    comments: 'Verified and approved.'
  });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.data.status, 'APPROVED');
});

test('F15: Finance Controller confirms reimbursement disbursement with payment reference', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const createRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Petty Office Expense',
    purpose: 'Stationery recharge',
    items: [
      {
        categoryId: 'cat-ops',
        merchantName: 'Abuja Stationery Supplies',
        amount: 15000,
        receiptUrl: '/uploads/receipts/rec-stat.pdf',
        description: 'Envelopes and stamps'
      }
    ]
  });

  // Manager approves
  const mgrClient = await createAuthenticatedClient('manager');
  await mgrClient.patch(`/api/v1/expenses/reports/${createRes.body.data.id}/action`, { action: 'APPROVE' });

  // Finance disburses
  const finClient = await createAuthenticatedClient('finance');
  const disburseRes = await finClient.post(`/api/v1/expenses/reports/${createRes.body.data.id}/disburse`, {
    disbursementReference: 'NIP-CBN-2026-981244',
    paidDate: '2026-03-10'
  });

  assert.equal(disburseRes.status, 200);
  assert.equal(disburseRes.body.data.status, 'PAID');
  assert.equal(disburseRes.body.data.disbursementReference, 'NIP-CBN-2026-981244');
});
