/**
 * Test Case Routes (Sprint 9 — Quality Hub)
 *
 * Endpoints:
 *  - POST  /api/test-cases  — Create a new manual or automated test case
 *  - GET   /api/test-cases  — List test cases scoped to org + optional project
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
                .sort({ createdAt: -1 })
                .toArray();

            return reply.send({ success: true, data: { testCases } });
        } catch (err: unknown) {
            app.log.error(err, '[test-cases] Failed to fetch test cases');
            return reply.status(500).send({ success: false, error: 'Failed to fetch test cases' });
        }
    });

    app.log.info('✅ Test case routes registered');
    app.log.info('  - POST  /api/test-cases');
    app.log.info('  - GET   /api/test-cases');
}
