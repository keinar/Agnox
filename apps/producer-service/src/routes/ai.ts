/**
 * AI Routes (Quality Hub)
 *
 * Endpoints:
 *  - POST /api/ai/generate-test-steps  — Generate manual test steps from a prompt (Gemini hardwired).
 *  - POST /api/ai/generate-test-suite  — Generate a full test suite from a feature name (Gemini hardwired).
 *  - POST /api/ai/generate-bug-report  — AI-structured bug report from a FAILED execution (Feature A).
 *  - POST /api/ai/analyze-stability    — Flakiness analysis for a test group (Feature B).
 *
 * All endpoints:
 *  - Are JWT-protected via the global auth middleware.
 *  - Do NOT store anything in the database — pure generation endpoints.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { resolveLlmConfig, LlmNotConfiguredError, IResolvedLlmConfig } from '../utils/llm-config.js';
import { sanitizePipeline, PipelineSanitizationError, ALLOWED_COLLECTIONS } from '../utils/chat-sanitizer.js';

const DB_NAME = 'automation_platform';
const LOG_TRUNCATION_LIMIT = 80_000;
const LOG_FIRST_CHARS = 8_000;
const LOG_LAST_CHARS = 72_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Truncate execution output to fit within the LLM context window.
 * Keeps the first 10% (startup/config) and last 90% (where errors concentrate).
 */
function truncateLog(output: string): string {
    if (output.length <= LOG_TRUNCATION_LIMIT) return output;
    const first = output.slice(0, LOG_FIRST_CHARS);
    const last = output.slice(-LOG_LAST_CHARS);
    return `${first}\n[... LOG TRUNCATED — showing first ${LOG_FIRST_CHARS} and last ${LOG_LAST_CHARS} chars ...]\n${last}`;
}

/**
 * Guard that checks an AI feature flag for the current org.
 * Returns true if the feature is enabled; sends a 403 response and returns false otherwise.
 */
async function featureFlagGuard(
    orgsCollection: any,
    organizationId: string,
    flag: keyof {
        rootCauseAnalysis: boolean; autoBugGeneration: boolean; flakinessDetective: boolean;
        testOptimizer: boolean; prRouting: boolean; qualityChatbot: boolean
    },
    reply: any,
): Promise<boolean> {
    const org = await orgsCollection.findOne(
        { _id: new ObjectId(organizationId) },
        { projection: { aiFeatures: 1, aiAnalysisEnabled: 1, aiConfig: 1 } },
    );
    if (!org) {
        reply.code(404).send({ success: false, error: 'Organization not found' });
        return false;
    }
    const enabled = flag === 'rootCauseAnalysis'
        ? (org.aiFeatures?.rootCauseAnalysis ?? (org.aiAnalysisEnabled !== false))
        : (org.aiFeatures?.[flag] ?? false);

    if (!enabled) {
        reply.code(403).send({
            success: false,
            error: 'This AI feature is not enabled for your organization.',
        });
        return false;
    }
    return true;
}

/**
 * Single function that calls the correct LLM provider and returns the raw text response.
 * Supports Gemini, OpenAI, and Anthropic via the resolved config from resolveLlmConfig().
 *
 * @param prompt       - The user-turn message.
 * @param config       - Resolved provider/model/key from resolveLlmConfig().
 * @param systemPrompt - Optional system-level instruction. Each provider handles this natively:
 *                       OpenAI → system message, Anthropic → system field, Gemini → prepended to prompt.
 */
async function callLlmText(prompt: string, config: IResolvedLlmConfig, systemPrompt?: string): Promise<string> {
    if (config.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model });
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
        const result = await model.generateContent(fullPrompt);
        return result.response.text().trim();
    }

    if (config.provider === 'openai') {
        const openai = new OpenAI({ apiKey: config.apiKey });
        const messages: { role: 'system' | 'user'; content: string }[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        const response = await openai.chat.completions.create({
            model: config.model,
            messages,
        });
        return (response.choices[0].message.content ?? '').trim();
    }

    if (config.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: config.apiKey });
        const response = await anthropic.messages.create({
            model: config.model,
            max_tokens: 4096,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: [{ role: 'user', content: prompt }],
        });
        const block = response.content[0];
        return (block.type === 'text' ? block.text : '').trim();
    }

    throw new Error(`Unsupported LLM provider: ${config.provider}`);
}

/**
 * Strip markdown code fences from an LLM response (defensive normalisation).
 */
function stripCodeFences(text: string): string {
    return text
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```$/im, '')
        .trim();
}

// ── Stability Report document shape ───────────────────────────────────────────

interface IStabilityReportDoc {
    organizationId: string;
    groupName: string;
    flakinessScore: number;
    verdict: 'stable' | 'mostly_stable' | 'flaky' | 'highly_flaky';
    findings: string[];
    recommendations: string[];
    executionsAnalyzed: number;
    passRate: number;
    createdAt: Date;
}

// ── Route registration ─────────────────────────────────────────────────────────

export async function aiRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: any, reply: any) => Promise<void>,
): Promise<void> {

    const db = mongoClient.db(DB_NAME);
    const orgsCollection = db.collection('organizations');
    const exeCollection = db.collection('executions');
    const stabilityReportsCollection = db.collection<IStabilityReportDoc>('stability_reports');

    // ── POST /api/ai/generate-test-steps ──────────────────────────────────────
    //
    // Body: { prompt: string }
    //   e.g. "Login flow with invalid credentials"
    //
    // Response: { success: true, data: { steps: ITestStep[] } }
    //   where each step has: action, expectedResult, status: 'PENDING'

    app.post('/api/ai/generate-test-steps', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const body = request.body as { prompt?: unknown };

        if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'prompt is required' });
        }

        const apiKey = process.env.PLATFORM_GEMINI_API_KEY;
        if (!apiKey) {
            app.log.warn('[ai] PLATFORM_GEMINI_API_KEY is not configured — AI generation is disabled');
            return reply.status(503).send({
                success: false,
                error: 'AI generation is not configured on this server',
            });
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            // The prompt is carefully engineered to guarantee JSON-only output.
            // Three layers of enforcement:
            //  1. Explicit "ONLY return JSON" instruction at the top
            //  2. Schema definition with field names and types
            //  3. A concrete single-step example in the exact expected format
            const engineeredPrompt = `You are a senior QA engineer generating manual test steps.

CRITICAL INSTRUCTIONS — YOU MUST FOLLOW THESE EXACTLY:
1. Your ENTIRE response must be a single valid JSON array.
2. Do NOT include markdown, code fences (\`\`\`), explanations, or any text outside the JSON array.
3. The response must start with [ and end with ].

Each element of the array must be a JSON object with EXACTLY these three fields:
  - "action"         (string): The user action to perform — must be non-empty.
  - "expectedResult" (string): The expected outcome after performing the action — must be non-empty.
  - "status"         (string): Always the literal string "PENDING".

Example of the ONLY acceptable response format (for a login scenario):
[{"action":"Open the browser and navigate to the application login page","expectedResult":"The login page loads and displays the email and password input fields along with a Submit button","status":"PENDING"},{"action":"Enter an invalid email address and a wrong password, then click Submit","expectedResult":"An error message is displayed: 'Invalid email or password. Please try again.'","status":"PENDING"}]

Generate test steps for the following scenario:
${body.prompt.trim()}`;

            app.log.info(
                `[ai] Generating test steps for prompt: "${body.prompt.trim().slice(0, 100)}"`,
            );

            const result = await model.generateContent(engineeredPrompt);
            const response = await result.response;
            const rawText = response.text().trim();

            // Defensively strip markdown code fences in case the model ignores the instruction
            const jsonText = rawText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            let parsed: unknown;
            try {
                parsed = JSON.parse(jsonText);
            } catch {
                app.log.error({ rawText }, '[ai] Gemini response is not valid JSON');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unparseable response. Please try a different prompt.',
                });
            }

            if (!Array.isArray(parsed)) {
                app.log.error({ rawText }, '[ai] Gemini response is not a JSON array');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unexpected format. Please try again.',
                });
            }

            // Sanitise every step: keep only valid action + expectedResult pairs
            const steps = (parsed as any[])
                .filter(
                    (s) =>
                        s !== null &&
                        typeof s === 'object' &&
                        typeof s.action === 'string' &&
                        s.action.trim().length > 0 &&
                        typeof s.expectedResult === 'string' &&
                        s.expectedResult.trim().length > 0,
                )
                .map((s) => ({
                    action: (s.action as string).trim(),
                    expectedResult: (s.expectedResult as string).trim(),
                    status: 'PENDING' as const,
                }));

            if (steps.length === 0) {
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned no valid steps. Please refine your prompt and try again.',
                });
            }

            app.log.info(`[ai] Generated ${steps.length} test steps successfully`);
            return reply.send({ success: true, data: { steps } });

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai] Failed to generate test steps via Gemini');
            return reply.status(500).send({ success: false, error: 'Failed to generate test steps' });
        }
    });

    // ── POST /api/ai/generate-test-suite ──────────────────────────────────────
    //
    // Body: { feature: string }
    //   e.g. "Login Screen"
    //
    // Response: { success: true, data: { testCases: [...] } }
    //   Each test case has: title, description, suite, preconditions, steps[]

    app.post('/api/ai/generate-test-suite', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const body = request.body as { feature?: unknown };

        if (typeof body.feature !== 'string' || body.feature.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'feature is required' });
        }

        const apiKey = process.env.PLATFORM_GEMINI_API_KEY;
        if (!apiKey) {
            app.log.warn('[ai] PLATFORM_GEMINI_API_KEY is not configured — AI generation is disabled');
            return reply.status(503).send({
                success: false,
                error: 'AI generation is not configured on this server',
            });
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const featureName = body.feature.trim();

            const engineeredPrompt = `You are a senior QA engineer creating a comprehensive manual test suite for a software feature.

CRITICAL INSTRUCTIONS — YOU MUST FOLLOW THESE EXACTLY:
1. Your ENTIRE response must be a single valid JSON array.
2. Do NOT include markdown, code fences (\`\`\`), explanations, or any text outside the JSON array.
3. The response must start with [ and end with ].

Each element of the array must be a JSON object with EXACTLY these five fields:
  - "title"          (string): A concise, descriptive test case title — must be non-empty.
  - "description"    (string): A 1-2 sentence explanation of what this test case validates.
  - "suite"          (string): Always the literal string "${featureName}".
  - "preconditions"  (string): Any setup or pre-existing conditions required before executing this test.
  - "steps"          (array):  An array of step objects. Each step has exactly three fields:
      - "action"         (string): The user action to perform.
      - "expectedResult" (string): The expected outcome after performing the action.
      - "status"         (string): Always the literal string "PENDING".

Generate 5-8 test cases covering the most important scenarios (happy path, negative cases, edge cases) for:
${featureName}

Example of the ONLY acceptable format (showing one test case):
[{"title":"Successful Login","description":"Verify that a user can log in with valid credentials.","suite":"${featureName}","preconditions":"User has a registered account with valid credentials.","steps":[{"action":"Navigate to the login page","expectedResult":"Login form with email and password fields is displayed","status":"PENDING"},{"action":"Enter valid email and password, click Submit","expectedResult":"User is redirected to the dashboard","status":"PENDING"}]}]`;

            app.log.info(
                `[ai] Generating test suite for feature: "${featureName}"`,
            );

            const result = await model.generateContent(engineeredPrompt);
            const response = await result.response;
            const rawText = response.text().trim();

            // Defensively strip markdown code fences
            const jsonText = rawText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            let parsed: unknown;
            try {
                parsed = JSON.parse(jsonText);
            } catch {
                app.log.error({ rawText }, '[ai] Gemini suite response is not valid JSON');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unparseable response. Please try a different prompt.',
                });
            }

            if (!Array.isArray(parsed)) {
                app.log.error({ rawText }, '[ai] Gemini suite response is not a JSON array');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unexpected format. Please try again.',
                });
            }

            // Sanitise and validate each test case
            const testCases = (parsed as any[])
                .filter(
                    (tc) =>
                        tc !== null &&
                        typeof tc === 'object' &&
                        typeof tc.title === 'string' &&
                        tc.title.trim().length > 0,
                )
                .map((tc) => {
                    // Sanitise steps within each test case
                    const steps = Array.isArray(tc.steps)
                        ? tc.steps
                            .filter(
                                (s: any) =>
                                    s !== null &&
                                    typeof s === 'object' &&
                                    typeof s.action === 'string' &&
                                    s.action.trim().length > 0 &&
                                    typeof s.expectedResult === 'string' &&
                                    s.expectedResult.trim().length > 0,
                            )
                            .map((s: any) => ({
                                action: (s.action as string).trim(),
                                expectedResult: (s.expectedResult as string).trim(),
                                status: 'PENDING' as const,
                            }))
                        : [];

                    return {
                        title: (tc.title as string).trim(),
                        description: typeof tc.description === 'string' ? tc.description.trim() : '',
                        suite: typeof tc.suite === 'string' ? tc.suite.trim() : featureName,
                        preconditions: typeof tc.preconditions === 'string' ? tc.preconditions.trim() : '',
                        steps,
                    };
                });

            if (testCases.length === 0) {
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned no valid test cases. Please refine your prompt and try again.',
                });
            }

            app.log.info(`[ai] Generated ${testCases.length} test cases for suite "${featureName}"`);
            return reply.send({ success: true, data: { testCases } });

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai] Failed to generate test suite via Gemini');
            return reply.status(500).send({ success: false, error: 'Failed to generate test suite' });
        }
    });

    // ── POST /api/ai/generate-bug-report ──────────────────────────────────────
    //
    // Feature A: Auto-Bug Generation
    //
    // Body: { executionId: string }
    //
    // Response: { success: true, data: {
    //   title, stepsToReproduce, expectedBehavior, actualBehavior, codePatches, severity, rawAnalysis
    // }}
    //
    // Feature flag guard: aiFeatures.autoBugGeneration
    // Tenant isolation: execution fetched with organizationId filter

    app.post('/api/ai/generate-bug-report', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const body = request.body as { executionId?: unknown };
        const currentUser = request.user!;

        if (typeof body.executionId !== 'string' || body.executionId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'executionId is required' });
        }

        // Feature flag guard
        const allowed = await featureFlagGuard(orgsCollection, currentUser.organizationId, 'autoBugGeneration', reply);
        if (!allowed) return;

        try {
            // Fetch execution — tenant-isolated
            const execution = await exeCollection.findOne({
                taskId: body.executionId.trim(),
                organizationId: currentUser.organizationId,
            }, {
                projection: { taskId: 1, status: 1, output: 1, error: 1, image: 1, config: 1, groupName: 1 },
            });

            if (!execution) {
                return reply.status(404).send({ success: false, error: 'Execution not found' });
            }

            if (execution.status !== 'FAILED' && execution.status !== 'ERROR') {
                return reply.status(400).send({
                    success: false,
                    error: 'Bug reports can only be generated for FAILED or ERROR executions',
                });
            }

            // Resolve LLM config (BYOK → platform env fallback)
            const org = await orgsCollection.findOne(
                { _id: new ObjectId(currentUser.organizationId) },
                { projection: { aiConfig: 1 } },
            );
            const llmConfig = resolveLlmConfig(org?.aiConfig);

            // Build context (with log truncation)
            const rawOutput = typeof execution.output === 'string' ? execution.output : '';
            const rawError = typeof execution.error === 'string' ? execution.error : '';
            const outputText = truncateLog(rawOutput);
            const errorText = rawError.slice(0, 5_000);

            const prompt = `You are an expert QA engineer and software developer tasked with analyzing a failed automated test execution and generating a structured bug report.

CRITICAL INSTRUCTIONS:
1. Your ENTIRE response must be a single valid JSON object.
2. Do NOT include markdown, code fences, or any text outside the JSON object.
3. The response must start with { and end with }.

Analyze the following failed test execution and return a JSON object with EXACTLY these fields:
- "title"             (string): A concise, descriptive bug title (max 120 chars).
- "severity"          (string): One of "critical", "high", "medium", or "low" — based on the failure impact.
- "stepsToReproduce"  (array of strings): Numbered steps to reproduce the failure.
- "expectedBehavior"  (string): What should have happened.
- "actualBehavior"    (string): What actually happened (derived from the logs/error).
- "codePatches"       (array of objects): Each with "file" (string, may be empty if unknown) and "suggestion" (string describing the fix). Return [] if no specific patch can be identified.
- "rawAnalysis"       (string): A 2-4 sentence plain-text analysis of the root cause.

Execution details:
- Run ID: ${execution.taskId}
- Status: ${execution.status}
- Docker image: ${execution.image ?? 'N/A'}
- Test group: ${execution.groupName ?? 'N/A'}
- Environment: ${execution.config?.environment ?? 'N/A'}
- Base URL: ${execution.config?.baseUrl ?? 'N/A'}

Error output:
${errorText || '(no error field)'}

Execution log:
${outputText || '(no output)'}`;

            app.log.info(`[ai] Generating bug report for execution "${execution.taskId}" using ${llmConfig.provider}/${llmConfig.model}`);

            const rawText = await callLlmText(prompt, llmConfig);
            const jsonText = stripCodeFences(rawText);

            let parsed: any;
            try {
                parsed = JSON.parse(jsonText);
            } catch {
                app.log.error({ rawText }, '[ai] Bug report response is not valid JSON');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unparseable response. Please try again.',
                });
            }

            const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

            const bugReport = {
                title: typeof parsed.title === 'string' ? parsed.title.trim() : `Failed execution: ${execution.taskId}`,
                severity: VALID_SEVERITIES.has(parsed.severity) ? parsed.severity : 'high',
                stepsToReproduce: Array.isArray(parsed.stepsToReproduce)
                    ? parsed.stepsToReproduce.filter((s: unknown) => typeof s === 'string').map((s: string) => s.trim())
                    : [],
                expectedBehavior: typeof parsed.expectedBehavior === 'string' ? parsed.expectedBehavior.trim() : '',
                actualBehavior: typeof parsed.actualBehavior === 'string' ? parsed.actualBehavior.trim() : '',
                codePatches: Array.isArray(parsed.codePatches)
                    ? parsed.codePatches
                        .filter((p: any) => typeof p === 'object' && p !== null)
                        .map((p: any) => ({
                            file: typeof p.file === 'string' ? p.file.trim() : '',
                            suggestion: typeof p.suggestion === 'string' ? p.suggestion.trim() : '',
                        }))
                    : [],
                rawAnalysis: typeof parsed.rawAnalysis === 'string' ? parsed.rawAnalysis.trim() : rawText,
            };

            app.log.info(`[ai] Bug report generated for execution "${execution.taskId}"`);
            return reply.send({ success: true, data: bugReport });

        } catch (err: unknown) {
            if (err instanceof LlmNotConfiguredError) {
                return reply.status(503).send({ success: false, error: err.message });
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai] Failed to generate bug report');
            return reply.status(500).send({ success: false, error: 'Failed to generate bug report' });
        }
    });

    // ── POST /api/ai/analyze-stability ────────────────────────────────────────
    //
    // Feature B: Flakiness & Stability Detective
    //
    // Body: { groupName: string }
    //
    // Response: { success: true, data: {
    //   groupName, flakinessScore, verdict, executionsAnalyzed, passRate, findings, recommendations
    // }}
    //
    // Feature flag guard: aiFeatures.flakinessDetective
    // DB constraint: last 20 executions, projection: status, error, output only

    app.post('/api/ai/analyze-stability', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const body = request.body as { groupName?: unknown };
        const currentUser = request.user!;

        if (typeof body.groupName !== 'string' || body.groupName.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'groupName is required' });
        }

        const groupName = body.groupName.trim();

        // Feature flag guard
        const allowed = await featureFlagGuard(orgsCollection, currentUser.organizationId, 'flakinessDetective', reply);
        if (!allowed) return;

        try {
            // Hard-limited to last 20 executions; only necessary fields projected
            const executions = await exeCollection
                .find(
                    {
                        organizationId: currentUser.organizationId,
                        groupName,
                    },
                    {
                        projection: { status: 1, error: 1, output: 1, startTime: 1 },
                        sort: { startTime: -1 },
                        limit: 20,
                    },
                )
                .toArray();

            if (executions.length === 0) {
                return reply.status(404).send({
                    success: false,
                    error: `No executions found for group "${groupName}"`,
                });
            }

            // Resolve LLM config
            const org = await orgsCollection.findOne(
                { _id: new ObjectId(currentUser.organizationId) },
                { projection: { aiConfig: 1 } },
            );
            const llmConfig = resolveLlmConfig(org?.aiConfig);

            // Summarise execution history (keep error/output short to avoid token overflow)
            const historySummary = executions.map((e, i) => {
                const errorSnippet = typeof e.error === 'string' ? e.error.slice(0, 500) : '';
                const outputSnippet = typeof e.output === 'string' ? e.output.slice(-1_000) : '';
                return `Run ${i + 1} — Status: ${e.status}${errorSnippet ? `\nError: ${errorSnippet}` : ''}${outputSnippet ? `\nLog tail: ${outputSnippet}` : ''}`;
            }).join('\n\n---\n\n');

            const passCount = executions.filter((e) => e.status === 'PASSED').length;
            const passRate = passCount / executions.length;

            // ── Step 1: Analyzer — generate a draft stability analysis ──────────────
            // The Analyzer sees only the raw execution data and produces a first-pass
            // assessment. This draft may contain hallucinations; the Critic corrects them.

            const analyzerPrompt = `You are a QA stability analyst. Analyze the following automated test execution history for the group "${groupName}" and produce a draft stability report.

Return a JSON object with EXACTLY these fields:
- "flakinessScore"   (number, 0-100): Higher = more flaky. 0 = perfectly stable, 100 = always fails.
- "verdict"          (string): One of "stable", "mostly_stable", "flaky", or "highly_flaky".
- "findings"         (array of strings): Key observations about failure patterns, error types, or timing issues. Reference only test names and file names that appear explicitly in the execution history below.
- "recommendations"  (array of strings): Actionable steps to improve stability.

Your ENTIRE response must be a single valid JSON object. Do NOT include markdown or code fences.

Summary stats:
- Group: ${groupName}
- Total runs analyzed: ${executions.length}
- Passed: ${passCount} / ${executions.length} (${Math.round(passRate * 100)}% pass rate)

Execution history (most recent first):
${historySummary}`;

            app.log.info(`[ai:analyzer] Generating draft stability analysis for group "${groupName}" (${executions.length} runs) using ${llmConfig.provider}/${llmConfig.model}`);

            const draftRawText = await callLlmText(analyzerPrompt, llmConfig);
            const draftText = stripCodeFences(draftRawText);

            app.log.info(`[ai:analyzer] Draft produced for group "${groupName}" — forwarding to Critic`);

            // ── Step 2: Critic — validate and ground the draft ───────────────────────
            // The Critic receives the original raw data AND the draft. Its sole job is
            // to detect and correct any hallucinations, then return the final JSON.

            const CRITIC_SYSTEM = `You are an expert, zero-tolerance QA Auditor. Your sole job is to evaluate a proposed draft stability analysis against the raw execution data and return a corrected, grounded result.

Rules you MUST follow:
1. If the raw data shows ALL executions have status PASSED and no errors, but the draft invents failures, visual regressions, or error messages — completely override it. Set flakinessScore to 0, verdict to "stable", findings to ["All runs passed successfully."], and recommendations to ["No action required — suite is fully stable."].
2. Remove any finding or recommendation that references a file name, test name, or error string that does NOT appear verbatim in the raw execution history.
3. Ensure the flakinessScore is arithmetically consistent with the pass rate supplied in the raw data.
4. Return ONLY strictly valid JSON. Do NOT include markdown, code fences, or any text outside the JSON object.
5. The JSON must match this exact structure: { "flakinessScore": number, "verdict": string, "findings": string[], "recommendations": string[] }`;

            const criticPrompt = `RAW EXECUTION DATA:
Group: ${groupName}
Total runs analyzed: ${executions.length}
Passed: ${passCount} / ${executions.length} (${Math.round(passRate * 100)}% pass rate)

Execution history (most recent first):
${historySummary}

---

DRAFT ANALYSIS TO AUDIT:
${draftText}

---

Review the draft against the raw data. Correct any hallucinations and return your final validated JSON.`;

            app.log.info(`[ai:critic] Auditing draft stability analysis for group "${groupName}"`);

            const criticRawText = await callLlmText(criticPrompt, llmConfig, CRITIC_SYSTEM);
            const jsonText = stripCodeFences(criticRawText);

            let parsed: any;
            try {
                parsed = JSON.parse(jsonText);
            } catch {
                app.log.error({ criticRawText }, '[ai:critic] Stability analysis response is not valid JSON');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unparseable response. Please try again.',
                });
            }

            const VALID_VERDICTS = new Set(['stable', 'mostly_stable', 'flaky', 'highly_flaky']);

            const report = {
                groupName,
                executionsAnalyzed: executions.length,
                passRate: Math.round(passRate * 100),
                flakinessScore: typeof parsed.flakinessScore === 'number'
                    ? Math.min(100, Math.max(0, Math.round(parsed.flakinessScore)))
                    : Math.round((1 - passRate) * 100),
                verdict: VALID_VERDICTS.has(parsed.verdict) ? parsed.verdict : (passRate >= 0.9 ? 'stable' : passRate >= 0.7 ? 'mostly_stable' : passRate >= 0.4 ? 'flaky' : 'highly_flaky'),
                findings: Array.isArray(parsed.findings) ? parsed.findings.filter((f: unknown) => typeof f === 'string').map((f: string) => f.trim()) : [],
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((r: unknown) => typeof r === 'string').map((r: string) => r.trim()) : [],
            };

            // Persist the report for history (non-fatal on failure)
            try {
                await stabilityReportsCollection.insertOne({
                    organizationId: currentUser.organizationId,
                    groupName,
                    flakinessScore: report.flakinessScore,
                    verdict: report.verdict as IStabilityReportDoc['verdict'],
                    findings: report.findings,
                    recommendations: report.recommendations,
                    executionsAnalyzed: report.executionsAnalyzed,
                    passRate: report.passRate,
                    createdAt: new Date(),
                });
            } catch (saveErr: unknown) {
                app.log.warn(
                    { error: saveErr instanceof Error ? saveErr.message : saveErr },
                    '[ai] Failed to persist stability report — response still returned',
                );
            }

            app.log.info(`[ai:critic] Stability report finalised for group "${groupName}": score=${report.flakinessScore}, verdict=${report.verdict}`);
            return reply.send({ success: true, data: report });

        } catch (err: unknown) {
            if (err instanceof LlmNotConfiguredError) {
                return reply.status(503).send({ success: false, error: err.message });
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai] Failed to analyze stability');
            return reply.status(500).send({ success: false, error: 'Failed to analyze stability' });
        }
    });

    // ── GET /api/ai/stability-reports ─────────────────────────────────────────
    //
    // Query params: groupName (optional — filters to a specific group)
    //
    // Returns the 50 most recent persisted stability reports for the current org,
    // optionally filtered to a single group. No feature-flag guard: historical
    // data is always readable even if the flag is later disabled.

    app.get('/api/ai/stability-reports', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const query = request.query as { groupName?: string };
        const currentUser = request.user!;

        try {
            const filter: Record<string, unknown> = { organizationId: currentUser.organizationId };
            if (typeof query.groupName === 'string' && query.groupName.trim().length > 0) {
                filter.groupName = query.groupName.trim();
            }

            const reports = await stabilityReportsCollection
                .find(filter, { sort: { createdAt: -1 }, limit: 50 })
                .toArray();

            return reply.send({ success: true, data: { reports } });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai] Failed to fetch stability reports');
            return reply.status(500).send({ success: false, error: 'Failed to fetch stability reports' });
        }
    });

    // ── POST /api/ai/optimize-test-cases ──────────────────────────────────────
    //
    // Feature C: Smart Test Optimizer
    //
    // Body: { testCaseIds: string[] }
    //
    // Response: { success: true, data: { optimizedCases: IOptimizedTestCase[] } }
    //
    // Feature flag guard: aiFeatures.testOptimizer
    // Tenant isolation: test cases fetched with organizationId filter
    // Dual-agent: Analyzer generates BDD draft → Critic validates and corrects

    app.post('/api/ai/optimize-test-cases', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const body = request.body as { testCaseIds?: unknown };
        const currentUser = request.user!;

        if (!Array.isArray(body.testCaseIds) || body.testCaseIds.length === 0) {
            return reply.status(400).send({ success: false, error: 'testCaseIds must be a non-empty array' });
        }
        if (body.testCaseIds.length > 20) {
            return reply.status(400).send({ success: false, error: 'Maximum 20 test cases can be optimized at once' });
        }

        const rawIds = body.testCaseIds as unknown[];
        const validIds: ObjectId[] = [];
        for (const id of rawIds) {
            if (typeof id !== 'string' || id.trim().length === 0) {
                return reply.status(400).send({ success: false, error: 'Each testCaseId must be a non-empty string' });
            }
            try {
                validIds.push(new ObjectId(id.trim()));
            } catch {
                return reply.status(400).send({ success: false, error: `Invalid testCaseId: ${id}` });
            }
        }

        // Feature flag guard
        const allowed = await featureFlagGuard(orgsCollection, currentUser.organizationId, 'testOptimizer', reply);
        if (!allowed) return;

        try {
            const testCasesCollection = db.collection('test_cases');

            // Fetch test cases — tenant-isolated
            const testCases = await testCasesCollection
                .find({
                    _id: { $in: validIds },
                    organizationId: currentUser.organizationId,
                })
                .project({ _id: 1, title: 1, description: 1, suite: 1, preconditions: 1, type: 1, steps: 1 })
                .toArray();

            if (testCases.length === 0) {
                return reply.status(404).send({ success: false, error: 'No matching test cases found' });
            }

            // Resolve LLM config (BYOK → platform env fallback)
            const org = await orgsCollection.findOne(
                { _id: new ObjectId(currentUser.organizationId) },
                { projection: { aiConfig: 1 } },
            );
            const llmConfig = resolveLlmConfig(org?.aiConfig);

            // Build a compact representation for the LLM
            const testCaseSummaries = testCases.map((tc: any) => {
                const steps = Array.isArray(tc.steps) ? tc.steps : [];
                return `### Test Case: "${tc.title}" (ID: ${tc._id.toString()})
Type: ${tc.type ?? 'MANUAL'}
Suite: ${tc.suite ?? 'N/A'}
Preconditions: ${tc.preconditions ?? 'N/A'}
Steps (${steps.length}):
${steps.map((s: any, i: number) => `  ${i + 1}. Action: ${s.action ?? ''}\n     Expected: ${s.expectedResult ?? ''}`).join('\n')}`;
            }).join('\n\n---\n\n');

            // ── Step 1: Analyzer — produce BDD-optimized draft ────────────────────
            const analyzerPrompt = `You are a senior QA engineer tasked with optimizing manual test cases.

For each test case below, produce an optimized BDD version. Your ENTIRE response must be a single valid JSON array. Do NOT include markdown or code fences.

Each element must be a JSON object with EXACTLY these fields:
- "originalId"       (string): The exact test case ID from the input.
- "title"            (string): The original test case title (unchanged).
- "optimizedSteps"   (array): Deduplicated BDD steps. Each step is an object with:
    - "action"         (string): The step text starting with "Given", "When", or "Then".
    - "expectedResult" (string): The expected outcome for this step.
- "duplicatesRemoved" (number): How many redundant/duplicate steps were merged or removed.
- "edgeCases"        (array of strings): 2-4 additional edge case scenarios not currently covered.
- "rationale"        (string): A 1-2 sentence explanation of the optimizations made.

BDD rules:
- "Given" = preconditions / setup state
- "When"  = the user action or event being tested
- "Then"  = the expected outcome / assertion

Input test cases:
${testCaseSummaries}`;

            app.log.info(`[ai:analyzer] Generating BDD optimization draft for ${testCases.length} test case(s) using ${llmConfig.provider}/${llmConfig.model}`);

            const draftRaw = await callLlmText(analyzerPrompt, llmConfig);
            const draftText = stripCodeFences(draftRaw);

            app.log.info(`[ai:analyzer] Draft produced — forwarding to Critic`);

            // ── Step 2: Critic — validate the draft against original data ─────────
            const CRITIC_SYSTEM = `You are a strict QA Auditor validating an AI-generated test optimization draft.

Rules you MUST follow:
1. Every "originalId" in the output MUST match one of the IDs from the input. Remove any element whose originalId is not in the input.
2. Every "optimizedSteps" array must be non-empty (at minimum, the core happy-path steps must remain).
3. Each step's "action" must begin with "Given", "When", or "Then".
4. "duplicatesRemoved" must be a non-negative integer.
5. "edgeCases" must be an array of strings (2-4 items).
6. Return ONLY strictly valid JSON. No markdown, no code fences, no explanatory text.
7. The output must be a JSON array starting with [ and ending with ].`;

            const validIdsStr = testCases.map((tc: any) => tc._id.toString()).join(', ');
            const criticPrompt = `VALID TEST CASE IDs: [${validIdsStr}]

DRAFT OPTIMIZATION TO AUDIT:
${draftText}

Review the draft. Correct any invalid IDs, empty step arrays, or non-BDD actions. Return the final validated JSON array.`;

            app.log.info(`[ai:critic] Auditing BDD optimization draft for ${testCases.length} test case(s)`);

            const criticRaw = await callLlmText(criticPrompt, llmConfig, CRITIC_SYSTEM);
            const jsonText = stripCodeFences(criticRaw);

            let parsed: any[];
            try {
                const raw = JSON.parse(jsonText);
                if (!Array.isArray(raw)) throw new Error('not an array');
                parsed = raw;
            } catch {
                app.log.error({ criticRaw }, '[ai:critic] Optimizer response is not valid JSON');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unparseable response. Please try again.',
                });
            }

            const validIdSet = new Set(testCases.map((tc: any) => tc._id.toString()));

            const optimizedCases = parsed
                .filter((item: any) =>
                    item !== null &&
                    typeof item === 'object' &&
                    typeof item.originalId === 'string' &&
                    validIdSet.has(item.originalId),
                )
                .map((item: any) => {
                    const steps: Array<{ action: string; expectedResult: string; status: 'PENDING' }> =
                        Array.isArray(item.optimizedSteps)
                            ? item.optimizedSteps
                                .filter((s: any) =>
                                    typeof s?.action === 'string' &&
                                    s.action.trim().length > 0 &&
                                    typeof s?.expectedResult === 'string' &&
                                    s.expectedResult.trim().length > 0,
                                )
                                .map((s: any) => ({
                                    action: s.action.trim(),
                                    expectedResult: s.expectedResult.trim(),
                                    status: 'PENDING' as const,
                                }))
                            : [];

                    const originalTc = testCases.find((tc: any) => tc._id.toString() === item.originalId);

                    return {
                        originalId: item.originalId,
                        title: typeof item.title === 'string' ? item.title.trim() : (originalTc?.title ?? ''),
                        originalSteps: Array.isArray(originalTc?.steps) ? originalTc.steps : [],
                        optimizedSteps: steps,
                        duplicatesRemoved: typeof item.duplicatesRemoved === 'number' && item.duplicatesRemoved >= 0
                            ? Math.round(item.duplicatesRemoved)
                            : 0,
                        edgeCases: Array.isArray(item.edgeCases)
                            ? item.edgeCases.filter((e: unknown) => typeof e === 'string').map((e: string) => e.trim())
                            : [],
                        rationale: typeof item.rationale === 'string' ? item.rationale.trim() : '',
                    };
                });

            app.log.info(`[ai:critic] Optimization finalised for ${optimizedCases.length} test case(s)`);
            return reply.send({ success: true, data: { optimizedCases } });

        } catch (err: unknown) {
            if (err instanceof LlmNotConfiguredError) {
                return reply.status(503).send({ success: false, error: err.message });
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai] Failed to optimize test cases');
            return reply.status(500).send({ success: false, error: 'Failed to optimize test cases' });
        }
    });

    // ── POST /api/ai/chat ──────────────────────────────────────────────────────
    //
    // Feature E: Quality Chatbot
    //
    // Body: { message: string; conversationId?: string }
    //
    // Response: { success: true, data: { answer, conversationId, chartData? } }
    //
    // Feature flag guard:  aiFeatures.qualityChatbot
    // Tenant isolation:    sanitizePipeline() injects organizationId unconditionally
    // NoSQL injection:     sanitizePipeline() enforces allowlists on every pipeline value
    //
    // Two-turn LLM flow:
    //   1. LLM A: translate natural-language question → { collection, pipeline }
    //   2. sanitizePipeline() — mandatory security layer
    //   3. MongoDB aggregate() — execute sanitized pipeline
    //   4. LLM B: summarise DB results in natural language + optional chartData

    app.post('/api/ai/chat', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const body = request.body as { message?: unknown; conversationId?: unknown };
        const currentUser = request.user!;

        // ── Input validation ───────────────────────────────────────────────────
        if (typeof body.message !== 'string' || body.message.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'message is required' });
        }
        const message = body.message.trim();
        if (message.length > 1_000) {
            return reply.status(400).send({ success: false, error: 'message must be 1000 characters or less' });
        }
        const conversationId: string =
            typeof body.conversationId === 'string' && body.conversationId.trim().length > 0
                ? body.conversationId.trim()
                : randomUUID();

        // ── Feature flag guard ─────────────────────────────────────────────────
        const allowed = await featureFlagGuard(orgsCollection, currentUser.organizationId, 'qualityChatbot', reply);
        if (!allowed) return;

        const chatSessionsCollection = db.collection('chat_sessions');

        try {
            // ── Resolve LLM config ─────────────────────────────────────────────
            const org = await orgsCollection.findOne(
                { _id: new ObjectId(currentUser.organizationId) },
                { projection: { aiConfig: 1 } },
            );
            const llmConfig = resolveLlmConfig(org?.aiConfig);

            // ── Load conversation history (last 10 turns for context) ──────────
            const sessionDoc = await chatSessionsCollection.findOne({
                conversationId,
                organizationId: currentUser.organizationId,
            });
            const history: Array<{ role: 'user' | 'assistant'; content: string }> =
                Array.isArray(sessionDoc?.history) ? sessionDoc.history.slice(-10) : [];

            // ── Step 1: LLM A — translate question to MongoDB pipeline ─────────
            const PIPELINE_SYSTEM = `You are a MongoDB query expert. Your ONLY job is to translate a natural language question into a MongoDB aggregation pipeline JSON object.

You have access to three collections:
- "executions": Fields include organizationId (ObjectId or string), status (string: PASSED/FAILED/ERROR/RUNNING), groupName (string), taskId (string), output (string), startTime (Date stored as ISODate in MongoDB — use THIS field for all date filters on executions, NOT createdAt), duration (number in ms).
- "test_cycles": Fields include organizationId (ObjectId or string), name (string), status (string), totalTests (number), passedTests (number), failedTests (number), createdAt (Date stored as ISODate in MongoDB).
- "test_cases": Fields include organizationId (ObjectId or string), title (string), description (string), suite (string), type (string: MANUAL/AUTOMATED), status (string), preconditions (string), steps (array of { action, expectedResult }), createdAt (Date stored as ISODate in MongoDB).

STRICT OUTPUT RULES:
1. Respond with ONLY a single JSON object — no markdown, no explanation, no code fences.
2. The JSON must have exactly two fields:
   - "collection": (string) one of "executions", "test_cycles", or "test_cases"
   - "pipeline": (array) a valid MongoDB aggregation pipeline
3. Do NOT include $out, $merge, $where, $function, $accumulator, $graphLookup, $unionWith.
4. Do NOT include organizationId in your pipeline — it will be injected automatically.
5. Always include a $limit stage (max 100 documents).
6. Use $group and $project to compute summaries when appropriate.

DATE RULES (CRITICAL):
7. The current date and time is __CURRENT_DATE__. ALWAYS derive your date ranges from this value — never use hardcoded past years (e.g. 2023, 2024).
8. NEVER use MongoDB-specific constructor syntax like ISODate(), ObjectId(), or NumberLong(). These are NOT valid JSON and will cause a parse error.
9. For date comparisons ($gte, $lte, $gt, $lt, $eq on date fields), provide the raw ISO-8601 date string as the value. The backend will automatically convert these strings to BSON Date objects before execution.
   CORRECT:   { "$match": { "startTime": { "$gte": "__CURRENT_DATE_START__" } } }
   INCORRECT: { "$match": { "startTime": { "$gte": ISODate("2026-01-01") } } }
10. When the user asks about "today", use: { "$match": { "startTime": { "$gte": "__CURRENT_DATE_START__", "$lte": "__CURRENT_DATE_END__" } } }

NULL GROUP RULES (CRITICAL):
11. When grouping by "groupName" (or any nullable field), ALWAYS add a $match stage immediately before the $group stage to filter out null and empty values:
    { "$match": { "groupName": { "$ne": null, "$gt": "" } } }
    This prevents null/empty keys from appearing in the grouped output.`;

            // ── Resolve dynamic date placeholders ─────────────────────────────
            const _now = new Date();
            const startOfDay = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0).toISOString();
            const endOfDay = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59, 999).toISOString();
            const finalSystemPrompt = PIPELINE_SYSTEM
                .replace(/__CURRENT_DATE__/g, _now.toISOString())
                .replace(/__CURRENT_DATE_START__/g, startOfDay)
                .replace(/__CURRENT_DATE_END__/g, endOfDay);

            const historyContext = history.length > 0
                ? `Previous conversation turns:\n${history.map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n\n`
                : '';

            const pipelinePrompt = `${historyContext}USER QUESTION: ${message}

Translate this into a MongoDB aggregation pipeline. Return ONLY the JSON object described in the system prompt.`;

            app.log.info(`[ai:chat] Generating pipeline for conversationId=${conversationId} using ${llmConfig.provider}/${llmConfig.model}`);

            const pipelineRaw = await callLlmText(pipelinePrompt, llmConfig, finalSystemPrompt);
            const pipelineText = stripCodeFences(pipelineRaw);

            // ── Parse LLM output ───────────────────────────────────────────────
            let parsedQuery: { collection: string; pipeline: unknown[] };
            try {
                const obj = JSON.parse(pipelineText);
                if (typeof obj?.collection !== 'string' || !Array.isArray(obj?.pipeline)) {
                    throw new Error('missing collection or pipeline fields');
                }
                parsedQuery = obj as { collection: string; pipeline: unknown[] };
            } catch (parseErr) {
                app.log.warn({ pipelineRaw }, '[ai:chat] LLM returned unparseable pipeline JSON');
                return reply.status(502).send({
                    success: false,
                    error: 'AI returned an unparseable response. Please rephrase your question.',
                });
            }

            // ── Layer 4: Collection whitelist ──────────────────────────────────
            const targetCollection = parsedQuery.collection.trim().toLowerCase();
            if (!ALLOWED_COLLECTIONS.has(targetCollection)) {
                app.log.warn(
                    { targetCollection },
                    '[ai:chat] LLM targeted a non-whitelisted collection — rejecting',
                );
                return reply.status(422).send({
                    success: false,
                    error: 'AI targeted an invalid data source. Please rephrase your question.',
                });
            }

            // ── Layers 1–3 & 5: Pipeline sanitisation (NoSQL injection guard) ──
            let safePipeline: Record<string, unknown>[];
            try {
                safePipeline = sanitizePipeline(parsedQuery.pipeline, currentUser.organizationId);
            } catch (sanitizeErr) {
                const sanitizeMsg = sanitizeErr instanceof PipelineSanitizationError
                    ? sanitizeErr.message
                    : 'Unknown sanitization error';
                app.log.warn(
                    { error: sanitizeMsg, pipeline: JSON.stringify(parsedQuery.pipeline) },
                    '[ai:chat] Pipeline rejected by sanitizer',
                );
                return reply.status(422).send({
                    success: false,
                    error: 'AI generated an unsafe query. Please rephrase your question.',
                });
            }

            app.log.info({ pipeline: JSON.stringify(safePipeline, null, 2) }, '🛠️ FINAL SANITIZED PIPELINE');
            app.log.info(`[ai:chat] Executing sanitized pipeline against "${targetCollection}"`);

            // ── Execute sanitized pipeline ─────────────────────────────────────
            const dbResults = await db
                .collection(targetCollection)
                .aggregate(safePipeline)
                .toArray();

            // Stringify results for the summariser — cap at 50 kB to avoid context blowout
            const resultsJson = JSON.stringify(dbResults, null, 2);
            const safeResults = resultsJson.length > 50_000
                ? resultsJson.slice(0, 50_000) + '\n[... RESULTS TRUNCATED ...]'
                : resultsJson;

            // ── Step 2: LLM B — summarise results in natural language ──────────
            const SUMMARY_SYSTEM = `You are a helpful QA analytics assistant. A MongoDB query was executed on behalf of the user and returned results. Your job is to:
1. Answer the user's question in clear, plain English based on the data.
2. Optionally produce a simple chart if the data is numeric and a chart adds value.

RESPONSE FORMAT — you MUST return ONLY a single valid JSON object with these fields:
- "answer": (string) A 1-4 sentence natural language answer to the question.
- "chartData": (object or null) If a chart adds value, include:
    { "type": "bar" | "line" | "pie", "title": string, "labels": string[], "values": number[] }
  Otherwise set to null.

No markdown. No code fences. Return raw JSON only.`;

            const summaryPrompt = `USER QUESTION: ${message}

QUERY RESULTS (${dbResults.length} document${dbResults.length !== 1 ? 's' : ''}):
${safeResults}

Summarise these results and answer the user's question.`;

            app.log.info(`[ai:chat] Summarising ${dbResults.length} result(s) for conversationId=${conversationId}`);

            const summaryRaw = await callLlmText(summaryPrompt, llmConfig, SUMMARY_SYSTEM);
            const summaryText = stripCodeFences(summaryRaw);

            let answer = 'Here are your results.';
            let chartData: { type: string; title: string; labels: string[]; values: number[] } | null = null;

            try {
                const summaryParsed = JSON.parse(summaryText);
                if (typeof summaryParsed?.answer === 'string') {
                    answer = summaryParsed.answer.trim();
                }
                const cd = summaryParsed?.chartData;
                if (
                    cd !== null &&
                    typeof cd === 'object' &&
                    ['bar', 'line', 'pie'].includes(cd.type) &&
                    typeof cd.title === 'string' &&
                    Array.isArray(cd.labels) &&
                    Array.isArray(cd.values) &&
                    cd.labels.length > 0 &&
                    cd.labels.length === cd.values.length
                ) {
                    chartData = {
                        type: cd.type,
                        title: cd.title,
                        labels: cd.labels.filter((l: unknown) => typeof l === 'string'),
                        values: cd.values.filter((v: unknown) => typeof v === 'number'),
                    };
                }
            } catch {
                // Fallback: use raw summary text as the answer
                answer = summaryText.length > 0 ? summaryText : 'I retrieved your data but could not format a summary.';
            }

            // ── Persist conversation turn ──────────────────────────────────────
            const newTurns: Array<{ role: 'user' | 'assistant'; content: string }> = [
                { role: 'user', content: message },
                { role: 'assistant', content: answer },
            ];

            try {
                await chatSessionsCollection.updateOne(
                    { conversationId, organizationId: currentUser.organizationId },
                    {
                        $push: { history: { $each: newTurns } } as any,
                        $set: { updatedAt: new Date() },
                        $setOnInsert: {
                            conversationId,
                            organizationId: currentUser.organizationId,
                            createdAt: new Date(),
                        },
                    },
                    { upsert: true },
                );
            } catch (persistErr) {
                // Non-fatal — the response is still returned to the user
                app.log.warn(
                    { error: persistErr instanceof Error ? persistErr.message : persistErr },
                    '[ai:chat] Failed to persist conversation turn',
                );
            }

            app.log.info(`[ai:chat] Chat turn complete for conversationId=${conversationId}`);
            return reply.send({
                success: true,
                data: {
                    answer,
                    conversationId,
                    ...(chartData ? { chartData } : {}),
                },
            });

        } catch (err: unknown) {
            if (err instanceof LlmNotConfiguredError) {
                return reply.status(503).send({ success: false, error: err.message });
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai:chat] Chat endpoint failed');
            return reply.status(500).send({ success: false, error: 'Failed to process your question. Please try again.' });
        }
    });

    // ── GET /api/ai/chat/history ───────────────────────────────────────────────
    //
    // Returns a summary list of all previous chat sessions for the current org.
    // No feature-flag guard — history is always readable even if the flag is later
    // disabled (same pattern as GET /api/ai/stability-reports).
    //
    // Response: { success: true, data: { sessions: ISessionSummary[] } }

    app.get('/api/ai/chat/history', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const currentUser = request.user!;
        const chatSessionsCollection = db.collection('chat_sessions');

        try {
            const rawSessions = await chatSessionsCollection
                .find(
                    { organizationId: currentUser.organizationId },
                    {
                        sort: { updatedAt: -1 },
                        limit: 50,
                        projection: { conversationId: 1, history: 1, updatedAt: 1, createdAt: 1 },
                    },
                )
                .toArray();

            const sessions = rawSessions.map((doc) => {
                // Derive a human-readable title from the first user message in the history
                const firstUserTurn = Array.isArray(doc.history)
                    ? doc.history.find((h: { role: string; content: string }) => h.role === 'user')
                    : null;
                const title = firstUserTurn?.content
                    ? firstUserTurn.content.length > 80
                        ? `${firstUserTurn.content.slice(0, 77)}…`
                        : firstUserTurn.content
                    : 'Untitled conversation';

                return {
                    conversationId: doc.conversationId as string,
                    title,
                    updatedAt: doc.updatedAt as Date,
                };
            });

            return reply.send({ success: true, data: { sessions } });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai:chat] Failed to fetch chat history');
            return reply.status(500).send({ success: false, error: 'Failed to fetch chat history' });
        }
    });

    // ── GET /api/ai/chat/:conversationId ──────────────────────────────────────
    //
    // Returns the full message history for a specific conversation session.
    // Tenant-isolated: only returns sessions belonging to the current org.
    //
    // Response: { success: true, data: { conversationId, history, updatedAt } }

    app.get('/api/ai/chat/:conversationId', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const { conversationId } = request.params as { conversationId: string };
        const currentUser = request.user!;
        const chatSessionsCollection = db.collection('chat_sessions');

        if (!conversationId || conversationId.trim().length === 0) {
            return reply.status(400).send({ success: false, error: 'conversationId is required' });
        }

        try {
            const sessionDoc = await chatSessionsCollection.findOne({
                conversationId: conversationId.trim(),
                organizationId: currentUser.organizationId,
            });

            if (!sessionDoc) {
                return reply.status(404).send({ success: false, error: 'Conversation not found' });
            }

            return reply.send({
                success: true,
                data: {
                    conversationId: sessionDoc.conversationId as string,
                    history: Array.isArray(sessionDoc.history) ? sessionDoc.history : [],
                    updatedAt: sessionDoc.updatedAt as Date,
                },
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            app.log.error({ error: message }, '[ai:chat] Failed to fetch conversation');
            return reply.status(500).send({ success: false, error: 'Failed to fetch conversation' });
        }
    });

    app.log.info('✅ AI routes registered');
    app.log.info('  - POST /api/ai/generate-test-steps');
    app.log.info('  - POST /api/ai/generate-test-suite');
    app.log.info('  - POST /api/ai/generate-bug-report  (Feature A: Auto-Bug Generation)');
    app.log.info('  - POST /api/ai/analyze-stability     (Feature B: Flakiness Detective)');
    app.log.info('  - GET  /api/ai/stability-reports     (Feature B: History)');
    app.log.info('  - POST /api/ai/optimize-test-cases   (Feature C: Smart Test Optimizer)');
    app.log.info('  - POST /api/ai/chat                  (Feature E: Quality Chatbot)');
    app.log.info('  - GET  /api/ai/chat/history          (Feature E: Chat session list)');
    app.log.info('  - GET  /api/ai/chat/:conversationId  (Feature E: Load conversation)');
}
