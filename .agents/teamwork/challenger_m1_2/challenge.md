# Adversarial Challenge Report: Milestone 1 Design System Tokens, Motion & UI Primitives

**Challenger**: `challenger_m1_2` (Design System Tokens & Motion Challenger)  
**Role**: `critic`, `specialist` (Empirical Challenger)  
**Milestone**: Milestone 1 (Scaffolding, Pages Restructure & Design System)  
**Date**: 2026-11-10T00:28:00Z  
**Verdict**: **APPROVE** (All 25 empirical challenge and stress tests passed; 0 blocking bugs found)

---

## 1. Challenge Summary

**Overall risk assessment**: **LOW**

The Design System Tokens, Typography, Geometry, Motion easing, and UI primitive atoms implemented by `worker_m1` in `update/` were empirically tested against strict mathematical, typographic, and rendering invariants.

1. **Tokens & Theme Consistency**:
   - `nexus-tokens.css` strictly provides all 16 dark tokens and 14 light theme tokens (`--nx-canvas`, `--nx-surface`, `--nx-subtle`, `--nx-ink`, `--nx-muted`, `--nx-rule`, `--nx-blue`, `--nx-button`, `--nx-button-hover`, `--nx-green`, `--nx-accent-soft`, `--nx-header`, `--nx-danger`, `--nx-danger-soft`, `--nx-warning`, `--nx-warning-soft`).
   - `index.css` `@theme inline` properly binds all `--color-*` utilities to the `--nx-*` tokens.
   - Production Vite bundle compiles the CSS tokens into `dist/assets/index-C7AfBU_j.css` with valid selector mappings for `:root, .nx-inverse` and `html.light`.
2. **Typography Contract**:
   - Google Fonts link in `index.html` loads all three specified font families: `Bricolage Grotesque` (display/headings), `Instrument Sans` (body/controls), and `DM Sans` (body/fallback).
   - `@theme inline` sets `--font-heading: "Bricolage Grotesque", var(--font-sans);` and `--font-sans: "Instrument Sans", "DM Sans", ...`.
3. **Geometry Contract**:
   - 7px control radius is strictly enforced across `--nx-radius-control: 7px;` in CSS, `--radius-control: 7px;` in `@theme`, `rounded-[7px]` in `Button.tsx`, `Input.tsx`, `Skeleton.tsx` rectangular variant, and close buttons.
   - 12px card radius is strictly enforced across `--nx-radius-card: 12px;` in CSS, `--radius-card: 12px;` in `@theme`, `rounded-[12px]` in `Card.tsx`, `Modal.tsx` panel, and `Drawer.tsx` bottom sheet.
4. **Motion System Contract**:
   - Universal easing curve `--nx-ease` strictly equals `cubic-bezier(0.22, 1, 0.36, 1)`.
   - Motion primitives in `framer-motion` (`motion/react`) explicitly configure `ease: [0.22, 1, 0.36, 1]`.
   - Accessibility fallback for `prefers-reduced-motion: reduce` sets animation and transition durations to `0.01ms` in `nexus-system.css`.
5. **UI Primitives Conformance & Stress Harness**:
   - All 8 UI atoms (`Button`, `Input`, `Badge`, `Card`, `Modal`, `Drawer`, `Skeleton`, `Tabs`) export valid TypeScript React components from `src/components/ui/index.ts`.
   - Evaluated 18 variant/size combinations of `Button`, 12 combinations of `Badge`, 12 combinations of `Card`, 3 variants of `Skeleton`, input error precedence, tabs active underline, and SSR safety guards for `Modal` and `Drawer`. All passed 100%.

---

## 2. Challenges & Empirical Stress Tests

### [Low Risk] Challenge 1: CSS Minification Stripping Leading Zeroes in Easing Curve
- **Assumption challenged**: The production build bundle preserves the exact string `"cubic-bezier(0.22, 1, 0.36, 1)"`.
- **Attack scenario**: CSS optimizers (lightningcss / esbuild) compress decimal numbers `< 1` by stripping leading zeroes (e.g. `0.22` -> `.22`), which could cause naive regex string matchers or strict token validators to claim tokens are missing.
- **Empirical verification**:
  Inspected `dist/assets/index-C7AfBU_j.css` at offset 57322:
  `--nx-ease:cubic-bezier(.22, 1, .36, 1);`
  The curve parameters `x1 = 0.22, y1 = 1, x2 = 0.36, y2 = 1` are identical in CSS rendering engines.
- **Blast radius**: Negligible. Browser CSS parsers treat `cubic-bezier(.22, 1, .36, 1)` and `cubic-bezier(0.22, 1, 0.36, 1)` identically.
- **Mitigation**: Verified that automated test regular expressions allow optional leading zeroes (`0?\.22,\s*1,\s*0?\.36,\s*1`).

### [Low Risk] Challenge 2: Headless SSR Safety for Portal Dialogs (Modal & Drawer)
- **Assumption challenged**: Invoking `Modal` or `Drawer` during server-side rendering or non-browser environments might access `document.body` or `window` and throw unhandled reference errors.
- **Attack scenario**: Render `<Modal isOpen={true}>` and `<Drawer isOpen={true}>` in Node.js server test environment where `typeof document === 'undefined'`.
- **Empirical verification**:
  Executed `tests/adversarial/m1-ui-primitives-stress.test.ts` line 160:
  ```ts
  const modalOpen = renderToStaticMarkup(React.createElement(Modal, { isOpen: true, onClose: () => {} }, 'Modal Content'));
  assert.equal(modalOpen, '');
  ```
  Both `Modal.tsx` and `Drawer.tsx` contain explicit safety guard `if (typeof document === 'undefined') return null;`, ensuring zero SSR crashes.
- **Blast radius**: None. Safely handles headless / SSR environments.

### [Low Risk] Challenge 3: Input Component Accessibility & Label Slug Collision
- **Assumption challenged**: When no `id` is passed to `Input`, the auto-generated `id` from `label` might produce invalid HTML id characters or collide.
- **Attack scenario**: Passed label `"Bank Account Number"` and tested whether `htmlFor` on `<label>` matches `id` on `<input>`.
- **Empirical verification**:
  Rendered output: `<label for="bank-account-number">...<input id="bank-account-number" ...>`.
  When an explicit `id="custom-input-id"` is provided, it overrides the auto-generated id.
- **Blast radius**: None. Accessible association confirmed.

---

## 3. Stress Test Results

Executed automated test suites:
- `tests/adversarial/m1-design-system-challenge.test.ts` (16 tests)
- `tests/adversarial/m1-ui-primitives-stress.test.ts` (9 tests)
- `tests/e2e/tier1-features/architecture-design.test.ts` (5 tests)

| Test Suite / Scenario | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- |
| **Color Tokens (Dark Theme)** | All 16 `--nx-*` tokens match exact hex values in `nexus-tokens.css` | All 16 tokens verified | **PASS** |
| **Color Tokens (Light Theme)** | All 14 `html.light` tokens match exact hex values in `nexus-tokens.css` | All 14 tokens verified | **PASS** |
| **Geometry (Control Radius)** | `--nx-radius-control: 7px;` in CSS and components | 7px enforced across CSS & components | **PASS** |
| **Geometry (Card Radius)** | `--nx-radius-card: 12px;` in CSS and components | 12px enforced across CSS & components | **PASS** |
| **Typography (index.html)** | Loads `Bricolage Grotesque`, `Instrument Sans`, `DM Sans` | All 3 fonts present in Google Fonts link | **PASS** |
| **Typography (@theme)** | Configures `--font-heading` and `--font-sans` with specified fonts | Configured correctly in `index.css` | **PASS** |
| **Motion Easing Curve** | `--nx-ease` strictly equals `cubic-bezier(0.22, 1, 0.36, 1)` | Verified in CSS and `dist` bundle | **PASS** |
| **Reduced Motion Fallback** | `prefers-reduced-motion` sets animation to `0.01ms` | Verified in `nexus-system.css` | **PASS** |
| **UI Primitives Export** | `src/components/ui/index.ts` exports 8 atoms | 8 components cleanly exported | **PASS** |
| **Button Matrix (18 cases)** | 6 variants x 3 sizes render 7px radius, easing, colors | All 18 permutations rendered correctly | **PASS** |
| **Button Disabled / Loading** | Loading shows spinner, disables button, suppresses leftIcon | Verified under stress harness | **PASS** |
| **Input State Precedence** | Error message suppresses helper text and sets `border-danger` | Precedence confirmed | **PASS** |
| **Badge Matrix (12 cases)** | 6 variants x 2 sizes render `rounded-full` and correct SVG icons | Verified under stress harness | **PASS** |
| **Card Matrix (12 cases)** | 3 variants x 4 padding render 12px radius and surface styling | Verified under stress harness | **PASS** |
| **Skeleton Variants** | Text (4px), circular (full), rectangular (7px) with dimension styles | Verified under stress harness | **PASS** |
| **Tabs Underline & Counts** | Active tab gets `text-brand` and active indicator; count badge rendered | Verified under stress harness | **PASS** |
| **Modal / Drawer SSR Guard** | Guard `typeof document === 'undefined'` prevents SSR exceptions | Renders empty string without exception | **PASS** |
| **Production Build** | `npm run build` succeeds with code 0 emitting JS/CSS bundles | Built in 8.09s, code 0 | **PASS** |

**Total Tests Executed**: 30  
**Passed**: 30  
**Failed**: 0  

---

## 4. Unchallenged Areas

- **Backend API & Data Persistence (`server/`)**: Planned for Milestone 2 (M2) in the roadmap. Out of scope for Milestone 1 Design System review.
- **Client Hash Route State Flow**: Covered by peer challenger `challenger_m1_1` (Scaffolding & Layout Architecture Challenger).

---

## 5. Explicit Recommendation

**VERDICT: APPROVE**

Milestone 1 Design System Tokens, Typography, Geometry, Motion, and UI Primitives strictly conform to the specifications defined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `visual_survey.md`.
