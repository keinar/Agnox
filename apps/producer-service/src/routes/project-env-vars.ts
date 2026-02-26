/**
 * Project Environment Variables Routes
 *
 * Manages per-project environment variables that are injected into Docker
 * containers at test execution time (e.g. BASE_URL, E2E_EMAIL, E2E_PASSWORD).
 *
 * Security:
 *   - All queries are scoped by organizationId (multi-tenant isolation).
 *   - Values where isSecret=true are encrypted at rest with AES-256-GCM.
 *   - GET endpoint returns "********" for secret values — plaintext is never
 *     sent to the client.
 *   - Decryption for execution happens server-side in the run-trigger handlers
 *     (test-cycles.ts and the execution-request handler in routes.ts).
 *
 * Endpoints:
 *   GET    /api/projects/:projectId/env          — List all variables (secrets masked)
 *   POST   /api/projects/:projectId/env          — Create a new variable
 *   PUT    /api/projects/:projectId/env/:varId   — Update an existing variable
 *   DELETE /api/projects/:projectId/env/:varId   — Delete a variable
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { encrypt, decrypt, IEncryptedPayload } from '../utils/encryption.js';
import { getDbName } from '../config/server.js';

const DB_NAME = getDbName();

/** Maximum number of env vars allowed per project (guards against abuse). */
const MAX_ENV_VARS_PER_PROJECT = 50;

/** Regex for valid environment variable keys (POSIX-style). */
const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The masked placeholder returned for secret values over the wire. */
export const SECRET_MASK = '********';

// ── Internal types ─────────────────────────────────────────────────────────────

interface IEnvVarDocument {
    _id: ObjectId;
    organizationId: string;
    projectId: string;
    key: string;
    /** Plaintext string for non-secret vars; IEncryptedPayload for secret vars. */
    value: string | IEncryptedPayload;
    isSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/** Shape returned to the client — secrets are always masked. */
interface IEnvVarResponse {
    id: string;
    key: string;
    value: string;
    isSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function toClientShape(doc: IEnvVarDocument): IEnvVarResponse {
    return {
        id: doc._id.toString(),
        key: doc.key,
        value: doc.isSecret ? SECRET_MASK : (doc.value as string),
        isSecret: doc.isSecret,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// ── Route registration ─────────────────────────────────────────────────────────

export async function projectEnvVarsRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
) {
    const db = mongoClient.db(DB_NAME);
    const envVarsCollection = db.collection<IEnvVarDocument>('projectEnvVars');
    const projectsCollection = db.collection('projects');

    // Indexes are managed by migration 007; this is a safety fallback.
    await envVarsCollection.createIndex(
        { organizationId: 1, projectId: 1, key: 1 },
        { unique: true, name: 'idx_env_vars_unique_key' },
    );

    // ── Helper: verify project ownership ──────────────────────────────────────
    async function assertProjectOwnership(
        projectId: string,
        organizationId: string,
        reply: FastifyReply,
    ): Promise<boolean> {
        let oid: ObjectId;
        try {
            oid = new ObjectId(projectId);
        } catch {
            await reply.status(400).send({ success: false, error: 'Invalid projectId format' });
            return false;
        }
        const project = await projectsCollection.findOne({ _id: oid, organizationId });
        if (!project) {
            await reply.status(404).send({ success: false, error: 'Project not found' });
            return false;
        }
        return true;
    }

    // ── GET /api/projects/:projectId/env ───────────────────────────────────────
    app.get(
        '/api/projects/:projectId/env',
        { preHandler: [apiRateLimit] },
        async (request, reply) => {
            const organizationId = request.user!.organizationId;
            const { projectId } = request.params as { projectId: string };

            try {
                const ok = await assertProjectOwnership(projectId, organizationId, reply);
                if (!ok) return;

                const docs = await envVarsCollection
                    .find({ organizationId, projectId })
                    .sort({ createdAt: 1 })
                    .toArray();

                return reply.send({
                    success: true,
                    data: docs.map(toClientShape),
                });
            } catch (error: unknown) {
                app.log.error(error, '[project-env-vars] Failed to list env vars');
                return reply.status(500).send({ success: false, error: 'Failed to fetch environment variables' });
            }
        },
    );

    // ── POST /api/projects/:projectId/env ─────────────────────────────────────
    app.post(
        '/api/projects/:projectId/env',
        { preHandler: [apiRateLimit] },
        async (request, reply) => {
            const organizationId = request.user!.organizationId;
            const { projectId } = request.params as { projectId: string };
            const body = request.body as { key?: unknown; value?: unknown; isSecret?: unknown };

            // Validate inputs
            if (typeof body.key !== 'string' || !ENV_KEY_REGEX.test(body.key.trim())) {
                return reply.status(400).send({
                    success: false,
                    error: 'key must be a valid environment variable name (letters, digits, underscores; cannot start with a digit)',
                });
            }
            if (typeof body.value !== 'string' || body.value.length === 0) {
                return reply.status(400).send({ success: false, error: 'value is required' });
            }
            if (body.value.length > 4096) {
                return reply.status(400).send({ success: false, error: 'value must not exceed 4096 characters' });
            }

            const key = body.key.trim();
            const isSecret = body.isSecret === true;

            try {
                const ok = await assertProjectOwnership(projectId, organizationId, reply);
                if (!ok) return;

                // Enforce per-project limit
                const count = await envVarsCollection.countDocuments({ organizationId, projectId });
                if (count >= MAX_ENV_VARS_PER_PROJECT) {
                    return reply.status(400).send({
                        success: false,
                        error: `Maximum of ${MAX_ENV_VARS_PER_PROJECT} environment variables per project reached`,
                    });
                }

                // Encrypt secret values; store plaintext otherwise
                const storedValue: string | IEncryptedPayload = isSecret
                    ? encrypt(body.value as string)
                    : (body.value as string);

                const now = new Date();
                const doc = {
                    organizationId,
                    projectId,
                    key,
                    value: storedValue,
                    isSecret,
                    createdAt: now,
                    updatedAt: now,
                };

                const result = await envVarsCollection.insertOne(doc as IEnvVarDocument);

                app.log.info({ organizationId, projectId, key, isSecret }, '[project-env-vars] Created env var');

                return reply.status(201).send({
                    success: true,
                    data: toClientShape({ ...doc, _id: result.insertedId }),
                });
            } catch (error: any) {
                if (error?.code === 11000) {
                    return reply.status(409).send({
                        success: false,
                        error: `A variable named "${key}" already exists for this project`,
                    });
                }
                app.log.error(error, '[project-env-vars] Failed to create env var');
                return reply.status(500).send({ success: false, error: 'Failed to create environment variable' });
            }
        },
    );

    // ── PUT /api/projects/:projectId/env/:varId ───────────────────────────────
    app.put(
        '/api/projects/:projectId/env/:varId',
        { preHandler: [apiRateLimit] },
        async (request, reply) => {
            const organizationId = request.user!.organizationId;
            const { projectId, varId } = request.params as { projectId: string; varId: string };
            const body = request.body as { key?: unknown; value?: unknown; isSecret?: unknown };

            try {
                const ok = await assertProjectOwnership(projectId, organizationId, reply);
                if (!ok) return;

                let varObjectId: ObjectId;
                try {
                    varObjectId = new ObjectId(varId);
                } catch {
                    return reply.status(400).send({ success: false, error: 'Invalid varId format' });
                }

                // Verify the variable belongs to this project + org
                const existing = await envVarsCollection.findOne({
                    _id: varObjectId,
                    organizationId,
                    projectId,
                });
                if (!existing) {
                    return reply.status(404).send({ success: false, error: 'Environment variable not found' });
                }

                const update: Partial<IEnvVarDocument> = { updatedAt: new Date() };

                if (typeof body.key === 'string' && body.key.trim()) {
                    if (!ENV_KEY_REGEX.test(body.key.trim())) {
                        return reply.status(400).send({
                            success: false,
                            error: 'key must be a valid environment variable name',
                        });
                    }
                    update.key = body.key.trim();
                }

                if (typeof body.isSecret === 'boolean') {
                    update.isSecret = body.isSecret;
                }

                // Determine the effective isSecret for value storage
                const effectiveIsSecret =
                    typeof body.isSecret === 'boolean' ? body.isSecret : existing.isSecret;

                if (typeof body.value === 'string' && body.value.length > 0) {
                    if (body.value.length > 4096) {
                        return reply.status(400).send({ success: false, error: 'value must not exceed 4096 characters' });
                    }
                    // If the client sends SECRET_MASK back, they didn't change the value — keep existing
                    if (body.value !== SECRET_MASK) {
                        update.value = effectiveIsSecret
                            ? encrypt(body.value)
                            : body.value;
                    } else if (effectiveIsSecret !== existing.isSecret) {
                        // isSecret toggle without a new value — re-encrypt or decrypt as needed
                        const currentPlaintext = existing.isSecret
                            ? decrypt(existing.value as IEncryptedPayload)
                            : (existing.value as string);
                        update.value = effectiveIsSecret ? encrypt(currentPlaintext) : currentPlaintext;
                    }
                } else if (typeof body.isSecret === 'boolean' && body.isSecret !== existing.isSecret) {
                    // isSecret toggled but no new value — re-encrypt or decrypt existing value
                    const currentPlaintext = existing.isSecret
                        ? decrypt(existing.value as IEncryptedPayload)
                        : (existing.value as string);
                    update.value = body.isSecret ? encrypt(currentPlaintext) : currentPlaintext;
                }

                await envVarsCollection.updateOne(
                    { _id: varObjectId, organizationId, projectId },
                    { $set: update },
                );

                const saved = await envVarsCollection.findOne({ _id: varObjectId, organizationId, projectId });

                app.log.info({ organizationId, projectId, varId }, '[project-env-vars] Updated env var');

                return reply.send({
                    success: true,
                    data: toClientShape(saved!),
                });
            } catch (error: unknown) {
                app.log.error(error, '[project-env-vars] Failed to update env var');
                return reply.status(500).send({ success: false, error: 'Failed to update environment variable' });
            }
        },
    );

    // ── DELETE /api/projects/:projectId/env/:varId ────────────────────────────
    app.delete(
        '/api/projects/:projectId/env/:varId',
        { preHandler: [apiRateLimit] },
        async (request, reply) => {
            const organizationId = request.user!.organizationId;
            const { projectId, varId } = request.params as { projectId: string; varId: string };

            try {
                const ok = await assertProjectOwnership(projectId, organizationId, reply);
                if (!ok) return;

                let varObjectId: ObjectId;
                try {
                    varObjectId = new ObjectId(varId);
                } catch {
                    return reply.status(400).send({ success: false, error: 'Invalid varId format' });
                }

                const result = await envVarsCollection.deleteOne({
                    _id: varObjectId,
                    organizationId,
                    projectId,
                });

                if (result.deletedCount === 0) {
                    return reply.status(404).send({ success: false, error: 'Environment variable not found' });
                }

                app.log.info({ organizationId, projectId, varId }, '[project-env-vars] Deleted env var');

                return reply.send({ success: true, data: null });
            } catch (error: unknown) {
                app.log.error(error, '[project-env-vars] Failed to delete env var');
                return reply.status(500).send({ success: false, error: 'Failed to delete environment variable' });
            }
        },
    );
}

// ── Exported helper: used by run-trigger handlers to fetch + decrypt all vars ──

/**
 * Fetches all environment variables for a project and returns them as a
 * plain `Record<string, string>` suitable for injection into a task payload.
 * Secrets are decrypted in memory — the plaintext is NEVER persisted.
 */
export async function resolveProjectEnvVars(
    db: ReturnType<MongoClient['db']>,
    organizationId: string,
    projectId: string,
    logger: { warn: (obj: unknown, msg: string) => void },
): Promise<{ envVars: Record<string, string>; secretKeys: string[] }> {
    const envVars: Record<string, string> = {};
    const secretKeys: string[] = [];

    try {
        const docs = await db
            .collection<IEnvVarDocument>('projectEnvVars')
            .find({ organizationId, projectId })
            .toArray();

        for (const doc of docs) {
            if (doc.isSecret) {
                envVars[doc.key] = decrypt(doc.value as IEncryptedPayload);
                secretKeys.push(doc.key);
            } else {
                envVars[doc.key] = doc.value as string;
            }
        }
    } catch (err: unknown) {
        logger.warn(err, '[project-env-vars] Failed to resolve project env vars — proceeding without them');
    }

    return { envVars, secretKeys };
}
