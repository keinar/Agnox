# Agnostic Automation Center - Developer Guide

## Project Overview
A production-ready, multi-tenant SaaS test automation platform that is language and framework agnostic. Supports Playwright, Pytest, and any containerized test framework.

**Status:** Production Ready (Phase 1-3 Complete)

## Tech Stack

### Backend Services
- **Producer Service**: Fastify + TypeScript + MongoDB
  - Location: `apps/producer-service/`
  - Purpose: API server, queue management, Stripe billing, JWT auth
  - Port: 3000 (internal)

- **Worker Service**: Node.js + TypeScript + Docker
  - Location: `apps/worker-service/`
  - Purpose: Container orchestration, test execution, AI analysis
  - Communicates via: RabbitMQ

### Frontend
- **Dashboard Client**: React 19 + Vite + TypeScript + Pure CSS
  - Location: `apps/dashboard-client/`
  - Real-time: Socket.io
  - Port: 8080 (exposed)

### Infrastructure (via Docker Compose)
- **Database**: MongoDB
- **Cache/Queue**: Redis (rate limiting, metrics)
- **Message Queue**: RabbitMQ
- **AI**: Google Gemini API
- **Payments**: Stripe

## Key Features (Production)

### Multi-Tenant Architecture
- Organization-scoped data isolation
- JWT authentication with role-based access
- RBAC: Admin, Developer, Viewer roles

### Billing & Subscriptions
- Stripe integration for payments
- Plan tiers: Free, Team, Enterprise
- Usage tracking and alerts

### Audit Logging
- Admin action tracking (role changes, user management)
- Stored in `audit_logs` collection

### Health Monitoring
- `/health` endpoint for orchestrator monitoring
- Checks: MongoDB, Redis, RabbitMQ

## Directory Structure
```
Agnostic-Automation-Center/
├── apps/
│   ├── producer-service/src/
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Auth, rate limiting
│   │   └── utils/         # Audit logs, password, usage
│   ├── worker-service/src/
│   │   ├── analysisService.ts  # AI analysis
│   │   ├── worker.ts           # Container orchestration
│   │   └── utils/logger.ts     # Structured logging
│   └── dashboard-client/src/
│       ├── components/    # React components
│       ├── pages/         # Route pages
│       └── hooks/         # Custom hooks
├── docs/
│   ├── integration/       # Customer guides
│   └── PRD-Multi-Tenant-SaaS.md
└── docker-compose.yml
```

## Running the Project

```bash
# Start all services
docker-compose up --build

# View logs
docker-compose logs -f

# Production build
docker-compose -f docker-compose.prod.yml up --build
```

### Access Points
- Dashboard: http://localhost:8080
- Health Check: http://localhost:3000/health
- RabbitMQ: http://localhost:15672

## Environment Variables

```yaml
# Required
JWT_SECRET: <64-char-random-string>
MONGODB_URL: mongodb://mongodb:27017/automation_platform
RABBITMQ_URL: amqp://rabbitmq:5672
REDIS_URL: redis://redis:6379

# Stripe (Billing)
STRIPE_SECRET_KEY: sk_...
STRIPE_WEBHOOK_SECRET: whsec_...

# AI Analysis
GOOGLE_AI_API_KEY: <your-key>

# Email
SENDGRID_API_KEY: <your-key>
SENDGRID_FROM_EMAIL: noreply@yourdomain.com
```

## Code Conventions

### Naming
- Files: `kebab-case.ts`
- Interfaces: `IEntityName`
- Constants: `UPPER_SNAKE_CASE`

### API Responses
```typescript
{
  success: boolean;
  data?: T;
  error?: string;
}
```

### Logging
- Producer: Uses Fastify's `app.log.info()`
- Worker: Uses custom `logger.info()` with structured context

## Testing

```bash
# Rebuild and test
docker-compose down && docker-compose up --build

# Check logs
docker-compose logs producer-service
docker-compose logs worker-service
```

## Documentation
- Customer Integration: `docs/integration/quickstart.md`
- Product Requirements: `docs/PRD-Multi-Tenant-SaaS.md`