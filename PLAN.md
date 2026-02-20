# Sprint 6 — UI/UX Polish & Theming

> **Last updated:** 2026-02-20
> **Branch:** `epic/v3-redesign`
> **Status:** ✅ **Task 6.5 Complete** (6.1–6.4 previously completed)
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
- **Expanded state:** Show `<img src={logoFull} alt="Agnostic Automation Center" className="h-8 w-auto object-contain" />`
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
