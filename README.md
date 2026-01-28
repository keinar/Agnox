# Agnostic Automation Center

A high-performance, microservices-based test automation platform designed to be **language and framework agnostic**. It allows you to run any containerized automation suite (Playwright, Pytest, JUnit, etc.) on a remote server with real-time monitoring, live logs, and **AI-powered failure analysis**.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue?style=flat-square)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-green?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Agnostic-2496ED?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-8e44ad?style=flat-square)

---

## 🚀 The Agnostic Concept

Unlike traditional frameworks, this system acts as a **Platform-as-a-Service (PaaS)** for automation.
- **The Center:** Manages infrastructure, queues, execution, and reporting.
- **The Test Suite:** Provided by the user as a Docker Image. The system doesn't care if it's Python, Node.js, or Java.
- **The Secret Sauce:** Dynamic environment injection via a "White List" (no hardcoded variables in the infrastructure).

---

## Key Features

### AI-Driven Root Cause Analysis
No more digging through thousands of log lines.
- **Automatic Detection:** When a test fails, the system automatically captures the logs.
- **Gemini 2.5 Flash:** Analyzes the failure context, identifies the exact error, and suggests code fixes.
- **Instant Report:** View a styled, easy-to-read analysis directly in the dashboard via the ✨ icon.

### Interactive Dashboard
A modern, React-based UI (Vite + Tailwind) that gives you full control:
- **Manual Triggers:** Launch tests directly from the UI using the **Execution Modal**.
- **Dynamic Configuration:** Select specific environments (Dev/Staging/Prod), target folders, and Docker images on the fly.
- **Live Monitoring:** Watch console logs stream in real-time via WebSockets.

### Smart Environment Mapping
- **Agnostic Environments:** Environments are defined via infrastructure ENV variables (`STAGING_URL`, `PROD_URL`).
- **Auto-Switching:** The UI automatically maps your selection to the correct URL, injecting it into the container seamlessly.

---

## Architecture

- **Dashboard (React/Vite):** Real-time UI for triggering runs, monitoring logs, and viewing AI reports.
- **Producer Service (Fastify):** Handles API requests, manages MongoDB/Redis, and queues tasks to RabbitMQ.
- **Worker Service (Node.js):** The execution engine. It pulls images, runs containers, and orchestrates the **AI Analysis** workflow upon failure.
- **Databases:** MongoDB (Logs & History) + Redis (Queue Management).

---

## Case Study: Integrated Example

This system is currently configured to validate the following full-stack project:
- **Test Suite Repo:** https://github.com/keinar/Photographer-Gallery-Automation
- **Target App Repo:** https://github.com/keinar/photographer-gallery

---

## Documentation

To set up or use the system, follow these detailed guides:

| Guide | Content |
| :--- | :--- |
| [Infrastructure Setup](./docs/INFRASTRUCTURE.md) | Setting up the Server, Docker, AI Keys, and Databases. |
| [Client Integration](./docs/CLIENT_GUIDE.md) | How to prepare your Test Repo to be "Agnostic-Ready". |
| [CI/CD & Secrets](./docs/CI_CD.md) | Managing GitHub Actions and the Secret Injection Whitelist. |

---

## License

[MIT](/LICENSE)