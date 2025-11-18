# **Playwright Full-Stack Automation Framework**
### End-to-End Quality Automation Framework for Modern Web Apps (Playwright + TypeScript)

This project is a complete, senior-level QA Automation framework built using **Playwright** and **TypeScript**, designed to test a full-stack **MERN** application (React + Node.js + MongoDB).

It demonstrates best-practice automation patterns in modern tech organizations — including scalable structure, API authentication, hybrid testing, POM architecture, database validation, visual testing, resilience testing, code quality, and CI/CD readiness.

---

## 🚀 **Project Highlights**

### ✔️ Global API Authentication  
A dedicated `global.setup.ts` authenticates once using the backend API and stores the JWT token for all following UI + API tests.

### ✔️ UI Automation (POM Architecture)  
All UI tests use a clean Page Object Model, ensuring reuse, maintainability, and readability.

### ✔️ API Automation  
A strongly typed `ApiClient` wrapper performs CRUD operations and automatically injects the authentication token.

### ✔️ Hybrid (UI + API) Testing  
Fast data creation/deletion via API + UI validation in the browser.  
The most efficient E2E testing style for real production systems.

### ✔️ Direct Database Validation  
Integration tests connect directly to **MongoDB** to validate inserted/deleted/updated data at the source — independent of API/UI.

### ✔️ Visual Regression Testing  
Uses Playwright's `toHaveScreenshot` to capture and compare snapshots of specific UI components, ensuring CSS and layout integrity across changes.

### ✔️ UI Resilience (API Mocking)
Utilizes `page.route()` to intercept API calls and simulate server errors (e.g., 500) or empty states, validating that the UI responds gracefully.

### ✔️ Code Quality & Maintainability  
Integrated with **ESLint** and **Prettier** to enforce consistent coding standards and prevent common errors, making the framework scalable for teams.

### ✔️ CI/CD Ready  
Includes a GitHub Actions workflow: `playwright.yml`.

### ✔️ Professional Reporting  
Supports **Allure Reports** + native Playwright HTML reports.

---

## 🛠️ **Tech Stack**

| Layer | Technology |
|------|------------|
| Automation Framework | **Playwright** |
| Language | **TypeScript** |
| UI Architecture | **POM (Page Object Model)** |
| API Layer | Playwright `request` |
| Database Validation | MongoDB native driver |
| Visual Testing | Playwright `toHaveScreenshot` |
| Resilience Testing | Playwright `page.route` (Mocking) |
| Code Quality | ESLint & Prettier |
| Reporting | Allure + Playwright HTML |
| CI/CD | GitHub Actions |

---

## 📁 **Project Structure**

```
📦 project-root
 ┣ 📂 helpers
 ┃ ┣ 📜 apiClient.ts
 ┃ ┗ 📜 mongoHelper.ts
 ┣ 📂 pages
 ┃ ┣ 📜 basePage.ts
 ┃ ┣ 📜 loginPage.ts
 ┃ ┗ 📜 dashboardPage.ts
 ┣ 📂 tests
 ┃ ┣ 📂 api
 ┃ ┣ 📂 ui
 ┃ ┣ 📂 e2e
 ┃ ┣ 📂 data
 ┃ ┗ 📂 visual
 ┣ 📜 playwright.config.ts
 ┣ 📜 global.setup.ts
 ┣ 📜 .env
 ┣ 📜 .eslintrc.js
 ┣ 📜 .prettierrc
 ┗ 📜 README.md
```

---


---

## 🏁 **Getting Started**

### 1️⃣ Prerequisites
- Node.js **18+**
- Installed Playwright browsers
- Running backend + frontend of the project under test
- Access to the MongoDB cluster

---

## 2️⃣ Installation

```bash
git clone https://github.com/keinar/Playwright-Full-Stack-Framework.git
cd Playwright-Full-Stack-Framework
npm install
npx playwright install
```

---

## 3️⃣ Environment Setup

Create a `.env` file in the project root:

```ini
BASE_URL=https://photo-gallery.keinar.com/
ADMIN_USER=your-admin-email@example.com
ADMIN_PASS=your-admin-password
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
```

---

## 🧪 **Running Tests**

### Run ALL tests:
```bash
npx playwright test
```

### UI Tests:
```bash
npx playwright test --project=ui-tests-chrome
```

### API Tests:
```bash
npx playwright test --project=api-tests
```

### Hybrid E2E Tests:
```bash
npx playwright test --project=e2e-tests
```

### Database Tests:
```bash
npx playwright test --project=data-tests
```

### Visual Tests:
```bash
npx playwright test --project=visual-tests
```

### Update Visual Snapshots:
```bash
npx playwright test --project=visual-tests --update-snapshots
```

---

# 📊 **Reports**

### Allure:
```bash
npx allure open
```

### Playwright HTML:
```bash
npx playwright show-report
```

---

# 🧹 **Code Quality**

### Run ESLint (Check for errors):
```bash
npx eslint . --ext .ts
```

### Run Prettier (Check formatting):
```bash
npx prettier --check .
```

---

# 📧 Author

**Keinar Elkayam**  
Senior QA Automation Engineer
