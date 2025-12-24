import { test } from '../../fixtures/base.fixture';

test.describe('Dashboard Page - Authenticated UI', () => {

    test.beforeEach(async ({ dashboardPage }) => {
        await dashboardPage.goto();
    });


    test('1. Should load dashboard and show create button', async ({ dashboardPage }) => {
        await dashboardPage.validateCreateGalleryButtonVisible();
    });


    test('2. Should be able to log out', async ({ dashboardPage }) => {
        await dashboardPage.logout();
    });
});