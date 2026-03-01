# @agnox/playwright-reporter

> **Stream live Playwright test results to your [Agnox](https://dev.agnox.dev) dashboard — test-by-test, in real time.**

Drop this reporter into any Playwright project and every test result, log line, and run summary will appear inside Agnox the moment it happens. No polling. No waiting until the run finishes. Just live visibility into your CI pipeline.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Finding Your Credentials](#finding-your-credentials)
- [CI Integration](#ci-integration)
- [Zero-Crash Guarantee](#zero-crash-guarantee)
- [Advanced Options](#advanced-options)

---

## Installation

```bash
npm i -D @agnox/playwright-reporter
```

```bash
# yarn
yarn add -D @agnox/playwright-reporter

# pnpm
pnpm add -D @agnox/playwright-reporter
```

> **Requires** `@playwright/test >= 1.40.0` and Node.js `>= 18`.

---

## Quick Start

Open your `playwright.config.ts` and add `AgnoxReporter` to the `reporter` array:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import AgnoxReporter from '@agnox/playwright-reporter';

export default defineConfig({
  reporter: [
    ['list'],          // keep your existing reporters
    [AgnoxReporter, {
      apiKey:    process.env.AGNOX_API_KEY!,
      projectId: process.env.AGNOX_PROJECT_ID!,
    }],
  ],
});
```

Then set the two required environment variables before running your suite:

```bash
AGNOX_API_KEY=ak_live_...  AGNOX_PROJECT_ID=proj_...  npx playwright test
```

That's it. Open your Agnox dashboard and watch results stream in live.

---

## Configuration Reference

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | `string` | **Yes** | — | Your Agnox API key. See [Finding Your Credentials](#finding-your-credentials). |
| `projectId` | `string` | **Yes** | — | The Agnox Project ID to attach this run to. |
| `runName` | `string` | No | *(auto)* | A human-readable label for the run, e.g. `"PR #42 — smoke"`. |
| `environment` | `'development' \| 'staging' \| 'production'` | No | `'production'` | Tags the run with the target environment. |
| `flushIntervalMs` | `number` | No | `2000` | How often (ms) to batch-flush events to the API. |
| `maxBatchSize` | `number` | No | `50` | Max events per batch before a size-triggered flush. |
| `debug` | `boolean` | No | `false` | Writes Agnox reporter activity to `stderr`. Useful for troubleshooting. |
| `baseUrl` | `string` | No | `'https://dev.agnox.dev'` | Override the Agnox API base URL (self-hosted installs only). |

### Full example

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import AgnoxReporter from '@agnox/playwright-reporter';

export default defineConfig({
  reporter: [
    ['html'],
    [AgnoxReporter, {
      apiKey:          process.env.AGNOX_API_KEY!,
      projectId:       process.env.AGNOX_PROJECT_ID!,
      runName:         `PR #${process.env.PR_NUMBER} — regression`,
      environment:     'staging',
      flushIntervalMs: 1000,   // flush more aggressively in CI
      debug:           false,
    }],
  ],
});
```

---

## Finding Your Credentials

### `apiKey`

1. Log in to the **Agnox Dashboard**.
2. Navigate to **Settings → API Keys**.
3. Click **Generate New Key** (or copy an existing one).
4. Store it as a secret in your CI provider — never hard-code it in your config file.

### `projectId`

1. From the sidebar, open the **Project** you want to report into.
2. Go to **Settings → General** inside that project.
3. Copy the **Project ID** shown at the top of the page (format: `proj_...`).

> **Tip for GitHub Actions:** Add both values as [repository secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets), then reference them with `${{ secrets.AGNOX_API_KEY }}` in your workflow YAML.

---

## CI Integration

The reporter **automatically detects your CI environment** and attaches context (branch, commit SHA, PR number, run URL) to every result — no extra config needed.

| Platform | Auto-detected? |
|---|---|
| GitHub Actions | ✅ |
| GitLab CI | ✅ |
| Azure DevOps | ✅ |
| Jenkins | ✅ |
| Any `CI=true` environment | ✅ (reported as generic) |
| Local machine | — *(runs are still captured)* |

### GitHub Actions — minimal workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        env:
          AGNOX_API_KEY:    ${{ secrets.AGNOX_API_KEY }}
          AGNOX_PROJECT_ID: ${{ secrets.AGNOX_PROJECT_ID }}
        run: npx playwright test
```

---

## Zero-Crash Guarantee

**Your test suite will never fail because of this reporter.**

The Agnox reporter is built on a strict *"Do No Harm"* principle:

- If the Agnox API is **unreachable** (network outage, wrong `baseUrl`, firewall), the reporter silently becomes a **no-op** after one automatic retry.
- If a **single event batch** fails to deliver, it is discarded — the run continues unaffected.
- Reporter errors are **never re-thrown** to Playwright. They are either swallowed silently or written to `stderr` when `debug: true`.
- The teardown flush waits at most **10 seconds** per request before giving up — it will not hang your CI job.

In short: the worst-case outcome of a misconfigured API key is a run that simply doesn't appear in Agnox. Your green builds stay green.

---

## Advanced Options

### Labelling runs dynamically

```ts
runName: `${process.env.GITHUB_REF_NAME} @ ${new Date().toISOString().slice(0, 10)}`,
```

### Environment tagging

Use `environment` to visually separate runs in the dashboard:

```ts
environment: (process.env.TARGET_ENV as 'development' | 'staging' | 'production') ?? 'production',
```

### Debugging connectivity issues

Enable `debug: true` to print every request and response status to `stderr`. This will not affect your test output or exit code.

```ts
[AgnoxReporter, { apiKey: '...', projectId: '...', debug: true }]
```

---

## License

MIT © [Agnox](https://dev.agnox.dev)
