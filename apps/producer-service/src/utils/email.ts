/**
 * Email Utilities
 *
 * Handles email template generation and sending for the multi-tenant system.
 *
 * Phase 5: SendGrid integration for production email delivery
 */

import sgMail from '@sendgrid/mail';

// ===================================================================
// SendGrid Initialization
// ===================================================================

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@agnox.dev';
const FROM_NAME = process.env.FROM_NAME || 'Agnostic Automation Center';
const EMAIL_TRACKING_ENABLED = process.env.EMAIL_TRACKING_ENABLED !== 'false';
const EMAIL_OPEN_TRACKING = process.env.EMAIL_OPEN_TRACKING !== 'false';
const EMAIL_CLICK_TRACKING = process.env.EMAIL_CLICK_TRACKING !== 'false';

// Initialize SendGrid if API key is provided
if (SENDGRID_API_KEY && SENDGRID_API_KEY.startsWith('SG.')) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized successfully');
  console.log(`   From: ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log(`   Tracking: Open=${EMAIL_OPEN_TRACKING}, Click=${EMAIL_CLICK_TRACKING}`);
} else {
  console.warn('⚠️  SendGrid API key not configured. Emails will be logged to console only.');
  console.warn('   Set SENDGRID_API_KEY in .env to enable production email delivery.');
}

// ===================================================================
// Type Definitions
// ===================================================================

/**
 * Email parameters for invitation emails
 */
export interface IInvitationEmailParams {
  recipientEmail: string;
  recipientName?: string;
  organizationName: string;
  inviterName: string;
  role: 'admin' | 'developer' | 'viewer';
  inviteToken: string; // Plain token (only sent via email, never stored)
  expiresAt: Date;
  actionType: 'signup' | 'join'; // Determines email content
}

/**
 * Email result
 */
export interface IEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email parameters for welcome emails
 */
export interface IWelcomeEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  role: 'admin' | 'developer' | 'viewer';
  isNewOrganization: boolean;
}

/**
 * Email parameters for payment success emails
 */
export interface IPaymentSuccessEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'team' | 'enterprise';
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceUrl: string;
}

/**
 * Email parameters for payment failed emails
 */
export interface IPaymentFailedEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'team' | 'enterprise';
  amount: number;
  failureReason: string;
  retryDate: Date | null;
  updatePaymentUrl: string;
}

/**
 * Email parameters for usage alert emails
 */
export interface IUsageAlertEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'free' | 'team' | 'enterprise';
  resource: 'testRuns' | 'users' | 'storage' | 'projects';
  current: number;
  limit: number;
  percentage: number;
  severity: 'info' | 'warning' | 'critical' | 'blocked';
  upgradeUrl: string;
}

/**
 * Email parameters for subscription canceled emails
 */
export interface ISubscriptionCanceledEmailParams {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  plan: 'team' | 'enterprise';
  canceledAt: Date;
  effectiveDate: Date;
  cancelAtPeriodEnd: boolean;
  feedbackUrl?: string;
}

/**
 * Generate HTML email template for invitation
 *
 * Creates professional HTML email with proper styling and branding.
 *
 * @param params - Invitation email parameters
 * @returns HTML email content
 */
export function generateInvitationEmailHTML(params: IInvitationEmailParams): string {
  const {
    recipientEmail,
    recipientName,
    organizationName,
    inviterName,
    role,
    inviteToken,
    expiresAt,
    actionType
  } = params;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const inviteUrl = `${frontendUrl}/${actionType}?token=${inviteToken}`;

  // Format role for display
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  // Calculate days until expiration
  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Different content based on action type
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const actionButton = actionType === 'signup' ? 'Create Account' : 'Accept Invitation';
  const actionDescription = actionType === 'signup'
    ? 'To get started, create your account by clicking the button below:'
    : 'To join the team, login to your account and accept the invitation:';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                🎉 You're Invited!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                ${greeting}
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${roleDisplay}</strong>.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 24px; color: #333333;">
                ${actionDescription}
              </p>

              <!-- Call to Action Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${inviteUrl}"
                       style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      ${actionButton}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Role Permissions -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 0 0 30px; border-radius: 4px;">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #333333;">
                  Your Role: ${roleDisplay}
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #666666;">
                  ${getRoleDescription(role)}
                </p>
              </div>

              <!-- Expiration Notice -->
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 20px; color: #666666;">
                ⏰ This invitation will expire in <strong>${daysUntilExpiry} days</strong> (${expiresAt.toLocaleDateString()}).
              </p>

              <!-- Manual Link (fallback) -->
              <p style="margin: 0 0 10px; font-size: 12px; line-height: 18px; color: #999999;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px; font-size: 12px; line-height: 18px; color: #667eea; word-break: break-all;">
                ${inviteUrl}
              </p>

              <!-- Help Text -->
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #666666;">
                Need help? Contact ${inviterName} at ${organizationName}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; font-size: 12px; line-height: 18px; color: #999999;">
                Sent by <strong>Agnostic Automation Center</strong>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999;">
                You received this email because ${inviterName} invited you to join their team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for invitation
 *
 * Creates plain text version for email clients that don't support HTML.
 *
 * @param params - Invitation email parameters
 * @returns Plain text email content
 */
export function generateInvitationEmailPlainText(params: IInvitationEmailParams): string {
  const {
    recipientEmail,
    recipientName,
    organizationName,
    inviterName,
    role,
    inviteToken,
    expiresAt,
    actionType
  } = params;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const inviteUrl = `${frontendUrl}/${actionType}?token=${inviteToken}`;

  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
  const actionText = actionType === 'signup'
    ? 'To get started, create your account by visiting the link below:'
    : 'To join the team, login to your account and accept the invitation:';

  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return `
You're Invited to Join ${organizationName}!

${greeting}

${inviterName} has invited you to join ${organizationName} as a ${roleDisplay}.

${actionText}

${inviteUrl}

YOUR ROLE: ${roleDisplay}
${getRoleDescription(role)}

IMPORTANT: This invitation will expire in ${daysUntilExpiry} days (${expiresAt.toLocaleDateString()}).

Need help? Contact ${inviterName} at ${organizationName}.

---
Sent by Agnostic Automation Center
You received this email because ${inviterName} invited you to join their team.
  `.trim();
}

/**
 * Get role description for email
 *
 * @param role - User role
 * @returns Human-readable role description
 */
function getRoleDescription(role: 'admin' | 'developer' | 'viewer'): string {
  switch (role) {
    case 'admin':
      return 'Full access to the organization, including user management, settings, billing, and all testing features.';
    case 'developer':
      return 'Can run tests, edit test configurations, and view results. Cannot manage users or organization settings.';
    case 'viewer':
      return 'Read-only access to view test results and reports. Cannot run tests or modify anything.';
    default:
      return 'Access to the organization.';
  }
}

// ===================================================================
// Additional Email Templates (Phase 5)
// ===================================================================

/**
 * Generate HTML for welcome email
 */
export function generateWelcomeEmailHTML(params: IWelcomeEmailParams): string {
  const { recipientName, organizationName, role, isNewOrganization } = params;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                ${isNewOrganization ? '🎉 Welcome to Agnostic Automation Center!' : `👋 Welcome to ${organizationName}!`}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Hi ${recipientName},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                ${isNewOrganization
      ? `Your organization <strong>${organizationName}</strong> has been created successfully! You're all set to start automating your tests.`
      : `You've successfully joined <strong>${organizationName}</strong> as a <strong>${roleDisplay}</strong>.`
    }
              </p>
              ${isNewOrganization ? `
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 0 0 30px; border-radius: 4px;">
                <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">
                  🚀 Get Started in 3 Steps:
                </p>
                <p style="margin: 0 0 10px; font-size: 14px; line-height: 20px; color: #666666;">
                  <strong>1. Create your first project</strong><br/>
                  Set up your test suite with your preferred framework (Playwright, Cypress, Selenium, etc.)
                </p>
                <p style="margin: 0 0 10px; font-size: 14px; line-height: 20px; color: #666666;">
                  <strong>2. Configure your Docker image</strong><br/>
                  Specify the test environment and dependencies
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #666666;">
                  <strong>3. Run your first test</strong><br/>
                  Trigger automated tests and get AI-powered failure analysis
                </p>
              </div>
              ` : `
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 0 0 30px; border-radius: 4px;">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #333333;">
                  Your Role: ${roleDisplay}
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #666666;">
                  ${getRoleDescription(role)}
                </p>
              </div>
              `}
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${frontendUrl}"
                       style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #666666;">
                Questions? Check our <a href="${frontendUrl}/docs" style="color: #667eea; text-decoration: none;">documentation</a> or reach out to support.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; font-size: 12px; line-height: 18px; color: #999999;">
                Sent by <strong>Agnostic Automation Center</strong>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999;">
                Your language-agnostic test automation platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text for welcome email
 */
export function generateWelcomeEmailPlainText(params: IWelcomeEmailParams): string {
  const { recipientName, organizationName, role, isNewOrganization } = params;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  return `
${isNewOrganization ? 'Welcome to Agnostic Automation Center!' : `Welcome to ${organizationName}!`}

Hi ${recipientName},

${isNewOrganization
      ? `Your organization "${organizationName}" has been created successfully! You're all set to start automating your tests.`
      : `You've successfully joined ${organizationName} as a ${roleDisplay}.`}

${isNewOrganization ? `
GET STARTED IN 3 STEPS:

1. Create your first project
   Set up your test suite with your preferred framework (Playwright, Cypress, Selenium, etc.)

2. Configure your Docker image
   Specify the test environment and dependencies

3. Run your first test
   Trigger automated tests and get AI-powered failure analysis
` : `
YOUR ROLE: ${roleDisplay}
${getRoleDescription(role)}
`}

Go to Dashboard: ${frontendUrl}

Questions? Check our documentation or reach out to support.

---
Sent by Agnostic Automation Center
Your language-agnostic test automation platform
  `.trim();
}

/**
 * Send invitation email
 *
 * Phase 5: Production SendGrid integration with retry logic
 *
 * @param params - Invitation email parameters
 * @returns Email result
 */
export async function sendInvitationEmail(params: IInvitationEmailParams): Promise<IEmailResult> {
  const htmlContent = generateInvitationEmailHTML(params);
  const plainTextContent = generateInvitationEmailPlainText(params);

  // Development mode or no API key: Console logging only
  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 INVITATION EMAIL (Development Mode - Console Only)');
    console.log('='.repeat(80));
    console.log(`To: ${params.recipientEmail}`);
    console.log(`From: ${FROM_NAME} <${FROM_EMAIL}>`);
    console.log(`Subject: You're invited to join ${params.organizationName}`);
    console.log(`Action: ${params.actionType === 'signup' ? 'Create Account' : 'Join Organization'}`);
    console.log(`Role: ${params.role}`);
    console.log(`Expires: ${params.expiresAt.toISOString()}`);
    console.log('-'.repeat(80));
    console.log('PLAIN TEXT VERSION:');
    console.log('-'.repeat(80));
    console.log(plainTextContent);
    console.log('='.repeat(80));
    console.log('💡 HTML version available (not shown in console)');
    console.log('📝 To enable SendGrid, set SENDGRID_API_KEY in .env');
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      messageId: `dev-${Date.now()}`
    };
  }

  // Production mode: Send via SendGrid
  try {
    const msg = {
      to: params.recipientEmail,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `You're invited to join ${params.organizationName}`,
      text: plainTextContent,
      html: htmlContent,
      // Tracking settings
      trackingSettings: {
        clickTracking: {
          enable: EMAIL_CLICK_TRACKING,
          enableText: EMAIL_CLICK_TRACKING
        },
        openTracking: {
          enable: EMAIL_OPEN_TRACKING
        }
      },
      // Categories for analytics
      categories: ['invitation', params.actionType, params.role]
    };

    const result = await sgMail.send(msg);

    console.log(`✅ Invitation email sent to ${params.recipientEmail}`);
    console.log(`   Organization: ${params.organizationName}`);
    console.log(`   Role: ${params.role}`);
    console.log(`   Message ID: ${result[0].headers['x-message-id']}`);

    return {
      success: true,
      messageId: result[0].headers['x-message-id'] as string
    };

  } catch (error: any) {
    console.error('❌ Failed to send invitation email:', error.message);

    // Log detailed error for debugging
    if (error.response) {
      console.error('SendGrid Error Details:', {
        statusCode: error.response.statusCode,
        body: error.response.body?.errors || error.response.body
      });
    }

    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

/**
 * Send welcome email to new user
 *
 * @param email - User email
 * @param name - User name
 * @param organizationName - Organization name
 * @param role - User role (optional)
 * @param isNewOrganization - Whether this is a new organization signup
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  organizationName: string,
  role: 'admin' | 'developer' | 'viewer' = 'developer',
  isNewOrganization: boolean = false
): Promise<IEmailResult> {
  const params: IWelcomeEmailParams = {
    recipientEmail: email,
    recipientName: name,
    organizationName,
    role,
    isNewOrganization
  };

  const htmlContent = generateWelcomeEmailHTML(params);
  const textContent = generateWelcomeEmailPlainText(params);

  const subject = isNewOrganization
    ? 'Welcome to Agnostic Automation Center!'
    : `Welcome to ${organizationName}!`;

  // Development mode or no API key: Console logging only
  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log(`📧 Welcome email would be sent to ${email} (${name}) at ${organizationName}`);
    return { success: true, messageId: `dev-welcome-${Date.now()}` };
  }

  // Production mode: Send via SendGrid
  try {
    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject,
      text: textContent,
      html: htmlContent,
      trackingSettings: {
        clickTracking: { enable: EMAIL_CLICK_TRACKING },
        openTracking: { enable: EMAIL_OPEN_TRACKING }
      },
      categories: ['welcome', isNewOrganization ? 'new-org' : 'team-member', role]
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Welcome email sent to ${email}`);

    return {
      success: true,
      messageId: result[0].headers['x-message-id'] as string
    };

  } catch (error: any) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
    return {
      success: false,
      error: error.message || 'Failed to send welcome email'
    };
  }
}

/**
 * Send payment success email
 *
 * Sent when payment is successfully processed
 */
export async function sendPaymentSuccessEmail(params: IPaymentSuccessEmailParams): Promise<IEmailResult> {
  const { recipientEmail, recipientName, organizationName, plan, amount, currency, periodStart, periodEnd, invoiceUrl } = params;

  const subject = `Payment successful - ${plan} plan renewed`;
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);

  const textContent = `
Hi ${recipientName},

Your payment for ${organizationName} has been processed successfully.

PAYMENT DETAILS:
- Plan: ${planDisplay}
- Amount: $${amount.toFixed(2)} ${currency.toUpperCase()}
- Billing Period: ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}
- Next Billing Date: ${periodEnd.toLocaleDateString()}

View Invoice: ${invoiceUrl}

Thank you for your continued support!

Best regards,
The Agnostic Automation Center Team
  `.trim();

  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log(`📧 Payment success email would be sent to ${recipientEmail}`);
    return { success: true, messageId: `dev-payment-success-${Date.now()}` };
  }

  try {
    const msg = {
      to: recipientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text: textContent,
      trackingSettings: {
        clickTracking: { enable: EMAIL_CLICK_TRACKING },
        openTracking: { enable: EMAIL_OPEN_TRACKING }
      },
      categories: ['payment', 'success', plan]
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Payment success email sent to ${recipientEmail}`);
    return { success: true, messageId: result[0].headers['x-message-id'] as string };
  } catch (error: any) {
    console.error(`❌ Failed to send payment success email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send payment failed email
 *
 * Sent when payment processing fails
 */
export async function sendPaymentFailedEmail(params: IPaymentFailedEmailParams): Promise<IEmailResult> {
  const { recipientEmail, recipientName, organizationName, plan, amount, failureReason, retryDate, updatePaymentUrl } = params;

  const subject = `Action required: Payment failed for ${organizationName}`;
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);

  const textContent = `
Hi ${recipientName},

We were unable to process your payment for ${organizationName}.

PAYMENT DETAILS:
- Plan: ${planDisplay}
- Amount: $${amount.toFixed(2)}
- Reason: ${failureReason}
${retryDate ? `- Next Retry: ${retryDate.toLocaleDateString()}` : ''}

ACTION REQUIRED:
Please update your payment method to continue using the ${planDisplay} plan.

Update Payment Method: ${updatePaymentUrl}

Your service will remain active until ${retryDate ? retryDate.toLocaleDateString() : 'the end of your current billing period'}.

If you need assistance, please contact our support team.

Best regards,
The Agnostic Automation Center Team
  `.trim();

  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log(`📧 Payment failed email would be sent to ${recipientEmail}`);
    return { success: true, messageId: `dev-payment-failed-${Date.now()}` };
  }

  try {
    const msg = {
      to: recipientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text: textContent,
      trackingSettings: {
        clickTracking: { enable: EMAIL_CLICK_TRACKING },
        openTracking: { enable: EMAIL_OPEN_TRACKING }
      },
      categories: ['payment', 'failed', plan]
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Payment failed email sent to ${recipientEmail}`);
    return { success: true, messageId: result[0].headers['x-message-id'] as string };
  } catch (error: any) {
    console.error(`❌ Failed to send payment failed email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send usage alert email
 *
 * Sent when usage approaches or exceeds limits
 */
export async function sendUsageAlertEmail(params: IUsageAlertEmailParams): Promise<IEmailResult> {
  const { recipientEmail, recipientName, organizationName, plan, resource, current, limit, percentage, severity, upgradeUrl } = params;

  const resourceNames: Record<string, string> = {
    testRuns: 'Test Runs',
    users: 'Users',
    storage: 'Storage',
    projects: 'Projects'
  };

  const resourceName = resourceNames[resource] || resource;
  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
    blocked: '🛑'
  }[severity];

  const subject = severity === 'blocked'
    ? `${resourceName} limit reached for ${organizationName}`
    : `${severityEmoji} ${Math.round(percentage)}% of ${resourceName} used`;

  const textContent = `
Hi ${recipientName},

${severity === 'blocked'
      ? `You've reached your ${resourceName} limit for ${organizationName}.`
      : `You've used ${Math.round(percentage)}% of your ${resourceName} limit.`
    }

USAGE DETAILS:
- Resource: ${resourceName}
- Current Usage: ${current}
- Plan Limit: ${limit}
- Percentage: ${Math.round(percentage)}%
- Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}

${severity === 'blocked' || severity === 'critical'
      ? `To continue using ${resourceName}, please upgrade your plan:\n${upgradeUrl}`
      : `Consider upgrading if you need more capacity:\n${upgradeUrl}`
    }

Need help? Contact our support team.

Best regards,
The Agnostic Automation Center Team
  `.trim();

  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log(`📧 Usage alert email would be sent to ${recipientEmail} (${severity})`);
    return { success: true, messageId: `dev-usage-alert-${Date.now()}` };
  }

  try {
    const msg = {
      to: recipientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text: textContent,
      trackingSettings: {
        clickTracking: { enable: EMAIL_CLICK_TRACKING },
        openTracking: { enable: EMAIL_OPEN_TRACKING }
      },
      categories: ['usage-alert', severity, resource]
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Usage alert email sent to ${recipientEmail} (${severity})`);
    return { success: true, messageId: result[0].headers['x-message-id'] as string };
  } catch (error: any) {
    console.error(`❌ Failed to send usage alert email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send subscription canceled email
 *
 * Sent when user cancels their subscription
 */
export async function sendSubscriptionCanceledEmail(params: ISubscriptionCanceledEmailParams): Promise<IEmailResult> {
  const { recipientEmail, recipientName, organizationName, plan, canceledAt, effectiveDate, cancelAtPeriodEnd, feedbackUrl } = params;

  const subject = `Subscription canceled for ${organizationName}`;
  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);

  const textContent = `
Hi ${recipientName},

We've received your cancellation request for ${organizationName}.

CANCELLATION DETAILS:
- Plan: ${planDisplay}
- Canceled On: ${canceledAt.toLocaleDateString()}
- Service Ends: ${effectiveDate.toLocaleDateString()}
${cancelAtPeriodEnd
      ? `\nYour ${planDisplay} plan will remain active until ${effectiveDate.toLocaleDateString()}. After that, your organization will be downgraded to the Free plan.`
      : '\nYour subscription has been canceled immediately and downgraded to the Free plan.'
    }

WHAT HAPPENS NEXT:
- Your test data will be retained
- You'll have access to Free plan features (100 test runs/month, 5 projects, 3 users)
- You can reactivate your subscription anytime

${feedbackUrl ? `We'd love to hear your feedback: ${feedbackUrl}\n\n` : ''}Want to reactivate? Contact our support team anytime.

Best regards,
The Agnostic Automation Center Team
  `.trim();

  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log(`📧 Subscription canceled email would be sent to ${recipientEmail}`);
    return { success: true, messageId: `dev-subscription-canceled-${Date.now()}` };
  }

  try {
    const msg = {
      to: recipientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text: textContent,
      trackingSettings: {
        clickTracking: { enable: EMAIL_CLICK_TRACKING },
        openTracking: { enable: EMAIL_OPEN_TRACKING }
      },
      categories: ['subscription', 'canceled', plan]
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Subscription canceled email sent to ${recipientEmail}`);
    return { success: true, messageId: result[0].headers['x-message-id'] as string };
  } catch (error: any) {
    console.error(`❌ Failed to send subscription canceled email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 *
 * @param email - User email
 * @param name - User name (optional)
 * @param resetToken - Password reset token
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  name?: string
): Promise<IEmailResult> {
  const resetUrl = `${process.env.FRONTEND_URL || 'https://agnox.dev'}/reset-password?token=${resetToken}`;
  const greeting = name ? `Hi ${name},` : 'Hello,';

  const textContent = `
${greeting}

We received a request to reset your password for your Agnostic Automation Center account.

To reset your password, click the link below (or copy and paste it into your browser):

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

Need help? Contact our support team.

Best regards,
The Agnostic Automation Center Team
  `.trim();

  // Development mode or no API key: Console logging only
  if (!SENDGRID_API_KEY || !SENDGRID_API_KEY.startsWith('SG.')) {
    console.log(`📧 Password reset email would be sent to ${email}`);
    console.log(`   Reset URL: ${resetUrl}`);
    return { success: true, messageId: `dev-reset-${Date.now()}` };
  }

  // Production mode: Send via SendGrid
  try {
    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: 'Reset your password',
      text: textContent,
      // TODO: Add HTML template in Task #5
      trackingSettings: {
        clickTracking: { enable: EMAIL_CLICK_TRACKING },
        openTracking: { enable: EMAIL_OPEN_TRACKING }
      },
      categories: ['password-reset', 'security']
    };

    const result = await sgMail.send(msg);
    console.log(`✅ Password reset email sent to ${email}`);

    return {
      success: true,
      messageId: result[0].headers['x-message-id'] as string
    };

  } catch (error: any) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error.message);
    return {
      success: false,
      error: error.message || 'Failed to send password reset email'
    };
  }
}

console.log('📧 Email Utilities Loaded');
console.log('  - Invitation email templates (HTML + Plain Text)');
console.log('  - Welcome email (basic template)');
console.log('  - Password reset email (basic template)');
console.log('  - Role-based permission descriptions');
if (SENDGRID_API_KEY && SENDGRID_API_KEY.startsWith('SG.')) {
  console.log('  - ✅ SendGrid integration active (production mode)');
} else {
  console.log('  - 📝 Console logging mode (development)');
}
