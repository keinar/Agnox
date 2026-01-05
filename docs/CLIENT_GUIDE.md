# Client Integration Guide

## Making Your Test Suite *Agnostic-Ready*

This guide explains how to prepare **any containerized automation suite (Python, Java, Node.js, etc.)** so it can run safely and correctly inside the **Agnostic Automation Center**.

The key principle: **The platform controls execution - your repo provides behavior.**

------------------------------------------------------------------------

## 1. Mandatory `entrypoint.sh`

For security and consistency, the Worker **does not execute arbitrary commands**. 
Instead, it always runs:

``` bash
/app/entrypoint.sh <folder>
```

### Your responsibility

Create an executable `entrypoint.sh` at the root of your repo. This script acts as the bridge between the platform and your specific test runner (e.g., Pytest, Maven, or Playwright).

``` bash
#!/bin/bash
# entrypoint.sh

FOLDER=$1

# Example for Node.js/Playwright:
if [ "$FOLDER" = "all" ] || [ -z "$FOLDER" ]; then
  npx playwright test
else
  npx playwright test "$FOLDER"
fi

# Example for Python/Pytest (uncomment if using Python):
# if [ "$FOLDER" = "all" ] || [ -z "$FOLDER" ]; then
#   pytest
# else
#   pytest "$FOLDER"
# fi
```

### Why this matters

-   Prevents command injection
-   Guarantees predictable execution
-   Allows folder-level test selection from the UI

------------------------------------------------------------------------

## 2. Dockerfile Requirements

Your test suite **must be containerized** and published to a registry (Docker Hub, GHCR, ECR, etc.).

### Example Dockerfile (Playwright)

#### While the example below uses Playwright/Node, you can use any base image (Python, Ruby, Java, etc.) as long as it includes your test runner and the mandatory entrypoint script.

``` dockerfile
FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app
COPY . .

RUN npm install
RUN chmod +x /app/entrypoint.sh
```

### Best Practices

-   Avoid hardcoding environment values
-   Keep images small and deterministic
-   Use `.dockerignore` aggressively

------------------------------------------------------------------------

## 3. Environment Variables & Validation

The platform injects environment variables **only if they are
whitelisted**.

### If you use Zod (or similar validators):

-   Provide defaults **OR**
-   Ensure variables are added to `INJECT_ENV_VARS` in infrastructure

Failure to do so will cause runtime errors such as:

``` text
ZodError: Required environment variable missing
```

------------------------------------------------------------------------

## 4. What You Should NOT Do ❌

-   ❌ Run Playwright directly in Docker CMD
-   ❌ Expect shell access
-   ❌ Read infrastructure-level secrets
-   ❌ Depend on local `.env` files

------------------------------------------------------------------------

## 5. What You CAN Do ✅

-   ✅ Read injected environment variables
-   ✅ Control test selection via folders
-   ✅ Use any framework and language (Playwright, Pytest, JUnit, Robot Framework, etc.)
-   ✅ Update logic without touching infrastructure

------------------------------------------------------------------------

## Client Integration Complete

Once your image is pushed, simply provide: 
- **Docker image name** 
- **Target URL** 
- **Test folder (optional)**

Your test suite is now **fully agnostic, portable, and secure**.
