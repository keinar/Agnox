import { test, expect } from '../fixtures/baseTest';
import { baseExecutionMock, TEST_EXECUTION_ID } from '../utils/mockData';

test.describe('Suite A — RBAC & Multi-Tenancy', () => {
    test('A-006 (UI): Viewer Role Cannot Delete Executions', async ({ page, drawerPage, baseURL }) => {
        // 1. Setup all mocks through POM
        await drawerPage.mockAuthAsViewer(); // The new proxy method

        // Use an existing POM method to mock the organization if needed, or create one.
        await drawerPage.mockOrganization();

        // Mock the execution list
        const executionMock = { ...baseExecutionMock, status: 'FAILED' };
        await drawerPage.mockExecutionList([executionMock]);

        // 2. Navigate and verify we stayed on the dashboard
        await page.goto(baseURL || 'http://localhost:8080/dashboard');
        await expect(page).toHaveURL(/.*dashboard/);

        // 3. Assert row renders and Delete button is hidden
        const executionRow = page.locator('tr', { hasText: TEST_EXECUTION_ID });
        await expect(executionRow).toBeVisible();

        const deleteBtn = executionRow.locator('button[title="Delete"]');
        await expect(deleteBtn).not.toBeVisible();
    });

    test('A-008 (UI): Admin Cannot Demote the Last Admin', async ({ page, membersPage, baseURL }) => {
        // 1. Set up mocks
        await membersPage.mockAuthAsAdmin();
        await membersPage.mockOrganization();
        await membersPage.mockInvitationsList([]);

        // Mock users list returning ONLY 1 admin (the current user)
        const fakeUserId = 'user-admin-123';
        const singleAdminUser = {
            id: fakeUserId,
            name: 'Sole Admin',
            email: 'admin@test.com',
            role: 'admin',
            createdAt: new Date().toISOString()
        };
        await membersPage.mockUsersList([singleAdminUser]);

        // Intercept the PATCH user role request
        await page.route('**/api/users/*/role', async (route) => {
            if (route.request().method() === 'PATCH') {
                await route.fulfill({
                    status: 400,
                    json: {
                        success: false,
                        message: 'Cannot demote the last admin of the organization.'
                    }
                });
            } else {
                await route.fallback();
            }
        });

        // Set up the dialog listener to catch the window.alert thrown by MembersTab
        let alertMessage = '';
        page.on('dialog', async dialog => {
            alertMessage = dialog.message();
            await dialog.accept();
        });

        // 2. Action: Navigate and attempt to demote
        await membersPage.navigateToMembers(baseURL);

        // Even though MembersTab blocks changing own role using user?.id, we bypass it for the sake of 
        // this test's "last admin" backend simulation by having the mock return a DIFFERENT id
        // than the one the real backend gives `useAuth` context during `global.setup`. 
        // This triggers the API call seamlessly. 

        const roleDropdown = page.locator('select');
        await expect(roleDropdown).toBeVisible();
        await roleDropdown.selectOption('developer');

        // Wait a slight moment for the API call and the window.alert to fire
        await page.waitForTimeout(500);

        // 3. Assertion: Verify the alert message matched the backend error
        expect(alertMessage).toBe('Cannot demote the last admin of the organization.');
    });
});
