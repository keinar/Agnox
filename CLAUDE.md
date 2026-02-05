# Agnostic Automation Center - Claude Code Context

## Project Overview
A microservices-based test automation platform that is language and framework agnostic. Currently transforming from single-tenant to multi-tenant SaaS.

**Important:** This project runs entirely via Docker Compose. No local npm build needed.

## Tech Stack

### Backend Services
- **Producer Service**: Fastify + TypeScript + MongoDB
  - Location: `apps/producer-service/`
  - Purpose: API server, queue management, database operations
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

### Shared Code
- **Shared Types**: `packages/shared-types/`
  - Contains: TypeScript interfaces shared between services

### Infrastructure (via Docker Compose)
- **Database**: MongoDB
- **Cache/Queue**: Redis
- **Message Queue**: RabbitMQ
- **AI**: Google Gemini API

## Directory Structure
```
Agnostic-Automation-Center/
├── apps/
│   ├── producer-service/
│   │   └── src/
│   │       ├── routes/        # Fastify route handlers
│   │       ├── models/        # MongoDB schemas (if exist)
│   │       ├── services/      # Business logic
│   │       └── utils/         # Helpers
│   ├── worker-service/
│   │   └── src/
│   │       ├── services/      # Docker orchestration
│   │       └── utils/         # AI analysis, logging
│   └── dashboard-client/
│       └── src/
│           ├── components/    # React components
│           ├── pages/         # Route pages
│           ├── hooks/         # Custom hooks
│           └── context/       # React context
├── packages/
│   └── shared-types/
│       └── src/               # Shared TypeScript interfaces
├── docs/                      # Documentation
├── migrations/                # Database migration scripts (NEW)
├── docker-compose.yml         # Local development
└── docker-compose.prod.yml    # Production
```

## Running the Project

### Local Development
```bash
# Start all services
docker-compose up --build

# Start in background
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Access Points (Local)
- Dashboard: http://localhost:8080
- Producer API: http://localhost:3000 (internal)
- MongoDB: localhost:27017
- RabbitMQ Management: http://localhost:15672

## Code Conventions

### TypeScript
- Use strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types on functions
- JSDoc comments for public APIs

### Naming
- Files: `kebab-case.ts`
- Interfaces: `IEntityName` (e.g., `IUser`, `IOrganization`)
- Types: `TEntityName` or `EntityNameType`
- Constants: `UPPER_SNAKE_CASE`
- Functions/Variables: `camelCase`

### MongoDB
- Collection names: `snake_case` plural (e.g., `test_runs`, `organizations`)
- Use ObjectId for `_id` fields
- Always include `createdAt` and `updatedAt` timestamps
- Index frequently queried fields

### API Routes
- RESTful naming: `/api/v1/resource`
- Use HTTP verbs correctly (GET, POST, PUT, DELETE)
- Return consistent response format:
```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Error Handling
- Use custom error classes
- Log errors with context (no sensitive data)
- Return user-friendly error messages

## Current Development: Multi-Tenant Transformation

### Phase 1 Goals (Current)
1. Add `organizationId` to all data models
2. Implement JWT authentication
3. Create Organization, User, Invitation schemas
4. Migrate existing data to default organization
5. Filter all queries by organizationId

### Key Files to Create/Modify
- `apps/producer-service/src/models/organization.ts` (NEW)
- `apps/producer-service/src/models/user.ts` (NEW)
- `apps/producer-service/src/models/invitation.ts` (NEW)
- `apps/producer-service/src/routes/auth.ts` (NEW)
- `apps/producer-service/src/middleware/auth.ts` (NEW)
- `apps/producer-service/src/utils/jwt.ts` (NEW)
- `packages/shared-types/src/index.ts` (MODIFY)
- Existing models: Add `organizationId` field

### Important Documents
- PRD: `docs/PRD-Multi-Tenant-SaaS.md`
- Implementation Plan: `docs/implementation/phase-1-plan.md`

## Environment Variables

### Required for Phase 1 (add to docker-compose.yml)
```yaml
# Producer Service environment
JWT_SECRET: <64-char-random-string>
JWT_EXPIRY: 24h
PASSWORD_SALT_ROUNDS: 10
```

### Existing (already in docker-compose)
```yaml
MONGODB_URI: mongodb://mongodb:27017/automation_db
RABBITMQ_URL: amqp://rabbitmq:5672
REDIS_URL: redis://redis:6379
GEMINI_API_KEY: <your-key>
```

## Testing After Changes

```bash
# Rebuild and test
docker-compose down
docker-compose up --build

# Check logs for errors
docker-compose logs producer-service
docker-compose logs worker-service

# Access dashboard to verify UI
# http://localhost:8080
```

## Git Workflow
- Branch naming: `feature/description`, `fix/description`
- Commit format: `type(scope): message`
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Always create PR for review before merging to main

## Notes for Claude Code
- This project uses Docker Compose - no local npm commands needed
- Always check existing patterns before creating new code
- Preserve existing code style
- Test changes by running `docker-compose up --build`
- Check container logs for errors: `docker-compose logs <service-name>`
- Commit frequently with descriptive messages
- Migration scripts run OUTSIDE Docker (need local Node.js or run in container)