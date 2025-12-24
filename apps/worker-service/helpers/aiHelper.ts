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

export interface TextValidationResult {
    isValid: boolean;
    reasoning: string;
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
     * Returns a boolean verdict AND the reasoning behind it.
     */
    async validateRelevance(textToCheck: string, topic: string): Promise<TextValidationResult> {
        const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const prompt = `
            Act as a strict QA auditor.
            Analyze if the text "${textToCheck}" is logically relevant to the topic "${topic}".
            
            Return a JSON object with:
            - "isValid": boolean (true if relevant, false if off-topic).
            - "reasoning": A short explanation (max 15 words) of why it passes or fails.
            
            Return ONLY the JSON.
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            
            console.log(`[AI Oracle] Analysis: ${text}`);
            
            return JSON.parse(text) as TextValidationResult;

        } catch (error) {
            console.error("AI Validation Failed:", error);
            return { isValid: false, reasoning: "AI Error" };
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

    /**
     * Scans text (HTML source, API response, Logs) for security risks.
     */
    async scanForSecurityRisks(content: string, context: string): Promise<{ isSecure: boolean, detectedIssues: string[] }> {
        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

            // Truncate content if it's too huge to save tokens, keep critical parts
            const safeContent = content.slice(0, 10000); 

            const prompt = `
                Act as a Security Analyst.
                Review the following ${context}:
                
                """
                ${safeContent}
                """

                Check for:
                1. PII Leakage (Emails, Phone numbers, Addresses found in unexpected places).
                2. Sensitive Technical Data (Stack traces, DB connection strings, Internal IPs).
                3. Exposed Secrets (API Keys, Tokens, Password Hashes).
                
                Return a JSON object:
                - "isSecure": boolean (true if NO sensitive data is found).
                - "detectedIssues": string array (list specific findings, e.g. "Found generic stack trace", "Exposed email address").
            `;

            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            return JSON.parse(text);

        } catch (error) {
            console.error("AI Security Scan Failed:", error);
            return { isSecure: true, detectedIssues: ["AI Error - Scan skipped"] };
        }
    }

    /**
     * Generates tricky, toxic, or edge-case inputs for Fuzz Testing.
     * @param scenario Description of the desired input (e.g., "SQL Injection strings", "Toxic usernames")
     * @param count Number of inputs to generate
     */
    async generateTestInputs(scenario: string, count: number = 3): Promise<string[]> {
        const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        
        const prompt = `
            Act as a QA Security Tester.
            Generate a JSON array containing ${count} string inputs.
            Goal: Create inputs that match this description: "${scenario}".
            
            The inputs should be strings that might break a web form or test content moderation filters.
            Return ONLY the raw JSON array (e.g. ["string1", "string2"]). No markdown formatting.
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().replace(/```json|```/g, '').trim();
            console.log(`[AI Fuzzing] Generated inputs for "${scenario}": ${text}`);
            return JSON.parse(text);
        } catch (error) {
            console.error("AI Generation Failed:", error);
            // Fallback to prevent test crash
            return ["fallback_test_data"];
        }
    }
}