# User Guide

Complete walkthrough of the Agnostic Automation Center platform features.

---

## 1. Getting Started

### Sign Up (New Organization)

1. Navigate to the **Sign Up** page
2. Enter your **email**, **password**, and **name**
3. Enter your **organization name** (your company/team name)
4. Click **Create Account**

> Your organization is created automatically in 10 seconds, and you become the **Admin**.

### Join via Invitation

1. Receive an email invitation from an existing team member
2. Click the **Accept Invitation** link in the email
3. If new user: Create your account with the invitation token
4. If existing user: Log in to join the new organization

---

## 2. Team Management

### Inviting Team Members (Admin Only)

1. Go to **Settings** → **Team Members** tab
2. Click **Invite Member**
3. Enter the invitee's **email** and select their **role**:
   - **Admin**: Full access, can manage billing, team, and settings
   - **Developer**: Can run tests, view results, limited settings access
   - **Viewer**: Read-only access to test results and dashboards
4. Click **Send Invitation**

### Managing Roles (Admin Only)

1. Go to **Settings** → **Team Members** tab
2. Find the user in the members list
3. Use the **role dropdown** to change their role
4. Changes take effect immediately

### Removing Members (Admin Only)

1. Go to **Settings** → **Team Members** tab
2. Click the **Remove** button next to the user
3. Confirm removal

> Note: The last admin cannot be removed to prevent lockout.

---

## 3. Profile Settings

### Updating Your Name

1. Go to **Settings** → **My Profile** tab
2. Edit your **Name** field
3. Click **Save Changes**

> Email and Role are read-only and displayed for reference.

---

## 4. Organization Settings

### Editing Organization Name (Admin Only)

1. Go to **Settings** → **Organization** tab
2. Edit the **Organization Name** field
3. Click **Save Changes**

> Non-admins can view but not edit organization settings.

---

## 5. Billing & Plans

### Viewing Current Plan

1. Go to **Settings** → **Billing & Plans** tab
2. View your current plan details and limits

### Upgrading Your Plan (Admin Only)

1. Go to **Settings** → **Billing & Plans** tab
2. Click **Upgrade Plan** on your desired tier
3. Complete payment via Stripe Checkout
4. Your plan upgrades immediately

### Plan Limits

| Feature | Free | Team | Enterprise |
|---------|------|------|------------|
| Test Runs/Month | 100 | 1,000 | Unlimited |
| Team Members | 3 | 10 | Unlimited |
| Concurrent Runs | 1 | 5 | 20 |
| AI Analysis | ❌ | ✅ | ✅ |

---

## 6. Usage Tracking

### Monitoring Usage

1. Go to **Settings** → **Usage** tab
2. View your current usage statistics:
   - Test runs this month
   - Team member count
   - Concurrent run capacity

### Usage Alerts

When approaching plan limits (80%), the dashboard displays warnings.

---

## 7. Running Tests

### From the Dashboard

1. Click **Run New Test** button
2. Fill in the execution modal:
   - **Docker Image**: e.g., `mcr.microsoft.com/playwright:v1.40.0`
   - **Command**: e.g., `npx playwright test`
   - **Environment**: Select Dev/Staging/Prod
3. Click **Start Execution**

### From CI/CD

Use the API with your JWT token:

```bash
curl -X POST https://your-api/api/execution-request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"image": "...", "command": "..."}'
```

---

## 8. Viewing Test Results

### Live Monitoring

- Watch test logs stream in real-time via WebSocket
- See execution status updates (Queued → Running → Passed/Failed)

### AI Analysis

When tests fail, click the **✨ icon** to view AI-powered root cause analysis.

> AI Analysis can be disabled organization-wide in **Settings** → **Organization**.

---

## Need Help?

- **Documentation**: See `/docs/` folder
- **Support**: info@digital-solution.co.il
