/**
 * Test Case Routes (Sprint 9 — Quality Hub)
 *
 * Endpoints:
 *  - POST   /api/test-cases       — Create a new manual or automated test case
 *  - POST   /api/test-cases/bulk  — Bulk insert multiple test cases (AI suite generation)
 *  - GET    /api/test-cases       — List test cases scoped to org + optional project
 *  - PUT    /api/test-cases/:id   — Update an existing test case
 *  - DELETE /api/test-cases/:id   — Delete a test case
 *
 * All endpoints:
 *  - Are JWT-protected via the global auth middleware.
 *  - Scope every query to the caller's organizationId (multi-tenant isolation).
 *  - Store steps as embedded sub-documents for efficient single-document reads.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDbName } from '../config/server.js';
import { initTestCaseCollection, TEST_CASES_COLLECTION } from '../models/TestCase.js';
import type { ITestCase, ITestStep, TestType, TestStatus } from '../../../../packages/shared-types/index.js';

const VALID_TEST_TYPES = new Set<TestType>(['MANUAL', 'AUTOMATED']);
const VALID_TEST_STATUSES = new Set<TestStatus>(['PASSED', 'FAILED', 'SKIPPED', 'PENDING', 'RUNNING', 'ERROR']);

/** Validate and normalise an array of raw test steps from the request body. */
function parseSteps(raw: unknown[]): ITestStep[] {
    return raw.map((s: any, index: number) => {
        if (typeof s.action !== 'string' || s.action.trim().length === 0) {
            throw new Error(`Step at index ${index} is missing a valid "action" field`);
        }
        if (typeof s.expectedResult !== 'string' || s.expectedResult.trim().length === 0) {
            throw new Error(`Step at index ${index} is missing a valid "expectedResult" field`);
        }

        const status: TestStatus =
            VALID_TEST_STATUSES.has(s.status) ? s.status : 'PENDING';

        const step: ITestStep = {
            id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : randomUUID(),
            action: s.action.trim(),
            expectedResult: s.expectedResult.trim(),
            status,
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

export async function testCaseRoutes(
    app: FastifyInstance,
    dbClient: MongoClient,
    apiRateLimit: (request: any, reply: any) => Promise<void>,
): Promise<void> {
    const DB_NAME = getDbName();
    const db = dbClient.db(DB_NAME);

    // Ensure indexes exist on startup
    await initTestCaseCollection(db);

    // ── POST /api/test-cases ──────────────────────────────────────────────────

    app.post('/api/test-cases', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const body = request.body as {
            projectId?: unknown;
            title?: unknown;
            description?: unknown;
            suite?: unknown;
            preconditions?: unknown;
            type?: unknown;
            steps?: unknown;
        };

        // Validate required fields
        if (typeof body.projectId !== 'string' || body.projectId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'projectId is required' });
        }
        if (typeof body.title !== 'string' || body.title.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'title is required' });
        }
        if (body.title.trim().length > 200) {
            return reply.status(400).send({ success: false, error: 'title must be 200 characters or fewer' });
        }
        if (!VALID_TEST_TYPES.has(body.type as TestType)) {
            return reply.status(400).send({
                success: false,
                error: `type must be one of: ${[...VALID_TEST_TYPES].join(', ')}`,
            });
        }

        // Parse steps (optional but validated when present)
        let steps: ITestStep[] = [];
        if (Array.isArray(body.steps) && body.steps.length > 0) {
            try {
                steps = parseSteps(body.steps);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Invalid steps payload';
                return reply.status(400).send({ success: false, error: message });
            }
        }

        try {
            const now = new Date();
            const doc: ITestCase = {
                organizationId,
                projectId: body.projectId.trim(),
                title: (body.title as string).trim(),
                type: body.type as TestType,
                steps,
                createdAt: now,
                updatedAt: now,
            };

            if (typeof body.description === 'string' && body.description.trim()) {
                doc.description = body.description.trim();
            }
            if (typeof body.suite === 'string' && body.suite.trim()) {
                doc.suite = body.suite.trim();
            }
            if (typeof body.preconditions === 'string' && body.preconditions.trim()) {
                doc.preconditions = body.preconditions.trim();
            }

            const result = await db.collection(TEST_CASES_COLLECTION).insertOne(doc);

            app.log.info(
                `[test-cases] Created test case "${doc.title}" (id: ${result.insertedId}) for org ${organizationId}`,
            );

            return reply.status(201).send({ success: true, data: { ...doc, _id: result.insertedId } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cases] Failed to create test case');
            return reply.status(500).send({ success: false, error: 'Failed to create test case' });
        }
    });

    // ── POST /api/test-cases/bulk ─────────────────────────────────────────────
    // Bulk insert multiple test cases in a single DB operation.
    // Used by the AI suite generator to save an entire suite efficiently.
    // NOTE: This route is placed BEFORE the :id parameter routes to avoid Fastify
    // matching "bulk" as an :id parameter.

    app.post('/api/test-cases/bulk', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const body = request.body as { projectId?: unknown; testCases?: unknown };

        if (typeof body.projectId !== 'string' || body.projectId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'projectId is required' });
        }
        if (!Array.isArray(body.testCases) || body.testCases.length === 0) {
            return reply.status(400).send({ success: false, error: 'testCases must be a non-empty array' });
        }
        if (body.testCases.length > 50) {
            return reply.status(400).send({ success: false, error: 'Cannot insert more than 50 test cases at once' });
        }

        // Verify project ownership (MED-8)
        const projectId = body.projectId.trim();
        let projectObjectId: ObjectId;
        try {
            projectObjectId = new ObjectId(projectId);
        } catch {
            return reply.status(400).send({ success: false, error: 'Invalid projectId format' });
        }

        const project = await db.collection('projects').findOne({
            _id: projectObjectId,
            organizationId
        });

        if (!project) {
            return reply.status(403).send({ success: false, error: 'Project not found or access denied' });
        }

        try {
            const now = new Date();

            const docs: ITestCase[] = (body.testCases as any[]).map((tc, index) => {
                if (typeof tc.title !== 'string' || tc.title.trim().length === 0) {
                    throw new Error(`Test case at index ${index} has an invalid title`);
                }

                // Parse steps if present
                let steps: ITestStep[] = [];
                if (Array.isArray(tc.steps) && tc.steps.length > 0) {
                    steps = parseSteps(tc.steps);
                }

                const doc: ITestCase = {
                    organizationId,
                    projectId,
                    title: tc.title.trim(),
                    type: 'MANUAL',
                    steps,
                    createdAt: now,
                    updatedAt: now,
                };

                if (typeof tc.description === 'string' && tc.description.trim()) {
                    doc.description = tc.description.trim();
                }
                if (typeof tc.suite === 'string' && tc.suite.trim()) {
                    doc.suite = tc.suite.trim();
                }
                if (typeof tc.preconditions === 'string' && tc.preconditions.trim()) {
                    doc.preconditions = tc.preconditions.trim();
                }

                return doc;
            });

            const result = await db.collection(TEST_CASES_COLLECTION).insertMany(docs);

            app.log.info(
                `[test-cases] Bulk inserted ${result.insertedCount} test cases for org ${organizationId}`,
            );

            return reply.status(201).send({
                success: true,
                data: { insertedCount: result.insertedCount },
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to bulk insert test cases';
            app.log.error(err, '[test-cases] Bulk insert failed');
            return reply.status(400).send({ success: false, error: message });
        }
    });

    // ── GET /api/test-cases ───────────────────────────────────────────────────
    // Query params:
    //   projectId  (required) — filter by project
    //   type       (optional) — 'MANUAL' | 'AUTOMATED'

    app.get('/api/test-cases', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const query = request.query as { projectId?: string; type?: string };

        if (!query.projectId || query.projectId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'projectId query parameter is required' });
        }

        const filter: Record<string, unknown> = {
            organizationId,
            projectId: query.projectId.trim(),
        };

        if (query.type && VALID_TEST_TYPES.has(query.type as TestType)) {
            filter.type = query.type;
        }

        try {
            const testCases = await db
                .collection(TEST_CASES_COLLECTION)
                .find(filter)
                .sort({ suite: 1, createdAt: -1 })
                .toArray();

            return reply.send({ success: true, data: { testCases } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cases] Failed to fetch test cases');
            return reply.status(500).send({ success: false, error: 'Failed to fetch test cases' });
        }
    });

    // ── PUT /api/test-cases/:id ───────────────────────────────────────────────
    // Full update of an existing test case. Scoped by organizationId for safety.

    app.put('/api/test-cases/:id', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { id } = request.params as { id: string };

        let objectId: ObjectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            return reply.status(400).send({ success: false, error: 'Invalid test case ID' });
        }

        const body = request.body as {
            title?: unknown;
            description?: unknown;
            suite?: unknown;
            preconditions?: unknown;
            type?: unknown;
            steps?: unknown;
        };

        // Validate required fields
        if (typeof body.title !== 'string' || body.title.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'title is required' });
        }
        if (body.title.trim().length > 200) {
            return reply.status(400).send({ success: false, error: 'title must be 200 characters or fewer' });
        }
        if (!VALID_TEST_TYPES.has(body.type as TestType)) {
            return reply.status(400).send({
                success: false,
                error: `type must be one of: ${[...VALID_TEST_TYPES].join(', ')}`,
            });
        }

        // Parse steps
        let steps: ITestStep[] = [];
        if (Array.isArray(body.steps) && body.steps.length > 0) {
            try {
                steps = parseSteps(body.steps);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Invalid steps payload';
                return reply.status(400).send({ success: false, error: message });
            }
        }

        try {
            const updateDoc: Record<string, unknown> = {
                title: (body.title as string).trim(),
                type: body.type as TestType,
                steps,
                updatedAt: new Date(),
                // Explicitly set optional fields: use value if non-empty, undefined unsets via $unset below
                description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined,
                suite: typeof body.suite === 'string' && body.suite.trim() ? body.suite.trim() : undefined,
                preconditions: typeof body.preconditions === 'string' && body.preconditions.trim() ? body.preconditions.trim() : undefined,
            };

            // Split into $set and $unset for clean document hygiene
            const $set: Record<string, unknown> = {};
            const $unset: Record<string, 1> = {};
            for (const [key, val] of Object.entries(updateDoc)) {
                if (val === undefined) {
                    $unset[key] = 1;
                } else {
                    $set[key] = val;
                }
            }

            const updateOp: Record<string, unknown> = {};
            if (Object.keys($set).length > 0) updateOp.$set = $set;
            if (Object.keys($unset).length > 0) updateOp.$unset = $unset;

            const result = await db.collection(TEST_CASES_COLLECTION).updateOne(
                { _id: objectId, organizationId },
                updateOp,
            );

            if (result.matchedCount === 0) {
                return reply.status(404).send({ success: false, error: 'Test case not found' });
            }

            app.log.info(`[test-cases] Updated test case ${id} for org ${organizationId}`);
            return reply.send({ success: true, data: { modifiedCount: result.modifiedCount } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cases] Failed to update test case');
            return reply.status(500).send({ success: false, error: 'Failed to update test case' });
        }
    });

    // ── DELETE /api/test-cases/:id ────────────────────────────────────────────
    // Hard delete — test cases are disposable drafts, no need for soft-delete.

    app.delete('/api/test-cases/:id', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { id } = request.params as { id: string };

        let objectId: ObjectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            return reply.status(400).send({ success: false, error: 'Invalid test case ID' });
        }

        try {
            const result = await db.collection(TEST_CASES_COLLECTION).deleteOne({
                _id: objectId,
                organizationId,
            });

            if (result.deletedCount === 0) {
                return reply.status(404).send({ success: false, error: 'Test case not found' });
            }

            app.log.info(`[test-cases] Deleted test case ${id} for org ${organizationId}`);
            return reply.send({ success: true });
        } catch (err: unknown) {
            app.log.error(err, '[test-cases] Failed to delete test case');
            return reply.status(500).send({ success: false, error: 'Failed to delete test case' });
        }
    });

    app.log.info('✅ Test case routes registered');
    app.log.info('  - POST   /api/test-cases');
    app.log.info('  - POST   /api/test-cases/bulk');
    app.log.info('  - GET    /api/test-cases');
    app.log.info('  - PUT    /api/test-cases/:id');
    app.log.info('  - DELETE /api/test-cases/:id');
}
