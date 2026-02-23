/**
 * Report Token Utility — HMAC-SHA256 Signed URL Tokens
 *
 * Generates short-lived tokens that grant access to report static files.
 * Tokens are scoped to a specific organizationId + taskId and expire after 5 minutes.
 *
 * SECURITY_PLAN §2.1 — Option A: HMAC-signed URL tokens.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const HMAC_SECRET = process.env.PLATFORM_JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';
const TOKEN_TTL_SECONDS = 300; // 5 minutes

interface IReportTokenPayload {
    orgId: string;
    taskId: string;
    exp: number; // Unix timestamp (seconds)
}

/**
 * Generate a short-lived HMAC-signed report access token.
 *
 * Token format: base64url(payload).base64url(signature)
 *
 * @param orgId  - The organization that owns the report
 * @param taskId - The execution/task ID for the report
 * @returns Signed token string
 */
export function generateReportToken(orgId: string, taskId: string): string {
    const payload: IReportTokenPayload = {
        orgId,
        taskId,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');

    return `${payloadB64}.${signature}`;
}

/**
 * Verify an HMAC-signed report token.
 *
 * Validates:
 *   1. Structural integrity (payload.signature format)
 *   2. HMAC signature (timing-safe comparison)
 *   3. Expiry (token must not be expired)
 *   4. Path scope (orgId and taskId must match the requested path)
 *
 * @param token           - The token string from the query parameter
 * @param requestedOrgId  - The organizationId extracted from the URL path
 * @param requestedTaskId - The taskId extracted from the URL path
 * @returns true if the token is valid, false otherwise
 */
export function verifyReportToken(
    token: string,
    requestedOrgId: string,
    requestedTaskId: string,
): boolean {
    if (!token || typeof token !== 'string') return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payloadB64, providedSig] = parts;

    // Verify HMAC signature (timing-safe)
    const expectedSig = createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');

    if (providedSig.length !== expectedSig.length) return false;

    const sigValid = timingSafeEqual(
        Buffer.from(providedSig, 'utf8'),
        Buffer.from(expectedSig, 'utf8'),
    );
    if (!sigValid) return false;

    // Decode and validate payload
    let payload: IReportTokenPayload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
        return false;
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return false;

    // Check path scope — token must match the requested orgId and taskId
    if (payload.orgId !== requestedOrgId) return false;
    if (payload.taskId !== requestedTaskId) return false;

    return true;
}

/** Token TTL exported for the API response */
export const REPORT_TOKEN_TTL = TOKEN_TTL_SECONDS;
