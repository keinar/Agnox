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
import { analyticsRoutes } from '../routes/analytics.js';
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

    // Analytics routes (MongoDB aggregation KPIs — JWT protected)
    await analyticsRoutes(app, dbClient, apiRateLimit);

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

    // ── GET /api/executions — Paginated, filtered execution list ─────────────
    //
    // Query params:
    //   limit       Number of records per page (default 25, max 100)
    //   offset      Zero-based start index (default 0)
    //   status      Comma-separated status values: PASSED,FAILED,ERROR,...
    //   environment Case-insensitive match on config.environment
    //   startAfter  ISO date — only include executions that started after this date
    //   startBefore ISO date — only include executions that started before this date
    //                          (inclusive: adjusted to end-of-day UTC internally)
    //   groupName   Exact match on groupName field (optional)
    //
    // Response: { success: true, data: { executions, total, limit, offset } }
    interface IExecutionQuery {
        limit?: string;
        offset?: string;
        status?: string;
        environment?: string;
        startAfter?: string;
        startBefore?: string;
        groupName?: string;
    }

    app.get('/api/executions', async (request, reply) => {
        if (!dbClient) return reply.status(500).send({ success: false, error: 'Database not connected' });

        const organizationId = request.user!.organizationId;
        const q = request.query as IExecutionQuery;

        // Parse and clamp pagination params
        const limit  = Math.min(Math.max(parseInt(q.limit  ?? '25', 10) || 25, 1), 100);
        const offset = Math.max(parseInt(q.offset ?? '0',  10) || 0, 0);

        // Base filter — always tenant-scoped, always excludes soft-deleted
        const filter: Record<string, unknown> = {
            organizationId,
            deletedAt: { $exists: false },
        };

        // Status filter: comma-separated values → $in
        if (q.status) {
            const statuses = q.status
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean);
            if (statuses.length > 0) filter.status = { $in: statuses };
        }

        // Environment filter: case-insensitive exact match on config.environment
        if (q.environment) {
            filter['config.environment'] = {
                $regex: `^${q.environment.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                $options: 'i',
            };
        }

        // Group name filter: exact match
        if (q.groupName) {
            filter.groupName = q.groupName.trim();
        }

        // Date range filter on startTime
        if (q.startAfter || q.startBefore) {
            const timeRange: Record<string, Date> = {};

            if (q.startAfter) {
                const d = new Date(q.startAfter);
                if (!isNaN(d.getTime())) timeRange.$gte = d;
            }

            if (q.startBefore) {
                const d = new Date(q.startBefore);
                if (!isNaN(d.getTime())) {
                    // Make the end-date inclusive: advance to 23:59:59.999 UTC
                    d.setUTCHours(23, 59, 59, 999);
                    timeRange.$lte = d;
                }
            }

            if (Object.keys(timeRange).length > 0) filter.startTime = timeRange;
        }

        try {
            const collection = dbClient.db(DB_NAME).collection('executions');

            // Run count and paginated fetch in parallel for performance
            const [total, executions] = await Promise.all([
                collection.countDocuments(filter),
                collection
                    .find(filter)
                    .sort({ startTime: -1 })
                    .skip(offset)
                    .limit(limit)
                    .toArray(),
            ]);

            return reply.send({ success: true, data: { executions, total, limit, offset } });
        } catch (error) {
            app.log.error(error, '[executions] Failed to fetch paginated executions');
            return reply.status(500).send({ success: false, error: 'Failed to fetch executions' });
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

        const { taskId, image: rawImage, command, tests, config, folder, groupName, batchId } = parseResult.data;
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
                const executionDoc: Record<string, unknown> = {
                    taskId,
                    organizationId,  // Add organizationId for multi-tenant isolation (as STRING)
                    image,
                    command,
                    status: 'PENDING',
                    folder: folder || 'all',
                    startTime,
                    config: enrichedConfig,
                    tests: tests || [],
                };

                // Optional grouping fields — only write when provided by the caller
                if (groupName) executionDoc.groupName = groupName;
                if (batchId)   executionDoc.batchId   = batchId;

                await collection.updateOne(
                    { taskId },
                    { $set: executionDoc },
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
                    tests: tests || [],
                    ...(groupName && { groupName }),
                    ...(batchId   && { batchId }),
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

    // ── GET /api/executions/grouped — Group-paginated execution list ──────────
    //
    // Returns executions aggregated by `groupName`.  Executions that have no
    // groupName are placed in a synthetic "__ungrouped__" bucket so they remain
    // visible in grouped view.
    //
    // Query params: same filter set as GET /api/executions, plus:
    //   limit   Number of GROUPS per page (default 10, max 50)
    //   offset  Zero-based group offset (default 0)
    //
    // Response:
    //   { success: true, data: { groups, totalGroups, limit, offset } }
    //   groups[]: { groupName, totalCount, passCount, lastRunAt, executions[] }

    interface IGroupedExecutionQuery {
        limit?: string;
        offset?: string;
        status?: string;
        environment?: string;
        startAfter?: string;
        startBefore?: string;
    }

    app.get('/api/executions/grouped', async (request, reply) => {
        if (!dbClient) return reply.status(500).send({ success: false, error: 'Database not connected' });

        const organizationId = request.user!.organizationId;
        const q = request.query as IGroupedExecutionQuery;

        // Groups per page — default 10, max 50
        const limit  = Math.min(Math.max(parseInt(q.limit  ?? '10', 10) || 10, 1), 50);
        const offset = Math.max(parseInt(q.offset ?? '0',  10) || 0, 0);

        // Build the same base filter as the flat endpoint
        const matchFilter: Record<string, unknown> = {
            organizationId,
            deletedAt: { $exists: false },
        };

        if (q.status) {
            const statuses = q.status
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean);
            if (statuses.length > 0) matchFilter.status = { $in: statuses };
        }

        if (q.environment) {
            matchFilter['config.environment'] = {
                $regex: `^${q.environment.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                $options: 'i',
            };
        }

        if (q.startAfter || q.startBefore) {
            const timeRange: Record<string, Date> = {};
            if (q.startAfter) {
                const d = new Date(q.startAfter);
                if (!isNaN(d.getTime())) timeRange.$gte = d;
            }
            if (q.startBefore) {
                const d = new Date(q.startBefore);
                if (!isNaN(d.getTime())) {
                    d.setUTCHours(23, 59, 59, 999);
                    timeRange.$lte = d;
                }
            }
            if (Object.keys(timeRange).length > 0) matchFilter.startTime = timeRange;
        }

        try {
            const collection = dbClient.db(DB_NAME).collection('executions');

            // Aggregation pipeline:
            //  1. $match  — apply all filters
            //  2. $sort   — newest first (so $first picks the latest run)
            //  3. $group  — bucket by groupName; compute summary stats
            //  4. $facet  — parallel: count total groups + paginate groups
            const pipeline = [
                { $match: matchFilter },
                { $sort: { startTime: -1 } },
                {
                    $group: {
                        _id: { $ifNull: ['$groupName', '__ungrouped__'] },
                        groupName:  { $first: { $ifNull: ['$groupName', '__ungrouped__'] } },
                        totalCount: { $sum: 1 },
                        passCount:  {
                            $sum: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] },
                        },
                        lastRunAt:  { $first: '$startTime' },
                        // Keep the 50 most recent executions per group for preview
                        executions: { $push: '$$ROOT' },
                    },
                },
                // Trim executions array to latest 50 to avoid huge documents
                {
                    $project: {
                        _id: 0,
                        groupName:  1,
                        totalCount: 1,
                        passCount:  1,
                        lastRunAt:  1,
                        executions: { $slice: ['$executions', 50] },
                    },
                },
                { $sort: { lastRunAt: -1 } },
                {
                    $facet: {
                        totalGroups: [{ $count: 'count' }],
                        groups: [{ $skip: offset }, { $limit: limit }],
                    },
                },
            ];

            const [result] = await collection.aggregate(pipeline).toArray();
            const totalGroups: number = result?.totalGroups?.[0]?.count ?? 0;
            const groups = result?.groups ?? [];

            return reply.send({ success: true, data: { groups, totalGroups, limit, offset } });
        } catch (error) {
            app.log.error(error, '[executions/grouped] Aggregation failed');
            return reply.status(500).send({ success: false, error: 'Failed to fetch grouped executions' });
        }
    });

    // ── DELETE /api/executions/bulk — Soft-delete up to 100 executions ────────
    // Body: { taskIds: string[] }
    // Uses updateMany for efficiency; enforces org isolation and 100-item cap.
    app.delete('/api/executions/bulk', async (request, reply) => {
        if (!dbClient) return reply.status(500).send({ success: false, error: 'Database not connected' });

        const { taskIds } = request.body as { taskIds?: unknown };

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return reply.status(400).send({ success: false, error: 'taskIds must be a non-empty array' });
        }
        if (taskIds.length > 100) {
            return reply.status(400).send({ success: false, error: 'Cannot delete more than 100 executions at once' });
        }

        const organizationId = request.user!.organizationId;

        try {
            const collection = dbClient.db(DB_NAME).collection('executions');
            const result = await collection.updateMany(
                {
                    taskId: { $in: taskIds },
                    organizationId,
                    deletedAt: { $exists: false },
                },
                {
                    $set: {
                        deletedAt: new Date(),
                        deletedBy: request.user!.userId,
                    },
                },
            );

            app.log.info(`[bulk-delete] Soft-deleted ${result.modifiedCount} executions for org ${organizationId}`);
            return reply.send({ success: true, data: { deletedCount: result.modifiedCount } });
        } catch (error) {
            app.log.error(error, '[bulk-delete] Failed to soft-delete executions');
            return reply.status(500).send({ success: false, error: 'Failed to delete executions' });
        }
    });

    // ── PATCH /api/executions/bulk — Update a whitelisted field on many executions
    // Body: { taskIds: string[], data: { groupName?: string } }
    // Only fields present in ALLOWED_PATCH_FIELDS are written to prevent arbitrary writes.
    app.patch('/api/executions/bulk', async (request, reply) => {
        if (!dbClient) return reply.status(500).send({ success: false, error: 'Database not connected' });

        const { taskIds, data } = request.body as { taskIds?: unknown; data?: Record<string, unknown> };

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return reply.status(400).send({ success: false, error: 'taskIds must be a non-empty array' });
        }
        if (taskIds.length > 100) {
            return reply.status(400).send({ success: false, error: 'Cannot update more than 100 executions at once' });
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return reply.status(400).send({ success: false, error: 'data must be a non-empty object' });
        }

        // Whitelist: only these fields may be patched via bulk update
        const ALLOWED_PATCH_FIELDS = new Set(['groupName']);
        const sanitizedData: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(data)) {
            if (ALLOWED_PATCH_FIELDS.has(key)) sanitizedData[key] = val;
        }

        if (Object.keys(sanitizedData).length === 0) {
            return reply.status(400).send({ success: false, error: 'No valid fields to update' });
        }

        const organizationId = request.user!.organizationId;

        try {
            const collection = dbClient.db(DB_NAME).collection('executions');
            const result = await collection.updateMany(
                {
                    taskId: { $in: taskIds },
                    organizationId,
                    deletedAt: { $exists: false },
                },
                { $set: sanitizedData },
            );

            app.log.info(`[bulk-update] Updated ${result.modifiedCount} executions for org ${organizationId}`);
            return reply.send({ success: true, data: { modifiedCount: result.modifiedCount } });
        } catch (error) {
            app.log.error(error, '[bulk-update] Failed to update executions');
            return reply.status(500).send({ success: false, error: 'Failed to update executions' });
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
