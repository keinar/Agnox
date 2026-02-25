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