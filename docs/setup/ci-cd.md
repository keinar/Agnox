# CI/CD Pipeline & Secret Management

The system relies on **GitHub Actions** to automate deployments and manage secrets securely.
Because this is an **Agnostic Platform**, it must handle secrets for *two* different layers:
1. **Infrastructure Layer:** Database, Queue, and AI Service credentials.
2. **Client Layer:** Credentials required by the test suite (e.g., Admin Login), which are injected dynamically.

---

## 1. Required GitHub Secrets

Go to your GitHub Repo -> **Settings** -> **Secrets and variables** -> **Actions** and add the following:

| Secret Name | Scope | Description |
| :--- | :--- | :--- |
| `VPS_HOST` | **Infra** | The IP address of your Linux server. |
| `VPS_SSH_KEY` | **Infra** | The Private Key (PEM) to access the server. |
| `VPS_USER` | **Infra** | Usually `ubuntu` or `opc`. |
| `MONGODB_URL` | **Infra** | Connection string for MongoDB Atlas. |
| `GEMINI_API_KEY` | **Infra** | **Critical:** Required by the Worker Service for AI Root Cause Analysis. |
| `ADMIN_USER` | *Client* | (Example) Username for the target application tests. |
| `ADMIN_PASS` | *Client* | (Example) Password for the target application tests. |
| `DEFAULT_TEST_IMAGE` | *Config* | The default Docker image to show in the Dashboard. |

---

## 2. Deployment Workflow (`deploy.yml`)

The pipeline ensures that every push to `main` updates the server configuration.
It uses a **HEREDOC** pattern to regenerate the `.env` file on the server during every deployment. This prevents stale configurations.

**Key Snippet from `.github/workflows/deploy.yml`:**

```yaml
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/agnostic-automation-center
            
            # 1. Stop current services
            docker compose -f docker-compose.prod.yml down --remove-orphans

            # 2. Regenerate .env from GitHub Secrets
            # This ensures the Worker has the AI Key and the Database URL
            cat <<EOF > .env
            
            # --- INFRASTRUCTURE ---
            MONGODB_URL=${{ secrets.MONGODB_URL }}
            RABBITMQ_URL=amqp://automation-rabbitmq
            REDIS_URL=redis://automation-redis:6379
            GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
            
            # --- DASHBOARD DEFAULTS ---
            DEFAULT_TEST_IMAGE=${{ secrets.DEFAULT_TEST_IMAGE }}
            DEFAULT_BASE_URL=https://photographer.keinar.com
            
            # --- CLIENT INJECTION ---
            ADMIN_USER=${{ secrets.ADMIN_USER }}
            ADMIN_PASS=${{ secrets.ADMIN_PASS }}
            
            # --- THE GATEKEEPER: Whitelist ---
            # Define which variables are allowed to pass into the test container
            INJECT_ENV_VARS=ADMIN_USER,ADMIN_PASS,MONGO_URI
            EOF
            
            # 3. Pull latest infrastructure images
            docker compose -f docker-compose.prod.yml pull
            
            # 4. Start the stack
            docker compose -f docker-compose.prod.yml up -d --build
```

---

## 3. The "Gatekeeper" Pattern

Notice the `INJECT_ENV_VARS` variable above.
The Worker Service uses this list to decide which environment variables to pass into the `docker run` command of the test container.

- **`GEMINI_API_KEY`**: Used by the **Worker** (Node.js) to analyze failures. It does *not* necessarily need to be in the whitelist unless the test code itself uses AI.
- **`ADMIN_USER`**: Used by the **Test Container** (Playwright). Must be in the whitelist.

---

## 4. Troubleshooting Deployments

| Issue | Resolution |
| --- | --- |
| **AI Analysis Fails** | Check if `GEMINI_API_KEY` is in GitHub Secrets and if the `.env` on the server contains it after deploy. |
| **Tests cannot login** | Verify `ADMIN_USER/PASS` are in GitHub Secrets AND in `INJECT_ENV_VARS`. |
| **"Permission denied"** | Ensure the SSH Key in GitHub Secrets matches the one on the VPS (`~/.ssh/authorized_keys`). |
