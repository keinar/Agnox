import { test, expect, APIRequestContext } from '@playwright/test';
import { AiHelper } from '../../helpers/aiHelper';
import { ProfilePage } from '../../pages/profilePage';
import { ApiClient } from '../../helpers/apiClient';
import * as dotenv from 'dotenv';


dotenv.config();

const ADMIN_EMAIL_FOR_LOGIN = process.env.ADMIN_USER || 'fallback@example.com';
const ORIGINAL_ADMIN_PASS = process.env.ADMIN_PASS || 'Password123!'; 
const ORIGINAL_NAME_STRING = 'Keinar'; 



test.describe('AI-Driven Fuzz Testing', () => {
    let aiHelper: AiHelper;
    let profilePage: ProfilePage;
    let apiClient: ApiClient;

    // We use the { request } fixture instead of { page } to ensure cleanup works even after the browser closes.
    test.afterAll(async ({ request }) => { 
        console.log(`[Teardown] Restoring profile back to: Name=${ORIGINAL_NAME_STRING}, Email=${ADMIN_EMAIL_FOR_LOGIN}`);
        
        const authHeader = ApiClient.readAuthHeaderFromDisk();
        if (!authHeader['Authorization']) {
            console.error("[Teardown ERROR] Failed to retrieve token. Skipping profile restoration.");
            return;
        }

        // 2. Prepare the cleanup payload
        const cleanupPayload = {
            name: ORIGINAL_NAME_STRING,
            email: ADMIN_EMAIL_FOR_LOGIN,
            password: ORIGINAL_ADMIN_PASS, 
            confirmPassword: ORIGINAL_ADMIN_PASS,
        };

        // 3. Perform the authenticated API PUT request to restore the state (FIX: Changed PATCH to PUT)
        const response = await request.put('api/users/profile', {
            headers: {
                'Authorization': authHeader['Authorization'],
                'Content-Type': 'application/json'
            },
            data: cleanupPayload,
        });

        if (response.ok()) {
            console.log(`[Teardown] Cleanup complete. Profile restored via API.`);
        } else {
            console.error(`[Teardown ERROR] Failed to restore profile via API. Status: ${response.status()}, Body: ${await response.text()}`);
        }
    });
    // ------------------------------------------------------------------

    test.beforeAll(() => {
        aiHelper = new AiHelper();
    });

    test.beforeEach(async ({ page }) => {
        profilePage = new ProfilePage(page);
        await profilePage.goto();
    });

    test('Should handle malicious usernames gracefully (XSS, SQLi, Special Chars)', async ({ page }) => {
        
        // 1. Ask the AI to generate a list of malicious inputs
        const maliciousInputs = await aiHelper.generateTestInputs(
            "Usernames containing XSS vectors, SQL injection attempts, and excessive special characters to test input sanitization and validation", 
            3
        );

        const testPassword = ORIGINAL_ADMIN_PASS; 

        for (const badInput of maliciousInputs) {
            console.log(`[Fuzz Test] Attempting to update username with: "${badInput}"`);

            let xssExecuted = false;
            page.on('dialog', async dialog => {
                if (dialog.type() === 'alert') {
                    xssExecuted = true;
                    await dialog.dismiss(); 
                }
            });

            // 3. Execute the action: The profile is updated with the BAD name and the ORIGINAL password
            await profilePage.updateProfile(
                badInput,          // Malicious Name Input
                ADMIN_EMAIL_FOR_LOGIN, // Correct Email Input
                testPassword       // Password to use (ORIGINAL_ADMIN_PASS)
            );

            // Assertions for Resilience and Stability
            const serverError = page.locator('text=Internal Server Error', { exact: true });
            await expect(serverError).not.toBeVisible({ timeout: 5000 });

            expect(xssExecuted, 
                `CRITICAL FAILED: XSS Alert executed with input: ${badInput}. Application is vulnerable.`
            ).toBeFalsy(); 

            // Reset state for the next loop iteration
            await profilePage.goto();
            await expect(profilePage.updateButton).toBeVisible(); 
        }
    });
});