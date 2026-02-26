/**
 * Migration 007: Create projectEnvVars Collection
 *
 * Purpose:
 *   - Create indexes on the new `projectEnvVars` collection which stores
 *     per-project environment variables (e.g. BASE_URL, E2E_EMAIL).
 *   - Secret values (`isSecret: true`) are stored as AES-256-GCM encrypted
 *     payloads. Plain values are stored as-is.
 *
 * Collection schema per document:
 *   {
 *     _id:            ObjectId
 *     organizationId: string   — tenant isolation key (MANDATORY on all queries)
 *     projectId:      string   — the project this variable belongs to
 *     key:            string   — variable name, e.g. "E2E_EMAIL"
 *     value:          string | IEncryptedPayload — plaintext or encrypted object
 *     isSecret:       boolean  — if true, value is encrypted; GET endpoint returns "********"
 *     createdAt:      Date
 *     updatedAt:      Date
 *   }
 *
 * Indexes created:
 *   1. { organizationId: 1, projectId: 1 }        — efficient listing per project
 *   2. { organizationId: 1, projectId: 1, key: 1 } — unique to prevent duplicate keys
 *
 * Run: npx tsx migrations/007-add-project-env-vars.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI =
    process.env.PLATFORM_MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

async function migrate(): Promise<void> {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const envVarsCollection = db.collection('projectEnvVars');

        // ── Step 1: Compound index for per-project listing ─────────────────────
        console.log('\nStep 1: Creating compound index { organizationId, projectId }...');

        const listingIndex = await envVarsCollection.createIndex(
            { organizationId: 1, projectId: 1 },
            { name: 'idx_env_vars_org_project' },
        );
        console.log(`✅ Created index: ${listingIndex}`);

        // ── Step 2: Unique index to prevent duplicate keys per project ──────────
        console.log('\nStep 2: Creating unique index { organizationId, projectId, key }...');

        const uniqueKeyIndex = await envVarsCollection.createIndex(
            { organizationId: 1, projectId: 1, key: 1 },
            {
                unique: true,
                name: 'idx_env_vars_unique_key',
            },
        );
        console.log(`✅ Created index: ${uniqueKeyIndex}`);

        console.log('\n✅ Migration 007 completed successfully');
        console.log('📊 projectEnvVars collection is ready');
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
