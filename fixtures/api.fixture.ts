import { test as baseTest, request as apiRequest, APIRequestContext } from '@playwright/test';
import { ApiClient } from '../helpers/apiClient';

// Define the path to the auth file
const authFile = 'playwright/.auth/auth-state.json';

/**
 * @file api.fixture.ts
 * @description This file defines a custom "test fixture" for our ApiClient.
 *
 * THIS IS THE ROBUST SOLUTION:
 * This fixture does NOT depend on the built-in '{ request }' fixture.
 * Instead, it *manually* creates a new APIRequestContext and *explicitly*
 * loads the 'storageState' file (the auth file) that was created by global.setup.ts.
 * This guarantees the context is authenticated.
 */

// Define the shape of our new fixtures
type MyFixtures = {
    apiClient: ApiClient;
};

// Extend the base 'test' with our new fixture
export const test = baseTest.extend<MyFixtures>({

    /**
     * apiClient fixture setup
     * This function now runs, creates its own context, loads auth,
     * and provides the client.
     */
    apiClient: async ({}, use) => {
        // 1. Manually create a new APIRequestContext
        const apiContext = await apiRequest.newContext({
            // 2. Explicitly tell it to use the auth file
            storageState: authFile
        });
        
        // 3. Create the ApiClient using the *authenticated* context
        const apiClient = new ApiClient(apiContext);
        
        // 4. "Provide" the initialized apiClient to the tests
        await use(apiClient);

        // 5. Clean up the context after the test is done
        await apiContext.dispose();
    },
});

// We also re-export 'expect' so our tests can import both from one file.
export { expect } from '@playwright/test';