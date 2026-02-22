/**
 * TestCycle Model Helper
 *
 * Initializes the 'test_cycles' collection indexes for the Quality Hub feature.
 * The project uses the native MongoDB driver (no Mongoose), so this module
 * acts as a thin schema layer responsible only for index management.
 *
 * Indexes:
 *  - { organizationId: 1 }              — tenant-scoped listing queries
 *  - { organizationId: 1, projectId: 1 } — the primary filter used by all routes
 */

import { Db } from 'mongodb';

export const TEST_CYCLES_COLLECTION = 'test_cycles';

/**
 * Create collection indexes for test_cycles.
 * Safe to call on every startup — MongoDB ignores no-op index creation.
 */
export async function initTestCycleCollection(db: Db): Promise<void> {
    const collection = db.collection(TEST_CYCLES_COLLECTION);

    await collection.createIndex({ organizationId: 1 });
    await collection.createIndex({ organizationId: 1, projectId: 1 });
}
