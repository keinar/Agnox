# PROJECT_CONTEXT.md — Agnostic Automation Center

> Generated: 2026-02-21 | Current Phase: Sprint 7 — The Investigation Hub (V3 Architecture)
> Source: Full monorepo scan of code, docs, configs, and shared types.

---

## 1. Monorepo Structure Map

```
Agnostic-Automation-Center/
├── apps/
│   ├── producer-service/          # Fastify API server (port 3000)
│   │   ├── src/
│   │   │   ├── index.ts           # Entrypoint: Fastify + plugins + routes
│   │   │   ├── routes/            # All API route handlers
│   │   │   ├── middleware/        # auth.ts, rateLimiter.ts, planLimits.ts
│   │   │   ├── config/            # plans.ts, middleware.ts (security headers, global auth hook)
│   │   │   └── utils/             # audit-log.ts, password.ts, usage helpers
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker-service/            # Docker container orchestrator
│   │   ├── src/
│   │   │   ├── worker.ts          # RabbitMQ consumer, Docker orchestration (495 lines)
│   │   │   ├── analysisService.ts # Google Gemini AI integration (55 lines)
│   │   │   └── utils/logger.ts    # Pino structured logger (14 lines)
│   │   ├── Dockerfile             # node:20-slim + Java + Allure CLI
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── dashboard-client/          # React 19 SPA (port 8080 via nginx)
│   │   ├── src/
│   │   │   ├── App.tsx            # Router + QueryClient + AuthProvider
│   │   │   ├── context/           # AuthContext.tsx (JWT + user state)
│   │   │   ├── hooks/             # useExecutions, useDashboardData, useSettings
│   │   │   ├── pages/             # Login, Signup, Settings
│   │   │   ├── components/        # Dashboard, ExecutionRow, modals, settings tabs
│   │   │   └── types/             # index.ts (Execution, ExecutionConfig)
│   │   ├── Dockerfile
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── docs/                      # Docusaurus docs site (docker-compose.prod only)
│   └── promo-video/               # Marketing assets
│
├── packages/
│   └── shared-types/              # Zod schemas + TypeScript interfaces
│       ├── index.ts               # IOrganization, IUser, IExecution, IProject, etc.
│       └── package.json           # zod@4.2.1, mongodb@7.0.0
│
├── docs/                          # 20 markdown files across 6 subdirectories
│   ├── architecture/overview.md
│   ├── api/                       # authentication, organizations, invitations, users
│   ├── setup/                     # infrastructure, deployment, k8s, ci-cd, security-audit, email, troubleshooting
│   ├── features/                  # billing-guide, user-guide
│   ├── integration/               # quickstart, docker-setup
│   ├── deployment/                # stripe-production-checklist
│   └── system/                    # project-history-archive
│
├── migrations/                    # 5 migration files (001-004 + indexes)
│   ├── 001-add-organization-to-existing-data.ts
│   ├── 002-create-invitations-indexes.js
│   ├── 003-create-audit-logs-indexes.js
│   ├── 003-add-billing-fields.ts
│   └── 004-add-webhook-logs.ts
│
├── tests/                         # System sanity tests (Playwright)
│   └── legacy_archive/            # Archived test files
│
├── docker-compose.yml             # Dev: rabbitmq, redis, mongodb, producer, worker, dashboard
├── docker-compose.prod.yml        # Prod: + nginx-proxy-manager, docs site, redis persistence
├── Dockerfile.tests               # System sanity test runner
├── env.example                    # Environment variable template
├── package.json                   # Monorepo root (npm workspaces)
├── tsconfig.json                  # Root TypeScript config
└── CLAUDE.md                      # AI coding rules & conventions
```

---

## 2. Architecture & Product Features

### Service Topology

```
                  ┌──────────────┐
   Browser ─────► │  Dashboard   │ React 19 SPA (port 8080)
                  │  (nginx)     │
                  └──────┬───────┘
                         │ REST + Socket.io
                  ┌──────▼───────┐
                  │   Producer   │ Fastify API (port 3000)
                  │   Service    │
                  └──┬───┬───┬──┘
                     │   │   │
              ┌──────┘   │   └──────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │MongoDB │ │ Redis  │ │RabbitMQ│
         └────────┘ └────────┘ └───┬────┘
                                   │ test_queue
                              ┌────▼─────┐
                              │  Worker   │ Docker orchestration
                              │  Service  │
                              └────┬─────┘
                                   │ Docker socket
                              ┌────▼─────┐
                              │ Test      │ User's Docker image
                              │ Container │ /app/entrypoint.sh
                              └──────────┘
```

### Product Features (Phases 1-5 — All Complete)

| Phase | Feature | Key Implementation |
|-------|---------|-------------------|
| 1 | Multi-Tenant Foundation | Organization isolation, JWT auth, RBAC (admin/developer/viewer), migration 001 |
| 2 | User Management UI | Team invitations, role management, rate limiting (Redis), security headers, account lockout |
| 3 | Billing Integration | Stripe subscriptions (Free/Team/Enterprise), webhook processing, plan limit enforcement, usage alerts |
| 4 | Project Run Settings | Per-project Docker image, target URLs, test folder config, shared-types package |
| 5 | Email Integration | SendGrid transactional emails (invitations, welcome, payment events), console fallback |
| 6 | Enterprise UI Overhaul | Full Tailwind CSS migration (zero inline styles), GitHub-inspired semantic token palette (`gh-bg`, `gh-border`, etc.), `ThemeContext` with Light/Dark toggle, collapsible sidebar, version footer with Changelog modal, DateRangeFilter, responsive filter drawer |
| 7 (**In Progress**) | The Investigation Hub | Unified side-drawer (`ExecutionDrawer.tsx`) with URL-state deep-linking (`?drawerId=<taskId>`), 3-tab layout: Terminal / Artifacts / AI Analysis. `ArtifactsView.tsx` media gallery. ⚠️ Tasks 7.1–7.5 in progress; not yet committed. |

### Security Posture (Score: 92/100)

- JWT HS256 auth with 24h expiry + API key dual-auth
- bcrypt password hashing (10 salt rounds)
- SHA-256 hashed invitation tokens and API keys
- Redis-backed rate limiting (per-org + per-IP)
- Account lockout (5 failed attempts → 15min lock)
- Security headers (HSTS, X-Frame-Options, nosniff, XSS-Protection)
- Stripe webhook signature verification
- Audit logging for admin actions
- Soft deletion preserves billing accuracy

---

## 3. Fastify API Routes

### Authentication (`/api/auth/*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| POST | `/api/auth/signup` | Public | 5/min/IP | Register user + org OR accept invitation via `inviteToken` |
| POST | `/api/auth/login` | Public | 5/min/IP | Authenticate, return JWT. Lockout after 5 failures (15min) |
| GET | `/api/auth/me` | JWT | 100/min/org | Current user profile + organization details + limits |
| PATCH | `/api/auth/profile` | JWT | 100/min/org | Update user name |
| POST | `/api/auth/logout` | JWT | 100/min/org | Placeholder (client-side token removal) |
| POST | `/api/auth/api-keys` | JWT | 100/min/org | Generate API key (`pk_live_<hex>`), return full key once |
| GET | `/api/auth/api-keys` | JWT | 100/min/org | List API keys (prefix only) |
| DELETE | `/api/auth/api-keys/:id` | JWT | 100/min/org | Revoke API key |

### Users (`/api/users/*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| GET | `/api/users` | JWT | 100/min/org | List organization members |
| GET | `/api/users/:id` | JWT | 100/min/org | Get user details (404 for other orgs) |
| PATCH | `/api/users/:id/role` | Admin | 10/min/org | Change user role. Audited. Cannot change own/last admin. |
| DELETE | `/api/users/:id` | Admin | 10/min/org | Remove user. Audited. Cannot remove last admin. |

### Organization (`/api/organization*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| GET | `/api/organization` | JWT | 100/min/org | Org profile + plan + limits + user count |
| PATCH | `/api/organization` | Admin | 100/min/org | Update name, toggle `aiAnalysisEnabled`. Audited. |
| GET | `/api/organization/usage` | JWT | 100/min/org | Monthly usage: test runs, users, storage |
| GET | `/api/organization/usage/alerts` | JWT | 100/min/org | Usage warnings at 80%/90%/100% thresholds |

### Projects (`/api/projects*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| GET | `/api/projects` | JWT | 100/min/org | List org projects |
| POST | `/api/projects` | JWT + ProjectLimit | 100/min/org | Create project (free=1, team=10, enterprise=unlimited) |
| GET | `/api/projects/:projectId` | JWT | 100/min/org | Get project details |
| GET | `/api/projects/:projectId/settings` | JWT | 100/min/org | Get project run settings |
| PUT | `/api/projects/:projectId/settings` | JWT | 100/min/org | Update docker image, target URLs, test folder |
| GET | `/api/project-settings` | JWT | 100/min/org | Get first project's settings (dashboard fallback) |

### Invitations (`/api/invitations*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| POST | `/api/invitations` | Admin + UserLimit | 10/min/org | Send invitation email. Token SHA-256 hashed. 7-day expiry. |
| GET | `/api/invitations` | Admin | 100/min/org | List pending invitations |
| DELETE | `/api/invitations/:id` | Admin | 10/min/org | Revoke invitation |
| GET | `/api/invitations/validate/:token` | Public | 5/min/IP | Validate token, return org name + role |
| POST | `/api/invitations/accept` | JWT | 5/min/IP | Existing user joins org via invitation |

### Billing (`/api/billing/*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| GET | `/api/billing/plans` | Public | 100/min/IP | List plan tiers with features/prices |
| POST | `/api/billing/checkout` | Admin | 100/min/org | Create Stripe Checkout session |
| GET | `/api/billing/portal` | Admin | 100/min/org | Get Stripe Customer Portal URL |
| GET | `/api/billing/subscription` | Admin | 100/min/org | Current subscription details |
| POST | `/api/billing/cancel` | Admin | 100/min/org | Cancel at period end |

### Webhooks (`/api/webhooks/*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe Signature | None | Process: subscription.created/updated/deleted, invoice.payment_succeeded/failed |
| GET | `/api/webhooks/test` | Public | None | Webhook connectivity check |

### Executions (`/api/executions*` & `/executions/*`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| GET | `/api/executions` | JWT | 100/min/org | List org executions (last 50, excludes soft-deleted) |
| POST | `/api/execution-request` | JWT + TestRunLimit | 100/min/org | Queue test run to RabbitMQ. Zod-validated. |
| DELETE | `/api/executions/:id` | JWT | 100/min/org | Soft-delete (sets `deletedAt`) |
| POST | `/executions/update` | Internal (Worker) | None | Worker callback: status update → Socket.io broadcast |
| POST | `/executions/log` | Internal (Worker) | None | Worker callback: log line → Socket.io broadcast |
| GET | `/api/metrics/:image` | JWT | 100/min/org | Performance metrics (avg duration, regression detection) |

### Public / Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Service running check |
| GET | `/health` | Public | Pings MongoDB, Redis, RabbitMQ. Returns healthy/degraded. |
| GET | `/config/defaults` | Public | Default image, baseUrl, folder, env mapping |
| GET | `/api/tests-structure` | Public | Available test folders from `/app/tests-source` |

**Total: 44 endpoints**

---

## 4. MongoDB Schema

**Database:** `automation_platform`

### `organizations`

```
_id              ObjectId
name             String
slug             String (unique, lowercase, from name)
plan             'free' | 'team' | 'enterprise'
limits.maxTestRuns       Number
limits.maxProjects       Number
limits.maxUsers          Number
limits.maxConcurrentRuns Number
billing.stripeCustomerId       String | null
billing.stripeSubscriptionId   String | null
billing.status                 'active' | 'past_due' | 'unpaid'
billing.currentPeriodStart     Date | null
billing.currentPeriodEnd       Date | null
billing.cancelAtPeriodEnd      Boolean
billing.lastPaymentDate        Date | null
billing.lastPaymentAmount      Number | null
aiAnalysisEnabled  Boolean (default: true)
createdAt          Date
updatedAt          Date
```

### `users`

```
_id              ObjectId
email            String (unique, lowercase)
name             String
hashedPassword   String (bcrypt)
organizationId   ObjectId (FK → organizations)
role             'admin' | 'developer' | 'viewer'
status           'active' | 'suspended'
lastLoginAt      Date | null
createdAt        Date
updatedAt        Date
Indexes: { email: 1 }, { organizationId: 1 }
```

### `projects`

```
_id              ObjectId
organizationId   ObjectId (FK)
name             String
slug             String
description      String | null
createdAt        Date
updatedAt        Date
Index: { organizationId: 1, slug: 1 } (unique compound)
```

### `projectRunSettings`

```
_id              ObjectId
organizationId   String
projectId        String
dockerImage      String (trimmed)
targetUrls.dev       String
targetUrls.staging   String
targetUrls.prod      String
defaultTestFolder    String
updatedAt        Date
updatedBy        ObjectId (userId)
createdAt        Date
Index: { organizationId: 1, projectId: 1 } (unique compound)
```

### `executions`

```
_id              ObjectId
taskId           String (unique per execution)
organizationId   String
image            String (Docker image)
command          String
folder           String
status           'PENDING' | 'RUNNING' | 'ANALYZING' | 'PASSED' | 'FAILED' | 'UNSTABLE' | 'ERROR'
startTime        Date
endTime          Date | null
config.baseUrl       String
config.environment   String
config.envVars       Object
tests            Array<String>
output           String (full logs)
error            String | null
analysis         String | null (Gemini AI markdown)
reportsBaseUrl   String
hasNativeReport  Boolean
hasAllureReport  Boolean
aiAnalysisEnabled Boolean
deletedAt        Date | null (soft delete)
deletedBy        ObjectId | null
Indexes: { organizationId: 1 }, { organizationId: 1, startTime: -1 },
         { organizationId: 1, taskId: 1 }, { organizationId: 1, status: 1 }
```

### `invitations`

```
_id              ObjectId
organizationId   ObjectId (FK)
email            String (lowercase)
tokenHash        String (SHA-256 of 32-byte random token)
role             'admin' | 'developer' | 'viewer'
status           'pending' | 'accepted' | 'expired' | 'revoked'
expiresAt        Date (default: now + 7 days)
acceptedAt       Date | null
invitedBy        ObjectId (userId)
createdAt        Date
updatedAt        Date
Indexes: { organizationId: 1, email: 1 }, { tokenHash: 1 }
```

### `apiKeys`

```
_id              ObjectId
userId           ObjectId (FK)
organizationId   ObjectId (FK)
name             String (user-defined)
keyHash          String (SHA-256 of full key)
prefix           String (e.g. "pk_live_abc...")
createdAt        Date
lastUsed         Date | null
```

### `audit_logs`

```
_id              ObjectId
organizationId   ObjectId
userId           ObjectId
action           'ROLE_CHANGED' | 'USER_REMOVED' | 'ORG_UPDATED' | 'INVITATION_SENT'
targetType       'user' | 'organization' | 'invitation'
targetId         String
details          Object (old/new values)
ip               String
timestamp        Date
```

### `webhook_logs`

```
_id              ObjectId
eventId          String (Stripe event ID, unique)
eventType        String (e.g. 'customer.subscription.created')
organizationId   String | null
status           'success' | 'error'
error            String | null
payload          Object (Stripe event data)
createdAt        Date
processedAt      Date
```

**Total: 9 collections**

---

## 5. Frontend Routing Map

### Application Routes

| Route | Component | Protection | Description |
|-------|-----------|-----------|-------------|
| `/` | `Navigate → /dashboard` | — | Default redirect |
| `/login` | `Login` | Public | Email/password auth form |
| `/signup` | `Signup` | Public | Registration or invitation join |
| `/join` | `Signup` | Public | Alias for `/signup` with token |
| `/privacy` | `PrivacyPolicy` | Public | Privacy policy page |
| `/dashboard` | `Dashboard` | ProtectedRoute | Execution monitoring, stats, run modal |
| `/settings` | `Settings` | ProtectedRoute | Multi-tab settings (URL param `?tab=`) |

### Settings Tabs (`/settings?tab=<id>`)

| Tab ID | Component | Visibility | Description |
|--------|-----------|-----------|-------------|
| `profile` | ProfileTab | All roles | Edit name, manage API keys |
| `organization` | OrganizationTab | All roles | Org info, name (default tab) |
| `members` | MembersTab | All roles | Team members, invitations, role management |
| `billing` | BillingTab (lazy) | Admin only | Stripe plans, upgrade, portal, invoices |
| `security` | SecurityTab | All roles | AI analysis toggle, privacy disclosure |
| `usage` | UsageTab | All roles | Test runs, users, storage usage stats |
| `run-settings` | RunSettingsTab | All roles | Per-project docker image, URLs, test folder |

### Key Component Hierarchy

```
App
├── AuthProvider (JWT context)
│   └── BrowserRouter
│       ├── /login → Login (Tailwind semantic tokens, logo fade-in)
│       ├── /signup → Signup (invitation validation, 2 flows)
│       ├── /dashboard → ProtectedRoute → Dashboard
│       │   ├── DashboardHeader (sticky, mobile menu)
│       │   ├── StatsGrid (total runs, pass rate, active services)
│       │   ├── ExecutionModal (form: folder, env, URL, image)
│       │   └── ExecutionList
│       │       └── ExecutionRow[] (flat — click sets ?drawerId= URL param)
│       │           └── ⚠️ NEEDS REVIEW: Sprint 7 in progress — ExecutionDrawer.tsx (slide-over)
│       │               ├── TerminalView (tab 1, moved from inline accordion)
│       │               ├── ArtifactsView (tab 2, media gallery — 7B)
│       │               └── AIAnalysisView (tab 3, moved from portal modal)
│       └── /settings → ProtectedRoute → Settings
│           └── [7 tab components listed above]
```

### State Management

- **Auth**: React Context (`AuthContext`) — JWT in localStorage, user profile
- **Server state**: TanStack React Query v5 — executions cache, auto-invalidation
- **Real-time**: Socket.io client — `execution-updated` and `execution-log` events
- **No Redux/Zustand** — hooks-only architecture

---

## 6. API Key Flow

### Generation (Frontend → Backend)

```
ProfileTab.tsx                          POST /api/auth/api-keys
┌─────────────────┐                    ┌──────────────────────────┐
│ User enters name │───── { name } ───►│ 1. crypto.randomBytes(24)│
│ Clicks Generate  │                    │    → 48 hex chars        │
└─────────────────┘                    │ 2. fullKey = pk_live_<hex>│
                                       │ 3. keyHash = SHA-256(key)│
┌─────────────────┐                    │ 4. prefix = key[0:12]... │
│ Modal shows key  │◄── { apiKey } ────│ 5. Store: keyHash, prefix│
│ "Copy & close"   │   (full, once)    │ 6. Return full key       │
└─────────────────┘                    └──────────────────────────┘
```

### Validation (Backend Middleware)

```
Incoming request with x-api-key header
         │
         ▼
createApiKeyAuthMiddleware(db)
  1. Extract key from x-api-key header
  2. Hash: SHA-256(provided_key)
  3. Lookup in apiKeys collection by keyHash
  4. If not found → fall back to JWT auth
  5. If found → fetch user by apiKey.userId
  6. Verify user.status === 'active'
  7. Build request.user context (userId, organizationId, role)
  8. Update lastUsed timestamp (non-blocking)
```

### Mismatch Analysis

| Aspect | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Key format | Displays `pk_live_...` prefix | Generates `pk_live_<48-hex>` | Aligned |
| Storage | Not stored (shown once in modal) | SHA-256 hash only | Aligned |
| Copy UX | `navigator.clipboard.writeText()` | N/A | OK (requires HTTPS) |
| Revocation | DELETE with confirmation | Hard delete from DB | Aligned |
| List display | Shows prefix, name, dates | Returns prefix, name, dates | Aligned |
| Auth header | Not used by dashboard (uses JWT) | Reads `x-api-key` header | Aligned (key is for CI/CD) |
| Dual auth | Dashboard uses JWT only | Tries API key first, falls back to JWT | **No mismatch** |

**Verdict: Frontend and backend API key flows are fully aligned. No mismatches found.**

---

## 7. Environment Variables

### Producer Service

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_SECRET` | **CRITICAL** | `dev-secret-...` (exits in prod) | JWT signing key (64+ chars) |
| `JWT_EXPIRY` | No | `24h` | Token expiration |
| `PASSWORD_SALT_ROUNDS` | No | `10` | bcrypt rounds |
| `MONGODB_URL` / `MONGO_URI` | Yes | `mongodb://automation-mongodb:27017/automation_platform` | MongoDB connection |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis (rate limiting, metrics) |
| `RABBITMQ_URL` | Yes | `amqp://rabbitmq:5672` | RabbitMQ broker |
| `PORT` | No | `3000` | HTTP listen port |
| `NODE_ENV` | No | — | `production` enables HSTS, JWT check |
| `STRIPE_SECRET_KEY` | Prod | `sk_test_mock` | Stripe API key |
| `STRIPE_PUBLISHABLE_KEY` | Prod | `pk_test_mock` | Stripe public key |
| `STRIPE_WEBHOOK_SECRET` | Prod | `whsec_mock` | Webhook signature verification |
| `STRIPE_TEAM_PRICE_ID` | Prod | — | Stripe price ID for Team plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Prod | — | Stripe price ID for Enterprise |
| `SENDGRID_API_KEY` | No | `SG.mock` | Email service (fails silently if missing) |
| `FROM_EMAIL` | No | `noreply@automation.keinar.com` | Sender email address |
| `FROM_NAME` | No | `Agnostic Automation Center` | Sender display name |
| `FRONTEND_URL` | No | `http://localhost:8080` | Frontend URL for email links/redirects |
| `ALLOWED_ORIGINS` | Prod | `localhost:8080,localhost:5173,localhost:3000` | CORS origins |
| `DASHBOARD_URL` | No | `http://localhost:8080` | Dashboard URL |
| `DEFAULT_TEST_IMAGE` | No | — | Default Docker image for tests |
| `DEFAULT_BASE_URL` | No | — | Default test target URL |
| `DEFAULT_TEST_FOLDER` | No | `all` | Default test folder |
| `STAGING_URL` | No | — | Staging environment URL |
| `PRODUCTION_URL` | No | — | Production environment URL |
| `INJECT_ENV_VARS` | No | — | Comma-separated env var names to inject into test containers |
| `ADMIN_USER` | No | `admin@test.com` | Bootstrap admin email (dev) |
| `ADMIN_PASS` | No | `TestPass123!` | Bootstrap admin password (dev) |
| `REPORTS_DIR` | No | `/app/reports` | Reports storage directory |
| `GEMINI_API_KEY` | No | `mock_gemini` | Gemini API (for strict checks) |

### Worker Service

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGODB_URL` / `MONGO_URI` | Yes | `mongodb://localhost:27017` | MongoDB connection |
| `RABBITMQ_URL` | Yes | `amqp://localhost` | RabbitMQ broker |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis (performance metrics) |
| `PRODUCER_URL` | Yes | `http://producer:3000` | Producer API for callbacks |
| `GEMINI_API_KEY` | No | — | Google Gemini AI (optional) |
| `RUNNING_IN_DOCKER` | No | `false` | Enables localhost→host.docker.internal rewrite |
| `BASE_URL` | No | `http://host.docker.internal:3000` | Fallback test target URL |
| `PUBLIC_API_URL` | No | `http://localhost:3000` | Base URL for report links |
| `REPORTS_DIR` | No | `{cwd}/test-results` | Host reports directory |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `CI` | No | `true` | Passed to test containers |
| `GITHUB_COPILOT_API_KEY` | No | — | Unused dependency reference |

### Dashboard Client (Build-time)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_URL` | Yes | `http://localhost:3000` | Producer API URL |
| `VITE_STRIPE_TEAM_PRICE_ID` | Prod | — | Stripe Team price (frontend) |
| `VITE_STRIPE_ENTERPRISE_PRICE_ID` | Prod | — | Stripe Enterprise price (frontend) |

### Known Inconsistency

`env.example` uses `MONGODB_URI` but `docker-compose.yml` uses `MONGO_URI` / `MONGODB_URL`. The producer code accepts `MONGODB_URL` with fallback. The worker code accepts `MONGODB_URL` with `MONGO_URI` fallback.

---

## 8. Tailwind CSS Status

### Current State: **FULLY CONFIGURED**

Tailwind CSS is fully configured and integrated. The application uses a strict GitHub-inspired semantic token palette (`gh-bg`, `gh-border`, etc.) with full Dark Mode support via `ThemeContext`. Zero inline styles remain.

### CLAUDE.md Directive

CLAUDE.md mandates: **"Styling is STRICTLY Tailwind CSS (Pure CSS is deprecated. No inline styles)."** This directive is now fully enforced across the codebase.

---

## 9. Relevant Installed Packages

### Producer Service (`apps/producer-service/package.json`)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Framework** | `fastify` | ^5.6.2 | HTTP server |
| | `@fastify/cors` | ^11.2.0 | CORS |
| | `@fastify/static` | ^8.3.0 | Static file serving (reports) |
| | `fastify-raw-body` | ^5.0.0 | Raw body for Stripe signatures |
| | `fastify-socket.io` | ^5.1.0 | Socket.io integration |
| **Auth** | `jsonwebtoken` | ^9.0.3 | JWT sign/verify |
| | `bcrypt` | ^6.0.0 | Password hashing |
| **Database** | `mongodb` | ^7.0.0 | MongoDB driver |
| | `ioredis` | ^5.8.2 | Redis client |
| | `amqplib` | ^0.10.9 | RabbitMQ client |
| **Billing** | `stripe` | ^20.3.0 | Stripe SDK |
| **Email** | `@sendgrid/mail` | ^8.1.6 | SendGrid |
| **Validation** | `zod` | ^4.2.1 | Schema validation |
| **Env** | `dotenv` | ^17.2.3 | .env loading |

### Worker Service (`apps/worker-service/package.json`)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Docker** | `dockerode` | 4.0.9 | Docker SDK |
| **Queue** | `amqplib` | 0.10.9 | RabbitMQ client |
| **Database** | `mongodb` | 7.0.0 | MongoDB driver |
| **Cache** | `ioredis` | 5.8.2 | Redis (metrics) |
| **AI** | `@google/generative-ai` | 0.24.1 | Gemini API |
| **Logging** | `pino` | 10.3.0 | Structured JSON logs |
| | `pino-pretty` | 13.1.3 | Dev log formatting |
| **Archiving** | `tar-fs` | 2.0.4 | Report extraction from containers |
| **Unused** | `uuid` | 13.0.0 | Not referenced in code |
| **Unused** | `zod` | 4.2.1 | Imported but not used for validation |
| **Unused** | `@github/copilot-sdk` | 0.1.16 | Not referenced in code |

### Dashboard Client (`apps/dashboard-client/package.json`)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **UI** | `react` | ^19.2.0 | React 19 |
| | `react-dom` | ^19.2.0 | DOM rendering |
| | `lucide-react` | ^0.562.0 | SVG icon library |
| | `ansi-to-react` | ^6.1.6 | ANSI terminal colors |
| **Routing** | `react-router-dom` | ^7.13.0 | Client-side routing |
| **State** | `@tanstack/react-query` | ^5.90.12 | Server state + caching |
| **HTTP** | `axios` | ^1.13.2 | REST client |
| **Real-time** | `socket.io-client` | ^4.8.3 | WebSocket client |
| **Dates** | `date-fns` | ^4.1.0 | Date formatting |
| **Build** | `vite` | ^7.2.4 | Bundler |
| | `typescript` | ~5.9.3 | Type checking |

### Shared Types (`packages/shared-types/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `zod` | ^4.2.1 | Schema validation |
| `mongodb` | ^7.0.0 | ObjectId type |

### Notable Absences

| Category | Missing | Impact |
|----------|---------|--------|
| Scheduling | No cron/scheduler lib | No scheduled jobs exist |
| Encryption (secrets) | No AES library | CLAUDE.md says "AES-256-GCM for secrets" but no implementation exists yet |
| Testing (frontend) | No vitest/jest | Zero frontend tests |

---

## 10. Billing / Plan / Feature-Gating Logic

### Plan Definitions (from `src/config/plans.ts`)

| Feature | Free | Team ($99/mo) | Enterprise ($499/mo) |
|---------|------|---------------|---------------------|
| Test Runs / month | 100 | 1,000 | Unlimited |
| Projects | 1 | 10 | Unlimited |
| Team Members | 3 | 20 | Unlimited |
| Concurrent Runs | 1 | 5 | 20 |
| Storage | 1 GB | 10 GB | 100 GB |
| AI Analysis | Yes | Yes | Yes |
| Audit Logs | No | No | Yes |
| SSO | No | No | Future |
| Support | Community | Email | 24/7 Priority |

### Enforcement Middleware

| Middleware | Applied To | Blocks With |
|-----------|-----------|-------------|
| `createTestRunLimitMiddleware(db)` | `POST /api/execution-request` | 403 + `{ used, limit, percentUsed, upgradeUrl }` |
| `createProjectLimitMiddleware(db)` | `POST /api/projects` | 403 + upgrade prompt |
| `createUserLimitMiddleware(db)` | `POST /api/invitations` | 403 + upgrade prompt |

### Usage Tracking

- **Test runs**: Counted from `executions` collection (`startTime` within current month, excludes soft-deleted)
- **Users**: Counted from `users` collection (`status === 'active'` in org)
- **Storage**: Scanned from `/reports/{organizationId}/` directory on disk

### Usage Alerts (GET `/api/organization/usage/alerts`)

| Threshold | Level | Example Message |
|-----------|-------|-----------------|
| 80% | Info | "You're using 80% of your test run quota" |
| 90% | Warning | "You're nearing your test run limit" |
| 100%+ | Critical | "You've exceeded your test run limit" |

### Stripe Webhook Event Handling

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Update org plan + limits, store Stripe IDs, send welcome email |
| `customer.subscription.updated` | Update billing period, handle plan changes |
| `customer.subscription.deleted` | Downgrade to free plan, reset limits, email admins |
| `invoice.payment_succeeded` | Set `billing.status = 'active'`, record payment, send receipt |
| `invoice.payment_failed` | Set `billing.status = 'past_due'`, email failure notification |

### Downgrade Flow

```
Subscription canceled (Stripe webhook)
  → downgradeToFreePlan(db, organizationId)
    1. Set plan = 'free'
    2. Set limits = { maxTestRuns: 100, maxProjects: 1, maxUsers: 3, maxConcurrentRuns: 1 }
    3. Clear billing subscription data
    4. Email all org admins with cancellation notice
  → New executions blocked if monthly limit already exceeded
```

### Checkout Flow

```
Admin clicks "Upgrade" → POST /api/billing/checkout
  1. Find/create Stripe customer (org.billing.stripeCustomerId)
  2. Create Checkout Session (Team or Enterprise price ID)
  3. Return session URL → Frontend redirects to Stripe
  4. User completes payment on Stripe
  5. Stripe sends webhook: customer.subscription.created
  6. Producer processes webhook → updates org plan + limits
  7. Frontend refreshes billing tab → shows new plan
```

---

## Appendix: Known Gaps & Red Flags

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 1 | HIGH | Env Config | `env.example` uses `MONGODB_URI`, docker-compose uses `MONGO_URI`/`MONGODB_URL`. Inconsistent. |
| 2 | MEDIUM | Worker | Unused deps: `uuid`, `zod` (not used for validation), `@github/copilot-sdk`. |
| 3 | MEDIUM | Worker | No dead-letter queue for rejected RabbitMQ messages (permanent message loss). |
| 4 | MEDIUM | Worker | No Gemini API timeout (could hang indefinitely in ANALYZING state). |
| 5 | MEDIUM | Worker | Unbounded `logsBuffer` (no max size, memory risk on verbose tests). |
| 6 | MEDIUM | Frontend | No centralized API client (axios calls duplicated across all hooks/components). |
| 7 | MEDIUM | Frontend | Zero frontend tests (no vitest/jest config). |
| 8 | MEDIUM | Frontend | Socket.io CORS may be `"*"` — should match `ALLOWED_ORIGINS`. |
| 9 | MEDIUM | Security | AES-256-GCM encryption mentioned in CLAUDE.md but no implementation exists. |
| 10 | LOW | Frontend | `StatsGrid` "Active Services" hardcoded to `"3"`. |
| 11 | LOW | Docs | `/api/projects`, `/api/projectRunSettings`, `/api/execution-request` POST body not documented in `docs/api/`. |
| 12 | LOW | Worker | No graceful shutdown handler (`SIGTERM` not caught). |
| 13 | LOW | Worker | ObjectId parsing without `ObjectId.isValid()` check. |
