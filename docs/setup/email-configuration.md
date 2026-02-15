# Email Configuration Guide

**Purpose:** Configure SendGrid for production email notifications
**Last Updated:** 2026-02-06
**Phase:** 5, Sprint 1

---

## Overview

The Agnostic Automation Center uses SendGrid for reliable email delivery in production. This guide covers:

- SendGrid setup and configuration
- Email template customization
- Testing and troubleshooting
- Monitoring and analytics

---

## Email Types

The platform sends 6 types of automated emails:

| Email Type | Trigger | Recipients | Purpose |
|------------|---------|------------|---------|
| **Invitation** | User invited to organization | Invited user | Team onboarding |
| **Welcome** | User signs up or accepts invitation | New user | Getting started guide |
| **Payment Success** | Successful payment processed | Organization admins | Payment confirmation |
| **Payment Failed** | Payment processing fails | Organization admins | Action required |
| **Usage Alert** | Usage reaches 50%, 80%, 90%, 100% | Organization admins | Resource monitoring |
| **Subscription Canceled** | User cancels subscription | Organization admins | Cancellation confirmation |

---

## Setup Instructions

### 1. Create SendGrid Account

1. Visit https://signup.sendgrid.com
2. Sign up (free tier: 100 emails/day)
3. Verify your email address
4. Complete profile setup

**Pricing:**
- Free: 100 emails/day (3,000/month) - Good for MVP
- Essentials: $15/month, 50,000 emails - For growing usage
- See full pricing: https://sendgrid.com/pricing

---

### 2. Verify Sender Identity

**Option A: Single Sender (Quick Setup)**

1. Navigate to Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in details:
   - From Email: `noreply@automation.keinar.com`
   - From Name: `Agnostic Automation Center`
   - Reply To: `support@automation.keinar.com` (optional)
4. Verify via email link

**Option B: Domain Authentication (Recommended for Production)**

1. Navigate to Settings → Sender Authentication
2. Click "Authenticate Your Domain"
3. Select your DNS provider
4. Add the provided DNS records (CNAME or TXT):

   Example records:
   ```
   Type: CNAME
   Name: em1234.automation.keinar.com
   Value: u1234567.wl.sendgrid.net

   Type: CNAME
   Name: s1._domainkey.automation.keinar.com
   Value: s1.domainkey.u1234567.wl.sendgrid.net

   Type: CNAME
   Name: s2._domainkey.automation.keinar.com
   Value: s2.domainkey.u1234567.wl.sendgrid.net
   ```

5. Wait for DNS propagation (24-48 hours)
6. Click "Verify" in SendGrid dashboard

**Benefits of Domain Authentication:**
- ✅ Higher deliverability (inbox vs spam)
- ✅ Professional sender reputation
- ✅ Can send from any @automation.keinar.com address
- ✅ Better analytics

---

### 3. Create API Key

1. Navigate to Settings → API Keys
2. Click "Create API Key"
3. Configure:
   - Name: `Production Email Service`
   - Permissions: **Restricted Access**
   - Mail Send: **Full Access** ✓
   - All other permissions: Off
4. Click "Create & View"
5. **Copy the API key** (shown only once!)
   - Format: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

⚠️ **Security:**
- Store API key securely (never commit to git)
- Rotate immediately if compromised
- Use minimal required permissions

---

### 4. Configure Environment Variables

**Development (.env file):**

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
FROM_EMAIL=noreply@automation.keinar.com
FROM_NAME=Agnostic Automation Center
FRONTEND_URL=http://localhost:8080

# Optional: Email Tracking
EMAIL_TRACKING_ENABLED=true
EMAIL_OPEN_TRACKING=true
EMAIL_CLICK_TRACKING=true

# Optional: Retry Configuration
EMAIL_RETRY_MAX_ATTEMPTS=3
EMAIL_RETRY_INITIAL_DELAY=1000
```

**Production (.env file):**

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.production_key_here
FROM_EMAIL=noreply@automation.keinar.com
FROM_NAME=Agnostic Automation Center
FRONTEND_URL=https://automation.keinar.com

# Email Tracking (Enabled by default)
EMAIL_TRACKING_ENABLED=true
EMAIL_OPEN_TRACKING=true
EMAIL_CLICK_TRACKING=true
```

**Verify Configuration:**

```bash
# Check environment variables are set
grep SENDGRID_API_KEY .env

# Should output: SENDGRID_API_KEY=SG.xxxxx (not empty)
```

---

### 5. Deploy and Test

**Rebuild Containers:**

```bash
# Development
docker-compose down
docker-compose up --build

# Production
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up --build -d
```

**Verify Initialization:**

```bash
# Check logs for SendGrid initialization
docker logs automation-producer | grep SendGrid

# Should see:
# ✅ SendGrid initialized successfully
#    From: Agnostic Automation Center <noreply@automation.keinar.com>
#    Tracking: Open=true, Click=true
```

**Send Test Email:**

```bash
# Option 1: Sign up with a test email
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User",
    "organizationName": "Test Organization"
  }'

# Option 2: Invite a user (requires JWT token)
curl -X POST http://localhost:3000/api/organizations/me/users/invite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teammate@example.com",
    "role": "developer"
  }'
```

**Check Results:**

1. **Inbox:** Check recipient email (including spam folder)
2. **SendGrid Dashboard:** Activity → Email Activity
3. **Logs:** `docker logs automation-producer | grep "email"`

---

## Email Templates

### Customization

All email templates are in `apps/producer-service/src/utils/email.ts`.

**HTML Templates:**
- Professional design with gradient headers
- Mobile-responsive (600px max width)
- Inline CSS for compatibility
- Brand colors: Purple gradient (#667eea → #764ba2)

**Plain Text Versions:**
- Always provided as fallback
- Readable without HTML
- Full URLs (no "Click here" links)

**Template Variables:**

- `recipientName` - Personalized greeting
- `organizationName` - Organization context
- `frontendUrl` - Links to dashboard
- `role` - User role with description

### Branding

Update branding in `email.ts`:

```typescript
// Change colors
const headerStyle = 'background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%)';

// Change sender name
const FROM_NAME = process.env.FROM_NAME || 'Your Company Name';

// Change footer text
const footer = 'Sent by Your Company Name';
```

---

## Development Mode

When `SENDGRID_API_KEY` is not set or invalid, emails are logged to console only.

**Console Output:**

```
================================================================================
📧 INVITATION EMAIL (Development Mode - Console Only)
================================================================================
To: user@example.com
From: Agnostic Automation Center <noreply@automation.keinar.com>
Subject: You're invited to join Acme Corporation
Action: Create Account
Role: developer
Expires: 2026-02-13T10:00:00.000Z
--------------------------------------------------------------------------------
PLAIN TEXT VERSION:
--------------------------------------------------------------------------------
You're Invited to Join Acme Corporation!

Hi User,

John Smith has invited you to join Acme Corporation as a Developer.
...
================================================================================
💡 HTML version available (not shown in console)
📝 To enable SendGrid, set SENDGRID_API_KEY in .env
================================================================================
```

**To Enable Production Mode:**
1. Add valid `SENDGRID_API_KEY` to `.env`
2. Restart services: `docker-compose restart producer`
3. Verify: Logs should show "✅ SendGrid initialized successfully"

---

## Monitoring & Analytics

### SendGrid Dashboard

**Access:** https://app.sendgrid.com/stats

**Key Metrics:**

1. **Delivered**
   - Target: > 98%
   - Low delivery? Check domain authentication

2. **Opened**
   - Target: > 30% (industry average: 20-25%)
   - Low opens? Improve subject lines

3. **Clicked**
   - Target: > 10%
   - Low clicks? Improve CTAs

4. **Bounced**
   - Target: < 2%
   - Hard bounces: Remove invalid emails
   - Soft bounces: Temporary issues (retry)

5. **Spam Reports**
   - Target: < 0.1%
   - High spam? Add unsubscribe link, check content

**Filters:**

- Date range: Last 7 days, 30 days, custom
- Category: invitation, welcome, payment, etc.
- Email address: Search specific recipient

---

### Application Logs

**View Email Logs:**

```bash
# All email-related logs
docker logs automation-producer | grep "email"

# Successful sends
docker logs automation-producer | grep "✅.*email"

# Failed sends
docker logs automation-producer | grep "❌.*email"

# Usage alerts
docker logs automation-producer | grep "Usage alert"
```

**Log Format:**

```
✅ Invitation email sent to user@example.com
   Organization: Acme Corporation
   Role: developer
   Message ID: <sendgrid-message-id>

❌ Failed to send invitation email: 401 Unauthorized
   Error: Invalid API key
```

---

### Alert Setup (Optional)

**CloudWatch Alarms (AWS):**

```bash
# Alert on high email failure rate
aws cloudwatch put-metric-alarm \
  --alarm-name email-failures \
  --metric-name EmailErrors \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --statistic Sum
```

**SendGrid Webhook (Future):**

- Configure webhook to receive delivery events
- Track: delivered, opened, clicked, bounced
- Store in database for analytics

---

## Troubleshooting

### Issue: Emails Not Sending

**Symptoms:**
- No emails received
- Logs show "SendGrid not configured"

**Solutions:**

1. **Check API Key:**
   ```bash
   grep SENDGRID_API_KEY .env
   # Should not be empty and start with "SG."
   ```

2. **Restart Services:**
   ```bash
   docker-compose restart producer
   ```

3. **Check Logs:**
   ```bash
   docker logs automation-producer | grep SendGrid
   # Look for: "✅ SendGrid initialized successfully"
   ```

4. **Verify API Key Permissions:**
   - SendGrid Dashboard → Settings → API Keys
   - Ensure "Mail Send: Full Access" is enabled

---

### Issue: Emails Going to Spam

**Symptoms:**
- Emails not in inbox
- Found in spam/junk folder

**Solutions:**

1. **Enable Domain Authentication:**
   - See "Setup Instructions → Step 2 → Option B"
   - Adds SPF, DKIM records to DNS

2. **Check Sender Reputation:**
   - SendGrid Dashboard → Settings → Sender Authentication
   - Look for "Authenticated" status

3. **Avoid Spam Triggers:**
   - Don't use ALL CAPS in subject lines
   - Don't use excessive punctuation (!!!)
   - Include unsubscribe link (future feature)
   - Don't send from "no-reply" (use "noreply")

4. **Warm Up Domain (New Accounts):**
   - Start slow: 10-20 emails/day for first week
   - Gradually increase volume
   - Prevents spam filters from flagging

---

### Issue: High Bounce Rate

**Symptoms:**
- SendGrid shows bounces > 5%
- Emails not delivered

**Solutions:**

1. **Identify Bounce Type:**
   - **Hard Bounce:** Invalid email address → Remove from database
   - **Soft Bounce:** Temporary issue (full inbox) → Retry

2. **Clean Email List:**
   ```sql
   -- Find users with bounced emails (pseudo-code)
   SELECT email FROM users WHERE email IN (SELECT bounced_emails FROM sendgrid);
   ```

3. **Validate Emails:**
   - Use SendGrid Email Validation API
   - Check format before sending: `email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)`

---

### Issue: API Errors (401, 403)

**Symptoms:**
- Logs show "401 Unauthorized" or "403 Forbidden"
- Emails not sent

**Solutions:**

1. **401 Unauthorized:**
   - Invalid API key
   - Regenerate API key in SendGrid dashboard
   - Update `.env` file
   - Restart services

2. **403 Forbidden:**
   - API key doesn't have required permissions
   - SendGrid Dashboard → API Keys → Edit
   - Enable "Mail Send: Full Access"

3. **429 Too Many Requests:**
   - Rate limit exceeded
   - Free tier: 100 emails/day
   - Upgrade plan or wait 24 hours

---

## Best Practices

### 1. Email Deliverability

- ✅ Use domain authentication (SPF, DKIM)
- ✅ Keep bounce rate < 5%
- ✅ Monitor spam reports (< 0.1%)
- ✅ Warm up new domains gradually
- ✅ Use clear, honest subject lines
- ✅ Include unsubscribe link (future)

### 2. Security

- ✅ Store API key in environment variables only
- ✅ Never commit API key to git
- ✅ Use minimal required permissions (Mail Send only)
- ✅ Rotate API key if compromised
- ✅ Enable 2FA on SendGrid account

### 3. Performance

- ✅ Send emails asynchronously (non-blocking)
- ✅ Use retry logic (exponential backoff)
- ✅ Log failures for debugging
- ✅ Monitor email queue length
- ✅ Rate limit to avoid spam flags

### 4. Testing

- ✅ Test in development (console logging)
- ✅ Test in staging (real emails to test accounts)
- ✅ Verify all email types before production
- ✅ Check HTML rendering (Gmail, Outlook, Apple Mail)
- ✅ Test mobile responsiveness

---

## FAQ

**Q: How much does SendGrid cost?**
A: Free tier (100 emails/day) is sufficient for MVP. Upgrade to Essentials ($15/month, 50,000 emails) when needed.

**Q: Can I use a different email provider?**
A: Yes, but you'll need to modify `apps/producer-service/src/utils/email.ts` to use a different SDK (e.g., AWS SES, Mailgun).

**Q: How do I test emails without sending real emails?**
A: Don't set `SENDGRID_API_KEY` in `.env`. Emails will be logged to console only.

**Q: Can users unsubscribe from emails?**
A: Not yet implemented. Future enhancement: Add unsubscribe link to footer.

**Q: What happens if SendGrid is down?**
A: Emails will fail but won't crash the application. Errors are logged. Users can retry actions.

**Q: How do I change email templates?**
A: Edit `apps/producer-service/src/utils/email.ts`. Search for the email type (e.g., "generateWelcomeEmailHTML").

**Q: Can I send emails in other languages?**
A: Not yet. Future enhancement: Detect user locale and translate templates.

**Q: How do I view sent emails?**
A: SendGrid Dashboard → Activity → Email Activity. Search by recipient email or date range.

---

## Support

### SendGrid Documentation
- Getting Started: https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs
- API Reference: https://docs.sendgrid.com/api-reference
- Node.js SDK: https://github.com/sendgrid/sendgrid-nodejs

### SendGrid Support
- Help Center: https://support.sendgrid.com
- Community: https://community.sendgrid.com
- Email: support@sendgrid.com (Pro+ plans)

### Platform Support
- Documentation: `docs/` folder
- Issues: GitHub Issues
- Email: info@digital-solution.co.il

---

## Related Documentation

- [Troubleshooting](./troubleshooting.md) - Email issues
- [Project History](../system/project-history-archive.md) - Implementation details
- [Architecture Overview](../architecture/overview.md) - System context

---

**Document Version:** 1.0
**Last Updated:** 2026-02-06
**Status:** Production Ready
