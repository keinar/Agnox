# Producer Service Middleware

Authentication and authorization middleware for protecting API routes.

## Authentication Middleware (`auth.ts`)

Provides JWT-based authentication and role-based access control (RBAC).

### Core Middleware Functions

#### `authMiddleware`
Main authentication middleware - verifies JWT token and injects user context.

```typescript
import { authMiddleware } from './middleware/auth';

app.get('/api/protected', { preHandler: authMiddleware }, async (request, reply) => {
  // User context is available
  console.log('User ID:', request.user.userId);
  console.log('Organization ID:', request.user.organizationId);
  console.log('Role:', request.user.role);

  return reply.send({ message: 'Authenticated!' });
});
```

**Behavior:**
- Extracts JWT from `Authorization: Bearer <token>` header
- Verifies token signature and expiration
- Injects `request.user` with user context
- Returns `401 Unauthorized` if token is missing or invalid

**User Context Structure:**
```typescript
request.user = {
  userId: string;              // User's unique ID
  organizationId: string;      // Organization ID (for multi-tenancy)
  role: 'admin' | 'developer' | 'viewer';
}
```

---

#### `requireRole(...roles)`
Role-based authorization middleware - restricts access by role.

```typescript
import { authMiddleware, requireRole } from './middleware/auth';

// Only admins can access
app.delete('/api/users/:id', {
  preHandler: [authMiddleware, requireRole('admin')]
}, async (request, reply) => {
  // Delete user logic
});

// Admins OR developers can access
app.post('/api/projects', {
  preHandler: [authMiddleware, requireRole('admin', 'developer')]
}, async (request, reply) => {
  // Create project logic
});
```

**Returns:**
- `200` - User has required role
- `401` - Not authenticated (use `authMiddleware` first!)
- `403` - Authenticated but insufficient permissions

**Error Response Example:**
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "This action requires one of the following roles: admin. Your role: developer."
}
```

---

#### `adminOnly`
Convenience wrapper for admin-only routes.

```typescript
import { authMiddleware, adminOnly } from './middleware/auth';

app.patch('/api/organizations/me', {
  preHandler: [authMiddleware, adminOnly]
}, async (request, reply) => {
  // Only admins can update organization settings
});
```

Equivalent to: `requireRole('admin')`

---

#### `developerOrAdmin`
Convenience wrapper for developer or admin routes.

```typescript
import { authMiddleware, developerOrAdmin } from './middleware/auth';

app.post('/api/executions', {
  preHandler: [authMiddleware, developerOrAdmin]
}, async (request, reply) => {
  // Developers and admins can trigger test runs
  // Viewers cannot
});
```

Equivalent to: `requireRole('admin', 'developer')`

---

#### `optionalAuth`
Optional authentication - injects user context if present, but doesn't fail.

```typescript
import { optionalAuth } from './middleware/auth';

app.get('/api/public-data', {
  preHandler: optionalAuth
}, async (request, reply) => {
  if (request.user) {
    // Authenticated user - return personalized data
    return reply.send({
      data: getPersonalizedData(request.user.organizationId)
    });
  } else {
    // Anonymous user - return generic data
    return reply.send({
      data: getGenericData()
    });
  }
});
```

**Use Cases:**
- Public endpoints that enhance experience for logged-in users
- Analytics tracking (authenticated vs anonymous)
- Feature flags based on authentication

---

#### `verifyOrganizationOwnership(getOrgId)`
Ensures a resource belongs to the user's organization.

```typescript
import { authMiddleware, verifyOrganizationOwnership } from './middleware/auth';
import { ObjectId } from 'mongodb';

app.get('/api/projects/:id', {
  preHandler: [
    authMiddleware,
    verifyOrganizationOwnership(async (request) => {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(request.params.id)
      });
      return project?.organizationId.toString();
    })
  ]
}, async (request, reply) => {
  // User can only access their organization's projects
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(request.params.id)
  });

  return reply.send({ project });
});
```

**Security Note:**
Returns `404 Not Found` instead of `403 Forbidden` to prevent leaking information about other organizations' resources.

---

#### `rateLimit(maxRequests, windowMs)`
Basic rate limiting (in-memory).

```typescript
import { rateLimit } from './middleware/auth';

// 5 requests per minute per IP/organization
app.post('/api/auth/login', {
  preHandler: rateLimit(5, 60000)
}, async (request, reply) => {
  // Login logic
});
```

**Parameters:**
- `maxRequests` - Maximum requests allowed
- `windowMs` - Time window in milliseconds

**Rate Limit Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2026-01-28T10:30:00.000Z
```

**Response (429 Too Many Requests):**
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

⚠️ **Production Note:** This uses in-memory storage. Replace with Redis for production multi-instance deployments.

---

## Role Hierarchy

| Role | Permissions | Use Case |
|------|-------------|----------|
| **admin** | Full access to organization | Organization owner, QA lead |
| **developer** | Create/run tests, view results | QA engineers, developers |
| **viewer** | View test results only | Product managers, stakeholders |

**Permission Matrix:**

| Action | Admin | Developer | Viewer |
|--------|-------|-----------|--------|
| View executions | ✅ | ✅ | ✅ |
| Trigger tests | ✅ | ✅ | ❌ |
| Create projects | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Update organization | ✅ | ❌ | ❌ |
| Delete resources | ✅ | ❌ | ❌ |

---

## Usage Patterns

### Pattern 1: Public Route (No Auth)

```typescript
app.get('/api/health', async (request, reply) => {
  return reply.send({ status: 'ok' });
});
```

**No middleware needed** - completely public.

---

### Pattern 2: Protected Route (Any Authenticated User)

```typescript
import { authMiddleware } from './middleware/auth';

app.get('/api/executions', {
  preHandler: authMiddleware
}, async (request, reply) => {
  // Any authenticated user can view their org's executions
  const executions = await db.collection('executions').find({
    organizationId: new ObjectId(request.user.organizationId)
  }).toArray();

  return reply.send({ executions });
});
```

---

### Pattern 3: Role-Restricted Route

```typescript
import { authMiddleware, developerOrAdmin } from './middleware/auth';

app.post('/api/executions/trigger', {
  preHandler: [authMiddleware, developerOrAdmin]
}, async (request, reply) => {
  // Only developers and admins can trigger tests
  // Viewers will get 403 Forbidden
});
```

---

### Pattern 4: Admin-Only Route

```typescript
import { authMiddleware, adminOnly } from './middleware/auth';

app.delete('/api/users/:id', {
  preHandler: [authMiddleware, adminOnly]
}, async (request, reply) => {
  // Only organization admins can delete users
});
```

---

### Pattern 5: Resource Ownership Verification

```typescript
import { authMiddleware, verifyOrganizationOwnership } from './middleware/auth';

app.get('/api/projects/:id', {
  preHandler: [
    authMiddleware,
    verifyOrganizationOwnership(async (request) => {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(request.params.id)
      });
      return project?.organizationId.toString();
    })
  ]
}, async (request, reply) => {
  // User can only access projects from their organization
  // Returns 404 if project belongs to another organization
});
```

---

### Pattern 6: Optional Authentication

```typescript
import { optionalAuth } from './middleware/auth';

app.get('/api/stats', {
  preHandler: optionalAuth
}, async (request, reply) => {
  if (request.user) {
    // Authenticated - show detailed org-specific stats
    return reply.send({
      stats: getDetailedStats(request.user.organizationId)
    });
  } else {
    // Anonymous - show public aggregate stats
    return reply.send({
      stats: getPublicStats()
    });
  }
});
```

---

### Pattern 7: Rate Limited Route

```typescript
import { rateLimit } from './middleware/auth';

app.post('/api/auth/login', {
  preHandler: rateLimit(5, 60000) // 5 attempts per minute
}, async (request, reply) => {
  // Login logic
  // Prevents brute force attacks
});
```

---

## Testing

Run the test suite:

```bash
npx tsx src/middleware/auth.test.ts
```

Expected output:
```
✅ All 13 test groups passed!
```

Tests cover:
- Missing token (401)
- Invalid token (401)
- Valid token (user context injection)
- Role-based access control
- Optional authentication
- Organization isolation
- Multi-role routes

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_AUTH` | `false` | Enable authentication logging |

**Enable auth logging:**
```bash
export LOG_AUTH=true
```

**Output example:**
```
[AUTH] User user123 (admin) from org org456
[AUTHZ] User user123 authorized with role admin
```

---

## Error Responses

### 401 Unauthorized - Missing Token
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "No token provided in Authorization header. Please login."
}
```

### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "error": "Invalid token",
  "message": "Token is invalid or expired. Please login again."
}
```

### 403 Forbidden - Insufficient Permissions
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "This action requires one of the following roles: admin, developer. Your role: viewer."
}
```

### 404 Not Found - Wrong Organization
```json
{
  "success": false,
  "error": "Resource not found"
}
```

**Note:** Returns 404 instead of 403 for organization mismatch to prevent information leakage.

### 429 Too Many Requests - Rate Limit
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## Security Best Practices

1. **Always use authMiddleware first**
   ```typescript
   // ✅ Correct
   preHandler: [authMiddleware, requireRole('admin')]

   // ❌ Wrong
   preHandler: [requireRole('admin'), authMiddleware]
   ```

2. **Filter by organizationId in queries**
   ```typescript
   // ✅ Correct - scoped to user's organization
   db.collection('executions').find({
     organizationId: new ObjectId(request.user.organizationId)
   })

   // ❌ Wrong - returns all data across all organizations
   db.collection('executions').find({})
   ```

3. **Return 404 instead of 403 for cross-org access**
   ```typescript
   // ✅ Correct - doesn't leak information
   if (resource.organizationId !== user.organizationId) {
     return reply.code(404).send({ error: 'Resource not found' });
   }

   // ❌ Wrong - reveals resource exists in another org
   if (resource.organizationId !== user.organizationId) {
     return reply.code(403).send({ error: 'Access denied' });
   }
   ```

4. **Use HTTPS in production**
   - JWT tokens transmitted in headers
   - Never use HTTP for authentication

5. **Set appropriate rate limits**
   - Login: 5-10 attempts per minute
   - API calls: 100-1000 per minute depending on plan
   - Prevent brute force and DoS attacks

6. **Log authentication events**
   - Failed login attempts
   - Permission denials
   - Unusual access patterns

---

## Troubleshooting

### "No user context found"
**Problem:** `requireRole` returns 401 with "Ensure authMiddleware runs first"

**Solution:** Add `authMiddleware` before `requireRole`:
```typescript
preHandler: [authMiddleware, requireRole('admin')]
```

### "Token is invalid or expired"
**Problem:** Valid-looking token fails verification

**Causes:**
- Token expired (default 24h expiry)
- JWT_SECRET changed (invalidates all tokens)
- Token from different environment

**Solution:**
- User should login again
- Implement token refresh mechanism (future)

### Rate limit too restrictive
**Problem:** Legitimate users hitting rate limits

**Solution:** Adjust limits based on plan:
```typescript
const limits = {
  free: rateLimit(10, 60000),
  team: rateLimit(100, 60000),
  enterprise: rateLimit(1000, 60000)
};

app.post('/api/endpoint', {
  preHandler: limits[organization.plan]
}, ...);
```

### Cross-organization data leaks
**Problem:** Users seeing other organizations' data

**Root Cause:** Missing `organizationId` filter in queries

**Solution:** ALWAYS filter by organization:
```typescript
const query = {
  _id: new ObjectId(id),
  organizationId: new ObjectId(request.user.organizationId) // Required!
};
```

---

## Future Enhancements

- [ ] Token refresh mechanism
- [ ] Token blacklist (Redis-based)
- [ ] IP-based rate limiting
- [ ] Failed login attempt tracking
- [ ] Session management
- [ ] Two-factor authentication (2FA)
- [ ] API key authentication (alternative to JWT)
- [ ] OAuth2 integration
- [ ] Audit logging (all auth events)
