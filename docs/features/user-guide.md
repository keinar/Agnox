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

## 2. Navigating the Dashboard

### Light / Dark Theme

The dashboard supports a **Light** and **Dark** theme. Use the theme toggle icon in the top-right of the header to switch between modes. Your preference is persisted in `localStorage` and applied automatically on every subsequent visit.

### Changelog

The current application version is shown at the bottom of the sidebar. Click the version number (e.g., `v3.0.0`) to open the **Changelog** modal, which summarises the features and fixes shipped in recent sprints.

---

## 3. Project & Run Settings

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

## 4. Running Tests

### Option A: Via Dashboard (Recommended)

1. Click **Run New Test** (top right).
2. Select your **Project** (settings are pre-filled from Run Settings).
3. Select the **Environment** (Dev/Staging/Prod).
4. (Optional) Override the folder path.
5. (Optional) Enter a **Group Name** — this is a smart Combobox: select an existing group from the dropdown to append the run to it, or type a new name to dynamically create a new group.
6. Click **Start Execution**.

> **Note:** The AAC CLI (`npx @keinar/aac-cli@latest init`) is used for **onboarding only** — generating your Dockerfile and pushing your image. Test execution is triggered via the Dashboard or API.

### Option B: Via API
See [API Keys section](#9-api-keys-cicd-integration) below.

### Option C: CI/CD Integration (GitHub Actions)
Generate an API key and use the API to trigger tests from your CI pipeline.

---

## 5. Execution Management

The dashboard provides powerful tools for organizing and acting on test runs at scale.

### Flat vs. Grouped Views

Use the **View** toggle (top-right of the execution list) to switch between two display modes:

- **Flat View (default):** All executions are listed in reverse-chronological order. Best for reviewing recent activity at a glance.
- **Grouped View:** Executions are aggregated by their `groupName`. Each group header displays a pass/fail summary badge and the timestamp of the most recent run. Click any group header to expand or collapse its child executions.

Both views support the full filter bar (status, environment, date range) and pagination controls.

### Bulk Actions

Select one or more execution rows using the checkboxes on the left. A floating **Bulk Actions** bar appears at the bottom of the screen with the following operations:

- **Assign Group** — Opens a popover where you can type a group name and apply it to all selected executions simultaneously.
- **Ungroup** — Removes the `groupName` assignment from all selected executions, returning them to the ungrouped pool.
- **Delete** — Soft-deletes up to 100 selected executions in a single API call. Deleted records are retained in the database to preserve billing accuracy and are excluded from all dashboard views.

---

## 6. Team Management (Admin Only)

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

## 7. Billing & Plans

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

## 8. API Keys (CI/CD Integration)

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

## 9. AI Analysis & Results

### Live Results
- Check the **Dashboard** for real-time logs via WebSocket.
- Status updates: `QUEUED` → `RUNNING` → `PASSED` / `FAILED`.

### AI Root Cause Analysis
If a test fails:
1. Click the **✨** icon next to the failure.
2. View the AI-generated diagnosis and suggested fix.
3. AI analysis can be disabled per-organization in **Settings** → **Organization**.

---

## 10. Support

- **Documentation**: [docs.automation.keinar.com](https://docs.automation.keinar.com)
- **Email**: info@digital-solution.co.il
