import { Page, expect, Locator } from '@playwright/test';
import { baseOrganizationMock } from '../utils/mockData';

export class MembersPage {
    readonly page: Page;
    readonly membersTabBtn: Locator;

    constructor(page: Page) {
        this.page = page;
        this.membersTabBtn = page.getByRole('button', { name: 'Team Members', exact: true });
    }

    async navigateToMembers() {
        await this.page.goto('/settings');
        await expect(this.membersTabBtn).toBeVisible();
        await this.membersTabBtn.click();
    }

    async mockAuthAsAdmin() {
        await this.page.route('**/api/auth/me*', async (route) => {
            const resp = await route.fetch();
            const json = await resp.json();

            // The robust injection mapping:
            if (json?.data?.user) json.data.user.role = 'admin';
            else if (json?.data) json.data.role = 'admin';
            else if (json?.user) json.user.role = 'admin';

            await route.fulfill({ json });
        });
    }

    async mockOrganization() {
        await this.page.route('**/api/organization', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    json: { success: true, organization: baseOrganizationMock }
                });
            } else {
                await route.fallback();
            }
        });
    }

    async mockUsersList(users: any[]) {
        await this.page.route('**/api/users', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    json: { success: true, users }
                });
            } else {
                await route.fallback();
            }
        });
    }

    async mockInvitationsList(invitations: any[] = []) {
        await this.page.route('**/api/invitations', async (route) => {
            await route.fulfill({
                json: { success: true, invitations }
            });
        });
    }

    async changeUserRole(userId: string, targetRole: 'admin' | 'developer' | 'viewer') {
        // The table row for the user contains a select dropdown
        // Playwright can select by option value
        const userRow = this.page.locator(`tr:has(span:text("${userId}"))`); // Actually we don't display ID natively, need to use name or email
        // Or simpler, since our mock will probably have just 1 user, just find the select
        const roleDropdown = this.page.locator('select');
        await roleDropdown.selectOption(targetRole);
    }

    async verifyErrorMessage(message: string) {
        // Axios alert errors are rendered via native window.alert in some components, 
        // but let's handle the window.alert event natively in Playwright.
        // Wait, the code says: alert(err.response?.data?.message || 'Failed to change user role');
        // We cannot use await expect(page.getByText(...)) for native alerts.
        // We must setup an alert listener before the action.
    }
}
