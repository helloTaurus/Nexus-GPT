# Nexus Finance & Zoho People HRMS: Comprehensive Visual Survey & UI/UX Design System

**Date**: 2026-11-09  
**Explorer**: `explorer_survey_1` (UI/UX & Visual Design Explorer)  
**Target Codebase**: `c:\Users\Head IT Inovation\Downloads\Nexus-Finance-Complete-Style-Update`  
**Reference Design Path**: `c:\Users\Head IT Inovation\Desktop\Nexus guide`  

---

## 1. Executive Summary & Brand Identity

The visual identity of Nexus Finance represents an institutional, high-trust fintech and cooperative financial architecture. The design language combines **Sapphire Blue**, **Ink**, **Porcelain**, and **Restrained Emerald Green** into an editorial, precision-engineered financial interface. 

The previous design iterations (seen in earlier screenshots with high-saturation neon greens `#00e599`) have been intentionally refactored in the Complete Style Update package into an authoritative palette:
- **Primary Brand / Action**: Solid Sapphire Blue (`#0D51B2`), delivering strong focus and accessibility.
- **Backgrounds & Canvas**: Deep Midnight Ink (`#0D1624`) in Dark Mode, Crisp Neutral Porcelain (`#F7F8FA`) in Light Mode.
- **Surfaces**: Distinct layered navy surfaces (`#121E2E` and `#192A3E`) in Dark Mode; pure white (`#FFFFFF`) and cool gray (`#EDF2F6`) in Light Mode.
- **Accents**: Restrained Emerald Green (`#007B58` Light / `#69D3B0` Dark) reserved strictly for positive financial metrics, verified statuses, and yields—never used as arbitrary decorative neon.

All HRMS (Zoho People replication) and Expense features must follow this exact design system without deviation.

---

## 2. Design System Tokens & Color Palette

### 2.1 CSS Custom Property Contract

Derived directly from `src/nexus-tokens.css` and `src/nexus-system.css`:

| Token Role | CSS Variable | Dark Theme (Default) | Light Theme (`html.light`) | Semantic Purpose & Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas** | `--nx-canvas` | `#0D1624` | `#F7F8FA` | Base page background |
| **Surface** | `--nx-surface` | `#121E2E` | `#FFFFFF` | Primary cards, modals, popovers, table bodies |
| **Secondary Surface / Subtle** | `--nx-subtle` | `#192A3E` | `#EDF2F6` | Input backgrounds, nested cards, table headers, hover rows |
| **Main Text (Ink)** | `--nx-ink` | `#F3F6FA` | `#101E30` | Headings, primary labels, table data, active values |
| **Supporting Text (Muted)** | `--nx-muted` | `#B3BFD0` | `#526174` | Descriptions, timestamps, secondary metadata, placeholders |
| **Border / Rule** | `--nx-rule` | `#34475D` | `#DCE3EB` | 1px clean architectural card borders, table dividers |
| **Link / Selection / Brand** | `--nx-blue` | `#8AB8FF` | `#0D51B2` | Hyperlinks, active tab indicator, active borders, brand mark |
| **Primary Action Button** | `--nx-button` | `#0D51B2` | `#0D51B2` | Main CTAs, submit buttons, primary triggers (always white text) |
| **Primary Button Hover** | `--nx-button-hover` | `#093F8D` | `#093F8D` | Darker sapphire on hover/interaction |
| **Positive / Emerald** | `--nx-green` | `#69D3B0` | `#007B58` | Approved status, APY, credit additions, verified tags |
| **Accent Soft** | `--nx-accent-soft` | `#1B304B` | `#EAF1FC` | Tinted pill badges, active row highlights, icon container backgrounds |
| **Danger / Rejected** | `--nx-danger` | `#FFACA9` | `#B52F38` | Rejected status, form errors, overdue alerts, delete triggers |
| **Danger Soft** | `--nx-danger-soft` | `#40262E` | `#FFEDEF` | Background for rejection tags and error banners |
| **Warning / Pending** | `--nx-warning` | `#F3CE87` | `#865600` | Pending approval, under review, draft status badges |
| **Warning Soft** | `--nx-warning-soft` | `#3B3222` | `#FFF3D9` | Background for pending approval pill tags |
| **Header** | `--nx-header` | `#0D1624` | `#FFFFFF` | Sticky navigation bar surface |
| **Easing Function** | `--nx-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | `cubic-bezier(0.22, 1, 0.36, 1)` | Universal smooth acceleration/deceleration curve |

### 2.2 Status Tags & Badges Specification

In both HRMS workflows and public pages, status badges adhere to high-contrast, rounded pills with distinct icon support:

1. **Approved / Active / Disbursed**:
   - Light: Background `#E6F7F1`, Text `#007B58`, Border 1px solid `rgba(0, 123, 88, 0.2)`
   - Dark: Background `#16382F`, Text `#69D3B0`, Border 1px solid `rgba(105, 211, 176, 0.3)`
   - Icon: `<CheckCircle size={14} weight="regular" />`

2. **Pending / Under Review / Submitted**:
   - Light: Background `#FFF8E6`, Text `#865600`, Border 1px solid `rgba(134, 86, 0, 0.2)`
   - Dark: Background `#3B3222`, Text `#F3CE87`, Border 1px solid `rgba(243, 206, 135, 0.3)`
   - Icon: `<Clock size={14} weight="regular" />`

3. **Rejected / Cancelled / Overdue**:
   - Light: Background `#FFEDEF`, Text `#B52F38`, Border 1px solid `rgba(181, 47, 56, 0.2)`
   - Dark: Background `#40262E`, Text `#FFACA9`, Border 1px solid `rgba(255, 172, 169, 0.3)`
   - Icon: `<XCircle size={14} weight="regular" />`

4. **Draft / Archived**:
   - Light: Background `#EDF2F6`, Text `#526174`, Border 1px solid `#DCE3EB`
   - Dark: Background `#192A3E`, Text `#B3BFD0`, Border 1px solid `#34475D`

---

## 3. Typography Hierarchy & Font Rules

### 3.1 Font Families

- **Display & Headings**: `Bricolage Grotesque`
  - Fallback: `Instrument Sans`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
  - Characteristics: Distinctive editorial personality, tight tracking, balanced geometry.
- **Body, UI Controls, Data Tables, & Labels**: `Instrument Sans` (or `DM Sans` fallback)
  - Characteristics: Clean legibility at micro sizes (11px–14px), balanced x-height.
- **Monetary & Numeric Figures**: `font-variant-numeric: tabular-nums;`
  - Mandatory for all Naira (`₦`) amounts, dates, tenure counters, and percentages to ensure columns align perfectly.

### 3.2 Type Scale & Weight Rules

Per `update/docs/DESIGN-SYSTEM.md` and `nexus-system.css`:
- **Heading weights**: Strict `500` (h2, h3) and `600` (h1, hero, page titles).
- **Controls & Emphasis**: `600`.
- **Body text**: `400`.
- **Prohibited weights**: Avoid `700`, `800`, or `900` bold weights.

| Element | Font Family | Size (Desktop / Mobile) | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title (H1)** | Bricolage Grotesque | `clamp(52px, 5.8vw, 80px)` / `44px` | 600 | 1.02 | `-0.055em` |
| **Page Title** | Bricolage Grotesque | `clamp(36px, 4.5vw, 64px)` / `36px` | 600 | 1.08 | `-0.05em` |
| **Section Title (H2)** | Bricolage Grotesque | `clamp(30px, 3.7vw, 50px)` / `30px` | 500 | 1.12 | `-0.04em` |
| **Card / Modal Title (H3)** | Bricolage Grotesque | `24px - 28px` / `20px` | 500 | 1.25 | `-0.035em` |
| **Subheadings (H4-H6)** | Instrument Sans | `16px - 18px` | 600 | 1.4 | `-0.02em` |
| **Lead Paragraph** | Instrument Sans | `17px - 18px` / `16px` | 400 | 1.65 | `normal` |
| **Body Regular** | Instrument Sans | `14px` / `15px` | 400 | 1.6 | `normal` |
| **Form Controls & Inputs** | Instrument Sans | `14px` (desktop), `16px` (mobile)* | 400/500 | 1.4 | `normal` |
| **Table Data Cells** | Instrument Sans (tabular-nums) | `13px - 14px` | 400/500 | 1.5 | `normal` |
| **Table Column Headers** | Instrument Sans | `11px` | 600 | 1.4 | `0.05em` (uppercase) |
| **Eyebrows & Micro-badges** | Instrument Sans | `10px - 11px` | 600 | 1.5 | `0.12em - 0.15em` (uppercase) |

*\* Note: Mobile inputs use minimum 16px font-size to prevent automatic iOS zoom on focus.*

---

## 4. Spacing, Geometry, Elevation & Layout

### 4.1 Spacing Rhythm (4px Base Increment)
- **4px / 8px / 12px / 16px / 20px / 24px / 32px / 48px / 64px / 88px**.
- **Container Max-Widths**:
  - Primary Content Container: `max-w-7xl` (`1344px`) with `48px` desktop padding (`px-12`), `32px` tablet padding (`px-8`), `20px` mobile padding (`px-5`).
  - Narrative / Form Container: `max-w-6xl` (`1248px`) or `max-w-3xl` (`768px`).
- **Vertical Section Padding**: `88px` on desktop (`py-24` modified by `.nx-app section.py-24`), reducing to `56px` on mobile.

### 4.2 Border Radiuses (Exact Standard)
- **Cards & Data Panels**: `12px` (`rounded-xl` / `border-radius: 12px;`).
- **Action Buttons & Form Controls**: `7px` (`border-radius: 7px;` per `nexus-system.css:42,63,298`).
- **Pills / Status Badges**: `9999px` (`rounded-full`).
- **Circular Icon Triggers & Avatars**: `50%` (`rounded-full`).
- **Signature Hero Visual Card**: Asymmetric radius `border-radius: 12px 12px 64px 12px;` (desktop) and `8px 8px 44px 8px;` (mobile).

### 4.3 Borders & Elevation
- **1px Clean Rule**: All cards, inputs, and tables use `1px solid var(--nx-rule)` without harsh multi-layer borders.
- **Elevation Shadows**: Restrained and subtle.
  - Standard Card Shadow: `box-shadow: 0 4px 18px -10px rgb(8 28 52 / 12%);`
  - Dropdown / Modal Shadow: `box-shadow: 0 18px 44px #001a3b14;`
- **Prohibition**: No neon glows, no colored blurry halos around cards or buttons.

---

## 5. Core App Motion Design Principles

Implementing the four core motion principles specified in `ORIGINAL_REQUEST.md` using `framer-motion` / `motion.dev`:

### 5.1 Micro-Interactions (Instant Feedback)
- **Button Hover**:
  - Background smoothly transitions from `--nx-button` (`#0D51B2`) to `--nx-button-hover` (`#093F8D`) over `0.2s`.
  - Nested directional icons (e.g., arrow `↗` or `→`) shift right by 3px: `transform: translateX(3px); transition: transform 0.25s var(--nx-ease);`.
- **Button Active / Tap**:
  - Haptic visual feedback: `transform: translateY(1px);` or `whileTap={{ scale: 0.98 }}`.
- **Focus Rings**:
  - Keyboard accessibility focus indicator: `outline: 3px solid var(--nx-blue); outline-offset: 4px;`.
  - Form field focus: `outline: 2px solid var(--nx-blue); outline-offset: 2px;`.

### 5.2 Contextual Transitions (Spatial Awareness)
- **Screen & Tab Transitions**:
  - Screens do not abruptly snap. They glide with subtle opacity and vertical translation:
    `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}` with duration `0.35s`.
- **Modal Dialogs**:
  - Backdrop fade: `opacity 0 -> 1` (`bg-black/80 backdrop-blur-md`).
  - Dialog scale: `initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}`.
- **Notification Drawer & Toast Alerts**:
  - Drop down from top with spring physics: `type: "spring", damping: 15, stiffness: 240`.

### 5.3 Natural Easing Curves
- Universal project easing curve:
  `--nx-ease: cubic-bezier(0.22, 1, 0.36, 1);` (Fast acceleration, organic deceleration).
- Avoid linear transitions (`ease-linear`) for visual layout elements.

### 5.4 Perceived Performance (Eliminating Blank States)
- **Skeleton Loaders**:
  - Subtle pulsing placeholder surfaces (`bg-subtle` with shimmer highlight) for table rows, cards, and profile data while queries load.
- **Optimistic State Updates**:
  - Instant toggle switches and form validation indicators before network payload roundtrips complete.
- **Reduced Motion Support (`prefers-reduced-motion: reduce`)**:
  - Automatically collapses animations to `0.01ms` duration and sets `scroll-behavior: auto !important` for vestibular comfort.

---

## 6. Comprehensive Screen & Component Inventory

Based on exhaustive inspection of all 97+ screenshots across the workspace and Desktop guide:

### 6.1 Global Shell & Navigation
1. **Fixed Header / Navbar**:
   - Height: `88px` (desktop), `76px` (tablet), `72px` (mobile).
   - Surface: `var(--nx-header)` with bottom 1px border `var(--nx-rule)`.
   - Left: Nexus Finance mark + wordmark (dark/light adaptive).
   - Center Navigation Links:
     - Home (active state: sapphire text + bottom line indicator).
     - Who We Are (dropdown trigger with chevron).
     - Products (dropdown trigger with chevron).
     - Loan Calculator (anchor scroll trigger).
     - Contact (anchor scroll trigger).
   - Right Action Group:
     - Theme Toggle circular button (sun/moon Phosphor icons).
     - "Apply now ↗" primary button (`bg-action`, white text, 7px corners).
     - Mobile menu trigger button (`☰` Phosphor `List` icon, 40x40px).

2. **Dropdown Popover Panels**:
   - **"Who We Are" Dropdown**:
     - 6 items: About Us (ShieldCheck), Leadership Team (Users), Blog & News (Newspaper), Gallery (ImageIcon), Careers (Briefcase), Institutional Partners (Bank).
     - Item layout: Icon in subtle container, bold title (14px), subtitle description (11px muted), hover background `var(--nx-subtle)`.
   - **"Products" Dropdown**:
     - Category Eyebrow: "CORE CREDIT FACILITIES".
     - Items: Suremoney Loan (tag: "15 Mins"), Nexus Credit (tag: "Remita"), Car-for-Cash (tag: "2hr Disbursal"), Travel Financing, Women Empowerment (NWEL), Shop-Owned Loan, Invoice Discounting, Gold-for-Cash, Fixed Deposit Vaults (tag: "15.5% APY").
     - 1px divider between personal loans and commercial/investment products.

3. **Mobile Drawer Navigation**:
   - Slide-in panel occupying `100dvh - 72px`.
   - Stacked accordions (`<details> / <summary>`) for nested product categories.
   - Large touch targets (minimum 48px height) with bottom rules.

### 6.2 Public Portal Sections
1. **Hero Section**:
   - Topline status: Category indicator + "NIBSS Interbank Realtime".
   - Split grid: Left copy (eyebrow with green horizontal rule, H1 heading with sapphire keyword, description, primary CTA + text link, 3 green-check benefit badges); Right signature image with `12px 12px 64px 12px` rounded corner and category watermark.
   - Hero Slider Controls: Slide tabs (01, 02, 03) with active border and next/prev circular icon buttons.

2. **Trust Marquee / Institutional Partner Strip**:
   - Full-width band with top and bottom borders.
   - Header with left/right carousel buttons.
   - Horizontal snap list of partner institutions:
     - Nigeria Police Force
     - EFCC (Economic and Financial Crimes Commission)
     - NDLEA (National Drug Law Enforcement Agency)
     - NSCDC (Civil Defence)
     - Federal MDAs & Ministries

3. **Prompt Liquidity / 15-Minute Disbursal Showcase**:
   - Headline: "Prompt liquidity. Disbursed in 15 minutes flat."
   - 3 proof cards: Algorithmic decisioning (<3 mins), Direct NIBSS rail, Live SMS/in-app alert.
   - Interactive Phone Simulation: Realistic iPhone frame with Dynamic Island, live push notification dropping down ("Direct Credit Alert: ₦1,500,000.00"), real-time balance counter incrementing from ₦1.24M to ₦2.74M, and transaction activity list.

4. **Product Bento Grid**:
   - Multi-column card layout displaying 8 core financial products.
   - Feature card: Full-bleed photo, gradient overlay, bottom facts, and "Explore Facility ↗" link.

5. **Interactive Loan & Investment Calculator**:
   - Mode Switcher Pill: "Loan & Credit Facilities" vs "High-Yield Fixed Deposit (Up to 15.5%)".
   - Left Controls Panel:
     - 1. Facility grid: 8 selectable facility buttons with turnaround tags.
     - 2. Amount Input: Direct numeric input field with `₦` prefix and smooth range slider (`₦100K` to `₦10M` or `₦50M`).
     - Quick amount pill buttons: `₦0.5M`, `₦1M`, `₦2.5M`, `₦5M`, `₦10M`.
     - 3. Tenure selector: Radio buttons / pill buttons (1 Month, 3 Months, 6 Months, 12 Months).
   - Right Estimated Schedule Panel:
     - Highlight card showing "Estimated Monthly Installment" in display type (`₦1,050,000/mo`).
     - Breakdown table: Principal, Monthly Interest Rate (green), Upfront Processing Fee, Total Interest.
     - Primary Action: "Apply for [Amount] ↗".

6. **Executive Leadership Section**:
   - 5 Executive Dossier Cards:
     1. Henrietta Okolo (Managing Director & CEO)
     2. David Nwokeukwu (Chief Risk Officer - CRO)
     3. Oluwatosin Ogunleye (Chief Service Officer - CSO)
     4. Immanuel Igomu (Group Head IT & Innovation)
     5. Abu Muritala (Head Recovery & Remediation)
   - Clickable full portrait cards opening comprehensive Executive Dossier Modal with credentials, prior institutions (GTBank, Access Bank, Fidelity), and keyboard navigation.

7. **Testimonial Slider & Live Ticking Yield**:
   - Customer quote cards with real member photos, verified institutional tags, and star ratings.
   - Real-time ticking counter showing micro-accrued yield (`+₦0.000412` per interval).

8. **Contact & Headquarters Section**:
   - Left: NICON Insurance Building office details, direct phone (`+234 809 121 2224`), WhatsApp link, operating hours (Mon-Fri 8am-5pm WAT).
   - Right: Contact inquiry form with topic selector, name, phone, message inputs, and submit button.
   - Embedded Google Map with theme-aware invert filter in dark mode.

9. **Global Footer**:
   - 4-column link layout: Products, Company, Legal & Compliance, Office Contact.
   - Cooperative registration disclosure text, copyright notice, back-to-top button.

### 6.3 Shared Modals & Dialogs
1. **ApplyModal (Fast-Track Loan Application)**:
   - 4-step wizard:
     - Step 1: Facility selection grid.
     - Step 2: Amount slider and tenure selection.
     - Step 3: Applicant details (Full name, phone, email, organization/ministry, BVN, NIN).
     - Step 4: Submission confirmation with generated reference ID (`NX-2026-XXXXX`).
   - Accessible keyboard focus trap (`useDialogFocus`), ESC key handling, backdrop click dismiss.

2. **JobApplyModal**:
   - Target position header, department badge, location badge.
   - Form inputs: Full Name, Email, Phone, LinkedIn URL, Resume upload link, Cover note.
   - Submission state with checkmark icon and Human Capital acknowledgment.

3. **Advisory VIP Desk Modal**:
   - One-tap Phone call and WhatsApp triggers.
   - Briefing request form for corporate loan consultation.

---

## 7. Reverse-Engineered HRMS & Expense Modules (Zoho People Replication)

To fulfill **R4 (Functional HRMS & Expense Modules)** following first principles, the Zoho People capability suite is mapped 1:1 onto the Nexus Finance design system:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXUS HRMS & EXPENSE SUITE                      │
├───────────────┬─────────────────┬─────────────────┬────────────────────┤
│ Staff Portal  │ Leave Mgmt      │ Expense System  │ Appraisals & Admin │
│ (Self-Service)│ (Workflows)     │ (Claims & Audit)│ (Performance/RBAC) │
└───────────────┴─────────────────┴─────────────────┴────────────────────┘
```

### 7.1 Module 1: Staff Portal (Employee Self-Service - ESS)
- **Top Summary Card**:
  - Employee Portrait avatar (circular 64px, with online presence dot).
  - Employee details: Full Name, Staff ID (`NX-EMP-0142`), Designation, Department, Reporting Manager, Work Location (Abuja Head Office).
  - Quick Action Buttons: "Apply Leave", "File Expense", "Clock In/Out", "Download Payslip".
- **Metric Cards (3-column grid)**:
  1. *Available Leave Balance*: Days remaining with breakdown link.
  2. *Expense Reimbursed YTD*: Total approved/paid claims (`₦X,XXX,XXX.00`).
  3. *Appraisal Status*: Current review cycle stage with progress indicator.
- **Attendance & Time Tracking Widget**:
  - Live clock display (WAT).
  - Check-in / Check-out button (green when clocked out, red when active).
  - Weekly attendance punch-card timeline (On Time, Late, WFH).
- **Recent Announcements & Team Notices**:
  - Pinned executive circulars from HR desk.

### 7.2 Module 2: Leave Management System
- **Leave Balance Overview**:
  - 4 cards:
    - Annual Leave (e.g., 18/24 Days)
    - Sick / Medical Leave (e.g., 10/12 Days)
    - Casual / Emergency Leave (e.g., 3/5 Days)
    - Paternity / Maternity / Study Leave (e.g., As applicable)
  - Visual progress bar for quota utilization (`bg-action`).
- **Leave Application Drawer / Modal**:
  - Form Fields:
    - Leave Type dropdown (Annual, Sick, Casual, Compassionate).
    - Date Range picker: Start date, End date, Half-Day toggle (First half / Second half).
    - Calculated total working days (excluding weekends and official Nigerian public holidays).
    - Relief Officer / Handover Colleague dropdown.
    - Reason for Leave textarea.
    - Medical certificate / supporting document upload zone.
- **Leave History & Approvals Table**:
  - Columns: Request ID, Leave Type, Duration, Total Days, Relief Staff, Status (Approved [Green], Pending [Amber], Rejected [Red]), Action buttons (View Details, Withdraw).
- **Manager Approval Workflow Console**:
  - Filter by department, pending status.
  - Approve button (`bg-action`), Reject button (`border-rule text-danger`), Comments modal.

### 7.3 Module 3: Expense System & Reimbursement
- **Expense Filing Drawer / Modal**:
  - Form Fields:
    - Claim Title (e.g., "Abuja-Kano Regional Command Audit Transit").
    - Category dropdown:
      - Travel & Transit (Flights, Inter-state logistics)
      - Fuel & Fleet Maintenance
      - Meals & Client Hospitality
      - Office Equipment & Consumables
      - Telecom & Data Subscriptions
      - Regulatory / Filing Fees
    - Date of Expense (date picker).
    - Amount (`₦` currency prefix with tabular formatting).
    - Merchant / Vendor Name.
    - Receipt Document Attachment (Drag-and-drop file upload with preview thumbnail).
    - Tax / VAT Inclusive checkbox.
    - Project / Department Allocation dropdown.
    - Business Justification narrative textarea.
- **Expense Claims Management Table**:
  - Columns: Claim ID (`EXP-2026-0089`), Date Incurred, Category (with icon), Merchant, Amount (`₦`), Receipt Preview icon, Approval Pipeline Status:
    - Stage 1: `Submitted` (Pending Manager Review)
    - Stage 2: `Manager Approved` (Forwarded to Finance)
    - Stage 3: `Finance Verified` (Queued for Disbursal)
    - Stage 4: `Disbursed` (Settled via NIBSS)
    - Stage 5: `Rejected` (With approver audit note)
- **Expense Analytics Summary**:
  - Monthly spending by category horizontal progress bars.
  - Departmental budget utilization meter.

### 7.4 Module 4: Performance Appraisals & Reviews
- **Review Cycle Management**:
  - Active review cycle card (e.g., "Q4 2026 Institutional Performance Review").
  - 4-stage pipeline stepper:
    `Self Evaluation` ➔ `Manager Appraisal` ➔ `HR Calibration` ➔ `Signoff & Scorecard Release`.
- **Self-Evaluation & KPI Form**:
  - Evaluation criteria with 1–5 rating scales:
    1. Operational Excellence & Execution
    2. Regulatory Compliance & Risk Management
    3. Innovation & Process Improvement
    4. Client Satisfaction & Team Collaboration
  - Goal attainment narrative: Key milestones achieved, challenges encountered.
  - Professional development & training aspirations.
- **Manager Assessment Console**:
  - Manager rating score input, qualitative assessment remarks.
  - Promotion / Increment recommendation dropdown (Eligible, Under Review, Retain Current Band).
- **Historical Appraisal Dossiers**:
  - Tabular list of past appraisal cycles, final composite ratings, performance tier badges:
    - `Exceeds Expectations` (Emerald green badge)
    - `Strong Performer` (Sapphire blue badge)
    - `Meets Expectations` (Subtle muted badge)
    - `Needs Improvement` (Warning amber badge)

### 7.5 Module 5: Administration & Role-Based Access Control (RBAC)
- **Employee Directory**:
  - Search bar by name, staff ID, department.
  - View toggle: Data Table vs Card Grid.
  - Columns: Staff Name + Avatar, ID, Department, Job Title, Employment Type, Status (Active / On Leave / Terminated), Actions (Edit, Permissions, Deactivate).
- **Add / Edit Employee Modal**:
  - Step 1: Personal & Contact Information.
  - Step 2: Job Role, Department, Reporting Line, Work Station.
  - Step 3: Salary structure, Bank account details for payroll/expense disallowance.
  - Step 4: System Role assignment.
- **Role-Based Access Control (RBAC) Matrix**:
  - Defined Roles:
    1. **Master Admin**: Full platform configuration, user provisioning, global overrides, audit log export.
    2. **HR Manager**: Leave approvals, appraisal cycle setup, employee record maintenance.
    3. **Finance Officer**: Expense claim audit, budget limits, NIBSS batch reimbursement.
    4. **Team Lead / Supervisor**: Departmental leave approval, direct report appraisal scoring.
    5. **Staff Member**: Self-service profile, personal leave filing, expense claim submission.
  - Granular Permissions Table: Matrix with checkboxes for `View`, `Create`, `Edit`, `Approve`, `Delete`.
- **Security & Audit Log**:
  - Immutable event log table: Timestamp (UTC/WAT), Actor (User ID + IP), Event Type (e.g., `EXPENSE_APPROVED`, `LEAVE_REJECTED`, `ROLE_CHANGED`), Resource ID, Description.

---

## 8. Tailwind CSS Configuration & Styling Snippet

To ensure 100% layout and visual fidelity across the application, the Tailwind configuration maps the Nexus design system tokens:

```typescript
// tailwind.config.ts / @theme configuration
export default {
  theme: {
    extend: {
      colors: {
        canvas: 'var(--nx-canvas)',
        surface: 'var(--nx-surface)',
        subtle: 'var(--nx-subtle)',
        ink: 'var(--nx-ink)',
        muted: 'var(--nx-muted)',
        rule: 'var(--nx-rule)',
        brand: 'var(--nx-blue)',
        action: {
          DEFAULT: 'var(--nx-button)',
          hover: 'var(--nx-button-hover)',
        },
        'on-action': '#ffffff',
        'accent-soft': 'var(--nx-accent-soft)',
        success: 'var(--nx-green)',
        danger: {
          DEFAULT: 'var(--nx-danger)',
          soft: 'var(--nx-danger-soft)',
        },
        warning: {
          DEFAULT: 'var(--nx-warning)',
          soft: 'var(--nx-warning-soft)',
        },
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"Instrument Sans"', '"DM Sans"', '-apple-system', 'sans-serif'],
        mono: ['"Instrument Sans"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '7px',
        btn: '7px',
        input: '7px',
        card: '12px',
      },
      boxShadow: {
        subtle: '0 4px 18px -10px rgb(8 28 52 / 12%)',
        dropdown: '0 18px 44px #001a3b14',
      },
      transitionTimingFunction: {
        'nx-ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
};
```

---

## 9. Conclusion & Downstream Blueprint

This survey establishes the complete blueprint for replicating Nexus Finance and reverse-engineering the Zoho People HRMS suite:
1. **Visual System Integrity**: Use the Sapphire, Ink, Porcelain, and Restrained Emerald palette. Never reintroduce neon greens or blurs.
2. **Typography**: Enforce `Bricolage Grotesque` for headings, `Instrument Sans` for body/controls, and `tabular-nums` for all currency amounts.
3. **Motion Design**: Integrate `framer-motion` using `--nx-ease: cubic-bezier(0.22, 1, 0.36, 1)`, snappy micro-interactions, modal scale/fade, and skeleton loaders.
4. **Zoho People Core Modules**: Implement Staff Portal, Leave Management, Expense System, Appraisals, and Administration using these exact cards, tables, drawers, and status tags.
