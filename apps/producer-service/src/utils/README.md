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

---

## Password Utilities (`password.ts`)

Handles secure password hashing, comparison, and validation using bcrypt.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PASSWORD_SALT_ROUNDS` | `10` | Number of bcrypt salt rounds (higher = more secure but slower) |

⚠️ **Production:** Use at least 10 salt rounds (default is fine).

### Password Requirements

- **Minimum Length:** 8 characters
- **Maximum Length:** 128 characters
- **Must contain:**
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&*(),.?":{}|<>)

### Functions

#### `hashPassword(password)`
Hash a plain text password using bcrypt.

```typescript
import { hashPassword } from './utils/password';

const hashed = await hashPassword('MySecurePass123!');
// Returns: "$2b$10$3cMZB9vE9UY3uwfHwdTSi.1..."
```

**Parameters:**
- `password` (string) - Plain text password to hash

**Returns:** Promise<string> - Bcrypt hash

**Throws:**
- Error if password is empty
- Error if password exceeds 128 characters

---

#### `comparePassword(password, hashedPassword)`
Compare a plain text password with a hashed password.

```typescript
import { comparePassword } from './utils/password';

const isValid = await comparePassword('MySecurePass123!', user.hashedPassword);
if (isValid) {
  console.log('Password correct - user authenticated');
} else {
  console.log('Invalid password');
}
```

**Parameters:**
- `password` (string) - Plain text password
- `hashedPassword` (string) - Bcrypt hash from database

**Returns:** Promise<boolean> - true if match, false otherwise

---

#### `validatePasswordStrength(password)`
Validate password meets all security requirements.

```typescript
import { validatePasswordStrength } from './utils/password';

const result = validatePasswordStrength('weak');
if (!result.valid) {
  console.log('Password errors:', result.errors);
  // Errors: ["Password must be at least 8 characters long", ...]
}
```

**Parameters:**
- `password` (string) - Password to validate

**Returns:** `IPasswordValidation`
```typescript
{
  valid: boolean;
  errors: string[];  // Empty if valid
}
```

---

#### `meetsMinimumRequirements(password)`
Check if password meets basic requirements (less strict).

```typescript
import { meetsMinimumRequirements } from './utils/password';

if (meetsMinimumRequirements('Password123')) {
  console.log('Meets minimum requirements');
}
```

**Requirements:**
- At least 8 characters
- Contains at least one letter
- Contains at least one number

**Returns:** boolean

---

#### `calculatePasswordStrength(password)`
Calculate password strength score (0-5).

```typescript
import { calculatePasswordStrength } from './utils/password';

const score = calculatePasswordStrength('Password123!');
// Returns: 4 (Strong)
```

**Score Levels:**
- `0` - Very weak (< 8 chars)
- `1` - Weak (8+ chars, letters only)
- `2` - Fair (8+ chars, letters + numbers)
- `3` - Good (8+ chars, letters + numbers + uppercase)
- `4` - Strong (8+ chars, all requirements met)
- `5` - Very strong (12+ chars, all requirements met)

**Returns:** number (0-5)

---

#### `getPasswordStrengthLabel(password)`
Get human-readable password strength label.

```typescript
import { getPasswordStrengthLabel } from './utils/password';

const label = getPasswordStrengthLabel('Password123!');
console.log('Strength:', label);  // "Strong"
```

**Returns:** string - One of:
- "Very Weak"
- "Weak"
- "Fair"
- "Good"
- "Strong"
- "Very Strong"

---

#### `containsCommonPatterns(password)`
Check if password contains weak patterns.

```typescript
import { containsCommonPatterns } from './utils/password';

if (containsCommonPatterns('password123')) {
  console.log('Password contains weak pattern "123"');
}
```

**Detects:**
- Sequential characters (abc, 123, 456, 789)
- Common keyboard patterns (qwerty, asdf, zxcv)
- Repeated characters (aaa, 111)

**Returns:** boolean - true if contains patterns

---

#### `generateSecurePassword(length)`
Generate a random password meeting all requirements.

```typescript
import { generateSecurePassword } from './utils/password';

const password = generateSecurePassword();
console.log('Temporary password:', password);
// Example: "#vKoB*1x%k2.utJr"

const customLength = generateSecurePassword(24);
// Generates 24-character password
```

**Parameters:**
- `length` (number, optional) - Password length (default: 16)

**Returns:** string - Random secure password

**Use Cases:**
- Temporary passwords for new users
- Password reset tokens
- API keys

---

### Usage in Authentication

**Signup (hash password):**
```typescript
import { hashPassword, validatePasswordStrength } from './utils/password';

app.post('/api/auth/signup', async (request, reply) => {
  const { email, password, name } = request.body;

  // 1. Validate password strength
  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    return reply.code(400).send({
      error: 'Weak password',
      message: validation.errors.join(', ')
    });
  }

  // 2. Hash password
  const hashedPassword = await hashPassword(password);

  // 3. Store user with hashed password
  await usersCollection.insertOne({
    email,
    name,
    hashedPassword,  // Never store plain password!
    // ...
  });

  return reply.code(201).send({ success: true });
});
```

**Login (compare password):**
```typescript
import { comparePassword } from './utils/password';

app.post('/api/auth/login', async (request, reply) => {
  const { email, password } = request.body;

  // 1. Find user
  const user = await usersCollection.findOne({ email });
  if (!user) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }

  // 2. Compare password
  const isValid = await comparePassword(password, user.hashedPassword);
  if (!isValid) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }

  // 3. User authenticated - generate JWT
  const token = signToken({
    userId: user._id.toString(),
    organizationId: user.organizationId.toString(),
    role: user.role
  });

  return reply.send({ token, user });
});
```

---

### Testing

Run the test suite:

```bash
npx tsx src/utils/password.test.ts
```

Expected output:
```
✅ All 18 test groups passed!
```

Tests cover:
- Password hashing
- Password comparison
- Strength validation
- Common pattern detection
- Secure password generation
- Edge cases (empty, too long, etc.)

---

### Security Best Practices

1. **Never log passwords** - Not even hashed ones
2. **Never store plain passwords** - Always hash before storing
3. **Use bcrypt** - Not MD5, SHA1, or plain SHA256
4. **Salt rounds** - Use at least 10 (default)
5. **Password reset** - Generate secure temporary passwords
6. **Rate limiting** - Limit login attempts to prevent brute force
7. **HTTPS only** - Always transmit passwords over encrypted connections

---

### Common Mistakes to Avoid

❌ **Bad:** Storing plain password
```typescript
await usersCollection.insertOne({ password: 'plain123' });
```

✅ **Good:** Storing hashed password
```typescript
const hashedPassword = await hashPassword('plain123');
await usersCollection.insertOne({ hashedPassword });
```

❌ **Bad:** Not validating before hashing
```typescript
const hashedPassword = await hashPassword(userInput);
```

✅ **Good:** Validate first
```typescript
const validation = validatePasswordStrength(userInput);
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}
const hashedPassword = await hashPassword(userInput);
```

❌ **Bad:** Using simple comparison
```typescript
if (password === user.password) { /* ... */ }
```

✅ **Good:** Using bcrypt comparison
```typescript
const isValid = await comparePassword(password, user.hashedPassword);
if (isValid) { /* ... */ }
```

---

### Troubleshooting

#### "Password hashing failed"
- Check bcrypt is installed: `npm list bcrypt`
- Ensure password is a string
- Check password length < 128 characters

#### Slow hashing/comparison
- Expected behavior with bcrypt (security vs speed tradeoff)
- Salt rounds of 10 takes ~100ms
- Consider async hashing to not block event loop

#### "Invalid credentials" on correct password
- Check password is hashed correctly during signup
- Verify you're using `comparePassword()` not `===`
- Check database field is `hashedPassword` not `password`

---

### Performance Notes

**Bcrypt is intentionally slow:**
- 10 salt rounds ≈ 100ms per hash/compare
- This prevents brute force attacks
- Use async functions to avoid blocking

**Don't hash on every request:**
- Hash only on signup/password change
- Compare only on login
- Cache authentication via JWT tokens

---

### Future Enhancements

- [ ] Password history (prevent reuse)
- [ ] Breach detection (HaveIBeenPwned API)
- [ ] Complexity scoring improvements
- [ ] Multi-language dictionary checks
- [ ] Argon2 as alternative to bcrypt
