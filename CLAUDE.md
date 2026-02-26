# Agnox - Claude Code Context

## Project Architecture & Tech Stack
- **Frontend (`apps/dashboard-client`)**: React 19 + Vite + TypeScript. **Styling is STRICTLY Tailwind CSS** (Pure CSS is deprecated. No inline styles).
- **Producer Service (`apps/producer-service`)**: Fastify + TypeScript + MongoDB. Handles API, Stripe billing, JWT/API Key auth.
- **Worker Service (`apps/worker-service`)**: Node.js + TypeScript + Docker. Orchestrates containers, executes tests, communicates via RabbitMQ, uses Gemini AI.
- **Infrastructure**: MongoDB, Redis (rate limiting), RabbitMQ (message queue).

## Multi-Tenant & Security Rules (CRITICAL)
- **Tenant Isolation**: Every database query MUST include the organization filter (e.g., `organizationId` or `org_id`). Never bypass this.
- **Secrets**: Never store integration secrets (like Jira API tokens) in plaintext. Always use AES-256-GCM encryption.
- **Migrations**: Never modify the DB schema without creating a corresponding migration file.

## Code Conventions
- **Naming**: File names must be `kebab-case.ts`. Interfaces must use `IEntityName`. Constants use `UPPER_SNAKE_CASE`.
- **API Responses**: All API endpoints MUST return this exact structure:
  `{ success: boolean; data?: T; error?: string; }`
- **Logging**: 
  - In `producer-service`: Use Fastify's `app.log.info()`.
  - In `worker-service`: Use the custom `logger.info()`.
  - NEVER use `console.log`.
- **Error Handling**: All async functions must have typed try/catch blocks.

## AI Execution Rules (Before ANY task)
1. Read the relevant files and map the existing routing/schema first.
2. State your implementation plan in short bullet points before writing ANY code.
3. Wait for the user's approval before proceeding with massive changes.
4. Commit after each completed feature or logical phase, not in bulk.