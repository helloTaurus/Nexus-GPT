# Architecture Migration Plan: Strict Page Separation & Components Cleanup

**Author**: `explorer_m1_r2_1` (Codebase Architecture & Migration Explorer)  
**Target Codebase**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src`  
**Date**: 2026-11-10T00:36:00Z  
**Target Milestone**: Milestone 1 Remediation (Resolving Gate 1 REQUEST_CHANGES)  

---

## 1. Executive Summary & Root Cause Analysis

In Gate 1, `reviewer_m1_1` issued **REQUEST_CHANGES** with a critical finding tagged as **INTEGRITY VIOLATION**:
1. **Loose Monolithic Files in Components**: 23 monolithic page and component files remained directly in `update/src/components/`.
2. **Facade Re-exports in Public Pages**: The files in `update/src/pages/public/` (`AboutUsPage.tsx`, `BlogPage.tsx`, `CareersPage.tsx`, `GalleryPage.tsx`, `ProductDetailPage.tsx`) were 11-line proxy re-exports delegating back to `../../components/*`.
3. **Facade Re-exports in Features**: `update/src/components/features/` contained 4 facade files (`Calculator.tsx`, `FAQ.tsx`, `MoveMoney.tsx`, `Testimonials.tsx`) re-exporting from parent files.
4. **Stale Duplicates**: Obsolete root duplicates of `Navbar.tsx` and `Footer.tsx` remained at `update/src/components/`.
5. **Route Normalization & Fallback**: Routing in `App.tsx` downgraded `/auth/*` paths to `#login`/`#register` and lacked a 404 / NotFound boundary.

### Target Architectural State
Per `PROJECT.md` (lines 6, 88–125) and Requirement R2:
- `update/src/components/` must contain **STRICTLY THREE SUBDIRECTORIES**:
  - `ui/` — Atomic primitives (`Button`, `Card`, `Badge`, `Modal`, `Drawer`, `Skeleton`, `Input`, `Tabs`)
  - `layout/` — Shell containers (`Navbar`, `Sidebar`, `Footer`, `PortalLayout`, `AdminLayout`)
  - `features/` — Domain widgets, sections, and feature modals
  - **Zero loose files** in `update/src/components/` root.
- `update/src/pages/` must contain the **FULL, GENUINE IMPLEMENTATIONS** with no facade delegates:
  - `public/` — `LandingPage`, `AboutUsPage`, `ProductDetailPage`, `BlogPage`, `CareersPage`, `GalleryPage`, `NotFoundPage`
  - `auth/` — `LoginPage`, `RegisterPage`
  - `portal/` — `StaffDashboardPage`, `StaffLeavePage`, `StaffExpensesPage`, `StaffAppraisalsPage`, `StaffProfilePage`
  - `admin/` — `AdminDashboardPage`, `EmployeeDirectoryPage`, `LeaveApprovalPage`, `ExpenseApprovalPage`, `AppraisalCalibrationPage`, `AuditLogsPage`, `CmsPortalPage`

---

## 2. Complete Inventory & Source-to-Destination Mapping

The table below maps all 23 loose files currently at `update/src/components/` to their exact destination and required action.

| # | Current Source File | File Type & Lines | Target Destination | Required Action |
|---|---------------------|-------------------|--------------------|-----------------|
| 1 | `components/AboutUsPage.tsx` | Page (497 lines, 26KB) | `pages/public/AboutUsPage.tsx` | Replace 12-line facade with full implementation; update section imports to `../../components/features/*` |
| 2 | `components/BlogPage.tsx` | Page (528 lines, 25KB) | `pages/public/BlogPage.tsx` | Replace 12-line facade with full implementation; update data import to `../../data/blogData` |
| 3 | `components/CareersPage.tsx` | Page (377 lines, 17KB) | `pages/public/CareersPage.tsx` | Replace 12-line facade with full implementation; update data import to `../../data/careersData` and modal import to `../../components/features/JobApplyModal` |
| 4 | `components/GalleryPage.tsx` | Page (290 lines, 15KB) | `pages/public/GalleryPage.tsx` | Replace 12-line facade with full implementation; update data import to `../../data/galleryData` |
| 5 | `components/ProductDetailPage.tsx` | Page (402 lines, 19KB) | `pages/public/ProductDetailPage.tsx` | Replace 13-line facade with full implementation; update data import to `../../data/content` |
| 6 | `components/CmsPortal.tsx` | Admin Page (1181 lines, 55KB) | `pages/admin/CmsPortalPage.tsx` | Relocate to admin pages; update data imports to `../../data/*`; export `CmsPortalPage` and alias `CmsPortal` |
| 7 | `components/Navbar.tsx` | Obsolete duplicate (219 lines, 7KB) | *None* | **DELETE**. Superseded by `src/components/layout/Navbar.tsx` (355 lines) |
| 8 | `components/Footer.tsx` | Obsolete duplicate (346 lines, 13KB) | *None* | **DELETE**. Superseded by `src/components/layout/Footer.tsx` (346 lines) |
| 9 | `components/Hero.tsx` | Feature Section (246 lines, 8KB) | `components/features/Hero.tsx` | Move to `features/`; no import path updates needed |
| 10 | `components/ProductBento.tsx` | Feature Section (186 lines, 8KB) | `components/features/ProductBento.tsx` | Move to `features/`; update import `../data/content` -> `../../data/content` |
| 11 | `components/TrustMarquee.tsx` | Feature Section (101 lines, 2KB) | `components/features/TrustMarquee.tsx` | Move to `features/`; no import path updates needed |
| 12 | `components/InteractiveCalculator.tsx` | Feature Section (589 lines, 31KB) | `components/features/InteractiveCalculator.tsx` | Move to `features/`; eliminates proxy `features/Calculator.tsx` |
| 13 | `components/LeadershipSection.tsx` | Feature Section (417 lines, 19KB) | `components/features/LeadershipSection.tsx` | Move to `features/`; update imports `../data/content` -> `../../data/content` and `../types` -> `../../types` |
| 14 | `components/FAQSection.tsx` | Feature Section (70 lines, 2KB) | `components/features/FAQSection.tsx` | Move to `features/`; update import `../data/content` -> `../../data/content`; eliminates proxy `features/FAQ.tsx` |
| 15 | `components/ComparisonSection.tsx` | Feature Section (130 lines, 5KB) | `components/features/ComparisonSection.tsx` | Move to `features/`; no import path updates needed |
| 16 | `components/ContactSection.tsx` | Feature Section (277 lines, 15KB) | `components/features/ContactSection.tsx` | Move to `features/`; no import path updates needed |
| 17 | `components/CardShowcase.tsx` | Feature Section (308 lines, 16KB) | `components/features/CardShowcase.tsx` | Move to `features/`; no import path updates needed |
| 18 | `components/GlobalNetwork.tsx` | Feature Section (133 lines, 5KB) | `components/features/GlobalNetwork.tsx` | Move to `features/`; update import `../assets/images/...` -> `../../assets/images/...` |
| 19 | `components/TestimonialsSection.tsx` | Feature Section (84 lines, 3KB) | `components/features/TestimonialsSection.tsx` | Move to `features/`; update import `../data/content` -> `../../data/content` |
| 20 | `components/TuyoShowcaseSections.tsx` | Feature Sections (871 lines, 42KB) | `components/features/TuyoShowcaseSections.tsx` | Move to `features/`; eliminates proxy `features/MoveMoney.tsx` and `features/Testimonials.tsx` |
| 21 | `components/ApplyModal.tsx` | Feature Modal (411 lines, 18KB) | `components/features/ApplyModal.tsx` | Move to `features/`; update imports `../data/content` -> `../../data/content` and `../hooks/useDialogFocus` -> `../../hooks/useDialogFocus` |
| 22 | `components/JobApplyModal.tsx` | Feature Modal (200 lines, 8KB) | `components/features/JobApplyModal.tsx` | Move to `features/`; update imports `../data/careersData` -> `../../data/careersData` and `../hooks/useDialogFocus` -> `../../hooks/useDialogFocus` |
| 23 | `components/BlogCmsModal.tsx` | Feature Modal (394 lines, 16KB) | `components/features/BlogCmsModal.tsx` | Move to `features/`; update import `../data/blogData` -> `../../data/blogData` |

---

## 3. Public Pages Migration Details

### 3.1 `update/src/pages/public/AboutUsPage.tsx`
- **Current state**: 12-line facade wrapper delegating to `../../components/AboutUsPage`.
- **Target state**: Full 497-line implementation moved here.
- **Import modifications required in new file**:
  ```tsx
  // BEFORE (in components/AboutUsPage.tsx):
  import { LeadershipSection } from './LeadershipSection';
  import { ProductBento } from './ProductBento';
  import { TrustMarquee } from './TrustMarquee';

  // AFTER (in pages/public/AboutUsPage.tsx):
  import { LeadershipSection } from '../../components/features/LeadershipSection';
  import { ProductBento } from '../../components/features/ProductBento';
  import { TrustMarquee } from '../../components/features/TrustMarquee';
  ```
- **Export interface**:
  ```tsx
  export interface AboutUsPageProps {
    onOpenApply: (productName?: string) => void;
    onNavigate: (view: string, productId?: string) => void;
  }
  export const AboutUsPage: React.FC<AboutUsPageProps> = ({ onOpenApply, onNavigate }) => { ... };
  ```

### 3.2 `update/src/pages/public/BlogPage.tsx`
- **Current state**: 12-line facade wrapper delegating to `../../components/BlogPage`.
- **Target state**: Full 528-line implementation moved here.
- **Import modifications required in new file**:
  ```tsx
  // BEFORE:
  import { BlogPost, INITIAL_BLOG_POSTS } from '../data/blogData';

  // AFTER:
  import { BlogPost, INITIAL_BLOG_POSTS } from '../../data/blogData';
  ```
- **Export interface**:
  ```tsx
  export interface BlogPageProps {
    onNavigate: (view: string, productId?: string) => void;
    onOpenApply: (productName?: string) => void;
  }
  export const BlogPage: React.FC<BlogPageProps> = ({ onNavigate, onOpenApply }) => { ... };
  ```

### 3.3 `update/src/pages/public/CareersPage.tsx`
- **Current state**: 12-line facade wrapper delegating to `../../components/CareersPage`.
- **Target state**: Full 377-line implementation moved here.
- **Import modifications required in new file**:
  ```tsx
  // BEFORE:
  import { JobOpening, JOB_OPENINGS } from '../data/careersData';
  import { JobApplyModal } from './JobApplyModal';

  // AFTER:
  import { JobOpening, JOB_OPENINGS } from '../../data/careersData';
  import { JobApplyModal } from '../../components/features/JobApplyModal';
  ```
- **Export interface**:
  ```tsx
  export interface CareersPageProps {
    onNavigate: (view: string, productId?: string) => void;
    onOpenApply: (productName?: string) => void;
  }
  export const CareersPage: React.FC<CareersPageProps> = ({ onNavigate, onOpenApply }) => { ... };
  ```

### 3.4 `update/src/pages/public/GalleryPage.tsx`
- **Current state**: 12-line facade wrapper delegating to `../../components/GalleryPage`.
- **Target state**: Full 290-line implementation moved here.
- **Import modifications required in new file**:
  ```tsx
  // BEFORE:
  import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../data/galleryData';

  // AFTER:
  import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../../data/galleryData';
  ```
- **Export interface**:
  ```tsx
  export interface GalleryPageProps {
    onNavigate: (view: string, productId?: string) => void;
    onOpenApply: (productName?: string) => void;
  }
  export const GalleryPage: React.FC<GalleryPageProps> = ({ onNavigate, onOpenApply }) => { ... };
  ```

### 3.5 `update/src/pages/public/ProductDetailPage.tsx`
- **Current state**: 13-line facade wrapper delegating to `../../components/ProductDetailPage`.
- **Target state**: Full 402-line implementation moved here.
- **Import modifications required in new file**:
  ```tsx
  // BEFORE:
  import { NEXUS_PRODUCTS } from '../data/content';

  // AFTER:
  import { NEXUS_PRODUCTS } from '../../data/content';
  ```
- **Export interface**:
  ```tsx
  export interface ProductDetailPageProps {
    productId: string;
    onOpenApply: (productName: string, amount?: number, tenure?: number) => void;
    onNavigate: (view: string, productId?: string) => void;
  }
  export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ productId, onOpenApply, onNavigate }) => { ... };
  ```

### 3.6 New Fallback Page: `update/src/pages/public/NotFoundPage.tsx`
To resolve Finding 4, create `NotFoundPage.tsx`:
```tsx
import React from 'react';
import { WarningCircle, House, ArrowLeft } from '@phosphor-icons/react';

export interface NotFoundPageProps {
  onNavigate: (view: string) => void;
  attemptedRoute?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate, attemptedRoute }) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-24 bg-canvas text-ink">
      <div className="w-16 h-16 rounded-2xl bg-danger-soft border border-danger/25 text-danger flex items-center justify-center mb-6">
        <WarningCircle size={36} weight="duotone" />
      </div>
      <span className="text-xs font-mono uppercase tracking-widest text-brand mb-2 font-semibold">
        Error 404
      </span>
      <h1 className="text-3xl sm:text-4xl font-display font-semibold mb-3">
        Page Not Found
      </h1>
      <p className="text-muted text-sm max-w-md mb-8">
        The route <code className="text-ink font-mono text-xs bg-subtle px-2 py-0.5 rounded border border-rule">{attemptedRoute || window.location.hash || 'unknown'}</code> does not exist or has been relocated.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[7px] border border-rule text-xs font-semibold text-ink hover:bg-subtle transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Go Back
        </button>
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[7px] bg-action text-on-action text-xs font-semibold hover:bg-action-hover transition-colors shadow-sm cursor-pointer"
        >
          <House size={14} /> Return to Homepage
        </button>
      </div>
    </div>
  );
};
```
And re-export from `update/src/pages/public/index.ts`.

---

## 4. Admin CMS Page Migration Details

### `update/src/pages/admin/CmsPortalPage.tsx`
- **Source**: `update/src/components/CmsPortal.tsx` (1181 lines, 55KB).
- **Target**: `update/src/pages/admin/CmsPortalPage.tsx`.
- **Import modifications required in new file**:
  ```tsx
  // BEFORE:
  import { BlogPost, INITIAL_BLOG_POSTS } from '../data/blogData';
  import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../data/galleryData';
  import { JobOpening, JOB_OPENINGS } from '../data/careersData';

  // AFTER:
  import { BlogPost, INITIAL_BLOG_POSTS } from '../../data/blogData';
  import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../../data/galleryData';
  import { JobOpening, JOB_OPENINGS } from '../../data/careersData';
  ```
- **Export interface**:
  ```tsx
  export interface CmsPortalPageProps {
    onNavigate: (view: string, productId?: string) => void;
  }
  export const CmsPortalPage: React.FC<CmsPortalPageProps> = ({ onNavigate }) => { ... };
  export { CmsPortalPage as CmsPortal };
  ```
- **Update `update/src/pages/admin/index.ts`**:
  ```ts
  export * from './AdminDashboardPage';
  export * from './EmployeeDirectoryPage';
  export * from './LeaveApprovalPage';
  export * from './ExpenseApprovalPage';
  export * from './AppraisalCalibrationPage';
  export * from './AuditLogsPage';
  export * from './CmsPortalPage';
  ```

---

## 5. Domain Features & Modals Relocation (`update/src/components/features/`)

All 15 feature files relocate directly into `update/src/components/features/`.

### 5.1 Import Adjustments for Relocated Feature Files
Every file moved into `features/` is one directory deeper (`src/components/` -> `src/components/features/`). Therefore, all `../` relative imports must become `../../`:

1. `update/src/components/features/ApplyModal.tsx`:
   - `import { NEXUS_PRODUCTS } from '../data/content';` -> `../../data/content`
   - `import { useDialogFocus } from '../hooks/useDialogFocus';` -> `../../hooks/useDialogFocus`
2. `update/src/components/features/JobApplyModal.tsx`:
   - `import { JobOpening } from '../data/careersData';` -> `../../data/careersData`
   - `import { useDialogFocus } from '../hooks/useDialogFocus';` -> `../../hooks/useDialogFocus`
3. `update/src/components/features/BlogCmsModal.tsx`:
   - `import { BlogPost } from '../data/blogData';` -> `../../data/blogData`
4. `update/src/components/features/ProductBento.tsx`:
   - `import { NEXUS_PRODUCTS } from '../data/content';` -> `../../data/content`
5. `update/src/components/features/LeadershipSection.tsx`:
   - `import { LEADERSHIP_TEAM } from '../data/content';` -> `../../data/content`
   - `import { LeadershipMember } from '../types';` -> `../../types`
6. `update/src/components/features/FAQSection.tsx`:
   - `import { FAQS } from '../data/content';` -> `../../data/content`
7. `update/src/components/features/TestimonialsSection.tsx`:
   - `import { TESTIMONIALS } from '../data/content';` -> `../../data/content`
8. `update/src/components/features/GlobalNetwork.tsx`:
   - `import globeImg from '../assets/images/...';` -> `../../assets/images/...`
9. `Hero.tsx`, `InteractiveCalculator.tsx`, `ComparisonSection.tsx`, `ContactSection.tsx`, `CardShowcase.tsx`, `TrustMarquee.tsx`, `TuyoShowcaseSections.tsx`:
   - No relative internal path imports; move directly.

### 5.2 Cleanup of Proxy Facades in `update/src/components/features/`
Delete or supersede the 4 facade wrappers:
- `Calculator.tsx` (facade) -> Delete. Consumers use `InteractiveCalculator.tsx`.
- `FAQ.tsx` (facade) -> Delete. Consumers use `FAQSection.tsx`.
- `MoveMoney.tsx` (facade) -> Delete. Consumers use `MoveMoneySection` from `TuyoShowcaseSections.tsx`.
- `Testimonials.tsx` (facade) -> Delete. Consumers use `TestimonialsSliderSection` / `LiveTickingYieldSection` from `TuyoShowcaseSections.tsx`.

*(Note: If maintaining backward-compatible aliases is desired during transition, they can simply re-export from sibling files `./InteractiveCalculator`, `./FAQSection`, `./TuyoShowcaseSections`, rather than `../`)*.

### 5.3 Consolidated `update/src/components/features/index.ts`
```ts
export * from './Hero';
export * from './ProductBento';
export * from './TrustMarquee';
export * from './TuyoShowcaseSections';
export * from './InteractiveCalculator';
export * from './LeadershipSection';
export * from './FAQSection';
export * from './ComparisonSection';
export * from './ContactSection';
export * from './CardShowcase';
export * from './GlobalNetwork';
export * from './TestimonialsSection';
export * from './ApplyModal';
export * from './JobApplyModal';
export * from './BlogCmsModal';
```

---

## 6. Exact List of Files to Delete from `update/src/components/` Root

The following **23 files** MUST be removed from `update/src/components/` root:

```powershell
# Complete removal list (all 23 loose files):
update/src/components/AboutUsPage.tsx
update/src/components/ApplyModal.tsx
update/src/components/BlogCmsModal.tsx
update/src/components/BlogPage.tsx
update/src/components/CardShowcase.tsx
update/src/components/CareersPage.tsx
update/src/components/CmsPortal.tsx
update/src/components/ComparisonSection.tsx
update/src/components/ContactSection.tsx
update/src/components/FAQSection.tsx
update/src/components/Footer.tsx
update/src/components/GalleryPage.tsx
update/src/components/GlobalNetwork.tsx
update/src/components/Hero.tsx
update/src/components/InteractiveCalculator.tsx
update/src/components/JobApplyModal.tsx
update/src/components/LeadershipSection.tsx
update/src/components/Navbar.tsx
update/src/components/ProductBento.tsx
update/src/components/ProductDetailPage.tsx
update/src/components/TestimonialsSection.tsx
update/src/components/TrustMarquee.tsx
update/src/components/TuyoShowcaseSections.tsx
```

### Post-Removal Verification Criterion:
Running:
```powershell
Get-ChildItem "update/src/components" -File
```
Must return **0 files** (empty).  
Running:
```powershell
Get-ChildItem "update/src/components" -Directory
```
Must return **strictly 3 directories**:
- `features`
- `layout`
- `ui`

---

## 7. Consumers & Call Site Updates

### 7.1 `update/src/pages/public/LandingPage.tsx`
Update imports to reference `../../components/features/*`:

```tsx
import React from 'react';
import { Hero } from '../../components/features/Hero';
import { ProductBento } from '../../components/features/ProductBento';
import { TrustMarquee } from '../../components/features/TrustMarquee';
import {
  MoveMoneySection,
  TestimonialsSliderSection,
  LiveTickingYieldSection,
} from '../../components/features/TuyoShowcaseSections';
import { InteractiveCalculator } from '../../components/features/InteractiveCalculator';
import { LeadershipSection } from '../../components/features/LeadershipSection';
import { FAQSection } from '../../components/features/FAQSection';
import { ContactSection } from '../../components/features/ContactSection';

export interface LandingPageProps {
  onOpenApply: (productName?: string, amount?: number, tenure?: number) => void;
  onNavigate: (view: string, productId?: string) => void;
  onScrollToCalculator: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenApply,
  onNavigate,
  onScrollToCalculator,
}) => {
  return (
    <>
      <Hero
        onOpenApply={onOpenApply}
        onScrollToCalculator={onScrollToCalculator}
        onNavigateProduct={(prodId) => onNavigate('product-detail', prodId)}
      />
      <ProductBento
        onSelectProduct={(prodId) => onNavigate('product-detail', prodId)}
      />
      <div id="partners">
        <TrustMarquee />
      </div>
      <MoveMoneySection onOpenApply={onOpenApply} />
      <InteractiveCalculator onOpenApply={onOpenApply} />
      <LeadershipSection />
      <FAQSection />
      <TestimonialsSliderSection />
      <LiveTickingYieldSection onOpenApply={onOpenApply} />
      <ContactSection />
    </>
  );
};
```

### 7.2 `update/src/App.tsx`
Address Finding 1, Finding 3, and Finding 4:

1. **Imports**:
   ```tsx
   import { Navbar, Footer } from './components/layout';
   import { ApplyModal } from './components/features/ApplyModal';
   import {
     LandingPage,
     AboutUsPage,
     ProductDetailPage,
     BlogPage,
     CareersPage,
     GalleryPage,
     NotFoundPage,
   } from './pages/public';
   import { LoginPage, RegisterPage } from './pages/auth';
   import {
     StaffDashboardPage,
     StaffLeavePage,
     StaffExpensesPage,
     StaffAppraisalsPage,
     StaffProfilePage,
   } from './pages/portal';
   import {
     AdminDashboardPage,
     EmployeeDirectoryPage,
     LeaveApprovalPage,
     ExpenseApprovalPage,
     AppraisalCalibrationPage,
     AuditLogsPage,
     CmsPortalPage,
   } from './pages/admin';
   ```

2. **Route Type**:
   ```tsx
   export type AppRoute =
     | 'home'
     | 'about'
     | 'blog'
     | 'careers'
     | 'gallery'
     | 'product-detail'
     | '/auth/login'
     | '/auth/register'
     | 'login'
     | 'register'
     | '/portal/dashboard'
     | '/portal/leave'
     | '/portal/expenses'
     | '/portal/appraisals'
     | '/portal/profile'
     | '/admin/dashboard'
     | '/admin/employees'
     | '/admin/leave-approvals'
     | '/admin/expense-approvals'
     | '/admin/appraisals'
     | '/admin/audit-logs'
     | 'cms'
     | '404';
   ```

3. **URL Routing & Auth Path Preservation**:
   In `handleUrlChange`:
   ```tsx
   const handleUrlChange = () => {
     const hash = window.location.hash.replace('#', '');
     if (!hash) {
       setCurrentRoute('home');
       return;
     }

     if (hash.startsWith('/portal/')) {
       setCurrentRoute(hash as AppRoute);
     } else if (hash.startsWith('/admin/')) {
       setCurrentRoute(hash as AppRoute);
     } else if (hash === '/auth/login' || hash === 'login') {
       setCurrentRoute('/auth/login');
     } else if (hash === '/auth/register' || hash === 'register') {
       setCurrentRoute('/auth/register');
     } else if (hash === 'portal') {
       setCurrentRoute('/portal/dashboard');
     } else if (hash === 'admin') {
       setCurrentRoute('/admin/dashboard');
     } else if (hash === 'cms') {
       setCurrentRoute('cms');
     } else if (hash.startsWith('product-detail/')) {
       const prodId = hash.split('/')[1];
       setSelectedProductId(prodId);
       setCurrentRoute('product-detail');
     } else if (['about', 'blog', 'careers', 'gallery', 'home'].includes(hash)) {
       setCurrentRoute(hash as AppRoute);
     } else {
       // Finding 4: Safe 404 fallback
       setCurrentRoute('404');
     }
   };
   ```

   In `handleNavigate`:
   ```tsx
   const handleNavigate = (route: string, productId?: string) => {
     if (route === 'portal' || route === '/portal') {
       route = '/portal/dashboard';
     } else if (route === 'admin' || route === '/admin') {
       route = '/admin/dashboard';
     } else if (route === 'login' || route === '/auth/login') {
       route = '/auth/login';
     } else if (route === 'register' || route === '/auth/register') {
       route = '/auth/register';
     } else if (route === '/' || route === '') {
       route = 'home';
     }

     if (route === 'product-detail') {
       setSelectedProductId(productId || 'suremoney-loan');
       setCurrentRoute('product-detail');
       window.location.hash = `product-detail/${productId || 'suremoney-loan'}`;
       window.scrollTo({ top: 0, behavior: 'smooth' });
       return;
     }

     if (route.startsWith('/portal/') || route.startsWith('/admin/') || route.startsWith('/auth/')) {
       setCurrentRoute(route as AppRoute);
       window.location.hash = route;
       window.scrollTo({ top: 0, behavior: 'smooth' });
       return;
     }

     if (['about', 'blog', 'careers', 'gallery', 'cms'].includes(route)) {
       setCurrentRoute(route as AppRoute);
       window.location.hash = route;
       window.scrollTo({ top: 0, behavior: 'smooth' });
       return;
     }

     // Section anchors on About or Home
     if (route === 'about-products' || route === 'leadership' || route === 'partners') {
       setCurrentRoute('about');
       window.location.hash = 'about';
       setTimeout(() => {
         const el = document.getElementById(route);
         if (el) el.scrollIntoView({ behavior: 'smooth' });
       }, 150);
       return;
     }

     setCurrentRoute('home');
     window.location.hash = '';
     if (route === 'home') {
       window.scrollTo({ top: 0, behavior: 'smooth' });
       return;
     }

     setTimeout(() => {
       const el = document.getElementById(route);
       if (el) el.scrollIntoView({ behavior: 'smooth' });
     }, 150);
   };
   ```

4. **Shell Condition & 404 View**:
   ```tsx
   const isPortalView = currentRoute.startsWith('/portal/');
   const isAdminView = currentRoute.startsWith('/admin/');
   const isAuthView = currentRoute === '/auth/login' || currentRoute === '/auth/register' || currentRoute === 'login' || currentRoute === 'register';
   const isCmsView = currentRoute === 'cms';
   const is404View = currentRoute === '404';
   const isPublicShell = !isPortalView && !isAdminView && !isAuthView && !isCmsView && !is404View;
   ```

   Inside `<main>`:
   ```tsx
   {/* AUTH PAGES */}
   {(currentRoute === '/auth/login' || currentRoute === 'login') && (
     <LoginPage
       onNavigate={handleNavigate}
       onLoginSuccess={(role) => setCurrentUserRole(role as 'Employee' | 'Manager' | 'Admin')}
     />
   )}

   {(currentRoute === '/auth/register' || currentRoute === 'register') && (
     <RegisterPage onNavigate={handleNavigate} />
   )}

   {/* CMS PORTAL (Admin Page) */}
   {currentRoute === 'cms' && <CmsPortalPage onNavigate={handleNavigate} />}

   {/* 404 FALLBACK */}
   {currentRoute === '404' && (
     <NotFoundPage onNavigate={handleNavigate} />
   )}
   ```

---

## 8. Step-by-Step Implementation Execution Order

To minimize disruption and ensure a smooth migration, the worker agent should execute the changes in this precise order:

### Phase 1: Relocate Feature Components & Modals
1. Create directory `update/src/components/features` (already exists).
2. Copy / write 15 feature files into `update/src/components/features/`:
   `ApplyModal.tsx`, `BlogCmsModal.tsx`, `JobApplyModal.tsx`, `CardShowcase.tsx`, `ComparisonSection.tsx`, `ContactSection.tsx`, `FAQSection.tsx`, `GlobalNetwork.tsx`, `Hero.tsx`, `InteractiveCalculator.tsx`, `LeadershipSection.tsx`, `ProductBento.tsx`, `TestimonialsSection.tsx`, `TrustMarquee.tsx`, `TuyoShowcaseSections.tsx`.
3. Adjust relative imports (`../` -> `../../`) for all files moved into `features/`.
4. Update `update/src/components/features/index.ts` to export all features.
5. Remove obsolete facade files `Calculator.tsx`, `FAQ.tsx`, `MoveMoney.tsx`, `Testimonials.tsx` from `features/`.

### Phase 2: Migrate Full Page Implementations
1. Overwrite facade `update/src/pages/public/AboutUsPage.tsx` with full 497-line implementation (updating feature imports).
2. Overwrite facade `update/src/pages/public/BlogPage.tsx` with full 528-line implementation (updating data imports).
3. Overwrite facade `update/src/pages/public/CareersPage.tsx` with full 377-line implementation (updating data & modal imports).
4. Overwrite facade `update/src/pages/public/GalleryPage.tsx` with full 290-line implementation (updating data imports).
5. Overwrite facade `update/src/pages/public/ProductDetailPage.tsx` with full 402-line implementation (updating data imports).
6. Create `update/src/pages/public/NotFoundPage.tsx` and re-export in `update/src/pages/public/index.ts`.
7. Create `update/src/pages/admin/CmsPortalPage.tsx` (from `components/CmsPortal.tsx`), adjusting data imports to `../../data/*`.
8. Update `update/src/pages/admin/index.ts` to export `CmsPortalPage`.

### Phase 3: Update Consumers (`LandingPage.tsx` & `App.tsx`)
1. Update `update/src/pages/public/LandingPage.tsx` to import features from `../../components/features/*`.
2. Update `update/src/App.tsx`:
   - Import `ApplyModal` from `./components/features/ApplyModal`.
   - Import `CmsPortalPage` from `./pages/admin/CmsPortalPage`.
   - Import `NotFoundPage` from `./pages/public`.
   - Update `AppRoute`, `handleUrlChange`, `handleNavigate`, and `<main>` rendering for `/auth/*`, `cms`, and `404`.

### Phase 4: Delete Loose Files in `update/src/components/` Root
1. Delete all 23 loose files in `update/src/components/`.
2. Ensure only `features`, `layout`, and `ui` directories remain in `update/src/components/`.

### Phase 5: Build & Verification
1. Run `cd update; npm run build` to verify clean compilation with code 0.
2. Run directory verification: confirm zero loose files in `src/components/`.
3. Run file line count verification: confirm all files in `src/pages/public/` are > 200 lines (no 11-line facades).

---

## 9. Verification & Validation Protocol

The implementer and reviewer can independently verify the completed migration using the following automated checks:

### Verification Check 1: Zero Loose Files in `src/components/`
```powershell
Get-ChildItem "update/src/components" -File | Measure-Object | Select-Object -ExpandProperty Count
# MUST RETURN: 0
```

### Verification Check 2: Strictly Allowed Subdirectories in `src/components/`
```powershell
(Get-ChildItem "update/src/components" -Directory).Name
# MUST RETURN EXACTLY:
# features
# layout
# ui
```

### Verification Check 3: Genuine Page Implementations (No Proxy Facades)
```powershell
Get-ChildItem "update/src/pages/public/*.tsx" | ForEach-Object {
    [PSCustomObject]@{
        Name = $_.Name
        Lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
    }
}
# Expected line counts:
# AboutUsPage.tsx: > 450 lines
# BlogPage.tsx: > 500 lines
# CareersPage.tsx: > 350 lines
# GalleryPage.tsx: > 280 lines
# LandingPage.tsx: ~ 68 lines
# NotFoundPage.tsx: ~ 45 lines
# ProductDetailPage.tsx: > 390 lines
```

### Verification Check 4: Full Client Build
```powershell
cd update
npm run build
# MUST EXIT CODE: 0
# MUST GENERATE: dist/index.html, dist/assets/*.css, dist/assets/*.js
```

### Verification Check 5: Route Safety Check
- `#` / `#/` -> Loads `LandingPage`
- `#/about` -> Loads `AboutUsPage`
- `#/blog` -> Loads `BlogPage`
- `#/careers` -> Loads `CareersPage`
- `#/gallery` -> Loads `GalleryPage`
- `#/product-detail/suremoney-loan` -> Loads `ProductDetailPage`
- `#/auth/login` -> Loads `LoginPage` (hash is preserved, not stripped)
- `#/auth/register` -> Loads `RegisterPage` (hash is preserved, not stripped)
- `#/portal/dashboard` -> Loads `StaffDashboardPage`
- `#/admin/dashboard` -> Loads `AdminDashboardPage`
- `#/cms` -> Loads `CmsPortalPage`
- `#/some/garbage/route` -> Loads `NotFoundPage` (clean 404 message, no blank screen)

---

## 10. Conclusion

This migration plan eliminates all technical shortcuts, removes 100% of the 23 loose files from `update/src/components/`, replaces all 5 proxy re-exports with true page implementations, reorganizes domain widgets into `components/features/`, purges duplicate files, corrects auth route preservation, and introduces 404 fallback handling. 

Implementation of this plan will fully satisfy all review objections from `reviewer_m1_1` and pave the way for an immediate **APPROVE** verdict at Gate 1.
