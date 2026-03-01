# 🚀 Deployment Guide

**Version:** 3.5.0
**Date:** February 27, 2026
**Phase:** Multi-Tenant SaaS — Automated Docker Lifecycle & Reliability
**Status:** ✅ **PRODUCTION READY**

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Deployment Steps](#deployment-steps)
5. [Verification & Smoke Tests](#verification--smoke-tests)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Deployment Monitoring](#post-deployment-monitoring)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Pre-Deployment Checklist

### Critical Requirements

#### 1. Environment Variables (CRITICAL)
- [ ] **PLATFORM_JWT_SECRET** - Generate cryptographically secure 64-character random string
  ```bash
  # Generate PLATFORM_JWT_SECRET
  openssl rand -hex 32
  # OR
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **PLATFORM_MONGO_URI** - Production MongoDB connection string with authentication
- [ ] **PLATFORM_RABBITMQ_URL** - Production RabbitMQ connection string
- [ ] **PLATFORM_REDIS_URL** - Production Redis connection string
- [ ] **PLATFORM_GEMINI_API_KEY** - Google Gemini API key for AI analysis
- [ ] **ALLOWED_ORIGINS** - Comma-separated list of allowed CORS origins
- [ ] **PUBLIC_API_URL** - Public-facing API URL (for report links)

#### 2. Security Configuration
- [ ] **SSL/TLS Certificates** - Ensure HTTPS is configured for API and Dashboard
- [ ] **CORS Origins** - Restrict to production domains only (no `*` or `true`)
- [ ] **Firewall Rules** - Only expose necessary ports (80, 443)
- [ ] **Database Security** - Enable authentication, restrict network access
- [ ] **Secret Rotation** - Plan for periodic secret rotation (quarterly)

#### 3. Infrastructure Readiness
- [ ] **Docker Engine** - Version 20.10+ installed on all nodes
- [ ] **Docker Compose** - Version 2.0+ installed
- [ ] **MongoDB** - Version 6.0+ with replica set configured
- [ ] **RabbitMQ** - Version 3.12+ with management plugin enabled
- [ ] **Redis** - Version 7.0+ with persistence enabled
- [ ] **Persistent Storage** - Volumes configured for reports, database, logs
- [ ] **Resource Limits** - CPU/Memory limits configured for containers

#### 4. Code & Dependencies
- [ ] **Git Repository** - All changes committed and pushed
- [ ] **Build Success** - All Docker images build without errors
- [ ] **Tests Passing** - Integration tests pass (8/8)
- [ ] **Dependencies Audited** - No critical vulnerabilities in npm packages
- [ ] **Documentation Updated** - README, .env.example, API docs current

#### 5. Backup & Recovery
- [ ] **Database Backup** - Pre-deployment snapshot created
- [ ] **Configuration Backup** - Current .env and docker-compose.yml saved
- [ ] **Rollback Plan** - Documented and tested
- [ ] **Recovery Time Objective (RTO)** - Defined (recommended: < 1 hour)
- [ ] **Recovery Point Objective (RPO)** - Defined (recommended: < 5 minutes)

---

## 🔧 Environment Setup

### 1. Create Production Environment File

**Location:** Server - `/opt/agnostic-automation-center/.env`

```bash
# 1. SSH into production server
ssh user@production-server

# 2. Create directory
sudo mkdir -p /opt/agnostic-automation-center
cd /opt/agnostic-automation-center

# 3. Copy .env.example
sudo cp .env.example .env

# 4. Edit with production values
sudo nano .env
```

**Production .env Template:**
```bash
# ================================
# PRODUCTION ENVIRONMENT VARIABLES
# ================================

# JWT Authentication (CRITICAL - CHANGE THESE!)
PLATFORM_JWT_SECRET=<64-character-random-hex-string>  # Generate: openssl rand -hex 32

# Database (MongoDB)
PLATFORM_MONGO_URI=mongodb://admin:<password>@mongodb-prod:27017/automation_platform?authSource=admin

# Message Queue (RabbitMQ)
PLATFORM_RABBITMQ_URL=amqp://admin:<password>@rabbitmq-prod:5672

# Cache (Redis)
PLATFORM_REDIS_URL=redis://:&lt;password&gt;@redis-prod:6379

# AI Analysis (Google Gemini)
PLATFORM_GEMINI_API_KEY=<REDACTED_GOOGLE_API_KEY>

# API Configuration
PUBLIC_API_URL=https://api.yourdomain.com
PRODUCER_URL=http://producer:3000

# CORS Configuration
ALLOWED_ORIGINS=https://app.yourdomain.com,https://dashboard.yourdomain.com

# Dashboard Configuration
VITE_API_URL=https://api.yourdomain.com
DASHBOARD_URL=https://app.yourdomain.com

# Reports & Storage
REPORTS_DIR=/app/reports

# Docker & Runtime
NODE_ENV=production
RUNNING_IN_DOCKER=true

# Logging (Optional)
LOG_LEVEL=info
LOG_AUTH=false  # Set to true for debugging auth issues
```

### 2. Generate Secrets

```bash
# Generate JWT_SECRET (64 characters)
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET"

# Generate MongoDB password
MONGO_PASSWORD=$(openssl rand -base64 32)
echo "MONGO_PASSWORD=$MONGO_PASSWORD"

# Generate RabbitMQ password
RABBIT_PASSWORD=$(openssl rand -base64 32)
echo "RABBIT_PASSWORD=$RABBIT_PASSWORD"

# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
```

### 3. Verify Environment Variables

```bash
# Check all critical variables are set
cat .env | grep -E "PLATFORM_JWT_SECRET|PLATFORM_MONGO_URI|PLATFORM_RABBITMQ_URL|PLATFORM_REDIS_URL|PLATFORM_GEMINI_API_KEY"

# Verify PLATFORM_JWT_SECRET is not default
if grep -q "dev-secret-CHANGE-IN-PRODUCTION" .env; then
  echo "❌ ERROR: PLATFORM_JWT_SECRET is still using default value!"
else
  echo "✅ PLATFORM_JWT_SECRET is set correctly"
fi
```

### 4. Database Connection (MONGO_URI)

> [!IMPORTANT]
> The `docker-compose.yml` uses `${MONGO_URI}` from your `.env` file to determine the database connection. **This is no longer hardcoded**.

Configure based on your environment:

| Mode | MONGO_URI Value | Use Case |
|------|----------------|----------|
| **Cloud** | `<REDACTED_MONGO_URI>` | Production/Staging with MongoDB Atlas |
| **Local** | `mongodb://automation-mongodb:27017/automation_platform` | Local development with Docker container |

**Setting Cloud Connection:**
```bash
# In .env file
MONGO_URI=<REDACTED_MONGO_URI>
```

**Setting Local Connection:**
```bash
# In .env file (uses Docker MongoDB container)
MONGO_URI=mongodb://automation-mongodb:27017/automation_platform
```

> [!WARNING]
> When switching between Cloud and Local:
> - Each database has separate user accounts
> - You must create a new account in the new environment
> - Existing JWT tokens will be invalid

---

## 📊 Database Migration

### Pre-Migration Steps

```bash
# 1. Backup existing database (CRITICAL)
mongodump --uri="mongodb://localhost:27017/automation_platform" --out=/backup/pre-migration-$(date +%Y%m%d-%H%M%S)

# 2. Verify backup
ls -lh /backup/

# 3. Test backup restoration (on staging first!)
mongorestore --uri="mongodb://staging-server:27017/automation_platform_test" /backup/pre-migration-20260129-120000
```

### Run Migration

```bash
# 1. Clone repository
cd /opt/agnostic-automation-center
git clone https://github.com/yourusername/agnostic-automation-center.git .

# 2. Install dependencies (for migration script)
npm install

# 3. Run migration script
export MONGODB_URI="mongodb://admin:<password>@mongodb-prod:27017/automation_platform?authSource=admin"
node migrations/001-add-organization-to-existing-data.ts

# Expected output:
# ✅ Migration started
# ✅ Created default organization
# ✅ Created default admin user
# ✅ Migrated 29 executions
# ✅ Created 15 indexes
# ✅ Migration completed successfully
```

### Post-Migration Verification

```bash
# 1. Connect to MongoDB
mongosh "mongodb://admin:<password>@mongodb-prod:27017/automation_platform?authSource=admin"

# 2. Verify collections and data
use automation_platform

# Check organizations
db.organizations.countDocuments()  // Should be >= 1

# Check users
db.users.countDocuments()  // Should be >= 1

# Check executions have organizationId
db.executions.findOne()  // Should have organizationId field

# Check indexes
db.executions.getIndexes()
db.users.getIndexes()
db.organizations.getIndexes()

# Exit
exit
```

---

## 🐳 Automated Test Image Lifecycle (v3.5.0)

### Overview

Starting with v3.5.0, the platform automatically builds and publishes a multi-platform Docker image for the Agnox test suite on every push to `main`. This eliminates the manual step of rebuilding and re-pushing the test image after each change.

### How It Works

The `build-test-image` job in `.github/workflows/deploy.yml` runs **after** the `quality-check` job passes:

1. **Docker Buildx setup:** Enables cross-platform builds via QEMU emulation.
2. **Docker Hub login:** Authenticates using the `DOCKER_USERNAME` and `DOCKER_PASSWORD` GitHub secrets.
3. **Multi-platform build & push:** Builds the `./tests/Dockerfile` for both `linux/amd64` (x86 servers) and `linux/arm64` (Oracle Cloud ARM instances), then pushes as `keinar101/agnox-tests:latest`.

### User Workflow

1. Make your test changes in the `tests/` directory.
2. Commit and push to `main`:
   ```bash
   git add tests/
   git commit -m "test: add login flow coverage"
   git push origin main
   ```
3. The GitHub Actions pipeline runs quality checks, then automatically rebuilds and republishes `keinar101/agnox-tests:latest`.
4. All subsequent test executions launched from the Agnox Dashboard will use the freshly built image — no manual action required.

> **Dashboard configuration:** In **Settings → Run Settings**, ensure your project's **Docker Image** field is set to `keinar101/agnox-tests:latest`. This is the image tag the worker will pull before each test run.

### Manual Build (Local Testing)

To reproduce the CI build locally — useful for debugging image build failures:

```bash
# Ensure Docker Buildx builder is active
docker buildx create --use --name multiarch-builder || docker buildx use multiarch-builder

# Build and push
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t keinar101/agnox-tests:latest \
  --push \
  .
```

> Requires `docker login` with credentials that have push access to `keinar101/agnox-tests`.

---

## 🚀 Deployment Steps

### Deployment Flow

```
1. Pull latest code
2. Build Docker images
3. Stop old containers
4. Start new containers
5. Verify services
6. Run smoke tests
7. Monitor logs
```

### Staging Deployment (Recommended First)

```bash
# 1. SSH to staging server
ssh user@staging-server
cd /opt/agnostic-automation-center

# 2. Pull latest code
git fetch origin
git checkout main
git pull origin main

# 3. Build images
docker-compose -f docker-compose.yml build

# 4. Stop existing containers
docker-compose down

# 5. Start new containers
docker-compose up -d

# 6. Verify all services started
docker-compose ps

# Expected output:
# NAME                          STATUS
# producer-service              Up 30 seconds
# worker-service                Up 30 seconds
# dashboard-client              Up 30 seconds
# automation-mongodb            Up 30 seconds
# automation-rabbitmq           Up 30 seconds
# automation-redis              Up 30 seconds

# 7. Check logs for errors
docker-compose logs --tail=50 producer
docker-compose logs --tail=50 worker
docker-compose logs --tail=50 dashboard

# 8. Run smoke tests (see Verification section below)
```

### Production Deployment

**IMPORTANT:** Only deploy to production after successful staging deployment and smoke tests.

```bash
# 1. SSH to production server
ssh user@production-server
cd /opt/agnostic-automation-center

# 2. Pull latest code
git fetch origin
git checkout main
git pull origin main

# 3. Verify commit hash matches staging
STAGING_COMMIT="<staging-commit-hash>"
CURRENT_COMMIT=$(git rev-parse HEAD)

if [ "$STAGING_COMMIT" == "$CURRENT_COMMIT" ]; then
  echo "✅ Commit matches staging"
else
  echo "❌ WARNING: Commit mismatch! Staging: $STAGING_COMMIT, Production: $CURRENT_COMMIT"
  exit 1
fi

# 4. Build images (production optimized)
docker-compose -f docker-compose.prod.yml build --no-cache

# 5. Create backup of current deployment
docker-compose ps > /backup/deployment-$(date +%Y%m%d-%H%M%S).txt
docker images > /backup/images-$(date +%Y%m%d-%H%M%S).txt

# 6. Rolling deployment (zero downtime)
# Option A: Blue-Green deployment
# Start new containers on different ports, switch load balancer, stop old containers

# Option B: Standard deployment (brief downtime)
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 7. Verify deployment
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs --tail=100

# 8. Health check
curl -f https://api.yourdomain.com/ || echo "❌ API health check failed"
curl -f https://app.yourdomain.com/ || echo "❌ Dashboard health check failed"
```

### Post-Deployment Cleanup

```bash
# Remove unused images
docker image prune -a -f

# Remove unused volumes (CAREFUL - only if absolutely sure)
# docker volume prune -f

# Check disk usage
docker system df
```

---

## ✅ Verification & Smoke Tests

### 1. Service Health Checks

```bash
# Producer Service
curl -f http://localhost:3000/
# Expected: {"message":"Agnostic Producer Service is running!"}

# Dashboard Client
curl -f http://localhost:8080/
# Expected: HTML response

# MongoDB
docker exec -it automation-mongodb mongosh --eval "db.adminCommand('ping')"
# Expected: { ok: 1 }

# RabbitMQ
docker exec -it automation-rabbitmq rabbitmqctl status
# Expected: Status information

# Redis
docker exec -it automation-redis redis-cli ping
# Expected: PONG
```

### 2. Authentication Tests

```bash
# Test signup endpoint
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test123!@#",
    "name": "Test User",
    "organizationName": "Test Organization"
  }'

# Expected:
# {
#   "success": true,
#   "token": "eyJhbGc...",
#   "user": { ... }
# }

# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test123!@#"
  }'

# Expected:
# {
#   "success": true,
#   "token": "eyJhbGc...",
#   "user": { ... }
# }
```

### 3. Protected Endpoint Tests

```bash
# Get executions (requires auth)
TOKEN="<token-from-login>"

curl -X GET http://localhost:3000/api/executions \
  -H "Authorization: Bearer $TOKEN"

# Expected:
# {
#   "success": true,
#   "data": []
# }
```

### 4. Multi-Tenant Isolation Test

```bash
# Create two organizations
ORG1_TOKEN=$(curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"org1@test.com","password":"Test123!@#","name":"User 1","organizationName":"Org 1"}' \
  | jq -r '.token')

ORG2_TOKEN=$(curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"org2@test.com","password":"Test123!@#","name":"User 2","organizationName":"Org 2"}' \
  | jq -r '.token')

# Verify isolation
# Org 1 should see 0 executions
curl -X GET http://localhost:3000/api/executions \
  -H "Authorization: Bearer $ORG1_TOKEN" \
  | jq '.data | length'
# Expected: 0

# Org 2 should see 0 executions
curl -X GET http://localhost:3000/api/executions \
  -H "Authorization: Bearer $ORG2_TOKEN" \
  | jq '.data | length'
# Expected: 0
```

### 5. Socket.io Connection Test

```bash
# Test Socket.io connection (requires wscat or similar tool)
npm install -g wscat

# Connect to Socket.io (replace TOKEN with actual JWT)
wscat -c "ws://localhost:3000/socket.io/?EIO=4&transport=websocket" \
  --header "Authorization: Bearer $TOKEN"

# Send authentication
42["auth",{"token":"YOUR_JWT_TOKEN"}]

# Expected:
# 42["auth-success",{"message":"Connected to organization channel",...}]
```

### 6. Dashboard UI Test

```bash
# Open dashboard in browser
open http://localhost:8080

# Manual checks:
# ✅ Login page loads
# ✅ Can signup new user
# ✅ Can login with credentials
# ✅ Dashboard displays after login
# ✅ No console errors in browser DevTools
# ✅ Socket.io connection successful (check Network tab → WS)
```

### 7. Integration Test Suite

```bash
# Run automated integration tests
cd tests
npm install
npm run test:integration

# Expected:
# ✅ 8/8 tests passed
```

---

## 🔙 Rollback Procedures

### Quick Rollback (Revert to Previous Docker Images)

```bash
# 1. Stop current containers
docker-compose down

# 2. List available images
docker images | grep agnostic-automation-center

# 3. Tag previous version
docker tag agnostic-automation-center-producer:previous agnostic-automation-center-producer:latest
docker tag agnostic-automation-center-worker:previous agnostic-automation-center-worker:latest
docker tag agnostic-automation-center-dashboard:previous agnostic-automation-center-dashboard:latest

# 4. Start previous version
docker-compose up -d

# 5. Verify rollback
docker-compose ps
docker-compose logs --tail=100
```

### Database Rollback (If Migration Failed)

```bash
# 1. Stop all services
docker-compose down

# 2. Drop current database
mongosh "mongodb://admin:<password>@mongodb-prod:27017/automation_platform?authSource=admin" \
  --eval "db.dropDatabase()"

# 3. Restore from backup
mongorestore --uri="mongodb://admin:<password>@mongodb-prod:27017/automation_platform?authSource=admin" \
  /backup/pre-migration-20260129-120000

# 4. Restart services with old code
git checkout <previous-commit-hash>
docker-compose up -d
```

### Full System Rollback

```bash
# 1. Stop all containers
docker-compose down

# 2. Revert code to previous version
git log --oneline -n 10  # Find previous stable commit
git checkout <previous-stable-commit>

# 3. Restore database from backup
mongorestore --uri="mongodb://admin:<password>@mongodb-prod:27017/automation_platform" \
  /backup/pre-migration-20260129-120000

# 4. Rebuild and restart
docker-compose build
docker-compose up -d

# 5. Verify rollback
curl http://localhost:3000/
curl http://localhost:8080/
```

---

## 📊 Post-Deployment Monitoring

### 1. Real-Time Monitoring

```bash
# Monitor all service logs
docker-compose logs -f

# Monitor specific service
docker-compose logs -f producer
docker-compose logs -f worker
docker-compose logs -f dashboard

# Monitor resource usage
docker stats

# Expected:
# CONTAINER               CPU %    MEM USAGE / LIMIT     NET I/O
# producer-service        2.5%     150MiB / 512MiB       1.2kB / 890B
# worker-service          1.2%     200MiB / 1GiB         450B / 320B
# dashboard-client        0.5%     50MiB / 256MiB        2.1kB / 1.5kB
```

### 2. Application Metrics

```bash
# Check MongoDB connections
docker exec -it automation-mongodb mongosh --eval "db.serverStatus().connections"
# Expected: { current: <number>, available: <number> }

# Check RabbitMQ queues
docker exec -it automation-rabbitmq rabbitmqctl list_queues
# Expected: test_queue with 0 messages (idle)

# Check Redis memory usage
docker exec -it automation-redis redis-cli INFO memory
# Expected: Memory usage statistics
```

### 3. System Health Endpoint (v3.5.0)

The `GET /api/system/monitor-status` endpoint provides a machine-readable health signal for external uptime monitors. It powers [status.agnox.dev](https://status.agnox.dev).

**Required environment variable:** Set `MONITORING_SECRET_KEY` in your `.env` to a secure random string (min 32 chars):
```bash
MONITORING_SECRET_KEY=$(openssl rand -hex 32)
```

**Probe the endpoint:**
```bash
curl -s \
  -H "X-Agnox-Monitor-Secret: $MONITORING_SECRET_KEY" \
  https://api.agnox.dev/api/system/monitor-status
# Expected:
# { "success": true, "data": { "status": "healthy", "version": "3.5.0", "timestamp": "..." } }
```

**Uptime monitor setup (e.g., UptimeRobot / BetterStack):**
1. Create a new HTTP(S) monitor pointing to `https://api.agnox.dev/api/system/monitor-status`.
2. Add a custom HTTP header: `X-Agnox-Monitor-Secret: <your-secret>`.
3. Set the expected keyword or status code to `"healthy"` / `200`.
4. Connect to your status page at `status.agnox.dev`.

> **Security:** Never expose `MONITORING_SECRET_KEY` publicly. Requests without a valid header receive `401 Unauthorized`. This ensures the health endpoint cannot be used for information gathering by unauthorized parties.

### 3. Error Monitoring (First 24 Hours)

```bash
# Monitor for errors in producer service
docker-compose logs producer | grep -i error

# Monitor for failed authentications
docker-compose logs producer | grep -i "401\|403"

# Monitor for database errors
docker-compose logs producer | grep -i "mongo\|database"

# Set up alerts (example using cron)
# Check errors every 5 minutes for first day
*/5 * * * * docker-compose logs --since 5m producer | grep -i error && echo "Errors detected in producer service!" | mail -s "Production Alert" admin@example.com
```

### 4. Performance Monitoring

```bash
# API response time test
time curl http://localhost:3000/api/executions -H "Authorization: Bearer $TOKEN"
# Expected: < 200ms

# Database query performance
docker exec -it automation-mongodb mongosh --eval "db.executions.find({}).limit(10).explain('executionStats')"
# Check: executionTimeMillis should be < 50ms

# Socket.io connection time
# Use browser DevTools Network tab
# Expected: < 500ms for connection establishment
```

### 5. Security Monitoring

```bash
# Monitor failed login attempts
docker-compose logs producer | grep -i "Invalid credentials" | wc -l

# Monitor JWT verification failures
docker-compose logs producer | grep -i "Invalid token" | wc -l

# Monitor suspicious activity
docker-compose logs producer | grep -i "403\|429"
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Issue 1: Producer Service Won't Start

**Symptoms:**
```
producer-service exited with code 1
Error: Failed to connect to MongoDB
```

**Solution:**
```bash
# Check MongoDB is running
docker-compose ps automation-mongodb

# Check MongoDB logs
docker-compose logs automation-mongodb

# Verify MONGODB_URL in .env
cat .env | grep MONGODB_URL

# Test MongoDB connection
docker exec -it automation-mongodb mongosh --eval "db.adminCommand('ping')"

# Restart MongoDB
docker-compose restart automation-mongodb
```

---

#### Issue 2: Dashboard Shows "Network Error"

**Symptoms:**
- Dashboard loads but shows connection errors
- Cannot login
- Console shows CORS errors

**Solution:**
```bash
# Check VITE_API_URL is correct
cat .env | grep VITE_API_URL

# Verify CORS configuration in producer service
docker-compose logs producer | grep -i cors

# Check producer service is accessible
curl http://localhost:3000/

# Verify ALLOWED_ORIGINS includes dashboard URL
cat .env | grep ALLOWED_ORIGINS
```

---

#### Issue 3: Socket.io Connection Fails

**Symptoms:**
```
WebSocket connection to 'ws://localhost:3000/socket.io/' failed
```

**Solution:**
```bash
# Check Socket.io registration in producer service
docker-compose logs producer | grep -i "socket"

# Verify JWT token is being sent
# (Check browser DevTools → Network → WS → Headers)

# Test Socket.io endpoint
curl http://localhost:3000/socket.io/

# Restart producer service
docker-compose restart producer
```

---

#### Issue 4: Tests Fail After Migration

**Symptoms:**
```
executions collection not found
organizationId is null
```

**Solution:**
```bash
# Verify migration completed
mongosh "mongodb://localhost:27017/automation_platform" --eval "db.organizations.countDocuments()"

# Check if executions have organizationId
mongosh "mongodb://localhost:27017/automation_platform" --eval "db.executions.findOne()"

# Re-run migration if needed
node migrations/001-add-organization-to-existing-data.ts
```

---

#### Issue 5: "Invalid Token" Errors

**Symptoms:**
```
401 Unauthorized - Invalid token
JWT verification failed
```

**Solution:**
```bash
# Verify JWT_SECRET matches between services
cat .env | grep JWT_SECRET

# Check JWT_SECRET is not default
if grep -q "dev-secret-CHANGE-IN-PRODUCTION" .env; then
  echo "❌ ERROR: JWT_SECRET is default!"
fi

# Generate new JWT_SECRET if needed
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env

# Restart all services
docker-compose down && docker-compose up -d
```

---

#### Issue 6: High CPU/Memory Usage

**Symptoms:**
```
docker stats shows >80% CPU or memory usage
Containers restarting frequently
```

**Solution:**
```bash
# Check resource limits
docker-compose config | grep -A 5 "resources:"

# Increase limits in docker-compose.yml
# services:
#   producer:
#     deploy:
#       resources:
#         limits:
#           memory: 1G
#           cpus: '2.0'

# Check for memory leaks
docker-compose logs producer | grep -i "out of memory"

# Restart services
docker-compose down && docker-compose up -d
```

---

#### Issue 7: Duplicate Executions

**Symptoms:**
- Same taskId appears twice in database
- One execution stuck PENDING, one completes

**Solution:**
```bash
# Verify organizationId is STRING in both services
docker-compose logs worker | grep -i "organizationId"

# Check worker service code
# Ensure NO ObjectId conversion:
# ✅ Correct: { taskId, organizationId }
# ❌ Wrong: { taskId, organizationId: new ObjectId(organizationId) }

# Clean up duplicates manually
mongosh "mongodb://localhost:27017/automation_platform" --eval "
  db.executions.aggregate([
    { \$group: { _id: '\$taskId', count: { \$sum: 1 }, docs: { \$push: '\$_id' } } },
    { \$match: { count: { \$gt: 1 } } }
  ]).forEach(doc => {
    db.executions.deleteMany({ _id: { \$in: doc.docs.slice(1) } });
  });
"
```

---

## 📞 Support Contacts

### Emergency Contacts
- **DevOps Lead:** [Contact Info]
- **Backend Developer:** [Contact Info]
- **Frontend Developer:** [Contact Info]
- **Database Admin:** [Contact Info]

### Escalation Path
1. **Level 1:** Check troubleshooting guide above
2. **Level 2:** Review logs and error messages
3. **Level 3:** Contact DevOps Lead
4. **Level 4:** Initiate rollback procedures
5. **Level 5:** Contact all stakeholders

---

## 🔐 SSL/TLS Setup

Use a reverse proxy (Nginx, Caddy, or Traefik) for SSL termination:

```nginx
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

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 🛡️ Security Hardening

### 1. Change Default Credentials
- Generate strong JWT secret (64+ chars): `openssl rand -hex 64`
- Use managed MongoDB with authentication
- Enable Redis authentication
- Change RabbitMQ default credentials

### 2. Network Isolation
- Use Docker networks to isolate services
- Don't expose MongoDB/Redis/RabbitMQ ports publicly
- Use firewall rules to restrict access

### 3. HTTPS Only
- Enable HSTS headers
- Redirect HTTP → HTTPS
- Use valid SSL certificates (Let's Encrypt)

### 4. Rate Limiting
- Configured by default (Redis-based)
- Auth endpoints: 5 requests/minute per IP
- API endpoints: 100 requests/minute per organization

For a full security review, see the [Security Audit](./security-audit.md).

---

## 💾 Backup & Restore

### MongoDB Backup

```bash
# Backup
docker-compose exec mongodb mongodump --out=/backup

# Restore
docker-compose exec mongodb mongorestore /backup
```

### Redis Backup

```bash
# Redis saves snapshots automatically (RDB)
docker-compose exec redis redis-cli BGSAVE
```

---

## 📈 Scaling

### Horizontal Scaling
- Run multiple Worker Service instances for parallel test execution
- Use a load balancer for Producer Service
- Use MongoDB replica set for high availability
- Use Redis Cluster for distributed rate limiting

### Kubernetes Deployment
See the [Kubernetes deployment guide](./kubernetes.md) for k8s-specific configuration.

---

## 📚 Additional Resources

- [Architecture Overview](../architecture/overview.md)
- [API Reference](../api/README.md)
- [Security Audit](./security-audit.md)
- [Troubleshooting](./troubleshooting.md)
- [Kubernetes Guide](./kubernetes.md)
