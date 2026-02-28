import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { logger } from './utils/logger.js';

export async function analyzeTestFailure(logs: string, image: string): Promise<string> {
    // SECURITY_PLAN §1.3 — Read platform-namespaced key;
    const apiKey = process.env.PLATFORM_GEMINI_API_KEY;

    if (!apiKey) {
        logger.warn('Missing PLATFORM_GEMINI_API_KEY. Skipping analysis.');
        return 'AI Analysis disabled: Missing API Key.';
    }

    if (!logs || logs.length < 50) {
        return "Insufficient logs for analysis.";
    }

    try {
        logger.info({ image }, 'Initializing Gemini for dual-agent AI analysis');

        const genAI = new GoogleGenerativeAI(apiKey);

        // Gemini 2.5 Flash has a massive context window. 
        // We increase the slice to 60,000 chars to catch earlier suite failures and setup contexts.
        const truncatedLogs = logs.slice(-60000);

        // ==========================================
        // STEP 1: The Analyzer (Generator)
        // ==========================================
        logger.info('Step 1 (Analyzer): Starting initial log analysis');

        const analyzerModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
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
            systemInstruction: "You are an expert QA Automation Investigator. Analyze the provided CI/CD logs and Playwright test errors. Identify the root cause and propose a technical fix."
        });

        const analyzerPrompt = `
A test execution failed inside a Docker container running the image: "${image}".

Analyze these logs and return your findings as strictly matching JSON:
${truncatedLogs}
`;

        const analyzerResult = await analyzerModel.generateContent(analyzerPrompt);
        const analyzerText = analyzerResult.response.text();

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

        const criticModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.0, // Strict, no hallucinations
            },
            systemInstruction: "You are an expert QA technical evaluator. You will receive raw logs and a proposed root cause + fix. Evaluate if the proposed fix is grounded in the logs. If it's hallucinating, override it with the correct analysis. DO NOT mention any 'draft', 'junior', or 'review process' in your output. DO NOT include the raw logs in the output. Keep the output extremely concise and directly structured to the developer."
        });

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

        const criticResult = await criticModel.generateContent(criticPrompt);
        const finalMarkdown = criticResult.response.text();

        logger.info('Step 2 (Critic): Completed final analysis');
        return finalMarkdown;

    } catch (err: any) {
        logger.error({ error: err.message }, 'AI Analysis error in the dual-agent pipeline');
        return "Failed to generate AI analysis due to a technical error.";
    }
}