# 🛠️ Infrastructure Setup Guide

This guide explains how to deploy the **Automation Center** on a Linux
server (Oracle Cloud / VPS).

------------------------------------------------------------------------

## 1. Prerequisites

Ensure the following are available before deployment:

-   Linux server with SSH access (Oracle Cloud, AWS, VPS, etc.)
-   Docker & Docker Compose installed
-   MongoDB Atlas connection string
-   Open ports for HTTP/HTTPS and RabbitMQ (if external)

------------------------------------------------------------------------

## 2. Server Configuration (`.env`)

The infrastructure relies on a central `.env` file.\
This file acts as the **Source of Truth** for the entire platform.

``` env
# Database & Queue (PaaS Infrastructure)
MONGODB_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/automation_platform
RABBITMQ_URL=amqp://automation-rabbitmq
REDIS_URL=redis://automation-redis:6379

# Dashboard Defaults (Pre-fills the UI)
DEFAULT_TEST_IMAGE=keinar101/my-automation-tests:latest
DEFAULT_BASE_URL=https://your-app.com
DEFAULT_TEST_FOLDER=all

# --- AGNOSTIC SECRET INJECTION ---
# These variables belong to the CLIENT tests.
# The platform does not interpret them — it only injects them.
ADMIN_USER=admin@example.com
ADMIN_PASS=secure_password
GEMINI_API_KEY=ai_key_here

# WHITE LIST
# Only variables declared here are injected into the test container
INJECT_ENV_VARS=ADMIN_USER,ADMIN_PASS,GEMINI_API_KEY,MONGO_URI
```

### Why the Whitelist Matters

This design prevents: - Accidental credential leaks - Arbitrary
environment access inside containers - Infrastructure coupling with test
logic

------------------------------------------------------------------------

## 3. Deployment

Build and start the production stack:

``` bash
docker compose -f docker-compose.prod.yml up -d --build
```

Once deployed: - The **Dashboard** becomes accessible via browser - The
**Producer** API handles job requests - The **Worker** pulls and
executes test images securely

------------------------------------------------------------------------

## 4. Operational Notes

-   Updating secrets requires re-running deployment
-   Test images are pulled dynamically at runtime
-   Logs are streamed live via WebSockets

------------------------------------------------------------------------

## 5. Troubleshooting

  Issue                         Resolution
  ----------------------------- ------------------------------
  Tests fail instantly          Verify `INJECT_ENV_VARS`
  Container exits immediately   Check `entrypoint.sh`
  Zod errors                    Missing env vars or defaults

------------------------------------------------------------------------

## Infrastructure Ready

Your Automation Center is now live and capable of running **any
compliant Dockerized test suite**.
