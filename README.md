# 🎭 Playwright Full-Stack Automation Framework

[![Playwright CI](https://github.com/keinar/Playwright-Full-Stack-Framework/actions/workflows/playwright.yml/badge.svg)](https://github.com/keinar/Playwright-Full-Stack-Framework/actions/workflows/playwright.yml)
[![Allure Report](https://img.shields.io/badge/Allure_Report-View_Report-blue?style=flat\&logo=allure)](https://keinar.github.io/Playwright-Full-Stack-Framework/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **production-grade Quality Automation Framework** for modern full‑stack web applications.

Built with **Playwright** and **TypeScript**, this framework demonstrates advanced testing patterns including:

* **Hybrid Testing** (UI + API)
* **AI‑driven validation**
* **Direct Database Assertions**
* **Dockerized Execution** for consistency

---

## 🚀 Key Features & Capabilities

### 🤖 AI‑Powered Testing (Generative AI)

Powered by **Google Gemini 2.5 Flash**, enabling validations beyond classic automation:

* **Visual Intelligence**
  Semantic image analysis (e.g. *“Does this image contain a human?”*, *“Is the main subject food?”*).

* **Contextual Validation**
  LLM‑based validation of text meaning, relevance, and logic.

* **Security & Fuzzing**
  Automated generation of malicious inputs (XSS / SQLi) and detection of PII leakage in API responses.

---

### 🏗️ Robust Architecture

* **Hybrid Testing Strategy**
  API‑based setup & teardown for speed, UI tests focused on real user behavior.

* **Dependency Injection (DI)**
  Custom Playwright **Fixtures** inject:

  * Page Objects
  * API Services
  * Database Helpers

* **Dockerized Environment**
  Tests run inside a controlled Docker container to ensure 100% consistency between local development and CI pipelines, eliminating *“works on my machine”* issues.

---

### 🛡️ Resilience & Data Integrity

* **Database Assertions**
  Direct **MongoDB** validation independent of UI state.

* **Network Resilience Testing**
  Mocked backend failures (500s, timeouts) to validate UI error handling.

* **Visual Regression Testing**
  Pixel‑perfect snapshot comparison ensuring consistency across environments via Docker.

---

## 🛠️ Tech Stack

| Component      | Technology        | Description                               |
| -------------- | ----------------- | ----------------------------------------- |
| Core Framework | Playwright        | End‑to‑End testing & network interception |
| Language       | TypeScript        | Strong typing & OOP patterns              |
| Infrastructure | Docker            | Containerized execution environment       |
| AI Engine      | Google Gemini SDK | AI validation & security analysis         |
| Validation     | Zod               | Environment schema validation             |
| Database       | MongoDB Driver    | Direct DB assertions & cleanup            |
| Reporting      | Allure Report     | Rich test reports with history            |
| CI/CD          | GitHub Actions    | Automated pipelines & GitHub Pages        |

---

## 📂 Project Structure

```plaintext
📦 project-root
 ┣ 📂 config             # Zod-validated environment configuration
 ┣ 📂 fixtures           # Dependency Injection (Pages, Services, DB)
 ┣ 📂 helpers            # Shared utilities (AI, Logger, Mongo, Polling)
 ┣ 📂 pages              # Page Object Models (POM)
 ┣ 📂 services           # API service layer (business logic)
 ┣ 📂 tests
 ┃ ┣ 📂 ai               # AI vision, fuzzing & security tests
 ┃ ┣ 📂 api              # API CRUD tests
 ┃ ┣ 📂 data             # Database integrity tests
 ┃ ┣ 📂 e2e              # Hybrid E2E flows (UI + API + DB)
 ┃ ┣ 📂 ui               # Functional UI tests
 ┃ ┗ 📂 visual           # Visual regression tests
 ┣ 📜 Dockerfile         # Docker image definition
 ┣ 📜 docker-compose.yml # Local orchestration config
 ┗ 📜 playwright.config.ts
```

---

## 🏁 Getting Started

### 1️⃣ Prerequisites

* **Docker** & **Docker Compose** (Recommended)
* **Node.js** v18+ (only if running without Docker)
* **MongoDB** connection string
* **Google Gemini API Key** (required for AI tests)

---

### 2️⃣ Installation

```bash
git clone https://github.com/keinar/Playwright-Full-Stack-Framework.git
cd Playwright-Full-Stack-Framework
```

---

### 3️⃣ Configuration

Create a `.env` file in the project root:

```ini
BASE_URL=https://photo-gallery.keinar.com/
ADMIN_USER=your-email@example.com
ADMIN_PASS=your-secure-password
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/test
GEMINI_API_KEY=your_google_ai_studio_key
```

---

## 🐳 Running with Docker (Recommended)

Running tests in Docker ensures your local environment matches the CI environment perfectly — especially for **Visual Regression** tests.

### Run All Tests

```bash
docker-compose up --build
```

### Run Specific Suite

```bash
docker-compose run --rm playwright-tests npx playwright test tests/api
```

### Update Visual Snapshots

Generate Linux‑based snapshots compatible with CI:

```bash
docker-compose run --rm playwright-tests npx playwright test --update-snapshots
```

### View Reports

```bash
npx playwright show-report
```

---

## 🧪 Running Locally (Without Docker)

1. **Install Dependencies**

```bash
npm install
npx playwright install --with-deps
```

2. **Run Commands**

| Suite         | Command               | Description                      |
| ------------- | --------------------- | -------------------------------- |
| Run All       | `npm test`            | Executes all tests (headless)    |
| UI Tests      | `npm run test:ui`     | Functional & resilience UI tests |
| API Tests     | `npm run test:api`    | Backend API validation           |
| E2E Hybrid    | `npm run test:e2e`    | Full flows (UI + API + DB)       |
| AI & Security | `npm run test:ai`     | AI vision, fuzzing & security    |
| Visual Tests  | `npm run test:visual` | Snapshot comparison              |
| Last Failed   | `npm run test:lf`     | Run last failed tests            |
| Debug Mode    | `npm run test:headed` | Runs with visible browser        |

---

## 📊 Reporting

### Local Allure Report

```bash
npm run allure:generate
npm run allure:open
```

### CI/CD Reports

Allure reports are automatically generated and deployed to **GitHub Pages** on every push.

🔗 **Latest CI Report:**
[https://keinar.github.io/Playwright-Full-Stack-Framework/](https://keinar.github.io/Playwright-Full-Stack-Framework/)

---

## 👨‍💻 Author

**Keinar Elkayam**
Senior QA Automation Engineer

---

## 📄 License

This project is licensed under the **MIT License**.
