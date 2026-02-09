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
    app.addHook('preHandler', async (request, reply) => {
        // Debug logging
        console.log(`[GlobalAuth] ${request.method} ${request.url}`);

        // Socket.io handshake - skip auth middleware (handled separately in Socket.io connection handler)
        if (request.url.startsWith('/socket.io/')) {
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
            '/executions/update',  // Internal worker callback
            '/executions/log',     // Internal worker callback
            '/health'
        ];

        // Invitation validation endpoint (public)
        if (request.url.startsWith('/api/invitations/validate/')) {
            console.log('[GlobalAuth] Skipping - invitation validation');
            return;
        }

        // Static files (reports) - no auth
        if (request.url.startsWith('/reports/')) {
            console.log('[GlobalAuth] Skipping - reports');
            return;
        }

        // Root path
        if (request.url === '/' || request.url === '') {
            return;
        }

        // Check if route is public (using startsWith for prefix matching)
        const isPublic = publicPrefixes.some(prefix => request.url.startsWith(prefix));
        if (isPublic) {
            console.log(`[GlobalAuth] Skipping auth - public path: ${request.url}`);
            return;
        }

        // Apply auth middleware to all other routes
        console.log(`[GlobalAuth] Applying auth to: ${request.url}`);
        await authMiddleware(request, reply);

        // Apply rate limiting after authentication (uses organizationId from request.user)
        // Skip rate limiting for internal worker callbacks
        if (!request.url.startsWith('/executions/')) {
            await apiRateLimit(request, reply);
        }
    });
}
