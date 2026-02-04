# Phase 2 Implementation Plan
## User Management UI + Organization Settings

**Version:** 2.0  
**Date:** February 4, 2026  
**Estimated Duration:** 5-7 days  
**Prerequisites:** Phase 1 Complete ✅

---

## Executive Summary

Phase 2 focuses on building the **User Management UI** and **Organization Settings** features. This includes inviting team members, managing roles, viewing organization details, and implementing the security enhancements recommended in the Phase 1 Security Audit.

### Goals
- ✅ Invite team members to organization (with multi-tenant support)
- ✅ Manage user roles (Admin/Developer/Viewer)
- ✅ Organization settings page
- ✅ AI Analysis toggle with worker-side enforcement
- ✅ Rate limiting enhancement (Redis-based, per-organization)
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

## RBAC Permissions Matrix

This matrix defines what each role can do within an organization:

| Permission | Admin | Developer | Viewer |
|------------|:-----:|:---------:|:------:|
| **User Management** |
| Invite users | ✅ | ❌ | ❌ |
| Remove users | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |
| View team members | ✅ | ✅ | ✅ |
| **Organization** |
| Update org settings | ✅ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ |
| View usage stats | ✅ | ✅ | ✅ |
| **Testing** |
| Run tests | ✅ | ✅ | ❌ |
| Edit tests | ✅ | ✅ | ❌ |
| View test results | ✅ | ✅ | ✅ |
| View reports | ✅ | ✅ | ✅ |
| Download artifacts | ✅ | ✅ | ✅ |

**Implementation Note:** All API endpoints must validate permissions using the `requireRole()` middleware based on this matrix.

---

## Sprint 1: Backend - Invitation System

### Task 1.1: Create Invitation Schema & Routes

**Database Schema:** `invitations` collection

```javascript
{
  _id: ObjectId,
  organizationId: string,
  email: string,
  role: 'admin' | 'developer' | 'viewer',
  tokenHash: string,           // SHA-256 hash of invitation token (SECURITY: never store plain token)
  status: 'pending' | 'accepted' | 'expired',  // NEW: explicit status tracking
  invitedBy: string,            // userId of inviter
  expiresAt: Date,
  createdAt: Date,
  acceptedAt?: Date             // Timestamp when invitation was accepted
}

// Indexes:
{ tokenHash: 1 }                // For token lookup
{ email: 1, organizationId: 1 } // Prevent duplicate invites
{ organizationId: 1, status: 1 } // List pending invites
{ expiresAt: 1 }                // TTL index for cleanup
```

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
- [ ] **Token is hashed with SHA-256 before storing in DB (security requirement)**
- [ ] Invitation expires in 7 days (status: 'expired')
- [ ] Duplicate email check (existing user or pending invite)
- [ ] Plan limit check (free: 3 users, team: 20, enterprise: unlimited)
- [ ] Email validation
- [ ] **Multi-tenant logic: Check if email exists in DB to determine signup vs. join flow**

**Multi-Tenant Invitation Logic:**

```typescript
// POST /api/invitations - Send Invitation
async function sendInvitation(email: string, role: string, organizationId: string) {
  // 1. Check if user already exists in the system
  const existingUser = await usersCollection.findOne({ email });
  
  // 2. Generate secure token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  // 3. Create invitation record
  await invitationsCollection.insertOne({
    organizationId,
    email,
    role,
    tokenHash,  // NEVER store plain token
    status: 'pending',
    invitedBy: currentUserId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date()
  });
  
  // 4. Send appropriate email based on user existence
  if (existingUser) {
    // User exists - send "Join Organization" email
    await sendJoinOrganizationEmail({
      recipientEmail: email,
      organizationName: org.name,
      inviterName: inviter.name,
      role,
      inviteToken: token,  // Send plain token via email
      actionType: 'join'   // This user should LOGIN then accept
    });
  } else {
    // New user - send "Create Account" email
    await sendCreateAccountEmail({
      recipientEmail: email,
      organizationName: org.name,
      inviterName: inviter.name,
      role,
      inviteToken: token,  // Send plain token via email
      actionType: 'signup' // This user should SIGNUP with token
    });
  }
}
```

**Token Security Implementation:**

```typescript
// Hashing function
function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Token validation
async function validateInvitationToken(token: string): Promise<Invitation | null> {
  const tokenHash = hashInvitationToken(token);
  const invitation = await invitationsCollection.findOne({ 
    tokenHash,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
  
  return invitation;
}
```

---

### Task 1.2: Create Invitation Email Templates

**File:** `apps/producer-service/src/utils/email.ts`

```typescript
interface InvitationEmailParams {
  recipientEmail: string;
  recipientName?: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteToken: string;  // Plain token (only sent via email, never stored)
  expiresAt: Date;
  actionType: 'signup' | 'join';  // NEW: determines email content
}

function generateInvitationEmail(params: InvitationEmailParams): string {
  const { actionType, inviteToken, organizationName, inviterName, role } = params;
  
  if (actionType === 'signup') {
    // New user - needs to create account
    return `
      <h2>You've been invited to join ${organizationName}</h2>
      <p>${inviterName} has invited you to join their organization as a ${role}.</p>
      <p><a href="${process.env.FRONTEND_URL}/signup?token=${inviteToken}">Create Account</a></p>
      <p>This invitation expires in 7 days.</p>
    `;
  } else {
    // Existing user - just needs to login and accept
    return `
      <h2>You've been invited to join ${organizationName}</h2>
      <p>${inviterName} has invited you to join their organization as a ${role}.</p>
      <p><a href="${process.env.FRONTEND_URL}/login?inviteToken=${inviteToken}">Login to Accept Invitation</a></p>
      <p>This invitation expires in 7 days.</p>
    `;
  }
}
```

**Note:** For Phase 2 MVP, log the invitation link to console. Email integration (SendGrid) can be Phase 3.

---

### Task 1.3: Update Signup Route for Invitations

**File:** `apps/producer-service/src/routes/auth.ts`

**Changes:**
- Accept optional `inviteToken` in signup request
- If token provided:
  - Validate token exists, not expired, and status is 'pending'
  - Hash the token and look up invitation
  - Create user with invitation's organizationId and role
  - Mark invitation as 'accepted' and set acceptedAt timestamp
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

// Signup logic with invitation support
async function handleSignup(request: SignupRequest) {
  if (request.inviteToken) {
    // Invited user flow
    const tokenHash = hashInvitationToken(request.inviteToken);
    const invitation = await invitationsCollection.findOne({
      tokenHash,
      email: request.email,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }
    
    // Create user with invitation's org and role
    const user = await createUser({
      email: request.email,
      password: request.password,
      name: request.name,
      organizationId: invitation.organizationId,
      role: invitation.role
    });
    
    // Mark invitation as accepted
    await invitationsCollection.updateOne(
      { _id: invitation._id },
      { 
        $set: { 
          status: 'accepted',
          acceptedAt: new Date()
        }
      }
    );
    
    return { user, organization: await getOrganization(invitation.organizationId) };
  } else {
    // Regular signup - create new organization
    // ... existing flow
  }
}
```

**Additional Route for Existing Users:**

```typescript
// POST /api/invitations/accept - For existing users who login first
async function acceptInvitation(inviteToken: string, userId: string) {
  const tokenHash = hashInvitationToken(inviteToken);
  const invitation = await invitationsCollection.findOne({
    tokenHash,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
  
  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }
  
  // Verify email matches
  const user = await usersCollection.findOne({ _id: userId });
  if (user.email !== invitation.email) {
    throw new Error('Invitation is for a different email address');
  }
  
  // Add user to organization
  await usersCollection.updateOne(
    { _id: userId },
    { 
      $set: { 
        organizationId: invitation.organizationId,
        role: invitation.role
      }
    }
  );
  
  // Mark invitation as accepted
  await invitationsCollection.updateOne(
    { _id: invitation._id },
    { 
      $set: { 
        status: 'accepted',
        acceptedAt: new Date()
      }
    }
  );
  
  return { success: true };
}
```

---

### Task 1.4: Create Users Management Routes

**File:** `apps/producer-service/src/routes/users.ts`

```typescript
// Routes to implement:
GET    /api/users              // List org users (All roles can view)
GET    /api/users/:id          // Get user details (All roles)
PATCH  /api/users/:id/role     // Change user role (Admin only)
DELETE /api/users/:id          // Remove user from org (Admin only)
```

**Business Rules:**
- Cannot change own role if sole admin
- Cannot delete self
- Cannot delete last admin
- Deleted user's data remains (executions still accessible)
- Returns 404 for users in other organizations (tenant isolation)

**Implementation:**

```typescript
// PATCH /api/users/:id/role - Change user role (Admin only)
async function changeUserRole(userId: string, newRole: string, currentUser: User) {
  // Validate requesting user is Admin
  if (currentUser.role !== 'admin') {
    throw new Error('Only admins can change user roles');
  }
  
  // Cannot change own role
  if (userId === currentUser.id) {
    throw new Error('Cannot change your own role');
  }
  
  // Check if target user is in same organization
  const targetUser = await usersCollection.findOne({ 
    _id: userId,
    organizationId: currentUser.organizationId
  });
  
  if (!targetUser) {
    throw new Error('User not found');
  }
  
  // If removing admin role, ensure at least one admin remains
  if (targetUser.role === 'admin' && newRole !== 'admin') {
    const adminCount = await usersCollection.countDocuments({
      organizationId: currentUser.organizationId,
      role: 'admin'
    });
    
    if (adminCount <= 1) {
      throw new Error('Cannot remove the last admin');
    }
  }
  
  // Update role
  await usersCollection.updateOne(
    { _id: userId },
    { $set: { role: newRole, updatedAt: new Date() } }
  );
  
  // Audit log
  await logAuditEvent({
    organizationId: currentUser.organizationId,
    userId: currentUser.id,
    action: 'user.role_changed',
    targetType: 'user',
    targetId: userId,
    details: { oldRole: targetUser.role, newRole }
  });
}
```

---

### Task 1.5: Add User Count to Organization

**File:** `apps/producer-service/src/routes/auth.ts` (update /me endpoint)

**Changes:**
- Add `userCount` to organization info in `/api/auth/me` response
- Add `userLimit` based on plan

```typescript
// Updated response
{
  user: { ... },
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    limits: { 
      maxTestRuns: number;
      maxUsers: number;
      maxStorage: number;
    },
    userCount: number;      // NEW - current active users
    userLimit: number;      // NEW - max users allowed (from limits.maxUsers)
    aiAnalysisEnabled: boolean;  // NEW
  }
}

// Implementation
const userCount = await usersCollection.countDocuments({ 
  organizationId: org._id 
});

const userLimit = org.limits?.maxUsers || (org.plan === 'free' ? 3 : org.plan === 'team' ? 20 : 999);
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
  status: 'pending' | 'accepted' | 'expired';  // NEW: explicit status
  invitedBy: string;
  invitedByName?: string;  // For UI display
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;     // NEW: acceptance timestamp
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

export interface IInvitationValidationResponse {
  valid: boolean;
  organizationName?: string;
  role?: string;
  inviterName?: string;
  userExists?: boolean;  // NEW: indicates if user should signup or login
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

**PATCH Validation:**
```typescript
// Only admins can update organization settings
app.patch('/api/organization', 
  authenticate,
  requireRole(['admin']),
  async (request, reply) => {
    const { name, aiAnalysisEnabled } = request.body;
    
    await organizationsCollection.updateOne(
      { _id: request.user.organizationId },
      { $set: { name, aiAnalysisEnabled, updatedAt: new Date() } }
    );
    
    // Audit log
    await logAuditEvent({
      organizationId: request.user.organizationId,
      userId: request.user.id,
      action: 'org.settings_updated',
      details: { name, aiAnalysisEnabled }
    });
  }
);
```

---

### Task 2.2: Add AI Analysis Toggle with Worker-Side Enforcement

**Per Security Audit Recommendation (Section 11)**

**CRITICAL SECURITY REQUIREMENT:** The AI analysis toggle must be enforced in the **Worker Service**, not just hidden in the frontend. This prevents clients from bypassing the toggle via API manipulation.

#### Backend Changes:

**1. Database Schema Update:**
```javascript
// organizations collection - add field:
{
  aiAnalysisEnabled: boolean  // default: true
}
```

**2. Worker Service Enforcement:**

**File:** `apps/worker-service/src/worker.ts`

```typescript
// BEFORE calling Gemini API, validate organization setting
async function processTestExecution(job: Job) {
  // ... existing execution logic ...
  
  // After test execution completes
  const finalStatus = determineFinalStatus(exitCode, logs);
  let analysis = '';
  
  // CRITICAL: Fetch organization settings from DB
  const org = await organizationsCollection.findOne({ 
    _id: new ObjectId(job.data.organizationId) 
  });
  
  // Enforce AI analysis toggle at worker level
  if (!org) {
    logger.warn(`Organization not found: ${job.data.organizationId}`);
    analysis = 'AI analysis unavailable - organization not found.';
  } else if (org.aiAnalysisEnabled === false) {
    logger.info(`AI analysis disabled for org: ${org.name}`);
    analysis = 'AI analysis disabled by organization policy.';
  } else if (finalStatus === 'FAILED' || finalStatus === 'UNSTABLE') {
    // Only run AI analysis if enabled AND test failed/unstable
    try {
      analysis = await analyzeTestFailure(logsBuffer, image);
    } catch (error) {
      logger.error('AI analysis failed:', error);
      analysis = 'AI analysis failed - see logs for details.';
    }
  }
  
  // Save execution with analysis result
  await saveExecution({
    ...executionData,
    analysis,
    aiAnalysisEnabled: org?.aiAnalysisEnabled ?? true  // Track setting at execution time
  });
}
```

**3. API Endpoint Update:**

**File:** `apps/producer-service/src/routes/organization.ts`

```typescript
// PATCH /api/organization - Update AI setting
app.patch('/api/organization',
  authenticate,
  requireRole(['admin']),
  async (request, reply) => {
    const { aiAnalysisEnabled } = request.body;
    
    // Validate boolean
    if (typeof aiAnalysisEnabled !== 'boolean') {
      return reply.code(400).send({ error: 'aiAnalysisEnabled must be boolean' });
    }
    
    // Update organization
    await organizationsCollection.updateOne(
      { _id: request.user.organizationId },
      { 
        $set: { 
          aiAnalysisEnabled,
          updatedAt: new Date()
        }
      }
    );
    
    // Audit log
    await logAuditEvent({
      organizationId: request.user.organizationId,
      userId: request.user.id,
      action: 'org.ai_analysis_toggled',
      details: { aiAnalysisEnabled }
    });
    
    return reply.send({ success: true });
  }
);
```

**4. Execution Schema Update:**

```javascript
// executions collection - add field to track setting at execution time:
{
  aiAnalysisEnabled: boolean  // Value at time of execution (for audit trail)
}
```

**Security Benefits:**
- ✅ Frontend cannot bypass the toggle by manipulating API requests
- ✅ Worker validates setting from authoritative source (database)
- ✅ Each execution records which policy was active (audit trail)
- ✅ No additional API calls to Gemini if disabled

---

### Task 2.3: Create Usage Tracking

**File:** `apps/producer-service/src/routes/organization.ts`

**Usage Stats Response:**
```typescript
interface UsageStats {
  currentPeriod: {
    startDate: string;  // First day of current month
    endDate: string;    // Last day of current month
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
```typescript
// GET /api/organization/usage
app.get('/api/organization/usage', 
  authenticate,
  async (request, reply) => {
    const orgId = request.user.organizationId;
    const org = await organizationsCollection.findOne({ _id: orgId });
    
    // Calculate current billing period (monthly)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Count executions in current month
    const executionCount = await executionsCollection.countDocuments({
      organizationId: orgId.toString(),
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Count active users
    const userCount = await usersCollection.countDocuments({
      organizationId: orgId.toString()
    });
    
    // Calculate storage (sum of report directory sizes or estimate)
    const storageUsed = await calculateStorageUsage(orgId);
    
    return {
      currentPeriod: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      testRuns: {
        used: executionCount,
        limit: org.limits?.maxTestRuns || 100,
        percentUsed: Math.round((executionCount / (org.limits?.maxTestRuns || 100)) * 100)
      },
      users: {
        active: userCount,
        limit: org.limits?.maxUsers || 3
      },
      storage: {
        usedBytes: storageUsed,
        limitBytes: org.limits?.maxStorage || (10 * 1024 * 1024 * 1024) // 10GB default
      }
    };
  }
);
```

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
  const auditLog = {
    ...entry,
    timestamp: new Date()
  };
  
  await auditLogsCollection.insertOne(auditLog);
  
  // Also log to console for monitoring
  logger.info('AUDIT', auditLog);
}
```

**Events to Log:**
- `user.invited` - When admin sends invitation
- `invitation.revoked` - When admin revokes invitation
- `invitation.accepted` - When user accepts invitation
- `user.role_changed` - When admin changes user role
- `user.removed` - When admin removes user from org
- `org.settings_updated` - When admin updates org settings
- `org.ai_analysis_toggled` - When admin enables/disables AI analysis

**Database Schema:**
```javascript
// audit_logs collection
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
{ userId: 1, timestamp: -1 }
```

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

// Layout structure:
export default function Settings() {
  const [activeTab, setActiveTab] = useState('members');
  
  return (
    <div className="settings-page">
      <header>
        <h1>Organization Settings</h1>
      </header>
      
      <nav className="tabs">
        <button onClick={() => setActiveTab('members')}>Members</button>
        <button onClick={() => setActiveTab('organization')}>Organization</button>
        <button onClick={() => setActiveTab('security')}>Security</button>
        <button onClick={() => setActiveTab('usage')}>Usage</button>
      </nav>
      
      <div className="tab-content">
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'usage' && <UsageTab />}
      </div>
    </div>
  );
}
```

---

### Task 3.2: Create Members Tab Component

**File:** `apps/dashboard-client/src/components/settings/MembersTab.tsx`

**Features:**
- List of current members (name, email, role, status, joined date)
- "Invite Member" button (Admin only)
- Role dropdown to change user role (Admin only)
- Remove user button (Admin only, disabled for self and last admin)
- List of pending invitations with revoke button (Admin only)

**Role-Based UI:**
```tsx
export function MembersTab() {
  const { user } = useAuth();
  const { users, loading } = useUsers();
  const { invitations } = useInvitations();
  
  const isAdmin = user.role === 'admin';
  
  return (
    <div>
      {isAdmin && (
        <button onClick={handleInvite}>Invite Member</button>
      )}
      
      <h2>Current Members</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                {isAdmin ? (
                  <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span>{u.role}</span>
                )}
              </td>
              <td>{formatDate(u.createdAt)}</td>
              {isAdmin && (
                <td>
                  <button 
                    onClick={() => handleRemove(u.id)}
                    disabled={u.id === user.id}
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {isAdmin && invitations.length > 0 && (
        <>
          <h2>Pending Invitations</h2>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Invited By</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{inv.role}</td>
                  <td>{inv.invitedByName}</td>
                  <td>{formatDate(inv.expiresAt)}</td>
                  <td>
                    <button onClick={() => handleRevoke(inv.id)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
```

---

### Task 3.3: Create Invite Modal Component

**File:** `apps/dashboard-client/src/components/settings/InviteModal.tsx`

**Features:**
- Email input with validation
- Role dropdown (Admin/Developer/Viewer)
- Display current user count vs. limit
- Show warning if approaching limit
- Submit to send invitation

```tsx
export function InviteModal({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'developer' | 'viewer'>('developer');
  const { organization } = useAuth();
  const { sendInvite, loading } = useInvitations();
  
  const canInvite = organization.userCount < organization.userLimit;
  
  return (
    <Modal onClose={onClose}>
      <h2>Invite Team Member</h2>
      
      <p>Users: {organization.userCount} / {organization.userLimit}</p>
      
      {!canInvite && (
        <Alert variant="warning">
          You've reached your user limit. Upgrade your plan to invite more members.
        </Alert>
      )}
      
      <form onSubmit={handleSubmit}>
        <label>
          Email Address
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        
        <label>
          Role
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="developer">Developer - Can run tests and view reports</option>
            <option value="viewer">Viewer - Read-only access</option>
            <option value="admin">Admin - Full access (use sparingly)</option>
          </select>
        </label>
        
        <button type="submit" disabled={!canInvite || loading}>
          Send Invitation
        </button>
      </form>
    </Modal>
  );
}
```

---

### Task 3.4: Create Organization Tab Component

**File:** `apps/dashboard-client/src/components/settings/OrganizationTab.tsx`

**Features:**
- Organization name (editable by Admin)
- Plan information (read-only, with upgrade link)
- Creation date
- Organization ID (for reference)

```tsx
export function OrganizationTab() {
  const { user, organization } = useAuth();
  const { updateOrg, loading } = useOrganization();
  const [name, setName] = useState(organization.name);
  
  const isAdmin = user.role === 'admin';
  
  return (
    <div>
      <h2>Organization Details</h2>
      
      <div className="form-group">
        <label>Organization Name</label>
        <input 
          type="text" 
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={!isAdmin}
        />
        {isAdmin && (
          <button onClick={() => updateOrg({ name })} disabled={loading}>
            Save
          </button>
        )}
      </div>
      
      <div className="form-group">
        <label>Current Plan</label>
        <div className="plan-badge">{organization.plan}</div>
        {organization.plan === 'free' && (
          <a href="/billing/upgrade">Upgrade to Team Plan</a>
        )}
      </div>
      
      <div className="form-group">
        <label>Organization ID</label>
        <code>{organization.id}</code>
      </div>
      
      <div className="form-group">
        <label>Created</label>
        <span>{formatDate(organization.createdAt)}</span>
      </div>
    </div>
  );
}
```

---

### Task 3.5: Create Security Tab Component

**File:** `apps/dashboard-client/src/components/settings/SecurityTab.tsx`

**Features:**
- AI Analysis toggle with explanation (Admin only)
- Warning when disabling: "Disabling AI analysis means you won't receive AI-powered failure insights."
- Data processing disclosure text

```tsx
export function SecurityTab() {
  const { user, organization } = useAuth();
  const { updateOrg, loading } = useOrganization();
  
  const isAdmin = user.role === 'admin';
  
  return (
    <div>
      <h2>Security & Privacy</h2>
      
      <div className="setting-group">
        <h3>AI-Powered Test Analysis</h3>
        <p>
          When enabled, test failures are analyzed by Google's Gemini AI to provide 
          intelligent insights and debugging suggestions.
        </p>
        
        {isAdmin ? (
          <>
            <label className="toggle">
              <input 
                type="checkbox"
                checked={organization.aiAnalysisEnabled}
                onChange={e => updateOrg({ aiAnalysisEnabled: e.target.checked })}
                disabled={loading}
              />
              Enable AI Analysis
            </label>
            
            {!organization.aiAnalysisEnabled && (
              <Alert variant="info">
                AI analysis is currently disabled. Test failures will not receive 
                AI-powered insights. This setting can be changed at any time.
              </Alert>
            )}
            
            <div className="disclosure">
              <h4>Data Processing</h4>
              <p>
                When AI analysis is enabled, test failure logs and screenshots are sent to 
                Google's Gemini API for analysis. Data is processed in real-time and not 
                stored by Google beyond the API call. Review our{' '}
                <a href="/privacy">Privacy Policy</a> for more details.
              </p>
            </div>
          </>
        ) : (
          <p>
            AI Analysis is currently {organization.aiAnalysisEnabled ? 'enabled' : 'disabled'}.
            Only administrators can change this setting.
          </p>
        )}
      </div>
    </div>
  );
}
```

---

### Task 3.6: Create Usage Tab Component

**File:** `apps/dashboard-client/src/components/settings/UsageTab.tsx`

**Features:**
- Test runs usage bar (X/100 for free plan)
- Users count (X/3 for free plan)
- Storage usage (if available)
- Billing period dates
- "Upgrade Plan" button if approaching limit

```tsx
export function UsageTab() {
  const { usage, loading } = useUsage();
  
  if (loading) return <Spinner />;
  
  return (
    <div>
      <h2>Usage & Limits</h2>
      
      <div className="billing-period">
        <p>
          Current billing period: {formatDate(usage.currentPeriod.startDate)} - {formatDate(usage.currentPeriod.endDate)}
        </p>
      </div>
      
      <div className="usage-metric">
        <h3>Test Runs</h3>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${usage.testRuns.percentUsed}%` }}
          />
        </div>
        <p>{usage.testRuns.used} / {usage.testRuns.limit} runs this month</p>
        
        {usage.testRuns.percentUsed > 80 && (
          <Alert variant="warning">
            You're approaching your test run limit. Consider upgrading your plan.
          </Alert>
        )}
      </div>
      
      <div className="usage-metric">
        <h3>Team Members</h3>
        <p>{usage.users.active} / {usage.users.limit} users</p>
      </div>
      
      <div className="usage-metric">
        <h3>Storage</h3>
        <p>{formatBytes(usage.storage.usedBytes)} / {formatBytes(usage.storage.limitBytes)}</p>
      </div>
      
      {(usage.testRuns.percentUsed > 80 || usage.users.active >= usage.users.limit) && (
        <div className="upgrade-prompt">
          <h3>Need More?</h3>
          <p>Upgrade to the Team plan for higher limits.</p>
          <a href="/billing/upgrade" className="button">Upgrade Plan</a>
        </div>
      )}
    </div>
  );
}
```

---

### Task 3.7: Add Settings Link to Header

**File:** `apps/dashboard-client/src/components/Dashboard.tsx`

**Changes:**
- Add "Settings" icon/link in header (visible to all roles)
- Use Settings icon from lucide-react
- Badge on settings icon if user limit reached (Admin only)

```tsx
import { Settings } from 'lucide-react';

export function Dashboard() {
  const { user, organization } = useAuth();
  const atUserLimit = organization.userCount >= organization.userLimit;
  
  return (
    <div>
      <header>
        {/* ... existing header content ... */}
        
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/executions">Test Runs</Link>
          
          <Link to="/settings" className="settings-link">
            <Settings size={20} />
            {user.role === 'admin' && atUserLimit && (
              <span className="badge">!</span>
            )}
            Settings
          </Link>
        </nav>
      </header>
      
      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

---

### Task 3.8: Create Settings API Hooks

**File:** `apps/dashboard-client/src/hooks/useSettings.ts`

```typescript
// Hooks to implement:

export function useOrganization() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const updateOrg = async (updates: Partial<Organization>) => {
    const response = await api.patch('/api/organization', updates);
    setOrg(response.data);
  };
  
  return { org, loading, error, updateOrg };
}

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const updateRole = async (userId: string, role: string) => {
    await api.patch(`/api/users/${userId}/role`, { role });
    // Refresh users list
  };
  
  const removeUser = async (userId: string) => {
    await api.delete(`/api/users/${userId}`);
    // Refresh users list
  };
  
  return { users, loading, updateRole, removeUser };
}

export function useInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const sendInvite = async (email: string, role: string) => {
    await api.post('/api/invitations', { email, role });
    // Refresh invitations list
  };
  
  const revokeInvite = async (invitationId: string) => {
    await api.delete(`/api/invitations/${invitationId}`);
    // Refresh invitations list
  };
  
  return { invitations, loading, sendInvite, revokeInvite };
}

export function useUsage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get('/api/organization/usage')
      .then(res => setUsage(res.data))
      .finally(() => setLoading(false));
  }, []);
  
  return { usage, loading };
}
```

---

## Sprint 4: Security Enhancements

### Task 4.1: Implement Redis-Based Rate Limiting

**Per Security Audit Recommendation**

**CRITICAL UPDATE:** Rate limiting must be **per-organization** for authenticated requests to prevent one tenant from impacting others.

**File:** `apps/producer-service/src/middleware/rateLimiter.ts`

```typescript
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis key prefix
}

// Rate limit configurations
const rateLimits = {
  auth: { 
    windowMs: 60000,      // 1 minute
    maxRequests: 5,       // 5 attempts per minute
    keyPrefix: 'rl:auth:' 
  },
  api: { 
    windowMs: 60000,      // 1 minute
    maxRequests: 100,     // 100 requests per minute per org
    keyPrefix: 'rl:api:'  
  }
};

async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  config: RateLimitConfig
) {
  // Determine rate limit key based on authentication status
  let key: string;
  
  if (request.user) {
    // AUTHENTICATED: Limit by organizationId (per-tenant isolation)
    key = `${config.keyPrefix}${request.user.organizationId}`;
  } else {
    // UNAUTHENTICATED: Limit by IP address
    key = `${config.keyPrefix}${request.ip}`;
  }
  
  // Increment request count in Redis
  const requests = await redis.incr(key);
  
  // Set expiry on first request
  if (requests === 1) {
    await redis.pexpire(key, config.windowMs);
  }
  
  // Check if limit exceeded
  if (requests > config.maxRequests) {
    return reply.code(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(config.windowMs / 1000)
    });
  }
  
  // Add rate limit headers
  reply.header('X-RateLimit-Limit', config.maxRequests);
  reply.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - requests));
}

// Middleware factories
export const authRateLimit = (request, reply) => 
  rateLimitMiddleware(request, reply, rateLimits.auth);

export const apiRateLimit = (request, reply) => 
  rateLimitMiddleware(request, reply, rateLimits.api);
```

**Apply to Routes:**
```typescript
// Authentication routes (unauthenticated - limit by IP)
app.post('/api/auth/login', { preHandler: authRateLimit }, loginHandler);
app.post('/api/auth/signup', { preHandler: authRateLimit }, signupHandler);
app.post('/api/invitations/accept', { preHandler: authRateLimit }, acceptHandler);

// General API routes (authenticated - limit by organizationId)
app.register((instance, opts, done) => {
  instance.addHook('preHandler', apiRateLimit);
  
  // All authenticated routes here
  instance.get('/api/executions', getExecutionsHandler);
  instance.post('/api/executions', createExecutionHandler);
  // ... other routes
  
  done();
});
```

**Benefits of Per-Organization Rate Limiting:**
- ✅ Prevents one tenant from consuming all API capacity
- ✅ Fair resource allocation across organizations
- ✅ Protects against noisy neighbor problem
- ✅ Enables per-plan rate limit customization (future enhancement)

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
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // CSP can be added later based on needs
  // reply.header('Content-Security-Policy', "default-src 'self'");
});
```

---

### Task 4.3: Implement Login Attempt Tracking

**File:** `apps/producer-service/src/routes/auth.ts`

```typescript
// Track failed login attempts in Redis
async function handleLogin(request, reply) {
  const { email, password } = request.body;
  
  // Check if account is locked
  const lockKey = `login_lock:${email}`;
  const isLocked = await redis.exists(lockKey);
  
  if (isLocked) {
    return reply.code(429).send({
      error: 'Account Temporarily Locked',
      message: 'Too many failed login attempts. Please try again in 15 minutes.'
    });
  }
  
  // Verify credentials
  const user = await usersCollection.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    // Increment failed attempts
    const failKey = `login_failures:${email}`;
    const failedAttempts = await redis.incr(failKey);
    await redis.expire(failKey, 900); // 15 min window
    
    // Lock account after 5 failed attempts
    if (failedAttempts >= 5) {
      await redis.setex(lockKey, 900, '1'); // Lock for 15 minutes
      
      // Log security event
      app.log.warn({ 
        event: 'ACCOUNT_LOCKED',
        email, 
        ip: request.ip,
        attempts: failedAttempts
      });
    }
    
    return reply.code(401).send({ 
      error: 'Invalid credentials',
      attemptsRemaining: Math.max(0, 5 - failedAttempts)
    });
  }
  
  // Successful login - clear failed attempts
  await redis.del(`login_failures:${email}`);
  await redis.del(lockKey);
  
  // Generate JWT and return
  const token = generateJWT(user);
  return reply.send({ token, user });
}
```

---

### Task 4.4: Add CORS Production Configuration

**File:** `apps/producer-service/src/index.ts`

```typescript
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? ['https://automation.keinar.com', 'https://www.automation.keinar.com']
  : ['http://localhost:8080', 'http://localhost:5173'];

app.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
- [ ] **Invitation token is stored as hash (security test)**
- [ ] **Existing user receives "join" email, new user receives "signup" email**
- [ ] Invitation token works for signup (new user)
- [ ] Invitation token works for join (existing user)
- [ ] Expired token rejected
- [ ] Revoked invitation cannot be accepted
- [ ] **Status transitions: pending → accepted**

```typescript
describe('Invitation System', () => {
  it('should hash invitation tokens before storage', async () => {
    const { token } = await sendInvitation('user@test.com', 'developer');
    
    // Token should not exist in plain text
    const plainInvite = await invitationsCollection.findOne({ token });
    expect(plainInvite).toBeNull();
    
    // Should exist as hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const hashedInvite = await invitationsCollection.findOne({ tokenHash });
    expect(hashedInvite).toBeTruthy();
  });
  
  it('should differentiate between new and existing users', async () => {
    // Create existing user
    await createUser({ email: 'existing@test.com' });
    
    // Invite existing user
    const invite1 = await sendInvitation('existing@test.com', 'developer');
    expect(invite1.emailType).toBe('join'); // Should get "join org" email
    
    // Invite new user
    const invite2 = await sendInvitation('newuser@test.com', 'developer');
    expect(invite2.emailType).toBe('signup'); // Should get "create account" email
  });
});
```

---

### Task 5.2: Integration Tests for User Management

**File:** `tests/users.test.ts`

**Test Cases:**
- [ ] Admin can list users
- [ ] Admin can change user role
- [ ] Cannot change own role if sole admin
- [ ] Cannot remove last admin
- [ ] Non-admin cannot change roles
- [ ] Removed user cannot access organization
- [ ] **Role permissions enforced per RBAC matrix**

```typescript
describe('User Management - RBAC', () => {
  it('should enforce permissions per RBAC matrix', async () => {
    const admin = await createUser({ role: 'admin' });
    const developer = await createUser({ role: 'developer' });
    const viewer = await createUser({ role: 'viewer' });
    
    // Admin can invite
    await expect(inviteUser(admin)).resolves.toBeTruthy();
    
    // Developer cannot invite
    await expect(inviteUser(developer)).rejects.toThrow('Forbidden');
    
    // Viewer cannot invite
    await expect(inviteUser(viewer)).rejects.toThrow('Forbidden');
    
    // Developer can run tests
    await expect(runTest(developer)).resolves.toBeTruthy();
    
    // Viewer cannot run tests
    await expect(runTest(viewer)).rejects.toThrow('Forbidden');
  });
});
```

---

### Task 5.3: E2E Test - Full Invitation Flow

**Test Flow:**
1. Admin creates organization (signup)
2. Admin invites developer@test.com (new user)
3. Developer signs up with invitation token
4. Developer can view executions
5. Developer cannot invite others
6. Admin invites existing-user@test.com (existing user)
7. Existing user logs in and accepts invitation
8. Admin changes developer to viewer
9. Viewer has read-only access (cannot run tests)

**File:** `tests/e2e/invitation-flow.test.ts`

```typescript
describe('E2E: Full Invitation Flow', () => {
  it('should handle complete multi-tenant invitation lifecycle', async () => {
    // 1. Admin signup
    const admin = await signup({
      email: 'admin@test.com',
      password: 'password',
      name: 'Admin',
      organizationName: 'Test Org'
    });
    
    // 2. Invite new user
    const invitation = await api.post('/api/invitations', {
      email: 'developer@test.com',
      role: 'developer'
    }, { headers: { Authorization: `Bearer ${admin.token}` }});
    
    expect(invitation.status).toBe(200);
    
    // 3. New user signs up with token
    const developer = await signup({
      email: 'developer@test.com',
      password: 'password',
      name: 'Developer',
      inviteToken: invitation.data.token
    });
    
    expect(developer.organizationId).toBe(admin.organizationId);
    expect(developer.role).toBe('developer');
    
    // 4. Developer can view but cannot invite
    const executions = await api.get('/api/executions', {
      headers: { Authorization: `Bearer ${developer.token}` }
    });
    expect(executions.status).toBe(200);
    
    const inviteAttempt = await api.post('/api/invitations', {
      email: 'another@test.com',
      role: 'viewer'
    }, { headers: { Authorization: `Bearer ${developer.token}` }});
    expect(inviteAttempt.status).toBe(403); // Forbidden
    
    // 5. Admin changes developer to viewer
    await api.patch(`/api/users/${developer.id}/role`, {
      role: 'viewer'
    }, { headers: { Authorization: `Bearer ${admin.token}` }});
    
    // 6. Viewer cannot run tests
    const testRun = await api.post('/api/executions', {
      url: 'https://example.com'
    }, { headers: { Authorization: `Bearer ${developer.token}` }});
    expect(testRun.status).toBe(403); // Forbidden
  });
});
```

---

### Task 5.4: Update Documentation

**Files to Update:**
1. `README.md` - Add user management section
2. `docs/implementation/phase-2-summary.md` - Create summary document
3. `.env.example` - Add new environment variables
4. `SECURITY-AUDIT-PHASE-1.md` - Mark implemented recommendations

**New Documentation to Create:**

**File:** `docs/RBAC.md`
```markdown
# Role-Based Access Control (RBAC)

## Roles

### Admin
- Full organization access
- Can invite/remove users
- Can manage billing
- Can update organization settings

### Developer
- Can run tests
- Can edit tests
- Can view reports
- Cannot invite users or modify org settings

### Viewer
- Read-only access
- Can view test results and reports
- Cannot run tests or modify anything

## Implementation

All API endpoints use the `requireRole()` middleware to enforce permissions.
See RBAC matrix in Phase 2 plan for complete permission mapping.
```

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
│   └── rateLimiter.ts    # NEW - per-org rate limiting
└── utils/
    ├── jwt.ts
    ├── password.ts
    ├── email.ts          # NEW (templates)
    └── audit.ts          # NEW

apps/worker-service/src/
├── worker.ts             # Updated with AI analysis enforcement
└── utils/
    └── ai-analysis.ts    # AI analysis with org setting check

apps/dashboard-client/src/
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   └── Settings.tsx      # NEW
├── components/
│   ├── Dashboard.tsx     # Updated with settings link
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

### New Collection: `invitations`

```javascript
{
  _id: ObjectId,
  organizationId: string,
  email: string,
  role: 'admin' | 'developer' | 'viewer',
  tokenHash: string,          // SHA-256 hash (NEVER plain token)
  status: 'pending' | 'accepted' | 'expired',  // NEW
  invitedBy: string,           // userId
  expiresAt: Date,
  createdAt: Date,
  acceptedAt?: Date            // NEW
}

// Indexes:
{ tokenHash: 1 }                     // Token lookup
{ email: 1, organizationId: 1 }      // Prevent duplicates
{ organizationId: 1, status: 1 }     // List pending
{ expiresAt: 1 }                     // TTL cleanup
```

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
{ userId: 1, timestamp: -1 }
```

### Updated Collection: `organizations`

```javascript
// Add field:
{
  aiAnalysisEnabled: boolean  // default: true
}
```

### Updated Collection: `executions`

```javascript
// Add field for audit trail:
{
  aiAnalysisEnabled: boolean  // Setting at execution time
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

# Frontend URL (for invitation links)
FRONTEND_URL=https://automation.keinar.com
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Invitation token guessed | Use 32-byte cryptographically secure random token + SHA-256 hash |
| Rate limiting bypass | Redis-based with per-organization keys for authenticated requests |
| Admin removes all admins | Prevent removing/demoting last admin |
| Invitation spam | Rate limit + email verification in Phase 3 |
| AI toggle bypassed via API | Worker service enforces setting from DB (not frontend) |
| One tenant DoS attack | Per-organization rate limiting prevents noisy neighbor problem |
| Token storage breach | Tokens stored as SHA-256 hashes, never plain text |

---

## Success Criteria

- [ ] Admin can invite users with specific roles
- [ ] **Existing users receive "join" flow, new users receive "signup" flow**
- [ ] Invited users can join organization via secure hashed token
- [ ] Admin can change user roles and remove users
- [ ] **RBAC matrix enforced for all API endpoints**
- [ ] **AI Analysis toggle enforced in Worker Service**
- [ ] **Rate limiting works per-organization for authenticated requests**
- [ ] Usage stats display correctly
- [ ] Rate limiting prevents brute force attacks
- [ ] All existing functionality still works
- [ ] 100% multi-tenant isolation maintained

---

## Estimated Effort

| Sprint | Estimated Time |
|--------|----------------|
| Sprint 1: Invitation Backend | 5-7 hours (increased for hashing + multi-tenant logic) |
| Sprint 2: Organization Backend | 3-4 hours (increased for worker-side AI enforcement) |
| Sprint 3: Frontend Settings | 6-8 hours |
| Sprint 4: Security Enhancements | 3-4 hours (increased for per-org rate limiting) |
| Sprint 5: Testing & Polish | 4-5 hours (increased for comprehensive testing) |
| **Total** | **21-28 hours** |

---

## Implementation Priority

**Critical Path (Must Have):**
1. Invitation token hashing (Task 1.1)
2. Multi-tenant invitation logic (Task 1.1, 1.2, 1.3)
3. Worker-side AI enforcement (Task 2.2)
4. Per-organization rate limiting (Task 4.1)
5. RBAC permissions (All routes)

**Important (Should Have):**
1. Audit logging (Task 2.4)
2. Usage tracking (Task 2.3)
3. Login attempt tracking (Task 4.3)

**Nice to Have:**
1. Detailed usage statistics
2. Advanced invite management UI

---

## Next Phase Preview (Phase 3)

**Billing Integration (Stripe)**
- Subscription management
- Plan upgrades/downgrades
- Payment history
- Invoice generation
- Webhook handling
- Email notifications via SendGrid

---

## Changes from v1.0 → v2.0

### Security Enhancements
✅ Invitation tokens now stored as SHA-256 hashes (never plain text)  
✅ Multi-tenant invitation logic (existing vs. new users)  
✅ Worker-side AI analysis enforcement (prevents frontend bypass)  
✅ Per-organization rate limiting (prevents noisy neighbor)

### Schema Updates
✅ Added `status` field to invitations ('pending' | 'accepted' | 'expired')  
✅ Added `acceptedAt` timestamp to invitations  
✅ Added `tokenHash` field (replaces plain token storage)  
✅ Added `aiAnalysisEnabled` to executions (audit trail)

### New Features
✅ RBAC Permissions Matrix (explicit role capabilities)  
✅ Invitation flow differentiation (signup vs. join)  
✅ Enhanced rate limiting strategy  
✅ Comprehensive testing requirements

---

**Document Version Control:**
- v1.0 (2026-01-30): Initial Phase 2 plan based on PRD and Security Audit
- v2.0 (2026-02-04): Hardened security specifications with multi-tenant support, RBAC matrix, worker-side enforcement, and per-org rate limiting
