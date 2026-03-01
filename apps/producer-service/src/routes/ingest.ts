import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getDbName } from '../config/server.js';
import { createApiKeyAuthMiddleware } from '../middleware/auth.js';
import { createCustomRateLimiter } from '../middleware/rateLimiter.js';
import type { IIngestSession } from '../../../../packages/shared-types/index.js';

const DB_NAME = getDbName();

// ── Redis key constants ──────────────────────────────────────────────────────
const SESSION_KEY_PREFIX = 'ingest:session:';
const RESULTS_KEY_PREFIX = 'ingest:results:';
const SESSION_TTL_SECONDS = 86400;      // 24 hours
const LOG_TTL_SECONDS = 4 * 3600;       // 4 hours — matches worker callback pattern

// ── In-memory session fallback (used when Redis is unavailable) ─────────────
// Prevents a Redis blip from completely blocking an in-flight CI run.
// Only effective for single-instance deployments; multi-instance relies on Redis.
const SESSION_MEMORY_FALLBACK = new Map<string, { session: IIngestSession; expiresAt: number }>();

// Periodic cleanup to prevent unbounded growth
const _fallbackCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of SESSION_MEMORY_FALLBACK) {
        if (entry.expiresAt < now) SESSION_MEMORY_FALLBACK.delete(key);
    }
}, 60_000);
// Prevent the interval from blocking process exit
_fallbackCleanupTimer.unref();

// ── Zod Validation Schemas ───────────────────────────────────────────────────

const CiContextSchema = z.object({
    source: z.enum(['github', 'gitlab', 'azure', 'jenkins', 'local']),
    repository: z.string().max(300).optional(),
    branch: z.string().max(255).optional(),
    prNumber: z.number().int().positive().optional(),
    commitSha: z.string().max(64).optional(),
    runUrl: z.string().url().max(500).optional(),
});

const SetupRequestSchema = z.object({
    projectId: z.string().min(1).max(100),
    runName: z.string().max(200).optional(),
    framework: z.enum(['playwright', 'jest', 'vitest', 'cypress']),
    reporterVersion: z.string().min(1).max(50),
    totalTests: z.number().int().min(0).max(100_000),
    environment: z.enum(['development', 'staging', 'production']).optional().default('production'),
    ciContext: CiContextSchema.optional(),
});

// Discriminated union ensures each event type has its required fields only
const IngestEventSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('log'),
        testId: z.string().max(500).optional(),
        chunk: z.string().max(8192),
        timestamp: z.number().int(),
    }),
    z.object({
        type: z.literal('test-begin'),
        testId: z.string().min(1).max(500),
        title: z.string().max(1000),
        file: z.string().max(500),
        timestamp: z.number().int(),
    }),
    z.object({
        type: z.literal('test-end'),
        testId: z.string().min(1).max(500),
        status: z.enum(['passed', 'failed', 'skipped', 'timedOut']),
        duration: z.number().int().min(0),
        error: z.string().max(8192).optional(),
        timestamp: z.number().int(),
    }),
    z.object({
        type: z.literal('status'),
        status: z.enum(['RUNNING', 'ANALYZING']),
        timestamp: z.number().int(),
    }),
]);

const EventBatchSchema = z.object({
    sessionId: z.string().uuid(),
    // min 1 prevents empty-body noise; max 100 caps per-request memory
    events: z.array(IngestEventSchema).min(1).max(100),
});

const TeardownRequestSchema = z.object({
    sessionId: z.string().uuid(),
    status: z.enum(['PASSED', 'FAILED']),
    summary: z.object({
        total: z.number().int().min(0),
        passed: z.number().int().min(0),
        failed: z.number().int().min(0),
        skipped: z.number().int().min(0),
        duration: z.number().int().min(0),
    }),
});

// ── Session resolver — Redis with in-memory fallback ────────────────────────
async function resolveSession(redis: Redis, sessionId: string): Promise<IIngestSession | null> {
    try {
        const raw = await redis.get(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (raw) return JSON.parse(raw) as IIngestSession;
    } catch {
        // Redis unavailable — fall through to in-memory store
    }

    const entry = SESSION_MEMORY_FALLBACK.get(sessionId);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.session;
}

// ── Route Registration ────────────────────────────────────────────────────────
export async function ingestRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    redis: Redis,
): Promise<void> {
    const db = mongoClient.db(DB_NAME);
    const apiKeyAuth = createApiKeyAuthMiddleware(db);

    // Approved higher-burst tier for /api/ingest/event (500 req/min per org).
    // Reporters batch events every 2 s, so this allows ~8 batches/second before throttling.
    const ingestEventRateLimit = createCustomRateLimiter(
        redis,
        500,
        60_000,
        'rl:ingest:event:',
        'Ingest event rate limit exceeded. Reduce your reporter flush frequency.',
    );

    // Standard rate for setup/teardown — each is called once per test run
    const ingestLifecycleRateLimit = createCustomRateLimiter(
        redis,
        100,
        60_000,
        'rl:ingest:lifecycle:',
        'Ingest lifecycle rate limit exceeded.',
    );

    const projectsCollection = db.collection('projects');
    const cyclesCollection = db.collection('test_cycles');
    const executionsCollection = db.collection('executions');
    const ingestSessionsCollection = db.collection('ingest_sessions');

    // ── POST /api/ingest/setup ────────────────────────────────────────────────
    //
    // Called once at the start of an external CI run. Creates the TestCycle,
    // Execution, and Redis session. Returns sessionId for subsequent calls.
    app.post(
        '/api/ingest/setup',
        { preHandler: [apiKeyAuth, ingestLifecycleRateLimit] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const organizationId = request.user!.organizationId;

            const parseResult = SetupRequestSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid setup payload',
                    details: parseResult.error.format(),
                });
            }

            const { projectId, runName, framework, reporterVersion, totalTests, environment, ciContext } =
                parseResult.data;

            try {
                // Security: verify the project exists and belongs to this org (prevents IDOR)
                const project = await projectsCollection.findOne({
                    _id: new ObjectId(projectId),
                    organizationId,
                });

                if (!project) {
                    return reply.status(403).send({
                        success: false,
                        error: 'Project not found or access denied',
                    });
                }

                // Generate all IDs up front to keep DB writes atomic
                const now = new Date();
                const sessionId = randomUUID();
                const taskId = `ingest-${now.getTime()}-${sessionId.slice(0, 8)}`;
                const cycleId = new ObjectId();
                const cycleItemId = randomUUID();
                const cycleName = runName ?? `External CI — ${now.toISOString()}`;

                // Create parent TestCycle
                const newCycle = {
                    _id: cycleId,
                    organizationId,
                    projectId,
                    name: cycleName,
                    status: 'RUNNING',
                    source: 'external-ci',
                    ciContext: ciContext ?? null,
                    items: [
                        {
                            id: cycleItemId,
                            testCaseId: 'ingest-auto-generated',
                            type: 'AUTOMATED',
                            title: `External CI Run (${framework})`,
                            status: 'RUNNING',
                            executionId: taskId,
                        },
                    ],
                    summary: {
                        total: totalTests,
                        passed: 0,
                        failed: 0,
                        automationRate: 100,
                    },
                    createdAt: now,
                    createdBy: request.user!.userId,
                };

                await cyclesCollection.insertOne(newCycle);

                // Create Execution document.
                // `image: 'external-ci'` is the sentinel value — no Docker image for passive runs.
                const executionDoc = {
                    taskId,
                    organizationId,
                    cycleId: cycleId.toString(),
                    cycleItemId,
                    image: 'external-ci',
                    command: `${framework} (external reporter)`,
                    status: 'RUNNING',
                    source: 'external-ci',
                    folder: 'all',
                    startTime: now,
                    config: { environment, envVars: {} },
                    tests: [],
                    trigger: ciContext?.source ?? 'webhook',
                    ingestMeta: {
                        sessionId,
                        reporterVersion,
                        framework,
                        totalTests,
                        ciContext: ciContext ?? null,
                    },
                };

                await executionsCollection.insertOne(executionDoc);

                // Store session in Redis with 24-hour TTL
                const sessionData: IIngestSession = {
                    sessionId,
                    organizationId,
                    projectId,
                    taskId,
                    cycleId: cycleId.toString(),
                    cycleItemId,
                    projectName: project.name as string,
                    status: 'RUNNING',
                    framework,
                    reporterVersion,
                    totalTests,
                    startTime: now,
                    createdAt: now,
                };

                try {
                    await redis.set(
                        `${SESSION_KEY_PREFIX}${sessionId}`,
                        JSON.stringify(sessionData),
                        'EX',
                        SESSION_TTL_SECONDS,
                    );
                } catch (redisErr: unknown) {
                    // Redis unavailable — fall back to in-memory store
                    app.log.warn(
                        { sessionId, err: String(redisErr) },
                        '[ingest] Redis unavailable; session stored in-memory (single-instance fallback)',
                    );
                    SESSION_MEMORY_FALLBACK.set(sessionId, {
                        session: sessionData,
                        expiresAt: Date.now() + 4 * 3600 * 1000, // 4h in-memory TTL
                    });
                }

                // Broadcast new execution to the org room so the dashboard reflects it immediately
                const orgRoom = `org:${organizationId}`;
                app.io.to(orgRoom).emit('execution-updated', executionDoc);

                app.log.info(
                    { organizationId, taskId, sessionId, framework },
                    '[ingest] Session created successfully',
                );

                return reply.status(201).send({
                    success: true,
                    data: { sessionId, taskId, cycleId: cycleId.toString() },
                });

            } catch (error: unknown) {
                app.log.error(error, '[ingest] Failed to create ingest session');
                return reply.status(500).send({
                    success: false,
                    error: 'Internal server error while creating ingest session',
                });
            }
        },
    );

    // ── POST /api/ingest/event ────────────────────────────────────────────────
    //
    // Called frequently by the reporter (every 2 s or every 50 events).
    // Streams log chunks into Redis and Socket.IO — no DB writes during streaming.
    // Returns 200 immediately (fire-and-forget) to avoid blocking the reporter.
    app.post(
        '/api/ingest/event',
        { preHandler: [apiKeyAuth, ingestEventRateLimit] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const organizationId = request.user!.organizationId;

            const parseResult = EventBatchSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid event batch',
                    details: parseResult.error.format(),
                });
            }

            const { sessionId, events } = parseResult.data;

            // Resolve session — Redis-first with in-memory fallback
            const session = await resolveSession(redis, sessionId);
            if (!session) {
                return reply.status(404).send({
                    success: false,
                    error: 'Session not found or expired',
                });
            }

            // Security: ensure the session's org matches the authenticated caller
            if (session.organizationId !== organizationId) {
                return reply.status(403).send({
                    success: false,
                    error: 'Session does not belong to your organization',
                });
            }

            const { taskId } = session;
            const orgRoom = `org:${organizationId}`;
            const logKey = `live:logs:${taskId}`;
            const resultsKey = `${RESULTS_KEY_PREFIX}${sessionId}`;

            // Build a single Redis pipeline for the entire batch — one round-trip
            const pipeline = redis.pipeline();
            let touchedLogKey = false;

            for (const event of events) {
                if (event.type === 'log') {
                    // Append raw log chunk — identical to how the worker callback buffers logs
                    pipeline.append(logKey, `${event.chunk}\n`);
                    touchedLogKey = true;
                    // Emit live to dashboard terminal
                    app.io.to(orgRoom).emit('execution-log', { taskId, log: event.chunk });

                } else if (event.type === 'test-begin') {
                    const msg = `▶ RUNNING  ${event.title}`;
                    pipeline.append(logKey, `${msg}\n`);
                    touchedLogKey = true;
                    app.io.to(orgRoom).emit('execution-log', { taskId, log: msg });

                } else if (event.type === 'test-end') {
                    const icon = event.status === 'passed' ? '✔' : event.status === 'skipped' ? '–' : '✘';
                    const statusLabel = event.status.toUpperCase().padEnd(8);
                    const durationLabel = `(${event.duration}ms)`;
                    const errorSuffix = event.error ? `\n  Error: ${event.error}` : '';
                    const msg = `${icon} ${statusLabel} ${event.testId} ${durationLabel}${errorSuffix}`;

                    pipeline.append(logKey, `${msg}\n`);
                    touchedLogKey = true;

                    // Buffer the structured result for teardown to drain and persist
                    pipeline.rpush(
                        resultsKey,
                        JSON.stringify({
                            testId: event.testId,
                            status: event.status,
                            duration: event.duration,
                            error: event.error ?? null,
                            timestamp: event.timestamp,
                        }),
                    );

                    app.io.to(orgRoom).emit('execution-log', { taskId, log: msg });

                } else if (event.type === 'status') {
                    // Propagate status transitions (e.g. RUNNING → ANALYZING) to the dashboard badge
                    app.io.to(orgRoom).emit('execution-updated', {
                        taskId,
                        organizationId,
                        status: event.status,
                    });
                }
            }

            // Set log TTL once per batch (not per event) to cap Redis memory usage
            if (touchedLogKey) {
                pipeline.expire(logKey, LOG_TTL_SECONDS);
            }

            // Execute the pipeline fire-and-forget — never block the reporter's response
            pipeline.exec().catch((err: unknown) => {
                app.log.warn(
                    { taskId, err: String(err) },
                    '[ingest] Redis pipeline failed — live logs may be incomplete for this batch',
                );
            });

            // Extend session TTL on every event call to support test suites longer than 24 h.
            // Redis expire is idempotent and cheap; ignore failures.
            redis.expire(`${SESSION_KEY_PREFIX}${sessionId}`, SESSION_TTL_SECONDS).catch(() => {});

            return reply.status(200).send({ success: true });
        },
    );

    // ── POST /api/ingest/teardown ─────────────────────────────────────────────
    //
    // Called once when the external test suite finishes. Finalises all DB records,
    // drains the buffered test results, archives the session, and cleans up Redis.
    app.post(
        '/api/ingest/teardown',
        { preHandler: [apiKeyAuth, ingestLifecycleRateLimit] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const organizationId = request.user!.organizationId;

            const parseResult = TeardownRequestSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid teardown payload',
                    details: parseResult.error.format(),
                });
            }

            const { sessionId, status, summary } = parseResult.data;

            // Resolve session
            const session = await resolveSession(redis, sessionId);
            if (!session) {
                return reply.status(404).send({
                    success: false,
                    error: 'Session not found or expired',
                });
            }

            // Security: org ownership check
            if (session.organizationId !== organizationId) {
                return reply.status(403).send({
                    success: false,
                    error: 'Session does not belong to your organization',
                });
            }

            const { taskId, cycleId, cycleItemId } = session;
            const finalStatus = status === 'PASSED' ? 'PASSED' : 'FAILED';
            const logKey = `live:logs:${taskId}`;
            const resultsKey = `${RESULTS_KEY_PREFIX}${sessionId}`;
            const sessionKey = `${SESSION_KEY_PREFIX}${sessionId}`;

            try {
                const now = new Date();

                // Drain buffered test results and permanent logs in parallel
                const [rawResults, permanentLogs] = await Promise.all([
                    redis.lrange(resultsKey, 0, -1),
                    redis.get(logKey),
                ]);

                const tests = rawResults
                    .map((r) => {
                        try { return JSON.parse(r); } catch { return null; }
                    })
                    .filter(Boolean);

                // Finalise the Execution document
                await executionsCollection.updateOne(
                    { taskId, organizationId },
                    {
                        $set: {
                            status: finalStatus,
                            endTime: now,
                            tests,
                            output: permanentLogs ?? '',
                        },
                    },
                );

                // Finalise the TestCycle — mark the item complete and recalculate summary
                const itemStatus: string = finalStatus === 'PASSED' ? 'PASSED' : 'FAILED';

                await cyclesCollection.updateOne(
                    {
                        _id: new ObjectId(cycleId),
                        organizationId,
                    },
                    {
                        $set: {
                            'items.$[elem].status': itemStatus,
                            status: 'COMPLETED',
                            summary: {
                                total: summary.total,
                                passed: summary.passed,
                                failed: summary.failed,
                                automationRate: 100,
                            },
                        },
                    },
                    { arrayFilters: [{ 'elem.id': cycleItemId }] },
                );

                // Archive the finalised session to MongoDB for audit trail
                // The TTL index on ingest_sessions.createdAt will auto-purge after 7 days
                await ingestSessionsCollection.insertOne({
                    ...session,
                    status: finalStatus === 'PASSED' ? 'COMPLETED' : 'FAILED',
                    finalSummary: summary,
                    endTime: now,
                    // Coerce string dates (from Redis JSON round-trip) back to Date objects
                    startTime: new Date(session.startTime),
                    createdAt: new Date(session.createdAt),
                });

                // Clean up Redis — fire-and-forget, failures are non-critical
                redis.del(logKey, resultsKey, sessionKey).catch((err: unknown) => {
                    app.log.warn({ taskId, err: String(err) }, '[ingest] Failed to clean up Redis keys after teardown');
                });

                // Remove from in-memory fallback if present
                SESSION_MEMORY_FALLBACK.delete(sessionId);

                // Broadcast final status to the org room
                const orgRoom = `org:${organizationId}`;
                app.io.to(orgRoom).emit('execution-updated', {
                    taskId,
                    organizationId,
                    cycleId,
                    cycleItemId,
                    status: finalStatus,
                });

                app.log.info(
                    { organizationId, taskId, sessionId, status: finalStatus, tests: tests.length },
                    '[ingest] Session torn down and archived successfully',
                );

                return reply.status(200).send({
                    success: true,
                    data: { taskId, status: finalStatus },
                });

            } catch (error: unknown) {
                app.log.error(error, '[ingest] Failed to process teardown');
                return reply.status(500).send({
                    success: false,
                    error: 'Internal server error during teardown',
                });
            }
        },
    );
}
