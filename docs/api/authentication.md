# Authentication API

Base URL: `/api/auth`

All authentication endpoints are **public** (no authentication required for signup/login).

---

## POST `/api/auth/signup`

Register a new user and create an organization (or join via invitation).

### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "organizationName": "Acme Corp",  // Required if no inviteToken
  "inviteToken": "abc123..."        // Optional: for invited users
}
```

### Validation Rules

| Field | Required | Rules |
|-------|----------|-------|
| `email` | Yes | Valid email format |
| `password` | Yes | Min 8 chars, uppercase, lowercase, number, special char |
| `name` | Yes | User's full name |
| `organizationName` | Conditional | Required if no `inviteToken` |
| `inviteToken` | No | Valid invitation token (if joining existing org) |

### Response (201 Created)

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",  // "admin" if creating org, or invitation role
    "organizationId": "507f191e810c19729de860ea",
    "organizationName": "Acme Corp"
  }
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing required fields` | Email, password, or name not provided |
| 400 | `Invalid email format` | Email doesn't match regex pattern |
| 400 | `Weak password` | Password doesn't meet strength requirements |
| 400 | `Invalid invitation token` | Token format invalid or not found |
| 400 | `Invitation has expired` | Token expired (>7 days old) |
| 409 | `Email already registered` | Account with email already exists |
| 429 | `Rate limit exceeded` | Too many signup attempts (5/min per IP) |
| 500 | `Signup failed` | Internal server error |

### Notes

- **Creating Organization:** If no `inviteToken` provided, user becomes `admin` of new organization
- **Joining via Invitation:** If `inviteToken` provided, user joins existing organization with invited role
- **JWT Token:** Returned token includes `{ userId, organizationId, role }` claims
- **Password Hashing:** Passwords hashed with bcrypt (10 rounds)
- **Rate Limiting:** 5 signup attempts per minute per IP address

---

## POST `/api/auth/login`

Authenticate user and return JWT token.

### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Response (200 OK)

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "organizationId": "507f191e810c19729de860ea",
    "organizationName": "Acme Corp"
  }
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing credentials` | Email or password not provided |
| 401 | `Invalid credentials` | Email or password incorrect |
| 403 | `Account suspended` | User account has been suspended |
| 429 | `Account temporarily locked` | Too many failed login attempts (5 in 15 minutes) |
| 429 | `Rate limit exceeded` | Too many login attempts (5/min per IP) |
| 500 | `Login failed` | Internal server error |

### Account Lockout

- **Failed Attempts Tracked:** Per email address in Redis
- **Lockout Threshold:** 5 failed attempts in 15-minute window
- **Lockout Duration:** 15 minutes
- **Remaining Attempts:** Returned in 401 error response
- **Reset:** Cleared on successful login

### Notes

- **JWT Token:** Contains `{ userId, organizationId, role }` claims
- **Rate Limiting:** 5 login attempts per minute per IP address
- **Login Tracking:** Failed attempts logged for security monitoring
- **Last Login:** Updates `lastLoginAt` timestamp on successful login

---

## GET `/api/auth/me`

Get current user information from JWT token.

### Headers

```
Authorization: Bearer <jwt-token>
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "status": "active",
    "lastLoginAt": "2026-02-04T10:30:00.000Z",
    "organization": {
      "id": "507f191e810c19729de860ea",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "plan": "free",
      "limits": {
        "maxProjects": 1,
        "maxTestRuns": 100,
        "maxUsers": 3,
        "maxConcurrentRuns": 1
      },
      "userCount": 2,
      "userLimit": 3,
      "aiAnalysisEnabled": true
    }
  }
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Authentication required` | No token provided |
| 401 | `Invalid or expired token` | Token verification failed |
| 404 | `User or organization not found` | User/org deleted after token issued |
| 500 | `Failed to fetch user info` | Internal server error |

### Notes

- **Rate Limiting:** 100 requests per minute per organization
- **User Count:** Includes total active users in organization
- **User Limit:** Max users allowed based on plan

---

## POST `/api/auth/logout`

Logout user (client-side token removal).

### Headers

```
Authorization: Bearer <jwt-token>
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Notes

- **Stateless JWT:** Logout handled client-side (remove token)
- **Future Enhancement:** Token blacklist in Redis (not yet implemented)
- **Client Action Required:** Delete JWT token from local storage

---

## Authentication Flow

### New User Signup (Creating Organization)

```
1. POST /api/auth/signup
   └─> Creates organization with user as admin
   └─> Returns JWT token
2. Store token in client (localStorage/sessionStorage)
3. Use token in Authorization header for subsequent requests
```

### Invited User Signup (Joining Organization)

```
1. Receive invitation email with token
2. POST /api/auth/signup with inviteToken
   └─> Joins existing organization with invited role
   └─> Marks invitation as "accepted"
   └─> Returns JWT token
3. Store token and use for authentication
```

### Existing User Login

```
1. POST /api/auth/login
   └─> Verifies credentials
   └─> Updates lastLoginAt timestamp
   └─> Returns JWT token
2. Store token in client
3. Use token in Authorization header
```

### Authenticated Request

```
1. Include token in headers:
   Authorization: Bearer <jwt-token>
2. Server verifies token via auth middleware
3. Request.user populated with { userId, organizationId, role }
4. Route handler accesses request.user
```

---

## Security Considerations

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`)

### JWT Token

- **Algorithm:** HS256 (HMAC SHA-256)
- **Secret:** Configured via `JWT_SECRET` environment variable (64+ chars recommended)
- **Expiration:** Configured via `JWT_EXPIRY` environment variable (default: 24h)
- **Claims:** `{ userId, organizationId, role, iat, exp }`
- **Verification:** Every authenticated request validates token signature and expiration

### Rate Limiting

| Endpoint | Limit | Key | Window |
|----------|-------|-----|--------|
| `/signup` | 5 requests | IP address | 1 minute |
| `/login` | 5 requests | IP address | 1 minute |
| `/me` | 100 requests | Organization ID | 1 minute |
| `/logout` | 100 requests | Organization ID | 1 minute |

### Account Lockout

- **Trigger:** 5 failed login attempts for same email
- **Duration:** 15 minutes
- **Storage:** Redis (`login_lock:<email>` key with 900s TTL)
- **Reset:** Automatic after 15 minutes, or on successful login

### Invitation Tokens

- **Format:** 32-byte random hex string
- **Storage:** SHA-256 hash stored in database
- **Expiration:** 7 days from creation
- **Single Use:** Marked as "accepted" after signup

---

## Example Usage

### JavaScript/TypeScript (Fetch API)

```typescript
// Signup
const signupResponse = await fetch('http://localhost:3000/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    name: 'John Doe',
    organizationName: 'Acme Corp'
  })
});
const { token } = await signupResponse.json();
localStorage.setItem('jwt_token', token);

// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});
const { token } = await loginResponse.json();
localStorage.setItem('jwt_token', token);

// Get Current User
const token = localStorage.getItem('jwt_token');
const meResponse = await fetch('http://localhost:3000/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: user } = await meResponse.json();
console.log(user);

// Logout
await fetch('http://localhost:3000/api/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
localStorage.removeItem('jwt_token');
```

### cURL

```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "organizationName": "Acme Corp"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Get Current User
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <jwt-token>"

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <jwt-token>"
```

---

## Related Documentation

- [Organizations API](./organizations.md)
- [Invitations API](./invitations.md)
- [Users API](./users.md)
- [Security Audit](../setup/security-audit.md)
