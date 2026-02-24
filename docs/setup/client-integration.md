# Client Integration Guide

## Making Your Test Suite *Agnostic-Ready*

This guide explains how to prepare **any containerized automation suite (Python, Java, Node.js, etc.)** so it can run safely and correctly inside the **Agnox**.

The key principle: **The platform controls execution - your repo provides behavior.**

---

## 1. Recommended: Use the Agnox CLI

The fastest way to get started is with the official **Agnox CLI**:

```bash
npx @agnox/agnox-cli@latest init
```

This interactive tool will:

- Generate a `Dockerfile`, `entrypoint.sh`, and `.dockerignore` tailored to your framework
- Auto-detect your Playwright version from `package.json` and pin the correct Docker base image
- Build a multi-platform Docker image (`linux/amd64` + `linux/arm64`) and push it to Docker Hub

**Supported frameworks:** Playwright (TypeScript/Node.js) and Pytest (Python).

📦 **CLI Repository:** [github.com/agnox/agnox-cli](https://github.com/agnox/agnox-cli) ·· **npm:** [@agnox/agnox-cli](https://www.npmjs.com/package/@agnox/agnox-cli)

---

## 2. Manual Setup (Advanced)

If you prefer to set up your project manually, follow the steps below.

### 2.1 Mandatory `entrypoint.sh`

For security and consistency, the Worker **does not execute arbitrary commands**.
Instead, it always runs:

```bash
/app/entrypoint.sh <folder>
```

#### Your responsibility

Create an executable `entrypoint.sh` at the root of your repo. This script acts as the bridge between the platform and your specific test runner.

**Recommended Script Pattern:**

```sh
#!/bin/sh

FOLDER=$1

# Remove local .env to enforce Worker configuration
if [ -f .env ]; then
  echo "Removing local .env to enforce injected configuration..."
  rm .env
fi

echo "Running against BASE_URL: $BASE_URL"

if [ -z "$FOLDER" ] || [ "$FOLDER" = "all" ]; then
  echo "Running ALL tests..."
  npx playwright test
else
  echo "Running tests in folder: $FOLDER"
  npx playwright test "$FOLDER"
fi

# Generate Allure HTML report from raw results
# NOTE: The Agnostic Worker handles report generation automatically!
# You do NOT need 'allure generate' here.
```

> ⚠️ **Do not use `exec`** before your test runner command. Using `exec` replaces the shell process and prevents the worker from correctly tracking the process exit.

#### Why this matters

- **Security:** Prevents configuration conflicts.
- **Predictability:** Guarantees the test runs exactly as the Dashboard intended.
- **Flexibility:** Allows folder-level test selection from the UI.

### 2.2 Dockerfile Requirements

Your test suite **must be containerized** and published to a registry (Docker Hub, GHCR).

```dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Ensure entrypoint is executable
RUN chmod +x /app/entrypoint.sh

# Do NOT use ENTRYPOINT or CMD here.
# The Worker Service will inject the entrypoint command at runtime.
```

### 2.3 Environment Variables & Validation

The platform injects environment variables **only if they are whitelisted** in the infrastructure.

#### Best Practice

If you use validation libraries like **Zod**, ensure your schema allows for optional defaults or that you have added the variable to the infrastructure's `INJECT_ENV_VARS` list.

---

## 3. Register Your Project in the Dashboard

Once your Docker image is built and pushed to a registry:

1. Open the **AAC Dashboard**
2. Go to **Settings → Run Settings**
3. **Create a new project** and enter a project name
4. Enter your **Docker image name** (e.g., `youruser/my-automation:latest`)
5. Configure your **environment URLs** (Dev, Staging, Production)
6. Set a **default test folder** (or leave as `all`)

These settings will pre-fill the Execution Modal each time you launch a new test run.

---

## 4. What You Should NOT Do ❌

- ❌ Run Playwright directly in Docker `CMD`.
- ❌ Expect shell access to the server.
- ❌ Read infrastructure-level secrets (like the VPS SSH key).
- ❌ Depend on a local `.env` file inside the image.

## 5. What You CAN Do ✅

- ✅ Read injected environment variables (`process.env.BASE_URL`).
- ✅ Control test selection via folders.
- ✅ Use any framework (Playwright, Pytest, Robot Framework).

---

## 6. Using the Interactive Dashboard 🎮

Once your image is integrated, you can utilize the Dashboard's advanced features:

### Manual Execution (The Play Button)

You don't need to trigger tests via API. You can launch them visually:

1. Click the **"Launch Execution"** button (Top Right).
2. **Environment:** Select `Dev`, `Staging`, or `Prod` - the system pre-fills the URL from your project settings.
3. **Folder:** Type a folder path (e.g., `tests/login`) or select `all`.
4. **Launch:** The test starts immediately, and you will see logs streaming in real-time.

### 🕵️ Troubleshooting with AI

If a test fails, the system automatically performs a Root Cause Analysis.

1. Look for the status: `ANALYZING` (Purple).
2. Once finished, a ✨ **Sparkle Icon** will appear next to the `FAILED` status.
3. **Click the icon** to open the **AI Analysis Report**.
   - See the exact error reason.
   - Get code snippets for suggested fixes.
   - Understand *why* it failed without reading 1000 log lines.

---

## Client Integration Complete

Your test suite is now **fully agnostic, portable, and secure**.
