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

export interface IReportTokenPayload {
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
 * Verify an HMAC-signed report token and return its payload.
 *
 * @param token           - The token string
 * @param requestedTaskId - The taskId extracted from the URL path
 * @returns The payload if valid, null otherwise
 */
export function extractReportTokenPayload(
    token: string,
    requestedTaskId: string,
): IReportTokenPayload | null {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, providedSig] = parts;

    // Verify HMAC signature (timing-safe)
    const expectedSig = createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');

    if (providedSig.length !== expectedSig.length) return null;

    const sigValid = timingSafeEqual(
        Buffer.from(providedSig, 'utf8'),
        Buffer.from(expectedSig, 'utf8'),
    );
    if (!sigValid) return null;

    // Decode and validate payload
    let payload: IReportTokenPayload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return null;

    // Check path scope — token must match the requested taskId
    if (payload.taskId !== requestedTaskId) return null;

    return payload;
}

/**
 * Verify an HMAC-signed report token.
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
    const payload = extractReportTokenPayload(token, requestedTaskId);
    if (!payload) return false;
    return payload.orgId === requestedOrgId;
}

/** Token TTL exported for the API response */
export const REPORT_TOKEN_TTL = TOKEN_TTL_SECONDS;
