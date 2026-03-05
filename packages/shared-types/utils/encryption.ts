/**
 * Encryption Utility — AES-256-GCM
 *
 * Used to encrypt/decrypt sensitive integration secrets (e.g. Jira API tokens)
 * before storing them in MongoDB. The plaintext is NEVER persisted.
 *
 * Required environment variable:
 *   ENCRYPTION_KEY — 64 hex characters (32 bytes)
 *   Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV for GCM

function getKey(): Buffer {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
    }
    return key;
}

export interface IEncryptedPayload {
    encrypted: string; // hex-encoded ciphertext
    iv: string;        // hex-encoded initialization vector
    authTag: string;   // hex-encoded GCM authentication tag
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * A fresh random IV is generated for every call.
 */
export function encrypt(text: string): IEncryptedPayload {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final(),
    ]);

    return {
        encrypted: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex'),
    };
}

/**
 * Decrypt a payload produced by `encrypt()`.
 * Throws if the key is wrong or the ciphertext has been tampered with (authTag mismatch).
 */
export function decrypt(payload: IEncryptedPayload): string {
    const key = getKey();
    const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(payload.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.encrypted, 'hex')),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}
