import * as dotenv from 'dotenv';
import * as path from 'path';
import Redis from 'ioredis';
import { createServer, connectToMongo, setupSocketIO } from './config/server.js';
import { setupSecurityHeaders, setupGlobalAuth } from './config/middleware.js';
import { setupRoutes } from './config/routes.js';
import { rabbitMqService } from './rabbitmq.js';
import { createAuthRateLimiter, createApiRateLimiter, createStrictRateLimiter, createCustomRateLimiter } from './middleware/rateLimiter.js';
import { initScheduler, stopAllJobs } from './utils/scheduler.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── Synchronous startup guard ────────────────────────────────────────────────
// Must run before any async logic so the process never starts in a broken state.
// These vars are read at module-load time by jwt.ts and other utilities, so a
// missing value would silently degrade security (e.g., undefined JWT secret).
const REQUIRED_ENV_VARS = ['PLATFORM_JWT_SECRET', 'PLATFORM_MONGO_URI', 'ENCRYPTION_KEY'] as const;
for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
        process.stderr.write(`[FATAL] Required environment variable "${varName}" is not set. Set it and restart.\n`);
        process.exit(1);
    }
}

// Validate MONITORING_SECRET_KEY strength when provided
if (process.env.MONITORING_SECRET_KEY !== undefined && process.env.MONITORING_SECRET_KEY.length < 32) {
    process.stderr.write('[FATAL] MONITORING_SECRET_KEY must be at least 32 characters long for security.\n');
    process.exit(1);
}

import { redis } from './config/redis.js';

/**
 * Main startup function
 * Orchestrates all service initialization in correct order
 */
const start = async () => {
    try {
        // Step 1: Create Fastify server with plugins (CORS, Socket.IO, static files)
        const app = createServer();

        // Step 2: Connect to external services
        await rabbitMqService.connect();
        const dbClient = await connectToMongo(app);

        // Step 3: Setup security headers
        setupSecurityHeaders(app);

        // Step 4: Create rate limiters
        const authRateLimit    = createAuthRateLimiter(redis);
        const apiRateLimit     = createApiRateLimiter(redis);
        const strictRateLimit  = createStrictRateLimiter(redis);
        // HIGH-2: dedicated limiter for worker callbacks — high ceiling to allow
        // legitimate burst from a 10-replica worker fleet, but not unbounded.
        const workerRateLimit  = createCustomRateLimiter(redis, 10_000, 60_000, 'rl:worker:cb:');

        // Step 5: Register all routes (auth, users, orgs, invitations, executions, etc.)
        await setupRoutes(app, dbClient, redis, authRateLimit, apiRateLimit, strictRateLimit);

        // Step 6: Setup global authentication middleware
        setupGlobalAuth(app, apiRateLimit, workerRateLimit);

        // Step 7: Start HTTP server
        await app.listen({ port: 3000, host: '0.0.0.0' });

        // Step 8: Setup Socket.IO connection handler (after server is listening)
        setupSocketIO(app);

        // Step 9: Initialize CRON scheduler (loads active schedules from DB)
        await initScheduler(dbClient);

        app.log.info('🚀 Producer Service started successfully');
        app.log.info('📍 Listening on port 3000');

        // Graceful shutdown: stop all cron jobs before the process exits
        const shutdown = () => {
            app.log.info('Received shutdown signal — stopping cron jobs...');
            stopAllJobs();
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (err) {
        process.stderr.write(`[FATAL] Producer service failed to start: ${(err as Error).message}\n`);
        process.exit(1);
    }
};

start();
