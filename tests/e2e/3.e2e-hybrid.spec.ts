import { test } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { DashboardPage } from '../../pages/dashboardPage';
import { GalleryFactory } from '../../helpers/dataFactory';

test.describe('Hybrid E2E - Admin Panel Validation', () => {

    let apiClient: ApiClient;
    let dashboardPage: DashboardPage;
    
    // Variable to store the created ID for teardown
    let createdGalleryId: string;

    const galleryData = GalleryFactory.createDefault();

    test.beforeEach(async ({ page, request }) => {
        apiClient = new ApiClient(request);
        // The 'page' fixture is already authenticated via global.setup logic
        dashboardPage = new DashboardPage(page);
    });

    test('1. API-created gallery should appear in the UI', async () => {
        
        // --- 1. SETUP (via API) ---
        // Using the strictly typed method. 'newGallery' is fully typed now!
        const newGallery = await apiClient.createGallery(galleryData);
        createdGalleryId = newGallery._id;
        
        console.log(`[Test] Created gallery via API: ${newGallery._id}`);
        
        // --- 2. TEST (via UI) ---
        await dashboardPage.goto();
        
        // Validation logic is delegated to the Page Object
        // The test remains clean and focused on business logic
        await dashboardPage.validateGalleryVisible(galleryData.title, galleryData.clientName);

        // --- 3. TEARDOWN (via API) ---
        if (createdGalleryId) {
            await apiClient.deleteGallery(createdGalleryId);
        }
    });
});