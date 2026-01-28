# Producer Service Routes

API routes for the Agnostic Automation Center producer service.

## Authentication Routes (`auth.ts`)

Handles user authentication and organization management for multi-tenant SaaS.

### POST /api/auth/signup

Register a new user and create an organization.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd!",
  "name": "John Doe",
  "organizationName": "Acme Corporation"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*(),.?":{}|<>)

**Response (201 Created):**
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
    "organizationName": "Acme Corporation"
  }
}
```

**Notes:**
- First user of a new organization is always **admin**
- Organization created with **free** plan by default
- Email is normalized to lowercase
- Organization slug auto-generated from name

**Errors:**
- `400` - Missing fields, invalid email, weak password
- `409` - Email already registered
- `500` - Server error

---

### POST /api/auth/login

Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd!"
}
```

**Response (200 OK):**
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
    "organizationName": "Acme Corporation"
  }
}
```

**Notes:**
- Updates `lastLoginAt` timestamp
- Returns full organization name
- JWT token expires in 24 hours (configurable via `JWT_EXPIRY`)

**Errors:**
- `400` - Missing email or password
- `401` - Invalid credentials (generic message for security)
- `403` - Account suspended
- `500` - Server error

---

### GET /api/auth/me

Get current user information from JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "status": "active",
    "lastLoginAt": "2026-01-28T10:30:00.000Z",
    "organization": {
      "id": "507f191e810c19729de860ea",
      "name": "Acme Corporation",
      "slug": "acme-corporation",
      "plan": "free",
      "limits": {
        "maxProjects": 1,
        "maxTestRuns": 100,
        "maxUsers": 3,
        "maxConcurrentRuns": 1
      }
    }
  }
}
```

**Use Cases:**
- Validate token on page load
- Fetch current user info for dashboard
- Check organization plan and limits
- Verify user role for UI permissions

**Errors:**
- `401` - Missing or invalid token
- `404` - User or organization not found
- `500` - Server error

---

### POST /api/auth/logout

Logout user (client-side token removal).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Notes:**
- Currently stateless - logout handled client-side by removing token
- Future enhancement: Token blacklist in Redis
- Always succeeds if token is valid

**Errors:**
- `401` - Missing or invalid token

---

## Authentication Flow

### 1. New User Signup

```javascript
// Client
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecureP@ssw0rd!',
    name: 'John Doe',
    organizationName: 'Acme Corp'
  })
});

const { token, user } = await response.json();

// Store token
localStorage.setItem('authToken', token);

// User is now authenticated
console.log('Welcome,', user.name);
```

**What happens:**
1. Password strength validated
2. Email checked for duplicates
3. Organization created with slug `acme-corp`
4. User created as **admin** of the organization
5. JWT token generated with userId, organizationId, role
6. Token returned to client

---

### 2. Existing User Login

```javascript
// Client
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecureP@ssw0rd!'
  })
});

const { token, user } = await response.json();

// Store token
localStorage.setItem('authToken', token);
```

**What happens:**
1. User fetched by email
2. Password verified with bcrypt
3. User status checked (suspended accounts blocked)
4. `lastLoginAt` updated
5. Organization info fetched
6. JWT token generated and returned

---

### 3. Accessing Protected Routes

```javascript
// Client
const token = localStorage.getItem('authToken');

const response = await fetch('/api/executions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const executions = await response.json();
```

**What happens:**
1. Request hits global auth middleware (index.ts:276)
2. Token extracted from `Authorization` header
3. Token verified (signature, expiration)
4. User context injected into `request.user`
5. Route handler accesses `request.user.organizationId`
6. Data filtered by organization

---

### 4. Get Current User Info

```javascript
// Client (on page load)
const token = localStorage.getItem('authToken');

if (!token) {
  // Redirect to login
  window.location.href = '/login';
  return;
}

const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

if (response.status === 401) {
  // Token expired or invalid
  localStorage.removeItem('authToken');
  window.location.href = '/login';
  return;
}

const { data } = await response.json();
console.log('Current user:', data.name);
console.log('Organization:', data.organization.name);
console.log('Plan:', data.organization.plan);
```

---

### 5. Logout

```javascript
// Client
const token = localStorage.getItem('authToken');

await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Remove token
localStorage.removeItem('authToken');

// Redirect to login
window.location.href = '/login';
```

---

## Security Features

### Password Security
- **Bcrypt hashing** with 10 salt rounds (configurable)
- **Strength validation** before hashing
- Never stored or logged in plain text

### JWT Tokens
- **HS256 algorithm** (HMAC with SHA-256)
- **Secret key** from `JWT_SECRET` environment variable
- **24-hour expiry** (configurable via `JWT_EXPIRY`)
- **Issuer/Audience** validation

### Email Security
- Normalized to **lowercase** to prevent duplicate accounts
- **Regex validation** for format
- Error messages don't leak existence (generic "invalid credentials")

### Error Messages
- **Generic messages** for authentication failures
  - "Email or password is incorrect" (not "Email not found")
- **404 instead of 403** for cross-org resources (Phase 1 Task 3.1)

---

## Public vs Protected Routes

### Public Routes (No Authentication)
- `GET /` - Health check
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /config/defaults` - Configuration
- `GET /reports/*` - Static report files
- `POST /executions/update` - Internal worker callback
- `POST /executions/log` - Internal worker callback

### Protected Routes (Require JWT)
- `GET /api/executions` - List executions
- `POST /api/execution-request` - Trigger test
- `DELETE /api/executions/:id` - Delete execution
- `GET /api/metrics/:image` - Performance metrics
- `GET /api/tests-structure` - Test folder structure
- `GET /api/auth/me` - Current user info
- `POST /api/auth/logout` - Logout

---

## Testing

Run the authentication test suite:

```bash
# Start services first
docker-compose up producer-service mongodb

# In another terminal
cd apps/producer-service
npx tsx src/routes/auth.test.ts
```

**Expected output:**
```
✅ All 10 tests passed!

=== Authentication Flow Summary ===
✅ Signup creates organization and admin user
✅ Login returns JWT token
✅ Protected routes require valid token
✅ Public routes accessible without token
✅ User info endpoint works correctly
✅ Invalid credentials rejected
✅ Weak passwords rejected
✅ Duplicate emails rejected
✅ Logout endpoint functional

🎉 Sprint 2 Complete!
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-CHANGE-IN-PRODUCTION` | Secret key for signing JWTs (min 32 chars) |
| `JWT_EXPIRY` | `24h` | Token expiration time (e.g., `1h`, `7d`, `30m`) |
| `PASSWORD_SALT_ROUNDS` | `10` | Bcrypt salt rounds (10 = ~100ms per hash) |

⚠️ **Production:** Generate a strong secret:
```bash
openssl rand -hex 64
```

---

## Troubleshooting

### "Authentication required" on protected routes
**Cause:** Missing or invalid JWT token

**Solution:**
- Check token is in `Authorization: Bearer <token>` header
- Verify token hasn't expired (24h default)
- Check JWT_SECRET matches between signup and verification

---

### "Email already registered"
**Cause:** Attempting to create account with existing email

**Solution:**
- Use `/api/auth/login` instead
- User may need to reset password (future feature)

---

### "Weak password" on signup
**Cause:** Password doesn't meet requirements

**Solution:** Ensure password has:
- 8+ characters
- Uppercase letter
- Lowercase letter
- Number
- Special character

---

### "Account suspended" on login
**Cause:** User account status set to 'suspended'

**Solution:**
- Contact organization admin
- Admin can update user status in database (UI coming in Phase 3)

---

## Future Enhancements

- [ ] Password reset via email
- [ ] Email verification on signup
- [ ] Refresh token mechanism
- [ ] Token blacklist (Redis-based)
- [ ] Rate limiting on login attempts
- [ ] Two-factor authentication (2FA)
- [ ] OAuth/SSO integration
- [ ] Session management dashboard

---

## Related Documentation

- **Middleware:** `apps/producer-service/src/middleware/README.md`
- **JWT Utilities:** `apps/producer-service/src/utils/README.md` (JWT section)
- **Password Utilities:** `apps/producer-service/src/utils/README.md` (Password section)
- **Shared Types:** `packages/shared-types/index.ts`
