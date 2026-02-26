/**
 * Migration: Add Billing Fields to Organizations
 *
 * Adds Stripe billing-related fields to all existing organizations.
 * This migration is idempotent - safe to run multiple times.
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URL = process.env.PLATFORM_MONGO_URI || 'mongodb://localhost:27017/automation_platform';

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function addBillingFields() {
  log('\n🔄 Starting migration: Add billing fields to organizations', colors.blue);

  const client = await MongoClient.connect(MONGODB_URL);

  try {
    const db = client.db();
    const orgsCollection = db.collection('organizations');

    // Count organizations that need migration
    const needsMigration = await orgsCollection.countDocuments({
      billing: { $exists: false }
    });

    if (needsMigration === 0) {
      log('✅ No organizations need migration - billing fields already exist', colors.green);
      return;
    }

    log(`Found ${needsMigration} organization(s) to migrate`, colors.blue);

    // Add billing fields to all organizations without them
    const result = await orgsCollection.updateMany(
      { billing: { $exists: false } },
      {
        $set: {
          billing: {
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            status: 'active', // active | past_due | canceled | trialing
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false
          },
          updatedAt: new Date()
        }
      }
    );

    log(`✅ Updated ${result.modifiedCount} organization(s) with billing fields`, colors.green);

    // Verify migration
    const afterCount = await orgsCollection.countDocuments({
      billing: { $exists: true }
    });

    log(`\n📊 Migration Summary:`, colors.blue);
    log(`  - Organizations updated: ${result.modifiedCount}`);
    log(`  - Total with billing fields: ${afterCount}`);
    log('\n✅ Migration completed successfully!', colors.green);

  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, colors.yellow);
    throw error;
  } finally {
    await client.close();
  }
}

// Run migration if executed directly
addBillingFields()
  .then(() => {
    log('\n✨ Migration script finished', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });

export { addBillingFields };
