/**
 * Redis-Based Rate Limiting Middleware
 *
 * Per Security Audit Recommendation:
 * - Authenticated requests: Rate limited per-organizationId (prevents noisy neighbor problem)
 * - Unauthenticated requests: Rate limited per-IP (prevents brute force attacks)
 *
 * Benefits:
 * - Fair resource allocation across tenants
 * - Protects against DoS attacks
 * - Prevents one organization from consuming all API capacity
 * - Redis-backed for distributed rate limiting (multiple server instances)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';

/**
 * Rate limit configuration interface
 */
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis key prefix
  message?: string;      // Custom error message
}

/**
 * Rate limit configurations
 */
const rateLimits = {
  // Authentication routes (unauthenticated - limit by IP)
  auth: {
    windowMs: 60000,      // 1 minute
    maxRequests: 5,       // 5 attempts per minute
    keyPrefix: 'rl:auth:',
    message: 'Too many authentication attempts. Please try again in a moment.'
  } as RateLimitConfig,

  // General API routes (authenticated - limit by organizationId)
  api: {
    windowMs: 60000,      // 1 minute
    maxRequests: 100,     // 100 requests per minute per organization
    keyPrefix: 'rl:api:',
    message: 'API rate limit exceeded. Please try again in a moment.'
  } as RateLimitConfig,

  // High-risk routes (extra strict)
  strict: {
    windowMs: 60000,      // 1 minute
    maxRequests: 10,      // 10 requests per minute
    keyPrefix: 'rl:strict:',
    message: 'Rate limit exceeded. Please wait before trying again.'
  } as RateLimitConfig
};

/**
 * Create rate limiting middleware with Redis backend
 *
 * @param redis - Redis client instance
 * @param config - Rate limit configuration
 * @returns Fastify middleware function
 */
export function createRateLimiter(redis: Redis, config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Determine rate limit key based on authentication status
      let key: string;
      let identifier: string;

      if (request.user) {
        // AUTHENTICATED: Limit by organizationId (per-tenant isolation)
        identifier = request.user.organizationId;
        key = `${config.keyPrefix}org:${identifier}`;
      } else {
        // UNAUTHENTICATED: Limit by IP address
        identifier = request.ip;
        key = `${config.keyPrefix}ip:${identifier}`;
      }

      // Increment request count in Redis
      const requests = await redis.incr(key);

      // Set expiry on first request (TTL in milliseconds)
      if (requests === 1) {
        await redis.pexpire(key, config.windowMs);
      }

      // Check if limit exceeded
      if (requests > config.maxRequests) {
        // Get TTL to calculate retry-after
        const ttl = await redis.pttl(key);
        const retryAfter = Math.ceil(ttl / 1000);

        // Log rate limit violation
        request.log.warn({
          event: 'RATE_LIMIT_EXCEEDED',
          identifier,
          type: request.user ? 'organization' : 'ip',
          requests,
          limit: config.maxRequests,
          window: config.windowMs,
          url: request.url
        });

        return reply.code(429).send({
          success: false,
          error: 'Too Many Requests',
          message: config.message || 'Rate limit exceeded. Please try again later.',
          retryAfter: retryAfter > 0 ? retryAfter : Math.ceil(config.windowMs / 1000),
          limit: config.maxRequests,
          window: config.windowMs
        });
      }

      // Add rate limit headers to response
      const remaining = Math.max(0, config.maxRequests - requests);
      const ttl = await redis.pttl(key);
      const resetAt = Date.now() + ttl;

      reply.header('X-RateLimit-Limit', config.maxRequests.toString());
      reply.header('X-RateLimit-Remaining', remaining.toString());
      reply.header('X-RateLimit-Reset', new Date(resetAt).toISOString());

      // Log rate limit info (debug level)
      if (process.env.LOG_RATE_LIMIT === 'true') {
        request.log.debug({
          event: 'RATE_LIMIT_CHECK',
          identifier,
          type: request.user ? 'organization' : 'ip',
          requests,
          remaining,
          limit: config.maxRequests
        });
      }
    } catch (error) {
      // Redis error - log and allow request through (fail open)
      // This prevents Redis outage from blocking all traffic
      request.log.error({
        event: 'RATE_LIMIT_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: request.url
      });

      // Continue without rate limiting on error (graceful degradation)
      // In production, you might want to use a fallback (in-memory cache)
    }
  };
}

/**
 * Factory functions for specific rate limit configurations
 */

/**
 * Authentication rate limiter (for login, signup, password reset)
 * - 5 requests per minute per IP
 * - Used for unauthenticated routes to prevent brute force
 */
export function createAuthRateLimiter(redis: Redis) {
  return createRateLimiter(redis, rateLimits.auth);
}

/**
 * General API rate limiter (for authenticated routes)
 * - 100 requests per minute per organization
 * - Prevents noisy neighbor problem in multi-tenant system
 */
export function createApiRateLimiter(redis: Redis) {
  return createRateLimiter(redis, rateLimits.api);
}

/**
 * Strict rate limiter (for sensitive operations)
 * - 10 requests per minute
 * - Used for admin actions, invitations, user management
 */
export function createStrictRateLimiter(redis: Redis) {
  return createRateLimiter(redis, rateLimits.strict);
}

/**
 * Custom rate limiter factory
 *
 * @param redis - Redis client instance
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @param keyPrefix - Redis key prefix (default: 'rl:custom:')
 * @returns Rate limiting middleware
 *
 * @example
 * const customLimiter = createCustomRateLimiter(redis, 50, 60000, 'rl:reports:');
 * app.get('/api/reports', { preHandler: customLimiter }, handler);
 */
export function createCustomRateLimiter(
  redis: Redis,
  maxRequests: number,
  windowMs: number,
  keyPrefix: string = 'rl:custom:',
  message?: string
) {
  return createRateLimiter(redis, {
    windowMs,
    maxRequests,
    keyPrefix,
    message
  });
}

/**
 * Reset rate limit for a specific identifier (admin tool)
 *
 * @param redis - Redis client instance
 * @param identifier - Organization ID or IP address
 * @param type - Type of identifier ('organization' | 'ip')
 *
 * @example
 * // Reset rate limit for organization
 * await resetRateLimit(redis, 'org-123', 'organization');
 *
 * // Reset rate limit for IP
 * await resetRateLimit(redis, '192.168.1.1', 'ip');
 */
export async function resetRateLimit(
  redis: Redis,
  identifier: string,
  type: 'organization' | 'ip' = 'organization'
): Promise<void> {
  const patterns = [
    `rl:auth:${type === 'organization' ? 'org:' : 'ip:'}${identifier}`,
    `rl:api:${type === 'organization' ? 'org:' : 'ip:'}${identifier}`,
    `rl:strict:${type === 'organization' ? 'org:' : 'ip:'}${identifier}`
  ];

  for (const pattern of patterns) {
    await redis.del(pattern);
  }
}

/**
 * Get rate limit status for an identifier
 *
 * @param redis - Redis client instance
 * @param identifier - Organization ID or IP address
 * @param type - Type of identifier ('organization' | 'ip')
 * @param limitType - Rate limit type ('auth' | 'api' | 'strict')
 * @returns Rate limit status object
 */
export async function getRateLimitStatus(
  redis: Redis,
  identifier: string,
  type: 'organization' | 'ip' = 'organization',
  limitType: 'auth' | 'api' | 'strict' = 'api'
): Promise<{
  requests: number;
  limit: number;
  remaining: number;
  resetAt: Date | null;
}> {
  const config = rateLimits[limitType];
  const key = `${config.keyPrefix}${type === 'organization' ? 'org:' : 'ip:'}${identifier}`;

  const requests = await redis.get(key);
  const ttl = await redis.pttl(key);

  const requestCount = requests ? parseInt(requests, 10) : 0;
  const remaining = Math.max(0, config.maxRequests - requestCount);
  const resetAt = ttl > 0 ? new Date(Date.now() + ttl) : null;

  return {
    requests: requestCount,
    limit: config.maxRequests,
    remaining,
    resetAt
  };
}

console.log('🛡️  Redis-Based Rate Limiter Loaded');
console.log('  - Per-organization rate limiting for authenticated requests');
console.log('  - Per-IP rate limiting for unauthenticated requests');
console.log('  - Auth routes: 5 requests/minute');
console.log('  - API routes: 100 requests/minute per org');
console.log('  - Strict routes: 10 requests/minute');
if (process.env.LOG_RATE_LIMIT === 'true') {
  console.log('  - Rate limit logging enabled');
}
