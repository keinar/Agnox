# Agnox - Integration Quickstart

Connect your test automation project to the platform and run your first test in minutes.

---

## Dual Architecture: Choose Your Integration Mode

Agnox supports two distinct ways to run and observe your tests. Choose the mode that fits your team's workflow:

| | **Agnox Hosted** | **External CI (Passive Reporter)** |
|---|---|---|
| **How it works** | Agnox provisions a Docker container, executes your tests inside it, and streams results back | Your CI pipeline runs tests natively; a lightweight reporter streams results to Agnox in real-time |
| **Requires Docker image** | Yes — you push your image to Docker Hub | No — works with any existing Playwright setup |
| **CI pipeline** | Optional (trigger via Dashboard, API, or CI webhook) | Required — tests must run in a CI environment or locally |
| **Live terminal** | Full Docker stdout/stderr | All Playwright stdout/stderr |
| **AI root cause analysis** | Automatic on failure | Automatic on failure |
| **Dashboard source label** | `Agnox Hosted` | `External CI` |
| **Best for** | Full isolation, multi-framework, scheduled runs | Teams already running Playwright in GitHub Actions, GitLab CI, or locally |

> **Not sure which to choose?** Start with the **Passive Reporter** (Option D below) if you already run Playwright in a CI pipeline — it requires zero infrastructure changes. Use **Agnox Hosted** when you need a fully managed execution environment, framework agnosticism, or scheduled runs.

---

## Agnostic Deployment with Agnox CLI

The Agnox CLI provides a **Zero-Config** experience through **Deep Analysis** of your project. It starts by collecting your Docker Hub identity and deep-scans your local configuration (`package.json`, `requirements.txt`, or `pyproject.toml`) for smart version pinning. With its platform intelligence, it automatically detects browser channels, reporting tools, and system dependencies, eliminating "it works on my machine" issues by proactively warning and adjusting for platform constraints.

**Key Features:**
- **Automated Infrastructure Sync:** Deep framework analysis to pin base images to your exact local versions.
- **Multi-Platform Buildx Execution:** Intelligent platform adjustment (e.g., forcing `linux/amd64` for proprietary browser channels) for seamless cross-platform deployments.
- **AI-Powered Root Cause Integration:** Automatic configuration of reporting tools (like Allure) to ensure rich data for downstream AI debugging.

```bash
npx @agnox/agnox-cli@latest init
```

> **Next Steps:** If you choose manual deployment, the CLI generates personalized `docker buildx` commands and instructions that are specific to your Docker Hub identity and copy-paste ready.

---

## Manual Setup

### Prerequisites

- **Docker Hub account** with a pushed automation image
- **Platform account** at [agnox.dev](https://agnox.dev)

---

## Step 1: Prepare Your Project

Your automation container must follow the [Container Protocol](./docker-setup.md). At minimum, you need:

### 1.1 Create `entrypoint.sh`

```bash
#!/bin/sh
FOLDER_PATH=$1
echo "🚀 Starting Agnostic Automation..."

# Handle environment enforcement
if [ -f .env ]; then
    echo "🧹 Removing local .env to enforce Worker configuration..."
    rm .env
fi

# Execution Logic
if [ -z "$FOLDER_PATH" ] || [ "$FOLDER_PATH" = "all" ]; then
    echo "▶️ Running ALL tests against $BASE_URL..."
    npx playwright test
else
    echo "▶️ Running tests in: $FOLDER_PATH against $BASE_URL..."
    npx playwright test "$FOLDER_PATH"
fi

# Report Generation
echo "📊 Generating Allure Report..."
npx allure generate allure-results --clean -o allure-report
```

### 1.2 Create Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy
WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npm install -g allure-commandline

COPY . .
RUN chmod +x /app/entrypoint.sh

# ⚠️ IMPORTANT: Do NOT add ENTRYPOINT or CMD
# The agnox Worker injects the entrypoint at runtime to handle environment variables 
# and log streaming. Adding them here will conflict with the execution engine.
```

> ⚠️ Do not add `ENTRYPOINT` or `CMD` to your Dockerfile. The Worker injects the entrypoint at runtime - adding them will conflict with the execution engine.

### 1.3 Configure Your Framework

Ensure your test framework reads `BASE_URL` from environment:

**playwright.config.ts:**
```typescript
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],
});
```

---

## Step 2: Build & Push Your Image

```bash
# Build your image
docker build -t your-dockerhub-user/my-automation:latest .

# Push to Docker Hub
docker push your-dockerhub-user/my-automation:latest
```

---

## Step 3: Register on the Platform

1. Go to [https://agnox.dev](https://agnox.dev)
2. Click **Sign Up** and create your account
3. Your organization is created automatically (you're the admin)

---

## Step 4: Generate an API Key

For CI/CD integration, generate an API Key (no username/password required):

1. Login to [https://agnox.dev](https://agnox.dev)
2. Go to **Settings → Profile**
3. Scroll to **API Access** section
4. Click **Generate New Key**
5. Give it a name (e.g., "GitHub Actions")
6. **Copy the key immediately** - it's only shown once!

Store the API key securely in your CI/CD secrets (e.g., `AAC_API_KEY`).

---

## Step 5: Execute Tests

### Option A: Via Dashboard

1. Login to [https://agnox.dev](https://agnox.dev)
2. Click **"Run"**
3. Enter your Docker image name
4. Select environment and folder
5. Click **Run**

### Option B: Via API

```bash
curl -X POST "https://api.agnox.dev/api/executions" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "your-dockerhub-user/my-automation:latest",
    "command": "npx playwright test",
    "environment": "staging",
    "baseUrl": "https://staging.agnox.dev",
    "folder": "tests/e2e"
  }'
```

### Option C: CI/CD Trigger (Agnox Hosted — GitHub Actions)

```yaml
name: Run E2E Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Tests via Agnox
        run: |
          curl -X POST https://api.agnox.dev/api/ci/trigger \
            -H "Content-Type: application/json" \
            -H "x-api-key: ${{ secrets.AGNOX_API_KEY }}" \
            -d '{
              "projectId": "${{ secrets.AGNOX_PROJECT_ID }}",
              "image": "your-dockerhub-user/my-automation:latest",
              "folder": "tests/e2e",
              "config": { "environment": "staging", "baseUrl": "${{ secrets.TARGET_URL }}" },
              "ciContext": {
                "source": "github",
                "repository": "${{ github.repository }}",
                "prNumber": ${{ github.event.number || 0 }},
                "commitSha": "${{ github.sha }}"
              }
            }'
```

> Agnox provisions a Docker container and runs your tests on its infrastructure. Results appear in the Dashboard under the **Agnox Hosted** source filter.

---

### Option D: Native Playwright Reporter (External CI — No Docker Required)

Stream live results from your existing Playwright setup directly to Agnox — no Docker image, no container provisioning.

**Step 1 — Install the reporter:**

```bash
npm install --save-dev @agnox/playwright-reporter
```

**Step 2 — Add to `playwright.config.ts`:**

> ⚠️ `dotenv/config` must be imported at the very top of the file so environment variables are available when Playwright evaluates the reporter config.

```typescript
// playwright.config.ts
import 'dotenv/config'; // ← must be FIRST
import { defineConfig } from '@playwright/test';
import AgnoxReporter from '@agnox/playwright-reporter';

export default defineConfig({
  reporter: [
    ['list'],
    [AgnoxReporter, {
      apiKey:    process.env.AGNOX_API_KEY!,
      projectId: process.env.AGNOX_PROJECT_ID!,
      // environment: 'staging', // optional
      // runName: 'PR smoke tests', // optional label in the Dashboard
    }],
  ],
});
```

**Step 3 — Add secrets to your CI provider and run:**

```yaml
# .github/workflows/e2e.yml
steps:
  - uses: actions/checkout@v4
  - run: npm ci
  - run: npm run build -w @agnox/playwright-reporter  # build the workspace package
  - run: npx playwright install --with-deps
  - name: Run Playwright tests
    env:
      AGNOX_API_KEY:    ${{ secrets.AGNOX_API_KEY }}
      AGNOX_PROJECT_ID: ${{ secrets.AGNOX_PROJECT_ID }}
    run: npx playwright test
```

The reporter auto-detects GitHub Actions, GitLab CI, Azure DevOps, and Jenkins — repository, branch, PR number, and commit SHA are attached to every run automatically.

> Results appear in the Dashboard under the **External CI** source filter. Use the **Source** filter chip in the Filter Bar to separate these runs from Agnox Hosted Docker runs.

#### Zero-Crash Guarantee

The reporter is built on a "Do No Harm" principle. If the Agnox API is unreachable or your credentials are wrong, the reporter silently becomes a no-op. **Your CI pipeline will never fail because of this reporter.** The worst-case outcome is that the run simply does not appear in Agnox.

---

## Step 6: Monitor & Review Results

1. **Live Dashboard** - Watch tests execute in real-time
2. **WebSocket Logs** - See console output streaming live
3. **AI Analysis** - When tests fail, AI analyzes root cause automatically
4. **Reports** - Access HTML and Allure reports at:
   ```
   https://api.agnox.dev/reports/{organizationId}/{taskId}/
   ```

---

## Environment Variables Reference

Your container receives these environment variables:

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Target application URL (from your config or platform default) |
| `TASK_ID` | Unique execution identifier |
| `CI` | Always `true` in platform execution |
| `FRAMEWORK_AGNOSTIC` | Always `true` |

---

## Troubleshooting

### Container Fails to Start (Agnox Hosted)

1. Verify `entrypoint.sh` exists at `/app/entrypoint.sh`
2. Check file has executable permissions (`chmod +x`)
3. Ensure Unix line endings (not Windows CRLF)

### Tests Not Found (Agnox Hosted)

1. Verify folder path matches your project structure
2. Check that test files are included in Docker image
3. Review logs for path-related errors

### Reports Not Visible (Agnox Hosted)

1. Reports must be written to `/app/<report-folder>`
2. Wait for execution to complete (status: `PASSED` or `FAILED`)
3. Check that report generation step succeeded in logs

### Reporter is Silent Locally — No Data in Dashboard (External CI)

**Check 1 — `dotenv.config()` must be the first line of `playwright.config.ts`.**

Playwright evaluates the config file before `dotenv` can run if the import is misplaced. Any `if (process.env.AGNOX_API_KEY)` guard will always be `false` unless `dotenv` runs first.

```typescript
import 'dotenv/config'; // ← FIRST line, before anything else
```

**Check 2 — `baseUrl` must point at the Agnox API, not your app.**

The reporter's `baseUrl` option is the URL of the **Agnox ingest API** (`https://api.agnox.dev`), not the URL of the application being tested. Confusing these two causes all reporter requests to silently 404 on your app server.

Remove `baseUrl` from the reporter options entirely — the default is correct for most users:

```typescript
[AgnoxReporter, {
  apiKey:    process.env.AGNOX_API_KEY!,
  projectId: process.env.AGNOX_PROJECT_ID!,
  // Do NOT set baseUrl to your app URL
}],
```

Enable `debug: true` temporarily to see what the reporter is attempting:

```typescript
[AgnoxReporter, { apiKey: '...', projectId: '...', debug: true }],
```

### `MODULE_NOT_FOUND` for `@agnox/playwright-reporter` in CI (External CI)

The compiled `dist/` folder is git-ignored and is not present after a fresh `npm ci`. The package must be built in CI before running Playwright:

```yaml
- run: npm ci
- run: npm run build -w @agnox/playwright-reporter   # ← add this
- run: npx playwright test
```

---

## Next Steps

- [Docker Setup Guide](./docker-setup.md) - Detailed container protocol
- [API Reference](/docs/api/) - Complete API documentation
- [Authentication API](/docs/api/authentication.md) - Token management
