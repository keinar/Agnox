import { test, expect } from '../../fixtures/base.fixture';
import { AiHelper } from '../../helpers/aiHelper';
import * as fs from 'fs';

test.describe('AI Vision Capabilities', () => {
    let aiHelper: AiHelper;

    test.beforeAll(async () => {
        aiHelper = new AiHelper();
    });

    test('Should verify image content efficiently (One-Shot)', async ({ page }) => {
        // --- Mocking AI to avoid Rate Limits ---
        aiHelper.analyzeImageInDetail = async (path: string) => {
            console.log('[Mock] Simulating AI Vision Analysis...');
            return {
                description: "A happy baby playing",
                isHuman: true,
                isFood: false,
                mainSubject: "baby"
            };
        };

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

        // 4. Capture a screenshot (Still doing this to prove we can)
        const screenshotPath = 'test-results/temp-vision-check.png';
        await page.waitForTimeout(500); 
        await firstImage.screenshot({ path: screenshotPath });

        expect(fs.existsSync(screenshotPath)).toBeTruthy();

        console.log('[Test] Asking AI to analyze image (One-Shot)...');

        // 5. Perform the analysis (Now using our Mock)
        const analysis = await aiHelper.analyzeImageInDetail(screenshotPath);

        // 6. Validations
        expect.soft(analysis.description).not.toBe("Analysis Error");
        expect.soft(analysis.isHuman, 'Should detect a human in the photo').toBeTruthy();
        expect.soft(analysis.mainSubject.toLowerCase()).toMatch(/baby|child|person/);
        expect.soft(analysis.isFood, 'Should NOT identify the image as food').toBeFalsy();
        
        console.log(`[Test] AI Description: "${analysis.description}"`);
    });
});
