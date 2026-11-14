# Routing Normalization & Clean Architecture Specification

**Author**: `explorer_m1_r2_3` (Routing Normalization & Clean Architecture Explorer)  
**Target Milestone**: Milestone 1 Iteration 2 (M1_R2)  
**Date**: 2026-11-10  
**Status**: COMPLETE (Read-Only Proposal)

---

## 1. Executive Summary & Reviewer Finding Assessment

During Milestone 1 gate review, `reviewer_m1_1` issued **REQUEST_CHANGES** citing two routing-specific defects alongside architectural shortcuts in `src/components/`:
1. **Finding 3 (Major) — Route Normalization Downgrade & Incomplete Route Structure in `App.tsx`**:
   - Auth routes were downgraded from `/auth/login` and `/auth/register` to `#login` and `#register` upon navigation (`handleNavigate` lines 125–128).
   - `handleUrlChange` only checked exact string matches and lacked sub-route dispatching.
   - `CmsPortal` and `ApplyModal` were imported loosely from `src/components/` root, violating directory boundary constraints.
2. **Finding 4 (Major) — Missing 404 / NotFound Route Boundary & Fallback**:
   - Direct navigation to unmatched hash strings (e.g. `#/portal/unknown`, `#/settings`, or arbitrary input) resulted in completely blank main views with no user feedback or recovery path.

This document provides a complete, robust routing normalization architecture that:
- Normalizes all client routing to canonical hierarchical paths (`/auth/login`, `/auth/register`, `/portal/*`, `/admin/*`, `/about`, etc.).
- Keeps hash routes matching the official hierarchy (`#/auth/login`, `#/auth/register`, `#/portal/dashboard`, `#/admin/dashboard`) without stripping namespaces.
- Preserves 100% backward compatibility for legacy navigation calls (`login`, `portal`, `admin`, `cms`, section anchors).
- Introduces `NotFoundPage.tsx` under `src/pages/public/` with diagnostic feedback and instant recovery actions.
- Relocates `CmsPortal` into `src/pages/admin/CmsPortalPage.tsx` and `ApplyModal` into `src/components/features/ApplyModal.tsx`, completely removing root component imports from `App.tsx`.
- Ensures zero build regressions under `vite build` (`tsc -b`).

---

## 2. Routing Architecture Analysis

### 2.1 Hash Routing vs Path Routing in Vite SPA
The Nexus Finance application is a Single-Page Application (SPA) built with React 19 and Vite 8 without an external client router dependency (e.g., `react-router`). Routing is managed via native browser events (`hashchange`, `popstate`, `window.location.hash`).

In static deployments (preview servers, static CDNs, file servers), direct browser path requests (e.g., `GET /portal/dashboard`) fail with HTTP 404 unless a server rewrite rule is configured to rewrite all routes to `/index.html`. Hash routing (`window.location.hash`) guarantees:
- **Zero server rewrite dependency**: The host server only serves `/index.html`, and the client router extracts the route from the hash fragment.
- **Full deep linking support**: Users can bookmark or share `https://example.com/#/portal/dashboard` or `https://example.com/#/auth/login`, and the application restores the exact view on initial load.
- **Instant client-side transitions**: Changing `window.location.hash` does not trigger a full page reload, enabling Framer Motion contextual transitions (`AnimatePresence mode="wait"`).

### 2.2 Auth Route Normalization
In the current implementation (`App.tsx` lines 125–128), calling `handleNavigate('/auth/login')` explicitly downgraded the route:
```ts
// Flawed downgrade in current App.tsx:
} else if (route === 'login' || route === '/auth/login') {
  route = 'login';
} else if (route === 'register' || route === '/auth/register') {
  route = 'register';
}
...
window.location.hash = route; // resulted in #login instead of #/auth/login
```
This caused:
1. Address bar desynchronization (`#login` instead of `#/auth/login`).
2. Namespace pollution: downplaying the `/auth/` prefix required downstream auth guards (in Milestone 2) to maintain ad-hoc special cases rather than clean prefix checking (`path.startsWith('/auth/')`).
3. Contract inconsistency with `PROJECT.md` section *Client Routing & Scaffolding* (`src/pages/auth/`).

**Normalized Hierarchy:**
- Canonical Auth Routes: `#/auth/login` and `#/auth/register`.
- Canonical Internal State: `currentRoute = '/auth/login'` and `currentRoute = '/auth/register'`.
- Normalizer Mapping:
  - Input `'login'`, `'/login'`, `'#login'`, `'/auth/login'`, `'#/auth/login'` -> resolves to `'/auth/login'`.
  - Input `'register'`, `'/register'`, `'#register'`, `'/auth/register'`, `'#/auth/register'` -> resolves to `'/auth/register'`.
  - When `window.location.hash` is updated, it is set to `'/auth/login'` (rendered by browser as `#/auth/login`).

### 2.3 Route Namespace Topography
All valid application routes are categorized into four distinct namespaces:

| Namespace | Routes | Shell Layout | Access Level |
|---|---|---|---|
| **Public** | `'home'`, `'/about'`, `'/blog'`, `'/careers'`, `'/gallery'`, `'/product-detail'`, `'/404'` | Public Shell (`Navbar` + `Footer`) | Public |
| **Auth** | `'/auth/login'`, `'/auth/register'` | Standalone Auth Card (Centered, no public navbar/footer) | Unauthenticated / Guest |
| **Staff Portal** | `'/portal/dashboard'`, `'/portal/leave'`, `'/portal/expenses'`, `'/portal/appraisals'`, `'/portal/profile'` | `PortalLayout` (with Portal `Sidebar`) | Authenticated Employee |
| **HRMS Admin** | `'/admin/dashboard'`, `'/admin/employees'`, `'/admin/leave-approvals'`, `'/admin/expense-approvals'`, `'/admin/appraisals'`, `'/admin/audit-logs'`, `'/admin/cms'` | `AdminLayout` (with Admin `Sidebar`) | Authenticated HR / Admin |

---

## 3. Missing 404 / NotFound Route Strategy

### 3.1 Failure Mode in Current Code
When an unmatched hash is entered (e.g. `#/portal/invalid`, `#/settings`, `#/foobar`), `App.tsx` behaves unpredictably:
1. If the route starts with `#/portal/`, `currentRoute` is set to `'/portal/invalid'`, but no portal page matches, rendering a blank white/dark `<main>` element.
2. If the route starts with `#/admin/`, same blank screen occurs.
3. If the route does not start with a recognized prefix, `handleUrlChange` exits early without updating state, leaving the prior page active while the URL bar displays an invalid hash.
4. Calling `handleNavigate('/unknown')` falls through all checks, sets `currentRoute = 'home'`, and attempts `document.getElementById('/unknown')`.

### 3.2 Recovery Architecture
To solve this:
1. **Central Route Resolver (`resolveRoute`)**: Any hash that does not match a known public, auth, portal, or admin route resolves to `'/404'` with the invalid path preserved in `attemptedPath`.
2. **Dedicated `NotFoundPage.tsx`**: Rendered inside `src/pages/public/NotFoundPage.tsx` within the public shell (with global Navbar & Footer) so users retain complete navigation context.
3. **User Feedback & Recovery**:
   - Clear HTTP 404 badge in brand sapphire (`#0D51B2`).
   - Diagnostic display of the requested URL (`attemptedPath`).
   - One-click recovery buttons: "Return to Home", "Staff Portal", "HRMS Admin", and "Browse Products".

### 3.3 Specification for `src/pages/public/NotFoundPage.tsx`
Create `update/src/pages/public/NotFoundPage.tsx`:

```tsx
import React from 'react';
import { motion } from 'motion/react';
import {
  House,
  ArrowLeft,
  ShieldCheck,
  User,
  WarningCircle,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { Button, Card } from '../../components/ui';

export interface NotFoundPageProps {
  attemptedPath?: string;
  onNavigate: (view: string, productId?: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  attemptedPath,
  onNavigate,
}) => {
  const displayPath = attemptedPath || (typeof window !== 'undefined' ? window.location.hash : '');

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8 bg-canvas">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl text-center space-y-6"
      >
        {/* Error Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft text-brand border border-brand/20 text-xs font-semibold uppercase tracking-wider">
          <WarningCircle size={16} weight="fill" />
          <span>HTTP 404 &bull; Page Not Found</span>
        </div>

        {/* Display Heading */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold font-display text-ink tracking-tight">
            Lost in the Nexus?
          </h1>
          <p className="text-sm sm:text-base text-muted max-w-md mx-auto leading-relaxed font-sans">
            The page or resource you requested does not exist, has been moved, or is temporarily unavailable.
          </p>
        </div>

        {/* Diagnostic Path Snippet */}
        {displayPath && (
          <div className="p-3 mx-auto max-w-md rounded-[7px] bg-subtle border border-rule text-xs font-mono text-muted text-center break-all">
            Requested: <span className="text-ink font-semibold">{displayPath}</span>
          </div>
        )}

        {/* Action Controls */}
        <Card className="p-6 bg-surface border border-rule shadow-sm space-y-4 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Recommended Recovery Paths
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="primary"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('home')}
            >
              <House size={16} weight="bold" />
              <span>Return to Home</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('/portal/dashboard')}
            >
              <User size={16} />
              <span>Staff Portal</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('/admin/dashboard')}
            >
              <ShieldCheck size={16} />
              <span>Admin Console</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-center gap-2"
              onClick={() => onNavigate('/auth/login')}
            >
              <ArrowLeft size={16} />
              <span>Sign In / Auth</span>
            </Button>
          </div>
        </Card>

        {/* Quick Links */}
        <div className="pt-2 text-xs text-muted space-x-4">
          <button
            onClick={() => onNavigate('about')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            About Us
          </button>
          <span>&bull;</span>
          <button
            onClick={() => onNavigate('careers')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            Careers
          </button>
          <span>&bull;</span>
          <button
            onClick={() => onNavigate('blog')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            News &amp; Insights
          </button>
          <span>&bull;</span>
          <button
            onClick={() => onNavigate('contact')}
            className="hover:text-brand hover:underline cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </motion.div>
    </div>
  );
};
```

### 3.4 Public Pages Export Index (`src/pages/public/index.ts`)
Update `update/src/pages/public/index.ts` to export `NotFoundPage`:
```ts
export * from './LandingPage';
export * from './AboutUsPage';
export * from './ProductDetailPage';
export * from './BlogPage';
export * from './CareersPage';
export * from './GalleryPage';
export * from './NotFoundPage';
```

---

## 4. CmsPortal & Modal Clean Architecture Refactor

### 4.1 CmsPortal Relocation
Currently, `CmsPortal.tsx` resides at `update/src/components/CmsPortal.tsx` and is imported directly in `App.tsx`:
```tsx
import { CmsPortal } from './components/CmsPortal';
```
This violates the core constraint that `src/components/` must contain only `ui/`, `layout/`, and `features/`, and that all page-level views belong in `src/pages/`.

**Refactoring Steps**:
1. Move `update/src/components/CmsPortal.tsx` to `update/src/pages/admin/CmsPortalPage.tsx`.
2. Update imports inside `CmsPortalPage.tsx` for data paths if needed (`../data/*` -> `../../data/*`).
3. Export `CmsPortalPage` from `update/src/pages/admin/index.ts`:
   ```ts
   export * from './AdminDashboardPage';
   export * from './EmployeeDirectoryPage';
   export * from './LeaveApprovalPage';
   export * from './ExpenseApprovalPage';
   export * from './AppraisalCalibrationPage';
   export * from './AuditLogsPage';
   export * from './CmsPortalPage';
   ```
4. Assign route `'/admin/cms'` as its canonical route, with backward-compatible aliases `'cms'` and `'/cms'`.
5. In `App.tsx`, import `CmsPortalPage` from `./pages/admin`.

### 4.2 ApplyModal Relocation
Currently, `ApplyModal.tsx` resides at `update/src/components/ApplyModal.tsx` and is imported directly in `App.tsx`:
```tsx
import { ApplyModal } from './components/ApplyModal';
```

**Refactoring Steps**:
1. Move `update/src/components/ApplyModal.tsx` to `update/src/components/features/ApplyModal.tsx`.
2. Export `ApplyModal` from `update/src/components/features/index.ts`:
   ```ts
   export * from './Calculator';
   export * from './FAQ';
   export * from './MoveMoney';
   export * from './Testimonials';
   export * from './ApplyModal';
   ```
3. In `App.tsx`, import `ApplyModal` from `./components/features`.

With these two relocations, zero loose components are imported from `src/components/` root.

---

## 5. Production-Ready Specification for `src/App.tsx`

Below is the complete, recommended implementation of `update/src/App.tsx`. It provides:
- Fully normalized `AppRoute` union type.
- Robust URL hash parser and dispatcher with 404 detection.
- Canonical preservation of `#/auth/login` and `#/auth/register`.
- Backward-compatible legacy alias support (`login`, `register`, `portal`, `admin`, `cms`, `calculator`, `contact`, etc.).
- Clean layout boundary separation (`isPublicShell`, `isPortalView`, `isAdminView`, `isAuthView`).
- Contextual motion transitions via Framer Motion.

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar, Footer } from './components/layout';
import { ApplyModal } from './components/features';
import { useIOReveal } from './hooks/useIOReveal';

// Public Pages
import {
  LandingPage,
  AboutUsPage,
  ProductDetailPage,
  BlogPage,
  CareersPage,
  GalleryPage,
  NotFoundPage,
} from './pages/public';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/auth';

// Portal Pages (Staff Self-Service)
import {
  StaffDashboardPage,
  StaffLeavePage,
  StaffExpensesPage,
  StaffAppraisalsPage,
  StaffProfilePage,
} from './pages/portal';

// Admin Pages (HRMS & Governance)
import {
  AdminDashboardPage,
  EmployeeDirectoryPage,
  LeaveApprovalPage,
  ExpenseApprovalPage,
  AppraisalCalibrationPage,
  AuditLogsPage,
  CmsPortalPage,
} from './pages/admin';

export type AppRoute =
  // Public
  | 'home'
  | '/about'
  | '/blog'
  | '/careers'
  | '/gallery'
  | '/product-detail'
  | '/404'
  // Auth
  | '/auth/login'
  | '/auth/register'
  // Portal
  | '/portal/dashboard'
  | '/portal/leave'
  | '/portal/expenses'
  | '/portal/appraisals'
  | '/portal/profile'
  // Admin
  | '/admin/dashboard'
  | '/admin/employees'
  | '/admin/leave-approvals'
  | '/admin/expense-approvals'
  | '/admin/appraisals'
  | '/admin/audit-logs'
  | '/admin/cms';

interface ParsedRouteResult {
  route: AppRoute;
  productId?: string;
  attemptedPath?: string;
  scrollTarget?: string;
}

/**
 * Normalizes raw hash strings or route paths into canonical AppRoute values.
 */
function parseRawRoute(raw: string): ParsedRouteResult {
  // Strip leading '#', trim whitespace, remove trailing slashes (except root)
  let clean = raw.trim().replace(/^#\/?/, '').replace(/\/+$/, '');

  if (!clean || clean === 'home') {
    return { route: 'home' };
  }

  // Ensure single leading slash for path matching
  const path = clean.startsWith('/') ? clean : `/${clean}`;

  // 1. Auth routes (preserve /auth/* canonical namespace)
  if (path === '/auth/login' || path === '/login') {
    return { route: '/auth/login' };
  }
  if (path === '/auth/register' || path === '/register') {
    return { route: '/auth/register' };
  }

  // 2. Staff Portal routes
  if (path === '/portal' || path === '/portal/dashboard') {
    return { route: '/portal/dashboard' };
  }
  if (path === '/portal/leave') {
    return { route: '/portal/leave' };
  }
  if (path === '/portal/expenses') {
    return { route: '/portal/expenses' };
  }
  if (path === '/portal/appraisals') {
    return { route: '/portal/appraisals' };
  }
  if (path === '/portal/profile') {
    return { route: '/portal/profile' };
  }

  // 3. Admin routes
  if (path === '/admin' || path === '/admin/dashboard') {
    return { route: '/admin/dashboard' };
  }
  if (path === '/admin/employees') {
    return { route: '/admin/employees' };
  }
  if (path === '/admin/leave-approvals') {
    return { route: '/admin/leave-approvals' };
  }
  if (path === '/admin/expense-approvals') {
    return { route: '/admin/expense-approvals' };
  }
  if (path === '/admin/appraisals') {
    return { route: '/admin/appraisals' };
  }
  if (path === '/admin/audit-logs') {
    return { route: '/admin/audit-logs' };
  }
  if (path === '/admin/cms' || path === '/cms') {
    return { route: '/admin/cms' };
  }

  // 4. Public Pages
  if (path === '/about') {
    return { route: '/about' };
  }
  if (path === '/blog') {
    return { route: '/blog' };
  }
  if (path === '/careers') {
    return { route: '/careers' };
  }
  if (path === '/gallery') {
    return { route: '/gallery' };
  }

  // 5. Product Detail route with ID
  if (path.startsWith('/product-detail')) {
    const parts = path.split('/');
    const prodId = parts[2] || 'suremoney-loan';
    return { route: '/product-detail', productId: prodId };
  }

  // 6. Public section anchors on /about or /home
  if (path === '/leadership' || path === '/partners' || path === '/about-products') {
    return { route: '/about', scrollTarget: path.replace('/', '') };
  }
  if (path === '/calculator' || path === '/contact') {
    return { route: 'home', scrollTarget: path.replace('/', '') };
  }

  // 7. Unmatched -> 404
  return { route: '/404', attemptedPath: raw };
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');
  const [selectedProductId, setSelectedProductId] = useState<string>('suremoney-loan');
  const [currentUserRole, setCurrentUserRole] = useState<'Employee' | 'Manager' | 'Admin'>('Employee');
  const [attemptedPath, setAttemptedPath] = useState<string>('');

  // Fast-track apply modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultProduct, setModalDefaultProduct] = useState<string | undefined>(undefined);
  const [modalDefaultAmount, setModalDefaultAmount] = useState<number | undefined>(undefined);
  const [modalDefaultTenure, setModalDefaultTenure] = useState<number | undefined>(undefined);

  // Trigger intersection observer reveal animation on viewport entry
  useIOReveal('.io-reveal');

  // Synchronize state from window.location.hash
  const handleUrlChange = useCallback(() => {
    const rawHash = window.location.hash;
    const { route, productId, attemptedPath: badPath, scrollTarget } = parseRawRoute(rawHash);

    setCurrentRoute(route);
    if (productId) setSelectedProductId(productId);
    if (badPath) setAttemptedPath(badPath);

    if (scrollTarget) {
      setTimeout(() => {
        const el = document.getElementById(scrollTarget);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, []);

  useEffect(() => {
    handleUrlChange();
    window.addEventListener('hashchange', handleUrlChange);
    return () => window.removeEventListener('hashchange', handleUrlChange);
  }, [handleUrlChange]);

  const handleOpenApply = (productName?: string, amount?: number, tenure?: number) => {
    setModalDefaultProduct(productName);
    setModalDefaultAmount(amount);
    setModalDefaultTenure(tenure);
    setModalOpen(true);
  };

  const handleNavigate = (routeInput: string, productId?: string) => {
    const { route, productId: parsedProdId, attemptedPath: badPath, scrollTarget } = parseRawRoute(routeInput);

    if (route === '/product-detail') {
      const activeProd = productId || parsedProdId || selectedProductId || 'suremoney-loan';
      setSelectedProductId(activeProd);
      setCurrentRoute('/product-detail');
      window.location.hash = `/product-detail/${activeProd}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (route === 'home') {
      setCurrentRoute('home');
      window.location.hash = '';
      if (scrollTarget) {
        setTimeout(() => {
          const el = document.getElementById(scrollTarget);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (route === '/about' && scrollTarget) {
      setCurrentRoute('/about');
      window.location.hash = '/about';
      setTimeout(() => {
        const el = document.getElementById(scrollTarget);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return;
    }

    if (route === '/404') {
      setAttemptedPath(routeInput || badPath || '');
      setCurrentRoute('/404');
      window.location.hash = `/404`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Standard Canonical Navigation
    setCurrentRoute(route);
    window.location.hash = route;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isPortalView = currentRoute.startsWith('/portal/');
  const isAdminView = currentRoute.startsWith('/admin/');
  const isAuthView = currentRoute.startsWith('/auth/');
  const isPublicShell = !isPortalView && !isAdminView && !isAuthView;

  return (
    <div className="nx-app min-h-screen bg-canvas text-ink selection:bg-action selection:text-white font-body transition-colors duration-300">
      {/* 1. Global Navbar for public shell */}
      {isPublicShell && (
        <Navbar
          onOpenApply={handleOpenApply}
          onNavigate={handleNavigate}
          currentView={currentRoute}
        />
      )}

      {/* Main Routed Content with Contextual Motion Transitions */}
      <main id="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentRoute}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* PUBLIC PAGES */}
            {currentRoute === 'home' && (
              <LandingPage
                onOpenApply={handleOpenApply}
                onNavigate={handleNavigate}
                onScrollToCalculator={() => handleNavigate('calculator')}
              />
            )}

            {currentRoute === '/about' && (
              <AboutUsPage onOpenApply={handleOpenApply} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/product-detail' && (
              <ProductDetailPage
                productId={selectedProductId}
                onOpenApply={handleOpenApply}
                onNavigate={handleNavigate}
              />
            )}

            {currentRoute === '/blog' && (
              <BlogPage onNavigate={handleNavigate} onOpenApply={handleOpenApply} />
            )}

            {currentRoute === '/careers' && (
              <CareersPage onNavigate={handleNavigate} onOpenApply={handleOpenApply} />
            )}

            {currentRoute === '/gallery' && (
              <GalleryPage onNavigate={handleNavigate} onOpenApply={handleOpenApply} />
            )}

            {/* 404 NOT FOUND PAGE */}
            {currentRoute === '/404' && (
              <NotFoundPage
                attemptedPath={attemptedPath}
                onNavigate={handleNavigate}
              />
            )}

            {/* AUTH PAGES */}
            {currentRoute === '/auth/login' && (
              <LoginPage
                onNavigate={handleNavigate}
                onLoginSuccess={(role) => setCurrentUserRole(role as 'Employee' | 'Manager' | 'Admin')}
              />
            )}

            {currentRoute === '/auth/register' && (
              <RegisterPage onNavigate={handleNavigate} />
            )}

            {/* PORTAL PAGES (Staff Self-Service) */}
            {currentRoute === '/portal/dashboard' && (
              <StaffDashboardPage
                currentPath={currentRoute}
                onNavigate={handleNavigate}
                userRole={currentUserRole}
              />
            )}

            {currentRoute === '/portal/leave' && (
              <StaffLeavePage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/portal/expenses' && (
              <StaffExpensesPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/portal/appraisals' && (
              <StaffAppraisalsPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/portal/profile' && (
              <StaffProfilePage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {/* ADMIN PAGES (HRMS & Governance) */}
            {currentRoute === '/admin/dashboard' && (
              <AdminDashboardPage
                currentPath={currentRoute}
                onNavigate={handleNavigate}
                userRole="HR & System Admin"
                userName="Henrietta Okolo"
              />
            )}

            {currentRoute === '/admin/employees' && (
              <EmployeeDirectoryPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/leave-approvals' && (
              <LeaveApprovalPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/expense-approvals' && (
              <ExpenseApprovalPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/appraisals' && (
              <AppraisalCalibrationPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {currentRoute === '/admin/audit-logs' && (
              <AuditLogsPage currentPath={currentRoute} onNavigate={handleNavigate} />
            )}

            {/* CMS PORTAL (Refactored to src/pages/admin/) */}
            {currentRoute === '/admin/cms' && (
              <CmsPortalPage onNavigate={handleNavigate} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Footer on public shell */}
      {isPublicShell && (
        <Footer onOpenApply={handleOpenApply} onNavigate={handleNavigate} />
      )}

      {/* Global Fast-Track Loan Application Modal (Refactored to src/components/features/) */}
      <ApplyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultProduct={modalDefaultProduct}
        defaultAmount={modalDefaultAmount}
        defaultTenure={modalDefaultTenure}
      />
    </div>
  );
}
```

---

## 6. Verification & Test Plan

To independently verify the implementation, the following automated and manual tests should be executed by the implementing worker and reviewer:

### 6.1 Build Verification
Execute the production build command in `update/`:
```bash
npm run build
```
**Acceptance Criteria**:
- Exit code 0.
- TypeScript compiler (`tsc -b`) reports zero diagnostic errors.
- Bundle emitted cleanly to `dist/`.

### 6.2 Route Deep Linking Verification
Verify that loading each URL hash in a browser or test runner renders the expected component without blank screens:
1. `#/auth/login` -> Renders `LoginPage` with no global navbar/footer.
2. `#/auth/register` -> Renders `RegisterPage` with onboarding form.
3. `#/portal/dashboard` -> Renders `StaffDashboardPage` inside `PortalLayout`.
4. `#/admin/dashboard` -> Renders `AdminDashboardPage` inside `AdminLayout`.
5. `#/admin/cms` -> Renders `CmsPortalPage` with article & media management.
6. `#/about` -> Renders `AboutUsPage` with global navbar/footer.
7. `#/product-detail/nexus-credit` -> Renders `ProductDetailPage` with `nexus-credit` active.

### 6.3 404 Route Fallback Verification
1. Navigate to `#/portal/nonexistent-route`:
   - Must render `NotFoundPage`.
   - Must NOT render a blank screen.
   - Diagnostic text must display `#/portal/nonexistent-route`.
   - Clicking "Return to Home" must navigate to `#/` and render `LandingPage`.
2. Navigate to `#/random-garbage-string`:
   - Must render `NotFoundPage`.
   - Must NOT crash or render a blank screen.

### 6.4 Auth Navigation Preservation Verification
1. In `Navbar`: Click "Portals" -> "Sign In".
   - Browser URL hash must change to `#/auth/login` (NOT `#login`).
2. In `LoginPage`: Click "Register for Onboarding".
   - Browser URL hash must change to `#/auth/register` (NOT `#register`).
3. In `RegisterPage`: Click "Back to Sign In".
   - Browser URL hash must return to `#/auth/login`.

---

## 7. Migration Checklist for Worker Agent

- [ ] Create `src/pages/public/NotFoundPage.tsx` with Phosphor icons, Bricolage Grotesque display typography, and recovery buttons.
- [ ] Export `NotFoundPage` from `src/pages/public/index.ts`.
- [ ] Move `src/components/CmsPortal.tsx` to `src/pages/admin/CmsPortalPage.tsx` and export from `src/pages/admin/index.ts`.
- [ ] Move `src/components/ApplyModal.tsx` to `src/components/features/ApplyModal.tsx` and export from `src/components/features/index.ts`.
- [ ] Replace `src/App.tsx` with the normalized dispatcher implementation specified in Section 5.
- [ ] Ensure all 23 loose files in `src/components/` root are relocated according to reviewer_m1_1 findings.
- [ ] Run `npm run build` to confirm exit code 0.
