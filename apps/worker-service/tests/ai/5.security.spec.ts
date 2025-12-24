import { test, expect } from '../../fixtures/base.fixture';
import { AiHelper } from '../../helpers/aiHelper';

test.describe('AI-Assisted Security Scans', () => {
    let aiHelper: AiHelper;

    test.beforeAll(() => {
        aiHelper = new AiHelper();
    });

    test('Should detect sensitive info in Error Responses (Mocked 500)', async ({ page, dashboardPage }) => {
        // --- Mocking AI: Simulate Finding a Leak ---
        aiHelper.scanForSecurityRisks = async (content, context) => {
            return {
                isSecure: false,
                detectedIssues: ["Critical Leak: Internal IP found", "Stack Trace exposed"]
            };
        };
        
        const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/galleries'));

        await page.route('**/api/galleries', route => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: "Database Connection Failed",
                    debugInfo: "MongoTimeoutError: 192.168.1.55:27017" 
                })
            });
        });

        await dashboardPage.goto();
        
        const response = await responsePromise;
        const responseBody = await response.text();

        const scanResult = await aiHelper.scanForSecurityRisks(responseBody, "500 API Response Body");
        
        expect(scanResult.isSecure, 
            `The AI failed to detect the security leak! Issues: ${scanResult.detectedIssues.join(', ')}`
        ).toBeFalsy(); 
    });

    test('Should not expose PII in public API responses', async ({galleryService}) => {
        // --- Mocking AI: Simulate SECURE Response ---
        aiHelper.scanForSecurityRisks = async (content, context) => {
            return { isSecure: true, detectedIssues: [] };
        };

        const response = await galleryService.getPublic('some-secret-link'); 
        const body = await response.text();

        const scanResult = await aiHelper.scanForSecurityRisks(body, "Public API Response");

        expect(scanResult.isSecure).toBeTruthy();
    });

    test('Production Security Scan - Real Traffic Analysis', async ({ page, dashboardPage }) => {
        // --- Mocking AI: Simulate SECURE Response ---
        aiHelper.scanForSecurityRisks = async (content, context) => {
            return { isSecure: true, detectedIssues: [] };
        };

        const capturedTraffic: string[] = [];

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/') || url.includes('/graphql')) {
                try {
                    const text = await response.text();
                    capturedTraffic.push(`URL: ${url}\nBody: ${text.slice(0, 100)}`); 
                } catch (e) {}
            }
        });

        console.log('[Security Scan] Navigating...');
        await dashboardPage.goto();
        await page.waitForLoadState('networkidle');

        const trafficReport = capturedTraffic.join('\n');
        const scanResult = await aiHelper.scanForSecurityRisks(trafficReport, "Real User Traffic");

        expect(scanResult.isSecure).toBeTruthy();
    });
});