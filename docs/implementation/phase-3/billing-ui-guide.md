# Billing Dashboard UI - User Guide

Complete guide for using the billing dashboard and managing subscriptions.

## Overview

The Billing tab in Settings provides a comprehensive interface for managing your organization's subscription, viewing usage alerts, and upgrading plans.

## Accessing the Billing Dashboard

1. Navigate to **Settings** (top right corner)
2. Click on the **Billing & Plans** tab
3. View your current subscription and available upgrade options

---

## Features

### 1. Current Subscription Card

Displays your active subscription information:

- **Plan Name**: Free, Team, or Enterprise
- **Status Badge**:
  - 🟢 **Active**: Subscription is current and payments up to date
  - 🟡 **Past Due**: Payment failed, action required
  - ⚫ **Canceled**: Subscription canceled, will downgrade at period end
- **Billing Period**: Current subscription cycle dates
- **Last Payment**: Date and amount of most recent payment

**Admin Actions:**
- **Manage Subscription** button: Opens Stripe Customer Portal to:
  - Update payment method
  - View invoice history
  - Cancel subscription
  - Update billing details

### 2. Usage Alerts

Real-time alerts appear at the top when you're approaching plan limits:

- **Info Alert (Blue)**: 50% usage reached
  - "You're halfway through your monthly test runs"
  - Informational only, no action required

- **Warning Alert (Yellow)**: 80% usage reached
  - "You're approaching your test run limit. Consider upgrading."
  - Time to evaluate upgrading to a higher plan

- **Critical Alert (Red)**: 90%+ usage reached
  - "Limit almost reached! You've used 95% of your test runs."
  - Immediate action recommended to avoid service interruption

### 3. Available Plans Section

Interactive cards showing all available plans:

#### Free Plan
- **Price**: $0/month
- **Features**:
  - 100 test runs/month
  - 3 team members
  - 1 concurrent run
  - Community support
- **Status**: Shows "Current Plan" if active

#### Team Plan
- **Price**: $99/month
- **Features**:
  - 1,000 test runs/month
  - 20 team members
  - 5 concurrent runs
  - Priority support
  - Advanced analytics
- **Action**: "Upgrade to Team" button (if not current plan)

#### Enterprise Plan
- **Price**: $499/month
- **Features**:
  - Unlimited test runs
  - Unlimited team members
  - Unlimited concurrent runs
  - 24/7 dedicated support
  - Custom integrations
  - SLA guarantee
- **Action**: "Upgrade to Enterprise" button (if not current plan)

---

## Upgrading Your Plan

### Step 1: Select a Plan

Click **Upgrade to [Plan Name]** button on the plan card you want.

### Step 2: Stripe Checkout

You'll be redirected to Stripe Checkout:
- Secure payment form (hosted by Stripe)
- Enter payment details:
  - Card number
  - Expiration date
  - CVC code
  - Billing address

**Test Cards (Development/Staging):**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Authentication Required: `4000 0025 0000 3155`

### Step 3: Confirmation

After successful payment:
- Redirected back to dashboard
- Subscription automatically activated via webhook
- New plan limits applied immediately
- Team receives increased capacity

---

## Managing Your Subscription

### Access Customer Portal

1. Click **Manage Subscription** button in Current Subscription card
2. Opens Stripe Customer Portal in new tab
3. Available actions:
   - **Update Payment Method**: Add/remove cards
   - **View Invoices**: Download past invoices
   - **Cancel Subscription**: Schedule cancellation at period end
   - **Update Billing Info**: Change billing address, tax ID

### Cancel Subscription

**Important**: Canceling your subscription will:
- Continue until the end of your current billing period
- Automatically downgrade to Free plan at period end
- Reduce limits to Free tier (100 runs, 3 users)
- No prorated refunds (per Stripe policy)

**To Cancel:**
1. Click **Manage Subscription**
2. In Customer Portal, click **Cancel plan**
3. Confirm cancellation
4. Webhook updates your status to "canceled"
5. On period end date, plan downgrades to Free

### Reactivate Canceled Subscription

If you canceled but want to continue:
1. Click **Manage Subscription** before period end
2. In Customer Portal, click **Resume subscription**
3. Subscription will continue normally

---

## Understanding Billing Status

### Active Status 🟢
- All systems operational
- Payments current
- Full access to plan limits

### Past Due Status 🟡
**What happened:**
- Payment failed (card declined, insufficient funds, expired card)

**What to do:**
1. Click **Manage Subscription**
2. Update payment method
3. Retry payment
4. Status returns to Active after successful payment

**Grace Period:**
- 7 days to resolve payment issues
- Service continues during grace period
- After 7 days, subscription cancels automatically

### Canceled Status ⚫
**What it means:**
- Subscription scheduled for cancellation
- Service continues until period end
- Will downgrade to Free plan

**Remaining Time:**
- Check "Billing Period End" date
- All features available until that date
- Can reactivate before period end

---

## Usage Monitoring

### View Detailed Usage

Navigate to **Settings → Usage** tab to see:
- Test runs used vs. limit (with progress bar)
- Active team members vs. limit
- Storage used vs. limit
- Current billing period dates

### Usage Alerts Trigger Points

| Usage Level | Alert Type | Action Recommended |
|------------|------------|-------------------|
| 50% | Info | Monitor usage trends |
| 80% | Warning | Consider upgrading |
| 90% | Critical | Upgrade immediately |
| 100% | Service Limited | Tests blocked until limit reset or upgrade |

### What Happens at 100%?

When you reach plan limits:
- **Test Runs**: Cannot queue new tests until:
  - Next billing period starts (monthly reset)
  - Or upgrade to higher plan
- **Team Members**: Cannot invite new members until:
  - Existing member leaves
  - Or upgrade to higher plan
- **Existing Tests**: Continue running normally
- **Historical Data**: Remains accessible

---

## Billing FAQ

### When does my billing period reset?

Monthly billing periods align with your subscription start date:
- Subscribed on Jan 15? Period: Jan 15 - Feb 15
- Test run counters reset on the 15th of each month
- View exact dates in Current Subscription card

### Are there prorated charges?

**Upgrades**: Yes, you're charged the prorated difference:
- Upgrade from Team ($99) to Enterprise ($499)
- On day 15 of 30-day period
- Prorated charge: ~$200 for remaining 15 days
- Next full charge: $499 on next period start

**Downgrades**: Changes take effect at period end:
- Downgrade requested on day 10
- Continue with current plan until day 30
- Downgrade applies on day 31
- No prorated refunds

### Can I change my billing cycle?

No, billing cycles are monthly based on subscription start date. Contact support@yourcompany.com for special arrangements.

### What payment methods are accepted?

Via Stripe:
- Credit cards (Visa, Mastercard, Amex)
- Debit cards
- Apple Pay / Google Pay (where available)
- ACH bank transfers (US only, Enterprise plan)

### How do I get invoices?

1. Click **Manage Subscription**
2. View **Invoice History** in Customer Portal
3. Download PDF invoices
4. Receipts also emailed after each payment

### What happens if payment fails?

1. Retry attempted automatically (next 3 days)
2. Email notification sent
3. Status changes to "Past Due"
4. Grace period: 7 days to update payment
5. After 7 days: Subscription cancels, downgrade to Free

### Can I upgrade/downgrade anytime?

Yes:
- **Upgrades**: Immediate, prorated charge
- **Downgrades**: Effective at period end, no refunds

---

## Enterprise Features

### Custom Plans

Need custom limits or features?
- Contact: sales@yourcompany.com
- Available customizations:
  - Higher test run limits
  - More concurrent runs
  - Custom SLA agreements
  - Dedicated infrastructure
  - On-premise deployment

### Annual Billing

Save 20% with annual subscriptions:
- Team: $950/year (save $238)
- Enterprise: $4,790/year (save $1,198)
- Contact sales@yourcompany.com to switch

---

## Support

### Billing Questions
- Email: billing@yourcompany.com
- Response time: 24 hours

### Technical Support
- Free Plan: Community forum
- Team Plan: Email support (48h response)
- Enterprise: 24/7 phone + Slack channel

### Stripe Payment Issues
- Managed directly in Customer Portal
- Or contact: support@stripe.com
- Include: Organization ID (from Settings → Organization)

---

## Security & Privacy

### Payment Security
- All payments processed by Stripe (PCI DSS Level 1)
- Credit card details never stored on our servers
- End-to-end encryption

### Data Retention
- After cancellation: Data retained for 90 days
- Permanent deletion available on request
- Export data before canceling (Settings → Organization)

### Refund Policy
- No prorated refunds for partial months
- Cancellations effective at period end
- Billing disputes: billing@yourcompany.com within 30 days

---

## Next Steps

After setting up billing:
1. **Invite Team Members** (Settings → Team Members)
2. **Configure Security** (Settings → Security)
3. **Run Your First Test** (Dashboard → New Execution)
4. **View Usage** (Settings → Usage)

For detailed API integration:
- See: `docs/implementation/phase-3/webhook-testing-guide.md`
- API Reference: `docs/api/billing-endpoints.md`
