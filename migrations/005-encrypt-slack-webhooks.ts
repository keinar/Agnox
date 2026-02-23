/**
 * Migration 005: Encrypt legacy Slack Webhook URLs
 *
 * Purpose: Finds existing organizations with plaintext slackWebhookUrl strings
 * and encrypts them using the AES-256-GCM encryption utility.
 *
 * Run: npx tsx migrations/005-encrypt-slack-webhooks.ts
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
// @ts-ignore: Cross-project import for standalone migration
import { encrypt } from '../apps/producer-service/src/utils/encryption.js';

dotenv.config();

const MONGO_URI = process.env.PLATFORM_MONGO_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB_NAME = 'automation_platform';

async function migrate() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(DB_NAME);
        const orgsCollection = db.collection('organizations');

        // Find organizations where slackWebhookUrl is a string (plaintext)
        const orgs = await orgsCollection.find({
            slackWebhookUrl: { $type: "string" }
        }).toArray();

        console.log(`Found ${orgs.length} organization(s) with plaintext Slack Webhook URLs`);

        let modifiedCount = 0;

        for (const org of orgs) {
            if (typeof org.slackWebhookUrl === 'string' && org.slackWebhookUrl.length > 0) {
                try {
                    const encryptedUrl = encrypt(org.slackWebhookUrl);
                    await orgsCollection.updateOne(
                        { _id: org._id },
                        { $set: { slackWebhookUrl: encryptedUrl } }
                    );
                    modifiedCount++;
                } catch (err: any) {
                    console.error(`Failed to encrypt URL for org ${org._id}:`, err.message);
                }
            }
        }

        console.log(`✅ Encrypted ${modifiedCount} Slack Webhook URL(s)`);
        console.log('\n✅ Migration 005 completed successfully');

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
