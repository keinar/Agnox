import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Security Headers Middleware (Task 4.2 - Security Enhancements)
 * Per Security Audit Recommendation: Add security headers to all responses
 */
export function setupSecurityHeaders(app: FastifyInstance): void {
    app.addHook('onSend', async (request, reply) => {
        // Prevent MIME type sniffing
        reply.header('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking attacks
        reply.header('X-Frame-Options', 'DENY');

        // Enable XSS protection in legacy browsers
        reply.header('X-XSS-Protection', '1; mode=block');

        // Control referrer information
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Enforce HTTPS in production (HSTS)
        if (process.env.NODE_ENV === 'production') {
            reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Content-Security-Policy can be added later based on needs
        // reply.header('Content-Security-Policy', "default-src 'self'");
    });
}

/**
 * Global Authentication Middleware
 * Apply auth to all /api/* routes except public endpoints
 */
export function setupGlobalAuth(
    app: FastifyInstance,
    apiRateLimit: (request: any, reply: any) => Promise<void>
): void {
    // ── SECURITY_PLAN §1.2 — Hook 1: Worker callback authentication ──────────
    // Registers FIRST so it fires before the JWT preHandler.
    // Validates the shared secret for /executions/update and /executions/log.
    const WORKER_CALLBACK_PATHS = new Set(['/executions/update', '/executions/log']);
    const WORKER_SECRET = process.env.PLATFORM_WORKER_CALLBACK_SECRET;
    const inTransition = process.env.WORKER_CALLBACK_TRANSITION === 'true';

    app.addHook('onRequest', async (request, reply) => {
        if (!WORKER_CALLBACK_PATHS.has(request.url)) return;

        const token = (request.headers['authorization'] ?? '').replace('Bearer ', '');

        if (!WORKER_SECRET || !token || token !== WORKER_SECRET) {
            if (inTransition) {
                // 24-hour window: allow but log for visibility
                request.log.warn(
                    { url: request.url },
                    '[worker-auth] Unauthenticated worker callback — transition window active'
                );
                request.isWorkerCallback = true;
                return;
            }
            return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }

        request.isWorkerCallback = true; // Signal JWT hook to skip
    });

    // ── Hook 2: JWT / API Key auth ───────────────────────────────────────────
    app.addHook('preHandler', async (request, reply) => {
        // Debug logging
        app.log.info(`[GlobalAuth] ${request.method} ${request.url}`);

        // Socket.io handshake - skip auth middleware (handled separately in Socket.io connection handler)
        if (request.url.startsWith('/socket.io/')) {
            return;
        }

        // If already authenticated by the worker callback hook, skip JWT check
        if (request.isWorkerCallback) {
            return;
        }

        // Public route prefixes - no authentication required
        const publicPrefixes = [
            '/api/auth/signup',
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/refresh',
            '/__webpack_hmr',
            '/config/defaults',
            '/health'
        ];

        // Invitation validation endpoint (public)
        if (request.url.startsWith('/api/invitations/validate/')) {
            app.log.info('[GlobalAuth] Skipping - invitation validation');
            return;
        }

        // Static files (reports) — SECURITY_PLAN §2.1: validate HMAC report token
        // Uses path-scoped cookies so sub-resources (CSS/JS) authenticate automatically.
        if (request.url.startsWith('/reports/')) {
            // Extract orgId and taskId from path: /reports/{orgId}/{taskId}/...
            const pathParts = request.url.split('?')[0].split('/').filter(Boolean);
            // pathParts = ['reports', orgId, taskId, ...]
            if (pathParts.length >= 3) {
                const [, orgId, taskId] = pathParts;
                const { verifyReportToken, REPORT_TOKEN_TTL } = await import('../utils/reportToken.js');

                // 1. Try query string token (initial page load)
                const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
                const queryToken = urlObj.searchParams.get('token');

                // 2. Fall back to cookie (sub-resource requests like CSS/JS)
                const cookieHeader = request.headers.cookie || '';
                const cookieToken = cookieHeader
                    .split(';')
                    .map(c => c.trim())
                    .find(c => c.startsWith('report_token='))
                    ?.split('=')[1] || null;

                const token = queryToken || cookieToken;

                if (!token) {
                    return reply
                        .status(401)
                        .header('Content-Type', 'application/json')
                        .send({ success: false, error: 'Report access requires a valid token' });
                }

                if (!verifyReportToken(token, orgId, taskId)) {
                    return reply
                        .status(401)
                        .header('Content-Type', 'application/json')
                        .send({ success: false, error: 'Invalid or expired report token' });
                }

                // If token came from query string, set a path-scoped cookie for sub-resources
                if (queryToken) {
                    const cookiePath = `/reports/${orgId}/${taskId}/`;
                    reply.header(
                        'Set-Cookie',
                        `report_token=${queryToken}; Path=${cookiePath}; Max-Age=${REPORT_TOKEN_TTL}; HttpOnly; SameSite=Lax`,
                    );
                }
            }
            // Token valid — allow static file serving
            return;
        }

        // Root path
        if (request.url === '/' || request.url === '') {
            return;
        }

        // Check if route is public (using startsWith for prefix matching)
        const isPublic = publicPrefixes.some(prefix => request.url.startsWith(prefix));
        if (isPublic) {
            app.log.info(`[GlobalAuth] Skipping auth - public path: ${request.url}`);
            return;
        }

        // Apply auth middleware to all other routes
        app.log.info(`[GlobalAuth] Applying auth to: ${request.url}`);
        await authMiddleware(request, reply);

        // Apply rate limiting after authentication (uses organizationId from request.user)
        // Skip rate limiting for internal worker callbacks and lightweight metrics polling
        if (!request.url.startsWith('/executions/') && !request.url.startsWith('/api/metrics/')) {
            await apiRateLimit(request, reply);
        }
    });
}

