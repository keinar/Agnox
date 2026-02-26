import { GoogleGenerativeAI } from '@google/generative-ai';
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
        logger.info({ image }, 'Initializing Gemini for AI analysis');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Gemini 2.5 Flash has a massive context window. 
        // We increase the slice to 60,000 chars to catch earlier suite failures and setup contexts.
        const truncatedLogs = logs.slice(-60000);

        const promptText = `
        You are an elite QA Automation Architect analyzing Playwright E2E test logs.
        A test execution failed inside a Docker container running the image: "${image}".
        
        CRITICAL: Follow this exact step-by-step thinking process before writing your final report.

        STEP 1 (Identify): Count how many tests failed and what the exact error was (e.g., Timeout, locator not found).
        STEP 2 (Pattern Match): Did multiple tests fail because they couldn't find expected data on the screen (e.g., empty tables, missing "Integrations" buttons, "0 elements received")?
        STEP 3 (Classify based on strict rules):
           - IF the app loaded but data/buttons were missing across multiple tests -> Classify as "🌐 Environment / Test Data Missing" (The database is likely empty).
           - IF the app threw a 500 error or crashed -> Classify as "🐛 Product Bug".
           - IF it failed on a DNS, CORS, or connection refused -> Classify as "🏗️ Infrastructure / Network".
           - IF it passed on retry but failed initially -> Classify as "❄️ Flaky Test".

        Logs (Last snippet):
        ${truncatedLogs}
        
        Now, output your analysis in the exact format below. Do not deviate.

        ## 📊 Failure Classification
        [Insert exactly ONE category from Step 3]

        ## 🧠 AI Thinking Process
        [Briefly explain how you applied Steps 1 and 2 to reach this conclusion. Keep it to 2-3 sentences.]

        ## 🚨 Root Cause Analysis
        [Explain what is actually wrong. E.g., "The tests expect 3 items in the table, but the table is empty because the test environment database has no mock data."]
        
        ## 🛠️ Suggested Fix
        1. [Actionable step 1]
        2. [Actionable step 2]
        `;

        logger.info('Sending prompt to Gemini');

        const result = await model.generateContent(promptText);
        const response = await result.response;
        const text = response.text();

        logger.info('Received response from Gemini');
        return text;

    } catch (err: any) {
        logger.error({ error: err.message }, 'AI Analysis error');
        return "Failed to generate AI analysis due to a technical error.";
    }
}