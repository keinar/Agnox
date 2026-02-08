/**
 * JWT Utilities
 *
 * Handles JSON Web Token signing, verification, and extraction
 * for authentication and authorization in the multi-tenant system.
 */

import jwt from 'jsonwebtoken';

// JWT Configuration from environment
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * JWT Payload Interface
 * Contains user and organization context
 */
export interface IJWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
  iat?: number; // Issued at (auto-added by jwt.sign)
  exp?: number; // Expiration (auto-added by jwt.sign)
}

/**
 * Sign a JWT token with user/organization context
 *
 * @param payload - User and organization data to encode in token
 * @returns Signed JWT token string
 *
 * @example
 * const token = signToken({
 *   userId: '507f1f77bcf86cd799439011',
 *   organizationId: '507f191e810c19729de860ea',
 *   role: 'admin'
 * });
 */
export function signToken(payload: Omit<IJWTPayload, 'iat' | 'exp'>): string {
  if (!payload.userId || !payload.email || !payload.organizationId || !payload.role) {
    throw new Error('JWT payload must include userId, email, organizationId, and role');
  }

  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: JWT_EXPIRY as string,
    issuer: 'agnostic-automation-center',
    audience: 'aac-api'
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token string to verify
 * @returns Decoded payload if valid, null if invalid or expired
 *
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('User ID:', payload.userId);
 * } else {
 *   console.log('Invalid token');
 * }
 */
export function verifyToken(token: string): IJWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'agnostic-automation-center',
      audience: 'aac-api'
    }) as IJWTPayload;

    // Validate required fields
    if (!decoded.userId || !decoded.email || !decoded.organizationId || !decoded.role) {
      console.error('JWT payload missing required fields');
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('JWT token expired:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('JWT verification failed:', error.message);
    } else {
      console.error('Unexpected JWT error:', error);
    }
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 *
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns Token string if found, null otherwise
 *
 * @example
 * const token = extractTokenFromHeader(request.headers.authorization);
 * if (token) {
 *   const payload = verifyToken(token);
 * }
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Check for Bearer scheme
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Extract token after "Bearer "
  const token = authHeader.substring(7);

  // Validate token is not empty
  if (!token || token.trim().length === 0) {
    return null;
  }

  return token.trim();
}

/**
 * Decode JWT token without verification
 * Useful for debugging or getting token info without validating signature
 *
 * @param token - JWT token string
 * @returns Decoded payload (unverified) or null if malformed
 *
 * @warning Do NOT use this for authentication - always use verifyToken()
 */
export function decodeTokenUnsafe(token: string): IJWTPayload | null {
  try {
    const decoded = jwt.decode(token) as IJWTPayload;
    return decoded;
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

/**
 * Get token expiration time in seconds from now
 *
 * @param token - JWT token string
 * @returns Seconds until expiration, or null if invalid/expired
 */
export function getTokenExpirationTime(token: string): number | null {
  const payload = decodeTokenUnsafe(token);

  if (!payload || !payload.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - now;

  return expiresIn > 0 ? expiresIn : null;
}

/**
 * Check if JWT token is expired
 *
 * @param token - JWT token string
 * @returns true if expired, false if still valid
 */
export function isTokenExpired(token: string): boolean {
  const expiresIn = getTokenExpirationTime(token);
  return expiresIn === null || expiresIn <= 0;
}

/**
 * Security: Enforce JWT_SECRET in production
 */
if (JWT_SECRET === 'dev-secret-CHANGE-IN-PRODUCTION') {
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 CRITICAL: JWT_SECRET is not set! Cannot start in production mode.');
    console.error('   Set the JWT_SECRET environment variable and restart.');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: Using default JWT_SECRET! Set JWT_SECRET environment variable in production.');
  }
}

// Log JWT configuration on module load
console.log('🔐 JWT Configuration:');
console.log(`  - Secret: ${JWT_SECRET.substring(0, 10)}... (${JWT_SECRET.length} chars)`);
console.log(`  - Expiry: ${JWT_EXPIRY}`);
console.log(`  - Issuer: agnostic-automation-center`);
console.log(`  - Audience: aac-api`);
