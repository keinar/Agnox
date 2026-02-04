/**
 * Email Utilities
 *
 * Handles email template generation and sending for the multi-tenant system.
 *
 * Phase 2: Console logging only (dev mode)
 * Phase 3: SendGrid integration for production
 */

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

/**
 * Send invitation email
 *
 * Phase 2: Logs email to console (dev mode)
 * Phase 3: Will integrate with SendGrid
 *
 * @param params - Invitation email parameters
 * @returns Email result
 */
export async function sendInvitationEmail(params: IInvitationEmailParams): Promise<IEmailResult> {
  const htmlContent = generateInvitationEmailHTML(params);
  const plainTextContent = generateInvitationEmailPlainText(params);

  // Phase 2: Console logging only
  if (process.env.NODE_ENV !== 'production' || !process.env.SENDGRID_API_KEY) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 INVITATION EMAIL (Development Mode - Console Only)');
    console.log('='.repeat(80));
    console.log(`To: ${params.recipientEmail}`);
    console.log(`From: ${params.inviterName} at ${params.organizationName}`);
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
    console.log('📝 In production, this will be sent via SendGrid');
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      messageId: `dev-${Date.now()}`
    };
  }

  // Phase 3: SendGrid integration
  try {
    // TODO: Implement SendGrid email sending
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    //
    // const msg = {
    //   to: params.recipientEmail,
    //   from: process.env.FROM_EMAIL || 'noreply@automation.keinar.com',
    //   subject: `You're invited to join ${params.organizationName}`,
    //   text: plainTextContent,
    //   html: htmlContent
    // };
    //
    // const result = await sgMail.send(msg);
    // return {
    //   success: true,
    //   messageId: result[0].headers['x-message-id']
    // };

    console.warn('⚠️  SendGrid not configured. Email not sent.');
    return {
      success: false,
      error: 'SendGrid not configured'
    };

  } catch (error: any) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

/**
 * Send welcome email to new user
 * (Future enhancement)
 *
 * @param email - User email
 * @param name - User name
 * @param organizationName - Organization name
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  organizationName: string
): Promise<IEmailResult> {
  // TODO: Implement welcome email template
  console.log(`📧 Welcome email would be sent to ${email} (${name}) at ${organizationName}`);
  return { success: true };
}

/**
 * Send password reset email
 * (Future enhancement)
 *
 * @param email - User email
 * @param resetToken - Password reset token
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<IEmailResult> {
  // TODO: Implement password reset email template
  console.log(`📧 Password reset email would be sent to ${email}`);
  return { success: true };
}

console.log('📧 Email Utilities Loaded');
console.log('  - Invitation email templates (HTML + Plain Text)');
console.log('  - Role-based permission descriptions');
console.log('  - Console logging for dev mode');
console.log('  - SendGrid integration ready (Phase 3)');
