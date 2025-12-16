import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { MongoHelper } from '../../repositories/mongoHelper';

/**
 * @file 4.db.spec.ts
 * @description This test covers the "Data Validation" requirement.
 * 1. Creates a gallery via API.
 * 2. Connects *directly* to MongoDB to verify the record was written correctly.
 * 3. Deletes the gallery via API.
 */
test.describe.serial('Data Validation - API vs DB', () => {

    let apiClient: ApiClient;
    let mongoHelper: MongoHelper;
    let newGalleryId: string;

    const galleryPayload = {
        title: `DB-Validation-Test-${Date.now()}`,
        clientName: "DB Test Client"
    };

    test.beforeAll(async () => {
        mongoHelper = new MongoHelper();
        await mongoHelper.connect();
    });

    test.afterAll(async () => {
        await mongoHelper.disconnect();
    });

    test.beforeEach(async ({ request }) => {
        apiClient = new ApiClient(request);
    });

    
    test('1. Gallery created via API should exist in MongoDB', async () => {

        // --- 1. SETUP (via API) ---
        console.log('[Test Setup] Creating gallery via API...');
        const newGallery = await apiClient.createGallery(galleryPayload);
        newGalleryId = newGallery._id;
        
        // --- 2. TEST (via DB) ---
        console.log(`[Test Run] Validating gallery ${newGalleryId} in MongoDB...`);
        
        // Find the gallery directly in the database
        const galleryFromDB = await mongoHelper.getGalleryById(newGalleryId);
        
        // Assertion 1: Check that the document was found
        expect(galleryFromDB).toBeDefined();
        expect(galleryFromDB).not.toBeNull();

        // Assertion 2: Validate the data at the source
        expect(galleryFromDB?.title).toBe(galleryPayload.title);
        expect(galleryFromDB?.clientName).toBe(galleryPayload.clientName);
        

        // --- 3. TEARDOWN (via API) ---
        console.log(`[Test Teardown] Deleting gallery via API: ${newGalleryId}`);
        await apiClient.deleteGallery(newGalleryId);
    });
});