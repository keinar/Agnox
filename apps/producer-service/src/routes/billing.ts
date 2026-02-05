/**
 * Billing Routes
 *
 * Handles Stripe subscription management, checkout sessions, and billing portal.
 *
 * Endpoints:
 * - GET /api/billing/plans - List available plans (Public)
 * - POST /api/billing/checkout - Create Stripe Checkout session (Admin only)
 * - GET /api/billing/portal - Get Stripe Customer Portal URL (Admin only)
 * - GET /api/billing/subscription - Get current subscription details (Admin only)
 * - POST /api/billing/cancel - Cancel subscription at period end (Admin only)
 *
 * Features:
 * - Stripe integration for payments
 * - Automatic customer creation
 * - Subscription lifecycle management
 * - Plan upgrade/downgrade support
 */

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

  // Check if Stripe is configured
  if (!STRIPE_CONFIG.enabled) {
    app.log.warn('⚠️  Stripe not configured - billing endpoints will return errors');
  }

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
   */
  app.post('/api/billing/checkout', {
    preHandler: [authMiddleware, adminOnly, apiRateLimit]
  }, async (request, reply) => {
    if (!stripe) {
      return reply.code(503).send({
        success: false,
        error: 'Billing not configured',
        message: 'Stripe integration is not configured on this server'
      });
    }

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
          { $set: { 'billing.stripeCustomerId': customerId, updatedAt: new Date() } }
        );

        app.log.info(`Created Stripe customer ${customerId} for org ${currentUser.organizationId}`);
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

  /**
   * GET /api/billing/portal
   * Get Stripe Customer Portal URL for subscription management (Admin only)
   *
   * Response (200):
   * - success: true
   * - portalUrl: string (redirect URL)
   */
  app.get('/api/billing/portal', {
    preHandler: [authMiddleware, adminOnly, apiRateLimit]
  }, async (request, reply) => {
    if (!stripe) {
      return reply.code(503).send({
        success: false,
        error: 'Billing not configured',
        message: 'Stripe integration is not configured on this server'
      });
    }

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

  /**
   * GET /api/billing/subscription
   * Get current subscription details (Admin only)
   *
   * Response (200):
   * - success: true
   * - subscription: {plan, status, dates, etc.}
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

      // If on paid plan and Stripe is configured, fetch latest subscription data
      let stripeSubscription = null;
      if (stripe && org.billing?.stripeSubscriptionId) {
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

  /**
   * POST /api/billing/cancel
   * Cancel subscription at end of billing period (Admin only)
   *
   * Response (200):
   * - success: true
   * - message: string
   */
  app.post('/api/billing/cancel', {
    preHandler: [authMiddleware, adminOnly, apiRateLimit]
  }, async (request, reply) => {
    if (!stripe) {
      return reply.code(503).send({
        success: false,
        error: 'Billing not configured',
        message: 'Stripe integration is not configured on this server'
      });
    }

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

  app.log.info('✅ Billing routes registered');
  app.log.info('  - GET /api/billing/plans (Public)');
  app.log.info('  - POST /api/billing/checkout (Admin only)');
  app.log.info('  - GET /api/billing/portal (Admin only)');
  app.log.info('  - GET /api/billing/subscription (Admin only)');
  app.log.info('  - POST /api/billing/cancel (Admin only)');
}
