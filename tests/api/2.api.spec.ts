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
        const response = await apiClient.createGallery(galleryPayload);
        expect(response.status()).toBe(201);

        const body = await response.json();

        expect(body).toHaveProperty('_id');
        expect(body).toHaveProperty('secretLink');

        galleryId = body._id;
        gallerySecret = body.secretLink;

        expect(body.title).toBe(galleryPayload.title);
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

        const delRes = await apiClient.deleteGallery(galleryId);
        expect(delRes.status()).toBe(200);

        // Public GET should now return 404
        const getRes = await apiClient.getGalleryPublic(gallerySecret);
        expect(getRes.status()).toBe(404);
    });
});
