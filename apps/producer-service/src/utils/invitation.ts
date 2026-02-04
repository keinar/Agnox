/**
 * Invitation Token Utilities
 *
 * Handles secure invitation token generation, hashing, and validation
 * for the multi-tenant invitation system.
 *
 * SECURITY: Invitation tokens are stored as SHA-256 hashes to prevent
 * token leakage in case of database breach. Only the plain token is
 * sent via email and never stored in the database.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random invitation token
 *
 * @returns 64-character hexadecimal token string (32 bytes)
 *
 * @example
 * const token = generateInvitationToken();
 * // Returns: "a1b2c3d4e5f6..."
 */
export function generateInvitationToken(): string {
  // Generate 32 random bytes for 256-bit security
  // Converts to 64-character hex string
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash an invitation token using SHA-256
 *
 * CRITICAL: Always hash tokens before storing in database.
 * The plain token should ONLY exist in the email sent to the user.
 *
 * @param token - Plain invitation token to hash
 * @returns SHA-256 hash as hexadecimal string
 *
 * @example
 * const token = generateInvitationToken();
 * const tokenHash = hashInvitationToken(token);
 * await invitationsCollection.insertOne({ tokenHash }); // Store hash
 * await sendEmail({ inviteToken: token }); // Send plain token via email
 */
export function hashInvitationToken(token: string): string {
  if (!token || token.trim().length === 0) {
    throw new Error('Token cannot be empty');
  }

  // SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Validate invitation token format
 *
 * Checks if token is a valid 64-character hexadecimal string
 * (the expected format from generateInvitationToken)
 *
 * @param token - Token to validate
 * @returns true if valid format, false otherwise
 */
export function isValidInvitationTokenFormat(token: string): boolean {
  if (!token) {
    return false;
  }

  // Check if 64 hex characters (32 bytes)
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Generate a secure invitation link
 *
 * @param baseUrl - Base URL of the frontend application
 * @param token - Plain invitation token
 * @param actionType - Whether user should 'signup' or 'login'
 * @returns Full invitation URL
 *
 * @example
 * const url = generateInvitationUrl(
 *   'https://app.example.com',
 *   token,
 *   'signup'
 * );
 * // Returns: "https://app.example.com/signup?token=..."
 */
export function generateInvitationUrl(
  baseUrl: string,
  token: string,
  actionType: 'signup' | 'login'
): string {
  const path = actionType === 'signup' ? '/signup' : '/login';
  const url = new URL(path, baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Calculate invitation expiration date
 *
 * @param daysValid - Number of days until expiration (default: 7)
 * @returns Date object representing expiration time
 */
export function calculateInvitationExpiration(daysValid: number = 7): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);
  return expiresAt;
}

/**
 * Check if invitation is expired
 *
 * @param expiresAt - Expiration date from invitation record
 * @returns true if expired, false if still valid
 */
export function isInvitationExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}

/**
 * Log invitation token generation for audit
 * (does NOT log the actual token for security)
 *
 * @param email - Email address receiving invitation
 * @param organizationId - Organization ID
 * @param role - Role being assigned
 */
export function logInvitationCreated(
  email: string,
  organizationId: string,
  role: string
): void {
  console.log(`[INVITATION] Created for ${email} as ${role} in org ${organizationId}`);
}

/**
 * Log invitation acceptance for audit
 *
 * @param email - Email address that accepted
 * @param organizationId - Organization ID
 */
export function logInvitationAccepted(
  email: string,
  organizationId: string
): void {
  console.log(`[INVITATION] Accepted by ${email} for org ${organizationId}`);
}

console.log('🎫 Invitation Token Utilities Loaded');
console.log('  - SHA-256 hashing enabled');
console.log('  - 256-bit token security (32 bytes)');
console.log('  - Default expiration: 7 days');
