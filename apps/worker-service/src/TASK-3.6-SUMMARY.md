# Task 3.6: Update Report Storage Paths (Org-Scoped)

**Sprint:** 3 - Data Isolation
**Task:** 3.6
**Date:** January 29, 2026
**Status:** ✅ COMPLETE

---

## Overview

Updated report storage paths to be organization-scoped, ensuring test reports (HTML reports, Allure reports, etc.) are isolated per organization in the multi-tenant system.

---

## Changes Made

### Worker Service Changes

#### 1. Updated Report Directory Structure

**File:** `apps/worker-service/src/worker.ts` (Lines 123-131)

**Before:**
```typescript
const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'test-results');
const baseTaskDir = path.join(reportsDir, taskId);

if (!fs.existsSync(baseTaskDir)) fs.mkdirSync(baseTaskDir, { recursive: true });
```

**After:**
```typescript
// Multi-tenant: Scope report storage by organization
const reportsDir = process.env.REPORTS_DIR || path.join(process.cwd(), 'test-results');
const orgReportsDir = path.join(reportsDir, organizationId);
const baseTaskDir = path.join(orgReportsDir, taskId);

if (!fs.existsSync(baseTaskDir)) {
    fs.mkdirSync(baseTaskDir, { recursive: true });
    console.log(`[Worker] Created org-scoped report directory: ${baseTaskDir}`);
}
```

**Impact:**
- **Old Path:** `{REPORTS_DIR}/{taskId}/`
- **New Path:** `{REPORTS_DIR}/{organizationId}/{taskId}/`

---

#### 2. Updated Report Base URL

**File:** `apps/worker-service/src/worker.ts` (Lines 133-136)

**Before:**
```typescript
const startTime = new Date();
const currentReportsBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';
```

**After:**
```typescript
const startTime = new Date();
// Multi-tenant: Include organizationId in report URLs
const apiBaseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3000';
const currentReportsBaseUrl = `${apiBaseUrl}/reports/${organizationId}`;
```

**Impact:**
- **Old URL:** `http://localhost:3000/reports/{taskId}/native-report/index.html`
- **New URL:** `http://localhost:3000/reports/{organizationId}/{taskId}/native-report/index.html`

---

## Directory Structure

### Before (Single-Tenant)

```
reports/
├── task-abc123/
│   ├── native-report/
│   │   └── index.html
│   ├── allure-results/
│   └── allure-report/
├── task-xyz789/
│   ├── native-report/
│   └── allure-report/
└── task-def456/
    └── native-report/
```

**Problem:** All organizations' reports mixed together.

---

### After (Multi-Tenant)

```
reports/
├── 507f191e810c19729de860ea/  ← Organization A
│   ├── task-abc123/
│   │   ├── native-report/
│   │   │   └── index.html
│   │   ├── allure-results/
│   │   └── allure-report/
│   └── task-xyz789/
│       ├── native-report/
│       └── allure-report/
│
├── 507f191e810c19729de860eb/  ← Organization B
│   ├── task-def456/
│   │   ├── native-report/
│   │   └── allure-report/
│   └── task-ghi789/
│       └── native-report/
│
└── 507f191e810c19729de860ec/  ← Organization C
    └── task-jkl012/
        └── native-report/
```

**Benefit:** Reports isolated per organization.

---

## Report URL Examples

### Playwright Report

**Old URL:**
```
http://localhost:3000/reports/task-abc123/native-report/index.html
```

**New URL:**
```
http://localhost:3000/reports/507f191e810c19729de860ea/task-abc123/native-report/index.html
```

---

### Allure Report

**Old URL:**
```
http://localhost:3000/reports/task-abc123/allure-report/index.html
```

**New URL:**
```
http://localhost:3000/reports/507f191e810c19729de860ea/task-abc123/allure-report/index.html
```

---

### Mochawesome Report

**Old URL:**
```
http://localhost:3000/reports/task-abc123/native-report/mochawesome.html
```

**New URL:**
```
http://localhost:3000/reports/507f191e810c19729de860ea/task-abc123/native-report/mochawesome.html
```

---

## Data Flow

### 1. Worker Receives Job from RabbitMQ

```json
{
  "taskId": "task-abc123",
  "organizationId": "507f191e810c19729de860ea",
  "image": "playwright-tests",
  "command": "npm test",
  "folder": "e2e"
}
```

---

### 2. Worker Creates Org-Scoped Directory

```typescript
const orgReportsDir = path.join(reportsDir, '507f191e810c19729de860ea');
const baseTaskDir = path.join(orgReportsDir, 'task-abc123');

fs.mkdirSync(baseTaskDir, { recursive: true });
// Creates: /app/test-results/507f191e810c19729de860ea/task-abc123/
```

**Log Output:**
```
[Worker] Created org-scoped report directory: /app/test-results/507f191e810c19729de860ea/task-abc123/
```

---

### 3. Worker Runs Tests in Container

```bash
docker run --name org_507f...860ea_task_task-abc123 \
  -e TASK_ID=task-abc123 \
  -e BASE_URL=http://host.docker.internal:3000 \
  playwright-tests
```

---

### 4. Worker Copies Artifacts from Container

```typescript
// Copy from container: /app/playwright-report
// To host: /app/test-results/507f191e810c19729de860ea/task-abc123/native-report/

await container.getArchive({ path: '/app/playwright-report' });
```

**Log Output:**
```
Copying artifacts from container to /app/test-results/507f191e810c19729de860ea/task-abc123/...
Successfully mapped playwright-report to native-report
```

---

### 5. Worker Updates Database with Report URL

```typescript
const currentReportsBaseUrl = `http://localhost:3000/reports/507f191e810c19729de860ea`;

await executionsCollection.updateOne(
    { taskId, organizationId: orgId },
    {
        $set: {
            status: 'PASSED',
            reportsBaseUrl: currentReportsBaseUrl
        }
    }
);
```

**Stored in MongoDB:**
```json
{
  "taskId": "task-abc123",
  "organizationId": "507f191e810c19729de860ea",
  "status": "PASSED",
  "reportsBaseUrl": "http://localhost:3000/reports/507f191e810c19729de860ea"
}
```

---

### 6. Dashboard Client Constructs Report URL

```typescript
const execution = await fetch('/api/executions');
// execution.reportsBaseUrl = "http://localhost:3000/reports/507f191e810c19729de860ea"
// execution.taskId = "task-abc123"

const reportUrl = `${execution.reportsBaseUrl}/${execution.taskId}/native-report/index.html`;
// Result: http://localhost:3000/reports/507f191e810c19729de860ea/task-abc123/native-report/index.html
```

---

## Security & Isolation

### ✅ Implemented

1. **Path-Based Isolation:** Reports stored in organization-specific directories
2. **URL Scoping:** Report URLs include organizationId in path
3. **Physical Separation:** Each organization's reports in separate filesystem directories
4. **Logging:** Directory creation logged for audit trail

### 🔒 Current Security Model

**Static File Serving:**
- Producer Service serves reports via `fastify-static` at `/reports/` prefix
- **No authentication currently required** to access static files
- Reports are public if you know the full URL

**Path Obfuscation:**
- organizationId is a MongoDB ObjectId (24-character hex string)
- Example: `507f191e810c19729de860ea`
- Difficult to guess/enumerate without access to database

**Security Level:** Medium (Path-based isolation)
- ✅ Organizations cannot accidentally see each other's reports
- ✅ Reports are physically separated on filesystem
- ⚠️ If organizationId is leaked, reports could be accessed
- ❌ No explicit authentication on `/reports/*` routes

---

### 🚀 Future Security Enhancements (Phase 2+)

#### Option 1: Authentication Middleware on /reports/

```typescript
// Add auth middleware to static file serving
app.register(fastifyStatic, {
    root: REPORTS_DIR,
    prefix: '/reports/',
    decorateReply: false,
    preHandler: async (request, reply) => {
        // Verify JWT token
        await authMiddleware(request, reply);

        // Extract organizationId from URL
        const urlParts = request.url.split('/');
        const urlOrgId = urlParts[2]; // /reports/{orgId}/{taskId}/...

        // Verify user belongs to organization
        if (request.user?.organizationId !== urlOrgId) {
            return reply.code(404).send({ error: 'Report not found' });
        }
    }
});
```

#### Option 2: Signed URLs

```typescript
// Generate time-limited signed URLs
const reportUrl = generateSignedUrl({
    organizationId: execution.organizationId,
    taskId: execution.taskId,
    expiresIn: 3600 // 1 hour
});
```

#### Option 3: Proxy Endpoint

```typescript
// Serve reports through authenticated endpoint
app.get('/api/reports/:taskId/*', { preHandler: authMiddleware }, async (request, reply) => {
    const { taskId } = request.params;
    const organizationId = request.user.organizationId;
    const filePath = path.join(REPORTS_DIR, organizationId, taskId, request.params['*']);

    // Verify file exists and belongs to user's organization
    if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: 'Report not found' });
    }

    return reply.sendFile(filePath);
});
```

---

## Testing Recommendations

### Manual Testing

1. **Create Two Organizations:**
   ```bash
   # Organization A
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@org-a.com","password":"Test1234!","name":"Admin A","organizationName":"Organization A"}'

   # Organization B
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@org-b.com","password":"Test1234!","name":"Admin B","organizationName":"Organization B"}'
   ```

2. **Run Tests for Both Organizations:**
   ```bash
   # Org A triggers test
   curl -X POST http://localhost:3000/api/execution-request \
     -H "Authorization: Bearer $TOKEN_A" \
     -H "Content-Type: application/json" \
     -d '{"taskId":"test-org-a","image":"playwright-tests","command":"npm test","folder":"all","tests":[],"config":{}}'

   # Org B triggers test
   curl -X POST http://localhost:3000/api/execution-request \
     -H "Authorization: Bearer $TOKEN_B" \
     -H "Content-Type: application/json" \
     -d '{"taskId":"test-org-b","image":"playwright-tests","command":"npm test","folder":"all","tests":[],"config":{}}'
   ```

3. **Verify Report Storage:**
   ```bash
   # Check filesystem structure
   ls -la reports/
   # Should show:
   # reports/507f191e810c19729de860ea/test-org-a/
   # reports/507f191e810c19729de860eb/test-org-b/
   ```

4. **Verify Report URLs:**
   ```bash
   # Fetch executions for Org A
   curl http://localhost:3000/api/executions \
     -H "Authorization: Bearer $TOKEN_A"

   # Check reportsBaseUrl field:
   # "reportsBaseUrl": "http://localhost:3000/reports/507f191e810c19729de860ea"
   ```

5. **Access Reports:**
   ```bash
   # Org A's report
   curl http://localhost:3000/reports/507f191e810c19729de860ea/test-org-a/native-report/index.html

   # Org B's report
   curl http://localhost:3000/reports/507f191e810c19729de860eb/test-org-b/native-report/index.html
   ```

---

### Automated Tests

```typescript
describe('Report storage isolation', () => {
  test('stores reports in org-scoped directories', async () => {
    const organizationId = '507f191e810c19729de860ea';
    const taskId = 'test-task-123';

    const reportsDir = '/app/test-results';
    const expectedPath = path.join(reportsDir, organizationId, taskId);

    // Trigger test execution
    await executeTest({ organizationId, taskId });

    // Verify directory exists
    expect(fs.existsSync(expectedPath)).toBe(true);

    // Verify report files exist
    const reportPath = path.join(expectedPath, 'native-report', 'index.html');
    expect(fs.existsSync(reportPath)).toBe(true);
  });

  test('generates correct report URLs', () => {
    const organizationId = '507f191e810c19729de860ea';
    const taskId = 'test-task-123';
    const apiBaseUrl = 'http://localhost:3000';

    const expectedUrl = `${apiBaseUrl}/reports/${organizationId}`;

    // Verify URL construction
    expect(currentReportsBaseUrl).toBe(expectedUrl);
  });
});
```

---

## Logging Examples

### Directory Creation

```
[Worker] Created org-scoped report directory: /app/test-results/507f191e810c19729de860ea/task-abc123/
```

### Artifact Copying

```
Copying artifacts from container to /app/test-results/507f191e810c19729de860ea/task-abc123/...
Successfully mapped playwright-report to native-report
Successfully mapped allure-results to allure-results
Successfully mapped allure-report to allure-report
```

---

## Acceptance Criteria

- [x] Reports stored at `{REPORTS_DIR}/{organizationId}/{taskId}/`
- [x] Report URLs include organizationId: `{API_URL}/reports/{organizationId}/{taskId}/...`
- [x] Directory creation logged for debugging
- [x] Filesystem isolation per organization
- [x] Multiple organizations can have tasks with same taskId without conflicts
- [x] Backward compatible with existing static file serving
- [x] No changes required to Producer Service (auto-scoped by path)

---

## Migration Considerations

### Migrating Existing Reports (If Needed)

If you have existing reports from pre-multi-tenant era, migrate them to a default organization:

```bash
#!/bin/bash
# migrate-reports.sh

REPORTS_DIR="./reports"
DEFAULT_ORG_ID="507f1f77bcf86cd799439011"  # Default organization ID from migration

# Create default org directory
mkdir -p "$REPORTS_DIR/$DEFAULT_ORG_ID"

# Move all existing task directories to default org
for taskDir in "$REPORTS_DIR"/*; do
  if [ -d "$taskDir" ] && [ "$(basename $taskDir)" != "$DEFAULT_ORG_ID" ]; then
    taskId=$(basename "$taskDir")
    echo "Migrating $taskId to default organization..."
    mv "$taskDir" "$REPORTS_DIR/$DEFAULT_ORG_ID/"
  fi
done

echo "Migration complete!"
```

**Run migration:**
```bash
chmod +x migrate-reports.sh
./migrate-reports.sh
```

---

## Performance Impact

**Expected:** None to minimal

- Same number of files written
- One additional directory level (organizationId)
- No additional database queries
- Static file serving performance unchanged

**Monitoring:**
- Check disk space usage (reports accumulate over time)
- Monitor report directory sizes per organization
- Implement cleanup policy for old reports (future enhancement)

---

## Cleanup & Retention (Future Enhancement)

### Automatic Report Cleanup

```typescript
// Delete reports older than 30 days
async function cleanupOldReports() {
  const reportsDir = process.env.REPORTS_DIR || './reports';
  const retentionDays = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const orgs = fs.readdirSync(reportsDir);

  for (const org of orgs) {
    const orgDir = path.join(reportsDir, org);
    const tasks = fs.readdirSync(orgDir);

    for (const task of tasks) {
      const taskDir = path.join(orgDir, task);
      const stats = fs.statSync(taskDir);

      if (stats.mtime < cutoffDate) {
        console.log(`Deleting old report: ${org}/${task}`);
        fs.rmSync(taskDir, { recursive: true });
      }
    }
  }
}

// Run daily
setInterval(cleanupOldReports, 24 * 60 * 60 * 1000);
```

---

## Rollback Plan

If issues are discovered:

1. **Quick Fix:** Revert worker to previous version
2. **Proper Rollback:**
   - Revert worker-service code
   - Existing org-scoped reports remain accessible
   - New reports will be stored at old path
3. **Data Integrity:** Reports already stored in org-scoped directories remain accessible at new URLs

**No data loss** - reports are just files on disk.

---

## Next Steps

**Sprint 3 Remaining Task:**
- **Task 3.7:** Test multi-org data isolation end-to-end

**Future Enhancements (Phase 2+):**
- Add authentication to `/reports/*` routes
- Implement signed URLs for reports
- Add report cleanup/retention policy
- Add report storage quotas per plan (free: 1GB, team: 10GB, enterprise: unlimited)

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `apps/worker-service/src/worker.ts` | 123-131, 133-136 | Org-scoped report directories and URLs |

---

**Task Status:** ✅ COMPLETE
**Ready for:** Task 3.7 - Test multi-org data isolation end-to-end
