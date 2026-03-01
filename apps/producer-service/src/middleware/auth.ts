/**
 * Authentication Middleware
 *
 * Handles JWT token verification and user context injection
 * for protected routes in the multi-tenant system.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';

/**
 * Public paths that do not require authentication
 */
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/register',
  '/api/auth/refresh',
  '/__webpack_hmr',
  '/health',
  '/documentation',
  '/api/ci/trigger',
  // Ingest endpoints authenticate via x-api-key inside the route preHandler,
  // identical to /api/ci/trigger. The global JWT hook must skip them here.
  '/api/ingest/',
];

/**
 * Check if a request path is public (doesn't require auth)
 */
function isPublicPath(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_PATHS.some(publicPath => url.startsWith(publicPath));
}

/**
 * User context injected into request after authentication
 */
export interface IUserContext {
  userId: string;
  email: string;
  organizationId: string;
  role: 'admin' | 'developer' | 'viewer';
}

/**
 * Extend Fastify request type to include user context
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: IUserContext;
  }
}

/**
 * Authentication middleware
 *
 * Verifies JWT token and injects user context into request.
 * Returns 401 Unauthorized if token is missing or invalid.
 * Bypasses authentication for public paths (login, signup, etc.)
 *
 * @example
 * app.get('/api/protected', { preHandler: authMiddleware }, async (request, reply) => {
 *   console.log('User ID:', request.user.userId);
 *   console.log('Organization ID:', request.user.organizationId);
 *   console.log('Role:', request.user.role);
 * });
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Bypass authentication for public paths
  if (isPublicPath(request.url)) {
    return;
  }

  // Extract token from Authorization header
  const token = extractTokenFromHeader(request.headers.authorization);

  if (!token) {
    return reply.code(401).send({
      success: false,
      error: 'Authentication required',
      message: 'No token provided in Authorization header. Please login.'
    });
  }

  // Verify token
  try {
    const payload = await verifyToken(token);

    if (!payload) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid token',
        message: 'Token is invalid or expired. Please login again.'
      });
    }

    // Inject user context into request
    request.user = {
      userId: payload.userId,
      email: payload.email,
      organizationId: payload.organizationId,
      role: payload.role as 'admin' | 'developer' | 'viewer'
    };
  } catch (err: any) {
    return reply.code(401).send({
      success: false,
      error: 'Invalid token',
      message: err.message || 'Token is invalid or expired. Please login again.'
    });
  }

  // Log authentication (optional, useful for debugging)
  if (process.env.LOG_AUTH === 'true') {
    console.log(`[AUTH] User ${request.user.userId} (${request.user.role}) from org ${request.user.organizationId}`);
  }
}

/**
 * Create API Key authentication middleware factory
 *
 * Creates middleware that supports both x-api-key header and JWT Bearer token.
 * API key is checked first, then falls back to JWT.
 *
 * @param db - MongoDB database instance
 * @returns Middleware function
 *
 * @example
 * const authWithApiKey = createApiKeyAuthMiddleware(db);
 * app.get('/api/executions', { preHandler: authWithApiKey }, handler);
 */
export function createApiKeyAuthMiddleware(db: any) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Import dynamically inside the handler to avoid circular dependency and fix Vitest
    const apiKeyUtils = await import('../utils/apiKeys.js');
    // Check for API key first
    const apiKey = request.headers['x-api-key'] as string;

    if (apiKey) {
      const validation = await apiKeyUtils.validateApiKey(apiKey, db);

      if (validation.valid && validation.user) {
        request.user = validation.user;

        // Update last used timestamp (non-blocking)
        if (validation.keyId) {
          apiKeyUtils.updateApiKeyLastUsed(validation.keyId, db).catch(() => { });
        }

        if (process.env.LOG_AUTH === 'true') {
          console.log(`[AUTH/API-KEY] User ${request.user.userId} authenticated via API key`);
        }
        return;
      }

      // Invalid API key - return 401
      return reply.code(401).send({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked.'
      });
    }

    // Fall back to JWT authentication
    const token = extractTokenFromHeader(request.headers.authorization);

    if (!token) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required',
        message: 'No API key or Bearer token provided. Use x-api-key header or Authorization: Bearer.'
      });
    }

    try {
      const payload = await verifyToken(token);

      if (!payload) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid token',
          message: 'Token is invalid or expired. Please login again.'
        });
      }

      request.user = {
        userId: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role as 'admin' | 'developer' | 'viewer'
      };
    } catch (err: any) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid token',
        message: err.message || 'Token is invalid or expired. Please login again.'
      });
    }

    if (process.env.LOG_AUTH === 'true') {
      console.log(`[AUTH/JWT] User ${request.user.userId} (${request.user.role}) from org ${request.user.organizationId}`);
    }
  };
}

/**
 * Role-based authorization middleware factory
 *
 * Creates middleware that checks if user has required role(s).
 * Must be used AFTER authMiddleware.
 *
 * @param allowedRoles - Array of roles that can access the route
 * @returns Middleware function
 *
 * @example
 * // Only admins can access
 * app.delete('/api/users/:id', {
 *   preHandler: [authMiddleware, requireRole('admin')]
 * }, async (request, reply) => {
 *   // Delete user logic
 * });
 *
 * @example
 * // Admins and developers can access
 * app.post('/api/projects', {
 *   preHandler: [authMiddleware, requireRole('admin', 'developer')]
 * }, async (request, reply) => {
 *   // Create project logic
 * });
 */
export function requireRole(...allowedRoles: Array<'admin' | 'developer' | 'viewer'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Check if user context exists (should be set by authMiddleware)
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required',
        message: 'No user context found. Ensure authMiddleware runs first.'
      });
    }

    // Check if user has required role
    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}. Your role: ${request.user.role}.`
      });
    }

    // Log authorization (optional)
    if (process.env.LOG_AUTH === 'true') {
      console.log(`[AUTHZ] User ${request.user.userId} authorized with role ${request.user.role}`);
    }
  };
}

/**
 * Admin-only middleware (convenience wrapper)
 *
 * @example
 * app.patch('/api/organizations/me', {
 *   preHandler: [authMiddleware, adminOnly]
 * }, async (request, reply) => {
 *   // Admin-only logic
 * });
 */
export const adminOnly = requireRole('admin');

/**
 * Developer or admin middleware (convenience wrapper)
 *
 * @example
 * app.post('/api/executions', {
 *   preHandler: [authMiddleware, developerOrAdmin]
 * }, async (request, reply) => {
 *   // Developer or admin logic
 * });
 */
export const developerOrAdmin = requireRole('admin', 'developer');

/**
 * Optional authentication middleware
 *
 * Injects user context if token is present, but doesn't fail if missing.
 * Useful for routes that work differently for authenticated vs anonymous users.
 *
 * @example
 * app.get('/api/public-data', {
 *   preHandler: optionalAuth
 * }, async (request, reply) => {
 *   if (request.user) {
 *     // Authenticated user - return personalized data
 *   } else {
 *     // Anonymous user - return generic data
 *   }
 * });
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractTokenFromHeader(request.headers.authorization);

  if (!token) {
    // No token provided - skip authentication
    return;
  }

  try {
    const payload = await verifyToken(token);

    if (payload) {
      // Valid token - inject user context
      request.user = {
        userId: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role as 'admin' | 'developer' | 'viewer'
      };
    }
  } catch (err) {
    // If token is invalid/revoked, we just treat them as anonymous
    return;
  }
  // Invalid token - ignore and continue without user context
}

/**
 * Verify organization ownership middleware
 *
 * Ensures that a resource (identified by organizationId in params or body)
 * belongs to the authenticated user's organization.
 *
 * @param getOrgId - Function to extract organizationId from request
 * @returns Middleware function
 *
 * @example
 * app.get('/api/projects/:id', {
 *   preHandler: [
 *     authMiddleware,
 *     verifyOrganizationOwnership(async (request, db) => {
 *       const project = await db.collection('projects').findOne({
 *         _id: new ObjectId(request.params.id)
 *       });
 *       return project?.organizationId.toString();
 *     })
 *   ]
 * }, async (request, reply) => {
 *   // User can only access projects from their organization
 * });
 */
export function verifyOrganizationOwnership(
  getOrgId: (request: FastifyRequest, db?: any) => Promise<string | undefined>
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    const resourceOrgId = await getOrgId(request);

    if (!resourceOrgId) {
      return reply.code(404).send({
        success: false,
        error: 'Resource not found'
      });
    }

    if (resourceOrgId !== request.user.organizationId) {
      // Return 404 instead of 403 to not leak information about other orgs
      return reply.code(404).send({
        success: false,
        error: 'Resource not found'
      });
    }
  };
}


console.log('🛡️  Authentication Middleware Loaded');
console.log('  - JWT verification enabled');
console.log('  - Role-based access control (admin, developer, viewer)');
console.log('  - Rate limiting available (in-memory)');
if (process.env.LOG_AUTH === 'true') {
  console.log('  - Authentication logging enabled');
}
