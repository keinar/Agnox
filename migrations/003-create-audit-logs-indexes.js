/**
 * Migration: Create Audit Logs Collection Indexes
 *
 * Creates indexes for the audit_logs collection to support:
 * - Organization-specific audit log queries
 * - Action-based filtering
 * - User-specific audit trails
 * - Time-based log retrieval
 *
 * Run this migration after Phase 2 Sprint 1, Task 1.4 implementation.
 *
 * Usage:
 *   node migrations/003-create-audit-logs-indexes.js
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/automation_platform';
const DB_NAME = 'automation_platform';

async function createAuditLogIndexes() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const auditLogsCollection = db.collection('audit_logs');

    console.log('\n📊 Creating indexes for audit_logs collection...\n');

    // 1. Compound index on organizationId + timestamp for organization audit trails
    console.log('1️⃣  Creating compound index on organizationId + timestamp...');
    await auditLogsCollection.createIndex(
      { organizationId: 1, timestamp: -1 },
      {
        name: 'organizationId_1_timestamp_-1',
        background: true
      }
    );
    console.log('   ✅ Index created: organizationId_1_timestamp_-1');

    // 2. Compound index on action + timestamp for action-based queries
    console.log('2️⃣  Creating compound index on action + timestamp...');
    await auditLogsCollection.createIndex(
      { action: 1, timestamp: -1 },
      {
        name: 'action_1_timestamp_-1',
        background: true
      }
    );
    console.log('   ✅ Index created: action_1_timestamp_-1');

    // 3. Compound index on userId + timestamp for user audit trails
    console.log('3️⃣  Creating compound index on userId + timestamp...');
    await auditLogsCollection.createIndex(
      { userId: 1, timestamp: -1 },
      {
        name: 'userId_1_timestamp_-1',
        background: true
      }
    );
    console.log('   ✅ Index created: userId_1_timestamp_-1');

    // 4. Index on timestamp for time-based queries and sorting
    console.log('4️⃣  Creating index on timestamp...');
    await auditLogsCollection.createIndex(
      { timestamp: -1 },
      {
        name: 'timestamp_-1',
        background: true
      }
    );
    console.log('   ✅ Index created: timestamp_-1');

    // 5. Compound index on targetType + targetId for resource audit trails
    console.log('5️⃣  Creating compound index on targetType + targetId...');
    await auditLogsCollection.createIndex(
      { targetType: 1, targetId: 1, timestamp: -1 },
      {
        name: 'targetType_1_targetId_1_timestamp_-1',
        background: true
      }
    );
    console.log('   ✅ Index created: targetType_1_targetId_1_timestamp_-1');

    console.log('\n✅ All audit log indexes created successfully!\n');

    // List all indexes to verify
    const indexes = await auditLogsCollection.indexes();
    console.log('📋 Current indexes on audit_logs collection:');
    indexes.forEach((idx, i) => {
      console.log(`   ${i + 1}. ${idx.name}`);
      if (idx.key) {
        console.log(`      Keys: ${JSON.stringify(idx.key)}`);
      }
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n💡 Audit Events Being Logged:');
    console.log('   - user.invited');
    console.log('   - invitation.revoked');
    console.log('   - invitation.accepted');
    console.log('   - user.role_changed');
    console.log('   - user.removed');
    console.log('   - org.settings_updated (future)');
    console.log('   - org.ai_analysis_toggled (future)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
createAuditLogIndexes();
