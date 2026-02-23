/**
 * Stripe Webhook Routes
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 *
 * Events Handled:
 * - customer.subscription.created - New subscription activated
 * - customer.subscription.updated - Plan changed or subscription modified
 * - customer.subscription.deleted - Subscription canceled
 * - invoice.payment_succeeded - Payment successful
 * - invoice.payment_failed - Payment failed
 *
 * Security:
 * - Stripe signature verification (webhook secret)
 * - Raw body parsing required for signature validation
 * - Idempotent event processing
 *
 * Testing:
 * - Use Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 * - Trigger events: stripe trigger customer.subscription.created
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG } from '../config/stripe.js';
import {
  updateOrganizationSubscription,
  downgradeToFreePlan
} from '../utils/subscription.js';
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail
} from '../utils/email.js';
import type { CiTriggerSource } from '../../../../packages/shared-types/index.js';

/**
 * Inspect incoming request headers to identify the CI/CD system that fired
 * the webhook.  Safe against missing or malformed headers — never throws.
 *
 * Priority order:
 *   1. GitHub  — `x-github-event` present, OR user-agent contains "GitHub-Hookshot"
 *   2. GitLab  — `x-gitlab-event` present
 *   3. Jenkins — `x-jenkins` present, OR user-agent contains "Jenkins"
 *   4. Fallback — `'webhook'` (authenticated API call from an unknown CI system)
 */
export function detectCiSource(
  headers: Record<string, string | string[] | undefined>
): CiTriggerSource {
  const ua = (typeof headers['user-agent'] === 'string' ? headers['user-agent'] : '').toLowerCase();

  if (headers['x-github-event'] !== undefined || ua.includes('github-hookshot')) {
    return 'github';
  }

  if (headers['x-gitlab-event'] !== undefined) {
    return 'gitlab';
  }

  if (headers['x-jenkins'] !== undefined || ua.includes('jenkins')) {
    return 'jenkins';
  }

  return 'webhook';
}

const DB_NAME = 'automation_platform';

/**
 * Map Stripe price ID to plan name
 */
function getPlanFromPriceId(priceId: string): string {
  if (priceId === STRIPE_CONFIG.priceIds.team) return 'team';
  if (priceId === STRIPE_CONFIG.priceIds.enterprise) return 'enterprise';
  return 'free';
}

/**
 * Get admin users for an organization
 */
async function getAdminUsers(db: any, organizationId: string) {
  const usersCollection = db.collection('users');
  return await usersCollection.find({
    organizationId: new ObjectId(organizationId),
    role: 'admin',
    status: 'active'
  }).toArray();
}

/**
 * Log webhook event to audit logs
 */
async function logWebhookEvent(
  db: any,
  event: Stripe.Event,
  organizationId: string | null,
  status: 'success' | 'error',
  error?: string
) {
  try {
    const webhookLogsCollection = db.collection('webhook_logs');
    await webhookLogsCollection.insertOne({
      eventId: event.id,
      eventType: event.type,
      organizationId,
      status,
      error: error || null,
      payload: event.data.object,
      createdAt: new Date(event.created * 1000),
      processedAt: new Date()
    });
  } catch (logError) {
    console.error('Failed to log webhook event:', logError);
  }
}

export async function webhookRoutes(
  app: FastifyInstance,
  mongoClient: MongoClient
) {
  const db = mongoClient.db(DB_NAME);
  const orgsCollection = db.collection('organizations');

  /**
   * POST /api/webhooks/stripe
   * Handle Stripe webhook events
   *
   * Headers Required:
   * - stripe-signature: Webhook signature for verification
   *
   * Response (200):
   * - received: true
   *
   * Errors:
   * - 400: Invalid signature
   * - 500: Processing failed
   */
  app.post('/api/webhooks/stripe', {
    config: {
      // IMPORTANT: Disable automatic JSON parsing for this route
      // We need raw body for Stripe signature verification
      rawBody: true
    }
  }, async (request, reply) => {
    // Check if Stripe is configured
    if (!stripe || !STRIPE_CONFIG.webhookSecret) {
      app.log.warn('Stripe webhook received but Stripe not configured');
      return reply.code(400).send({
        error: 'Stripe not configured'
      });
    }

    const signature = request.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      app.log.error('Webhook signature missing');
      return reply.code(400).send({
        error: 'Missing stripe-signature header'
      });
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      const rawBody = (request.rawBody as string | Buffer) || (request.body as string);
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      app.log.info(`✅ Webhook verified: ${event.type} (${event.id})`);
    } catch (err: any) {
      app.log.error(`⚠️  Webhook signature verification failed: ${err.message}`);
      return reply.code(400).send({
        error: 'Invalid signature'
      });
    }

    // Process event based on type
    let organizationId: string | null = null;

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;

          // Find organization by Stripe customer ID
          const org = await orgsCollection.findOne({
            'billing.stripeCustomerId': subscription.customer as string
          });

          if (!org) {
            app.log.warn(`Organization not found for customer: ${subscription.customer}`);
            await logWebhookEvent(db, event, null, 'error', 'Organization not found');
            return reply.send({ received: true });
          }

          organizationId = org._id.toString();

          // Get plan from subscription
          const priceId = subscription.items.data[0]?.price.id;
          const planId = getPlanFromPriceId(priceId);

          // Update organization subscription
          await updateOrganizationSubscription(db, organizationId, {
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            planId
          });

          app.log.info(
            `✅ Subscription ${event.type === 'customer.subscription.created' ? 'created' : 'updated'}: ` +
            `org=${organizationId}, plan=${planId}, status=${subscription.status}`
          );

          await logWebhookEvent(db, event, organizationId, 'success');
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;

          // Find organization by Stripe customer ID
          const org = await orgsCollection.findOne({
            'billing.stripeCustomerId': subscription.customer as string
          });

          if (!org) {
            app.log.warn(`Organization not found for customer: ${subscription.customer}`);
            await logWebhookEvent(db, event, null, 'error', 'Organization not found');
            return reply.send({ received: true });
          }

          organizationId = org._id.toString();

          // Get plan before downgrading
          const previousPlan = org.plan;

          // Downgrade to free plan
          await downgradeToFreePlan(db, organizationId);

          app.log.info(`✅ Subscription canceled: org=${organizationId} downgraded to free plan`);

          // Send cancellation emails to admins
          const admins = await getAdminUsers(db, organizationId);
          for (const admin of admins) {
            sendSubscriptionCanceledEmail({
              recipientEmail: admin.email,
              recipientName: admin.name,
              organizationName: org.name,
              plan: previousPlan as 'team' | 'enterprise',
              canceledAt: new Date(((subscription as any).canceled_at || Date.now() / 1000) * 1000),
              effectiveDate: new Date(((subscription as any).current_period_end || Date.now() / 1000) * 1000),
              cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
              feedbackUrl: `${process.env.FRONTEND_URL || 'https://automation.keinar.com'}/feedback`
            }).catch((error: any) => {
              app.log.error(`Failed to send cancellation email to ${admin.email}: ${error?.message || error}`);
            });
          }

          await logWebhookEvent(db, event, organizationId, 'success');
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;

          // Find organization by Stripe customer ID
          const org = await orgsCollection.findOne({
            'billing.stripeCustomerId': invoice.customer as string
          });

          if (!org) {
            app.log.warn(`Organization not found for customer: ${invoice.customer}`);
            await logWebhookEvent(db, event, null, 'error', 'Organization not found');
            return reply.send({ received: true });
          }

          organizationId = org._id.toString();

          // Update billing status to active
          await orgsCollection.updateOne(
            { _id: new ObjectId(organizationId) },
            {
              $set: {
                'billing.status': 'active',
                'billing.lastPaymentDate': new Date(invoice.created * 1000),
                'billing.lastPaymentAmount': invoice.amount_paid,
                updatedAt: new Date()
              }
            }
          );

          // Send payment success emails to admins
          const invoiceSubscription = (invoice as any).subscription;
          if (invoiceSubscription && typeof invoiceSubscription === 'string') {
            try {
              const subscription = await stripe.subscriptions.retrieve(invoiceSubscription);
              const admins = await getAdminUsers(db, organizationId);

              for (const admin of admins) {
                sendPaymentSuccessEmail({
                  recipientEmail: admin.email,
                  recipientName: admin.name,
                  organizationName: org.name,
                  plan: org.plan as 'team' | 'enterprise',
                  amount: invoice.amount_paid / 100,
                  currency: invoice.currency,
                  periodStart: new Date(((subscription as any).current_period_start || Date.now() / 1000) * 1000),
                  periodEnd: new Date(((subscription as any).current_period_end || Date.now() / 1000) * 1000),
                  invoiceUrl: invoice.hosted_invoice_url || `${process.env.FRONTEND_URL || 'https://automation.keinar.com'}/settings?tab=billing`
                }).catch((error: any) => {
                  app.log.error(`Failed to send payment success email to ${admin.email}: ${error?.message || error}`);
                });
              }
            } catch (error: any) {
              app.log.warn(`Failed to retrieve subscription for payment success email: ${error?.message || error}`);
            }
          }

          app.log.info(
            `✅ Payment succeeded: org=${organizationId}, ` +
            `amount=$${(invoice.amount_paid / 100).toFixed(2)}`
          );

          await logWebhookEvent(db, event, organizationId, 'success');
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;

          // Find organization by Stripe customer ID
          const org = await orgsCollection.findOne({
            'billing.stripeCustomerId': invoice.customer as string
          });

          if (!org) {
            app.log.warn(`Organization not found for customer: ${invoice.customer}`);
            await logWebhookEvent(db, event, null, 'error', 'Organization not found');
            return reply.send({ received: true });
          }

          organizationId = org._id.toString();

          // Update billing status to past_due
          await orgsCollection.updateOne(
            { _id: new ObjectId(organizationId) },
            {
              $set: {
                'billing.status': 'past_due',
                'billing.lastPaymentAttempt': new Date(invoice.created * 1000),
                updatedAt: new Date()
              }
            }
          );

          // Send payment failed emails to admins
          const admins = await getAdminUsers(db, organizationId);

          // Try to get subscription details for retry date
          let retryDate: Date | null = null;
          const invoiceSubscription = (invoice as any).subscription;
          if (invoiceSubscription && typeof invoiceSubscription === 'string') {
            try {
              const subscription = await stripe.subscriptions.retrieve(invoiceSubscription);
              const nextInvoice = (subscription as any).next_pending_invoice_item_invoice;
              if (nextInvoice && typeof nextInvoice === 'number') {
                retryDate = new Date(nextInvoice * 1000);
              }
            } catch (error: any) {
              app.log.warn(`Failed to retrieve subscription for payment failed email: ${error?.message || error}`);
            }
          }

          for (const admin of admins) {
            sendPaymentFailedEmail({
              recipientEmail: admin.email,
              recipientName: admin.name,
              organizationName: org.name,
              plan: org.plan as 'team' | 'enterprise',
              amount: invoice.amount_due / 100,
              failureReason: invoice.last_finalization_error?.message || 'Payment declined',
              retryDate,
              updatePaymentUrl: `${process.env.FRONTEND_URL || 'https://automation.keinar.com'}/settings?tab=billing`
            }).catch((error: any) => {
              app.log.error(`Failed to send payment failed email to ${admin.email}: ${error?.message || error}`);
            });
          }

          app.log.warn(
            `⚠️  Payment failed: org=${organizationId}, ` +
            `amount=$${(invoice.amount_due / 100).toFixed(2)}`
          );

          await logWebhookEvent(db, event, organizationId, 'success');

          // TODO Phase 4: Send email notification about failed payment
          break;
        }

        default:
          app.log.info(`Unhandled webhook event type: ${event.type}`);
          await logWebhookEvent(db, event, null, 'success');
      }

      return reply.send({ received: true });

    } catch (error: any) {
      app.log.error(`Webhook processing error: ${error.message}`);
      await logWebhookEvent(db, event, organizationId, 'error', error.message);

      // Always return 200 to Stripe to prevent retries for processing errors
      // Stripe will retry on 500 errors, but we log the failure for manual review
      return reply.send({ received: true });
    }
  });

  app.log.info('✅ Webhook routes registered');
  app.log.info('  - POST /api/webhooks/stripe (Stripe events)');
}
