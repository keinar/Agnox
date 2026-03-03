/**
 * Smart PR Routing Routes (Feature D)
 *
 * Endpoint:
 *  - POST /api/webhooks/ci/pr?token=<organizationId>
 *
 * Authentication:
 *  - Token-based: the ?token query param is the organization's _id.
 *  - No JWT required — this is a CI webhook endpoint called by GitHub/GitLab.
 *  - The JWT global hook is bypassed via PUBLIC_PATHS in middleware/auth.ts.
 *
 * Payload (GitHub push / PR event format):
 *  - Accepts a GitHub-style push event: body.commits[].added/modified/removed
 *  - Also accepts a custom body.changedFiles string[] for other CI systems
 *
 * Flow:
 *  1. Look up org by _id (token).
 *  2. Guard on aiFeatures.prRouting.
 *  3. Extract changed file paths from payload.
 *  4. Fetch the org's project run settings for defaultTestFolder + dockerImage.
 *  5. Ask the LLM to map changed files → target test folder/pattern.
 *  6. Dispatch an AMQP task to run only those targeted tests.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { resolveLlmConfig, LlmNotConfiguredError } from '../utils/llm-config.js';
import { rabbitMqService } from '../rabbitmq.js';
import { computeOrgPriority } from '../utils/scheduling.js';

const DB_NAME = 'automation_platform';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract the list of changed file paths from a GitHub-style webhook payload.
 * Supports:
 *  - Custom `body.changedFiles` string[] (explicit list from any CI system)
 *  - GitHub push event: `body.commits[].added/modified/removed`
 *  - GitHub PR event: `body.pull_request.head.ref` (filenames not in payload; returns empty)
 *
 * Deduplicates and limits to 500 files.
 */
function extractChangedFiles(body: Record<string, any>): string[] {
    // Custom explicit list (highest priority)
    if (Array.isArray(body.changedFiles)) {
        return [...new Set(body.changedFiles.filter((f: unknown) => typeof f === 'string'))].slice(0, 500) as string[];
    }

    // GitHub push event format
    if (Array.isArray(body.commits)) {
        const files = new Set<string>();
        for (const commit of body.commits as any[]) {
            for (const file of (commit.added    ?? []) as string[]) files.add(file);
            for (const file of (commit.modified ?? []) as string[]) files.add(file);
            for (const file of (commit.removed  ?? []) as string[]) files.add(file);
        }
        return [...files].slice(0, 500);
    }

    // GitHub PR event — no file list in payload body; return empty
    return [];
}

// ── Single-function LLM call (mirrors ai.ts helper) ───────────────────────────

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { IResolvedLlmConfig } from '../utils/llm-config.js';

async function callLlmText(prompt: string, config: IResolvedLlmConfig): Promise<string> {
    if (config.provider === 'gemini') {
        const genAI  = new GoogleGenerativeAI(config.apiKey);
        const model  = genAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }
    if (config.provider === 'openai') {
        const openai    = new OpenAI({ apiKey: config.apiKey });
        const response  = await openai.chat.completions.create({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
        });
        return (response.choices[0].message.content ?? '').trim();
    }
    if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.apiKey });
        const response  = await anthropic.messages.create({
            model:      config.model,
            max_tokens: 512,
            messages:   [{ role: 'user', content: prompt }],
        });
        const block = response.content[0];
        return (block.type === 'text' ? block.text : '').trim();
    }
    throw new Error(`Unsupported provider: ${config.provider}`);
}

function stripCodeFences(text: string): string {
    return text
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```$/im, '')
        .trim();
}

// ── Route registration ─────────────────────────────────────────────────────────

export async function prRoutingRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
): Promise<void> {
    const db                 = mongoClient.db(DB_NAME);
    const orgsCollection     = db.collection('organizations');
    const settingsCollection = db.collection('projectRunSettings');

    // ── POST /api/webhooks/ci/pr ───────────────────────────────────────────────
    //
    // Query params: token (required) = Organization _id
    // Body: GitHub push / PR webhook payload  (or custom { changedFiles: string[] })
    //
    // Response: { success: true, data: { taskId, targetFolder, dispatchedAt } }

    app.post('/api/webhooks/ci/pr', async (request, reply) => {
        const query = request.query as Record<string, string>;
        const token = query.token;

        if (typeof token !== 'string' || token.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'Missing required ?token query parameter' });
        }

        // Resolve org by token (= orgId)
        let orgId: ObjectId;
        try {
            orgId = new ObjectId(token.trim());
        } catch {
            return reply.status(400).send({ success: false, error: 'Invalid token — must be a valid organization ID' });
        }

        const org = await orgsCollection.findOne(
            { _id: orgId },
            { projection: { _id: 1, aiFeatures: 1, aiConfig: 1, name: 1 } },
        );

        if (!org) {
            return reply.status(404).send({ success: false, error: 'Organization not found' });
        }

        // Feature flag guard
        if (!(org.aiFeatures?.prRouting ?? false)) {
            return reply.status(403).send({
                success: false,
                error: 'Smart PR Routing is not enabled for this organization.',
            });
        }

        const body         = (request.body ?? {}) as Record<string, any>;
        const changedFiles = extractChangedFiles(body);

        if (changedFiles.length === 0) {
            // No file info in payload — acknowledge without dispatching
            app.log.warn(`[pr-routing] No changed files extracted from payload for org "${org.name}" — skipping dispatch`);
            return reply.send({
                success: true,
                data: { dispatched: false, reason: 'No changed files detected in webhook payload' },
            });
        }

        // Fetch project run settings (use the org's first configured project)
        const runSettings = await settingsCollection.findOne(
            { organizationId: org._id.toString() },
            {
                sort: { updatedAt: -1 },
                projection: { dockerImage: 1, defaultTestFolder: 1, targetUrls: 1 },
            },
        );

        if (!runSettings || !runSettings.dockerImage) {
            return reply.status(422).send({
                success: false,
                error: 'No run settings configured for this organization. Set Docker image in Settings → Run Settings.',
            });
        }

        // Resolve LLM config
        const llmConfig = resolveLlmConfig(org.aiConfig);

        const fileList    = changedFiles.slice(0, 100).join('\n');
        const baseFolder  = runSettings.defaultTestFolder || 'tests';

        const routingPrompt = `You are a smart CI test router. Your job is to map changed source files to the most relevant automated test folder.

Base test folder configured for this project: "${baseFolder}"

Changed files in this PR/push:
${fileList}

Analyze the changed files and determine which sub-folder or file pattern within "${baseFolder}" should be run to validate these changes.

Return a single valid JSON object with EXACTLY two fields:
- "targetFolder" (string): The specific sub-folder or glob pattern to run (e.g. "${baseFolder}/auth", "${baseFolder}/checkout/**"). If all tests should run, return "${baseFolder}".
- "reasoning"    (string): A 1-2 sentence explanation of why these tests were selected.

Your ENTIRE response must be a single valid JSON object. Do NOT include markdown or code fences.`;

        app.log.info(`[pr-routing] Resolving test target for ${changedFiles.length} changed file(s) in org "${org.name}" using ${llmConfig.provider}/${llmConfig.model}`);

        let targetFolder = baseFolder;
        let reasoning    = '';

        try {
            const rawText  = await callLlmText(routingPrompt, llmConfig);
            const jsonText = stripCodeFences(rawText);

            const parsed = JSON.parse(jsonText);

            if (typeof parsed.targetFolder === 'string' && parsed.targetFolder.trim().length > 0) {
                targetFolder = parsed.targetFolder.trim();
            }
            if (typeof parsed.reasoning === 'string') {
                reasoning = parsed.reasoning.trim();
            }

            app.log.info(`[pr-routing] LLM selected folder: "${targetFolder}" — ${reasoning}`);
        } catch (llmErr: unknown) {
            // Non-fatal: fall back to the default test folder
            const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
            app.log.warn(`[pr-routing] LLM routing failed (${msg}) — falling back to default folder "${baseFolder}"`);
        }

        // Determine priority
        const orgIdStr = org._id.toString();
        let priority = 5; // default mid-priority for webhook-triggered runs
        try {
            priority = await computeOrgPriority(mongoClient, orgIdStr);
        } catch {
            // Non-fatal — use default
        }

        // Build RabbitMQ task
        const taskId   = randomUUID();
        const baseUrl  = runSettings.targetUrls?.staging ?? runSettings.targetUrls?.dev ?? '';
        const command  = `npx playwright test ${targetFolder}`;

        const task = {
            taskId,
            organizationId: orgIdStr,
            image:          runSettings.dockerImage,
            command,
            folder:         targetFolder,
            config: {
                environment: 'staging' as const,
                baseUrl,
                retryAttempts: 1,
            },
            groupName: `PR Routing — ${new Date().toISOString().slice(0, 10)}`,
            trigger:   'webhook' as const,
        };

        await rabbitMqService.sendToQueue(task, priority);

        app.log.info(`[pr-routing] Dispatched task "${taskId}" to queue (folder="${targetFolder}", priority=${priority}) for org "${org.name}"`);

        return reply.send({
            success: true,
            data: {
                taskId,
                targetFolder,
                reasoning,
                dispatchedAt: new Date().toISOString(),
            },
        });
    });

    app.log.info('✅ PR Routing webhook registered');
    app.log.info('  - POST /api/webhooks/ci/pr  (Feature D: Smart PR Routing)');
}
