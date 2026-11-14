import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const updateDir = path.join(projectRoot, 'update');
const srcDir = path.join(updateDir, 'src');
const componentsDir = path.join(srcDir, 'components');
const pagesDir = path.join(srcDir, 'pages');
const libDir = path.join(srcDir, 'lib');

// --------------------------------------------------------------------------
// 1. Clean Components Directory Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: update/src/components/ has exactly 0 loose files in its root', () => {
  assert.ok(fs.existsSync(componentsDir), 'components directory must exist');

  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile());
  const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  assert.equal(
    files.length,
    0,
    `update/src/components root must contain exactly 0 files, but found: ${files.map((f) => f.name).join(', ')}`
  );

  assert.ok(subdirs.includes('ui'), 'components must have a ui/ subdirectory');
  assert.ok(subdirs.includes('layout'), 'components must have a layout/ subdirectory');
  assert.ok(subdirs.includes('features'), 'components must have a features/ subdirectory');
});

// --------------------------------------------------------------------------
// 2. Credentials 'include' Invariant for HttpOnly Session Cookies
// --------------------------------------------------------------------------
test('CHALLENGE: update/src/lib/api.ts explicitly enforces credentials: "include" on all fetch requests', () => {
  const apiFilePath = path.join(libDir, 'api.ts');
  assert.ok(fs.existsSync(apiFilePath), 'api.ts must exist');

  const content = fs.readFileSync(apiFilePath, 'utf-8');

  // Must have credentials: 'include'
  assert.match(
    content,
    /credentials\s*:\s*['"]include['"]/,
    'api.ts request wrapper must explicitly include credentials: "include" for HttpOnly cookie propagation'
  );

  // Must export class ApiError
  assert.match(content, /export\s+class\s+ApiError\s+extends\s+Error/, 'api.ts must export ApiError');

  // Must export api object with required domain namespaces
  assert.match(content, /export\s+const\s+api\s*=/, 'api.ts must export api constant');
  assert.match(content, /profile\s*:\s*\{/, 'api must provide profile namespace');
  assert.match(content, /leaves\s*:\s*\{/, 'api must provide leaves namespace');
  assert.match(content, /auth\s*:\s*\{/, 'api must provide auth namespace');
});

test('CHALLENGE: No rogue fetch() in update/src bypasses credentials: "include"', () => {
  function scanDir(dir: string, fileList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, fileList);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allTsFiles = scanDir(srcDir);
  const rogueFetches: string[] = [];

  for (const filePath of allTsFiles) {
    const relPath = path.relative(srcDir, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find all occurrences of fetch(
    const fetchMatches = [...content.matchAll(/fetch\s*\(/g)];
    if (fetchMatches.length > 0) {
      if (relPath !== path.join('lib', 'api.ts')) {
        // Any direct fetch outside api.ts is flagged
        rogueFetches.push(relPath);
      }
    }
  }

  assert.equal(
    rogueFetches.length,
    0,
    `Direct fetch() calls found outside update/src/lib/api.ts: ${rogueFetches.join(', ')}`
  );
});

// --------------------------------------------------------------------------
// 3. Strict Nigerian NUBAN, BVN, NIN Validation Invariants
// --------------------------------------------------------------------------
test('CHALLENGE: StaffProfilePage.tsx strictly validates 10-digit Nigerian NUBAN format', () => {
  const profilePagePath = path.join(pagesDir, 'portal', 'StaffProfilePage.tsx');
  assert.ok(fs.existsSync(profilePagePath), 'StaffProfilePage.tsx must exist');

  const content = fs.readFileSync(profilePagePath, 'utf-8');

  // Must contain strict 10-digit regex /^\d{10}$/
  assert.match(
    content,
    /\/\^\\d\{10\}\$\//,
    'StaffProfilePage.tsx must validate bankAccountNumber with strict 10-digit regex /^\\d{10}$/'
  );

  // Must sanitize input to digits only and cap at 10 digits
  assert.match(
    content,
    /replace\(\/\\D\/g,\s*['"]['"]\)\.slice\(0,\s*10\)/,
    'handleNubanChange must sanitize digits and cap length at 10'
  );

  // Invariant stress test on the regex pattern
  const nubanRegex = /^\d{10}$/;

  // Valid 10-digit NUBAN accounts
  assert.ok(nubanRegex.test('0123456789'), 'Standard 10-digit NUBAN should pass');
  assert.ok(nubanRegex.test('2084930192'), 'Zenith/GTBank 10-digit NUBAN should pass');
  assert.ok(nubanRegex.test('0000000000'), '10 zeros should match pattern');

  // Invalid NUBAN accounts
  assert.equal(nubanRegex.test(''), false, 'Empty string is invalid');
  assert.equal(nubanRegex.test('123456789'), false, '9 digits must be rejected');
  assert.equal(nubanRegex.test('12345678901'), false, '11 digits must be rejected');
  assert.equal(nubanRegex.test('012345678A'), false, 'Alphanumeric must be rejected');
  assert.equal(nubanRegex.test(' 0123456789'), false, 'Leading whitespace must be rejected');
  assert.equal(nubanRegex.test('0123456789 '), false, 'Trailing whitespace must be rejected');
  assert.equal(nubanRegex.test('012-345678'), false, 'Hyphenated number must be rejected');
});

test('CHALLENGE: StaffProfilePage.tsx strictly validates 11-digit BVN and NIN format', () => {
  const profilePagePath = path.join(pagesDir, 'portal', 'StaffProfilePage.tsx');
  const content = fs.readFileSync(profilePagePath, 'utf-8');

  // Must contain strict 11-digit regex for BVN and NIN
  assert.match(
    content,
    /\/\^\\d\{11\}\$\//,
    'StaffProfilePage.tsx must validate BVN and NIN with strict 11-digit regex /^\\d{11}$/'
  );

  const bvnNinRegex = /^\d{11}$/;

  assert.ok(bvnNinRegex.test('22233344455'), 'Valid 11-digit BVN should pass');
  assert.ok(bvnNinRegex.test('10000000000'), 'Valid 11-digit NIN should pass');
  assert.equal(bvnNinRegex.test('2223334445'), false, '10-digit BVN must fail');
  assert.equal(bvnNinRegex.test('222333444555'), false, '12-digit BVN must fail');
  assert.equal(bvnNinRegex.test('2223334445X'), false, 'Alphanumeric BVN must fail');
});

// --------------------------------------------------------------------------
// 4. Restricted Profile Fields Exclusion from Client Mutation Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: StaffProfilePage.tsx excludes restricted fields from PUT payload', () => {
  const profilePagePath = path.join(pagesDir, 'portal', 'StaffProfilePage.tsx');
  const content = fs.readFileSync(profilePagePath, 'utf-8');

  // Extract the payload construction inside handleSave
  const handleSaveMatch = content.match(/const\s+handleSave\s*=\s*async[\s\S]*?const\s+payload\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(handleSaveMatch, 'handleSave must construct an explicit payload object');

  const payloadString = handleSaveMatch[1];

  // Restricted fields that must NEVER appear in the client PUT mutation payload
  const restrictedFields = ['salary', 'title', 'role', 'staffId', 'department', 'employmentType', 'hireDate'];

  for (const field of restrictedFields) {
    const fieldRegex = new RegExp(`\\b${field}\\b\\s*:`, 'i');
    assert.equal(
      fieldRegex.test(payloadString),
      false,
      `Restricted field "${field}" must not be included in client profile update payload`
    );
  }
});

test('CHALLENGE: update/src/lib/api.ts profile.update signature strictly excludes restricted fields', () => {
  const apiFilePath = path.join(libDir, 'api.ts');
  const content = fs.readFileSync(apiFilePath, 'utf-8');

  // Extract profile.update argument type
  const updateMatch = content.match(/update\s*:\s*\(\s*payload\s*:\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(updateMatch, 'api.profile.update method must define typed payload');

  const paramTypeString = updateMatch[1];
  const restrictedFields = ['salary', 'title', 'role', 'staffId', 'department', 'employmentType', 'hireDate'];

  for (const field of restrictedFields) {
    const fieldRegex = new RegExp(`\\b${field}\\b\\s*\\??:`, 'i');
    assert.equal(
      fieldRegex.test(paramTypeString),
      false,
      `Restricted field "${field}" must not be accepted by api.profile.update type definition`
    );
  }
});

// --------------------------------------------------------------------------
// 5. Leave Application Drawer Zero-Overdraft & Date Inversion Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: StaffLeavePage.tsx enforces zero-overdraft and inverted date submission guards', () => {
  const leavePagePath = path.join(pagesDir, 'portal', 'StaffLeavePage.tsx');
  assert.ok(fs.existsSync(leavePagePath), 'StaffLeavePage.tsx must exist');

  const content = fs.readFileSync(leavePagePath, 'utf-8');

  // Date inversion check in real-time calculation hook
  assert.match(
    content,
    /if\s*\(\s*endDate\s*<\s*startDate\s*\)/,
    'StaffLeavePage.tsx must check for inverted dates (endDate < startDate)'
  );
  assert.match(
    content,
    /End date cannot be earlier than start date/,
    'StaffLeavePage.tsx must show inverted date error message'
  );

  // Zero-working-days guard
  assert.match(
    content,
    /calcResult\.workingDays\s*<=\s*0/,
    'handleSubmit must reject submissions with 0 or negative working days'
  );

  // Zero-overdraft balance guard
  assert.match(
    content,
    /calcResult\.workingDays\s*>\s*activeBalance\.availableDays/,
    'handleSubmit must reject submissions exceeding availableDays (zero-overdraft)'
  );

  // Policy guards: Casual leave limit of 2 days
  assert.match(
    content,
    /leaveTypeId\s*===\s*['"]lt-casual['"]\s*&&\s*calcResult\.workingDays\s*>\s*2/,
    'StaffLeavePage.tsx must enforce casual leave limit of max 2 consecutive working days'
  );

  // Policy guards: Sick leave medical certificate requirement for > 2 days
  assert.match(
    content,
    /leaveTypeId\s*===\s*['"]lt-sick['"]\s*&&\s*calcResult\.workingDays\s*>\s*2/,
    'StaffLeavePage.tsx must enforce medical certificate for sick leave > 2 working days'
  );
});

// --------------------------------------------------------------------------
// 6. LeaveApprovalPage Self-Approval Guard Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: LeaveApprovalPage.tsx visually and logically prevents self-approvals', () => {
  const approvalPagePath = path.join(pagesDir, 'admin', 'LeaveApprovalPage.tsx');
  assert.ok(fs.existsSync(approvalPagePath), 'LeaveApprovalPage.tsx must exist');

  const content = fs.readFileSync(approvalPagePath, 'utf-8');

  // Logical self-approval guard definition
  assert.match(
    content,
    /const\s+isSelf\s*=\s*reviewModalItem\s*&&\s*currentUserId\s*&&\s*reviewModalItem\.employeeId\s*===\s*currentUserId/,
    'LeaveApprovalPage.tsx must compute isSelf check comparing reviewModalItem.employeeId to currentUserId'
  );

  // Visual warning banner
  assert.match(
    content,
    /Self-Approval Prohibited/,
    'LeaveApprovalPage.tsx must render visual warning banner for self-approvals'
  );

  // Action button disabling
  assert.match(
    content,
    /disabled=\{Boolean\(isSelf\)\}/,
    'LeaveApprovalPage.tsx must disable Approve and Reject buttons when isSelf is true'
  );
});

// --------------------------------------------------------------------------
// 7. Design System, Tokens, and Typography Adherence Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: All Milestone 3 portal pages adhere to Nexus tokens and UI primitives', () => {
  const m3Pages = [
    path.join(pagesDir, 'portal', 'StaffProfilePage.tsx'),
    path.join(pagesDir, 'portal', 'StaffLeavePage.tsx'),
    path.join(pagesDir, 'portal', 'StaffDashboardPage.tsx'),
    path.join(pagesDir, 'admin', 'LeaveApprovalPage.tsx'),
  ];

  for (const pagePath of m3Pages) {
    const filename = path.basename(pagePath);
    assert.ok(fs.existsSync(pagePath), `${filename} must exist`);

    const content = fs.readFileSync(pagePath, 'utf-8');

    // UI primitives imports from ../../components/ui
    assert.match(
      content,
      /from\s+['"]\.\.\/\.\.\/components\/ui['"]/,
      `${filename} must import atomic components from ../../components/ui`
    );

    // Layout components from ../../components/layout/
    assert.match(
      content,
      /from\s+['"]\.\.\/\.\.\/components\/layout\/(PortalLayout|AdminLayout)['"]/,
      `${filename} must import standard Layout component`
    );

    // Font tokens
    assert.match(
      content,
      /font-display/,
      `${filename} must utilize Bricolage Grotesque display font class font-display`
    );

    // Border and surface tokens
    assert.match(
      content,
      /border-rule/,
      `${filename} must utilize Nexus border token border-rule`
    );
  }
});

// --------------------------------------------------------------------------
// 8. Nigerian Gazetted Statutory Holidays Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: SEED_NIGERIAN_HOLIDAYS_2026 defines all 12 statutory gazetted holidays', () => {
  const leaveTypesPath = path.join(libDir, 'leaveTypes.ts');
  assert.ok(fs.existsSync(leaveTypesPath), 'leaveTypes.ts must exist');

  const content = fs.readFileSync(leaveTypesPath, 'utf-8');

  // Verify key Nigerian statutory gazetted holidays in 2026
  const requiredHolidays = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-03-20', name: 'Eid al-Fitr (Day 1)' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-01', name: "Workers' Day" },
    { date: '2026-05-27', name: 'Eid al-Kabir (Day 1)' },
    { date: '2026-06-12', name: 'Democracy Day' },
    { date: '2026-10-01', name: 'Independence Day' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-28', name: 'Boxing Day (Observed)' },
  ];

  for (const h of requiredHolidays) {
    assert.match(
      content,
      new RegExp(`date:\\s*['"]${h.date}['"]`),
      `SEED_NIGERIAN_HOLIDAYS_2026 must contain gazetted holiday on ${h.date} (${h.name})`
    );
  }
});

// --------------------------------------------------------------------------
// 9. Absence of Legacy Mock Simulation Invariant
// --------------------------------------------------------------------------
test('CHALLENGE: No legacy mock setTimeout saves or mock ID generation remain in M3 pages', () => {
  const profilePage = fs.readFileSync(path.join(pagesDir, 'portal', 'StaffProfilePage.tsx'), 'utf-8');
  assert.equal(
    /setTimeout\s*\(\s*\(\)\s*=>\s*\{\s*setIsSaved\(true\)/.test(profilePage),
    false,
    'StaffProfilePage.tsx must not use mock setTimeout saving'
  );

  const leavePage = fs.readFileSync(path.join(pagesDir, 'portal', 'StaffLeavePage.tsx'), 'utf-8');
  assert.equal(
    /LV-2026-00\d/.test(leavePage),
    false,
    'StaffLeavePage.tsx must not fabricate mock leave request IDs'
  );
  assert.match(
    leavePage,
    /api\.leaves\.submitRequest/,
    'StaffLeavePage.tsx must dispatch via api.leaves.submitRequest'
  );

  const approvalPage = fs.readFileSync(path.join(pagesDir, 'admin', 'LeaveApprovalPage.tsx'), 'utf-8');
  assert.match(
    approvalPage,
    /api\.leaves\.reviewRequest/,
    'LeaveApprovalPage.tsx must invoke api.leaves.reviewRequest'
  );
});
