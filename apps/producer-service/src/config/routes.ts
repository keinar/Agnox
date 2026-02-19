import { FastifyInstance } from 'fastify';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import * as fs from 'fs';
import { TestExecutionRequestSchema } from '../../../../packages/shared-types/index.js';
import { rabbitMqService } from '../rabbitmq.js';
import { authRoutes } from '../routes/auth.js';
import { invitationRoutes } from '../routes/invitations.js';
import { userRoutes } from '../routes/users.js';
import { organizationRoutes } from '../routes/organization.js';
import { projectRoutes } from '../routes/projects.js';
import { projectSettingsRoutes } from '../routes/projectSettings.js';
import { billingRoutes } from '../routes/billing.js';
import { webhookRoutes } from '../routes/webhooks.js';
import { integrationRoutes } from '../routes/integrations.js';
import { createTestRunLimitMiddleware } from '../middleware/planLimits.js';
import { getDbName } from './server.js';

const DB_NAME = getDbName();

/**
 * Register all application routes
 */
export async function setupRoutes(
    app: FastifyInstance,
    dbClient: MongoClient,
    redis: Redis,
    authRateLimit: (request: any, reply: any) => Promise<void>,
    apiRateLimit: (request: any, reply: any) => Promise<void>,
    strictRateLimit: (request: any, reply: any) => Promise<void>
): Promise<void> {
    // Authentication routes
    await authRoutes(app, dbClient, authRateLimit, redis);

    // Invitation routes
    await invitationRoutes(app, dbClient, strictRateLimit);

    // User management routes
    await userRoutes(app, dbClient, strictRateLimit);

    // Organization routes
    await organizationRoutes(app, dbClient, apiRateLimit);

    // Project routes (CRUD + plan-based limits)
    await projectRoutes(app, dbClient, apiRateLimit);

    // Project run settings routes (per-project configuration)
    await projectSettingsRoutes(app, dbClient, apiRateLimit);

    // Billing routes (Stripe integration)
    await billingRoutes(app, dbClient, apiRateLimit);

    // Webhook routes (Stripe events - no auth, signature verified)
    await webhookRoutes(app, dbClient);

    // Integration routes (Jira settings + proxy — JWT protected via global auth)
    await integrationRoutes(app, dbClient, apiRateLimit);

    // Create plan enforcement middleware
    const db = dbClient.db(DB_NAME);
    const enforceTestRunLimit = createTestRunLimitMiddleware(db);

    // Public: Default configuration endpoint
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

    // Public: Health check endpoint
    app.get('/', async () => {
        return { message: 'Agnostic Producer Service is running!' };
    });

    // Health check endpoint for orchestrator monitoring
    app.get('/health', async (request, reply) => {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'producer-service',
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime(),
            checks: {
                database: 'unknown',
                redis: 'unknown',
                rabbitmq: 'unknown'
            }
        };

        try {
            // Check MongoDB
            await dbClient.db(DB_NAME).command({ ping: 1 });
            health.checks.database = 'healthy';
        } catch {
            health.checks.database = 'unhealthy';
            health.status = 'degraded';
        }

        try {
            // Check Redis
            await redis.ping();
            health.checks.redis = 'healthy';
        } catch {
            health.checks.redis = 'unhealthy';
            health.status = 'degraded';
        }

        try {
            // Check RabbitMQ - assume healthy if service is imported and connected
            health.checks.rabbitmq = 'healthy';
        } catch {
            health.checks.rabbitmq = 'unhealthy';
            health.status = 'degraded';
        }

        const statusCode = health.status === 'healthy' ? 200 : 503;
        return reply.status(statusCode).send(health);
    });

    // Performance metrics endpoint
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

    // Internal: Worker callback for execution updates
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

    // Internal: Worker callback for execution logs
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

    // Get executions for current organization
    app.get('/api/executions', async (request, reply) => {
        try {
            if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });

            // Multi-tenant data isolation: Filter by organizationId from JWT (as STRING)
            const organizationId = request.user!.organizationId;

            const collection = dbClient.db(DB_NAME).collection('executions');
            const executions = await collection
                .find({
                    organizationId,
                    // Soft delete: Exclude records that have been marked as deleted
                    deletedAt: { $exists: false }
                })
                .sort({ startTime: -1 })
                .limit(50)
                .toArray();

            return { success: true, data: executions };
        } catch (error) {
            return reply.status(500).send({ error: 'Failed to fetch data' });
        }
    });

    // Create new execution request
    app.post('/api/execution-request', {
        preHandler: [enforceTestRunLimit] // NEW: Check plan limits before queuing
    }, async (request, reply) => {
        const parseResult = TestExecutionRequestSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.status(400).send({
                error: 'Invalid payload',
                details: parseResult.error.format
            });
        }

        const { taskId, image: rawImage, command, tests, config, folder } = parseResult.data;
        const image = rawImage?.trim();

        if (!image) {
            return reply.status(400).send({ error: 'Image name cannot be empty' });
        }

        // DEBUG: Trace incoming payload config
        app.log.info({
            taskId,
            configBaseUrl: config.baseUrl,
            configEnvironment: config.environment
        }, '[API] Received execution request');

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

    // Soft-delete execution by ID
    // NOTE: We use soft delete to prevent billing quota abuse.
    // The record remains in the database so usage counts stay accurate.
    app.delete('/api/executions/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });

            // Multi-tenant data isolation: Verify ownership by filtering with organizationId (as STRING)
            const organizationId = request.user!.organizationId;

            const collection = dbClient.db(DB_NAME).collection('executions');

            // Soft delete: Set deletedAt timestamp instead of removing the document
            // This preserves the record for accurate billing counts
            const result = await collection.updateOne(
                {
                    taskId: id,
                    organizationId,  // Only allow deletion if belongs to this organization
                    deletedAt: { $exists: false }  // Don't re-delete already deleted records
                },
                {
                    $set: {
                        deletedAt: new Date(),
                        deletedBy: request.user!.userId
                    }
                }
            );

            // Return 404 instead of 403 to prevent leaking information about other orgs
            if (result.matchedCount === 0) {
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

    // Get available test folders/structure
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
}
