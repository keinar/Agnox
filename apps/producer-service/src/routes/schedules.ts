/**
 * Schedule Routes (Task 8.2)
 *
 * Endpoints:
 *  - POST   /api/schedules       — Create a new CRON schedule
 *  - GET    /api/schedules       — List all schedules for the organization
 *  - DELETE /api/schedules/:id   — Delete (and deactivate) a schedule
 *
 * All endpoints:
 *  - Are JWT-protected via the global auth middleware.
 *  - Scope every query to the caller's organizationId (multi-tenant isolation).
 *  - Validate the cronExpression with cron.validate() before persisting.
 *  - Synchronize changes with the in-memory job registry in scheduler.ts.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import * as cron from 'node-cron';
import { getDbName } from '../config/server.js';
import { addScheduledJob, removeScheduledJob } from '../utils/scheduler.js';
import type { ISchedule, ICreateScheduleRequest } from '../../../../packages/shared-types/index.js';

export async function scheduleRoutes(
    app: FastifyInstance,
    dbClient: MongoClient,
    apiRateLimit: (request: any, reply: any) => Promise<void>,
): Promise<void> {
    const DB_NAME = getDbName();

    // ── POST /api/schedules ───────────────────────────────────────────────────

    app.post('/api/schedules', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const body = request.body as ICreateScheduleRequest;

        // Validate required fields
        if (!body.name || !body.cronExpression || !body.environment || !body.image || !body.baseUrl) {
            return reply.status(400).send({
                success: false,
                error: 'Missing required fields: name, cronExpression, environment, image, baseUrl',
            });
        }

        // Validate the cron expression before persisting
        if (!cron.validate(body.cronExpression)) {
            return reply.status(400).send({
                success: false,
                error: `Invalid cron expression: "${body.cronExpression}"`,
            });
        }

        try {
            const collection = dbClient.db(DB_NAME).collection<ISchedule>('schedules');

            const newSchedule: Omit<ISchedule, '_id'> = {
                organizationId,
                projectId: body.projectId,
                name: body.name.trim(),
                cronExpression: body.cronExpression.trim(),
                environment: body.environment,
                isActive: true,
                createdAt: new Date(),
                image: body.image.trim(),
                folder: (body.folder || 'all').trim(),
                baseUrl: body.baseUrl.trim(),
            };

            const result = await collection.insertOne(newSchedule as ISchedule);
            const inserted: ISchedule = { ...newSchedule, _id: result.insertedId } as ISchedule;

            // Register the job in the live scheduler without restarting
            addScheduledJob(inserted);

            app.log.info(`[schedules] Created schedule "${inserted.name}" (id: ${result.insertedId}) for org ${organizationId}`);

            return reply.status(201).send({ success: true, data: inserted });
        } catch (err: unknown) {
            app.log.error(err, '[schedules] Failed to create schedule');
            return reply.status(500).send({ success: false, error: 'Failed to create schedule' });
        }
    });

    // ── GET /api/schedules ────────────────────────────────────────────────────

    app.get('/api/schedules', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;

        try {
            const collection = dbClient.db(DB_NAME).collection<ISchedule>('schedules');
            const schedules = await collection
                .find({ organizationId })
                .sort({ createdAt: -1 })
                .toArray();

            return reply.send({ success: true, data: { schedules } });
        } catch (err: unknown) {
            app.log.error(err, '[schedules] Failed to fetch schedules');
            return reply.status(500).send({ success: false, error: 'Failed to fetch schedules' });
        }
    });

    // ── DELETE /api/schedules/:id ─────────────────────────────────────────────

    app.delete('/api/schedules/:id', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { id } = request.params as { id: string };

        if (!ObjectId.isValid(id)) {
            return reply.status(400).send({ success: false, error: 'Invalid schedule ID' });
        }

        try {
            const collection = dbClient.db(DB_NAME).collection<ISchedule>('schedules');

            const result = await collection.deleteOne({
                _id: new ObjectId(id),
                organizationId, // Enforce tenant isolation
            });

            if (result.deletedCount === 0) {
                return reply.status(404).send({ success: false, error: 'Schedule not found' });
            }

            // Remove the job from the live scheduler
            removeScheduledJob(id);

            app.log.info(`[schedules] Deleted schedule ${id} for org ${organizationId}`);

            return reply.send({ success: true, data: { deletedId: id } });
        } catch (err: unknown) {
            app.log.error(err, '[schedules] Failed to delete schedule');
            return reply.status(500).send({ success: false, error: 'Failed to delete schedule' });
        }
    });

    app.log.info('✅ Schedule routes registered');
    app.log.info('  - POST   /api/schedules');
    app.log.info('  - GET    /api/schedules');
    app.log.info('  - DELETE /api/schedules/:id');
}
