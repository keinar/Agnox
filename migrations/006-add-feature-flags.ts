/**
 * Migration 006: Add Feature Flags to Organizations
 *
 * Purpose: Backfill all existing organizations that lack the `features` field,
 * defaulting both testCasesEnabled and testCyclesEnabled to true so existing
 * organizations are unaffected by the new feature-flag system.
 *
 * Run: npx tsx migrations/006-add-feature-flags.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.PLATFORM_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

async function migrate() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const orgsCollection = db.collection('organizations');

    // Backfill organizations that don't yet have the features field
    console.log('Backfilling feature flags for organizations without features field...');

    const result = await orgsCollection.updateMany(
      { features: { $exists: false } },
      {
        $set: {
          features: {
            testCasesEnabled: true,
            testCyclesEnabled: true,
          },
        },
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} organization(s) with default feature flags`);
    console.log(`   (${result.matchedCount} matched, ${result.modifiedCount} modified)`);

    console.log('\n✅ Migration 006 completed successfully');
    console.log('📊 All organizations now have testCasesEnabled and testCyclesEnabled flags');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
