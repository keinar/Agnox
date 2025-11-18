import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });


export class AiHelper {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is missing in .env file");
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Use the flash model for speed and efficiency in tests
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    }

    /**
     * Generates a creative gallery title based on a theme.
     * @param theme e.g., "Wedding", "Nature"
     */
    async generateGalleryTitle(theme: string): Promise<string> {
        const prompt = `Generate a short, creative title (max 5 words) for a photo gallery about: "${theme}". Return ONLY the title text, no quotes, no markdown.`;
        
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error("AI Generation Failed:", error);
            return `Fallback ${theme} Title`;
        }
    }

    /**
     * Validates if a given text matches a specific topic/sentiment.
     * Acts as an "AI Oracle" for assertions.
     * @returns boolean (true if valid)
     */
    async validateRelevance(textToCheck: string, topic: string): Promise<boolean> {
        const prompt = `You are a strict QA validation bot.
        Does the text "${textToCheck}" logically relate to the topic "${topic}"?
        Answer strictly with "YES" or "NO" only.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const answer = response.text().trim().toUpperCase();
            
            console.log(`[AI Oracle] Input: "${textToCheck}" | Topic: "${topic}" | Verdict: ${answer}`);
            
            return answer.includes('YES');
        } catch (error) {
            console.error("AI Validation Failed:", error);
            return false;
        }
    }
}