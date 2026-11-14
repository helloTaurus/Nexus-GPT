## 2026-11-09T22:42:29Z
You are worker_m1, the Scaffolding, Pages Restructure & Design System Worker.
Your working directory is: c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m1

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\ORIGINAL_REQUEST.md

Also read:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\PROJECT.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_survey_1\visual_survey.md
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\explorer_survey_3\tech_sec_survey.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You own exclusively:
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\pages\
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\components\
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\App.tsx
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\main.tsx
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\index.css
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\nexus-tokens.css
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\src\nexus-system.css
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\index.html
- c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\update\package.json
DO NOT modify anything in tests/.

Task Objectives (Milestone 1):
1. Project Repository Restructure & Clean Architecture:
   - Establish dedicated `src/pages/` folder hierarchy:
     * `src/pages/public/` (Landing/Home, AboutUsPage, ProductDetailPage, BlogPage, CareersPage, GalleryPage)
     * `src/pages/auth/` (LoginPage, RegisterPage)
     * `src/pages/portal/` (Staff Portal layout and placeholder dashboard)
     * `src/pages/admin/` (Admin Portal layout and placeholder dashboard)
   - Reorganize `src/components/` into pure reusable components:
     * `src/components/ui/` (Button, Input, Badge, Card, Modal, Drawer, Skeleton, Tabs)
     * `src/components/layout/` (Navbar, Sidebar, Footer, PortalLayout, AdminLayout)
     * `src/components/features/` (MoveMoney, Calculator, Testimonials, FAQ)
2. Typography & Design Tokens:
   - Verify and ensure `Bricolage Grotesque` and `Instrument Sans` / `DM Sans` are loaded and configured.
   - Enforce exact design tokens: Sapphire (`#0D51B2`), Ink (`#101E30`/`#F3F6FA`), Canvas (`#F7F8FA`/`#0D1624`), Surface (`#FFFFFF`/`#121E2E`), Emerald (`#007B58`/`#69D3B0`), 7px control radiuses, 12px card radiuses.
3. Motion Design Implementation:
   - Integrate `motion` (`motion/react`) with natural easing curve: `cubic-bezier(0.22, 1, 0.36, 1)`.
   - Micro-interactions: hover states, tap scale, toggle switches, form submission feedback.
   - Contextual transitions: smooth screen routing transitions with AnimatePresence.
   - Perceived performance: skeleton screen loaders for data retrieval states.
4. Client Routing:
   - Update `src/App.tsx` with clean URL routing supporting all public pages, `/auth/*`, `/portal/*`, and `/admin/*`.
5. Build Verification:
   - Run build command (`npm run build` or `npx vite build`) in `update/` to verify TypeScript compiles cleanly with zero errors.
6. Write your handoff report documenting code changes and build results to:
   c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update\.agents\teamwork\worker_m1\handoff.md.
7. Send a message to orchestrator (conversation ID f0eaa8f3-f239-4c1e-803d-5a3d0223cbc8) when complete.
