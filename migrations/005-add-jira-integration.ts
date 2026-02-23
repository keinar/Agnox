/**
 * Migration 005: Add Jira Integration Schema to Organizations
 *
 * Purpose:
 *   - Initialize the `integrations` sub-document on all existing organization
 *     records that do not already have it (idempotent).
 *   - Create a sparse index on `integrations.jira.enabled` for efficient
 *     querying of orgs with an active Jira integration.
 *
 * Schema added to `organizations`:
 *   integrations: {
 *     jira?: {
 *       domain:         string   — e.g. "yourcompany.atlassian.net"
 *       email:          string   — Jira account email (lowercase)
 *       encryptedToken: string   — AES-256-GCM ciphertext (hex)
 *       iv:             string   — Initialization vector (hex)
 *       authTag:        string   — GCM authentication tag (hex)
 *       enabled:        boolean
 *       updatedAt:      Date
 *     }
 *   }
 *
 * NOTE: The token is NEVER stored in plaintext.
 *       See apps/producer-service/src/utils/encryption.ts for details.
 *
 * Run: npx tsx migrations/005-add-jira-integration.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.PLATFORM_MONGO_URI || process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

async function migrate(): Promise<void> {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const orgsCollection = db.collection('organizations');

        // ── Step 1: Initialize `integrations` on orgs that don't have it yet ──
        console.log('\nStep 1: Initialising integrations field on existing organizations...');

        const result = await orgsCollection.updateMany(
            { integrations: { $exists: false } },
            { $set: { integrations: {} } },
        );

        console.log(`✅ Updated ${result.modifiedCount} organization(s) with empty integrations field`);
        if (result.matchedCount === 0) {
            console.log('   (All organizations already have the integrations field — no changes needed)');
        }

        // ── Step 2: Create a sparse index on jira.enabled ──────────────────────
        // Sparse so documents without the sub-field are excluded from the index.
        console.log('\nStep 2: Creating index on integrations.jira.enabled...');

        const jiraEnabledIndex = await orgsCollection.createIndex(
            { 'integrations.jira.enabled': 1 },
            {
                sparse: true,
                name: 'idx_jira_enabled',
            },
        );
        console.log(`✅ Created index: ${jiraEnabledIndex}`);

        // ── Step 3: Create a sparse index on jira.domain for lookups ───────────
        console.log('\nStep 3: Creating index on integrations.jira.domain...');

        const jiraDomainIndex = await orgsCollection.createIndex(
            { 'integrations.jira.domain': 1 },
            {
                sparse: true,
                name: 'idx_jira_domain',
            },
        );
        console.log(`✅ Created index: ${jiraDomainIndex}`);

        console.log('\n✅ Migration 005 completed successfully');
        console.log('📊 Organizations collection is ready for Jira integration settings');

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
