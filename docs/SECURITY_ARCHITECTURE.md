# Enterprise Security Architecture

This document details the defense-in-depth security architecture of the Agnox. It covers authentication, authorization, data protection, integration security, and tenant isolation constraints.

---

## 1. Authentication & Authorization

### JWT Algorithm Pinning & Revocation
- **Algorithm Pinning:** The platform strictly enforces the `HS256` algorithm for all JWT operations (signing and verification) to prevent algorithmic confusion attacks.
- **Stateful Revocation:** While JWTs are inherently stateless, the platform uses a Redis-backed token blacklist. Upon logout, the JWT signature is added to the Redis blacklist with a TTL matching its remaining validity, ensuring immediate invalidation.
- **Secret Management:** JWT secrets (`PLATFORM_JWT_SECRET`) are explicitly redacted from all startup logs and environments, ensuring they are never exposed during initialization.

### Session & Identity
- **Password Hashes:** User passwords are encrypted using `bcrypt` with a minimum of 10 salt rounds.
- **Account Lockout:** Failed login attempts are tracked in Redis. Exceeding 5 failures within 15 minutes triggers an automatic account lockout for the target email address.

---

## 2. API Key Security & Hashing

- **HMAC-SHA256 Encryption:** API keys and invitation tokens are never stored in plaintext. They are hashed using `HMAC-SHA256` combined with a strictly server-side secret (`PLATFORM_API_KEY_HMAC_SECRET`).
- **One-Time Display:** Upon generation, the plaintext API key is displayed once to the user and is never retrievable again. The backend only stores the HMAC hash and a verifiable prefix (e.g., `pk_live_...`).
- **Immediate Revocation:** Administrators can revoke API keys at any time; deleted keys are instantly invalidated across all nodes.

---

## 3. Webhook & Integration Security (SSRF Protection)

To prevent Server-Side Request Forgery (SSRF) and localized data leakage, external integrations have strict boundaries.

### Slack Webhooks (Data at Rest)
- **Encryption:** Slack webhook URLs are encrypted at rest in the MongoDB database using `AES-256-GCM`.
- **Validation:** Uploaded URLs must match a strict regex pattern ensuring they target `hooks.slack.com` safely, rejecting internal IP probes or port scanning payloads.

### Jira Integration
- **Domain Allowlisting:** The Jira cloud integration requires providing an Atlassian domain. The system employs strict regex validation (`^[a-z0-9-]+\.atlassian\.net$`) to guarantee all requests are cleanly routed to Atlassian Cloud, thwarting wildcard SSRF attacks against internal networks.

---

## 4. Platform Secrets vs. Test Variables

### The `PLATFORM_*` Namespace
One of AAC's core design tenets is allowing users to execute arbitrary tests using standard environment variables (like `MONGO_URI` or `API_KEY`).
To ensure absolute isolation between the host infrastructure and the user containers, the platform utilizes a prefixed namespace. Infrastructure connection strings are strictly scoped to:
- `PLATFORM_MONGO_URI`
- `PLATFORM_REDIS_URL`
- `PLATFORM_RABBITMQ_URL`

### Secure Docker Orchestration
- **Runtime Masking:** The Worker Service strips all `PLATFORM_*` environment variables before constructing the Docker `run` command for the test containers.
- **Container Hardening:** Test containers execute with restricted internal Docker privileges via `HostConfig`. The host's Docker socket (`/var/run/docker.sock`) is never mounted. Memory limits and dropped capabilities are enforced.

---

## 5. Network & Inter-Service Security

### Rate Limiting
- **Redis-Backed Policies:** Global API rate limiting is enforced per-organization and per-IP using Redis to prevent DDoS and Brute Force activity.
- Configured as `100 requests / minute / organization` for standard API routes, and `5 requests / minute / IP` for authentication endpoints.

### Internal Worker Callbacks
- The Worker Service reports real-time execution logs back to the Producer Service via internal REST callbacks.
- These callbacks are authenticated using a cryptographically strong, symmetric handshake via the `PLATFORM_WORKER_CALLBACK_SECRET`. They do not rely on user-level authentication but are strongly protected against spoofing by external actors.

### Static Artifact Protection
- Native test artifacts (HTML Reports, Videos, Screenshots) are served via `Fastify`.
- To prevent Unauthorized Direct Object Reference (Insecure IDOR), asset links are signed with a short-lived, verifiable HMAC token that expires after a set window. Users cannot guess or manipulate asset URLs without the cryptographic signature.

---

## 6. Multi-Tenant Isolation

### Cross-Tenant Data Boundaries (Data in Motion)
- **Organization ID Enforcement:** Every database query mapping to user data implicitly applies a strict `organizationId` filter derived securely from the requesting user's verified JWT payload.
- **Project Boundary Checks:** Cross-project operations (e.g. modifying test cycles or manual plans) strictly validate that the targeted resource's `projectId` belongs to the requesting user's `organizationId`.

### HTTP Hardening (Front-End Edge)
- **Strict Headers:** The Producer API responds with hardened security headers:
  - `Strict-Transport-Security` (HSTS preload)
  - `Content-Security-Policy` (CSP)
  - `X-Frame-Options` (DENY)
  - `X-Content-Type-Options` (nosniff)
- **CORS Protection:** Cross-Origin Resource Sharing is strictly pinned to expected dashboard environments, restricting API access from malicious third-party origins.

---

*This document outlines the foundation of AAC's Security Architecture as established in the Sprint 1-3 Hardening Phase (February 2026).*
