# Self-Hosting Guide

> **Note:** This guide is for maintainers and contributors who want to self-host the Agnostic Automation Center.
>
> **End users** should refer to the [main README](../../README.md) for API integration instructions.

---

## Prerequisites

- **Docker & Docker Compose** (for local development)
- **Node.js 18+** (for running database migrations)
- **MongoDB** (Atlas or local instance)
- **Redis** (for rate limiting and caching)
- **RabbitMQ** (for task queue)
- **Secure JWT secret** (generate with: `openssl rand -hex 64`)

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Agnostic-Automation-Center
```

### 2. Generate JWT Secret

```bash
openssl rand -hex 64
```

### 3. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# JWT Authentication
JWT_SECRET=<your-64-char-hex-secret>
JWT_EXPIRY=24h
PASSWORD_SALT_ROUNDS=10

# Database
MONGODB_URL=mongodb://mongodb:27017/automation_platform
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://rabbitmq:5672

# AI Analysis (Optional)
GEMINI_API_KEY=<your-gemini-api-key>

# Email Service (for invitations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASS=<your-app-password>
SMTP_FROM=noreply@yourcompany.com

# CORS (production)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Test Execution Defaults
DEFAULT_TEST_IMAGE=mcr.microsoft.com/playwright:v1.40.0
DEFAULT_BASE_URL=http://localhost:3000
DEFAULT_TEST_FOLDER=all
```

### 4. Start Services with Docker Compose

```bash
docker-compose up --build
```

This will start:
- **Dashboard Client** (port 8080)
- **Producer Service** (port 3000)
- **Worker Service** (internal)
- **MongoDB** (port 27017)
- **Redis** (port 6379)
- **RabbitMQ** (port 5672, management UI on 15672)

### 5. Access the Dashboard

- **Dashboard:** http://localhost:8080
- **API:** http://localhost:3000
- **RabbitMQ Management:** http://localhost:15672 (guest/guest)

### 6. Create Your First Account

1. Navigate to http://localhost:8080/signup
2. Create account (organization created automatically)
3. First user becomes organization admin
4. Invite team members via Settings → Team Members

---

## Production Deployment

### Using Docker Compose (Recommended)

```bash
# Production compose file
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables for Production

```env
# Production API URL
VITE_API_URL=https://api.yourdomain.com

# Enable HTTPS enforcement
NODE_ENV=production

# Restrict CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Use managed services
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/automation
REDIS_URL=redis://prod-redis.example.com:6379
RABBITMQ_URL=amqp://user:pass@rabbitmq.example.com:5672

# Production SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
```

### SSL/TLS Setup

Use a reverse proxy (Nginx, Caddy, Traefik) for SSL termination:

```nginx
# Nginx example
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Database Migrations

If you're upgrading from a single-tenant installation, run the migration script:

```bash
# Ensure Node.js 18+ is installed
node migrations/add-organizationId.js
```

This will:
- Create default organization
- Assign all existing data to default organization
- Verify multi-tenant isolation

---

## Monitoring & Logs

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f producer-service
docker-compose logs -f worker-service
```

### Health Checks

```bash
# Producer Service
curl http://localhost:3000/

# MongoDB connection
docker-compose exec mongodb mongosh --eval "db.runCommand({ ping: 1 })"

# Redis connection
docker-compose exec redis redis-cli ping
```

---

## Troubleshooting

### Services Won't Start

```bash
# Clean restart
docker-compose down -v
docker-compose up --build
```

### MongoDB Connection Issues

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Connect to MongoDB shell
docker-compose exec mongodb mongosh

# Check database
use automation_platform
db.users.countDocuments()
```

### RabbitMQ Issues

```bash
# Access RabbitMQ Management UI
# http://localhost:15672 (guest/guest)

# Check queue status
docker-compose exec rabbitmq rabbitmqctl list_queues
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker-compose logs -f worker-service

# Restart worker
docker-compose restart worker-service
```

---

## Security Hardening

### 1. Change Default Credentials

- Generate strong JWT secret (64+ chars)
- Use managed MongoDB with authentication
- Enable Redis authentication
- Change RabbitMQ default credentials

### 2. Network Isolation

- Use Docker networks to isolate services
- Don't expose MongoDB/Redis/RabbitMQ ports publicly
- Use firewall rules to restrict access

### 3. HTTPS Only

- Enable HSTS headers (already configured)
- Redirect HTTP → HTTPS
- Use valid SSL certificates (Let's Encrypt)

### 4. Rate Limiting

- Configured by default (Redis-based)
- Auth endpoints: 5 requests/minute
- API endpoints: 100 requests/minute per organization

---

## Backup & Restore

### MongoDB Backup

```bash
# Backup
docker-compose exec mongodb mongodump --out=/backup

# Restore
docker-compose exec mongodb mongorestore /backup
```

### Redis Backup

```bash
# Redis automatically saves snapshots (RDB)
docker-compose exec redis redis-cli BGSAVE
```

---

## Scaling

### Horizontal Scaling

- Run multiple Worker Service instances
- Use load balancer for Producer Service
- Use MongoDB replica set
- Use Redis Cluster for high availability

### Kubernetes Deployment

See [Kubernetes deployment guide](../setup/kubernetes.md) (if available)

---

## Support

For maintainers and contributors:
- **Issues:** [GitHub Issues](https://github.com/your-org/agnostic-automation-center/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/agnostic-automation-center/discussions)
- **Email:** info@digital-solution.co.il
