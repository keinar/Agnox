import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';

test.describe.serial('Gallery API - Full CRUD Flow', () => {

    let apiClient: ApiClient;
    let galleryId: string;
    let gallerySecret: string;

    test.beforeEach(async ({ request }) => {
        apiClient = new ApiClient(request);
    });

    const galleryPayload = {
        title: `Test Gallery ${Date.now()}`,
        clientName: "Created by Playwright API test"
    };

    test('1. CREATE - Should create a new gallery', async () => {
        const newGallery = await apiClient.createGallery(galleryPayload);

        expect(newGallery).toHaveProperty('_id');
        expect(newGallery).toHaveProperty('secretLink');

        galleryId = newGallery._id;
        gallerySecret = newGallery.secretLink;

        expect(newGallery.title).toBe(galleryPayload.title);
    });

    test('2. READ - Should retrieve the created gallery (public GET)', async () => {
        test.fail(!gallerySecret, "secretLink was not set");

        const response = await apiClient.getGalleryPublic(gallerySecret);
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.title).toBe(galleryPayload.title);
    });

    test('3. DELETE - Should delete the created gallery', async () => {
        test.fail(!galleryId, "Gallery ID was not set");

        await apiClient.deleteGallery(galleryId);

        const getRes = await apiClient.getGalleryPublic(gallerySecret);
        expect(getRes.status()).toBe(404);
    });
});
