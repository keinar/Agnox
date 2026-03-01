# @agnox/playwright-reporter

> **Stream live Playwright test results to your [Agnox](https://agnox.dev) dashboard — test-by-test, in real time.**

Drop this reporter into any Playwright project and every test result, log line, and run summary will appear inside Agnox the moment it happens. No polling. No waiting until the run finishes. Just live visibility into your CI pipeline.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Finding Your Credentials](#finding-your-credentials)
- [CI Integration](#ci-integration)
- [Zero-Crash Guarantee](#zero-crash-guarantee)

---

## Installation

```bash
npm i -D @agnox/playwright-reporter
```

```bash
# yarn
yarn add -D @agnox/playwright-reporter
```

```bash
# pnpm
pnpm add -D @agnox/playwright-reporter
```

Requires `@playwright/test >= 1.40.0` and `Node.js >= 18`.

---

## Quick Start

Open your `playwright.config.ts` and add `@agnox/playwright-reporter` to the `reporter` array:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],          // keep your existing reporters
    ['@agnox/playwright-reporter', {
      apiKey:    process.env.AGNOX_API_KEY!,
      projectId: process.env.AGNOX_PROJECT_ID!,
    }],
  ],
});
```

Then set the two required environment variables before running your suite:

```bash
AGNOX_API_KEY=your_api_key AGNOX_PROJECT_ID=your_project_id npx playwright test
```

That's it. Open your Agnox dashboard and watch results stream in live.

---

## Configuration Reference

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | string | Yes | — | Your Agnox API key. See [Finding Your Credentials](#finding-your-credentials). |
| `projectId` | string | Yes | — | The Agnox Project ID to attach this run to. |
| `baseUrl` | string | No | `'https://api.agnox.dev'` | Override the Agnox API base URL (for self-hosted installs). |

---

## Finding Your Credentials

### `apiKey`

1. Log in to the Agnox Dashboard at [https://agnox.dev](https://agnox.dev).
2. Navigate to **Settings → API Keys** (or Profile).
3. Generate a new API Key and copy it.
4. Store it as a secret in your CI provider — never hard-code it in your config file.

### `projectId`

1. Navigate to **Settings → Run Settings** in the Agnox Dashboard.
2. Select your project from the dropdown.
3. Copy the **Project ID** shown at the top of the "Execution Defaults" section.

> **Tip for GitHub Actions:** Add both values as repository secrets, then reference them with `${{ secrets.AGNOX_API_KEY }}` in your workflow YAML.

---

## CI Integration

The reporter automatically detects your CI environment and attaches context (branch, commit SHA, PR number, run URL) to every result — no extra config needed.

| Platform | Auto-detected? |
|---|---|
| GitHub Actions | ✅ |
| GitLab CI | ✅ |
| Azure DevOps | ✅ |
| Jenkins | ✅ |
| Any `CI=true` environment | ✅ (reported as generic) |
| Local machine | — (runs are still captured) |

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

The Agnox reporter is built on a strict "Do No Harm" principle:

- If the Agnox API is unreachable (network outage, wrong `baseUrl`, firewall), the reporter silently becomes a no-op after one automatic retry.
- If a single event batch fails to deliver, it is discarded — the run continues unaffected.
- Reporter errors are never re-thrown to Playwright. They are either swallowed silently or written to `stderr` when `debug: true`.
- The teardown flush waits at most **10 seconds** per request before giving up — it will not hang your CI job.

In short: the worst-case outcome of a misconfigured API key is a run that simply doesn't appear in Agnox. Your green builds stay green.
