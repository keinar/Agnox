/**
 * Plan Configuration
 *
 * Defines pricing tiers, limits, and features for each subscription plan.
 * This is the single source of truth for plan details.
 */

export interface IPlanLimits {
  maxTestRuns: number;
  maxProjects: number;
  maxUsers: number;
  maxConcurrentRuns: number;
  maxStorage: number; // bytes
}

export interface IPlanFeatures {
  name: string;
  price: number;
  interval: 'month' | 'year';
  stripePriceId?: string;
  limits: IPlanLimits;
  features: {
    aiAnalysis: boolean;
    support: string;
    sso?: boolean;
    auditLogs?: boolean;
  };
}

export const PLANS: Record<string, IPlanFeatures> = {
  free: {
    name: 'Free',
    price: 0,
    interval: 'month',
    limits: {
      maxTestRuns: 100,
      maxProjects: 1,
      maxUsers: 3,
      maxConcurrentRuns: 1,
      maxStorage: 1 * 1024 * 1024 * 1024 // 1GB
    },
    features: {
      aiAnalysis: true,
      support: 'Community'
    }
  },
  team: {
    name: 'Team',
    price: 99,
    interval: 'month',
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID,
    limits: {
      maxTestRuns: 1000,
      maxProjects: 10,
      maxUsers: 20,
      maxConcurrentRuns: 5,
      maxStorage: 10 * 1024 * 1024 * 1024 // 10GB
    },
    features: {
      aiAnalysis: true,
      support: 'Email'
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 499,
    interval: 'month',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    limits: {
      maxTestRuns: 999999, // Effectively unlimited
      maxProjects: 999999,
      maxUsers: 999999,
      maxConcurrentRuns: 20,
      maxStorage: 100 * 1024 * 1024 * 1024 // 100GB
    },
    features: {
      aiAnalysis: true,
      support: 'Priority 24/7',
      sso: true, // Future feature
      auditLogs: true // Future feature
    }
  }
};

/**
 * Get plan details by name
 */
export function getPlanByName(planName: string): IPlanFeatures | null {
  return PLANS[planName] || null;
}

/**
 * Check if plan change is an upgrade
 */
export function isUpgrade(currentPlan: string, newPlan: string): boolean {
  const order = { free: 0, team: 1, enterprise: 2 };
  return (order[newPlan as keyof typeof order] || 0) > (order[currentPlan as keyof typeof order] || 0);
}

/**
 * Get formatted plan limits for display
 */
export function formatLimits(limits: IPlanLimits) {
  return {
    testRuns: limits.maxTestRuns === 999999 ? 'Unlimited' : limits.maxTestRuns.toLocaleString(),
    projects: limits.maxProjects === 999999 ? 'Unlimited' : limits.maxProjects,
    users: limits.maxUsers === 999999 ? 'Unlimited' : limits.maxUsers,
    concurrentRuns: limits.maxConcurrentRuns,
    storage: `${Math.round(limits.maxStorage / (1024 * 1024 * 1024))} GB`
  };
}
