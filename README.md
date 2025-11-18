# **Playwright Full-Stack Automation Framework**
### End-to-End Quality Automation Framework for Modern Web Apps (Playwright + TypeScript)

This project is a complete, senior-level QA Automation framework built using **Playwright** and **TypeScript**, designed to test a full-stack **MERN** application.

It goes beyond standard testing by integrating **Generative AI (Google Gemini)** for complex content validation, alongside best-practice patterns like Hybrid Testing, POM, and direct Database Validation.

---

## 🚀 **Project Highlights**

### 🤖 **AI-Powered Testing (New!)**
Leverages **Google Gemini 2.5 Flash** via the official SDK to perform intelligent validations:
* **Visual Content Analysis:** Validates image contents (e.g., "Does this photo contain a human?" or "Is it food?") rather than just pixel comparison.
* **Semantic Text Validation:** Uses AI to determine if generated content is logically relevant to a specific topic/sentiment.

### ✔️ Global API Authentication  
A dedicated `global.setup.ts` authenticates once using the backend API and stores the JWT token. Custom fixtures inject this state automatically into tests.

### ✔️ Hybrid (UI + API) Testing  
Combines API for fast setup/teardown with UI for user-centric validation.
* *Example:* Create a gallery via API -> Verify it appears in the UI -> Delete via API.

### ✔️ Direct Database Validation  
Connects directly to **MongoDB** to assert data integrity at the source, independent of the UI or API responses.

### ✔️ Visual Regression Testing  
Uses Playwright's `toHaveScreenshot` for pixel-perfect UI verification across different environments (Linux/macOS).

### ✔️ Resilience Testing  
Simulates backend failures (e.g., 500 Error, Empty States) using network interception (`page.route`) to ensure the UI handles errors gracefully.

---

## 🛠️ **Tech Stack**

| Layer | Technology |
|------|------------|
| Automation Framework | **Playwright** |
| Language | **TypeScript** |
| AI Integration | **Google Gemini (Generative AI SDK)** |
| UI Architecture | **POM (Page Object Model)** |
| Database | **MongoDB (Native Driver)** |
| CI/CD | **GitHub Actions** |
| Reporting | **Allure + Playwright HTML** |

---

## 📁 **Project Structure**

```plaintext
📦 project-root
 ┣ 📂 fixtures           # Custom Playwright fixtures (e.g., Authenticated API Context)
 ┣ 📂 helpers            # Shared logic (ApiClient, MongoHelper, AiHelper)
 ┣ 📂 pages              # Page Object Models (POM)
 ┣ 📂 tests
 ┃ ┣ 📂 api              # API CRUD tests
 ┃ ┣ 📂 ui               # UI Functional tests
 ┃ ┣ 📂 e2e              # Hybrid E2E scenarios
 ┃ ┣ 📂 data             # DB integrity tests
 ┃ ┣ 📂 visual           # Visual regression tests
 ┃ ┗ 📂 ai               # AI-assisted validation tests
 ┣ 📜 playwright.config.ts
 ┣ 📜 global.setup.ts
 ┣ 📜 .env
 ┗ 📜 package.json
```

-----

## 🏁 **Getting Started**

### 1️⃣ Prerequisites

  - Node.js **18+**
  - Access to the MongoDB cluster
  - **Gemini API Key** (for AI tests)

### 2️⃣ Installation

```bash
git clone https://github.com/keinar/Playwright-Full-Stack-Framework.git
cd Playwright-Full-Stack-Framework
npm install
npx playwright install
```

### 3️⃣ Environment Setup

Create a `.env` file in the project root:

```ini
BASE_URL=https://photo-gallery.keinar.com/
ADMIN_USER=your-email@example.com
ADMIN_PASS=your-password
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>...
GEMINI_API_KEY=your_google_gemini_api_key  # Required for AI tests
```

-----

## 🧪 **Running Tests**

| Test Type | Command | Description |
|-----------|---------|-------------|
| **Run All** | `npm test` | Runs all tests in headless mode |
| **UI Tests** | `npm run test:ui` | Runs only UI functional tests |
| **API Tests** | `npm run test:api` | Runs API CRUD tests |
| **Visual Tests** | `npm run test:visual` | Runs visual regression tests |
| **Headed Mode** | `npm run test:headed` | Runs tests with the browser visible |
| **Update Snapshots** | `npx playwright test --update-snapshots` | Updates visual reference images |

-----

## 📊 **Reports**

Generate and view the comprehensive Allure report:

```bash
npm run allure:generate
npm run allure:open
```

-----

## 📧 Author

**Keinar Elkayam** — Senior QA Automation Engineer
