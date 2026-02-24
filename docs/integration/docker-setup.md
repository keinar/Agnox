# Docker Container Setup Guide

This guide explains how to prepare your Docker image to work with the Agnox Worker.

---

## Container Protocol

The Worker service executes your automation container using a specific protocol. Your container **MUST** be configured to support this protocol.

### How the Worker Runs Your Container

When you trigger a test execution, the Worker:

1. Pulls your Docker image
2. Runs: `/bin/sh /app/entrypoint.sh <folder>`
3. Injects environment variables (including `BASE_URL`)
4. Streams logs in real-time
5. Collects reports from predefined paths

### Required Arguments

Your `entrypoint.sh` script receives:

| Argument | Description |
|----------|-------------|
| `$1` | Folder path to run tests in (e.g., `tests/e2e`). If empty or `"all"`, run all tests. |

### Injected Environment Variables

The Worker automatically injects these environment variables into your container:

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Target website URL to test against |
| `TASK_ID` | Unique execution identifier |
| `CI` | Set to `true` (indicates CI environment) |
| `FRAMEWORK_AGNOSTIC` | Set to `true` |

---

## Standard Entrypoint Script

Create an `entrypoint.sh` file in your project root with the following content:

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

> [!IMPORTANT]
> The script **MUST** be located at `/app/entrypoint.sh` inside your container.

---

## Dockerfile Template

Here's a complete Dockerfile template for Playwright projects:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Install Allure CLI
RUN npm install -g allure-commandline

# Copy project files
COPY . .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Default entrypoint (Worker overrides with specific folder)
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
CMD ["all"]
```

### Key Points

1. **WORKDIR must be `/app`** - The Worker expects your code at this path
2. **entrypoint.sh must be executable** - Use `chmod +x`
3. **ENTRYPOINT format** - Use exec form with shell invocation

---

## Report Output Paths

The Worker collects reports from these paths inside your container:

| Path | Report Type |
|------|-------------|
| `/app/playwright-report` | Native Playwright HTML report |
| `/app/pytest-report` | Pytest HTML report |
| `/app/mochawesome-report` | Mocha/Cypress report |
| `/app/allure-results` | Allure raw results |
| `/app/allure-report` | Generated Allure HTML report |

> [!TIP]
> Configure your test framework to output reports to these paths for automatic collection.

---

## Framework-Specific Examples

### Playwright (TypeScript)

**playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],
});
```

### Pytest

**conftest.py:**
```python
import os
import pytest

@pytest.fixture(scope='session')
def base_url():
    return os.environ.get('BASE_URL', 'http://localhost:3000')
```

**entrypoint.sh for Pytest:**
```bash
#!/bin/sh
FOLDER_PATH=$1
echo "🚀 Starting Pytest Automation..."

if [ -z "$FOLDER_PATH" ] || [ "$FOLDER_PATH" = "all" ]; then
    pytest --html=/app/pytest-report/report.html --self-contained-html
else
    pytest "$FOLDER_PATH" --html=/app/pytest-report/report.html --self-contained-html
fi
```

### Cypress

**cypress.config.js:**
```javascript
module.exports = {
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'mochawesome-report',
    html: true,
  },
};
```

---

## Troubleshooting

### Container Fails to Start

1. **Verify entrypoint.sh exists** at `/app/entrypoint.sh`
2. **Check file permissions** - Run `chmod +x entrypoint.sh` before building
3. **Use Unix line endings** - Windows CRLF will break shell scripts

### Tests Not Running

1. **Check BASE_URL** - Your tests should use `process.env.BASE_URL`
2. **Verify folder path** - Ensure the folder argument matches your test structure
3. **Review container logs** - Check execution output in the dashboard

### Reports Not Collected

1. **Verify output paths** - Reports must be in `/app/<report-folder>`
2. **Check report generation** - Ensure Allure/HTML reports are actually generated
3. **Wait for completion** - Reports are collected only after container exits

---

## Next Steps

- [Integration Quickstart](./quickstart.md) - Complete integration guide
- [API Reference](/docs/api/) - Programmatic test execution
