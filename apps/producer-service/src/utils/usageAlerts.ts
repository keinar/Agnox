/**
 * Usage Alerts System
 *
 * Monitors organization usage and generates alerts when approaching or exceeding limits.
 * Used in dashboard to show warnings and upgrade prompts.
 */

import { Db } from 'mongodb';
import { checkPlanLimits } from './subscription.js';

export interface IUsageAlert {
  type: 'testRuns' | 'projects' | 'users' | 'storage';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  action?: string;
  actionUrl?: string;
}

/**
 * Check all usage limits and return alerts
 * Returns array of alerts sorted by severity (critical first)
 */
export async function checkUsageAlerts(
  db: Db,
  organizationId: string
): Promise<IUsageAlert[]> {
  const alerts: IUsageAlert[] = [];

  // Check test runs usage
  try {
    const testRunLimits = await checkPlanLimits(db, organizationId, 'testRuns');
    const testRunPercent = testRunLimits.limit > 0
      ? (testRunLimits.used / testRunLimits.limit) * 100
      : 0;

    if (testRunPercent >= 100) {
      alerts.push({
        type: 'testRuns',
        message: `You've reached your test run limit (${testRunLimits.used}/${testRunLimits.limit}). Upgrade to continue testing.`,
        severity: 'critical',
        action: 'Upgrade Plan',
        actionUrl: '/settings?tab=billing'
      });
    } else if (testRunPercent >= 80) {
      alerts.push({
        type: 'testRuns',
        message: `You've used ${Math.round(testRunPercent)}% of your test run limit (${testRunLimits.used}/${testRunLimits.limit}).`,
        severity: 'warning',
        action: 'View Usage',
        actionUrl: '/settings?tab=usage'
      });
    } else if (testRunPercent >= 50) {
      alerts.push({
        type: 'testRuns',
        message: `You've used ${Math.round(testRunPercent)}% of your monthly test runs.`,
        severity: 'info'
      });
    }
  } catch (error) {
    // Log error but don't fail
    console.error('Failed to check test run limits:', error);
  }

  // Check users usage
  try {
    const userLimits = await checkPlanLimits(db, organizationId, 'users');
    if (userLimits.exceeded) {
      alerts.push({
        type: 'users',
        message: `You've reached your team member limit (${userLimits.used}/${userLimits.limit}). Upgrade to invite more users.`,
        severity: 'critical',
        action: 'Upgrade Plan',
        actionUrl: '/settings?tab=billing'
      });
    } else if (userLimits.used >= userLimits.limit * 0.8) {
      alerts.push({
        type: 'users',
        message: `You're using ${userLimits.used} of ${userLimits.limit} team member slots.`,
        severity: 'warning'
      });
    }
  } catch (error) {
    console.error('Failed to check user limits:', error);
  }

  // Check projects usage
  try {
    const projectLimits = await checkPlanLimits(db, organizationId, 'projects');
    if (projectLimits.exceeded) {
      alerts.push({
        type: 'projects',
        message: `You've reached your project limit (${projectLimits.used}/${projectLimits.limit}). Upgrade to create more projects.`,
        severity: 'critical',
        action: 'Upgrade Plan',
        actionUrl: '/settings?tab=billing'
      });
    } else if (projectLimits.used >= projectLimits.limit * 0.8) {
      alerts.push({
        type: 'projects',
        message: `You're using ${projectLimits.used} of ${projectLimits.limit} project slots.`,
        severity: 'warning'
      });
    }
  } catch (error) {
    console.error('Failed to check project limits:', error);
  }

  // Sort alerts by severity (critical > warning > info)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

/**
 * Get usage summary with percentages
 * Used for dashboard displays
 */
export async function getUsageSummary(db: Db, organizationId: string) {
  try {
    const [testRuns, projects, users] = await Promise.all([
      checkPlanLimits(db, organizationId, 'testRuns'),
      checkPlanLimits(db, organizationId, 'projects'),
      checkPlanLimits(db, organizationId, 'users')
    ]);

    return {
      testRuns: {
        ...testRuns,
        percentUsed: testRuns.limit > 0 ? Math.round((testRuns.used / testRuns.limit) * 100) : 0
      },
      projects: {
        ...projects,
        percentUsed: projects.limit > 0 ? Math.round((projects.used / projects.limit) * 100) : 0
      },
      users: {
        ...users,
        percentUsed: users.limit > 0 ? Math.round((users.used / users.limit) * 100) : 0
      }
    };
  } catch (error) {
    console.error('Failed to get usage summary:', error);
    throw error;
  }
}

/**
 * Check if organization should see upgrade prompt
 * Returns true if any critical alerts or usage > 80%
 */
export async function shouldShowUpgradePrompt(
  db: Db,
  organizationId: string
): Promise<boolean> {
  const alerts = await checkUsageAlerts(db, organizationId);
  return alerts.some(alert => alert.severity === 'critical' || alert.severity === 'warning');
}
