import { test as base, expect, APIRequestContext } from '@playwright/test';

/**
 * Admin user fixture data returned after authentication
 */
export interface AdminUser {
    token: string;
    userId: string;
    organizationId: string;
    email: string;
    request: APIRequestContext;
}

/**
 * Extended test fixtures for API testing
 */
export const test = base.extend<{
    adminUser: AdminUser;
}>({
    /**
     * Fixture: adminUser
     * Automatically registers a new admin user and returns authenticated context
     */
    adminUser: async ({ request }, use) => {
        const timestamp = Date.now();
        const email = `sanity-admin-${timestamp}@test.local`;
        const password = 'TestPass123!';

        // Register new admin user
        const signupResponse = await request.post('/api/auth/signup', {
            data: {
                email,
                password,
                name: `Sanity Test Admin ${timestamp}`,
                organizationName: `Sanity Org ${timestamp}`,
            },
        });

        if (!signupResponse.ok()) {
            const error = await signupResponse.text();
            throw new Error(`Admin signup failed: ${signupResponse.status()} - ${error}`);
        }

        const signupData = await signupResponse.json();

        const adminUser: AdminUser = {
            token: signupData.token,
            userId: signupData.user.id,
            organizationId: signupData.user.organizationId,
            email,
            request,
        };

        await use(adminUser);
    },
});

export { expect };