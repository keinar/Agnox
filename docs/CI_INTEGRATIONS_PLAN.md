# CI/CD Integrations Architecture Plan (Two-Way)

## 1. Objective
Achieve a seamless two-way integration between the Agnox (AAC) and various Continuous Integration (CI) / Source Control Management (SCM) platforms. The primary goal is to empower developers by natively triggering automated test cycles from their CI pipelines and automatically posting AI-analyzed execution results (comments, summaries, or pass/fail statuses) directly back to the originating Pull Requests (PRs) or Merge Requests (MRs).

## 2. Architecture (The Provider Pattern)
Because the platform is fundamentally **agnostic**, hardcoding platform-specific logic directly in the core services is an anti-pattern. Instead, the architecture relies heavily on the **Strategy/Provider Pattern** to maintain modularity and scalability.

- `CiProvider` Interface: A generic contract defining strictly needed capabilities, such as `postCommentToPr(context, message)` or `updateCommitStatus(context, status)`.
- **Implementations**: Dedicated wrapper classes implementing the interface, such as `GithubProvider`, `GitlabProvider`, and `AzureDevOpsProvider`. These encapsulate platform-specific configurations, HTTP requests, rate limiting, and exact payload formatting.
- **Agnostic Runners**: Generic CI runners (like Jenkins, CircleCI, or custom bash scripts) will initiate test executions and attach the underlying SCM context (e.g., `source="github"`, `pr=123`, `repo="my-org/core-service"`). The system dynamically resolves and spins up the correct provider at runtime based on the `source` variable.

## 3. Data Model Updates
To authorize API calls back to the SCM platforms on behalf of organizations, the `Organization` schema must be securely updated to store authorization identifiers and tokens.
- **Secure Storage**: We will enforce the existing AES-256-GCM encryption utility to ensure all integration tokens are encrypted securely at rest and only decrypted securely at runtime inside memory.
- **Schema Updates**: The `Organization` model will include a designated `integrations` sub-document mapping:
  ```javascript
  integrations: {
    github: { token: "ENCRYPTED_GITHUB_PAT", enabled: true },
    gitlab: { token: "ENCRYPTED_GITLAB_TOKEN", enabled: false },
    azure: { token: "ENCRYPTED_AZURE_PAT", enabled: false }
  }
  ```

## 4. Execution Flow
The end-to-end event lifecycle ensures decoupling between execution processing and external delivery mechanisms:
1. **Inbound Webhook (Test Trigger):** A CI pipeline initiates a test run via an AAC webhook, passing along the CI Context payload (commit SHA, PR/MR number, repository identifier, and platform source).
2. **Context Persistence:** The CI Context is securely attached to the root level of the generated `TestCycle` record in the database for tracking.
3. **Test Execution:** The configured testing nodes process the steps and successfully terminate the cycle.
4. **AI Analysis Generation:** An asynchronous background Worker Service compiles the granular test logs and leverages the AI engine to generate a concise, human-readable report.
5. **Provider Resolution:** The Worker inspects the `source` from the `TestCycle`'s CI Context and utilizes a Factory to load the correct `CiProvider`. The matched decrypted token is retrieved from the `Organization`'s integration vault.
6. **Publishing:** The resolved Provider formats the AI report in the markup dialect appropriate for that SCM platform and issues an authenticated HTTP call to post the intelligence back to the SCM (e.g., as a comment on the GitHub PR timeline).

## 5. Sprint 4 Milestones
The integration rollout will be managed iteratively to ensure maximum quality and code stability:

- **Phase 1 (Infrastructure & GitHub):**
  - Define the `CiProvider` interface, data transfer objects, and instantiate the Provider Factory.
  - Implement and test the native `GithubProvider`.
  - Update the `Organization` schema to support encrypted token storage and hook up the AES-256-GCM utility.
  - Validate the end-to-end execution flow for GitHub PR AI comments.
- **Phase 2 (GitLab/Azure):**
  - Implement the `GitlabProvider` and `AzureDevOpsProvider`, applying API best practices modeled during Phase 1.
  - Expand and robustify CI Context parsing for varying inbound webhook payloads.
  - Final integration testing, performance benchmarking, and comprehensive documentation release.
