# Multi-Tenant Isolation Tests

End-to-end tests for verifying complete data isolation between organizations in the multi-tenant SaaS platform.

---

## Prerequisites

1. **Services Running:**
   ```bash
   docker-compose up producer-service mongodb rabbitmq redis
   ```

2. **Dependencies Installed:**
   ```bash
   npm install axios socket.io-client
   npm install -D tsx @types/node
   ```

---

## Running Tests

### Multi-Organization Isolation Test (End-to-End)

```bash
npx tsx tests/multi-org-isolation-e2e.test.ts
```

**What it tests:**
- ✅ Organization creation and JWT authentication
- ✅ Database query isolation (executions filtered by organizationId)
- ✅ Cross-organization delete protection (404 returned)
- ✅ Socket.io room-based broadcasting (organization-specific rooms)
- ✅ Report URL format (includes organizationId)
- ✅ User resource management (can delete own, not others)

**Expected output:**
```
================================================================================
  Multi-Organization Isolation End-to-End Test
================================================================================

================================================================================
  TEST 1: Create Two Organizations
================================================================================
ℹ️  Creating Organization A...
✅ Organization A created
  Organization ID: 507f191e810c19729de860ea
  User ID: 507f1f77bcf86cd799439011

ℹ️  Creating Organization B...
✅ Organization B created
  Organization ID: 507f191e810c19729de860eb
  User ID: 507f1f77bcf86cd799439012

================================================================================
  TEST 2: Verify JWT Authentication
================================================================================
ℹ️  User A fetching /api/auth/me...
✅ User A authenticated correctly
  Organization: Test Organization A

ℹ️  User B fetching /api/auth/me...
✅ User B authenticated correctly
  Organization: Test Organization B

================================================================================
  TEST 3: Database Isolation (Executions)
================================================================================
ℹ️  User A creating execution...
✅ Organization A execution created (taskId: test-org-a-1738157400000)
ℹ️  User B creating execution...
✅ Organization B execution created (taskId: test-org-b-1738157400000)
ℹ️  User A fetching executions...
✅ User A can only see their own execution
  Found 1 execution(s)
ℹ️  User B fetching executions...
✅ User B can only see their own execution
  Found 1 execution(s)

================================================================================
  TEST 4: Delete Operation Isolation
================================================================================
ℹ️  User B attempting to delete User A's execution...
✅ User B cannot delete User A's execution (404 as expected)
ℹ️  Verifying User A's execution still exists...
✅ User A's execution still exists after failed delete attempt

================================================================================
  TEST 5: Socket.io Room-Based Broadcasting
================================================================================
ℹ️  Testing Socket.io room isolation...
ℹ️  Connecting User A to Socket.io...
✅ User A connected to Socket.io
  Room: org:507f191e810c19729de860ea
ℹ️  Connecting User B to Socket.io...
✅ User B connected to Socket.io
  Room: org:507f191e810c19729de860eb
ℹ️  Simulating execution update for Organization A...
ℹ️  User A received update for their execution ✓
✅ User A received their update correctly
✅ User B did not receive Org A's update (correct isolation)
✅ Socket.io room-based broadcasting is properly isolated

================================================================================
  TEST 6: Report URL Isolation
================================================================================
ℹ️  Verifying report URL format...
✅ Report URL includes organizationId
  Report Base URL: http://localhost:3000/reports/507f191e810c19729de860ea

================================================================================
  TEST 7: User Deletion (Owner Can Delete Their Own)
================================================================================
ℹ️  User A deleting their own execution...
✅ User A successfully deleted their own execution
✅ Execution successfully removed from database

================================================================================
  🎉 ALL TESTS PASSED! 🎉
================================================================================

Multi-Tenant Isolation Summary:
✅ ✓ Organization creation and JWT authentication
✅ ✓ Database query isolation (executions filtered by organizationId)
✅ ✓ Cross-organization delete blocked (404 returned)
✅ ✓ Socket.io room-based broadcasting (organization-specific)
✅ ✓ Report URLs include organizationId
✅ ✓ Users can manage their own resources

Isolation Features Verified:
  • MongoDB: All queries filtered by organizationId
  • RabbitMQ: Messages include organizationId
  • Socket.io: Room-based broadcasting per organization
  • Reports: Org-scoped storage paths
  • Redis: Org-scoped metric keys (implicit)
  • Auth: JWT-based with organizationId in payload

✅ Phase 1 - Sprint 3 Complete! Multi-tenant data isolation is working correctly.
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3000` | Producer Service URL |

**Example:**
```bash
API_URL=http://localhost:3000 npx tsx tests/multi-org-isolation-e2e.test.ts
```

---

## Test Breakdown

### Test 1: Create Two Organizations
- Creates Organization A with admin user
- Creates Organization B with admin user
- Verifies JWT tokens returned
- Extracts organizationId for both

### Test 2: Verify JWT Authentication
- User A calls `/api/auth/me`
- User B calls `/api/auth/me`
- Verifies each user sees their correct organization

### Test 3: Database Isolation (Executions)
- User A creates execution `test-org-a-{timestamp}`
- User B creates execution `test-org-b-{timestamp}`
- User A fetches executions → Should only see their own
- User B fetches executions → Should only see their own
- **CRITICAL:** Verifies no cross-org data leaks

### Test 4: Delete Operation Isolation
- User B attempts to delete User A's execution
- Should receive `404 Not Found` (not 403 - security best practice)
- Verifies User A's execution still exists
- **CRITICAL:** Prevents cross-org resource manipulation

### Test 5: Socket.io Room-Based Broadcasting
- Connects User A and User B via Socket.io with JWT tokens
- Verifies both join organization-specific rooms
- Broadcasts update for Organization A
- User A should receive update
- User B should NOT receive update
- **CRITICAL:** Verifies real-time updates are isolated

### Test 6: Report URL Isolation
- Verifies report URLs include organizationId in path
- Format: `{API_URL}/reports/{organizationId}/{taskId}/...`
- **CRITICAL:** Ensures report paths are org-scoped

### Test 7: User Deletion (Owner Can Delete Their Own)
- User A deletes their own execution
- Verifies deletion succeeds
- Verifies execution removed from database
- **CRITICAL:** Users can manage their own resources

---

## Troubleshooting

### "ECONNREFUSED" Error
**Problem:** Cannot connect to API

**Solution:**
```bash
# Start services
docker-compose up producer-service mongodb rabbitmq redis

# Verify producer is running
curl http://localhost:3000/
```

---

### "Socket.io test partially skipped"
**Problem:** Socket.io tests skipped with warning

**Impact:** Low - Other isolation tests still verify multi-tenancy

**Solution:**
- Check if Socket.io is enabled in producer-service
- Verify port 3000 is accessible
- This warning is acceptable for basic isolation testing

---

### Test Hangs or Times Out
**Problem:** Test doesn't complete

**Solution:**
1. Check MongoDB is running: `docker ps | grep mongodb`
2. Check producer-service logs: `docker-compose logs producer-service`
3. Verify no port conflicts: `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)

---

### "Email already registered" Error
**Problem:** Test user email conflicts with existing data

**Solution:**
- Tests use timestamp-based emails to avoid conflicts
- If error persists, clear MongoDB test database:
  ```bash
  docker-compose exec mongodb mongosh automation_platform --eval "db.users.deleteMany({ email: /test.com$/ })"
  ```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Multi-Tenant Isolation Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker-compose up -d producer-service mongodb rabbitmq redis

      - name: Wait for services
        run: |
          sleep 10
          curl --retry 10 --retry-delay 3 http://localhost:3000/

      - name: Run isolation tests
        run: npx tsx tests/multi-org-isolation-e2e.test.ts

      - name: Cleanup
        if: always()
        run: docker-compose down
```

---

## Future Test Additions

### Performance Tests
```bash
# Test concurrent users from multiple organizations
npx tsx tests/multi-org-performance.test.ts
```

### Load Tests
```bash
# Test system under load with 100+ organizations
npx tsx tests/multi-org-load.test.ts
```

### Security Penetration Tests
```bash
# Attempt to bypass isolation using various attack vectors
npx tsx tests/multi-org-security.test.ts
```

---

## Test Data Cleanup

After running tests, you may want to clean up test data:

```bash
# Delete test organizations
docker-compose exec mongodb mongosh automation_platform --eval "
  db.organizations.deleteMany({ name: /^Test Organization/ });
  db.users.deleteMany({ email: /test.com$/ });
  db.executions.deleteMany({ taskId: /^test-org-/ });
"
```

---

## Success Criteria

All tests must pass with:
- ✅ No cross-organization data leaks
- ✅ No authentication failures
- ✅ No database query errors
- ✅ Proper 404 responses for cross-org access
- ✅ Socket.io broadcasts isolated by room
- ✅ Report URLs include organizationId

**Exit Code:**
- `0` = All tests passed
- `1` = Tests failed (see error output)

---

## Additional Resources

- **Phase 1 Plan:** `docs/implementation/phase-1-plan.md`
- **Auth Routes:** `apps/producer-service/src/routes/README.md`
- **Middleware:** `apps/producer-service/src/middleware/README.md`
- **Task Summaries:** `apps/producer-service/src/TASK-*.md`
