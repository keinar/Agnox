# Phase 2 Implementation Plan
## User Management UI + Organization Settings

**Version:** 1.0  
**Date:** January 30, 2026  
**Estimated Duration:** 5-7 days  
**Prerequisites:** Phase 1 Complete ✅

---

## Executive Summary

Phase 2 focuses on building the **User Management UI** and **Organization Settings** features. This includes inviting team members, managing roles, viewing organization details, and implementing the security enhancements recommended in the Phase 1 Security Audit.

### Goals
- ✅ Invite team members to organization
- ✅ Manage user roles (Admin/Developer/Viewer)
- ✅ Organization settings page
- ✅ AI Analysis toggle (per Security Audit recommendation)
- ✅ Rate limiting enhancement (Redis-based)
- ✅ Usage tracking foundation

---

## Phase 2 Sprints Overview

| Sprint | Focus | Duration | Tasks |
|--------|-------|----------|-------|
| Sprint 1 | Backend - Invitation System | 1-2 days | 6 tasks |
| Sprint 2 | Backend - Organization Settings | 1 day | 4 tasks |
| Sprint 3 | Frontend - Settings UI | 2 days | 8 tasks |
| Sprint 4 | Security Enhancements | 1 day | 4 tasks |
| Sprint 5 | Testing & Polish | 1 day | 4 tasks |

**Total: 26 tasks across 5 sprints**

---

## Sprint 1: Backend - Invitation System

### Task 1.1: Create Invitation Routes

**File:** `apps/producer-service/src/routes/invitations.ts`

```typescript
// Routes to implement:
POST   /api/invitations          // Send invitation (Admin only)
GET    /api/invitations          // List pending invitations (Admin only)
DELETE /api/invitations/:id      // Revoke invitation (Admin only)
POST   /api/invitations/accept   // Accept invitation (Public - with token)
GET    /api/invitations/validate/:token  // Validate token (Public)
```

**Acceptance Criteria:**
- [ ] Admin can invite by email + role
- [ ] Invitation creates secure random token (32 bytes hex)
- [ ] Invitation expires in 7 days
- [ ] Duplicate email check (existing user or pending invite)
- [ ] Plan limit check (free: 3 users, team: 20, enterprise: unlimited)
- [ ] Email validation

---

### Task 1.2: Create Invitation Email Template

**File:** `apps/producer-service/src/utils/email.ts`

```typescript
interface InvitationEmailParams {
  recipientEmail: string;
  recipientName?: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteToken: string;
  expiresAt: Date;
}

function generateInvitationEmail(params: InvitationEmailParams): string {
  // Return HTML email template
}
```

**Note:** For Phase 2 MVP, log the invitation link to console. Email integration (SendGrid) can be Phase 3.

---

### Task 1.3: Update Signup Route for Invitations

**File:** `apps/producer-service/src/routes/auth.ts`

**Changes:**
- Accept optional `inviteToken` in signup request
- If token provided:
  - Validate token exists and not expired
  - Create user with invitation's organizationId and role
  - Mark invitation as accepted
  - Skip organization creation
- If no token:
  - Current flow (create new org)

```typescript
// Updated signup payload
interface SignupRequest {
  email: string;
  password: string;
  name: string;
  organizationName?: string;  // Required only if no inviteToken
  inviteToken?: string;       // Optional - for invited users
}
```

---

### Task 1.4: Create Users Management Routes

**File:** `apps/producer-service/src/routes/users.ts`

```typescript
// Routes to implement:
GET    /api/users              // List org users (Admin only)
GET    /api/users/:id          // Get user details (Admin only)
PATCH  /api/users/:id/role     // Change user role (Admin only)
DELETE /api/users/:id          // Remove user from org (Admin only)
```

**Business Rules:**
- Cannot change own role if sole admin
- Cannot delete self
- Deleted user's data remains (executions still accessible)
- Returns 404 for users in other organizations

---

### Task 1.5: Add User Count to Organization

**File:** `apps/producer-service/src/routes/auth.ts` (update /me endpoint)

**Changes:**
- Add `userCount` to organization info in `/api/auth/me` response
- Add `userLimit` based on plan

```typescript
// Updated response
{
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    limits: { ... },
    userCount: number;      // NEW
    userLimit: number;      // NEW (from limits.maxUsers)
  }
}
```

---

### Task 1.6: Create Invitation Types

**File:** `packages/shared-types/src/index.ts`

```typescript
// Add these interfaces:
export interface IInvitationRequest {
  email: string;
  role: 'admin' | 'developer' | 'viewer';
}

export interface IInvitationResponse {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface IUserListResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
}
```

---

## Sprint 2: Backend - Organization Settings

### Task 2.1: Create Organization Routes

**File:** `apps/producer-service/src/routes/organization.ts`

```typescript
// Routes to implement:
GET    /api/organization              // Get org details (All roles)
PATCH  /api/organization              // Update org settings (Admin only)
GET    /api/organization/usage        // Get usage stats (All roles)
```

**Organization Settings:**
```typescript
interface OrganizationSettings {
  name: string;
  aiAnalysisEnabled: boolean;  // NEW - per Security Audit
  // Future: webhookUrl, slackIntegration, etc.
}
```

---

### Task 2.2: Add AI Analysis Toggle

**Per Security Audit Recommendation (Section 11)**

**Backend Changes:**
1. Add `aiAnalysisEnabled` field to organizations collection (default: true)
2. Worker checks this setting before calling Gemini API
3. If disabled, skip AI analysis and set `analysis = "AI analysis disabled by organization policy"`

**File:** `apps/worker-service/src/worker.ts`

```typescript
// Before AI analysis:
const org = await organizationsCollection.findOne({ _id: organizationId });
if (org?.aiAnalysisEnabled && (finalStatus === 'FAILED' || finalStatus === 'UNSTABLE')) {
  analysis = await analyzeTestFailure(logsBuffer, image);
} else {
  analysis = org?.aiAnalysisEnabled === false 
    ? 'AI analysis disabled by organization policy.'
    : '';
}
```

---

### Task 2.3: Create Usage Tracking

**File:** `apps/producer-service/src/routes/organization.ts`

**Usage Stats Response:**
```typescript
interface UsageStats {
  currentPeriod: {
    startDate: string;
    endDate: string;
  };
  testRuns: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  users: {
    active: number;
    limit: number;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
  };
}
```

**Implementation:**
- Count executions in current month with `organizationId`
- Count active users in organization
- Calculate storage from reports directory (or estimate)

---

### Task 2.4: Add Audit Logging (Foundation)

**File:** `apps/producer-service/src/utils/audit.ts`

```typescript
interface AuditLogEntry {
  organizationId: string;
  userId: string;
  action: string;  // 'user.invited', 'user.role_changed', 'org.settings_updated', etc.
  targetType?: string;  // 'user', 'invitation', 'organization'
  targetId?: string;
  details?: Record<string, any>;
  ip?: string;
  timestamp: Date;
}

async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  // Insert into audit_logs collection
}
```

**Events to Log:**
- User invited
- Invitation revoked
- User role changed
- User removed
- Organization settings updated
- AI analysis toggle changed

---

## Sprint 3: Frontend - Settings UI

### Task 3.1: Create Settings Page Layout

**File:** `apps/dashboard-client/src/pages/Settings.tsx`

```tsx
// Tab-based settings page
- Tab: Members (default)
- Tab: Organization
- Tab: Security
- Tab: Usage (read-only)
```

---

### Task 3.2: Create Members Tab Component

**File:** `apps/dashboard-client/src/components/settings/MembersTab.tsx`

**Features:**
- List of current members (name, email, role, status, joined date)
- "Invite Member" button (Admin only)
- Role dropdown to change roles (Admin only)
- "Remove" button (Admin only)
- Pending invitations section
- Revoke invitation button

---

### Task 3.3: Create Invite Modal Component

**File:** `apps/dashboard-client/src/components/settings/InviteModal.tsx`

**Fields:**
- Email input
- Role dropdown (Admin/Developer/Viewer)
- Send Invitation button

**Validation:**
- Email format
- Check if already member or invited
- Check user limit

---

### Task 3.4: Create Organization Tab Component

**File:** `apps/dashboard-client/src/components/settings/OrganizationTab.tsx`

**Features:**
- Organization name (editable, Admin only)
- Organization slug (read-only)
- Plan badge
- Created date

---

### Task 3.5: Create Security Tab Component

**File:** `apps/dashboard-client/src/components/settings/SecurityTab.tsx`

**Features:**
- AI Analysis toggle with explanation
- Warning when disabling: "Disabling AI analysis means you won't receive AI-powered failure insights."
- Data processing disclosure text

---

### Task 3.6: Create Usage Tab Component

**File:** `apps/dashboard-client/src/components/settings/UsageTab.tsx`

**Features:**
- Test runs usage bar (X/100 for free plan)
- Users count (X/3 for free plan)
- Storage usage (if available)
- Billing period dates
- "Upgrade Plan" button if approaching limit

---

### Task 3.7: Add Settings Link to Header

**File:** `apps/dashboard-client/src/components/Dashboard.tsx`

**Changes:**
- Add "Settings" icon/link in header (Admin only, or all roles with limited access)
- Use Settings icon from lucide-react

---

### Task 3.8: Create Settings API Hooks

**File:** `apps/dashboard-client/src/hooks/useSettings.ts`

```typescript
// Hooks to implement:
export function useOrganization(): { org, loading, error, updateOrg }
export function useUsers(): { users, loading, error, updateRole, removeUser }
export function useInvitations(): { invitations, loading, sendInvite, revokeInvite }
export function useUsage(): { usage, loading, error }
```

---

## Sprint 4: Security Enhancements

### Task 4.1: Implement Redis-Based Rate Limiting

**Per Security Audit Recommendation**

**File:** `apps/producer-service/src/middleware/rateLimiter.ts`

```typescript
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis key prefix
}

// Configurations:
const authRateLimit = { windowMs: 60000, maxRequests: 5, keyPrefix: 'rl:auth:' };
const apiRateLimit = { windowMs: 60000, maxRequests: 100, keyPrefix: 'rl:api:' };
```

**Apply to:**
- `/api/auth/login` - 5 requests/minute per IP
- `/api/auth/signup` - 3 requests/minute per IP
- `/api/invitations/accept` - 5 requests/minute per IP
- General API - 100 requests/minute per user

---

### Task 4.2: Add Security Headers

**Per Security Audit Recommendation**

**File:** `apps/producer-service/src/index.ts`

```typescript
app.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP can be added later based on needs
});
```

---

### Task 4.3: Implement Login Attempt Tracking

**File:** `apps/producer-service/src/routes/auth.ts`

```typescript
// Track failed login attempts in Redis
const failedAttempts = await redis.incr(`login_failures:${email}`);
await redis.expire(`login_failures:${email}`, 900); // 15 min window

if (failedAttempts >= 5) {
  // Log security event
  app.log.warn({ event: 'BRUTE_FORCE_DETECTED', email, ip: request.ip });
  
  // Optionally: temporary lockout
  return reply.code(429).send({
    error: 'Too many failed attempts',
    message: 'Please try again in 15 minutes'
  });
}

// On successful login, clear failed attempts
await redis.del(`login_failures:${email}`);
```

---

### Task 4.4: Add CORS Production Configuration

**File:** `apps/producer-service/src/index.ts`

```typescript
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? ['https://automation.keinar.com', 'https://www.automation.keinar.com']
  : ['http://localhost:8080', 'http://localhost:5173'];

app.register(cors, {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});
```

---

## Sprint 5: Testing & Polish

### Task 5.1: Integration Tests for Invitations

**File:** `tests/invitations.test.ts`

**Test Cases:**
- [ ] Admin can send invitation
- [ ] Non-admin cannot send invitation
- [ ] Duplicate email rejected
- [ ] User limit enforced
- [ ] Invitation token works for signup
- [ ] Expired token rejected
- [ ] Revoked invitation cannot be accepted

---

### Task 5.2: Integration Tests for User Management

**File:** `tests/users.test.ts`

**Test Cases:**
- [ ] Admin can list users
- [ ] Admin can change user role
- [ ] Cannot change own role if sole admin
- [ ] Non-admin cannot change roles
- [ ] Removed user cannot access organization

---

### Task 5.3: E2E Test - Full Invitation Flow

**Test Flow:**
1. Admin creates organization (signup)
2. Admin invites developer@test.com
3. Developer accepts invitation
4. Developer can view executions
5. Developer cannot invite others
6. Admin changes developer to viewer
7. Viewer has read-only access

---

### Task 5.4: Update Documentation

**Files to Update:**
- `README.md` - Add user management section
- `docs/implementation/phase-2-summary.md` - Create summary
- `.env.example` - Add any new environment variables
- `SECURITY-AUDIT-PHASE-1.md` - Mark implemented recommendations

---

## File Structure After Phase 2

```
apps/producer-service/src/
├── routes/
│   ├── auth.ts           # Updated for invite tokens
│   ├── invitations.ts    # NEW
│   ├── users.ts          # NEW
│   └── organization.ts   # NEW
├── middleware/
│   ├── auth.ts
│   └── rateLimiter.ts    # NEW
└── utils/
    ├── jwt.ts
    ├── password.ts
    ├── email.ts          # NEW (template only)
    └── audit.ts          # NEW

apps/dashboard-client/src/
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   └── Settings.tsx      # NEW
├── components/
│   ├── Dashboard.tsx     # Updated
│   └── settings/         # NEW folder
│       ├── MembersTab.tsx
│       ├── OrganizationTab.tsx
│       ├── SecurityTab.tsx
│       ├── UsageTab.tsx
│       └── InviteModal.tsx
└── hooks/
    ├── useAuth.ts
    ├── useExecutions.ts
    └── useSettings.ts    # NEW
```

---

## Database Changes

### New Collection: `audit_logs`

```javascript
{
  _id: ObjectId,
  organizationId: string,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: object,
  ip: string,
  timestamp: Date
}

// Indexes:
{ organizationId: 1, timestamp: -1 }
{ action: 1, timestamp: -1 }
```

### Updated Collection: `organizations`

```javascript
// Add field:
{
  aiAnalysisEnabled: boolean  // default: true
}
```

---

## Environment Variables (New)

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# Email (Phase 3, but placeholder)
SENDGRID_API_KEY=
FROM_EMAIL=noreply@automation.keinar.com

# Allowed Origins (Production)
ALLOWED_ORIGINS=https://automation.keinar.com
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Invitation token guessed | Use 32-byte cryptographically secure random token |
| Rate limiting bypass | Use Redis with IP + user combination |
| Admin removes all admins | Prevent removing last admin |
| Invitation spam | Rate limit + email verification in Phase 3 |

---

## Success Criteria

- [ ] Admin can invite users with specific roles
- [ ] Invited users can join organization via secure link
- [ ] Admin can change user roles and remove users
- [ ] AI Analysis toggle works per organization
- [ ] Usage stats display correctly
- [ ] Rate limiting prevents brute force attacks
- [ ] All existing functionality still works
- [ ] 100% multi-tenant isolation maintained

---

## Estimated Effort

| Sprint | Estimated Time |
|--------|----------------|
| Sprint 1: Invitation Backend | 4-6 hours |
| Sprint 2: Organization Backend | 2-3 hours |
| Sprint 3: Frontend Settings | 6-8 hours |
| Sprint 4: Security Enhancements | 2-3 hours |
| Sprint 5: Testing & Polish | 3-4 hours |
| **Total** | **17-24 hours** |

---

## Next Phase Preview (Phase 3)

**Billing Integration (Stripe)**
- Subscription management
- Plan upgrades/downgrades
- Payment history
- Invoice generation
- Webhook handling

---

**Document Version Control:**
- v1.0 (2026-01-30): Initial Phase 2 plan based on PRD and Security Audit
