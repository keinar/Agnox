import { Page, Locator, expect } from '@playwright/test';
import { TEST_EXECUTION_ID } from '../utils/mockData';

export class ExecutionDrawerPage {
    readonly page: Page;
    readonly drawer: Locator;

    constructor(page: Page) {
        this.page = page;
        this.drawer = page.locator('role=dialog');
    }

    async navigateToDrawer(executionId: string = TEST_EXECUTION_ID) {
        await this.page.goto(`/dashboard?drawerId=${executionId}`);
        await this.page.waitForSelector('text=Terminal');
    }
    async mockAuthAsViewer() {
        await this.page.route('**/api/auth/me*', async (route) => {
            // 1. Fetch the REAL response using the valid storageState token
            const response = await route.fetch();
            const json = await response.json();

            // 2. Safely mutate ONLY the role to 'viewer' based on wherever it exists
            if (json?.data?.user) json.data.user.role = 'viewer';
            else if (json?.data) json.data.role = 'viewer';
            else if (json?.user) json.user.role = 'viewer';

            console.log(`[Proxy] Modified /auth/me real response to role: viewer. Actual shape injected:`, Object.keys(json));

            // 3. Fulfill the route with the modified real data
            await route.fulfill({ response, json });
        });

        // Do the exact same proxy pattern for /api/users/me* just in case
        await this.page.route('**/api/users/me*', async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            if (json?.data?.user) json.data.user.role = 'viewer';
            else if (json?.data) json.data.role = 'viewer';
            else if (json?.user) json.user.role = 'viewer';

            console.log(`[Proxy] Modified /users/me real response to role: viewer.`);
            await route.fulfill({ response, json });
        });
    }

    async mockOrganization() {
        const { baseOrganizationMock } = require('../utils/mockData');
        await this.page.route('**/api/organization*', async (route) => {
            await route.fulfill({
                json: {
                    success: true,
                    organization: { ...baseOrganizationMock, id: 'fake-org' }
                }
            });
        });
    }

    async mockExecutionList(executions: any[]) {
        await this.page.route('**/api/executions*', async (route) => {
            if (route.request().url().includes('/artifacts')) {
                return route.fallback();
            }
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        executions,
                        total: executions.length,
                        limit: 25,
                        offset: 0
                    }
                }
            });
        });
    }

    async mockSingleExecution(executionMock: any) {
        await this.page.route('**/api/executions/*', async (route) => {
            if (route.request().url().includes('/artifacts')) {
                return route.fallback();
            }
            // Prevent intercepting the list API by falling back if there is no specific ID in the path
            // e.g. /api/executions?limit=25
            if (route.request().url().match(/api\/executions\?./)) {
                return route.fallback();
            }
            await route.fulfill({
                json: {
                    success: true,
                    data: executionMock
                }
            });
        });
    }

    async mockArtifacts(executionId: string, artifacts: any[]) {
        await this.page.route(`**/api/executions/${executionId}/artifacts`, async (route) => {
            await route.fulfill({
                json: {
                    success: true,
                    data: { artifacts }
                }
            });
        });
    }

    getTabLocator(tabName: string) {
        return this.drawer.locator(`button:has-text("${tabName}")`);
    }

    async verifyTabVisible(tabName: string) {
        await expect(this.getTabLocator(tabName)).toBeVisible();
    }

    async verifyTabHidden(tabName: string) {
        await expect(this.getTabLocator(tabName)).not.toBeVisible();
    }

    async clickTab(tabName: string) {
        await this.getTabLocator(tabName).click();
    }
}
