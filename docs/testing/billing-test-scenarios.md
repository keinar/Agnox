# Billing Integration - Comprehensive Test Scenarios

**Phase 3 Sprint 5: Testing & Launch Prep**

Complete end-to-end test scenarios for billing integration covering UI, API, webhooks, and edge cases.

---

## Test Environment Setup

### Prerequisites
- Docker Compose running (`docker-compose up`)
- Stripe test account configured
- Test organization and admin user created
- MongoDB accessible for verification
- Browser DevTools open (Network + Console tabs)

### Test Data
```javascript
// Test Organization
{
  _id: ObjectId("..."),
  name: "Test Organization",
  slug: "test-org",
  plan: "free",
  billing: {
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null
  }
}

// Test Admin User
{
  email: "admin@test.com",
  password: "TestPassword123!",
  role: "admin",
  organizationId: "..."
}

// Stripe Test Cards
4242 4242 4242 4242 - Success
4000 0000 0000 9995 - Declined
4000 0000 0000 0341 - 3D Secure required
4000 0025 0000 3155 - Payment fails
```

---

## Scenario 1: New Organization Signup → Free Plan

### Objective
Verify new organization starts on free plan with correct limits.

### Steps
1. Navigate to `http://localhost:8080`
2. Click "Sign Up"
3. Fill form:
   - Email: `neworg@test.com`
   - Password: `Password123!`
   - Name: `New User`
   - Organization Name: `New Organization`
4. Click "Create Account"

### Expected Results
- ✅ Redirected to dashboard
- ✅ JWT token stored in localStorage
- ✅ Welcome message displays organization name
- ✅ Settings → Billing shows:
  - Current Plan: Free ($0/month)
  - Status: Active
  - Test Runs: 0 / 100
  - Users: 1 / 3
  - Storage: 0 GB / 10 GB
- ✅ Plan cards show "Upgrade to Team" and "Upgrade to Enterprise" buttons

### Database Verification
```javascript
db.organizations.findOne({name: "New Organization"})
// Verify:
// - plan: "free"
// - limits.maxTestRuns: 100
// - limits.maxUsers: 3
// - limits.maxProjects: 5
// - billing.status: "active"
// - billing.stripeCustomerId: null
// - billing.stripeSubscriptionId: null
```

### Test Status
- [ ] UI displays correctly
- [ ] Database state correct
- [ ] Limits enforced

---

## Scenario 2: Upgrade from Free to Team Plan

### Objective
Complete full checkout flow and verify subscription activation.

### Prerequisites
- Organization on free plan
- Admin user authenticated
- Stripe test mode enabled

### Steps

#### Part A: Initiate Checkout
1. Navigate to Settings → Billing
2. Click "Upgrade to Team" button
3. Verify:
   - Loading spinner appears
   - Button disabled during API call

#### Part B: Stripe Checkout
4. Redirected to Stripe Checkout page
5. Verify checkout page shows:
   - Product: "Team Plan"
   - Amount: $99.00 / month
   - Your domain in URL bar
6. Fill payment details:
   - Email: `admin@test.com`
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Name: `Test User`
7. Click "Subscribe"

#### Part C: Success Redirect
8. Redirected back to: `http://localhost:8080/settings?tab=billing&success=true`
9. Success message appears: "Subscription activated!"

#### Part D: Verify UI Updated
10. Billing tab now shows:
    - Current Plan: Team ($99/month)
    - Status: Active
    - Test Runs: 0 / 1,000
    - Users: 1 / 20
    - Next Billing Date: (one month from now)
11. "Manage Subscription" button visible
12. Plan cards:
    - Team card shows "Current Plan"
    - Enterprise card shows "Upgrade to Enterprise"
    - Free card grayed out

#### Part E: Verify Backend Processing
13. Check producer logs:
```bash
docker-compose logs producer | grep -i webhook
# Expected:
# ✅ Webhook verified: customer.subscription.created (evt_xxxxx)
# ✅ Subscription created: org=..., plan=team, status=active
# ✅ Checkout session created for org...
```

14. Verify MongoDB:
```javascript
db.organizations.findOne({_id: ObjectId("YOUR_ORG_ID")})
// Verify:
// - plan: "team"
// - limits.maxTestRuns: 1000
// - limits.maxUsers: 20
// - limits.maxProjects: 50
// - billing.status: "active"
// - billing.stripeCustomerId: "cus_xxxxx"
// - billing.stripeSubscriptionId: "sub_xxxxx"
// - billing.currentPeriodStart: <Date>
// - billing.currentPeriodEnd: <Date>
```

15. Verify webhook log:
```javascript
db.webhook_logs.find({
  eventType: "customer.subscription.created",
  organizationId: "YOUR_ORG_ID"
}).sort({processedAt: -1}).limit(1)
// Verify:
// - status: "success"
// - error: null
// - payload contains subscription details
```

### Expected Results
- ✅ Checkout flow completes without errors
- ✅ Stripe customer created
- ✅ Subscription activated
- ✅ Webhook processed successfully
- ✅ Organization upgraded to team plan
- ✅ Limits updated correctly
- ✅ UI reflects new plan immediately
- ✅ No CORS errors in browser console
- ✅ No errors in producer logs

### Test Status
- [ ] Checkout initiated successfully
- [ ] Payment processed
- [ ] Webhook received and processed
- [ ] Database updated correctly
- [ ] UI displays new plan
- [ ] Limits enforced

---

## Scenario 3: Plan Upgrade (Team → Enterprise)

### Objective
Verify existing subscription can be upgraded to higher tier.

### Prerequisites
- Organization on Team plan
- Active subscription (`billing.stripeSubscriptionId` exists)

### Steps
1. Navigate to Settings → Billing
2. Verify current plan shows "Team"
3. Click "Upgrade to Enterprise"
4. Complete Stripe Checkout:
   - Use test card: `4242 4242 4242 4242`
5. Redirected back with success message
6. Verify new plan:
   - Current Plan: Enterprise ($499/month)
   - Test Runs: 0 / Unlimited
   - Users: 1 / Unlimited
   - Storage: Unlimited

### Expected Results
- ✅ Checkout completes
- ✅ Old subscription canceled/updated
- ✅ New subscription created
- ✅ Webhook: `customer.subscription.updated`
- ✅ Organization plan: "enterprise"
- ✅ Limits set to unlimited (999999)

### Database Verification
```javascript
db.organizations.findOne({_id: ObjectId("YOUR_ORG_ID")})
// Verify:
// - plan: "enterprise"
// - limits.maxTestRuns: 999999
// - limits.maxUsers: 999999
// - billing.stripeSubscriptionId: "sub_xxxxx" (may be new or updated)
```

### Test Status
- [ ] Upgrade initiated
- [ ] Payment processed
- [ ] Webhook processed
- [ ] Plan upgraded
- [ ] Limits updated

---

## Scenario 4: Manage Subscription via Customer Portal

### Objective
Verify Customer Portal access and subscription management.

### Prerequisites
- Organization on paid plan (Team or Enterprise)
- Active subscription

### Steps
1. Navigate to Settings → Billing
2. Click "Manage Subscription" button
3. Verify:
   - Redirected to Stripe Customer Portal
   - URL: `https://billing.stripe.com/session/...`
4. Portal shows:
   - Current subscription details
   - Payment method
   - Billing history
   - "Update payment method" button
   - "Cancel subscription" button

### Portal Actions to Test

#### Action A: Update Payment Method
1. Click "Update payment method"
2. Enter new card: `5555 5555 5555 4444` (Mastercard)
3. Save changes
4. Verify success message

#### Action B: View Invoices
1. Click "Invoices" tab
2. Verify recent invoice appears
3. Download PDF invoice
4. Verify PDF contains:
   - Organization name
   - Amount paid
   - Plan details
   - Date

#### Action C: Cancel Subscription
1. Click "Cancel subscription"
2. Select reason: "Testing"
3. Confirm cancellation
4. Verify message: "Your subscription will end on [date]"
5. Click "Back to website"
6. Redirected to: `http://localhost:8080/settings?tab=billing`

### Expected Results After Cancellation
- ✅ Billing tab shows:
  - Status: "Canceling at period end"
  - Message: "Your subscription will end on [date]"
  - All features remain available until end date
- ✅ Webhook received: `customer.subscription.updated` with `cancel_at_period_end: true`
- ✅ Database updated:
  ```javascript
  db.organizations.findOne({_id: ObjectId("YOUR_ORG_ID")})
  // Verify:
  // - billing.cancelAtPeriodEnd: true
  // - billing.currentPeriodEnd: <future date>
  // - plan: still "team" or "enterprise" (until period ends)
  ```

### Test Status
- [ ] Portal access working
- [ ] Payment method update working
- [ ] Invoice access working
- [ ] Cancellation flow working
- [ ] Webhook processed

---

## Scenario 5: Subscription Cancellation → Downgrade to Free

### Objective
Verify automatic downgrade when subscription ends.

### Prerequisites
- Organization with canceled subscription
- Billing period ended (simulate with Stripe CLI)

### Steps
1. Trigger subscription deletion:
```bash
stripe trigger customer.subscription.deleted
```

2. Check producer logs:
```bash
docker-compose logs producer | grep "Subscription canceled"
# Expected:
# ✅ Subscription canceled: org=... downgraded to free plan
```

3. Refresh billing page
4. Verify downgrade:
   - Current Plan: Free ($0/month)
   - Status: Active
   - Test Runs: X / 100 (usage remains but limit reduced)
   - Users: X / 3
   - Message: "Your subscription has ended. You are now on the free plan."

### Expected Results
- ✅ Webhook: `customer.subscription.deleted`
- ✅ Organization plan: "free"
- ✅ Limits reset to free tier
- ✅ `billing.stripeSubscriptionId`: null
- ✅ `billing.status`: "canceled"
- ✅ Existing data preserved (projects, test runs, users)
- ✅ Usage counters remain (but limited by new plan)

### Database Verification
```javascript
db.organizations.findOne({_id: ObjectId("YOUR_ORG_ID")})
// Verify:
// - plan: "free"
// - limits.maxTestRuns: 100
// - limits.maxUsers: 3
// - billing.status: "canceled"
// - billing.stripeSubscriptionId: null
// - billing.currentPeriodEnd: <past date>
```

### Test Status
- [ ] Webhook processed
- [ ] Downgrade completed
- [ ] Limits enforced
- [ ] Data preserved

---

## Scenario 6: Payment Failure Handling

### Objective
Verify system handles failed payments gracefully.

### Prerequisites
- Organization on paid plan
- Active subscription

### Steps
1. Trigger payment failure:
```bash
stripe trigger invoice.payment_failed
```

2. Check producer logs:
```bash
docker-compose logs producer | grep "Payment failed"
# Expected:
# ⚠️ Payment failed: org=..., amount=$XX.XX
```

3. Verify organization status:
```javascript
db.organizations.findOne({_id: ObjectId("YOUR_ORG_ID")})
// Verify:
// - plan: still "team" or "enterprise"
// - billing.status: "past_due"
// - billing.lastPaymentAttempt: <recent date>
```

4. Refresh billing page
5. Verify UI shows warning:
   - Status: "Past Due"
   - Banner: "⚠️ Your payment failed. Please update your payment method."
   - "Update Payment Method" button visible

6. Click "Update Payment Method"
7. Redirected to Customer Portal
8. Update card to: `4242 4242 4242 4242`
9. Stripe retries payment automatically

10. Trigger payment success:
```bash
stripe trigger invoice.payment_succeeded
```

11. Verify recovery:
```javascript
db.organizations.findOne({_id: ObjectId("YOUR_ORG_ID")})
// Verify:
// - billing.status: "active"
// - billing.lastPaymentDate: <recent date>
// - billing.lastPaymentAmount: <amount in cents>
```

### Expected Results
- ✅ Failed payment logged
- ✅ Status changed to "past_due"
- ✅ Warning displayed to user
- ✅ Service continues (grace period)
- ✅ After successful payment: status returns to "active"
- ✅ No data loss

### Test Status
- [ ] Payment failure detected
- [ ] Warning displayed
- [ ] Recovery flow works
- [ ] Status updated correctly

---

## Scenario 7: Usage Limit Enforcement

### Objective
Verify plan limits are enforced for test runs, users, and projects.

### Test Cases

### 7A: Test Run Limit (Free Plan: 100/month)
1. Organization on free plan
2. Create 100 test runs (via API or automation)
3. Attempt to create 101st test run:
```bash
curl -X POST http://localhost:3000/api/test-runs \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"...","testFilePath":"..."}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Test run limit exceeded",
  "message": "Your organization has reached the monthly limit of 100 test runs. Upgrade to Team plan for 1,000 runs/month.",
  "currentUsage": 100,
  "limit": 100
}
```

### 7B: User Limit (Free Plan: 3 users)
1. Organization has 3 users
2. Admin attempts to invite 4th user
3. Fill invite form:
   - Email: `user4@test.com`
   - Role: Developer
4. Click "Send Invitation"

**Expected Response:**
```json
{
  "success": false,
  "error": "User limit exceeded",
  "message": "Your organization has reached the limit of 3 users. Upgrade to Team plan for up to 20 users.",
  "currentUsers": 3,
  "limit": 3
}
```

### 7C: Project Limit (Free Plan: 5 projects)
1. Organization has 5 projects
2. Attempt to create 6th project
3. Fill create project form
4. Click "Create Project"

**Expected Response:**
```json
{
  "success": false,
  "error": "Project limit exceeded",
  "message": "Your organization has reached the limit of 5 projects. Upgrade to Team plan for up to 50 projects.",
  "currentProjects": 5,
  "limit": 5
}
```

### Expected Results
- ✅ Limits enforced at API level
- ✅ Clear error messages
- ✅ Upgrade prompts included
- ✅ Current usage displayed
- ✅ No silent failures
- ✅ Limits increase immediately after upgrade

### Test Status
- [ ] Test run limits enforced
- [ ] User limits enforced
- [ ] Project limits enforced
- [ ] Error messages clear
- [ ] Upgrade prompts work

---

## Scenario 8: Usage Alerts and Warnings

### Objective
Verify usage alerts appear at correct thresholds.

### Test Cases

### 8A: 50% Usage (Info Alert)
1. Organization uses 50 out of 100 test runs
2. Navigate to Settings → Billing
3. Verify alert appears:
   - Type: Info (blue banner)
   - Message: "ℹ️ You've used 50% of your test runs (50/100). Consider upgrading if you need more."

### 8B: 80% Usage (Warning Alert)
1. Organization uses 80 out of 100 test runs
2. Refresh billing page
3. Verify alert:
   - Type: Warning (yellow/orange banner)
   - Message: "⚠️ You've used 80% of your test runs (80/100). Upgrade soon to avoid interruptions."

### 8C: 90% Usage (Critical Alert)
1. Organization uses 90 out of 100 test runs
2. Refresh billing page
3. Verify alert:
   - Type: Critical (red banner)
   - Message: "🚨 You've used 90% of your test runs (90/100). Upgrade now or your tests will be blocked."

### 8D: 100% Usage (Limit Reached)
1. Organization uses 100 out of 100 test runs
2. Verify:
   - Critical alert persists
   - Additional banner: "🚫 Test run limit reached. Upgrade to continue running tests."
   - "Upgrade Now" button prominent

### Expected Results
- ✅ Alerts appear at correct thresholds (50%, 80%, 90%, 100%)
- ✅ Alert severity increases with usage
- ✅ Alerts visible on dashboard and billing page
- ✅ Alerts include upgrade CTAs
- ✅ Alerts update in real-time

### Database Verification
```javascript
// Check usage alerts are calculated correctly
db.executions.countDocuments({
  organizationId: "YOUR_ORG_ID",
  createdAt: {
    $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  }
})
// Count should match usage displayed
```

### Test Status
- [ ] 50% alert works
- [ ] 80% alert works
- [ ] 90% alert works
- [ ] 100% alert works
- [ ] Upgrade CTAs present

---

## Scenario 9: Multi-Tenant Isolation

### Objective
Verify billing data is isolated between organizations.

### Prerequisites
- Two test organizations (Org A and Org B)
- Both on different plans (A=Free, B=Team)

### Steps
1. Login as Org A admin
2. Navigate to Billing
3. Verify:
   - Shows Org A's plan (Free)
   - Shows Org A's usage stats
4. Copy JWT token from localStorage

5. Attempt to access Org B's billing data:
```bash
# Try to get Org B's subscription (using Org A's token)
curl -X GET http://localhost:3000/api/billing/subscription \
  -H "Authorization: Bearer $ORG_A_JWT"

# Should return Org A's data, NOT Org B's
```

6. Logout from Org A
7. Login as Org B admin
8. Navigate to Billing
9. Verify:
   - Shows Org B's plan (Team)
   - Shows Org B's usage stats
   - Cannot see Org A's data

### Expected Results
- ✅ Each org sees only their own billing data
- ✅ JWT token scoped to organizationId
- ✅ API queries filtered by organizationId
- ✅ Webhook processing isolated by org
- ✅ Stripe customers separate per org
- ✅ No cross-org data leakage

### Security Verification
```javascript
// Verify all billing queries include organizationId filter
db.organizations.find({
  _id: ObjectId("ORG_A_ID")
})
// Should only return Org A's data

db.webhook_logs.find({
  organizationId: "ORG_A_ID"
})
// Should only return Org A's webhooks
```

### Test Status
- [ ] JWT scoped correctly
- [ ] API filtered by org
- [ ] Webhooks isolated
- [ ] No cross-org access

---

## Scenario 10: Billing Page Performance

### Objective
Verify billing page loads quickly with usage data.

### Steps
1. Login as admin
2. Open browser DevTools → Network tab
3. Navigate to Settings → Billing
4. Measure load times:
   - Time to first byte (TTFB)
   - DOM content loaded
   - Full page load
   - API request times

### Expected Performance
- ✅ GET /api/organization: < 200ms
- ✅ GET /api/organization/usage: < 300ms
- ✅ GET /api/organization/usage/alerts: < 200ms
- ✅ Total page load: < 1 second
- ✅ No memory leaks
- ✅ No console errors

### API Response Times
```bash
# Test API performance
time curl -X GET http://localhost:3000/api/organization \
  -H "Authorization: Bearer $JWT"

# Should complete in < 200ms
```

### Test Status
- [ ] Page loads quickly
- [ ] API responses fast
- [ ] No errors
- [ ] No memory leaks

---

## Test Execution Checklist

### Before Testing
- [ ] Docker Compose running
- [ ] MongoDB accessible
- [ ] Stripe test mode configured
- [ ] Stripe CLI installed and running
- [ ] Test organization created
- [ ] Browser DevTools open

### During Testing
- [ ] Take screenshots of key screens
- [ ] Log all API requests/responses
- [ ] Monitor producer logs
- [ ] Check MongoDB after each action
- [ ] Verify webhook logs

### After Testing
- [ ] All scenarios passed
- [ ] Edge cases documented
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation updated
- [ ] Bugs filed (if any)

---

## Bug Reporting Template

If you encounter issues, report with this format:

```markdown
### Bug: [Brief Description]

**Scenario:** [Which test scenario]
**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots:**
[Attach screenshots]

**Logs:**
```
[Paste relevant logs]
```

**Database State:**
```javascript
[MongoDB query results]
```

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Docker: 24.0.7
- Date: 2026-02-06
```

---

## Next Steps

After completing all test scenarios:
1. Review edge cases document
2. Run load testing
3. Complete production deployment checklist
4. Deploy to production
5. Monitor for 24 hours
6. Conduct post-launch review

**Related Documents:**
- `docs/testing/billing-edge-cases.md` - Edge case handling
- `docs/testing/webhook-load-testing.md` - Performance testing
- `docs/deployment/stripe-production-checklist.md` - Production setup
- `docs/implementation/phase-3/webhook-testing-guide.md` - Webhook details
