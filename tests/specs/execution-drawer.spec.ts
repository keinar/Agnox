import { test, expect } from '../fixtures/baseTest';
import { TEST_EXECUTION_ID, baseExecutionMock } from '../utils/mockData';

test.describe('Suite C — AI Analysis & Triage', () => {
    test('C-008: AI Analysis Tab Is Hidden in UI on ERROR Status', async ({ drawerPage, baseURL }) => {
        const executionMock = { ...baseExecutionMock, status: 'ERROR', output: 'Execution failed due to error.' };
        await drawerPage.mockExecutionList([executionMock]);
        await drawerPage.mockArtifacts(TEST_EXECUTION_ID, [{ id: 'art-1', name: 'error-log.txt', type: 'text' }]);

        await drawerPage.navigateToDrawer(baseURL, TEST_EXECUTION_ID);
        await expect(drawerPage.page.locator('text=Execution failed due to error.')).toBeVisible();

        await drawerPage.verifyTabVisible('Terminal');
        await drawerPage.verifyTabVisible('Artifacts');
        await drawerPage.verifyTabHidden('AI Analysis');
    });

    test('C-009: AI Analysis Tab Is Visible on COMPLETED Status', async ({ drawerPage, baseURL }) => {
        await drawerPage.mockExecutionList([baseExecutionMock]);
        await drawerPage.mockArtifacts(TEST_EXECUTION_ID, [{ id: 'art-2', name: 'success-log.txt', type: 'text' }]);

        await drawerPage.navigateToDrawer(baseURL, TEST_EXECUTION_ID);
        await expect(drawerPage.page.locator('text=Execution completed successfully.')).toBeVisible();

        await drawerPage.verifyTabVisible('Terminal');
        await drawerPage.verifyTabVisible('Artifacts');

        await drawerPage.verifyTabVisible('AI Analysis');
        await drawerPage.clickTab('AI Analysis');
        await expect(drawerPage.getTabLocator('AI Analysis')).toHaveClass(/.*text-blue-600.*/);
    });

    test('C-010: AI Analysis Renders Markdown Content Correctly', async ({ drawerPage, baseURL }) => {
        const executionMock = {
            ...baseExecutionMock,
            analysis: '## Root Cause Analysis\n\n* **Issue**: Timeout\n* **Recommendation**: Check Redis connection.'
        };
        await drawerPage.mockExecutionList([executionMock]);
        await drawerPage.mockArtifacts(TEST_EXECUTION_ID, [{ id: 'art-3', name: 'analysis-log.txt', type: 'text' }]);

        await drawerPage.navigateToDrawer(baseURL, TEST_EXECUTION_ID);
        await expect(drawerPage.page.locator('text=Execution completed successfully.')).toBeVisible();

        await drawerPage.verifyTabVisible('AI Analysis');
        await drawerPage.clickTab('AI Analysis');
        await expect(drawerPage.getTabLocator('AI Analysis')).toHaveClass(/.*text-blue-600.*/);

        const rootCauseHeader = drawerPage.drawer.locator('h3', { hasText: /^Root Cause Analysis$/ });
        await expect(rootCauseHeader).toBeVisible();
        await expect(drawerPage.drawer.locator('text="Issue: Timeout"')).toBeVisible();
        await expect(drawerPage.drawer.locator('text="Recommendation: Check Redis connection."')).toBeVisible();
    });
});
