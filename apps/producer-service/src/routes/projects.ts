/**
 * Project Routes
 *
 * CRUD operations for automation projects within an organization.
 * Plan-based enforcement: Free plan allows max 1 project per organization.
 *
 * Endpoints:
 * - GET  /api/projects           — List projects for authenticated org
 * - POST /api/projects           — Create project (admin/developer, plan-limited)
 * - GET  /api/projects/:projectId — Get single project
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { getDbName } from '../config/server.js';

const DB_NAME = getDbName();

/**
 * Generate a URL-friendly slug from a project name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

export async function projectRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
) {
    const db = mongoClient.db(DB_NAME);
    const projectsCollection = db.collection('projects');

    // Ensure indexes for multi-tenant queries
    await projectsCollection.createIndex({ organizationId: 1 });
    await projectsCollection.createIndex(
        { organizationId: 1, slug: 1 },
        { unique: true }
    );

    // ── GET /api/projects — List projects for the authenticated organization ──
    app.get('/api/projects', async (request, reply) => {
        const organizationId = request.user!.organizationId;

        try {
            const projects = await projectsCollection
                .find({ organizationId })
                .sort({ createdAt: -1 })
                .toArray();

            return reply.send({
                success: true,
                projects: projects.map(p => ({
                    id: p._id.toString(),
                    name: p.name,
                    slug: p.slug,
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                })),
            });
        } catch (error) {
            app.log.error(error, 'Failed to fetch projects');
            return reply.status(500).send({ success: false, error: 'Failed to fetch projects' });
        }
    });

    // ── POST /api/projects — Create a new project (plan-limited) ──────────────
    app.post('/api/projects', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { name } = request.body as { name?: string };

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return reply.status(400).send({
                success: false,
                error: 'Project name is required',
            });
        }

        if (name.trim().length > 100) {
            return reply.status(400).send({
                success: false,
                error: 'Project name must be 100 characters or less',
            });
        }

        try {
            // ── Plan-based limit enforcement ──────────────────────────────────
            const orgsCollection = db.collection('organizations');
            const org = await orgsCollection.findOne({
                $or: [
                    { _id: new ObjectId(organizationId) },
                    { _id: organizationId as any },
                ],
            });

            const maxProjects = org?.limits?.maxProjects ?? 1;
            const currentCount = await projectsCollection.countDocuments({ organizationId });

            if (currentCount >= maxProjects) {
                const planName = org?.plan || 'free';
                return reply.status(403).send({
                    success: false,
                    error: `${planName.charAt(0).toUpperCase() + planName.slice(1)} plan allows only ${maxProjects} project${maxProjects === 1 ? '' : 's'} per organization`,
                    limit: maxProjects,
                    current: currentCount,
                });
            }

            // ── Create the project ────────────────────────────────────────────
            const slug = generateSlug(name.trim());
            const now = new Date();

            // Check for slug collision within org
            const existing = await projectsCollection.findOne({ organizationId, slug });
            if (existing) {
                return reply.status(409).send({
                    success: false,
                    error: 'A project with a similar name already exists in this organization',
                });
            }

            const result = await projectsCollection.insertOne({
                organizationId,
                name: name.trim(),
                slug,
                createdAt: now,
                updatedAt: now,
            });

            return reply.status(201).send({
                success: true,
                project: {
                    id: result.insertedId.toString(),
                    name: name.trim(),
                    slug,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        } catch (error) {
            app.log.error(error, 'Failed to create project');
            return reply.status(500).send({ success: false, error: 'Failed to create project' });
        }
    });

    // ── GET /api/projects/:projectId — Get a single project ───────────────────
    app.get('/api/projects/:projectId', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { projectId } = request.params as { projectId: string };

        try {
            let project;
            try {
                project = await projectsCollection.findOne({
                    _id: new ObjectId(projectId),
                    organizationId,
                });
            } catch {
                // Invalid ObjectId format
                return reply.status(404).send({ success: false, error: 'Project not found' });
            }

            if (!project) {
                return reply.status(404).send({ success: false, error: 'Project not found' });
            }

            return reply.send({
                success: true,
                project: {
                    id: project._id.toString(),
                    name: project.name,
                    slug: project.slug,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt,
                },
            });
        } catch (error) {
            app.log.error(error, 'Failed to fetch project');
            return reply.status(500).send({ success: false, error: 'Failed to fetch project' });
        }
    });
}
