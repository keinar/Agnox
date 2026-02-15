# Billing & Plans Guide

Manage your organization's subscription, view usage alerts, and upgrade plans.

## Accessing the Billing Dashboard

1. Navigate to **Settings** (top right corner)
2. Click on the **Billing & Plans** tab
3. View your current subscription and available upgrade options

---

## Current Subscription Card

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

---

## Usage Alerts

Real-time alerts appear at the top when approaching plan limits:

| Usage Level | Alert Type | Color | Action |
|------------|------------|-------|--------|
| 50% | Info | Blue | Monitor usage trends |
| 80% | Warning | Yellow | Consider upgrading |
| 90% | Critical | Red | Upgrade immediately |
| 100% | Blocked | — | Tests blocked until reset/upgrade |

---

## Available Plans

### Free Plan — $0/month
- 100 test runs/month
- 3 team members
- 1 concurrent run
- Community support

### Team Plan — $99/month
- 1,000 test runs/month
- 20 team members
- 5 concurrent runs
- Priority support
- Advanced analytics

### Enterprise Plan — $499/month
- Unlimited test runs
- Unlimited team members
- Unlimited concurrent runs
- 24/7 dedicated support
- Custom integrations
- SLA guarantee

---

## Upgrading Your Plan

1. **Select a plan** — Click **Upgrade to [Plan Name]** on the desired plan card
2. **Stripe Checkout** — Enter payment details on secure Stripe-hosted form
3. **Confirmation** — Subscription activates via webhook, new limits apply immediately

---

## Managing Your Subscription

### Customer Portal

Click **Manage Subscription** to access Stripe Customer Portal:
- Update payment method
- View and download invoices
- Cancel subscription
- Update billing details

### Cancel Subscription

Canceling will:
- Continue until the end of your current billing period
- Automatically downgrade to Free plan at period end
- No prorated refunds

### Reactivate

If canceled, click **Manage Subscription** → **Resume subscription** before period end.

---

## Billing Status Reference

### Active 🟢
All systems operational, payments current, full access to plan limits.

### Past Due 🟡
Payment failed. Update payment method within the 7-day grace period. Service continues during grace period. After 7 days, subscription cancels automatically.

### Canceled ⚫
Subscription scheduled for cancellation. Service continues until period end, then downgrades to Free plan. Can reactivate before period end.

---

## Billing FAQ

**When does my billing period reset?**
Monthly periods align with your subscription start date. Test run counters reset on that date.

**Are there prorated charges?**
- **Upgrades**: Yes, prorated charge for remaining period
- **Downgrades**: Take effect at period end, no prorated refunds

**What payment methods are accepted?**
Via Stripe: credit/debit cards (Visa, Mastercard, Amex), Apple Pay, Google Pay.

**What happens if payment fails?**
Automatic retry for 3 days → "Past Due" status → 7-day grace period → auto-cancel if unresolved.

---

## Security & Privacy

- All payments processed by Stripe (PCI DSS Level 1)
- Credit card details never stored on our servers
- After cancellation: data retained for 90 days, permanent deletion available on request

---

## Related Documentation

- [Usage Monitoring](./user-guide.md)
- [API Reference](../api/README.md)
- [Organization Settings](../api/organizations.md)
