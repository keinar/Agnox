import { test, expect } from '@playwright/test';

// Define placeholder IDs for our mocked executions
const ID_PASSED = 'mock-passed-123';
const ID_FAILED = 'mock-failed-456';
const ID_ERROR = 'mock-error-789';

const createMockExecution = (id: string, status: string) => ({
    id,
    taskId: id, // Used by ExecutionList for the row key and display
    organizationId: 'fake-org-id',
    status,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    output: `Mock log for ${status}`,
    aiAnalysisEnabled: true
});

test.describe('Suite D — Dashboard Filters', () => {
    test('D-001: Filter by Status updates the execution list', async ({ page, baseURL }) => {
        // 1. Mock the API endpoint
        // Playwright intercepts are evaluated in order of registration. Since we only
        // have one route handler for **/api/executions*, we inspect the query params dynamically.
        await page.route('**/api/executions*', async (route) => {
            const requestUrl = route.request().url();

            // Pass-through or ignore artifacts fetches, just in case
            if (requestUrl.includes('/artifacts')) {
                return route.fallback();
            }

            // 3. Interception: Verify specific filtered request by 'FAILED' status
            if (requestUrl.includes('status=FAILED')) {
                await route.fulfill({
                    json: {
                        success: true,
                        data: {
                            executions: [createMockExecution(ID_FAILED, 'FAILED')],
                            total: 1,
                            limit: 25,
                            offset: 0
                        }
                    }
                });
                return;
            }

            // 1. Initial State: Return a mixed list of 3 executions
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        executions: [
                            createMockExecution(ID_PASSED, 'PASSED'),
                            createMockExecution(ID_FAILED, 'FAILED'),
                            createMockExecution(ID_ERROR, 'ERROR')
                        ],
                        total: 3,
                        limit: 25,
                        offset: 0
                    }
                }
            });
        });

        // 2. Action: Navigate to /dashboard
        const urlToVisit = baseURL ? `${baseURL}/dashboard` : 'http://localhost:8080/dashboard';

        // Navigate and wait for DOM-based evidence that the initial data loaded.
        // Avoids waitForResponse, which is unreliable when the SPA serves data from cache.
        await page.goto(urlToVisit);

        // Ensure the table initially loaded all 3 mock items.
        // Playwright polls these assertions until they pass (up to the configured expect timeout).
        await expect(page.locator(`text=${ID_PASSED}`)).toBeVisible();
        await expect(page.locator(`text=${ID_FAILED}`)).toBeVisible();
        await expect(page.locator(`text=${ID_ERROR}`)).toBeVisible();

        // Once visible, confirming the strict count is safe
        await expect(page.locator('tbody tr')).toHaveCount(3);

        // 2. Action: Click the "Failed" filter button.
        // The Source filter added "All", "Agnox Hosted", "External CI" buttons — none conflict
        // with this locator, so the exact-match on "Failed" remains unambiguous.
        const failedButton = page.getByRole('button', { name: 'Failed', exact: true });
        await expect(failedButton).toBeVisible();
        await failedButton.click();

        // Give the UI time to settle. The SPA may serve the filtered result from its in-memory
        // cache (no network round-trip), so waitForResponse would hang indefinitely. A short
        // fixed wait followed by polling assertions is the robust alternative.
        await page.waitForTimeout(1000);

        // 4. Assertion: Verify the table now shows exactly 1 row
        // Wait for the specific mock ID string to ensure data matched
        await expect(page.locator(`text=${ID_FAILED}`)).toBeVisible();
        await expect(page.locator('tbody tr')).toHaveCount(1);

        // Assertion: Verify the PASSED and ERROR rows disappeared
        await expect(page.locator(`text=${ID_PASSED}`)).not.toBeVisible();
        await expect(page.locator(`text=${ID_ERROR}`)).not.toBeVisible();

        // Assertion: Verify the "Status" column in that remaining row contains "FAILED"
        // Wait for the specific mock ID string to ensure data matched
        await expect(page.locator(`text=${ID_FAILED}`)).toBeVisible();
        const statusCell = page.locator('tbody tr td').filter({ hasText: 'FAILED' }).first();
        await expect(statusCell).toBeVisible();

        // Assertion: Verify that the "Failed" filter button now has the active UI state.
        // The active class block from FilterBar is 'bg-rose-600 text-white border-rose-600'.
        // Let's assert against the presence of the active background color.
        await expect(failedButton).toHaveClass(/.*bg-rose-600.*/);
    });
});
