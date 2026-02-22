/**
 * Test Cycle Routes (Sprint 9 — Quality Hub)
 *
 * Endpoints:
 *  - POST  /api/test-cycles  — Create a new hybrid test cycle
 *  - GET   /api/test-cycles  — List test cycles scoped to org + optional project
 *
 * All endpoints:
 *  - Are JWT-protected via the global auth middleware.
 *  - Scope every query to the caller's organizationId (multi-tenant isolation).
 *  - Compute the summary sub-document at write time to keep reads fast.
 *  - Store items (and their manualSteps) as embedded sub-documents.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDbName } from '../config/server.js';
import { initTestCycleCollection, TEST_CYCLES_COLLECTION } from '../models/TestCycle.js';
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

        try {
            const initialStatus: CycleStatus = 'PENDING';
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

            app.log.info(
                `[test-cycles] Created cycle "${doc.name}" (id: ${result.insertedId}) for org ${organizationId}`,
            );

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

    app.log.info('✅ Test cycle routes registered');
    app.log.info('  - POST  /api/test-cycles');
    app.log.info('  - GET   /api/test-cycles');
}
