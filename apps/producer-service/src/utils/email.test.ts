/**
 * Email Utilities Test
 *
 * Demonstrates email template generation and provides examples
 * of both HTML and plain text invitation emails.
 *
 * Run this file to preview email templates:
 *   npx ts-node src/utils/email.test.ts
 */

import {
  generateInvitationEmailHTML,
  generateInvitationEmailPlainText,
  sendInvitationEmail,
  IInvitationEmailParams
} from './email';

// Example invitation for a NEW user (signup flow)
const signupInvitation: IInvitationEmailParams = {
  recipientEmail: 'newdev@example.com',
  recipientName: 'Sarah Johnson',
  organizationName: 'Acme Testing Inc',
  inviterName: 'John Smith',
  role: 'developer',
  inviteToken: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  actionType: 'signup'
};

// Example invitation for an EXISTING user (join flow)
const joinInvitation: IInvitationEmailParams = {
  recipientEmail: 'existing@example.com',
  recipientName: 'Mike Chen',
  organizationName: 'Tech Startup LLC',
  inviterName: 'Emily Davis',
  role: 'admin',
  inviteToken: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  actionType: 'join'
};

// Example invitation for a VIEWER role
const viewerInvitation: IInvitationEmailParams = {
  recipientEmail: 'viewer@example.com',
  organizationName: 'Beta QA Team',
  inviterName: 'Alice Williams',
  role: 'viewer',
  inviteToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  actionType: 'signup'
};

/**
 * Test email template generation
 */
async function testEmailTemplates() {
  console.log('\n🧪 EMAIL TEMPLATE TESTING\n');
  console.log('='.repeat(80));
  console.log('Testing invitation email templates for different scenarios...\n');

  // Test 1: New user signup invitation
  console.log('TEST 1: New User Signup (Developer Role)');
  console.log('='.repeat(80));
  await sendInvitationEmail(signupInvitation);

  // Test 2: Existing user join invitation
  console.log('\nTEST 2: Existing User Join (Admin Role)');
  console.log('='.repeat(80));
  await sendInvitationEmail(joinInvitation);

  // Test 3: Viewer role invitation
  console.log('\nTEST 3: New User Signup (Viewer Role)');
  console.log('='.repeat(80));
  await sendInvitationEmail(viewerInvitation);

  console.log('\n✅ All email template tests completed!\n');
}

/**
 * Generate HTML sample file
 */
function generateHTMLSample() {
  const htmlContent = generateInvitationEmailHTML(signupInvitation);
  const fs = require('fs');
  const path = require('path');

  const outputPath = path.join(__dirname, '../../email-sample.html');
  fs.writeFileSync(outputPath, htmlContent);

  console.log(`\n📄 HTML sample saved to: ${outputPath}`);
  console.log('   Open this file in a browser to preview the email design.\n');
}

/**
 * Compare HTML vs Plain Text
 */
function compareFormats() {
  console.log('\n📊 FORMAT COMPARISON\n');
  console.log('='.repeat(80));

  const htmlContent = generateInvitationEmailHTML(signupInvitation);
  const plainContent = generateInvitationEmailPlainText(signupInvitation);

  console.log(`HTML Length: ${htmlContent.length} characters`);
  console.log(`Plain Text Length: ${plainContent.length} characters`);
  console.log(`\nHTML/Plain Ratio: ${(htmlContent.length / plainContent.length).toFixed(2)}x`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Main test runner
 */
async function main() {
  console.clear();
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'EMAIL TEMPLATE TEST SUITE' + ' '.repeat(33) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  // Run tests
  await testEmailTemplates();

  // Generate HTML sample
  generateHTMLSample();

  // Compare formats
  compareFormats();

  console.log('✨ All tests completed successfully!\n');
}

// Run tests if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { testEmailTemplates, generateHTMLSample };
