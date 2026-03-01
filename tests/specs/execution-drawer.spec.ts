import { test, expect } from '../fixtures/baseTest';
import { TEST_EXECUTION_ID, baseExecutionMock } from '../utils/mockData';

test.describe('Suite C — AI Analysis & Triage', () => {
    test('C-008: AI Analysis Tab Is Hidden in UI on ERROR Status', async ({ drawerPage }) => {
        const executionMock = { ...baseExecutionMock, id: TEST_EXECUTION_ID, name: 'Test Execution', status: 'ERROR', error: 'Execution failed due to error.' };
        await drawerPage.mockExecutionList([executionMock]);
        await drawerPage.mockSingleExecution(executionMock);
        await drawerPage.mockArtifacts(TEST_EXECUTION_ID, [{ id: 'art-1', name: 'error-log.txt', type: 'text' }]);

        await drawerPage.navigateToDrawer(TEST_EXECUTION_ID);
        await expect(drawerPage.page.locator('text=Execution failed due to error.')).toBeVisible();

        await drawerPage.verifyTabVisible('Terminal');
        await drawerPage.verifyTabVisible('Artifacts');
        await drawerPage.verifyTabHidden('AI Analysis');
    });

    test('C-009: AI Analysis Tab Is Visible on COMPLETED Status', async ({ drawerPage }) => {
        const executionMock = { ...baseExecutionMock, id: TEST_EXECUTION_ID, name: 'Test Execution', status: 'COMPLETED' };
        await drawerPage.mockExecutionList([executionMock]);
        await drawerPage.mockSingleExecution(executionMock);
        await drawerPage.mockArtifacts(TEST_EXECUTION_ID, [{ id: 'art-2', name: 'success-log.txt', type: 'text' }]);

        await drawerPage.navigateToDrawer(TEST_EXECUTION_ID);
        await expect(drawerPage.page.locator('text=Execution completed successfully.')).toBeVisible();

        await drawerPage.verifyTabVisible('Terminal');
        await drawerPage.verifyTabVisible('Artifacts');

        await drawerPage.verifyTabVisible('AI Analysis');
        await drawerPage.clickTab('AI Analysis');
        await expect(drawerPage.getTabLocator('AI Analysis')).toHaveClass(/.*text-blue-600.*/);
    });

    test('C-010: AI Analysis Renders Markdown Content Correctly', async ({ drawerPage }) => {
        const executionMock = {
            ...baseExecutionMock,
            id: TEST_EXECUTION_ID,
            name: 'Test Execution',
            status: 'COMPLETED',
            // שינינו מ-aiAnalysis ל-analysis
            analysis: '### Root Cause Analysis\n\nIssue: Timeout\n\nRecommendation: Check Redis connection.'
        };
        await drawerPage.mockExecutionList([executionMock]);
        await drawerPage.mockSingleExecution(executionMock);
        await drawerPage.mockArtifacts(TEST_EXECUTION_ID, [{ id: 'art-3', name: 'analysis-log.txt', type: 'text' }]);

        await drawerPage.navigateToDrawer(TEST_EXECUTION_ID);
        await expect(drawerPage.page.locator('text=Execution completed successfully.')).toBeVisible();

        await drawerPage.verifyTabVisible('AI Analysis');
        await drawerPage.clickTab('AI Analysis');
        await expect(drawerPage.getTabLocator('AI Analysis')).toHaveClass(/.*text-blue-600.*/);

        const rootCauseHeader = drawerPage.drawer.getByRole('heading', {
            name: /^Root Cause Analysis$/,
            exact: true
        });
        await expect(rootCauseHeader).toBeVisible();
        await expect(drawerPage.drawer.getByText('Issue: Timeout')).toBeVisible();
        await expect(drawerPage.drawer.getByText('Recommendation: Check Redis connection.')).toBeVisible();
    });
});
