import { test, expect } from '@playwright/test';
import { AdminLoginPage } from '../../pages/adminLoginPage'; // <-- Updated import path due to new folder

const ADMIN_USERNAME = process.env.ADMIN_USER!;
const ADMIN_PASSWORD = process.env.ADMIN_PASS!;


test.describe('Admin Panel - UI Login', () => {

    let adminLogin: AdminLoginPage;

    test.beforeEach(async ({ page }) => {
        adminLogin = new AdminLoginPage(page);
        await adminLogin.goto();
    });

    test('1. Successful Login', async ({ page }) => {
        
        await adminLogin.login(ADMIN_USERNAME, ADMIN_PASSWORD);
        await expect(page).toHaveURL(/.*\/admin\/rooms/, { timeout: 10000 });
    });

    test('2. Failed Login with wrong password', async () => {
        
        await adminLogin.login(ADMIN_USERNAME, 'wrongpassword123');
        await expect(adminLogin.errorMessage).toBeVisible();
        await expect(adminLogin.errorMessage).toContainText('Invalid credentials');
    });
});