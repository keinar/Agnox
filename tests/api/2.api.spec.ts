import { test, expect } from '../../fixtures/base.fixture';
import { faker } from '@faker-js/faker';

test.describe.serial('Gallery API - Full CRUD Flow (Refactored)', () => {

    let createdGalleryId: string;
    let secretLink: string;

    const galleryPayload = {
        title: faker.company.catchPhrase(),
        clientName: faker.person.fullName()
    };

    test('1. CREATE - Should create a new gallery @api @sanity', async ({galleryService}) => {
        const newGallery = await galleryService.create(galleryPayload);

        expect(newGallery).toHaveProperty('_id');
        expect(newGallery.title).toBe(galleryPayload.title);

        // Store for next steps
        createdGalleryId = newGallery._id;
        secretLink = newGallery.secretLink;
    });

    test('2. READ - Should retrieve the created gallery (public GET)', async ({galleryService}) => {
        // Ensure dependent data exists
        test.fail(!secretLink, "Skipping: Secret link not available from previous step");

        const response = await galleryService.getPublic(secretLink);
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body.title).toBe(galleryPayload.title);
    });

    test('3. DELETE - Should delete the created gallery', async ({galleryService}) => {
        test.fail(!createdGalleryId, "Skipping: ID not available from previous step");

        await galleryService.delete(createdGalleryId);

        // Verify deletion by trying to fetch it again
        const response = await galleryService.getPublic(secretLink);
        expect(response.status()).toBe(404);
    });
});