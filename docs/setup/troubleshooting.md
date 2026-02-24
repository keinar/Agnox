# Troubleshooting Guide

Common issues and solutions for the Agnox.

---

## 🚀 Startup Issues

### Services Won't Start

**Symptom:** `docker-compose up` fails or services exit immediately

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker ps
   # If error: Start Docker Desktop/daemon
   ```

2. **Check port conflicts:**
   ```bash
   # Check if ports are already in use
   netstat -an | findstr "3000 8080 27017 5672 6379"  # Windows
   lsof -i :3000,8080,27017,5672,6379                 # Mac/Linux
   ```

3. **Clean and rebuild:**
   ```bash
   docker-compose down -v  # Remove volumes
   docker-compose up --build --force-recreate
   ```

4. **Check logs:**
   ```bash
   docker-compose logs producer-service
   docker-compose logs worker-service
   ```

---

### MongoDB Connection Errors

**Symptom:** `Failed to connect to MongoDB` in logs

**Solutions:**

1. **Wait for MongoDB to start:**
   - MongoDB takes 10-15 seconds to initialize
   - Producer/Worker services retry automatically

2. **Check MongoDB is healthy:**
   ```bash
   docker-compose ps mongodb
   # Status should be "Up" not "Restarting"
   ```

3. **Verify connection string:**
   ```env
   # In .env or docker-compose.yml
   MONGODB_URI=mongodb://automation-mongodb:27017/automation_platform
   # Use container name, not localhost
   ```

4. **Check MongoDB logs:**
   ```bash
   docker-compose logs mongodb
   ```

---

### RabbitMQ Connection Errors

**Symptom:** `Failed to connect to RabbitMQ` in worker logs

**Solutions:**

1. **Check RabbitMQ is running:**
   ```bash
   docker-compose ps rabbitmq
   ```

2. **Verify connection URL:**
   ```env
   RABBITMQ_URL=amqp://automation-rabbitmq:5672
   # Use container name, not localhost
   ```

3. **Check RabbitMQ management UI:**
   - Open http://localhost:15672
   - Login: `guest` / `guest`
   - Check queue `automation_queue` exists

---

## 🔐 Authentication Issues

### "Invalid or expired token" on Every Request

**Symptom:** Logged in but every API call returns 401

**Solutions:**

1. **Check JWT secret matches:**
   ```bash
   # Same JWT_SECRET in producer-service across restarts
   # If changed, all existing tokens are invalidated
   ```

2. **Verify token expiration:**
   ```env
   JWT_EXPIRY=24h  # In producer-service
   # Token expires after 24 hours by default
   ```

3. **Check Authorization header format:**
   ```javascript
   // Correct
   headers: { 'Authorization': 'Bearer eyJhbGc...' }

   // Incorrect (missing "Bearer ")
   headers: { 'Authorization': 'eyJhbGc...' }
   ```

4. **Clear browser localStorage and login again:**
   ```javascript
   localStorage.removeItem('jwt_token');
   // Then login again
   ```

---

### "Account temporarily locked" After Failed Logins

**Symptom:** Cannot login even with correct password

**Solutions:**

1. **Wait 15 minutes:**
   - Account locked for 15 minutes after 5 failed attempts
   - Automatic unlock after expiration

2. **Manual unlock via Redis:**
   ```bash
   docker exec -it <redis-container> redis-cli
   > DEL login_lock:user@example.com
   > DEL login_failures:user@example.com
   > exit
   ```

3. **Check Redis is running:**
   ```bash
   docker-compose ps redis
   ```

---

### Email Invitations Not Sending

**Symptom:** Invitation created but email never arrives

**Solutions:**

1. **Check SendGrid configuration:**
   ```env
   # In .env
   SENDGRID_API_KEY=SG.your-api-key
   FROM_EMAIL=noreply@agnox.dev
   FROM_NAME=Agnox
   ```

2. **Check logs for email errors:**
   ```bash
   docker-compose logs producer-service | grep -i "email\|sendgrid"
   ```

3. **Verify SendGrid API key is valid:**
   - Log into SendGrid dashboard
   - Check Activity → Email Activity for delivery status

4. **If SendGrid is not configured:**
   - The system falls back to console logging
   - Invitation will be created but email won't be sent
   - Check producer logs for the invitation accept URL

---

### Rate Limit Errors (429 Too Many Requests)

**Symptom:** API returns 429 status code

**Solutions:**

1. **Check current rate limits:**
   - Auth endpoints: 5 requests/min per IP
   - API endpoints: 100 requests/min per organization
   - Admin actions: 10 requests/min per organization

2. **Wait for the rate limit window to reset** (typically 60 seconds)

3. **Manual rate limit reset (development only):**
   ```bash
   docker exec -it automation-redis redis-cli
   > KEYS rl:*
   > DEL rl:api:<your-org-id>
   > exit
   ```

4. **Check if you're running automation against the API:**
   - Consider adding delays between requests
   - Use API keys for CI/CD to track usage separately

---

### Invalid Credentials When Switching Environments

**Symptom:** Login fails after changing from Cloud to Local database (or vice versa)

**Cause:** Each database environment has separate user accounts.

**Solutions:**

1. **Check your MONGO_URI in `.env`:**
   ```bash
   # Cloud (MongoDB Atlas)
   MONGO_URI=<REDACTED_MONGO_URI>
   
   # Local (Docker container)
   MONGO_URI=mongodb://automation-mongodb:27017/automation_platform
   ```

2. **Create a new account** in the target environment (users don't transfer between databases)

3. **Clear browser localStorage** to remove stale JWT tokens:
   ```javascript
   localStorage.clear();
   // Then refresh and login
   ```

4. **Restart services** after changing `MONGO_URI`:
   ```bash
   docker-compose down && docker-compose up -d
   ```

## 🧪 Test Execution Issues

### Tests Stuck in "PENDING" Status

**Symptom:** Execution created but never starts running

**Solutions:**

1. **Check worker service is running:**
   ```bash
   docker-compose ps worker-service
   docker-compose logs worker-service
   ```

2. **Check RabbitMQ queue has consumer:**
   - Open http://localhost:15672
   - Go to Queues → `automation_queue`
   - Check "Consumers" column shows 1 or more

3. **Restart worker service:**
   ```bash
   docker-compose restart worker-service
   ```

---

### Tests Stuck in "RUNNING" Status Forever

**Symptom:** Test execution shows RUNNING but never completes

**Solutions:**

1. **Check worker logs:**
   ```bash
   docker-compose logs -f worker-service
   # Look for container errors or crashes
   ```

2. **Check Docker socket access:**
   ```yaml
   # In docker-compose.yml worker service
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock  # Required
   ```

3. **Test container might have crashed:**
   ```bash
   docker ps -a | grep playwright  # Or your test image
   docker logs <container-id>
   ```

4. **Clean up stuck containers:**
   ```bash
   docker ps -a | grep Exited
   docker rm $(docker ps -a -q --filter "status=exited")
   ```

---

### "Docker image not found" Error

**Symptom:** Worker fails with image pull error

**Solutions:**

1. **Pull image manually:**
   ```bash
   docker pull mcr.microsoft.com/playwright:latest
   # Or your custom image
   ```

2. **Check image name is correct:**
   ```json
   // In execution request
   {
     "image": "mcr.microsoft.com/playwright:latest",  // Full name with registry
     "command": "npm test"
   }
   ```

3. **Private registry authentication:**
   ```bash
   docker login your-registry.com
   # Or configure Docker credentials helper
   ```

---

## 🌐 WebSocket / Real-time Issues

### Live Logs Not Showing

**Symptom:** Tests run but logs don't appear in dashboard

**Solutions:**

1. **Check WebSocket connection:**
   ```javascript
   // In browser console
   console.log('Socket connected:', socket.connected);
   ```

2. **Verify Socket.io handshake includes token:**
   ```javascript
   const socket = io('http://localhost:3000', {
     auth: {
       token: localStorage.getItem('jwt_token')  // Must include
     }
   });
   ```

3. **Check CORS configuration:**
   ```javascript
   // In producer-service index.ts
   app.register(socketio, {
     cors: {
       origin: "*",  // Development
       methods: ["GET", "POST"]
     }
   });
   ```

4. **Check producer logs for Socket.io connections:**
   ```bash
   docker-compose logs producer-service | grep -i "socket"
   ```

---

### "auth-error" on Socket Connection

**Symptom:** WebSocket connects but immediately gets auth-error

**Solutions:**

1. **Check JWT token is valid:**
   ```javascript
   // Verify token exists and is not expired
   const token = localStorage.getItem('jwt_token');
   console.log('Token:', token);
   ```

2. **Ensure token is in handshake auth:**
   ```javascript
   // Correct
   io('http://localhost:3000', { auth: { token: yourToken } });

   // Incorrect (missing auth)
   io('http://localhost:3000');
   ```

---

## 📊 Data / Database Issues

### Can't See Executions from Other Users

**Symptom:** Only see my own test runs, not team's

**Behavior:** **THIS IS EXPECTED** - Multi-tenant isolation working correctly

**Explanation:**
- All users in same organization should see same executions
- If not seeing team executions, check:
  1. You're logged in to correct organization
  2. Executions have correct `organizationId` field
  3. Your JWT token has correct `organizationId`

**Verify:**
```javascript
// In browser console after login
const token = localStorage.getItem('jwt_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Organization ID:', payload.organizationId);
```

---

### Old Executions Missing After Migration

**Symptom:** Historical executions disappeared

**Solutions:**

1. **Check migration ran successfully:**
   ```bash
   # In MongoDB
   docker exec -it <mongo-container> mongosh automation_platform
   > db.executions.findOne()
   # Should have organizationId field
   ```

2. **Re-run migration if needed:**
   ```bash
   cd migrations
   npm install
   npm run migrate:001
   ```

3. **Check organizationId matches:**
   ```bash
   # In MongoDB
   > db.executions.find({ organizationId: { $exists: false } }).count()
   # Should be 0
   ```

---

## ⚡ Performance Issues

### Dashboard Slow to Load

**Solutions:**

1. **Check execution history size:**
   ```bash
   # Limit query results
   GET /api/executions?limit=50
   ```

2. **Clear old executions:**
   ```bash
   # In MongoDB
   > db.executions.deleteMany({
       startTime: { $lt: new Date('2026-01-01') }
     })
   ```

3. **Check Redis is running:**
   ```bash
   docker-compose ps redis
   # Redis caches improve performance
   ```

---

### Rate Limit Errors on Normal Usage

**Symptom:** Getting 429 errors despite normal use

**Solutions:**

1. **Check rate limit configuration:**
   ```typescript
   // In rateLimiter.ts
   api: {
     windowMs: 60000,      // 1 minute
     maxRequests: 100,     // 100 requests per minute
   }
   ```

2. **Temporary increase for testing:**
   ```typescript
   // Modify and rebuild
   maxRequests: 500,  // Higher limit
   ```

3. **Manual reset via Redis:**
   ```bash
   docker exec -it <redis-container> redis-cli
   > DEL rl:api:your-org-id
   > exit
   ```

---

## 🔧 Development Issues

### Hot Reload Not Working

**Symptom:** Code changes don't reflect without rebuild

**Solutions:**

1. **Check volume mounts:**
   ```yaml
   # In docker-compose.yml
   services:
     dashboard-client:
       volumes:
         - ./apps/dashboard-client:/app  # Source code mount
         - /app/node_modules              # Don't override node_modules
   ```

2. **Restart service:**
   ```bash
   docker-compose restart dashboard-client
   ```

3. **Full rebuild if needed:**
   ```bash
   docker-compose up --build dashboard-client
   ```

---

### TypeScript Errors in IDE but Not in Container

**Symptom:** VS Code shows errors but code runs fine

**Solutions:**

1. **Install dependencies locally:**
   ```bash
   cd apps/dashboard-client
   npm install
   # Or npm install from root with workspace setup
   ```

2. **Restart TypeScript server:**
   - VS Code: Cmd/Ctrl + Shift + P → "Restart TypeScript Server"

3. **Check tsconfig.json paths:**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@shared/*": ["../../packages/shared-types/src/*"]
       }
     }
   }
   ```

---

## 🛠️ Debugging Tips

### Enable Debug Logging

**Producer Service:**
```env
LOG_LEVEL=debug  # In docker-compose.yml environment
```

**Worker Service:**
```env
DEBUG=true
```

**MongoDB Queries:**
```javascript
// Add to producer code temporarily
console.log('Query:', { organizationId: request.user.organizationId });
```

---

### Check All Service Health

```bash
# Quick health check
docker-compose ps

# Detailed logs for each service
docker-compose logs -f producer-service
docker-compose logs -f worker-service
docker-compose logs -f mongodb
docker-compose logs -f redis
docker-compose logs -f rabbitmq

# Check resource usage
docker stats
```

---

### Reset Everything (Nuclear Option)

```bash
# ⚠️ WARNING: Deletes all data and containers
docker-compose down -v
docker system prune -a --volumes
docker-compose up --build --force-recreate
```

---

## 📞 Getting Help

### Before Opening an Issue

1. **Check logs:**
   ```bash
   docker-compose logs > debug.log
   # Attach debug.log to issue
   ```

2. **Gather environment info:**
   - OS and version
   - Docker version: `docker --version`
   - Node version (if running locally): `node --version`

3. **Reproduce steps:**
   - List exact steps to reproduce
   - Expected vs actual behavior

### Useful Commands

```bash
# View all containers (including stopped)
docker ps -a

# Inspect container
docker inspect <container-id>

# Execute command in container
docker exec -it <container-id> sh

# View container resource usage
docker stats

# Check network connectivity
docker exec -it <container> ping mongodb
docker exec -it <container> ping producer-service
```

---

## Related Documentation

- [Deployment Guide](./deployment.md)
- [Architecture Overview](../architecture/overview.md)
- [API Documentation](../api/README.md)
- [Security Audit](./security-audit.md)
