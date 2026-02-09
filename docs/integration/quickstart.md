# Agnostic Automation Center - Integration Quickstart

Connect your test automation project to the platform and run your first test in minutes.

---

## Prerequisites

- **Docker Hub account** with a pushed automation image
- **Platform account** at [automation.keinar.com](https://automation.keinar.com)

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

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
CMD ["all"]
```

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

1. Go to [https://automation.keinar.com](https://automation.keinar.com)
2. Click **Sign Up** and create your account
3. Your organization is created automatically (you're the admin)

---

## Step 4: Generate an API Key

For CI/CD integration, generate an API Key (no username/password required):

1. Login to [https://automation.keinar.com](https://automation.keinar.com)
2. Go to **Settings → Profile**
3. Scroll to **API Access** section
4. Click **Generate New Key**
5. Give it a name (e.g., "GitHub Actions")
6. **Copy the key immediately** - it's only shown once!

Store the API key securely in your CI/CD secrets (e.g., `AAC_API_KEY`).

---

## Step 5: Execute Tests

### Option A: Via Dashboard

1. Login to [https://automation.keinar.com](https://automation.keinar.com)
2. Click **"Run New Test"**
3. Enter your Docker image name
4. Select environment and folder
5. Click **Run**

### Option B: Via API

```bash
curl -X POST "https://api.automation.keinar.com/api/executions" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "your-dockerhub-user/my-automation:latest",
    "command": "npx playwright test",
    "environment": "staging",
    "baseUrl": "https://staging.automation.keinar.com",
    "folder": "tests/e2e"
  }'
```

### Option C: CI/CD Integration (GitHub Actions)

```yaml
name: Run E2E Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Tests
        run: |
          curl -X POST https://api.automation.keinar.com/api/executions \
            -H "Content-Type: application/json" \
            -H "x-api-key: ${{ secrets.AAC_API_KEY }}" \
            -d '{
              "image": "your-dockerhub-user/my-automation:latest",
              "folder": "tests",
              "baseUrl": "${{ secrets.TARGET_URL }}"
            }'
```

---

## Step 6: Monitor & Review Results

1. **Live Dashboard** - Watch tests execute in real-time
2. **WebSocket Logs** - See console output streaming live
3. **AI Analysis** - When tests fail, AI analyzes root cause automatically
4. **Reports** - Access HTML and Allure reports at:
   ```
   https://api.automation.keinar.com/reports/{organizationId}/{taskId}/
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

### Container Fails to Start

1. Verify `entrypoint.sh` exists at `/app/entrypoint.sh`
2. Check file has executable permissions (`chmod +x`)
3. Ensure Unix line endings (not Windows CRLF)

### Tests Not Found

1. Verify folder path matches your project structure
2. Check that test files are included in Docker image
3. Review logs for path-related errors

### Reports Not Visible

1. Reports must be written to `/app/<report-folder>`
2. Wait for execution to complete (status: `PASSED` or `FAILED`)
3. Check that report generation step succeeded in logs

---

## Next Steps

- [Docker Setup Guide](./docker-setup.md) - Detailed container protocol
- [API Reference](/docs/api/) - Complete API documentation
- [Authentication API](/docs/api/authentication.md) - Token management
