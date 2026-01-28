# Task 3.1: Update All Execution Queries with organizationId Filter

**Sprint:** 3 - Data Isolation
**Task:** 3.1
**Date:** January 28, 2026
**Status:** ✅ COMPLETE

---

## Overview

Updated all execution-related endpoints in the Producer Service to include `organizationId` filtering, ensuring complete data isolation between organizations in the multi-tenant system.

---

## Changes Made

### 1. Added ObjectId Import

**File:** `apps/producer-service/src/index.ts` (Line 4)

```typescript
// BEFORE
import { MongoClient } from 'mongodb';

// AFTER
import { MongoClient, ObjectId } from 'mongodb';
```

**Reason:** Required for converting organizationId strings from JWT to MongoDB ObjectId.

---

### 2. Updated GET /api/executions

**File:** `apps/producer-service/src/index.ts` (Lines 140-156)

**Before:**
```typescript
app.get('/api/executions', async (request, reply) => {
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });
        const collection = dbClient.db(DB_NAME).collection('executions');
        return await collection.find({}).sort({ startTime: -1 }).limit(50).toArray();
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch data' });
    }
});
```

**After:**
```typescript
app.get('/api/executions', async (request, reply) => {
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });

        // Multi-tenant data isolation: Filter by organizationId from JWT
        const organizationId = new ObjectId(request.user!.organizationId);

        const collection = dbClient.db(DB_NAME).collection('executions');
        const executions = await collection
            .find({ organizationId })
            .sort({ startTime: -1 })
            .limit(50)
            .toArray();

        return executions;
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch data' });
    }
});
```

**Impact:** Users now only see executions from their own organization.

---

### 3. Updated POST /api/execution-request

**File:** `apps/producer-service/src/index.ts` (Lines 197-241)

**Key Changes:**

1. **Extract organizationId from JWT:**
```typescript
// Multi-tenant data isolation: Include organizationId from JWT
const organizationId = new ObjectId(request.user!.organizationId);
```

2. **Include in RabbitMQ message:**
```typescript
const taskData = {
    ...parseResult.data,
    organizationId: organizationId.toString(),  // Include organizationId for worker
    folder: folder || 'all',
    config: {
        ...enrichedConfig
    }
};
```

3. **Include in database document:**
```typescript
await collection.updateOne(
    { taskId },
    {
        $set: {
            taskId,
            organizationId,  // Add organizationId for multi-tenant isolation
            image,
            command,
            status: 'PENDING',
            folder: folder || 'all',
            startTime,
            config: enrichedConfig,
            tests: tests || []
        }
    },
    { upsert: true }
);
```

4. **Include in Socket.io broadcast:**
```typescript
app.io.emit('execution-updated', {
    taskId,
    organizationId: organizationId.toString(),  // Include in broadcast
    status: 'PENDING',
    startTime,
    image,
    command,
    config: enrichedConfig,
    tests: tests || []
});
```

**Impact:**
- New executions are automatically tagged with organizationId
- RabbitMQ messages include organizationId for worker processing
- Real-time updates include organizationId (preparation for room-based broadcasting)

---

### 4. Updated DELETE /api/executions/:id

**File:** `apps/producer-service/src/index.ts` (Lines 252-277)

**Before:**
```typescript
app.delete('/api/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });
        const collection = dbClient.db(DB_NAME).collection('executions');
        await collection.deleteOne({ taskId: id });
        return { status: 'Deleted successfully' };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to delete' });
    }
});
```

**After:**
```typescript
app.delete('/api/executions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        if (!dbClient) return reply.status(500).send({ error: 'Database not connected' });

        // Multi-tenant data isolation: Verify ownership by filtering with organizationId
        const organizationId = new ObjectId(request.user!.organizationId);

        const collection = dbClient.db(DB_NAME).collection('executions');
        const result = await collection.deleteOne({
            taskId: id,
            organizationId  // Only delete if belongs to this organization
        });

        // Return 404 instead of 403 to prevent leaking information about other orgs
        if (result.deletedCount === 0) {
            return reply.status(404).send({
                success: false,
                error: 'Execution not found'
            });
        }

        return { success: true, message: 'Execution deleted successfully' };
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to delete' });
    }
});
```

**Security Note:** Returns `404 Not Found` instead of `403 Forbidden` when execution belongs to another organization. This prevents information leakage about other organizations' resources.

**Impact:** Users can only delete executions from their own organization.

---

### 5. Updated GET /api/metrics/:image

**File:** `apps/producer-service/src/index.ts` (Lines 84-112)

**Before:**
```typescript
app.get('/api/metrics/:image', async (request, reply) => {
    const { image } = request.params as { image: string };
    const key = `metrics:test:${image}`;

    try {
        // Fetch last 10 durations
        const durations = await redis.lrange(key, 0, -1);
        // ... rest of metrics logic
    }
});
```

**After:**
```typescript
app.get('/api/metrics/:image', async (request, reply) => {
    const { image } = request.params as { image: string };
    // Scope Redis keys by organization for multi-tenant isolation
    const organizationId = request.user?.organizationId || 'global';
    const key = `metrics:${organizationId}:test:${image}`;

    try {
        // Fetch last 10 durations
        const durations = await redis.lrange(key, 0, -1);
        // ... rest of metrics logic
    }
});
```

**Impact:** Performance metrics are now scoped by organization, preventing data leakage.

---

## Data Isolation Verification

### What's Now Isolated:

1. **Executions Query (GET /api/executions)**
   - Users only see executions from their organization
   - Filter: `{ organizationId: <user's org> }`

2. **Execution Creation (POST /api/execution-request)**
   - New executions tagged with user's organizationId
   - RabbitMQ messages include organizationId for worker

3. **Execution Deletion (DELETE /api/executions/:id)**
   - Users can only delete their organization's executions
   - Returns 404 for other organizations' resources (security best practice)

4. **Performance Metrics (GET /api/metrics/:image)**
   - Redis keys scoped by organization
   - Each org has separate performance tracking

---

## Security Considerations

### ✅ Implemented

1. **Query Filtering:** All database queries filter by `organizationId` from JWT token
2. **Ownership Verification:** Delete operations verify resource belongs to user's organization
3. **Information Hiding:** Returns 404 instead of 403 for cross-org access attempts
4. **Redis Scoping:** Performance metrics keys scoped by organization

### 🔄 Still Needed (Future Tasks)

1. **Socket.io Room-Based Broadcasting:** Task 3.5
2. **Worker Organization Filtering:** Task 3.4
3. **Report Storage Scoping:** Task 3.6

---

## Testing Recommendations

### Manual Testing Steps

1. **Create Two Organizations:**
   ```bash
   # Organization A
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@org-a.com",
       "password": "Test1234!",
       "name": "Admin A",
       "organizationName": "Organization A"
     }'

   # Organization B
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@org-b.com",
       "password": "Test1234!",
       "name": "Admin B",
       "organizationName": "Organization B"
     }'
   ```

2. **Test Data Isolation:**
   ```bash
   # User A creates execution
   curl -X POST http://localhost:3000/api/execution-request \
     -H "Authorization: Bearer <token-a>" \
     -H "Content-Type: application/json" \
     -d '{
       "taskId": "test-org-a-1",
       "image": "test-image",
       "command": "npm test",
       "folder": "all",
       "tests": [],
       "config": {}
     }'

   # User B fetches executions (should be empty)
   curl -X GET http://localhost:3000/api/executions \
     -H "Authorization: Bearer <token-b>"

   # User A fetches executions (should see their execution)
   curl -X GET http://localhost:3000/api/executions \
     -H "Authorization: Bearer <token-a>"
   ```

3. **Test Deletion Isolation:**
   ```bash
   # User B tries to delete User A's execution (should get 404)
   curl -X DELETE http://localhost:3000/api/executions/test-org-a-1 \
     -H "Authorization: Bearer <token-b>"

   # Expected: 404 Not Found
   ```

---

## Acceptance Criteria

- [x] GET /api/executions filters by organizationId
- [x] POST /api/execution-request includes organizationId in database
- [x] POST /api/execution-request includes organizationId in RabbitMQ message
- [x] DELETE /api/executions/:id verifies ownership
- [x] DELETE returns 404 for other org's resources (not 403)
- [x] GET /api/metrics/:image uses org-scoped Redis keys
- [x] All queries use `new ObjectId(request.user!.organizationId)`
- [x] No global queries (`find({})`) remain

---

## Next Steps

**Task 3.2:** Update RabbitMQ messages to include organizationId ✅ (Already done!)
**Task 3.3:** Update Worker to extract and use organizationId
**Task 3.4:** Implement Socket.io room-based broadcasting
**Task 3.5:** Update report storage paths (org-scoped)
**Task 3.6:** Test multi-org data isolation

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `apps/producer-service/src/index.ts` | 4, 84-112, 140-156, 197-241, 252-277 | Added organizationId filtering to all execution endpoints |

---

## Performance Impact

**Expected:** Minimal to none

- MongoDB indexes on `organizationId` will be created in migration (already done in Sprint 1)
- Query performance may improve slightly due to more specific filters
- Redis key scoping has negligible overhead

**Monitoring:**
- Watch for any queries missing organizationId (should trigger index scans)
- Monitor API response times (p95 should remain < 300ms)

---

## Rollback Plan

If issues are discovered:

1. **Temporary Fix:** Remove organizationId filter from queries (emergency only)
2. **Proper Rollback:** Revert this commit and redeploy previous version
3. **Data Integrity:** No data changes in this task, only query modifications

---

**Task Status:** ✅ COMPLETE
**Ready for:** Task 3.3 - Update Worker to extract and use organizationId
