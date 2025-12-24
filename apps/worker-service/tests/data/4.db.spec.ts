import { test, expect } from '../../fixtures/base.fixture';
import { PollingHelper } from '../../helpers/pollingHelper';

test.describe.serial('Data Validation - API vs DB (Refactored)', () => {
    
    // State management
    let createdGalleryId: string;

    const galleryPayload = {
        title: `DB-Validation-Refactor-${Date.now()}`,
        clientName: "DB Test Client"
    };

    test.beforeAll(async ({mongoHelper}) => {
        await mongoHelper.connect();
    });

    test.afterAll(async ({mongoHelper}) => {
        await mongoHelper.disconnect();
    });

    test.afterEach(async ({galleryService}) => {
        if (createdGalleryId) {
            await galleryService.delete(createdGalleryId);
        }
    });
    
    test('1. Gallery created via API should exist in MongoDB', async ({galleryService, galleryRepo}) => {

        // --- 1. SETUP (via Service) ---
        console.log('[Test Setup] Creating gallery via Service Layer...');
        const newGallery = await galleryService.create(galleryPayload);
        createdGalleryId = newGallery._id;
        
        // --- 2. TEST (via Repository & Polling) ---
        console.log(`[Test Run] Validating gallery ${createdGalleryId} in MongoDB...`);
        
        // Use PollingHelper to wait for eventual consistency (Best Practice)
        const galleryFromDB = await PollingHelper.pollUntil(
            "Gallery document in MongoDB",
            async () => await galleryRepo.findById(createdGalleryId),
            (doc) => doc !== null && doc.title === galleryPayload.title
        );
        
        // Assertion: Validate data integrity
        expect(galleryFromDB).toBeDefined();
        expect(galleryFromDB?.clientName).toBe(galleryPayload.clientName);
    });
});