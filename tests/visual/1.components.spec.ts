import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboardPage';


test.describe('Visual Regression - Static Components', () => {

    let dashboardPage: DashboardPage;


    test.beforeEach(async ({ page }) => {
        dashboardPage = new DashboardPage(page);
        await dashboardPage.goto();
    });

    test('1. Should match the Login Form design', async ({ page }) => {
        await dashboardPage.logout();
        const loginForm = page.locator('//*[@id="root"]/div/main/div/div');
        await expect(loginForm).toHaveScreenshot('login-form.png', {
            maxDiffPixels: 100
        });
    });


    test('2. Should match the Dashboard Sidebar design', async ({ page }) => {
        await dashboardPage.sidebar.waitFor({ state: 'visible' });
        await expect(dashboardPage.sidebar).toHaveScreenshot('dashboard-sidebar.png', {
            maxDiffPixels: 100
        });
    });
});