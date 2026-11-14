import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';
import {
  createDisallowedExeBuffer,
  createDisallowedScriptBuffer,
  createOversizedBuffer
} from '../../fixtures/mockFiles.ts';

beforeEach(() => {
  resetTestState();
});

test('Tier 2 Boundary: Expense claim with zero amount returns 400 Bad Request', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/expenses/reports', {
    title: 'Zero Claim',
    items: [
      {
        categoryId: 'cat-office',
        merchantName: 'Store',
        amount: 0,
        description: 'Zero naira item'
      }
    ]
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_AMOUNT');
});

test('Tier 2 Boundary: Expense claim with negative amount returns 400 Bad Request', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/expenses/reports', {
    title: 'Negative Claim',
    items: [
      {
        categoryId: 'cat-office',
        merchantName: 'Store',
        amount: -15000,
        description: 'Negative value item'
      }
    ]
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_AMOUNT');
});

test('Tier 2 Boundary: Expense item exceeding NGN 5,000 threshold without receipt returns 422', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.post('/api/v1/expenses/reports', {
    title: 'Client Dinner',
    items: [
      {
        categoryId: 'cat-hosp',
        merchantName: 'Chopsticks Abuja',
        amount: 18500, // > 5,000 NGN
        description: 'Dinner without receipt'
        // Missing receiptUrl
      }
    ]
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'RECEIPT_REQUIRED');
  assert.ok(res.body.error.message.includes('Receipt document is mandatory'));
});

test('Tier 2 Boundary: Single item amount exceeding category ceiling returns 422', async () => {
  const client = await createAuthenticatedClient('employee');
  // cat-telco limit is 30,000 NGN. Attempt 65,000 NGN.
  const res = await client.post('/api/v1/expenses/reports', {
    title: 'Excessive Telecom Recharge',
    items: [
      {
        categoryId: 'cat-telco',
        merchantName: 'MTN Business',
        amount: 65000,
        receiptUrl: '/uploads/receipts/rec-telco.pdf',
        description: 'Monthly broadband'
      }
    ]
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'CATEGORY_LIMIT_EXCEEDED');
  assert.ok(res.body.error.message.includes('exceeds maximum single limit'));
});

test('Tier 2 Boundary: File upload with executable magic-bytes (MZ header) returns 415', async () => {
  const client = await createAuthenticatedClient('employee');
  const exeBuffer = createDisallowedExeBuffer();
  const res = await client.upload('/api/v1/expenses/upload-receipt', exeBuffer, 'application/x-msdownload');

  assert.equal(res.status, 415);
  assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('Tier 2 Boundary: File upload with bash/shell script returns 415 Unsupported Media Type', async () => {
  const client = await createAuthenticatedClient('employee');
  const scriptBuffer = createDisallowedScriptBuffer();
  const res = await client.upload('/api/v1/expenses/upload-receipt', scriptBuffer, 'text/x-shellscript');

  assert.equal(res.status, 415);
  assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('Tier 2 Boundary: Oversized file upload (> 10MB) returns 413 Payload Too Large', async () => {
  const client = await createAuthenticatedClient('employee');
  const hugeBuffer = createOversizedBuffer();
  const res = await client.upload('/api/v1/expenses/upload-receipt', hugeBuffer, 'application/pdf');

  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('Tier 2 Boundary: Self-approval prohibition prevents manager from approving own expense report', async () => {
  const mgrClient = await createAuthenticatedClient('manager');
  const submitRes = await mgrClient.post('/api/v1/expenses/reports', {
    title: 'Manager Travel Claim',
    items: [
      {
        categoryId: 'cat-trav',
        merchantName: 'Arik Air',
        amount: 45000,
        receiptUrl: '/uploads/receipts/flight.pdf',
        description: 'Flight to Lagos'
      }
    ]
  });
  assert.equal(submitRes.status, 201);

  // Manager attempts to approve own report
  const approveRes = await mgrClient.patch(`/api/v1/expenses/reports/${submitRes.body.data.id}/action`, {
    action: 'APPROVE'
  });

  assert.equal(approveRes.status, 403);
  assert.equal(approveRes.body.error.code, 'SELF_APPROVAL_PROHIBITED');
});

test('Tier 2 Boundary: Disbursement on unapproved expense report returns 409 Conflict', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const submitRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Pending Claim',
    items: [
      {
        categoryId: 'cat-office',
        merchantName: 'Store',
        amount: 2500,
        description: 'Notepads'
      }
    ]
  });
  assert.equal(submitRes.status, 201);

  // Finance attempts to disburse immediately while still SUBMITTED (not APPROVED)
  const finClient = await createAuthenticatedClient('finance');
  const disburseRes = await finClient.post(`/api/v1/expenses/reports/${submitRes.body.data.id}/disburse`, {
    disbursementReference: 'TRX-PREMATURE-01'
  });

  assert.equal(disburseRes.status, 409);
  assert.equal(disburseRes.body.error.code, 'NOT_APPROVED');
});

test('Tier 2 Boundary: Regular employee cannot trigger disbursement (403 Forbidden)', async () => {
  const empClient = await createAuthenticatedClient('employee');
  const submitRes = await empClient.post('/api/v1/expenses/reports', {
    title: 'Claim For Disbursement',
    items: [
      {
        categoryId: 'cat-office',
        merchantName: 'Store',
        amount: 2500,
        description: 'Items'
      }
    ]
  });
  assert.equal(submitRes.status, 201);

  // Manager approves
  const mgrClient = await createAuthenticatedClient('manager');
  await mgrClient.patch(`/api/v1/expenses/reports/${submitRes.body.data.id}/action`, { action: 'APPROVE' });

  // Employee attempts to trigger disbursement on own approved report
  const disburseRes = await empClient.post(`/api/v1/expenses/reports/${submitRes.body.data.id}/disburse`, {
    disbursementReference: 'ILLEGAL-TRX'
  });

  assert.equal(disburseRes.status, 403);
  assert.equal(disburseRes.body.error.code, 'FORBIDDEN');
});
