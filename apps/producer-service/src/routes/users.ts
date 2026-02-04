/**
 * User Management Routes
 *
 * Handles user listing, role changes, and user removal with RBAC enforcement.
 *
 * Endpoints:
 * - GET /api/users - List organization users (All roles)
 * - GET /api/users/:id - Get user details (All roles)
 * - PATCH /api/users/:id/role - Change user role (Admin only)
 * - DELETE /api/users/:id - Remove user from organization (Admin only)
 *
 * Business Rules:
 * - Cannot change own role if sole admin
 * - Cannot delete self
 * - Cannot delete last admin
 * - Deleted user's data remains (executions still accessible)
 * - Returns 404 for users in other organizations (tenant isolation)
 */

import { FastifyInstance } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const DB_NAME = 'automation_platform';

/**
 * Audit log entry for user management actions
 */
interface IAuditLogEntry {
  organizationId: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, any>;
  ip?: string;
  timestamp: Date;
}

/**
 * Log audit event to database
 */
async function logAuditEvent(
  db: any,
  entry: IAuditLogEntry,
  logger: any
): Promise<void> {
  try {
    const auditLogsCollection = db.collection('audit_logs');
    await auditLogsCollection.insertOne({
      ...entry,
      timestamp: new Date()
    });

    // Also log to console for monitoring
    logger.info({
      event: 'AUDIT',
      ...entry
    });
  } catch (error) {
    logger.error('Failed to log audit event:', error);
  }
}

export async function userRoutes(app: FastifyInstance, mongoClient: MongoClient) {
  const db = mongoClient.db(DB_NAME);
  const usersCollection = db.collection('users');

  /**
   * GET /api/users
   * List all users in the organization (All roles can view)
   *
   * Response (200):
   * - success: true
   * - users: Array<{id, email, name, role, status, lastLoginAt, createdAt}>
   *
   * Errors:
   * - 401: Authentication required
   * - 500: Failed to fetch users
   */
  app.get('/api/users', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    try {
      const currentUser = request.user!;

      // Fetch all users in organization (tenant isolation)
      const users = await usersCollection
        .find({ organizationId: currentUser.organizationId })
        .sort({ createdAt: -1 })
        .toArray();

      // Transform to response format
      const userList = users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }));

      return reply.send({
        success: true,
        users: userList
      });

    } catch (error: any) {
      app.log.error(`List users error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch users',
        message: error.message
      });
    }
  });

  /**
   * GET /api/users/:id
   * Get user details (All roles can view)
   *
   * Response (200):
   * - success: true
   * - user: {id, email, name, role, status, lastLoginAt, createdAt, updatedAt}
   *
   * Errors:
   * - 400: Invalid user ID format
   * - 401: Authentication required
   * - 404: User not found (or belongs to different organization)
   * - 500: Failed to fetch user
   */
  app.get('/api/users/:id', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { id } = request.params as any;
    const currentUser = request.user!;

    try {
      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid user ID format'
        });
      }

      // Find user (with tenant isolation)
      const user = await usersCollection.findOne({
        _id: new ObjectId(id),
        organizationId: currentUser.organizationId
      });

      // Return 404 if not found (don't leak info about other orgs)
      if (!user) {
        return reply.code(404).send({
          success: false,
          error: 'User not found'
        });
      }

      // Transform to response format (exclude sensitive data)
      return reply.send({
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });

    } catch (error: any) {
      app.log.error(`Get user error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user',
        message: error.message
      });
    }
  });

  /**
   * PATCH /api/users/:id/role
   * Change user role (Admin only)
   *
   * Request Body:
   * - role: 'admin' | 'developer' | 'viewer'
   *
   * Response (200):
   * - success: true
   * - message: string
   * - user: {id, email, name, role}
   *
   * Errors:
   * - 400: Invalid user ID, invalid role, missing role
   * - 401: Authentication required
   * - 403: Not admin, cannot change own role, cannot remove last admin
   * - 404: User not found
   * - 500: Failed to update role
   */
  app.patch('/api/users/:id/role', {
    preHandler: [authMiddleware, adminOnly]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { role } = request.body as any;
    const currentUser = request.user!;

    try {
      // Validation
      if (!role) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required field',
          message: 'Role is required'
        });
      }

      // Validate role value
      if (!['admin', 'developer', 'viewer'].includes(role)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid role',
          message: 'Role must be admin, developer, or viewer'
        });
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid user ID format'
        });
      }

      // Check if trying to change own role
      if (id === currentUser.userId) {
        return reply.code(403).send({
          success: false,
          error: 'Cannot change own role',
          message: 'You cannot change your own role'
        });
      }

      // Find target user (with tenant isolation)
      const targetUser = await usersCollection.findOne({
        _id: new ObjectId(id),
        organizationId: currentUser.organizationId
      });

      if (!targetUser) {
        return reply.code(404).send({
          success: false,
          error: 'User not found'
        });
      }

      // If removing admin role, ensure at least one admin remains
      if (targetUser.role === 'admin' && role !== 'admin') {
        const adminCount = await usersCollection.countDocuments({
          organizationId: currentUser.organizationId,
          role: 'admin'
        });

        if (adminCount <= 1) {
          return reply.code(403).send({
            success: false,
            error: 'Cannot remove last admin',
            message: 'Organization must have at least one admin. Promote another user to admin first.'
          });
        }
      }

      // Update user role
      await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            role,
            updatedAt: new Date()
          }
        }
      );

      // Log audit event
      await logAuditEvent(
        db,
        {
          organizationId: currentUser.organizationId,
          userId: currentUser.userId,
          action: 'user.role_changed',
          targetType: 'user',
          targetId: id,
          details: {
            oldRole: targetUser.role,
            newRole: role,
            targetEmail: targetUser.email
          },
          ip: request.ip
        },
        app.log
      );

      app.log.info(`Role changed: ${targetUser.email} (${targetUser.role} → ${role}) by ${currentUser.userId}`);

      return reply.send({
        success: true,
        message: `User role updated to ${role}`,
        user: {
          id: targetUser._id.toString(),
          email: targetUser.email,
          name: targetUser.name,
          role
        }
      });

    } catch (error: any) {
      app.log.error(`Change role error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update role',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/users/:id
   * Remove user from organization (Admin only)
   *
   * Response (200):
   * - success: true
   * - message: string
   *
   * Errors:
   * - 400: Invalid user ID format
   * - 401: Authentication required
   * - 403: Not admin, cannot delete self, cannot delete last admin
   * - 404: User not found
   * - 500: Failed to delete user
   */
  app.delete('/api/users/:id', {
    preHandler: [authMiddleware, adminOnly]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const currentUser = request.user!;

    try {
      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid user ID format'
        });
      }

      // Check if trying to delete self
      if (id === currentUser.userId) {
        return reply.code(403).send({
          success: false,
          error: 'Cannot delete yourself',
          message: 'You cannot remove your own account. Ask another admin to do this.'
        });
      }

      // Find target user (with tenant isolation)
      const targetUser = await usersCollection.findOne({
        _id: new ObjectId(id),
        organizationId: currentUser.organizationId
      });

      if (!targetUser) {
        return reply.code(404).send({
          success: false,
          error: 'User not found'
        });
      }

      // If deleting an admin, ensure at least one admin remains
      if (targetUser.role === 'admin') {
        const adminCount = await usersCollection.countDocuments({
          organizationId: currentUser.organizationId,
          role: 'admin'
        });

        if (adminCount <= 1) {
          return reply.code(403).send({
            success: false,
            error: 'Cannot delete last admin',
            message: 'Organization must have at least one admin. Promote another user to admin first.'
          });
        }
      }

      // Delete user
      await usersCollection.deleteOne({
        _id: new ObjectId(id)
      });

      // Log audit event
      await logAuditEvent(
        db,
        {
          organizationId: currentUser.organizationId,
          userId: currentUser.userId,
          action: 'user.removed',
          targetType: 'user',
          targetId: id,
          details: {
            targetEmail: targetUser.email,
            targetRole: targetUser.role,
            targetName: targetUser.name
          },
          ip: request.ip
        },
        app.log
      );

      app.log.info(`User removed: ${targetUser.email} (${targetUser.role}) by ${currentUser.userId}`);

      // Note: User's data (executions, etc.) remains in the system
      // This is intentional for audit trail and data integrity

      return reply.send({
        success: true,
        message: `User ${targetUser.email} has been removed from the organization`
      });

    } catch (error: any) {
      app.log.error(`Remove user error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove user',
        message: error.message
      });
    }
  });

  app.log.info('✅ User management routes registered');
  app.log.info('  - GET /api/users (All roles)');
  app.log.info('  - GET /api/users/:id (All roles)');
  app.log.info('  - PATCH /api/users/:id/role (Admin only)');
  app.log.info('  - DELETE /api/users/:id (Admin only)');
}
