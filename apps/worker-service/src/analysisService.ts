import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { logger } from './utils/logger.js';
import { IResolvedLlmConfig } from '../../../packages/shared-types/index.js';

export async function analyzeTestFailure(logs: string, image: string, failedTests: Array<{ testId: string, error?: string | null, errorHash?: string }> = [], llmConfig: IResolvedLlmConfig): Promise<string> {
    if (!logs || logs.length < 50) {
        return "Insufficient logs for analysis.";
    }

    try {
        logger.info({ image, provider: llmConfig.provider, model: llmConfig.model }, 'Initializing AI provider for dual-agent analysis');

        // Gemini 2.5 Flash has a massive context window. 
        // We increase the slice to 60,000 chars to catch earlier suite failures and setup contexts.
        const truncatedLogs = logs.slice(-60000);

        // Phase 5: Smart Execution Analytics — Failure Clustering
        // Group failed tests by their errorHash to save tokens and provide a better summary
        let failuresClusterText = '';
        if (failedTests.length > 0) {
            const clusters: Record<string, { representativeError: string, tests: string[] }> = {};

            for (const test of failedTests) {
                const hash = test.errorHash || 'unknown';
                if (!clusters[hash]) {
                    clusters[hash] = {
                        representativeError: test.error || 'No error message provided',
                        tests: []
                    };
                }
                clusters[hash].tests.push(test.testId);
            }

            failuresClusterText = '\n\nCLUSTERED FAILURES:\n';
            let clusterIndex = 1;
            for (const [hash, cluster] of Object.entries(clusters)) {
                failuresClusterText += `Cluster ${clusterIndex} (Hash: ${hash}) affected ${cluster.tests.length} tests.\n`;
                failuresClusterText += `Representative Error: ${cluster.representativeError}\n`;
                failuresClusterText += `Tests affected: ${cluster.tests.join(', ')}\n\n`;
                clusterIndex++;
            }
        }

        // ==========================================
        // STEP 1: The Analyzer (Generator)
        // ==========================================
        logger.info('Step 1 (Analyzer): Starting initial log analysis');

        const systemInstructionAnalyzer = "You are an expert QA Automation Investigator. Analyze the provided CI/CD logs, Playwright test errors, and clustered failures. Identify the root cause and propose a technical fix. Keep in mind that failures are often clustered by exact error fingerprints to save diagnostic time.";
        const analyzerPrompt = `
A test execution failed inside a Docker container running the image: "${image}".

Analyze these logs and clustered failures (if any) and return your findings as strictly matching JSON:

RAW LOGS:
${truncatedLogs}
${failuresClusterText}
`;

        let analyzerText = '';

        if (llmConfig.provider === 'openai') {
            const openai = new OpenAI({ apiKey: llmConfig.apiKey });
            const response = await openai.chat.completions.create({
                model: llmConfig.model,
                temperature: 0.4,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemInstructionAnalyzer + "\nOutput purely valid JSON with rootCause and suggestedFix keys." },
                    { role: "user", content: analyzerPrompt }
                ]
            });
            analyzerText = response.choices[0]?.message?.content || '{}';
        } else if (llmConfig.provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: llmConfig.apiKey });
            const response = await anthropic.messages.create({
                model: llmConfig.model,
                temperature: 0.4,
                max_tokens: 2000,
                system: systemInstructionAnalyzer + "\nCRITICAL: You must return purely valid JSON containing 'rootCause' and 'suggestedFix' keys. No markdown formatting, just {...}.",
                messages: [
                    { role: "user", content: analyzerPrompt }
                ]
            });
            analyzerText = (response.content[0] as any)?.text || '{}';
        } else {
            const genAI = new GoogleGenerativeAI(llmConfig.apiKey);
            const analyzerModel = genAI.getGenerativeModel({
                model: llmConfig.model,
                generationConfig: {
                    temperature: 0.4,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: SchemaType.OBJECT,
                        properties: {
                            rootCause: {
                                type: SchemaType.STRING,
                                description: "The technical root cause of the failure based on the logs."
                            },
                            suggestedFix: {
                                type: SchemaType.STRING,
                                description: "The proposed technical fix to resolve the error."
                            }
                        },
                        required: ["rootCause", "suggestedFix"]
                    }
                },
                systemInstruction: systemInstructionAnalyzer
            });
            const analyzerResult = await analyzerModel.generateContent(analyzerPrompt);
            analyzerText = analyzerResult.response.text();
        }

        let initialAnalysis;
        try {
            initialAnalysis = JSON.parse(analyzerText);
            logger.info('Step 1 (Analyzer): Successfully generated JSON analysis');
        } catch (jsonErr) {
            logger.warn({ rawText: analyzerText }, 'Step 1 (Analyzer): Model failed to return valid JSON. Creating fallback object.');
            initialAnalysis = {
                rootCause: "Technical error parsing the logs. Analyzer failed to output valid JSON.",
                suggestedFix: "Review the raw logs manually."
            };
        }

        // ==========================================
        // STEP 2: The Critic (Evaluator)
        // ==========================================
        logger.info('Step 2 (Critic): Evaluating initial analysis against raw logs');

        const criticSystemInstruction = "You are an expert QA technical evaluator. You will receive raw logs and a proposed root cause + fix. Evaluate if the proposed fix is grounded in the logs. If it's hallucinating, override it with the correct analysis. DO NOT mention any 'draft', 'junior', or 'review process' in your output. DO NOT include the raw logs in the output. Keep the output extremely concise and directly structured to the developer.";
        const criticPrompt = `
RAW LOGS:
${truncatedLogs}

PROPOSED ANALYSIS:
- Proposed Root Cause: ${initialAnalysis.rootCause}
- Proposed Fix: ${initialAnalysis.suggestedFix}

Task: Evaluate if the proposed analysis is correct based strictly on the raw logs. If it is hallucinatory, unhelpful, or factually wrong based on the logs, override it entirely with the correct analysis. 

CRITICAL - You MUST strictly follow this exact Markdown structure for your final output, with no exceptions and no extra conversational text/filler:

### 🚨 Root Cause
[Direct, concise 2-sentence explanation of what failed]

### 🛠️ Suggested Fix
1. [Actionable step 1]
2. [Actionable step 2]
`;

        let finalMarkdown = '';

        if (llmConfig.provider === 'openai') {
            const openai = new OpenAI({ apiKey: llmConfig.apiKey });
            const response = await openai.chat.completions.create({
                model: llmConfig.model,
                temperature: 0.0,
                messages: [
                    { role: "system", content: criticSystemInstruction },
                    { role: "user", content: criticPrompt }
                ]
            });
            finalMarkdown = response.choices[0]?.message?.content || 'Analysis failed.';
        } else if (llmConfig.provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: llmConfig.apiKey });
            const response = await anthropic.messages.create({
                model: llmConfig.model,
                temperature: 0.0,
                max_tokens: 1500,
                system: criticSystemInstruction,
                messages: [
                    { role: "user", content: criticPrompt }
                ]
            });
            finalMarkdown = (response.content[0] as any)?.text || 'Analysis failed.';
        } else {
            const genAI = new GoogleGenerativeAI(llmConfig.apiKey);
            const criticModel = genAI.getGenerativeModel({
                model: llmConfig.model,
                generationConfig: {
                    temperature: 0.0, // Strict, no hallucinations
                },
                systemInstruction: criticSystemInstruction
            });
            const criticResult = await criticModel.generateContent(criticPrompt);
            finalMarkdown = criticResult.response.text();
        }

        logger.info('Step 2 (Critic): Completed final analysis');
        return finalMarkdown;

    } catch (err: any) {
        logger.error({ error: err.message }, 'AI Analysis error in the dual-agent pipeline');
        return `Failed to generate AI analysis: [${err.message}]`;
    }
}