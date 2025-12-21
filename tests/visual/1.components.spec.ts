import { test } from '../../fixtures/base.fixture';

test.describe('Visual Regression - Static Components', () => {

    test.beforeAll(() => {
        if (process.platform !== 'linux') {
            console.log('Skipping Visual Tests: Must run on Linux/Docker to match snapshots.');
            test.skip();
        }
    });

    test('1. Should match the Login Form design', async ({ loginPage, dashboardPage }) => {
        await dashboardPage.goto();
        await dashboardPage.logout();
        await loginPage.validateLoginFormDesignMatch();
    });

    test('2. Should match the Dashboard Sidebar design', async ({ dashboardPage }) => {
        await dashboardPage.goto();
        await dashboardPage.validateDashboardDesignMatch();
    });
});