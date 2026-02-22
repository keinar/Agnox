/**
 * TestCase Model Helper
 *
 * Initializes the 'test_cases' collection indexes for the Quality Hub feature.
 * The project uses the native MongoDB driver (no Mongoose), so this module
 * acts as a thin schema layer responsible only for index management.
 *
 * Indexes:
 *  - { organizationId: 1 }              — tenant-scoped listing queries
 *  - { organizationId: 1, projectId: 1 } — the primary filter used by all routes
 */

import { Db } from 'mongodb';

export const TEST_CASES_COLLECTION = 'test_cases';

/**
 * Create collection indexes for test_cases.
 * Safe to call on every startup — MongoDB ignores no-op index creation.
 */
export async function initTestCaseCollection(db: Db): Promise<void> {
    const collection = db.collection(TEST_CASES_COLLECTION);

    await collection.createIndex({ organizationId: 1 });
    await collection.createIndex({ organizationId: 1, projectId: 1 });
}
