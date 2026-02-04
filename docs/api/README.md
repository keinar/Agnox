# API Documentation

Complete API reference for the Agnostic Automation Center.

## Authentication Required

All endpoints except `/api/auth/signup` and `/api/auth/login` require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt-token>
```

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** Your configured production URL

## API Endpoints

### Authentication
- [Authentication API](./authentication.md) - Signup, login, user info, logout

### Organization Management
- `GET /api/organization` - Get organization details
- `PATCH /api/organization` - Update organization name (admin only)
- `GET /api/organization/usage` - Get usage statistics
- `PATCH /api/organization/ai-analysis` - Toggle AI analysis (admin only)

### User Management
- `GET /api/users` - List organization users (admin only)
- `PATCH /api/users/:id/role` - Update user role (admin only)
- `DELETE /api/users/:id` - Remove user (admin only)

### Invitations
- `POST /api/invitations` - Send invitation (admin only)
- `GET /api/invitations` - List invitations (admin only)
- `GET /api/invitations/validate/:token` - Validate invitation token (public)
- `DELETE /api/invitations/:id` - Revoke invitation (admin only)

### Test Execution
- `POST /api/execution-request` - Queue test execution
- `GET /api/executions` - List executions (filtered by organization)
- `DELETE /api/executions/:id` - Delete execution

### Configuration
- `GET /config/defaults` - Get default configuration values
- `GET /api/tests-structure` - List available test folders

### Metrics
- `GET /api/metrics/:image` - Get performance insights for test suite

## Rate Limits

| Tier | Limit | Applied To |
|------|-------|------------|
| **Auth** | 5 requests/min | Unauthenticated (IP-based) |
| **API** | 100 requests/min | Authenticated (per-organization) |
| **Strict** | 10 requests/min | Admin actions (per-organization) |

Rate limit headers included in responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Timestamp when limit resets

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }  // or "message": "..."
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limit exceeded) |
| 500 | Internal Server Error |

## Multi-Tenant Isolation

All API endpoints automatically filter data by the authenticated user's `organizationId`:
- Users can only see data belonging to their organization
- Attempts to access other organizations' data return `404 Not Found`
- Organization ID extracted from JWT token payload

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000` (production only)

## WebSocket (Socket.io)

Real-time updates via Socket.io at `/socket.io/`.

### Authentication

Include JWT token in handshake:

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

**Client Listens:**
- `auth-success` - Connection authenticated
- `auth-error` - Authentication failed
- `execution-updated` - Test execution status changed
- `execution-log` - Live test logs

**Organization Rooms:**
- Automatically joined to `org:<organizationId>` room
- Events only broadcast to organization members

## Related Documentation

- [Client Integration Guide](../setup/client-integration.md)
- [Security Audit](../setup/security-audit.md)
- [Deployment Guide](../setup/deployment.md)
