import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { MongoHelper } from '../../helpers/mongoHelper'; // Fixed import path
import { GalleryService } from '../../services/gallery.service';
import { GalleryRepository } from '../../repositories/gallery.repository';
import { PollingHelper } from '../../helpers/pollingHelper';

test.describe.serial('Data Validation - API vs DB (Refactored)', () => {

    let mongoHelper: MongoHelper;
    let galleryService: GalleryService;
    let galleryRepo: GalleryRepository;
    
    // State management
    let createdGalleryId: string;

    const galleryPayload = {
        title: `DB-Validation-Refactor-${Date.now()}`,
        clientName: "DB Test Client"
    };

    test.beforeAll(async () => {
        // 1. Connect to DB directly
        mongoHelper = new MongoHelper();
        await mongoHelper.connect();
    });

    test.afterAll(async () => {
        await mongoHelper.disconnect();
    });

    test.beforeEach(async ({ request }) => {
        // 2. Initialize Layers
        const apiClient = new ApiClient(request);
        galleryService = new GalleryService(apiClient);
        galleryRepo = new GalleryRepository(mongoHelper);
    });

    test.afterEach(async () => {
        // 3. Cleanup using Service Layer
        if (createdGalleryId) {
            await galleryService.delete(createdGalleryId);
        }
    });
    
    test('1. Gallery created via API should exist in MongoDB', async () => {

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