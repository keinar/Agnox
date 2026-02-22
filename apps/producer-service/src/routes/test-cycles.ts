/**
 * Test Cycle Routes (Sprint 9 — Quality Hub)
 *
 * Endpoints:
 *  - POST  /api/test-cycles                       — Create a new hybrid test cycle
 *  - GET   /api/test-cycles                       — List test cycles scoped to org + optional project
 *  - PUT   /api/test-cycles/:cycleId/items/:itemId — Update a single cycle item
 *  - GET   /api/test-cycles/:id                   — Fetch a single cycle as JSON
 *
 * All endpoints:
 *  - Are JWT-protected via the global auth middleware.
 *  - Scope every query to the caller's organizationId (multi-tenant isolation).
 *  - Compute the summary sub-document at write time to keep reads fast.
 *  - Store items (and their manualSteps) as embedded sub-documents.
 *
 * When a cycle contains AUTOMATED items, the POST handler pushes execution
 * payloads to RabbitMQ so the worker can pick them up. Each payload includes
 * cycleId + cycleItemId for the worker to report results back.
 *
 * PDF report generation uses the browser's native print dialog (window.print())
 * on the client side — no server-side rendering required.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDbName } from '../config/server.js';
import { initTestCycleCollection, TEST_CYCLES_COLLECTION } from '../models/TestCycle.js';
import type { RabbitMqService } from '../rabbitmq.js';
import type {
    ITestCycle,
    ICycleItem,
    ITestStep,
    TestType,
    TestStatus,
    CycleStatus,
} from '../../../../packages/shared-types/index.js';

const VALID_TEST_TYPES = new Set<TestType>(['MANUAL', 'AUTOMATED']);
const VALID_TEST_STATUSES = new Set<TestStatus>(['PASSED', 'FAILED', 'SKIPPED', 'PENDING', 'RUNNING', 'ERROR']);

/** Generate a short, human-readable Run ID for worker task payloads. */
const generateRunId = () => `run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

/** Validate and normalise the items array received from the request body. */
function parseItems(raw: unknown[]): ICycleItem[] {
    return raw.map((item: any, index: number) => {
        if (typeof item.testCaseId !== 'string' || item.testCaseId.trim().length === 0) {
            throw new Error(`Item at index ${index} is missing a valid "testCaseId" field`);
        }
        if (!VALID_TEST_TYPES.has(item.type)) {
            throw new Error(
                `Item at index ${index} has an invalid "type". Must be one of: ${[...VALID_TEST_TYPES].join(', ')}`,
            );
        }
        if (typeof item.title !== 'string' || item.title.trim().length === 0) {
            throw new Error(`Item at index ${index} is missing a valid "title" field`);
        }

        const status: TestStatus =
            VALID_TEST_STATUSES.has(item.status) ? item.status : 'PENDING';

        const cycleItem: ICycleItem = {
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : randomUUID(),
            testCaseId: item.testCaseId.trim(),
            type: item.type as TestType,
            title: item.title.trim(),
            status,
        };

        if (typeof item.executionId === 'string' && item.executionId.trim()) {
            cycleItem.executionId = item.executionId.trim();
        }

        if (Array.isArray(item.manualSteps) && item.manualSteps.length > 0) {
            cycleItem.manualSteps = item.manualSteps.map((s: any, sIdx: number) => {
                if (typeof s.action !== 'string' || s.action.trim().length === 0) {
                    throw new Error(
                        `manualStep at item[${index}].step[${sIdx}] is missing a valid "action" field`,
                    );
                }
                if (typeof s.expectedResult !== 'string' || s.expectedResult.trim().length === 0) {
                    throw new Error(
                        `manualStep at item[${index}].step[${sIdx}] is missing a valid "expectedResult" field`,
                    );
                }

                const step: ITestStep = {
                    id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : randomUUID(),
                    action: s.action.trim(),
                    expectedResult: s.expectedResult.trim(),
                    status: VALID_TEST_STATUSES.has(s.status) ? s.status : 'PENDING',
                };

                if (typeof s.comment === 'string' && s.comment.trim()) {
                    step.comment = s.comment.trim();
                }
                if (typeof s.attachmentUrl === 'string' && s.attachmentUrl.trim()) {
                    step.attachmentUrl = s.attachmentUrl.trim();
                }

                return step;
            });
        }

        return cycleItem;
    });
}

/** Derive the summary sub-document from the items array. */
function computeSummary(items: ICycleItem[]): ITestCycle['summary'] {
    const total = items.length;
    const passed = items.filter((i) => i.status === 'PASSED').length;
    const failed = items.filter((i) => i.status === 'FAILED').length;
    const automatedCount = items.filter((i) => i.type === 'AUTOMATED').length;
    const automationRate = total > 0 ? Math.round((automatedCount / total) * 100) : 0;

    return { total, passed, failed, automationRate };
}

export async function testCycleRoutes(
    app: FastifyInstance,
    dbClient: MongoClient,
    apiRateLimit: (request: any, reply: any) => Promise<void>,
    rabbitMqService: RabbitMqService,
): Promise<void> {
    const DB_NAME = getDbName();
    const db = dbClient.db(DB_NAME);

    // Ensure indexes exist on startup
    await initTestCycleCollection(db);

    // ── POST /api/test-cycles ─────────────────────────────────────────────────

    app.post('/api/test-cycles', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const userId = request.user!.userId;
        const body = request.body as {
            projectId?: unknown;
            name?: unknown;
            items?: unknown;
            // Automated execution config (optional — required when AUTOMATED items exist)
            image?: unknown;
            baseUrl?: unknown;
            folder?: unknown;
        };

        // Validate required fields
        if (typeof body.projectId !== 'string' || body.projectId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'projectId is required' });
        }
        if (typeof body.name !== 'string' || body.name.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'name is required' });
        }
        if (body.name.trim().length > 200) {
            return reply.status(400).send({ success: false, error: 'name must be 200 characters or fewer' });
        }
        if (!Array.isArray(body.items)) {
            return reply.status(400).send({ success: false, error: 'items must be an array' });
        }

        // Parse and validate items (may be empty for a cycle created before tests are linked)
        let items: ICycleItem[] = [];
        if (body.items.length > 0) {
            try {
                items = parseItems(body.items);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Invalid items payload';
                return reply.status(400).send({ success: false, error: message });
            }
        }

        // Check if there are automated items — if so, an image must be resolved
        const automatedItems = items.filter((i) => i.type === 'AUTOMATED');
        const hasAutomated = automatedItems.length > 0;

        // Resolved config for automated execution (populated below when hasAutomated is true)
        let resolvedImage = '';
        let resolvedBaseUrl = '';
        let envVarsToInject: Record<string, string> = {};

        if (hasAutomated) {
            // Fetch project run settings so we can fall back to stored image / baseUrl
            // and so the worker receives the same env-var injections as a direct run.
            let projectSettings: Record<string, any> | null = null;
            try {
                projectSettings = await db.collection('projectRunSettings').findOne({
                    organizationId,
                    projectId: body.projectId.trim(),
                });
            } catch (settingsErr: unknown) {
                app.log.warn(settingsErr, '[test-cycles] Could not fetch projectRunSettings — proceeding with request body values');
            }

            // Resolve image: explicit body value takes precedence, then project settings
            const bodyImage = typeof body.image === 'string' ? body.image.trim() : '';
            resolvedImage = bodyImage || projectSettings?.dockerImage || '';

            if (!resolvedImage) {
                return reply.status(400).send({
                    success: false,
                    error: 'No Docker image configured. Set one in Project Settings or pass it in the request body.',
                });
            }

            // Resolve baseUrl: explicit body value takes precedence, then project settings (prod → staging → dev)
            const bodyBaseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
            resolvedBaseUrl =
                bodyBaseUrl ||
                projectSettings?.targetUrls?.prod ||
                projectSettings?.targetUrls?.staging ||
                projectSettings?.targetUrls?.dev ||
                '';

            // Inject server-side env vars — same mechanism used by /api/execution-request.
            // These typically carry API keys / auth tokens that the test suite needs.
            const varsToInject = (process.env.INJECT_ENV_VARS || '').split(',');
            for (const varName of varsToInject) {
                const name = varName.trim();
                if (name && process.env[name]) {
                    envVarsToInject[name] = process.env[name]!;
                }
            }
        }

        try {
            // Determine initial status: if there are automated items, the cycle starts as RUNNING
            const initialStatus: CycleStatus = hasAutomated ? 'RUNNING' : 'PENDING';
            const doc: ITestCycle = {
                organizationId,
                projectId: body.projectId.trim(),
                name: (body.name as string).trim(),
                status: initialStatus,
                items,
                summary: computeSummary(items),
                createdAt: new Date(),
                createdBy: userId,
            };

            const result = await db.collection(TEST_CYCLES_COLLECTION).insertOne(doc);
            const cycleId = result.insertedId.toString();

            app.log.info(
                `[test-cycles] Created cycle "${doc.name}" (id: ${cycleId}) for org ${organizationId}`,
            );

            // ── Push AUTOMATED items to RabbitMQ ──────────────────────────────
            if (hasAutomated) {
                const image = resolvedImage;
                const baseUrl = resolvedBaseUrl;
                const folder = typeof body.folder === 'string' && body.folder.trim() ? body.folder.trim() : 'all';

                for (const item of automatedItems) {
                    const taskId = generateRunId();

                    // Set the executionId on the item so it links to the execution record
                    item.executionId = taskId;

                    const taskPayload = {
                        taskId,
                        image,
                        command: `Agnostic Execution Mode: Running [${folder}] via entrypoint.sh`,
                        folder,
                        organizationId,
                        config: {
                            baseUrl,
                            environment: 'production',
                            // Inject server-side env vars so the worker has the same auth
                            // credentials it receives during a direct /api/execution-request run.
                            envVars: envVarsToInject,
                        },
                        // Cycle linkage — allows the worker to update the correct cycle item
                        cycleId,
                        cycleItemId: item.id,
                    };

                    await rabbitMqService.sendToQueue(taskPayload);

                    app.log.info(
                        `[test-cycles] Pushed AUTOMATED item "${item.title}" (taskId: ${taskId}) for cycle ${cycleId}`,
                    );
                }

                // Update the items in the DB to include the executionId links
                await db.collection(TEST_CYCLES_COLLECTION).updateOne(
                    { _id: result.insertedId },
                    { $set: { items } },
                );
            }

            return reply.status(201).send({ success: true, data: { ...doc, _id: result.insertedId } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cycles] Failed to create test cycle');
            return reply.status(500).send({ success: false, error: 'Failed to create test cycle' });
        }
    });

    // ── GET /api/test-cycles ──────────────────────────────────────────────────
    // Query params:
    //   projectId  (required) — filter by project
    //   status     (optional) — 'PENDING' | 'RUNNING' | 'COMPLETED'

    app.get('/api/test-cycles', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const query = request.query as { projectId?: string; status?: string };

        if (!query.projectId || query.projectId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'projectId query parameter is required' });
        }

        const VALID_CYCLE_STATUSES = new Set<CycleStatus>(['PENDING', 'RUNNING', 'COMPLETED']);

        const filter: Record<string, unknown> = {
            organizationId,
            projectId: query.projectId.trim(),
        };

        if (query.status && VALID_CYCLE_STATUSES.has(query.status as CycleStatus)) {
            filter.status = query.status;
        }

        try {
            const cycles = await db
                .collection(TEST_CYCLES_COLLECTION)
                .find(filter)
                .sort({ createdAt: -1 })
                .toArray();

            return reply.send({ success: true, data: { cycles } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cycles] Failed to fetch test cycles');
            return reply.status(500).send({ success: false, error: 'Failed to fetch test cycles' });
        }
    });

    // ── PUT /api/test-cycles/:cycleId/items/:itemId ────────────────────────────
    // Updates a single item within a cycle (manual execution player).
    //
    // Body: { status: TestStatus, manualSteps?: ITestStep[] }
    //
    // After updating the item, recalculates the cycle summary and
    // sets the cycle status to COMPLETED if all items are terminal.

    app.put('/api/test-cycles/:cycleId/items/:itemId', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { cycleId, itemId } = request.params as { cycleId: string; itemId: string };
        const body = request.body as { status?: unknown; manualSteps?: unknown };

        // Validate cycleId
        let cycleObjectId: ObjectId;
        try {
            cycleObjectId = new ObjectId(cycleId);
        } catch {
            return reply.status(400).send({ success: false, error: 'Invalid cycleId' });
        }

        // Validate status
        if (!body.status || !VALID_TEST_STATUSES.has(body.status as TestStatus)) {
            return reply.status(400).send({
                success: false,
                error: `status is required and must be one of: ${[...VALID_TEST_STATUSES].join(', ')}`,
            });
        }

        const newStatus = body.status as TestStatus;

        // Build the $set for the matched item
        const itemUpdate: Record<string, unknown> = {
            'items.$[elem].status': newStatus,
        };

        // If manualSteps are provided, validate and set them
        if (Array.isArray(body.manualSteps)) {
            const parsedSteps: ITestStep[] = body.manualSteps.map((s: any, idx: number) => {
                const step: ITestStep = {
                    id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : randomUUID(),
                    action: typeof s.action === 'string' ? s.action.trim() : `Step ${idx + 1}`,
                    expectedResult: typeof s.expectedResult === 'string' ? s.expectedResult.trim() : '',
                    status: VALID_TEST_STATUSES.has(s.status) ? s.status : 'PENDING',
                };
                if (typeof s.comment === 'string' && s.comment.trim()) {
                    step.comment = s.comment.trim();
                }
                return step;
            });
            itemUpdate['items.$[elem].manualSteps'] = parsedSteps;
        }

        try {
            // Step 1: Update the specific item in the cycle
            const updateResult = await db.collection(TEST_CYCLES_COLLECTION).updateOne(
                { _id: cycleObjectId, organizationId },
                { $set: itemUpdate },
                { arrayFilters: [{ 'elem.id': itemId }] },
            );

            if (updateResult.matchedCount === 0) {
                return reply.status(404).send({ success: false, error: 'Cycle not found' });
            }

            // Step 2: Re-fetch the cycle to recalculate summary
            const cycle = await db.collection(TEST_CYCLES_COLLECTION).findOne({ _id: cycleObjectId });

            if (cycle && Array.isArray(cycle.items)) {
                const items = cycle.items as ICycleItem[];
                const summary = computeSummary(items);

                // Determine if all items have reached a terminal state
                const TERMINAL = new Set<TestStatus>(['PASSED', 'FAILED', 'ERROR', 'SKIPPED']);
                const allTerminal = items.every((i) => TERMINAL.has(i.status));

                await db.collection(TEST_CYCLES_COLLECTION).updateOne(
                    { _id: cycleObjectId },
                    {
                        $set: {
                            summary,
                            ...(allTerminal ? { status: 'COMPLETED' as CycleStatus } : {}),
                        },
                    },
                );

                app.log.info(
                    `[test-cycles] Updated item ${itemId} in cycle ${cycleId} → ${newStatus}` +
                    (allTerminal ? ' (cycle COMPLETED)' : ''),
                );

                return reply.send({ success: true, data: { ...cycle, summary, status: allTerminal ? 'COMPLETED' : cycle.status } });
            }

            return reply.send({ success: true });
        } catch (err: unknown) {
            app.log.error(err, '[test-cycles] Failed to update cycle item');
            return reply.status(500).send({ success: false, error: 'Failed to update cycle item' });
        }
    });

    // ── GET /api/test-cycles/:id ──────────────────────────────────────────────
    // Returns a single test cycle as JSON, scoped to the caller's organization.

    app.get('/api/test-cycles/:id', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { id } = request.params as { id: string };

        let cycleObjectId: ObjectId;
        try {
            cycleObjectId = new ObjectId(id);
        } catch {
            return reply.status(400).send({ success: false, error: 'Invalid cycle ID' });
        }

        try {
            const raw = await db
                .collection(TEST_CYCLES_COLLECTION)
                .findOne({ _id: cycleObjectId, organizationId });

            if (!raw) {
                return reply.status(404).send({ success: false, error: 'Test cycle not found' });
            }

            app.log.info(`[test-cycles] Fetched cycle ${id} for org ${organizationId}`);
            return reply.send({ success: true, data: { cycle: raw } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cycles] Failed to fetch cycle by ID');
            return reply.status(500).send({ success: false, error: 'Failed to fetch test cycle' });
        }
    });

    app.log.info('✅ Test cycle routes registered');
    app.log.info('  - POST  /api/test-cycles');
    app.log.info('  - GET   /api/test-cycles');
    app.log.info('  - PUT   /api/test-cycles/:cycleId/items/:itemId');
    app.log.info('  - GET   /api/test-cycles/:id');
}
