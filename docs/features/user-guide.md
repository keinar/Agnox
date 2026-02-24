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

The current application version is shown at the bottom of the sidebar. Click the version number (e.g., `v3.1.0`) to open the **Changelog** modal, which summarises the features and fixes shipped in recent sprints.

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

1. Click **Run Test** (top right).
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
- Status updates: `PENDING` → `RUNNING` → `ANALYZING` → `PASSED` / `FAILED` / `UNSTABLE` / `ERROR`.

### AI Root Cause Analysis (Investigation Hub)
If a test fails:
1. Click on any execution row in the dashboard to open the **Investigation Hub** (side drawer).
2. Select the **AI Analysis** tab (third tab) to view the Gemini-generated diagnosis and suggested fix.
3. AI analysis can be disabled per-organization in **Settings** → **Organization**.

### Investigation Hub
Click any execution row to open the slide-over **Investigation Hub** drawer:
- **Terminal tab:** Live log stream with auto-scroll toggle and `.txt` download.
- **Artifacts tab:** Media gallery of screenshots, videos, and downloadable trace zips from the test run.
- **AI Analysis tab:** Gemini-powered root cause analysis for failed executions.

The drawer URL updates with `?drawerId=<taskId>` — links can be copied and shared directly.

---

## 10. CRON Schedules

Automate recurring test runs without CI/CD pipelines.

### Creating a Schedule
1. Click **Run Test** to open the Execution Modal.
2. Switch to the **Schedule Run** tab (top of the modal).
3. Fill in the standard run fields (project, environment, folder).
4. Enter a **Schedule Name** (used as the `groupName` for all triggered executions).
5. Enter or select a **CRON Expression** (e.g., `0 2 * * *` = daily at 02:00 UTC). Use the preset buttons for common intervals.
6. Click **Save Schedule**.

The schedule is immediately registered in the live scheduler — no server restart needed.

### Managing Schedules
Go to **Settings** → **Schedules** to see a table of all active CRON schedules for your organization:
- **Name**, **CRON Expression**, **Environment**, **Folder**
- Click **Delete** to permanently remove a schedule and cancel its next execution.

> **Note:** Viewer role cannot delete schedules.

### Slack Notifications
To receive a Slack message whenever a test run completes:
1. Go to **Settings** → **Integrations**.
2. Under the **Slack** card, paste your Slack **Incoming Webhook URL**.
3. Click **Save Webhook**.

Notifications are sent for `PASSED`, `FAILED`, `ERROR`, and `UNSTABLE` statuses. Failed executions include a truncated AI analysis snippet and a direct link to the Investigation Hub.

---

## 11. Test Cases (Quality Hub)

Build and manage a repository of manual and automated test cases.

### Creating a Test Case
1. Navigate to **Test Cases** from the sidebar.
2. Select your **Project** from the dropdown.
3. Click **New Test Case** to open the creation drawer.
4. Fill in:
   - **Title**: Name of the test case (e.g., "Login flow with invalid credentials")
   - **Suite**: Grouping label (e.g., "Authentication", "Checkout")
   - **Priority**: LOW / MEDIUM / HIGH / CRITICAL
   - **Steps**: Add individual test steps with Action and Expected Result

### AI-Powered Step Generation
1. In the test case drawer, click **Generate with AI**.
2. Enter a natural-language intent (e.g., "Test the checkout flow with a coupon code").
3. Gemini generates a structured array of test steps automatically.
4. Review and edit the generated steps before saving.

### Managing Test Cases
- Test cases are grouped by **Suite** using collapsible accordions.
- Click any test case row to open the edit drawer.
- Delete test cases using the trash icon in the test case row.

---

## 12. Test Cycles & Manual Execution Player

Hybrid test cycles combine manual and automated tests into a single, unified workflow.

### Creating a Hybrid Cycle
1. Navigate to **Test Cycles** from the sidebar.
2. Select your **Project**.
3. Click **Create Cycle** to open the Cycle Builder drawer.
4. Enter a **Cycle Name**.
5. Select **Manual Tests** from the suite-grouped checklist.
6. (Optional) Enable **Include Automated Test Run** — requires run settings (Docker image, base URL) to be configured in Settings.
7. Click **Launch Cycle**.

> When launched, AUTOMATED items are immediately pushed to RabbitMQ for execution. MANUAL items remain PENDING until a QA engineer executes them.

### Viewing Cycle Details
- Click any cycle row in the table to **expand** and see all items.
- **AUTOMATED items**: Display status badge and execution ID.
- **MANUAL items**: Display status badge and an **Execute** button.

### Manual Execution Player
1. Click **Execute** on a MANUAL item to open the Manual Execution drawer.
2. Each test step is displayed as an interactive checklist.
3. Click **Pass**, **Fail**, or **Skip** on each step.
4. Steps auto-advance to the next pending item.
5. Click **Complete Test** to submit results.

> Cycle status automatically transitions to **COMPLETED** when all items (manual + automated) reach a terminal state.

---

## 13. Support

- **Documentation**: [docs.automation.keinar.com](https://docs.automation.keinar.com)
- **Email**: info@digital-solution.co.il
