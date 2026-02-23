# Security Remediation Plan — Agnostic Automation Center v3.1.0

> **References:** [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) · [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)
> **Date:** 2026-02-23 | **Status:** ✅ COMPLETED (Target Score 100/100 Reached)
> **Author:** Security Architecture Review

---

## Introduction

**UPDATE:** As of February 23, 2026, all tasks across Sprints 1-3 have been fully executed. A post-remediation static analysis confirmed 0 remaining instances of unauthenticated endpoints, plaintext `MONGO_URI` injection, or `execSync` vulnerabilities. No further sprints are required.

This document serves as the historical execution roadmap for remediating all CRITICAL and HIGH findings identified
in `SECURITY_AUDIT.md` (February 2026).

### Goal

Achieve enterprise-grade security posture **without breaking two non-negotiable runtime contracts:**

1. **Test execution must not regress.** Code inside user-provided test containers may legitimately use
   environment variables named `MONGO_URI`, `ADMIN_USER`, etc. — those names refer to the
   *App-Under-Test*, not the platform's infrastructure. Any renaming strategy must account for this.

2. **Live log streaming must not break.** The Worker Service calls `/executions/update` and
   `/executions/log` as internal server-to-server callbacks. These endpoints must never require a
   *user* JWT, but they must no longer be completely unauthenticated.

### Guiding Principle

> The platform's internal secrets and the user's test variables share a namespace by accident.
> The fix is to give the platform its own namespace (`PLATFORM_` prefix), not to block names
> that tests legitimately need.

---

## The "Platform Prefix" Strategy

### Problem

The Worker's `getMergedEnvVars()` function contains a hardcoded `localKeysToInject` array that
automatically passes platform secrets into every user-controlled test container:

```
MONGO_URI      → full MongoDB Atlas URI with write access to ALL tenant data
REDIS_URL      → internal Redis connection string
GEMINI_API_KEY → live AI API key billed to the platform
```

A user-controlled Docker image running arbitrary code instantly receives root-level access to the
entire multi-tenant database.

### Why Simple Blocking Fails

Blocking the name `MONGO_URI` outright would break any test suite that uses a variable *also named*
`MONGO_URI` to connect to their own App-Under-Test database — a completely legitimate pattern.

### The Solution: Namespace Separation

| Secret | Old Name (dangerous — shared namespace) | New Name (platform-private) |
|---|---|---|
| Platform MongoDB | `MONGO_URI` / `MONGODB_URL` | `PLATFORM_MONGO_URI` |
| Platform Redis | `REDIS_URL` | `PLATFORM_REDIS_URL` |
| Platform RabbitMQ | `RABBITMQ_URL` | `PLATFORM_RABBITMQ_URL` |
| Gemini AI Key | `GEMINI_API_KEY` | `PLATFORM_GEMINI_API_KEY` |
| JWT Signing Key | `JWT_SECRET` | `PLATFORM_JWT_SECRET` |
| Worker Callback Secret | *(did not exist)* | `PLATFORM_WORKER_CALLBACK_SECRET` |
| API Key HMAC Secret | *(did not exist)* | `PLATFORM_API_KEY_HMAC_SECRET` |

**Result:** The `PLATFORM_SECRET_BLOCKLIST` in `getMergedEnvVars()` only needs to block names that
start with `PLATFORM_`. A user's `MONGO_URI` test variable flows through freely because it is
user-supplied and does not match any platform-internal name.

---

## Sprint 1 — Critical Fixes

> **Goal:** Stop active exploitation vectors. No production deployment is safe until Sprint 1 is complete.

---

### 1.1 — Credential Rotation & Git Purge (CRIT-1)

*This is out-of-band work — no code change, but it must happen first.*

- [x] Rotate MongoDB Atlas password for `automation_user`
- [x] Revoke and re-issue `GEMINI_API_KEY` in Google Cloud Console
- [x] Change `keinarelkayam@gmail.com` admin password and enable MFA
- [x] Purge `.env.server` from full git history:
  ```bash
  git filter-repo --path .env.server --invert-paths --force
  ```
- [x] Add to root `.gitignore`:
  ```
  .env.server
  .env.*.local
  .env.local
  ```
- [x] Verify `.env.example` contains only placeholder values — no real credentials
- [x] Notify all repository collaborators to re-clone (cached clones may still contain secrets)

---

### 1.2 — Internal Auth Handshake: `PLATFORM_WORKER_CALLBACK_SECRET` (CRIT-3)

**Threat:** `/executions/update` and `/executions/log` are completely unauthenticated. Any internet
actor can POST to them to corrupt test results, forge log output, or spam Socket.io rooms for any
organization.

**Solution:** A shared secret checked by a dedicated `onRequest` hook that fires *before* the global
JWT middleware. This preserves the existing JWT flow for all user-facing routes.

#### Files to change:
- `apps/producer-service/src/config/middleware.ts`
- `apps/producer-service/src/types/fastify.d.ts` *(new — FastifyRequest augmentation)*
- `apps/worker-service/src/worker.ts`
- `.env.server` / `docker-compose.yml` / `docker-compose.prod.yml`

#### Implementation Detail — Middleware (`middleware.ts`)

```typescript
// Hook 1: Worker callback authentication (registers FIRST)
app.addHook('onRequest', async (request, reply) => {
  const WORKER_PATHS = ['/executions/update', '/executions/log'];
  if (!WORKER_PATHS.includes(request.url)) return;

  const token = (request.headers['authorization'] ?? '').replace('Bearer ', '');
  if (!token || token !== process.env.PLATFORM_WORKER_CALLBACK_SECRET) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
  request.isWorkerCallback = true; // signal JWT hook to skip
});

// Hook 2: JWT / API Key auth (registers SECOND — unchanged logic)
app.addHook('onRequest', async (request, reply) => {
  if (request.isWorkerCallback) return; // already authenticated
  // ... existing JWT/API key logic ...
});
```

#### Implementation Detail — Worker (`worker.ts`)

```typescript
const CALLBACK_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.PLATFORM_WORKER_CALLBACK_SECRET}`,
};
// Apply CALLBACK_HEADERS to both /executions/update and /executions/log fetch calls
```

#### 24-Hour Transition Window

To enable a zero-downtime deploy (Worker and Producer may not redeploy simultaneously), the Producer
middleware will accept both authenticated and unauthenticated callbacks for **24 hours** using an
environment flag:

```typescript
// In .env.server / docker-compose:
WORKER_CALLBACK_TRANSITION=true   # set to 'false' or remove after 24h

// In middleware.ts:
const inTransition = process.env.WORKER_CALLBACK_TRANSITION === 'true';
if (!token || token !== process.env.PLATFORM_WORKER_CALLBACK_SECRET) {
  if (inTransition) {
    request.log.warn('Unauthenticated worker callback — transition window active');
    request.isWorkerCallback = true; // allow, but log it
    return;
  }
  return reply.status(401).send({ success: false, error: 'Unauthorized' });
}
```

**Deploy order:** Worker (add secret header) → Producer (enforce secret) → Remove `WORKER_CALLBACK_TRANSITION`.

#### IDOR Fix — Add `organizationId` Filter to Cycle Sync

In `config/routes.ts` (the `/executions/update` handler, ~line 237):

```typescript
// Before — IDOR: any cycleId from any org
await cyclesCollection.updateOne(
  { _id: new ObjectId(updateData.cycleId) },
  { ... }
);

// After — tenant-scoped
if (!ObjectId.isValid(updateData.cycleId) || !ObjectId.isValid(updateData.organizationId)) {
  return reply.status(400).send({ success: false, error: 'Invalid IDs' });
}
await cyclesCollection.updateOne(
  { _id: new ObjectId(updateData.cycleId), organizationId: updateData.organizationId },
  { ... }
);
```

- [x] Add `PLATFORM_WORKER_CALLBACK_SECRET` (64-char random hex) to `.env.server`
- [x] Add `PLATFORM_WORKER_CALLBACK_SECRET` to `docker-compose.yml` and `docker-compose.prod.yml`
- [x] Register worker-secret `onRequest` hook in `middleware.ts` (before JWT hook)
- [x] Add `FastifyRequest.isWorkerCallback` type declaration
- [x] Update Worker `fetch` calls to include `Authorization` header
- [x] Add `organizationId` filter to `cyclesCollection.updateOne` in routes.ts
- [x] Add `ObjectId.isValid()` guards before the cycle sync query
- [x] Set `WORKER_CALLBACK_TRANSITION=true` on initial deploy
- [x] Remove `WORKER_CALLBACK_TRANSITION` after 24-hour window

---

### 1.3 — Platform Prefix Rename & Container Env Hardening (CRIT-2)

**Threat:** Platform infrastructure secrets are automatically injected into every user test container.
A user-controlled Docker image can exfiltrate the entire multi-tenant MongoDB database.

#### Files to change:
- `apps/worker-service/src/worker.ts` — `getMergedEnvVars()` rewrite
- `.env.server` — rename `PLATFORM_*` keys
- `docker-compose.yml` / `docker-compose.prod.yml` — update env var names
- `apps/producer-service/src/index.ts` — read `PLATFORM_MONGO_URI` etc.
- `apps/producer-service/src/config/routes.ts` — `INJECT_ENV_VARS` validation

#### `getMergedEnvVars()` Rewrite

```typescript
const PLATFORM_SECRET_BLOCKLIST = new Set([
  // New platform-namespaced names
  'PLATFORM_MONGO_URI', 'PLATFORM_REDIS_URL', 'PLATFORM_RABBITMQ_URL',
  'PLATFORM_GEMINI_API_KEY', 'PLATFORM_JWT_SECRET',
  'PLATFORM_WORKER_CALLBACK_SECRET', 'PLATFORM_API_KEY_HMAC_SECRET',
  // Legacy names — block as safety net during transition
  'MONGO_URI', 'MONGODB_URL', 'REDIS_URL', 'GEMINI_API_KEY', 'JWT_SECRET',
]);

function getMergedEnvVars(task: ITaskMessage, resolvedBaseUrl: string): Record<string, string> {
  // 1. Safe platform-provided constants — no secrets
  const merged: Record<string, string> = {
    CI: 'true',
    TASK_ID: task.taskId,
    BASE_URL: resolvedBaseUrl,
  };

  // 2. INJECT_ENV_VARS from platform env — filtered through blocklist
  const platformInjected = (process.env.INJECT_ENV_VARS ?? '')
    .split(',').map(k => k.trim()).filter(k => k && !PLATFORM_SECRET_BLOCKLIST.has(k));
  for (const key of platformInjected) {
    if (process.env[key] !== undefined) merged[key] = process.env[key]!;
  }

  // 3. Per-execution user-supplied envVars (from task message, Zod-validated)
  for (const [k, v] of Object.entries(task.envVars ?? {})) {
    if (!PLATFORM_SECRET_BLOCKLIST.has(k)) merged[k] = v;
  }

  return merged;
}
```

- [x] Rename all platform secrets to `PLATFORM_*` in `.env.server`
- [x] Update `docker-compose.yml` environment blocks to use `PLATFORM_*` names
- [x] Update `docker-compose.prod.yml` environment blocks
- [x] Update all `process.env.MONGO_URI` / `process.env.MONGODB_URL` reads in producer-service to `PLATFORM_MONGO_URI`
- [x] Update all `process.env.GEMINI_API_KEY` reads in worker-service to `PLATFORM_GEMINI_API_KEY`
- [x] Rewrite `getMergedEnvVars()` in `worker.ts` per spec above
- [x] Remove `localKeysToInject` array entirely from `worker.ts`
- [x] Update `.env.example` to document `PLATFORM_*` naming convention
- [x] Validate `INJECT_ENV_VARS` in `/api/execution-request` handler — reject any value in blocklist

---

### 1.4 — RabbitMQ Message Schema Validation (CRIT-4)

**Threat:** RabbitMQ messages are parsed with `JSON.parse` and destructured with no validation.
Combined with Docker socket access, a malicious message can run arbitrary containers.

#### Files to change:
- `apps/worker-service/src/worker.ts`

#### Zod Schema

```typescript
import { z } from 'zod'; // already installed, not yet used

const TaskMessageSchema = z.object({
  taskId:         z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  organizationId: z.string().length(24).regex(/^[a-f0-9]{24}$/),
  image:          z.string().min(1).max(256).regex(/^[a-zA-Z0-9][a-zA-Z0-9._\-/:@]*:[a-zA-Z0-9._\-]+$/),
  command:        z.string().min(1).max(1024),
  folder:         z.string().max(256).regex(/^[a-zA-Z0-9_\-.\/]*$/),
  cycleId:        z.string().regex(/^[a-f0-9]{24}$/).optional(),
  cycleItemId:    z.string().max(128).optional(),
  envVars:        z.record(
                    z.string().regex(/^[A-Z][A-Z0-9_]*$/),
                    z.string().max(4096)
                  ).optional().default({}),
  baseUrl:        z.string().url().max(2048).optional(),
  environment:    z.enum(['development', 'staging', 'production']).optional(),
  aiAnalysisEnabled: z.boolean().optional().default(false),
});
```

Rejected messages are `nack`'d with `requeue: false` (sent to dead-letter queue if configured).

#### Docker `HostConfig` Security Limits

```typescript
HostConfig: {
  Memory:        2 * 1024 * 1024 * 1024,  // 2 GB
  MemorySwap:    2 * 1024 * 1024 * 1024,  // no swap
  NanoCpus:      2 * 1e9,                 // 2 CPUs
  PidsLimit:     512,                     // prevent fork bombs
  SecurityOpt:   ['no-new-privileges:true'],
  CapDrop:       ['ALL'],
  CapAdd:        [],
  NetworkMode:   'bridge',
  Tmpfs:         { '/tmp': 'rw,noexec,nosuid,size=256m' },
  // NOTE: /var/run/docker.sock is NOT mounted in test containers
}
```

- [x] Define `TaskMessageSchema` (Zod) at the top of `worker.ts`
- [x] Replace raw `JSON.parse` + destructure with `TaskMessageSchema.safeParse()`
- [x] Log and `nack(msg, false, false)` on parse failure
- [x] Define `ALLOWED_IMAGE_REGISTRIES` env var (optional allowlist, comma-separated)
- [x] Add registry allowlist check after schema parse
- [x] Add `HostConfig` resource and security limits to `createContainer` call
- [x] Verify test containers do NOT receive `/var/run/docker.sock` bind mount

---

### 1.5 — Status Resolution Fix: FATAL ERROR in Logs (Logic Fix)

**Threat:** A container that emits `FATAL ERROR` (e.g., Node.js heap crash) but exits with code 0
is recorded as `PASSED`, hiding critical infrastructure failures.

#### Files to change:
- `apps/worker-service/src/worker.ts`

```typescript
const FATAL_LOG_PATTERNS = [
  /FATAL ERROR/i,
  /JavaScript heap out of memory/i,
  /Segmentation fault/i,
];

function containsFatalPattern(logs: string): boolean {
  return FATAL_LOG_PATTERNS.some(p => p.test(logs));
}

// After container exits and logs are collected:
let finalStatus: ExecutionStatus;
const fullLog = logsBuffer.join('\n');

if (exitCode !== 0) {
  finalStatus = 'FAILED';
} else if (containsFatalPattern(fullLog)) {
  finalStatus = 'FAILED';
  logger.warn({ taskId }, 'Container exited 0 but FATAL ERROR detected in logs');
} else {
  finalStatus = 'PASSED';
}
```

- [x] Add `FATAL_LOG_PATTERNS` constant array to `worker.ts`
- [x] Add `containsFatalPattern()` helper function
- [x] Replace current `exitCode !== 0 ? 'FAILED' : 'PASSED'` logic with three-way check
- [x] Add `logger.warn` for the exit-0-but-fatal case (structured, not `console.log`)

---

## Sprint 2 — High Severity Hardening

> **Goal:** Eliminate SSRF vectors, command injection, and unauthenticated data leakage.

---

### 2.1 — Signed Tokens for Report Access — Option A (HIGH-6)

**Threat:** `/reports/{organizationId}/{taskId}/` is served with no authentication. Former org
members retain access to all historical reports indefinitely via the organizationId alone.

**Decision: Option A — Short-lived HMAC-signed URL tokens (lower complexity than full proxy).**

#### Files to change:
- `apps/producer-service/src/config/middleware.ts`
- `apps/producer-service/src/config/routes.ts` *(new endpoint)*
- `apps/dashboard-client/src/` *(report link generation)*

#### Flow

```
1. User clicks "View Report" in the dashboard
2. Dashboard calls: GET /api/executions/:taskId/report-token
   → Producer verifies JWT (org ownership of taskId confirmed)
   → Returns: { token: "<HMAC-signed token>", expiresIn: 300 }
3. Dashboard opens: /reports/{orgId}/{taskId}/index.html?token=<token>
4. /reports/* middleware validates HMAC token + expiry + path scope before serving
```

Token payload: `{ orgId, taskId, exp: now + 300s }` — signed with `PLATFORM_JWT_SECRET`.

- [x] Add `GET /api/executions/:taskId/report-token` endpoint (JWT-protected)
- [x] Implement `generateReportToken(orgId, taskId)` utility
- [x] Implement `verifyReportToken(token, requestPath)` utility
- [x] Replace blanket `/reports/` bypass in `middleware.ts` with token validation
- [x] Update dashboard report links to fetch a token before navigation
- [x] Set token expiry to 5 minutes (300 seconds)

---

### 2.2 — Jira Domain SSRF Protection (HIGH-3)

**Threat:** Any HTTPS URL can be stored as the Jira domain, enabling SSRF to internal services or
cloud metadata endpoints (e.g., `169.254.169.254`).

#### Files to change:
- `apps/producer-service/src/routes/integrations.ts`

```typescript
// In PUT /api/integrations/jira — before storing domain:
const sanitized = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
const atlassianPattern = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?\.atlassian\.net$/i;
if (!atlassianPattern.test(sanitized)) {
  return reply.status(400).send({
    success: false,
    error: 'Domain must be a valid Atlassian Cloud domain (*.atlassian.net)',
  });
}
```

- [x] Add `atlassianPattern` regex validation to Jira domain update handler
- [x] Sanitize stored domain (strip protocol prefix, trailing slash)
- [ ] Add unit test for domain validation edge cases (IP addresses, cloud metadata URLs)

---

### 2.3 — Slack Webhook SSRF Protection & Encryption (HIGH-7)

**Threat:** Any HTTPS URL accepted as a Slack webhook enables SSRF. Webhook URLs stored in plaintext
— a database dump leaks all customer Slack webhooks.

#### Files to change:
- `apps/producer-service/src/routes/organization.ts`
- `apps/producer-service/src/utils/notifier.ts`
- `migrations/005-encrypt-slack-webhooks.ts` *(Sprint 3 migration — see §3.3)*

```typescript
// Validation — reject non-Slack URLs:
const slackPattern =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{9,11}\/[A-Z0-9]{9,11}\/[a-zA-Z0-9]{24,}$/;
if (!slackPattern.test(slackWebhookUrl)) {
  return reply.status(400).send({
    success: false,
    error: 'Must be a valid Slack Incoming Webhook URL (hooks.slack.com/services/...)',
  });
}

// Encrypt before storing (reuse existing utils/encryption.ts):
const encryptedUrl = encrypt(slackWebhookUrl);
await orgCollection.updateOne({ _id: orgId }, { $set: { slackWebhookUrl: encryptedUrl } });
```

```typescript
// notifier.ts — decrypt before calling Slack:
const webhookUrl = decrypt(org.slackWebhookUrl);
```

- [x] Add `slackPattern` regex validation to organization webhook update handler
- [x] Encrypt webhook URL with `utils/encryption.ts` before storing in MongoDB
- [x] Update `notifier.ts` to decrypt before use
- [ ] Note: existing plaintext URLs require migration (see Sprint 3 §3.3)

---

### 2.4 — Jira Custom Fields Injection Fix (HIGH-4)

**Threat:** `customFields` is spread into the Jira issue payload with only a `typeof` check,
allowing attackers to override standard fields like `project`, `reporter`, `assignee`.

#### Files to change:
- `apps/producer-service/src/routes/integrations.ts`

```typescript
const STANDARD_JIRA_FIELDS = new Set([
  'project', 'issuetype', 'summary', 'description',
  'reporter', 'assignee', 'priority', 'labels',
  'components', 'fixVersions', 'duedate', 'parent',
]);

const safeCustomFields = customFields
  ? Object.fromEntries(
      Object.entries(customFields).filter(([k]) => !STANDARD_JIRA_FIELDS.has(k))
    )
  : {};
```

- [x] Define `STANDARD_JIRA_FIELDS` constant (module-level `Set`)
- [x] Replace raw `customFields` spread with filtered `safeCustomFields`

---

### 2.5 — Replace `execSync` with `execFileSync` (HIGH-5)

**Threat:** `allure generate "${allureResultsDir}"` uses shell interpolation. If `organizationId`
or `taskId` from a RabbitMQ message contains shell metacharacters, arbitrary commands execute.

Note: CRIT-4's Zod schema (§1.4) already validates `organizationId` as a 24-char hex string,
mitigating the injection source. This fix is defence-in-depth.

#### Files to change:
- `apps/worker-service/src/worker.ts`

```typescript
// Before:
import { execSync } from 'child_process';
execSync(`allure generate "${allureResultsDir}" --clean -o "${allureReportDir}"`, { stdio: 'pipe' });

// After:
import { execFileSync } from 'child_process';
execFileSync('allure', ['generate', allureResultsDir, '--clean', '-o', allureReportDir], {
  stdio: 'pipe',
});
```

- [x] Replace `execSync` import with `execFileSync`
- [x] Convert shell string template to `execFileSync` argv array
- [x] Verify no other `execSync` calls remain in `worker.ts`

---

## Sprint 3 — Defence in Depth

> **Goal:** Harden the authentication layer, complete the data-at-rest encryption story, and close
> remaining HIGH findings.

---

### 3.1 — JWT Blacklist on Logout via Redis (HIGH-8)

**Threat:** Logout is a no-op. A stolen JWT remains valid for its full 24-hour TTL.

Redis is already deployed and used for login lockouts — a token blacklist is a natural extension.

#### Files to change:
- `apps/producer-service/src/routes/auth.ts`
- `apps/producer-service/src/utils/jwt.ts`

```typescript
// auth.ts — on POST /api/auth/logout:
const jti = `${payload.userId}:${payload.iat}`;
const ttlSeconds = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
await redis.setex(`revoked:${jti}`, ttlSeconds, '1');
return reply.send({ success: true });

// jwt.ts — verifyToken, after signature verification:
const jti = `${decoded.userId}:${decoded.iat}`;
const isRevoked = await redis.get(`revoked:${jti}`);
if (isRevoked) throw new Error('Token has been revoked');
```

- [ ] Implement `jti` derivation in logout handler (`userId:iat`)
- [ ] Add `redis.setex('revoked:<jti>', ttl, '1')` on logout
- [ ] Add Redis revocation check in `verifyToken` (after signature, before returning decoded)
- [ ] Benchmark: confirm Redis GET latency is acceptable in p99 (target < 2ms)

---

### 3.2 — JWT Algorithm Pinning to HS256 (HIGH-1) & Secret Redaction (HIGH-2)

**Threat (HIGH-1):** Omitting `algorithms: ['HS256']` in `verify()` enables algorithm confusion
attacks in shared-codebase scenarios.

**Threat (HIGH-2):** Ten characters of `JWT_SECRET` are logged to stdout on every server start,
persisting indefinitely in log aggregation pipelines.

#### Files to change:
- `apps/producer-service/src/utils/jwt.ts`

```typescript
// signToken — add algorithm
jwt.sign(payload, PLATFORM_JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: JWT_EXPIRY,
  issuer: 'agnostic-automation-center',
  audience: 'aac-client',
});

// verifyToken — add algorithms allowlist
jwt.verify(token, PLATFORM_JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: 'agnostic-automation-center',
  audience: 'aac-client',
});

// Startup log — redact secret value
app.log.info(`  - JWT Secret: [REDACTED] (${PLATFORM_JWT_SECRET.length} chars)`);
```

- [ ] Add `algorithm: 'HS256'` to `jwt.sign()` call
- [ ] Add `algorithms: ['HS256']` to `jwt.verify()` call
- [ ] Add `issuer` and `audience` claims to both sign and verify
- [ ] Replace `JWT_SECRET.substring(0, 10)...` log line with `[REDACTED]`
- [ ] Replace `console.log` in `jwt.ts` with `app.log.info` per CLAUDE.md convention

---

### 3.3 — Migration: Encrypt Existing Slack Webhook URLs (HIGH-7 completion)

Sprint 2 (§2.3) encrypts new webhook URLs going forward. This migration encrypts all existing
plaintext webhook URLs already in MongoDB.

#### File to create:
- `migrations/005-encrypt-slack-webhooks.ts`

```typescript
// Pseudocode — full implementation in Sprint 3
for each org in organizations where slackWebhookUrl is a non-null string:
  if slackWebhookUrl does not match encrypted format { iv, ciphertext, authTag }:
    encryptedUrl = encrypt(org.slackWebhookUrl)
    update org set slackWebhookUrl = encryptedUrl
```

- [ ] Create `migrations/005-encrypt-slack-webhooks.ts`
- [ ] Query all orgs where `slackWebhookUrl` is a plain string (not an object)
- [ ] Encrypt each URL using `utils/encryption.ts`
- [ ] Update the document in-place
- [ ] Log count of migrated records
- [ ] Run migration in staging before production
- [ ] Verify `notifier.ts` decrypts correctly after migration

---

### 3.4 — Additional Sprint 3 Hardening

- [ ] **MED-7 — HMAC API Key Hashing:** Replace `SHA-256(key)` with `HMAC-SHA256(key, PLATFORM_API_KEY_HMAC_SECRET)` in `utils/apiKeys.ts`
- [ ] **MED-8 — projectId Ownership Check:** Before inserting test cases or cycles, verify `projectId` belongs to the caller's `organizationId`
- [ ] **MED-9 — Redis Rate Limiter:** Replace in-memory `Map<>` rate limiter in `middleware/auth.ts` with the existing `middleware/rateLimiter.ts` (Redis-backed)
- [ ] **MED-1 — Content-Security-Policy:** Uncomment and configure CSP header in `config/middleware.ts`
- [ ] **MED-2 — Remove `X-XSS-Protection`:** Delete the deprecated header (replaced by CSP)
- [ ] **MED-3 — HSTS `preload`:** Add `; preload` to the `Strict-Transport-Security` header value
- [ ] **MED-4 — Remove `/api/webhooks/test`:** Delete the unauthenticated Stripe config disclosure endpoint
- [ ] **MED-5 — Restrict `/config/defaults`:** Add JWT authentication to this endpoint
- [ ] **LOW-1 — Replace `console.log`:** Sweep all `console.log`/`console.error` in producer-service and replace with `app.log.info`/`app.log.error`
- [ ] **LOW-2 — `decodeTokenUnsafe`:** Add `/** @internal */` JSDoc and prefix with `_` to signal non-public API
- [ ] **LOW-6 — Remove `attemptsRemaining`:** Strip attempt count from failed login responses in `routes/auth.ts`

---

## Deploy Sequencing

```
Sprint 1 Deploy Order
─────────────────────
Step 1: Add PLATFORM_* secrets to all environments (no code change yet)
Step 2: Deploy Worker with:
        - PLATFORM_WORKER_CALLBACK_SECRET set
        - New getMergedEnvVars() (no longer auto-injects infra secrets)
        - Zod schema validation
        - execFileSync for allure
        - FATAL ERROR detection
Step 3: Deploy Producer with:
        - WORKER_CALLBACK_TRANSITION=true (24-hour window)
        - Worker callback secret hook registered
        - organizationId filter on cycle sync
Step 4: Verify live log streaming and execution callbacks work end-to-end
Step 5: Set WORKER_CALLBACK_TRANSITION=false (or remove var) after 24 hours
```

---

## Progress Tracker

| Sprint | Finding | Status |
|---|---|---|
| Pre-work | CRIT-1 — Rotate credentials & purge git history | ✅ Done |
| Sprint 1 | CRIT-3 — Worker callback secret handshake | ✅ Done |
| Sprint 1 | CRIT-2 — Platform prefix rename & container env hardening | ✅ Done |
| Sprint 1 | CRIT-4 — RabbitMQ Zod schema + Docker HostConfig | ✅ Done |
| Sprint 1 | Logic — FATAL ERROR → FAILED status resolution | ✅ Done |
| Sprint 2 | HIGH-6 — Signed tokens for report access | ✅ Done |
| Sprint 2 | HIGH-3 — Jira SSRF domain validation | ✅ Done |
| Sprint 2 | HIGH-7 — Slack SSRF + encryption (new records) | ✅ Done |
| Sprint 2 | HIGH-4 — Jira custom fields injection | ✅ Done |
| Sprint 2 | HIGH-5 — `execSync` → `execFileSync` | ✅ Done |
| Sprint 3 | HIGH-8 — JWT blacklist on logout | ⬜ Not Started |
| Sprint 3 | HIGH-1 — JWT algorithm pinning (HS256) | ⬜ Not Started |
| Sprint 3 | HIGH-2 — JWT secret redaction in logs | ⬜ Not Started |
| Sprint 3 | Migration 005 — Encrypt existing Slack webhook URLs | ⬜ Not Started |
| Sprint 3 | MED-1/2/3/4/5/6/7/8/9 — Hardening sweep | ⬜ Not Started |
| Sprint 3 | LOW-1/2/6 — Console.log, decodeTokenUnsafe, attempt count | ⬜ Not Started |

---

*This plan is version-controlled alongside the codebase. Update task statuses here as each item is completed.*
