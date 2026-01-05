# Agnostic Automation Center (Playwright)

A high-performance, microservices-based test automation platform
designed to be **completely agnostic**. It allows you to run any
Dockerized automation suite on a remote server with real-time
monitoring, live logs, and secure secret injection.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue?style=flat-square)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-green?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Agnostic-2496ED?style=flat-square)

------------------------------------------------------------------------

## The Agnostic Concept

Unlike traditional frameworks, this system acts as a **Platform-as-a-Service (PaaS)** for automation. 
- **The Center:** Manages infrastructure, queues, and reporting. 
- **The Test Suite:** Provided by the user as a Docker Image. 
- **The Secret Sauce:** Dynamic environment injection via a "White List" (no hardcoded variables in the infrastructure).
- **Dynamic Environment Mapping**: Environments (Dev/Staging/Prod) are fully agnostic and defined via infrastructure ENV variables, with automatic URL switching in the UI.
- **Smart Path Resolution**: Automatic detection and formatting of test paths to ensure consistent execution regardless of user input.

## Architecture

-   **Dashboard (React/Vite):** Real-time UI for triggering runs and
    monitoring logs via Socket.io.
-   **Producer Service (Fastify):** Handles API requests, manages
    MongoDB/Redis, and queues tasks to RabbitMQ.
-   **Worker Service (Node.js):** The execution engine. It pulls the
    requested image, injects secrets, and enforces security by running
    an internal `entrypoint.sh`.

## Case Study: Integrated Example

This system is currently configured to validate the following full-stack
project: 
- **Test Suite Repo:** https://github.com/keinar/Photographer-Gallery-Automation 
- **Target App Repo:** https://github.com/keinar/photographer-gallery

------------------------------------------------------------------------

## Documentation

To set up or use the system, follow these detailed guides:

| Guide | Content |
| :--- | :--- |
| [Infrastructure Setup](./docs/INFRASTRUCTURE.md) | Setting up the Server, Docker, and Databases. |
| [Client Integration](./docs/CLIENT_GUIDE.md) | How to prepare your Test Repo to be "Agnostic-Ready". |
| [CI/CD & Secrets](./docs/CI_CD.md) | Managing GitHub Actions and the Secret Injection Whitelist. |

---

## License

[MIT](/LICENSE)
