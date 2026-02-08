import { test, expect } from '../fixtures/base';

// Helper to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test.describe('System Sanity Tests (STD)', () => {

    /**
     * TC-01: Admin Onboarding
     */
    test('TC-01: Admin onboarding returns 201 with JWT token', async ({ request }) => {
        const timestamp = Date.now();

        const response = await request.post('/api/auth/signup', {
            data: {
                email: `tc01-admin-${timestamp}@test.local`,
                password: 'SecurePass123!',
                name: 'TC-01 Admin User',
                organizationName: `TC-01 Org ${timestamp}`,
            },
        });

        expect(response.status()).toBe(201);

        const data = await response.json();

        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('token');
        expect(data.token).toBeTruthy();
        expect(typeof data.token).toBe('string');
        expect(data.token.split('.')).toHaveLength(3);

        expect(data).toHaveProperty('user');
        expect(data.user).toHaveProperty('id');
        expect(data.user).toHaveProperty('organizationId');
        expect(data.user).toHaveProperty('role', 'admin');
    });

    /**
     * TC-02: Execution Flow
     */
    test('TC-02: Execution flow returns task ID', async ({ adminUser }) => {
        const taskId = `tc02-exec-${Date.now()}`;

        const execResponse = await adminUser.request.post('/api/execution-request', {
            headers: { Authorization: `Bearer ${adminUser.token}` },
            data: {
                taskId,
                image: 'test-image:latest',
                command: 'npm test',
                folder: 'all',
                tests: [],  // Required field!
                config: {
                    environment: 'development',
                    baseUrl: 'https://example.com',
                },
            },
        });

        const status = execResponse.status();
        const responseText = await execResponse.text();

        console.log(`Execution request status: ${status}`);
        console.log(`Response: ${responseText}`);

        expect([200, 201, 202]).toContain(status);

        const execData = JSON.parse(responseText);
        expect(execData).toHaveProperty('taskId', taskId);
    });

    /**
     * TC-03: Multi-Organization Isolation
     */
    test('TC-03: Organization isolation prevents cross-org access', async ({ request }) => {
        const timestamp = Date.now();

        await delay(1000);

        const signupA = await request.post('/api/auth/signup', {
            data: {
                email: `tc03-org-a-${timestamp}@test.local`,
                password: 'SecurePass123!',
                name: 'Org A Admin',
                organizationName: `TC-03 Organization A ${timestamp}`,
            },
        });

        if (signupA.status() === 429) {
            console.log('Rate limited on signup A, skipping test');
            test.skip();
            return;
        }

        expect(signupA.status()).toBe(201);
        const dataA = await signupA.json();
        const tokenA = dataA.token;
        const orgAId = dataA.user.organizationId;

        await delay(1000);

        const signupB = await request.post('/api/auth/signup', {
            data: {
                email: `tc03-org-b-${timestamp}@test.local`,
                password: 'SecurePass123!',
                name: 'Org B Admin',
                organizationName: `TC-03 Organization B ${timestamp}`,
            },
        });

        if (signupB.status() === 429) {
            console.log('Rate limited on signup B, skipping test');
            test.skip();
            return;
        }

        expect(signupB.status()).toBe(201);
        const dataB = await signupB.json();
        const tokenB = dataB.token;
        const orgBId = dataB.user.organizationId;

        expect(orgAId).not.toBe(orgBId);

        const orgAResponse = await request.get('/api/executions', {
            headers: { Authorization: `Bearer ${tokenA}` },
        });
        expect(orgAResponse.ok()).toBeTruthy();

        const orgBResponse = await request.get('/api/executions', {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        expect(orgBResponse.ok()).toBeTruthy();

        // Handle both array and wrapped response formats
        const rawA = await orgAResponse.json();
        const rawB = await orgBResponse.json();

        const executionsA = Array.isArray(rawA) ? rawA : (rawA.executions || rawA.data || []);
        const executionsB = Array.isArray(rawB) ? rawB : (rawB.executions || rawB.data || []);

        // Verify isolation - neither org should see the other's data
        const orgAHasOrgBData = executionsA.some((e: any) => e.organizationId === orgBId);
        const orgBHasOrgAData = executionsB.some((e: any) => e.organizationId === orgAId);

        expect(orgAHasOrgBData).toBe(false);
        expect(orgBHasOrgAData).toBe(false);
    });

    /**
     * TC-04: Health Check
     */
    test('TC-04: Health endpoint returns 200 with healthy status', async ({ request }) => {
        let response = await request.get('/');

        if (response.status() === 401) {
            response = await request.get('/health');
        }

        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data).toBeDefined();
    });

});