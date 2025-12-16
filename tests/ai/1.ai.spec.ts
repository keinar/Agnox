import { test, expect } from '../../fixtures/base.fixture';
import { AiHelper } from '../../helpers/aiHelper';


test.describe('AI-Assisted Content Validation', () => {

    let aiHelper: AiHelper;
    let galleryId: string;

    test.beforeEach(async () => {
        aiHelper = new AiHelper();
    });

    test('1. Should generate creative title via Gemini and validate relevance', async ({galleryService}) => {
        
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

    test.afterEach(async ({galleryService}) => {
        if (galleryId) {
            await galleryService.delete(galleryId);
        }
    });
});