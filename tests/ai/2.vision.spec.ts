import { test, expect } from '@playwright/test';
import { AiHelper } from '../../helpers/aiHelper';
import * as fs from 'fs';

test.describe('AI Vision Capabilities', () => {
    let aiHelper: AiHelper;

    test.beforeAll(async () => {
        aiHelper = new AiHelper();
    });

    test('Should verify image content efficiently (One-Shot)', async ({ page }) => {
        // 1. Navigate to the application
        await page.goto('https://photo-gallery.keinar.com/gallery/xB4WC0tAs_');

        // 2. Wait for the gallery images to be visible
        await page.waitForSelector('main main img');

        // 3. Target the first image element
        const firstImage = page.locator('main main img').first();

        // Ensure the element is visible and fully loaded
        await expect(firstImage).toBeVisible();
        
        await firstImage.evaluate(async (img) => {
            const image = img as HTMLImageElement;
            if (image.complete && image.naturalWidth > 0) return;
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });
        });

        // 4. Capture a screenshot of that specific element only
        const screenshotPath = 'test-results/temp-vision-check.png';
        await page.waitForTimeout(500); // Allow transitions to settle
        await firstImage.screenshot({ path: screenshotPath });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();

        console.log('[Test] Asking AI to analyze image (One-Shot)...');

        // 5. Perform a single AI analysis
        const analysis = await aiHelper.analyzeImageInDetail(screenshotPath);

        // 6. Validations based on the returned JSON object
        expect(analysis.description).not.toBe("Analysis Error");

        // Positive Assertion: Expecting a human/baby
        expect(analysis.isHuman, 'Should detect a human in the photo').toBeTruthy();
        expect(analysis.mainSubject.toLowerCase()).toMatch(/baby|child|person/);

        // Negative Assertion: Should not be food
        expect(analysis.isFood, 'Should NOT identify the image as food').toBeFalsy();
        
        console.log(`[Test] AI Description: "${analysis.description}"`);
    });
});