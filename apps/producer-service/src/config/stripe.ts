/**
 * Stripe Configuration
 *
 * Sets up Stripe SDK with API keys and configuration.
 * Used for subscription management, checkout sessions, and webhooks.
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set - Billing features will be disabled');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20' as any, // Stripe API version
      typescript: true
    })
  : null;

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  priceIds: {
    team: process.env.STRIPE_TEAM_PRICE_ID || '',
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || ''
  },
  enabled: !!process.env.STRIPE_SECRET_KEY
};

// Validate configuration in production
if (process.env.NODE_ENV === 'production' && !STRIPE_CONFIG.enabled) {
  throw new Error('STRIPE_SECRET_KEY is required in production');
}
