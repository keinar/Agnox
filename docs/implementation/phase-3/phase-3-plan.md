# Phase 3 Implementation Plan
## Billing Integration with Stripe

**Version:** 1.0
**Date:** February 5, 2026
**Estimated Duration:** 5-7 days
**Prerequisites:** Phase 1 & 2 Complete ✅

---

## Executive Summary

Phase 3 focuses on **Billing Integration** using Stripe for subscription management. This enables monetization through tiered pricing plans (Free, Team, Enterprise) with automated billing, usage enforcement, and customer self-service.

### Goals
- ✨ Stripe subscription integration (Checkout + Webhooks)
- ✨ Three pricing tiers (Free, Team, Enterprise)
- ✨ Payment checkout flow
- ✨ Usage limits enforcement (already done - enhance)
- ✨ Billing dashboard in Settings page
- ✨ Webhook handling for subscription lifecycle events
- ✨ Payoneer integration for Israeli bank account

### Context: Israel + Payoneer + Stripe Setup
For Israeli businesses, the typical setup is:
1. **Stripe account** - Accepts payments from customers worldwide
2. **Payoneer account** - Acts as your receiving bank account
3. **Connection** - Stripe sends payouts to your Payoneer US bank details

**Setup Steps** (before coding):
1. Create Stripe account (or use existing)
2. Create Payoneer account with US receiving account
3. Add Payoneer US bank details to Stripe as payout destination
4. Enable Stripe Checkout and Customer Portal in dashboard
5. Create products and price IDs (see "Stripe Setup" section below)

---

## Phase 3 Sprints Overview

| Sprint | Focus | Duration | Tasks |
|--------|-------|----------|-------|
| Sprint 1 | Stripe Setup & API Integration | 1-2 days | 6 tasks |
| Sprint 2 | Subscription Management Backend | 1-2 days | 5 tasks |
| Sprint 3 | Webhook Handling | 1 day | 4 tasks |
| Sprint 4 | Billing Dashboard UI | 2 days | 6 tasks |
| Sprint 5 | Testing & Launch Prep | 1 day | 4 tasks |

**Total: 25 tasks across 5 sprints**

---

## Pricing Tiers

Based on PRD specifications:

| Feature | Free | Team | Enterprise |
|---------|------|------|------------|
| **Price** | $0/month | $99/month | $499/month |
| **Test Runs** | 100/month | 1,000/month | Unlimited |
| **Projects** | 1 | 10 | Unlimited |
| **Team Members** | 3 | 20 | Unlimited |
| **Concurrent Runs** | 1 | 5 | 20 |
| **AI Analysis** | ✅ | ✅ | ✅ |
| **Support** | Community | Email | Priority 24/7 |
| **SSO** | ❌ | ❌ | ✅ (Future) |
| **Audit Logs** | ❌ | ❌ | ✅ (Future) |

---

## Stripe Setup Requirements

### Products to Create in Stripe Dashboard

1. **Team Plan**
   - Product Name: "Agnostic Automation Center - Team Plan"
   - Description: "1,000 test runs/month, 10 projects, 20 users"
   - Pricing: $99/month recurring
   - **Save Price ID:** `price_team_monthly_XXXXX`

2. **Enterprise Plan**
   - Product Name: "Agnostic Automation Center - Enterprise Plan"
   - Description: "Unlimited runs, projects, and users"
   - Pricing: $499/month recurring
   - **Save Price ID:** `price_enterprise_monthly_XXXXX`

3. **Optional: Annual Billing** (20% discount per PRD)
   - Team Annual: $950/year (`price_team_yearly_XXXXX`)
   - Enterprise Annual: $4,800/year (`price_enterprise_yearly_XXXXX`)

### Stripe Configuration

**Enable in Stripe Dashboard:**
- ✅ Stripe Checkout
- ✅ Customer Portal (for subscription management)
- ✅ Webhooks (configure in Sprint 3)
- ✅ Test mode (for development)

**API Keys Needed:**
- `STRIPE_SECRET_KEY` (sk_test_... for dev, sk_live_... for prod)
- `STRIPE_PUBLISHABLE_KEY` (pk_test_... or pk_live_...)
- `STRIPE_WEBHOOK_SECRET` (whsec_... - created when configuring webhook endpoint)

**Price IDs Needed** (copy from Stripe Dashboard):
```bash
STRIPE_TEAM_PRICE_ID=price_team_monthly_XXXXX
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_monthly_XXXXX
```

---

## Sprint 1: Stripe Setup & API Integration

### Task 1.1: Install Stripe SDK & Setup Environment

**Install Dependencies:**
```bash
cd apps/producer-service
npm install stripe
```

**Environment Variables:**

Add to `docker-compose.yml` (producer service):
```yaml
environment:
  # Existing vars...

  # Stripe Configuration
  STRIPE_SECRET_KEY: sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
  STRIPE_PUBLISHABLE_KEY: pk_test_XXXXXXXXXXXXXXXXXXXX
  STRIPE_WEBHOOK_SECRET: whsec_XXXXXXXXXXXXXXXXXXXXXXXXX
  STRIPE_TEAM_PRICE_ID: price_team_monthly_XXXXX
  STRIPE_ENTERPRISE_PRICE_ID: price_enterprise_monthly_XXXXX
```

**File:** `apps/producer-service/src/config/stripe.ts`

```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia', // Latest API version
  typescript: true
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  priceIds: {
    team: process.env.STRIPE_TEAM_PRICE_ID || '',
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || ''
  }
};
```

---

### Task 1.2: Update Organization Schema for Billing

**Database Migration Script:**

**File:** `migrations/003-add-billing-fields.ts`

```typescript
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/automation_platform';

async function addBillingFields() {
  const client = await MongoClient.connect(MONGODB_URL);
  const db = client.db();
  const orgsCollection = db.collection('organizations');

  console.log('Adding billing fields to organizations...');

  // Add billing fields to all organizations
  const result = await orgsCollection.updateMany(
    { billing: { $exists: false } },
    {
      $set: {
        billing: {
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          status: 'active', // active | past_due | canceled | trialing
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false
        },
        updatedAt: new Date()
      }
    }
  );

  console.log(`✅ Updated ${result.modifiedCount} organizations with billing fields`);

  await client.close();
}

addBillingFields()
  .then(() => {
    console.log('Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

export { addBillingFields };
```

**Run Migration:**
```bash
npx tsx migrations/003-add-billing-fields.ts
```

**Updated Organization Schema:**
```typescript
interface IOrganization {
  _id: ObjectId;
  name: string;
  slug: string;
  plan: 'free' | 'team' | 'enterprise';
  limits: {
    maxTestRuns: number;
    maxProjects: number;
    maxUsers: number;
    maxConcurrentRuns: number;
    maxStorage: number;
  };
  billing: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: 'active' | 'past_due' | 'canceled' | 'trialing';
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };
  aiAnalysisEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### Task 1.3: Create Plan Configuration Module

**File:** `apps/producer-service/src/config/plans.ts`

```typescript
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
      maxTestRuns: 999999,
      maxProjects: 999999,
      maxUsers: 999999,
      maxConcurrentRuns: 20,
      maxStorage: 100 * 1024 * 1024 * 1024 // 100GB
    },
    features: {
      aiAnalysis: true,
      support: 'Priority 24/7',
      sso: true,
      auditLogs: true
    }
  }
};

export function getPlanByName(planName: string): IPlanFeatures | null {
  return PLANS[planName] || null;
}

export function isUpgrade(currentPlan: string, newPlan: string): boolean {
  const order = { free: 0, team: 1, enterprise: 2 };
  return (order[newPlan as keyof typeof order] || 0) > (order[currentPlan as keyof typeof order] || 0);
}
```

---

### Task 1.4: Create Billing Routes - Plans List

**File:** `apps/producer-service/src/routes/billing.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { stripe, STRIPE_CONFIG } from '../config/stripe.js';
import { PLANS } from '../config/plans.js';

const DB_NAME = 'automation_platform';

export async function billingRoutes(
  app: FastifyInstance,
  mongoClient: MongoClient,
  apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
) {
  const db = mongoClient.db(DB_NAME);
  const orgsCollection = db.collection('organizations');

  /**
   * GET /api/billing/plans
   * Get available subscription plans (Public endpoint)
   *
   * Response (200):
   * - success: true
   * - plans: Array of plan details
   */
  app.get('/api/billing/plans', {
    preHandler: [apiRateLimit]
  }, async (request, reply) => {
    try {
      const plans = Object.entries(PLANS).map(([id, plan]) => ({
        id,
        name: plan.name,
        price: plan.price,
        interval: plan.interval,
        features: {
          maxTestRuns: plan.limits.maxTestRuns === 999999 ? 'Unlimited' : plan.limits.maxTestRuns,
          maxProjects: plan.limits.maxProjects === 999999 ? 'Unlimited' : plan.limits.maxProjects,
          maxUsers: plan.limits.maxUsers === 999999 ? 'Unlimited' : plan.limits.maxUsers,
          maxConcurrentRuns: plan.limits.maxConcurrentRuns,
          aiAnalysis: plan.features.aiAnalysis,
          support: plan.features.support,
          sso: plan.features.sso || false,
          auditLogs: plan.features.auditLogs || false
        }
      }));

      return reply.send({
        success: true,
        plans
      });

    } catch (error: any) {
      app.log.error(`Get plans error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch plans',
        message: error.message
      });
    }
  });

  app.log.info('✅ Billing routes registered (partial)');
}
```

---

### Task 1.5: Create Checkout Session Endpoint

**Add to billing routes:**

```typescript
/**
 * POST /api/billing/checkout
 * Create Stripe Checkout session for plan upgrade (Admin only)
 *
 * Request Body:
 * - planId: 'team' | 'enterprise'
 *
 * Response (200):
 * - success: true
 * - sessionId: string (Stripe session ID)
 * - checkoutUrl: string (redirect URL)
 *
 * Errors:
 * - 400: Invalid plan, already on plan, or downgrade attempt
 * - 401: Authentication required
 * - 403: Not admin
 * - 500: Failed to create checkout session
 */
app.post('/api/billing/checkout', {
  preHandler: [authMiddleware, adminOnly, apiRateLimit]
}, async (request, reply) => {
  const { planId } = request.body as any;
  const currentUser = request.user!;

  try {
    // Validate plan
    if (!planId || !['team', 'enterprise'].includes(planId)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid plan',
        message: 'Plan must be "team" or "enterprise"'
      });
    }

    const plan = PLANS[planId];
    if (!plan.stripePriceId) {
      return reply.code(400).send({
        success: false,
        error: 'Plan not available',
        message: 'This plan is not configured for checkout'
      });
    }

    // Fetch organization
    const orgId = new ObjectId(currentUser.organizationId);
    const org = await orgsCollection.findOne({ _id: orgId });

    if (!org) {
      return reply.code(404).send({
        success: false,
        error: 'Organization not found'
      });
    }

    // Check if already on this plan
    if (org.plan === planId) {
      return reply.code(400).send({
        success: false,
        error: 'Already on this plan',
        message: `Your organization is already on the ${plan.name} plan`
      });
    }

    // Create or retrieve Stripe customer
    let customerId = org.billing?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: currentUser.email,
        metadata: {
          organizationId: currentUser.organizationId,
          organizationName: org.name
        }
      });
      customerId = customer.id;

      // Save customer ID
      await orgsCollection.updateOne(
        { _id: orgId },
        { $set: { 'billing.stripeCustomerId': customerId } }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings?tab=billing&success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings?tab=billing&canceled=true`,
      metadata: {
        organizationId: currentUser.organizationId,
        planId
      }
    });

    app.log.info(`Checkout session created for org ${currentUser.organizationId}: ${session.id}`);

    return reply.send({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url
    });

  } catch (error: any) {
    app.log.error(`Create checkout error: ${error?.message || error}`);
    return reply.code(500).send({
      success: false,
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});
```

---

### Task 1.6: Create Customer Portal Endpoint

**Add to billing routes:**

```typescript
/**
 * GET /api/billing/portal
 * Get Stripe Customer Portal URL for subscription management (Admin only)
 *
 * Response (200):
 * - success: true
 * - portalUrl: string (redirect URL)
 *
 * Errors:
 * - 400: No active subscription
 * - 401: Authentication required
 * - 403: Not admin
 * - 500: Failed to create portal session
 */
app.get('/api/billing/portal', {
  preHandler: [authMiddleware, adminOnly, apiRateLimit]
}, async (request, reply) => {
  const currentUser = request.user!;

  try {
    // Fetch organization
    const orgId = new ObjectId(currentUser.organizationId);
    const org = await orgsCollection.findOne({ _id: orgId });

    if (!org) {
      return reply.code(404).send({
        success: false,
        error: 'Organization not found'
      });
    }

    // Check if customer exists
    if (!org.billing?.stripeCustomerId) {
      return reply.code(400).send({
        success: false,
        error: 'No subscription',
        message: 'Your organization does not have an active subscription'
      });
    }

    // Create Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: org.billing.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/settings?tab=billing`
    });

    return reply.send({
      success: true,
      portalUrl: session.url
    });

  } catch (error: any) {
    app.log.error(`Create portal error: ${error?.message || error}`);
    return reply.code(500).send({
      success: false,
      error: 'Failed to create portal session',
      message: error.message
    });
  }
});
```

---

## Sprint 2: Subscription Management Backend

### Task 2.1: Implement Subscription Update Logic

**File:** `apps/producer-service/src/utils/subscription.ts`

```typescript
import { Db, ObjectId } from 'mongodb';
import { PLANS } from '../config/plans.js';

/**
 * Update organization after successful subscription creation/update
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
 * Cancel subscription and downgrade to free plan
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
      // Count executions in current billing period
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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
```

---

### Task 2.2: Add Plan Enforcement Middleware

**File:** `apps/producer-service/src/middleware/planLimits.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { Db } from 'mongodb';
import { checkPlanLimits } from '../utils/subscription.js';

/**
 * Middleware to check if organization can trigger new test run
 */
export async function enforceTestRunLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  db: Db
) {
  const currentUser = request.user!;

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
        upgradeUrl: '/settings?tab=billing'
      });
    }
  } catch (error: any) {
    request.log.error(`Plan limit check error: ${error.message}`);
    // Don't block request on check failure
  }
}

/**
 * Middleware to check if organization can create new project
 */
export async function enforceProjectLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  db: Db
) {
  const currentUser = request.user!;

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
        upgradeUrl: '/settings?tab=billing'
      });
    }
  } catch (error: any) {
    request.log.error(`Plan limit check error: ${error.message}`);
  }
}
```

**Apply to Routes:**

```typescript
// In apps/producer-service/src/routes/executions.ts
app.post('/api/executions', {
  preHandler: [
    authMiddleware,
    requireRole(['admin', 'developer']),
    (req, res) => enforceTestRunLimit(req, res, db), // Add this
    apiRateLimit
  ]
}, createExecutionHandler);

// In apps/producer-service/src/routes/projects.ts
app.post('/api/projects', {
  preHandler: [
    authMiddleware,
    requireRole(['admin', 'developer']),
    (req, res) => enforceProjectLimit(req, res, db), // Add this
    apiRateLimit
  ]
}, createProjectHandler);
```

---

### Task 2.3: Create Billing Info Endpoint

**Add to billing routes:**

```typescript
/**
 * GET /api/billing/subscription
 * Get current subscription details (Admin only)
 *
 * Response (200):
 * - success: true
 * - subscription: {
 *     plan: string,
 *     status: string,
 *     currentPeriodStart: string,
 *     currentPeriodEnd: string,
 *     cancelAtPeriodEnd: boolean,
 *     nextBillingDate: string
 *   }
 */
app.get('/api/billing/subscription', {
  preHandler: [authMiddleware, adminOnly, apiRateLimit]
}, async (request, reply) => {
  const currentUser = request.user!;

  try {
    const orgId = new ObjectId(currentUser.organizationId);
    const org = await orgsCollection.findOne({ _id: orgId });

    if (!org) {
      return reply.code(404).send({
        success: false,
        error: 'Organization not found'
      });
    }

    const plan = PLANS[org.plan] || PLANS.free;

    // If on paid plan, fetch latest Stripe subscription data
    let stripeSubscription = null;
    if (org.billing?.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          org.billing.stripeSubscriptionId
        );
      } catch (error) {
        app.log.error('Failed to fetch Stripe subscription:', error);
      }
    }

    return reply.send({
      success: true,
      subscription: {
        plan: org.plan,
        planName: plan.name,
        price: plan.price,
        status: org.billing?.status || 'active',
        currentPeriodStart: org.billing?.currentPeriodStart || null,
        currentPeriodEnd: org.billing?.currentPeriodEnd || null,
        cancelAtPeriodEnd: org.billing?.cancelAtPeriodEnd || false,
        nextBillingDate: stripeSubscription?.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : null
      }
    });

  } catch (error: any) {
    app.log.error(`Get subscription error: ${error?.message || error}`);
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch subscription',
      message: error.message
    });
  }
});
```

---

### Task 2.4: Add Usage Alerts

**Create notification system:**

**File:** `apps/producer-service/src/utils/usageAlerts.ts`

```typescript
import { Db } from 'mongodb';
import { checkPlanLimits } from './subscription.js';

export async function checkUsageAlerts(
  db: Db,
  organizationId: string
): Promise<Array<{ type: string; message: string; severity: 'warning' | 'critical' }>> {
  const alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical' }> = [];

  // Check test runs usage
  const testRunLimits = await checkPlanLimits(db, organizationId, 'testRuns');
  const testRunPercent = (testRunLimits.used / testRunLimits.limit) * 100;

  if (testRunPercent >= 100) {
    alerts.push({
      type: 'testRuns',
      message: `You've reached your test run limit (${testRunLimits.used}/${testRunLimits.limit}). Upgrade to continue testing.`,
      severity: 'critical'
    });
  } else if (testRunPercent >= 80) {
    alerts.push({
      type: 'testRuns',
      message: `You've used ${testRunPercent.toFixed(0)}% of your test run limit (${testRunLimits.used}/${testRunLimits.limit}).`,
      severity: 'warning'
    });
  }

  // Check users usage
  const userLimits = await checkPlanLimits(db, organizationId, 'users');
  if (userLimits.exceeded) {
    alerts.push({
      type: 'users',
      message: `You've reached your team member limit (${userLimits.used}/${userLimits.limit}). Upgrade to invite more users.`,
      severity: 'critical'
    });
  }

  // Check projects usage
  const projectLimits = await checkPlanLimits(db, organizationId, 'projects');
  if (projectLimits.exceeded) {
    alerts.push({
      type: 'projects',
      message: `You've reached your project limit (${projectLimits.used}/${projectLimits.limit}). Upgrade to create more projects.`,
      severity: 'critical'
    });
  }

  return alerts;
}
```

**Add to organization/usage endpoint:**

```typescript
// In organization.ts - GET /api/organization/usage
// Add this before return:
const alerts = await checkUsageAlerts(db, currentUser.organizationId);

return reply.send({
  success: true,
  usage: { /* existing usage data */ },
  alerts // Add alerts to response
});
```

---

### Task 2.5: Implement Cancel Subscription

**Add to billing routes:**

```typescript
/**
 * POST /api/billing/cancel
 * Cancel subscription at end of billing period (Admin only)
 *
 * Response (200):
 * - success: true
 * - message: string
 *
 * Errors:
 * - 400: No active subscription
 * - 401: Authentication required
 * - 403: Not admin
 * - 500: Failed to cancel subscription
 */
app.post('/api/billing/cancel', {
  preHandler: [authMiddleware, adminOnly, apiRateLimit]
}, async (request, reply) => {
  const currentUser = request.user!;

  try {
    const orgId = new ObjectId(currentUser.organizationId);
    const org = await orgsCollection.findOne({ _id: orgId });

    if (!org || !org.billing?.stripeSubscriptionId) {
      return reply.code(400).send({
        success: false,
        error: 'No active subscription',
        message: 'Your organization does not have an active subscription to cancel'
      });
    }

    // Cancel subscription at period end (don't cancel immediately)
    await stripe.subscriptions.update(org.billing.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update organization
    await orgsCollection.updateOne(
      { _id: orgId },
      {
        $set: {
          'billing.cancelAtPeriodEnd': true,
          updatedAt: new Date()
        }
      }
    );

    app.log.info(`Subscription canceled for org ${currentUser.organizationId}`);

    return reply.send({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period'
    });

  } catch (error: any) {
    app.log.error(`Cancel subscription error: ${error?.message || error}`);
    return reply.code(500).send({
      success: false,
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
});
```

---

## Sprint 3: Webhook Handling

### Task 3.1: Create Webhook Endpoint

**File:** `apps/producer-service/src/routes/webhooks.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient } from 'mongodb';
import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG } from '../config/stripe.js';
import { updateOrganizationSubscription, downgradeToFreePlan } from '../utils/subscription.js';

const DB_NAME = 'automation_platform';

export async function webhookRoutes(
  app: FastifyInstance,
  mongoClient: MongoClient
) {
  const db = mongoClient.db(DB_NAME);

  /**
   * POST /api/webhooks/stripe
   * Handle Stripe webhook events
   *
   * IMPORTANT: This endpoint does NOT use standard middleware
   * - No authentication (verified via Stripe signature)
   * - No JSON parsing (need raw body for signature verification)
   */
  app.post('/api/webhooks/stripe', {
    config: {
      // Get raw body for signature verification
      rawBody: true
    }
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;

    if (!signature) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    try {
      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(
        request.rawBody!,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      app.log.info(`Webhook received: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, db, app);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db, app);
          break;

        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice, db, app);
          break;

        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.Invoice, db, app);
          break;

        default:
          app.log.info(`Unhandled webhook event: ${event.type}`);
      }

      return reply.send({ received: true });

    } catch (error: any) {
      app.log.error(`Webhook error: ${error?.message || error}`);
      return reply.code(400).send({
        error: 'Webhook signature verification failed',
        message: error.message
      });
    }
  });

  app.log.info('✅ Webhook routes registered');
}

/**
 * Handle subscription creation/update
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  db: any,
  app: FastifyInstance
) {
  const organizationId = subscription.metadata.organizationId;
  const planId = subscription.metadata.planId || 'team';

  if (!organizationId) {
    app.log.error('No organizationId in subscription metadata');
    return;
  }

  await updateOrganizationSubscription(db, organizationId, {
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    planId
  });

  app.log.info(`Subscription updated for org ${organizationId}: ${planId}`);
}

/**
 * Handle subscription deletion (cancelation)
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: any,
  app: FastifyInstance
) {
  const organizationId = subscription.metadata.organizationId;

  if (!organizationId) {
    app.log.error('No organizationId in subscription metadata');
    return;
  }

  await downgradeToFreePlan(db, organizationId);

  app.log.info(`Subscription canceled for org ${organizationId}, downgraded to free plan`);
}

/**
 * Handle successful payment (reset usage counters)
 */
async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  db: any,
  app: FastifyInstance
) {
  // Payment succeeded - subscription is active
  const customerId = invoice.customer as string;

  const orgsCollection = db.collection('organizations');
  const org = await orgsCollection.findOne({ 'billing.stripeCustomerId': customerId });

  if (!org) {
    app.log.error(`No organization found for customer ${customerId}`);
    return;
  }

  // Update billing status to active
  await orgsCollection.updateOne(
    { _id: org._id },
    {
      $set: {
        'billing.status': 'active',
        updatedAt: new Date()
      }
    }
  );

  app.log.info(`Payment succeeded for org ${org._id.toString()}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  db: any,
  app: FastifyInstance
) {
  const customerId = invoice.customer as string;

  const orgsCollection = db.collection('organizations');
  const org = await orgsCollection.findOne({ 'billing.stripeCustomerId': customerId });

  if (!org) {
    app.log.error(`No organization found for customer ${customerId}`);
    return;
  }

  // Mark as past_due
  await orgsCollection.updateOne(
    { _id: org._id },
    {
      $set: {
        'billing.status': 'past_due',
        updatedAt: new Date()
      }
    }
  );

  app.log.warn(`Payment failed for org ${org._id.toString()}`);

  // TODO: Send email notification to admin
}
```

---

### Task 3.2: Configure Fastify for Raw Body

**Update producer service setup:**

**File:** `apps/producer-service/src/index.ts`

```typescript
// Add raw body support for webhooks
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body as string);
    // Store raw body for webhook verification
    req.rawBody = body as string;
    done(null, json);
  } catch (error: any) {
    error.statusCode = 400;
    done(error, undefined);
  }
});
```

**Update TypeScript types:**

**File:** `apps/producer-service/src/types/fastify.d.ts` (create if doesn't exist)

```typescript
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}
```

---

### Task 3.3: Register Webhook in Stripe Dashboard

**Manual Setup Steps:**

1. **Go to Stripe Dashboard** → Developers → Webhooks
2. **Click "Add endpoint"**
3. **Endpoint URL:** `https://automation.keinar.com/api/webhooks/stripe`
   - For testing: Use ngrok or similar to expose localhost
4. **Select events to listen to:**
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
5. **Copy webhook signing secret** → Add to `STRIPE_WEBHOOK_SECRET` env var
6. **Test webhook** using Stripe CLI:
   ```bash
   stripe trigger customer.subscription.created
   ```

---

### Task 3.4: Add Webhook Logging

**Create webhook log collection:**

```typescript
// In webhook handlers, log all events
const webhookLogsCollection = db.collection('webhook_logs');

await webhookLogsCollection.insertOne({
  eventId: event.id,
  eventType: event.type,
  organizationId: subscription.metadata.organizationId || null,
  data: event.data.object,
  processedAt: new Date(),
  success: true
});
```

**Benefits:**
- Audit trail of all billing events
- Debugging webhook processing issues
- Reconciliation with Stripe dashboard

---

## Sprint 4: Billing Dashboard UI

### Task 4.1: Create Billing Tab Component

**File:** `apps/dashboard-client/src/components/settings/BillingTab.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { useBilling } from '../../hooks/useBilling';
import { useAuth } from '../../hooks/useAuth';

export function BillingTab() {
  const { user, organization } = useAuth();
  const { subscription, plans, loading, createCheckout, openPortal } = useBilling();
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const isAdmin = user.role === 'admin';
  const currentPlan = plans.find(p => p.id === organization.plan);

  const handleUpgrade = async (planId: string) => {
    if (!isAdmin) return;

    setLoadingCheckout(true);
    try {
      const { checkoutUrl } = await createCheckout(planId);
      window.location.href = checkoutUrl;
    } catch (error) {
      alert('Failed to create checkout session');
      setLoadingCheckout(false);
    }
  };

  const handleManageBilling = async () => {
    if (!isAdmin) return;

    try {
      const { portalUrl } = await openPortal();
      window.location.href = portalUrl;
    } catch (error) {
      alert('Failed to open billing portal');
    }
  };

  if (loading) {
    return <div>Loading billing information...</div>;
  }

  return (
    <div className="billing-tab">
      {/* Current Plan Section */}
      <section className="current-plan">
        <h2>Current Plan</h2>
        <div className="plan-card active">
          <h3>{currentPlan?.name || 'Free'}</h3>
          <div className="price">
            ${currentPlan?.price || 0}
            <span className="interval">/month</span>
          </div>

          {subscription?.cancelAtPeriodEnd && (
            <div className="alert warning">
              Your subscription will be canceled on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}

          {isAdmin && organization.plan !== 'free' && (
            <button onClick={handleManageBilling} className="btn-secondary">
              Manage Billing
            </button>
          )}
        </div>

        {subscription && (
          <div className="billing-details">
            <p><strong>Status:</strong> {subscription.status}</p>
            <p><strong>Next billing date:</strong> {new Date(subscription.nextBillingDate).toLocaleDateString()}</p>
          </div>
        )}
      </section>

      {/* Available Plans Section */}
      <section className="available-plans">
        <h2>Available Plans</h2>
        <div className="plans-grid">
          {plans.map(plan => {
            const isCurrent = plan.id === organization.plan;
            const canUpgrade = isAdmin && !isCurrent && ['team', 'enterprise'].includes(plan.id);

            return (
              <div key={plan.id} className={`plan-card ${isCurrent ? 'current' : ''}`}>
                <h3>{plan.name}</h3>
                <div className="price">
                  ${plan.price}
                  <span className="interval">/{plan.interval}</span>
                </div>

                <ul className="features">
                  <li>
                    {typeof plan.features.maxTestRuns === 'number'
                      ? `${plan.features.maxTestRuns.toLocaleString()} test runs/month`
                      : 'Unlimited test runs'}
                  </li>
                  <li>
                    {typeof plan.features.maxProjects === 'number'
                      ? `${plan.features.maxProjects} projects`
                      : 'Unlimited projects'}
                  </li>
                  <li>
                    {typeof plan.features.maxUsers === 'number'
                      ? `${plan.features.maxUsers} team members`
                      : 'Unlimited team members'}
                  </li>
                  <li>{plan.features.maxConcurrentRuns} concurrent runs</li>
                  {plan.features.aiAnalysis && <li>AI-powered analysis</li>}
                  <li>{plan.features.support} support</li>
                  {plan.features.sso && <li>SSO integration</li>}
                  {plan.features.auditLogs && <li>Audit logs</li>}
                </ul>

                {isCurrent ? (
                  <button disabled className="btn-primary">Current Plan</button>
                ) : canUpgrade ? (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loadingCheckout}
                    className="btn-primary"
                  >
                    {loadingCheckout ? 'Loading...' : 'Upgrade'}
                  </button>
                ) : plan.id === 'free' ? (
                  <button disabled className="btn-secondary">Downgrade via billing portal</button>
                ) : (
                  <button disabled className="btn-secondary">Admin only</button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

---

### Task 4.2: Create Billing Hook

**File:** `apps/dashboard-client/src/hooks/useBilling.ts`

```typescript
import { useState, useEffect } from 'react';
import { api } from '../utils/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: {
    maxTestRuns: number | string;
    maxProjects: number | string;
    maxUsers: number | string;
    maxConcurrentRuns: number;
    aiAnalysis: boolean;
    support: string;
    sso?: boolean;
    auditLogs?: boolean;
  };
}

interface Subscription {
  plan: string;
  planName: string;
  price: number;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  nextBillingDate: string | null;
}

export function useBilling() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);

      // Fetch plans (public endpoint)
      const plansResponse = await api.get('/api/billing/plans');
      setPlans(plansResponse.data.plans);

      // Fetch subscription (admin only)
      try {
        const subResponse = await api.get('/api/billing/subscription');
        setSubscription(subResponse.data.subscription);
      } catch (subError: any) {
        // User might not be admin or no subscription exists
        if (subError.response?.status !== 403) {
          console.error('Failed to fetch subscription:', subError);
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async (planId: string) => {
    const response = await api.post('/api/billing/checkout', { planId });
    return response.data;
  };

  const openPortal = async () => {
    const response = await api.get('/api/billing/portal');
    return response.data;
  };

  return {
    plans,
    subscription,
    loading,
    error,
    createCheckout,
    openPortal,
    refresh: loadBillingData
  };
}
```

---

### Task 4.3: Update Settings Page with Billing Tab

**File:** `apps/dashboard-client/src/pages/Settings.tsx`

```tsx
import { BillingTab } from '../components/settings/BillingTab';

// Add to tab list:
<nav className="tabs">
  <button onClick={() => setActiveTab('members')}>Members</button>
  <button onClick={() => setActiveTab('organization')}>Organization</button>
  <button onClick={() => setActiveTab('security')}>Security</button>
  <button onClick={() => setActiveTab('billing')}>Billing</button>
  <button onClick={() => setActiveTab('usage')}>Usage</button>
</nav>

// Add to tab content:
{activeTab === 'billing' && <BillingTab />}
```

---

### Task 4.4: Add Billing Alerts to Dashboard

**File:** `apps/dashboard-client/src/components/Dashboard.tsx`

```tsx
import { useUsage } from '../hooks/useSettings';

export function Dashboard() {
  const { usage } = useUsage();

  return (
    <div className="dashboard">
      {/* Show usage alerts if critical */}
      {usage?.alerts?.filter(a => a.severity === 'critical').map((alert, i) => (
        <div key={i} className="alert alert-danger">
          {alert.message}
          <a href="/settings?tab=billing">Upgrade Plan</a>
        </div>
      ))}

      {/* Rest of dashboard */}
    </div>
  );
}
```

---

### Task 4.5: Style Billing Components

**File:** `apps/dashboard-client/src/styles/billing.css`

```css
.billing-tab {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.current-plan {
  margin-bottom: 3rem;
}

.plan-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 1rem;
}

.plan-card.active,
.plan-card.current {
  border-color: #4CAF50;
  background-color: #f1f8f4;
}

.price {
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  margin: 1rem 0;
}

.price .interval {
  font-size: 1rem;
  font-weight: normal;
  color: #666;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.features {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0;
}

.features li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.features li:before {
  content: "✓ ";
  color: #4CAF50;
  font-weight: bold;
  margin-right: 0.5rem;
}

.billing-details {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.alert.warning {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
}

.alert.danger {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background-color: #45a049;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ccc;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e0e0e0;
}
```

---

### Task 4.6: Handle Checkout Success/Cancel

**File:** `apps/dashboard-client/src/pages/Settings.tsx`

```tsx
import { useSearchParams } from 'react-router-dom';

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (success) {
      // Show success message
      alert('Subscription upgraded successfully!');
      // Clear query params
      setSearchParams({});
    }

    if (canceled) {
      // Show cancelation message
      alert('Checkout canceled. Your subscription was not changed.');
      // Clear query params
      setSearchParams({});
    }
  }, [success, canceled]);

  // Rest of Settings component...
}
```

---

## Sprint 5: Testing & Launch Prep

### Task 5.1: Create Billing Integration Tests

**File:** `tests/billing.test.ts`

```typescript
import axios from 'axios';
import Stripe from 'stripe';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});

/**
 * Test: Fetch available plans (public endpoint)
 */
async function testFetchPlans() {
  const response = await axios.get(`${API_URL}/api/billing/plans`);

  console.assert(response.status === 200, 'Expected 200 OK');
  console.assert(response.data.success === true, 'Expected success: true');
  console.assert(Array.isArray(response.data.plans), 'Expected plans array');
  console.assert(response.data.plans.length === 3, 'Expected 3 plans');

  const planIds = response.data.plans.map((p: any) => p.id);
  console.assert(planIds.includes('free'), 'Expected free plan');
  console.assert(planIds.includes('team'), 'Expected team plan');
  console.assert(planIds.includes('enterprise'), 'Expected enterprise plan');

  console.log('✅ Test passed: Fetch plans');
}

/**
 * Test: Create checkout session (admin only)
 */
async function testCreateCheckout(adminToken: string, orgId: string) {
  const response = await axios.post(
    `${API_URL}/api/billing/checkout`,
    { planId: 'team' },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  console.assert(response.status === 200, 'Expected 200 OK');
  console.assert(response.data.success === true, 'Expected success: true');
  console.assert(typeof response.data.sessionId === 'string', 'Expected sessionId');
  console.assert(response.data.checkoutUrl.startsWith('https://checkout.stripe.com'), 'Expected Stripe URL');

  console.log('✅ Test passed: Create checkout session');
  return response.data.sessionId;
}

/**
 * Test: Non-admin cannot create checkout
 */
async function testNonAdminCheckout(developerToken: string) {
  try {
    await axios.post(
      `${API_URL}/api/billing/checkout`,
      { planId: 'team' },
      { headers: { Authorization: `Bearer ${developerToken}` } }
    );
    console.error('❌ Test failed: Non-admin should not be able to create checkout');
  } catch (error: any) {
    console.assert(error.response?.status === 403, 'Expected 403 Forbidden');
    console.log('✅ Test passed: Non-admin cannot create checkout');
  }
}

/**
 * Test: Plan enforcement - exceeding test run limit
 */
async function testPlanEnforcement(userToken: string, orgId: string) {
  // Simulate reaching limit by manually updating org
  // (In real scenario, this would be triggered by running 100 tests)

  // Try to run test when at limit
  try {
    await axios.post(
      `${API_URL}/api/executions`,
      { /* test data */ },
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    console.error('❌ Test failed: Should block execution when limit reached');
  } catch (error: any) {
    console.assert(error.response?.status === 403, 'Expected 403 Forbidden');
    console.assert(error.response?.data.error === 'Test run limit exceeded', 'Expected limit error');
    console.log('✅ Test passed: Plan enforcement works');
  }
}

/**
 * Test: Webhook signature verification
 */
async function testWebhookSignature() {
  // Create test event
  const event = stripe.webhooks.generateTestHeaderString({
    payload: JSON.stringify({ type: 'customer.subscription.created' }),
    secret: process.env.STRIPE_WEBHOOK_SECRET || ''
  });

  // Send webhook
  try {
    const response = await axios.post(
      `${API_URL}/api/webhooks/stripe`,
      { type: 'customer.subscription.created' },
      { headers: { 'stripe-signature': event } }
    );

    console.assert(response.status === 200, 'Expected 200 OK');
    console.log('✅ Test passed: Webhook signature verification');
  } catch (error: any) {
    console.error('❌ Test failed: Webhook signature verification', error.response?.data);
  }
}

// Run all tests
async function runBillingTests() {
  console.log('🧪 Running Billing Integration Tests...\n');

  try {
    await testFetchPlans();

    // Note: These tests require actual user tokens and org IDs
    // In production tests, create test users first
    // await testCreateCheckout(ADMIN_TOKEN, ORG_ID);
    // await testNonAdminCheckout(DEVELOPER_TOKEN);
    // await testPlanEnforcement(USER_TOKEN, ORG_ID);
    // await testWebhookSignature();

    console.log('\n✅ All billing tests passed!');
  } catch (error) {
    console.error('\n❌ Billing tests failed:', error);
    process.exit(1);
  }
}

runBillingTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { runBillingTests };
```

---

### Task 5.2: Test Stripe Integration in Test Mode

**Testing Checklist:**

1. **Test Checkout Flow:**
   - ✅ Create checkout session
   - ✅ Complete payment with test card (4242 4242 4242 4242)
   - ✅ Verify webhook received
   - ✅ Verify organization upgraded to Team plan
   - ✅ Verify limits updated

2. **Test Card Numbers (Stripe test mode):**
   - Success: `4242 4242 4242 4242`
   - Declined: `4000 0000 0000 0002`
   - Insufficient funds: `4000 0000 0000 9995`
   - 3D Secure required: `4000 0027 6000 3184`

3. **Test Webhooks:**
   - ✅ Use Stripe CLI to trigger webhooks:
     ```bash
     stripe trigger customer.subscription.created
     stripe trigger invoice.payment_succeeded
     stripe trigger invoice.payment_failed
     ```
   - ✅ Verify organization updates in database

4. **Test Customer Portal:**
   - ✅ Open customer portal
   - ✅ Update payment method
   - ✅ Cancel subscription
   - ✅ Verify cancellation webhook

---

### Task 5.3: Update Documentation

**Files to Update:**

1. **README.md** - Add billing section:

```markdown
## 💳 Billing Integration

The platform uses Stripe for subscription management with three pricing tiers:

- **Free:** $0/month - 100 test runs, 1 project, 3 users
- **Team:** $99/month - 1,000 runs, 10 projects, 20 users
- **Enterprise:** $499/month - Unlimited runs, projects, users

### Setup (Development)

1. Create Stripe account (test mode)
2. Create products and price IDs in Stripe Dashboard
3. Add environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_TEAM_PRICE_ID=price_...
   STRIPE_ENTERPRISE_PRICE_ID=price_...
   ```
4. Configure webhook endpoint in Stripe Dashboard
5. Test with Stripe test cards

### Payoneer Integration (Production)

For Israeli businesses:
1. Create Payoneer account with US receiving account
2. Add Payoneer bank details to Stripe as payout destination
3. Stripe will send payouts to your Payoneer account
```

2. **Create Billing Guide:**

**File:** `docs/BILLING.md`

```markdown
# Billing System Guide

## Overview

The Agnostic Automation Center uses Stripe for subscription billing. This document explains the billing flow, webhook handling, and plan management.

## Plans

### Free Plan
- **Price:** $0/month
- **Limits:** 100 test runs, 1 project, 3 users
- **Support:** Community
- **Default plan** for all new organizations

### Team Plan
- **Price:** $99/month
- **Limits:** 1,000 test runs, 10 projects, 20 users
- **Support:** Email
- **Target:** Small to medium teams

### Enterprise Plan
- **Price:** $499/month
- **Limits:** Unlimited
- **Support:** Priority 24/7
- **Target:** Large organizations with high testing needs

## Checkout Flow

1. Admin clicks "Upgrade" button in Billing tab
2. Backend creates Stripe Checkout session
3. User redirected to Stripe-hosted checkout page
4. User enters payment information
5. Stripe processes payment
6. Stripe sends webhook to our server
7. Server updates organization plan and limits
8. User redirected back to dashboard

## Webhooks

### Events Handled

- `customer.subscription.created` - New subscription started
- `customer.subscription.updated` - Plan changed or payment method updated
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Successful payment, reset usage counters
- `invoice.payment_failed` - Failed payment, mark organization as past_due

### Webhook Security

All webhooks are verified using Stripe signature verification:
```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

## Plan Enforcement

Limits are enforced at API level using middleware:

- **Test Runs:** Checked before triggering execution
- **Projects:** Checked before creating project
- **Users:** Checked before sending invitation

When limit exceeded, API returns 403 error with upgrade prompt.

## Testing

Use Stripe test mode for development:
- Test card: 4242 4242 4242 4242
- Use Stripe CLI to trigger webhooks
- Check webhook logs in dashboard

## Production Setup

1. Switch Stripe to live mode
2. Update environment variables with live keys
3. Configure webhook endpoint with live URL
4. Test with real card (refund immediately)
5. Monitor webhook logs for issues
```

3. **Update Environment Variables:**

**File:** `.env.example`

```bash
# Stripe Billing (Phase 3)
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_TEAM_PRICE_ID=price_team_monthly_XXXXX
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_monthly_XXXXX
FRONTEND_URL=http://localhost:8080
```

---

### Task 5.4: Launch Preparation Checklist

**Pre-Launch Checklist:**

**Stripe Configuration:**
- [ ] Switch from test mode to live mode
- [ ] Create live products and price IDs
- [ ] Update environment variables with live keys
- [ ] Configure live webhook endpoint
- [ ] Set up Payoneer for payouts (Israeli account)
- [ ] Enable Customer Portal
- [ ] Configure email receipts in Stripe

**Code Readiness:**
- [ ] All billing routes tested
- [ ] Webhooks verified with test events
- [ ] Plan enforcement working
- [ ] UI flows complete (upgrade, cancel, portal)
- [ ] Error handling robust
- [ ] Logging comprehensive

**Database:**
- [ ] Billing fields added to all organizations
- [ ] Migration script tested on staging
- [ ] Indexes created for performance

**Documentation:**
- [ ] README updated with billing info
- [ ] Billing guide created
- [ ] Environment variables documented
- [ ] Payoneer setup instructions

**Monitoring:**
- [ ] Webhook logs collection set up
- [ ] Error tracking (Sentry) configured
- [ ] Billing event alerts (email/Slack)
- [ ] Revenue tracking dashboard

**Legal/Compliance:**
- [ ] Terms of Service updated with pricing
- [ ] Privacy Policy mentions Stripe
- [ ] Refund policy documented
- [ ] Billing support email set up

---

## Implementation Priority

**Critical Path (Must Have):**
1. Stripe SDK setup (Task 1.1)
2. Billing schema migration (Task 1.2)
3. Checkout session endpoint (Task 1.5)
4. Webhook handling (Sprint 3)
5. Plan enforcement (Task 2.2)
6. Billing UI (Sprint 4)

**Important (Should Have):**
1. Customer Portal integration (Task 1.6)
2. Usage alerts (Task 2.4)
3. Cancel subscription (Task 2.5)
4. Billing tests (Task 5.1)

**Nice to Have:**
1. Annual billing option
2. Advanced usage analytics
3. Invoice history download
4. Custom plan requests

---

## File Structure After Phase 3

```
apps/producer-service/src/
├── routes/
│   ├── auth.ts
│   ├── invitations.ts
│   ├── users.ts
│   ├── organization.ts
│   ├── billing.ts           # NEW
│   └── webhooks.ts          # NEW
├── middleware/
│   ├── auth.ts
│   ├── rateLimiter.ts
│   └── planLimits.ts        # NEW
├── config/
│   ├── stripe.ts            # NEW
│   └── plans.ts             # NEW
└── utils/
    ├── subscription.ts      # NEW
    └── usageAlerts.ts       # NEW

apps/dashboard-client/src/
├── pages/
│   └── Settings.tsx         # Updated with billing tab
├── components/
│   └── settings/
│       └── BillingTab.tsx   # NEW
├── hooks/
│   └── useBilling.ts        # NEW
└── styles/
    └── billing.css          # NEW

migrations/
└── 003-add-billing-fields.ts  # NEW

tests/
└── billing.test.ts          # NEW
```

---

## Estimated Effort

| Sprint | Estimated Time |
|--------|----------------|
| Sprint 1: Stripe Setup | 5-7 hours |
| Sprint 2: Subscription Backend | 6-8 hours |
| Sprint 3: Webhook Handling | 4-5 hours |
| Sprint 4: Billing Dashboard UI | 8-10 hours |
| Sprint 5: Testing & Launch Prep | 4-6 hours |
| **Total** | **27-36 hours** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Webhook delivery failure | Log all webhooks, implement retry mechanism |
| Plan downgrade edge cases | Test all upgrade/downgrade paths thoroughly |
| Stripe API changes | Pin API version, monitor Stripe changelog |
| Payment fraud | Use Stripe Radar (built-in fraud detection) |
| Currency/Tax complexity | Start with USD only, add tax handling in Phase 4 |
| Payoneer payout delays | Set expectations (5-7 business days) |

---

## Success Criteria

- [ ] Admins can upgrade organization to paid plan
- [ ] Stripe Checkout flow works end-to-end
- [ ] Webhooks properly update organization plan and limits
- [ ] Plan limits enforced at API level
- [ ] Usage alerts show when approaching limits
- [ ] Customer Portal allows subscription management
- [ ] Billing tab displays current plan and upgrade options
- [ ] Test mode works with Stripe test cards
- [ ] Production mode ready for launch
- [ ] Payoneer receives payouts from Stripe

---

## Next Phase Preview (Phase 4)

**Advanced Features:**
- Email integration (SendGrid)
- Advanced analytics dashboard
- Test history and trends
- Email notifications (usage alerts, payment failed)
- API keys for programmatic access
- Webhook integrations (Slack, Discord)
- SSO for Enterprise (OAuth/SAML)
- Annual billing with discounts

---

**Document Version:**
- v1.0 (2026-02-05): Initial Phase 3 plan - Billing Integration with Stripe

**Approvals:**
- [ ] Technical Lead
- [ ] Product Owner
