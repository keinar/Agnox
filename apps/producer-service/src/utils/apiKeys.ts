/**
 * API Key Utilities
 *
 * Handles generation, hashing, and validation of API keys for CI/CD integration.
 * Keys use format: pk_live_<32-char-random>
 */

import crypto from 'crypto';
import { Db, ObjectId } from 'mongodb';
import { IUserContext } from '../middleware/auth.js';

/**
 * API Key interface for database storage
 */
export interface IApiKey {
    _id?: ObjectId;
    userId: ObjectId;
    organizationId: ObjectId;
    name: string;
    keyHash: string;
    prefix: string;
    createdAt: Date;
    lastUsed: Date | null;
}

/**
 * Result of key generation
 */
export interface IGeneratedKey {
    fullKey: string;
    hash: string;
    prefix: string;
}

/**
 * Result of key validation
 */
export interface IApiKeyValidation {
    valid: boolean;
    user?: IUserContext;
    keyId?: ObjectId;
}

const API_KEY_PREFIX = 'pk_live_';
const API_KEY_RANDOM_BYTES = 24; // 24 bytes = 32 hex chars

/**
 * Generate a new API key
 * 
 * @returns Object containing full key (show once), hash (store), and prefix (display)
 */
export function generateApiKey(): IGeneratedKey {
    const randomPart = crypto.randomBytes(API_KEY_RANDOM_BYTES).toString('hex');
    const fullKey = `${API_KEY_PREFIX}${randomPart}`;
    const hash = hashApiKey(fullKey);
    const prefix = fullKey.substring(0, 12) + '...'; // pk_live_abc...

    return {
        fullKey,
        hash,
        prefix,
    };
}

/**
 * Hash an API key using SHA-256
 * 
 * @param key - The full API key to hash
 * @returns SHA-256 hash of the key
 */
export function hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate an API key and return user context
 * 
 * @param key - The full API key to validate
 * @param db - MongoDB database instance
 * @returns Validation result with user context if valid
 */
export async function validateApiKey(key: string, db: Db): Promise<IApiKeyValidation> {
    // Validate key format
    if (!key || !key.startsWith(API_KEY_PREFIX)) {
        return { valid: false };
    }

    // Hash the provided key
    const keyHash = hashApiKey(key);

    // Find the key in the database
    const apiKeysCollection = db.collection<IApiKey>('apiKeys');
    const apiKey = await apiKeysCollection.findOne({ keyHash });

    if (!apiKey) {
        return { valid: false };
    }

    // Find the associated user
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: apiKey.userId });

    if (!user) {
        return { valid: false };
    }

    // Verify user is active and organization is valid
    if (user.status !== 'active') {
        return { valid: false };
    }

    // Build user context
    const userContext: IUserContext = {
        userId: user._id.toString(),
        email: user.email,
        organizationId: apiKey.organizationId.toString(),
        role: user.role as 'admin' | 'developer' | 'viewer',
    };

    return {
        valid: true,
        user: userContext,
        keyId: apiKey._id,
    };
}

/**
 * Update the lastUsed timestamp for an API key
 * 
 * @param keyId - The ObjectId of the API key
 * @param db - MongoDB database instance
 */
export async function updateApiKeyLastUsed(keyId: ObjectId, db: Db): Promise<void> {
    const apiKeysCollection = db.collection<IApiKey>('apiKeys');
    await apiKeysCollection.updateOne(
        { _id: keyId },
        { $set: { lastUsed: new Date() } }
    );
}

/**
 * Create a new API key for a user
 * 
 * @param userId - The user's ObjectId
 * @param organizationId - The organization's ObjectId
 * @param name - User-defined name for the key
 * @param db - MongoDB database instance
 * @returns The full key (show once) and stored key data
 */
export async function createApiKey(
    userId: ObjectId,
    organizationId: ObjectId,
    name: string,
    db: Db
): Promise<{ fullKey: string; keyData: IApiKey }> {
    const { fullKey, hash, prefix } = generateApiKey();

    const keyData: IApiKey = {
        userId,
        organizationId,
        name: name.trim() || 'Unnamed Key',
        keyHash: hash,
        prefix,
        createdAt: new Date(),
        lastUsed: null,
    };

    const apiKeysCollection = db.collection<IApiKey>('apiKeys');
    const result = await apiKeysCollection.insertOne(keyData);
    keyData._id = result.insertedId;

    return { fullKey, keyData };
}

/**
 * List all API keys for a user (without full key)
 * 
 * @param userId - The user's ObjectId
 * @param db - MongoDB database instance
 * @returns Array of API key metadata (prefix, name, dates)
 */
export async function listApiKeys(userId: ObjectId, db: Db): Promise<IApiKey[]> {
    const apiKeysCollection = db.collection<IApiKey>('apiKeys');
    return apiKeysCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
}

/**
 * Revoke (delete) an API key
 * 
 * @param keyId - The ObjectId of the key to revoke
 * @param userId - The user's ObjectId (for ownership verification)
 * @param db - MongoDB database instance
 * @returns True if key was deleted, false if not found or not owned
 */
export async function revokeApiKey(keyId: ObjectId, userId: ObjectId, db: Db): Promise<boolean> {
    const apiKeysCollection = db.collection<IApiKey>('apiKeys');
    const result = await apiKeysCollection.deleteOne({ _id: keyId, userId });
    return result.deletedCount > 0;
}

console.log('🔑 API Key utilities loaded');
