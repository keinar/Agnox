import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboardPage';


test.describe('Dashboard Page - Authenticated UI', () => {

    let dashboardPage: DashboardPage;

    test.beforeEach(async ({ page }) => {
        dashboardPage = new DashboardPage(page);
        await dashboardPage.goto();
    });


    test('1. Should load dashboard and show create button', async () => {
        await expect(dashboardPage.createGalleryButton).toBeVisible();
    });


    test('2. Should be able to log out', async ({ page }) => {
        await dashboardPage.logout();
        await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });
});