# Agnostic Automation Center - Integration Guide

This guide explains how to connect your test automation projects to the Agnostic Automation Center.

---

## Quickstart

### Prerequisites

- Active organization account with valid API token
- Docker image containing your test framework
- Test project configured with environment variables

### Step 1: Get Your API Token

1. Log in to the dashboard at your instance URL
2. Navigate to **Settings** → **Profile**
3. Copy your JWT token from the browser's local storage or use the login API

### Step 2: Configure Your Test Project

#### Environment Variables

Your Docker container will receive these environment variables:

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Target application URL |
| `ENVIRONMENT` | Test environment (staging, production) |
| `API_TOKEN` | Your JWT authentication token |

### Step 3: Submit a Test Execution

#### Using the Dashboard

1. Click **"Run New Test"** button
2. Select your Docker image
3. Configure environment and command
4. Click **Run**

#### Using the API

```bash
curl -X POST "https://your-instance.com/api/executions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "your-org/test-image:latest",
    "command": "npx playwright test",
    "environment": "staging",
    "baseUrl": "https://staging.yourapp.com",
    "folder": "tests/e2e"
  }'
```

---

## Framework Examples

### Playwright

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

CMD ["npx", "playwright", "test", "--reporter=html"]
```

**playwright.config.ts:**
```typescript
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  reporter: [['html', { outputFolder: '/output/playwright-report' }]],
});
```

### Pytest

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

CMD ["pytest", "--html=/output/report.html", "-v"]
```

**conftest.py:**
```python
import os
import pytest

@pytest.fixture
def base_url():
    return os.environ.get('BASE_URL', 'http://localhost:3000')
```

---

## Output & Reports

### Report Directory

All test output should be written to `/output/` inside the container:

```
/output/
├── playwright-report/    # Playwright HTML report
├── screenshots/          # Failure screenshots
├── videos/              # Test recordings
└── results.json         # Test results
```

### Accessing Reports

After execution completes, reports are available at:
```
https://your-instance.com/reports/{organizationId}/{taskId}/
```

---

## Real-Time Updates

The dashboard receives real-time status updates via WebSocket. Your tests can emit progress by writing to stdout:

```javascript
console.log('[PROGRESS] 50% - Running login tests');
```

---

## Troubleshooting

### Container Fails to Start

1. Verify the Docker image exists and is accessible
2. Check that required environment variables are set
3. Review container logs in the execution details

### Tests Not Found

1. Ensure your `command` matches your test runner
2. Verify the test files are included in the Docker image
3. Check the `folder` path matches your project structure

### Reports Not Visible

1. Confirm reports are written to `/output/` directory
2. Check file permissions in the container
3. Wait for the execution to complete (status: `passed` or `failed`)

---

## API Reference

See [API Documentation](/docs/api/) for complete endpoint reference.
