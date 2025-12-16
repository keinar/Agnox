import { test, expect } from '../../fixtures/base.fixture';
import { AiHelper } from '../../helpers/aiHelper';
import { ProfilePage } from '../../pages/profilePage';
import { config } from '../../config/env';

const ORIGINAL_NAME = 'Keinar'; 

test.describe('AI-Driven Fuzz Testing', () => {
    let aiHelper: AiHelper;

    test.beforeAll(() => {
        aiHelper = new AiHelper();
    });

    test.afterAll(async ({ apiClient }) => { 
        console.log(`[Teardown] Restoring profile...`);
        await apiClient.put('/api/users/profile', {
            name: ORIGINAL_NAME,
            email: config.ADMIN_USER,
            password: config.ADMIN_PASS,
            confirmPassword: config.ADMIN_PASS,
        });
    });

    test('Should handle malicious usernames', async ({ page }) => {
        const profilePage = new ProfilePage(page);
        await profilePage.goto();

        const maliciousInputs = await aiHelper.generateTestInputs(
            "Usernames containing XSS and SQL injection", 3
        );

        for (const badInput of maliciousInputs) {
            console.log(`[Fuzz Test] Input: "${badInput}"`);
            
            let xssExecuted = false;
            page.on('dialog', async dialog => {
                xssExecuted = true;
                await dialog.dismiss(); 
            });

            await profilePage.updateProfile(badInput, config.ADMIN_USER, config.ADMIN_PASS);

            expect(xssExecuted, `XSS executed with: ${badInput}`).toBeFalsy(); 
            await profilePage.goto();
        }
    });
});