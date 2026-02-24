# Stripe Production Deployment Checklist

**Phase 3 Sprint 5: Production Launch**

Complete checklist for deploying Stripe billing integration to production at `agnox.dev`.

---

## Pre-Deployment Requirements

### Business Setup
- [ ] **Stripe Account Activated**
  - [ ] Real business information verified
  - [ ] Bank account connected
  - [ ] Tax information submitted
  - [ ] Identity verification complete
  - [ ] Payouts enabled

- [ ] **Israel-Specific Requirements** (Payoneer + Stripe)
  - [ ] Payoneer account linked to Stripe
  - [ ] Currency conversion fees understood
  - [ ] VAT/Tax handling configured
  - [ ] Israeli business registration verified

- [ ] **Legal & Compliance**
  - [ ] Terms of Service updated (subscription terms)
  - [ ] Privacy Policy updated (payment data handling)
  - [ ] Refund policy documented
  - [ ] GDPR compliance reviewed
  - [ ] PCI DSS compliance (handled by Stripe)

### Stripe Dashboard Configuration
- [ ] **Live API Keys Generated**
  - [ ] Live Secret Key (`<REDACTED_STRIPE_SECRET_KEY>`) created
  - [ ] Live Publishable Key (`<REDACTED_STRIPE_PUBLISHABLE_KEY>`) created
  - [ ] Keys stored securely (NOT in git)

- [ ] **Products Created in Live Mode**
  ```bash
  # Create Team Plan
  stripe products create \
    --name="Team Plan" \
    --description="Up to 20 users, 1,000 test runs/month, email support" \
    --api-key=<REDACTED_STRIPE_SECRET_KEY>

  # Note product ID: prod_xxxxx

  # Create Team Price
  stripe prices create \
    --product=prod_xxxxx \
    --unit-amount=9900 \
    --currency=usd \
    --recurring[interval]=month \
    --api-key=<REDACTED_STRIPE_SECRET_KEY>

  # Note price ID: price_xxxxx
  ```

  ```bash
  # Create Enterprise Plan
  stripe products create \
    --name="Enterprise Plan" \
    --description="Unlimited users and test runs, priority support, SSO" \
    --api-key=<REDACTED_STRIPE_SECRET_KEY>

  # Note product ID: prod_yyyyy

  # Create Enterprise Price
  stripe prices create \
    --product=prod_yyyyy \
    --unit-amount=49900 \
    --currency=usd \
    --recurring[interval]=month \
    --api-key=<REDACTED_STRIPE_SECRET_KEY>

  # Note price ID: price_yyyyy
  ```

- [ ] **Webhook Endpoint Configured**
  - [ ] Go to: https://dashboard.stripe.com/webhooks
  - [ ] Click "Add endpoint"
  - [ ] URL: `https://agnox.dev/api/webhooks/stripe`
  - [ ] Select events:
    - [x] `customer.subscription.created`
    - [x] `customer.subscription.updated`
    - [x] `customer.subscription.deleted`
    - [x] `invoice.payment_succeeded`
    - [x] `invoice.payment_failed`
  - [ ] API version: Latest (2024-11-20 or newer)
  - [ ] Copy webhook signing secret (`whsec_...`)

- [ ] **Billing Settings Configured**
  - [ ] Business name set
  - [ ] Support email configured
  - [ ] Statement descriptor set: "KEINAR AUTOMATION"
  - [ ] Invoice footer added (optional)

- [ ] **Customer Portal Configured**
  - [ ] Go to: https://dashboard.stripe.com/settings/billing/portal
  - [ ] Enable Customer Portal
  - [ ] Configure features:
    - [x] Update payment method
    - [x] View invoices
    - [x] Cancel subscription
    - [x] Update billing information
  - [ ] Set return URL: `https://agnox.dev/settings?tab=billing`

- [ ] **Email Notifications Configured**
  - [ ] Successful payment: Enabled
  - [ ] Failed payment: Enabled
  - [ ] Upcoming invoice: Enabled (7 days before)
  - [ ] Subscription canceled: Enabled

---

## Environment Configuration

### Production .env File
Create `.env` file on production server with:

```bash
# ==========================================
# STRIPE BILLING (LIVE MODE)
# ==========================================
# Stripe Live Keys
STRIPE_SECRET_KEY=<REDACTED_STRIPE_SECRET_KEY>
STRIPE_PUBLISHABLE_KEY=<REDACTED_STRIPE_PUBLISHABLE_KEY>
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_TEAM_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_yyyyy

# ==========================================
# CORS & API CONFIGURATION
# ==========================================
VITE_API_URL=https://agnox.dev
ALLOWED_ORIGINS=https://agnox.dev
FRONTEND_URL=https://agnox.dev

# ==========================================
# JWT & SECURITY
# ==========================================
JWT_SECRET=<64-char-random-string>
JWT_EXPIRY=24h
PASSWORD_SALT_ROUNDS=10

# ==========================================
# DATABASE
# ==========================================
MONGO_URI=mongodb://<username>:<password>@<host>:27017/automation_platform?authSource=admin

# ==========================================
# INFRASTRUCTURE
# ==========================================
RABBITMQ_URL=amqp://rabbitmq
REDIS_URL=redis://redis:6379
GEMINI_API_KEY=<REDACTED_GOOGLE_API_KEY>

# ==========================================
# APPLICATION
# ==========================================
NODE_ENV=production
PORT=3000
REPORTS_DIR=/app/reports
```

### Security Checklist
- [ ] **Secrets Management**
  - [ ] `.env` file not in git
  - [ ] `.env` permissions: `chmod 600 .env`
  - [ ] Secrets not logged
  - [ ] No secrets in Docker images

- [ ] **HTTPS Enforcement**
  - [ ] SSL certificate valid (Let's Encrypt)
  - [ ] HTTP → HTTPS redirect enabled
  - [ ] HSTS header enabled
  - [ ] Secure cookies only

- [ ] **Database Security**
  - [ ] MongoDB authentication enabled
  - [ ] MongoDB exposed only to internal network
  - [ ] Regular backups configured
  - [ ] Backup encryption enabled

---

## Deployment Steps

### Step 1: Update Codebase

```bash
# On production server
cd /path/to/Agnostic-Automation-Center

# Pull latest code
git pull origin main

# Verify latest commit
git log --oneline -1
# Should be: Latest Phase 3 Sprint 5 commit
```

### Step 2: Update Environment Variables

```bash
# Edit .env file
nano .env

# Add/update Stripe live keys
# Save and exit (Ctrl+X, Y, Enter)

# Verify variables (don't expose secrets!)
grep -E "STRIPE_|VITE_API_URL|ALLOWED_ORIGINS" .env | sed 's/=.*/=***/'
```

### Step 3: Run Database Migrations

```bash
# Check current migration status
node migrations/check.js

# Run pending migrations (especially 004-add-webhook-logs)
node migrations/004-add-webhook-logs.js

# Verify indexes created
docker exec -it automation-mongodb mongosh
> use automation_platform
> db.webhook_logs.getIndexes()
# Should show unique index on eventId
> exit
```

### Step 4: Rebuild Docker Containers

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Rebuild with NO cache (important for env vars)
docker-compose -f docker-compose.prod.yml build --no-cache dashboard producer

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify all containers running
docker-compose -f docker-compose.prod.yml ps
# All should show "Up" status
```

### Step 5: Verify Services

```bash
# Check producer logs
docker-compose -f docker-compose.prod.yml logs -f producer | head -50

# Look for:
# ✅ Producer connected to MongoDB
# ✅ Billing routes registered
# ✅ Webhook routes registered
# ✅ CORS configured
# No errors

# Check dashboard logs
docker-compose -f docker-compose.prod.yml logs dashboard | tail -20

# Verify Nginx serving static files
```

### Step 6: Test Webhook Endpoint

```bash
# From external machine (not server)
curl -X GET https://agnox.dev/api/webhooks/test

# Expected response:
{
  "status": "ok",
  "message": "Webhook endpoint is accessible",
  "stripeConfigured": true,
  "webhookSecretConfigured": true
}
```

### Step 7: Test Stripe Webhook Delivery

```bash
# In Stripe Dashboard
# Go to: Webhooks → [Your Endpoint]
# Click "Send test webhook"
# Select: customer.subscription.created
# Click "Send test webhook"

# Check producer logs
docker-compose -f docker-compose.prod.yml logs producer | grep -i webhook

# Should see:
# ✅ Webhook verified: customer.subscription.created
```

### Step 8: Smoke Test Full Flow

**Test Free Plan:**
1. Open: https://agnox.dev
2. Sign up with new account
3. Verify:
   - Redirected to dashboard
   - Settings → Billing shows Free plan
   - Plan cards visible
   - No errors in console

**Test Upgrade Flow:**
1. Click "Upgrade to Team"
2. Use test card: `4242 4242 4242 4242`
3. Complete checkout
4. Verify:
   - Redirected back to billing page
   - Plan shows "Team"
   - Usage limits updated
   - No errors

**Test Customer Portal:**
1. Click "Manage Subscription"
2. Verify redirected to Stripe portal
3. Check subscription details visible
4. Return to billing page

**Roll Back Test (Don't complete):**
1. Start upgrade to Enterprise
2. Cancel on Stripe checkout
3. Verify no changes to current plan

---

## Post-Deployment Verification

### Functional Tests
- [ ] **Free Plan Signup**
  - [ ] User registration works
  - [ ] Default limits applied
  - [ ] Billing page accessible

- [ ] **Upgrade Flow**
  - [ ] Checkout session created
  - [ ] Payment processed
  - [ ] Webhook received
  - [ ] Organization upgraded
  - [ ] Limits increased

- [ ] **Plan Management**
  - [ ] Customer Portal accessible
  - [ ] Payment method update works
  - [ ] Invoice download works
  - [ ] Cancellation works

- [ ] **Usage Limits**
  - [ ] Limits enforced
  - [ ] Clear error messages
  - [ ] Upgrade prompts shown

- [ ] **Usage Alerts**
  - [ ] 50% alert appears
  - [ ] 80% alert appears
  - [ ] 90% alert appears

### Security Tests
- [ ] **HTTPS**
  - [ ] All pages load via HTTPS
  - [ ] No mixed content warnings
  - [ ] SSL certificate valid

- [ ] **CORS**
  - [ ] API requests succeed from dashboard
  - [ ] No CORS errors in console
  - [ ] Unauthorized origins blocked

- [ ] **Authentication**
  - [ ] JWT tokens work
  - [ ] Expired tokens rejected
  - [ ] Admin-only routes protected

- [ ] **Webhook Security**
  - [ ] Invalid signature rejected
  - [ ] Missing signature rejected
  - [ ] Webhook secret not exposed

### Performance Tests
- [ ] **Page Load Times**
  - [ ] Dashboard: < 2 seconds
  - [ ] Billing page: < 2 seconds
  - [ ] API endpoints: < 500ms

- [ ] **Concurrent Users**
  - [ ] 10 simultaneous signups work
  - [ ] 5 simultaneous checkouts work
  - [ ] No rate limiting errors (unless intentional)

### Monitoring Setup
- [ ] **Logging**
  - [ ] Producer logs accessible
  - [ ] Worker logs accessible
  - [ ] Dashboard logs accessible
  - [ ] Log rotation configured

- [ ] **Metrics** (Optional - Phase 4)
  - [ ] Stripe webhooks/hour
  - [ ] Checkout sessions created
  - [ ] Subscription churn rate
  - [ ] Failed payments count

- [ ] **Alerts** (Optional - Phase 4)
  - [ ] Webhook processing failures
  - [ ] Payment failures spike
  - [ ] API error rate spike
  - [ ] Database connection issues

---

## Rollback Plan

If critical issues found after deployment:

### Quick Rollback (Emergency)
```bash
# Revert to previous version
git checkout <previous-commit-hash>

# Rebuild containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Database Rollback
```bash
# If migration needs rollback
node migrations/rollback-004.js  # Create if needed

# Restore from backup
mongorestore --uri="$MONGO_URI" --archive=backup-YYYYMMDD.gz --gzip
```

### Stripe Webhook Rollback
1. In Stripe Dashboard: Disable webhook endpoint
2. Stop processing until issue resolved
3. Re-enable after fix deployed

---

## Post-Launch Monitoring (First 24 Hours)

### Every 2 Hours: Check Logs
```bash
# Check for errors
docker-compose -f docker-compose.prod.yml logs producer | grep -i error | tail -50

# Check webhook processing
docker-compose -f docker-compose.prod.yml logs producer | grep -i webhook | tail -50

# Check API errors
docker-compose -f docker-compose.prod.yml logs producer | grep " 500 " | tail -20
```

### Daily: Check Metrics
```javascript
// MongoDB - Check webhook health
use automation_platform

// Today's webhooks
db.webhook_logs.countDocuments({
  createdAt: {$gte: new Date(new Date().setHours(0,0,0,0))}
})

// Failed webhooks today
db.webhook_logs.countDocuments({
  status: 'error',
  createdAt: {$gte: new Date(new Date().setHours(0,0,0,0))}
})

// New subscriptions today
db.organizations.countDocuments({
  plan: {$in: ['team', 'enterprise']},
  'billing.currentPeriodStart': {$gte: new Date(new Date().setHours(0,0,0,0))}
})
```

### Stripe Dashboard: Check Metrics
1. Go to: https://dashboard.stripe.com/dashboard
2. Check:
   - Total revenue today
   - Successful payments
   - Failed payments (should be low)
   - Webhook delivery success rate (should be >99%)
   - Customer disputes (should be 0)

---

## Common Issues & Solutions

### Issue 1: Webhook Not Receiving Events

**Symptoms:**
- Checkout completes but plan doesn't upgrade
- Logs show no webhook received

**Diagnosis:**
```bash
# Check Stripe Dashboard
# Go to: Webhooks → [Your Endpoint] → Events
# See if events were sent

# Check endpoint accessibility
curl -X GET https://agnox.dev/api/webhooks/test
# Should return 200 OK
```

**Solutions:**
1. Verify webhook URL in Stripe Dashboard
2. Check firewall allows Stripe IPs
3. Verify HTTPS certificate valid
4. Check producer service running
5. Verify ALLOWED_ORIGINS includes Stripe

---

### Issue 2: CORS Errors on Dashboard

**Symptoms:**
- Browser console: "CORS policy: No 'Access-Control-Allow-Origin'"
- API requests fail with status 0

**Diagnosis:**
```bash
# Check ALLOWED_ORIGINS
docker exec automation-producer env | grep ALLOWED_ORIGINS

# Expected:
ALLOWED_ORIGINS=https://agnox.dev
```

**Solutions:**
1. Update ALLOWED_ORIGINS in .env
2. Restart producer service
3. Verify dashboard built with correct VITE_API_URL

---

### Issue 3: Dashboard Using Wrong API URL

**Symptoms:**
- Dashboard tries to connect to localhost:3000
- CORS errors

**Diagnosis:**
```bash
# Check what API URL is in dashboard bundle
docker exec automation-dashboard cat /usr/share/nginx/html/assets/index-*.js | grep -o 'http[s]*://[^"]*' | head -1

# Should output: https://agnox.dev
```

**Solutions:**
1. Verify VITE_API_URL in docker-compose.prod.yml
2. Rebuild dashboard with --no-cache
3. Verify build args passed correctly

---

### Issue 4: Payments Not Processing

**Symptoms:**
- Checkout session loads but payment fails
- Stripe error in logs

**Diagnosis:**
```bash
# Check Stripe API key
docker exec automation-producer env | grep STRIPE_SECRET_KEY | sed 's/=.*/=***/'

# Should show <REDACTED_STRIPE_SECRET_KEY> (not sk_test_***)
```

**Solutions:**
1. Verify live API keys (not test keys)
2. Check Stripe account activated
3. Verify Payoneer connected
4. Check business verification complete

---

## Launch Communication

### Internal Team
```markdown
Subject: ✅ Phase 3: Billing Integration - LIVE

Team,

Billing integration deployed to production!

**What's Live:**
- Stripe subscription management
- Free, Team ($99/mo), Enterprise ($499/mo) plans
- Plan upgrade/downgrade flows
- Customer Portal for subscription management
- Usage limit enforcement
- Usage alerts at 50%, 80%, 90%

**URLs:**
- Dashboard: https://agnox.dev
- API: https://agnox.dev/api
- Stripe Dashboard: https://dashboard.stripe.com

**Monitoring:**
- Check logs every 2 hours (first 24h)
- Monitor Stripe dashboard for issues
- On-call: [Name] (first 48 hours)

**Known Issues:**
- None at this time

**Next Steps:**
- Monitor for 48 hours
- Collect user feedback
- Plan Phase 4: Email notifications

Questions? → #billing-support

Thanks!
```

### Users (In-App Announcement)
```markdown
🎉 New Feature: Team & Enterprise Plans!

We've launched paid plans with more resources:

**Team Plan ($99/mo):**
- 1,000 test runs/month
- Up to 20 users
- Email support

**Enterprise Plan ($499/mo):**
- Unlimited test runs
- Unlimited users
- Priority support
- SSO (coming soon)

View plans in Settings → Billing

Questions? Contact support@keinar.com
```

---

## Success Criteria

Deployment considered successful when:
- [ ] All smoke tests passed
- [ ] No critical errors in logs
- [ ] At least 1 successful test subscription created
- [ ] Webhook delivery rate > 99%
- [ ] Page load times acceptable
- [ ] No user complaints in first 24 hours
- [ ] All planned features working

---

## Next Steps After Launch

1. **Week 1:**
   - Daily log reviews
   - Monitor Stripe metrics
   - Collect user feedback
   - Fix any minor issues

2. **Week 2:**
   - Review conversion rates
   - Analyze failed payments
   - Optimize checkout flow
   - Plan improvements

3. **Phase 4 Planning:**
   - Email notifications (payment failed, subscription expiring)
   - Usage reports
   - Advanced analytics
   - Team management features

---

## Related Documents

- [Billing Guide](../features/billing-guide.md)
- [API Reference](../api/README.md)
- [Security Audit](../setup/security-audit.md)

---

## Support Contacts

**Stripe Support:**
- Dashboard: https://dashboard.stripe.com/support
- Email: support@stripe.com
- Phone: Check dashboard for regional number

**Internal:**
- Slack: #billing-support
- On-call: Check PagerDuty
- Email: devops@keinar.com

**Emergency Rollback Authority:**
- Primary: [Name]
- Secondary: [Name]

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Verified By:** _____________
**Sign-off:** _____________
