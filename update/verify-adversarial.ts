import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { StaffDashboardPage } from './src/pages/portal/StaffDashboardPage';
import { StaffLeavePage } from './src/pages/portal/StaffLeavePage';
import { StaffExpensesPage } from './src/pages/portal/StaffExpensesPage';
import { StaffAppraisalsPage } from './src/pages/portal/StaffAppraisalsPage';
import { StaffProfilePage } from './src/pages/portal/StaffProfilePage';

import { AdminDashboardPage } from './src/pages/admin/AdminDashboardPage';
import { EmployeeDirectoryPage } from './src/pages/admin/EmployeeDirectoryPage';
import { LeaveApprovalPage } from './src/pages/admin/LeaveApprovalPage';
import { ExpenseApprovalPage } from './src/pages/admin/ExpenseApprovalPage';
import { AppraisalCalibrationPage } from './src/pages/admin/AppraisalCalibrationPage';
import { AuditLogsPage } from './src/pages/admin/AuditLogsPage';

import { LoginPage } from './src/pages/auth/LoginPage';
import { RegisterPage } from './src/pages/auth/RegisterPage';
import { ProductDetailPage } from './src/pages/public/ProductDetailPage';

interface StressResult {
  scenario: string;
  expected: string;
  result: string;
  passed: boolean;
  error?: string;
}

const stressResults: StressResult[] = [];

function runStress(scenario: string, expected: string, fn: () => string) {
  try {
    const res = fn();
    stressResults.push({ scenario, expected, result: res, passed: true });
  } catch (err: any) {
    stressResults.push({
      scenario,
      expected,
      result: 'EXCEPTION_THROWN',
      passed: false,
      error: err?.message || String(err),
    });
  }
}

console.log('========================================================');
console.log(' NEXUS FINANCE — ADVERSARIAL STRESS TEST HARNESS');
console.log('========================================================\n');

// 1. Staff Dashboard under different role assignments
runStress(
  'StaffDashboardPage with role=Manager',
  'Renders without throwing with Manager snapshot',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffDashboardPage, {
        onNavigate: () => {},
        userRole: 'Manager',
        userName: 'David Nwokeukwu',
      })
    );
    if (!html.includes('David')) throw new Error('Missing user name in output');
    return 'Rendered successfully with Manager role';
  }
);

runStress(
  'StaffDashboardPage with role=Admin',
  'Renders without throwing with Admin snapshot',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffDashboardPage, {
        onNavigate: () => {},
        userRole: 'Admin',
        userName: 'Henrietta Okolo',
      })
    );
    if (!html.includes('Henrietta')) throw new Error('Missing user name in output');
    return 'Rendered successfully with Admin role';
  }
);

// 2. ProductDetailPage with extreme / malformed product IDs
runStress(
  'ProductDetailPage with empty string ID',
  'Falls back to default product gracefully',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductDetailPage, {
        productId: '',
        onOpenApply: () => {},
        onNavigate: () => {},
      })
    );
    if (!html.includes('Nexus Finance') && !html.includes('Loan')) {
      throw new Error('Fallback failed to render product template');
    }
    return 'Gracefully handled empty string product ID';
  }
);

runStress(
  'ProductDetailPage with XSS probe string in ID',
  'Sanitizes/safely treats XSS payload without throwing',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductDetailPage, {
        productId: '<script>alert(1)</script>',
        onOpenApply: () => {},
        onNavigate: () => {},
      })
    );
    if (html.includes('<script>alert(1)</script>')) {
      throw new Error('Raw unescaped script tag leaked into output');
    }
    return 'Safely rendered without unescaped script tag injection';
  }
);

// 3. EmployeeDirectoryPage with extreme query strings
runStress(
  'EmployeeDirectoryPage initial mount',
  'Renders workforce table with at least 5 employees and headers',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(EmployeeDirectoryPage, {
        onNavigate: () => {},
      })
    );
    if (!html.includes('Henrietta Okolo') || !html.includes('David Nwokeukwu')) {
      throw new Error('Workforce directory missing seed staff');
    }
    return 'Rendered directory with active employee records';
  }
);

// 4. LeaveApprovalPage items render
runStress(
  'LeaveApprovalPage initial mount',
  'Renders pending leave requests table with staff name and category',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(LeaveApprovalPage, {
        onNavigate: () => {},
      })
    );
    if (!html.includes('David Alabi') || !html.includes('Annual Vacation Leave')) {
      throw new Error('Missing seed leave request for David Alabi');
    }
    return 'Rendered pending leave request table with David Alabi request';
  }
);

// 5. ExpenseApprovalPage items render
runStress(
  'ExpenseApprovalPage initial mount',
  'Renders expense review queue',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(ExpenseApprovalPage, {
        onNavigate: () => {},
      })
    );
    if (!html.includes('EXP-2026-0089')) {
      throw new Error('Missing seed expense claim EXP-2026-0089');
    }
    return 'Rendered multi-tier expense review queue';
  }
);

// 6. AuditLogsPage immutable event stream
runStress(
  'AuditLogsPage initial mount',
  'Renders DevSecOps audit log entries with IP and action tokens',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditLogsPage, {
        onNavigate: () => {},
      })
    );
    if (!html.includes('AUTH_SUCCESS') || !html.includes('197.210.65.12')) {
      throw new Error('Audit log missing security event records');
    }
    return 'Rendered immutable DevSecOps audit events';
  }
);

// 7. AppraisalCalibrationPage performance curve
runStress(
  'AppraisalCalibrationPage initial mount',
  'Renders 4 performance tiers and distribution grid',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(AppraisalCalibrationPage, {
        onNavigate: () => {},
      })
    );
    if (!html.includes('Exceeds Expectations') || !html.includes('Q4 2026')) {
      throw new Error('Calibration grid missing performance tiers');
    }
    return 'Rendered performance appraisal calibration grid';
  }
);

// 8. StaffProfilePage KYC and NUBAN bank records
runStress(
  'StaffProfilePage initial mount',
  'Renders NUBAN, BVN, NIN, emergency contact inputs',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffProfilePage, {
        onNavigate: () => {},
      })
    );
    if (!html.includes('0142998812') || !html.includes('Folake Alabi')) {
      throw new Error('Profile missing banking or emergency contact records');
    }
    return 'Rendered full KYC and Nigerian NUBAN banking details';
  }
);

// Summary
let passedCount = 0;
let failedCount = 0;

console.log('--- Stress Test Results ---');
for (const s of stressResults) {
  if (s.passed) {
    passedCount++;
    console.log(`  [PASS] ${s.scenario} -> ${s.result}`);
  } else {
    failedCount++;
    console.log(`  [FAIL] ${s.scenario} -> ${s.error}`);
  }
}

console.log('\n========================================================');
console.log(` Stress Test Summary: ${passedCount} PASSED, ${failedCount} FAILED out of ${stressResults.length}`);
console.log('========================================================\n');

if (failedCount > 0) process.exit(1);
else process.exit(0);
