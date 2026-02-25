import { Page, expect, Locator } from '@playwright/test';

export class SettingsIntegrationsPage {
    readonly page: Page;
    readonly integrationsTabBtn: Locator;
    readonly slackWebhookInput: Locator;
    readonly saveSlackBtn: Locator;
    readonly jiraDomainInput: Locator;
    readonly jiraEmailInput: Locator;
    readonly jiraTokenInput: Locator;
    readonly saveJiraBtn: Locator;

    constructor(page: Page) {
        this.page = page;
        this.integrationsTabBtn = page.getByRole('button', { name: 'Integrations', exact: true });
        this.slackWebhookInput = page.locator('#slack-webhook-url');
        this.saveSlackBtn = page.getByRole('button', { name: 'Save Webhook', exact: true });
        this.jiraDomainInput = page.locator('#jira-domain');
        this.jiraEmailInput = page.locator('#jira-email');
        this.jiraTokenInput = page.locator('#jira-token');
        this.saveJiraBtn = page.getByRole('button', { name: 'Save Configuration', exact: true });
    }

    async navigateToSettings(baseURL?: string) {
        await this.page.goto(`${baseURL || 'http://localhost:8080'}/settings`);
        await expect(this.integrationsTabBtn).toBeVisible();
        await this.integrationsTabBtn.click();
    }

    async fillSlackForm(webhookUrl: string) {
        await expect(this.slackWebhookInput).toBeVisible();
        await this.slackWebhookInput.fill(webhookUrl);
    }

    async submitSlackForm() {
        await expect(this.saveSlackBtn).toBeVisible();
        await this.saveSlackBtn.click();
    }

    async fillJiraForm(domain: string, email: string, token: string) {
        await expect(this.jiraDomainInput).toBeVisible();
        await this.jiraDomainInput.fill(domain);

        await expect(this.jiraEmailInput).toBeVisible();
        await this.jiraEmailInput.fill(email);

        await expect(this.jiraTokenInput).toBeVisible();
        await this.jiraTokenInput.fill(token);
    }

    async submitJiraForm() {
        await expect(this.saveJiraBtn).toBeVisible();
        await this.saveJiraBtn.click();
    }

    async mockOrganization(organizationMock: any) {
        await this.page.route('**/api/organization', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    json: {
                        success: true,
                        organization: organizationMock
                    }
                });
            } else {
                await route.fallback();
            }
        });
    }

    async mockAuthAsAdmin() {
        await this.page.route('**/api/auth/me', async (route) => {
            const resp = await route.fetch();
            const json = await resp.json();
            if (json.user) {
                json.user.role = 'admin';
            }
            await route.fulfill({ json });
        });
    }

    async verifyErrorMessage(message: string) {
        const errorMessage = this.page.getByText(message);
        await expect(errorMessage).toBeVisible();
    }
}
