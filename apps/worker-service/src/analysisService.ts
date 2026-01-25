import { GoogleGenerativeAI } from '@google/generative-ai';

export async function analyzeTestFailure(logs: string, image: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[AI Analysis] Missing GEMINI_API_KEY. Skipping analysis.');
        return 'AI Analysis disabled: Missing API Key.';
    }

    if (!logs || logs.length < 50) {
        return "Insufficient logs for analysis.";
    }

    try {
        console.log(`[AI Analysis] Initializing Gemini for image: ${image}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const truncatedLogs = logs.slice(-8000); 

        const promptText = `
        You are an expert Automation Infrastructure Engineer.
        A test execution failed inside a Docker container running the image: "${image}".
        
        Analyze the following logs and provide a structured response using Markdown.
        Focus on identifying if this is an Infrastructure Issue, Flaky Test, or Product Bug.

        Logs (Last snippet):
        ${truncatedLogs}
        
        Output Format:
        ## 🚨 Root Cause
        [Short explanation of what went wrong]
        
        ## 🛠️ Suggested Fix
        [Actionable advice for the developer]
        `;

        console.log(`[AI Analysis] Sending prompt to Gemini...`);
        
        const result = await model.generateContent(promptText);
        const response = await result.response;
        const text = response.text();

        console.log(`[AI Analysis] Received response from Gemini.`);
        return text;

    } catch (err: any) {
        console.error('[AI Analysis] Error:', err);
        return "Failed to generate AI analysis due to a technical error.";
    }
}