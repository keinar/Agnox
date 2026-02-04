# Agnostic Automation Center

> A high-performance, multi-tenant test automation platform designed to be **language and framework agnostic**.

Run any containerized automation suite (Playwright, Pytest, JUnit, Cypress, etc.) on a remote server with real-time monitoring, live logs, and AI-powered failure analysis. Built for teams with complete data isolation between organizations.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue?style=flat-square)
![Multi-Tenant](https://img.shields.io/badge/Multi--Tenant-SaaS-orange?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Agnostic-2496ED?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-8e44ad?style=flat-square)
![Security](https://img.shields.io/badge/Security-JWT%20%2B%20RBAC-green?style=flat-square)

---

## 🎯 What Problem Does This Solve?

**The Challenge:** Test automation teams struggle with:
- Managing different frameworks (Playwright, Selenium, Pytest, etc.) across environments
- Debugging failures without clear root cause analysis
- Scaling test infrastructure for multiple teams
- Maintaining secure, isolated test environments

**The Solution:** Agnostic Automation Center provides:
- **Framework-agnostic execution** - Bring your own Docker image, we handle the rest
- **AI-powered debugging** - Instant root cause analysis for test failures
- **Multi-tenant SaaS** - Complete isolation between teams/organizations
- **Real-time monitoring** - Live logs, WebSocket updates, interactive dashboard
- **Smart environment management** - Dynamic configuration injection per test run

---

## ✨ Key Features

### 🧠 AI-Powered Root Cause Analysis

No more digging through thousands of log lines.

- **Automatic Detection:** When tests fail, the system captures logs automatically
- **Gemini 2.5 Flash:** Analyzes failure context, identifies exact errors, suggests fixes
- **Privacy Controls:** Organization-level toggle to opt-out of AI processing
- **Instant Reports:** View styled analysis directly in dashboard via ✨ icon

### 🏢 Multi-Tenant SaaS Architecture

Complete isolation and security for multiple organizations.

- **Organization Management:** Each signup creates an isolated organization
- **Team Collaboration:** Invite members with role-based permissions (Admin/Developer/Viewer)
- **Data Isolation:** Organizations cannot see or access each other's data
- **Usage Tracking:** Per-organization quotas and limits based on subscription plan

### 🎨 Interactive Dashboard

Modern React-based UI built with Vite + Tailwind CSS.

- **Manual Triggers:** Launch tests directly from UI using Execution Modal
- **Dynamic Configuration:** Select environments (Dev/Staging/Prod), folders, Docker images on-the-fly
- **Live Monitoring:** Watch console logs stream in real-time via WebSockets
- **Mobile Responsive:** Full mobile and tablet support with Tailwind responsive design
- **Settings Management:** Manage team members, organization settings, usage quotas

### 🔐 Enterprise-Grade Security

Built with security best practices from the ground up.

- **JWT Authentication:** Stateless authentication with bcrypt password hashing
- **Role-Based Access Control (RBAC):** Admin, Developer, Viewer roles
- **Rate Limiting:** Per-organization and per-IP rate limiting (Redis-based)
- **Account Protection:** Login attempt tracking with automatic lockout (15 min after 5 failures)
- **Security Headers:** OWASP-recommended headers (HSTS, X-Frame-Options, CSP-ready)
- **CORS Protection:** Environment-based origin validation

### 🚀 Smart Environment Mapping

Framework-agnostic environment configuration.

- **Agnostic Environments:** Define environments via infrastructure ENV variables
- **Auto-Switching:** UI automatically maps environment selection to correct URL
- **Dynamic Injection:** Environment variables injected into containers at runtime
- **Secret Management:** Sensitive data never hardcoded, always injected

---

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Dashboard Client<br/>React + Vite + Tailwind]
    end

    subgraph "API Layer"
        Producer[Producer Service<br/>Fastify + TypeScript]
        Socket[Socket.io<br/>Real-time Updates]
    end

    subgraph "Worker Layer"
        Worker[Worker Service<br/>Docker Orchestration]
        Docker[Docker Engine<br/>Test Containers]
    end

    subgraph "Data Layer"
        Mongo[(MongoDB<br/>Multi-tenant Data)]
        Redis[(Redis<br/>Cache + Queues)]
    end

    subgraph "Message Queue"
        RabbitMQ[RabbitMQ<br/>Task Distribution]
    end

    subgraph "External Services"
        Gemini[Google Gemini AI<br/>Root Cause Analysis]
        Email[Email Service<br/>SMTP/SendGrid]
    end

    UI -->|HTTPS/WSS| Producer
    UI <-->|WebSocket| Socket
    Producer --> Mongo
    Producer --> Redis
    Producer --> RabbitMQ
    Producer --> Email

    RabbitMQ --> Worker
    Worker --> Docker
    Worker --> Mongo
    Worker --> Redis
    Worker --> Gemini

    Socket -.->|Organization Rooms| UI
```

### Component Overview

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Dashboard Client** | React 18 + TypeScript + Vite + Tailwind | User interface for test management |
| **Producer Service** | Fastify + TypeScript | RESTful API, authentication, WebSocket server |
| **Worker Service** | Node.js + Docker SDK | Test execution orchestration |
| **MongoDB** | NoSQL Database | Multi-tenant data storage |
| **Redis** | In-memory Cache | Rate limiting, session storage, metrics |
| **RabbitMQ** | Message Queue | Distributed task queue for test execution |
| **Google Gemini** | AI Model | Root cause analysis for test failures |
| **Email Service** | Nodemailer + SMTP | Team member invitations |

---

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for local development)
- **Node.js 18+** (for running database migrations)
- **MongoDB** (Atlas or local instance)
- **Secure JWT secret** (generate with: `openssl rand -hex 64`)

### Local Development Setup

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

4. **Start services**
   ```bash
   docker-compose up --build
   ```

5. **Access the dashboard**
   - Open http://localhost:8080
   - Create account → organization created automatically
   - Start running tests!

### First Login

1. **Signup:** Create your account at http://localhost:8080/signup
2. **Organization Created:** Your organization is automatically created
3. **You're Admin:** First user is always organization admin
4. **Invite Team:** Navigate to Settings → Team Members → Invite

---

## 📦 What's Included

### Phase 1: Multi-Tenant Foundation ✅ (Complete)

**Duration:** Jan 28-30, 2026 | **Status:** Production Ready

- ✅ Organization and User management with RBAC
- ✅ JWT-based authentication with bcrypt password hashing
- ✅ Multi-tenant data isolation (100% verified)
- ✅ Database migration script for existing data
- ✅ Security audit completed (87/100 → 92/100 score)
- ✅ Production deployment guide
- ✅ Comprehensive test coverage (unit + integration)

**Deliverables:**
- 3 new data models (Organization, User, Invitation)
- 4 API route modules (auth, users, invitations, organization)
- Authentication middleware with JWT verification
- Database migration script
- 8,000+ lines of code
- Comprehensive documentation

---

### Phase 2: User Management UI & Security ✅ (60% Complete)

**Duration:** Feb 4-6, 2026 | **Status:** In Progress

#### ✅ Completed Features (Sprint 1-4)

**Team Member Management:**
- ✅ Invite team members via email
- ✅ Role management (Admin, Developer, Viewer)
- ✅ User list with status indicators
- ✅ Remove team members
- ✅ Invitation status tracking

**Organization Settings:**
- ✅ Organization details page
- ✅ Plan limits visualization
- ✅ Admin-only organization name editing
- ✅ Mobile-responsive settings UI

**AI Privacy Controls:**
- ✅ Organization-level AI analysis toggle
- ✅ Privacy disclosure and transparency
- ✅ Worker service enforcement
- ✅ Admin-only control

**Security Enhancements:**
- ✅ Redis-based rate limiting (per-organization + per-IP)
- ✅ Security headers (OWASP recommendations)
- ✅ Login attempt tracking with account lockout
- ✅ CORS production configuration

#### 🚧 In Progress (Sprint 5-6)

**Usage Tracking & Quotas:**
- 🚧 Usage statistics visualization
- 🚧 Quota enforcement (test runs, concurrent runs)
- 🚧 Progress bars and charts
- 🚧 Alerts when approaching limits

**Polish & Testing:**
- 🚧 Comprehensive integration testing
- 🚧 End-to-end testing
- 🚧 Accessibility improvements

---

### Phase 3 & 4: Advanced Features 📋 (Planned)

**Phase 3: Advanced Dashboard & Analytics** (Planned)
- Advanced analytics and insights
- Custom role permissions (fine-grained access control)
- Audit logging for compliance
- Webhook integrations
- API key management

**Phase 4: Enterprise Features** (Planned)
- SSO integration (SAML, OAuth)
- Advanced billing and subscription management
- Terraform/IaC templates
- Custom SLA monitoring
- 99.9% uptime SLA

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI framework
- **TypeScript** - Type safety
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling, mobile-responsive
- **Socket.io Client** - Real-time WebSocket connections

### Backend
- **Fastify** - High-performance web framework
- **TypeScript** - Type-safe backend
- **MongoDB** - NoSQL database for multi-tenant data
- **Redis** - In-memory cache and rate limiting
- **RabbitMQ** - Message queue for task distribution
- **Docker SDK** - Container orchestration
- **Socket.io** - WebSocket server

### Security & Auth
- **JWT (jsonwebtoken)** - Stateless authentication
- **bcrypt** - Password hashing
- **Redis Rate Limiting** - DDoS and brute force protection
- **CORS** - Cross-origin resource sharing
- **Security Headers** - OWASP best practices

### AI & External Services
- **Google Gemini 2.5 Flash** - AI-powered root cause analysis
- **Nodemailer** - Email invitations
- **SMTP / SendGrid** - Email delivery

---

## 📖 Documentation

Comprehensive documentation available in `/docs/`:

### Setup & Deployment
- **[Quick Start Guide](docs/setup/quickstart.md)** - Get started in 5 minutes _(coming soon)_
- **[Deployment Guide](docs/setup/deployment.md)** - Production deployment instructions
- **[Infrastructure Guide](docs/setup/infrastructure.md)** - Server requirements and setup
- **[CI/CD Guide](docs/setup/ci-cd.md)** - GitHub Actions configuration
- **[Troubleshooting](docs/setup/troubleshooting.md)** - Common issues and solutions

### Architecture & Design
- **[Architecture Overview](docs/architecture/overview.md)** - System design and data flow
- **[Multi-Tenant Design](docs/PRD-Multi-Tenant-SaaS.md)** - Product requirements document

### API Documentation
- **[API Overview](docs/api/README.md)** - Complete API reference
- **[Authentication API](docs/api/authentication.md)** - Signup, login, JWT tokens

### Security
- **[Security Audit](docs/setup/security-audit.md)** - Comprehensive security assessment
- **[Client Integration Guide](docs/setup/client-integration.md)** - How to integrate test suites

### Implementation Records
- **[Phase 1 Summary](docs/implementation/phase-1/summary.md)** - Multi-tenant foundation
- **[Phase 2 Progress](docs/implementation/phase-2/progress.md)** - Current development

---

## 🔒 Security

Security is a top priority. The platform includes:

- **87/100 → 92/100 Security Score** (comprehensive audit completed)
- JWT authentication with bcrypt password hashing (10 rounds)
- Per-organization rate limiting (prevents noisy neighbor problem)
- Login attempt tracking (5 failures = 15-minute lockout)
- OWASP-recommended security headers
- Multi-tenant data isolation (100% verified, zero cross-org data leaks)
- CORS protection with environment-based configuration
- HTTPS/TLS in production with HSTS headers

See [Security Audit](docs/setup/security-audit.md) for detailed assessment.

---

## 🧪 Running Tests

### Integration Tests
```bash
# Start services
docker-compose up -d

# Run integration tests
npm run test:integration
```

### Unit Tests
```bash
# Backend tests
cd apps/producer-service
npm test

# Frontend tests
cd apps/dashboard-client
npm test
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Contributing Guide](CONTRIBUTING.md) _(coming soon)_ for details.

---

## 📊 Project Status

| Phase | Status | Completion |
|-------|--------|------------|
| **Phase 1:** Multi-Tenant Foundation | ✅ Complete | 100% |
| **Phase 2:** User Management UI & Security | 🚧 In Progress | 60% |
| **Phase 3:** Advanced Dashboard | 📋 Planned | 0% |
| **Phase 4:** Enterprise Features | 📋 Planned | 0% |

**Current Focus:** Phase 2 - Sprint 5 (Usage Tracking & Quotas)

---

## 🗺️ Roadmap

### Q1 2026
- ✅ Phase 1: Multi-tenant foundation
- 🚧 Phase 2: User management UI and security enhancements
- 🎯 Phase 2 completion: Usage tracking and quotas

### Q2 2026
- 📋 Phase 3: Advanced analytics and insights
- 📋 Custom role permissions (fine-grained RBAC)
- 📋 Audit logging and compliance features

### Q3 2026
- 📋 Phase 4: Enterprise features (SSO, advanced billing)
- 📋 Terraform/IaC templates
- 📋 99.9% uptime SLA

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful root cause analysis capabilities
- **Fastify** for blazing-fast API performance
- **React + Vite** for excellent developer experience
- **MongoDB** for flexible multi-tenant data modeling
- **Docker** for framework-agnostic test execution

---

## 📞 Support & Contact

- **Documentation:** [/docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/agnostic-automation-center/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/agnostic-automation-center/discussions)
- **Email:** support@agnosticautomation.com _(if applicable)_

---

**Built with ❤️ for test automation teams everywhere**

Made by developers, for developers. Framework agnostic. AI-powered. Multi-tenant. Secure.
