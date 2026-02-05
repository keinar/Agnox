/**
 * Migration: Add Organization Support to Existing Data
 *
 * This migration transforms the single-tenant system to multi-tenant by:
 * 1. Creating organizations collection
 * 2. Creating users collection
 * 3. Creating invitations collection
 * 4. Adding organizationId to all existing executions
 * 5. Creating a default organization for existing data
 * 6. Creating a default admin user
 * 7. Adding necessary indexes
 *
 * Usage:
 *   Dry run:  ts-node migrations/001-add-organization-to-existing-data.ts --dry-run
 *   Execute:  ts-node migrations/001-add-organization-to-existing-data.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';
const DEFAULT_ORG_ID = new ObjectId();
const DEFAULT_ADMIN_PASSWORD = 'admin123'; // Change after first login!

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, colors.bright + colors.cyan);
  console.log('='.repeat(70));
}

async function migrate() {
  log(`\n🚀 Starting Migration: Add Organization Support`, colors.bright);

  if (isDryRun) {
    log('⚠️  DRY RUN MODE - No changes will be made to the database', colors.yellow);
  }

  log(`📊 Database: ${DB_NAME}`, colors.blue);
  log(`🔗 URI: ${MONGO_URI}\n`, colors.blue);

  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db(DB_NAME);

  try {
    // ========================================================================
    // STEP 1: Pre-migration verification
    // ========================================================================
    logSection('Step 1: Pre-Migration Verification');

    const existingExecutions = await db.collection('executions').countDocuments();
    log(`✓ Found ${existingExecutions} existing executions`, colors.green);

    const executionsWithOrgId = await db.collection('executions').countDocuments({
      organizationId: { $exists: true }
    });

    if (executionsWithOrgId > 0) {
      log(`⚠️  Warning: ${executionsWithOrgId} executions already have organizationId`, colors.yellow);
      log(`   This migration may have been run before.`, colors.yellow);
    }

    // ========================================================================
    // STEP 2: Create organizations collection
    // ========================================================================
    logSection('Step 2: Create Organizations Collection');

    if (!isDryRun) {
      const orgsCollection = db.collection('organizations');

      // Check if collection exists
      const collections = await db.listCollections({ name: 'organizations' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('organizations');
        log('✓ Created organizations collection', colors.green);
      } else {
        log('✓ Organizations collection already exists', colors.green);
      }

      // Create unique index on slug
      await orgsCollection.createIndex({ slug: 1 }, { unique: true });
      log('✓ Created unique index on slug', colors.green);

      // Insert default organization
      const existingOrg = await orgsCollection.findOne({ _id: DEFAULT_ORG_ID });
      if (!existingOrg) {
        await orgsCollection.insertOne({
          _id: DEFAULT_ORG_ID,
          name: 'Default Organization',
          slug: 'default-org',
          plan: 'enterprise',
          limits: {
            maxProjects: 999,
            maxTestRuns: 999999,
            maxUsers: 999,
            maxConcurrentRuns: 50
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
        log(`✓ Created default organization (ID: ${DEFAULT_ORG_ID})`, colors.green);
      } else {
        log(`✓ Default organization already exists (ID: ${DEFAULT_ORG_ID})`, colors.green);
      }
    } else {
      log('[DRY RUN] Would create organizations collection', colors.yellow);
      log(`[DRY RUN] Would create default org with ID: ${DEFAULT_ORG_ID}`, colors.yellow);
      log('[DRY RUN] Would create index on slug', colors.yellow);
    }

    // ========================================================================
    // STEP 3: Create users collection
    // ========================================================================
    logSection('Step 3: Create Users Collection');

    if (!isDryRun) {
      const usersCollection = db.collection('users');

      // Check if collection exists
      const collections = await db.listCollections({ name: 'users' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('users');
        log('✓ Created users collection', colors.green);
      } else {
        log('✓ Users collection already exists', colors.green);
      }

      // Create indexes
      await usersCollection.createIndex({ email: 1 }, { unique: true });
      log('✓ Created unique index on email', colors.green);

      await usersCollection.createIndex({ organizationId: 1 });
      log('✓ Created index on organizationId', colors.green);

      await usersCollection.createIndex({ organizationId: 1, role: 1 });
      log('✓ Created compound index on organizationId + role', colors.green);

      // Create default admin user
      const existingAdmin = await usersCollection.findOne({
        email: 'admin@default.local'
      });

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
        const adminUserId = new ObjectId();

        await usersCollection.insertOne({
          _id: adminUserId,
          email: 'admin@default.local',
          name: 'Default Admin',
          hashedPassword,
          organizationId: DEFAULT_ORG_ID,
          role: 'admin',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        log(`✓ Created default admin user`, colors.green);
        log(`  📧 Email: admin@default.local`, colors.blue);
        log(`  🔑 Password: ${DEFAULT_ADMIN_PASSWORD}`, colors.blue);
        log(`  ⚠️  IMPORTANT: Change password after first login!`, colors.red);
      } else {
        log('✓ Default admin user already exists', colors.green);
      }
    } else {
      log('[DRY RUN] Would create users collection', colors.yellow);
      log('[DRY RUN] Would create indexes on email, organizationId', colors.yellow);
      log('[DRY RUN] Would create default admin: admin@default.local', colors.yellow);
    }

    // ========================================================================
    // STEP 4: Create invitations collection
    // ========================================================================
    logSection('Step 4: Create Invitations Collection');

    if (!isDryRun) {
      const invitationsCollection = db.collection('invitations');

      // Check if collection exists
      const collections = await db.listCollections({ name: 'invitations' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('invitations');
        log('✓ Created invitations collection', colors.green);
      } else {
        log('✓ Invitations collection already exists', colors.green);
      }

      // Drop old index if exists (from pre-refactoring)
      try {
        await invitationsCollection.dropIndex('token_1');
        log('✓ Dropped old index: token_1', colors.green);
      } catch (error: any) {
        if (error.code === 27 || error.codeName === 'IndexNotFound') {
          log('  Old index token_1 not found (OK)', colors.blue);
        } else {
          log(`⚠️  Warning dropping old index: ${error.message}`, colors.yellow);
        }
      }

      // Create new indexes (using tokenHash, not token)
      await invitationsCollection.createIndex({ tokenHash: 1 }, { unique: true });
      log('✓ Created unique index on tokenHash', colors.green);

      await invitationsCollection.createIndex({ organizationId: 1, status: 1 });
      log('✓ Created compound index on organizationId + status', colors.green);

      await invitationsCollection.createIndex({ email: 1, organizationId: 1 });
      log('✓ Created compound index on email + organizationId', colors.green);
    } else {
      log('[DRY RUN] Would create invitations collection', colors.yellow);
      log('[DRY RUN] Would create indexes on token, organizationId, email', colors.yellow);
    }

    // ========================================================================
    // STEP 5: Add organizationId to existing executions
    // ========================================================================
    logSection('Step 5: Update Existing Executions');

    const executionsToUpdate = await db.collection('executions').countDocuments({
      organizationId: { $exists: false }
    });

    log(`Found ${executionsToUpdate} executions without organizationId`, colors.blue);

    if (!isDryRun) {
      if (executionsToUpdate > 0) {
        const updateResult = await db.collection('executions').updateMany(
          { organizationId: { $exists: false } },
          { $set: { organizationId: DEFAULT_ORG_ID } }
        );

        log(`✓ Updated ${updateResult.modifiedCount} executions with organizationId`, colors.green);

        if (updateResult.modifiedCount !== executionsToUpdate) {
          log(`⚠️  Warning: Expected to update ${executionsToUpdate}, but updated ${updateResult.modifiedCount}`, colors.yellow);
        }
      } else {
        log('✓ All executions already have organizationId', colors.green);
      }
    } else {
      log(`[DRY RUN] Would update ${executionsToUpdate} executions`, colors.yellow);
      log(`[DRY RUN] Would set organizationId to: ${DEFAULT_ORG_ID}`, colors.yellow);
    }

    // ========================================================================
    // STEP 6: Create indexes on executions collection
    // ========================================================================
    logSection('Step 6: Create Indexes on Executions');

    if (!isDryRun) {
      const executionsCollection = db.collection('executions');

      await executionsCollection.createIndex({ organizationId: 1 });
      log('✓ Created index on organizationId', colors.green);

      await executionsCollection.createIndex({ organizationId: 1, startTime: -1 });
      log('✓ Created compound index on organizationId + startTime (desc)', colors.green);

      await executionsCollection.createIndex({ organizationId: 1, taskId: 1 });
      log('✓ Created compound index on organizationId + taskId', colors.green);

      await executionsCollection.createIndex({ organizationId: 1, status: 1 });
      log('✓ Created compound index on organizationId + status', colors.green);
    } else {
      log('[DRY RUN] Would create 4 indexes on executions collection', colors.yellow);
    }

    // ========================================================================
    // STEP 7: Post-migration verification
    // ========================================================================
    logSection('Step 7: Post-Migration Verification');

    if (!isDryRun) {
      // Count documents in each collection
      const orgCount = await db.collection('organizations').countDocuments();
      const userCount = await db.collection('users').countDocuments();
      const invitationCount = await db.collection('invitations').countDocuments();
      const executionCount = await db.collection('executions').countDocuments();
      const executionsWithOrg = await db.collection('executions').countDocuments({
        organizationId: { $exists: true }
      });

      log(`✓ Organizations: ${orgCount}`, colors.green);
      log(`✓ Users: ${userCount}`, colors.green);
      log(`✓ Invitations: ${invitationCount}`, colors.green);
      log(`✓ Executions (total): ${executionCount}`, colors.green);
      log(`✓ Executions (with organizationId): ${executionsWithOrg}`, colors.green);

      // Verify all executions have organizationId
      if (executionCount === executionsWithOrg) {
        log('\n✅ SUCCESS: All executions have organizationId!', colors.green + colors.bright);
      } else {
        log(`\n⚠️  WARNING: ${executionCount - executionsWithOrg} executions missing organizationId`, colors.red);
      }

      // List indexes
      log('\nIndexes created:', colors.blue);
      const orgIndexes = await db.collection('organizations').indexes();
      const userIndexes = await db.collection('users').indexes();
      const invitationIndexes = await db.collection('invitations').indexes();
      const executionIndexes = await db.collection('executions').indexes();

      log(`  Organizations: ${orgIndexes.length} indexes`, colors.blue);
      log(`  Users: ${userIndexes.length} indexes`, colors.blue);
      log(`  Invitations: ${invitationIndexes.length} indexes`, colors.blue);
      log(`  Executions: ${executionIndexes.length} indexes`, colors.blue);
    } else {
      log('[DRY RUN] Would verify migration results', colors.yellow);
      log(`[DRY RUN] Expected final state:`, colors.yellow);
      log(`  - Organizations: 1`, colors.yellow);
      log(`  - Users: 1 (admin@default.local)`, colors.yellow);
      log(`  - Invitations: 0`, colors.yellow);
      log(`  - Executions with orgId: ${existingExecutions}`, colors.yellow);
    }

    // ========================================================================
    // STEP 8: Summary
    // ========================================================================
    logSection('Migration Summary');

    if (!isDryRun) {
      log('✅ Migration completed successfully!', colors.green + colors.bright);
      log('\nNext steps:', colors.blue);
      log('1. Update producer-service to use new auth middleware', colors.blue);
      log('2. Deploy updated services with JWT authentication', colors.blue);
      log('3. Change default admin password: admin@default.local', colors.blue);
      log('4. Test multi-tenant isolation', colors.blue);
    } else {
      log('✅ Dry run completed - no changes made', colors.green + colors.bright);
      log('\nTo execute migration:', colors.blue);
      log('  ts-node migrations/001-add-organization-to-existing-data.ts', colors.blue);
    }

    log('\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    log('🔌 Database connection closed\n', colors.blue);
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { migrate };
