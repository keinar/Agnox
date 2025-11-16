import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboardPage';
import { LoginApp } from '../../pages/loginApp';

/**
 * @file 1.components.spec.ts
 * @description This file contains all Visual Regression Tests.
 * It focuses on capturing screenshots of specific, stable components
 * rather than full, dynamic pages.
 */
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