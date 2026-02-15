/**
 * Project Settings Routes
 *
 * Per-project run configuration (Docker image, target URLs, default test folder).
 * Settings are keyed by organizationId + projectId for full multi-tenant isolation.
 *
 * Endpoints:
 * - GET  /api/projects/:projectId/settings — Get settings for a specific project
 * - PUT  /api/projects/:projectId/settings — Upsert settings for a specific project
 * - GET  /api/project-settings              — Fallback: get settings for the org's first project
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { getDbName } from '../config/server.js';

const DB_NAME = getDbName();

/** Empty settings returned when no configuration exists yet */
const EMPTY_SETTINGS = {
    dockerImage: '',
    targetUrls: { dev: '', staging: '', prod: '' },
    defaultTestFolder: '',
};

export async function projectSettingsRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
) {
    const db = mongoClient.db(DB_NAME);
    const settingsCollection = db.collection('projectRunSettings');
    const projectsCollection = db.collection('projects');

    // Ensure compound index for efficient lookups
    await settingsCollection.createIndex(
        { organizationId: 1, projectId: 1 },
        { unique: true }
    );

    // ── GET /api/projects/:projectId/settings ─────────────────────────────────
    app.get('/api/projects/:projectId/settings', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { projectId } = request.params as { projectId: string };

        try {
            // Verify project belongs to this organization
            let project;
            try {
                project = await projectsCollection.findOne({
                    _id: new ObjectId(projectId),
                    organizationId,
                });
            } catch {
                return reply.status(404).send({ success: false, error: 'Project not found' });
            }

            if (!project) {
                return reply.status(404).send({ success: false, error: 'Project not found' });
            }

            // Fetch settings
            const settings = await settingsCollection.findOne({
                organizationId,
                projectId,
            });

            return reply.send({
                success: true,
                settings: settings
                    ? {
                        dockerImage: settings.dockerImage || '',
                        targetUrls: {
                            dev: settings.targetUrls?.dev || '',
                            staging: settings.targetUrls?.staging || '',
                            prod: settings.targetUrls?.prod || '',
                        },
                        defaultTestFolder: settings.defaultTestFolder || '',
                    }
                    : { ...EMPTY_SETTINGS },
            });
        } catch (error) {
            app.log.error(error, 'Failed to fetch project settings');
            return reply.status(500).send({ success: false, error: 'Failed to fetch project settings' });
        }
    });

    // ── PUT /api/projects/:projectId/settings ─────────────────────────────────
    app.put('/api/projects/:projectId/settings', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const userId = request.user!.userId;
        const { projectId } = request.params as { projectId: string };
        const body = request.body as any;

        try {
            // Verify project belongs to this organization
            let project;
            try {
                project = await projectsCollection.findOne({
                    _id: new ObjectId(projectId),
                    organizationId,
                });
            } catch {
                return reply.status(404).send({ success: false, error: 'Project not found' });
            }

            if (!project) {
                return reply.status(404).send({ success: false, error: 'Project not found' });
            }

            // Build the update document — all fields optional
            const update: Record<string, any> = {
                organizationId,
                projectId,
                updatedAt: new Date(),
                updatedBy: userId,
            };

            if (typeof body.dockerImage === 'string') {
                update.dockerImage = body.dockerImage;
            }

            if (body.targetUrls && typeof body.targetUrls === 'object') {
                update.targetUrls = {
                    dev: typeof body.targetUrls.dev === 'string' ? body.targetUrls.dev : '',
                    staging: typeof body.targetUrls.staging === 'string' ? body.targetUrls.staging : '',
                    prod: typeof body.targetUrls.prod === 'string' ? body.targetUrls.prod : '',
                };
            }

            if (typeof body.defaultTestFolder === 'string') {
                update.defaultTestFolder = body.defaultTestFolder;
            }

            // Upsert: create if not exists, update if exists
            await settingsCollection.updateOne(
                { organizationId, projectId },
                { $set: update },
                { upsert: true }
            );

            // Read back the full document to return
            const saved = await settingsCollection.findOne({ organizationId, projectId });

            return reply.send({
                success: true,
                settings: {
                    dockerImage: saved?.dockerImage || '',
                    targetUrls: {
                        dev: saved?.targetUrls?.dev || '',
                        staging: saved?.targetUrls?.staging || '',
                        prod: saved?.targetUrls?.prod || '',
                    },
                    defaultTestFolder: saved?.defaultTestFolder || '',
                },
            });
        } catch (error) {
            app.log.error(error, 'Failed to save project settings');
            return reply.status(500).send({ success: false, error: 'Failed to save project settings' });
        }
    });

    // ── GET /api/project-settings — Fallback (no projectId context) ───────────
    // Returns settings for the org's first project, or empty defaults.
    // Used by the Launch Modal which doesn't have project context yet.
    app.get('/api/project-settings', async (request, reply) => {
        const organizationId = request.user!.organizationId;

        try {
            // Find the org's first project
            const firstProject = await projectsCollection.findOne(
                { organizationId },
                { sort: { createdAt: 1 } }
            );

            if (!firstProject) {
                return reply.send({ success: true, settings: { ...EMPTY_SETTINGS }, projectId: null });
            }

            const projectId = firstProject._id.toString();
            const settings = await settingsCollection.findOne({ organizationId, projectId });

            return reply.send({
                success: true,
                projectId,
                settings: settings
                    ? {
                        dockerImage: settings.dockerImage || '',
                        targetUrls: {
                            dev: settings.targetUrls?.dev || '',
                            staging: settings.targetUrls?.staging || '',
                            prod: settings.targetUrls?.prod || '',
                        },
                        defaultTestFolder: settings.defaultTestFolder || '',
                    }
                    : { ...EMPTY_SETTINGS },
            });
        } catch (error) {
            app.log.error(error, 'Failed to fetch project settings fallback');
            return reply.status(500).send({ success: false, error: 'Failed to fetch project settings' });
        }
    });
}
