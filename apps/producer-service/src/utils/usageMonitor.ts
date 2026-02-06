/**
 * Usage Monitoring Utility
 *
 * Monitors usage thresholds and sends alerts when limits are approached.
 *
 * Features:
 * - Real-time usage checking
 * - Threshold-based alerts (50%, 80%, 90%, 100%)
 * - Email notifications to admins
 * - Deduplication (don't spam same alert)
 */

import { Db, ObjectId } from 'mongodb';
import { sendUsageAlertEmail } from './email.js';

// ===================================================================
// Types
// ===================================================================

interface UsageThreshold {
  percentage: number;
  severity: 'info' | 'warning' | 'critical' | 'blocked';
}

const THRESHOLDS: UsageThreshold[] = [
  { percentage: 50, severity: 'info' },
  { percentage: 80, severity: 'warning' },
  { percentage: 90, severity: 'critical' },
  { percentage: 100, severity: 'blocked' }
];

// ===================================================================
// Usage Monitoring
// ===================================================================

/**
 * Check if usage alert should be sent
 *
 * Sends alert if:
 * 1. Usage just crossed a threshold (50%, 80%, 90%, 100%)
 * 2. Alert for this threshold hasn't been sent yet this period
 *
 * @param db - MongoDB database
 * @param organizationId - Organization ID
 * @param resource - Resource type (testRuns, users, storage, projects)
 */
export async function checkUsageAlerts(
  db: Db,
  organizationId: string,
  resource: 'testRuns' | 'users' | 'storage' | 'projects'
): Promise<void> {
  try {
    const orgsCollection = db.collection('organizations');
    const usersCollection = db.collection('users');

    // Get organization
    const org = await orgsCollection.findOne({ _id: new ObjectId(organizationId) });
    if (!org) return;

    // Get current usage and limits
    const { current, limit } = await getCurrentUsage(db, organizationId, resource, org);

    if (limit === 0 || limit === Infinity) return; // No limit or unlimited

    const percentage = (current / limit) * 100;

    // Check which threshold was crossed
    const crossedThreshold = THRESHOLDS.find(t => percentage >= t.percentage && percentage < t.percentage + 10);

    if (!crossedThreshold) return;

    // Check if alert already sent for this threshold
    const alertKey = `${organizationId}:${resource}:${crossedThreshold.percentage}`;
    const alertSent = await wasAlertSent(db, alertKey, org.billing?.currentPeriodStart);

    if (alertSent) return;

    // Get admin users
    const admins = await usersCollection.find({
      organizationId: new ObjectId(organizationId),
      role: 'admin',
      status: 'active'
    }).toArray();

    if (admins.length === 0) return;

    // Send alert emails to all admins
    for (const admin of admins) {
      await sendUsageAlertEmail({
        recipientEmail: admin.email,
        recipientName: admin.name,
        organizationName: org.name,
        plan: org.plan,
        resource,
        current,
        limit,
        percentage,
        severity: crossedThreshold.severity,
        upgradeUrl: `${process.env.FRONTEND_URL || 'https://automation.keinar.com'}/settings?tab=billing`
      }).catch(error => {
        console.error(`Failed to send usage alert to ${admin.email}:`, error);
      });
    }

    // Mark alert as sent
    await markAlertSent(db, alertKey);

    console.log(`✅ Usage alert sent: org=${organizationId}, resource=${resource}, ${percentage.toFixed(1)}%`);

  } catch (error: any) {
    console.error(`Error checking usage alerts:`, error);
  }
}

/**
 * Get current usage for a resource
 */
async function getCurrentUsage(
  db: Db,
  organizationId: string,
  resource: 'testRuns' | 'users' | 'storage' | 'projects',
  org: any
): Promise<{ current: number; limit: number }> {
  const executionsCollection = db.collection('executions');
  const usersCollection = db.collection('users');
  const projectsCollection = db.collection('projects');

  const limits = org.limits || {};
  const billing = org.billing || {};

  let current = 0;
  let limit = 0;

  switch (resource) {
    case 'testRuns': {
      // Count test runs in current billing period
      const periodStart = billing.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      current = await executionsCollection.countDocuments({
        organizationId: new ObjectId(organizationId),
        createdAt: { $gte: new Date(periodStart) }
      });
      limit = limits.maxTestRuns || 100;
      break;
    }

    case 'users': {
      current = await usersCollection.countDocuments({
        organizationId: new ObjectId(organizationId),
        status: 'active'
      });
      limit = limits.maxUsers || 3;
      break;
    }

    case 'projects': {
      current = await projectsCollection.countDocuments({
        organizationId: new ObjectId(organizationId)
      });
      limit = limits.maxProjects || 1;
      break;
    }

    case 'storage': {
      // Calculate storage from executions (logs + artifacts)
      const executions = await executionsCollection.find({
        organizationId: new ObjectId(organizationId)
      }).toArray();

      let totalBytes = 0;
      for (const execution of executions) {
        // Estimate log size (rough calculation)
        const logsSize = JSON.stringify(execution.logs || []).length;
        totalBytes += logsSize;
      }

      current = totalBytes / (1024 * 1024 * 1024); // Convert to GB
      limit = limits.maxStorage || 10; // Default 10GB
      break;
    }
  }

  return { current, limit };
}

/**
 * Check if alert was already sent for this threshold
 */
async function wasAlertSent(db: Db, alertKey: string, periodStart?: Date): Promise<boolean> {
  const alertsCollection = db.collection('usage_alerts');

  const periodStartDate = periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const alert = await alertsCollection.findOne({
    alertKey,
    sentAt: { $gte: periodStartDate }
  });

  return !!alert;
}

/**
 * Mark alert as sent
 */
async function markAlertSent(db: Db, alertKey: string): Promise<void> {
  const alertsCollection = db.collection('usage_alerts');

  await alertsCollection.insertOne({
    alertKey,
    sentAt: new Date()
  });
}

console.log('📊 Usage Monitor Utility Loaded');
console.log('   Thresholds: 50% (info), 80% (warning), 90% (critical), 100% (blocked)');
