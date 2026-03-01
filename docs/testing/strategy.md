# Agnox Testing Strategy & Coverage

## 1. Overview
Agnox employs a **Layered Defense Testing Strategy** to ensure security, multi-tenancy isolation, and a seamless user experience. This document outlines our testing types and their specific roles across the platform.

## 2. Testing Layers

### Layer 1: Unit Testing (Vitest)
* **Target:** Pure functions and isolated logic (e.g., `utils` and helper functions).
* **Focus:** Security blocklists, URL resolvers, data normalization, and password validation.
* **Why Vitest:** Extremely fast execution (~1ms per test) and seamless TypeScript support without compilation overhead.

### Layer 2: API Integration Testing (Vitest + Supertest + MongoMemoryServer)
* **Target:** All REST API endpoints in the `producer-service`.
* **Focus:** 
  * **RBAC:** Ensuring Roles (Admin, Developer, Viewer) are strictly enforced at the HTTP layer.
  * **Multi-Tenancy:** Verifying data isolation between organizations (P0 requirement to prevent cross-tenant data leakage).
  * **Hardening:** Validating rate limiting, account lockout mechanisms, and brute-force protection.
* **Infrastructure:** Uses `mongodb-memory-server` to spin up a fully isolated, in-memory MongoDB instance for each test suite, guaranteeing zero cross-test pollution and rapid setup/teardown.

### Layer 3: End-to-End (E2E) Testing (Playwright)
* **Target:** Full user journeys in the `dashboard-client` and complete system integration.
* **Focus:** 
  * **UI State:** Verifying component visibility and route protection based on authenticated roles.
  * **Complex Flows:** End-to-end execution drawer interactions, real-time log streaming via Socket.io.
  * **Visual Validation:** Markdown rendering, UI consistency, and responsiveness.
* **Architecture:** Utilizes the Page Object Model (POM) pattern alongside custom authentication fixtures (e.g., overriding `storageState` dynamically) for robust, maintainable tests.
* **Why Playwright:** Native support for modern web apps, built-in auto-waiting, and perfect visual/browser consistency across Chromium, WebKit, and Firefox.

## 3. Coverage Summary (Phase 1)
* **Authentication:** 100% coverage on Login, Signup, JWT validation, and Account Lockout.
* **RBAC:** Fully verified across both Dashboard UI flows and API Backend endpoints.
* **Multi-Tenancy:** Verified cross-tenant access rejection (HTTP 404/403) across all core entities.
* **Execution Engine:** Core logic for status transitions and log parsing is comprehensively covered by Unit and E2E layers.

---

## 4. E2E Test Setup & Data Seeding

### `global.setup.ts` — Automated Authentication & Seeding

All Layer 3 (Playwright) E2E tests depend on an authenticated session and a pre-existing user record in the database. This is handled by `tests/global.setup.ts`, which Playwright runs **once before the full test suite** via the `globalSetup` config option.

**What it does:**
1. Navigates to `/login` using a real browser page.
2. Reads credentials from the `E2E_EMAIL` and `E2E_PASSWORD` environment variables (injected by the CI pipeline or a local `.env`).
3. Fills and submits the login form, then waits for a redirect to `/dashboard`.
4. Persists the authenticated browser storage state to `tests/.auth/user.json`.
5. All subsequent test specs reuse this saved state — **no test re-authenticates individually**, ensuring both speed and consistency.

> **Important:** `global.setup.ts` only *logs in* an existing user. The user and organization must already exist in the database before setup runs. In CI, the **"Seed Database"** step in `deploy.yml` calls `POST /api/auth/signup` to create the `admin@test.com` account and its organization immediately before the E2E layer executes.

### Running E2E Tests Against a Clean Environment

If you are running the E2E suite against a **fresh production or staging environment** (i.e., an empty database), the following must be satisfied **before** running Playwright:

1. **Create an account:** Sign up through the dashboard UI or via the API:
   ```bash
   curl -X POST https://api.agnox.dev/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "your-test-user@example.com",
       "password": "YourStrongPass1!",
       "name": "E2E User",
       "organizationName": "E2E Test Org"
     }'
   ```
2. **Set environment variables:** Export `E2E_EMAIL` and `E2E_PASSWORD` matching the account you just created.
3. **Configure Project Settings:** In **Settings → Run Settings**, ensure a project exists with a valid Docker image (e.g., `keinar101/agnox-tests:latest`) and at least one target URL configured. Several E2E tests assert that the Run Settings form is pre-populated; without saved settings, these tests will fail.
4. **Configure API Credentials (if testing integrations):** Integration-specific tests (Jira, Slack, CI providers) require valid credentials to be stored in **Settings → Connectors**. Without them, those tests must be skipped or the assertions adjusted for the "not configured" UI state.

### Root Cause Analysis: "Empty State" E2E Failures

A known failure mode occurs when E2E tests are executed against a clean database that has never had a test execution. Symptoms include:
- Dashboard KPI cards showing `0` where the test expects real data.
- The execution list being empty, causing row-click or drawer tests to fail with "element not found".

**Resolution:** This is not a bug in the test suite — it reflects a real empty state. The fix is to trigger at least one test execution via the Execution Modal after signing in, then re-run the E2E suite. In CI, this is handled automatically because the pipeline runs Layer 2 integration tests (which create execution records) before Layer 3 E2E tests.