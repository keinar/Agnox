# Producer Service Utilities

Shared utility functions for the producer service.

## JWT Utilities (`jwt.ts`)

Handles JSON Web Token operations for authentication and authorization.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-CHANGE-IN-PRODUCTION` | Secret key for signing tokens (min 32 chars) |
| `JWT_EXPIRY` | `24h` | Token expiration time (e.g., `1h`, `7d`, `30m`) |

⚠️ **Production:** Generate a strong secret with:
```bash
openssl rand -hex 64
```

### Functions

#### `signToken(payload)`
Create a new JWT token with user/organization context.

```typescript
import { signToken } from './utils/jwt';

const token = signToken({
  userId: '507f1f77bcf86cd799439011',
  organizationId: '507f191e810c19729de860ea',
  role: 'admin'
});
// Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Parameters:**
- `payload.userId` (string, required) - User's unique ID
- `payload.organizationId` (string, required) - Organization's unique ID
- `payload.role` (string, required) - User's role (admin, developer, viewer)

**Returns:** JWT token string

**Throws:** Error if required fields are missing

---

#### `verifyToken(token)`
Verify and decode a JWT token.

```typescript
import { verifyToken } from './utils/jwt';

const payload = verifyToken(token);
if (payload) {
  console.log('User ID:', payload.userId);
  console.log('Org ID:', payload.organizationId);
  console.log('Role:', payload.role);
} else {
  console.log('Invalid or expired token');
}
```

**Parameters:**
- `token` (string) - JWT token to verify

**Returns:**
- Decoded `IJWTPayload` if valid
- `null` if invalid or expired

**Payload Structure:**
```typescript
{
  userId: string;
  organizationId: string;
  role: string;
  iat: number;        // Issued at (Unix timestamp)
  exp: number;        // Expiration (Unix timestamp)
  iss: string;        // Issuer: "agnostic-automation-center"
  aud: string;        // Audience: "aac-api"
}
```

---

#### `extractTokenFromHeader(authHeader)`
Extract token from Authorization header.

```typescript
import { extractTokenFromHeader } from './utils/jwt';

// From HTTP request
const token = extractTokenFromHeader(request.headers.authorization);
// Input: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
// Output: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

**Parameters:**
- `authHeader` (string | undefined) - Authorization header value

**Returns:**
- Token string if found
- `null` if header is missing, malformed, or doesn't use Bearer scheme

---

#### `isTokenExpired(token)`
Check if a token is expired.

```typescript
import { isTokenExpired } from './utils/jwt';

if (isTokenExpired(token)) {
  console.log('Token expired, please login again');
}
```

**Parameters:**
- `token` (string) - JWT token to check

**Returns:** `true` if expired, `false` if still valid

---

#### `getTokenExpirationTime(token)`
Get seconds until token expiration.

```typescript
import { getTokenExpirationTime } from './utils/jwt';

const expiresIn = getTokenExpirationTime(token);
if (expiresIn) {
  console.log(`Token expires in ${expiresIn} seconds`);
}
```

**Parameters:**
- `token` (string) - JWT token

**Returns:**
- Number of seconds until expiration
- `null` if already expired or invalid

---

#### `decodeTokenUnsafe(token)`
Decode token WITHOUT verification (for debugging only).

```typescript
import { decodeTokenUnsafe } from './utils/jwt';

const payload = decodeTokenUnsafe(token);
console.log('Token contents (unverified):', payload);
```

⚠️ **Warning:** Do NOT use for authentication - always use `verifyToken()`

**Parameters:**
- `token` (string) - JWT token

**Returns:**
- Decoded payload (unverified)
- `null` if malformed

---

### Usage in Routes

**Typical authentication flow:**

```typescript
import { extractTokenFromHeader, verifyToken } from './utils/jwt';

app.get('/api/protected-route', async (request, reply) => {
  // 1. Extract token from header
  const token = extractTokenFromHeader(request.headers.authorization);

  if (!token) {
    return reply.code(401).send({ error: 'No token provided' });
  }

  // 2. Verify token
  const payload = verifyToken(token);

  if (!payload) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }

  // 3. Use payload data
  console.log('Authenticated user:', payload.userId);
  console.log('Organization:', payload.organizationId);
  console.log('Role:', payload.role);

  // 4. Your route logic here
  return reply.send({ message: 'Success' });
});
```

---

### Testing

Run the test suite:

```bash
npx tsx src/utils/jwt.test.ts
```

Expected output:
```
✅ All tests passed!
```

---

### Security Notes

1. **Never log tokens** - They provide authentication access
2. **Use HTTPS** - Tokens transmitted in HTTP headers
3. **Strong secret** - Minimum 32 characters, random
4. **Short expiry** - Recommended: 1-24 hours
5. **Token rotation** - Refresh tokens before expiry
6. **Blacklisting** - Consider token blacklist for logout (future)

---

### Troubleshooting

#### "Invalid token" on verification
- Check JWT_SECRET matches between sign and verify
- Ensure token hasn't been modified
- Verify token hasn't expired

#### "Token expired"
- User needs to login again
- Implement token refresh mechanism (future)

#### Default secret warning
```
⚠️ WARNING: Using default JWT_SECRET!
```
**Solution:** Set JWT_SECRET environment variable:
```bash
export JWT_SECRET=$(openssl rand -hex 64)
```

---

### Future Enhancements

- [ ] Token refresh mechanism
- [ ] Token blacklist (Redis-based)
- [ ] Multiple secret rotation
- [ ] Token revocation
- [ ] Rate limiting on token verification
