import { test, expect, Page } from '@playwright/test';
import { AiHelper } from '../../helpers/aiHelper';
import { ApiClient } from '../../helpers/apiClient';
import { DashboardPage } from '../../pages/dashboardPage';

test.describe('AI-Assisted Security Scans', () => {
    let aiHelper: AiHelper;
    let apiClient: ApiClient;
    let dashboard: DashboardPage;

    test.beforeAll(() => {
        aiHelper = new AiHelper();
    });

    test.beforeEach(async ({ request, page }) => {
        apiClient = new ApiClient(request);
        dashboard = new DashboardPage(page);
    });

    /**
     * Test 1: Sanity Check for the AI Tool
     * We intentionally fake a security breach to make sure our AI catches it.
     * If this passes, we know the "Alarm System" works.
     */
    test('Should detect sensitive info in Error Responses (Mocked 500)', async ({ page }) => {
        
        // 1. Prepare to capture the specific network response
        const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/galleries'));

        // 2. Mock the endpoint to return sensitive leaked data
        await page.route('**/api/galleries', route => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: "Database Connection Failed",
                    // Critical Leak: Internal IP and Stack Trace
                    debugInfo: "MongoTimeoutError: Server selection timed out after 30000 ms at 192.168.1.55:27017" 
                })
            });
        });

        // 3. Trigger the request
        await dashboard.goto();
        
        // 4. Get the mocked response
        const response = await responsePromise;
        const responseBody = await response.text();

        // 5. Verify the AI shouts "UNSAFE"
        const scanResult = await aiHelper.scanForSecurityRisks(responseBody, "500 API Response Body");
        
        expect(scanResult.isSecure, 
            `The AI failed to detect the security leak! Issues: ${scanResult.detectedIssues.join(', ')}`
        ).toBeFalsy(); 
    });

    /**
     * Test 2: Specific API Endpoint Scan
     * Checking a specific known endpoint for PII.
     */
    test('Should not expose PII in public API responses', async () => {
        // Note: Make sure this link exists or handle 404
        const response = await apiClient.getGalleryPublic('some-secret-link'); 
        const body = await response.text();

        const scanResult = await aiHelper.scanForSecurityRisks(body, "Public API Response");

        expect(scanResult.isSecure, 
            `Found PII/Secrets in public response: ${scanResult.detectedIssues}`
        ).toBeTruthy();
    });

    /**
     * Test 3: Real Production Scan (E2E)
     * We passively listen to ALL traffic during a real user session.
     * If the AI finds anything here -> STOP DEPLOYMENT.
     */
    test('Production Security Scan - Real Traffic Analysis', async ({ page }) => {
        const capturedTraffic: string[] = [];

        // 1. Start Listening BEFORE navigation
        // We subscribe to the 'response' event to collect data in real-time
        page.on('response', async (response) => {
            const url = response.url();
            // Filter only relevant API calls (ignore CSS, Images, JS files)
            if (url.includes('/api/') || url.includes('/graphql')) {
                try {
                    // Get response body (safely)
                    const text = await response.text();
                    capturedTraffic.push(`URL: ${url}\nMethod: ${response.request().method()}\nBody: ${text.slice(0, 2000)}`); // Limit length for AI
                } catch (e) {
                    // Ignore failed/empty responses
                }
            }
        });

        // 2. Perform User Actions (Navigate, Click, Load Data)
        console.log('[Security Scan] Navigating and collecting traffic...');
        await dashboard.goto();
        
        // Wait for network to be idle to ensure we caught everything
        await page.waitForLoadState('networkidle');

        // 3. Analyze the collected data
        console.log(`[Security Scan] Analyzing ${capturedTraffic.length} network requests...`);
        
        if (capturedTraffic.length === 0) {
            console.warn("No API traffic captured! Check the filter logic.");
        }

        // Join all requests into one big text blob for the AI
        const trafficReport = capturedTraffic.join('\n\n-----------------\n\n');
        const scanResult = await aiHelper.scanForSecurityRisks(trafficReport, "Real User Traffic");

        // 4. Assertion: Must be Secure
        expect(scanResult.isSecure, 
            `CRITICAL SECURITY ALERT: ${scanResult.detectedIssues}`
        ).toBeTruthy();
    });
});