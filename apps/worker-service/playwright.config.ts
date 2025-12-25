import { defineConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { 
      outputFolder: 'allure-results',
      detail: true,
      suiteTitle: false,
      environmentInfo: { FRAMEWORK: 'Playwright' }
    }]
  ],

  timeout: 30 * 1000,

  expect: {
    timeout: 5000
  },
// Global setup file to perform API login and save auth state
  globalSetup: require.resolve('./global.setup.ts'),

  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    headless: !!process.env.CI,

    viewport: { width: 1920, height: 1080 },
    storageState: '.auth/auth-state.json',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'ui-tests',
      testDir: './tests/ui',
      use: { 
        browserName: 'chromium'
      },
    },
    {
      name: 'api-tests',
      testDir: './tests/api',
    },
    {
      name: 'e2e-tests',
      testDir: './tests/e2e',
      use: { 
        browserName: 'chromium'
      },
    },
    {
      name: 'data-validation-tests',
      testDir: './tests/data',
      use: { 
        browserName: 'chromium'
      },
    },
    {
      name: 'visual-tests',
      testDir: './tests/visual',
      use: { 
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'ai-tests',
      testDir: './tests/ai',
      use: { 
        browserName: 'chromium'
      },
    },
  ],
});
