/**
 * Organization Routes
 *
 * Handles organization settings, details, and usage statistics.
 *
 * Endpoints:
 * - GET /api/organization - Get organization details (All roles)
 * - PATCH /api/organization - Update organization settings (Admin only)
 * - GET /api/organization/usage - Get usage statistics (All roles)
 * - GET /api/organization/usage/alerts - Get usage alerts (All roles)
 *
 * Features:
 * - Multi-tenant isolation enforced
 * - Audit logging for settings changes
 * - Real-time usage tracking
 * - Plan limits enforcement
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { checkUsageAlerts } from '../utils/usageAlerts.js';
import { encrypt, decrypt, IEncryptedPayload } from '../utils/encryption.js';

const DB_NAME = 'automation_platform';
const REPORTS_DIR = process.env.REPORTS_DIR || path.join(process.cwd(), 'reports');

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
 * Recursively calculate the total size of all files in a directory
 *
 * @param dirPath - Path to the directory
 * @returns Total size in bytes
 */
function getDirectorySizeSync(dirPath: string): number {
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively sum subdirectory sizes
        totalSize += getDirectorySizeSync(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          totalSize += stats.size;
        } catch {
          // Skip files we can't access
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
    return 0;
  }

  return totalSize;
}

/**
 * Calculate storage usage for organization
 *
 * Scans the organization's report directory and sums the size of all files.
 *
 * @param db - Database instance (unused, kept for API compatibility)
 * @param organizationId - Organization ID
 * @returns Storage used in bytes
 */
async function calculateStorageUsage(
  db: any,
  organizationId: string
): Promise<number> {
  // Build the path to the organization's report directory
  const orgReportsDir = path.join(REPORTS_DIR, organizationId);

  // Check if the directory exists
  if (!fs.existsSync(orgReportsDir)) {
    return 0;
  }

  // Calculate total size of all files in the directory
  return getDirectorySizeSync(orgReportsDir);
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

      // Count active users (use $or to handle both string and ObjectId types)
      const userCount = await usersCollection.countDocuments({
        $or: [
          { organizationId: currentUser.organizationId },
          { organizationId: orgId }
        ]
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
          slackWebhookUrl: org.slackWebhookUrl
            ? (typeof org.slackWebhookUrl === 'object' ? 'configured' : 'configured (legacy)')
            : null,
          features: {
            testCasesEnabled: org.features?.testCasesEnabled !== false,
            testCyclesEnabled: org.features?.testCyclesEnabled !== false,
          },
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
    const { name, aiAnalysisEnabled, slackWebhookUrl } = request.body as any;
    const currentUser = request.user!;

    try {
      // Validate at least one field is provided
      if (name === undefined && aiAnalysisEnabled === undefined && slackWebhookUrl === undefined) {
        return reply.code(400).send({
          success: false,
          error: 'Missing fields',
          message: 'At least one field (name, aiAnalysisEnabled, or slackWebhookUrl) is required'
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

      // Validate and set slackWebhookUrl if provided (SECURITY_PLAN §2.3)
      if (slackWebhookUrl !== undefined) {
        if (slackWebhookUrl === null || slackWebhookUrl === '') {
          // Allow clearing the webhook URL
          updateFields.slackWebhookUrl = null;
        } else if (typeof slackWebhookUrl !== 'string') {
          return reply.code(400).send({
            success: false,
            error: 'Invalid slackWebhookUrl',
            message: 'slackWebhookUrl must be a string or null'
          });
        } else {
          // SSRF protection: strict Slack webhook URL validation
          const slackPattern = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{9,11}\/[A-Z0-9]{9,11}\/[a-zA-Z0-9]{24,}$/;
          if (!slackPattern.test(slackWebhookUrl.trim())) {
            return reply.code(400).send({
              success: false,
              error: 'Invalid slackWebhookUrl',
              message: 'Must be a valid Slack Incoming Webhook URL (hooks.slack.com/services/...)'
            });
          }

          // Encrypt before storing (defence-in-depth)
          updateFields.slackWebhookUrl = encrypt(slackWebhookUrl.trim());
        }
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
          aiAnalysisEnabled: updatedOrg?.aiAnalysisEnabled !== false,
          slackWebhookUrl: updatedOrg?.slackWebhookUrl
            ? (typeof updatedOrg.slackWebhookUrl === 'object' ? 'configured' : 'configured (legacy)')
            : null
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
   * PATCH /api/organization/features
   * Update feature flags for the organization (Admin only)
   *
   * Request Body:
   * - testCasesEnabled?: boolean
   * - testCyclesEnabled?: boolean
   *
   * Response (200):
   * - success: true
   * - features: { testCasesEnabled, testCyclesEnabled }
   *
   * Errors:
   * - 400: No valid fields / non-boolean values
   * - 401: Authentication required
   * - 403: Not admin
   * - 404: Organization not found
   * - 500: Failed to update features
   */
  app.patch('/api/organization/features', {
    preHandler: [authMiddleware, adminOnly, apiRateLimit]
  }, async (request, reply) => {
    const { testCasesEnabled, testCyclesEnabled } = request.body as any;
    const currentUser = request.user!;

    try {
      // Validate at least one field is provided
      if (testCasesEnabled === undefined && testCyclesEnabled === undefined) {
        return reply.code(400).send({
          success: false,
          error: 'Missing fields',
          message: 'At least one field (testCasesEnabled or testCyclesEnabled) is required'
        });
      }

      // Validate both are boolean if provided
      if (testCasesEnabled !== undefined && typeof testCasesEnabled !== 'boolean') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid testCasesEnabled',
          message: 'testCasesEnabled must be a boolean'
        });
      }

      if (testCyclesEnabled !== undefined && typeof testCyclesEnabled !== 'boolean') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid testCyclesEnabled',
          message: 'testCyclesEnabled must be a boolean'
        });
      }

      const orgId = new ObjectId(currentUser.organizationId);

      // Build $set payload with dot-notation keys
      const setFields: Record<string, any> = { updatedAt: new Date() };
      if (testCasesEnabled !== undefined) {
        setFields['features.testCasesEnabled'] = testCasesEnabled;
      }
      if (testCyclesEnabled !== undefined) {
        setFields['features.testCyclesEnabled'] = testCyclesEnabled;
      }

      const result = await orgsCollection.updateOne(
        { _id: orgId },
        { $set: setFields }
      );

      if (result.matchedCount === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Organization not found'
        });
      }

      // Fetch updated org to return accurate values
      const updatedOrg = await orgsCollection.findOne({ _id: orgId });

      // Audit log
      await logAuditEvent(
        db,
        {
          organizationId: currentUser.organizationId,
          userId: currentUser.userId,
          action: 'org.features_updated',
          targetType: 'organization',
          targetId: currentUser.organizationId,
          details: { changes: setFields },
          ip: request.ip
        },
        app.log
      );

      app.log.info(`Feature flags updated for org ${currentUser.organizationId}: ${JSON.stringify(setFields)}`);

      return reply.send({
        success: true,
        features: {
          testCasesEnabled: updatedOrg?.features?.testCasesEnabled !== false,
          testCyclesEnabled: updatedOrg?.features?.testCyclesEnabled !== false,
        }
      });

    } catch (error: any) {
      app.log.error(`Update organization features error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update organization features',
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

      // DEBUG: Log the query parameters
      app.log.info({
        msg: 'Usage query parameters',
        organizationId: currentUser.organizationId,
        orgIdObjectId: orgId.toString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Count executions in current month
      // Note: organizationId may be stored as string or ObjectId depending on source
      // Use $or to match both formats for consistency
      // FIXED: Use startTime field (what execution records actually store) not createdAt
      const executionCount = await executionsCollection.countDocuments({
        $or: [
          { organizationId: currentUser.organizationId },
          { organizationId: orgId }
        ],
        startTime: {
          $gte: startDate,
          $lte: endDate
        }
      });

      // DEBUG: Also count total executions (without date filter) to diagnose issues
      const totalExecutions = await executionsCollection.countDocuments({
        $or: [
          { organizationId: currentUser.organizationId },
          { organizationId: orgId }
        ]
      });

      // DEBUG: Log the results
      app.log.info({
        msg: 'Usage query results',
        organizationId: currentUser.organizationId,
        executionCountThisMonth: executionCount,
        totalExecutionsAllTime: totalExecutions
      });

      // Count active users (users collection stores organizationId as ObjectId)
      const userCount = await usersCollection.countDocuments({
        $or: [
          { organizationId: currentUser.organizationId },
          { organizationId: orgId }
        ]
      });

      // Get limits
      const testRunLimit = org.limits?.maxTestRuns || 100;
      const userLimit = org.limits?.maxUsers || 3;
      const storageLimit = org.limits?.maxStorage || (10 * 1024 * 1024 * 1024); // 10GB default

      // Calculate storage usage (placeholder)
      const storageUsed = await calculateStorageUsage(db, currentUser.organizationId);

      // Calculate percent used
      const percentUsed = Math.round((executionCount / testRunLimit) * 100);

      // Get usage alerts (warnings and critical notifications)
      const alerts = await checkUsageAlerts(db, currentUser.organizationId);

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
        },
        alerts // NEW: Include usage alerts for dashboard
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

  /**
   * GET /api/organization/usage/alerts
   * Get usage alerts for current organization (All roles can view)
   *
   * Response (200):
   * - success: true
   * - alerts: Array<{
   *     type: 'info' | 'warning' | 'critical',
   *     resource: string,
   *     message: string,
   *     percentUsed: number
   *   }>
   *
   * Errors:
   * - 401: Authentication required
   * - 500: Failed to fetch alerts
   */
  app.get('/api/organization/usage/alerts', {
    preHandler: [authMiddleware, apiRateLimit]
  }, async (request, reply) => {
    try {
      const currentUser = request.user!;

      // Get usage alerts (warnings and critical notifications)
      const alerts = await checkUsageAlerts(db, currentUser.organizationId);

      return reply.send({
        success: true,
        alerts
      });

    } catch (error: any) {
      app.log.error(`Get usage alerts error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch usage alerts',
        message: error.message
      });
    }
  });

  app.log.info('✅ Organization routes registered');
  app.log.info('  - GET /api/organization (All roles)');
  app.log.info('  - PATCH /api/organization (Admin only)');
  app.log.info('  - PATCH /api/organization/features (Admin only)');
  app.log.info('  - GET /api/organization/usage (All roles)');
  app.log.info('  - GET /api/organization/usage/alerts (All roles)');
}
