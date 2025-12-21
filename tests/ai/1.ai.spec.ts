import { test, expect } from '../../fixtures/base.fixture';
import { AiHelper } from '../../helpers/aiHelper';

class MockAiHelper extends AiHelper {
    async generateGalleryTitle(theme: string): Promise<string> {
        console.log(`[Mock Class] Generating title for ${theme}`);
        return "Mocked Family Vacation Title";
    }

    async validateRelevance(text: string, topic: string) {
        console.log(`[Mock Class] Validating relevance for '${text}'...`);
        return { isValid: true, reasoning: "Perfect match (Mocked)" };
    }
}

test.describe('AI-Assisted Content Validation', () => {
    
    test.use({ aiHelper: new MockAiHelper() });

    let galleryId: string;

    test('1. Should generate creative title via Gemini and validate relevance (Mocked)', async ({ galleryService, aiHelper }) => {
        
        const theme = "Family Vacation";
        
        console.log(`[Test] Asking AI Helper to generate title...`);
        const aiTitle = await aiHelper.generateGalleryTitle(theme);
        
        expect(aiTitle).toBe("Mocked Family Vacation Title");
        
        const newGallery = await galleryService.create({
            title: aiTitle,
            clientName: "Gemini Bot"
        });
        galleryId = newGallery._id;

        const getResponse = await galleryService.getPublic(newGallery.secretLink);
        const fetchedBody = await getResponse.json();
        const savedTitle = fetchedBody.title;

        console.log(`[Test] Asking AI Helper to validate relevance...`);
        const validation = await aiHelper.validateRelevance(savedTitle, theme);
        
        console.log(`[AI Oracle] Logic: "${validation.reasoning}"`);
        expect(validation.isValid).toBe(true);
    });

    test.afterEach(async ({ galleryService }) => {
        if (galleryId) {
            await galleryService.delete(galleryId);
        }
    });
});