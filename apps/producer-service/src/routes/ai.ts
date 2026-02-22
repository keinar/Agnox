/**
 * AI Routes (Sprint 9 — Quality Hub)
 *
 * Endpoints:
 *  - POST /api/ai/generate-test-steps — Generate test steps from a natural-language
 *    prompt using Gemini 2.5 Flash.
 *
 * All endpoints:
 *  - Are JWT-protected via the global auth middleware.
 *  - Do NOT store anything in the database — pure generation endpoint.
 */

import { FastifyInstance } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function aiRoutes(
    app: FastifyInstance,
    apiRateLimit: (request: any, reply: any) => Promise<void>,
): Promise<void> {

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

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            app.log.warn('[ai] GEMINI_API_KEY is not configured — AI generation is disabled');
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

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            app.log.warn('[ai] GEMINI_API_KEY is not configured — AI generation is disabled');
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

    app.log.info('✅ AI routes registered');
    app.log.info('  - POST /api/ai/generate-test-steps');
    app.log.info('  - POST /api/ai/generate-test-suite');
}
