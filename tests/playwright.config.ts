import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

try {
    dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
    console.log('No .env file found, relying on process.env');
}

const authFile = path.resolve(__dirname, '.auth/user.json');

export default defineConfig({
    testDir: '.',
    testIgnore: ['**/legacy_archive/**', '**/fixtures/**'],
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
        baseURL: process.env.BASE_URL || 'http://localhost:8080',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
        },
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'setup',
            testMatch: /global\.setup\.ts/,
        },
        {
            name: 'chromium',
            testMatch: /specs\/.*\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: authFile,
            },
            dependencies: ['setup'],
        }
    ]
});