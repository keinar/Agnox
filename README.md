# Agnostic Automation Center

A high-performance, microservices-based test automation platform designed to be **language and framework agnostic**. It allows you to run any containerized automation suite (Playwright, Pytest, JUnit, etc.) on a remote server with real-time monitoring, live logs, and **AI-powered failure analysis**.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue?style=flat-square)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-green?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Agnostic-2496ED?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-8e44ad?style=flat-square)

---

## 🚀 The Agnostic Concept

Unlike traditional frameworks, this system acts as a **Platform-as-a-Service (PaaS)** for automation.
- **The Center:** Manages infrastructure, queues, execution, and reporting.
- **The Test Suite:** Provided by the user as a Docker Image. The system doesn't care if it's Python, Node.js, or Java.
- **The Secret Sauce:** Dynamic environment injection via a "White List" (no hardcoded variables in the infrastructure).

---

## Key Features

### AI-Driven Root Cause Analysis
No more digging through thousands of log lines.
- **Automatic Detection:** When a test fails, the system automatically captures the logs.
- **Gemini 2.5 Flash:** Analyzes the failure context, identifies the exact error, and suggests code fixes.
- **Instant Report:** View a styled, easy-to-read analysis directly in the dashboard via the ✨ icon.

### Interactive Dashboard
A modern, React-based UI (Vite + Tailwind) that gives you full control:
- **Manual Triggers:** Launch tests directly from the UI using the **Execution Modal**.
- **Dynamic Configuration:** Select specific environments (Dev/Staging/Prod), target folders, and Docker images on the fly.
- **Live Monitoring:** Watch console logs stream in real-time via WebSockets.

### Smart Environment Mapping
- **Agnostic Environments:** Environments are defined via infrastructure ENV variables (`STAGING_URL`, `PROD_URL`).
- **Auto-Switching:** The UI automatically maps your selection to the correct URL, injecting it into the container seamlessly.

---

## Architecture

- **Dashboard (React/Vite):** Real-time UI for triggering runs, monitoring logs, and viewing AI reports.
- **Producer Service (Fastify):** Handles API requests, manages MongoDB/Redis, and queues tasks to RabbitMQ.
- **Worker Service (Node.js):** The execution engine. It pulls images, runs containers, and orchestrates the **AI Analysis** workflow upon failure.
- **Databases:** MongoDB (Logs & History) + Redis (Queue Management).

---

## 🔐 Multi-Tenant SaaS (Phase 1)

The Agnostic Automation Center now supports **multi-tenancy** with complete data isolation between organizations.

### Multi-Tenant Features

- **🏢 Organization Management:** Each signup creates a new isolated organization
- **👥 User Authentication:** JWT-based secure authentication with bcrypt password hashing
- **🔒 Complete Data Isolation:** Organizations cannot see or access each other's data
- **📊 Real-Time Updates:** Socket.io room-based broadcasting ensures updates are scoped to each organization
- **🎭 Role-Based Access:** Admin, Developer, and Viewer roles (RBAC foundation)

### Prerequisites

- **Docker & Docker Compose** (for local development)
- **Node.js 18+** (for running database migrations)
- **MongoDB** (Atlas or local instance)
- **A secure JWT secret** (generate with: `openssl rand -hex 64`)

### First-Time Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Agnostic-Automation-Center
   ```

2. **Generate JWT Secret**
   ```bash
   openssl rand -hex 64
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env and add your JWT_SECRET, MONGO_URI, and other variables
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Run Database Migration**

   The migration transforms the database to support multi-tenancy:
   ```bash
   # Dry run first (recommended) - no changes made
   npm run migration:dry-run

   # Execute actual migration
   npm run migration:run
   ```

   This will:
   - Create `organizations`, `users`, and `invitations` collections
   - Add `organizationId` to all existing executions
   - Create a default organization and admin user
   - Set up all necessary indexes

6. **Start All Services**
   ```bash
   docker-compose up --build
   ```

7. **Access Dashboard**
   - URL: **http://localhost:8080**
   - Default credentials (if migrated from single-tenant):
     - Email: `admin@default.local`
     - Password: `admin123`
     - ⚠️ **CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

### Creating a New Organization

1. Visit **http://localhost:8080/signup**
2. Fill in the signup form:
   - Your full name
   - Email address
   - Password (min 8 chars with uppercase, lowercase, and number)
   - Organization name
3. Click **Create Account** - you'll be automatically logged in
4. You're now the **admin** of your new organization!

### Authentication Features

- **JWT Tokens:** Secure, stateless authentication with 24-hour expiration
- **Password Security:** Bcrypt hashing with configurable salt rounds
- **Protected Routes:** All API endpoints require valid authentication
- **Real-Time Auth:** Socket.io connections authenticated with JWT
- **Persistent Sessions:** Tokens stored in localStorage for seamless experience

### Security Notes

⚠️ **CRITICAL for Production:**

- **JWT_SECRET:** Must be a strong random value (minimum 64 characters)
  - Generate with: `openssl rand -hex 64`
  - Never commit to version control
  - Store in environment variables or secrets manager

- **MongoDB:** Use authentication and SSL/TLS in production
  - Never expose MongoDB port publicly
  - Use strong passwords
  - Enable audit logging

- **HTTPS:** Always use HTTPS in production for:
  - Dashboard (frontend)
  - API (backend)
  - WebSocket connections

- **CORS:** Configure `DASHBOARD_URL` to match your production domain

- **Default Admin:** Change the password for `admin@default.local` immediately

- **Environment Variables:** Never hardcode secrets in code
  - Use `.env` for local development
  - Use cloud secrets management for production

### Multi-Tenancy Verification

To verify data isolation works correctly:

1. Create two separate organizations (use different browsers or incognito mode)
2. Login as User A, create a test execution
3. Login as User B in a different browser
4. Verify User B cannot see User A's execution
5. Both users should only see their own organization's data

---

## Case Study: Integrated Example

This system is currently configured to validate the following full-stack project:
- **Test Suite Repo:** https://github.com/keinar/Photographer-Gallery-Automation
- **Target App Repo:** https://github.com/keinar/photographer-gallery

---

## Documentation

To set up or use the system, follow these detailed guides:

| Guide | Content |
| :--- | :--- |
| [Infrastructure Setup](./docs/INFRASTRUCTURE.md) | Setting up the Server, Docker, AI Keys, and Databases. |
| [Client Integration](./docs/CLIENT_GUIDE.md) | How to prepare your Test Repo to be "Agnostic-Ready". |
| [CI/CD & Secrets](./docs/CI_CD.md) | Managing GitHub Actions and the Secret Injection Whitelist. |

---

## License

[MIT](/LICENSE)