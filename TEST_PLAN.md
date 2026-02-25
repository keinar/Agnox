# Agnox Platform — Production-Grade Test Plan

> **Version:** 1.0.0 | **Date:** 2026-02-25 | **Author:** Senior QA Automation Architect
> **Platform Version:** 3.3.0 | **Phase Coverage:** Phases 1–11 (All complete features)

---

## Table of Contents

1. [Executive Summary & Scope](#1-executive-summary--scope)
2. [Test Strategy](#2-test-strategy)
3. [Suite A — Authentication, RBAC & Multi-Tenancy](#3-suite-a--authentication-rbac--multi-tenancy)
4. [Suite B — Core Execution Engine](#4-suite-b--core-execution-engine)
5. [Suite C — AI Analysis & Triage](#5-suite-c--ai-analysis--triage)
6. [Suite D — Integrations & Notifications](#6-suite-d--integrations--notifications)
7. [Infrastructure & Security Edge Cases](#7-infrastructure--security-edge-cases)
8. [Test Environment & Data Strategy](#8-test-environment--data-strategy)
9. [Tooling & CI Pipeline](#9-tooling--ci-pipeline)
10. [Coverage Gaps & Known Risks](#10-coverage-gaps--known-risks)

---

## 1. Executive Summary & Scope

### Platform Under Test

Agnox is a multi-tenant test automation platform with three primary services:
- **Producer Service** (Fastify/Node.js, port 3000) — REST API, JWT auth, billing, CRON scheduling
- **Worker Service** (Node.js, Docker socket) — Container orchestration, RabbitMQ consumer, Gemini AI triage
- **Dashboard Client** (React 19, SPA) — Real-time execution monitoring via Socket.io

### Scope

| Area | In Scope | Out of Scope |
|---|---|---|
| Auth & RBAC | JWT, Redis blacklist, API Keys, account lockout | SSO (planned future) |
| Multi-Tenancy | All DB queries, org isolation, cross-tenant bleed | Infrastructure-level network isolation |
| Execution Engine | RabbitMQ, Docker-in-Docker, status logic, log streaming | Maestro mobile stub (unimplemented) |
| AI Triage | Gemini integration, org settings, fallback behavior | AI model accuracy/quality |
| Integrations | Slack webhooks, Jira SSRF, CI provider PR comments | Third-party API internals |
| Billing | Plan limits, Stripe webhooks, downgrade flow | Stripe payment processing UI |
| Frontend | Auth flows, real-time UI updates, WebSocket events | Visual regression testing |
| Infrastructure | Secret blocklist, DB disconnect, rate limiting | Cloud provider infrastructure |

### Risk Classification

| Priority | Description |
|---|---|
| **P0 — Critical** | Data leaking across tenant boundaries; security bypass |
| **P1 — High** | Execution engine failures; incorrect status reporting |
| **P2 — Medium** | Integration misfires; notification delivery failures |
| **P3 — Low** | UI cosmetic issues; non-critical edge cases |

---

## 2. Test Strategy

### 2.1 Testing Layers

#### Layer 1: Unit Tests
- **Target:** Pure business logic functions — `getMergedEnvVars`, `resolveHostForDocker`, `containsFatalPattern`, `resolveWebhookUrl`, Zod schema validation, `PLATFORM_SECRET_BLOCKLIST` filtering, status-determination logic in `worker.ts`
- **Tooling:** **Vitest** (zero-config with TypeScript, ESM-compatible for worker-service's `.js` imports)
- **Location:** Co-located as `*.test.ts` files beside source files
- **Run command:** `vitest run` in each service workspace
- **Mocking strategy:** Mock MongoDB client, RabbitMQ channel, Docker socket, and Gemini SDK with `vi.mock()`
- **Target coverage:** 90%+ on security-critical functions

#### Layer 2: API Integration Tests
- **Target:** All 50+ Fastify endpoints — HTTP semantics, authentication enforcement, tenant isolation, rate limits, error response shapes
- **Tooling:** **Supertest** + **Vitest** against a real Fastify instance with an in-memory MongoDB (via `mongodb-memory-server`) and mocked Redis/RabbitMQ
- **Location:** `apps/producer-service/src/routes/*.test.ts`
- **Auth strategy:** Generate real JWTs signed with the test `PLATFORM_JWT_SECRET`; use separate JWT tokens for Org A and Org B to validate cross-tenant isolation
- **Response contract:** Every response MUST match `{ success: boolean; data?: T; error?: string; }`
- **Run command:** `vitest run --project api`

#### Layer 3: End-to-End (E2E) / UI Tests
- **Target:** Full user journeys — login → run execution → view logs → configure Slack → invite member
- **Tooling:** **Playwright** with `@playwright/test`
- **Location:** `tests/` directory (replace legacy archive)
- **Environment:** `docker-compose.yml` dev stack; dedicated `playwright.config.ts` pointing at `http://localhost:8080`
- **Socket.io testing:** Use `socket.io-client` in test fixtures to assert real-time events fire
- **Run command:** `playwright test`

### 2.2 Test ID Convention

`<SUITE>-<SEQUENCE>` — e.g., `A-001`, `B-012`, `C-003`

### 2.3 Assertion Standards

All API test assertions must verify:
1. HTTP status code
2. Response body shape (`success: boolean`)
3. Database state post-mutation (verify via a subsequent GET)
4. Absence of sensitive fields in responses (e.g., `encryptedToken`, `hashedPassword`, `iv`, `authTag`)

---

## 3. Suite A — Authentication, RBAC & Multi-Tenancy

**Risk Level:** P0 (Critical)
**Layer:** Primarily API; some Unit and E2E

---

### A-001: Successful Login Returns Valid JWT

| Field | Detail |
|---|---|
| **Test ID** | A-001 |
| **Title** | Successful login returns a signed JWT with correct claims |
| **Pre-conditions** | User `alice@org-a.com` exists in `users` collection with `status: 'active'`, correct bcrypt hash |
| **Steps** | `POST /api/auth/login` with `{ email: "alice@org-a.com", password: "Correct!Pass1" }` |
| **Expected Result** | HTTP 200; body `{ success: true, data: { token: "<jwt>" } }`; decoded payload contains `userId`, `organizationId`, `role: "admin"`, `exp` set to ~24h from now |
| **Layer** | API |

---

### A-002: JWT Expiration Triggers 401

| Field | Detail |
|---|---|
| **Test ID** | A-002 |
| **Title** | An expired JWT is rejected with 401 |
| **Pre-conditions** | Sign a JWT with `exp: Math.floor(Date.now() / 1000) - 1` (already expired) using the test `PLATFORM_JWT_SECRET` |
| **Steps** | `GET /api/auth/me` with `Authorization: Bearer <expired_token>` |
| **Expected Result** | HTTP 401; `{ success: false, error: "Invalid token" }`; NO user data returned |
| **Layer** | API / Unit |

---

### A-003: Revoked JWT Is Rejected After Logout (Redis Blacklist)

| Field | Detail |
|---|---|
| **Test ID** | A-003 |
| **Title** | Token added to Redis blacklist during logout cannot be reused |
| **Pre-conditions** | Valid JWT for `alice@org-a.com`; Redis instance connected |
| **Steps** | 1. `POST /api/auth/logout` with valid JWT → expect HTTP 200. 2. Immediately `GET /api/auth/me` with the same JWT |
| **Expected Result** | Step 1: HTTP 200. Step 2: HTTP 401; token must be found in Redis blacklist by its `jti` or token hash; body `{ success: false, error: "Invalid token" }` |
| **Layer** | API |

---

### A-004: Account Lockout After 5 Failed Login Attempts

| Field | Detail |
|---|---|
| **Test ID** | A-004 |
| **Title** | Account is locked for 15 minutes after 5 consecutive failed logins |
| **Pre-conditions** | User `bob@org-a.com` exists with `status: 'active'`; rate limiter enabled |
| **Steps** | Send 5 × `POST /api/auth/login` with incorrect password for `bob@org-a.com`. Then send a 6th attempt with the correct password |
| **Expected Result** | Attempts 1–5: HTTP 401. Attempt 6 (correct password): HTTP 429 or 403 indicating account locked; message references 15-minute lockout. `users` collection: `failedLoginAttempts >= 5`, `lockedUntil` field set ~15 min in the future |
| **Layer** | API |

---

### A-005: Cross-Tenant Execution Log Access Is Denied

| Field | Detail |
|---|---|
| **Test ID** | A-005 |
| **Title** | User from Org B cannot retrieve execution logs belonging to Org A |
| **Pre-conditions** | `executions` collection contains a document with `organizationId: "org-a-id"`, `taskId: "task-xyz"`. A valid JWT for a user in Org B exists |
| **Steps** | `GET /api/executions/task-xyz/artifacts` using Org B's JWT |
| **Expected Result** | HTTP 404 (resource not found — not 403, to avoid org existence leakage); body `{ success: false, error: "..." }`. The DB query for artifacts MUST include `organizationId: "org-b-id"` filter and thus return no match |
| **Layer** | API |

---

### A-006: Viewer Role Cannot Delete an Execution

| Field | Detail |
|---|---|
| **Test ID** | A-006 |
| **Title** | A user with `role: 'viewer'` receives 403 when attempting to soft-delete an execution |
| **Pre-conditions** | Valid JWT for a user with `role: 'viewer'` in Org A; execution `task-abc` exists in Org A |
| **Steps** | `DELETE /api/executions/task-abc` using viewer JWT |
| **Expected Result** | HTTP 403; `{ success: false, error: "Insufficient permissions" }`; `executions` collection: `deletedAt` remains `null` for `task-abc` |
| **Layer** | API |

---

### A-007: Non-Admin Cannot Change Another User's Role

| Field | Detail |
|---|---|
| **Test ID** | A-007 |
| **Title** | A developer role user is blocked from changing another user's role |
| **Pre-conditions** | JWT for user with `role: 'developer'`; target user `user-id-123` in the same org |
| **Steps** | `PATCH /api/users/user-id-123/role` with body `{ role: "admin" }` using developer JWT |
| **Expected Result** | HTTP 403; no change to `users` collection; no audit log entry created |
| **Layer** | API |

---

### A-008: Admin Cannot Demote the Last Admin of an Organization

| Field | Detail |
|---|---|
| **Test ID** | A-008 |
| **Title** | The system prevents demotion of the sole admin, preserving org governability |
| **Pre-conditions** | Org with exactly one admin user (`alice@org-a.com`); a second user with `role: 'developer'` exists |
| **Steps** | As Alice (admin): `PATCH /api/users/alice-id/role` with `{ role: "developer" }` |
| **Expected Result** | HTTP 400 or 422; `{ success: false, error: "..." }` indicating cannot demote last admin; Alice's role remains `admin` in `users` collection |
| **Layer** | API |

---

### A-009: API Key Authentication Grants Correct Org Context

| Field | Detail |
|---|---|
| **Test ID** | A-009 |
| **Title** | A valid `x-api-key` header authenticates the request and scopes it to the correct org |
| **Pre-conditions** | API key `pk_live_<hex>` generated for `alice@org-a.com`; SHA-256 hash stored in `apiKeys` collection |
| **Steps** | `GET /api/executions` with header `x-api-key: pk_live_<hex>` (no JWT) |
| **Expected Result** | HTTP 200; response contains only Org A's executions; `apiKeys.lastUsed` timestamp updated in DB |
| **Layer** | API |

---

### A-010: Revoked API Key Returns 401

| Field | Detail |
|---|---|
| **Test ID** | A-010 |
| **Title** | A deleted API key is rejected immediately |
| **Pre-conditions** | API key created and then hard-deleted from `apiKeys` collection |
| **Steps** | `GET /api/executions` with the now-revoked `x-api-key` header |
| **Expected Result** | HTTP 401; `{ success: false, error: "Invalid API key" }` |
| **Layer** | API |

---

### A-011: Cross-Tenant User Profile Access Returns 404

| Field | Detail |
|---|---|
| **Test ID** | A-011 |
| **Title** | Fetching a user from a different organization returns 404, not 403 |
| **Pre-conditions** | User `dave@org-b.com` has `userId: "user-dave-id"`. A valid JWT for Org A exists |
| **Steps** | `GET /api/users/user-dave-id` using Org A's JWT |
| **Expected Result** | HTTP 404; `{ success: false, error: "..." }`; Org A's user data is not leaked |
| **Layer** | API |

---

### A-012: Invitation Token Is SHA-256 Hashed Before Storage

| Field | Detail |
|---|---|
| **Test ID** | A-012 |
| **Title** | The raw invitation token is never stored in the database |
| **Pre-conditions** | Admin user in Org A |
| **Steps** | `POST /api/invitations` with `{ email: "new@user.com", role: "developer" }` |
| **Expected Result** | HTTP 201; `invitations` collection: document contains `tokenHash` (64-char hex, SHA-256) but NOT a `token` or `rawToken` field. Email is sent to `new@user.com` containing the raw token link |
| **Layer** | API / Unit |

---

### A-013: Expired Invitation Token Is Rejected

| Field | Detail |
|---|---|
| **Test ID** | A-013 |
| **Title** | A token past its 7-day expiry cannot be used to join an org |
| **Pre-conditions** | `invitations` collection contains a document with `expiresAt: <8 days ago>` and `status: 'pending'` |
| **Steps** | `GET /api/invitations/validate/<expired_token>` |
| **Expected Result** | HTTP 400 or 410; `{ success: false, error: "..." }` indicating token is expired; `status` in DB remains `pending` (or `expired`) but NOT `accepted` |
| **Layer** | API |

---

## 4. Suite B — Core Execution Engine

**Risk Level:** P1 (High)
**Layer:** Unit, API, and integration with real Docker

---

### B-001: RabbitMQ Message with Invalid JSON Is Dead-Lettered (Nack, No Requeue)

| Field | Detail |
|---|---|
| **Test ID** | B-001 |
| **Title** | Malformed JSON in RabbitMQ message is rejected without requeue |
| **Pre-conditions** | Worker service connected to test RabbitMQ instance; channel spy attached |
| **Steps** | Publish `{ content: Buffer.from("not valid json {{ }") }` to `test_queue` |
| **Expected Result** | `channel.nack(msg, false, false)` is called (verified via spy); message is NOT requeued; worker remains alive and continues processing subsequent messages; error is logged via `logger.error` |
| **Layer** | Unit (with mocked channel) |

---

### B-002: RabbitMQ Message Failing Zod Schema Is Rejected

| Field | Detail |
|---|---|
| **Test ID** | B-002 |
| **Title** | A structurally invalid task message (missing required `taskId`) is rejected |
| **Pre-conditions** | Valid JSON but missing `taskId` field |
| **Steps** | Unit test: call `TaskMessageSchema.safeParse({ organizationId: "org1", image: "img:1.0" })` |
| **Expected Result** | `parseResult.success === false`; error path includes `taskId`; in integration: `channel.nack(msg, false, false)` is called; no execution document is created in MongoDB |
| **Layer** | Unit |

---

### B-003: Windows Path Backslash Is Normalized to Forward Slash

| Field | Detail |
|---|---|
| **Test ID** | B-003 |
| **Title** | A `folder` value containing Windows backslashes is normalized before being passed to the container command |
| **Pre-conditions** | Task message with `folder: "tests\\regression\\login"` |
| **Steps** | Unit test: construct the task message with the Windows path; invoke the folder normalization logic (`(task.folder || 'all').replace(/\\/g, '/')`) |
| **Expected Result** | `containerCmd` is `['/bin/sh', '/app/entrypoint.sh', 'tests/regression/login']`; no backslash characters present in the command array |
| **Layer** | Unit |

---

### B-004: "No Tests Found" Exit Code Results in ERROR Status

| Field | Detail |
|---|---|
| **Test ID** | B-004 |
| **Title** | An execution whose container logs contain "No tests found" is marked ERROR regardless of exit code |
| **Pre-conditions** | Mock container that exits with code 0 but outputs `"No tests found in regression suite"` to stdout |
| **Steps** | Unit test: set `logsBuffer = "No tests found in regression suite"`, `result.StatusCode = 0`; run the status determination logic |
| **Expected Result** | `finalStatus === 'ERROR'`; `logger.warn` called with message "No tests found"; this takes precedence over exit code 0 |
| **Layer** | Unit |

---

### B-005: Exit Code 0 with Only Failures Detected → FAILED

| Field | Detail |
|---|---|
| **Test ID** | B-005 |
| **Title** | A container that exits 0 but whose logs contain only failure markers is downgraded to FAILED |
| **Pre-conditions** | `logsBuffer` contains `"1 failed, 0 passed"` (no `✓` or `passing`); `StatusCode = 0` |
| **Steps** | Unit test: run status determination logic with above inputs |
| **Expected Result** | `finalStatus === 'FAILED'`; `logger.warn` called with "Exit code 0 but only failures detected" |
| **Layer** | Unit |

---

### B-006: Mixed Pass/Fail Results Produce UNSTABLE Status

| Field | Detail |
|---|---|
| **Test ID** | B-006 |
| **Title** | A run with both passing and failing tests is classified UNSTABLE |
| **Pre-conditions** | `logsBuffer` contains `"3 passed"` AND `"2 failed"`; `StatusCode = 0` |
| **Steps** | Unit test: run status determination logic |
| **Expected Result** | `finalStatus === 'UNSTABLE'`; `logger.warn` called with "Mixed results detected" |
| **Layer** | Unit |

---

### B-007: FATAL ERROR Pattern in Logs Forces FAILED

| Field | Detail |
|---|---|
| **Test ID** | B-007 |
| **Title** | A container that exits 0 but whose logs contain "FATAL ERROR" is forced to FAILED |
| **Pre-conditions** | `logsBuffer = "Test suite passed\nFATAL ERROR: JavaScript heap out of memory"`, `StatusCode = 0`, `finalStatus = 'PASSED'` |
| **Steps** | Unit test: call `containsFatalPattern(logsBuffer)` and run status override logic |
| **Expected Result** | `containsFatalPattern` returns `true`; `finalStatus` overridden to `'FAILED'`; `logger.warn` called with "FATAL ERROR detected in logs" |
| **Layer** | Unit |

---

### B-008: localhost URL in Docker Container Is Rewritten to host.docker.internal

| Field | Detail |
|---|---|
| **Test ID** | B-008 |
| **Title** | `resolveHostForDocker` rewrites localhost URLs when running inside Docker |
| **Pre-conditions** | `RUNNING_IN_DOCKER=true` set in env |
| **Steps** | Unit test: call `resolveHostForDocker("http://localhost:8080/api")` and `resolveHostForDocker("http://127.0.0.1:3000")` |
| **Expected Result** | Returns `"http://host.docker.internal:8080/api"` and `"http://host.docker.internal:3000"` respectively; production URLs (no `localhost`) are returned unchanged |
| **Layer** | Unit |

---

### B-009: PLATFORM_* Secrets Are Blocked from Container Environment Variables

| Field | Detail |
|---|---|
| **Test ID** | B-009 |
| **Title** | Platform infrastructure secrets are never injected into user test containers |
| **Pre-conditions** | `INJECT_ENV_VARS=PLATFORM_JWT_SECRET,PLATFORM_MONGO_URI,APP_FEATURE_FLAG` set in worker env; `process.env.PLATFORM_JWT_SECRET = "super-secret"` |
| **Steps** | Unit test: call `getMergedEnvVars({ envVars: {}, baseUrl: "http://localhost" }, "http://target")` |
| **Expected Result** | Returned env map does NOT contain `PLATFORM_JWT_SECRET` or `PLATFORM_MONGO_URI`; DOES contain `APP_FEATURE_FLAG` (not blocklisted); `CI: 'true'` and `BASE_URL` are always present |
| **Layer** | Unit |

---

### B-010: User-Supplied envVars Containing PLATFORM_* Key Are Silently Dropped

| Field | Detail |
|---|---|
| **Test ID** | B-010 |
| **Title** | A user who crafts a task message with `envVars: { PLATFORM_JWT_SECRET: "injected" }` cannot override platform secrets |
| **Pre-conditions** | Task message `config.envVars = { PLATFORM_JWT_SECRET: "injected", MY_KEY: "ok" }` |
| **Steps** | Unit test: call `getMergedEnvVars({ envVars: { PLATFORM_JWT_SECRET: "injected", MY_KEY: "ok" } }, "http://target")` |
| **Expected Result** | Returned map: `PLATFORM_JWT_SECRET` absent; `MY_KEY: "ok"` present |
| **Layer** | Unit |

---

### B-011: Container Reports Are Stored in Org-Scoped Directory

| Field | Detail |
|---|---|
| **Test ID** | B-011 |
| **Title** | Reports are written to `<REPORTS_DIR>/<organizationId>/<taskId>/` and not to a shared root |
| **Pre-conditions** | `REPORTS_DIR=/tmp/reports`; task with `organizationId: "org-abc"`, `taskId: "task-001"` |
| **Steps** | Integration test: run worker with mocked Docker (container exits 0, no artifacts); inspect filesystem after execution |
| **Expected Result** | Directory `/tmp/reports/org-abc/task-001/` exists; NO files written to `/tmp/reports/task-001/` (un-scoped path) |
| **Layer** | Unit / Integration |

---

### B-012: Real-Time WebSocket Log Streaming Is Delivered Per Org Room

| Field | Detail |
|---|---|
| **Test ID** | B-012 |
| **Title** | Socket.io log events are broadcast only to the room belonging to the execution's organization |
| **Pre-conditions** | Producer service running; two Socket.io clients connected — Client A joined room `org-a-id`, Client B joined room `org-b-id`; execution `task-log-test` belongs to Org A |
| **Steps** | Worker's `sendLogToProducer` is invoked with `organizationId: "org-a-id"`, `taskId: "task-log-test"`, `log: "test output line"` |
| **Expected Result** | Client A receives `execution-log` event with correct payload; Client B receives NO event; event payload shape: `{ taskId, log, organizationId }` |
| **Layer** | E2E / Integration |

---

### B-013: Container Is Cleaned Up (force-removed) After Execution Completes

| Field | Detail |
|---|---|
| **Test ID** | B-013 |
| **Title** | The Docker container is always removed after execution, even on error |
| **Pre-conditions** | Worker configured with mocked `docker.createContainer` that returns a spy object; execution throws during artifact copy |
| **Steps** | Unit test: verify the `finally` block calls `container.remove({ force: true })` |
| **Expected Result** | `container.remove` is called exactly once; `channel.ack(msg)` is called regardless of success/failure; no dangling containers |
| **Layer** | Unit |

---

### B-014: Worker Rejects Task With Empty Image Name

| Field | Detail |
|---|---|
| **Test ID** | B-014 |
| **Title** | A task message with `image: "   "` (whitespace only) is nack'd |
| **Pre-conditions** | Valid JSON task message; `image` field is `"   "` |
| **Steps** | Unit test: invoke the consumer handler with this message |
| **Expected Result** | `channel.nack(msg, false, false)` called; logger error includes "Image name is empty or invalid"; no container is created |
| **Layer** | Unit |

---

### B-015: Execution Status Transitions Are Persisted to MongoDB with organizationId Filter

| Field | Detail |
|---|---|
| **Test ID** | B-015 |
| **Title** | DB `updateOne` for status transitions always includes `organizationId` in the filter |
| **Pre-conditions** | Spy on `executionsCollection.updateOne`; task with `taskId: "t1"`, `organizationId: "org-1"` |
| **Steps** | Unit test: run the worker's consumer handler with mocked Docker (happy path exit) |
| **Expected Result** | Every `updateOne` call's first argument contains `{ taskId: "t1", organizationId: "org-1" }`; no call uses only `{ taskId: "t1" }` |
| **Layer** | Unit |

---

### B-016: RabbitMQ Prefetch Is Set to 1 (Sequential Processing)

| Field | Detail |
|---|---|
| **Test ID** | B-016 |
| **Title** | Worker sets `channel.prefetch(1)` to prevent concurrent message processing |
| **Pre-conditions** | Spy on `channel.prefetch` |
| **Steps** | Unit test: invoke `startWorker()` through initialization |
| **Expected Result** | `channel.prefetch(1)` is called during startup before any message consumption begins |
| **Layer** | Unit |

---

## 5. Suite C — AI Analysis & Triage

**Risk Level:** P1 (High)
**Layer:** Unit, API

---

### C-001: AI Analysis Is Skipped When Gemini API Key Is Missing

| Field | Detail |
|---|---|
| **Test ID** | C-001 |
| **Title** | `analyzeTestFailure` returns a safe fallback string when `PLATFORM_GEMINI_API_KEY` is unset |
| **Pre-conditions** | `delete process.env.PLATFORM_GEMINI_API_KEY`; `delete process.env.GEMINI_API_KEY` |
| **Steps** | Unit test: call `analyzeTestFailure("some logs", "my-image:latest")` |
| **Expected Result** | Returns `"AI Analysis disabled: Missing API Key."`; `logger.warn` called; Gemini SDK is never instantiated; execution status does NOT get stuck in `ANALYZING` |
| **Layer** | Unit |

---

### C-002: AI Analysis Is Skipped When Logs Are Insufficient (< 50 chars)

| Field | Detail |
|---|---|
| **Test ID** | C-002 |
| **Title** | Executions with negligible logs skip AI analysis gracefully |
| **Pre-conditions** | `PLATFORM_GEMINI_API_KEY` is set; `logsBuffer.length = 30` |
| **Steps** | Worker logic: check the `logsBuffer.length < 50` guard before calling `analyzeTestFailure` |
| **Expected Result** | `analysis = "AI Analysis skipped: Insufficient logs."`; Gemini API is not called; execution DB document updated with this value |
| **Layer** | Unit |

---

### C-003: AI Analysis Is Disabled When Organization Has aiAnalysisEnabled = false

| Field | Detail |
|---|---|
| **Test ID** | C-003 |
| **Title** | Worker enforces per-org AI disable flag and skips analysis even for FAILED executions |
| **Pre-conditions** | `organizations` collection: `{ _id: "org-1", aiAnalysisEnabled: false }`; execution is FAILED; `PLATFORM_GEMINI_API_KEY` set |
| **Steps** | Unit test with mocked MongoDB: worker fetches org, checks `aiAnalysisEnabled`, skips analysis |
| **Expected Result** | `aiAnalysisEnabled = false`; `analysis = "AI Analysis disabled for this organization."`; Gemini SDK never called; DB update includes `aiAnalysisEnabled: false` (audit trail) |
| **Layer** | Unit |

---

### C-004: AI Analysis Is NOT Triggered for PASSED Executions

| Field | Detail |
|---|---|
| **Test ID** | C-004 |
| **Title** | Gemini is only invoked for FAILED and UNSTABLE outcomes |
| **Pre-conditions** | `aiAnalysisEnabled: true`; `finalStatus = 'PASSED'` |
| **Steps** | Unit test: run post-execution analysis block with PASSED status |
| **Expected Result** | `analyzeTestFailure` is never called; `analysis` remains `''`; status in DB is `PASSED` (never transitions to `ANALYZING`) |
| **Layer** | Unit |

---

### C-005: Gemini API Crash Is Caught and Does Not Crash the Worker

| Field | Detail |
|---|---|
| **Test ID** | C-005 |
| **Title** | If the Gemini API throws an exception, the worker records the error gracefully and marks the execution with the final test status |
| **Pre-conditions** | `aiAnalysisEnabled: true`; `finalStatus = 'FAILED'`; Gemini SDK mock throws `new Error("API quota exceeded")` |
| **Steps** | Unit test: mock `model.generateContent` to throw; run worker analysis block |
| **Expected Result** | `analysis = "AI Analysis Failed: API quota exceeded"`; `logger.error` called; execution DB document updated with `status: 'FAILED'` (not stuck in `ANALYZING`); worker remains alive and acks the RabbitMQ message |
| **Layer** | Unit |

---

### C-006: Organization Not Found During AI Settings Fetch → AI Disabled (Fail Closed)

| Field | Detail |
|---|---|
| **Test ID** | C-006 |
| **Title** | If the organization document cannot be found during the AI settings check, AI is disabled (fail-closed) |
| **Pre-conditions** | `organizationsCollection.findOne` returns `null` (org deleted mid-execution) |
| **Steps** | Unit test with mocked MongoDB returning `null` for org lookup |
| **Expected Result** | `aiAnalysisEnabled = false`; `logger.warn` called with "Organization not found. Defaulting AI to disabled"; no crash; execution proceeds to final status update |
| **Layer** | Unit |

---

### C-007: ANALYZING Status Is Broadcast via Socket.io Before Gemini Is Called

| Field | Detail |
|---|---|
| **Test ID** | C-007 |
| **Title** | The `ANALYZING` intermediate status is persisted to DB and broadcast to the org room before the Gemini API call begins |
| **Pre-conditions** | `aiAnalysisEnabled: true`; `finalStatus = 'FAILED'`; sufficient logs |
| **Steps** | Unit test: spy on `notifyProducer` and `executionsCollection.updateOne` |
| **Expected Result** | 1st `updateOne` call: `$set.status = 'ANALYZING'`; 1st `notifyProducer` call: `status: 'ANALYZING'`; BOTH happen BEFORE `analyzeTestFailure` is awaited |
| **Layer** | Unit |

---

### C-008: AI Analysis Tab Is Hidden in UI When aiAnalysisEnabled Is False for Org

| Field | Detail |
|---|---|
| **Test ID** | C-008 |
| **Title** | The AI Analysis drawer tab is not rendered when the organization has AI disabled |
| **Pre-conditions** | API mock: `GET /api/organization` returns `{ aiAnalysisEnabled: false }`; user navigates to an execution drawer |
| **Steps** | E2E: open `ExecutionDrawer` for a FAILED execution |
| **Expected Result** | The "AI Analysis" tab is absent from the drawer's tab list; the "Terminal" and "Artifacts" tabs are still present; no JavaScript errors in console |
| **Layer** | E2E (Playwright) |

---

### C-009: Gemini Logs Are Truncated to Last 8000 Characters Before Sending

| Field | Detail |
|---|---|
| **Test ID** | C-009 |
| **Title** | Very long execution logs are truncated to protect API limits and performance |
| **Pre-conditions** | `logs` string of 20,000 characters |
| **Steps** | Unit test: spy on `model.generateContent`; call `analyzeTestFailure(twentyKString, "img:1")` |
| **Expected Result** | The prompt passed to `generateContent` contains at most 8,000 characters of log content (`logs.slice(-8000)`); the first 12,000 chars are absent |
| **Layer** | Unit |

---

## 6. Suite D — Integrations & Notifications

**Risk Level:** P2 (Medium)
**Layer:** Unit, API

---

### D-001: Slack Webhook URL Must Match Strict Pattern (SSRF Protection)

| Field | Detail |
|---|---|
| **Test ID** | D-001 |
| **Title** | A Slack webhook URL not matching `https://hooks.slack.com/services/...` is rejected |
| **Pre-conditions** | Admin JWT for Org A |
| **Steps** | `PATCH /api/organization` with body `{ slackWebhookUrl: "https://evil.com/webhook" }` |
| **Expected Result** | HTTP 400; `{ success: false, error: "Invalid slackWebhookUrl" }`; `organizations` collection: `slackWebhookUrl` unchanged |
| **Layer** | API |

---

### D-002: Valid Slack Webhook URL Is Encrypted Before Storage

| Field | Detail |
|---|---|
| **Test ID** | D-002 |
| **Title** | A valid Slack webhook URL is stored as an AES-256-GCM encrypted object, not plaintext |
| **Pre-conditions** | Admin JWT; valid URL `https://example.com/fake-slack-webhook` |
| **Steps** | `PATCH /api/organization` with the valid webhook URL |
| **Expected Result** | HTTP 200; `organizations` DB document: `slackWebhookUrl` is an object with `encrypted`, `iv`, `authTag` fields — NOT the raw URL string; `GET /api/organization` response returns `slackWebhookUrl: "configured"` (masked) |
| **Layer** | API |

---

### D-003: Slack Notification Is Sent Only for Configured Events

| Field | Detail |
|---|---|
| **Test ID** | D-003 |
| **Title** | `sendExecutionNotification` respects `slackNotificationEvents` array and skips non-subscribed statuses |
| **Pre-conditions** | Org has `slackNotificationEvents: ['FAILED']` and a valid (mocked) webhook URL |
| **Steps** | Unit test: call `sendExecutionNotification` with `execution.status = 'PASSED'`; then call with `execution.status = 'FAILED'` |
| **Expected Result** | For `PASSED`: `fetch` is NOT called; `logger.info` contains "Notification skipped". For `FAILED`: `fetch` IS called once with the Slack webhook URL |
| **Layer** | Unit |

---

### D-004: Slack Notification Contains Correct Block Kit Structure

| Field | Detail |
|---|---|
| **Test ID** | D-004 |
| **Title** | The Slack payload uses Block Kit format with correct fields and a deep-link button |
| **Pre-conditions** | Org has `slackNotificationEvents: ['FAILED']` and valid webhook; execution `{ status: 'FAILED', taskId: 'task-123', folder: 'regression', analysis: 'Root cause: DB connection error.' }` |
| **Steps** | Unit test: spy on `fetch`; call `sendExecutionNotification` |
| **Expected Result** | Captured `fetch` body (parsed as JSON): `blocks` array; first block is `type: 'header'` with emoji `🔴`; section block contains `Status`, `Triggered by`, `Environment`, `Folder` fields; AI analysis snippet block is present (truncated to 150 chars); final `actions` block contains a button with `url` pointing to `<DASHBOARD_URL>/dashboard?drawerId=task-123` |
| **Layer** | Unit |

---

### D-005: Slack Notification Does Not Block Execution Status Update on Delivery Failure

| Field | Detail |
|---|---|
| **Test ID** | D-005 |
| **Title** | A Slack delivery failure (network error) is swallowed and does not affect the execution record |
| **Pre-conditions** | `fetch` mock throws `new Error("ECONNREFUSED")` |
| **Steps** | Unit test: call `sendExecutionNotification`; check that it resolves (does not reject) |
| **Expected Result** | Function resolves successfully; `logger.error` called with the caught error; no exception propagates to the caller; execution `status` in DB is unchanged |
| **Layer** | Unit |

---

### D-006: slackNotificationEvents Rejects Invalid Status Values

| Field | Detail |
|---|---|
| **Test ID** | D-006 |
| **Title** | An invalid status value in `slackNotificationEvents` array is rejected with 400 |
| **Pre-conditions** | Admin JWT |
| **Steps** | `PATCH /api/organization` with `{ slackNotificationEvents: ["FAILED", "BANANA"] }` |
| **Expected Result** | HTTP 400; `{ success: false, error: "Invalid slackNotificationEvents" }`; DB unchanged |
| **Layer** | API |

---

### D-007: Clearing Slack Webhook URL Nullifies It in DB

| Field | Detail |
|---|---|
| **Test ID** | D-007 |
| **Title** | Sending `slackWebhookUrl: null` removes the Slack configuration |
| **Pre-conditions** | Org has a configured (encrypted) Slack webhook URL |
| **Steps** | `PATCH /api/organization` with `{ slackWebhookUrl: null }` |
| **Expected Result** | HTTP 200; `organizations` DB: `slackWebhookUrl: null`; `GET /api/organization` returns `slackWebhookUrl: null`; subsequent FAILED executions send no Slack notification |
| **Layer** | API |

---

### D-008: Jira Domain Must Be *.atlassian.net (SSRF Prevention)

| Field | Detail |
|---|---|
| **Test ID** | D-008 |
| **Title** | A Jira domain not matching the `*.atlassian.net` pattern is rejected |
| **Pre-conditions** | Valid JWT |
| **Steps** | `PUT /api/integrations/jira` with `{ domain: "mycompany.evil.com", email: "user@co.com", token: "tok" }` |
| **Expected Result** | HTTP 400; `{ success: false, error: "Domain must be a valid Atlassian Cloud domain (*.atlassian.net)" }`; no DB write |
| **Layer** | API |

---

### D-009: Jira API Token Is Encrypted Before Storage; Token Field Is Redacted in Response

| Field | Detail |
|---|---|
| **Test ID** | D-009 |
| **Title** | The Jira API token is AES-256-GCM encrypted at rest and never returned in API responses |
| **Pre-conditions** | Valid JWT; valid domain `myco.atlassian.net` |
| **Steps** | `PUT /api/integrations/jira` with `{ domain: "myco.atlassian.net", email: "dev@co.com", token: "ATATTxxx" }` |
| **Expected Result** | HTTP 200; response `data.token === "***"`; `organizations` DB: `integrations.jira.encryptedToken` is a non-empty string ≠ "ATATTxxx"; fields `iv` and `authTag` are present; `GET /api/integrations/jira` response also returns `token: "***"` |
| **Layer** | API |

---

### D-010: Updating Jira Domain/Email Without a New Token Preserves Existing Encrypted Token

| Field | Detail |
|---|---|
| **Test ID** | D-010 |
| **Title** | A partial Jira settings update (domain + email only, no `token` field) must keep the existing encrypted token |
| **Pre-conditions** | Existing Jira config with encrypted token stored; admin JWT |
| **Steps** | `PUT /api/integrations/jira` with `{ domain: "newco.atlassian.net", email: "newuser@co.com" }` — no `token` field |
| **Expected Result** | HTTP 400 (token is required by the API); if the route allowed partial updates, the `encryptedToken` in DB must remain unchanged; test verifies the DB `encryptedToken` before and after is identical |
| **Layer** | API |

---

### D-011: Jira Custom Fields Blocklist Prevents Standard Field Override

| Field | Detail |
|---|---|
| **Test ID** | D-011 |
| **Title** | A caller cannot override standard Jira fields (`project`, `reporter`, `summary`) via `customFields` |
| **Pre-conditions** | Valid Jira config; valid JWT |
| **Steps** | Unit test: call `POST /api/jira/tickets` with `customFields: { summary: "injected", customfield_10001: "safe" }` |
| **Expected Result** | `issueFields` object: `summary` comes from the top-level `summary` parameter (not `customFields`); `customfield_10001` is included; `customFields.summary` injection is silently dropped via `STANDARD_JIRA_FIELDS` filter |
| **Layer** | Unit / API |

---

### D-012: CI Integration Token Decryption Failure Is Logged and Does Not Crash Worker

| Field | Detail |
|---|---|
| **Test ID** | D-012 |
| **Title** | If the CI integration token fails decryption, the worker logs the error and continues without posting a PR comment |
| **Pre-conditions** | `organizations` collection: `integrations.github.encryptedToken = "corrupted_data"`, `iv = "bad_iv"`, `authTag = "bad_tag"`; cycle has `ciContext.prNumber = 42` |
| **Steps** | Unit test: mock `decrypt` to throw; run post-execution CI integration block |
| **Expected Result** | `logger.error` called with "Failed to decrypt github integration token"; `provider.postPrComment` is never called; `channel.ack(msg)` still called; execution status in DB is the correct final status |
| **Layer** | Unit |

---

### D-013: Slack Notification Uses Legacy Plaintext URL as Fallback

| Field | Detail |
|---|---|
| **Test ID** | D-013 |
| **Title** | If `slackWebhookUrl` in DB is a plaintext string (legacy format), `resolveWebhookUrl` returns it correctly |
| **Pre-conditions** | Org document has `slackWebhookUrl: "https://hooks.slack.com/services/T00/B00/xxx"` (string, not encrypted object) |
| **Steps** | Unit test: call `resolveWebhookUrl("https://hooks.slack.com/services/T00/B00/xxx")` |
| **Expected Result** | Returns the raw URL string; no decryption attempted; `fetch` is called with this URL |
| **Layer** | Unit |

---

### D-014: PATCH /api/organization Requires Admin Role for Slack Configuration

| Field | Detail |
|---|---|
| **Test ID** | D-014 |
| **Title** | A developer or viewer role cannot configure the Slack webhook URL |
| **Pre-conditions** | JWT for a user with `role: 'developer'` |
| **Steps** | `PATCH /api/organization` with `{ slackWebhookUrl: "https://hooks.slack.com/services/T00/B00/xxx" }` using developer JWT |
| **Expected Result** | HTTP 403; `{ success: false, error: "Insufficient permissions" }`; DB unchanged |
| **Layer** | API |

---

## 7. Infrastructure & Security Edge Cases

**Risk Level:** P0–P1
**Layer:** Unit, API, Integration

---

### E-001: MongoDB Disconnection During Execution Callback Is Handled Gracefully

| Field | Detail |
|---|---|
| **Test ID** | E-001 |
| **Title** | If MongoDB connection drops mid-execution, the worker logs the error without crashing the process |
| **Pre-conditions** | Mocked MongoDB client where `updateOne` throws `new Error("MongoNetworkError: connection closed")` |
| **Steps** | Unit test: invoke worker consumer handler; verify `updateOne` throws; check process state |
| **Expected Result** | `logger.error` called; worker does NOT call `process.exit(1)` (only startup failures do that); `channel.ack(msg)` still eventually called (via `finally` block); no uncaught exception propagates |
| **Layer** | Unit |

---

### E-002: GET /health Endpoint Reports All Infrastructure Status

| Field | Detail |
|---|---|
| **Test ID** | E-002 |
| **Title** | `/health` returns degraded status if any backend service is unreachable |
| **Pre-conditions** | Producer service running; Redis is down (connection refused) |
| **Steps** | `GET /health` |
| **Expected Result** | HTTP 200 (or 503); body: `{ status: "degraded", services: { mongodb: "healthy", redis: "error", rabbitmq: "healthy" } }`; never returns `{ status: "healthy" }` when a dependency is down |
| **Layer** | API |

---

### E-003: Rate Limiter Blocks Excessive Requests (Per-Org)

| Field | Detail |
|---|---|
| **Test ID** | E-003 |
| **Title** | An org that exceeds the per-org rate limit (100/min) receives 429 |
| **Pre-conditions** | Redis connected; rate limit configured at 100 req/min/org |
| **Steps** | Send 101 sequential `GET /api/executions` requests using the same JWT (same org) within one minute |
| **Expected Result** | First 100: HTTP 200. Request 101: HTTP 429; `{ success: false, error: "Too many requests" }`; `Retry-After` header present |
| **Layer** | API |

---

### E-004: Login Rate Limit — 5 Attempts Per Minute Per IP

| Field | Detail |
|---|---|
| **Test ID** | E-004 |
| **Title** | The login endpoint enforces 5 requests/min/IP rate limit |
| **Pre-conditions** | Redis connected; login rate limit configured |
| **Steps** | Send 6 `POST /api/auth/login` requests from the same IP within one minute |
| **Expected Result** | Request 6: HTTP 429; body includes rate limit error; subsequent attempt from different IP succeeds normally |
| **Layer** | API |

---

### E-005: Soft-Deleted Executions Are Excluded from List Queries

| Field | Detail |
|---|---|
| **Test ID** | E-005 |
| **Title** | Executions with `deletedAt != null` are not returned by `GET /api/executions` |
| **Pre-conditions** | Two executions in Org A: one with `deletedAt: null`, one with `deletedAt: <timestamp>` |
| **Steps** | `GET /api/executions` with Org A's JWT |
| **Expected Result** | HTTP 200; `data` array contains exactly 1 execution (the non-deleted one); soft-deleted execution is absent; `deletedAt` field is not exposed on the returned documents |
| **Layer** | API |

---

### E-006: Stripe Webhook Signature Verification Rejects Unsigned Requests

| Field | Detail |
|---|---|
| **Test ID** | E-006 |
| **Title** | A request to `POST /api/webhooks/stripe` without a valid `Stripe-Signature` header is rejected |
| **Pre-conditions** | `STRIPE_WEBHOOK_SECRET` configured |
| **Steps** | `POST /api/webhooks/stripe` with valid Stripe event JSON but missing or incorrect `Stripe-Signature` header |
| **Expected Result** | HTTP 400 or 401; no `webhook_logs` document created; organization plan is unchanged |
| **Layer** | API |

---

### E-007: Plan Limit Enforcement Blocks Test Runs at Quota

| Field | Detail |
|---|---|
| **Test ID** | E-007 |
| **Title** | A Free-plan org that has used all 100 test runs this month receives 403 on new run requests |
| **Pre-conditions** | Org on `free` plan; 100 execution documents with `startTime` in the current calendar month |
| **Steps** | `POST /api/execution-request` with valid run config |
| **Expected Result** | HTTP 403; response body: `{ success: false, error: "...", data: { used: 100, limit: 100, percentUsed: 100, upgradeUrl: "..." } }`; no message published to RabbitMQ |
| **Layer** | API |

---

### E-008: Stripe Subscription Cancellation Downgrades Org to Free Plan

| Field | Detail |
|---|---|
| **Test ID** | E-008 |
| **Title** | Receiving `customer.subscription.deleted` webhook resets org plan and limits to free-tier values |
| **Pre-conditions** | Org on Team plan (`maxTestRuns: 1000`, `plan: 'team'`); valid Stripe webhook payload |
| **Steps** | `POST /api/webhooks/stripe` with a properly signed `customer.subscription.deleted` event for this org's `stripeCustomerId` |
| **Expected Result** | `organizations` DB: `plan: 'free'`, `limits.maxTestRuns: 100`, `limits.maxProjects: 1`, `limits.maxUsers: 3`; `billing.stripeSubscriptionId: null`; admin email notification sent |
| **Layer** | API |

---

### E-009: CRON Schedule with Invalid Expression Is Rejected

| Field | Detail |
|---|---|
| **Test ID** | E-009 |
| **Title** | Submitting an invalid CRON expression returns 400 and does not register a job |
| **Pre-conditions** | Valid JWT; scheduler initialized |
| **Steps** | `POST /api/schedules` with `{ cronExpression: "99 * * * *", name: "Bad Schedule", environment: "staging" }` |
| **Expected Result** | HTTP 400; `{ success: false, error: "Invalid CRON expression" }`; no document inserted in `schedules` collection; no in-memory job registered |
| **Layer** | API |

---

### E-010: CRON Schedule Deletion Removes In-Memory Job

| Field | Detail |
|---|---|
| **Test ID** | E-010 |
| **Title** | Deleting a schedule stops the CRON job from firing |
| **Pre-conditions** | A schedule with a valid CRON expression registered and running |
| **Steps** | `DELETE /api/schedules/<scheduleId>`; wait past the next scheduled fire time |
| **Expected Result** | HTTP 200; `schedules` collection: document deleted; no new execution is queued to RabbitMQ after deletion; scheduler registry no longer contains the job |
| **Layer** | API / Integration |

---

### E-011: Worker Callback Endpoint Validates Authorization Header

| Field | Detail |
|---|---|
| **Test ID** | E-011 |
| **Title** | `POST /executions/update` from an unauthenticated caller is rejected |
| **Pre-conditions** | `PLATFORM_WORKER_CALLBACK_SECRET=correct-secret` set |
| **Steps** | `POST /executions/update` with `Authorization: Bearer wrong-secret` and a valid execution update payload |
| **Expected Result** | HTTP 401 or 403; execution status in DB is NOT updated; no Socket.io event broadcast |
| **Layer** | API |

---

### E-012: Security Headers Are Present on All Responses

| Field | Detail |
|---|---|
| **Test ID** | E-012 |
| **Title** | Production responses include hardened HTTP security headers |
| **Pre-conditions** | `NODE_ENV=production`; valid endpoint |
| **Steps** | `GET /health` or any API endpoint |
| **Expected Result** | Response headers include: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=...`, `Content-Security-Policy: ...`; `X-Powered-By` header is absent |
| **Layer** | API |

---

### E-013: Bulk Execution Operations Are Scoped to the Requesting Org

| Field | Detail |
|---|---|
| **Test ID** | E-013 |
| **Title** | `PATCH /api/executions/bulk` cannot update executions belonging to another organization |
| **Pre-conditions** | Org A has executions `[e1, e2]`; Org B has execution `[e3]`; Org A JWT |
| **Steps** | `PATCH /api/executions/bulk` with `{ ids: ["e1", "e3"], groupName: "new-group" }` using Org A's JWT |
| **Expected Result** | HTTP 200 (partial success); `e1` updated; `e3` is NOT updated (Org B's record untouched); `matchedCount` in DB reflects only 1 match; Org B's execution `groupName` unchanged |
| **Layer** | API |

---

### E-014: Invitation User Limit Enforcement Blocks Admin From Over-Inviting

| Field | Detail |
|---|---|
| **Test ID** | E-014 |
| **Title** | A Free-plan org with 3 active users cannot send a new invitation |
| **Pre-conditions** | Org on `free` plan; `limits.maxUsers: 3`; 3 active users exist |
| **Steps** | Admin: `POST /api/invitations` with `{ email: "4th@user.com", role: "viewer" }` |
| **Expected Result** | HTTP 403; `{ success: false, error: "..." }` with upgrade prompt; no email sent; no invitation created |
| **Layer** | API |

---

### E-015: Reports Directory Traversal Is Prevented

| Field | Detail |
|---|---|
| **Test ID** | E-015 |
| **Title** | A crafted `taskId` containing path traversal sequences cannot escape the org's reports directory |
| **Pre-conditions** | `REPORTS_DIR=/app/reports`; org `org-a`; attacker JWT for Org A |
| **Steps** | `GET /api/executions/../../../etc/passwd/artifacts` or craft a taskId with `../org-b/task-xyz` |
| **Expected Result** | HTTP 400 or 404; file system path is never constructed outside `<REPORTS_DIR>/<organizationId>/`; no arbitrary file system access granted |
| **Layer** | API |

---

## 8. Test Environment & Data Strategy

### 8.1 Environment Configuration

| Environment | Purpose | Infrastructure |
|---|---|---|
| **Unit** | Pure function/module testing | In-process only; no external services |
| **Integration** | API + DB interaction | `mongodb-memory-server`; mocked Redis (`ioredis-mock`); mocked RabbitMQ channel |
| **E2E** | Full stack browser tests | `docker-compose.yml` dev stack; Playwright headless |
| **Staging** | Pre-release validation | Full docker-compose.prod equivalent; Stripe test mode |

### 8.2 Test Data Seed Strategy

```typescript
// Seed organizations for isolation tests
const ORG_A = { _id: new ObjectId("000000000000000000000001"), name: "Org Alpha", plan: "free" };
const ORG_B = { _id: new ObjectId("000000000000000000000002"), name: "Org Beta", plan: "team" };

// Tokens scoped to each org (signed with test PLATFORM_JWT_SECRET)
const JWT_ORG_A_ADMIN = signJwt({ userId: "u1", organizationId: "000000000000000000000001", role: "admin" });
const JWT_ORG_B_VIEWER = signJwt({ userId: "u2", organizationId: "000000000000000000000002", role: "viewer" });
```

- **Seed before each suite**, not before each test — use `beforeAll` with teardown in `afterAll`
- **Isolation:** Each test suite uses distinct `organizationId` values to prevent cross-suite interference
- **Sensitive data:** Never use real Stripe keys, real Slack URLs, or real Jira tokens in test fixtures; use mocked services
- **Clock control:** Use `vi.useFakeTimers()` for all tests involving `expiresAt`, JWT `exp`, and CRON timing

### 8.3 Mocking Strategy

| Dependency | Mock Approach |
|---|---|
| MongoDB | `mongodb-memory-server` for API tests; `vi.fn()` for unit tests |
| Redis | `ioredis-mock` for API tests |
| RabbitMQ | `vi.fn()` channel spy for unit tests |
| Docker | `vi.mock('dockerode')` returning fake container objects |
| Gemini AI | `vi.mock('@google/generative-ai')` |
| Slack webhook | Mock `fetch` via `vi.spyOn(global, 'fetch')` |
| Stripe | `stripe-mock` local server or mocked webhook events |
| SendGrid | Mock `@sendgrid/mail` — verify `send()` called with correct params |

---

## 9. Tooling & CI Pipeline

### 9.1 Recommended Stack

| Tool | Purpose | Config Location |
|---|---|---|
| **Vitest** | Unit + API tests (ESM-native, TypeScript) | `vitest.config.ts` per service |
| **@faker-js/faker** | Realistic test data generation | Test fixtures |
| **mongodb-memory-server** | In-memory MongoDB for API tests | `globalSetup.ts` |
| **Playwright** | E2E browser tests + Socket.io assertions | `tests/playwright.config.ts` |
| **supertest** | HTTP-level API assertions within Vitest | API test helpers |
| **msw** (Mock Service Worker) | Frontend API mocking for React component tests | `src/__mocks__/` |

### 9.2 CI Pipeline (GitHub Actions)

```yaml
# Suggested CI stages (sequential, fast-fail)
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit --workspace=apps/producer-service
      - run: npm run test:unit --workspace=apps/worker-service

  api-tests:
    needs: unit-tests
    services:
      mongodb: { image: mongo:7 }
      redis: { image: redis:7 }
    steps:
      - run: npm run test:api --workspace=apps/producer-service

  e2e-tests:
    needs: api-tests
    services:
      # Full docker-compose dev stack
    steps:
      - run: docker-compose up -d --wait
      - run: npx playwright test
```

### 9.3 Coverage Targets

| Service | Target | Priority Modules |
|---|---|---|
| `producer-service` | 80% line coverage | `auth.ts`, `planLimits.ts`, `notifier.ts`, `organization.ts` |
| `worker-service` | 90% line coverage | `worker.ts` (status logic, blocklist, URL resolution), `analysisService.ts` |
| `dashboard-client` | 60% component coverage | `AuthContext`, `ExecutionDrawer`, `IntegrationsTab` |

---

## 10. Coverage Gaps & Known Risks

The following gaps represent areas where tests are currently missing or infrastructure makes testing difficult. These are ordered by risk.

| # | Severity | Gap | Test Recommendation |
|---|---|---|---|
| 1 | **P0** | No dead-letter queue for rejected RabbitMQ messages — permanent message loss if nack'd | Add `E-016`: Verify nack'd messages appear in a DLQ; implement DLQ before testing |
| 2 | **P0** | `logsBuffer` has no maximum size cap — OOM risk on verbose tests | Add `B-017`: Unit test asserting memory usage stays bounded for a 100MB log stream; implement a `MAX_LOG_BUFFER_SIZE` |
| 3 | **P1** | No Gemini API timeout configured — execution can get stuck in `ANALYZING` indefinitely | Add `C-010`: Mock `generateContent` to hang; assert `AbortController` timeout fires after N seconds |
| 4 | **P1** | Zero frontend tests (no Vitest/React Testing Library configured) | Add `vitest` + `@testing-library/react` to `dashboard-client`; start with `AuthContext` and `ExecutionDrawer` |
| 5 | **P1** | Socket.io CORS may be `"*"` — should match `ALLOWED_ORIGINS` | Add `E-017`: Assert Socket.io handshake fails for disallowed origins |
| 6 | **P2** | `ObjectId.isValid()` check not applied universally across all routes | Add `A-014` through `A-016`: Validate that malformed `_id` params in user, execution, and schedule routes return 400, not 500 |
| 7 | **P2** | `scheduler.ts` uses `console.error` instead of `app.log` | Add `E-018`: Assert no `console.error` calls reach stdout in production builds; enforce logging convention via ESLint rule |
| 8 | **P2** | `DASHBOARD_URL` env var not listed in `env.example` — Slack deep links may be broken in some environments | Add `D-015`: Integration test asserting Slack `deepLink` URL resolves to correct format when `DASHBOARD_URL` is unset |
| 9 | **P2** | Worker has no `SIGTERM` handler — graceful shutdown not implemented | Add `E-019`: Send `SIGTERM` to worker process; assert in-flight message is acked and connection is cleanly closed |
| 10 | **P3** | `StatsGrid` "Active Services" hardcoded to `"3"` — always misleading | Add UI test asserting the value reflects actual service health from `/health` endpoint |
| 11 | **P3** | `env.example` uses `MONGODB_URI` but docker-compose uses `MONGO_URI/MONGODB_URL` | Add `E-020`: Startup test asserting worker and producer each resolve the correct env variable with proper fallback chain |

---

*End of TEST_PLAN.md*
