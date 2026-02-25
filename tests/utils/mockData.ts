export const TEST_EXECUTION_ID = 'mock-task-123';

export const baseExecutionMock = {
    id: TEST_EXECUTION_ID,
    taskId: TEST_EXECUTION_ID,
    organizationId: 'fake-org-id', // The drawer component just renders what it gets
    status: 'COMPLETED',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    output: 'Execution completed successfully.',
    aiAnalysisEnabled: true
};

export const baseOrganizationMock = {
    id: 'fake-org',
    name: 'Fake Org',
    slug: 'fake-org',
    plan: 'free',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    limits: {
        maxProjects: 10,
        maxTestRuns: 1000,
        maxUsers: 5,
        maxConcurrentRuns: 2
    },
    slackWebhookUrl: '',
    slackNotificationEvents: ['FAILED', 'ERROR', 'UNSTABLE'],
    integrations: {}
};
