# CI/CD Pipeline & Secret Injection

The system uses GitHub Actions to automate deployments and maintain a secure environment.

### 1. Secret Injection Flow

To maintain the agnostic nature of the platform, secrets are handled as follows:

1. Store the secret in **GitHub Actions Secrets** (e.g., `GEMINI_API_KEY`).
2. Update the `deploy.yml` to recreate the server's `.env` during deployment.
3. Add the variable name to the `INJECT_ENV_VARS` whitelist.

### 2. Deployment Workflow (`deploy.yml`)

The pipeline ensures that every push to `main` updates the server without losing configuration or leaving stale environment variables.

**Crucial Deployment Script:**

```yaml
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          script: |
            cd ~/playwright-full-stack-framework
            
            # Recreate .env using a HEREDOC to prevent data loss or stale values
            cat <<EOF > .env
            MONGODB_URL=${{ secrets.MONGO_URI }}
            MONGO_URI=${{ secrets.MONGO_URI }}
            RABBITMQ_URL=${{ secrets.RABBITMQ_URL }}
            GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
            ADMIN_USER=${{ secrets.ADMIN_USER }}
            ADMIN_PASS=${{ secrets.ADMIN_PASS }}
            DEFAULT_TEST_IMAGE=${{ secrets.DEFAULT_TEST_IMAGE }}
            DEFAULT_BASE_URL=${{ secrets.DEFAULT_BASE_URL }}
            DEFAULT_TEST_FOLDER=${{ secrets.DEFAULT_TEST_FOLDER }}
            VITE_API_URL=${{ secrets.VITE_API_URL }}
            PUBLIC_API_URL=${{ secrets.PUBLIC_API_URL }}
            
            # THE GATEKEEPER: Whitelist for client injection
            INJECT_ENV_VARS=ADMIN_USER,ADMIN_PASS,GEMINI_API_KEY,MONGO_URI
            EOF
            
            # Pull latest client image to avoid using stale local cache
            docker pull ${{ secrets.DEFAULT_TEST_IMAGE }}
            
            # Restart services
            docker compose -f docker-compose.prod.yml down --remove-orphans
            docker compose -f docker-compose.prod.yml up -d --build

```

### 3. Key Secrets Required

| Name | Purpose |
| --- | --- |
| `VPS_HOST` / `VPS_SSH_KEY` | Remote server access. |
| `MONGO_URI` | MongoDB Atlas connection string. |
| `DEFAULT_TEST_IMAGE` | The agnostic Docker image to run (e.g., `user/repo:latest`). |
| `VITE_API_URL` | The public URL of your Producer API (for Dashboard). |
| `ADMIN_USER` / `ADMIN_PASS` | (Example) Client-side credentials for the target app. |

### 4. Troubleshooting CI/CD

| Issue | Root Cause | Solution |
| --- | --- | --- |
| `ZodError` in tests | Variable missing from Whitelist | Add the variable name to `INJECT_ENV_VARS`. |
| `pull access denied` | Private repo without login | Run `docker login` once on the VPS manually. |
| Dashboard shows 500 | `MONGODB_URL` is missing | Ensure the infra DB string is correctly mapped in `deploy.yml`. |
| Tests run old code | Docker used local cache | Ensure `docker pull` runs before `docker compose up`. |