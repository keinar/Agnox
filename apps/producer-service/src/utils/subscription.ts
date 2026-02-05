/**
 * Subscription Management Utilities
 *
 * Handles organization subscription updates, plan changes, and limit checking.
 * Used by webhook handlers and plan enforcement middleware.
 */

import { Db, ObjectId } from 'mongodb';
import { PLANS } from '../config/plans.js';

/**
 * Update organization after successful subscription creation/update
 * Called by Stripe webhooks when subscription is created or updated
 */
export async function updateOrganizationSubscription(
  db: Db,
  organizationId: string,
  subscription: {
    stripeSubscriptionId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    planId: string;
  }
) {
  const orgsCollection = db.collection('organizations');
  const plan = PLANS[subscription.planId];

  if (!plan) {
    throw new Error(`Invalid plan: ${subscription.planId}`);
  }

  const result = await orgsCollection.updateOne(
    { _id: new ObjectId(organizationId) },
    {
      $set: {
        plan: subscription.planId,
        limits: plan.limits,
        'billing.stripeSubscriptionId': subscription.stripeSubscriptionId,
        'billing.status': subscription.status,
        'billing.currentPeriodStart': subscription.currentPeriodStart,
        'billing.currentPeriodEnd': subscription.currentPeriodEnd,
        updatedAt: new Date()
      }
    }
  );

  return result;
}

/**
 * Cancel subscription and downgrade organization to free plan
 * Called when subscription is deleted or canceled
 */
export async function downgradeToFreePlan(
  db: Db,
  organizationId: string
) {
  const orgsCollection = db.collection('organizations');
  const freePlan = PLANS.free;

  const result = await orgsCollection.updateOne(
    { _id: new ObjectId(organizationId) },
    {
      $set: {
        plan: 'free',
        limits: freePlan.limits,
        'billing.stripeSubscriptionId': null,
        'billing.status': 'canceled',
        'billing.cancelAtPeriodEnd': false,
        updatedAt: new Date()
      }
    }
  );

  return result;
}

/**
 * Check if organization has exceeded plan limits
 * Returns usage data for a specific limit type
 */
export async function checkPlanLimits(
  db: Db,
  organizationId: string,
  limitType: 'testRuns' | 'projects' | 'users'
): Promise<{ exceeded: boolean; used: number; limit: number }> {
  const orgsCollection = db.collection('organizations');
  const org = await orgsCollection.findOne({ _id: new ObjectId(organizationId) });

  if (!org) {
    throw new Error('Organization not found');
  }

  let used = 0;
  let limit = 0;

  switch (limitType) {
    case 'testRuns':
      // Count executions in current billing period (monthly)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      used = await db.collection('executions').countDocuments({
        organizationId,
        createdAt: { $gte: startDate, $lte: endDate }
      });
      limit = org.limits?.maxTestRuns || 100;
      break;

    case 'projects':
      used = await db.collection('projects').countDocuments({ organizationId });
      limit = org.limits?.maxProjects || 1;
      break;

    case 'users':
      used = await db.collection('users').countDocuments({ organizationId });
      limit = org.limits?.maxUsers || 3;
      break;
  }

  return {
    exceeded: used >= limit,
    used,
    limit
  };
}

/**
 * Get organization's current plan details
 */
export async function getOrganizationPlan(db: Db, organizationId: string) {
  const orgsCollection = db.collection('organizations');
  const org = await orgsCollection.findOne({ _id: new ObjectId(organizationId) });

  if (!org) {
    throw new Error('Organization not found');
  }

  const planDetails = PLANS[org.plan] || PLANS.free;

  return {
    currentPlan: org.plan,
    limits: org.limits || planDetails.limits,
    billing: org.billing || null
  };
}

/**
 * Check if organization can perform action based on plan
 * Returns error message if action not allowed, null if allowed
 */
export async function canPerformAction(
  db: Db,
  organizationId: string,
  action: 'createProject' | 'runTest' | 'inviteUser'
): Promise<{ allowed: boolean; reason?: string }> {
  let limitType: 'testRuns' | 'projects' | 'users';

  switch (action) {
    case 'createProject':
      limitType = 'projects';
      break;
    case 'runTest':
      limitType = 'testRuns';
      break;
    case 'inviteUser':
      limitType = 'users';
      break;
  }

  const { exceeded, used, limit } = await checkPlanLimits(db, organizationId, limitType);

  if (exceeded) {
    return {
      allowed: false,
      reason: `${limitType} limit exceeded (${used}/${limit}). Upgrade your plan to continue.`
    };
  }

  return { allowed: true };
}
