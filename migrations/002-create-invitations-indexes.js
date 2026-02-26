/**
 * Migration: Create Invitations Collection Indexes
 *
 * Creates indexes for the invitations collection to support:
 * - Fast token lookup (tokenHash)
 * - Duplicate invite prevention (email + organizationId)
 * - Organization-specific invite listing (organizationId + status)
 * - Automatic cleanup of expired invitations (TTL index on expiresAt)
 *
 * Run this migration after Phase 2 Sprint 1 implementation.
 *
 * Usage:
 *   node migrations/002-create-invitations-indexes.js
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.PLATFORM_MONGO_URI || 'mongodb://localhost:27017/automation_platform';
const DB_NAME = 'automation_platform';

async function createInvitationIndexes() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const invitationsCollection = db.collection('invitations');

    console.log('\n📊 Creating indexes for invitations collection...\n');

    // 1. Index on tokenHash for fast token lookup during validation
    console.log('1️⃣  Creating index on tokenHash...');
    await invitationsCollection.createIndex(
      { tokenHash: 1 },
      {
        name: 'tokenHash_1',
        unique: true,
        background: true
      }
    );
    console.log('   ✅ Index created: tokenHash_1 (unique)');

    // 2. Compound index on email + organizationId to prevent duplicate invites
    console.log('2️⃣  Creating compound index on email + organizationId...');
    await invitationsCollection.createIndex(
      { email: 1, organizationId: 1 },
      {
        name: 'email_1_organizationId_1',
        background: true
      }
    );
    console.log('   ✅ Index created: email_1_organizationId_1');

    // 3. Compound index on organizationId + status for listing pending invitations
    console.log('3️⃣  Creating compound index on organizationId + status...');
    await invitationsCollection.createIndex(
      { organizationId: 1, status: 1 },
      {
        name: 'organizationId_1_status_1',
        background: true
      }
    );
    console.log('   ✅ Index created: organizationId_1_status_1');

    // 4. TTL index on expiresAt for automatic cleanup of expired invitations
    console.log('4️⃣  Creating TTL index on expiresAt...');
    await invitationsCollection.createIndex(
      { expiresAt: 1 },
      {
        name: 'expiresAt_1_ttl',
        expireAfterSeconds: 0, // Delete immediately after expiration
        background: true
      }
    );
    console.log('   ✅ Index created: expiresAt_1_ttl (TTL)');

    // 5. Index on createdAt for sorting invitation lists
    console.log('5️⃣  Creating index on createdAt...');
    await invitationsCollection.createIndex(
      { createdAt: -1 },
      {
        name: 'createdAt_-1',
        background: true
      }
    );
    console.log('   ✅ Index created: createdAt_-1');

    console.log('\n✅ All invitations indexes created successfully!\n');

    // List all indexes to verify
    const indexes = await invitationsCollection.indexes();
    console.log('📋 Current indexes on invitations collection:');
    indexes.forEach((idx, i) => {
      console.log(`   ${i + 1}. ${idx.name}`);
      if (idx.key) {
        console.log(`      Keys: ${JSON.stringify(idx.key)}`);
      }
      if (idx.unique) {
        console.log(`      Unique: true`);
      }
      if (idx.expireAfterSeconds !== undefined) {
        console.log(`      TTL: ${idx.expireAfterSeconds} seconds`);
      }
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n💡 Note: The TTL index will automatically delete expired invitations.');
    console.log('   MongoDB checks TTL indexes every 60 seconds.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
createInvitationIndexes();
