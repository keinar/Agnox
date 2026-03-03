# AI Quality Orchestrator — Implementation Plan

> Status: **AWAITING APPROVAL** — Do not begin implementation until explicitly approved.
>
> Codebase analyzed: `packages/shared-types/index.ts`, `apps/producer-service/src/utils/encryption.ts`,
> `apps/producer-service/src/routes/ai.ts`, `apps/producer-service/src/routes/organization.ts`,
> `apps/dashboard-client/src/components/settings/FeaturesTab.tsx`,
> `apps/dashboard-client/src/components/settings/SecurityTab.tsx`,
> `apps/dashboard-client/src/pages/Settings.tsx`, `apps/dashboard-client/src/components/Sidebar.tsx`

---

## Section 0 — Current State Summary (Findings)

| Area | Current State |
|---|---|
| AI in `shared-types` | No `aiConfig` block; `aiAnalysisEnabled` lives as a flat boolean on the org document |
| AI feature flags | Single `org.aiAnalysisEnabled` boolean; managed in `SecurityTab.tsx` via `PATCH /api/organization` |
| Module feature flags | `features.testCasesEnabled`, `features.testCyclesEnabled` in `organization.ts` and `FeaturesTab.tsx` |
| AI routes | `POST /api/ai/generate-test-steps`, `POST /api/ai/generate-test-suite` — both hardwired to `PLATFORM_GEMINI_API_KEY` |
| Encryption util | `encrypt()`/`decrypt()` in `utils/encryption.ts` returns `IEncryptedPayload { encrypted, iv, authTag }` |
| Webhooks | `webhooks.ts` handles **Stripe only**; no CI/PR webhook endpoint exists yet |
| Sidebar nav | Fixed nav items: Dashboard, Test Cases, Test Cycles, Settings, Docs |

---

## Section 1 — Proposed Database Schema Changes (`shared-types`)

### 1.1 New: `IAiConfig` interface

```typescript
// Stored on IOrganization.aiConfig
export interface IAiConfig {
    /** The model used by default for all AI features in this org. */
    defaultModel: 'gemini-2.5-flash' | 'gpt-4o' | 'claude-3-5-sonnet';
    /**
     * Per-provider BYOK keys, encrypted with AES-256-GCM via encryption.ts.
     * Keys are NEVER returned to the frontend in plaintext.
     */
    byok?: {
        gemini?:    IEncryptedPayload;
        openai?:    IEncryptedPayload;
        anthropic?: IEncryptedPayload;
    };
    updatedAt?: Date;
}
```

> `IEncryptedPayload` is already exported from `utils/encryption.ts` — we re-export it from `shared-types` so both the producer and worker can reference it without a circular import.

### 1.2 New: `IAiFeatureFlags` interface

```typescript
// Replaces the flat `aiAnalysisEnabled` boolean on IOrganization
export interface IAiFeatureFlags {
    rootCauseAnalysis:  boolean; // was aiAnalysisEnabled — migrated in 009
    autoBugGeneration:  boolean;
    flakinessDetective: boolean;
    testOptimizer:      boolean;
    prRouting:          boolean;
    qualityChatbot:     boolean;
}
```

### 1.3 Updated `IOrganization` (additions only — no fields removed)

```typescript
export interface IOrganization {
    // ... all existing fields preserved unchanged ...

    /** AI provider config & BYOK keys. Absent = use platform defaults. */
    aiConfig?: IAiConfig;

    /**
     * Granular AI feature flags. Replaces the legacy flat `aiAnalysisEnabled`
     * boolean. If this field is absent, `rootCauseAnalysis` defaults to the
     * value of the legacy `aiAnalysisEnabled` field (migration safety net).
     */
    aiFeatures?: IAiFeatureFlags;
}
```

> **Backwards-compatibility rule:** Any code that reads `rootCauseAnalysis` MUST
> fall back to `org.aiAnalysisEnabled !== false` when `org.aiFeatures` is absent.
> This handles orgs that have not yet been touched by migration 009.

### 1.4 Updated `TaskMessageSchema` (worker) additions

The worker task payload gains two optional fields so every LLM call can use the
correct model and key without re-fetching the org from the database:

```typescript
// In packages/shared-types/index.ts TaskMessageSchema (Zod)
resolvedLlmModel:   z.string().optional(),   // e.g. 'gemini-2.5-flash'
resolvedLlmApiKey:  z.string().optional(),   // decrypted at producer, passed over AMQP
aiFeatures:         z.object({ ... }).optional(),
```

---

## Section 2 — Migration Plan

### Migration `009-add-ai-orchestrator.ts`

Location: `migrations/009-add-ai-orchestrator.ts`

**Steps:**
1. For every org document where `aiFeatures` is **absent**:
   - Set `aiFeatures.rootCauseAnalysis = (org.aiAnalysisEnabled !== false)` (migrate legacy flag).
   - Set all other `aiFeatures.*` to `false` (new features default off — opt-in model).
   - Set `aiConfig.defaultModel = 'gemini-2.5-flash'` (preserve existing behavior).
2. Leave the legacy `aiAnalysisEnabled` field in place (do **not** `$unset`) so a
   rollback of the app can still read it.
3. Create a sparse index on `organizations.aiConfig.defaultModel` for fast reads.

---

## Section 3 — New Backend Utility: `resolveLlmConfig()`

**File:** `apps/producer-service/src/utils/llm-config.ts`

**Purpose:** Single source of truth for resolving which API key and model to use
for any LLM call. Encapsulates the BYOK fallback chain so no route needs to
duplicate this logic.

```
Algorithm:
  1. Read org.aiConfig.defaultModel (fallback: 'gemini-2.5-flash').
  2. Check org.aiConfig.byok[provider] — if present, call decrypt() and return key.
  3. If no BYOK key, fall back to platform env vars:
       gemini     → process.env.PLATFORM_GEMINI_API_KEY
       openai     → process.env.PLATFORM_OPENAI_API_KEY
       anthropic  → process.env.PLATFORM_ANTHROPIC_API_KEY
  4. If no platform key either, throw LlmNotConfiguredError (caught by routes → 503).

Returns: { model: string; apiKey: string; provider: 'gemini' | 'openai' | 'anthropic' }
```

---

## Section 4 — REST API Contract

### 4.1 Section 1.1: BYOK Engine (`SecurityTab`)

#### `GET /api/organization/ai-config`
Auth: JWT (all roles read, admin to write)

```
Response 200:
{
  success: true,
  data: {
    defaultModel: 'gemini-2.5-flash' | 'gpt-4o' | 'claude-3-5-sonnet';
    byokConfigured: {
      gemini:    boolean;  // true if an encrypted key is stored — NEVER the key itself
      openai:    boolean;
      anthropic: boolean;
    }
  }
}
```

#### `PATCH /api/organization/ai-config`
Auth: JWT + Admin only

```
Request body (all fields optional, at least one required):
{
  defaultModel?: 'gemini-2.5-flash' | 'gpt-4o' | 'claude-3-5-sonnet';
  byok?: {
    provider: 'gemini' | 'openai' | 'anthropic';
    apiKey:   string;   // plaintext — encrypted server-side before persist
  };
  removeByok?: 'gemini' | 'openai' | 'anthropic';  // to delete a stored key
}

Response 200:
{
  success: true,
  data: {
    defaultModel: string;
    byokConfigured: { gemini: boolean; openai: boolean; anthropic: boolean; }
  }
}

Errors:
  400 — invalid model name, missing required fields
  403 — not admin
  503 — if no platform key exists for the selected provider and no BYOK provided
```

**Server-side security:** The API key is validated with a test call to the
provider before encryption and storage. This prevents storing invalid keys.

---

### 4.2 Section 1.2: Granular AI Feature Flags (`FeaturesTab`)

#### Extend `PATCH /api/organization/features`
New accepted body fields (in addition to existing `testCasesEnabled`, `testCyclesEnabled`):

```
{
  // NEW
  aiFeatures?: {
    rootCauseAnalysis?:  boolean;
    autoBugGeneration?:  boolean;
    flakinessDetective?: boolean;
    testOptimizer?:      boolean;
    prRouting?:          boolean;
    qualityChatbot?:     boolean;
  }
}
```

Response gains the `aiFeatures` object in the returned `features` block.

#### Extend `GET /api/organization`
The `organization` response block gains:
```
aiConfig: { defaultModel: string; byokConfigured: {...} }
aiFeatures: { rootCauseAnalysis: boolean; ... }
```
(replacing the legacy `aiAnalysisEnabled` field — both are returned during
the migration window for backwards-compat).

---

### 4.3 Feature A: Auto-Bug Generator

#### `POST /api/ai/generate-bug-report`
Auth: JWT

```
Request:
{
  executionId: string;   // UUID — used to fetch logs and context from DB
}

Response 200:
{
  success: true,
  data: {
    title:             string;
    stepsToReproduce:  string[];
    expectedBehavior:  string;
    actualBehavior:    string;
    codePatches: {
      file:        string;
      suggestion:  string;
    }[];
    severity:    'critical' | 'high' | 'medium' | 'low';
    rawAnalysis: string;   // full LLM output, for user review/edit before submission
  }
}

Errors:
  400 — executionId missing or not a valid UUID
  403 — execution belongs to a different org (enforced via organizationId filter)
  404 — execution not found
  503 — LLM not configured / aiFeatures.autoBugGeneration is false
```

**Log truncation strategy (edge case):** If `execution.output` exceeds 80,000
characters (approx. Gemini's safe window):
- Keep the first 10% of the log (container startup, config output).
- Keep the last 90% (where errors concentrate).
- Insert `\n[... LOG TRUNCATED — showing first 8000 and last 72000 chars ...]\n`.

---

### 4.4 Feature E: Quality Chatbot

#### `POST /api/ai/chat`
Auth: JWT

```
Request:
{
  message:          string;           // max 1000 chars
  conversationId?:  string;           // UUID for multi-turn context
}

Response 200:
{
  success: true,
  data: {
    answer:          string;
    conversationId:  string;          // new UUID if not provided in request
    chartData?: {
      type:    'bar' | 'line' | 'pie';
      title:   string;
      labels:  string[];
      values:  number[];
    };
  }
}

Errors:
  400 — message empty or over limit
  503 — LLM not configured / aiFeatures.qualityChatbot is false
```

**CRITICAL Security Implementation — NoSQL Injection Prevention:**

The LLM generates a MongoDB Aggregation Pipeline from the user's natural-language
query. Before execution, a mandatory sanitizer function (`sanitizePipeline()` in
`utils/chat-sanitizer.ts`) runs the following checks in order:

```
1. ALLOWLIST STAGES: Reject any pipeline containing stages outside:
   ['$match', '$group', '$project', '$sort', '$limit', '$count',
    '$addFields', '$unwind', '$lookup', '$facet', '$bucket', '$sum', '$avg']
   — Explicitly blocked: $out, $merge, $unionWith, $function, $accumulator,
     $where (JS execution), $graphLookup (unbounded traversal risk).

2. FORCE organizationId: Locate the first $match stage. If absent, prepend one.
   Then unconditionally OVERWRITE (not merge) the organizationId field:
     pipeline[matchIndex].$match.organizationId = new ObjectId(currentUser.organizationId)
   This ensures even a manipulated LLM output cannot read another org's data.

3. ENFORCE $limit: If no $limit stage is found, append { $limit: 500 }.
   If a $limit > 1000 is found, clamp it to 1000.

4. COLLECTION WHITELIST: Only allow execution against the collections
   ['executions', 'test_cycles']. The target collection is resolved by the
   LLM prompt structure and validated before `db.collection(name).aggregate()`.

5. OPERATOR SANITIZATION: Recursively scan all values in the pipeline object.
   Reject any string value that starts with '$' in a field-name position that
   isn't in the operator allowlist (prevents operator injection via LLM).
```

The conversation history is stored in a new `chat_sessions` MongoDB collection
(TTL: 24h) scoped by `organizationId`.

---

## Section 5 — Frontend Component Plan

### 5.1 SecurityTab.tsx — BYOK UI (New Section, replaces AI toggle)

Remove the current `aiAnalysisEnabled` toggle section and replace with:
- **"Default AI Model" dropdown** — three options (Gemini, GPT-4o, Claude 3.5 Sonnet).
- **"Bring Your Own Key" section** — one row per provider:
  - Status badge: "Configured" (green) or "Using Platform Default" (grey).
  - Input: Password field for API key entry + "Save Key" button per provider.
  - "Remove" button if a key is already configured.
- **"Data Processing & Privacy" disclosure** — updated copy.

### 5.2 FeaturesTab.tsx — AI Feature Flags (New Section)

Add a second `<section>` below the existing "Feature Management" section:
- Section title: **"AI Features"**.
- Description: "Control which AI-powered capabilities are active for your organization."
- One `<FeatureRow>` per flag (reuse the existing `FeatureRow` and `Toggle` components):
  1. Root Cause Analysis
  2. Auto-Bug Generation
  3. Flakiness & Stability Detective
  4. Smart Test Optimizer
  5. Smart PR Routing
  6. Quality Chatbot
- Flags default to `false` (opt-in) — user is informed by a callout.

### 5.3 ExecutionDrawer.tsx — "Auto-Generate Bug" Button (Feature A)

- Add "Auto-Generate Bug" button (visible only when `status === 'FAILED'` or
  `'ERROR'` **and** `aiFeatures.autoBugGeneration === true`).
- Button triggers `POST /api/ai/generate-bug-report`, shows a spinner.
- On success, opens a new `AutoBugModal.tsx` pre-populated with the returned data.
- `AutoBugModal.tsx` is an edit-before-submit form (title, steps, expected/actual, patches).
- Modal's "Submit to Jira" button invokes the existing `CreateJiraTicketModal.tsx` flow,
  passing the finalized fields as the pre-filled payload.

### 5.4 New: `StabilityPage.tsx` (Feature B)

- Route: `/stability`
- Sidebar nav entry: "Stability" (icon: `Activity`) — visible when
  `aiFeatures.flakinessDetective === true`.
- UI:
  - Group-name selector (dropdown, powered by existing `useGroupNames` hook).
  - "Analyze Stability" button → `POST /api/ai/analyze-stability`.
  - Results card: flakiness score (0-100 gauge), verdict badge, findings list.

### 5.5 TestCases.tsx / BulkActionsBar.tsx — "Optimize with AI" (Feature C)

- Add "Optimize with AI" button to the existing `BulkActionsBar.tsx`.
- Visible only when at least one test case is selected **and**
  `aiFeatures.testOptimizer === true`.
- Calls `POST /api/ai/optimize-test-cases` with selected test-case IDs.
- Opens `OptimizedTestCasesModal.tsx` — a diff-style review UI (original vs. proposed).
- User approves individual optimizations; approved ones are saved via existing
  `PATCH /api/test-cases/:id` endpoint.

### 5.6 RunSettingsTab.tsx — Smart PR Routing Toggle (Feature D)

- Add a "Smart PR Routing" toggle row (similar to existing toggles in the tab).
- Persisted to `org.aiFeatures.prRouting` via the extended `PATCH /api/organization/features`.
- Displays a callout: "Requires a GitHub or GitLab webhook configured in Connectors."

### 5.7 New: `ChatPage.tsx` (Feature E)

- Route: `/chat`
- Sidebar nav entry: "Ask AI" (icon: `MessageSquare`) — visible when
  `aiFeatures.qualityChatbot === true`.
- Full-page conversational UI:
  - Message list (user + assistant bubbles).
  - Chart component (bar/line/pie) rendered below assistant message when
    `chartData` is present.
  - Text input + submit button.
  - Persists `conversationId` in component state for multi-turn context.

---

## Section 6 — New Backend Routes Summary

| Method | Path | Auth | Feature Flag Guard | Phase |
|---|---|---|---|---|
| `GET` | `/api/organization/ai-config` | JWT | — | 1 |
| `PATCH` | `/api/organization/ai-config` | JWT + Admin | — | 1 |
| `PATCH` | `/api/organization/features` (extended) | JWT + Admin | — | 1 |
| `POST` | `/api/ai/generate-bug-report` | JWT | `autoBugGeneration` | 2 |
| `POST` | `/api/ai/analyze-stability` | JWT | `flakinessDetective` | 2 |
| `POST` | `/api/ai/optimize-test-cases` | JWT | `testOptimizer` | 3 |
| `POST` | `/api/webhooks/ci/pr` | HMAC sig | `prRouting` | 3 |
| `POST` | `/api/ai/chat` | JWT | `qualityChatbot` | 4 |

All new AI routes add a `featureFlagGuard` preHandler that:
1. Fetches `org.aiFeatures` from DB.
2. Checks the specific flag for the endpoint.
3. Returns `{ success: false, error: 'This AI feature is not enabled for your organization.' }` (403) if off.

---

## Section 7 — Worker Changes

The worker's `rootCauseAnalysis` call (existing) must be updated to:
1. Check `taskPayload.aiFeatures.rootCauseAnalysis` — if `false`, skip AI call and log info.
2. Use `taskPayload.resolvedLlmModel` and `taskPayload.resolvedLlmApiKey` (decrypted
   at the producer by `resolveLlmConfig()`) instead of hardcoded `PLATFORM_GEMINI_API_KEY`.
3. Support calling OpenAI or Anthropic SDKs based on `provider` field.

A new utility `apps/worker-service/src/utils/llm-client.ts` wraps the three
provider SDKs behind a single `callLlm(prompt, config)` function.

---

## Section 8 — Implementation Phases & Order

### Phase 1 — Foundation (Prerequisite for everything)
1. `packages/shared-types/index.ts` — add `IAiConfig`, `IAiFeatureFlags`, update `IOrganization`.
2. `migrations/009-add-ai-orchestrator.ts` — backfill `aiFeatures` and `aiConfig`.
3. `apps/producer-service/src/utils/llm-config.ts` — `resolveLlmConfig()` utility.
4. `apps/producer-service/src/routes/organization.ts` — add `GET/PATCH /api/organization/ai-config`; extend `PATCH /api/organization/features`.
5. `apps/dashboard-client/src/components/settings/SecurityTab.tsx` — BYOK UI.
6. `apps/dashboard-client/src/components/settings/FeaturesTab.tsx` — AI feature flag rows.
7. `apps/dashboard-client/src/hooks/useOrganizationFeatures.ts` — extend to return `aiFeatures`.

### Phase 2 — Feature A (Auto-Bug) + Feature B (Flakiness Detective)
8. `POST /api/ai/generate-bug-report` in `ai.ts`.
9. `POST /api/ai/analyze-stability` in `ai.ts`.
10. `apps/dashboard-client/src/components/AutoBugModal.tsx` — new component.
11. `apps/dashboard-client/src/components/ExecutionDrawer.tsx` — "Auto-Generate Bug" button.
12. `apps/dashboard-client/src/pages/StabilityPage.tsx` — new page.
13. `Sidebar.tsx` — add "Stability" nav item.

### Phase 3 — Feature C (Test Optimizer) + Feature D (PR Routing)
14. `POST /api/ai/optimize-test-cases` in `ai.ts`.
15. `apps/dashboard-client/src/components/OptimizedTestCasesModal.tsx` — new component.
16. `apps/dashboard-client/src/pages/TestCases.tsx` + `BulkActionsBar.tsx` — "Optimize with AI" button.
17. `POST /api/webhooks/ci/pr` — new endpoint in `webhooks.ts` or new `ci-pr.ts` route.
18. `apps/dashboard-client/src/components/settings/RunSettingsTab.tsx` — PR routing toggle.

### Phase 4 — Feature E (Quality Chatbot)
19. `apps/producer-service/src/utils/chat-sanitizer.ts` — `sanitizePipeline()`.
20. `POST /api/ai/chat` in `ai.ts`.
21. `apps/dashboard-client/src/pages/ChatPage.tsx` — new page.
22. `Sidebar.tsx` — add "Ask AI" nav item.

### Phase 5 — Worker Updates
23. `apps/worker-service/src/utils/llm-client.ts` — multi-provider LLM client.
24. `apps/worker-service/src/worker.ts` — respect `aiFeatures.rootCauseAnalysis` flag + use resolved key.

---

## Section 9 — Key Risk & Constraint Register

| Risk | Mitigation |
|---|---|
| BYOK key stored in plaintext if mishandled | `resolveLlmConfig()` is the only place that calls `decrypt()`. Routes never store or log decrypted keys. |
| LLM generates NoSQL injection via chatbot | `sanitizePipeline()` is mandatory, runs before every `aggregate()` call. Org isolation is injected at layer 2 of the sanitizer, after LLM output. |
| Log context overflow (Feature A) | First-10% + last-90% truncation strategy with explicit `[TRUNCATED]` marker. |
| DB payload too large (Feature B flakiness) | Fetch is hard-limited to last 20 executions per group; only `status`, `error`, `output` fields are fetched (projection). |
| Worker receives decrypted BYOK key over AMQP | AMQP connections must be TLS. Key is short-lived in memory only; not logged or persisted in the worker. |
| New sidebar nav items clutter UI for non-AI orgs | Nav items are conditionally rendered based on `aiFeatures.*` flags — hidden when feature is off. |

---

## Section 10 — New Environment Variables Required

| Variable | Service | Purpose |
|---|---|---|
| `PLATFORM_OPENAI_API_KEY` | producer | Platform-default OpenAI key (optional if BYOK used) |
| `PLATFORM_ANTHROPIC_API_KEY` | producer | Platform-default Anthropic key (optional if BYOK used) |

`PLATFORM_GEMINI_API_KEY` already exists.

---

*Awaiting your explicit approval to begin Phase 1 implementation.*
