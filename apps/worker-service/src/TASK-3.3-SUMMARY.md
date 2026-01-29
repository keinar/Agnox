# Task 3.3: Update Worker to Extract and Use organizationId

**Sprint:** 3 - Data Isolation
**Task:** 3.3
**Date:** January 28, 2026
**Status:** ✅ COMPLETE

---

## Overview

Updated the Worker Service to extract organizationId from RabbitMQ messages and use it throughout the execution lifecycle to ensure complete multi-tenant data isolation.

---

## Changes Made

### 1. Added ObjectId Import

**File:** `apps/worker-service/src/worker.ts` (Line 2)

```typescript
// BEFORE
import { MongoClient } from 'mongodb';

// AFTER
import { MongoClient, ObjectId } from 'mongodb';
```

**Reason:** Required for converting organizationId strings from RabbitMQ messages to MongoDB ObjectId.

---

### 2. Updated Performance Metrics Function

**File:** `apps/worker-service/src/worker.ts` (Lines 67-73)

**Before:**
```typescript
async function updatePerformanceMetrics(testName: string, durationMs: number) {
    const key = `metrics:test:${testName}`;
    await redis.lpush(key, durationMs);
    await redis.ltrim(key, 0, 9);
    console.log(`[Redis] Updated metrics for ${testName}. Duration: ${durationMs}ms`);
}
```

**After:**
```typescript
async function updatePerformanceMetrics(testName: string, durationMs: number, organizationId: string) {
    // Multi-tenant: Scope Redis keys by organization
    const key = `metrics:${organizationId}:test:${testName}`;
    await redis.lpush(key, durationMs);
    await redis.ltrim(key, 0, 9);
    console.log(`[Redis] Updated metrics for ${testName} (org: ${organizationId}). Duration: ${durationMs}ms`);
}
```

**Impact:** Performance metrics now scoped by organization, matching the Producer Service implementation.

---

### 3. Extract organizationId from RabbitMQ Message

**File:** `apps/worker-service/src/worker.ts` (Lines 112-121)

**Before:**
```typescript
const task = JSON.parse(msg.content.toString());
const { taskId, image, command, config } = task;
```

**After:**
```typescript
const task = JSON.parse(msg.content.toString());
const { taskId, image, command, config, organizationId } = task;

// Multi-tenant: Convert organizationId string to ObjectId for MongoDB queries
if (!organizationId) {
    console.error(`[Worker] ERROR: Task ${taskId} missing organizationId. Rejecting message.`);
    channel!.nack(msg, false, false); // Don't requeue
    return;
}
const orgId = new ObjectId(organizationId);
```

**Security:** Rejects messages missing organizationId to prevent data corruption or security issues.

---

### 4. Updated Status to RUNNING (DB Update)

**File:** `apps/worker-service/src/worker.ts` (Lines 131-147)

**Before:**
```typescript
await executionsCollection.updateOne(
    { taskId },
    { $set: { status: 'RUNNING', startTime, config, reportsBaseUrl: currentReportsBaseUrl } },
    { upsert: true }
);

await notifyProducer({
    taskId,
    status: 'RUNNING',
    // ...
});
```

**After:**
```typescript
// Notify start (DB update) - Multi-tenant: Filter by organizationId
await executionsCollection.updateOne(
    { taskId, organizationId: orgId },
    { $set: { status: 'RUNNING', startTime, config, reportsBaseUrl: currentReportsBaseUrl } },
    { upsert: true }
);

await notifyProducer({
    taskId,
    organizationId,  // Include for room-based broadcasting
    status: 'RUNNING',
    // ...
});
```

**Impact:**
- MongoDB query filters by both taskId and organizationId
- Socket.io broadcast includes organizationId for room-based broadcasting (Task 3.5)

---

### 5. Added organizationId to Container Name

**File:** `apps/worker-service/src/worker.ts` (Lines 167-171)

**New Code:**
```typescript
// Multi-tenant: Include organizationId in container name for isolation
const containerName = `org_${organizationId}_task_${taskId}`;

container = await docker.createContainer({
    name: containerName,
    Image: image,
    // ...
});
```

**Benefits:**
- Easy identification of which organization a container belongs to
- Better debugging and monitoring (can see org in `docker ps`)
- Prevents container name collisions between organizations
- Example: `org_507f191e810c19729de860ea_task_abc123`

---

### 6. Updated Status to ANALYZING (DB Update)

**File:** `apps/worker-service/src/worker.ts` (Lines 224-237)

**Before:**
```typescript
await executionsCollection.updateOne(
    { taskId },
    { $set: { status: 'ANALYZING', output: logsBuffer } }
);
await notifyProducer({
    taskId,
    status: 'ANALYZING',
    // ...
});
```

**After:**
```typescript
// Multi-tenant: Filter by organizationId
await executionsCollection.updateOne(
    { taskId, organizationId: orgId },
    { $set: { status: 'ANALYZING', output: logsBuffer } }
);
await notifyProducer({
    taskId,
    organizationId,  // Include for room-based broadcasting
    status: 'ANALYZING',
    // ...
});
```

---

### 7. Updated Performance Metrics Call

**File:** `apps/worker-service/src/worker.ts` (Line 298)

**Before:**
```typescript
await updatePerformanceMetrics(image, duration);
```

**After:**
```typescript
// Multi-tenant: Pass organizationId to scope metrics by org
await updatePerformanceMetrics(image, duration, organizationId);
```

---

### 8. Updated Final Status Update (DB Update)

**File:** `apps/worker-service/src/worker.ts` (Lines 302-320)

**Before:**
```typescript
const updateData = {
    taskId,
    status: finalStatus,
    // ...
};

await executionsCollection.updateOne({ taskId }, { $set: updateData });
await notifyProducer(updateData);
console.log(`✅ Task ${taskId} finished with status: ${finalStatus}`);
```

**After:**
```typescript
const updateData = {
    taskId,
    organizationId,  // Include for room-based broadcasting
    status: finalStatus,
    // ...
};

// Multi-tenant: Filter by organizationId
await executionsCollection.updateOne(
    { taskId, organizationId: orgId },
    { $set: updateData }
);
await notifyProducer(updateData);
console.log(`✅ Task ${taskId} (org: ${organizationId}) finished with status: ${finalStatus}`);
```

**Impact:** Log messages now include organizationId for better debugging.

---

### 9. Updated Error Handling (DB Update)

**File:** `apps/worker-service/src/worker.ts` (Lines 322-337)

**Before:**
```typescript
console.error(`❌ Container orchestration failure for task ${taskId}:`, error.message);
const errorData = {
    taskId,
    status: 'ERROR',
    // ...
};
await executionsCollection.updateOne({ taskId }, { $set: errorData });
await notifyProducer(errorData);
```

**After:**
```typescript
console.error(`❌ Container orchestration failure for task ${taskId} (org: ${organizationId}):`, error.message);
const errorData = {
    taskId,
    organizationId,  // Include for room-based broadcasting
    status: 'ERROR',
    // ...
};
// Multi-tenant: Filter by organizationId
await executionsCollection.updateOne(
    { taskId, organizationId: orgId },
    { $set: errorData }
);
await notifyProducer(errorData);
```

---

## Data Flow

### RabbitMQ Message Structure

**From Producer (Task 3.1):**
```json
{
  "taskId": "abc123",
  "organizationId": "507f191e810c19729de860ea",
  "image": "test-image",
  "command": "npm test",
  "folder": "all",
  "config": {
    "baseUrl": "http://localhost:3000",
    "envVars": {}
  }
}
```

### Worker Processing Flow

1. **Extract organizationId** from message → Validate it exists
2. **Convert to ObjectId** for MongoDB queries
3. **Update to RUNNING** → Filter by `{ taskId, organizationId }`
4. **Create container** with org-scoped name: `org_507f...860ea_task_abc123`
5. **Run tests** in container
6. **Update to ANALYZING** (if failed) → Filter by `{ taskId, organizationId }`
7. **Store metrics** with org-scoped Redis key: `metrics:507f...860ea:test:image-name`
8. **Final update** → Filter by `{ taskId, organizationId }`
9. **Notify Producer** → Include organizationId for room-based broadcasting

---

## Security & Isolation

### ✅ Implemented

1. **Message Validation:** Rejects messages without organizationId
2. **Query Filtering:** All MongoDB updates filter by organizationId
3. **Container Naming:** Container names include organizationId
4. **Redis Scoping:** Performance metrics scoped by organization
5. **Broadcast Data:** All Socket.io notifications include organizationId

### 🛡️ Protection Against

- **Cross-org data corruption:** Worker can only update executions belonging to the correct organization
- **Cross-org metrics pollution:** Performance metrics isolated per organization
- **Execution confusion:** Container names clearly show which org they belong to

---

## Testing Recommendations

### Unit Tests

```typescript
describe('Worker organizationId handling', () => {
  test('rejects message without organizationId', async () => {
    const message = {
      taskId: 'test-123',
      image: 'test-image',
      command: 'npm test',
      config: {}
      // Missing organizationId
    };

    // Should nack message without requeuing
  });

  test('converts organizationId to ObjectId', () => {
    const orgIdString = '507f191e810c19729de860ea';
    const orgId = new ObjectId(orgIdString);
    expect(orgId).toBeInstanceOf(ObjectId);
    expect(orgId.toString()).toBe(orgIdString);
  });

  test('scopes Redis keys by organization', async () => {
    const orgId = '507f191e810c19729de860ea';
    await updatePerformanceMetrics('test-image', 1000, orgId);

    const key = `metrics:${orgId}:test:test-image`;
    const metrics = await redis.lrange(key, 0, -1);
    expect(metrics).toContain('1000');
  });
});
```

### Integration Tests

1. **Create Test Organizations:**
   - Organization A: `507f191e810c19729de860ea`
   - Organization B: `507f191e810c19729de860eb`

2. **Send Execution for Org A:**
   ```json
   {
     "taskId": "org-a-test",
     "organizationId": "507f191e810c19729de860ea",
     "image": "test-image",
     "command": "npm test",
     "folder": "all",
     "config": {}
   }
   ```

3. **Verify Isolation:**
   - ✅ MongoDB document has correct organizationId
   - ✅ Container name includes Org A's ID
   - ✅ Redis metrics key includes Org A's ID
   - ✅ Org B cannot see/modify Org A's execution

---

## Container Naming Convention

### Format
```
org_<organizationId>_task_<taskId>
```

### Examples
```bash
org_507f191e810c19729de860ea_task_abc123
org_507f191e810c19729de860ea_task_xyz789
org_507f191e810c19729de860eb_task_test456
```

### Docker PS Output
```bash
$ docker ps
CONTAINER ID   IMAGE         NAMES
a1b2c3d4e5f6   test-image    org_507f191e810c19729de860ea_task_abc123
g7h8i9j0k1l2   test-image    org_507f191e810c19729de860eb_task_test456
```

**Benefits:**
- Clear organization ownership
- Easy filtering: `docker ps --filter name=org_507f191e810c19729de860ea`
- Prevents name collisions between organizations
- Simplified debugging and monitoring

---

## Acceptance Criteria

- [x] Extract organizationId from RabbitMQ message
- [x] Validate organizationId exists (reject if missing)
- [x] Convert organizationId string to ObjectId
- [x] Filter all MongoDB updates by organizationId
- [x] Include organizationId in container names
- [x] Scope Redis metrics keys by organizationId
- [x] Include organizationId in all Socket.io broadcasts
- [x] Log messages include organizationId for debugging
- [x] Error handling includes organizationId filtering

---

## Monitoring & Debugging

### Log Messages Include Org Context

**Before:**
```
✅ Task abc123 finished with status: PASSED
❌ Container orchestration failure for task abc123: Error message
```

**After:**
```
✅ Task abc123 (org: 507f191e810c19729de860ea) finished with status: PASSED
❌ Container orchestration failure for task abc123 (org: 507f191e810c19729de860ea): Error message
[Redis] Updated metrics for test-image (org: 507f191e810c19729de860ea). Duration: 5432ms
```

**Benefits:**
- Easy identification of which organization's execution
- Simplified debugging of multi-tenant issues
- Clear audit trail

---

## Performance Impact

**Expected:** Minimal to none

- MongoDB queries slightly more specific (better performance)
- Redis key scoping has negligible overhead
- Container naming overhead is negligible

**Monitoring:**
- Watch for messages rejected due to missing organizationId
- Monitor MongoDB query performance (should improve with compound index)
- Check Redis key patterns to ensure proper scoping

---

## Rollback Plan

If issues are discovered:

1. **Temporary Fix:** Revert to previous container without multi-tenant support
2. **Proper Rollback:** Revert this commit and redeploy previous worker version
3. **Data Integrity:**
   - Existing executions in MongoDB remain unchanged
   - No data migration needed for rollback
   - Redis metrics may need cleanup if keys were written with new pattern

---

## Next Steps

**Sprint 3 Remaining Tasks:**
- **Task 3.4:** ✅ SKIPPED (Combined with 3.3 - worker updates complete)
- **Task 3.5:** Implement Socket.io room-based broadcasting (Producer Service)
- **Task 3.6:** Update report storage paths (org-scoped)
- **Task 3.7:** Test multi-org data isolation end-to-end

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `apps/worker-service/src/worker.ts` | 2, 67-73, 112-121, 131-147, 167-171, 224-237, 298, 302-320, 322-337 | Added organizationId extraction and filtering throughout worker lifecycle |

---

## Integration with Other Tasks

### Task 3.1 (Producer Updates) ✅
- Producer now sends organizationId in RabbitMQ messages
- Worker receives and validates organizationId

### Task 3.2 (RabbitMQ Messages) ✅
- Already completed as part of Task 3.1
- RabbitMQ messages include organizationId

### Task 3.5 (Socket.io Rooms) 🔄
- Worker includes organizationId in all notifyProducer() calls
- Producer can use this to broadcast to org-specific rooms

### Task 3.6 (Report Storage) 🔜
- Reports currently stored at `reports/{taskId}/`
- Future: `reports/{organizationId}/{taskId}/`

---

**Task Status:** ✅ COMPLETE
**Ready for:** Task 3.5 - Implement Socket.io room-based broadcasting
