import { test, expect } from '../fixtures/baseTest';
import { baseOrganizationMock } from '../utils/mockData';

test.describe('Suite D — Settings & Integrations', () => {
    test.beforeEach(async ({ page }) => {
        // Mock jira config fetch to prevent 404 console errors in test
        await page.route('**/api/integrations/jira', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 404,
                    json: {
                        success: false,
                        error: 'Jira integration not found.'
                    }
                });
            } else {
                await route.fallback();
            }
        });
    });

    test('D-001 (UI): Slack Webhook SSRF Protection', async ({ page, settingsPage, baseURL }) => {
        await settingsPage.mockOrganization(baseOrganizationMock);
        await settingsPage.mockAuthAsAdmin();

        await page.route('**/api/organization', async (route) => {
            if (route.request().method() === 'PATCH') {
                const postData = route.request().postDataJSON();
                if (postData && postData.slackWebhookUrl === 'https://evil.com/webhook') {
                    await route.fulfill({
                        status: 400,
                        json: {
                            success: false,
                            message: 'Invalid Slack Webhook URL. Only hooks.slack.com is permitted.'
                        }
                    });
                } else {
                    await route.fallback();
                }
            } else {
                await route.fallback();
            }
        });

        await settingsPage.navigateToSettings(baseURL);
        await settingsPage.fillSlackForm('https://evil.com/webhook');
        await settingsPage.submitSlackForm();

        await settingsPage.verifyErrorMessage('Invalid Slack Webhook URL. Only hooks.slack.com is permitted.');
        await expect(settingsPage.slackWebhookInput).toHaveValue('https://evil.com/webhook');
    });

    test('D-008 (UI): Jira Domain SSRF Prevention', async ({ page, settingsPage, baseURL }) => {
        await settingsPage.mockOrganization(baseOrganizationMock);
        await settingsPage.mockAuthAsAdmin();

        await page.route('**/api/integrations/jira', async (route) => {
            if (route.request().method() === 'PUT') {
                const postData = route.request().postDataJSON();
                if (postData && postData.domain === 'mycompany.evil.com') {
                    await route.fulfill({
                        status: 400,
                        json: {
                            success: false,
                            error: 'Domain must be a valid Atlassian Cloud domain (*.atlassian.net)'
                        }
                    });
                } else {
                    await route.fallback();
                }
            } else {
                await route.fallback();
            }
        });

        await settingsPage.navigateToSettings(baseURL);
        await settingsPage.fillJiraForm('mycompany.evil.com', 'user@co.com', 'dummy_token');
        await settingsPage.submitJiraForm();

        await settingsPage.verifyErrorMessage('Domain must be a valid Atlassian Cloud domain (*.atlassian.net)');
    });
});
