import { test, expect } from '../../fixtures/base.fixture';


test.describe('UI Resilience - API Error Handling', () => {

    test('1. Should display empty state if galleries API returns 500', async ({ page, dashboardPage }) => {
        
        await page.route('**/api/galleries', route => {
            console.log('[Mock API] Intercepted /api/galleries, returning 500 error.');
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: "Mocked Internal Server Error" })
            });
        });

        await dashboardPage.goto();

        const errorMessage = page.locator("text=You haven't created any galleries yet.");
        await expect(errorMessage).toBeVisible();
    });


    test('2. Should display empty state if galleries API returns empty list', async ({ page, dashboardPage }) => {
        
        await page.route('**/api/galleries', route => {
            console.log('[Mock API] Intercepted /api/galleries, returning empty array.');
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        await dashboardPage.goto();

        const emptyMessage = page.locator("text=You haven't created any galleries yet.");
        await expect(emptyMessage).toBeVisible();
    });
});