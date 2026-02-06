# Phase 5, Sprint 1: SendGrid Email Integration

**Status:** 🚧 In Progress
**Sprint Duration:** 2 days
**Date Started:** 2026-02-06
**Dependencies:** Phase 3 complete (Billing), existing email templates

---

## Executive Summary

Implement production-ready email notifications using SendGrid to enhance user experience and automate critical communications for payment events, user invitations, and system alerts.

**Current State:**
- Email templates exist (`apps/producer-service/src/utils/email.ts`)
- Console logging only (development mode)
- SendGrid integration commented out

**Target State:**
- SendGrid SDK integrated and configured
- All email types sending in production
- Comprehensive email templates (HTML + Plain Text)
- Email tracking and analytics
- Error handling and retry logic

---

## Objectives

### Primary Goals
1. ✅ **SendGrid Integration:** Configure SendGrid SDK for production email delivery
2. ✅ **Email Templates:** Complete all email types (invitations, welcome, billing, alerts)
3. ✅ **Testing:** Verify email delivery in development and production
4. ✅ **Documentation:** Comprehensive guide for email management

### Success Metrics
- Email delivery rate > 98%
- Email open rate > 30% (industry average: 20-25%)
- No bounced emails to valid addresses
- Email send latency < 2 seconds
- All critical flows include email notifications

---

## Implementation Tasks

### Task 1: SendGrid Setup & Configuration (2 hours)

#### 1.1 SendGrid Account Setup
1. **Create SendGrid Account**
   - Sign up at https://sendgrid.com
   - Choose free tier: 100 emails/day (sufficient for MVP)
   - Verify account via email

2. **Domain Authentication (Recommended)**
   - Add sender domain: `automation.keinar.com`
   - Configure DNS records (SPF, DKIM)
   - Verify domain ownership
   - **Benefit:** Higher deliverability, avoid spam folder

3. **Create API Key**
   - Navigate to Settings → API Keys
   - Create new API key: "Production Email Service"
   - Permissions: **Full Access** (Mail Send only)
   - Copy API key (shown once only)
   - Store in `.env` file

4. **Configure Sender Identity**
   - If domain auth not possible, use Single Sender Verification
   - Email: `noreply@automation.keinar.com`
   - Verify email address via link

#### 1.2 Install SendGrid SDK
```bash
cd apps/producer-service
npm install @sendgrid/mail
npm install --save-dev @types/node  # If not already installed
```

**Package Details:**
- `@sendgrid/mail`: Official SendGrid SDK
- Version: Latest stable (v8.x)

#### 1.3 Environment Configuration
Update `.env` and `docker-compose.yml`:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@automation.keinar.com
FROM_NAME=Agnostic Automation Center
FRONTEND_URL=https://automation.keinar.com
```

Update `docker-compose.yml`:
```yaml
producer:
  environment:
    # Existing vars...
    - SENDGRID_API_KEY=${SENDGRID_API_KEY:-}
    - FROM_EMAIL=${FROM_EMAIL:-noreply@automation.keinar.com}
    - FROM_NAME=${FROM_NAME:-Agnostic Automation Center}
```

Update `docker-compose.prod.yml` similarly.

---

### Task 2: Implement SendGrid Email Service (3 hours)

#### 2.1 Update `apps/producer-service/src/utils/email.ts`

**Changes:**
1. Import SendGrid SDK
2. Create SendGrid client instance
3. Replace TODO section with actual implementation
4. Add error handling and logging
5. Add retry logic for transient failures

**Implementation:**
```typescript
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized');
} else {
  console.warn('⚠️  SendGrid API key not found. Emails will only be logged to console.');
}

/**
 * Send invitation email (updated implementation)
 */
export async function sendInvitationEmail(params: IInvitationEmailParams): Promise<IEmailResult> {
  const htmlContent = generateInvitationEmailHTML(params);
  const plainTextContent = generateInvitationEmailPlainText(params);

  const fromEmail = process.env.FROM_EMAIL || 'noreply@automation.keinar.com';
  const fromName = process.env.FROM_NAME || 'Agnostic Automation Center';

  // Development mode: Console logging
  if (process.env.NODE_ENV !== 'production' || !SENDGRID_API_KEY) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 INVITATION EMAIL (Development Mode - Console Only)');
    console.log('='.repeat(80));
    console.log(`To: ${params.recipientEmail}`);
    console.log(`From: ${fromName} <${fromEmail}>`);
    console.log(`Subject: You're invited to join ${params.organizationName}`);
    console.log('-'.repeat(80));
    console.log(plainTextContent);
    console.log('='.repeat(80) + '\n');

    return { success: true, messageId: `dev-${Date.now()}` };
  }

  // Production mode: SendGrid
  try {
    const msg = {
      to: params.recipientEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `You're invited to join ${params.organizationName}`,
      text: plainTextContent,
      html: htmlContent,
      // Tracking settings
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      // Categories for analytics
      categories: ['invitation', params.actionType, params.role]
    };

    const result = await sgMail.send(msg);

    console.log(`✅ Invitation email sent to ${params.recipientEmail}`);

    return {
      success: true,
      messageId: result[0].headers['x-message-id'] as string
    };

  } catch (error: any) {
    console.error('❌ Failed to send invitation email:', error);

    // Log specific error details
    if (error.response) {
      console.error('SendGrid Error:', {
        statusCode: error.response.statusCode,
        body: error.response.body
      });
    }

    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}
```

#### 2.2 Add Retry Logic

Create `apps/producer-service/src/utils/emailRetry.ts`:

```typescript
/**
 * Retry email sending with exponential backoff
 *
 * Handles transient failures (network, rate limits, temporary API issues)
 */
export async function sendEmailWithRetry<T>(
  sendFn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendFn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.response?.statusCode >= 400 && error.response?.statusCode < 500) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`⏳ Email send failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

---

### Task 3: Implement Additional Email Templates (4 hours)

#### 3.1 Welcome Email Template

**When to send:** User signs up or accepts invitation

```typescript
export interface IWelcomeEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  role: 'admin' | 'developer' | 'viewer';
  isNewOrganization: boolean;  // True if first user
}

export async function sendWelcomeEmail(params: IWelcomeEmailParams): Promise<IEmailResult> {
  const subject = params.isNewOrganization
    ? `Welcome to Agnostic Automation Center!`
    : `Welcome to ${params.organizationName}!`;

  const html = generateWelcomeEmailHTML(params);
  const text = generateWelcomeEmailPlainText(params);

  // Implementation similar to invitation email
  // Include: Getting started guide, key features, support links
}
```

**Content:**
- Greeting and welcome message
- Quick start guide (3 steps)
- Link to documentation
- Support contact info
- CTA: "Create Your First Project" (for admins)

---

#### 3.2 Payment Success Email

**When to send:** `invoice.payment_succeeded` webhook

```typescript
export interface IPaymentSuccessEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'team' | 'enterprise';
  amount: number;  // In dollars
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceUrl: string;  // Stripe hosted invoice
}

export async function sendPaymentSuccessEmail(params: IPaymentSuccessEmailParams): Promise<IEmailResult> {
  // Email content
}
```

**Content:**
- Payment confirmation
- Amount and plan details
- Billing period
- Link to invoice (Stripe hosted)
- Link to Customer Portal
- Next billing date

---

#### 3.3 Payment Failed Email

**When to send:** `invoice.payment_failed` webhook

```typescript
export interface IPaymentFailedEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'team' | 'enterprise';
  amount: number;
  failureReason: string;
  retryDate: Date | null;
  updatePaymentUrl: string;  // Link to Customer Portal
}

export async function sendPaymentFailedEmail(params: IPaymentFailedEmailParams): Promise<IEmailResult> {
  // Email content
}
```

**Content:**
- Payment failure notification
- Reason for failure (card declined, expired, etc.)
- Impact: "Your service will remain active until [date]"
- CTA: "Update Payment Method"
- Support contact

---

#### 3.4 Usage Alert Emails

**When to send:**
- 50% of limit reached
- 80% of limit reached (warning)
- 90% of limit reached (critical)
- 100% of limit reached (blocked)

```typescript
export interface IUsageAlertEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'free' | 'team' | 'enterprise';
  resource: 'testRuns' | 'users' | 'storage';
  current: number;
  limit: number;
  percentage: number;
  severity: 'info' | 'warning' | 'critical' | 'blocked';
  upgradeUrl: string;  // Link to billing page
}

export async function sendUsageAlertEmail(params: IUsageAlertEmailParams): Promise<IEmailResult> {
  // Email content
}
```

**Content:**
- Alert notification
- Current usage vs. limit
- Progress bar (visual representation)
- Impact if limit reached
- CTA: "Upgrade Plan" (if not enterprise)
- Link to usage dashboard

---

#### 3.5 Subscription Canceled Email

**When to send:** User cancels subscription (immediate or end of period)

```typescript
export interface ISubscriptionCanceledEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'team' | 'enterprise';
  canceledAt: Date;
  effectiveDate: Date;  // When it actually ends
  cancelAtPeriodEnd: boolean;
  feedbackUrl: string;  // Optional: Survey link
}

export async function sendSubscriptionCanceledEmail(params: ISubscriptionCanceledEmailParams): Promise<IEmailResult> {
  // Email content
}
```

**Content:**
- Cancellation confirmation
- When service will end
- What happens to data (e.g., downgrade to free plan)
- Reactivation option
- Feedback request (optional)

---

#### 3.6 Password Reset Email

**When to send:** User requests password reset (future feature)

```typescript
export interface IPasswordResetEmailParams {
  recipientEmail: string;
  recipientName: string;
  resetToken: string;
  expiresAt: Date;
}

export async function sendPasswordResetEmail(params: IPasswordResetEmailParams): Promise<IEmailResult> {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${params.resetToken}`;

  // Email content
}
```

**Content:**
- Password reset request confirmation
- Reset link (expires in 1 hour)
- Security notice ("If you didn't request this...")
- Support contact

---

### Task 4: Integrate Emails into Existing Flows (2 hours)

#### 4.1 Update Auth Routes (`apps/producer-service/src/routes/auth.ts`)

**Signup Flow:**
```typescript
// After user creation
await sendWelcomeEmail({
  recipientEmail: user.email,
  recipientName: user.name,
  organizationName: organization.name,
  role: user.role,
  isNewOrganization: true
});
```

**Invitation Accept Flow:**
```typescript
// After user accepts invitation
await sendWelcomeEmail({
  recipientEmail: user.email,
  recipientName: user.name,
  organizationName: organization.name,
  role: user.role,
  isNewOrganization: false
});
```

---

#### 4.2 Update Webhook Handler (`apps/producer-service/src/routes/webhooks.ts`)

**Payment Success:**
```typescript
case 'invoice.payment_succeeded':
  // After updating organization
  const admins = await getUsersByRole(organizationId, 'admin');
  for (const admin of admins) {
    await sendPaymentSuccessEmail({
      recipientEmail: admin.email,
      recipientName: admin.name,
      organizationName: organization.name,
      plan: organization.plan,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
      invoiceUrl: invoice.hosted_invoice_url
    });
  }
  break;
```

**Payment Failed:**
```typescript
case 'invoice.payment_failed':
  const admins = await getUsersByRole(organizationId, 'admin');
  for (const admin of admins) {
    await sendPaymentFailedEmail({
      recipientEmail: admin.email,
      recipientName: admin.name,
      organizationName: organization.name,
      plan: organization.plan,
      amount: invoice.amount_due / 100,
      failureReason: invoice.last_finalization_error?.message || 'Payment declined',
      retryDate: subscription.next_pending_invoice_item_invoice
        ? new Date(subscription.next_pending_invoice_item_invoice * 1000)
        : null,
      updatePaymentUrl: `${process.env.FRONTEND_URL}/settings?tab=billing`
    });
  }
  break;
```

**Subscription Canceled:**
```typescript
case 'customer.subscription.deleted':
  const admins = await getUsersByRole(organizationId, 'admin');
  for (const admin of admins) {
    await sendSubscriptionCanceledEmail({
      recipientEmail: admin.email,
      recipientName: admin.name,
      organizationName: organization.name,
      plan: organization.plan,
      canceledAt: new Date(subscription.canceled_at * 1000),
      effectiveDate: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      feedbackUrl: `${process.env.FRONTEND_URL}/feedback`
    });
  }
  break;
```

---

#### 4.3 Usage Alerts Integration

Create scheduled job or real-time check:

**Option 1: Real-time (on test run trigger)**
```typescript
// In POST /api/runs/trigger
const usage = await getUsageForOrganization(organizationId);
const limits = organization.limits;

// Check thresholds
const testRunPercentage = (usage.testRuns / limits.maxTestRuns) * 100;

if ([50, 80, 90].includes(Math.floor(testRunPercentage))) {
  const admins = await getUsersByRole(organizationId, 'admin');
  for (const admin of admins) {
    await sendUsageAlertEmail({
      recipientEmail: admin.email,
      recipientName: admin.name,
      organizationName: organization.name,
      plan: organization.plan,
      resource: 'testRuns',
      current: usage.testRuns,
      limit: limits.maxTestRuns,
      percentage: testRunPercentage,
      severity: testRunPercentage >= 90 ? 'critical' : testRunPercentage >= 80 ? 'warning' : 'info',
      upgradeUrl: `${process.env.FRONTEND_URL}/settings?tab=billing`
    });
  }
}
```

**Option 2: Daily scheduled job (future enhancement)**
- Run cron job at 9 AM daily
- Check all organizations
- Send alerts if thresholds crossed since last check

---

### Task 5: Testing (3 hours)

#### 5.1 Development Testing

**Setup SendGrid Test Mode:**
1. Use free tier (100 emails/day)
2. Use your personal email for testing
3. Check SendGrid Activity Feed

**Test Cases:**
```bash
# Test 1: Invitation Email
curl -X POST http://localhost:3000/api/organizations/me/users/invite \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "developer"
  }'

# Check: Email received, links work, styling correct

# Test 2: Welcome Email (signup flow)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "name": "Test User",
    "organizationName": "Test Org"
  }'

# Check: Welcome email received

# Test 3: Payment Success (webhook simulation)
# Use Stripe CLI: stripe trigger invoice.payment_succeeded
```

**Checklist:**
- [ ] Email delivered to inbox (not spam)
- [ ] HTML rendering correct (test in Gmail, Outlook, Apple Mail)
- [ ] Plain text version readable
- [ ] Links clickable and point to correct URLs
- [ ] Images load (if any)
- [ ] Mobile responsive
- [ ] Unsubscribe link present (optional)

---

#### 5.2 Production Testing

**Pre-Production Checklist:**
1. **Domain Authentication:**
   - [ ] SPF record added
   - [ ] DKIM record added
   - [ ] Domain verified in SendGrid
   - [ ] Test email deliverability

2. **API Key Security:**
   - [ ] API key stored in environment variables
   - [ ] API key not in git history
   - [ ] API key has minimal required permissions

3. **Email Templates:**
   - [ ] All templates reviewed for typos
   - [ ] Branding consistent
   - [ ] Legal footer present (if required)

**Production Smoke Test:**
1. Sign up with real email
2. Verify welcome email received
3. Invite team member
4. Verify invitation email received
5. Trigger test run at 50% limit
6. Verify usage alert email received
7. Upgrade plan (test mode)
8. Verify payment success email received

---

### Task 6: Monitoring & Analytics (1 hour)

#### 6.1 SendGrid Analytics Dashboard

**Metrics to Monitor:**
- **Delivered:** Total emails delivered
- **Opened:** Open rate (%)
- **Clicked:** Click-through rate (%)
- **Bounced:** Hard/soft bounces
- **Spam Reports:** User-reported spam
- **Unsubscribes:** Opt-out rate

**Access:**
- Log in to SendGrid dashboard
- Navigate to Stats → Email Activity
- Filter by category (invitation, payment, alert)

---

#### 6.2 Application Logging

Add logging in `email.ts`:

```typescript
// After sending email
console.log('[Email Sent]', {
  type: 'invitation',
  recipient: params.recipientEmail,
  messageId: result.messageId,
  timestamp: new Date().toISOString()
});
```

**Log Aggregation:**
- Collect logs in centralized system (e.g., CloudWatch, Logtail)
- Create alerts for high bounce rate (> 5%)
- Create alerts for send failures (> 2%)

---

#### 6.3 Email Delivery Metrics in Database

Create `email_logs` collection (optional):

```typescript
{
  _id: ObjectId,
  organizationId: ObjectId,
  recipientEmail: string,
  emailType: 'invitation' | 'welcome' | 'payment_success' | 'payment_failed' | 'usage_alert' | 'subscription_canceled',
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed',
  messageId: string,  // SendGrid message ID
  sentAt: Date,
  deliveredAt: Date | null,
  openedAt: Date | null,
  clickedAt: Date | null,
  error: string | null
}
```

**Indexes:**
- `{ organizationId: 1, sentAt: -1 }` - Recent emails
- `{ messageId: 1 }` - Unique lookup
- `{ emailType: 1, status: 1 }` - Analytics

**Use Cases:**
- Admin dashboard: "Email Delivery Status"
- Debugging: Why didn't user receive invitation?
- Analytics: Open rates by email type

---

### Task 7: Documentation (1 hour)

#### 7.1 Create Email Management Guide

File: `docs/setup/email-configuration.md`

**Contents:**
1. SendGrid setup instructions
2. Environment variable configuration
3. Domain authentication guide
4. Email template customization
5. Troubleshooting common issues
6. Analytics and monitoring

---

#### 7.2 Update Existing Docs

**Update `CLAUDE.md`:**
```markdown
## Email Configuration

### SendGrid Integration (Phase 5)
- Provider: SendGrid
- Templates: Invitation, Welcome, Payment, Usage Alerts
- Configuration: See docs/setup/email-configuration.md
- Monitoring: SendGrid Dashboard → Email Activity

### Environment Variables
```env
SENDGRID_API_KEY=SG.xxxxx
FROM_EMAIL=noreply@automation.keinar.com
FROM_NAME=Agnostic Automation Center
```
```

**Update `README.md`:**
Add section on email notifications and testing.

---

## File Structure Changes

### New Files
```
apps/producer-service/src/
├── utils/
│   ├── email.ts                    # Updated with SendGrid
│   └── emailRetry.ts               # New: Retry logic
└── types/
    └── email.types.ts              # New: Email interfaces

docs/
├── setup/
│   └── email-configuration.md      # New: Email setup guide
└── implementation/
    └── phase-5/
        ├── phase-5-sprint-1-sendgrid-plan.md  # This document
        └── email-templates-guide.md           # New: Template customization
```

### Modified Files
```
apps/producer-service/
├── package.json                    # Add @sendgrid/mail
├── src/
│   ├── routes/
│   │   ├── auth.ts                 # Add welcome emails
│   │   ├── webhooks.ts             # Add payment/cancellation emails
│   │   └── organization.ts         # Add usage alert emails
│   └── utils/
│       └── email.ts                # Implement SendGrid

docker-compose.yml                  # Add SENDGRID_API_KEY
docker-compose.prod.yml             # Add SENDGRID_API_KEY
.env.example                        # Document SendGrid vars
CLAUDE.md                           # Document email config
```

---

## Environment Variables Summary

### Required
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@automation.keinar.com
FROM_NAME=Agnostic Automation Center
FRONTEND_URL=https://automation.keinar.com
```

### Optional (with defaults)
```env
# Email retry settings
EMAIL_RETRY_MAX_ATTEMPTS=3
EMAIL_RETRY_INITIAL_DELAY=1000

# Tracking
EMAIL_TRACKING_ENABLED=true
EMAIL_OPEN_TRACKING=true
EMAIL_CLICK_TRACKING=true
```

---

## Testing Checklist

### Unit Tests
- [ ] Email template generation (HTML + Plain Text)
- [ ] SendGrid client initialization
- [ ] Error handling (invalid API key, network failure)
- [ ] Retry logic (transient failures)

### Integration Tests
- [ ] Send invitation email (end-to-end)
- [ ] Send welcome email (signup + invitation accept)
- [ ] Send payment success email (webhook)
- [ ] Send payment failed email (webhook)
- [ ] Send usage alert email (threshold reached)
- [ ] Send subscription canceled email (webhook)

### Manual Tests
- [ ] Emails appear in inbox (not spam)
- [ ] HTML rendering correct (multiple email clients)
- [ ] Links work correctly
- [ ] Mobile responsive
- [ ] Plain text fallback works

### Production Tests
- [ ] Domain authentication working
- [ ] Deliverability > 98%
- [ ] Open rate > 20%
- [ ] No bounces on valid emails
- [ ] SendGrid analytics accessible

---

## Rollback Plan

If email delivery issues occur in production:

1. **Immediate Rollback:**
   ```bash
   # Disable SendGrid, revert to console logging
   docker exec -it automation-producer \
     sh -c 'export SENDGRID_API_KEY="" && pm2 restart all'
   ```

2. **Code Rollback:**
   ```bash
   git revert <commit-hash>
   docker-compose down
   docker-compose up --build -d
   ```

3. **Investigate:**
   - Check SendGrid Activity Feed
   - Review error logs: `docker logs automation-producer`
   - Check DNS records (domain auth)
   - Verify API key permissions

4. **Fix & Re-deploy:**
   - Fix identified issue
   - Test in development
   - Deploy to production

---

## Success Criteria

### Functional Requirements ✅
- [ ] All email types implemented and tested
- [ ] Emails delivered to inbox (not spam)
- [ ] HTML and plain text versions work
- [ ] Links and CTAs function correctly
- [ ] SendGrid integration configured

### Technical Requirements ✅
- [ ] Email send latency < 2 seconds
- [ ] Delivery rate > 98%
- [ ] Error handling prevents crashes
- [ ] Retry logic handles transient failures
- [ ] Logging captures all email events

### User Experience ✅
- [ ] Professional, branded email design
- [ ] Clear subject lines
- [ ] Actionable CTAs
- [ ] Mobile responsive
- [ ] Helpful error messages (if send fails)

### Security ✅
- [ ] API key stored securely (env vars)
- [ ] No sensitive data in email logs
- [ ] Domain authentication enabled
- [ ] HTTPS for all links
- [ ] Unsubscribe option (if applicable)

---

## Timeline

### Day 1: Setup & Core Implementation
- **Morning (3 hours):**
  - Task 1: SendGrid setup and configuration
  - Task 2: Implement SendGrid service

- **Afternoon (4 hours):**
  - Task 3: Implement email templates (invitation, welcome, payment)
  - Task 4: Integrate into auth and webhook flows

### Day 2: Testing & Documentation
- **Morning (3 hours):**
  - Task 5: Testing (development + production)
  - Fix any issues discovered

- **Afternoon (2 hours):**
  - Task 6: Monitoring setup
  - Task 7: Documentation
  - Final review and deployment

**Total Estimated Time:** 12 hours (1.5 days)

---

## Risks & Mitigations

### Risk 1: Emails Going to Spam
**Impact:** High - Users won't receive critical notifications
**Likelihood:** Medium (without domain authentication)

**Mitigation:**
- Set up domain authentication (SPF, DKIM)
- Use verified sender email
- Include unsubscribe link
- Avoid spam trigger words in subject lines
- Monitor spam rate in SendGrid analytics

---

### Risk 2: SendGrid Rate Limits
**Impact:** Medium - Emails delayed during high traffic
**Likelihood:** Low (free tier: 100/day, team tier: 40,000/day)

**Mitigation:**
- Monitor daily send volume
- Upgrade SendGrid plan if approaching limit
- Implement queuing for non-critical emails
- Add retry logic with backoff

---

### Risk 3: Email Template Rendering Issues
**Impact:** Medium - Poor user experience
**Likelihood:** Medium (email clients vary widely)

**Mitigation:**
- Test in multiple email clients (Gmail, Outlook, Apple Mail)
- Use email-safe HTML (tables, inline CSS)
- Provide plain text fallback
- Use email testing tools (Litmus, Email on Acid)

---

### Risk 4: API Key Exposure
**Impact:** Critical - Unauthorized email sending
**Likelihood:** Low (with proper practices)

**Mitigation:**
- Store in environment variables only
- Never commit to git
- Rotate key if compromised
- Use minimal required permissions
- Monitor SendGrid activity for anomalies

---

## Future Enhancements (Phase 6+)

1. **Email Templates Library:**
   - Visual template editor
   - A/B testing for subject lines
   - Personalization tokens

2. **Advanced Analytics:**
   - Open rate by email type
   - Click-through rate tracking
   - Engagement heatmaps

3. **Email Preferences:**
   - User preference center
   - Frequency control (daily digest vs. real-time)
   - Category subscriptions (alerts, marketing, product)

4. **Transactional Email API:**
   - Webhooks for email events (opened, clicked)
   - Real-time delivery status
   - Bounce handling automation

5. **Multi-Language Support:**
   - Detect user locale
   - Translate email templates
   - Date/time formatting per locale

---

## Appendix A: SendGrid Pricing Tiers

| Plan | Price | Emails/Month | Features |
|------|-------|--------------|----------|
| Free | $0 | 100/day (3,000/mo) | Basic analytics, domain auth |
| Essentials | $15 | 50,000 | Email validation, dedicated IP |
| Pro | $90 | 100,000 | Advanced analytics, A/B testing |
| Premier | Custom | Custom | Custom volume, dedicated account manager |

**Recommendation:** Start with Free tier, upgrade to Essentials when exceeding 3,000 emails/month.

---

## Appendix B: Email Template Design Guidelines

### Subject Lines
- **Length:** 40-50 characters (mobile preview)
- **Clarity:** Be specific and actionable
- **Personalization:** Include organization name when relevant
- **Avoid:** ALL CAPS, excessive punctuation (!!!)

**Examples:**
- ✅ "You're invited to join Acme Corp"
- ✅ "Payment successful - Team Plan renewed"
- ✅ "Heads up: 80% of test runs used this month"
- ❌ "URGENT!!! Your payment failed!!!"

### HTML Email Best Practices
- **Width:** Max 600px (mobile-friendly)
- **Tables:** Use table-based layout (old email clients)
- **Inline CSS:** Avoid `<style>` tags or external CSS
- **Images:** Host externally, include alt text
- **Fonts:** Web-safe fonts (Arial, Helvetica, Georgia)
- **Colors:** High contrast, accessible (WCAG 2.1)
- **CTAs:** Large buttons (min 44px height), clear text

### Plain Text Version
- Always provide plain text alternative
- Readable without HTML formatting
- Include full URLs (not just "Click here")
- Use ASCII characters for visual separation

---

## Appendix C: Sample Email Templates

### Invitation Email (Already Implemented)
See `apps/producer-service/src/utils/email.ts`

### Welcome Email (To Implement)
**Subject:** Welcome to Agnostic Automation Center!

**Preview Text:** Get started with your automation testing platform in 3 easy steps.

**Content:**
- Hero: Welcome banner
- Body: Quick start guide (3 steps)
- CTA: "Create Your First Project"
- Footer: Support links, social media

### Payment Success Email (To Implement)
**Subject:** Payment successful - [Plan] renewed

**Preview Text:** Your subscription has been renewed. Next billing date: [Date]

**Content:**
- Confirmation message
- Invoice details (amount, date, plan)
- Link to download invoice PDF
- Next billing date
- CTA: "View Billing Details"

### Usage Alert Email (To Implement)
**Subject:** You've used [X]% of your [Resource] limit

**Preview Text:** Upgrade your plan to continue enjoying uninterrupted service.

**Content:**
- Alert message with severity indicator
- Visual progress bar
- Current usage vs. limit
- Impact if limit reached
- CTA: "Upgrade Plan" or "View Usage"

---

**Document Version:** 1.0
**Last Updated:** 2026-02-06
**Status:** Plan Approved, Ready for Implementation
**Estimated Completion:** 2026-02-08
