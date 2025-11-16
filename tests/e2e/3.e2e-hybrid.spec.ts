import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/apiClient';
import { DashboardPage } from '../../pages/dashboardPage';
import { LoginPage } from '../../pages/loginPage';

/**
 * @file 3.e2e-hybrid.spec.ts
 * @description This file demonstrates a "Hybrid" E2E test.
 * It uses the API for fast data setup and teardown,
 * and the UI for validation, which is a highly efficient pattern.
 */
test.describe('Hybrid E2E - Admin Panel Validation', () => {

    let apiClient: ApiClient;
    let dashboardPage: DashboardPage;
    let galleryId: string;

    const uniqueGalleryName = `E2E-Hybrid-Test-${Date.now()}`;
    
    const galleryPayload = {
        title: uniqueGalleryName,
        clientName: "Hybrid Test Client"
    };

    test.beforeEach(async ({ page, request }) => {
        apiClient = new ApiClient(request);
        dashboardPage = new DashboardPage(page);
        loginPage = new LoginPage(page);
    });

    test('1. API-created gallery should appear in the UI', async ({ page }) => {
        
        // Create gallery via API
        const createResponse = await apiClient.createGallery(galleryPayload);
        expect(createResponse.status()).toBe(201);
        const body = await createResponse.json();
        galleryId = body._id; // Save the ID for cleanup
        
        
        // Navigate to dashboard via UI
        await dashboardPage.goto();
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

        if (!await page.getByText(uniqueGalleryName).isVisible()) {
            console.log('[Test Run] Not logged in, performing UI login...');
            await loginPage.goto();
            await loginPage.login(process.env.ADMIN_USER!, process.env.ADMIN_PASS!);
            await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
        }
        
        console.log('[Test Run] Verifying gallery is visible in UI...');
        // Assertion: Find the gallery we created on the main admin page
        const galleryCard = page.locator('div.card', { hasText: uniqueGalleryName });
        await expect(galleryCard).toBeVisible();
        await expect(galleryCard).toContainText(galleryPayload.clientName);


        // --- 3. TEARDOWN (via API) ---
        console.log(`[Test Teardown] Deleting gallery via API: ${galleryId}`);
        const deleteResponse = await apiClient.deleteGallery(galleryId);
        expect(deleteResponse.status()).toBe(200);
    });
});