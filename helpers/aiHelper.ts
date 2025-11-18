import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export interface ImageAnalysisResult {
    description: string;
    isHuman: boolean;
    isFood: boolean;
    mainSubject: string;
}

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

    /**
     * Analyzes an image efficiently in a single request.
     * Returns a structured JSON object with multiple details.
     * @param imagePath - The local path to the image file.
     */
    async analyzeImageInDetail(imagePath: string): Promise<ImageAnalysisResult> {
        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

            const imageBuffer = fs.readFileSync(imagePath);
            const imageBase64 = imageBuffer.toString('base64');

            const prompt = `
                Analyze this image and return a valid JSON object with the following fields:
                - "description": A short summary of what you see (max 15 words).
                - "isHuman": boolean (true if a person is present).
                - "isFood": boolean (true if food is the main subject).
                - "mainSubject": One or two words describing the main subject (e.g., "Baby", "Building", "Car").
                
                Return ONLY the JSON object, no markdown formatting.
            `;

            const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/png",
                },
            };

            const result = await model.generateContent([prompt, imagePart]);
            
            // Clean up potential Markdown syntax from the response
            const text = result.response.text().replace(/```json|```/g, '').trim();

            console.log(`[AI Vision] Raw JSON Response: ${text}`);

            return JSON.parse(text) as ImageAnalysisResult;

        } catch (error) {
            console.error("AI Analysis Failed:", error);
            // Return a fallback object to prevent test crash
            return { 
                description: "Analysis Error", 
                isHuman: false, 
                isFood: false, 
                mainSubject: "Unknown" 
            };
        }
    }
}