/**
 * Migration 010: Add Stability Reports Collection
 *
 * Purpose:
 *   Creates the `stability_reports` collection and indexes to support
 *   persistent history for Feature B (Flakiness & Stability Detective).
 *
 *   Indexes created:
 *     - idx_stability_org_date       : { organizationId, createdAt }
 *       Used by the history list endpoint when no groupName filter is applied.
 *     - idx_stability_org_group_date : { organizationId, groupName, createdAt }
 *       Used by GET /api/ai/stability-reports?groupName=... queries.
 *
 * Run: npx tsx migrations/010-add-stability-reports.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.PLATFORM_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME   = 'automation_platform';

async function migrate(): Promise<void> {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);

        // ── Step 1: Create stability_reports collection ───────────────────────
        console.log('\nStep 1: Creating stability_reports collection...');

        const existing = await db.listCollections({ name: 'stability_reports' }).toArray();
        if (existing.length === 0) {
            await db.createCollection('stability_reports');
            console.log('✅ Created stability_reports collection');
        } else {
            console.log('ℹ️  stability_reports already exists — skipping creation');
        }

        const col = db.collection('stability_reports');

        // ── Step 2: Create indexes ─────────────────────────────────────────────
        console.log('\nStep 2: Creating indexes on stability_reports...');

        const idx1 = await col.createIndex(
            { organizationId: 1, createdAt: -1 },
            { name: 'idx_stability_org_date' },
        );
        console.log(`✅ Created index: ${idx1}`);

        const idx2 = await col.createIndex(
            { organizationId: 1, groupName: 1, createdAt: -1 },
            { name: 'idx_stability_org_group_date' },
        );
        console.log(`✅ Created index: ${idx2}`);

        console.log('\n✅ Migration 010 completed successfully');
        console.log('📊 stability_reports collection ready for Feature B history');

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
