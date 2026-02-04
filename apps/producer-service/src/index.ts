import fastify from 'fastify';
import socketio from 'fastify-socket.io';
import cors from '@fastify/cors';
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { rabbitMqService } from './rabbitmq.js';
import { TestExecutionRequestSchema } from '../../../packages/shared-types/index.js';
import fastifyStatic from '@fastify/static';
import type { Server } from 'socket.io';
import * as fs from 'fs';
import Redis from 'ioredis';
import { authRoutes } from './routes/auth.js';
import { invitationRoutes } from './routes/invitations.js';
import { userRoutes } from './routes/users.js';
import { organizationRoutes } from './routes/organization.js';
import { authMiddleware } from './middleware/auth.js';
import { verifyToken } from './utils/jwt.js';
import { createAuthRateLimiter, createApiRateLimiter, createStrictRateLimiter } from './middleware/rateLimiter.js';

declare module 'fastify' {
    interface FastifyInstance {
        io: Server;
    }
}

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('🔍 Default Image from ENV:', process.env.DEFAULT_TEST_IMAGE);

const app = fastify({ logger: true });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://automation-mongodb:27017/automation_platform';
const DB_NAME = 'automation_platform';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

let dbClient: MongoClient;

// Task 4.4: CORS Production Configuration
// Per Security Audit Recommendation: Restrict origins based on environment
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim())
    : ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'];

app.register(cors, {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, Postman, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        // Check if origin is in allowed list
        if (ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            app.log.warn({ event: 'CORS_BLOCKED', origin, allowed: ALLOWED_ORIGINS });
            return callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.register(socketio, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Security Headers (Task 4.2 - Security Enhancements)
// Per Security Audit Recommendation: Add security headers to all responses
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

const REPORTS_DIR = process.env.REPORTS_DIR || path.join(process.cwd(), 'reports');

if (!fs.existsSync(REPORTS_DIR)) {
    console.log(`⚠️ Reports directory not found at ${REPORTS_DIR}, creating it...`);
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log(`📂 Serving static reports from: ${REPORTS_DIR}`);

app.register(fastifyStatic, {
    root: REPORTS_DIR,
    prefix: '/reports/',
    index: ['index.html'],
    list: false,
    decorateReply: false
});

app.get('/config/defaults', async (request, reply) => {
    const envMapping: Record<string, string> = {};

    if (process.env.DEFAULT_BASE_URL) envMapping.development = process.env.DEFAULT_BASE_URL;
    if (process.env.STAGING_URL) envMapping.staging = process.env.STAGING_URL;
    if (process.env.PRODUCTION_URL) envMapping.production = process.env.PRODUCTION_URL;

    return reply.send({
        image: process.env.DEFAULT_TEST_IMAGE || '',
        baseUrl: process.env.DEFAULT_BASE_URL || '',
        folder: process.env.DEFAULT_TEST_FOLDER || 'all',
        envMapping
    });
});

app.get('/', async () => {
    return { message: 'Agnostic Producer Service is running!' };
});

/**
 * GET Performance insights for a specific image/suite
 */
app.get('/api/metrics/:image', async (request, reply) => {
    const { image } = request.params as { image: string };
    // Scope Redis keys by organization for multi-tenant isolation
    const organizationId = request.user?.organizationId || 'global';
    const key = `metrics:${organizationId}:test:${image}`;

    try {
        // Fetch last 10 durations
        const durations = await redis.lrange(key, 0, -1);

        if (durations.length === 0) {
            return { averageDuration: 0, status: 'NO_DATA' };
        }

        const numbers = durations.map(Number);
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;

        return {
            averageDuration: Math.round(avg),
            lastRunDuration: numbers[0],
            sampleSize: numbers.length,
            // Senior insight: Is the last run significantly slower than average?
            isRegression: numbers[0] > avg * 1.2 // 20% slower than usual
        };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch metrics' });
    }
});

app.post('/executions/update', async (request, reply) => {
    const updateData = request.body as any;

    // Multi-tenant: Broadcast only to the organization's room
    if (updateData.organizationId) {
        const orgRoom = `org:${updateData.organizationId}`;
        app.io.to(orgRoom).emit('execution-updated', updateData);
        app.log.info(`📡 Broadcast execution-updated to room ${orgRoom} (taskId: ${updateData.taskId})`);
    } else {
        // Fallback: Global broadcast (for backwards compatibility during transition)
        app.io.emit('execution-updated', updateData);
        app.log.warn(`⚠️  Execution update missing organizationId (taskId: ${updateData.taskId}), broadcasting globally`);
    }

    return { status: 'broadcasted' };
});

app.post('/executions/log', async (request, reply) => {
    const { taskId, log, organizationId } = request.body as { taskId: string; log: string; organizationId?: string };

    // Multi-tenant: Broadcast only to the organization's room
    if (organizationId) {
        const orgRoom = `org:${organizationId}`;
        app.io.to(orgRoom).emit('execution-log', { taskId, log });
        // Don't log every line (too verbose), only log if needed for debugging
        // app.log.debug(`📡 Broadcast log to room ${orgRoom} (taskId: ${taskId})`);
    } else {
        // Fallback: Global broadcast (for backwards compatibility during transition)
        app.io.emit('execution-log', { taskId, log });
        app.log.warn(`⚠️  Log broadcast missing organizationId (taskId: ${taskId}), broadcasting globally`);
    }

    return { status: 'ok' };
});

async function connectToMongo() {
    try {
        dbClient = new MongoClient(MONGO_URI);
        await dbClient.connect();
        app.log.info('Producer connected to MongoDB');
    } catch (error) {
        app.log.error({ msg: 'Failed to connect to Mongo', error });
    }
}

app.get('/api/executions', async (request, reply) => {
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });

        // Multi-tenant data isolation: Filter by organizationId from JWT (as STRING)
        const organizationId = request.user!.organizationId;

        const collection = dbClient.db(DB_NAME).collection('executions');
        const executions = await collection
            .find({ organizationId })
            .sort({ startTime: -1 })
            .limit(50)
            .toArray();

        return { success: true, data: executions };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch data' });
    }
});

/**
 * Agnostic Execution Request
 * supports custom Docker images and commands
 */
app.post('/api/execution-request', async (request, reply) => {
    const parseResult = TestExecutionRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
        return reply.status(400).send({
            error: 'Invalid payload',
            details: parseResult.error.format
        });
    }

    const { taskId, image, command, tests, config, folder } = parseResult.data;

    try {
        const startTime = new Date();

        const envVarsToInject: Record<string, string> = {};

        const varsToInject = (process.env.INJECT_ENV_VARS || '').split(',');

        varsToInject.forEach(varName => {
            const name = varName.trim();
            if (name && process.env[name]) {
                envVarsToInject[name] = process.env[name]!;
            }
        });

        const enrichedConfig = {
            ...config,
            envVars: {
                ...(config?.envVars || {}),
                ...envVarsToInject
            }
        };

        // Multi-tenant data isolation: Include organizationId from JWT (as STRING)
        const organizationId = request.user!.organizationId;

        const taskData = {
            ...parseResult.data,
            organizationId,  // Include organizationId for worker
            folder: folder || 'all',
            config: {
            ...enrichedConfig
        }
        };

        if (dbClient) {

            const collection = dbClient.db(DB_NAME).collection('executions');
            await collection.updateOne(
                { taskId },
                {
                    $set: {
                        taskId,
                        organizationId,  // Add organizationId for multi-tenant isolation (as STRING)
                        image,
                        command,
                        status: 'PENDING',
                        folder: folder || 'all',
                        startTime,
                        config: enrichedConfig,
                        tests: tests || []
                    }
                },
                { upsert: true }
            );

            // Multi-tenant: Broadcast only to the organization's room
            const orgRoom = `org:${organizationId}`;
            app.io.to(orgRoom).emit('execution-updated', {
                taskId,
                organizationId,  // Include in broadcast
                status: 'PENDING',
                startTime,
                image,
                command,
                config: enrichedConfig,
                tests: tests || []
            });
            app.log.info(`📡 Broadcast execution-updated to room ${orgRoom} (taskId: ${taskId}, status: PENDING)`);
        }

        await rabbitMqService.sendToQueue(taskData);

        app.log.info(`Job ${taskId} queued using image: ${image}`);
        return reply.status(200).send({ status: 'Message queued successfully', taskId });

    } catch (error) {
        app.log.error(error);
        reply.status(500).send({ status: 'Failed to queue message' });
    }
});

app.delete('/api/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });

        // Multi-tenant data isolation: Verify ownership by filtering with organizationId (as STRING)
        const organizationId = request.user!.organizationId;

        const collection = dbClient.db(DB_NAME).collection('executions');
        const result = await collection.deleteOne({
            taskId: id,
            organizationId  // Only delete if belongs to this organization
        });

        // Return 404 instead of 403 to prevent leaking information about other orgs
        if (result.deletedCount === 0) {
            return reply.status(404).send({
                success: false,
                error: 'Execution not found'
            });
        }

        return { success: true, message: 'Execution deleted successfully' };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to delete' });
    }
});

app.get('/api/tests-structure', async (request, reply) => {
    const testsPath = '/app/tests-source';
    try {
        if (!fs.existsSync(testsPath)) {
            return reply.header('Content-Type', 'application/json').send([]);
        }

        const items = fs.readdirSync(testsPath, { withFileTypes: true });
        const folders = items
            .filter(item => item.isDirectory())
            .map(item => item.name);

        return reply.header('Content-Type', 'application/json').send(folders);
    } catch (error) {
        app.log.error(error, "Error reading tests structure");
        return reply.header('Content-Type', 'application/json').send([]);
    }
});

const start = async () => {
    try {
        await rabbitMqService.connect();
        await connectToMongo();

        // Create rate limiter instances
        const authRateLimit = createAuthRateLimiter(redis);
        const apiRateLimit = createApiRateLimiter(redis);
        const strictRateLimit = createStrictRateLimiter(redis);

        // Register authentication routes (with auth rate limiter and Redis for login tracking)
        await authRoutes(app, dbClient, authRateLimit, redis);

        // Register invitation routes (with strict rate limiter for admin actions)
        await invitationRoutes(app, dbClient, strictRateLimit);

        // Register user management routes (with strict rate limiter for admin actions)
        await userRoutes(app, dbClient, strictRateLimit);

        // Register organization routes (with API rate limiter)
        await organizationRoutes(app, dbClient, apiRateLimit);

        // Global authentication middleware
        // Apply auth to all /api/* routes except auth endpoints
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

        await app.listen({ port: 3000, host: '0.0.0.0' });

        // Socket.io connection with JWT authentication and room-based broadcasting
        app.io.on('connection', (socket) => {
            // Extract JWT token from handshake
            const token = socket.handshake.auth?.token;

            if (!token) {
                app.log.warn(`Socket connection rejected: No token provided (socket: ${socket.id})`);
                socket.emit('auth-error', { error: 'Authentication required' });
                socket.disconnect();
                return;
            }

            // Verify JWT token
            const payload = verifyToken(token);

            if (!payload) {
                app.log.warn(`Socket connection rejected: Invalid token (socket: ${socket.id})`);
                socket.emit('auth-error', { error: 'Invalid or expired token' });
                socket.disconnect();
                return;
            }

            // Multi-tenant: Join organization-specific room
            const orgRoom = `org:${payload.organizationId}`;
            socket.join(orgRoom);

            app.log.info(`✅ Socket ${socket.id} connected for user ${payload.userId} (${payload.role}) in organization ${payload.organizationId}`);
            app.log.info(`   Joined room: ${orgRoom}`);

            // Send confirmation to client
            socket.emit('auth-success', {
                message: 'Connected to organization channel',
                organizationId: payload.organizationId,
                userId: payload.userId,
                role: payload.role
            });

            socket.on('disconnect', () => {
                app.log.info(`Socket ${socket.id} disconnected from room ${orgRoom}`);
            });
        });

        app.log.info('🚀 Producer Service started successfully');
        app.log.info('📍 Listening on port 3000');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();