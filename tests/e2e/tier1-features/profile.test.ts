import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedClient, resetTestState } from '../../helpers/testHarness.ts';

beforeEach(() => {
  resetTestState();
});

test('F03: Authenticated employee retrieves comprehensive profile docket', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.get('/api/v1/portal/profile');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const profile = res.body.data;
  assert.equal(profile.staffId, 'NX-1042');
  assert.equal(profile.firstName, 'Oluwaseun');
  assert.equal(profile.lastName, 'Bakare');
  assert.equal(profile.department, 'Credit & Risk');
  assert.equal(profile.designation, 'Risk Analyst');
  assert.ok(profile.phone, 'Expected phone number to be present');
  assert.ok(profile.emergencyContactName, 'Expected emergency contact');
  assert.ok(profile.bankAccountNumber, 'Expected bank account');
});

test('F03: Employee successfully updates personal phone and address', async () => {
  const client = await createAuthenticatedClient('employee');
  const updateRes = await client.patch('/api/v1/portal/profile', {
    phone: '+2348123456789',
    residentialAddress: 'Plot 12, Gwarinpa Estate, Abuja'
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.phone, '+2348123456789');
  assert.equal(updateRes.body.data.residentialAddress, 'Plot 12, Gwarinpa Estate, Abuja');

  // Verify persistence on fresh GET
  const getRes = await client.get('/api/v1/portal/profile');
  assert.equal(getRes.body.data.phone, '+2348123456789');
  assert.equal(getRes.body.data.residentialAddress, 'Plot 12, Gwarinpa Estate, Abuja');
});

test('F03: Employee updates emergency next-of-kin contact details', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.patch('/api/v1/portal/profile', {
    emergencyContactName: 'Dr. Tunde Bakare',
    emergencyContactPhone: '+2348039876543',
    emergencyContactRelationship: 'Father'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.emergencyContactName, 'Dr. Tunde Bakare');
  assert.equal(res.body.data.emergencyContactPhone, '+2348039876543');
  assert.equal(res.body.data.emergencyContactRelationship, 'Father');
});

test('F03: Employee updates Nigerian 10-digit NUBAN banking reimbursement details', async () => {
  const client = await createAuthenticatedClient('employee');
  const res = await client.patch('/api/v1/portal/profile', {
    bankName: 'Access Bank PLC',
    bankAccountNumber: '0123987456',
    bankAccountName: 'Oluwaseun T. Bakare'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.bankName, 'Access Bank PLC');
  assert.equal(res.body.data.bankAccountNumber, '0123987456');
  assert.equal(res.body.data.bankAccountName, 'Oluwaseun T. Bakare');
});

test('F03: Female employee (Chioma) views and updates profile details', async () => {
  const client = await createAuthenticatedClient('chioma');
  const res = await client.get('/api/v1/portal/profile');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.firstName, 'Chioma');
  assert.equal(res.body.data.gender, 'FEMALE');

  const patchRes = await client.patch('/api/v1/portal/profile', {
    residentialAddress: 'Lifecamp, Abuja'
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.data.residentialAddress, 'Lifecamp, Abuja');
});
