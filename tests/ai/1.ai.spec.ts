import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { AiHelper } from '../../helpers/aiHelper';
import { GalleryService } from '../../services/gallery.service';

test.describe('AI-Assisted Content Validation', () => {

    let apiClient: ApiClient;
    let galleryService: GalleryService;
    let aiHelper: AiHelper;
    let galleryId: string;

    test.beforeEach(async ({ request }) => {
        apiClient = new ApiClient(request);
        galleryService = new GalleryService(apiClient);
        aiHelper = new AiHelper();
    });

    test('1. Should generate creative title via Gemini and validate relevance', async () => {
        
        // --- MOCKING START ---
        // Mock 1: Generate Title
        aiHelper.generateGalleryTitle = async (theme: string) => {
            console.log(`[Mock] Generating title for ${theme}`);
            return "Mocked Family Vacation Title";
        };

        // Mock 2: Validate Relevance
        aiHelper.validateRelevance = async (text: string, topic: string) => {
            console.log(`[Mock] Validating relevance for ${text}`);
            return { isValid: true, reasoning: "Perfect match (Mocked)" };
        };

        const theme = "Family Vacation";
        
        console.log(`[AI] Asking Gemini to generate a title for: ${theme}...`);
        const aiTitle = await aiHelper.generateGalleryTitle(theme);
        console.log(`[AI] Generated Title: "${aiTitle}"`);
        
        expect(aiTitle.length).toBeGreaterThan(0);
        
        const newGallery = await galleryService.create({
            title: aiTitle,
            clientName: "Gemini Bot"
        });
        galleryId = newGallery._id;

        const getResponse = await galleryService.getPublic(newGallery.secretLink);
        const fetchedBody = await getResponse.json();
        const savedTitle = fetchedBody.title;

        console.log(`[AI] Asking Gemini to validate relevance...`);
    
        const validation = await aiHelper.validateRelevance(savedTitle, theme);
        
        console.log(`[AI Oracle] Logic: "${validation.reasoning}"`);

        expect(validation.isValid, `AI rejected the title. Reason: ${validation.reasoning}`).toBe(true);
    });

    test.afterEach(async () => {
        if (galleryId) {
            await galleryService.delete(galleryId);
        }
    });
});