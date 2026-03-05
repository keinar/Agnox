---
id: executions
title: Running & Managing Executions
sidebar_position: 1
---

# Running & Managing Executions

The execution engine is the heart of Agnox. This guide covers triggering test runs, monitoring live output, and managing your execution history at scale.

---

## Running Tests

### Option A: Via Dashboard (Recommended)

1. Click **Run Test** (top right of the dashboard).
2. Select your **Project** — settings are pre-filled from Run Settings.
3. Select the **Environment** (Development / Staging / Production).
4. *(Optional)* Override the folder path.
5. *(Optional)* Enter a **Group Name** — use the smart combobox to select an existing group (appends to it) or type a new name to create one.
6. Click **Start Execution**.

### Option B: Via API

```bash
curl -X POST https://api.agnox.dev/api/executions \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "your-dockerhub-user/my-tests:latest",
    "command": "npx playwright test",
    "environment": "staging",
    "baseUrl": "https://staging.myapp.com",
    "folder": "tests/e2e"
  }'
```

### Option C: CI/CD Trigger

Use `POST /api/ci/trigger` to start a run from your pipeline and pass CI context for automatic naming and traceability:

```bash
curl -X POST https://api.agnox.dev/api/ci/trigger \
  -H "Content-Type: application/json" \
  -H "x-api-key: $AGNOX_API_KEY" \
  -d '{
    "projectId": "<your-project-id>",
    "image": "myorg/my-tests:latest",
    "command": "npx playwright test",
    "folder": "tests/e2e",
    "config": {
      "environment": "staging",
      "baseUrl": "https://staging.myapp.com"
    },
    "ciContext": {
      "source": "github",
      "repository": "myorg/my-repo",
      "prNumber": 42,
      "commitSha": "abc1234"
    }
  }'
```

Returns `{ cycleId, taskId, status: "PENDING" }`. The cycle appears immediately in **Test Cycles** with a name derived from the repository and PR number.

**Find your Project ID:** Settings → Run Settings → select your project → copy the **Project ID** shown in the Execution Defaults section.

---

## Execution Status Lifecycle

```
PENDING → RUNNING → ANALYZING → PASSED / FAILED / UNSTABLE / ERROR
```

- **PENDING** — queued in RabbitMQ, waiting for a Worker
- **RUNNING** — Worker has started the Docker container; logs are streaming
- **ANALYZING** — container has exited; AI root-cause analysis is in progress
- **PASSED / FAILED / UNSTABLE / ERROR** — terminal state

---

## Live Logs & Investigation Hub

Click any execution row to open the **Investigation Hub** side drawer. The drawer URL updates with `?drawerId=<taskId>` — these links can be copied and shared directly.

The drawer has three tabs:

| Tab | Content |
|-----|---------|
| **Terminal** | Live log stream with auto-scroll toggle and `.txt` download |
| **Artifacts** | Media gallery — screenshots, videos, and downloadable trace zips |
| **AI Analysis** | Gemini-powered root-cause analysis for failed executions |

> The **AI Analysis** tab is hidden when the execution status is `ERROR` — AI cannot effectively analyze platform or container launch errors.

---

## Organizing Executions

### Flat vs. Grouped Views

Use the **View** toggle (top-right of the execution list) to switch modes:

- **Flat View** — all executions in reverse-chronological order; best for reviewing recent activity
- **Grouped View** — executions aggregated by `groupName`; each group shows a pass/fail summary badge and the timestamp of the most recent run; click a group header to expand or collapse

Both views support the full filter bar (status, environment, date range) and pagination.

### Bulk Actions

Select one or more execution rows using the checkboxes. A floating **Bulk Actions** bar appears with:

| Action | Description |
|--------|-------------|
| **Assign Group** | Type a group name and apply it to all selected executions |
| **Ungroup** | Remove the `groupName` from selected executions |
| **Delete** | Soft-delete up to 100 executions in a single API call |

> Deleted executions are retained in the database for billing accuracy and excluded from all dashboard views.

---

## Environment Variables

Custom variables can be defined per-project in **Settings → Env Variables**:

- Encrypted at rest with AES-256-GCM
- Injected directly into the test container at runtime
- Mark values as **Secret** to redact them from streamed logs

---

## AI Root-Cause Analysis

When a test fails:

1. Click the execution row to open the Investigation Hub.
2. Switch to the **AI Analysis** tab.
3. The two-step pipeline generates a diagnosis:
   - **Analyzer** — generates a structured root-cause and suggested fix
   - **Critic** — validates every claim against raw logs, eliminating hallucinations
4. The final output is clean, developer-facing Markdown.

AI analysis can be disabled per-organization in **Settings → Organization**.

---

## Auto-Quarantine & Quality Gate Bypass

Phase 5 introduces **Auto-Quarantine** to prevent flaky tests from blocking your CI/CD pipelines.

### How it Works
1. When a test fails **3 consecutive times**, Agnox automatically flags it as quarantined.
2. In the **Test Cases** table, these tests appear with a prominent **QUARANTINED** badge.
3. In the **Investigation Hub**, quarantined failures are dimmed and struck-through.

### Quality Gate Bypass
The Agnox CI/CD webhook (`POST /api/webhooks/ci/pr`) implements a smart quality gate:
- If an execution fails, but **all failed tests are currently quarantined**, the webhook will return a `PASSED` status to your CI provider (e.g., GitHub Actions).
- This ensures that known flaky tests do not halt your deployment pipeline while your team works on a fix.
- A test automatically "self-heals" and leaves quarantine as soon as it passes once.

> **Note:** Auto-Quarantine must be enabled in **Settings → Run Settings** for each project.

---

## Related

- [Test Cases →](./test-cases)
- [Test Cycles →](./test-cycles)
- [Scheduling →](./scheduling)
- [Playwright Reporter →](../integrations/playwright-reporter)
