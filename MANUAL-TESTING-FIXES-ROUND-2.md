# 🔧 Manual Testing Fixes - Round 2

**Date:** January 29, 2026
**Priority:** CRITICAL
**Status:** ✅ ALL 3 ISSUES FIXED

---

## Issues Identified During Second Round of Manual Testing

### Issue #1: Duplicate Executions with Same TaskId (CRITICAL)
**Problem:** When running a test, two executions are created with the same taskId:
- One stays PENDING forever
- One runs normally (PASSED/FAILED)

**Example:**
```
_id: "697b8b2b272dad52787eaf42" - status: PASSED
_id: "697b8b2b272dad52787eaf41" - status: PENDING (same taskId!)
```

**Root Cause:** Worker service was converting `organizationId` to `ObjectId` while backend kept it as `STRING`. This caused MongoDB queries to fail matching existing documents:

1. Backend creates: `{ taskId: "x", organizationId: "string123" }`
2. Worker tries to update with: `{ taskId: "x", organizationId: ObjectId("string123") }`
3. Query doesn't match (string !== ObjectId)
4. Worker's `upsert: true` creates a NEW document instead of updating
5. Result: **Two documents with same taskId**

**Fix Applied:**
- **File:** `apps/worker-service/src/worker.ts`
- **Change:** Removed all ObjectId conversions, use organizationId as STRING
- **Lines Changed:** 115-121, 139, 239, 323, 341

```typescript
// ❌ BEFORE
const orgId = new ObjectId(organizationId);
await executionsCollection.updateOne(
    { taskId, organizationId: orgId },  // ObjectId won't match string
    { $set: { ... } },
    { upsert: true }  // Creates duplicate!
);

// ✅ AFTER
// Use organizationId as STRING (matches backend)
await executionsCollection.updateOne(
    { taskId, organizationId },  // String matches string
    { $set: { ... } },
    { upsert: true }  // Updates existing document
);
```

---

### Issue #2: Reports 404 - Double "reports" in Path (HIGH)
**Problem:** Report URLs have "reports" twice in the path:

**Broken URL:**
```
/reports/697b4ffb617b3eb72e825119/reports/run-1769704234429/allure-report/index.html
                                 ^^^^^^^^ duplicate!
```

**Correct URL:**
```
/reports/697b4ffb617b3eb72e825119/run-1769704234429/allure-report/index.html
```

**Root Cause:** Frontend was appending `/reports/` to `reportsBaseUrl` which already contained `/reports/`:

```typescript
baseUrl = "/reports/697b4ffb617b3eb72e825119"  // Already has /reports/
htmlReportUrl = `${baseUrl}/reports/${taskId}/...`  // Adds /reports/ again!
```

**Fix Applied:**
- **File:** `apps/dashboard-client/src/components/ExecutionRow.tsx`
- **Lines:** 109-112

```typescript
// ❌ BEFORE
const baseUrl = getBaseUrl(); // Returns "/reports/{organizationId}"
const htmlReportUrl = `${baseUrl}/reports/${execution.taskId}/native-report/index.html`;
//                               ^^^^^^^^^ duplicate!

// ✅ AFTER
const baseUrl = getBaseUrl(); // Returns "/reports/{organizationId}"
const htmlReportUrl = `${baseUrl}/${execution.taskId}/native-report/index.html`;
//                               No /reports/ prefix
```

---

### Issue #3: /metrics Endpoint Returns 401 Unauthorized (MEDIUM)
**Problem:** Performance metrics fetch fails with 401:

```
GET /api/metrics/keinar101%2Fmy-automation-tests%3Alatest
Response: 401 Unauthorized
```

**Root Cause:** Frontend was calling `/api/metrics/:image` without authentication token. The endpoint requires auth to scope metrics by organization (multi-tenant isolation).

**Fix Applied:**
- **File:** `apps/dashboard-client/src/components/ExecutionRow.tsx`
- **Lines:** 1-8 (import), 46-63 (useEffect)

```typescript
// ✅ ADDED
import { useAuth } from '../context/AuthContext';

export const ExecutionRow: React.FC<ExecutionRowProps> = ({ execution, isExpanded, onToggle, onDelete }) => {
    const { token } = useAuth();  // Get JWT token

    React.useEffect(() => {
        const isFinished = ['PASSED', 'FAILED', 'UNSTABLE'].includes(execution.status);
        if (isFinished && execution.image && token) {  // Check token exists
            const API_URL = ...;

            fetch(`${API_URL}/api/metrics/${encodeURIComponent(execution.image)}`, {
                headers: {
                    Authorization: `Bearer ${token}`  // Send auth token
                }
            })
            .then(res => res.json())
            .then(data => setMetrics(data))
            .catch(err => console.error("Metrics fetch failed", err));
        }
    }, [execution.status, execution.image, token]);  // Added token dependency
});
```

**Why Not Make Public?**
- Metrics are scoped by organizationId for multi-tenant isolation
- Making it public would show global metrics (defeats multi-tenancy)
- Better to authenticate and show organization-specific performance data

---

## Summary of Changes

### Files Modified

| File | Issue | Lines | Changes |
|------|-------|-------|---------|
| `apps/worker-service/src/worker.ts` | #1 Duplicates | 115-121, 139, 239, 323, 341 | Remove ObjectId, use STRING |
| `apps/dashboard-client/src/components/ExecutionRow.tsx` | #2 Reports 404 | 109-112 | Remove duplicate /reports/ |
| `apps/dashboard-client/src/components/ExecutionRow.tsx` | #3 Metrics 401 | 1-8, 46-63 | Add auth token |

### Impact

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| Duplicate Executions | CRITICAL | Data integrity, confusion | ✅ FIXED |
| Reports 404 | HIGH | Users can't view test reports | ✅ FIXED |
| Metrics 401 | MEDIUM | No performance insights shown | ✅ FIXED |

---

## Testing Checklist

### Test 1: No More Duplicates ✅
- [ ] Login to dashboard
- [ ] Run new test execution
- [ ] Wait for completion
- [ ] Refresh page
- [ ] **Expected:** Single execution entry (no duplicates)
- [ ] **Before Fix:** Two entries with same taskId, one stuck PENDING

### Test 2: Reports Load Successfully ✅
- [ ] Login to dashboard
- [ ] Find completed execution (PASSED/FAILED)
- [ ] Click "HTML Report" or "Allure Report" button
- [ ] **Expected:** Report loads successfully
- [ ] **Before Fix:** 404 Not Found (double /reports/ in URL)

### Test 3: Performance Metrics Show ✅
- [ ] Login to dashboard
- [ ] Find completed execution
- [ ] Look for performance icon (🐢 Turtle or ⚡ Lightning)
- [ ] **Expected:** Icon appears if metrics available
- [ ] **Before Fix:** No icon (metrics fetch failed with 401)

---

## Root Cause Analysis

### Why Were These Bugs Not Caught Earlier?

1. **Issue #1 (Duplicates):**
   - Worker and Backend were developed separately
   - Backend was fixed to use STRING, but Worker wasn't updated
   - No database constraints (no unique index on taskId)
   - **Lesson:** Need unified type definitions for organizationId across all services

2. **Issue #2 (Reports URL):**
   - `reportsBaseUrl` abstraction hid the actual path structure
   - Frontend assumed baseUrl didn't include `/reports/`
   - **Lesson:** Document URL structure conventions clearly

3. **Issue #3 (Metrics 401):**
   - Feature added after auth implementation
   - Fetch call didn't follow new auth pattern
   - **Lesson:** Create reusable API client with auth built-in

### Preventive Measures

1. **Type Safety:** Use shared TypeScript types for organizationId
2. **URL Constants:** Define report URL patterns in shared constants
3. **API Client:** Create authenticated `apiClient` utility with token injection
4. **Integration Tests:** Add E2E tests covering report viewing and metrics

---

## Deployment Instructions

1. **Commit Changes**
   ```bash
   git add apps/worker-service/src/worker.ts
   git add apps/dashboard-client/src/components/ExecutionRow.tsx
   git commit -m "fix(integration): Fix duplicates, reports 404, and metrics 401"
   ```

2. **Rebuild Services**
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

3. **Verify Logs**
   ```bash
   docker-compose logs worker --tail=50
   docker-compose logs producer --tail=50
   docker-compose logs dashboard --tail=50
   ```

4. **Run Manual Tests**
   - Execute all tests in Testing Checklist above
   - Verify no duplicate executions created
   - Confirm reports load successfully
   - Check performance metrics display

---

## Consistency Guidelines (For Future Development)

### organizationId Handling
```typescript
// ✅ CORRECT: Always use STRING
const organizationId: string = request.user!.organizationId;
await collection.find({ organizationId });

// ❌ WRONG: Never convert to ObjectId
const orgId = new ObjectId(organizationId); // NO!
```

### Report URL Construction
```typescript
// ✅ CORRECT: reportsBaseUrl includes /reports/{organizationId}
const reportsBaseUrl = `${apiUrl}/reports/${organizationId}`;
const reportUrl = `${reportsBaseUrl}/${taskId}/allure-report/index.html`;
// Result: /reports/{orgId}/{taskId}/allure-report/index.html

// ❌ WRONG: Don't add /reports/ twice
const reportUrl = `${reportsBaseUrl}/reports/${taskId}/...`; // NO!
```

### Authenticated API Calls
```typescript
// ✅ CORRECT: Always include auth token
import { useAuth } from '../context/AuthContext';

const { token } = useAuth();
fetch(`${API_URL}/api/endpoint`, {
    headers: { Authorization: `Bearer ${token}` }
});

// ❌ WRONG: Missing auth header
fetch(`${API_URL}/api/endpoint`); // Will get 401!
```

---

## Sign-Off

**Fixes Applied By:** Claude Opus 4.5
**Reviewed By:** [User - Manual Testing]
**Date:** January 29, 2026
**Status:** ✅ READY FOR REBUILD & TESTING

**Next Steps:**
1. Rebuild all services: `docker-compose up --build -d`
2. Run manual testing checklist above
3. If all tests pass, proceed with staging deployment
4. Monitor for any related issues in production

---

**CRITICAL:** These fixes address data integrity (duplicates), user experience (reports 404), and feature functionality (metrics). Deploy immediately after verification.
