# SendGrid Setup Guide

**Purpose:** Configure SendGrid for production email delivery
**Estimated Time:** 30 minutes
**Prerequisites:** Access to DNS records for domain authentication (optional but recommended)

---

## Step 1: Create SendGrid Account

1. **Visit SendGrid:**
   - Go to https://signup.sendgrid.com
   - Click "Start for Free"

2. **Sign Up:**
   - Email: `your-email@example.com`
   - Password: Create strong password
   - Complete CAPTCHA

3. **Verify Email:**
   - Check inbox for verification email
   - Click verification link
   - Complete profile setup

4. **Choose Plan:**
   - **Free Tier:** 100 emails/day (recommended for MVP)
   - **Essentials:** $15/month, 50,000 emails (upgrade when needed)

---

## Step 2: Verify Sender Identity

**Option A: Single Sender Verification (Quick, Less Reliable)**

1. Navigate to Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in sender details:
   - **From Name:** Agnostic Automation Center
   - **From Email:** noreply@automation.keinar.com (or your email)
   - **Reply To:** support@automation.keinar.com (optional)
   - **Address:** Your company address
4. Click "Create"
5. Check email and verify

**Option B: Domain Authentication (Recommended, Better Deliverability)**

1. Navigate to Settings → Sender Authentication
2. Click "Authenticate Your Domain"
3. Choose your DNS host (e.g., Cloudflare, GoDaddy, Route53)
4. Enter domain: `automation.keinar.com`
5. SendGrid provides DNS records:

   **CNAME Records to Add:**
   ```
   em1234.automation.keinar.com → u1234567.wl.sendgrid.net
   s1._domainkey.automation.keinar.com → s1.domainkey.u1234567.wl.sendgrid.net
   s2._domainkey.automation.keinar.com → s2.domainkey.u1234567.wl.sendgrid.net
   ```

   **Or TXT Record (if CNAME not available):**
   ```
   Name: automation.keinar.com
   Value: v=spf1 include:sendgrid.net ~all
   ```

6. Add records to your DNS provider
7. Wait 24-48 hours for DNS propagation (usually faster)
8. Click "Verify" in SendGrid dashboard

**Benefits of Domain Authentication:**
- ✅ Higher email deliverability (95%+ inbox rate)
- ✅ Emails less likely to go to spam
- ✅ Professional sender reputation
- ✅ Can send from any email @automation.keinar.com

---

## Step 3: Create API Key

1. **Navigate to API Keys:**
   - Settings → API Keys
   - Click "Create API Key"

2. **Configure API Key:**
   - **Name:** Production Email Service
   - **Permissions:** Restricted Access
   - **Mail Send:** Full Access (enable)
   - **All other permissions:** Off

3. **Save API Key:**
   - Click "Create & View"
   - **IMPORTANT:** Copy the API key immediately (shown only once)
   - It should start with `SG.`
   - Example: `SG.abcdefghijklmnopqrstuvwxyz1234567890...`

4. **Store API Key Securely:**
   ```bash
   # Add to .env file (NEVER commit this to git)
   SENDGRID_API_KEY=SG.your_actual_api_key_here
   ```

---

## Step 4: Configure Environment Variables

1. **Create/Update `.env` file:**
   ```bash
   cd /path/to/Agnostic-Automation-Center

   # If .env doesn't exist
   cp .env.example .env

   # Edit .env
   nano .env  # or use your preferred editor
   ```

2. **Add SendGrid Configuration:**
   ```env
   # SendGrid Configuration
   SENDGRID_API_KEY=SG.your_actual_api_key_from_step_3
   FROM_EMAIL=noreply@automation.keinar.com
   FROM_NAME=Agnostic Automation Center
   FRONTEND_URL=https://automation.keinar.com

   # Optional: Email Tracking
   EMAIL_TRACKING_ENABLED=true
   EMAIL_OPEN_TRACKING=true
   EMAIL_CLICK_TRACKING=true
   ```

3. **Verify Configuration:**
   ```bash
   # Check that SENDGRID_API_KEY is set
   grep SENDGRID_API_KEY .env

   # Should output: SENDGRID_API_KEY=SG.xxxxx (not empty)
   ```

---

## Step 5: Test Email Delivery (Development)

1. **Start Development Server:**
   ```bash
   docker-compose up --build
   ```

2. **Watch Logs:**
   ```bash
   # In another terminal
   docker logs -f automation-producer
   ```

3. **Test Invitation Email:**
   ```bash
   # Get JWT token first (login to dashboard)
   # Then send test invitation

   curl -X POST http://localhost:3000/api/organizations/me/users/invite \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "role": "developer"
     }'
   ```

4. **Check Results:**
   - **Console:** Should see "✅ SendGrid initialized" in logs
   - **Email:** Check inbox of `test@example.com`
   - **SendGrid Dashboard:** Activity → Email Activity (shows sent emails)

---

## Step 6: Production Deployment

1. **Update Production `.env`:**
   ```bash
   # On production server
   cd /path/to/Agnostic-Automation-Center
   nano .env
   ```

   ```env
   # Production SendGrid Configuration
   SENDGRID_API_KEY=SG.production_api_key_here
   FROM_EMAIL=noreply@automation.keinar.com
   FROM_NAME=Agnostic Automation Center
   FRONTEND_URL=https://automation.keinar.com
   ```

2. **Rebuild Containers:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

3. **Verify Service Running:**
   ```bash
   docker logs automation-producer | grep SendGrid
   # Should see: ✅ SendGrid initialized
   ```

4. **Production Smoke Test:**
   - Sign up with real email address
   - Check welcome email received
   - Invite team member
   - Check invitation email received
   - Verify emails in SendGrid Activity Feed

---

## Step 7: Configure Email Tracking (Optional)

SendGrid automatically tracks email opens and clicks if enabled.

1. **Navigate to SendGrid Dashboard:**
   - Settings → Tracking

2. **Enable Tracking:**
   - ✅ Click Tracking: Enabled
   - ✅ Open Tracking: Enabled
   - ✅ Subscription Tracking: Disabled (we handle this)
   - ✅ Google Analytics: Optional (add UTM parameters)

3. **View Analytics:**
   - Stats → Overview
   - Filter by date range
   - Metrics: Delivered, Opened, Clicked, Bounced, Spam Reports

---

## Monitoring & Troubleshooting

### Check Email Delivery Status

1. **SendGrid Activity Feed:**
   - Activity → Email Activity
   - Search by recipient email
   - View delivery status, opens, clicks

2. **Application Logs:**
   ```bash
   # View email send logs
   docker logs automation-producer | grep "Email"

   # Look for:
   # ✅ Invitation email sent to user@example.com
   # ❌ Failed to send invitation email: [error message]
   ```

### Common Issues

#### ❌ Issue: "SendGrid API key not found"
**Solution:**
```bash
# Check .env file
cat .env | grep SENDGRID_API_KEY

# If empty or missing, add:
SENDGRID_API_KEY=SG.your_key_here

# Restart containers
docker-compose restart producer
```

#### ❌ Issue: Emails going to spam
**Solution:**
1. Complete domain authentication (Step 2, Option B)
2. Verify SPF and DKIM records in DNS
3. Check SendGrid sender reputation: Settings → Sender Authentication
4. Avoid spam trigger words in subject lines

#### ❌ Issue: "403 Forbidden" from SendGrid
**Solution:**
1. Check API key permissions (Settings → API Keys)
2. Ensure "Mail Send" permission is enabled
3. Regenerate API key if needed

#### ❌ Issue: No emails received
**Solution:**
1. Check SendGrid Activity Feed for delivery status
2. Check spam folder
3. Verify sender email is authenticated
4. Check recipient email is valid
5. Look for bounces in SendGrid dashboard

#### ❌ Issue: "Account suspended"
**Solution:**
1. Check email from SendGrid (sent to your signup email)
2. Common reasons: Bounce rate too high, spam complaints
3. Contact SendGrid support: https://support.sendgrid.com

---

## Email Deliverability Best Practices

### 1. Warm Up Your Domain (New Accounts)
- **Day 1-3:** Send 10-20 emails/day
- **Week 1:** Gradually increase to 100/day
- **Week 2+:** Normal volume
- **Why:** Prevents being flagged as spam

### 2. Monitor Bounce Rate
- **Target:** < 5% bounce rate
- **Check:** SendGrid Stats → Bounces
- **Action:** Remove invalid emails from database

### 3. Monitor Spam Reports
- **Target:** < 0.1% spam report rate
- **Check:** SendGrid Stats → Spam Reports
- **Action:** Add clear unsubscribe link (future feature)

### 4. Keep Sender Reputation High
- **Check Reputation:** SendGrid → Sender Authentication
- **Maintain:**
  - Low bounce rate (< 5%)
  - Low spam reports (< 0.1%)
  - High engagement (opens, clicks)

---

## SendGrid Pricing Tiers

| Plan | Price | Emails/Month | Features |
|------|-------|--------------|----------|
| **Free** | $0 | 3,000 (100/day) | Basic analytics, domain auth |
| **Essentials** | $15 | 50,000 | Email validation, dedicated IP |
| **Pro** | $90 | 100,000 | Advanced analytics, A/B testing |
| **Premier** | Custom | Custom | Dedicated account manager |

**Current Recommendation:** Start with Free tier (sufficient for MVP)

**Upgrade Triggers:**
- Approaching 3,000 emails/month
- Need dedicated IP (better deliverability)
- Require advanced analytics

---

## Security Checklist

- [ ] API key stored in `.env` (not committed to git)
- [ ] API key has minimal required permissions (Mail Send only)
- [ ] `.env` file in `.gitignore`
- [ ] Sender email verified in SendGrid
- [ ] Domain authentication configured (recommended)
- [ ] HTTPS enabled for all email links
- [ ] Production uses different API key than development

---

## Next Steps

After completing this setup:

1. ✅ SendGrid configured and verified
2. ✅ Environment variables set
3. ✅ Test email sent successfully
4. ⏭️ Proceed to Task #2: Install SendGrid SDK
5. ⏭️ Proceed to Task #3: Implement email service

---

## Support

### SendGrid Documentation
- Getting Started: https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs
- API Reference: https://docs.sendgrid.com/api-reference
- Node.js SDK: https://github.com/sendgrid/sendgrid-nodejs

### SendGrid Support
- Help Center: https://support.sendgrid.com
- Email: support@sendgrid.com
- Chat: Available in dashboard (Pro+ plans)

### Platform Support
- Issues: https://github.com/your-repo/issues
- Email: info@digital-solution.co.il

---

**Document Version:** 1.0
**Last Updated:** 2026-02-06
**Status:** Ready for Production
