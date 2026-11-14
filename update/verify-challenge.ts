import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// 1. Import all exports from barrel files
import * as PagesBarrel from './src/pages';
import * as PublicPages from './src/pages/public';
import * as AuthPages from './src/pages/auth';
import * as PortalPages from './src/pages/portal';
import * as AdminPages from './src/pages/admin';

// 2. Import individual components directly from source
import { LandingPage } from './src/pages/public/LandingPage';
import { AboutUsPage } from './src/pages/public/AboutUsPage';
import { ProductDetailPage } from './src/pages/public/ProductDetailPage';
import { BlogPage } from './src/pages/public/BlogPage';
import { CareersPage } from './src/pages/public/CareersPage';
import { GalleryPage } from './src/pages/public/GalleryPage';

import { LoginPage } from './src/pages/auth/LoginPage';
import { RegisterPage } from './src/pages/auth/RegisterPage';

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

import App from './src/App';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  outputLength?: number;
}

const results: TestResult[] = [];

function assertTest(name: string, category: string, fn: () => void) {
  try {
    fn();
    results.push({ name, category, passed: true });
  } catch (err: any) {
    results.push({ name, category, passed: false, error: err?.message || String(err) });
  }
}

console.log('========================================================');
console.log(' NEXUS FINANCE — CLIENT ROUTING & EXPORT CHALLENGE SUITE');
console.log('========================================================\n');

// --- SUITE 1: BARREL EXPORTS INTEGRITY ---
const expectedExports = {
  public: ['LandingPage', 'AboutUsPage', 'ProductDetailPage', 'BlogPage', 'CareersPage', 'GalleryPage'],
  auth: ['LoginPage', 'RegisterPage'],
  portal: ['StaffDashboardPage', 'StaffLeavePage', 'StaffExpensesPage', 'StaffAppraisalsPage', 'StaffProfilePage'],
  admin: ['AdminDashboardPage', 'EmployeeDirectoryPage', 'LeaveApprovalPage', 'ExpenseApprovalPage', 'AppraisalCalibrationPage', 'AuditLogsPage'],
};

for (const exp of expectedExports.public) {
  assertTest(`Export public/${exp}`, 'Barrel Exports', () => {
    if (typeof (PublicPages as any)[exp] !== 'function') throw new Error(`Missing export in public: ${exp}`);
    if (typeof (PagesBarrel as any)[exp] !== 'function') throw new Error(`Missing re-export in master pages: ${exp}`);
  });
}

for (const exp of expectedExports.auth) {
  assertTest(`Export auth/${exp}`, 'Barrel Exports', () => {
    if (typeof (AuthPages as any)[exp] !== 'function') throw new Error(`Missing export in auth: ${exp}`);
    if (typeof (PagesBarrel as any)[exp] !== 'function') throw new Error(`Missing re-export in master pages: ${exp}`);
  });
}

for (const exp of expectedExports.portal) {
  assertTest(`Export portal/${exp}`, 'Barrel Exports', () => {
    if (typeof (PortalPages as any)[exp] !== 'function') throw new Error(`Missing export in portal: ${exp}`);
    if (typeof (PagesBarrel as any)[exp] !== 'function') throw new Error(`Missing re-export in master pages: ${exp}`);
  });
}

for (const exp of expectedExports.admin) {
  assertTest(`Export admin/${exp}`, 'Barrel Exports', () => {
    if (typeof (AdminPages as any)[exp] !== 'function') throw new Error(`Missing export in admin: ${exp}`);
    if (typeof (PagesBarrel as any)[exp] !== 'function') throw new Error(`Missing re-export in master pages: ${exp}`);
  });
}

// --- SUITE 2: SSR RENDER INTEGRITY OF ALL 19 INDIVIDUAL PAGES ---
const noop = () => {};

const pageRenders: Array<{ name: string; element: React.ReactElement }> = [
  {
    name: 'LandingPage',
    element: React.createElement(LandingPage, {
      onOpenApply: noop,
      onNavigate: noop,
      onScrollToCalculator: noop,
    }),
  },
  {
    name: 'AboutUsPage',
    element: React.createElement(AboutUsPage, {
      onOpenApply: noop,
      onNavigate: noop,
    }),
  },
  {
    name: 'ProductDetailPage (suremoney-loan)',
    element: React.createElement(ProductDetailPage, {
      productId: 'suremoney-loan',
      onOpenApply: noop,
      onNavigate: noop,
    }),
  },
  {
    name: 'ProductDetailPage (wealth-asset-yield)',
    element: React.createElement(ProductDetailPage, {
      productId: 'wealth-asset-yield',
      onOpenApply: noop,
      onNavigate: noop,
    }),
  },
  {
    name: 'ProductDetailPage (unknown product fallback test)',
    element: React.createElement(ProductDetailPage, {
      productId: 'invalid-non-existent-product-id',
      onOpenApply: noop,
      onNavigate: noop,
    }),
  },
  {
    name: 'BlogPage',
    element: React.createElement(BlogPage, {
      onNavigate: noop,
      onOpenApply: noop,
    }),
  },
  {
    name: 'CareersPage',
    element: React.createElement(CareersPage, {
      onNavigate: noop,
      onOpenApply: noop,
    }),
  },
  {
    name: 'GalleryPage',
    element: React.createElement(GalleryPage, {
      onNavigate: noop,
      onOpenApply: noop,
    }),
  },
  {
    name: 'LoginPage',
    element: React.createElement(LoginPage, {
      onNavigate: noop,
      onLoginSuccess: noop,
    }),
  },
  {
    name: 'RegisterPage',
    element: React.createElement(RegisterPage, {
      onNavigate: noop,
    }),
  },
  {
    name: 'StaffDashboardPage',
    element: React.createElement(StaffDashboardPage, {
      currentPath: '/portal/dashboard',
      onNavigate: noop,
      userRole: 'Employee',
      userName: 'David Alabi',
    }),
  },
  {
    name: 'StaffLeavePage',
    element: React.createElement(StaffLeavePage, {
      currentPath: '/portal/leave',
      onNavigate: noop,
    }),
  },
  {
    name: 'StaffExpensesPage',
    element: React.createElement(StaffExpensesPage, {
      currentPath: '/portal/expenses',
      onNavigate: noop,
    }),
  },
  {
    name: 'StaffAppraisalsPage',
    element: React.createElement(StaffAppraisalsPage, {
      currentPath: '/portal/appraisals',
      onNavigate: noop,
    }),
  },
  {
    name: 'StaffProfilePage',
    element: React.createElement(StaffProfilePage, {
      currentPath: '/portal/profile',
      onNavigate: noop,
    }),
  },
  {
    name: 'AdminDashboardPage',
    element: React.createElement(AdminDashboardPage, {
      currentPath: '/admin/dashboard',
      onNavigate: noop,
      userRole: 'HR & System Admin',
      userName: 'Henrietta Okolo',
    }),
  },
  {
    name: 'EmployeeDirectoryPage',
    element: React.createElement(EmployeeDirectoryPage, {
      currentPath: '/admin/employees',
      onNavigate: noop,
    }),
  },
  {
    name: 'LeaveApprovalPage',
    element: React.createElement(LeaveApprovalPage, {
      currentPath: '/admin/leave-approvals',
      onNavigate: noop,
    }),
  },
  {
    name: 'ExpenseApprovalPage',
    element: React.createElement(ExpenseApprovalPage, {
      currentPath: '/admin/expense-approvals',
      onNavigate: noop,
    }),
  },
  {
    name: 'AppraisalCalibrationPage',
    element: React.createElement(AppraisalCalibrationPage, {
      currentPath: '/admin/appraisals',
      onNavigate: noop,
    }),
  },
  {
    name: 'AuditLogsPage',
    element: React.createElement(AuditLogsPage, {
      currentPath: '/admin/audit-logs',
      onNavigate: noop,
    }),
  },
];

for (const p of pageRenders) {
  assertTest(`Render <${p.name}>`, 'Page Component Rendering', () => {
    const markup = renderToStaticMarkup(p.element);
    if (!markup || markup.length < 20) {
      throw new Error(`Component rendered empty or truncated output (${markup.length} bytes)`);
    }
  });
}

// --- SUITE 3: APP ROUTER ROOT RENDER ---
assertTest('Render root <App /> initial default (home)', 'Router Root', () => {
  const markup = renderToStaticMarkup(React.createElement(App));
  if (!markup.includes('Nexus Finance')) {
    throw new Error('Root App did not render institutional header/branding');
  }
});

// Print Results
console.log('\n--- Challenge Results ---\n');
let passedCount = 0;
let failedCount = 0;

for (const res of results) {
  if (res.passed) {
    passedCount++;
    console.log(`  [PASS] [${res.category}] ${res.name}`);
  } else {
    failedCount++;
    console.log(`  [FAIL] [${res.category}] ${res.name} -> ${res.error}`);
  }
}

console.log('\n========================================================');
console.log(` Summary: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} assertions.`);
console.log('========================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
