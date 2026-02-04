# Sprint 1, Task 1.1 - Implementation Summary

## Invitation Schema & Routes

**Completed:** February 4, 2026
**Status:** ✅ Complete

---

## Files Created

### 1. Token Hashing Utilities
**File:** `apps/producer-service/src/utils/invitation.ts`

Functions implemented:
- `generateInvitationToken()` - Generates 64-char hex token (32 bytes)
- `hashInvitationToken(token)` - SHA-256 hashing
- `isValidInvitationTokenFormat(token)` - Format validation
- `generateInvitationUrl(baseUrl, token, actionType)` - URL generation
- `calculateInvitationExpiration(daysValid)` - Expiration calculation
- `isInvitationExpired(expiresAt)` - Expiration check
- Audit logging helpers

**Security:** All tokens are stored as SHA-256 hashes. Plain tokens only sent via email.

---

### 2. Invitation Routes
**File:** `apps/producer-service/src/routes/invitations.ts`

Endpoints implemented:

#### POST /api/invitations (Admin only)
- Send invitation to join organization
- Multi-tenant logic: Detects if user exists
- Plan limit validation (maxUsers)
- Duplicate invitation check
- Logs invitation URL to console (dev mode)

#### GET /api/invitations (Admin only)
- List pending invitations for organization
- Enriched with inviter names

#### DELETE /api/invitations/:id (Admin only)
- Revoke pending invitation
- Tenant isolation enforced

#### GET /api/invitations/validate/:token (Public)
- Validate invitation token
- Returns organization info, role, and userExists flag
- Marks expired invitations

#### POST /api/invitations/accept (Authenticated)
- Accept invitation for existing users
- Email verification
- Updates user's organization and role
- Marks invitation as accepted

---

### 3. Database Migration
**File:** `migrations/002-create-invitations-indexes.js`

Indexes created:
1. `tokenHash_1` (unique) - Fast token lookup
2. `email_1_organizationId_1` - Prevent duplicate invites
3. `organizationId_1_status_1` - List pending invitations
4. `expiresAt_1_ttl` - Automatic cleanup (TTL)
5. `createdAt_-1` - Sorting

**Run migration:**
```bash
node migrations/002-create-invitations-indexes.js
```

---

## Files Modified

### 1. Shared Types
**File:** `packages/shared-types/index.ts`

Changes:
- Updated `IInvitation.token` → `IInvitation.tokenHash`
- Added `IInvitationRequest` interface
- Added `IInvitationResponse` interface
- Added `IUserListResponse` interface
- Added `IInvitationValidationResponse` interface
- Updated `InvitationStatus` type (removed 'revoked')

---

### 2. Auth Routes
**File:** `apps/producer-service/src/routes/auth.ts`

Changes:
- Added `inviteToken` parameter to signup
- Imported invitation utilities
- Added `invitationsCollection` reference
- Implemented invitation-based signup flow:
  - Validates token format
  - Hashes token for database lookup
  - Checks expiration
  - Creates user with invitation's org and role
  - Marks invitation as accepted
- Maintains regular signup flow (create new org)

---

### 3. Main Server
**File:** `apps/producer-service/src/index.ts`

Changes:
- Imported `invitationRoutes`
- Registered invitation routes
- Added `/api/invitations/validate/*` to public routes

---

## Database Schema

### invitations Collection

```javascript
{
  _id: ObjectId,
  organizationId: string,
  email: string,
  role: 'admin' | 'developer' | 'viewer',
  tokenHash: string,           // SHA-256 hash (NEVER plain token)
  status: 'pending' | 'accepted' | 'expired',
  invitedBy: string,            // userId
  expiresAt: Date,
  createdAt: Date,
  acceptedAt?: Date
}
```

**Indexes:**
- `tokenHash` (unique)
- `email + organizationId`
- `organizationId + status`
- `expiresAt` (TTL)
- `createdAt`

---

## Security Features Implemented

✅ **Token Hashing (SHA-256)**
- Tokens stored as hashes in database
- Plain tokens only sent via email
- Prevents token leakage in database breach

✅ **Multi-Tenant Invitation Logic**
- Checks if user exists in ANY organization
- Different email flows:
  - Existing user → "Join Organization" (login + accept)
  - New user → "Create Account" (signup with token)

✅ **Plan Limit Enforcement**
- Validates user count against plan limits
- Free: 3 users, Team: 20, Enterprise: unlimited

✅ **Duplicate Prevention**
- Checks for existing user in organization
- Checks for pending invitation

✅ **Expiration Handling**
- 7-day expiration
- TTL index for automatic cleanup
- Expired status tracking

✅ **Tenant Isolation**
- All queries filter by organizationId
- Returns 404 (not 403) for cross-tenant access

---

## Testing Instructions

### 1. Start the Services
```bash
docker-compose up --build
```

### 2. Run Database Migration
```bash
node migrations/002-create-invitations-indexes.js
```

### 3. Create Organization (Signup)
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "name": "Admin User",
    "organizationName": "Test Org"
  }'
```

Save the JWT token from response.

### 4. Send Invitation (Admin)
```bash
curl -X POST http://localhost:3000/api/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "developer@example.com",
    "role": "developer"
  }'
```

Check console logs for invitation link:
```
📧 INVITATION EMAIL (Development Mode)
To: developer@example.com
Link: http://localhost:8080/signup?token=a1b2c3d4e5f6...
```

### 5. Validate Invitation Token
```bash
curl http://localhost:3000/api/invitations/validate/TOKEN_FROM_EMAIL
```

Expected response:
```json
{
  "success": true,
  "valid": true,
  "organizationName": "Test Org",
  "role": "developer",
  "inviterName": "Admin User",
  "userExists": false
}
```

### 6. Accept Invitation (Signup)
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "DevPass123!",
    "name": "Developer User",
    "inviteToken": "TOKEN_FROM_EMAIL"
  }'
```

Expected: New user created with role 'developer' in Test Org.

### 7. List Invitations (Admin)
```bash
curl http://localhost:3000/api/invitations \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### 8. Revoke Invitation (Admin)
```bash
curl -X DELETE http://localhost:3000/api/invitations/INVITATION_ID \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

## Acceptance Criteria

- [x] Admin can invite by email + role
- [x] Invitation creates secure random token (32 bytes hex)
- [x] Token is hashed with SHA-256 before storing in DB
- [x] Invitation expires in 7 days (status: 'expired')
- [x] Duplicate email check (existing user or pending invite)
- [x] Plan limit check (free: 3 users)
- [x] Email validation
- [x] Multi-tenant logic: Check if email exists to determine signup vs. join flow

---

## Next Steps

**Sprint 1, Task 1.2:** Create Invitation Email Templates
- Implement email template generation
- Add email service utility
- Support for both 'signup' and 'join' action types
- Console logging for dev mode (SendGrid integration in Phase 3)

---

## Notes

- Email sending is currently console-only (dev mode)
- SendGrid integration planned for Phase 3
- TTL index runs every 60 seconds (MongoDB default)
- Invitation URLs include plain token (sent via secure email)
- Database stores only SHA-256 hashes (never plain tokens)

---

**Document Version:** 1.0
**Author:** Claude Code
**Date:** February 4, 2026
