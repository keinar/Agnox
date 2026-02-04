# Phase 1 Implementation Plan
## Multi-Tenant Transformation - Foundation & Authentication

**Version:** 1.0
**Date:** January 28, 2026
**Status:** Ready for Implementation
**Duration:** 15 Days (3 weeks, Sprint-based)

---

## Table of Contents
1. [Overview](#overview)
2. [Phase 1 Goals](#phase-1-goals)
3. [Current State Analysis](#current-state-analysis)
4. [Architecture Changes](#architecture-changes)
5. [Sprint Breakdown](#sprint-breakdown)
6. [Detailed Task List](#detailed-task-list)
7. [File Modification Matrix](#file-modification-matrix)
8. [Risk Assessment](#risk-assessment)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Plan](#deployment-plan)
11. [Success Criteria](#success-criteria)
12. [Rollback Procedures](#rollback-procedures)

---

## Overview

Phase 1 transforms the Agnostic Automation Center from a **single-tenant, unauthenticated** platform into a **multi-tenant SaaS with JWT-based authentication and complete data isolation**.

This phase establishes the foundation for:
- User authentication (email/password with JWT)
- Organization management (create, settings)
- Data isolation (organizationId-based filtering)
- Role-based access control (admin, developer, viewer)

**What Phase 1 Does NOT Include:**
- Billing/Stripe integration (Phase 4)
- User invitations/management UI (Phase 3)
- Advanced RBAC beyond basic roles (Future)
- SSO/OAuth (Future)

---

## Phase 1 Goals

### Primary Goals
✅ **Data Isolation:** Every organization's data completely isolated from others
✅ **Authentication:** Secure JWT-based login/signup with bcrypt password hashing
✅ **Organization Context:** All API calls scoped to user's organization
✅ **Migration:** Existing data migrated to default organization (zero data loss)
✅ **Real-time Isolation:** Socket.io room-based broadcasting per organization

### Technical Deliverables
1. **Backend:**
   - JWT authentication middleware
   - Organization & User models
   - Auth routes (signup, login, /me)
   - All queries filtered by organizationId
   - RabbitMQ messages include organizationId
   - Socket.io room-based broadcasting

2. **Frontend:**
   - Login/Signup pages
   - Auth context provider
   - Protected route guards
   - JWT token storage (localStorage)
   - Dashboard header with org/user info

3. **Database:**
   - New collections: `organizations`, `users`, `invitations`
   - Add `organizationId` to `executions` collection
   - Indexes on organizationId for all collections
   - Default organization for migrated data

### Success Metrics
- **Security:** Zero cross-organization data leaks in testing
- **Performance:** API response time < 300ms (no degradation)
- **Compatibility:** All existing features work after migration
- **Stability:** Zero critical bugs after 7 days in production

---

## Current State Analysis

### Existing Architecture
```
Producer Service (Fastify)
├── Single file API (index.ts - 279 lines)
├── No authentication
├── No middleware
├── Direct MongoDB access
└── Global data queries (no filtering)

Worker Service
├── RabbitMQ consumer
├── Docker container orchestration
├── Direct MongoDB updates
└── No organization context

Dashboard Client (React)
├── React Query for state
├── Socket.io for real-time
├── No authentication UI
└── Shows ALL executions globally

Database (MongoDB)
├── Database: automation_platform
├── Collections: executions (ONLY ONE)
└── No organizationId field
```

### Critical Gaps Identified
1. **No Models/Schemas** - Direct MongoDB operations without abstraction
2. **No Routes Directory** - All routes inline in index.ts
3. **No Middleware** - No auth, validation, or request processing
4. **Global Queries** - `find({})` returns ALL data across all organizations
5. **No User Management** - No users, roles, or permissions
6. **Shared Storage** - Reports stored without org scoping

---

## Architecture Changes

### Before vs After

#### API Request Flow (Before)
```
Dashboard → GET /executions
  ↓
Producer Service (no auth check)
  ↓
MongoDB: collection.find({})  ← Returns ALL executions
  ↓
Dashboard receives global data
```

#### API Request Flow (After)
```
Dashboard → GET /api/executions + JWT token
  ↓
Producer Service → Auth Middleware
  ↓
Extract organizationId from JWT
  ↓
MongoDB: collection.find({ organizationId })  ← Filtered by org
  ↓
Dashboard receives ONLY org's executions
```

### New Collections

#### organizations
```typescript
{
  _id: ObjectId,
  name: "Acme Corporation",
  slug: "acme-corp",
  plan: "free" | "team" | "enterprise",
  limits: {
    maxProjects: 1,
    maxTestRuns: 100,
    maxUsers: 3,
    maxConcurrentRuns: 1
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### users
```typescript
{
  _id: ObjectId,
  email: "user@acme.com",
  name: "John Doe",
  hashedPassword: "$2b$10$...",
  organizationId: ObjectId,
  role: "admin" | "developer" | "viewer",
  status: "active" | "invited" | "suspended",
  lastLoginAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### executions (updated)
```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,  // ← NEW FIELD
  taskId: string,
  status: string,
  image: string,
  command: string,
  // ... existing fields
}
```

---

## Sprint Breakdown

### Sprint 1: Backend Foundation (Days 1-3)
**Goal:** Create data models, migration script, JWT/password utilities

**Tasks:**
- Task 1.1: Create shared TypeScript interfaces (IOrganization, IUser, IJWTPayload)
- Task 1.2: Write database migration script
- Task 1.3: Implement JWT signing/verification utilities
- Task 1.4: Implement password hashing utilities
- Task 1.5: Create authentication middleware

**Deliverable:** Backend infrastructure ready for auth routes

---

### Sprint 2: Authentication Routes (Days 4-6)
**Goal:** Implement signup, login, and /me endpoints

**Tasks:**
- Task 2.1: Create auth routes file (signup, login)
- Task 2.2: Implement POST /api/auth/signup (create org + user)
- Task 2.3: Implement POST /api/auth/login (validate credentials, return JWT)
- Task 2.4: Implement GET /api/auth/me (return user info from token)
- Task 2.5: Update index.ts to register auth routes
- Task 2.6: Test authentication flow end-to-end

**Deliverable:** Working authentication API endpoints

---

### Sprint 3: Data Isolation (Days 7-9)
**Goal:** Add organizationId filtering to all queries and broadcasts

**Tasks:**
- Task 3.1: Update ALL execution queries with organizationId filter
- Task 3.2: Update execution creation to include organizationId
- Task 3.3: Update RabbitMQ messages to include organizationId
- Task 3.4: Update Worker to extract and use organizationId
- Task 3.5: Implement Socket.io room-based broadcasting
- Task 3.6: Update report storage paths (org-scoped)
- Task 3.7: Test multi-org data isolation

**Deliverable:** Complete data isolation between organizations

---

### Sprint 4: Frontend Authentication (Days 10-12)
**Goal:** Build login UI, auth context, and protected routes

**Tasks:**
- Task 4.1: Create AuthContext provider (user state, login/logout)
- Task 4.2: Create Login page component
- Task 4.3: Create Signup page component
- Task 4.4: Create ProtectedRoute wrapper component
- Task 4.5: Update App.tsx with routing (react-router-dom)
- Task 4.6: Update Dashboard header (show org name, user menu)
- Task 4.7: Update API calls to include JWT token
- Task 4.8: Update Socket.io connection to authenticate

**Deliverable:** Fully functional authentication UI

---

### Sprint 5: Testing & Polish (Days 13-15)
**Goal:** Integration testing, bug fixes, deployment preparation

**Tasks:**
- Task 5.1: Run database migration on staging environment
- Task 5.2: Test multi-org isolation (create 2 orgs, verify separation)
- Task 5.3: Test authentication flows (signup, login, logout, refresh)
- Task 5.4: Test real-time updates per organization
- Task 5.5: Update docker-compose.yml with new env vars
- Task 5.6: Create .env.example with JWT_SECRET placeholder
- Task 5.7: Performance testing (ensure no degradation)
- Task 5.8: Security audit (check for vulnerabilities)
- Task 5.9: Update README with new setup instructions
- Task 5.10: Deploy to staging, smoke test, deploy to production

**Deliverable:** Production-ready Phase 1 deployment

---

## Detailed Task List

### Sprint 1: Backend Foundation

#### Task 1.1: Create Shared TypeScript Interfaces
**File:** `packages/shared-types/src/index.ts`

**Action:** ADD new interfaces

```typescript
// Organization Interface
export interface IOrganization {
  _id: ObjectId;
  name: string;
  slug: string;
  plan: 'free' | 'team' | 'enterprise';
  limits: {
    maxProjects: number;
    maxTestRuns: number;
    maxUsers: number;
    maxConcurrentRuns: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// User Interface
export interface IUser {
  _id: ObjectId;
  email: string;
  name: string;
  hashedPassword: string;
  organizationId: ObjectId;
  role: 'admin' | 'developer' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Invitation Interface
export interface IInvitation {
  _id: ObjectId;
  organizationId: ObjectId;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

// JWT Payload
export interface IJWTPayload {
  userId: string;
  organizationId: string;
  role: string;
  iat: number;
  exp: number;
}

// Auth API Types
export interface ISignupRequest {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IAuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
    organizationName: string;
  };
}
```

**Update Execution Interface:**
```typescript
export interface IExecution {
  _id: ObjectId;
  organizationId: ObjectId;  // ← ADD THIS FIELD
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'UNSTABLE' | 'ANALYZING';
  image: string;
  command: string;
  folder: string;
  startTime: Date;
  endTime?: Date;
  config: IExecutionConfig;
  tests: string[];
  output?: string;
  error?: string;
  analysis?: string;
  reportsBaseUrl?: string;
}
```

**Acceptance Criteria:**
- [ ] All interfaces compile without errors
- [ ] Exported correctly from shared-types package
- [ ] Usable in producer-service, worker-service, and dashboard-client

**Estimated Time:** 1 hour

---

#### Task 1.2: Write Database Migration Script
**File:** `migrations/001-add-organization-to-existing-data.ts`

**Action:** CREATE new migration script

```typescript
import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/automation_platform';
const DEFAULT_ORG_ID = new ObjectId();

async function migrate() {
  console.log('Starting migration: Add organization support...');
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db();

  try {
    // Step 1: Create organizations collection
    console.log('Creating organizations collection...');
    const orgsCollection = db.collection('organizations');
    await orgsCollection.createIndex({ slug: 1 }, { unique: true });

    // Step 2: Insert default organization for existing data
    console.log('Inserting default organization...');
    await orgsCollection.insertOne({
      _id: DEFAULT_ORG_ID,
      name: 'Default Organization (Migrated)',
      slug: 'default-org',
      plan: 'enterprise',
      limits: {
        maxProjects: 999,
        maxTestRuns: 999999,
        maxUsers: 999,
        maxConcurrentRuns: 50
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Default org created with ID: ${DEFAULT_ORG_ID}`);

    // Step 3: Create users collection
    console.log('Creating users collection...');
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ organizationId: 1 });

    // Step 4: Create default admin user
    console.log('Creating default admin user...');
    const bcrypt = require('bcrypt');
    const defaultPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const adminUserId = new ObjectId();
    await usersCollection.insertOne({
      _id: adminUserId,
      email: 'admin@default.local',
      name: 'Default Admin',
      hashedPassword,
      organizationId: DEFAULT_ORG_ID,
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Default admin created: admin@default.local / ${defaultPassword}`);

    // Step 5: Add organizationId to all existing executions
    console.log('Updating existing executions with organizationId...');
    const executionsCollection = db.collection('executions');
    const updateResult = await executionsCollection.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: DEFAULT_ORG_ID } }
    );
    console.log(`Updated ${updateResult.modifiedCount} executions with organizationId`);

    // Step 6: Create indexes on executions
    console.log('Creating indexes on executions collection...');
    await executionsCollection.createIndex({ organizationId: 1 });
    await executionsCollection.createIndex({ organizationId: 1, startTime: -1 });
    await executionsCollection.createIndex({ organizationId: 1, taskId: 1 });
    console.log('Indexes created successfully');

    // Step 7: Create invitations collection
    console.log('Creating invitations collection...');
    const invitationsCollection = db.collection('invitations');
    await invitationsCollection.createIndex({ token: 1 }, { unique: true });
    await invitationsCollection.createIndex({ organizationId: 1, status: 1 });
    await invitationsCollection.createIndex({ email: 1, organizationId: 1 });
    console.log('Invitations collection created');

    // Step 8: Verify migration
    console.log('\n=== Migration Verification ===');
    const orgCount = await orgsCollection.countDocuments();
    const userCount = await usersCollection.countDocuments();
    const executionCount = await executionsCollection.countDocuments({ organizationId: DEFAULT_ORG_ID });

    console.log(`Organizations: ${orgCount}`);
    console.log(`Users: ${userCount}`);
    console.log(`Executions with organizationId: ${executionCount}`);
    console.log('Migration completed successfully! ✓');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error during migration:', error);
  process.exit(1);
});
```

**Run Command:**
```bash
# Install dependencies first
npm install mongodb bcrypt

# Run migration
node migrations/001-add-organization-to-existing-data.ts
```

**Acceptance Criteria:**
- [ ] Default organization created successfully
- [ ] All existing executions have organizationId field
- [ ] Default admin user created (email: admin@default.local, password: admin123)
- [ ] All indexes created without errors
- [ ] Verification output shows correct counts

**Estimated Time:** 2 hours

---

#### Task 1.3: Implement JWT Utilities
**File:** `apps/producer-service/src/utils/jwt.ts`

**Action:** CREATE new file

```typescript
import jwt from 'jsonwebtoken';
import { IJWTPayload } from '@shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Sign a JWT token with user/org context
 */
export function signToken(payload: Omit<IJWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode a JWT token
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): IJWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as IJWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
```

**Install Dependencies:**
```bash
cd apps/producer-service
npm install jsonwebtoken @types/jsonwebtoken
```

**Acceptance Criteria:**
- [ ] signToken creates valid JWT with correct payload
- [ ] verifyToken correctly validates and decodes tokens
- [ ] verifyToken returns null for invalid/expired tokens
- [ ] extractTokenFromHeader parses Authorization header correctly

**Estimated Time:** 30 minutes

---

#### Task 1.4: Implement Password Utilities
**File:** `apps/producer-service/src/utils/password.ts`

**Action:** CREATE new file

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS || '10');

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain text password with hashed password
 * @returns true if passwords match
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Validate password strength
 * @returns true if password meets requirements
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

**Install Dependencies:**
```bash
cd apps/producer-service
npm install bcrypt @types/bcrypt
```

**Acceptance Criteria:**
- [ ] hashPassword produces bcrypt hashes
- [ ] comparePassword correctly validates passwords
- [ ] validatePasswordStrength enforces minimum requirements
- [ ] Hashed passwords cannot be reversed

**Estimated Time:** 30 minutes

---

#### Task 1.5: Create Authentication Middleware
**File:** `apps/producer-service/src/middleware/auth.ts`

**Action:** CREATE new file

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';

/**
 * Authentication middleware
 * Extracts JWT token, verifies it, and injects user context into request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = extractTokenFromHeader(request.headers.authorization);

  if (!token) {
    return reply.code(401).send({
      success: false,
      error: 'Authentication required',
      message: 'No token provided in Authorization header'
    });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return reply.code(401).send({
      success: false,
      error: 'Invalid token',
      message: 'Token is invalid or expired'
    });
  }

  // Inject user context into request
  request.user = {
    userId: payload.userId,
    organizationId: payload.organizationId,
    role: payload.role
  };
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }
  };
}

// Extend FastifyRequest type to include user context
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      organizationId: string;
      role: string;
    };
  }
}
```

**Acceptance Criteria:**
- [ ] Middleware rejects requests without Authorization header
- [ ] Middleware rejects requests with invalid tokens
- [ ] Middleware injects user context for valid tokens
- [ ] requireRole blocks users without correct role

**Estimated Time:** 1 hour

---

### Sprint 2: Authentication Routes

#### Task 2.1: Create Auth Routes File
**File:** `apps/producer-service/src/routes/auth.ts`

**Action:** CREATE new file

```typescript
import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { signToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';

export async function authRoutes(app: FastifyInstance, mongoClient: MongoClient) {
  const db = mongoClient.db();
  const usersCollection = db.collection('users');
  const orgsCollection = db.collection('organizations');

  /**
   * POST /api/auth/signup
   * Register new user and create organization
   */
  app.post('/api/auth/signup', async (request, reply) => {
    const { email, password, name, organizationName } = request.body as any;

    // Validation
    if (!email || !password || !name || !organizationName) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields',
        message: 'Email, password, name, and organization name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return reply.code(400).send({
        success: false,
        error: 'Weak password',
        message: passwordValidation.errors.join(', ')
      });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return reply.code(409).send({
        success: false,
        error: 'Email already registered',
        message: 'An account with this email already exists'
      });
    }

    try {
      // Create organization
      const orgId = new ObjectId();
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      await orgsCollection.insertOne({
        _id: orgId,
        name: organizationName,
        slug,
        plan: 'free',
        limits: {
          maxProjects: 1,
          maxTestRuns: 100,
          maxUsers: 3,
          maxConcurrentRuns: 1
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create user
      const userId = new ObjectId();
      const hashedPassword = await hashPassword(password);

      await usersCollection.insertOne({
        _id: userId,
        email: email.toLowerCase(),
        name,
        hashedPassword,
        organizationId: orgId,
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Generate JWT token
      const token = signToken({
        userId: userId.toString(),
        organizationId: orgId.toString(),
        role: 'admin'
      });

      return reply.code(201).send({
        success: true,
        token,
        user: {
          id: userId.toString(),
          email: email.toLowerCase(),
          name,
          role: 'admin',
          organizationId: orgId.toString(),
          organizationName
        }
      });

    } catch (error: any) {
      console.error('Signup error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Signup failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token
   */
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    try {
      // Find user
      const user = await usersCollection.findOne({ email: email.toLowerCase() });
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.hashedPassword);
      if (!isValidPassword) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Check user status
      if (user.status === 'suspended') {
        return reply.code(403).send({
          success: false,
          error: 'Account suspended',
          message: 'Your account has been suspended. Contact support.'
        });
      }

      // Get organization
      const org = await orgsCollection.findOne({ _id: user.organizationId });

      // Generate JWT token
      const token = signToken({
        userId: user._id.toString(),
        organizationId: user.organizationId.toString(),
        role: user.role
      });

      // Update last login timestamp
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } }
      );

      return reply.send({
        success: true,
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId.toString(),
          organizationName: org?.name || 'Unknown Organization'
        }
      });

    } catch (error: any) {
      console.error('Login error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Login failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info from JWT token
   */
  app.get('/api/auth/me', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = new ObjectId(request.user!.userId);
      const orgId = new ObjectId(request.user!.organizationId);

      const user = await usersCollection.findOne({ _id: userId });
      const org = await orgsCollection.findOne({ _id: orgId });

      if (!user || !org) {
        return reply.code(404).send({
          success: false,
          error: 'User or organization not found'
        });
      }

      return reply.send({
        success: true,
        data: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          organization: {
            id: org._id.toString(),
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            limits: org.limits
          }
        }
      });

    } catch (error: any) {
      console.error('Get user error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user info',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout user (client-side token removal, placeholder for future token blacklist)
   */
  app.post('/api/auth/logout', { preHandler: authMiddleware }, async (request, reply) => {
    // In a stateless JWT system, logout is handled client-side
    // Future: Implement token blacklist in Redis
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });
}
```

**Acceptance Criteria:**
- [ ] POST /api/auth/signup creates organization and user
- [ ] POST /api/auth/login validates credentials and returns JWT
- [ ] GET /api/auth/me returns user info from token
- [ ] Proper error handling for all edge cases
- [ ] Email normalized to lowercase
- [ ] Password strength validated

**Estimated Time:** 3 hours

---

#### Task 2.2: Update index.ts to Register Auth Routes
**File:** `apps/producer-service/src/index.ts`

**Action:** MODIFY existing file

**Add imports:**
```typescript
import { authRoutes } from './routes/auth';
import { authMiddleware } from './middleware/auth';
```

**Register routes after MongoDB connection:**
```typescript
// After connecting to MongoDB
await authRoutes(app, mongoClient);
```

**Add global auth middleware (with exclusions):**
```typescript
// Global authentication middleware (after route registration)
app.addHook('preHandler', async (request, reply) => {
  // Skip auth for these routes
  const publicRoutes = [
    '/',
    '/api/auth/signup',
    '/api/auth/login'
  ];

  if (publicRoutes.includes(request.url)) {
    return;
  }

  // Apply auth middleware to all other routes
  await authMiddleware(request, reply);
});
```

**Update route paths to include /api prefix:**
```typescript
// Change all routes from:
// app.get('/executions', ...)
// To:
// app.get('/api/executions', ...)
```

**Acceptance Criteria:**
- [ ] Auth routes registered correctly
- [ ] Global auth middleware applied to protected routes
- [ ] Public routes (/, /api/auth/*) accessible without token
- [ ] Protected routes require valid JWT token

**Estimated Time:** 1 hour

---

### Sprint 3: Data Isolation

#### Task 3.1: Update All Execution Queries with organizationId
**File:** `apps/producer-service/src/index.ts`

**Action:** MODIFY all execution endpoints

**GET /api/executions:**
```typescript
// BEFORE
app.get('/executions', async (request, reply) => {
  const executions = await collection.find({}).sort({ startTime: -1 }).limit(50).toArray();
  reply.send(executions);
});

// AFTER
app.get('/api/executions', { preHandler: authMiddleware }, async (request, reply) => {
  const orgId = new ObjectId(request.user!.organizationId);

  const executions = await collection
    .find({ organizationId: orgId })
    .sort({ startTime: -1 })
    .limit(50)
    .toArray();

  reply.send({
    success: true,
    data: executions
  });
});
```

**POST /api/execution-request:**
```typescript
// Add organizationId to new executions
const execution = {
  taskId,
  organizationId: new ObjectId(request.user!.organizationId), // ← ADD THIS
  image,
  command,
  folder,
  // ... rest of fields
};
```

**DELETE /api/executions/:id:**
```typescript
// BEFORE
app.delete('/executions/:id', async (request, reply) => {
  const { id } = request.params as any;
  await collection.deleteOne({ taskId: id });
  reply.send({ success: true });
});

// AFTER
app.delete('/api/executions/:id', { preHandler: authMiddleware }, async (request, reply) => {
  const { id } = request.params as any;
  const orgId = new ObjectId(request.user!.organizationId);

  // Only delete if belongs to this organization
  const result = await collection.deleteOne({
    taskId: id,
    organizationId: orgId
  });

  if (result.deletedCount === 0) {
    return reply.code(404).send({
      success: false,
      error: 'Execution not found'
    });
  }

  reply.send({ success: true });
});
```

**GET /api/metrics/:image:**
```typescript
// Add org prefix to Redis keys
const key = `org:${request.user!.organizationId}:metrics:test:${image}`;
```

**Acceptance Criteria:**
- [ ] All queries filter by organizationId
- [ ] New executions include organizationId
- [ ] Delete operations verify ownership
- [ ] Redis keys scoped by organization
- [ ] No global data leaks possible

**Estimated Time:** 2 hours

---

#### Task 3.2: Update RabbitMQ Messages to Include organizationId
**File:** `apps/producer-service/src/rabbitmq.ts`

**Action:** MODIFY message payload

```typescript
// When publishing job to queue
export async function publishTestJob(execution: any) {
  const message = {
    taskId: execution.taskId,
    organizationId: execution.organizationId.toString(), // ← ADD THIS
    image: execution.image,
    command: execution.command,
    folder: execution.folder,
    tests: execution.tests,
    config: execution.config
  };

  const channel = await getChannel();
  channel.sendToQueue('test_queue', Buffer.from(JSON.stringify(message)), {
    persistent: true
  });
}
```

**Acceptance Criteria:**
- [ ] All queue messages include organizationId
- [ ] Messages can be consumed by updated worker

**Estimated Time:** 30 minutes

---

#### Task 3.3: Update Worker to Extract and Use organizationId
**File:** `apps/worker-service/src/worker.ts`

**Action:** MODIFY worker job processing

```typescript
import { ObjectId } from 'mongodb';

channel.consume('test_queue', async (msg) => {
  if (!msg) return;

  const job = JSON.parse(msg.content.toString());
  const { taskId, organizationId, image, command, folder, tests, config } = job;

  // Convert organizationId string to ObjectId
  const orgId = new ObjectId(organizationId);

  try {
    // Update status to RUNNING
    await executionsCollection.updateOne(
      { taskId, organizationId: orgId }, // ← Filter by both
      { $set: { status: 'RUNNING', startTime: new Date() } }
    );

    // Run container with org-scoped name
    const containerName = `org_${organizationId}_${taskId}`;

    // ... rest of container orchestration

    // Store logs with organizationId
    const logData = {
      organizationId: orgId,
      taskId,
      timestamp: new Date(),
      message: logLine
    };

    // Update final status
    await executionsCollection.updateOne(
      { taskId, organizationId: orgId }, // ← Always filter by org
      { $set: {
        status: finalStatus,
        endTime: new Date(),
        output: logs,
        analysis: aiAnalysis
      } }
    );

    channel.ack(msg);

  } catch (error) {
    console.error(`Job failed for org ${organizationId}:`, error);
    channel.nack(msg);
  }
});
```

**Acceptance Criteria:**
- [ ] Worker extracts organizationId from queue message
- [ ] All MongoDB updates filter by organizationId
- [ ] Container names include organizationId
- [ ] Logs stored with organizationId

**Estimated Time:** 1.5 hours

---

#### Task 3.4: Implement Socket.io Room-Based Broadcasting
**File:** `apps/producer-service/src/index.ts`

**Action:** MODIFY Socket.io connection handling

```typescript
import { Server } from 'socket.io';
import { verifyToken } from './utils/jwt';

// Socket.io server setup
const io = new Server(server, {
  cors: {
    origin: process.env.DASHBOARD_URL || 'http://localhost:8080',
    credentials: true
  }
});

// Authentication on connection
io.on('connection', (socket) => {
  // Extract JWT token from handshake
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log('Socket connection rejected: No token');
    socket.disconnect();
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    console.log('Socket connection rejected: Invalid token');
    socket.disconnect();
    return;
  }

  // Join organization-specific room
  const orgRoom = `org:${payload.organizationId}`;
  socket.join(orgRoom);

  console.log(`Socket ${socket.id} joined room ${orgRoom}`);

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected from ${orgRoom}`);
  });
});

// Broadcast execution updates to specific organization
export function broadcastExecutionUpdate(execution: any) {
  const orgRoom = `org:${execution.organizationId}`;
  io.to(orgRoom).emit('execution-updated', execution);
}

// Broadcast logs to specific organization
export function broadcastLog(executionId: string, organizationId: string, logData: any) {
  const orgRoom = `org:${organizationId}`;
  io.to(orgRoom).emit('execution-log', logData);
}
```

**Acceptance Criteria:**
- [ ] Socket connections authenticated with JWT
- [ ] Clients join organization-specific rooms
- [ ] Broadcasts only sent to correct organization
- [ ] No cross-org data leaks via Socket.io

**Estimated Time:** 2 hours

---

### Sprint 4: Frontend Authentication

#### Task 4.1: Create AuthContext Provider
**File:** `apps/dashboard-client/src/context/AuthContext.tsx`

**Action:** CREATE new file

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, orgName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  async function fetchCurrentUser() {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const userData = response.data.data;
        setUser({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          organizationId: userData.organization.id,
          organizationName: userData.organization.name
        });
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    });

    if (response.data.success) {
      const { token, user } = response.data;
      localStorage.setItem('authToken', token);
      setToken(token);
      setUser(user);
    } else {
      throw new Error(response.data.error || 'Login failed');
    }
  }

  async function signup(
    email: string,
    password: string,
    name: string,
    organizationName: string
  ) {
    const response = await axios.post(`${API_URL}/api/auth/signup`, {
      email,
      password,
      name,
      organizationName
    });

    if (response.data.success) {
      const { token, user } = response.data;
      localStorage.setItem('authToken', token);
      setToken(token);
      setUser(user);
    } else {
      throw new Error(response.data.error || 'Signup failed');
    }
  }

  function logout() {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        signup,
        logout,
        isLoading,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Acceptance Criteria:**
- [ ] Auth state persists in localStorage
- [ ] User info fetched on mount if token exists
- [ ] Login/signup update state correctly
- [ ] Logout clears state and localStorage

**Estimated Time:** 1.5 hours

---

#### Task 4.2: Create Login Page
**File:** `apps/dashboard-client/src/pages/Login.tsx`

**Action:** CREATE new file

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your Automation Center account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Form validates email and password fields
- [ ] Submit calls login function from AuthContext
- [ ] Loading state shown during authentication
- [ ] Errors displayed clearly
- [ ] Redirects to /dashboard on success

**Estimated Time:** 1 hour

---

#### Task 4.3: Create Signup Page
**File:** `apps/dashboard-client/src/pages/Signup.tsx`

**Action:** CREATE new file

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signup(email, password, name, organizationName);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Start automating your tests today
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              disabled={isLoading}
              minLength={8}
            />
            <p className="mt-1 text-xs text-gray-500">
              At least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
              Organization Name
            </label>
            <input
              id="organization"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] All fields validated
- [ ] Password strength hint shown
- [ ] Signup creates org and user
- [ ] Redirects to dashboard on success

**Estimated Time:** 1 hour

---

#### Task 4.4: Update App.tsx with Routing
**File:** `apps/dashboard-client/src/App.tsx`

**Action:** MODIFY to add routing

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './components/Dashboard';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Install Dependencies:**
```bash
cd apps/dashboard-client
npm install react-router-dom
```

**Acceptance Criteria:**
- [ ] Routing works correctly
- [ ] Unauthenticated users redirect to /login
- [ ] Authenticated users can access /dashboard
- [ ] Root path redirects to /dashboard

**Estimated Time:** 1 hour

---

#### Task 4.5: Update Dashboard Header
**File:** `apps/dashboard-client/src/components/Dashboard.tsx`

**Action:** MODIFY to add header with org/user info

```typescript
import React from 'react';
import { useAuth } from '../context/AuthContext';
// ... existing imports

export function Dashboard() {
  const { user, logout } = useAuth();
  // ... existing dashboard logic

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Left side - Logo and Org name */}
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-blue-600">AAC</h1>
              <span className="text-gray-400">|</span>
              <span className="text-lg font-medium text-gray-900">
                {user?.organizationName}
              </span>
            </div>

            {/* Right side - User info and logout */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.name}
                </div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {user?.role}
              </span>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Existing dashboard content */}
      </main>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Header shows organization name
- [ ] User name and email displayed
- [ ] Role badge shown
- [ ] Logout button functional

**Estimated Time:** 1 hour

---

#### Task 4.6: Update API Calls to Include JWT Token
**File:** `apps/dashboard-client/src/hooks/useExecutions.ts`

**Action:** MODIFY to add Authorization header

```typescript
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export function useExecutions() {
  const { token } = useAuth();

  // Create axios instance with auth header
  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // Fetch executions
  const { data, isLoading, error } = useQuery({
    queryKey: ['executions'],
    queryFn: async () => {
      const response = await api.get('/api/executions');
      return response.data.data;
    },
    enabled: !!token
  });

  // Socket.io with authentication
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: {
        token // ← Send token on connection
      }
    });

    socket.on('execution-updated', (updatedExecution) => {
      // Update query cache
      queryClient.setQueryData(['executions'], (old: any) => {
        return old.map((exec: any) =>
          exec.taskId === updatedExecution.taskId ? updatedExecution : exec
        );
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { executions: data, isLoading, error };
}
```

**Acceptance Criteria:**
- [ ] All API calls include Authorization header
- [ ] Socket.io sends JWT token on connection
- [ ] Queries only run when authenticated
- [ ] Token changes trigger re-fetch

**Estimated Time:** 1.5 hours

---

### Sprint 5: Testing & Polish

#### Task 5.1: Multi-Organization Isolation Test
**File:** `tests/multi-org-isolation.test.ts`

**Action:** CREATE test script

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function testMultiOrgIsolation() {
  console.log('=== Multi-Organization Isolation Test ===\n');

  // Step 1: Create Organization A
  console.log('1. Creating Organization A...');
  const orgASignup = await axios.post(`${API_URL}/api/auth/signup`, {
    email: 'admin@org-a.com',
    password: 'Test1234!',
    name: 'Admin A',
    organizationName: 'Organization A'
  });
  const tokenA = orgASignup.data.token;
  console.log('✓ Organization A created');

  // Step 2: Create Organization B
  console.log('2. Creating Organization B...');
  const orgBSignup = await axios.post(`${API_URL}/api/auth/signup`, {
    email: 'admin@org-b.com',
    password: 'Test1234!',
    name: 'Admin B',
    organizationName: 'Organization B'
  });
  const tokenB = orgBSignup.data.token;
  console.log('✓ Organization B created');

  // Step 3: User A creates execution
  console.log('3. User A creating execution...');
  const executionA = await axios.post(
    `${API_URL}/api/execution-request`,
    {
      taskId: 'test-org-a-exec-1',
      image: 'test-image',
      command: 'npm test',
      folder: 'all',
      tests: [],
      config: { environment: 'staging', retryAttempts: 0 }
    },
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  console.log('✓ Execution created by User A');

  // Step 4: User B fetches executions (should NOT see User A's)
  console.log('4. User B fetching executions...');
  const orgBExecutions = await axios.get(`${API_URL}/api/executions`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });

  if (orgBExecutions.data.data.length > 0) {
    console.error('❌ FAIL: User B can see User A\'s execution!');
    process.exit(1);
  }
  console.log('✓ User B cannot see User A\'s execution');

  // Step 5: User A fetches executions (should see their own)
  console.log('5. User A fetching executions...');
  const orgAExecutions = await axios.get(`${API_URL}/api/executions`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  if (orgAExecutions.data.data.length === 0) {
    console.error('❌ FAIL: User A cannot see their own execution!');
    process.exit(1);
  }
  console.log('✓ User A can see their own execution');

  // Step 6: User B tries to delete User A's execution (should fail)
  console.log('6. User B trying to delete User A\'s execution...');
  try {
    await axios.delete(`${API_URL}/api/executions/test-org-a-exec-1`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    console.error('❌ FAIL: User B can delete User A\'s execution!');
    process.exit(1);
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('✓ User B cannot delete User A\'s execution (404)');
    } else {
      console.error('❌ FAIL: Unexpected error:', error.response?.status);
      process.exit(1);
    }
  }

  console.log('\n=== All Tests Passed! ✓ ===');
  console.log('Organizations are properly isolated.');
}

testMultiOrgIsolation().catch(console.error);
```

**Run Command:**
```bash
npm install -g tsx
tsx tests/multi-org-isolation.test.ts
```

**Acceptance Criteria:**
- [ ] Organizations cannot see each other's executions
- [ ] Delete operations return 404 for other org's data
- [ ] Each org sees only their own data

**Estimated Time:** 1 hour

---

#### Task 5.2: Update docker-compose.yml
**File:** `docker-compose.yml`

**Action:** ADD new environment variables

```yaml
producer:
  environment:
    # Existing vars...
    - MONGODB_URI=${MONGODB_URI:-mongodb://mongodb:27017/automation_platform}
    - RABBITMQ_URL=${RABBITMQ_URL:-amqp://rabbitmq:5672}
    - REDIS_URL=${REDIS_URL:-redis://redis:6379}

    # NEW: Authentication vars
    - JWT_SECRET=${JWT_SECRET:-dev-secret-CHANGE-IN-PRODUCTION-min-64-chars}
    - JWT_EXPIRY=${JWT_EXPIRY:-24h}
    - PASSWORD_SALT_ROUNDS=${PASSWORD_SALT_ROUNDS:-10}

    # Dashboard URL for CORS
    - DASHBOARD_URL=${DASHBOARD_URL:-http://localhost:8080}

worker:
  environment:
    # Existing vars...
    # No new vars needed for worker
```

**File:** `.env.example`

**Action:** CREATE example environment file

```bash
# Database
MONGODB_URI=mongodb://mongodb:27017/automation_platform

# Message Queue
RABBITMQ_URL=amqp://rabbitmq:5672

# Cache
REDIS_URL=redis://redis:6379

# Authentication (REQUIRED in production)
# Generate with: openssl rand -hex 64
JWT_SECRET=your-super-secret-jwt-key-minimum-64-characters-use-openssl-rand
JWT_EXPIRY=24h
PASSWORD_SALT_ROUNDS=10

# Dashboard URL (for CORS)
DASHBOARD_URL=http://localhost:8080

# AI Analysis
GEMINI_API_KEY=your-gemini-api-key
```

**Acceptance Criteria:**
- [ ] Services start with new environment variables
- [ ] .env.example provides clear instructions
- [ ] JWT_SECRET warning in README for production

**Estimated Time:** 30 minutes

---

#### Task 5.3: Update README with Setup Instructions
**File:** `README.md`

**Action:** ADD Phase 1 setup instructions

```markdown
## Multi-Tenant Setup (Phase 1)

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for running migrations)

### First-Time Setup

1. **Generate JWT Secret**
   ```bash
   openssl rand -hex 64
   ```

2. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env and add your JWT_SECRET
   ```

3. **Run Database Migration**
   ```bash
   # Start MongoDB first
   docker-compose up -d mongodb

   # Run migration script
   npm install
   node migrations/001-add-organization-to-existing-data.ts
   ```

4. **Start All Services**
   ```bash
   docker-compose up --build
   ```

5. **Access Dashboard**
   - URL: http://localhost:8080
   - Default credentials (if migrated):
     - Email: `admin@default.local`
     - Password: `admin123`

### Creating New Organization

1. Visit http://localhost:8080/signup
2. Enter your details and organization name
3. You'll be the admin of your new organization

### Multi-Tenancy Features

- **Complete Data Isolation**: Each organization's data is completely isolated
- **Role-Based Access**: Admin, Developer, and Viewer roles
- **JWT Authentication**: Secure token-based authentication
- **Real-Time Updates**: Organization-scoped Socket.io broadcasts

### Security Notes

⚠️ **IMPORTANT for Production:**
- Change `JWT_SECRET` to a strong random value (min 64 characters)
- Use environment variables, not hardcoded values
- Enable HTTPS for all API calls
- Set strong password policies
```

**Acceptance Criteria:**
- [ ] Clear setup instructions
- [ ] Security warnings highlighted
- [ ] Default credentials documented

**Estimated Time:** 30 minutes

---

## File Modification Matrix

### Backend (Producer Service)

| File Path | Action | Description |
|-----------|--------|-------------|
| `packages/shared-types/src/index.ts` | MODIFY | Add IOrganization, IUser, IInvitation, IJWTPayload interfaces |
| `apps/producer-service/src/utils/jwt.ts` | CREATE | JWT signing and verification utilities |
| `apps/producer-service/src/utils/password.ts` | CREATE | Password hashing and validation |
| `apps/producer-service/src/middleware/auth.ts` | CREATE | Authentication middleware |
| `apps/producer-service/src/routes/auth.ts` | CREATE | Auth routes (signup, login, /me) |
| `apps/producer-service/src/index.ts` | MODIFY | Register auth routes, add global auth middleware |
| `apps/producer-service/src/rabbitmq.ts` | MODIFY | Include organizationId in queue messages |

### Backend (Worker Service)

| File Path | Action | Description |
|-----------|--------|-------------|
| `apps/worker-service/src/worker.ts` | MODIFY | Extract organizationId, filter queries |
| `apps/worker-service/src/analysisService.ts` | MODIFY | Track AI usage per organization |

### Frontend (Dashboard Client)

| File Path | Action | Description |
|-----------|--------|-------------|
| `apps/dashboard-client/src/context/AuthContext.tsx` | CREATE | Authentication context provider |
| `apps/dashboard-client/src/pages/Login.tsx` | CREATE | Login page component |
| `apps/dashboard-client/src/pages/Signup.tsx` | CREATE | Signup page component |
| `apps/dashboard-client/src/App.tsx` | MODIFY | Add routing and ProtectedRoute |
| `apps/dashboard-client/src/components/Dashboard.tsx` | MODIFY | Add header with org/user info |
| `apps/dashboard-client/src/hooks/useExecutions.ts` | MODIFY | Add JWT to API calls, auth Socket.io |

### Database & Infrastructure

| File Path | Action | Description |
|-----------|--------|-------------|
| `migrations/001-add-organization-to-existing-data.ts` | CREATE | Migration script |
| `docker-compose.yml` | MODIFY | Add JWT_SECRET and auth env vars |
| `.env.example` | CREATE | Example environment variables |
| `README.md` | MODIFY | Add multi-tenant setup instructions |

---

## Risk Assessment

### HIGH RISK

#### Risk 1: Data Isolation Breach
**Impact:** CRITICAL - Organizations see each other's data
**Likelihood:** Medium (coding errors in queries)
**Mitigation:**
- Comprehensive testing with 2+ organizations
- Code review checklist: "All queries include organizationId?"
- Automated test suite for isolation
- Database middleware to auto-inject filters (future enhancement)

**Detection:**
- Run multi-org isolation test suite
- Monitor logs for missing organizationId warnings
- Penetration testing before production

---

#### Risk 2: Migration Data Loss
**Impact:** CRITICAL - Existing executions lost
**Likelihood:** Low (with proper backups)
**Mitigation:**
- Full MongoDB backup before migration
- Test migration on staging environment first
- Dry-run migration (read-only verification)
- Rollback procedure documented
- Keep backup for 30 days post-migration

**Detection:**
- Verify execution count before/after migration
- Check that all executions have organizationId
- Spot-check random execution records

---

### MEDIUM RISK

#### Risk 3: Authentication Bypass
**Impact:** HIGH - Unauthorized access
**Likelihood:** Low (using industry-standard JWT)
**Mitigation:**
- Use strong JWT_SECRET (min 64 chars random)
- Short token expiry (24 hours)
- Validate tokens on every request
- No client-side role checks (server enforces)

**Detection:**
- Attempt to access API without token
- Attempt to modify JWT payload
- Attempt to use expired token

---

#### Risk 4: Performance Degradation
**Impact:** MEDIUM - Slow API responses
**Likelihood:** Medium (additional query filters, JWT verification)
**Mitigation:**
- Create MongoDB indexes on organizationId
- Cache JWT verification results (in-memory LRU)
- Monitor API response times
- Load testing before deployment

**Detection:**
- Benchmark API endpoints before/after Phase 1
- Monitor p95 latency in production
- Set alerts for response time > 500ms

---

### LOW RISK

#### Risk 5: Socket.io Connection Issues
**Impact:** LOW - Real-time updates delayed
**Likelihood:** Low
**Mitigation:**
- Fallback to HTTP polling if Socket.io fails
- Test room-based broadcasting thoroughly
- Monitor Socket.io connection errors

**Detection:**
- Check Socket.io connection status in browser console
- Monitor server logs for connection failures

---

## Testing Strategy

### Unit Tests

**Backend:**
- JWT signing and verification
- Password hashing and comparison
- Auth middleware token validation
- Role-based permission checks

**Frontend:**
- AuthContext state management
- Login/Signup form validation
- API call error handling

**Coverage Target:** >70% for new code

---

### Integration Tests

**Critical Flows:**
1. **Signup → Login → Dashboard**
   - Create account
   - Login with credentials
   - Fetch user info
   - Access protected resource

2. **Multi-Org Isolation**
   - Create 2 organizations
   - User A creates execution
   - User B fetches executions (should be empty)
   - User A fetches executions (should see their own)
   - User B tries to delete User A's execution (should fail)

3. **Real-Time Updates**
   - User A triggers execution
   - User B should NOT receive Socket.io update
   - User A should receive Socket.io update

4. **Authentication Flow**
   - Access protected route without token → 401
   - Access with invalid token → 401
   - Access with expired token → 401
   - Access with valid token → 200

---

### Manual Testing Checklist

- [ ] Create new organization via signup
- [ ] Login with credentials
- [ ] Access dashboard (should see org name in header)
- [ ] Trigger test execution (should include organizationId)
- [ ] View executions (should only see own org's data)
- [ ] Real-time logs update correctly
- [ ] Logout and verify token cleared
- [ ] Create second organization in different browser
- [ ] Verify data isolation between orgs
- [ ] Performance test (50 concurrent users)

---

## Deployment Plan

### Pre-Deployment Checklist

**Infrastructure:**
- [ ] MongoDB backup enabled (automated daily)
- [ ] Redis persistence configured
- [ ] Docker registry secured
- [ ] SSL certificates valid
- [ ] Generate production JWT_SECRET (openssl rand -hex 64)
- [ ] Update .env with production values

**Database:**
- [ ] Run migration script on staging
- [ ] Verify default organization created
- [ ] Verify all executions have organizationId
- [ ] Test rollback procedure

**Code:**
- [ ] All tests passing
- [ ] No console.log in production code
- [ ] Environment variables documented
- [ ] README updated

---

### Deployment Steps (Zero-Downtime)

#### Step 1: Backup
```bash
# Backup MongoDB
mongodump --uri="mongodb://prod-host:27017/automation_platform" \
  --out=backup-$(date +%Y%m%d-%H%M%S)

# Backup .env file
cp .env .env.backup
```

#### Step 2: Update Environment Variables
```bash
# Add to .env (production server)
JWT_SECRET=<your-64-char-random-secret>
JWT_EXPIRY=24h
PASSWORD_SALT_ROUNDS=10
```

#### Step 3: Run Migration
```bash
# SSH into production server
ssh production-server

# Run migration
cd /app
node migrations/001-add-organization-to-existing-data.ts

# Verify migration
mongo automation_platform --eval "db.executions.find({organizationId: {\$exists: true}}).count()"
```

#### Step 4: Deploy Services
```bash
# Pull latest code
git pull origin main

# Rebuild and restart services
docker-compose down
docker-compose up --build -d

# Watch logs for errors
docker-compose logs -f producer worker
```

#### Step 5: Smoke Tests
```bash
# Test health check
curl http://localhost:3000/

# Test signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","name":"Test User","organizationName":"Test Org"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Test dashboard access
curl http://localhost:8080/
```

#### Step 6: Monitor
- Check error rates (Sentry)
- Check API response times (Prometheus)
- Check Socket.io connections
- Monitor RabbitMQ queue

---

### Rollback Plan

**If deployment fails:**

1. **Stop services**
   ```bash
   docker-compose down
   ```

2. **Restore database**
   ```bash
   mongorestore --uri="mongodb://prod-host" --drop backup-<timestamp>/
   ```

3. **Revert code**
   ```bash
   git checkout <previous-commit>
   docker-compose up -d
   ```

4. **Verify rollback**
   - Check API health
   - Test existing functionality
   - Monitor error rates

---

## Success Criteria

### Phase 1 Complete When:

#### Technical Metrics
- [ ] **Zero Data Leaks:** Multi-org isolation test passes 100%
- [ ] **Authentication Works:** Signup, login, logout functional
- [ ] **Performance:** API p95 < 300ms (no degradation from baseline)
- [ ] **Stability:** Zero critical bugs after 7 days in production
- [ ] **Test Coverage:** >70% for new authentication code

#### Functional Metrics
- [ ] **Signup Flow:** New users can create account + organization
- [ ] **Login Flow:** Users can login and access dashboard
- [ ] **Data Isolation:** Organizations see only their own executions
- [ ] **Real-Time:** Socket.io broadcasts to correct organization only
- [ ] **Migration:** All existing data accessible in default organization

#### Business Metrics
- [ ] **Zero Data Loss:** All pre-existing executions preserved
- [ ] **Backward Compatibility:** All existing features work
- [ ] **Documentation:** README updated with setup instructions
- [ ] **Security:** No high-severity vulnerabilities (OWASP ZAP scan)

---

## Rollback Procedures

### Scenario 1: Migration Failed

**Symptoms:**
- Executions missing organizationId
- Queries returning empty results
- Database errors in logs

**Rollback:**
```bash
# Restore database from backup
mongorestore --uri="mongodb://prod-host" --drop backup-<timestamp>/

# Verify restoration
mongo automation_platform --eval "db.executions.count()"
```

---

### Scenario 2: Authentication Broken

**Symptoms:**
- Cannot login
- JWT verification errors
- 401 errors on all requests

**Rollback:**
```bash
# Revert producer service to previous version
docker-compose down producer
docker pull <previous-image-tag>
docker-compose up -d producer
```

**Temporary Fix:**
```typescript
// Disable auth middleware temporarily
app.addHook('preHandler', async (request, reply) => {
  // Skip auth for ALL routes (emergency only)
  return;
});
```

---

### Scenario 3: Frontend Build Failed

**Symptoms:**
- Dashboard not loading
- Blank white page
- JavaScript errors

**Rollback:**
```bash
# Revert dashboard to previous build
cd apps/dashboard-client
git checkout <previous-commit>
npm run build
# Re-deploy build artifacts
```

---

## Timeline Summary

### Week 1 (Days 1-5)
- **Sprint 1:** Backend foundation (3 days)
- **Sprint 2:** Authentication routes (2 days)

### Week 2 (Days 6-10)
- **Sprint 3:** Data isolation (3 days)
- **Sprint 4:** Frontend authentication (2 days)

### Week 3 (Days 11-15)
- **Sprint 5:** Testing and deployment (5 days)

**Total Duration:** 15 working days (3 weeks)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Generate JWT_SECRET** for production: `openssl rand -hex 64`
3. **Set up staging environment** for testing
4. **Begin Sprint 1** - Backend foundation
5. **Daily standups** to track progress
6. **Code reviews** for all authentication-related code

---

## References

- **PRD:** `docs/PRD-Multi-Tenant-SaaS.md`
- **Current Architecture:** `CLAUDE.md`
- **Codebase Analysis:** Available in this document

---

**Document Version Control:**
- v1.0 (2026-01-28): Initial Phase 1 implementation plan

**Approvals:**
- [ ] Technical Lead
- [ ] Product Owner
- [ ] Security Lead
