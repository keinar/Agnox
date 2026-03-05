# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

## [3.13.0] — 2026-03-05

### Added
- **Smart Execution Analytics (Phase 5)** — Persistent tracking of individual test health metrics: `stabilityScore` (A-F), `averageDurationMs`, and `isQuarantined` state.
- **Auto-Quarantine & Quality Gate Bypass** — Automatically quarantine tests that fail 3 consecutive times to prevent CI/CD pipeline blocking. Webhooks return `PASSED` if all failed tests are quarantined.
- **AI Failure Clustering** — MD5-based `errorHash` generation for failures, grouping similar errors to optimize AI token usage and analysis accuracy.
- **`SmartAnalyticsService`** — Native backend logic for scoring algorithms, performance degradation checks (🐌 Snail badge), and historical metric aggregation.
- **Enhanced Feature Tour** — Added "Smart Analytics" discovery step highlighting Auto-Quarantine and Stability Scoring in the Run Settings dashboard.

### Changed
- `apps/dashboard-client/src/components/Onboarding/tourManager.ts` — New 6th step added to `buildFeatureTour`.
- `docs/core-features/executions.md` — Added "Auto-Quarantine & Quality Gate Bypass" section.
- `docs/ai-capabilities/flakiness-detective.md` — Added "Smart Execution Analytics (Phase 5)" documentation.
- `docs/ai-capabilities/configuration.md` — Added "Smart Analytics" to feature flags table.
- `PLAN.md` — Marked AI Quality Orchestrator Phase 5 as complete (v3.13.0).
- `PROJECT_CONTEXT.md` — Version bumped to 3.13.0; feature registry updated with Phase 5 details.
- `package.json` — Version bumped from `3.12.0` to `3.13.0`.

## [3.12.0] — 2026-03-04

### Added
- **Docusaurus documentation restructure** — Core user-facing docs migrated to `docs/` directory tree, organized into `getting-started/`, `core-features/`, `ai-capabilities/`, `integrations/`, `api-reference/`, and `architecture/` sections. Previous monolithic `user-guide.md` chunked into per-feature pages.
- **SAST Critical/High vulnerability resolution** — All Critical and High severity findings from the security audit resolved. Security score advanced to 100/100.
- **Synchronous startup guard** — Producer service validates `ENCRYPTION_KEY` (exactly 32 chars), `PLATFORM_JWT_SECRET`, and `PLATFORM_MONGO_URI` at process boot; service refuses to start on any missing or malformed required secret.
- **`ENCRYPTION_KEY` enforcement** — Startup guard enforces exactly 32 characters for the AES-256-GCM key; documented in `docs/getting-started/installation.md` under "Backend Startup Requirements".
- **Webhook HMAC signature validation** — PR Routing endpoint (`POST /api/webhooks/ci/pr`) now enforces `X-Hub-Signature-256` HMAC-SHA256 verification with constant-time comparison; unsigned or tampered GitHub deliveries rejected 401 before any task dispatch. Requires `webhookSecret` set in Settings → Run Settings and mirrored in the GitHub webhook form.
- **5-Layer AI Pipeline Sanitizer** (`utils/chat-sanitizer.ts`) — Formally documented: stage allowlist, forced `organizationId` injection, `$limit` cap (max 1,000), collection whitelist (`executions`, `test_cycles` only), recursive operator scan. `PipelineSanitizationError` thrown on any violation.
- **Shift-left data redaction** — Credential field values (`password`, `token`, `secret`, `key`, `apiKey`, `authorization`) stripped from AI prompts before LLM transmission.
- **Prompt injection denylist** — Inbound chatbot messages scanned for known injection phrases (`ignore previous instructions`, `act as`, etc.); matched requests rejected 400.
- **Rate limiting isolation** — Ingest and AI endpoints use independently tuned Redis rate limiters (Ingest events: 500 req/min; AI chat: separate limit) to prevent cross-feature interference.

### Changed
- `docs/getting-started/installation.md` — Added "Backend Startup Requirements" section with required env var table (`ENCRYPTION_KEY`, `PLATFORM_JWT_SECRET`, `PLATFORM_MONGO_URI`) and optional platform keys.
- `docs/ai-capabilities/pr-routing.md` — GitHub Setup section updated with Webhook Secret step (step 3) and new "HMAC Signature Verification" subsection documenting the full validation pipeline.
- `docs/ai-capabilities/chatbot.md` — "Security Model" renamed to "Security Model & Defense-in-Depth"; added Layer 0 (shift-left data redaction) and Layer 0.5 (prompt injection denylist) before the existing 5-layer table.
- `README.md` — "Enterprise-Grade Security" section extended with three new bullets: 5-Layer AI Sanitizer, Webhook HMAC Verification, Synchronous Startup Guard. "Security" section score updated from 92/100 to 100/100; same three bullets added.
- `PROJECT_CONTEXT.md` — Security Posture section extended with four new bullets reflecting all security hardening additions.
- `.agents/doc-sync/SKILL.md` — Bumped to v1.2.0; target documents updated to reference `docs/**/*.md` dynamic scan in place of deprecated `docs/architecture/overview.md` and `docs/features/user-guide.md` paths.
- `package.json` — Version bumped from `3.11.0` to `3.12.0`.

## [3.11.0] — 2026-03-03

### Changed
- `docs/features/user-guide.md` — Section 15 (AI Quality Orchestrator) significantly expanded with richer, step-by-step guidance for all five AI features:
  - **BYOK Configuration:** New step-by-step setup guide (Settings → Security → AI Configuration) documenting model selection, per-provider key input, status badges (Configured / Using Platform Default), Remove flow, and the AES-256-GCM encryption guarantee.
  - **Auto-Bug Generator:** Detailed log-truncation strategy (first 10% + last 90%, max 80k chars, `[LOG TRUNCATED]` marker), full field breakdown of the generated report (`title`, `stepsToReproduce`, `expectedBehavior`, `actualBehavior`, `severity`, `codePatches`).
  - **Smart Test Optimizer:** Renamed section to match product name; documented the BDD conversion flow step by step (`Given / When / Then`), described Pass 1 (Analyzer, temp 0.4) and Pass 2 (Critic, temp 0.0) separately, and clarified the side-by-side diff modal UX including the Edge Cases panel.
  - **Smart PR Routing:** Added GitLab webhook setup instructions (Settings → Webhooks → Push events) alongside the existing GitHub steps; added format note for the webhook URL (`?token=<orgId>`); clarified that `reasoning` in the response explains the folder-selection rationale.
  - **Quality Chatbot:** Added supported chart types table (bar / line / pie); replaced prose security note with a 5-column guard table documenting each layer (stage allowlist, `organizationId` injection, `$limit` cap, collection whitelist, operator scan); added conversation 24h TTL note.
  - **Dual-Agent (Actor-Critic) Architecture:** New dedicated subsection with ASCII pipeline diagram, temperature settings, schema enforcement details, and explanation of why a two-pass validation prevents confident-but-wrong outputs.
- `docs/architecture/overview.md` — Two updates:
  - **New "Dual-Agent (Actor-Critic) AI Architecture" subsection** added after the Worker Service section, showing the full pipeline (`logs.slice(-60000)` → Analyzer at temp 0.4 with `responseSchema` → Critic at temp 0.0 with override authority → final Markdown) along with design decisions (JSON schema enforcement, fallback object on JSON parse failure).
  - **Technology Stack Summary table — AI row** updated from "Google Gemini API / Root cause analysis" to reflect multi-provider BYOK support (Gemini, OpenAI, Anthropic) and the `resolveLlmConfig()` resolver.
- `package.json` — Version bumped from `3.10.0` to `3.11.0`.

## [3.10.0] — 2026-03-03

### Added
- **AI Orchestrator — Phase 1 (Foundation)**: New `IAiConfig` and `IAiFeatureFlags` shared-types interfaces; `IOrganization` extended with `aiConfig` and `aiFeatures`. Migration 009 (`migrations/009-add-ai-orchestrator.ts`) backfills granular AI feature flags and `aiConfig.defaultModel` for all existing orgs.
- **AI Orchestrator — `resolveLlmConfig()` utility** (`apps/producer-service/src/utils/llm-config.ts`): Single-source-of-truth BYOK resolver — reads org's `defaultModel` and encrypted per-provider keys, decrypts via `encryption.ts`, and falls back to `PLATFORM_GEMINI_API_KEY` / `PLATFORM_OPENAI_API_KEY` / `PLATFORM_ANTHROPIC_API_KEY`. Throws `LlmNotConfiguredError` (→ 503) when no key is available.
- **AI Orchestrator — BYOK & AI Config API** (`GET/PATCH /api/organization/ai-config`): Admins can select the org's default AI model (`gemini-2.5-flash`, `gpt-4o`, `claude-3-5-sonnet`) and store per-provider API keys encrypted at rest; response returns only `byokConfigured` flags, never plaintext keys.
- **AI Orchestrator — Granular Feature Flags** (`PATCH /api/organization/features` extended): `aiFeatures` block now accepted alongside existing module flags: `rootCauseAnalysis`, `autoBugGeneration`, `flakinessDetective`, `testOptimizer`, `prRouting`, `qualityChatbot`.
- **Feature A — Auto-Bug Generator** (`POST /api/ai/generate-bug-report`): Fetches execution logs, applies first-10% + last-90% truncation at 80k chars, and generates a structured bug report (`title`, `stepsToReproduce`, `expectedBehavior`, `actualBehavior`, `codePatches`, `severity`). Guarded by `autoBugGeneration` feature flag.
- **`AutoBugModal.tsx`**: Edit-before-submit form pre-populated with AI-generated bug report fields; "Submit to Jira" button opens `CreateJiraTicketModal` with `initialSummary` / `initialDescription` pre-filled.
- **`ExecutionDrawer.tsx`** — "Auto Bug" button (Sparkles icon) added for `FAILED`/`ERROR` executions when `autoBugGeneration` is enabled.
- **Feature B — Flakiness Detective** (`POST /api/ai/analyze-stability`): Fetches last 20 executions for a group, calculates flakiness score (0–100), and returns structured `findings[]` and `recommendations[]`. Results persisted in new `stability_reports` collection (Migration 010). Guarded by `flakinessDetective` flag.
- **`GET /api/ai/stability-reports`**: Returns last 50 stability reports for the org (no feature-flag guard — history always readable).
- **`StabilityPage.tsx`** (route: `/stability`): Group selector → "Analyze Stability" → flakiness gauge + verdict badge + findings/recommendations + clickable history list (loads past reports without a new LLM call).
- **Feature C — Test Case Optimizer** (`POST /api/ai/optimize-test-cases`): Dual-agent pipeline (Analyzer → Critic) accepts up to 20 test-case IDs and returns optimized BDD steps, detected duplicates, and edge cases per case. Guarded by `testOptimizer` flag.
- **`OptimizedTestCasesModal.tsx`**: Side-by-side diff view (original vs. optimized steps) with per-case "Apply Optimization" and "Apply All" actions that call `PUT /api/test-cases/:id`.
- **`BulkActionsBar.tsx`** extended with optional `onOptimize` / `showOptimize` props; "Optimize with AI" button appears when test cases are selected and `testOptimizer` is enabled.
- **Feature D — Smart PR Routing** (`POST /api/webhooks/ci/pr?token=<orgId>`): Receives GitHub push webhooks, extracts changed files, maps them to a `targetFolder` via LLM, dispatches a RabbitMQ task using `computeOrgPriority()`, and returns `{ taskId, targetFolder, reasoning, dispatchedAt }`. Guarded by `prRouting` flag. Route file: `apps/producer-service/src/routes/pr-routing.ts`.
- **`RunSettingsTab.tsx`** — PR Routing toggle + webhook URL callout added; uses `useOrganizationFeatures`.
- **Feature E — Quality Chatbot** (`POST /api/ai/chat`): Two-turn LLM pipeline — Step 1 translates natural-language question into `{ collection, pipeline }`, Step 2 summarises DB results as `{ answer, chartData? }`. Pipeline sanitized by `sanitizePipeline()` in `utils/chat-sanitizer.ts` (5-layer NoSQL injection guard: stage allowlist, force `organizationId`, `$limit` cap, collection whitelist, operator scan). Conversation history stored in `chat_sessions` collection (24h TTL). Guarded by `qualityChatbot` flag.
- **`GET /api/ai/chat/history`** and **`GET /api/ai/chat/:conversationId`**: History endpoints (no feature-flag guard — always readable).
- **`ChatPage.tsx`** (route: `/chat`): Two-panel layout (left: session history sidebar, right: chat); CSS bar chart rendered when `chartData` is returned; suggested-question chips; history refreshed after first turn of a new conversation.
- **`SecurityTab.tsx`** — Full BYOK UI: default AI model dropdown, per-provider key management rows (Configured / Using Platform Default badges, masked key input, Remove button). Replaces legacy single `aiAnalysisEnabled` toggle.
- **`FeaturesTab.tsx`** — New "AI Features" section with 6 toggle rows (Root Cause Analysis, Auto-Bug Generation, Flakiness Detective, Test Optimizer, Smart PR Routing, Quality Chatbot); opt-in model (all default `false`).
- **`Sidebar.tsx`** — "Stability" (Activity icon) and "Ask AI" (MessageSquare icon) nav items conditionally rendered via `aiFeatures` flags.
- **`App.tsx`** — `/stability` and `/chat` routes added as `FeatureGatedRoute` entries with `aiFeatureKey` prop.
- **Migration 010** (`migrations/010-add-stability-reports.ts`): Creates `stability_reports` collection with indexes on `organizationId + createdAt` and `organizationId + groupName`.
- **New MongoDB collections**: `stability_reports` (flakiness analysis history, tenant-isolated) and `chat_sessions` (multi-turn AI chat context, 24h TTL, tenant-isolated).
- **New env vars** (optional): `PLATFORM_OPENAI_API_KEY`, `PLATFORM_ANTHROPIC_API_KEY` — platform-default fallback keys for the respective providers.

### Changed
- `packages/shared-types/index.ts` — Added `IAiConfig`, `IAiFeatureFlags`; `IOrganization` extended with `aiConfig?` and `aiFeatures?`; `openai` and `@anthropic-ai/sdk` SDKs installed in producer.
- `PROJECT_CONTEXT.md` — Added Phase 19 (AI Orchestrator) to the feature registry; added AI routes, new collections, new components/pages, new utilities; bumped version header to `3.10.0`.
- `docs/architecture/overview.md` — Added AI Orchestrator routes to Producer Service routes list; added `stability_reports` and `chat_sessions` to MongoDB collections.
- `docs/features/user-guide.md` — Added Section 15 (AI Quality Orchestrator) with subsections for all five AI features.
- `package.json` — Version bumped from `3.9.0` to `3.10.0`.

## [3.9.0] — 2026-03-03

### Added
- **Onboarding Widget** (`apps/dashboard-client/src/components/onboarding/OnboardingWidget.tsx`) — Floating bottom-right checklist widget for new users with three items: "Connect Docker Image", "Run Your First Test", and "Explore Platform Features". Widget state (dismissed, completed items) is persisted in `localStorage` under `aac:onboarding-dismissed` and `aac:onboarding-completed`.
- **`buildEmptyStateTour`** — 11-step guided driver.js tour walking users through configuring a project in Run Settings, launching their first execution, and viewing results in the Investigation Hub. Uses `MutationObserver` for reliable DOM-based step advancement and `setInterval` URL polling for cross-page navigation detection.
- **`buildFeatureTour`** — 5-step platform discovery tour highlighting Test Cases, Test Cycles, Settings > Team Members, and Settings > Env Variables by spotlighting sidebar navigation items.
- **Sidebar "Getting Started" recovery button** — Desktop and mobile sidebar footers gain a `Rocket`-icon button that dispatches `agnox:open-onboarding` custom window event to re-open a previously dismissed onboarding widget without a page reload.
- **Replay mode** — Completed checklist items remain clickable and render a "Replay" badge, enabling users to revisit any guided tour after completing it.
- `data-testid` additions in `ExecutionModal.tsx`: `modal-launch-button`, `modal-schedule-tab`, `modal-environment-select` — used as driver.js tour anchors.

### Changed
- `DRIVER_BASE_CONFIG` — `allowClose: false` applied globally to all driver.js tour instances to prevent accidental tour dismissal.
- `PROJECT_CONTEXT.md` — Added Phase 18 (Onboarding UX) to the sprint table; added `OnboardingWidget` to the component hierarchy; bumped version header to `3.9.0`.
- `docs/features/user-guide.md` — Added "Getting Started Checklist" subsection under section 2 (Navigating the Dashboard).
- `package.json` — Version bumped from `3.8.1` to `3.9.0`.

## [3.8.1] — 2026-03-01

### Changed
- `packages/playwright-reporter/README.md` — Added dedicated **Troubleshooting / FAQ** section documenting the three most common pitfalls: missing `dotenv.config()` at the top of `playwright.config.ts`, `baseUrl` accidentally pointed at the application under test instead of the Agnox API, and `MODULE_NOT_FOUND` caused by the git-ignored `dist/` folder not being built in CI.
- `docs/integration/quickstart.md` — Added **Dual Architecture** comparison table at the top of the guide explaining the difference between Agnox Hosted (Docker) and External CI (Passive Reporter) integration modes. Added Option D (Native Playwright Reporter) walkthrough and expanded Troubleshooting section with reporter-specific entries.
- `docs/setup/ci-cd.md` — Added **Section 5: Using the `@agnox/playwright-reporter` in CI** with required CI secrets, a full GitHub Actions workflow example, and a troubleshooting table for `MODULE_NOT_FOUND`, silent reporter, and wrong `baseUrl` issues.
- `README.md` — Fixed duplicate "Option C (Legacy)" label (was colliding with existing "Option C" for generic execution request) — renamed to "Option E (Legacy)".

### Purged (Ghosts)
- `README.md`: Duplicate heading "Option C (Legacy)" conflicted with "Option C" (generic execution endpoint). Corrected to "Option E (Legacy)".

## [3.8.0] — 2026-03-01

### Added
- **`@agnox/playwright-reporter` package** — New official Playwright reporter (`packages/playwright-reporter/`) that implements Playwright's `Reporter` interface and streams live test results to the Agnox Ingest API in real-time. Features: batched event delivery (`EventBatcher`), configurable flush interval and batch size, auto-detection of CI environment (GitHub Actions, GitLab CI, Azure DevOps, Jenkins), and a "Do No Harm" design where reporter failures are always silent no-ops that never affect the user's test suite.
- **Dashboard Source Filter** — New "Source" segment in `FilterBar.tsx` (Cloud icon) with chips for `agnox-hosted`, `external-ci`, and `All`. Enables teams to separate Agnox-hosted Docker runs from external CI passive runs at a glance.
- **`Execution` type extensions** — `source` (`'agnox-hosted' | 'external-ci'`), `ingestMeta` (`IIngestMeta`), and `batchId` fields added to the `Execution` interface. `IIngestMeta` and `IIngestCiContext` interfaces added to `types/index.ts`.

### Changed
- `useExecutions.ts` / `useGroupedExecutions.ts` — `source` filter parameter wired through the URL builder and passed to `GET /api/executions` and `GET /api/executions/grouped`.
- `PROJECT_CONTEXT.md` — Added `playwright-reporter` package to the monorepo structure map and packages section; bumped version header to `3.8.0`; updated current phase to "Playwright Reporter (Phase 2)".
- `README.md` — Added "Native Playwright Reporter" feature section documenting the new `@agnox/playwright-reporter` package.
- `package.json` — Version bumped from `3.7.0` to `3.8.0`.

## [3.7.0] — 2026-03-01

### Added
- **`/api/ci/trigger` API Key Authentication** — The CI trigger endpoint now accepts `x-api-key` header auth via `createApiKeyAuthMiddleware`. The global JWT `authMiddleware` bypasses this route (added to `PUBLIC_PATHS`); authentication is handled at the route level, checking `x-api-key` first and falling back to Bearer JWT. CI/CD callers no longer need a user Bearer token to trigger test cycles.
- **Project ID Field in Run Settings** — `RunSettingsTab.tsx` now displays a read-only "Project ID (Required for CI/CD API triggers)" field at the top of the Execution Defaults section. Clicking the field selects its content; a one-click **Copy** button writes the value to the clipboard and shows a success banner.

### Changed
- `PROJECT_CONTEXT.md` — Added `POST /api/ci/trigger` to the routes table (new CI/CD Integration section); updated `run-settings` tab description to mention Project ID field; bumped version header to `3.7.0`.
- `docs/architecture/overview.md` — Added `/api/ci/trigger` to the Producer Service routes list.
- `docs/features/user-guide.md` — Section 8 (API Keys) expanded with a "Triggering Tests from CI/CD Pipelines" sub-section documenting the dedicated endpoint and Project ID retrieval.
- `README.md` — Option B in the CI/CD integration section replaced with the native `POST /api/ci/trigger` endpoint (GitHub Actions + GitLab CI examples); original generic execution request moved to Option C; added v3.7.0 "What's Included" entry.
- `package.json` — Version bumped from `3.6.0` to `3.7.0`.

## [3.6.0] — 2026-02-28

### Added
- **Dual-Agent AI Analysis Pipeline** — `analysisService.ts` now runs two sequential Gemini 2.5 Flash calls: an **Analyzer** (temperature 0.4) generates a structured JSON `{ rootCause, suggestedFix }` using a constrained `responseSchema`; a **Critic** (temperature 0.0) validates the output against the raw logs and overrides hallucinations before producing the final developer-facing Markdown. Improves analysis accuracy and eliminates non-grounded suggestions.
- **Extended Log Context** — Log slice passed to Gemini increased from 30 000 to 60 000 characters, capturing full suite output and earlier setup failures.

### Changed
- `PROJECT_CONTEXT.md` — Updated `analysisService.ts` description to reflect dual-agent pipeline; added Phase 15 to the feature registry.
- `docs/architecture/overview.md` — Updated Worker Service key files section to reflect dual-agent pipeline; fixed incorrect `AGNOX_MONITOR_SECRET` references to the correct `MONITORING_SECRET_KEY` env var name.
- `docs/features/user-guide.md` — AI Analysis section updated to explain the Analyzer + Critic validation step.
- `README.md` — AI-Powered Root Cause Analysis section updated to document the dual-agent architecture.
- `PLAN.md` — Marked Sprint 7 tasks (7.1–7.5) as complete; marked Task 9.5 and Tasks 10.1–10.2 as complete with implementation notes reflecting the live HTML report substitution for the originally planned PDF backend.

### Purged (Ghosts)
- `PLAN.md`: Sprint 7 tasks (7.1–7.5) were all marked `[ ]` despite Phase 7 being fully implemented and shipped — corrected to `[x]`.
- `PLAN.md`: Task 9.5 (Dual Progress Bar) and Tasks 10.1/10.2 (PDF backend/UI) were `[ ]` despite the cycle report being live as `CycleReportPage.tsx` with browser-print-to-PDF — corrected to `[x]` with implementation notes.
- `docs/architecture/overview.md`: `AGNOX_MONITOR_SECRET` env var name replaced with the actual variable `MONITORING_SECRET_KEY` (two occurrences).

## [3.5.0] — 2026-02-26 — DocSync & Multi-Tenant Architecture Alignment

### Changed
- **Documentation Sync** — Synchronized `README.md`, `PROJECT_CONTEXT.md`, and all setup guides (`infrastructure.md`, `client-integration.md`, `deployment.md`, `ci-cd.md`) to reflect the new Multi-Tenant architecture.
- **Legacy Env Vars Removed** — Removed references to deprecated variables including `INJECT_ENV_VARS`, `ADMIN_USER`, `ADMIN_PASS`, `DEFAULT_TEST_IMAGE`, `DEFAULT_BASE_URL`, `STAGING_URL`, and `PRODUCTION_URL`.
- **Infrastructure Standardization** — Updated documentation to emphasize the `PLATFORM_*` prefix for infrastructure secrets, completely removing self-hosted assumptions and decoupling platform from client test workloads.
- **Feature Documentation** — Documented the background Docker image pre-fetching mechanism built to minimize execution wait times in `PROJECT_CONTEXT.md` and `docs/architecture/overview.md`.
- **Security Artifact Updates** — Struck through obsolete mitigations in `SECURITY_PLAN.md` related to `INJECT_ENV_VARS` as it has been replaced by the more secure `projectEnvVars` DB collection and AES-256-GCM encryption. Marked corresponding `SECURITY_AUDIT.md` issues as resolved.

## [3.4.0] — 2026-02-26 — Env Variables & Secrets Management

### Added
- **`projectEnvVars` MongoDB collection** — Stores per-project environment variables with AES-256-GCM encryption for secret values. Migration 007 creates the required indexes.
- **Env Vars CRUD API** — Four new endpoints under `/api/projects/:projectId/env` (GET/POST/PUT/DELETE). Secret values are always masked as `••••••••` in API responses; plaintext is never returned to the client.
- **`resolveProjectEnvVars()` helper** — Shared server-side function that fetches and decrypts all project env vars in memory for injection into test run payloads.
- **Execution pipeline integration** — Both the `test-cycles` POST handler and the `execution-request` handler now fetch, decrypt, and merge project env vars into the RabbitMQ task payload before queuing.
- **`secretKeys` field in worker TaskMessageSchema** — Communicates which env var keys hold secret values so the worker can redact them from logs.
- **`sanitizeLogLine()` in worker** — Redacts secret values (by value, not key) from every streamed container log chunk before dashboard broadcast or buffer accumulation.
- **`EnvironmentVariablesTab` React component** — New Settings tab (`env-vars`) with project selector, Add/Edit form with animated secret toggle, and masked table view with hover-reveal Edit/Delete actions.

### Changed
- `Settings.tsx` — Added `env-vars` tab to the tab registry and `TabId` union type.
- `PROJECT_CONTEXT.md` — Updated migration count to 007, added `projectEnvVars` schema (collection total: 13), added env var endpoints to Projects API table, added `env-vars` to Settings tabs, fixed Notable Absences row for encryption (now resolved), corrected `zod` worker entry (IS used for `TaskMessageSchema`), resolved Known Gap #9.
- `docs/architecture/overview.md` — Corrected RabbitMQ queue name from `automation_queue` to `test_queue`, updated message format to include `secretKeys`, added `projectEnvVars` to MongoDB collections, added env var route to Producer routes.
- `README.md` — Added Sprint 9/10/11 and Env Vars entries to Project Status table and Roadmap, added Sprint 10/11/Env Vars "What's Included" sections, expanded Smart Environment Management section.

### Purged (Ghosts)
- `PROJECT_CONTEXT.md` Notable Absences: "No AES library / no implementation exists" — encryption has existed since Sprint 2 (Jira tokens).
- `PROJECT_CONTEXT.md` Known Gaps #9: "AES-256-GCM mentioned in CLAUDE.md but no implementation" — same as above.
- `PROJECT_CONTEXT.md` worker packages: `zod` incorrectly listed as unused; it powers `TaskMessageSchema` in `worker.ts`.
- `docs/architecture/overview.md`: `automation_queue` replaced with correct queue name `test_queue`.

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
