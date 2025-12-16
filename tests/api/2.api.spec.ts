import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { GalleryService } from '../../services/gallery.service';

test.describe.serial('Gallery API - Full CRUD Flow (Refactored)', () => {

    let galleryService: GalleryService;
    let createdGalleryId: string;
    let secretLink: string;

    test.beforeEach(async ({ request }) => {
        const apiClient = new ApiClient(request);
        galleryService = new GalleryService(apiClient);
    });

    const galleryPayload = {
        title: `API-Refactor-Test-${Date.now()}`,
        clientName: "Service Layer Client"
    };

    test('1. CREATE - Should create a new gallery', async () => {
        const newGallery = await galleryService.create(galleryPayload);

        expect(newGallery).toHaveProperty('_id');
        expect(newGallery.title).toBe(galleryPayload.title);

        // Store for next steps
        createdGalleryId = newGallery._id;
        secretLink = newGallery.secretLink;
    });

    test('2. READ - Should retrieve the created gallery (public GET)', async () => {
        // Ensure dependent data exists
        test.fail(!secretLink, "Skipping: Secret link not available from previous step");

        const response = await galleryService.getPublic(secretLink);
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.title).toBe(galleryPayload.title);
    });

    test('3. DELETE - Should delete the created gallery', async () => {
        test.fail(!createdGalleryId, "Skipping: ID not available from previous step");

        await galleryService.delete(createdGalleryId);

        // Verify deletion by trying to fetch it again
        const response = await galleryService.getPublic(secretLink);
        expect(response.status()).toBe(404);
    });
});