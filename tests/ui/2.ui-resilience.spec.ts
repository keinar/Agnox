import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboardPage';


test.describe('UI Resilience - API Error Handling', () => {

    let dashboardPage: DashboardPage;

    test.beforeEach(async ({ page }) => {
        dashboardPage = new DashboardPage(page);
    });


    test('1. Should display empty state if galleries API returns 500', async ({ page }) => {
        
        await page.route('**/api/galleries', route => {
            console.log('[Mock API] Intercepted /api/galleries, returning 500 error.');
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: "Mocked Internal Server Error" })
            });
        });

        await dashboardPage.goto();

        // Verify that the empty state message is displayed (as per DashboardPage.jsx)
        const errorMessage = page.locator("text=You haven't created any galleries yet.");
        await expect(errorMessage).toBeVisible();
    });


    test('2. Should display empty state if galleries API returns empty list', async ({ page }) => {
        
        await page.route('**/api/galleries', route => {
            console.log('[Mock API] Intercepted /api/galleries, returning empty array.');
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        await dashboardPage.goto();

        // Verify that the "empty state" message is displayed (as per DashboardPage.jsx)
        const emptyMessage = page.locator("text=You haven't created any galleries yet.");
        await expect(emptyMessage).toBeVisible();
    });
});