# User Guide

Complete walkthrough of the Agnostic Automation Center platform features.

---

## 1. Getting Started

### Sign Up
1. Navigate to the **Sign Up** page.
2. Enter your **email**, **password**, and **name**.
3. Enter your **organization name** (your company/team name).
4. Click **Create Account**.

> Your organization is created automatically, and you become the **Admin**.

### Join via Invitation
1. Receive an email invitation from a team member.
2. Click the **Accept Invitation** link.
3. **New users:** Create an account with the token.
4. **Existing users:** Log in to join the new organization.

---

## 2. Project & Run Settings

Before running tests, you must configure your project settings.

### Creating a Project
1. Go to **Settings** → **Run Settings**.
2. Click **Create New Project**.
3. Enter:
   - **Project Name**: e.g., "Web App E2E"
   - **Docker Image**: The image you pushed to Docker Hub (e.g., `myuser/my-tests:latest`)
   - **Test Folder**: Path to tests inside container (default: `.` or `tests/`)

### Configuring Environments
For each project, define base URLs for your environments:
- **Development**
- **Staging**
- **Production**

These URLs are injected into your test container as `BASE_URL` at runtime.

---

## 3. Running Tests

## 3. Running Tests

### Option A: Via Dashboard (Primary)
1. Click **Run New Test** (top right).
2. Select your **Project** (settings are auto-filled).
3. Select the **Environment** (Dev/Staging/Prod).
4. (Optional) Override the command or folder.
5. Click **Start Execution**.

### Option B: Via API / CI/CD
See [API Keys section](#8-api-keys-cicd-integration) below.

### Note on CLI
The CLI (`aac-cli`) is currently used for **onboarding only** (initializing projects). Test execution is handled via the Dashboard or API to ensure centralized logging and analytics.

---

## 4. Team Management (Admin Only)

### Inviting Members
1. Go to **Settings** → **Team Members**.
2. Click **Invite Member**.
3. Enter email and select role:
   - **Admin**: Full access (billing, settings, invites)
   - **Developer**: Run tests, view results
   - **Viewer**: Read-only access

### Managing Roles
- **Promote/Demote**: Change roles via the dropdown in the member list.
- **Remove**: Click the trash icon to remove a member.

---

## 5. Billing & Plans

Manage subscriptions in **Settings** → **Billing & Plans**.

### Plan Limits

| Feature | Free | Team | Enterprise |
|---------|------|------|------------|
| **Test Runs/Month** | 100 | 1,000 | Unlimited |
| **Projects** | 1 | 10 | Unlimited |
| **Team Members** | 3 | 20 | Unlimited |
| **Concurrent Runs** | 1 | 5 | 20 |
| **Storage** | 1 GB | 10 GB | 100 GB |
| **AI Analysis** | ✅ | ✅ | ✅ |

> **Note:** Limits are enforced automatically. Upgrading takes effect immediately.

---

## 6. API Keys (CI/CD Integration)

Use API keys to authenticate CI/CD pipelines without sharing personal credentials.

### Generating a Key
1. Go to **Settings** → **Profile** → **API Access**.
2. Click **Generate New Key**.
3. Enter a label (e.g., "GitHub Actions").
4. **Copy the key** immediately (it won't be shown again).

### Using the Key
Add the `x-api-key` header to your requests:

```bash
curl -H "x-api-key: pk_live_..." ...
```

---

## 7. AI Analysis & Results

### Live Results
- Check the **Dashboard** for real-time logs via WebSocket.
- Status updates: `QUEUED` → `RUNNING` → `PASSED` / `FAILED`.

### AI Root Cause Analysis
If a test fails:
1. Click the **✨** icon next to the failure.
2. View the AI-generated diagnosis and suggested fix.
3. AI analysis can be disabled per-organization in **Settings** → **Organization**.

---

## 8. Support

- **Documentation**: [docs.automation.keinar.com](https://docs.automation.keinar.com)
- **Email**: info@digital-solution.co.il
