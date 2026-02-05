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
        // Socket.io handshake - skip auth middleware (handled separately in Socket.io connection handler)
        if (request.url.startsWith('/socket.io/')) {
            return;
        }

        // Public routes - no authentication required
        const publicRoutes = [
            '/',
            '/api/auth/signup',
            '/api/auth/login',
            '/config/defaults',
            '/executions/update',  // Internal worker callback
            '/executions/log'      // Internal worker callback
        ];

        // Invitation validation endpoint (public)
        if (request.url.startsWith('/api/invitations/validate/')) {
            return;
        }

        // Static files (reports) - no auth
        if (request.url.startsWith('/reports/')) {
            return;
        }

        // Check if route is public
        if (publicRoutes.includes(request.url)) {
            return;
        }

        // Apply auth middleware to all other routes
        await authMiddleware(request, reply);

        // Apply rate limiting after authentication (uses organizationId from request.user)
        // Skip rate limiting for internal worker callbacks
        if (!request.url.startsWith('/executions/')) {
            await apiRateLimit(request, reply);
        }
    });
}
