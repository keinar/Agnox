# **Playwright TS Project**
### _End-to-End Quality Automation Framework (Playwright + TypeScript)_

This project is a complete, senior-level QA Automation framework built using **Playwright** and **TypeScript**, designed to test a full-stack **MERN** application (React + Node.js + MongoDB).

It demonstrates best-practice automation patterns used by senior QA engineers in modern tech organizations — including scalable structure, API authentication, Hybrid testing, POM architecture, database validation, and CI/CD readiness.

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
 ┃ ┣ 📜 dashboardPage.ts
 ┃ ┗ 📜 profilePage.ts
 ┣ 📂 tests
 ┃ ┣ 📂 api
 ┃ ┣ 📂 ui
 ┃ ┣ 📂 e2e
 ┃ ┗ 📂 data
 ┣ 📜 playwright.config.ts
 ┣ 📜 global.setup.ts
 ┣ 📜 .env
 ┗ 📜 README.md
```

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

# 🧪 **Running Tests**

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

# 📧 Author

**Keinar Elkayam**  
Senior QA Automation Engineer
