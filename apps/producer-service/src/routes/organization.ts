/**
 * Organization Routes
 *
 * Handles organization settings, details, and usage statistics.
 *
 * Endpoints:
 * - GET /api/organization - Get organization details (All roles)
 * - PATCH /api/organization - Update organization settings (Admin only)
 * - GET /api/organization/usage - Get usage statistics (All roles)
 *
 * Features:
 * - Multi-tenant isolation enforced
 * - Audit logging for settings changes
 * - Real-time usage tracking
 * - Plan limits enforcement
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const DB_NAME = 'automation_platform';

/**
 * Audit log entry for organization actions
 */
interface IAuditLogEntry {
  organizationId: string;
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ip?: string;
  timestamp?: Date;
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

    logger.info({
      event: 'AUDIT',
      ...entry
    });
  } catch (error) {
    logger.error('Failed to log audit event:', error);
  }
}

/**
 * Calculate storage usage for organization
 *
 * @param db - Database instance
 * @param organizationId - Organization ID
 * @returns Storage used in bytes
 */
async function calculateStorageUsage(
  db: any,
  organizationId: string
): Promise<number> {
  // TODO: Implement actual storage calculation
  // For now, return 0 as placeholder
  // In production, this would:
  // 1. Calculate size of report directories
  // 2. Sum artifact storage
  // 3. Count screenshot sizes
  // 4. Include log file sizes

  return 0;
}

export async function organizationRoutes(
  app: FastifyInstance,
  mongoClient: MongoClient,
  apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
) {
  const db = mongoClient.db(DB_NAME);
  const orgsCollection = db.collection('organizations');
  const usersCollection = db.collection('users');
  const executionsCollection = db.collection('executions');

  /**
   * GET /api/organization
   * Get organization details (All roles can view)
   *
   * Response (200):
   * - success: true
   * - organization: {
   *     id, name, slug, plan, limits,
   *     userCount, userLimit, aiAnalysisEnabled,
   *     createdAt, updatedAt
   *   }
   *
   * Errors:
   * - 401: Authentication required
   * - 404: Organization not found
   * - 500: Failed to fetch organization
   */
  app.get('/api/organization', {
    preHandler: [authMiddleware, apiRateLimit]
  }, async (request, reply) => {
    try {
      const currentUser = request.user!;
      const orgId = new ObjectId(currentUser.organizationId);

      // Fetch organization
      const org = await orgsCollection.findOne({ _id: orgId });

      if (!org) {
        return reply.code(404).send({
          success: false,
          error: 'Organization not found'
        });
      }

      // Count active users
      const userCount = await usersCollection.countDocuments({
        organizationId: currentUser.organizationId
      });

      // Calculate user limit
      const userLimit = org.limits?.maxUsers || (
        org.plan === 'free' ? 3 :
        org.plan === 'team' ? 20 :
        999 // enterprise
      );

      return reply.send({
        success: true,
        organization: {
          id: org._id.toString(),
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          limits: org.limits,
          userCount,
          userLimit,
          aiAnalysisEnabled: org.aiAnalysisEnabled !== false, // default: true
          createdAt: org.createdAt,
          updatedAt: org.updatedAt
        }
      });

    } catch (error: any) {
      app.log.error(`Get organization error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch organization',
        message: error.message
      });
    }
  });

  /**
   * PATCH /api/organization
   * Update organization settings (Admin only)
   *
   * Request Body:
   * - name?: string (organization name)
   * - aiAnalysisEnabled?: boolean (AI analysis toggle)
   *
   * Response (200):
   * - success: true
   * - message: string
   * - organization: {id, name, aiAnalysisEnabled}
   *
   * Errors:
   * - 400: Invalid data, empty name
   * - 401: Authentication required
   * - 403: Not admin
   * - 404: Organization not found
   * - 500: Failed to update organization
   */
  app.patch('/api/organization', {
    preHandler: [authMiddleware, adminOnly, apiRateLimit]
  }, async (request, reply) => {
    const { name, aiAnalysisEnabled } = request.body as any;
    const currentUser = request.user!;

    try {
      // Validate at least one field is provided
      if (name === undefined && aiAnalysisEnabled === undefined) {
        return reply.code(400).send({
          success: false,
          error: 'Missing fields',
          message: 'At least one field (name or aiAnalysisEnabled) is required'
        });
      }

      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid name',
            message: 'Organization name cannot be empty'
          });
        }

        if (name.trim().length < 2) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid name',
            message: 'Organization name must be at least 2 characters'
          });
        }

        if (name.trim().length > 100) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid name',
            message: 'Organization name cannot exceed 100 characters'
          });
        }
      }

      // Validate aiAnalysisEnabled if provided
      if (aiAnalysisEnabled !== undefined && typeof aiAnalysisEnabled !== 'boolean') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid aiAnalysisEnabled',
          message: 'aiAnalysisEnabled must be a boolean'
        });
      }

      const orgId = new ObjectId(currentUser.organizationId);

      // Build update object
      const updateFields: any = {
        updatedAt: new Date()
      };

      if (name !== undefined) {
        updateFields.name = name.trim();
      }

      if (aiAnalysisEnabled !== undefined) {
        updateFields.aiAnalysisEnabled = aiAnalysisEnabled;
      }

      // Update organization
      const result = await orgsCollection.updateOne(
        { _id: orgId },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Organization not found'
        });
      }

      // Get updated organization
      const updatedOrg = await orgsCollection.findOne({ _id: orgId });

      // Log audit event
      await logAuditEvent(
        db,
        {
          organizationId: currentUser.organizationId,
          userId: currentUser.userId,
          action: 'org.settings_updated',
          targetType: 'organization',
          targetId: currentUser.organizationId,
          details: {
            changes: updateFields
          },
          ip: request.ip
        },
        app.log
      );

      // If AI analysis was toggled, log specific event
      if (aiAnalysisEnabled !== undefined) {
        await logAuditEvent(
          db,
          {
            organizationId: currentUser.organizationId,
            userId: currentUser.userId,
            action: 'org.ai_analysis_toggled',
            targetType: 'organization',
            targetId: currentUser.organizationId,
            details: {
              aiAnalysisEnabled
            },
            ip: request.ip
          },
          app.log
        );

        app.log.info(`AI Analysis ${aiAnalysisEnabled ? 'enabled' : 'disabled'} for org ${currentUser.organizationId}`);
      }

      return reply.send({
        success: true,
        message: 'Organization settings updated successfully',
        organization: {
          id: updatedOrg?._id.toString(),
          name: updatedOrg?.name,
          aiAnalysisEnabled: updatedOrg?.aiAnalysisEnabled !== false
        }
      });

    } catch (error: any) {
      app.log.error(`Update organization error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update organization',
        message: error.message
      });
    }
  });

  /**
   * GET /api/organization/usage
   * Get usage statistics (All roles can view)
   *
   * Response (200):
   * - success: true
   * - usage: {
   *     currentPeriod: {startDate, endDate},
   *     testRuns: {used, limit, percentUsed},
   *     users: {active, limit},
   *     storage: {usedBytes, limitBytes}
   *   }
   *
   * Errors:
   * - 401: Authentication required
   * - 404: Organization not found
   * - 500: Failed to fetch usage
   */
  app.get('/api/organization/usage', {
    preHandler: [authMiddleware, apiRateLimit]
  }, async (request, reply) => {
    try {
      const currentUser = request.user!;
      const orgId = new ObjectId(currentUser.organizationId);

      // Fetch organization
      const org = await orgsCollection.findOne({ _id: orgId });

      if (!org) {
        return reply.code(404).send({
          success: false,
          error: 'Organization not found'
        });
      }

      // Calculate current billing period (monthly)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Count executions in current month
      const executionCount = await executionsCollection.countDocuments({
        organizationId: currentUser.organizationId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      // Count active users
      const userCount = await usersCollection.countDocuments({
        organizationId: currentUser.organizationId
      });

      // Get limits
      const testRunLimit = org.limits?.maxTestRuns || 100;
      const userLimit = org.limits?.maxUsers || 3;
      const storageLimit = org.limits?.maxStorage || (10 * 1024 * 1024 * 1024); // 10GB default

      // Calculate storage usage (placeholder)
      const storageUsed = await calculateStorageUsage(db, currentUser.organizationId);

      // Calculate percent used
      const percentUsed = Math.round((executionCount / testRunLimit) * 100);

      return reply.send({
        success: true,
        usage: {
          currentPeriod: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          testRuns: {
            used: executionCount,
            limit: testRunLimit,
            percentUsed
          },
          users: {
            active: userCount,
            limit: userLimit
          },
          storage: {
            usedBytes: storageUsed,
            limitBytes: storageLimit
          }
        }
      });

    } catch (error: any) {
      app.log.error(`Get usage error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch usage statistics',
        message: error.message
      });
    }
  });

  app.log.info('✅ Organization routes registered');
  app.log.info('  - GET /api/organization (All roles)');
  app.log.info('  - PATCH /api/organization (Admin only)');
  app.log.info('  - GET /api/organization/usage (All roles)');
}
