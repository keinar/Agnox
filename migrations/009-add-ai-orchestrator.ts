/**
 * Migration 009: Add AI Orchestrator Foundation
 *
 * Purpose:
 *   1. Backfill `aiFeatures` on every organization document that lacks it:
 *      - rootCauseAnalysis  ← migrated from legacy `aiAnalysisEnabled` flag
 *      - autoBugGeneration  ← false (new, opt-in)
 *      - flakinessDetective ← false (new, opt-in)
 *      - testOptimizer      ← false (new, opt-in)
 *      - prRouting          ← false (new, opt-in)
 *      - qualityChatbot     ← false (new, opt-in)
 *
 *   2. Backfill `aiConfig.defaultModel` = 'gemini-2.5-flash' on orgs
 *      that have no aiConfig, preserving existing behaviour.
 *
 *   3. Create a sparse index on organizations.aiConfig.defaultModel
 *      for fast model-based queries.
 *
 * NOTE: The legacy `aiAnalysisEnabled` field is NOT removed. Leaving it
 * in place ensures a code rollback can still read it without data loss.
 *
 * Run: npx tsx migrations/009-add-ai-orchestrator.ts
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
        const orgs = db.collection('organizations');

        // ── Step 1: Backfill aiFeatures on orgs that lack it ─────────────────
        console.log('\nStep 1: Backfilling aiFeatures on organizations without it...');

        const cursor = orgs.find({ aiFeatures: { $exists: false } });
        let updatedCount = 0;

        for await (const org of cursor) {
            // Migrate legacy aiAnalysisEnabled → rootCauseAnalysis.
            // If the field is absent it defaulted to true in the app, so we
            // preserve that by treating absent-or-true as true.
            const rootCauseAnalysis = org.aiAnalysisEnabled !== false;

            await orgs.updateOne(
                { _id: org._id },
                {
                    $set: {
                        aiFeatures: {
                            rootCauseAnalysis,
                            autoBugGeneration:  false,
                            flakinessDetective: false,
                            testOptimizer:      false,
                            prRouting:          false,
                            qualityChatbot:     false,
                        },
                    },
                },
            );
            updatedCount++;
        }

        console.log(`✅ Backfilled aiFeatures on ${updatedCount} organization(s)`);

        // ── Step 2: Backfill aiConfig.defaultModel on orgs without aiConfig ──
        console.log('\nStep 2: Backfilling aiConfig.defaultModel on organizations without it...');

        const { modifiedCount } = await orgs.updateMany(
            { aiConfig: { $exists: false } },
            {
                $set: {
                    'aiConfig.defaultModel': 'gemini-2.5-flash',
                    'aiConfig.updatedAt': new Date(),
                },
            },
        );

        console.log(`✅ Backfilled aiConfig on ${modifiedCount} organization(s)`);

        // ── Step 3: Sparse index on aiConfig.defaultModel ────────────────────
        console.log('\nStep 3: Creating sparse index on organizations.aiConfig.defaultModel...');

        const idxName = await orgs.createIndex(
            { 'aiConfig.defaultModel': 1 },
            { sparse: true, name: 'idx_org_ai_default_model' },
        );
        console.log(`✅ Created index: ${idxName}`);

        console.log('\n✅ Migration 009 completed successfully');
        console.log('📊 aiFeatures backfilled on all existing organizations');
        console.log('📊 aiConfig.defaultModel backfilled (gemini-2.5-flash)');
        console.log('📊 Sparse index on organizations.aiConfig.defaultModel created');

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
