import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { AiHelper } from '../../helpers/aiHelper';

test.describe('AI-Assisted Content Validation', () => {

    let apiClient: ApiClient;
    let aiHelper: AiHelper;
    let galleryId: string;

    test.beforeEach(async ({ request }) => {
        apiClient = new ApiClient(request);
        aiHelper = new AiHelper();
    });

    test('1. Should generate creative title via Gemini and validate relevance', async () => {
        
        const theme = "Family Vacation";
        
        console.log(`[AI] Asking Gemini to generate a title for: ${theme}...`);
        const aiTitle = await aiHelper.generateGalleryTitle(theme);
        console.log(`[AI] Generated Title: "${aiTitle}"`);
        
        expect(aiTitle.length).toBeGreaterThan(0);
        expect(aiTitle).not.toContain("Fallback");

        // We use the AI-generated title to create real data in the system
        const createResponse = await apiClient.createGallery({
            title: aiTitle,
            clientName: "Gemini Bot"
        });
        expect(createResponse.status()).toBe(201);
        const body = await createResponse.json();
        galleryId = body._id;

        // We fetch the gallery back from the DB/API
        const getResponse = await apiClient.getGalleryPublic(body.secretLink);
        const fetchedBody = await getResponse.json();
        const savedTitle = fetchedBody.title;

        console.log(`[AI] Asking Gemini to validate relevance...`);
    
        
        // We receive an object { isValid: boolean, reasoning: string }
        const validation = await aiHelper.validateRelevance(savedTitle, theme);
        
        // Log the AI's reasoning for debugging/reporting
        console.log(`[AI Oracle] Logic: "${validation.reasoning}"`);

        // Assertion: We check validation.isValid instead of the whole object
        // If it fails, the error message will contain the AI's reasoning!
        expect(validation.isValid, `AI rejected the title. Reason: ${validation.reasoning}`).toBe(true);

    });

    test.afterEach(async () => {
        if (galleryId) {
            await apiClient.deleteGallery(galleryId);
        }
    });
});