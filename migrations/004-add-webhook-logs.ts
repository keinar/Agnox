/**
 * Migration 004: Add Webhook Logs Collection and Indexes
 *
 * Purpose: Create webhook_logs collection with proper indexes for:
 * - Event ID lookup (prevent duplicate processing)
 * - Organization filtering
 * - Time-based queries (debugging and monitoring)
 *
 * Run: npx tsx migrations/004-add-webhook-logs.ts
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
    const webhookLogsCollection = db.collection('webhook_logs');

    // Create indexes for webhook_logs collection
    console.log('Creating indexes for webhook_logs collection...');

    // 1. Event ID index (unique) - prevent duplicate webhook processing
    const eventIdIndex = await webhookLogsCollection.createIndex(
      { eventId: 1 },
      { unique: true, name: 'idx_eventId_unique' }
    );
    console.log(`✅ Created index: ${eventIdIndex}`);

    // 2. Organization ID index - filter by organization
    const orgIdIndex = await webhookLogsCollection.createIndex(
      { organizationId: 1 },
      { name: 'idx_organizationId' }
    );
    console.log(`✅ Created index: ${orgIdIndex}`);

    // 3. Event type index - filter by event type
    const eventTypeIndex = await webhookLogsCollection.createIndex(
      { eventType: 1 },
      { name: 'idx_eventType' }
    );
    console.log(`✅ Created index: ${eventTypeIndex}`);

    // 4. Status index - filter by processing status
    const statusIndex = await webhookLogsCollection.createIndex(
      { status: 1 },
      { name: 'idx_status' }
    );
    console.log(`✅ Created index: ${statusIndex}`);

    // 5. Processed date index (descending) - recent events first
    const processedAtIndex = await webhookLogsCollection.createIndex(
      { processedAt: -1 },
      { name: 'idx_processedAt_desc' }
    );
    console.log(`✅ Created index: ${processedAtIndex}`);

    // 6. Compound index: organizationId + processedAt (common query pattern)
    const compoundIndex = await webhookLogsCollection.createIndex(
      { organizationId: 1, processedAt: -1 },
      { name: 'idx_org_processedAt' }
    );
    console.log(`✅ Created index: ${compoundIndex}`);

    // Add TTL index to auto-delete old webhook logs after 90 days
    const ttlIndex = await webhookLogsCollection.createIndex(
      { processedAt: 1 },
      {
        expireAfterSeconds: 7776000, // 90 days
        name: 'idx_processedAt_ttl'
      }
    );
    console.log(`✅ Created TTL index: ${ttlIndex} (logs expire after 90 days)`);

    console.log('\n✅ Migration 004 completed successfully');
    console.log('📊 Webhook logs collection is ready for Stripe events');

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
