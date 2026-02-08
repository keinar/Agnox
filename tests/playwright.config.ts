import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './specs',
    timeout: 60000,
    retries: process.env.CI ? 2 : 1,
    workers: 1,

    expect: {
        timeout: 10000,
    },

    reporter: [
        ['list'],
        ['html', { outputFolder: '../playwright-report', open: 'never' }]
    ],

    use: {
        baseURL: process.env.API_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
        },
        trace: 'on-first-retry',
    },
});