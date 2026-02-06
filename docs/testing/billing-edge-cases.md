# Billing Integration - Edge Cases & Error Handling

**Phase 3 Sprint 5: Testing & Launch Prep**

Comprehensive documentation of edge cases, error scenarios, and recovery procedures for billing integration.

---

## Table of Contents
1. [Payment Failures](#payment-failures)
2. [Subscription Cancellations](#subscription-cancellations)
3. [Plan Upgrades & Downgrades](#plan-upgrades--downgrades)
4. [Webhook Retry Handling](#webhook-retry-handling)
5. [Network & Timeout Issues](#network--timeout-issues)
6. [Data Consistency](#data-consistency)
7. [User Experience Edge Cases](#user-experience-edge-cases)
8. [Security Edge Cases](#security-edge-cases)

---

## Payment Failures

### EC-1: Initial Payment Fails During Checkout

**Scenario:** User's card is declined during subscription creation.

**Flow:**
1. User clicks "Upgrade to Team"
2. Redirected to Stripe Checkout
3. Enters card: `4000 0000 0000 9995` (test decline card)
4. Clicks "Subscribe"
5. Stripe shows error: "Your card was declined"

**System Behavior:**
- ✅ User remains on Stripe Checkout page
- ✅ No subscription created
- ✅ No webhook sent
- ✅ Organization remains on current plan
- ✅ User can try different payment method
- ✅ No partial state changes

**Recovery:**
- User can update payment method and retry
- No cleanup needed (nothing was created)

**Database State:**
```javascript
// Organization unchanged
{
  plan: "free",
  billing: {
    status: "active",
    stripeCustomerId: "cus_xxxxx", // May exist if retry
    stripeSubscriptionId: null
  }
}
```

**Test Command:**
```bash
# Use Stripe test card
4000 0000 0000 9995  # Generic decline
4000 0000 0000 9987  # Insufficient funds
4000 0000 0000 9979  # Lost card
```

---

### EC-2: Recurring Payment Fails

**Scenario:** Monthly subscription renewal payment fails.

**Webhook:** `invoice.payment_failed`

**Flow:**
1. Stripe attempts to charge subscription renewal
2. Payment fails (expired card, insufficient funds, etc.)
3. Stripe sends `invoice.payment_failed` webhook
4. System processes webhook

**System Behavior:**
```javascript
// webhooks.ts line 241-278
case 'invoice.payment_failed':
  // Update billing status to past_due
  await orgsCollection.updateOne(
    { _id: new ObjectId(organizationId) },
    {
      $set: {
        'billing.status': 'past_due',
        'billing.lastPaymentAttempt': new Date(),
        updatedAt: new Date()
      }
    }
  );
```

**User Experience:**
- ✅ Service continues (grace period)
- ✅ Warning banner in UI: "⚠️ Payment failed. Update payment method."
- ✅ Email notification sent (TODO Phase 4)
- ✅ All features remain accessible for 7 days
- ✅ "Update Payment Method" button prominent

**Stripe Retry Logic:**
- Day 0: Initial attempt fails
- Day 3: Stripe retries automatically
- Day 5: Stripe retries again
- Day 7: Stripe retries final time
- Day 8: Subscription canceled if still failing

**Recovery Options:**
1. **User Updates Payment Method:**
   - User clicks "Manage Subscription"
   - Updates card in Customer Portal
   - Stripe retries immediately
   - On success: `invoice.payment_succeeded` webhook
   - Status returns to "active"

2. **Automatic Retry Succeeds:**
   - Stripe retries on schedule
   - If successful: `invoice.payment_succeeded`
   - Status returns to "active"

3. **Payment Never Succeeds:**
   - After final retry: `customer.subscription.deleted`
   - Organization downgraded to free plan
   - Data preserved but limits enforced

**Database States:**
```javascript
// After payment fails
{
  plan: "team",
  billing: {
    status: "past_due",  // Changed from "active"
    stripeSubscriptionId: "sub_xxxxx",
    lastPaymentAttempt: ISODate("2026-02-06"),
    currentPeriodEnd: ISODate("2026-03-01")  // Grace period
  }
}

// After payment succeeds (recovery)
{
  plan: "team",
  billing: {
    status: "active",  // Back to active
    lastPaymentDate: ISODate("2026-02-09"),
    lastPaymentAmount: 9900  // $99.00 in cents
  }
}

// After subscription canceled (failed recovery)
{
  plan: "free",  // Downgraded
  billing: {
    status: "canceled",
    stripeSubscriptionId: null,
    canceledAt: ISODate("2026-02-13")
  }
}
```

**Monitoring:**
```javascript
// Find organizations with past_due status
db.organizations.find({'billing.status': 'past_due'})

// Check recent payment failures
db.webhook_logs.find({
  eventType: 'invoice.payment_failed',
  processedAt: {$gte: new Date(Date.now() - 7*24*60*60*1000)}
}).sort({processedAt: -1})
```

---

### EC-3: 3D Secure Authentication Required

**Scenario:** Card requires additional authentication (3D Secure).

**Flow:**
1. User enters card: `4000 0027 6000 3184` (3DS required)
2. Stripe redirects to bank's authentication page
3. User completes authentication (or cancels)
4. Redirected back to Stripe Checkout

**System Behavior:**
- ✅ If authenticated: Payment proceeds normally
- ✅ If canceled: Returns to checkout, no changes made
- ✅ Webhook only sent after successful authentication

**User Experience:**
- Popup window for authentication
- Clear instructions from bank
- Can retry if authentication fails
- Session preserved during redirect

**Test Card:**
```bash
4000 0027 6000 3184  # 3DS authentication required
# Use any CVC and future expiry
# Authentication always succeeds in test mode
```

---

## Subscription Cancellations

### EC-4: Immediate Cancellation vs. End of Period

**Scenario A: Cancel at Period End (Default)**

**Flow:**
1. User clicks "Manage Subscription"
2. Clicks "Cancel subscription"
3. Selects "Cancel at end of billing period"
4. Confirms cancellation

**Webhook:** `customer.subscription.updated` with `cancel_at_period_end: true`

**System Behavior:**
```javascript
// Subscription still active until period end
{
  plan: "team",  // Unchanged
  billing: {
    status: "active",  // Still active
    cancelAtPeriodEnd: true,  // Flag set
    currentPeriodEnd: ISODate("2026-03-01")  // Remains until this date
  }
}
```

**User Experience:**
- ✅ All features remain accessible
- ✅ Banner: "Your subscription will end on March 1, 2026"
- ✅ "Reactivate Subscription" button available
- ✅ At period end: automatic downgrade to free

**At Period End:**
- Webhook: `customer.subscription.deleted`
- Organization downgraded to free
- Limits reduced
- Data preserved

---

**Scenario B: Immediate Cancellation (Admin Override)**

**Flow:**
1. Admin calls Stripe API directly (or uses Stripe Dashboard)
2. Cancels subscription immediately

**Webhook:** `customer.subscription.deleted` (immediate)

**System Behavior:**
```javascript
// Immediate downgrade
{
  plan: "free",  // Changed immediately
  limits: {
    maxTestRuns: 100,  // Reduced
    maxUsers: 3
  },
  billing: {
    status: "canceled",
    stripeSubscriptionId: null,
    canceledAt: ISODate("2026-02-06")
  }
}
```

**User Experience:**
- ✅ Immediate loss of paid features
- ✅ Banner: "Your subscription has been canceled"
- ✅ Limits enforced immediately
- ✅ No refund (unless explicitly processed)

---

### EC-5: Reactivation After Cancellation

**Scenario:** User cancels subscription then changes mind.

**Flow:**
1. User canceled with `cancel_at_period_end: true`
2. Before period ends, user clicks "Reactivate Subscription"
3. Redirected to Customer Portal
4. Clicks "Reactivate"
5. Stripe removes cancellation flag

**Webhook:** `customer.subscription.updated` with `cancel_at_period_end: false`

**System Behavior:**
```javascript
// Update removed
await orgsCollection.updateOne(
  { _id: orgId },
  {
    $set: {
      'billing.cancelAtPeriodEnd': false,
      updatedAt: new Date()
    }
  }
);
```

**User Experience:**
- ✅ Cancellation notice removed
- ✅ Subscription continues normally
- ✅ Next billing date unchanged
- ✅ No interruption to service

---

## Plan Upgrades & Downgrades

### EC-6: Upgrade Mid-Billing Period (Proration)

**Scenario:** User upgrades from Team ($99) to Enterprise ($499) on day 15 of 30-day period.

**Stripe Behavior:**
- Immediate upgrade to Enterprise
- Prorated charge for remaining 15 days
- Next invoice: Full $499 + remaining proration

**Calculation:**
```
Team plan remaining: $99 * 15/30 = $49.50 credit
Enterprise prorated: $499 * 15/30 = $249.50 charge
Immediate charge: $249.50 - $49.50 = $200.00
Next month: $499.00 (full amount)
```

**Webhooks:**
1. `customer.subscription.updated` - Plan changed
2. `invoice.created` - Proration invoice
3. `invoice.payment_succeeded` - Proration paid

**System Behavior:**
```javascript
// Immediate upgrade
{
  plan: "enterprise",  // Updated immediately
  limits: {
    maxTestRuns: 999999,  // Unlimited
    maxUsers: 999999
  },
  billing: {
    status: "active",
    currentPeriodStart: ISODate("2026-02-01"),
    currentPeriodEnd: ISODate("2026-03-01")  // Unchanged
  }
}
```

**User Experience:**
- ✅ Instant access to Enterprise features
- ✅ Prorated charge explained in invoice
- ✅ Clear breakdown in Stripe receipt
- ✅ Next billing date unchanged

---

### EC-7: Downgrade Mid-Billing Period

**Scenario:** User downgrades from Enterprise ($499) to Team ($99).

**Stripe Behavior:**
- Downgrade scheduled for end of period (not immediate)
- User keeps Enterprise features until period ends
- Next invoice: $99 (Team rate)

**Why?**
- Stripe doesn't issue credits for downgrades
- Prevents abuse (upgrade → use → immediate downgrade)
- User paid for full period, should get full period

**Webhook:** `customer.subscription.updated` with schedule change

**System Behavior:**
```javascript
// Plan change scheduled
{
  plan: "enterprise",  // Unchanged until period ends
  billing: {
    status: "active",
    scheduledPlanChange: "team",  // Will change to this
    currentPeriodEnd: ISODate("2026-03-01")
  }
}

// After period ends
{
  plan: "team",  // Changed
  limits: {
    maxTestRuns: 1000,
    maxUsers: 20
  }
}
```

**User Experience:**
- ✅ Banner: "Your plan will change to Team on March 1, 2026"
- ✅ Enterprise features remain available
- ✅ Can cancel scheduled downgrade before period ends
- ✅ At period end: automatic plan change

---

### EC-8: Multiple Rapid Plan Changes

**Scenario:** User changes plans multiple times in short period.

**Example:**
1. Free → Team (Day 1)
2. Team → Enterprise (Day 3)
3. Enterprise → Team (Day 5)

**Stripe Behavior:**
- Each upgrade: immediate proration
- Downgrades: scheduled for period end
- Webhooks: sent for each change

**System Protection:**
```typescript
// Rate limiting in billing.ts
// Prevent rapid API calls
const RATE_LIMIT = 5; // requests per minute

// Check recent subscription changes
const recentChanges = await db.collection('webhook_logs').countDocuments({
  organizationId,
  eventType: 'customer.subscription.updated',
  createdAt: {$gte: new Date(Date.now() - 60000)} // Last minute
});

if (recentChanges > RATE_LIMIT) {
  return reply.code(429).send({
    error: 'Too many subscription changes',
    message: 'Please wait a moment before changing plans again'
  });
}
```

**User Experience:**
- ✅ Rate limiting prevents abuse
- ✅ Clear error message if too fast
- ✅ Each change processes correctly if within limits
- ✅ Webhook deduplication prevents double-processing

---

## Webhook Retry Handling

### EC-9: Webhook Delivery Failure

**Scenario:** Webhook endpoint is temporarily unavailable.

**Stripe Retry Schedule:**
```
Attempt 1: Immediate
Attempt 2: +5 seconds
Attempt 3: +5 minutes
Attempt 4: +30 minutes
Attempt 5: +2 hours
Attempt 6: +5 hours
Attempt 7: +10 hours
Attempt 8: +15 hours
```

**System Protection:**
```javascript
// Idempotent webhook processing (webhooks.ts)
// Unique index prevents duplicate processing

db.webhook_logs.createIndex(
  { eventId: 1 },
  { unique: true }  // Duplicate eventId throws E11000 error
);

// In webhook handler
try {
  await webhookLogsCollection.insertOne({
    eventId: event.id,
    // ... other fields
  });
} catch (error) {
  if (error.code === 11000) {
    // Duplicate event - already processed
    app.log.info(`Webhook ${event.id} already processed, skipping`);
    return reply.send({ received: true });
  }
  throw error;
}
```

**Scenarios:**

**A: Endpoint Down (500 Error)**
- Stripe: Retries automatically
- System: Processes webhook when back online
- Result: No data loss, eventual consistency

**B: Network Timeout**
- Stripe: Treats as failure, retries
- System: May process webhook twice (rare)
- Protection: Unique eventId prevents double-processing

**C: Webhook Secret Mismatch**
- Stripe: Returns 400, doesn't retry (client error)
- System: Logs error, webhook lost
- Recovery: Manual intervention required

**D: Database Down**
- Stripe: Returns 500, retries
- System: Processes when database back online
- Result: No data loss

**Monitoring:**
```javascript
// Find failed webhooks (never processed)
db.webhook_logs.find({
  status: 'error',
  processedAt: {$exists: true}
}).sort({processedAt: -1})

// Check Stripe Dashboard for failed deliveries
// https://dashboard.stripe.com/webhooks
```

**Recovery Procedures:**
```bash
# Manually replay webhook from Stripe Dashboard
1. Go to Webhooks section
2. Find the failed event
3. Click "Resend"
4. Verify processing in logs

# Or use Stripe CLI
stripe events resend evt_xxxxx
```

---

### EC-10: Out-of-Order Webhook Delivery

**Scenario:** Webhooks arrive in wrong order due to network issues.

**Example:**
1. `customer.subscription.created` (Event A, timestamp 10:00:00)
2. `invoice.payment_succeeded` (Event B, timestamp 10:00:02)
3. Network delay causes B to arrive before A

**Problem:**
- Payment success webhook for subscription that doesn't exist yet
- Can't update organization without subscription ID

**Solution:**
```javascript
// In webhook handler (webhooks.ts)
case 'invoice.payment_succeeded':
  const org = await orgsCollection.findOne({
    'billing.stripeCustomerId': invoice.customer
  });

  if (!org) {
    // Organization not found - webhook may be out of order
    app.log.warn(`Organization not found for invoice, will retry`);

    // Return 500 to trigger Stripe retry
    // By the time Stripe retries, subscription.created may have processed
    return reply.code(500).send({
      error: 'Organization not found, will retry'
    });
  }

  // Continue processing...
```

**Alternative: Event Ordering**
```javascript
// Store webhook in queue, process in order of Stripe timestamp
await webhookQueue.push({
  eventId: event.id,
  eventType: event.type,
  timestamp: event.created,  // Stripe timestamp
  payload: event.data.object
});

// Background processor orders by timestamp before processing
const events = await webhookQueue.find().sort({ timestamp: 1 });
```

**Monitoring:**
```javascript
// Check for processing order issues
db.webhook_logs.find({
  organizationId: 'xxx'
}).sort({createdAt: 1})  // Stripe timestamp

// Compare to processedAt order
db.webhook_logs.find({
  organizationId: 'xxx'
}).sort({processedAt: 1})

// If orders differ significantly, investigate
```

---

### EC-11: Duplicate Webhook Events

**Scenario:** Stripe sends same webhook multiple times.

**Causes:**
- Network timeout (Stripe didn't receive 200 OK)
- Stripe retry logic
- Manual webhook resend

**Protection:**
```javascript
// Unique index on eventId (migrations/004-add-webhook-logs.ts)
await webhookLogsCollection.createIndex(
  { eventId: 1 },
  { unique: true, name: 'idx_eventId_unique' }
);

// Webhook handler catches duplicate
try {
  await webhookLogsCollection.insertOne({
    eventId: event.id,  // Unique
    eventType: event.type,
    organizationId,
    status: 'success',
    // ...
  });
} catch (error) {
  if (error.code === 11000) {
    // E11000: Duplicate key error
    app.log.info(`Duplicate webhook ${event.id} ignored`);
    return reply.send({ received: true });  // Still return 200
  }
  throw error;
}
```

**User Impact:**
- ✅ No duplicate charges
- ✅ No duplicate plan changes
- ✅ No double emails (once implemented)
- ✅ Seamless user experience

**Verification:**
```javascript
// Check for duplicate event IDs (should be none)
db.webhook_logs.aggregate([
  { $group: { _id: '$eventId', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
// Expected: Empty array []
```

---

## Network & Timeout Issues

### EC-12: Stripe API Timeout

**Scenario:** Stripe API call times out during checkout creation.

**Code Location:** `billing.ts:173`
```javascript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  // ...
});
```

**Timeout Scenarios:**
- Network congestion
- Stripe API latency
- Server overload

**Error Handling:**
```javascript
try {
  const session = await Promise.race([
    stripe.checkout.sessions.create({...}),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 10000)
    )
  ]);
} catch (error) {
  if (error.message === 'Timeout') {
    app.log.error('Stripe API timeout');
    return reply.code(504).send({
      success: false,
      error: 'Billing service temporarily unavailable',
      message: 'Please try again in a moment'
    });
  }
  throw error;
}
```

**User Experience:**
- ✅ Clear error message
- ✅ "Try Again" button
- ✅ No partial state changes
- ✅ Can retry immediately

**Recovery:**
- User clicks "Upgrade" again
- System creates new checkout session
- No cleanup needed (no session was created)

---

### EC-13: Webhook Endpoint Slow Response

**Scenario:** Webhook processing takes > 30 seconds (Stripe timeout).

**Causes:**
- Database slow query
- External API call in webhook handler
- Lock contention

**Problem:**
- Stripe receives timeout, retries webhook
- May cause duplicate processing attempt

**Solution: Quick Acknowledge Pattern**
```javascript
// WRONG: Long processing in webhook handler
app.post('/api/webhooks/stripe', async (request, reply) => {
  const event = verifyWebhook(request);

  // BAD: Long operation blocks response
  await updateSubscription(event);  // 20 seconds
  await sendEmail(event);            // 10 seconds

  return reply.send({ received: true });  // Stripe already timed out!
});

// RIGHT: Quick acknowledge, async processing
app.post('/api/webhooks/stripe', async (request, reply) => {
  const event = verifyWebhook(request);

  // Acknowledge immediately
  reply.send({ received: true });

  // Process in background
  processWebhookAsync(event);  // Fire and forget
});

async function processWebhookAsync(event) {
  try {
    await updateSubscription(event);
    await sendEmail(event);
    await logSuccess(event);
  } catch (error) {
    app.log.error('Webhook processing failed:', error);
    await logError(event, error);
  }
}
```

**Current Implementation:**
- Processing is fast (< 1 second typically)
- Direct database updates only
- No external API calls
- Safe to process synchronously

**Monitoring:**
```javascript
// Find slow webhook processing
db.webhook_logs.find({
  $expr: {
    $gt: [
      { $subtract: ['$processedAt', '$createdAt'] },
      5000  // > 5 seconds
    ]
  }
}).sort({processedAt: -1})
```

---

## Data Consistency

### EC-14: Webhook Processed but Database Update Fails

**Scenario:** Webhook log created but organization update fails.

**Flow:**
1. Webhook received and verified
2. Webhook log inserted successfully
3. Organization update throws error (network, lock, etc.)

**Problem:**
```javascript
// Webhook logged as success
db.webhook_logs.findOne({eventId: 'evt_xxx'})
// { status: 'success', ... }

// But organization not updated
db.organizations.findOne({_id: ObjectId('xxx')})
// { plan: 'free' }  // Still on old plan!
```

**Solution: Transactions**
```javascript
// Use MongoDB transactions for consistency
const session = mongoClient.startSession();
try {
  await session.withTransaction(async () => {
    // Both succeed or both fail
    await webhookLogsCollection.insertOne({...}, { session });
    await orgsCollection.updateOne({...}, { session });
  });
} finally {
  await session.endSession();
}
```

**Current Implementation:**
- Webhook log inserted last (after org update)
- If org update fails, no webhook log created
- Stripe retries, processes successfully next time
- Eventual consistency guaranteed

**Monitoring:**
```javascript
// Find webhooks marked success but org not updated
// (Compare webhook timestamp to org updatedAt)
const webhooks = db.webhook_logs.find({
  eventType: 'customer.subscription.created',
  status: 'success'
});

for (const webhook of webhooks) {
  const org = db.organizations.findOne({
    _id: ObjectId(webhook.organizationId)
  });

  if (org.updatedAt < webhook.processedAt) {
    console.log('Inconsistency:', webhook.eventId);
  }
}
```

---

### EC-15: Race Condition - Concurrent Webhook Processing

**Scenario:** Two webhooks for same org arrive simultaneously.

**Example:**
- Webhook A: `subscription.created` (timestamp 10:00:00.100)
- Webhook B: `subscription.updated` (timestamp 10:00:00.200)
- Both arrive at server at same time

**Without Locking:**
```
Thread 1: Read org plan="free"
Thread 2: Read org plan="free"
Thread 1: Update org plan="team"
Thread 2: Update org plan="enterprise"
Result: plan="enterprise" (correct)
But limits may be inconsistent if partial update
```

**Solution: Optimistic Locking**
```javascript
// Add version field to organizations
{
  _id: ObjectId('xxx'),
  version: 1,
  plan: 'free',
  // ...
}

// Update with version check
const result = await orgsCollection.findOneAndUpdate(
  {
    _id: orgId,
    version: currentVersion  // Only update if version matches
  },
  {
    $set: { plan: 'team', limits: {...} },
    $inc: { version: 1 }  // Increment version
  },
  { returnDocument: 'after' }
);

if (!result.value) {
  // Version mismatch - document was updated by another process
  // Retry with latest version
  const latestOrg = await orgsCollection.findOne({ _id: orgId });
  // Process with latest data...
}
```

**Current Implementation:**
- MongoDB atomic updates prevent corruption
- Last write wins (acceptable for this use case)
- Webhook deduplication prevents double-processing
- Event ordering generally correct due to Stripe timestamps

---

## User Experience Edge Cases

### EC-16: User Navigates Away During Checkout

**Scenario:** User closes browser tab during Stripe Checkout.

**Stripe Behavior:**
- Checkout session remains valid for 24 hours
- User can return to same URL to complete payment
- After 24 hours: session expires, need new one

**System Behavior:**
- No subscription created
- No webhook sent
- Organization unchanged
- No cleanup needed

**User Recovery:**
1. Return to billing page
2. Click "Upgrade" again
3. Get new checkout session
4. Complete payment

**Session Management:**
```javascript
// Optional: Store checkout session ID
db.organizations.updateOne(
  { _id: orgId },
  {
    $set: {
      'billing.pendingCheckoutSession': session.id,
      'billing.pendingCheckoutCreated': new Date()
    }
  }
);

// Clean up expired sessions (background job)
db.organizations.updateMany(
  {
    'billing.pendingCheckoutCreated': {
      $lt: new Date(Date.now() - 24*60*60*1000)  // > 24 hours old
    }
  },
  {
    $unset: {
      'billing.pendingCheckoutSession': '',
      'billing.pendingCheckoutCreated': ''
    }
  }
);
```

---

### EC-17: User Completes Checkout But Webhook Delayed

**Scenario:** User completes payment but webhook takes 30 seconds to arrive.

**User Flow:**
1. Completes Stripe Checkout
2. Redirected back to: `/settings?tab=billing&success=true`
3. Page shows: "Current Plan: Free" (not updated yet!)
4. User confused: "I just paid, why am I still on free?"

**Solution: Polling During Success**
```typescript
// BillingTab.tsx - Check for success query param
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    // Poll for plan update
    pollForPlanUpdate();
  }
}, []);

async function pollForPlanUpdate() {
  const maxAttempts = 10;
  const interval = 2000;  // 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    const response = await axios.get(`${API_URL}/api/organization`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.data.organization.plan !== 'free') {
      // Plan updated!
      setBilling(response.data.organization);
      showSuccessMessage('Subscription activated!');
      break;
    }
  }

  // If still not updated after 20 seconds, show message
  if (billing.plan === 'free') {
    showInfoMessage('Your subscription is being activated. Refresh in a moment.');
  }
}
```

**User Experience:**
- ✅ Loading indicator during polling
- ✅ Automatic refresh when plan updates
- ✅ Success message when detected
- ✅ Fallback message if delayed

---

### EC-18: User Opens Multiple Tabs During Upgrade

**Scenario:** User has billing page open in two tabs, initiates upgrade in both.

**Flow:**
1. Tab A: Click "Upgrade to Team"
2. Tab B: Click "Upgrade to Team" (before A completes)
3. Result: Two checkout sessions created

**Stripe Behavior:**
- Each checkout creates new session
- Both sessions valid
- If user completes both: only one subscription created (Stripe prevents duplicate)
- Second completion: redirects to success but subscription already exists

**System Protection:**
```javascript
// In billing.ts
// Check if upgrade already in progress
const existingCheckout = await orgsCollection.findOne({
  _id: orgId,
  'billing.pendingCheckoutSession': { $exists: true },
  'billing.pendingCheckoutCreated': {
    $gt: new Date(Date.now() - 5*60*1000)  // < 5 minutes old
  }
});

if (existingCheckout) {
  return reply.code(409).send({
    success: false,
    error: 'Upgrade already in progress',
    message: 'Please complete or cancel your current checkout session',
    checkoutUrl: `https://checkout.stripe.com/c/pay/${existingCheckout.billing.pendingCheckoutSession}`
  });
}
```

**User Experience:**
- ✅ Error message in second tab
- ✅ Link to complete existing checkout
- ✅ No duplicate charges
- ✅ Clear instructions

---

## Security Edge Cases

### EC-19: Expired JWT During Checkout Flow

**Scenario:** User's JWT expires while on Stripe Checkout page.

**Flow:**
1. User clicks "Upgrade" (JWT valid, expires in 2 minutes)
2. Redirected to Stripe Checkout
3. Spends 5 minutes filling payment form
4. Completes payment
5. Redirected back to: `/settings?tab=billing&success=true`
6. JWT now expired (401 Unauthorized)

**Problem:**
- Billing page can't fetch updated organization data
- User sees error instead of success

**Solution: JWT Refresh**
```typescript
// AuthContext.tsx - Refresh token if expired
async function refreshTokenIfNeeded() {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  const payload = parseJWT(token);
  const expiresIn = payload.exp - (Date.now() / 1000);

  if (expiresIn < 60) {
    // Token expires in < 1 minute, refresh it
    try {
      const response = await axios.post(`${API_URL}/api/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newToken = response.data.token;
      localStorage.setItem('authToken', newToken);
      return newToken;
    } catch (error) {
      // Refresh failed, logout
      logout();
      return null;
    }
  }

  return token;
}

// Call before API requests
axios.interceptors.request.use(async (config) => {
  const token = await refreshTokenIfNeeded();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Alternative: Extend JWT Expiry**
```javascript
// In jwt.ts - Increase expiry for checkout flow
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';  // 24 hours default
```

---

### EC-20: CSRF Attack on Webhook Endpoint

**Scenario:** Attacker tries to forge webhook requests.

**Attack:**
```bash
# Attacker sends fake webhook
curl -X POST https://automation.keinar.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type": "customer.subscription.created",
    "data": {
      "object": {
        "customer": "cus_victim",
        "id": "sub_fake",
        "status": "active"
      }
    }
  }'
```

**Protection: Signature Verification**
```javascript
// webhooks.ts line 118-132
const signature = request.headers['stripe-signature'];

if (!signature) {
  return reply.code(400).send({ error: 'Missing signature' });
}

try {
  // Verify signature with Stripe webhook secret
  event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_CONFIG.webhookSecret
  );
} catch (err) {
  // Invalid signature - reject request
  return reply.code(400).send({ error: 'Invalid signature' });
}
```

**How It Works:**
- Stripe signs webhook payload with secret key
- Only Stripe knows the secret
- Server verifies signature before processing
- Forged requests fail verification

**Security Levels:**
1. ✅ Signature verification (primary defense)
2. ✅ HTTPS only (prevent MITM)
3. ✅ Rate limiting (prevent brute force)
4. ✅ Webhook secret rotation (periodic)

**Monitoring:**
```javascript
// Check for failed signature verifications
db.webhook_logs.find({
  status: 'error',
  error: /signature/i
}).sort({processedAt: -1})

// High rate = potential attack
```

---

## Recovery Procedures

### Procedure 1: Manually Process Lost Webhook

**When:** Webhook lost due to prolonged outage, never retried.

**Steps:**
1. Identify lost event in Stripe Dashboard
2. Get event ID (e.g., `evt_1234567890`)
3. Replay using Stripe CLI:
```bash
stripe events resend evt_1234567890
```

4. Verify processing:
```bash
docker-compose logs producer | grep evt_1234567890
```

5. Check webhook log:
```javascript
db.webhook_logs.findOne({eventId: 'evt_1234567890'})
```

---

### Procedure 2: Fix Inconsistent Organization State

**When:** Organization plan doesn't match Stripe subscription.

**Diagnosis:**
```javascript
// Check organization
const org = db.organizations.findOne({_id: ObjectId('xxx')});
console.log('DB plan:', org.plan);
console.log('Stripe sub:', org.billing.stripeSubscriptionId);

// Check actual Stripe subscription
stripe subscriptions retrieve sub_xxxxx
```

**Manual Fix:**
```javascript
// If Stripe says "team" but DB says "free"
db.organizations.updateOne(
  { _id: ObjectId('xxx') },
  {
    $set: {
      plan: 'team',
      'limits.maxTestRuns': 1000,
      'limits.maxUsers': 20,
      'limits.maxProjects': 50,
      'billing.status': 'active',
      updatedAt: new Date()
    }
  }
);
```

**Prevention:**
- Regular consistency checks
- Stripe as source of truth
- Automated reconciliation job

---

### Procedure 3: Refund and Cancel Subscription

**When:** User disputes charge, requires refund.

**Steps:**
1. In Stripe Dashboard: Find payment
2. Click "Refund" → Full or Partial
3. Select reason
4. Confirm refund
5. Stripe sends `charge.refunded` webhook (not handled yet)
6. Manually cancel subscription:
   - In Stripe: Cancel subscription
   - Webhook: `customer.subscription.deleted`
   - System: Auto-downgrades to free
7. Notify user via email

**Notes:**
- Refunds don't auto-cancel subscriptions
- Must manually cancel to prevent next charge
- Consider adding `charge.refunded` webhook handler (Phase 4)

---

## Testing Checklist

- [ ] Test all payment failure scenarios
- [ ] Test cancellation flows (immediate and end-of-period)
- [ ] Test upgrade/downgrade with proration
- [ ] Test webhook retry with simulated failures
- [ ] Test duplicate webhook prevention
- [ ] Test out-of-order webhook handling
- [ ] Test race conditions with concurrent webhooks
- [ ] Test JWT expiry during checkout
- [ ] Test signature verification security
- [ ] Test manual recovery procedures

---

## Related Documents

- `docs/testing/billing-test-scenarios.md` - Full test scenarios
- `docs/testing/webhook-load-testing.md` - Performance testing
- `docs/deployment/stripe-production-checklist.md` - Production setup
- `docs/implementation/phase-3/webhook-testing-guide.md` - Webhook testing

---

## Support Resources

**Stripe Documentation:**
- Webhooks: https://docs.stripe.com/webhooks
- Retries: https://docs.stripe.com/webhooks/best-practices#retry-logic
- Testing: https://docs.stripe.com/testing
- Checkout: https://docs.stripe.com/payments/checkout

**Internal:**
- Slack: #billing-support
- On-call: Check PagerDuty rotation
- Runbook: `docs/runbooks/billing-incidents.md` (TODO Phase 4)
