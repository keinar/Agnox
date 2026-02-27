import { test as setup, expect, request } from '@playwright/test';
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

    await page.goto('/login');
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

    // Ensure we have some data for the tests to run by requesting executions from the API
    console.log('[Playwright Setup] Checking for existing executions...');

    // Playwright API context uses the browser cookies/auth state automatically if we pass it the page context
    // However, the backend expects a Bearer token in the Authorization header.
    // Let's grab the token from localStorage and use a new API context
    const token = await page.evaluate(() => localStorage.getItem('authToken'));

    if (token) {
        // The producer service is running on port 3000 and registers routes exactly at /api/executions
        const apiUrl = 'http://localhost:3000';

        const apiContext = await request.newContext({
            extraHTTPHeaders: {
                'Authorization': `Bearer ${token}`
            }
        });

        const executionsReq = await apiContext.get(`${apiUrl}/api/executions`);
        if (executionsReq.ok()) {
            const body = await executionsReq.json();
            const total = body.data?.total || 0;

            if (total < 3) {
                console.log(`[Playwright Setup] Found ${total} executions. Seeding 3 dummy executions...`);
                // Queue 3 dummy test runs using the API
                for (let i = 1; i <= 3; i++) {
                    const reqPayload = {
                        taskId: `seed-task-${Date.now()}-${i}`,
                        image: 'alpine:latest',
                        command: `echo "Seeded Test Execution ${i}"`,
                        folder: 'all',
                        config: {
                            environment: 'development',
                        }
                    };

                    await apiContext.post(`${apiUrl}/api/execution-request`, {
                        data: reqPayload,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Wait slightly for tests to show up in the DB
                await page.waitForTimeout(3000);
                console.log('[Playwright Setup] Successfully queued 3 dummy test executions.');
            } else {
                console.log(`[Playwright Setup] Found ${total} executions. No seeding required.`);
            }
        } else {
            console.log(`[Playwright Setup] Failed to fetch executions. Status: ${executionsReq.status()} ${executionsReq.statusText()}`);
            console.log(`[Playwright Setup] Response Body: ${await executionsReq.text()}`);
        }
    } else {
        console.log('[Playwright Setup] No auth_token found in localStorage, skipping API seeding.');
    }
    // Save the authenticated state
    await page.context().storageState({ path: authFile });
    console.log('[Playwright Setup] Successfully authenticated test user via UI.');
});
