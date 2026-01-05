# 🤖 CI/CD Pipeline & Secret Injection

The system uses GitHub Actions to automate deployments and maintain a secure environment.

### 1. Secret Injection Flow
To maintain the agnostic nature of the platform, secrets are handled as follows:
1. Store the secret in **GitHub Actions Secrets** (e.g., `MY_API_KEY`).
2. Update the `deploy.yml` to echo this secret into the server's `.env`.
3. Add the variable name to the `INJECT_ENV_VARS` list.

### 2. Deployment Workflow (`deploy.yml`)
The pipeline ensures that every push to `main` updates the server without losing configuration.

**Crucial Deployment Script:**
```yaml
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          script: |
            cd ~/playwright-full-stack-framework
            # Recreate .env from GitHub Secrets to prevent data loss
            echo "MONGO_URI=${{ secrets.MONGO_URI }}" > .env
            echo "ADMIN_USER=${{ secrets.ADMIN_USER }}" >> .env
            echo "INJECT_ENV_VARS=ADMIN_USER,MONGO_URI,GEMINI_API_KEY" >> .env
            
            # Pull latest client image
            docker pull ${{ secrets.DEFAULT_TEST_IMAGE }}
            
            # Restart services
            docker compose -f docker-compose.prod.yml up -d --build
```
### 3. Key Secrets Required

| Name | Purpose |
| --- | --- |
| `VPS_HOST` | Server IP |
| `MONGO_URI` | Infrastructure DB |
| `DEFAULT_TEST_IMAGE` | The Agnostic Test Image to run |
| `ADMIN_USER` | (Example) Client-side secret |