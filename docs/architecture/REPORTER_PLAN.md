# Agnox Reporter — Passive Ingestion System (v4.0)

**Author:** Claude Code (Senior Architect Mode)
**Date:** 2026-03-01
**Status:** DRAFT — Pending approval before implementation

---

## 0. Vision & Motivation

Agnox currently operates as an **Active Runner**: it provisions Docker containers, executes tests,
and streams results. v4.0 extends Agnox into a **Central Quality Hub** by adding a
**Passive Reporter** channel: developers run tests *anywhere* (GitHub Actions, local CI, Jenkins)
and stream live results into the Agnox Dashboard in real-time — no Docker container required.

```
BEFORE (Active Runner only)
  Agnox → pulls Docker image → runs tests → streams logs back

AFTER (Active Runner + Passive Reporter)
  Agnox ← receives events from external runner (GitHub Actions, local CLI, Jenkins)
  The UI updates in real-time exactly as it does for hosted runs.
```

---

## 1. Architecture Overview

### 1.1 New Concepts

| Concept | Description |
|---|---|
| **Ingest Session** | A stateful handle for one external test run. Lives in Redis during the run, persisted to MongoDB at teardown. |
| **Ingest Event** | A batched payload of log lines, test results, or status updates sent during an active session. |
| `@agnox/playwright-reporter` | Official NPM package. Implements Playwright's `Reporter` interface and calls the Ingest API. |

### 1.2 Data Flow

```
GitHub Actions (Playwright run)
  │
  ├─ POST /api/ingest/setup        → creates Session + TestCycle + Execution in Mongo
  │    └─ returns { sessionId }
  │
  ├─ POST /api/ingest/event (batched, every 2s)
  │    ├─ appends to Redis  live:logs:{taskId}
  │    └─ emits Socket.IO  execution-log  →  Dashboard (live terminal)
  │
  └─ POST /api/ingest/teardown
       ├─ writes final test results to Execution document
       ├─ updates TestCycle summary
       └─ emits Socket.IO  execution-updated  →  Dashboard (status badge)
```

### 1.3 Authentication for Ingest Endpoints

The ingest API uses the **existing API key system** (`x-api-key` header +
`createApiKeyAuthMiddleware()`), identical to `/api/ci/trigger`.
The `projectId` is sent in the request body at setup time and stored in the session.
No JWT is required — this is designed for non-interactive CI environments.

---

## Phase 1 — Backend Architecture & Ingestion API

### Overview

Create three new HTTP endpoints under `/api/ingest/*`. Each endpoint is stateless
at the HTTP layer; session state is maintained in Redis for sub-millisecond lookups
during the high-frequency event stream.

### 1.1 Migration — `migrations/008-add-ingest-support.ts` (NEW)

```typescript
// Adds:
// 1. `source` field to `executions` collection
//    Values: 'agnox-hosted' | 'external-ci'
//    Default for existing rows: 'agnox-hosted'
// 2. `ingest_sessions` collection with indexes

db.collection('executions').updateMany(
  { source: { $exists: false } },
  { $set: { source: 'agnox-hosted' } }
);

db.createCollection('ingest_sessions');
db.collection('ingest_sessions').createIndexes([
  { key: { sessionId: 1 }, unique: true },
  { key: { organizationId: 1, createdAt: -1 } },
  { key: { taskId: 1 }, unique: true },
  { key: { createdAt: 1 }, expireAfterSeconds: 604800 } // auto-purge after 7 days
]);
```

**Why a dedicated collection?** Ingest sessions carry metadata (reporter version,
framework, total test count) that doesn't fit cleanly into the existing `executions`
schema. Keeping it separate avoids polluting the hot `executions` collection.

---

### 1.2 Shared Types — `packages/shared-types/src/index.ts` (MODIFY)

Add the following interfaces:

```typescript
// New source discriminator on existing IExecution
export interface IExecution {
  // ... existing fields ...
  source: 'agnox-hosted' | 'external-ci';
  ingestMeta?: IIngestMeta;  // only present when source === 'external-ci'
}

export interface IIngestMeta {
  sessionId: string;
  reporterVersion: string;
  framework: 'playwright' | 'jest' | 'vitest' | 'cypress';
  totalTests: number;
  ciContext?: ICiContext;  // reuse existing type from shared-types
}

export interface IIngestSession {
  sessionId: string;           // UUID v4, returned to reporter
  organizationId: string;
  projectId: string;
  taskId: string;              // links to executions collection
  cycleId: string;             // links to test_cycles collection
  cycleItemId: string;
  projectName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  framework: string;
  reporterVersion: string;
  totalTests: number;
  startTime: Date;
  createdAt: Date;
}

// Event payload shape (what the reporter POSTs in batches)
export interface IIngestEventBatch {
  sessionId: string;
  events: IIngestEvent[];
}

export type IIngestEvent =
  | { type: 'log';       testId?: string; chunk: string; timestamp: number }
  | { type: 'test-begin'; testId: string; title: string; file: string; timestamp: number }
  | { type: 'test-end';   testId: string; status: 'passed' | 'failed' | 'skipped' | 'timedOut';
      duration: number; error?: string; timestamp: number }
  | { type: 'status';    status: 'RUNNING' | 'ANALYZING'; timestamp: number };
```

---

### 1.3 Ingest Routes — `apps/producer-service/src/routes/ingest.ts` (NEW)

This is the core of Phase 1. Three endpoints, all under `/api/ingest`.

#### `POST /api/ingest/setup`

**Purpose:** Called once at the start of a test run. Creates all necessary DB records
and returns a `sessionId` that the reporter includes on every subsequent request.

**Request body:**
```typescript
{
  projectId: string;
  runName?: string;                // e.g. "PR #42 — feature/auth"
  framework: 'playwright' | 'jest' | 'vitest' | 'cypress';
  reporterVersion: string;
  totalTests: number;
  environment?: 'development' | 'staging' | 'production';
  ciContext?: {
    source: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'local';
    repository?: string;
    branch?: string;
    prNumber?: number;
    commitSha?: string;
    runUrl?: string;              // link back to the CI job
  };
}
```

**Implementation steps:**
1. Validate body with Zod.
2. Auth: `createApiKeyAuthMiddleware()` injects `request.user` (existing pattern from CI trigger).
3. Verify project belongs to caller's `organizationId` (same security check as `/api/ci/trigger`).
4. Generate IDs:
   ```typescript
   const sessionId  = crypto.randomUUID();
   const taskId     = `ingest-${Date.now()}-${sessionId.slice(0, 8)}`;
   const cycleId    = new ObjectId().toString();
   const cycleItemId = crypto.randomUUID();
   ```
5. Create `TestCycle` document (reuse pattern from `test-cycles.ts`):
   - `name`: `runName ?? \`External CI — ${new Date().toISOString()}\``
   - `source`: `'external-ci'`
   - `ciContext`: from request body
6. Create `Execution` document:
   - `image`: `'external-ci'` (sentinel — no Docker image for passive runs)
   - `source`: `'external-ci'`
   - `status`: `'RUNNING'`
   - `ingestMeta`: `{ sessionId, reporterVersion, framework, totalTests, ciContext }`
7. Store session in Redis:
   ```
   SET ingest:session:{sessionId}  {JSON}  EX 86400   (24h TTL)
   ```
8. Broadcast via Socket.IO to `org:{organizationId}`:
   - Event: `execution-updated` with the new Execution document.
9. Return `201 { success: true, data: { sessionId, taskId, cycleId } }`.

**Failure modes to handle:**
- Project not found / wrong org → `403 Forbidden`
- Redis unavailable → still proceed, session stored in-memory Map as fallback (TTL 4h)

---

#### `POST /api/ingest/event`

**Purpose:** Called repeatedly during the test run (batched by reporter every 2s or
50 events). Streams logs and test results into the live pipeline.

**Request body:** `IIngestEventBatch` (see shared types above).

**Implementation steps:**
1. Validate body with Zod.
2. Resolve session from Redis:
   ```typescript
   const raw = await redis.get(\`ingest:session:\${sessionId}\`);
   if (!raw) return reply.status(404).send({ success: false, error: 'Session not found or expired' });
   const session: IIngestSession = JSON.parse(raw);
   ```
3. Process each event in the batch:
   - **`log`**: Append to `live:logs:{taskId}` in Redis (identical to worker callback pattern in `middleware.ts`). Emit `execution-log` on Socket.IO room `org:{session.organizationId}`.
   - **`test-begin`**: No persistence needed (UI reflects via Socket.IO only).
   - **`test-end`**: Buffer result in Redis list `ingest:results:{sessionId}` (RPUSH). Emit `execution-log` with formatted result line.
   - **`status`**: Emit `execution-updated` with new status to the org room.
4. Return `200 { success: true }` immediately (fire-and-forget pattern — don't block the reporter).

**Performance note:** This endpoint will be called frequently. Keep it lean:
- Single Redis pipeline call per batch (MULTI/EXEC).
- No DB writes during event streaming.

---

#### `POST /api/ingest/teardown`

**Purpose:** Called once when the test suite finishes. Finalizes all records.

**Request body:**
```typescript
{
  sessionId: string;
  status: 'PASSED' | 'FAILED';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;   // total run duration in ms
  };
}
```

**Implementation steps:**
1. Resolve session from Redis.
2. Drain `ingest:results:{sessionId}` list (LRANGE + DEL).
3. Build `tests` array from buffered results (same shape as worker's result payload).
4. Update `Execution` document:
   - `status`: `body.status === 'PASSED' ? 'PASSED' : 'FAILED'`
   - `endTime`: `new Date()`
   - `tests`: the drained results array
   - `output`: LRANGE from `live:logs:{taskId}` (for permanent log storage)
5. Update `TestCycle` summary and status.
6. Write finalized `IngestSession` to `ingest_sessions` MongoDB collection (for audit).
7. Clean up Redis keys: `DEL live:logs:{taskId}` and `DEL ingest:results:{sessionId}`.
8. Emit `execution-updated` with final status to `org:{organizationId}`.
9. Return `200 { success: true, data: { taskId, status } }`.

---

### 1.4 Route Registration — `apps/producer-service/src/config/routes.ts` (MODIFY)

```typescript
// Add import at top
import { ingestRoutes } from '../routes/ingest.js';

// Inside registerRoutes(), add after ciRoutes registration:
await ingestRoutes(app);
app.log.info('Ingest routes registered');
```

### 1.5 Middleware Update — `apps/producer-service/src/config/middleware.ts` (MODIFY)

Add `/api/ingest/` to the **`apiKeyOnlyPaths`** list (a new concept — paths that skip
JWT but still require `x-api-key`). This is already how `/api/ci/trigger` works via
`createApiKeyAuthMiddleware()` called inside the route handler; keep the same pattern.

No changes to `publicPrefixes` — ingest endpoints are NOT public.

---

## Phase 2 — The NPM Package (`@agnox/playwright-reporter`)

### Overview

A zero-dependency (except `@playwright/test` as a peer dep) NPM package that
any Playwright user can install and add to their `playwright.config.ts` in minutes.

### 2.1 Package Scaffold — `packages/playwright-reporter/` (NEW)

```
packages/playwright-reporter/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── src/
│   ├── index.ts          # Main export: AgnoxReporter class
│   ├── client.ts         # HTTP client with retry + graceful failure
│   ├── batcher.ts        # Event queue with time + size flush triggers
│   └── types.ts          # Reporter config + internal types
├── dist/                 # Built output (gitignored)
└── README.md
```

### 2.2 `packages/playwright-reporter/package.json`

```json
{
  "name": "@agnox/playwright-reporter",
  "version": "1.0.0",
  "description": "Official Playwright reporter for Agnox — stream live test results to your dashboard",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch"
  },
  "peerDependencies": {
    "@playwright/test": ">=1.40.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.51.0",
    "typescript": "^5.4.0"
  },
  "keywords": ["playwright", "reporter", "agnox", "testing", "ci"],
  "license": "MIT"
}
```

### 2.3 Reporter Config — `packages/playwright-reporter/src/types.ts`

```typescript
export interface AgnoxReporterConfig {
  /** Your Agnox API key (from Settings → API Keys) */
  apiKey: string;
  /** The Agnox Project ID to associate this run with */
  projectId: string;
  /** Agnox API base URL (default: https://app.agnox.io) */
  baseUrl?: string;
  /** Human-readable name for this run (e.g. "PR #42 smoke tests") */
  runName?: string;
  /** Target environment */
  environment?: 'development' | 'staging' | 'production';
  /** Batch flush interval in ms (default: 2000) */
  flushIntervalMs?: number;
  /** Max events per batch (default: 50) */
  maxBatchSize?: number;
  /** Whether to log Agnox activity to stdout (default: false) */
  debug?: boolean;
}
```

### 2.4 HTTP Client — `packages/playwright-reporter/src/client.ts`

**Key design principle:** The reporter MUST NOT crash the user's test suite.
Every network call is wrapped in try/catch. Failures are silently logged to stderr.

```typescript
export class AgnoxClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly debug: boolean;

  constructor(config: AgnoxReporterConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://app.agnox.io').replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    };
    this.debug = config.debug ?? false;
  }

  async setup(payload: SetupPayload): Promise<SetupResponse | null> {
    return this.post('/api/ingest/setup', payload);
  }

  async sendEvents(batch: EventBatch): Promise<void> {
    await this.post('/api/ingest/event', batch);
  }

  async teardown(payload: TeardownPayload): Promise<void> {
    await this.post('/api/ingest/teardown', payload);
  }

  private async post<T>(path: string, body: unknown, attempt = 1): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),   // 10s timeout per request
      });
      if (!res.ok) {
        this.log(`[agnox] HTTP ${res.status} on ${path}`);
        return null;
      }
      return res.json() as T;
    } catch (err) {
      // Retry once on network error (not on 4xx/5xx)
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000));
        return this.post<T>(path, body, attempt + 1);
      }
      this.log(`[agnox] Failed to reach Agnox (${path}): ${String(err)}`);
      return null;    // Graceful degradation — never throws
    }
  }

  private log(msg: string) {
    if (this.debug) process.stderr.write(msg + '\n');
  }
}
```

**Why `fetch` instead of `axios`?** Node.js 18+ ships native `fetch`. This keeps the
package truly zero-dependency at runtime.

### 2.5 Event Batcher — `packages/playwright-reporter/src/batcher.ts`

```typescript
export class EventBatcher {
  private queue: IIngestEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly onFlush: (events: IIngestEvent[]) => Promise<void>;

  constructor(config: { flushIntervalMs: number; maxBatchSize: number;
    onFlush: (events: IIngestEvent[]) => Promise<void> }) {
    this.flushIntervalMs = config.flushIntervalMs;
    this.maxBatchSize    = config.maxBatchSize;
    this.onFlush         = config.onFlush;
  }

  push(event: IIngestEvent): void {
    this.queue.push(event);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();  // size-based trigger
    }
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);          // drain atomically
    await this.onFlush(batch).catch(() => {});   // swallow errors
  }

  async drain(): Promise<void> {
    await this.flush();
  }
}
```

### 2.6 Main Reporter Class — `packages/playwright-reporter/src/index.ts`

```typescript
import type { Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { AgnoxClient } from './client.js';
import { EventBatcher } from './batcher.js';
import type { AgnoxReporterConfig } from './types.js';

export default class AgnoxReporter implements Reporter {
  private client: AgnoxClient;
  private batcher: EventBatcher;
  private sessionId: string | null = null;
  private taskId: string | null = null;
  private cfg: Required<AgnoxReporterConfig>;

  constructor(config: AgnoxReporterConfig) {
    // Validate required config
    if (!config.apiKey)    throw new Error('[agnox] apiKey is required');
    if (!config.projectId) throw new Error('[agnox] projectId is required');

    this.cfg = {
      baseUrl: 'https://app.agnox.io',
      runName: undefined,
      environment: 'production',
      flushIntervalMs: 2000,
      maxBatchSize: 50,
      debug: false,
      ...config,
    };

    this.client = new AgnoxClient(this.cfg);
    this.batcher = new EventBatcher({
      flushIntervalMs: this.cfg.flushIntervalMs,
      maxBatchSize: this.cfg.maxBatchSize,
      onFlush: async (events) => {
        if (!this.sessionId) return;
        await this.client.sendEvents({ sessionId: this.sessionId, events });
      },
    });
  }

  // Called once — the full test suite tree is available here
  async onBegin(config: unknown, suite: Suite): Promise<void> {
    const ciContext = detectCiContext();    // reads standard CI env vars
    const res = await this.client.setup({
      projectId: this.cfg.projectId,
      runName: this.cfg.runName,
      framework: 'playwright',
      reporterVersion: PACKAGE_VERSION,
      totalTests: suite.allTests().length,
      environment: this.cfg.environment,
      ciContext,
    });
    if (res?.data) {
      this.sessionId = res.data.sessionId;
      this.taskId    = res.data.taskId;
    }
    // If setup fails, reporter silently becomes a no-op (sessionId stays null)
  }

  onTestBegin(test: TestCase): void {
    this.batcher.push({
      type: 'test-begin',
      testId: test.id,
      title: test.titlePath().join(' › '),
      file: test.location.file,
      timestamp: Date.now(),
    });
  }

  onStdOut(chunk: string | Buffer, test?: TestCase): void {
    this.batcher.push({
      type: 'log',
      testId: test?.id,
      chunk: chunk.toString(),
      timestamp: Date.now(),
    });
  }

  onStdErr(chunk: string | Buffer, test?: TestCase): void {
    this.batcher.push({
      type: 'log',
      testId: test?.id,
      chunk: `[stderr] ${chunk.toString()}`,
      timestamp: Date.now(),
    });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.batcher.push({
      type: 'test-end',
      testId: test.id,
      status: result.status,
      duration: result.duration,
      error: result.errors[0]?.message,
      timestamp: Date.now(),
    });
  }

  async onEnd(result: { status: 'passed' | 'failed' | 'interrupted' | 'timedout' }): Promise<void> {
    await this.batcher.drain();   // flush remaining events first
    if (!this.sessionId) return;
    await this.client.teardown({
      sessionId: this.sessionId,
      status: result.status === 'passed' ? 'PASSED' : 'FAILED',
      summary: { /* aggregated from onTestEnd events */ },
    });
  }
}

// Reads standard environment variables set by GitHub Actions, GitLab CI, etc.
function detectCiContext() { /* ... */ }

const PACKAGE_VERSION = '__PACKAGE_VERSION__';   // replaced at build time
```

### 2.7 User Configuration (in `playwright.config.ts`)

```typescript
import AgnoxReporter from '@agnox/playwright-reporter';

export default defineConfig({
  reporter: [
    ['list'],    // keep the local output
    [AgnoxReporter, {
      apiKey:    process.env.AGNOX_API_KEY,
      projectId: process.env.AGNOX_PROJECT_ID,
      runName:   `PR #${process.env.GITHUB_PR_NUMBER}`,
      debug:     true,
    }],
  ],
});
```

### 2.8 Monorepo Integration — Root `package.json` (MODIFY)

Add to `workspaces`:
```json
"workspaces": [
  "apps/*",
  "packages/*"    // already includes packages/playwright-reporter
]
```

---

## Phase 3 — Real-time Sync & WebSocket Integration

### Overview

The ingest API reuses the **existing** Redis and Socket.IO pipeline. No new
infrastructure is needed. This phase documents the exact integration points
and ensures the ingest events arrive in the UI identically to hosted runs.

### 3.1 Log Streaming (already covered in Phase 1 implementation)

The `/api/ingest/event` handler uses the same pattern as the worker callback
in `middleware.ts`:

| Concern | Hosted Run (Worker) | External CI (Ingest) |
|---|---|---|
| Log write key | `live:logs:{taskId}` | `live:logs:{taskId}` (same) |
| Socket event | `execution-log` | `execution-log` (same) |
| Socket room | `org:{orgId}` | `org:{orgId}` (same) |
| Status event | `execution-updated` | `execution-updated` (same) |

Because the key names and Socket.IO events are identical, the `ExecutionDrawer`
and live terminal work with **zero frontend changes** for log streaming.

### 3.2 Log Hydration on Reconnect

The existing `GET /api/executions/:taskId/logs` endpoint reads from
`live:logs:{taskId}` in Redis (and falls back to `executions.output` in Mongo
for completed runs). This **already works** for ingest sessions because Phase 1
writes to the same Redis key. No changes needed.

### 3.3 Session Expiry Edge Case

If the CI job is killed and teardown is never called, the Redis keys expire
naturally (24h for session, 4h for live logs). A cleanup cron job (or a simple
Mongo TTL index on `ingest_sessions.createdAt`, added in migration 008) will
mark orphaned executions as `CANCELLED` after 24h.

**File to modify:** `apps/producer-service/src/config/server.ts`
Add a `setInterval` (or use the existing schedule service) to find `RUNNING`
ingest executions older than 24h and mark them `CANCELLED`.

---

## Phase 4 — Frontend Updates

### Overview

Four targeted UI changes. No new pages required.

### 4.1 Execution Type Badge — `apps/dashboard-client/src/components/ExecutionRow.tsx` (MODIFY)

Add a small source indicator next to the execution title:

```tsx
// Helper (add near top of file)
function SourceBadge({ source, ciContext }: { source: IExecution['source']; ciContext?: ICiContext }) {
  if (source !== 'external-ci') return null;
  const icons: Record<string, string> = {
    github: '🔗',   // replace with actual SVG icon component
    gitlab: '🦊',
    azure: '☁️',
    jenkins: '⚙️',
    local: '💻',
  };
  const label = ciContext?.source ?? 'External CI';
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
      {icons[label] ?? '🔗'} {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}
```

Usage in the row JSX:
```tsx
<SourceBadge source={execution.source} ciContext={execution.ingestMeta?.ciContext} />
```

### 4.2 CI Context Panel — `apps/dashboard-client/src/components/ExecutionDrawer.tsx` (MODIFY)

When `execution.source === 'external-ci'`, render a collapsible "CI Context" panel
above the terminal in the drawer, showing:

```
Repository:   myorg/my-repo
Branch:       feature/auth
PR:           #42
Commit:       a1b2c3d
CI Run URL:   [View in GitHub Actions ↗]
Framework:    Playwright v1.51.0
Reporter:     @agnox/playwright-reporter v1.0.0
Total Tests:  142
```

Implementation: read `execution.ingestMeta` and `execution.ingestMeta.ciContext`.
No API changes needed — these fields are already part of the Execution document
after Phase 1.

### 4.3 Source Filter — `apps/dashboard-client/src/components/FilterBar.tsx` (MODIFY)

Add a "Source" filter dropdown alongside the existing Status/Environment filters:

```tsx
<select
  value={filters.source ?? 'all'}
  onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
  className="..."
>
  <option value="all">All Sources</option>
  <option value="agnox-hosted">Agnox Hosted</option>
  <option value="external-ci">External CI</option>
</select>
```

Pass `source` filter to the `/api/executions` query param, and add the MongoDB
filter in `routes.ts` execution list handler.

### 4.4 Type Updates — `apps/dashboard-client/src/types/index.ts` (MODIFY)

Extend `IExecution` with:
```typescript
source: 'agnox-hosted' | 'external-ci';
ingestMeta?: {
  sessionId: string;
  reporterVersion: string;
  framework: string;
  totalTests: number;
  ciContext?: {
    source: string;
    repository?: string;
    branch?: string;
    prNumber?: number;
    commitSha?: string;
    runUrl?: string;
  };
};
```

---

## Phase 5 — Documentation & User Guide

### 5.1 Files to Create

| File | Purpose |
|---|---|
| `packages/playwright-reporter/README.md` | Full user guide with install, config, and CI examples |
| `docs/features/PASSIVE_REPORTER.md` | Internal architecture notes |

### 5.2 `packages/playwright-reporter/README.md` — Key Sections

```markdown
## Installation
npm install @agnox/playwright-reporter --save-dev

## Quick Setup (30 seconds)
1. Get your API key from Agnox → Settings → API Keys
2. Get your Project ID from Agnox → Projects
3. Add to playwright.config.ts (see below)
4. Set AGNOX_API_KEY in your CI secrets

## GitHub Actions Example
- name: Run Playwright Tests
  env:
    AGNOX_API_KEY: ${{ secrets.AGNOX_API_KEY }}
    AGNOX_PROJECT_ID: your-project-id
  run: npx playwright test

## What Gets Synced
- Live log stream (visible in Agnox Terminal as tests run)
- Per-test pass/fail status with duration
- Automatic CI context (repo, branch, PR number, commit SHA)
- Final summary with overall pass/fail

## Privacy & Security
- Only stdout/stderr is sent (no environment variables)
- All data is scoped to your organization
- API key only requires Write access to the project
```

### 5.3 Changelog Update — `CHANGELOG.md` (MODIFY)

Add v4.0.0 entry:
```markdown
## [4.0.0] — 2026-03-XX

### Added
- **Passive Ingestion System**: Stream external CI test results directly into Agnox
- **`@agnox/playwright-reporter`**: Official NPM package for Playwright integration
- New ingest API endpoints: `POST /api/ingest/setup|event|teardown`
- External CI badge and CI context panel in execution drawer
- Source filter (Agnox Hosted / External CI) in dashboard filter bar

### Changed
- `executions` collection: new `source` field (`agnox-hosted` | `external-ci`)
- Migration 008 required before deployment
```

---

## Implementation Order & Dependencies

```
Migration 008 (must go first — adds DB fields)
    ↓
Shared Types update (needed by both backend and reporter)
    ↓
Backend Ingest Routes (Phase 1)         ← can parallelize with ↓
    ↓                                   ↓
NPM Package (Phase 2)           Frontend Types (Phase 4.4)
    ↓                                   ↓
Integration testing          Frontend Badge + Drawer (Phase 4.1–4.3)
    ↓
Documentation (Phase 5)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| High-frequency `/api/ingest/event` overwhelms producer | Medium | High | Redis pipeline (MULTI/EXEC), return 200 immediately, async Socket.IO emit |
| Reporter crashes user's test suite | Low | Critical | Every network call is try/catch; sessionId=null → reporter becomes no-op |
| Session expires mid-run (>24h test suite) | Low | Medium | Extend TTL on every `/event` call; warn in reporter if session is near expiry |
| `external-ci` executions confuse existing worker logic | Medium | Medium | `source` field check: worker only processes `agnox-hosted` executions |
| Port collision if `image: 'external-ci'` breaks UI filters | Low | Low | Add `source` filter before any image-based filtering in frontend |

---

## Open Questions (Resolve Before Coding)

1. **Rate limiting for `/api/ingest/event`**: Should it use `strictRateLimit` or a
   new `ingestRateLimit` tier (higher burst allowance since reporters batch events)?
   *Recommendation: new tier — 500 req/min per API key.*

2. **Multi-file parallelism**: Playwright runs tests in parallel workers. Each worker
   produces its own stdout. The reporter's `onStdOut` interleaves these. Is that OK,
   or do we want per-file sub-executions?
   *Recommendation: v1 — single interleaved stream. v2 — per-worker sub-executions.*

3. **Artifact support**: Playwright screenshots/videos — should v1 support uploading
   artifacts via a `POST /api/ingest/artifact` endpoint?
   *Recommendation: defer to v4.1.*

4. **Other reporters**: Should v1 include a Jest/Vitest reporter as well?
   *Recommendation: defer. Playwright is the highest-demand target.*

5. **Public NPM vs private registry**: Publish to `npmjs.com` (public) or keep
   internal? *Recommendation: public — it's a growth driver.*

---

*End of plan. Ready for review and sprint planning.*
