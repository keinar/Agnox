# Playwright Full-Stack Automation Framework

A robust, microservices-based test automation platform designed for **scalability**, **real-time reporting**, and **AI-driven analysis**.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue?style=flat-square)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-green?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini%20Pro-orange?style=flat-square)

---

## Architecture

The system is built using a modern event-driven architecture to ensure decoupling between test execution, reporting, and management.

### Services Overview

- **🌐 Gateway / Reverse Proxy (`nginx-proxy-manager`)**
    - Manages SSL certificates (Let's Encrypt).
    - Handles routing to internal services and production-grade security (HTTPS).

- **🖥️ Dashboard Client (`apps/dashboard-client`)**
    - Built with **React**, **Vite**, and **Tailwind CSS**.
    - **NEW: Cross-Environment Origin Tracking** – Visually distinguishes between **LOCAL** and **CLOUD** execution runs.
    - Real-time UI using **Socket.io** for live logs and statistics.

- **⚙️ Producer Service (`apps/producer-service`)**
    - High-performance API Gateway built with **Fastify**.
    - Manages **MongoDB** connections and publishes tasks to **RabbitMQ**.

- **👷 Worker Service (`apps/worker-service`)**
    - The core execution engine (Node.js).
    - Executes **Playwright** tests and generates **Allure Reports**.
    - Integrates **Google Gemini AI** for intelligent error analysis and vision-based testing.

---

## Key Features

- **Distributed Model**: Decoupled Producer-Worker architecture using RabbitMQ for high scalability.
- **Smart Report Routing**: Automatically detects the server origin to serve reports from the correct environment.
- **AI Integration**: Leverages Google Gemini for dynamic test data generation and failure RCA.
- **Cloud Optimized**: Production Docker configuration optimized for **ARM64 (Oracle Ampere)** architecture.
- **Live Monitoring**: Console outputs and execution status streamed directly to the dashboard.

---

## Tech Stack

- **Frontend:** React, TypeScript, Recharts, Framer Motion, Lucide Icons.
- **Backend:** Node.js, Fastify, Socket.io.
- **Testing:** Playwright, Allure Report.
- **Infrastructure:** Docker, RabbitMQ, MongoDB, Nginx Proxy Manager.
- **CI/CD:** GitHub Actions.
- **AI:** Google Gemini (Generative AI).

---

## Getting Started

### Prerequisites
* Docker & Docker Compose
* Node.js (v18+)
* Google Gemini API Key

### Local Setup

1. **Clone the repository:**
```bash
git clone https://github.com/keinar/playwright-full-stack-framework.git
cd playwright-full-stack-framework
```

2. **Environment Configuration:**
Create a `.env` file in the root directory:
```env
# Infrastructure
MONGO_URI=mongodb://mongo:27017/automation
RABBITMQ_URL=amqp://rabbitmq
GEMINI_API_KEY=your_api_key_here

# App Config
BASE_URL=https://your-target-site.com
ADMIN_USER=admin@example.com
ADMIN_PASS=securepass

# URL Resolution (Required for Cloud/Local sync)
VITE_API_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:3000
```

3. **Run with Docker Compose:**
```bash
docker compose up -d --build
```

4. **Access Services:**
- **Dashboard:** http://localhost:8080 (Production) or http://localhost:5173 (Dev)
- **Producer API:** http://localhost:3000
- **RabbitMQ UI:** http://localhost:15672 (guest/guest)

---

## ☁️ Deployment & CI/CD

Production-ready **CI/CD pipeline** optimized for VPS / Oracle Cloud ARM instances.

### Deployment Logic
- **Build Optimization**: Uses `node:20-slim` for ARM64 native module compatibility.
- **Environment Injection**: API endpoints injected at build-time for correct cloud routing.

### Required GitHub Actions Secrets

| Secret Name | Description |
|-----------|-------------|
| VPS_HOST | Server IP Address |
| VPS_USER | Server Username |
| VPS_SSH_KEY | Private SSH Key |
| MONGO_URI | MongoDB Connection String |
| GEMINI_API_KEY | Google Gemini API Key |
| VITE_API_URL | Cloud API URL |
| PUBLIC_API_URL | Cloud API URL (Worker) |

---

## Running Tests

### Option 1: Via Dashboard
Select a test suite/folder and click **Run**.

### Option 2: CLI
```bash
docker compose exec worker npx playwright test
```

### Option 3: API
```bash
curl -X POST http://localhost:3000/execution-request   -H "Content-Type: application/json"   -d '{"config":{"baseUrl":"https://example.com"},"tests":["tests/ui/login.spec.ts"]}'
```

---

## Reporting

1. Real-time console streaming (Dashboard)
2. Playwright HTML reports
3. Allure historical dashboards

---

## License

MIT
