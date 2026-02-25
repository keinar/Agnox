import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.resolve(__dirname, '.auth/user.json');

setup('authenticate via UI', async ({ page }) => {
    // Ensure the auth directory exists
    const dir = path.dirname(authFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
        throw new Error('Missing E2E_EMAIL or E2E_PASSWORD in .env');
    }

    await page.goto('http://localhost:8080/login');
    // Fill credentials using exact codegen selectors
    const emailInput = page.getByRole('textbox', { name: 'Email Address' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(email);
    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);

    // Submit the login form
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await signInButton.waitFor({ state: 'visible', timeout: 10000 });
    await signInButton.click();

    // CRITICAL: Wait for the navigation to finish by waiting for the dashboard URL
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Save the authenticated state
    await page.context().storageState({ path: authFile });
    console.log('[Playwright Setup] Successfully authenticated test user via UI.');
});
