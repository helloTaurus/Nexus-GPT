# Complete Import Dependency & Feature Migration Map (Milestone 1 — Round 2)

**Author**: `explorer_m1_r2_2` (Import Dependency & Feature Migration Explorer)  
**Target Codebase**: `update/src/`  
**Date**: 2026-11-10T00:40:00Z  
**Context**: Resolution of Gate 1 Review Failure (reviewer_m1_1 finding: 23 loose files in `src/components/`, facade proxy wrappers in `src/pages/public/`, duplicate files in `src/components/`, proxy wrappers in `src/components/features/`).

---

## 1. Executive Summary & Architecture Topography

In Milestone 1 Iteration 1, `reviewer_m1_1` issued `REQUEST_CHANGES` due to an integrity violation: the worker retained 23 monolithic page and widget files in `update/src/components/`, created 12-line facade proxy files in `update/src/pages/public/`, left stale duplicate layout files (`Navbar.tsx`, `Footer.tsx`), and populated `update/src/components/features/` with facade wrappers pointing back to parent loose files.

This document establishes the **exhaustive import dependency graph and path transformation specification** required to achieve 100% clean architecture compliance:
1. Move the **15 domain feature widgets and modals** into `update/src/components/features/`.
2. Move the **5 public page implementations** into `update/src/pages/public/` as standalone components (no facade re-exports).
3. Relocate **`CmsPortal.tsx`** into `update/src/pages/admin/` (or dedicated pages subfolder).
4. Remove the **2 stale duplicate files** (`Navbar.tsx`, `Footer.tsx`) from `update/src/components/`.
5. Eliminate the **4 proxy facade files** in `update/src/components/features/` (`Calculator.tsx`, `FAQ.tsx`, `MoveMoney.tsx`, `Testimonials.tsx`) in favor of canonical feature implementations and a unified barrel re-export in `update/src/components/features/index.ts`.
6. Ensure `update/src/components/` contains **strictly** three subdirectories: `ui/`, `layout/`, and `features/`, with zero loose files.

```
update/src/components/
├── ui/                 # 8 UI atomic primitives + index.ts (UNCHANGED)
├── layout/             # Navbar, Footer, Sidebar, PortalLayout, AdminLayout + index.ts (UNCHANGED)
└── features/           # 15 Domain Feature Widgets & Modals + index.ts (RELOCATED & UNIFIED)
```

---

## 2. Feature Components Relocation Matrix (15 Widgets & Modals)

Each component moving from `update/src/components/` into `update/src/components/features/` is shifted **one directory level deeper** relative to the project root (`src/components/` → `src/components/features/`). Consequently, all imports referencing `../data/*`, `../hooks/*`, and `../types` must be adjusted to `../../data/*`, `../../hooks/*`, and `../../types`.

Below is the complete inventory of all 15 feature files:

| # | Component File | Source Path (`update/src/components/`) | Destination Path (`update/src/components/features/`) | Relative Imports to Update | External Dependencies |
|---|----------------|-----------------------------------------|-------------------------------------------------------|----------------------------|-----------------------|
| 1 | `ApplyModal.tsx` | `./ApplyModal.tsx` | `./features/ApplyModal.tsx` | `../data/content` → `../../data/content`<br>`../hooks/useDialogFocus` → `../../hooks/useDialogFocus` | React, `@phosphor-icons/react` |
| 2 | `JobApplyModal.tsx` | `./JobApplyModal.tsx` | `./features/JobApplyModal.tsx` | `../hooks/useDialogFocus` → `../../hooks/useDialogFocus`<br>`../data/careersData` → `../../data/careersData` | React, `@phosphor-icons/react` |
| 3 | `BlogCmsModal.tsx` | `./BlogCmsModal.tsx` | `./features/BlogCmsModal.tsx` | `../data/blogData` → `../../data/blogData` | React, `@phosphor-icons/react` |
| 4 | `CardShowcase.tsx` | `./CardShowcase.tsx` | `./features/CardShowcase.tsx` | **None** (Self-contained) | React, `lucide-react` |
| 5 | `ComparisonSection.tsx` | `./ComparisonSection.tsx` | `./features/ComparisonSection.tsx` | **None** (Self-contained) | React, `@phosphor-icons/react` |
| 6 | `ContactSection.tsx` | `./ContactSection.tsx` | `./features/ContactSection.tsx` | **None** (Self-contained) | React, `@phosphor-icons/react` |
| 7 | `FAQSection.tsx` | `./FAQSection.tsx` | `./features/FAQSection.tsx` | `../data/content` → `../../data/content` | React, `@phosphor-icons/react` |
| 8 | `GlobalNetwork.tsx` | `./GlobalNetwork.tsx` | `./features/GlobalNetwork.tsx` | `../assets/images/...` → `../../assets/images/...` *(See Critical Hazard in Section 7)* | React, `lucide-react` |
| 9 | `Hero.tsx` | `./Hero.tsx` | `./features/Hero.tsx` | **None** (Uses public asset path string `"hero_car.jpg"`) | React, `@phosphor-icons/react`, `motion/react` |
| 10 | `InteractiveCalculator.tsx` | `./InteractiveCalculator.tsx` | `./features/InteractiveCalculator.tsx` | **None** (Self-contained math engine) | React, `@phosphor-icons/react` |
| 11 | `LeadershipSection.tsx` | `./LeadershipSection.tsx` | `./features/LeadershipSection.tsx` | `../data/content` → `../../data/content`<br>`../types` → `../../types` | React, `react-dom`, `@phosphor-icons/react` |
| 12 | `ProductBento.tsx` | `./ProductBento.tsx` | `./features/ProductBento.tsx` | `../data/content` → `../../data/content` | React, `@phosphor-icons/react` |
| 13 | `TestimonialsSection.tsx` | `./TestimonialsSection.tsx` | `./features/TestimonialsSection.tsx` | `../data/content` → `../../data/content` | React, `lucide-react` |
| 14 | `TrustMarquee.tsx` | `./TrustMarquee.tsx` | `./features/TrustMarquee.tsx` | **None** (Self-contained institutional array) | React, `@phosphor-icons/react` |
| 15 | `TuyoShowcaseSections.tsx` | `./TuyoShowcaseSections.tsx` | `./features/TuyoShowcaseSections.tsx` | **None** (Self-contained liquidity & yield sections) | React, `motion/react`, `@phosphor-icons/react` |

---

### Detailed Code Snippet Changes for 15 Features

#### 1. `ApplyModal.tsx`
- **Location**: `update/src/components/features/ApplyModal.tsx`
- **Changes**: Lines 3–4
```diff
--- a/update/src/components/ApplyModal.tsx
+++ b/update/src/components/features/ApplyModal.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect } from 'react';
 import { X, Check, ArrowRight, ShieldCheck, Clock, FileText, Buildings } from '@phosphor-icons/react';
-import { NEXUS_PRODUCTS } from '../data/content';
-import { useDialogFocus } from '../hooks/useDialogFocus';
+import { NEXUS_PRODUCTS } from '../../data/content';
+import { useDialogFocus } from '../../hooks/useDialogFocus';
```

#### 2. `JobApplyModal.tsx`
- **Location**: `update/src/components/features/JobApplyModal.tsx`
- **Changes**: Lines 2–3
```diff
--- a/update/src/components/JobApplyModal.tsx
+++ b/update/src/components/features/JobApplyModal.tsx
@@ -1,4 +1,4 @@
 import React, { useState } from 'react';
-import { useDialogFocus } from '../hooks/useDialogFocus';
-import { JobOpening } from '../data/careersData';
+import { useDialogFocus } from '../../hooks/useDialogFocus';
+import { JobOpening } from '../../data/careersData';
 import { X, CheckCircle, PaperPlaneTilt, UploadSimple } from '@phosphor-icons/react';
```

#### 3. `BlogCmsModal.tsx`
- **Location**: `update/src/components/features/BlogCmsModal.tsx`
- **Changes**: Line 2
```diff
--- a/update/src/components/BlogCmsModal.tsx
+++ b/update/src/components/features/BlogCmsModal.tsx
@@ -1,3 +1,3 @@
 import React, { useState } from 'react';
-import { BlogPost } from '../data/blogData';
+import { BlogPost } from '../../data/blogData';
 import { X, Plus, PencilSimple, Trash, Check, ArrowCounterClockwise } from '@phosphor-icons/react';
```

#### 4. `FAQSection.tsx`
- **Location**: `update/src/components/features/FAQSection.tsx`
- **Changes**: Line 2
```diff
--- a/update/src/components/FAQSection.tsx
+++ b/update/src/components/features/FAQSection.tsx
@@ -1,3 +1,3 @@
 import React, { useState } from 'react';
-import { FAQS } from '../data/content';
+import { FAQS } from '../../data/content';
 import { CaretDown, Question } from '@phosphor-icons/react';
```

#### 5. `LeadershipSection.tsx`
- **Location**: `update/src/components/features/LeadershipSection.tsx`
- **Changes**: Lines 3–4
```diff
--- a/update/src/components/LeadershipSection.tsx
+++ b/update/src/components/features/LeadershipSection.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect } from 'react';
 import { createPortal } from 'react-dom';
-import { LEADERSHIP_TEAM } from '../data/content';
-import { LeadershipMember } from '../types';
+import { LEADERSHIP_TEAM } from '../../data/content';
+import { LeadershipMember } from '../../types';
 import {
```

#### 6. `ProductBento.tsx`
- **Location**: `update/src/components/features/ProductBento.tsx`
- **Changes**: Line 14
```diff
--- a/update/src/components/ProductBento.tsx
+++ b/update/src/components/features/ProductBento.tsx
@@ -11,4 +11,4 @@
   AirplaneTilt,
 } from "@phosphor-icons/react";
-import { NEXUS_PRODUCTS } from "../data/content";
+import { NEXUS_PRODUCTS } from "../../data/content";
 interface ProductBentoProps {
```

#### 7. `TestimonialsSection.tsx`
- **Location**: `update/src/components/features/TestimonialsSection.tsx`
- **Changes**: Line 2
```diff
--- a/update/src/components/TestimonialsSection.tsx
+++ b/update/src/components/features/TestimonialsSection.tsx
@@ -1,3 +1,3 @@
 import React, { useState } from 'react';
-import { TESTIMONIALS } from '../data/content';
+import { TESTIMONIALS } from '../../data/content';
 import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
```

#### 8. `GlobalNetwork.tsx`
- **Location**: `update/src/components/features/GlobalNetwork.tsx`
- **Changes**: Line 3 *(See Section 7 for asset missing error prevention)*
```diff
--- a/update/src/components/GlobalNetwork.tsx
+++ b/update/src/components/features/GlobalNetwork.tsx
@@ -1,4 +1,4 @@
 import React, { useState } from 'react';
 import { Globe, ArrowRight, Shield, Zap, RefreshCw } from 'lucide-react';
-import globeImg from '../assets/images/nexus_global_exchange_globe_1792755830792.jpg';
+import globeImg from '../../assets/images/nexus_global_exchange_globe_1792755830792.jpg';
```

---

## 3. Standalone Public Pages Import Transformation Matrix

Currently, `update/src/pages/public/` contains facade wrappers that delegate to `../../components/*`. The real implementations (26KB–15KB) from `src/components/` must be moved to replace the facades.

When these page implementations are placed in `update/src/pages/public/`:
- They reside **two levels deep** from `update/src/` (`src/pages/public/`).
- Imports pointing to `../data/*` become `../../data/*`.
- Imports referencing feature sections become `../../components/features/*` or from the barrel `../../components/features`.

### 1. `AboutUsPage.tsx`
- **Source**: `update/src/components/AboutUsPage.tsx` (497 lines)
- **Target**: `update/src/pages/public/AboutUsPage.tsx`
- **Exports**: `AboutUsPageProps`, `AboutUsPage`
- **Import Changes (Lines 22–24)**:
```diff
--- a/update/src/components/AboutUsPage.tsx
+++ b/update/src/pages/public/AboutUsPage.tsx
@@ -19,6 +19,4 @@
   Check,
 } from '@phosphor-icons/react';
-import { LeadershipSection } from './LeadershipSection';
-import { ProductBento } from './ProductBento';
-import { TrustMarquee } from './TrustMarquee';
+import { LeadershipSection, ProductBento, TrustMarquee } from '../../components/features';
```

### 2. `BlogPage.tsx`
- **Source**: `update/src/components/BlogPage.tsx` (528 lines)
- **Target**: `update/src/pages/public/BlogPage.tsx`
- **Exports**: `BlogPageProps`, `BlogPage`
- **Import Changes (Line 2)**:
```diff
--- a/update/src/components/BlogPage.tsx
+++ b/update/src/pages/public/BlogPage.tsx
@@ -1,3 +1,3 @@
 import React, { useState } from 'react';
-import { BlogPost, INITIAL_BLOG_POSTS } from '../data/blogData';
+import { BlogPost, INITIAL_BLOG_POSTS } from '../../data/blogData';
 import {
```

### 3. `CareersPage.tsx`
- **Source**: `update/src/components/CareersPage.tsx` (377 lines)
- **Target**: `update/src/pages/public/CareersPage.tsx`
- **Exports**: `CareersPageProps`, `CareersPage`
- **Import Changes (Lines 2–3)**:
```diff
--- a/update/src/components/CareersPage.tsx
+++ b/update/src/pages/public/CareersPage.tsx
@@ -1,4 +1,4 @@
 import React, { useState } from 'react';
-import { JobOpening, JOB_OPENINGS } from '../data/careersData';
-import { JobApplyModal } from './JobApplyModal';
+import { JobOpening, JOB_OPENINGS } from '../../data/careersData';
+import { JobApplyModal } from '../../components/features';
 import {
```

### 4. `GalleryPage.tsx`
- **Source**: `update/src/components/GalleryPage.tsx` (364 lines)
- **Target**: `update/src/pages/public/GalleryPage.tsx`
- **Exports**: `GalleryPageProps`, `GalleryPage`
- **Import Changes (Line 2)**:
```diff
--- a/update/src/components/GalleryPage.tsx
+++ b/update/src/pages/public/GalleryPage.tsx
@@ -1,3 +1,3 @@
 import React, { useState, useEffect, useCallback } from 'react';
-import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../data/galleryData';
+import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../../data/galleryData';
 import {
```

### 5. `ProductDetailPage.tsx`
- **Source**: `update/src/components/ProductDetailPage.tsx` (402 lines)
- **Target**: `update/src/pages/public/ProductDetailPage.tsx`
- **Exports**: `ProductDetailPageProps`, `ProductDetailPage`
- **Import Changes (Line 2)**:
```diff
--- a/update/src/components/ProductDetailPage.tsx
+++ b/update/src/pages/public/ProductDetailPage.tsx
@@ -1,3 +1,3 @@
 import React, { useState } from 'react';
-import { NEXUS_PRODUCTS } from '../data/content';
+import { NEXUS_PRODUCTS } from '../../data/content';
 import {
```

### 6. `LandingPage.tsx` (Update to use Clean Features Barrel)
- **File**: `update/src/pages/public/LandingPage.tsx`
- **Import Changes (Lines 2–13)**:
```diff
--- a/update/src/pages/public/LandingPage.tsx
+++ b/update/src/pages/public/LandingPage.tsx
@@ -1,13 +1,12 @@
 import React from 'react';
-import { Hero } from '../../components/Hero';
-import { ProductBento } from '../../components/ProductBento';
-import { TrustMarquee } from '../../components/TrustMarquee';
-import { MoveMoney } from '../../components/features/MoveMoney';
-import { Calculator } from '../../components/features/Calculator';
-import { LeadershipSection } from '../../components/LeadershipSection';
-import { FAQ } from '../../components/features/FAQ';
 import {
+  Hero,
+  ProductBento,
+  TrustMarquee,
+  MoveMoney,
+  Calculator,
+  LeadershipSection,
+  FAQ,
   TestimonialsSliderSection,
   LiveTickingYieldSection,
-} from '../../components/features/Testimonials';
-import { ContactSection } from '../../components/ContactSection';
+  ContactSection,
+} from '../../components/features';
```

---

## 4. App.tsx & Admin Relocation Mappings

### 1. `update/src/App.tsx`
In `App.tsx`:
- Line 4 imports `ApplyModal` directly from `./components/ApplyModal`. This must be updated to `./components/features`.
- Line 40 imports `CmsPortal` from `./components/CmsPortal`. This should be updated to `./pages/admin/CmsPortal` (or imported from `./pages/admin`).

```diff
--- a/update/src/App.tsx
+++ b/update/src/App.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect } from 'react';
 import { motion, AnimatePresence } from 'motion/react';
 import { Navbar, Footer } from './components/layout';
-import { ApplyModal } from './components/ApplyModal';
+import { ApplyModal } from './components/features';
 import { useIOReveal } from './hooks/useIOReveal';
@@ -37,4 +37,4 @@
 } from './pages/admin';
 
-// Legacy CMS Portal
-import { CmsPortal } from './components/CmsPortal';
+import { CmsPortal } from './pages/admin/CmsPortal';
```

### 2. `CmsPortal.tsx`
- **Source**: `update/src/components/CmsPortal.tsx` (1181 lines)
- **Target**: `update/src/pages/admin/CmsPortal.tsx`
- **Import Changes**:
```diff
--- a/update/src/components/CmsPortal.tsx
+++ b/update/src/pages/admin/CmsPortal.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect } from 'react';
-import { BlogPost, INITIAL_BLOG_POSTS } from '../data/blogData';
-import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../data/galleryData';
-import { JobOpening, JOB_OPENINGS } from '../data/careersData';
+import { BlogPost, INITIAL_BLOG_POSTS } from '../../data/blogData';
+import { GalleryItem, INITIAL_GALLERY_ITEMS, GalleryFolder } from '../../data/galleryData';
+import { JobOpening, JOB_OPENINGS } from '../../data/careersData';
```
- In `update/src/pages/admin/index.ts`, add:
```ts
export * from './CmsPortal';
```

---

## 5. Clean Re-Export Architecture: `src/components/features/index.ts`

To provide both canonical domain naming and seamless backward compatibility for existing imports (`Calculator`, `MoveMoney`, `FAQ`, `Testimonials`), `update/src/components/features/index.ts` should be structured as follows:

```typescript
/**
 * Nexus Finance - Domain Feature Components & Modals Barrel
 * Conforming to Clean Architecture Layout Specification
 */

// 1. Modals & Application Dialogs
export * from './ApplyModal';
export * from './JobApplyModal';
export * from './BlogCmsModal';

// 2. Interactive Calculator Engine
export * from './InteractiveCalculator';
export { InteractiveCalculator as Calculator } from './InteractiveCalculator';

// 3. Tuyo Financial Showcase & Liquidity Sections
export * from './TuyoShowcaseSections';
export { MoveMoneySection as MoveMoney } from './TuyoShowcaseSections';
export { TestimonialsSliderSection as Testimonials } from './TuyoShowcaseSections';

// 4. Marketing & Public Feature Sections
export * from './Hero';
export * from './ProductBento';
export * from './TrustMarquee';
export * from './LeadershipSection';
export * from './ContactSection';
export * from './FAQSection';
export { FAQSection as FAQ } from './FAQSection';
export * from './CardShowcase';
export * from './ComparisonSection';
export * from './TestimonialsSection';
export * from './GlobalNetwork';
```

### Treatment of Old Facade Files in `features/`
The 4 old facade files in `update/src/components/features/`:
- `Calculator.tsx` (13 lines)
- `FAQ.tsx` (9 lines)
- `MoveMoney.tsx` (13 lines)
- `Testimonials.tsx` (13 lines)

**Recommendation**: Remove them completely. Since `index.ts` re-exports both the canonical names (`InteractiveCalculator`, `MoveMoneySection`, `FAQSection`, `TestimonialsSliderSection`) AND the alias names (`Calculator`, `MoveMoney`, `FAQ`, `Testimonials`), any consumer importing from `@/components/features` or `../../components/features` will resolve cleanly without needing proxy wrapper files.

If deep imports like `import { Calculator } from '@/components/features/Calculator'` must be preserved for legacy reasons, replace their contents with simple local sibling re-exports (e.g. `export * from './InteractiveCalculator';`) with zero references to `../` (parent directory).

---

## 6. Dead Code & Duplicate Elimination Map

The following files currently at the root of `update/src/components/` are obsolete duplicates and must be removed:

| File to Delete | Reason | Active Replacement |
|----------------|--------|---------------------|
| `update/src/components/Navbar.tsx` (219 lines) | Dead duplicate from initial prototype. | `update/src/components/layout/Navbar.tsx` (355 lines, full responsive navigation with theme toggle) |
| `update/src/components/Footer.tsx` (345 lines) | Dead duplicate from initial prototype. | `update/src/components/layout/Footer.tsx` (345 lines, matches official layout) |

**Verification**: A global grep across `update/src/` confirms that `App.tsx` line 3 already imports `import { Navbar, Footer } from './components/layout';`. Deleting the root files introduces zero breaks.

---

## 7. Critical Hazards, Asset Anomalies & Mitigation Strategies

### Hazard: Missing Image in `GlobalNetwork.tsx`
- **Observation**: Line 3 of `update/src/components/GlobalNetwork.tsx` attempts to import:
  ```ts
  import globeImg from '../assets/images/nexus_global_exchange_globe_1792755830792.jpg';
  ```
- **Finding**: The directory `update/src/assets` does not exist on disk. While `npm run build` currently passes because `GlobalNetwork.tsx` is not imported anywhere in `App.tsx` or `pages/`, **exporting `GlobalNetwork` from `features/index.ts` or importing it into a page will trigger a fatal Vite module resolution error**:
  `[vite] Internal server error: Failed to resolve import "../assets/images/nexus_global_exchange_globe_1792755830792.jpg"`
- **Mitigation Strategy for Implementer**:
  In `update/src/components/features/GlobalNetwork.tsx`, replace the static local asset import with an inline SVG / Lucide visual or a reliable web SVG fallback:
  ```tsx
  // Instead of: import globeImg from '../../assets/images/nexus_global_exchange_globe_1792755830792.jpg';
  // Use a fallback placeholder or the Lucide Globe component:
  const globeImg = "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80";
  ```
  This ensures that Vite builds cleanly regardless of whether `GlobalNetwork` is bundled.

---

## 8. Summary of All 23 Files in `update/src/components/`

| # | Filename | Relocation Action | Target Path |
|---|----------|-------------------|-------------|
| 1 | `AboutUsPage.tsx` | Move full implementation | `update/src/pages/public/AboutUsPage.tsx` |
| 2 | `ApplyModal.tsx` | Move widget | `update/src/components/features/ApplyModal.tsx` |
| 3 | `BlogCmsModal.tsx` | Move widget | `update/src/components/features/BlogCmsModal.tsx` |
| 4 | `BlogPage.tsx` | Move full implementation | `update/src/pages/public/BlogPage.tsx` |
| 5 | `CardShowcase.tsx` | Move section | `update/src/components/features/CardShowcase.tsx` |
| 6 | `CareersPage.tsx` | Move full implementation | `update/src/pages/public/CareersPage.tsx` |
| 7 | `CmsPortal.tsx` | Move admin page | `update/src/pages/admin/CmsPortal.tsx` |
| 8 | `ComparisonSection.tsx` | Move section | `update/src/components/features/ComparisonSection.tsx` |
| 9 | `ContactSection.tsx` | Move section | `update/src/components/features/ContactSection.tsx` |
| 10 | `FAQSection.tsx` | Move section | `update/src/components/features/FAQSection.tsx` |
| 11 | `Footer.tsx` | **DELETE** | Stale duplicate of `components/layout/Footer.tsx` |
| 12 | `GalleryPage.tsx` | Move full implementation | `update/src/pages/public/GalleryPage.tsx` |
| 13 | `GlobalNetwork.tsx` | Move section (patch asset) | `update/src/components/features/GlobalNetwork.tsx` |
| 14 | `Hero.tsx` | Move section | `update/src/components/features/Hero.tsx` |
| 15 | `InteractiveCalculator.tsx` | Move section | `update/src/components/features/InteractiveCalculator.tsx` |
| 16 | `JobApplyModal.tsx` | Move widget | `update/src/components/features/JobApplyModal.tsx` |
| 17 | `LeadershipSection.tsx` | Move section | `update/src/components/features/LeadershipSection.tsx` |
| 18 | `Navbar.tsx` | **DELETE** | Stale duplicate of `components/layout/Navbar.tsx` |
| 19 | `ProductBento.tsx` | Move section | `update/src/components/features/ProductBento.tsx` |
| 20 | `ProductDetailPage.tsx` | Move full implementation | `update/src/pages/public/ProductDetailPage.tsx` |
| 21 | `TestimonialsSection.tsx` | Move section | `update/src/components/features/TestimonialsSection.tsx` |
| 22 | `TrustMarquee.tsx` | Move section | `update/src/components/features/TrustMarquee.tsx` |
| 23 | `TuyoShowcaseSections.tsx` | Move section | `update/src/components/features/TuyoShowcaseSections.tsx` |

**Post-Migration Result**: Exactly **0 loose files** in `update/src/components/`.

---

## 9. Verification Commands

1. **Verify Build**:
   ```bash
   npm --prefix update run build
   ```
   Must output exit code 0 and generate `update/dist/`.

2. **Verify Adversarial UI Suite**:
   ```powershell
   $env:NODE_PATH="update/node_modules"; node --import ./update/node_modules/tsx/dist/loader.mjs --test tests/adversarial/*.test.ts
   ```
   Must report 25/25 passing tests.

3. **Verify Zero Loose Files**:
   ```powershell
   Get-ChildItem -Path "update\src\components" -File
   ```
   Must return an empty array (length 0).
