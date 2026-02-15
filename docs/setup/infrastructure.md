# 🛠️ Infrastructure Setup Guide

This guide explains how to deploy the **Automation Center** on a Linux server (Oracle Cloud / VPS).

---

## 1. Prerequisites

Ensure the following are available before deployment:

- Linux server with SSH access (Oracle Cloud, AWS, VPS, etc.)
- Docker & Docker Compose installed
- MongoDB Atlas connection string
- Open ports for HTTP/HTTPS and RabbitMQ (if external)
- **Gemini API Key:** Required for the AI Root Cause Analysis feature.

---

## 2. Server Configuration (`.env`)

The system now supports dynamic environment mapping and AI integration.

```env
# Database & Queue (PaaS Infrastructure)
MONGODB_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/automation_platform
RABBITMQ_URL=amqp://automation-rabbitmq
REDIS_URL=redis://automation-redis:6379

# AI Configuration
GEMINI_API_KEY=AIzaSy...your_key_here

# --- AGNOSTIC SECRET INJECTION ---
# These variables belong to the CLIENT tests.
# The platform does not interpret them — it only injects them.
ADMIN_USER=admin@example.com
ADMIN_PASS=secure_password
MONGO_URI=mongodb+srv://... (Client DB)

# WHITE LIST
# Only variables declared here are injected into the test container
INJECT_ENV_VARS=ADMIN_USER,ADMIN_PASS,GEMINI_API_KEY,MONGO_URI
```

---

## 3. The Worker Service Workflow

The Worker is the heart of the execution engine. Here is the updated lifecycle of a test run:

1. **Pull:** Worker pulls the requested Docker image (if not cached).
2. **Run:** Executes the container with the secure `entrypoint.sh`.
3. **Stream:** Logs are streamed in real-time to Redis/MongoDB and the Dashboard.
4. **Completion Check:**
   - ✅ **PASS:** Status updated to `PASSED`.
   - ❌ **FAIL:** Status updated to `ANALYZING`.

5. **AI Analysis (If Failed):**
   - The Worker gathers the failure logs.
   - It sends them to the **Gemini 2.5 Flash** model.
   - Generates a "Root Cause Analysis" and "Suggested Fix".
   - Updates the execution record with the analysis report.
   - Final status set to `FAILED` (or `UNSTABLE`).

---

## 4. Deployment

Build and start the production stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Once deployed:

- The **Dashboard** becomes accessible via browser.
- The **Producer** API handles job requests.
- The **Worker** listens for tasks on RabbitMQ.

---

## 5. Troubleshooting

| Issue | Resolution |
| --- | --- |
| **Tests fail instantly** | Verify `INJECT_ENV_VARS` in `.env`. |
| **No AI Analysis** | Check if `GEMINI_API_KEY` is set and valid. |
| **Container exits immediately** | Check `entrypoint.sh` permissions. |
| **Status stuck on ANALYZING** | Check Worker logs for timeouts connecting to Google AI. |
