# Client Integration Guide

## Making Your Test Suite *Agnostic-Ready*

This guide explains how to prepare **any containerized automation suite (Python, Java, Node.js, etc.)** so it can run safely and correctly inside the **Agnostic Automation Center**.

The key principle: **The platform controls execution - your repo provides behavior.**

---

## 1. Mandatory `entrypoint.sh`

For security and consistency, the Worker **does not execute arbitrary commands**.
Instead, it always runs:

```bash
/app/entrypoint.sh <folder>
```

### Your responsibility

Create an executable `entrypoint.sh` at the root of your repo. This script acts as the bridge between the platform and your specific test runner.

**Recommended Script Pattern:**

```bash
#!/bin/sh
# entrypoint.sh

FOLDER=$1

# 🧹 CRITICAL: Remove local .env file if it exists.
# We want to rely ONLY on the variables injected by the Worker/Dashboard.
if [ -f .env ]; then
  echo "Removing local .env to enforce injected configuration..."
  rm .env
fi

# Example for Node.js/Playwright:
if [ -z "$FOLDER" ] || [ "$FOLDER" = "all" ]; then
  echo "Running ALL tests..."
  npx playwright test
else
  echo "Running tests in folder: $FOLDER"
  npx playwright test "$FOLDER"
fi
```

### Why this matters

- **Security:** Prevents configuration conflicts.
- **Predictability:** Guarantees the test runs exactly as the Dashboard intended.
- **Flexibility:** Allows folder-level test selection from the UI.

---

## 2. Dockerfile Requirements

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

---

## 3. Environment Variables & Validation

The platform injects environment variables **only if they are whitelisted** in the infrastructure.

### Best Practice

If you use validation libraries like **Zod**, ensure your schema allows for optional defaults or that you have added the variable to the infrastructure's `INJECT_ENV_VARS` list.

---

## 4. What You Should NOT Do ❌

- ❌ Run Playwright directly in Docker `CMD`.
- ❌ Expect shell access to the server.
- ❌ Read infrastructure-level secrets (like the VPS SSH key).
- ❌ Depend on a local `.env` file inside the image.

---

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
2. **Environment:** Select `Dev`, `Staging`, or `Prod`. The system automatically maps this to the correct URL.
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
