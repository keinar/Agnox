/**
 * Integration Routes — Jira
 *
 * Handles Jira integration settings (stored on the organization document)
 * and proxy endpoints that forward requests to the Jira Cloud REST API.
 *
 * Settings endpoints:
 *   GET  /api/integrations/jira       — Return config (token redacted)
 *   PUT  /api/integrations/jira       — Save + encrypt credentials
 *   POST /api/integrations/jira/test  — Verify credentials against Jira
 *
 * Proxy endpoints (require a configured integration):
 *   GET  /api/jira/projects           — List available Jira projects
 *   GET  /api/jira/issue-types        — Issue types for a project (?projectId=)
 *   POST /api/jira/tickets            — Create a Jira issue
 *
 * Security:
 *   - All routes are protected by the global JWT middleware (no extra preHandler needed)
 *   - Every query is scoped to request.user!.organizationId (tenant isolation)
 *   - The API token is NEVER returned or logged in plaintext
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { encrypt, decrypt, IEncryptedPayload } from '../utils/encryption.js';
import { getDbName } from '../config/server.js';

const DB_NAME = getDbName();

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch the Jira configuration for the caller's organization.
 * Returns null if not configured.
 */
async function getJiraConfig(
    mongoClient: MongoClient,
    organizationId: string,
): Promise<IJiraSettings | null> {
    const db = mongoClient.db(DB_NAME);
    const org = await db.collection('organizations').findOne(
        {
            $or: [
                { _id: new ObjectId(organizationId) },
                { _id: organizationId as any },
            ],
        },
        { projection: { 'integrations.jira': 1 } },
    );
    return org?.integrations?.jira ?? null;
}

/**
 * Build a Basic-Auth header for Jira Cloud (email:apiToken, base64-encoded).
 */
function buildJiraAuthHeader(email: string, apiToken: string): string {
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
    return `Basic ${credentials}`;
}

/**
 * Make an authenticated request to the Jira Cloud REST API.
 * Throws on non-2xx responses with a descriptive message.
 */
async function jiraFetch(
    domain: string,
    path: string,
    email: string,
    apiToken: string,
    options: RequestInit = {},
): Promise<unknown> {
    const url = `https://${domain}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': buildJiraAuthHeader(email, apiToken),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers ?? {}),
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Jira API error ${response.status}: ${body}`);
    }

    return response.json();
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface IJiraSettings {
    domain: string;
    email: string;
    encryptedToken: string;
    iv: string;
    authTag: string;
    enabled: boolean;
    updatedAt: Date;
}

interface IPutJiraBody {
    domain?: string;
    email?: string;
    token?: string;
    enabled?: boolean;
}

interface ICreateTicketBody {
    projectKey?: string;
    issueType?: string;
    summary?: string;
    description?: string;
    executionId?: string;
    expectedResult?: string;
    actualResult?: string;
    assigneeId?: string;
    customFields?: Record<string, unknown>;
}

interface ICreateMetaQuerystring {
    projectKey: string;
    issueTypeId: string;
}

interface IAssigneesQuerystring {
    projectKey: string;
}

/** Normalized custom field schema entry returned to the client. */
interface ICustomFieldSchema {
    key: string;
    name: string;
    required: boolean;
    schema: { type: string; items?: string };
}

/** Standard Jira fields that are already handled by dedicated form inputs. */
const STANDARD_JIRA_FIELDS = new Set([
    'summary', 'description', 'issuetype', 'project', 'reporter',
    'attachment', 'issuelinks', 'subtasks', 'comment', 'votes', 'watches',
]);

// ── Route registration ────────────────────────────────────────────────────────

export async function integrationRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): Promise<void> {
    const db = mongoClient.db(DB_NAME);
    const orgsCollection = db.collection('organizations');

    // ── GET /api/integrations/jira ────────────────────────────────────────────
    // Returns current Jira config with the API token redacted.
    app.get('/api/integrations/jira', async (request, reply) => {
        const organizationId = request.user!.organizationId;

        try {
            const config = await getJiraConfig(mongoClient, organizationId);

            if (!config) {
                return reply.status(404).send({
                    success: false,
                    error: 'Jira integration not configured',
                });
            }

            return reply.send({
                success: true,
                data: {
                    domain: config.domain,
                    email: config.email,
                    token: '***',      // Never expose the encrypted token
                    enabled: config.enabled,
                    updatedAt: config.updatedAt,
                },
            });
        } catch (error) {
            app.log.error(error, '[integrations] Failed to fetch Jira config');
            return reply.status(500).send({ success: false, error: 'Failed to fetch Jira configuration' });
        }
    });

    // ── PUT /api/integrations/jira ────────────────────────────────────────────
    // Encrypts and saves the Jira API token alongside domain/email.
    app.put('/api/integrations/jira', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { domain, email, token, enabled = true } = request.body as IPutJiraBody;

        // Input validation
        if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'Jira domain is required (e.g. yourcompany.atlassian.net)' });
        }
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return reply.status(400).send({ success: false, error: 'A valid Jira account email is required' });
        }
        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'Jira API token is required' });
        }

        try {
            const { encrypted, iv, authTag } = encrypt(token.trim());

            const jiraSettings: IJiraSettings = {
                domain: domain.trim().replace(/^https?:\/\//, ''), // strip protocol if included
                email: email.trim().toLowerCase(),
                encryptedToken: encrypted,
                iv,
                authTag,
                enabled: Boolean(enabled),
                updatedAt: new Date(),
            };

            await orgsCollection.updateOne(
                {
                    $or: [
                        { _id: new ObjectId(organizationId) },
                        { _id: organizationId as any },
                    ],
                },
                { $set: { 'integrations.jira': jiraSettings } },
            );

            app.log.info({ organizationId }, '[integrations] Jira credentials saved');

            return reply.send({
                success: true,
                data: {
                    domain: jiraSettings.domain,
                    email: jiraSettings.email,
                    token: '***',
                    enabled: jiraSettings.enabled,
                    updatedAt: jiraSettings.updatedAt,
                },
            });
        } catch (error) {
            app.log.error(error, '[integrations] Failed to save Jira config');
            return reply.status(500).send({ success: false, error: 'Failed to save Jira configuration' });
        }
    });

    // ── POST /api/integrations/jira/test ──────────────────────────────────────
    // Decrypts the stored token and pings Jira's /myself endpoint to verify credentials.
    app.post('/api/integrations/jira/test', async (request, reply) => {
        const organizationId = request.user!.organizationId;

        try {
            const config = await getJiraConfig(mongoClient, organizationId);

            if (!config) {
                return reply.status(404).send({ success: false, error: 'Jira integration not configured' });
            }

            const apiToken = decrypt({
                encrypted: config.encryptedToken,
                iv: config.iv,
                authTag: config.authTag,
            });

            const result = await jiraFetch(config.domain, '/rest/api/3/myself', config.email, apiToken) as any;

            app.log.info({ organizationId, jiraAccountId: result?.accountId }, '[integrations] Jira credentials verified');

            return reply.send({
                success: true,
                data: {
                    accountId: result?.accountId,
                    displayName: result?.displayName,
                    email: result?.emailAddress,
                },
            });
        } catch (error: any) {
            app.log.warn({ organizationId, error: error?.message }, '[integrations] Jira credentials test failed');
            return reply.status(400).send({
                success: false,
                error: `Jira connection failed: ${error?.message ?? 'Unknown error'}`,
            });
        }
    });

    // ── GET /api/jira/projects ────────────────────────────────────────────────
    // Returns the list of Jira projects accessible by the stored credentials.
    app.get('/api/jira/projects', async (request, reply) => {
        const organizationId = request.user!.organizationId;

        try {
            const config = await getJiraConfig(mongoClient, organizationId);

            if (!config || !config.enabled) {
                return reply.status(404).send({ success: false, error: 'Jira integration not configured or disabled' });
            }

            const apiToken = decrypt({
                encrypted: config.encryptedToken,
                iv: config.iv,
                authTag: config.authTag,
            });

            const result = await jiraFetch(
                config.domain,
                '/rest/api/3/project/search?maxResults=50&orderBy=name',
                config.email,
                apiToken,
            ) as any;

            const projects = (result?.values ?? []).map((p: any) => ({
                id: p.id,
                key: p.key,
                name: p.name,
                type: p.projectTypeKey,
                avatarUrl: p.avatarUrls?.['48x48'] ?? null,
            }));

            return reply.send({ success: true, data: projects });
        } catch (error: any) {
            app.log.error(error, '[integrations] Failed to fetch Jira projects');
            return reply.status(502).send({
                success: false,
                error: `Failed to fetch Jira projects: ${error?.message ?? 'Unknown error'}`,
            });
        }
    });

    // ── GET /api/jira/issue-types ─────────────────────────────────────────────
    // Returns issue types. Optionally filter by ?projectId= to get project-specific types.
    app.get('/api/jira/issue-types', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { projectId } = request.query as { projectId?: string };

        try {
            const config = await getJiraConfig(mongoClient, organizationId);

            if (!config || !config.enabled) {
                return reply.status(404).send({ success: false, error: 'Jira integration not configured or disabled' });
            }

            const apiToken = decrypt({
                encrypted: config.encryptedToken,
                iv: config.iv,
                authTag: config.authTag,
            });

            const path = projectId
                ? `/rest/api/3/issuetype/project?projectId=${encodeURIComponent(projectId)}`
                : '/rest/api/3/issuetype';

            const result = await jiraFetch(config.domain, path, config.email, apiToken) as any[];

            const issueTypes = (Array.isArray(result) ? result : []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description ?? '',
                iconUrl: t.iconUrl ?? null,
                subtask: t.subtask ?? false,
            }));

            return reply.send({ success: true, data: issueTypes });
        } catch (error: any) {
            app.log.error(error, '[integrations] Failed to fetch Jira issue types');
            return reply.status(502).send({
                success: false,
                error: `Failed to fetch Jira issue types: ${error?.message ?? 'Unknown error'}`,
            });
        }
    });

    // ── GET /api/jira/createmeta ──────────────────────────────────────────────
    // Returns the custom-field schema for a given project + issue type.
    // Query params: projectKey (e.g. "AAC"), issueTypeId (numeric Jira ID)
    app.get('/api/jira/createmeta', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { projectKey, issueTypeId } = request.query as ICreateMetaQuerystring;

        if (!projectKey || !issueTypeId) {
            return reply.status(400).send({ success: false, error: 'projectKey and issueTypeId are required' });
        }

        try {
            const config = await getJiraConfig(mongoClient, organizationId);
            if (!config || !config.enabled) {
                return reply.status(404).send({ success: false, error: 'Jira integration not configured or disabled' });
            }

            const apiToken = decrypt({ encrypted: config.encryptedToken, iv: config.iv, authTag: config.authTag });

            const path =
                `/rest/api/3/issue/createmeta` +
                `?projectKeys=${encodeURIComponent(projectKey)}` +
                `&issuetypeIds=${encodeURIComponent(issueTypeId)}` +
                `&expand=projects.issuetypes.fields`;

            const result = await jiraFetch(config.domain, path, config.email, apiToken) as any;

            const rawFields: Record<string, any> =
                result?.projects?.[0]?.issuetypes?.[0]?.fields ?? {};

            const customFields: ICustomFieldSchema[] = Object.entries(rawFields)
                .filter(([key]) => !STANDARD_JIRA_FIELDS.has(key))
                .map(([key, meta]) => ({
                    key,
                    name: meta.name ?? key,
                    required: meta.required === true,
                    schema: {
                        type: meta.schema?.type ?? 'string',
                        items: meta.schema?.items,
                    },
                }));

            return reply.send({ success: true, data: customFields });
        } catch (error: any) {
            app.log.error(error, '[integrations] Failed to fetch Jira createmeta');
            return reply.status(502).send({
                success: false,
                error: `Failed to fetch custom field schema: ${error?.message ?? 'Unknown error'}`,
            });
        }
    });

    // ── GET /api/jira/assignees ───────────────────────────────────────────────
    // Returns users that can be assigned to issues in the given project.
    // Query params: projectKey (e.g. "AAC")
    app.get('/api/jira/assignees', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const { projectKey } = request.query as IAssigneesQuerystring;

        if (!projectKey) {
            return reply.status(400).send({ success: false, error: 'projectKey is required' });
        }

        try {
            const config = await getJiraConfig(mongoClient, organizationId);
            if (!config || !config.enabled) {
                return reply.status(404).send({ success: false, error: 'Jira integration not configured or disabled' });
            }

            const apiToken = decrypt({ encrypted: config.encryptedToken, iv: config.iv, authTag: config.authTag });

            const path =
                `/rest/api/3/user/assignable/search` +
                `?project=${encodeURIComponent(projectKey)}&maxResults=50`;

            const result = await jiraFetch(config.domain, path, config.email, apiToken) as any[];

            const assignees = (Array.isArray(result) ? result : []).map((u: any) => ({
                accountId: u.accountId,
                displayName: u.displayName ?? u.accountId,
                emailAddress: u.emailAddress ?? null,
                avatarUrl: u.avatarUrls?.['48x48'] ?? null,
            }));

            return reply.send({ success: true, data: assignees });
        } catch (error: any) {
            app.log.error(error, '[integrations] Failed to fetch Jira assignees');
            return reply.status(502).send({
                success: false,
                error: `Failed to fetch assignees: ${error?.message ?? 'Unknown error'}`,
            });
        }
    });

    // ── POST /api/jira/tickets ────────────────────────────────────────────────
    // Creates a Jira issue and links it back to the execution document.
    // Body: projectKey, issueType, summary, description, executionId,
    //       expectedResult, actualResult, assigneeId?, customFields?
    app.post('/api/jira/tickets', async (request, reply) => {
        const organizationId = request.user!.organizationId;
        const {
            projectKey, issueType, summary, description,
            executionId, expectedResult, actualResult,
            assigneeId, customFields,
        } = request.body as ICreateTicketBody;

        // Input validation
        if (!projectKey || typeof projectKey !== 'string' || projectKey.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'projectKey is required' });
        }
        if (!issueType || typeof issueType !== 'string' || issueType.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'issueType is required' });
        }
        if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'summary is required' });
        }

        try {
            const config = await getJiraConfig(mongoClient, organizationId);
            if (!config || !config.enabled) {
                return reply.status(404).send({ success: false, error: 'Jira integration not configured or disabled' });
            }

            const apiToken = decrypt({ encrypted: config.encryptedToken, iv: config.iv, authTag: config.authTag });

            // Build description in Atlassian Document Format (ADF)
            const adfContent: unknown[] = [];

            if (description) {
                adfContent.push({
                    type: 'paragraph',
                    content: [{ type: 'text', text: description }],
                });
            }

            if (expectedResult) {
                adfContent.push(
                    { type: 'paragraph', content: [{ type: 'text', text: 'Expected Result:', marks: [{ type: 'strong' }] }] },
                    { type: 'paragraph', content: [{ type: 'text', text: expectedResult }] },
                );
            }

            if (actualResult) {
                adfContent.push(
                    { type: 'paragraph', content: [{ type: 'text', text: 'Actual Result:', marks: [{ type: 'strong' }] }] },
                    { type: 'paragraph', content: [{ type: 'text', text: actualResult }] },
                );
            }

            const issueFields: Record<string, unknown> = {
                project: { key: projectKey.trim().toUpperCase() },
                issuetype: { id: issueType.trim() },
                summary: summary.trim(),
                ...(adfContent.length > 0 && {
                    description: { type: 'doc', version: 1, content: adfContent },
                }),
                // Assignee — injected only when provided
                ...(assigneeId && assigneeId.trim().length > 0 && {
                    assignee: { id: assigneeId.trim() },
                }),
                // Custom fields — spread directly into fields so Jira receives them as top-level keys
                ...(customFields && typeof customFields === 'object' ? customFields : {}),
            };

            const result = await jiraFetch(
                config.domain,
                '/rest/api/3/issue',
                config.email,
                apiToken,
                { method: 'POST', body: JSON.stringify({ fields: issueFields }) },
            ) as any;

            const ticketKey: string = result?.key;
            const ticketUrl = `https://${config.domain}/browse/${ticketKey}`;

            app.log.info({ organizationId, jiraKey: ticketKey, executionId }, '[integrations] Jira ticket created');

            // Bidirectional linkage — push ticket reference back into the execution document.
            // We attempt the update but never fail the overall request if it doesn't match.
            if (executionId) {
                const executionsCollection = db.collection('executions');

                // Support both ObjectId and plain string task IDs
                const execFilter: Record<string, unknown> = {
                    organizationId,
                    $or: [
                        { taskId: executionId },
                        ...(ObjectId.isValid(executionId)
                            ? [{ _id: new ObjectId(executionId) }]
                            : []),
                    ],
                };

                const pushResult = await executionsCollection.updateOne(
                    execFilter,
                    {
                        $push: {
                            jiraTickets: {
                                ticketKey,
                                ticketUrl,
                                createdAt: new Date(),
                            },
                        } as any,
                    },
                );

                app.log.info(
                    { organizationId, executionId, ticketKey, matched: pushResult.matchedCount },
                    '[integrations] Execution jiraTickets updated',
                );
            }

            return reply.status(201).send({
                success: true,
                data: { id: result?.id, key: ticketKey, url: ticketUrl },
            });
        } catch (error: any) {
            app.log.error(error, '[integrations] Failed to create Jira ticket');
            return reply.status(502).send({
                success: false,
                error: `Failed to create Jira ticket: ${error?.message ?? 'Unknown error'}`,
            });
        }
    });
}
