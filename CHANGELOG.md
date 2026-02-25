# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [3.3.1] — 2026-02-25 — Security & RBAC Testing Suite (Suite A)

### Added
- **Testing Strategy Documentation** — Documented the 3-Layer Testing Architecture (Unit, API Integration, E2E) at `docs/testing/strategy.md`.
- **API Integration Tests** — Added comprehensive API integration tests for RBAC, Data Isolation (Multi-tenancy), and Account Lockout using Vitest, Supertest, and MongoMemoryServer.
- **E2E Playwright Tests** — Completed Playwright Page Object Model (POM) and UI flow tests for Role-Based Access Control and Execution boundaries.

## [3.3.0] — 2026-02-25 — Slack Notifications & Execution Polishes

### Added
- **Configurable Slack Notifications** — Users can configure which test execution statuses (PASSED, FAILED, ERROR, UNSTABLE) trigger Slack notifications.
- **Connected Status Badges** — Added "Connected" status badges for Jira, GitHub, GitLab, and Azure DevOps integration cards based on their enabled states.

### Changed
- **Slack Notification Workflow** — Modifying the `slackWebhookUrl` is now optional upon saving if the Slack integration is already connected. The backend supports receiving and processing notifications.
- **Global Brand Refresh** — Updated global branding from "Agnostic Automation Center" to "Agnox" across documentation and UI, safely avoiding backend/API path changes.
- **AI Analysis Tab** — The "AI Analysis" tab is now hidden when an execution has an "ERROR" status since AI cannot analyze platform/container launch errors effectively.

### Fixed
- **Windows Worker Compatibility** — Normalized Windows file paths to forward slashes in the worker backend.
- **Slack Deep Linking** — Corrected the Slack webhook deep link in the producer backend to properly target specific test execution drawers. 
- **Allure Parse Metrics** — Fixed the test metrics reported in CI/CD PR comments by accurately parsing Allure summary data.
- **Frontend Session Revocation** — Fixed frontend logout logic to synchronously call the backend `/api/auth/logout` endpoint before clearing local storage.

## [3.2.0] — 2026-02-24 — Native CI/CD Integrations

### Added
- **Native CI Providers** — Added robust strategy-pattern `CiProvider` implementations for GitHub, GitLab, and Azure DevOps to natively post AI root-cause analysis as PR/MR comments.
- **Dynamic API Routing** — Refactored integration API to use a unified `PATCH /api/organization/integrations/:provider` endpoint for secure PAT token storage.
- **Provider Settings UI** — Added a native "Integrations" UI in the Dashboard to securely manage GitHub, GitLab, and Azure DevOps personal access tokens (PATs).
- **Automated CI Triggers** — Added `POST /api/ci/trigger` webhook endpoint for CI environments to natively initiate test cycles and supply standard SCM push context.

### Changed
- **Encrypted Storage** — Migrated integration credentials to use strict AES-256-GCM encryption at rest within the `Organization` document.
- **Worker Execution Flow** — Refactored the Worker Service pipeline to dynamically resolve the SCM provider and dispatch AI comments upstream asynchronously.

## [3.1.1] — 2026-02-23 — Security Hardening Documentation

### Added
- **Security Architecture Document** — Created `docs/SECURITY_ARCHITECTURE.md` detailing the enterprise-grade, defense-in-depth security measures implemented during Sprints 1-3.
- **Documentation Sync** — Synchronized `PROJECT_CONTEXT.md`, `README.md`, and `architecture/overview.md` to reflect the new `PLATFORM_*` namespace, Redis JWT blacklisting, and SSRF mitigations.

## [3.1.0] — 2026-02-22 — Quality Hub & Reporting Evolution

### Added
- **Live HTML Reports** — Dedicated preview screen for Test Cycles (`CycleReportPage.tsx`) with stat cards, expandable item list, and native browser-print optimization (`@media print` CSS forces all manual steps visible, high-contrast badges)
- **Feature Management** — Organization-level toggles for Manual Test Repository and Hybrid Cycles, enabling progressive rollout per tenant
- **Automated Versioning** — Single-source-of-truth version pipeline: `vite.config.ts` reads root `package.json` at build time and injects `__APP_VERSION__` into the entire UI via `VersionDisplay` component

### Changed
- `version.ts` — removed hardcoded version string; now reads from Vite-injected build constant
- `Sidebar.tsx` — replaced inline version text with `<VersionDisplay />` component in both desktop and mobile footers
- `ChangelogModal.tsx` — added v3.1.0 release notes
- `vite.config.ts` — pinned HMR WebSocket to dev-server port, eliminating stray console errors
- `index.css` — added `@media print` block (shadow removal, `<details>` force-expand, manual-steps visibility)
- `CycleReportPage.tsx` — print-friendly contrast overrides on all status badges, type badges, and text elements

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
