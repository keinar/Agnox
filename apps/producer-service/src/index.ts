import * as dotenv from 'dotenv';
import * as path from 'path';
import Redis from 'ioredis';
import { createServer, connectToMongo, setupSocketIO } from './config/server.js';
import { setupSecurityHeaders, setupGlobalAuth } from './config/middleware.js';
import { setupRoutes } from './config/routes.js';
import { rabbitMqService } from './rabbitmq.js';
import { createAuthRateLimiter, createApiRateLimiter, createStrictRateLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('🔍 Default Image from ENV:', process.env.DEFAULT_TEST_IMAGE);

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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
        const authRateLimit = createAuthRateLimiter(redis);
        const apiRateLimit = createApiRateLimiter(redis);
        const strictRateLimit = createStrictRateLimiter(redis);

        // Step 5: Register all routes (auth, users, orgs, invitations, executions, etc.)
        await setupRoutes(app, dbClient, redis, authRateLimit, apiRateLimit, strictRateLimit);

        // Step 6: Setup global authentication middleware
        setupGlobalAuth(app, apiRateLimit);

        // Step 7: Start HTTP server
        await app.listen({ port: 3000, host: '0.0.0.0' });

        // Step 8: Setup Socket.IO connection handler (after server is listening)
        setupSocketIO(app);

        app.log.info('🚀 Producer Service started successfully');
        app.log.info('📍 Listening on port 3000');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
