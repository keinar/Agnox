/**
 * Plan Limits Enforcement Middleware
 *
 * Middleware functions that check if organization has exceeded plan limits
 * before allowing actions like running tests or creating projects.
 *
 * Returns 403 Forbidden with upgrade prompt if limit exceeded.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Db } from 'mongodb';
import { checkPlanLimits } from '../utils/subscription.js';

/**
 * Middleware to check if organization can trigger new test run
 * Apply to: POST /api/executions, POST /api/execution-request
 */
export function createTestRunLimitMiddleware(db: Db) {
  return async function enforceTestRunLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const currentUser = request.user;

    if (!currentUser) {
      // User not authenticated - let auth middleware handle it
      return;
    }

    try {
      const { exceeded, used, limit } = await checkPlanLimits(
        db,
        currentUser.organizationId,
        'testRuns'
      );

      if (exceeded) {
        return reply.code(403).send({
          success: false,
          error: 'Test run limit exceeded',
          message: `Your organization has reached the monthly test run limit (${used}/${limit}). Upgrade your plan to continue testing.`,
          upgradeUrl: '/settings?tab=billing',
          usage: { used, limit, percentUsed: 100 }
        });
      }
    } catch (error: any) {
      request.log.error(`Plan limit check error: ${error.message}`);
      // Don't block request on check failure - fail open for availability
    }
  };
}

/**
 * Middleware to check if organization can create new project
 * Apply to: POST /api/projects
 */
export function createProjectLimitMiddleware(db: Db) {
  return async function enforceProjectLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const currentUser = request.user;

    if (!currentUser) {
      return;
    }

    try {
      const { exceeded, used, limit } = await checkPlanLimits(
        db,
        currentUser.organizationId,
        'projects'
      );

      if (exceeded) {
        return reply.code(403).send({
          success: false,
          error: 'Project limit exceeded',
          message: `Your organization has reached the project limit (${used}/${limit}). Upgrade your plan to create more projects.`,
          upgradeUrl: '/settings?tab=billing',
          usage: { used, limit, percentUsed: 100 }
        });
      }
    } catch (error: any) {
      request.log.error(`Plan limit check error: ${error.message}`);
    }
  };
}

/**
 * Middleware to check if organization can invite new user
 * Apply to: POST /api/invitations
 */
export function createUserLimitMiddleware(db: Db) {
  return async function enforceUserLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const currentUser = request.user;

    if (!currentUser) {
      return;
    }

    try {
      const { exceeded, used, limit } = await checkPlanLimits(
        db,
        currentUser.organizationId,
        'users'
      );

      if (exceeded) {
        return reply.code(403).send({
          success: false,
          error: 'User limit exceeded',
          message: `Your organization has reached the team member limit (${used}/${limit}). Upgrade your plan to invite more users.`,
          upgradeUrl: '/settings?tab=billing',
          usage: { used, limit, percentUsed: 100 }
        });
      }
    } catch (error: any) {
      request.log.error(`Plan limit check error: ${error.message}`);
    }
  };
}

/**
 * Check plan limit without blocking request
 * Used for warnings and analytics
 */
export async function checkPlanLimitSoft(
  db: Db,
  organizationId: string,
  limitType: 'testRuns' | 'projects' | 'users'
): Promise<{ exceeded: boolean; used: number; limit: number; percentUsed: number }> {
  try {
    const { exceeded, used, limit } = await checkPlanLimits(db, organizationId, limitType);
    const percentUsed = Math.round((used / limit) * 100);

    return { exceeded, used, limit, percentUsed };
  } catch (error) {
    // Return safe defaults on error
    return { exceeded: false, used: 0, limit: 100, percentUsed: 0 };
  }
}
