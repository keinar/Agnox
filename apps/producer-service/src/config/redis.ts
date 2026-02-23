import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const redisUrl = process.env.PLATFORM_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Shared Redis client instance for the producer service.
 * Handles JWT revocation blacklists, rate limits, and cross-service communication.
 */
export const redis = new Redis(redisUrl);

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});
