# Agnostic Automation Center - Claude Code Context

## Project Overview
A microservices-based test automation platform that is language and framework agnostic. Currently transforming from single-tenant to multi-tenant SaaS.

## Tech Stack

### Backend Services
- **Producer Service**: Fastify + TypeScript + MongoDB
  - Location: `apps/producer/`
  - Purpose: API server, queue management, database operations
  - Port: 3000

- **Worker Service**: Node.js + TypeScript + Docker
  - Location: `apps/worker/`
  - Purpose: Container orchestration, test execution, AI analysis
  - Communicates via: RabbitMQ

### Frontend
- **Dashboard**: React 18 + Vite + TypeScript + Tailwind CSS
  - Location: `apps/dashboard/`
  - Real-time: Socket.io
  - Port: 5173 (dev)

### Shared Code
- **Shared Types**: `packages/shared-types/`
  - Contains: TypeScript interfaces shared between services

### Infrastructure
- **Database**: MongoDB 6.0+
- **Cache/Queue**: Redis 7.0+
- **Message Queue**: RabbitMQ 3.12+
- **Container Runtime**: Docker
- **AI**: Google Gemini API

## Directory Structure
```
Agnostic-Automation-Center/
├── apps/
│   ├── producer/
│   │   └── src/
│   │       ├── routes/        # Fastify route handlers
│   │       ├── models/        # MongoDB schemas (if exist)
│   │       ├── services/      # Business logic
│   │       └── utils/         # Helpers
│   ├── worker/
│   │   └── src/
│   │       ├── services/      # Docker orchestration
│   │       └── utils/         # AI analysis, logging
│   └── dashboard/
│       └── src/
│           ├── components/    # React components
│           ├── pages/         # Route pages
│           ├── hooks/         # Custom hooks
│           └── context/       # React context
├── packages/
│   └── shared-types/
│       └── src/               # Shared TypeScript interfaces
├── docs/                      # Documentation
└── migrations/                # Database migration scripts
```

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
- `apps/producer/src/models/organization.ts` (NEW)
- `apps/producer/src/models/user.ts` (NEW)
- `apps/producer/src/models/invitation.ts` (NEW)
- `apps/producer/src/routes/auth.ts` (NEW)
- `apps/producer/src/middleware/auth.ts` (NEW)
- `apps/producer/src/utils/jwt.ts` (NEW)
- `packages/shared-types/src/index.ts` (MODIFY)
- Existing models: Add `organizationId` field

### Important Documents
- PRD: `docs/PRD-Multi-Tenant-SaaS.md`
- Implementation Plan: `docs/implementation/phase-1-plan.md`

## Environment Variables

### Required for Phase 1
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/automation_db

# Authentication (NEW)
JWT_SECRET=<64-char-random-string>
JWT_EXPIRY=24h
PASSWORD_SALT_ROUNDS=10

# Existing
RABBITMQ_URL=amqp://localhost:5672
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=<your-key>
```

## Testing Commands
```bash
# Run all tests
npm test

# Run specific service tests
npm run test --workspace=apps/producer

# Build check
npm run build

# Lint
npm run lint
```

## Common Tasks

### Adding a New API Route (Producer)
1. Create route file in `apps/producer/src/routes/`
2. Register in main server file
3. Add types to `packages/shared-types/`
4. Update tests

### Adding a New MongoDB Model
1. Create interface in `packages/shared-types/`
2. Create model file in `apps/producer/src/models/`
3. Add indexes in migration script
4. Update related services

### Running Locally
```bash
# Start infrastructure
docker-compose up -d mongodb redis rabbitmq

# Start services (separate terminals)
npm run dev --workspace=apps/producer
npm run dev --workspace=apps/worker
npm run dev --workspace=apps/dashboard
```

## Git Workflow
- Branch naming: `feature/description`, `fix/description`
- Commit format: `type(scope): message`
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Always create PR for review before merging to main

## Notes for Claude Code
- Always check existing patterns before creating new code
- Preserve existing code style
- Run `npm run build` after changes to verify TypeScript compiles
- Test migrations in dry-run mode first
- Commit frequently with descriptive messages
