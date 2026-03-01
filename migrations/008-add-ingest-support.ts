/**
 * Migration 008: Add Ingest Support
 *
 * Purpose:
 *   1. Backfill `source` field on the `executions` collection.
 *      All existing rows are agnox-hosted Docker runs → set to 'agnox-hosted'.
 *      New ingest-based rows will be written as 'external-ci'.
 *
 *   2. Create the `ingest_sessions` collection with:
 *      - Unique index on sessionId  (fast lookup by session)
 *      - Unique index on taskId     (prevents duplicate executions)
 *      - Compound index { organizationId, createdAt }  (per-org listing)
 *      - TTL index on createdAt (auto-purge after 7 days)
 *
 *   3. Add { organizationId, source } compound index on `executions`
 *      to support the "Source" filter in the dashboard without a collection scan.
 *
 * Run: npx tsx migrations/008-add-ingest-support.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.PLATFORM_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

async function migrate(): Promise<void> {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);

        // ── Step 1: Backfill `source` on existing executions ─────────────────
        console.log('\nStep 1: Backfilling `source: agnox-hosted` on existing executions...');

        const { modifiedCount } = await db.collection('executions').updateMany(
            { source: { $exists: false } },
            { $set: { source: 'agnox-hosted' } },
        );

        console.log(`✅ Updated ${modifiedCount} execution document(s)`);

        // ── Step 2: Create ingest_sessions collection ─────────────────────────
        console.log('\nStep 2: Creating ingest_sessions collection...');

        try {
            await db.createCollection('ingest_sessions');
            console.log('✅ Collection ingest_sessions created');
        } catch (err: any) {
            // Error code 48 = NamespaceExists — safe to ignore on re-runs
            if (err.code !== 48) throw err;
            console.log('ℹ️  ingest_sessions already exists — skipping creation');
        }

        const sessions = db.collection('ingest_sessions');

        const sessionIdx1 = await sessions.createIndex(
            { sessionId: 1 },
            { unique: true, name: 'idx_ingest_session_id' },
        );
        console.log(`✅ Created index: ${sessionIdx1}`);

        const sessionIdx2 = await sessions.createIndex(
            { taskId: 1 },
            { unique: true, name: 'idx_ingest_task_id' },
        );
        console.log(`✅ Created index: ${sessionIdx2}`);

        const sessionIdx3 = await sessions.createIndex(
            { organizationId: 1, createdAt: -1 },
            { name: 'idx_ingest_org_created' },
        );
        console.log(`✅ Created index: ${sessionIdx3}`);

        // TTL index — MongoDB automatically deletes documents 7 days after createdAt
        const sessionIdx4 = await sessions.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 604800, name: 'idx_ingest_ttl_7d' },
        );
        console.log(`✅ Created TTL index (7 days): ${sessionIdx4}`);

        // ── Step 3: Add { organizationId, source } index on executions ────────
        console.log('\nStep 3: Adding compound { organizationId, source } index on executions...');

        const execIdx = await db.collection('executions').createIndex(
            { organizationId: 1, source: 1 },
            { name: 'idx_executions_org_source' },
        );
        console.log(`✅ Created index: ${execIdx}`);

        console.log('\n✅ Migration 008 completed successfully');
        console.log('📊 ingest_sessions collection is ready');
        console.log('📊 executions.source field backfilled');

    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await client.close();
        console.log('Disconnected from MongoDB');
    }
}

migrate()
    .then(() => {
        console.log('Migration complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
