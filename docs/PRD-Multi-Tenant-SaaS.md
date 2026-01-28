# Product Requirements Document (PRD)
## Agnostic Automation Center - Multi-Tenant SaaS Transformation

**Version:** 1.0  
**Date:** January 28, 2026  
**Status:** Draft  
**Owner:** Product/Engineering Team

---

## Executive Summary

Transform the Agnostic Automation Center from a single-tenant automation platform into a production-ready, multi-tenant SaaS product. This transformation will enable the platform to serve multiple organizations simultaneously with complete data isolation, user management, and billing capabilities.

### Current State
- **Architecture:** Microservices (Producer, Worker, Dashboard)
- **Deployment:** Single instance at automation.keinar.com
- **Users:** Single organization with shared access
- **Authentication:** None
- **Billing:** None

### Target State
- **Architecture:** Multi-tenant microservices with organization isolation
- **Deployment:** SaaS platform serving multiple organizations
- **Users:** Multiple organizations with role-based access control
- **Authentication:** JWT-based with email/password + SSO (future)
- **Billing:** Stripe integration with tiered pricing

### Success Metrics
- Support 10+ organizations in first 3 months
- 99.5% data isolation accuracy (zero cross-organization leaks)
- User onboarding < 5 minutes
- System uptime > 99.9%

---

## Table of Contents
1. [Problem Statement](#1-problem-statement)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Personas](#3-user-personas)
4. [User Stories](#4-user-stories)
5. [Technical Architecture](#5-technical-architecture)
6. [Data Models](#6-data-models)
7. [API Specifications](#7-api-specifications)
8. [UI/UX Changes](#8-uiux-changes)
9. [Security & Compliance](#9-security--compliance)
10. [Implementation Phases](#10-implementation-phases)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Plan](#12-deployment-plan)
13. [Success Criteria](#13-success-criteria)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Open Questions](#15-open-questions)

---

## 1. Problem Statement

### Current Limitations
**Single-Tenant Architecture:**
- All users share the same workspace
- No data isolation between different companies
- Cannot commercialize as SaaS product
- No user authentication or authorization
- No billing or usage tracking

### Business Impact
- **Cannot Scale:** Limited to single organization deployment
- **Security Risk:** No data separation if multiple teams use it
- **No Revenue Model:** Cannot charge customers
- **Limited Market:** Cannot sell to enterprises requiring data isolation

### Opportunity
Transforming to multi-tenant SaaS opens:
- **Enterprise Market:** Companies requiring isolated testing platforms
- **Recurring Revenue:** Subscription-based pricing model
- **Market Differentiation:** Language-agnostic testing platform + AI analysis
- **Scalability:** Serve hundreds of organizations from single deployment

---

## 2. Goals & Non-Goals

### Goals (Must Have)
✅ **Complete Data Isolation:** Organizations cannot access each other's data  
✅ **User Authentication:** Secure login with JWT tokens  
✅ **Role-Based Access Control:** Admin, Developer, Viewer roles  
✅ **Organization Management:** Create, invite users, settings  
✅ **Billing Integration:** Stripe for subscription management  
✅ **Usage Tracking:** Monitor test runs, compute time, storage  
✅ **Tiered Pricing:** Free, Team, Enterprise plans  
✅ **Onboarding Flow:** Self-service organization creation  
✅ **Existing Features Preserved:** All current functionality works per-organization

### Nice to Have (Future)
🔄 **SSO Integration:** SAML/OAuth for enterprise customers  
🔄 **Audit Logs:** Complete activity tracking for compliance  
🔄 **White-Label:** Custom branding per organization  
🔄 **Advanced Analytics:** Cross-project insights dashboard  
🔄 **API Keys:** Programmatic access with organization scoping  
🔄 **Webhooks:** Real-time event notifications  

### Non-Goals (Explicitly Out of Scope)
❌ **Multi-Region Deployment:** Single region for MVP  
❌ **Custom Deployments:** No on-premise installations yet  
❌ **Advanced RBAC:** No custom permissions beyond 3 roles  
❌ **Data Migration Service:** No automated import from other platforms  
❌ **Mobile Apps:** Web-only for now

---

## 3. User Personas

### Persona 1: Organization Admin (Sarah)
**Role:** QA Lead at a mid-sized SaaS company  
**Goals:**
- Set up testing infrastructure for her team
- Invite team members and manage access
- Monitor testing activity and costs
- Ensure compliance with company security policies

**Pain Points:**
- Needs quick setup without DevOps dependency
- Requires visibility into who's running what tests
- Concerned about cost overruns

**Key Features:**
- Organization settings and billing management
- User invitation and role assignment
- Usage dashboards and alerts
- Audit logs

---

### Persona 2: Test Developer (Mike)
**Role:** Senior QA Automation Engineer  
**Goals:**
- Run automated tests on-demand
- Debug test failures quickly
- Manage multiple test projects
- Integrate with CI/CD pipelines

**Pain Points:**
- Slow debugging process when tests fail
- Complex setup for new test suites
- Limited visibility into test history

**Key Features:**
- Project creation and management
- Real-time test execution monitoring
- AI-powered failure analysis
- Historical test run data

---

### Persona 3: Stakeholder/Viewer (Jennifer)
**Role:** Product Manager  
**Goals:**
- Monitor testing health across products
- Understand quality trends
- View test results without technical setup

**Pain Points:**
- Doesn't understand technical logs
- Needs simple pass/fail visibility
- Wants to see trends over time

**Key Features:**
- Read-only dashboard access
- Test run summaries (no raw logs)
- Pass/fail rate visualizations
- Email notifications for critical failures

---

## 4. User Stories

### Epic 1: Organization Management

**Story 1.1: Create Organization**
```
As a new user
I want to sign up and automatically create my organization
So that I can start using the platform immediately
```
**Acceptance Criteria:**
- Sign up with email/password creates user + organization
- Organization slug auto-generated from email domain
- First user becomes admin automatically
- Default free plan assigned
- Welcome email sent with getting started guide

---

**Story 1.2: Invite Team Members**
```
As an organization admin
I want to invite colleagues to my organization
So that my team can collaborate on testing
```
**Acceptance Criteria:**
- Invite via email address
- Select role (Admin/Developer/Viewer) during invite
- Invitation email with secure signup link
- Invitee can accept and join organization
- Admin can revoke pending invitations
- Admin can view list of all organization members

---

**Story 1.3: Manage User Roles**
```
As an organization admin
I want to change user roles
So that I can control access levels as the team evolves
```
**Acceptance Criteria:**
- Change any user's role (except own admin role if sole admin)
- Role change takes effect immediately
- User sees updated permissions in next request
- Audit log records role changes

---

### Epic 2: Authentication & Authorization

**Story 2.1: User Login**
```
As a registered user
I want to log in with my email and password
So that I can access my organization's testing platform
```
**Acceptance Criteria:**
- Login form with email/password fields
- JWT token issued on successful login (24h expiry)
- Token contains userId, organizationId, role
- Invalid credentials return clear error message
- Token stored in httpOnly cookie + localStorage
- Auto-redirect to dashboard after login

---

**Story 2.2: Protected Routes**
```
As the system
I want all API endpoints to require valid authentication
So that unauthorized users cannot access organization data
```
**Acceptance Criteria:**
- All routes except /auth/* require JWT token
- Expired tokens return 401 Unauthorized
- Missing tokens return 401 Unauthorized
- Invalid tokens return 401 Unauthorized
- All queries auto-filtered by organizationId from token

---

**Story 2.3: Permission Checks**
```
As the system
I want to enforce role-based permissions on actions
So that users can only perform authorized operations
```
**Acceptance Criteria:**
- Viewer role: Read-only access to test runs
- Developer role: Create projects, trigger tests, view runs
- Admin role: All developer permissions + user management + billing
- 403 Forbidden returned when insufficient permissions
- Clear error message indicating required permission

---

### Epic 3: Data Isolation

**Story 3.1: Organization-Scoped Queries**
```
As the system
I want all database queries to be scoped to the user's organization
So that organizations cannot see each other's data
```
**Acceptance Criteria:**
- Every collection has organizationId field
- All find() queries include organizationId filter
- All insert() operations include organizationId
- All update/delete operations verify organizationId match
- Attempting to access other org's data returns 404 Not Found (not 403)

---

**Story 3.2: Container Isolation**
```
As the system
I want test containers to be isolated per organization
So that organizations cannot interfere with each other's tests
```
**Acceptance Criteria:**
- Container names include organizationId
- Containers tagged with organizationId label
- Resource limits enforced per organization
- Logs stored with organizationId
- Failed container cleanup includes organizationId filter

---

### Epic 4: Billing & Plans

**Story 4.1: Stripe Integration**
```
As an organization admin
I want to subscribe to a paid plan via credit card
So that I can unlock higher usage limits
```
**Acceptance Criteria:**
- Stripe Checkout integration for plan upgrades
- Free plan: 100 test runs/month, 1 project, 3 users
- Team plan ($99/mo): 1000 runs/month, 10 projects, 20 users
- Enterprise plan ($499/mo): Unlimited runs, projects, users
- Subscription status synced with Stripe webhooks
- Billing portal link for managing subscription

---

**Story 4.2: Usage Tracking**
```
As the system
I want to track usage per organization
So that I can enforce plan limits and bill accurately
```
**Acceptance Criteria:**
- Test run counter incremented on each execution
- Compute minutes calculated from container runtime
- Storage usage calculated from logs + artifacts
- Monthly usage resets on billing cycle date
- Usage visible in organization settings dashboard
- Email alerts at 80% and 100% of plan limits

---

**Story 4.3: Plan Enforcement**
```
As the system
I want to enforce plan limits
So that organizations cannot exceed their subscribed usage
```
**Acceptance Criteria:**
- Free plan: Block new test runs after 100/month
- Free plan: Block creating >1 project
- Free plan: Block inviting >3 users
- Paid plans: Soft limits with overage charges (Enterprise only)
- Clear error messages when limits reached
- Upgrade CTA shown when hitting limits

---

### Epic 5: Dashboard Updates

**Story 5.1: Login Screen**
```
As a new user
I want a clean login/signup page
So that I can easily create an account or sign in
```
**Acceptance Criteria:**
- Modern, professional design matching brand
- Email/password fields with validation
- "Sign Up" and "Log In" tabs
- "Forgot Password" link (sends reset email)
- Social login buttons (Google, GitHub) - future
- Mobile responsive

---

**Story 5.2: Organization Context in Header**
```
As a logged-in user
I want to see my organization name and role in the header
So that I always know which organization I'm viewing
```
**Acceptance Criteria:**
- Organization name/logo displayed top-left
- User avatar/name displayed top-right
- Role badge visible (Admin/Developer/Viewer)
- Dropdown menu: Account Settings, Organization Settings, Logout
- Organization switcher (future: if user belongs to multiple orgs)

---

**Story 5.3: Projects Scoped to Organization**
```
As a user
I want to see only my organization's projects
So that I'm not confused by other organizations' data
```
**Acceptance Criteria:**
- Projects list filtered by user's organizationId
- "Create Project" button visible only to Developer/Admin
- Project cards show project-specific metadata
- No indication other organizations exist (for security)

---

### Epic 6: API Enhancements

**Story 6.1: Organization Management APIs**
```
As a developer
I want REST APIs to manage organizations
So that I can integrate organization management into other tools
```
**Acceptance Criteria:**
```
GET    /api/organizations/me           # Get current organization
PATCH  /api/organizations/me           # Update organization settings
GET    /api/organizations/me/users     # List users
POST   /api/organizations/me/users/invite  # Invite user
DELETE /api/organizations/me/users/:id # Remove user
PATCH  /api/organizations/me/users/:id # Update user role
```

---

**Story 6.2: Authentication APIs**
```
As a developer
I want REST APIs for authentication
So that I can build login flows
```
**Acceptance Criteria:**
```
POST   /api/auth/signup        # Create account + organization
POST   /api/auth/login         # Login and get JWT
POST   /api/auth/logout        # Invalidate token
POST   /api/auth/refresh       # Refresh expired token
POST   /api/auth/forgot-password  # Send reset email
POST   /api/auth/reset-password   # Reset with token
GET    /api/auth/me            # Get current user info
```

---

## 5. Technical Architecture

### High-Level Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
│  (Multiple Organizations: Company A, Company B, Company C)       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Dashboard (React)                             │
│  - Login/Signup UI                                               │
│  - Organization Context Provider                                 │
│  - JWT Token Management                                          │
│  - Projects List (filtered by org)                              │
│  - Real-time Logs (Socket.io)                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTPS + JWT Token
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                Producer Service (Fastify)                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Authentication Middleware                                 │  │
│  │  - Verify JWT token                                       │  │
│  │  - Extract organizationId from token                      │  │
│  │  - Inject into request context                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Authorization Middleware                                  │  │
│  │  - Check user role permissions                            │  │
│  │  - Enforce plan limits (usage quotas)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  API Routes (all scoped by organizationId):                     │
│   - /api/auth/*          (signup, login, etc)                   │
│   - /api/organizations/* (manage org)                           │
│   - /api/projects/*      (CRUD projects)                        │
│   - /api/runs/*          (trigger tests, view runs)             │
│                                                                   │
└───┬──────────────────────┬────────────────────┬─────────────────┘
    │                      │                    │
    │                      │                    │
    ▼                      ▼                    ▼
┌──────────┐       ┌──────────────┐    ┌──────────────┐
│ MongoDB  │       │  RabbitMQ    │    │   Stripe     │
│          │       │              │    │   (Billing)  │
│ Multi-   │       │ Test Queue   │    │              │
│ Tenant   │       │ (with orgId) │    │              │
│ Data     │       │              │    │              │
└──────────┘       └──────┬───────┘    └──────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │  Worker Service      │
                │                      │
                │  - Pull jobs         │
                │  - Check orgId       │
                │  - Run containers    │
                │  - Store logs (orgId)│
                │  - AI Analysis       │
                │  - Update MongoDB    │
                └──────────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   Docker     │
                   │              │
                   │ Containers   │
                   │ (labeled     │
                   │  with orgId) │
                   └──────────────┘
```

### Component Changes

#### Producer Service
**New Modules:**
- `auth/` - JWT generation, password hashing, token verification
- `organizations/` - Organization CRUD, user management
- `billing/` - Stripe integration, usage tracking, plan enforcement
- `middleware/` - Authentication, authorization, rate limiting

**Modified Modules:**
- `projects/` - Add organizationId to all operations
- `runs/` - Add organizationId to all operations
- `database/` - Add organizationId filters to all queries

---

#### Worker Service
**Changes:**
- Read organizationId from RabbitMQ job payload
- Include organizationId in container labels/names
- Store organizationId in all MongoDB writes
- Rate limit containers per organization

---

#### Dashboard
**New Pages:**
- `/login` - Login/signup form
- `/signup` - Organization creation flow
- `/org/settings` - Organization settings page
- `/org/users` - User management page
- `/org/billing` - Billing and usage page

**Modified Components:**
- `Header` - Add organization name, user menu
- `ProjectsList` - Filter by organizationId (automatic via API)
- `TestRuns` - Filter by organizationId (automatic via API)

---

## 6. Data Models

### MongoDB Collections

#### `organizations`
```typescript
{
  _id: ObjectId("org_abc123"),
  name: "Acme Corporation",
  slug: "acme-corp",               // URL-friendly, unique
  domain: "acme.com",               // Email domain for auto-join
  plan: "team",                     // free | team | enterprise
  limits: {
    maxProjects: 10,
    maxTestRuns: 1000,              // per billing cycle
    maxUsers: 20,
    maxConcurrentRuns: 5
  },
  usage: {
    currentPeriodStart: "2026-01-01T00:00:00Z",
    currentPeriodEnd: "2026-02-01T00:00:00Z",
    testRuns: 487,
    computeMinutes: 1250.5,
    storageGB: 2.3
  },
  billing: {
    stripeCustomerId: "cus_stripe_xyz",
    stripeSubscriptionId: "sub_stripe_abc",
    status: "active",               // active | past_due | canceled | trialing
    currentPeriodStart: "2026-01-01T00:00:00Z",
    currentPeriodEnd: "2026-02-01T00:00:00Z",
    cancelAtPeriodEnd: false
  },
  settings: {
    logo: "https://cdn.example.com/logo.png",
    allowAutoJoin: true,            // Allow users with same email domain to auto-join
    defaultUserRole: "viewer"       // Role for auto-joined users
  },
  createdAt: "2025-12-15T10:30:00Z",
  updatedAt: "2026-01-20T14:22:00Z"
}
```

**Indexes:**
- `{ slug: 1 }` - unique
- `{ domain: 1 }` - for auto-join lookup
- `{ "billing.stripeCustomerId": 1 }` - for webhook processing

---

#### `users`
```typescript
{
  _id: ObjectId("user_def456"),
  email: "sarah@acme.com",
  name: "Sarah Johnson",
  hashedPassword: "$2b$10$...",    // bcrypt hash
  organizationId: ObjectId("org_abc123"),
  role: "admin",                    // admin | developer | viewer
  status: "active",                 // active | invited | suspended
  invitedBy: ObjectId("user_xyz"),  // User who invited this user (if applicable)
  lastLoginAt: "2026-01-28T09:15:00Z",
  createdAt: "2026-01-10T11:00:00Z",
  updatedAt: "2026-01-28T09:15:00Z"
}
```

**Indexes:**
- `{ email: 1 }` - unique
- `{ organizationId: 1 }` - frequent filtering
- `{ organizationId: 1, role: 1 }` - role-based queries

---

#### `projects`
```typescript
{
  _id: ObjectId("proj_ghi789"),
  organizationId: ObjectId("org_abc123"),  // 🔑 Key addition
  name: "Web E2E Tests",
  description: "Playwright tests for main web app",
  dockerImage: "acme/web-tests:latest",
  environments: {
    staging: {
      BASE_URL: "https://staging.acme.com",
      API_KEY: "${STAGING_API_KEY}"
    },
    production: {
      BASE_URL: "https://acme.com",
      API_KEY: "${PROD_API_KEY}"
    }
  },
  testFolders: ["tests/e2e", "tests/smoke"],
  reportFormat: "allure",
  createdBy: ObjectId("user_def456"),
  createdAt: "2026-01-15T14:00:00Z",
  updatedAt: "2026-01-22T10:30:00Z"
}
```

**Indexes:**
- `{ organizationId: 1 }` - **Critical for data isolation**
- `{ organizationId: 1, name: 1 }` - unique per org
- `{ organizationId: 1, createdAt: -1 }` - recent projects

---

#### `test_runs`
```typescript
{
  _id: ObjectId("run_jkl012"),
  organizationId: ObjectId("org_abc123"),  // 🔑 Key addition
  projectId: ObjectId("proj_ghi789"),
  environment: "staging",
  status: "passed",                 // queued | running | passed | failed | error
  triggeredBy: ObjectId("user_def456"),
  triggeredAt: "2026-01-28T11:45:00Z",
  startedAt: "2026-01-28T11:45:23Z",
  completedAt: "2026-01-28T11:52:10Z",
  duration: 407,                    // seconds
  containerName: "org_abc123_proj_ghi789_1738065923",
  logs: [...],                      // Array of log entries
  aiAnalysis: {
    analyzed: true,
    summary: "Tests passed successfully",
    failureReason: null,
    suggestedFix: null
  },
  artifacts: {
    allureReport: "https://s3.../allure-report.zip",
    screenshots: ["https://s3.../screenshot1.png"]
  },
  metadata: {
    testCommand: "npm run test:e2e",
    testFolder: "tests/e2e",
    totalTests: 45,
    passedTests: 45,
    failedTests: 0,
    skippedTests: 0
  }
}
```

**Indexes:**
- `{ organizationId: 1 }` - **Critical for data isolation**
- `{ organizationId: 1, projectId: 1, createdAt: -1 }` - project history
- `{ organizationId: 1, status: 1 }` - filter by status
- `{ organizationId: 1, triggeredBy: 1 }` - user activity

---

#### `invitations` (new collection)
```typescript
{
  _id: ObjectId("inv_mno345"),
  organizationId: ObjectId("org_abc123"),
  email: "mike@acme.com",
  role: "developer",
  token: "secure_random_token_xyz",  // For signup link
  status: "pending",                 // pending | accepted | expired | revoked
  invitedBy: ObjectId("user_def456"),
  expiresAt: "2026-02-04T11:00:00Z",  // 7 days from creation
  createdAt: "2026-01-28T11:00:00Z",
  acceptedAt: null
}
```

**Indexes:**
- `{ token: 1 }` - unique, for signup link lookup
- `{ organizationId: 1, status: 1 }` - pending invitations list
- `{ email: 1, organizationId: 1 }` - prevent duplicate invites

---

#### `usage_records` (new collection)
```typescript
{
  _id: ObjectId("usage_pqr678"),
  organizationId: ObjectId("org_abc123"),
  period: "2026-01",                // YYYY-MM format
  testRuns: 487,
  computeMinutes: 1250.5,
  storageGB: 2.3,
  breakdown: [
    {
      projectId: ObjectId("proj_ghi789"),
      projectName: "Web E2E Tests",
      testRuns: 320,
      computeMinutes: 850.2
    },
    {
      projectId: ObjectId("proj_xyz"),
      projectName: "API Tests",
      testRuns: 167,
      computeMinutes: 400.3
    }
  ],
  createdAt: "2026-02-01T00:00:00Z",  // Created at end of billing period
}
```

**Indexes:**
- `{ organizationId: 1, period: -1 }` - historical usage lookup

---

### Data Migration Script

Since existing data has no organizationId, we need a migration:

```javascript
// migration_add_organization_id.js

const DEFAULT_ORG_ID = ObjectId("org_default_migration");

// Create default organization for existing data
db.organizations.insertOne({
  _id: DEFAULT_ORG_ID,
  name: "Default Organization (Migrated)",
  slug: "default-org",
  plan: "enterprise",  // Give them full access
  createdAt: new Date(),
  updatedAt: new Date()
});

// Add organizationId to all projects
db.projects.updateMany(
  { organizationId: { $exists: false } },
  { $set: { organizationId: DEFAULT_ORG_ID } }
);

// Add organizationId to all test_runs
db.test_runs.updateMany(
  { organizationId: { $exists: false } },
  { $set: { organizationId: DEFAULT_ORG_ID } }
);

// Create indexes
db.projects.createIndex({ organizationId: 1 });
db.test_runs.createIndex({ organizationId: 1 });
db.users.createIndex({ organizationId: 1 });
```

---

## 7. API Specifications

### Authentication Endpoints

#### `POST /api/auth/signup`
**Purpose:** Create new user account and organization  
**Authentication:** None (public endpoint)

**Request:**
```json
{
  "email": "sarah@acme.com",
  "password": "SecurePass123!",
  "name": "Sarah Johnson",
  "organizationName": "Acme Corporation"
}
```

**Response (201 Created):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_def456",
    "email": "sarah@acme.com",
    "name": "Sarah Johnson",
    "role": "admin",
    "organizationId": "org_abc123",
    "organizationName": "Acme Corporation"
  }
}
```

**Business Logic:**
1. Validate email format and password strength (min 8 chars, 1 number, 1 special char)
2. Check if email already exists → 409 Conflict
3. Extract domain from email (e.g., "acme.com")
4. Check if organization with this domain exists:
   - If yes and `allowAutoJoin = true` → Join existing org with `defaultUserRole`
   - If no → Create new organization with slug = domain-based
5. Hash password with bcrypt (10 rounds)
6. Create user with role = "admin" (if new org) or `defaultUserRole` (if joining)
7. Generate JWT token (24h expiry)
8. Send welcome email
9. Return token + user info

**Error Responses:**
- `400 Bad Request` - Invalid input (weak password, invalid email)
- `409 Conflict` - Email already exists

---

#### `POST /api/auth/login`
**Purpose:** Authenticate user and get JWT token  
**Authentication:** None (public endpoint)

**Request:**
```json
{
  "email": "sarah@acme.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_def456",
    "email": "sarah@acme.com",
    "name": "Sarah Johnson",
    "role": "admin",
    "organizationId": "org_abc123",
    "organizationName": "Acme Corporation"
  }
}
```

**Business Logic:**
1. Find user by email
2. Compare password with bcrypt
3. Check user status (must be "active", not "suspended")
4. Check organization billing status (warn if past_due)
5. Generate JWT token with payload: `{ userId, organizationId, role }`
6. Update `lastLoginAt` timestamp
7. Return token + user info

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account suspended

---

#### `GET /api/auth/me`
**Purpose:** Get current user info from token  
**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "id": "user_def456",
  "email": "sarah@acme.com",
  "name": "Sarah Johnson",
  "role": "admin",
  "organization": {
    "id": "org_abc123",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "plan": "team"
  }
}
```

**Business Logic:**
1. Extract userId from JWT token
2. Fetch user from database
3. Fetch organization details
4. Return combined info

---

### Organization Endpoints

#### `GET /api/organizations/me`
**Purpose:** Get current organization details  
**Authentication:** Required (JWT)  
**Authorization:** Any role

**Response (200 OK):**
```json
{
  "id": "org_abc123",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "plan": "team",
  "limits": {
    "maxProjects": 10,
    "maxTestRuns": 1000,
    "maxUsers": 20,
    "maxConcurrentRuns": 5
  },
  "usage": {
    "currentPeriod": "2026-01-01 to 2026-02-01",
    "testRuns": 487,
    "testRunsLimit": 1000,
    "testRunsPercentage": 48.7,
    "computeMinutes": 1250.5,
    "storageGB": 2.3
  },
  "billing": {
    "status": "active",
    "nextBillingDate": "2026-02-01"
  },
  "memberCount": 8,
  "projectCount": 5
}
```

---

#### `PATCH /api/organizations/me`
**Purpose:** Update organization settings  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Request:**
```json
{
  "name": "Acme Corp Inc.",
  "settings": {
    "allowAutoJoin": false,
    "defaultUserRole": "viewer"
  }
}
```

**Response (200 OK):**
```json
{
  "id": "org_abc123",
  "name": "Acme Corp Inc.",
  "settings": {
    "allowAutoJoin": false,
    "defaultUserRole": "viewer"
  }
}
```

---

#### `GET /api/organizations/me/users`
**Purpose:** List all users in organization  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "user_def456",
      "email": "sarah@acme.com",
      "name": "Sarah Johnson",
      "role": "admin",
      "status": "active",
      "lastLoginAt": "2026-01-28T09:15:00Z",
      "createdAt": "2026-01-10T11:00:00Z"
    },
    {
      "id": "user_xyz789",
      "email": "mike@acme.com",
      "name": "Mike Chen",
      "role": "developer",
      "status": "active",
      "lastLoginAt": "2026-01-27T14:30:00Z",
      "createdAt": "2026-01-15T09:00:00Z"
    }
  ],
  "total": 2
}
```

---

#### `POST /api/organizations/me/users/invite`
**Purpose:** Invite user to organization  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Request:**
```json
{
  "email": "jennifer@acme.com",
  "role": "viewer",
  "sendEmail": true
}
```

**Response (201 Created):**
```json
{
  "invitation": {
    "id": "inv_mno345",
    "email": "jennifer@acme.com",
    "role": "viewer",
    "status": "pending",
    "expiresAt": "2026-02-04T11:00:00Z",
    "inviteLink": "https://automation.keinar.com/signup?token=secure_random_token_xyz"
  }
}
```

**Business Logic:**
1. Check if user with email already exists in organization → 409 Conflict
2. Check if pending invitation already exists → 409 Conflict
3. Check if organization has reached user limit → 403 Forbidden
4. Generate secure random token (crypto.randomBytes)
5. Create invitation record with 7-day expiry
6. If `sendEmail = true`, send invitation email with signup link
7. Return invitation details

---

#### `PATCH /api/organizations/me/users/:userId`
**Purpose:** Update user role  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Request:**
```json
{
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "id": "user_xyz789",
  "email": "mike@acme.com",
  "name": "Mike Chen",
  "role": "admin",
  "updatedAt": "2026-01-28T12:00:00Z"
}
```

**Business Logic:**
1. Verify target user belongs to same organization
2. Prevent self-demotion if requester is sole admin
3. Update user role
4. Invalidate existing JWT tokens (force re-login)
5. Log action in audit log

---

#### `DELETE /api/organizations/me/users/:userId`
**Purpose:** Remove user from organization  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Response (204 No Content)**

**Business Logic:**
1. Verify target user belongs to same organization
2. Prevent self-removal if requester is sole admin
3. Check if user has created projects/runs (optionally reassign ownership)
4. Delete user record
5. Invalidate JWT tokens
6. Send email notification to removed user

---

### Project Endpoints (Modified)

#### `GET /api/projects`
**Purpose:** List all projects in organization  
**Authentication:** Required (JWT)  
**Authorization:** Any role

**Response (200 OK):**
```json
{
  "projects": [
    {
      "id": "proj_ghi789",
      "name": "Web E2E Tests",
      "description": "Playwright tests for main web app",
      "dockerImage": "acme/web-tests:latest",
      "lastRunAt": "2026-01-28T11:45:00Z",
      "lastRunStatus": "passed",
      "createdAt": "2026-01-15T14:00:00Z"
    }
  ],
  "total": 1
}
```

**Business Logic:**
1. Extract organizationId from JWT token
2. Query: `db.projects.find({ organizationId })`
3. Join with latest test_run for each project
4. Return results

**Key Change:** All queries automatically filtered by organizationId

---

#### `POST /api/projects`
**Purpose:** Create new project  
**Authentication:** Required (JWT)  
**Authorization:** Developer or Admin

**Request:**
```json
{
  "name": "API Integration Tests",
  "description": "Pytest suite for backend APIs",
  "dockerImage": "acme/api-tests:latest",
  "environments": {
    "staging": {
      "BASE_URL": "https://api-staging.acme.com",
      "API_KEY": "${STAGING_API_KEY}"
    }
  }
}
```

**Response (201 Created):**
```json
{
  "id": "proj_new123",
  "organizationId": "org_abc123",
  "name": "API Integration Tests",
  "createdBy": "user_def456",
  "createdAt": "2026-01-28T12:30:00Z"
}
```

**Business Logic:**
1. Check organization project limit (based on plan)
2. Verify Docker image exists (optional validation)
3. Insert with organizationId from JWT token
4. Return created project

**Key Change:** organizationId automatically injected from token

---

### Test Run Endpoints (Modified)

#### `GET /api/runs`
**Purpose:** List test runs with filters  
**Authentication:** Required (JWT)  
**Authorization:** Any role

**Query Parameters:**
- `projectId` (optional) - Filter by project
- `status` (optional) - Filter by status (passed/failed/running)
- `limit` (optional, default 50) - Number of results
- `offset` (optional, default 0) - Pagination offset

**Response (200 OK):**
```json
{
  "runs": [
    {
      "id": "run_jkl012",
      "projectId": "proj_ghi789",
      "projectName": "Web E2E Tests",
      "environment": "staging",
      "status": "passed",
      "duration": 407,
      "triggeredBy": "Sarah Johnson",
      "triggeredAt": "2026-01-28T11:45:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

**Business Logic:**
1. Extract organizationId from JWT token
2. Build query with organizationId filter + optional filters
3. Join with projects and users collections
4. Return paginated results

**Key Change:** organizationId filter automatically applied

---

#### `POST /api/runs/trigger`
**Purpose:** Trigger new test run  
**Authentication:** Required (JWT)  
**Authorization:** Developer or Admin

**Request:**
```json
{
  "projectId": "proj_ghi789",
  "environment": "staging",
  "testFolder": "tests/smoke"
}
```

**Response (201 Created):**
```json
{
  "id": "run_new456",
  "status": "queued",
  "queuePosition": 3,
  "estimatedStartTime": "2026-01-28T12:35:00Z"
}
```

**Business Logic:**
1. Extract organizationId from JWT token
2. Verify project belongs to organization
3. Check organization test run limit (daily/monthly)
4. Check concurrent run limit
5. Create test_run record with status = "queued"
6. Publish job to RabbitMQ with organizationId included
7. Return run info

**Key Change:** 
- organizationId included in RabbitMQ message
- Plan limits enforced before queuing

---

### Billing Endpoints (New)

#### `GET /api/billing/plans`
**Purpose:** Get available subscription plans  
**Authentication:** None (public)

**Response (200 OK):**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "interval": "month",
      "features": {
        "maxProjects": 1,
        "maxTestRuns": 100,
        "maxUsers": 3,
        "maxConcurrentRuns": 1,
        "aiAnalysis": true,
        "support": "Community"
      }
    },
    {
      "id": "team",
      "name": "Team",
      "price": 99,
      "interval": "month",
      "stripePriceId": "price_team_monthly",
      "features": {
        "maxProjects": 10,
        "maxTestRuns": 1000,
        "maxUsers": 20,
        "maxConcurrentRuns": 5,
        "aiAnalysis": true,
        "support": "Email"
      }
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "price": 499,
      "interval": "month",
      "stripePriceId": "price_enterprise_monthly",
      "features": {
        "maxProjects": "Unlimited",
        "maxTestRuns": "Unlimited",
        "maxUsers": "Unlimited",
        "maxConcurrentRuns": 20,
        "aiAnalysis": true,
        "support": "Priority 24/7",
        "sso": true,
        "auditLogs": true
      }
    }
  ]
}
```

---

#### `POST /api/billing/checkout`
**Purpose:** Create Stripe Checkout session for plan upgrade  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Request:**
```json
{
  "planId": "team",
  "interval": "month"
}
```

**Response (200 OK):**
```json
{
  "sessionId": "cs_stripe_session_xyz",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_stripe_session_xyz"
}
```

**Business Logic:**
1. Verify requester is admin
2. Get organization details
3. Create Stripe Customer if doesn't exist
4. Create Stripe Checkout Session with:
   - success_url = `https://automation.keinar.com/billing/success`
   - cancel_url = `https://automation.keinar.com/billing`
   - customer = stripeCustomerId
   - line_items = selected plan
5. Return checkout URL for frontend redirect

---

#### `GET /api/billing/portal`
**Purpose:** Get Stripe Customer Portal link for managing subscription  
**Authentication:** Required (JWT)  
**Authorization:** Admin only

**Response (200 OK):**
```json
{
  "portalUrl": "https://billing.stripe.com/p/session/xyz"
}
```

**Business Logic:**
1. Verify requester is admin
2. Get organization's stripeCustomerId
3. Create Stripe Portal Session
4. Return portal URL

---

#### `POST /api/webhooks/stripe`
**Purpose:** Handle Stripe webhook events  
**Authentication:** Stripe signature verification

**Handled Events:**
- `customer.subscription.created` - Activate subscription
- `customer.subscription.updated` - Update plan/status
- `customer.subscription.deleted` - Cancel subscription
- `invoice.payment_succeeded` - Reset usage counters
- `invoice.payment_failed` - Mark as past_due

**Business Logic:**
1. Verify webhook signature
2. Parse event type
3. Update organization record in MongoDB
4. Send email notifications if needed
5. Return 200 OK to Stripe

---

## 8. UI/UX Changes

### New Pages

#### `/login`
**Purpose:** User login page

**Layout:**
```
┌────────────────────────────────────────────┐
│                                            │
│           [AAC Logo]                       │
│                                            │
│       Agnostic Automation Center           │
│                                            │
│   ┌──────────────────────────────────┐    │
│   │  Email                           │    │
│   │  [___________________________]   │    │
│   │                                  │    │
│   │  Password                        │    │
│   │  [___________________________]   │    │
│   │                                  │    │
│   │  [x] Remember me                 │    │
│   │                                  │    │
│   │        [Log In] button           │    │
│   │                                  │    │
│   │  Forgot password? | Sign Up      │    │
│   └──────────────────────────────────┘    │
│                                            │
└────────────────────────────────────────────┘
```

**Features:**
- Email + password fields with validation
- "Remember me" checkbox (30-day token expiry)
- "Forgot password" link → email reset flow
- "Sign Up" link → `/signup`
- Error messages below form
- Loading state during API call

---

#### `/signup`
**Purpose:** New user registration + organization creation

**Layout:**
```
┌────────────────────────────────────────────┐
│                                            │
│       Create Your Account                  │
│                                            │
│   ┌──────────────────────────────────┐    │
│   │  Step 1: Your Details            │    │
│   │                                  │    │
│   │  Full Name                       │    │
│   │  [___________________________]   │    │
│   │                                  │    │
│   │  Email                           │    │
│   │  [___________________________]   │    │
│   │                                  │    │
│   │  Password                        │    │
│   │  [___________________________]   │    │
│   │  [Password strength meter]       │    │
│   │                                  │    │
│   │  Confirm Password                │    │
│   │  [___________________________]   │    │
│   │                                  │    │
│   │  ────────────────────────────    │    │
│   │                                  │    │
│   │  Step 2: Organization            │    │
│   │                                  │    │
│   │  Organization Name               │    │
│   │  [___________________________]   │    │
│   │                                  │    │
│   │  We detected your email domain:  │    │
│   │  acme.com                        │    │
│   │                                  │    │
│   │  ○ Create new organization       │    │
│   │  ○ Request to join "Acme Corp"   │    │
│   │     (requires admin approval)    │    │
│   │                                  │    │
│   │  [x] I agree to Terms of Service │    │
│   │                                  │    │
│   │       [Create Account]           │    │
│   │                                  │    │
│   │  Already have an account? Log In │    │
│   └──────────────────────────────────┘    │
│                                            │
└────────────────────────────────────────────┘
```

**Features:**
- Two-step form (personal → organization)
- Password strength indicator
- Auto-detect if domain has existing org
- Option to create new or join existing
- Terms of Service checkbox
- Real-time validation

---

#### `/dashboard` (Modified Header)

**Before (Current):**
```
┌────────────────────────────────────────────────────┐
│  [AAC Logo]                         [No Auth]     │
└────────────────────────────────────────────────────┘
```

**After (Multi-Tenant):**
```
┌──────────────────────────────────────────────────────────────┐
│  [AAC Logo]  |  Acme Corporation                              │
│                                                                │
│                      [Sarah Johnson] [Admin] [Avatar] [v]     │
│                                                                │
│                      Dropdown Menu:                            │
│                      ├─ Account Settings                       │
│                      ├─ Organization Settings                  │
│                      ├─ Billing & Usage                        │
│                      ├─ Help & Docs                            │
│                      └─ Logout                                 │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Organization name/logo prominently displayed
- User info with role badge
- Dropdown menu with settings and logout
- Visual separation between org and user context

---

#### `/org/settings`
**Purpose:** Organization settings management

**Tabs:**
1. **General**
   - Organization name
   - Logo upload
   - Slug (URL identifier)
   
2. **Members**
   - List of users with roles
   - Invite new members button
   - Role change dropdown (admin only)
   - Remove member button (admin only)
   
3. **Security**
   - Auto-join settings (allow users with domain to join)
   - Default role for auto-joined users
   - Two-factor authentication (future)
   
4. **Integrations**
   - API keys (future)
   - Webhooks (future)
   - SSO configuration (Enterprise only)

---

#### `/org/billing`
**Purpose:** Billing and usage dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Current Plan: Team                   [Manage Billing]  │
│  $99/month • Renews Feb 1, 2026                         │
│                                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Usage This Month (Jan 1 - Feb 1)                 │ │
│  │                                                    │ │
│  │  Test Runs:    ████████░░░░░  487 / 1,000 (48%)  │ │
│  │  Compute:      ██████████░░░  1,250 / 2,000 min  │ │
│  │  Storage:      ███░░░░░░░░░░  2.3 / 10 GB        │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Available Plans                                   │ │
│  │                                                    │ │
│  │  [Free]         [Team - Current]    [Enterprise]  │ │
│  │  $0/mo          $99/mo              $499/mo       │ │
│  │  • 100 runs     • 1,000 runs        • Unlimited   │ │
│  │  • 1 project    • 10 projects       • Unlimited   │ │
│  │  • 3 users      • 20 users          • Unlimited   │ │
│  │                                     • SSO          │ │
│  │                 [Downgrade]         [Upgrade]      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Billing History:                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Jan 1, 2026   Team Plan        $99.00   [Receipt] │ │
│  │ Dec 1, 2025   Team Plan        $99.00   [Receipt] │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Current plan overview with renewal date
- Real-time usage meters with percentages
- Usage alerts when approaching limits (80%, 100%)
- Plan comparison cards with upgrade/downgrade buttons
- Billing history with PDF receipts
- "Manage Billing" button → Stripe Customer Portal

---

### Modified Components

#### `ProjectsList`
**Changes:**
- Automatically filtered by organizationId (via API)
- "Create Project" button visible only to Developer/Admin roles
- Project cards show creator name and last run info

#### `TestRunsTable`
**Changes:**
- Automatically filtered by organizationId (via API)
- "Trigger Test" button visible only to Developer/Admin roles
- Triggered by user shown with avatar/name

#### `LiveLogs` (Socket.io)
**Changes:**
- Socket connection authenticated with JWT token
- Rooms namespaced by organizationId: `org_${organizationId}_run_${runId}`
- Server validates user belongs to organization before joining room

---

## 9. Security & Compliance

### Data Isolation Strategy

**Principle:** Zero Trust - Assume every request could be malicious

#### Database Query Enforcement
```typescript
// ❌ NEVER do this
const projects = await db.collection('projects').find({}).toArray();

// ✅ ALWAYS do this
const projects = await db.collection('projects').find({
  organizationId: request.user.organizationId
}).toArray();
```

**Implementation:**
- Create a wrapper around MongoDB client that auto-injects organizationId
- Code review checklist item: "All queries include organizationId filter"
- Automated tests: Attempt to access other org's data should always return empty/404

---

#### API Response Sanitization
**Never leak existence of other organizations:**

```typescript
// ❌ BAD: Reveals other org's data exists
if (project.organizationId !== user.organizationId) {
  return reply.code(403).send({ error: 'Access denied to this project' });
}

// ✅ GOOD: Looks like data doesn't exist
const project = await db.projects.findOne({ 
  _id: projectId, 
  organizationId: user.organizationId 
});
if (!project) {
  return reply.code(404).send({ error: 'Project not found' });
}
```

---

#### Container Isolation
**Prevent cross-organization container interference:**

```typescript
// Container naming: org_${organizationId}_proj_${projectId}_${timestamp}
const containerName = `org_${organizationId}_proj_${projectId}_${Date.now()}`;

// Docker labels for cleanup
const labels = {
  'aac.organization': organizationId,
  'aac.project': projectId,
  'aac.run': runId
};

// Resource limits per organization
const limits = getOrgResourceLimits(organizationId);
await docker.run(image, [], {
  name: containerName,
  Labels: labels,
  HostConfig: {
    Memory: limits.memory,      // e.g., 2GB
    NanoCpus: limits.cpu,       // e.g., 2 CPUs
    NetworkMode: 'bridge',      // Isolated network
  }
});
```

**Cleanup Process:**
```typescript
// Daily cleanup job - ONLY delete org's own containers
await docker.listContainers({ 
  all: true, 
  filters: { label: [`aac.organization=${organizationId}`] }
}).then(containers => {
  containers.forEach(async (container) => {
    if (isOlderThan(container, '24 hours')) {
      await docker.getContainer(container.Id).remove({ force: true });
    }
  });
});
```

---

### Authentication Security

#### Password Storage
- **Algorithm:** bcrypt with 10 rounds
- **Minimum Requirements:** 8 characters, 1 number, 1 special character
- **Password Reset:** Time-limited tokens (1 hour expiry)

#### JWT Tokens
**Payload:**
```json
{
  "userId": "user_def456",
  "organizationId": "org_abc123",
  "role": "admin",
  "iat": 1738065600,
  "exp": 1738152000
}
```

**Storage:**
- **httpOnly Cookie:** Prevents XSS attacks, 7-day expiry with "Remember me"
- **localStorage:** 24-hour expiry for API calls
- **Token Rotation:** Refresh tokens before expiry (silent refresh)

**Revocation:**
- On password change: Increment user.tokenVersion, invalidate old tokens
- On role change: Force re-login
- On user removal: Delete user record (automatic invalidation)

---

#### Rate Limiting
**Per-Organization Limits:**

```typescript
// API rate limits (per minute)
const RATE_LIMITS = {
  free: {
    api_calls: 100,
    test_triggers: 10
  },
  team: {
    api_calls: 500,
    test_triggers: 50
  },
  enterprise: {
    api_calls: 2000,
    test_triggers: 200
  }
};

// Redis-based implementation
const key = `rate_limit:${organizationId}:${endpoint}:${minute}`;
const count = await redis.incr(key);
await redis.expire(key, 60);

if (count > limit) {
  return reply.code(429).send({ 
    error: 'Rate limit exceeded',
    retryAfter: 60 - (Date.now() % 60000) / 1000 
  });
}
```

---

### Compliance Considerations

#### GDPR Compliance
**Data Subject Rights:**
1. **Right to Access:** Export all organization data via API
2. **Right to Erasure:** Delete organization + all associated data
3. **Data Portability:** JSON export of all data
4. **Privacy Policy:** Clearly state what data is collected and why

**Implementation:**
```typescript
// DELETE /api/organizations/me (admin only)
// Cascading delete:
// 1. Delete all test_runs
// 2. Delete all projects
// 3. Delete all users
// 4. Delete organization
// 5. Cancel Stripe subscription
// 6. Delete all stored artifacts (S3)
```

---

#### SOC 2 Considerations (Future)
**For Enterprise Customers:**
- Audit logs: All user actions logged with timestamp, IP, user
- Encryption: At-rest (MongoDB encryption) + in-transit (TLS 1.3)
- Access controls: Role-based permissions, MFA for admins
- Incident response: Automated alerting for security events
- Penetration testing: Annual third-party security audits

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Core multi-tenancy without breaking existing functionality

#### Week 1: Data Model + Migration
- [ ] Create MongoDB schemas (organizations, users, invitations)
- [ ] Write data migration script (add organizationId to existing data)
- [ ] Create database indexes
- [ ] Test migration on staging data

#### Week 2: Authentication
- [ ] Implement JWT generation and verification
- [ ] Create `/api/auth/signup` endpoint
- [ ] Create `/api/auth/login` endpoint
- [ ] Create authentication middleware
- [ ] Add organizationId extraction from token
- [ ] Test: Multiple organizations cannot access each other's data

**Deliverable:** Working authentication with organization isolation

---

### Phase 2: Dashboard Integration (Week 3)
**Goal:** Frontend login flow and organization context

- [ ] Create Login page (`/login`)
- [ ] Create Signup page (`/signup`)
- [ ] Implement JWT storage (cookie + localStorage)
- [ ] Create OrganizationContext provider
- [ ] Update Dashboard header with org name + user menu
- [ ] Add authentication guards to all routes
- [ ] Update all API calls to include JWT token
- [ ] Test: Full login → dashboard → logout flow

**Deliverable:** Functional UI with multi-tenant support

---

### Phase 3: User Management (Week 4)
**Goal:** Invite users and manage roles

- [ ] Create Organization Settings page (`/org/settings`)
- [ ] Implement user list view
- [ ] Create invitation flow (send email, accept link)
- [ ] Implement role change functionality
- [ ] Implement user removal
- [ ] Add RBAC middleware for protected actions
- [ ] Test: Admin can invite, change roles, remove users

**Deliverable:** Complete user management system

---

### Phase 4: Billing Integration (Week 5-6)
**Goal:** Stripe integration and plan management

#### Week 5: Stripe Setup
- [ ] Create Stripe account and products
- [ ] Implement Stripe Checkout integration
- [ ] Create `/api/billing/checkout` endpoint
- [ ] Create success/cancel pages
- [ ] Implement webhook handler (`/api/webhooks/stripe`)
- [ ] Test subscription creation flow

#### Week 6: Usage Tracking
- [ ] Implement usage tracking (test runs, compute, storage)
- [ ] Create usage records collection
- [ ] Add plan limit enforcement (before test trigger)
- [ ] Create Billing page (`/org/billing`)
- [ ] Add usage meters and plan comparison
- [ ] Implement Stripe Customer Portal link
- [ ] Test: Upgrade, downgrade, usage limits

**Deliverable:** Fully functional billing system

---

### Phase 5: Polish & Security (Week 7-8)
**Goal:** Production-ready hardening

#### Week 7: Security
- [ ] Comprehensive security audit
- [ ] Add input validation with Joi schemas
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Security headers (Helmet.js)
- [ ] Penetration testing
- [ ] Fix all vulnerabilities

#### Week 8: Polish
- [ ] Error message improvements
- [ ] Loading states and skeletons
- [ ] Email templates (welcome, invitation, password reset)
- [ ] Help documentation
- [ ] Onboarding tour (optional)
- [ ] Performance optimization
- [ ] Final QA testing

**Deliverable:** Production-ready SaaS platform

---

## 11. Testing Strategy

### Unit Tests
**Coverage Target:** >80%

**Producer Service:**
- [ ] Auth: Signup, login, JWT generation, password hashing
- [ ] Organizations: CRUD operations, user management
- [ ] Projects: CRUD with organizationId filtering
- [ ] Runs: Trigger with plan limit enforcement
- [ ] Billing: Stripe webhook handling, usage tracking

**Worker Service:**
- [ ] Job processing with organizationId validation
- [ ] Container orchestration with resource limits
- [ ] Log storage with organizationId

**Dashboard:**
- [ ] Authentication flows (login, signup, logout)
- [ ] Organization context provider
- [ ] Protected route guards
- [ ] API client with JWT token injection

---

### Integration Tests
**Scenarios:**

1. **Full Signup → Test Run Flow**
   - Signup with new email
   - Create organization
   - Create project
   - Trigger test run
   - View results
   - Verify organizationId throughout

2. **Multi-Organization Isolation**
   - Create Org A and Org B
   - Create projects in each
   - Attempt to access Org A's project from Org B
   - Verify 404 (not 403)

3. **Role-Based Permissions**
   - Create admin, developer, viewer users
   - Attempt various actions
   - Verify permissions enforced correctly

4. **Billing Flow**
   - Start with free plan
   - Trigger 100 tests (hit limit)
   - Upgrade to team plan
   - Verify limit increased
   - Trigger more tests successfully

---

### Load Testing
**Tool:** k6 or Artillery

**Scenarios:**
1. **Concurrent Users:** 100 users across 10 organizations
2. **Test Run Throughput:** 50 simultaneous test runs
3. **API Performance:** 1000 req/sec mixed endpoints
4. **Database Queries:** Verify indexes are effective

**Acceptance Criteria:**
- API response time p95 < 200ms
- Dashboard loads < 2 seconds
- Worker can handle 20 concurrent containers

---

### Security Testing

**Automated:**
- [ ] npm audit (dependency vulnerabilities)
- [ ] OWASP ZAP scan (XSS, SQL injection, etc.)
- [ ] JWT token manipulation attempts
- [ ] CSRF attack simulation

**Manual:**
- [ ] Attempt to access other org's data via API
- [ ] Attempt to bypass authentication
- [ ] Attempt to escalate privileges (viewer → admin)
- [ ] Attempt container escape attacks

---

## 12. Deployment Plan

### Pre-Deployment Checklist

**Infrastructure:**
- [ ] MongoDB backups enabled (daily, 7-day retention)
- [ ] Redis persistence configured
- [ ] Docker registry secured (private images)
- [ ] SSL certificates valid (automation.keinar.com)
- [ ] Environment variables configured for prod
- [ ] Stripe webhooks configured with correct URL

**Database:**
- [ ] Run migration script on production MongoDB
- [ ] Verify all collections have organizationId
- [ ] Verify indexes created
- [ ] Test rollback procedure (restore from backup)

**Services:**
- [ ] Producer service health check endpoint: `/health`
- [ ] Worker service heartbeat mechanism
- [ ] Dashboard build optimized (minified, CDN)
- [ ] Monitoring: Prometheus + Grafana dashboards
- [ ] Error tracking: Sentry integration
- [ ] Log aggregation: CloudWatch or ELK stack

---

### Deployment Steps (Zero-Downtime)

**Step 1: Deploy Producer Service (v2.0)**
```bash
# Build new Docker image
docker build -t automation-producer:v2.0 ./apps/producer

# Tag and push
docker tag automation-producer:v2.0 registry.example.com/automation-producer:v2.0
docker push registry.example.com/automation-producer:v2.0

# Update docker-compose.prod.yml
services:
  producer:
    image: registry.example.com/automation-producer:v2.0
    
# Rolling update (blue-green deployment)
docker-compose -f docker-compose.prod.yml up -d --no-deps producer
```

**Step 2: Run Migration**
```bash
# Backup database first
mongodump --uri="mongodb://prod-host" --out=backup-$(date +%Y%m%d)

# Run migration
docker exec -it mongo-container mongo automation_db < migration_add_organization_id.js

# Verify migration
docker exec -it mongo-container mongo automation_db --eval "db.projects.find({organizationId: {$exists: true}}).count()"
```

**Step 3: Deploy Worker Service (v2.0)**
```bash
# Build and push
docker build -t automation-worker:v2.0 ./apps/worker
docker push registry.example.com/automation-worker:v2.0

# Update and deploy
docker-compose -f docker-compose.prod.yml up -d --no-deps worker
```

**Step 4: Deploy Dashboard (v2.0)**
```bash
# Build optimized production bundle
cd apps/dashboard
npm run build

# Upload to CDN (CloudFront, Netlify, etc.)
aws s3 sync dist/ s3://automation-dashboard-prod/

# Invalidate CDN cache
aws cloudfront create-invalidation --distribution-id ABC123 --paths "/*"
```

**Step 5: Smoke Tests**
```bash
# Test authentication
curl -X POST https://automation.keinar.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test project listing (should be empty for new user)
curl https://automation.keinar.com/api/projects \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Test dashboard loads
curl -I https://automation.keinar.com/
```

---

### Rollback Plan

**If deployment fails:**

1. **Revert Producer/Worker Services:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d producer worker
```

2. **Restore Database (if migration failed):**
```bash
mongorestore --uri="mongodb://prod-host" --drop backup-<date>/
```

3. **Revert Dashboard:**
```bash
# Rollback to previous S3 bucket version
aws s3 sync s3://automation-dashboard-prod-backup/ s3://automation-dashboard-prod/
```

---

### Post-Deployment Monitoring

**Monitor for 24 hours:**
- Error rates (Sentry dashboard)
- API response times (Prometheus)
- Database query performance (MongoDB Atlas)
- Container orchestration errors (Docker logs)
- Authentication failures (check JWT errors)
- Billing webhooks (Stripe dashboard)

**Success Criteria:**
- Error rate < 0.1%
- P95 API latency < 500ms
- Zero data isolation breaches
- All existing functionality works

---

## 13. Success Criteria

### Technical Metrics
✅ **100% Data Isolation:** Zero cross-organization data leaks in testing  
✅ **API Performance:** P95 response time < 300ms  
✅ **Uptime:** 99.9% availability  
✅ **Security:** Pass OWASP ZAP scan with 0 high-severity vulnerabilities  
✅ **Test Coverage:** >80% unit test coverage  

### Business Metrics
✅ **User Adoption:** 10 organizations signed up within 3 months  
✅ **Conversion Rate:** 30% of free users upgrade to paid plans  
✅ **Time to Value:** Users can run first test within 10 minutes of signup  
✅ **Revenue:** $1000 MRR within 6 months  

### User Experience Metrics
✅ **Onboarding Completion:** 80% of signups complete first test run  
✅ **Dashboard Load Time:** < 2 seconds  
✅ **Error Recovery:** Clear error messages with actionable steps  
✅ **Support Tickets:** < 5% of users require support for onboarding  

---

## 14. Risks & Mitigations

### Risk 1: Data Isolation Breach
**Impact:** CRITICAL - Cross-organization data exposure  
**Likelihood:** Medium (coding errors, logic bugs)

**Mitigation:**
- Automated testing: Attempt to access other org's data in every test
- Code review checklist: "Every query includes organizationId filter"
- Database middleware: Auto-inject organizationId filter
- Security audit: Third-party penetration testing

---

### Risk 2: Billing Integration Failures
**Impact:** HIGH - Revenue loss, poor user experience  
**Likelihood:** Medium (Stripe webhooks, sync issues)

**Mitigation:**
- Stripe webhook signature verification (prevent spoofing)
- Idempotency keys (prevent duplicate charges)
- Manual retry mechanism for failed webhooks
- Admin dashboard to manually adjust subscriptions
- Alert system for webhook failures (PagerDuty)

---

### Risk 3: Migration Data Loss
**Impact:** CRITICAL - Lose existing test runs and projects  
**Likelihood:** Low (with proper backups)

**Mitigation:**
- Full database backup before migration
- Test migration on staging environment first
- Dry-run migration (read-only) to verify script
- Rollback procedure documented and tested
- Keep backup for 30 days post-migration

---

### Risk 4: Performance Degradation
**Impact:** MEDIUM - Slow API, unhappy users  
**Likelihood:** Medium (additional queries, JWT verification overhead)

**Mitigation:**
- Database indexes on organizationId (all collections)
- Redis caching for frequently accessed data
- JWT caching (in-memory LRU cache)
- Load testing before deployment
- Performance monitoring (Prometheus, Grafana)

---

### Risk 5: Complex Onboarding
**Impact:** MEDIUM - Low adoption rate  
**Likelihood:** High (multi-step signup, Docker image creation)

**Mitigation:**
- Simplify signup flow (defer organization name to post-signup)
- CLI tool for easy Docker image creation
- Video tutorials and documentation
- In-app onboarding tour (tooltips, progress tracker)
- Free trial with full features (no credit card required)

---

## 15. Open Questions

### Technical
- [ ] **Q1:** Should we support users belonging to multiple organizations?
  - **Recommendation:** Not in MVP, add in Phase 2 (organization switcher)
  
- [ ] **Q2:** How long should we retain test run logs?
  - **Recommendation:** 30 days for free, 90 days for team, unlimited for enterprise
  
- [ ] **Q3:** Should we allow custom Docker registries (private repos)?
  - **Recommendation:** Yes for enterprise plan, add in Phase 2

### Business
- [ ] **Q4:** Should free plan have credit card requirement?
  - **Recommendation:** No - maximize signups, add upgrade friction later
  
- [ ] **Q5:** What's the upgrade incentive timeline?
  - **Recommendation:** Show upgrade CTA after 50% of free limit used
  
- [ ] **Q6:** Annual billing discount?
  - **Recommendation:** 20% discount for annual plans (Team: $950/yr, Enterprise: $4800/yr)

### Product
- [ ] **Q7:** Should we show public "Featured Tests" marketplace?
  - **Recommendation:** Not in MVP, interesting future feature
  
- [ ] **Q8:** Integration with GitHub/GitLab for auto-trigger on push?
  - **Recommendation:** Yes, high priority for Phase 2

---

## Appendix A: Example User Flows

### Flow 1: New Organization Signup
```
1. User: Visit automation.keinar.com
2. System: Redirect to /login (unauthenticated)
3. User: Click "Sign Up"
4. System: Show /signup form
5. User: Enter email (sarah@acme.com), password, name
6. System: Detect domain "acme.com" - no existing org found
7. User: Enter organization name "Acme Corporation"
8. User: Check "I agree to Terms"
9. User: Click "Create Account"
10. System: 
    - Create organization (plan: free)
    - Create user (role: admin)
    - Generate JWT token
    - Send welcome email
11. System: Redirect to /dashboard
12. User: See empty dashboard with "Create First Project" prompt
```

---

### Flow 2: Invite Team Member
```
1. Admin: Navigate to /org/settings → Members tab
2. Admin: Click "Invite Member"
3. System: Show modal with email + role fields
4. Admin: Enter mike@acme.com, select "Developer"
5. Admin: Click "Send Invitation"
6. System:
    - Check if email exists → No
    - Check if pending invite exists → No
    - Check user limit → 1/3 (free plan)
    - Generate secure token
    - Create invitation record (expires in 7 days)
    - Send email to mike@acme.com with signup link
7. Mike: Receives email, clicks link
8. System: Show /signup?token=xyz with pre-filled email (read-only)
9. Mike: Enter name, password
10. Mike: Click "Join Acme Corporation"
11. System:
     - Verify token is valid and not expired
     - Create user with organizationId = Acme's org
     - Mark invitation as accepted
     - Generate JWT token
12. System: Redirect Mike to /dashboard
13. Mike: See projects created by Sarah (read-only)
```

---

### Flow 3: Upgrade to Paid Plan
```
1. Admin: Trigger 100th test run on free plan
2. System: Return 403 error "Test run limit reached for free plan"
3. Dashboard: Show modal "You've reached your monthly limit! Upgrade to Team plan for 1000 runs/month"
4. Admin: Click "Upgrade Now"
5. System: Redirect to /org/billing
6. Admin: Click "Upgrade" on Team plan card
7. System: Call POST /api/billing/checkout
8. System: Redirect to Stripe Checkout
9. Admin: Enter credit card info on Stripe
10. Admin: Complete payment
11. Stripe: Redirect to automation.keinar.com/billing/success
12. System: 
     - Receive Stripe webhook (subscription.created)
     - Update organization plan to "team"
     - Update limits (1000 runs/month)
13. Dashboard: Show success message "Upgraded to Team plan!"
14. Admin: Navigate back to projects
15. Admin: Click "Trigger Test" → Success (limit now 1000)
```

---

## Appendix B: Tech Stack Summary

### Backend
- **Language:** Node.js (TypeScript)
- **Framework:** Fastify
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Database:** MongoDB 6.0+
- **Caching:** Redis 7.0+
- **Message Queue:** RabbitMQ 3.12+
- **Container Orchestration:** Docker
- **Payment Processing:** Stripe

### Frontend
- **Language:** TypeScript
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** React Context + useState
- **Real-time:** Socket.io-client
- **HTTP Client:** Fetch API

### DevOps
- **CI/CD:** GitHub Actions
- **Deployment:** Docker Compose (production)
- **Monitoring:** Prometheus + Grafana
- **Error Tracking:** Sentry
- **Logging:** Winston + CloudWatch

### External Services
- **Email:** SendGrid or AWS SES
- **File Storage:** AWS S3 (test artifacts)
- **CDN:** CloudFront or Cloudflare
- **DNS:** Route 53 or Cloudflare

---

## Appendix C: Environment Variables

### Producer Service
```bash
# Server
NODE_ENV=production
PORT=3000
API_URL=https://automation.keinar.com

# Database
MONGODB_URI=mongodb://user:pass@host:27017/automation_db
REDIS_URL=redis://host:6379

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672

# JWT
JWT_SECRET=<strong-random-secret-64-chars>
JWT_EXPIRY=24h

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_FREE_PRICE_ID=price_free
STRIPE_TEAM_PRICE_ID=price_team_monthly
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_monthly

# Email
SENDGRID_API_KEY=SG....
FROM_EMAIL=noreply@automation.keinar.com

# AI (Gemini)
GEMINI_API_KEY=AIza...

# AWS (for S3 artifacts)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=aac-test-artifacts
AWS_REGION=us-east-1
```

### Worker Service
```bash
# Same as Producer + Docker socket
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_REGISTRY=registry.example.com
```

### Dashboard
```bash
VITE_API_URL=https://automation.keinar.com
VITE_SOCKET_URL=wss://automation.keinar.com
```

---

## Appendix D: Cost Estimate (Monthly)

### Infrastructure (Oracle Cloud / AWS)
- **Compute (VMs):** $50 - $100 (2 instances: Producer + Worker)
- **MongoDB Atlas (M10 cluster):** $60
- **Redis Cloud (1GB):** $20
- **RabbitMQ CloudAMQP (Lemur plan):** $20
- **S3 Storage (100GB):** $2
- **CloudFront CDN:** $10
- **Email (SendGrid):** $15 (1000 emails/day)
- **Monitoring (Grafana Cloud):** $0 (free tier)
- **Sentry (Error tracking):** $0 (free tier, <10k events)

**Total Infrastructure: ~$180/month**

### Stripe Fees (assuming $2000 MRR)
- **Transaction fees:** 2.9% + $0.30 = ~$60

**Total with 20 paying customers: $2000 revenue - $180 - $60 = $1760 profit**

---

## Conclusion

This PRD provides a comprehensive roadmap to transform the Agnostic Automation Center from a single-tenant platform into a production-ready multi-tenant SaaS product.

**Key Takeaways:**
- **Scope:** 8 weeks, 5 phases (Foundation → Dashboard → Users → Billing → Polish)
- **Investment:** ~$60-90 with Claude Pro (estimated $20-30/month for 2-3 months)
- **Risk Mitigation:** Emphasis on data isolation, security, and rollback procedures
- **Business Opportunity:** Recurring revenue model with clear path to profitability

**Next Steps:**
1. Review and approve this PRD
2. Set up development environment
3. Begin Phase 1: Foundation (Data Model + Authentication)
4. Use Claude Code to accelerate development (est. 50%+ time savings)

---

**Document Version Control:**
- v1.0 (2026-01-28): Initial draft - comprehensive multi-tenant transformation plan

**Approvals:**
- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Security Lead
- [ ] Business Stakeholder
