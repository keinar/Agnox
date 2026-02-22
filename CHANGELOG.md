# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [3.1.0] — 2026-02-22

### Added
- **VersionDisplay component** (`VersionDisplay.tsx`) — reads application version at build time from root `package.json` via Vite `define` injection; renders as small, muted `gh-*`-styled text in the sidebar footer
- **Automated version pipeline** — `vite.config.ts` injects `__APP_VERSION__` constant from root `package.json` so the UI version always matches the monorepo version field without manual updates
- **Sprint 10 foundation** — Sprint 10 section added to `PLAN.md`; Task 10.3 (Automated Version Infrastructure) marked complete

### Changed
- Root `package.json` version bumped from `1.1.0` to `3.1.0`
- `apps/dashboard-client/src/config/version.ts` — removed hardcoded `'v3.0.0'` string; now reads from Vite-injected build constant
- `Sidebar.tsx` — replaced bare `{APP_VERSION}` text nodes with `<VersionDisplay />` component in both desktop and mobile version footers
- `ChangelogModal.tsx` — added `v3.1.0` release entry for Sprint 10: PDF Reporting & Automation Infrastructure
- `PROJECT_CONTEXT.md` — advanced current phase to Sprint 10; updated version references

## [1.1.0] — 2026-02-22

### Added
- **Test Case Repository** — `test_cases` MongoDB collection with full CRUD API (`POST/GET/PUT/DELETE /api/test-cases`) and AI-powered bulk step generation via Google Gemini
- **Test Cases Page** (`TestCases.tsx`) — Suite-grouped accordion view with search, project selector, and `TestCaseDrawer.tsx` for creating/editing test cases
- **Hybrid Cycle Builder** — `test_cycles` MongoDB collection, `POST/GET /api/test-cycles`, `CycleBuilderDrawer.tsx` for composing manual + automated cycles with suite-grouped checkbox selection
- **Test Cycles Page** (`TestCycles.tsx`) — Cycle listing with expandable item detail rows, status badges, automation rate progress bars, and pass/fail counters
- **Manual Execution Player** (`ManualExecutionDrawer.tsx`) — Interactive step-by-step checklist with Pass/Fail/Skip buttons per step, progress bar, auto-advance, and "Complete Test" button
- **Manual Item Update Endpoint** — `PUT /api/test-cycles/:cycleId/items/:itemId` using MongoDB `arrayFilters` for efficient nested updates, with automatic cycle summary recalculation
- **Automated Cycle Sync** — Worker forwards `cycleId`/`cycleItemId` from RabbitMQ task payloads; Producer syncs cycle item status on terminal execution results and auto-completes cycles
- **Sidebar Navigation** — Added "Test Cases" (ClipboardList icon) and "Test Cycles" (Layers icon) entries
- **Routes** — `/test-cases` and `/test-cycles` routes registered in `App.tsx`

### Changed
- `PLAN.md` — Sprint 9 tasks 9.1–9.4 marked complete
- `PROJECT_CONTEXT.md` — Advanced phase to Sprint 9, added `test_cases` and `test_cycles` schemas, updated routing map and component hierarchy, bumped collection count to 12
- `docs/features/user-guide.md` — Added sections 11 (Test Cases) and 12 (Test Cycles & Manual Player)
- `docs/architecture/overview.md` — Added test case and cycle routes to Producer service, added `test_cases` and `test_cycles` to MongoDB collections
- `README.md` — Added Quality Hub feature entries (Test Case Repository, Hybrid Cycles, Manual Player, AI Step Generation)
- `package.json` version bumped from `1.0.0` to `1.1.0`
