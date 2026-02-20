/**
 * Migration 005 — Add execution group fields
 *
 * Adds compound indexes on `groupName` and `batchId` to the `executions`
 * collection to support efficient grouped queries introduced in Task 5.4.
 *
 * Both fields are optional on existing documents — MongoDB's flexible schema
 * means no column-add is required. The migration only creates the indexes.
 *
 * Run: npx ts-node migrations/005-add-execution-group-fields.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI =
    process.env.MONGODB_URL ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017';

const DB_NAME = 'automation_platform';

async function run(): Promise<void> {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        console.log('[005] Connected to MongoDB');

        const db = client.db(DB_NAME);
        const executions = db.collection('executions');

        // Compound index: tenant + groupName + startTime
        // Supports efficient group listing scoped to an organization.
        await executions.createIndex(
            { organizationId: 1, groupName: 1, startTime: -1 },
            { name: 'org_groupName_startTime', sparse: true }
        );
        console.log('[005] Created index: org_groupName_startTime');

        // Compound index: tenant + batchId
        // Allows fetching all runs belonging to a CI batch.
        await executions.createIndex(
            { organizationId: 1, batchId: 1 },
            { name: 'org_batchId', sparse: true }
        );
        console.log('[005] Created index: org_batchId');

        console.log('[005] Migration complete.');
    } catch (err) {
        console.error('[005] Migration failed:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

run();
