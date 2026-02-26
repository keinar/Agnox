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
| `PLATFORM_MONGO_URI` | **Infra** | Connection string for MongoDB Atlas. |
| `PLATFORM_JWT_SECRET` | **Infra** | 64-char hex secret for JWT authentication (`openssl rand -hex 32`). |
| `PLATFORM_GEMINI_API_KEY` | **Infra** | **Critical:** Required by the Worker Service for AI Root Cause Analysis. |
| `STRIPE_SECRET_KEY` | **Infra** | Stripe API secret key for billing integration. |
| `STRIPE_WEBHOOK_SECRET` | **Infra** | Stripe webhook endpoint secret for signature verification. |
| `SENDGRID_API_KEY` | **Infra** | SendGrid API key for transactional email delivery. |


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
            PLATFORM_MONGO_URI=${{ secrets.PLATFORM_MONGO_URI }}
            PLATFORM_RABBITMQ_URL=amqp://automation-rabbitmq
            PLATFORM_REDIS_URL=redis://automation-redis:6379
            PLATFORM_JWT_SECRET=${{ secrets.PLATFORM_JWT_SECRET }}
            PLATFORM_GEMINI_API_KEY=${{ secrets.PLATFORM_GEMINI_API_KEY }}
            PLATFORM_WORKER_CALLBACK_SECRET=${{ secrets.PLATFORM_WORKER_CALLBACK_SECRET }}
            
            # --- BILLING ---
            STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
            STRIPE_WEBHOOK_SECRET=${{ secrets.STRIPE_WEBHOOK_SECRET }}
            
            # --- EMAIL ---
            SENDGRID_API_KEY=${{ secrets.SENDGRID_API_KEY }}
            FROM_EMAIL=noreply@agnox.dev
            EOF
            
            # 3. Pull latest infrastructure images
            docker compose -f docker-compose.prod.yml pull
            
            # 4. Start the stack
            docker compose -f docker-compose.prod.yml up -d --build
```

---

## 3. Worker Configuration

The Worker Service uses the platform environment variables to connect to infrastructure and external services.

- **`PLATFORM_GEMINI_API_KEY`**: Used by the **Worker** (Node.js) to analyze failures.

---

## 4. Troubleshooting Deployments

| Issue | Resolution |
| --- | --- |
| **AI Analysis Fails** | Check if `PLATFORM_GEMINI_API_KEY` is in GitHub Secrets and if the `.env` on the server contains it after deploy. |
| **Billing not working** | Verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are in GitHub Secrets and that the webhook URL is registered in Stripe dashboard. |
| **Emails not sending** | Verify `SENDGRID_API_KEY` is valid. Check SendGrid Activity for delivery status. |
| **"Permission denied"** | Ensure the SSH Key in GitHub Secrets matches the one on the VPS (`~/.ssh/authorized_keys`). |
