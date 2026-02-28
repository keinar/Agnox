# SPRINT 11 — Layered Defense Testing Strategy (Suite A)

## 🎯 Sprint Goal
Establish a robust, multi-layered testing architecture to definitively verify security boundaries, Role-Based Access Control (RBAC), and multi-tenant data isolation across the platform.

---

## 📋 Task Breakdown

### [x] Task 11.1: E2E UI Testing (Playwright) ✅
**Goal:** Verify component visibility and route protection based on authenticated roles.
- **Action:** Created `tests/pages/MembersPage.ts` Page Object Model.
- **Action:** Implemented tests for execution deletion boundaries (Viewer role) and Admin demotion prevention.
- **Action:** Migrated from mocked API authentication to real UI-driven `storageState` persistence.

### [x] Task 11.2: API Integration Testing (Vitest + Supertest) ✅
**Goal:** Mathematically prove multi-tenant isolation and HTTP-level role enforcement.
- **Action:** Established the `MongoMemoryServer` integration pattern for rapid, perfectly isolated backend testing.
- **Action:** Implemented Test A-005 (Cross-Tenant Execution Access Is Denied - 404).
- **Action:** Implemented Test A-006 (Viewer Cannot Delete Executions - 403).
- **Action:** Implemented Test A-007 (Non-Admin Cannot Change Roles - 403).
- **Action:** Implemented Test A-008 (Admin Cannot Demote Last Admin - 403).

### [x] Task 11.3: Security & Rate Limiting Verification ✅
**Goal:** Prevent brute-force attacks and validate Redis-backed defensive mechanisms.
- **Action:** Fully mocked `ioredis` state in memory to deterministically test time-based lockouts.
- **Action:** Implemented Test A-004 to verify 429 Too Many Requests response after 5 failed login attempts.

### [x] Task 11.4: Testing Strategy Documentation ✅
**Goal:** Formalize the testing architecture.
- **Action:** Created `docs/testing/strategy.md` outlining the 3 layers (Unit, API Integration, E2E).
- **Action:** Linked strategy document from main `README.md`.

---

# SPRINT 10 — PDF Reporting & Automation Infrastructure

## 🎯 Sprint Goal
Deliver exportable PDF test reports for cycles and executions, and harden the automation infrastructure by eliminating all remaining manual version synchronisation points across the monorepo.

---

## 📋 Task Breakdown

### [x] Task 10.1: PDF Cycle Report Generation (Backend) ✅ — Substituted
**Goal:** Generate a downloadable PDF summary for a completed test cycle.
- **Implemented as:** Live HTML report page (`CycleReportPage.tsx`) with browser-native print-to-PDF. No backend PDF library required — the frontend route handles generation via `window.print()` with `@media print` CSS. Cycle data is fetched from the existing `GET /api/test-cycles/:cycleId` endpoint.

### [x] Task 10.2: PDF Download UI (Frontend) ✅ — Substituted
**Goal:** Surface the PDF export as a one-click button inside the Test Cycles page.
- **Implemented as:** "View Report" button in the cycle row opens `CycleReportPage.tsx`. A "Print Report" button within that page triggers the browser print dialog, enabling save-as-PDF from any browser without a blob download flow.

### [x] Task 10.3: Automated Version Infrastructure ✅
**Goal:** Eliminate the hardcoded `APP_VERSION` constant so the UI always reflects the root `package.json` version without manual intervention.
- **Action:** Updated `vite.config.ts` to read root `package.json` via `fs.readFileSync` and inject `__APP_VERSION__` via Vite `define`.
- **Action:** Replaced hardcoded string in `apps/dashboard-client/src/config/version.ts` with a Vite-injected build constant.
- **Action:** Created `VersionDisplay.tsx` — a single-responsibility component that reads the injected version and renders it with `gh-*` muted styling.
- **Action:** Updated `Sidebar.tsx` to use `<VersionDisplay />` in both desktop and mobile version footers.
- **Action:** Updated `ChangelogModal.tsx` with the `v3.1.0` release entry.
- **Action:** Bumped root `package.json` to `3.1.0` and prepended the `[3.1.0]` entry to `CHANGELOG.md`.

---

# SPRINT 9 — Quality Hub: Manual Testing & Hybrid Cycles

## 🎯 Sprint Goal
Transform the agnox from a pure execution engine into a comprehensive Test Management System (TMS). We will introduce manual test case repositories, AI-assisted test generation, and "Hybrid Cycles" that consolidate automated and manual test results into a single, unified report.

---

## 📋 Task Breakdown

### [x] Task 9.1: Data Schema Evolution (MongoDB Foundation) ✅
**Goal:** Expand the database to support manual tests and hybrid cycles.
- **Action:** Created raw MongoDB collection definitions and TypeScript interfaces for `test_cases` (type: MANUAL | AUTOMATED, includes `steps` array for manual).
- **Action:** Created `test_cycles` collection schema (aggregating multiple test items under one cycle ID with `items` array and `summary` stats).
- **Action:** Implemented CRUD API routes in the Producer service (`test-cases.ts`, `test-cycles.ts`) with validation, Gemini AI integration, and rate limiting.

### [x] Task 9.2: Manual Test Management Screen ✅
**Goal:** Built a dedicated repository view for manual tests.
- **Action:** Created the `TestCases.tsx` page listing all manual tests grouped by suite with accordions.
- **Action:** Built `TestCaseDrawer.tsx` — a Headless UI creation/edit side drawer.
- **Action:** **AI Integration:** Added "Generate with AI" button in the drawer that Gemini generates the structured JSON array of test steps from a natural-language intent.

### [x] Task 9.3: The Hybrid Cycle Builder UI ✅
**Goal:** Allow users to package manual and automated tests into executable cycles.
- **Action:** Created `CycleBuilderDrawer.tsx` — suite-grouped checkbox selection for manual tests + automated test section.
- **Action:** Implemented multi-select interface with suite-level "select all" and individual test case checkboxes.
- **Action:** "Launch Cycle" button creates the `TestCycle` document and pushes AUTOMATED items to RabbitMQ with `cycleId` + `cycleItemId` linkage.

### [x] Task 9.4: Manual Execution Player (In-Drawer) ✅
**Goal:** The interactive checklist for QA engineers during a cycle.
- **Action:** Created `ManualExecutionDrawer.tsx` — step-by-step interactive player with Pass/Fail/Skip per step, progress bar, auto-advance.
- **Action:** Worker forwards `cycleId`/`cycleItemId` in execution callbacks; Producer syncs cycle item status on terminal results.
- **Action:** Added `PUT /api/test-cycles/:cycleId/items/:itemId` endpoint for manual results. Cycles auto-complete when all items reach terminal state.

### [x] Task 9.5: Consolidated Cycle Report & UX Polish ✅
**Goal:** Deliver the executive summary view.
- **Action:** Built `CycleReportPage.tsx` — a dedicated live HTML report page with stat cards (total, passed, failed, automation rate), expandable item list with status badges, and full browser-print optimization (`@media print` forces manual steps visible, high-contrast badges for PDF export).
- **Note:** Implemented as a live, browser-printable HTML page rather than the originally planned "Dual Progress Bar" UI. Print-to-PDF workflow replaces the backend PDF generation requirement from the sprint brief.

## Archive / Completed Sprints

# SPRINT 1-3 — Security Hardening Phase

## 🎯 Phase Goal
Remediate all CRITICAL and HIGH findings identified in the February 2026 security audit to achieve an enterprise-grade security posture without breaking runtime contracts.

---

## 📋 Task Breakdown

### [x] Sprint 1: Critical Fixes ✅
**Goal:** Stop active exploitation vectors.
- **Action:** Rotated MongoDB Atlas password, Gemini API key, and admin credentials. Purged `.env.server` from git history.
- **Action:** Implemented internal auth handshake (`PLATFORM_WORKER_CALLBACK_SECRET`) for worker callbacks, eliminating cross-tenant IDOR.
- **Action:** Applied the "Platform Prefix" strategy (`PLATFORM_*`) to prevent infrastructure secrets from being injected into test containers.
- **Action:** Added RabbitMQ Zod schema validation and Docker `HostConfig` security limits.
- **Action:** Fixed `FATAL ERROR` resolution logic to correctly mark crashed containers as `FAILED`.

### [x] Sprint 2: High Severity Hardening ✅
**Goal:** Eliminate SSRF vectors, command injection, and unauthenticated data leakage.
- **Action:** Implemented short-lived HMAC-signed URL tokens for serving static test reports securely.
- **Action:** Added regex validation to Jira domain input to prevent SSRF.
- **Action:** Added strict URL validation and AES-256-GCM encryption for storing Slack webhook URLs.
- **Action:** Hardened Jira custom fields integration to prevent payload injection.
- **Action:** Replaced `execSync` with `execFileSync` to eliminate shell interpolation vulnerabilities.

### [x] Sprint 3: Defence in Depth ✅
**Goal:** Harden the authentication layer and close remaining findings.
- **Action:** Implemented a Redis-based JWT revocation blacklist on user logout.
- **Action:** Pinned JWT algorithm strictly to `HS256`.
- **Action:** Redacted JWT secret values from startup logs.
- **Action:** Ran database migration to encrypt all legacy plaintext Slack webhook URLs.
- **Action:** Upgraded API keys to use `HMAC-SHA256` hashing.
- **Action:** Ensured strict `projectId` and `organizationId` boundaries.
- **Action:** General HTTP hardening (CSP, HSTS preload).

# SPRINT 7 — The Investigation Hub (V3 Architecture)

## 🎯 Sprint Goal
Transform the debugging and triage experience by consolidating logs, AI analysis, and test artifacts into a unified Side Drawer. 

**Execution Strategy:** We are splitting this into Phase 7A (Core Drawer & Text) and Phase 7B (Artifacts Pipeline) to mitigate backend storage blockers.

---

## 🛠️ PHASE 7A: Drawer, Terminal & AI

### [x] Task 7.1: Overlay Drawer Architecture & URL State ✅
**Goal:** Build the slide-over shell with deep-linking support.
- **Action:** Create `ExecutionDrawer.tsx` utilizing `@headlessui/react` `Dialog`. This IS intended to be a modal overlay (with a backdrop) that slides in from the right, taking ~60% width on desktop.
- **Action:** State Management MUST use URL search parameters (e.g., `?drawerId=<taskId>`) via React Router's `useSearchParams`. This enables sharing direct links to specific execution failures.
- **Action:** Implement a 3-tab header: "Terminal", "Artifacts", and "AI Analysis".
- **Notes for Claude:** The semantic tokens `gh-bg-dark`, `gh-border-dark`, etc., ARE already configured in `tailwind.config.js`. Use them confidently.

### [x] Task 7.2: The Live Terminal Tab ✅
**Goal:** Port existing real-time logging into the Drawer.
- **Action:** Move the existing `TerminalView` into the first tab of the Drawer.
- **Action:** Ensure Socket.io events (`execution-log`, `execution-updated`) correctly target the active `drawerId`.
- **Action:** Add utility controls: "Auto-scroll to bottom" toggle, and "Download Logs" button (.txt export).

### [x] Task 7.3: AI Analysis Integration & UI Cleanup ✅
**Goal:** Move the AI diagnosis out of the blocking modal and clean up the list.
- **Action:** Refactor `AIAnalysisView.tsx` to render as the third tab inside the Drawer.
- **Action:** Remove the old inline Accordion logs from `ExecutionRow.tsx`. The main Execution List must be perfectly flat. Clicking a row sets the `drawerId` URL param.

---

## 📦 PHASE 7B: Artifacts Pipeline (Media Gallery)

### [x] Task 7.4-PRE: Artifact Storage Audit ✅
**Goal:** Confirm backend readiness for serving images/videos.
- **Action:** Analyze `apps/worker-service/src/worker.ts` and `docker-compose.yml` to understand exactly how test-results (png, webm, zip) are extracted and shared with `producer-service`.
- **Checkpoint:** Do not proceed to 7.5 until the storage and transfer mechanism for media files is confirmed and documented.

### [x] Task 7.5: Artifacts API & Gallery UI ✅
**Goal:** Serve and display test media.
- **Action (Backend):** Create `GET /api/executions/:taskId/artifacts` in Producer to list available media files.
- **Action (Frontend):** Build `ArtifactsView.tsx` in the second tab. Fetch the list via TanStack Query and display a CSS Grid gallery for images/videos, and download links for traces/zips.

# Sprint 6 — UI/UX Polish & Theming

> **Last updated:** 2026-02-21
> **Branch:** `epic/v3-redesign`
> **Status:** ✅ **SPRINT 6 — 100% COMPLETE** (Tasks 6.1–6.9 all done)
> **Status legend:** ✅ Done · 🔄 In Progress · ⬜ Pending

---

## Design Vision

The goal is to move from a "functional tool with neon/purple gradients" to a **professional, enterprise-grade** product. The reference aesthetic is GitHub / Vercel:

| Principle | Description |
|-----------|-------------|
| **High Contrast** | Crisp `#0d1117`-style darks, pure `#ffffff` backgrounds in light mode |
| **Blue, not Purple** | Active/accent states use `blue-600`, never `indigo-500`/`purple-600` |
| **Typography-first** | `font-semibold` for labels, `font-medium` for data, `font-mono` for IDs & times |
| **Subtle Motion** | 200–300ms ease transitions only — no bouncy animations |
| **Dark/Light parity** | Every surface has a tested `dark:` counterpart |

---

## Pre-flight Audit

### Known State (from codebase scan)
- **Tailwind is already installed** (`tailwindcss@^3.4.19` in devDependencies). ✅
- **`tailwind.config.js`** already sets `darkMode: 'class'` and defines custom `slide-down`, `slide-up`, `fade-in` animations. ✅
- **`index.css`** already has `@tailwind base/components/utilities` directives. ✅
- **`App.css`** (323 lines of legacy CSS variables and component classes) is still imported — this conflicts with Tailwind and must be eliminated.
- **Purple/indigo gradient** (`from-indigo-500 to-purple-600`) is the current brand. Must be replaced.
- **No `ThemeContext`** exists anywhere in the codebase.
- **Sidebar collapse toggle** lives at the bottom (`collapseButton` in `Sidebar.tsx:103–113`). Must move to header.
- **Logo** is currently a hardcoded `<div>AAC</div>` text block in `Sidebar.tsx:34–49`. The new `logo-full.png` asset is at `src/assets/logo-full.png`.

### Files That Will Change

| File | Change Type |
|------|-------------|
| `src/context/ThemeContext.tsx` | **New** — theme engine |
| `src/App.tsx` | Wrap with `<ThemeProvider>`, remove `App.css` import |
| `src/App.css` | **Delete** (all rules migrated or no longer needed) |
| `src/index.css` | Add Google Fonts import for Inter + Fira Code |
| `tailwind.config.js` | Extend palette with GitHub-inspired `gh-*` token colors |
| `src/components/AppLayout.tsx` | Dark mode base classes |
| `src/components/Sidebar.tsx` | Logo, collapse toggle position, GitHub palette, dark: classes |
| `src/components/dashboard/DashboardHeader.tsx` | Collapse toggle slot, theme toggle button, dark: classes |
| `src/components/dashboard/ExecutionList.tsx` | Table header polish, dark: classes |
| `src/components/ExecutionRow.tsx` | Row spacing, font weights, dark: classes |
| `src/components/GroupHeaderRow.tsx` | Expansion transition, dark: classes |
| `src/components/StatsGrid.tsx` | Dark: classes, remove any purple |
| `src/components/FilterBar.tsx` | Dark: classes, blue active state |
| `src/components/Pagination.tsx` | Dark: classes |
| `src/components/BulkActionsBar.tsx` | Dark: classes |
| `src/pages/Login.tsx` | Remove inline styles → Tailwind + dark: |
| `src/pages/Signup.tsx` | Remove inline styles → Tailwind + dark: |
| `src/pages/Settings.tsx` | Dark: classes |

---

## Task 6.1 — Asset & Layout Refactor ⬜

### 6.1.1 — Logo Integration

**File:** `src/components/Sidebar.tsx`

**Current state:** The logo block is a gradient `<div>` containing the text "AAC".

**Target state:**
- Import `logoFull` from `'../assets/logo-full.png'`
- Wrap it in a `<Link to="/dashboard">` from `react-router-dom`
- **Expanded state:** Show `<img src={logoFull} alt="Agnox" className="h-8 w-auto object-contain" />`
- **Collapsed state:** Show a 32×32 favicon-style version (crop or use first 32px of the logo image). Use `<img src={logoFull} className="h-7 w-7 object-cover object-left" />` as a fallback until a separate icon asset is provided.
- Remove the `user.organizationName` sub-label from the logo block entirely (it will be shown in the header).

### 6.1.2 — Sidebar Collapse Toggle → Header

**Current state:** Collapse toggle (`ChevronLeft/ChevronRight`) is at the bottom of the sidebar in `collapseButton`.

**Target state:**
- Remove the `collapseButton` from the bottom of `Sidebar.tsx` entirely.
- The `isCollapsed` state and `toggle` function must be **lifted up** to `AppLayout.tsx` as shared state.
- Pass `isCollapsed` and `onToggle` as props to both `Sidebar` and `DashboardHeader`.
- In `DashboardHeader.tsx`, add a desktop-only (`hidden md:flex`) `<button>` on the far left that renders `<PanelLeft size={20} />` (Lucide icon for sidebar toggle). This is positioned before the desktop spacer `<div className="flex-1" />`.

**Prop interface changes:**
```typescript
// Sidebar.tsx
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

// DashboardHeader.tsx
interface DashboardHeaderProps {
  user: User | null;
  onLogout: () => void;
  onMobileMenuToggle: () => void;
  onSidebarToggle: () => void;  // NEW
}
```

**`AppLayout.tsx` state:**
```typescript
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
  () => localStorage.getItem('aac:sidebar-collapsed') === 'true',
);
const toggleSidebar = useCallback(() => {
  setIsSidebarCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem('aac:sidebar-collapsed', String(next));
    return next;
  });
}, []);
```

### Acceptance Criteria — 6.1
- [ ] Clicking the logo navigates to `/dashboard` without a page reload.
- [ ] Collapsed sidebar shows only the logo image cropped, not text.
- [ ] The bottom collapse toggle is gone from the sidebar.
- [ ] A `PanelLeft` button appears in the top header on desktop (≥768px), triggers the same toggle.
- [ ] Mobile hamburger is unchanged.
- [ ] `localStorage` key `aac:sidebar-collapsed` still persists correctly.

---

## Task 6.2 — Theme Engine ⬜

### 6.2.1 — `ThemeContext`

**New file:** `src/context/ThemeContext.tsx`

```typescript
// Interface (for reference — do not copy blindly, write proper implementation)
type Theme = 'light' | 'dark';
interface IThemeContext {
  theme: Theme;
  toggleTheme: () => void;
}
```

**Behavior:**
1. On mount: read `localStorage.getItem('aac:theme')`. Default to `'light'` if not set.
2. Apply the theme immediately by adding/removing the `dark` class on `document.documentElement`.
3. On `toggleTheme()`: flip the theme, persist to localStorage, update the DOM class.
4. Export: `ThemeProvider`, `useTheme`.

### 6.2.2 — Wire into `App.tsx`

- Remove `import './App.css'` from `App.tsx`.
- Wrap the app tree with `<ThemeProvider>` as the outermost provider (above `QueryClientProvider` and `AuthProvider`).
- Confirm `index.css` has the Google Fonts import (add it if `App.css` was the source).

### 6.2.3 — Theme Toggle UI

**File:** `src/components/dashboard/DashboardHeader.tsx`

- Import `useTheme` from `ThemeContext`.
- Import `Sun`, `Moon` from `lucide-react`.
- Add a toggle button between the sidebar toggle and the user section:
  - Renders `<Moon size={18} />` when theme is `'light'`, `<Sun size={18} />` when theme is `'dark'`.
  - Classes: `flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors duration-150`

### Acceptance Criteria — 6.2
- [ ] Toggle switches between light and dark on click.
- [ ] `dark` class is present on `<html>` in dark mode, absent in light mode.
- [ ] Preference survives a full page reload.
- [ ] Sun/Moon icon reflects current state correctly.
- [ ] No flash of wrong theme on initial load (read from localStorage before first paint).

---

## Task 6.3 — "GitHub Style" Palette Update ⬜

### 6.3.1 — Tailwind Config Extension

**File:** `tailwind.config.js`

Extend the theme with GitHub-inspired semantic tokens. These supplement (not replace) Tailwind's built-in `slate`/`blue` scale:

```javascript
// Add to theme.extend.colors:
canvas: {
  default:  '#ffffff',      // light page bg
  subtle:   '#f6f8fa',      // light sidebar/card bg
  inset:    '#f0f3f6',      // table row hover (light)
},
gh: {
  border:    '#d0d7de',     // light border
  shadow:    '#8c959f',     // muted text (light)
  fg:        '#1f2328',     // primary text (light)
  'fg-muted':'#636c76',     // secondary text (light)
  accent:    '#0969da',     // link / active blue (light)
  success:   '#1a7f37',     // passed (light)
  danger:    '#cf222e',     // failed / error (light)
  warning:   '#9a6700',     // unstable (light)
},
```

Dark mode equivalents are handled via Tailwind `dark:` utility classes, mapping to existing `slate-*` scale:
- `dark:bg-slate-950` for page background
- `dark:bg-slate-900` for sidebar/card backgrounds
- `dark:border-slate-800` for borders
- `dark:text-slate-100` for primary text
- `dark:text-slate-400` for secondary/muted text
- `dark:text-blue-400` for active/link states

### 6.3.2 — Eliminate Purple/Indigo Gradient

The current neon accent `from-indigo-500 to-purple-600` appears in:
- `Sidebar.tsx` — logo block (being replaced in 6.1.1)
- `DashboardHeader.tsx` — user avatar ring (`from-indigo-500/10 to-purple-500/10`, `ring-indigo-500/20`)
- `Sidebar.tsx` — `ACTIVE_CLASS` uses `border-indigo-600 text-indigo-600 bg-indigo-50`

**Replacements:**
| Old | New (light) | New (dark) |
|-----|-------------|------------|
| `bg-gradient-to-br from-indigo-500 to-purple-600` | `bg-blue-600` (solid) | `bg-blue-500` |
| `bg-indigo-50 text-indigo-600 border-r-2 border-indigo-600` | `bg-blue-50 text-blue-700 border-r-2 border-blue-600` | `dark:bg-blue-950 dark:text-blue-400 dark:border-blue-500` |
| `ring-indigo-500/20` | `ring-blue-500/20` | `dark:ring-blue-400/20` |
| `bg-indigo-50 text-indigo-600 border-indigo-200` (role badge) | `bg-blue-50 text-blue-700 border-blue-200` | `dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800` |
| `hover:bg-rose-50 hover:text-rose-600` (logout) | Keep — rose is correct for danger | `dark:hover:bg-rose-950 dark:hover:text-rose-400` |

### 6.3.3 — Global Surface / Background Colors

| Component | Light mode | Dark mode |
|-----------|-----------|----------|
| `AppLayout` root | `bg-canvas-subtle` (or `bg-slate-50`) | `dark:bg-slate-950` |
| `Sidebar` | `bg-white border-slate-200` | `dark:bg-slate-900 dark:border-slate-800` |
| `DashboardHeader` | `bg-white border-slate-200` | `dark:bg-slate-900 dark:border-slate-800` |
| Table rows | `bg-white hover:bg-slate-50` | `dark:bg-slate-900 dark:hover:bg-slate-800` |
| Modal/Card backgrounds | `bg-white` | `dark:bg-slate-900` |
| Input fields | `bg-white border-slate-300` | `dark:bg-slate-800 dark:border-slate-700` |
| `FilterBar` chips | `bg-slate-100 text-slate-700` | `dark:bg-slate-800 dark:text-slate-300` |

### 6.3.4 — Status Color Standardization

Status badges should use semantic, non-neon colors:

| Status | Light bg / text | Dark bg / text |
|--------|----------------|----------------|
| PASSED | `bg-green-50 text-green-700` | `dark:bg-green-950 dark:text-green-400` |
| FAILED | `bg-red-50 text-red-700` | `dark:bg-red-950 dark:text-red-400` |
| RUNNING | `bg-amber-50 text-amber-700` | `dark:bg-amber-950 dark:text-amber-400` |
| PENDING | `bg-slate-100 text-slate-600` | `dark:bg-slate-800 dark:text-slate-400` |
| UNSTABLE | `bg-orange-50 text-orange-700` | `dark:bg-orange-950 dark:text-orange-400` |
| ERROR | `bg-red-50 text-red-700` | `dark:bg-red-950 dark:text-red-400` |
| ANALYZING | `bg-violet-50 text-violet-700` | `dark:bg-violet-950 dark:text-violet-400` |

**File to update:** `src/components/StatusBadge.tsx`

### 6.3.5 — Delete `App.css`

- Verify all styles from `App.css` are either:
  - Redundant with Tailwind (can be deleted), or
  - Migrated to explicit Tailwind classes on the component.
- Delete `apps/dashboard-client/src/App.css`.
- Remove the `import './App.css'` line from `App.tsx`.

### 6.3.6 — Login & Signup Page Cleanup

`Login.tsx` and `Signup.tsx` currently use inline `React.CSSProperties` objects.

- Replace all inline styles with Tailwind classes.
- Apply the new palette: `bg-slate-50 dark:bg-slate-950` for page, `bg-white dark:bg-slate-900` for the card.
- Remove the custom gradient backgrounds (or replace with a simple `bg-gradient-to-b from-slate-900 to-blue-950` in dark mode only).

### Acceptance Criteria — 6.3
- [ ] No `from-indigo-*`, `to-purple-*`, `text-indigo-*`, `bg-indigo-*` classes remain anywhere (except any third-party component that cannot be changed).
- [ ] `App.css` file is deleted and no longer imported.
- [ ] All inline `style={{...}}` props are removed from Login and Signup.
- [ ] The `dark:` class is applied on the `<html>` element and all surfaces visually change.
- [ ] Status badges use the correct semantic color map.
- [ ] No visual regressions on light mode.

---

## Task 6.4 — Table & Animation Polish ⬜

### 6.4.1 — Execution Table Row Spacing

**File:** `src/components/ExecutionRow.tsx`

Current state: compact rows with minimal padding.

Target changes:
- Table row `<tr>`: `h-12` → `h-14` (increase row height)
- All `<td>` cells: `py-2 px-4` → `py-3 px-4`
- Task ID column: use `font-mono text-xs text-slate-500 dark:text-slate-400` for the ID string
- Status badge cell: ensure badge is vertically centered with `align-middle`
- Image column: truncate with `max-w-[180px] truncate` to prevent overflow
- Duration / timestamp columns: `font-medium tabular-nums` for consistent number alignment

### 6.4.2 — Execution Table Header Polish

**File:** `src/components/dashboard/ExecutionList.tsx`

Current state: table header uses basic styling.

Target:
- `<thead>` row: `bg-slate-50 dark:bg-slate-900/50`
- `<th>` cells: `text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 px-4`
- Add a sticky header: `<thead className="sticky top-0 z-10 ...">` so headers stay visible on scroll

### 6.4.3 — Group Expansion Transition

**File:** `src/components/GroupHeaderRow.tsx`

- The `ChevronRight` icon should rotate 90° when expanded: add `transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}` to the icon element.
- The group's child rows should slide in with the existing `animate-slide-down` utility (already defined in `tailwind.config.js`).
- Ensure the group header row itself has a distinct background: `bg-slate-100 dark:bg-slate-800/50` with a bottom border `border-b border-slate-200 dark:border-slate-700`.

### 6.4.4 — Sidebar Collapse Transition Verification

**File:** `src/components/Sidebar.tsx`

- The `transition-all duration-300` on the `<aside>` is already correct.
- Verify the sidebar width change (`w-16` ↔ `w-60`) animates smoothly with the new dark mode classes applied.
- Verify text/icon labels fade correctly — add `transition-opacity duration-200` to the label `<span>` elements.

### 6.4.5 — StatsGrid KPI Cards

**File:** `src/components/StatsGrid.tsx`

- Cards: `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm`
- KPI value: `text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums`
- KPI label: `text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400`
- Remove any lingering purple/indigo color references.

### Acceptance Criteria — 6.4
- [ ] Table rows are visibly taller and more readable.
- [ ] Table header text is uppercase, light-gray, and sticky on scroll.
- [ ] Group header chevron rotates smoothly on expand/collapse.
- [ ] Child rows slide in with the `animate-slide-down` animation.
- [ ] Sidebar width transition is smooth with no layout jump.
- [ ] KPI cards use the new palette and are readable in both modes.

---

## Task 6.5 — Logo Switching & ThemeContext ✅

Completed in prior session. `ThemeContext` reads from `localStorage`, applies `dark` class to `<html>` before paint, and exposes `useTheme()`. The `Sidebar.tsx` dynamically imports the black/white logo variant based on the active theme.

---

## Task 6.6 — Settings Page & StatsGrid Polish ✅

Completed in prior session. Settings tabs, StatsGrid KPI cards, and all remaining surfaces converted to `gh-*` token classes.

---

## Task 6.7 — Final UI Stabilization & Sprint Closure ✅

### 6.7.1 — Members Table Dark Mode Fix

**Files changed:** `MembersTab.tsx`, `MemberTable.tsx`, `MemberCards.tsx`, `InvitationList.tsx`

- Replaced all inline `React.CSSProperties` style objects with Tailwind utility classes.
- Table header now uses `dark:bg-gh-bg-subtle-dark` — no more white flash in Dark Mode.
- `getRoleBadgeStyle` (returning `CSSProperties`) replaced by `getRoleBadgeClass` (returning a `string` of Tailwind classes), enabling proper `dark:` variants on role badges.
- Select inputs in role column and invite flow use `dark:bg-gh-bg-dark dark:border-gh-border-dark`.

### 6.7.2 — Settings Nav Scrollbar

**File:** `tailwind.config.js` + `Settings.tsx`

- Added `scrollbar-hide` plugin utility (hides `-webkit-scrollbar` + sets `scrollbar-width: none`) so the horizontal overflow on the Settings tab nav is invisible but still scrollable. The `scrollbar-hide` class was already applied in `Settings.tsx`.

### 6.7.3 — FilterBar Full Dark Mode

**File:** `FilterBar.tsx`

- Container: `dark:bg-gh-bg-subtle-dark dark:border-gh-border-dark`
- Status chips (inactive state): dark variants for `emerald`, `rose`, `amber` chip families.
- Environment & View Mode segmented controls: `dark:bg-gh-bg-dark dark:text-slate-300`, active state uses `dark:bg-gh-accent-dark`.
- Date inputs and Group combobox: `dark:bg-gh-bg-dark dark:border-gh-border-dark dark:text-slate-300`.
- Dividers: `dark:bg-gh-border-dark`.
- Clear button: `dark:bg-gh-bg-dark dark:text-slate-400 dark:hover:bg-gh-bg-subtle-dark`.

### 6.7.4 — ExecutionModal Verification

**File:** `ExecutionModal.tsx`

- Confirmed: modal panel `dark:bg-gh-bg-subtle-dark`, all inputs `dark:bg-gh-bg-dark`, footer `dark:border-gh-border-dark`. No regressions introduced.

### 6.7.5 — Documentation Update

**File:** `apps/dashboard-client/README.md`

- Replaced outdated "Pure CSS" framing with Tailwind CSS + GitHub-style Dark Mode.
- Added "Visual Identity & Theming" section documenting dynamic logo switching, the semantic token palette table, and ThemeContext usage.
- Updated Contributing guidelines to enforce Tailwind-only, dark-mode-paired styling.

### Acceptance Criteria — 6.7
- [x] Team Members table header uses `dark:bg-gh-bg-subtle-dark` — no white header in Dark Mode.
- [x] Settings nav scrollbar is hidden (via `scrollbar-hide` Tailwind utility).
- [x] FilterBar is fully dark-mode compatible with correct chip, button, and input styling.
- [x] ExecutionModal has no white backgrounds in Dark Mode.
- [x] README Visual Identity section documents logo switching and GitHub-style Dark Mode.
- [x] PLAN.md Sprint 6 marked 100% complete.
- [x] Clean commit created.

---

## Task 6.8 — Post-Audit Theme Hardening ✅

> **Triggered by:** Manual dark-mode audit revealing residual white-flash surfaces and purple/indigo regressions across Settings, Billing, and KPI cards.

### 6.8.1 — StatsGrid KPI Cards (`StatsGrid.tsx`)

- Replaced `bg-gh-bg` / `border-gh-border` / `bg-gh-bg-subtle` / `text-gh-text` with explicit paired tokens:
  `bg-white dark:bg-gh-bg-subtle-dark`, `border-slate-200 dark:border-gh-border-dark`,
  `bg-slate-100 dark:bg-gh-bg-dark`, `text-slate-900 dark:text-slate-100`.
- Added `tabular-nums` to KPI value for consistent number width.
- Replaced `text-violet-500` on the Timer icon with `text-amber-500` (no purple remnants).
- Loading skeleton: `bg-slate-200 dark:bg-slate-700`.

### 6.8.2 — BillingTab Full Tailwind Rewrite (`BillingTab.tsx`)

- Deleted the entire `styles` constant (229 lines of inline `React.CSSProperties`).
- Removed all `onMouseOver`/`onMouseOut` JS hover handlers; replaced with Tailwind `hover:` classes.
- **Plan cards**: `bg-white dark:bg-gh-bg-subtle-dark border-2 border-slate-200 dark:border-gh-border-dark`.
  Current plan card: `border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20`.
- **Upgrade buttons**: replaced `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` → `bg-gh-accent dark:bg-gh-accent-dark`.
- **Manage Subscription button**: indigo secondary style → `text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30`.
- **Status badges**: semantic per-status classes (`emerald` active, `amber` past_due, `slate` canceled) with full dark: variants.
- **Alert banners**: `bg-blue-50/amber-50/red-50` with `dark:bg-*-950/30` variants.
- **Section titles / info labels**: `dark:text-slate-100` / `dark:text-slate-400`.

### 6.8.3 — OrganizationTab Full Tailwind Rewrite (`OrganizationTab.tsx`)

- Deleted inline `styles` object (90 lines).
- **Save Changes button**: `linear-gradient(to right, #4f46e5, #7c3aed)` → `bg-gh-accent dark:bg-gh-accent-dark`.
- **Plan badge**: purple gradient → `bg-blue-600 dark:bg-blue-500 text-white`.
- **Name input**: inline style → `bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 border-slate-300 dark:border-gh-border-dark`.
- **Disabled input** (non-admin): `bg-slate-100 dark:bg-gh-bg-subtle-dark text-slate-500`.
- **Plan limits grid**: `bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark`.
- All labels: `text-slate-700 dark:text-slate-300`.

### 6.8.4 — RunSettingsTab Full Tailwind Rewrite (`RunSettingsTab.tsx`)

- Deleted inline `styles` object (128 lines).
- **Save Settings button**: purple gradient → `bg-gh-accent dark:bg-gh-accent-dark`.
- **Create (secondary) button**: indigo text → `text-slate-700 dark:text-slate-300 bg-white dark:bg-gh-bg-dark border border-slate-300 dark:border-gh-border-dark`.
- **All inputs / select**: `bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 border-slate-300 dark:border-gh-border-dark`.
- Divider: `border-t border-slate-200 dark:border-gh-border-dark`.
- Upgrade banner: `bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800`.

### 6.8.5 — InviteModal Full Tailwind Rewrite (`InviteModal.tsx`)

- Deleted inline `styles` object (164 lines) and all `onMouseOver`/`onMouseOut` handlers.
- Modal backdrop: `bg-black/50` fixed overlay.
- Modal panel: `bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark`.
- **Send Invitation button**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` → `bg-gh-accent dark:bg-gh-accent-dark`.
- **Usage info banner**: indigo `#667eea` text → `text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30`.
- Email / Role inputs: `bg-white dark:bg-gh-bg-dark border-2 border-slate-200 dark:border-gh-border-dark focus:border-gh-accent`.

### 6.8.6 — ProfileTab Full Tailwind Rewrite (`ProfileTab.tsx`)

- Deleted inline `styles` object (191 lines).
- **Save Changes / Generate Key / Copy Key buttons**: purple gradient → `bg-gh-accent dark:bg-gh-accent-dark`.
- **Admin role badge**: `bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800`.
- **API key table**: `bg-slate-50 dark:bg-gh-bg-dark` header, `dark:border-gh-border-dark` rows, mono key prefix with `dark:bg-slate-800 dark:text-slate-300`.
- **New Key modal**: dark panel `dark:bg-gh-bg-subtle-dark`, key display stays `bg-slate-950 text-emerald-400`.
- **Revoke button**: `text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30`.

### 6.8.7 — SecurityTab Full Tailwind Rewrite (`SecurityTab.tsx`)

- Deleted inline `styles` object (131 lines).
- **AI toggle**: `backgroundColor: '#4f46e5'` → `bg-gh-accent dark:bg-gh-accent-dark` (on), `bg-slate-300 dark:bg-slate-600` (off).
- **Privacy Policy link**: `color: '#4f46e5'` → `text-gh-accent dark:text-gh-accent-dark`.
- Alert banners: info/warning/disabled use proper semantic color classes with dark: variants.
- Toggle row container: `bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark`.

### 6.8.8 — UsageTab Full Tailwind Rewrite (`UsageTab.tsx`)

- Deleted inline `styles` object (167 lines) and all `onMouseOver`/`onMouseOut` handlers.
- **Metric cards**: `bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark`.
- **Progress bar (normal)**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` → `bg-gh-accent dark:bg-gh-accent-dark`. Warning → `bg-amber-500`, Danger → `bg-red-500`.
- **Upgrade button**: purple gradient → `bg-gh-accent dark:bg-gh-accent-dark`.
- **Upgrade section**: indigo gradient background → `bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800`.
- Extracted `MetricCard` and `AlertBanner` sub-components for readability.

### 6.8.9 — PrivacyPolicy Full Tailwind Rewrite (`PrivacyPolicy.tsx`)

- Deleted inline `styles` object (68 lines) and all `onMouseOver`/`onMouseOut` handlers.
- **Page background**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` → `bg-slate-50 dark:bg-gh-bg-dark`.
- **Content card**: `bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark`.
- **Back link** and **email link**: `#667eea` → `text-gh-accent dark:text-gh-accent-dark`.

### Acceptance Criteria — 6.8
- [x] KPI cards no longer flash white in Dark Mode — use explicit `dark:bg-gh-bg-subtle-dark`.
- [x] All Settings tab labels are readable: `text-slate-700 dark:text-slate-300`.
- [x] Zero `purple-` or `indigo-` Tailwind classes remain anywhere in `dashboard-client/src`.
- [x] Zero purple/indigo hex codes (`#4f46e5`, `#7c3aed`, `#667eea`, `#764ba2`) remain in any `.tsx` file.
- [x] All upgrade/save/invite buttons use `bg-gh-accent dark:bg-gh-accent-dark` (GitHub blue).
- [x] BillingTab plan cards are dark-mode aware (`dark:bg-gh-bg-subtle-dark`).
- [x] No inline `React.CSSProperties` style objects remain in the audited settings components.
- [x] PLAN.md updated to reflect Task 6.8 completion.

---

## Task 6.9 — Final Holdout Dark Mode Fixes ✅

> **Triggered by:** Post-sprint manual dark-mode audit identifying two remaining white-flash surfaces.

### 6.9.1 — GroupHeaderRow Dark Mode (`GroupHeaderRow.tsx`)

- `<tr>` background: added `dark:bg-gh-bg-subtle-dark dark:border-gh-border-dark` and `dark:hover:bg-slate-700/30`.
- Group name `<span>`: added `dark:text-slate-300` alongside existing `text-slate-700`.
- `getPassRateBadgeClass`: updated all four return values with full `dark:` variants:
  - Zero total: `dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50`
  - 100% pass: `dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50`
  - ≥75% pass (amber): `dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50`
  - <75% pass (rose): `dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50`

### 6.9.2 — IntegrationsTab Input Dark Mode (`IntegrationsTab.tsx`)

- `INPUT_CLASS` constant: replaced undefined token `dark:text-gh-text-dark` with `dark:text-slate-200`.
- All three inputs (`jira-domain`, `jira-email`, `jira-token`) inherit the fix via the shared constant.

### Acceptance Criteria — 6.9
- [x] GroupHeaderRow `<tr>` uses `dark:bg-gh-bg-subtle-dark` — no bright white/gray flash.
- [x] Group name text uses `dark:text-slate-300` — readable on dark background.
- [x] All pass-rate badge variants have correct `dark:` color pairs.
- [x] All three Jira inputs use `dark:bg-gh-bg-dark dark:text-slate-200` — no white fields.
- [x] Zero `indigo-`, `purple-`, or `violet-` Tailwind classes remain in `dashboard-client/src`.

---

## Execution Order

```
6.2 (ThemeContext) ──► 6.3 (Palette, dark: classes)
6.1 (Asset/Layout) ──┘  (parallel with 6.2, no dependency)
6.4 (Polish)        ── independent, execute last
```

**Recommended commit sequence:**
1. `feat(theme): add ThemeContext with localStorage persistence` (6.2.1 + 6.2.2)
2. `feat(header): add theme toggle button and sidebar toggle slot` (6.2.3 + 6.1.2)
3. `feat(sidebar): integrate logo asset and lift collapse state` (6.1.1 + 6.1.2 remaining)
4. `refactor(palette): replace indigo/purple with GitHub-style blue + dark mode` (6.3)
5. `refactor(login,signup): replace inline styles with Tailwind` (6.3.6)
6. `style(table): polish row spacing, header and group animations` (6.4)

---

## Architectural Notes

- `ThemeContext` must be the **outermost** provider — it manipulates `document.documentElement`, so it should run before anything renders.
- All Tailwind `dark:` classes require the `dark` class to be present on `<html>`. `ThemeContext` owns this DOM mutation.
- `App.css` is fully deprecated after this sprint. No new CSS files should be created.
- All code, comments, and documentation must be in **English**.
- Every DB query still requires `organizationId` — this sprint is frontend-only, no backend changes.
- Commit after each of the 6 logical phases above, not in one bulk commit.

---

## Dependency Map

```
6.1.1 (logo asset)            — standalone
6.1.2 (collapse toggle lift)  — standalone, but coordinates with 6.2.3 (header button)
6.2.1 (ThemeContext)          — no deps; must precede 6.3
6.2.2 (App.tsx wiring)        — depends on 6.2.1
6.2.3 (header toggle UI)      — depends on 6.2.1; coordinates with 6.1.2
6.3.1 (tailwind config)       — standalone
6.3.2–6.3.5 (palette sweep)   — depends on 6.2.1 (dark: only works after ThemeContext activates)
6.3.6 (Login/Signup cleanup)  — standalone
6.4.1–6.4.5 (polish)          — standalone; execute after 6.3 for visual coherence
```
