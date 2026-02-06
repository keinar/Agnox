# Webhook Load Testing Guide

**Phase 3 Sprint 5: Performance Validation**

Load testing procedures for Stripe webhook endpoints to ensure production readiness.

---

## Test Objectives

1. **Throughput:** Handle 100+ webhooks/minute
2. **Response Time:** < 500ms per webhook (95th percentile)
3. **Reliability:** 0% error rate under normal load
4. **Resilience:** Graceful degradation under peak load
5. **Idempotency:** Correctly handle duplicate webhooks

---

## Test Environment

### Local Development Setup
```bash
# Start services
docker-compose up -d

# Verify all services healthy
docker-compose ps

# Check baseline resource usage
docker stats --no-stream
```

### Production-Like Setup (Recommended)
```bash
# Use docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d

# Scale producer service
docker-compose -f docker-compose.prod.yml up -d --scale producer=3

# Configure load balancer (if using)
```

### Monitoring Setup
```bash
# Terminal 1: Producer logs
docker-compose logs -f producer

# Terminal 2: MongoDB stats
docker exec -it automation-mongodb mongosh
> use admin
> db.runCommand({serverStatus: 1})

# Terminal 3: Resource monitor
docker stats

# Terminal 4: Test execution
# Run load tests here
```

---

## Load Testing Tools

### Option 1: Apache Bench (Simple)
```bash
# Install
sudo apt install apache2-utils

# Basic test
ab -n 1000 -c 10 \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  http://localhost:3000/api/webhooks/test
```

### Option 2: Artillery (Recommended)
```bash
# Install
npm install -g artillery

# Create test script
artillery run webhook-load-test.yml
```

### Option 3: k6 (Advanced)
```bash
# Install
sudo apt install k6

# Run test
k6 run webhook-load-test.js
```

---

## Test Scenarios

### Scenario 1: Baseline Performance

**Objective:** Measure webhook processing time under no load.

**Test Script: `webhook-baseline.yml`**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 1  # 1 request/second
      name: "Baseline"

scenarios:
  - name: "Subscription Created"
    flow:
      - post:
          url: "/api/webhooks/test"
          json:
            type: "customer.subscription.created"
            data:
              object:
                id: "sub_{{ $randomString() }}"
                customer: "cus_test"
                status: "active"
          headers:
            stripe-signature: "dummy"  # Update with real signature for prod
```

**Run Test:**
```bash
artillery run webhook-baseline.yml
```

**Expected Results:**
- Response time: < 200ms (p95)
- Success rate: 100%
- CPU usage: < 20%
- Memory usage: < 500MB

---

### Scenario 2: Moderate Load (100 req/min)

**Objective:** Simulate typical production traffic.

**Test Script: `webhook-moderate.yml`**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 300  # 5 minutes
      arrivalRate: 1.67  # ~100 requests/minute
      name: "Moderate load"

scenarios:
  - name: "Mixed webhook events"
    weight: 40
    flow:
      - post:
          url: "/api/webhooks/stripe"
          json:
            type: "customer.subscription.created"
            id: "evt_{{ $randomString() }}"
            data:
              object:
                id: "sub_{{ $randomString() }}"
                customer: "cus_{{ $randomString() }}"
                status: "active"

  - name: "Payment succeeded"
    weight: 30
    flow:
      - post:
          url: "/api/webhooks/stripe"
          json:
            type: "invoice.payment_succeeded"
            id: "evt_{{ $randomString() }}"
            data:
              object:
                id: "in_{{ $randomString() }}"
                customer: "cus_{{ $randomString() }}"
                amount_paid: 9900

  - name: "Payment failed"
    weight: 20
    flow:
      - post:
          url: "/api/webhooks/stripe"
          json:
            type: "invoice.payment_failed"
            id: "evt_{{ $randomString() }}"
            data:
              object:
                id: "in_{{ $randomString() }}"
                customer: "cus_{{ $randomString() }}"

  - name: "Subscription deleted"
    weight: 10
    flow:
      - post:
          url: "/api/webhooks/stripe"
          json:
            type: "customer.subscription.deleted"
            id: "evt_{{ $randomString() }}"
            data:
              object:
                id: "sub_{{ $randomString() }}"
                customer: "cus_{{ $randomString() }}"
```

**Expected Results:**
- Response time: < 500ms (p95)
- Success rate: > 99%
- CPU usage: < 50%
- Memory usage: < 1GB
- No database connection errors

---

### Scenario 3: Peak Load (500 req/min)

**Objective:** Test system limits and identify bottlenecks.

**Test Configuration:**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 2  # Warm up
      name: "Warm up"
    - duration: 180  # 3 minutes
      arrivalRate: 8.33  # ~500 requests/minute
      name: "Peak load"
    - duration: 60
      arrivalRate: 2  # Cool down
      name: "Cool down"

# Same scenarios as moderate load
```

**Expected Results:**
- Response time: < 1000ms (p95)
- Success rate: > 95%
- CPU usage: < 80%
- Memory usage: < 2GB
- Possible rate limiting (429 responses)

---

### Scenario 4: Spike Test

**Objective:** Test resilience to sudden traffic spike.

**Test Configuration:**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 1  # Normal
      name: "Before spike"
    - duration: 60
      arrivalRate: 20  # Sudden spike (1200 req/min)
      name: "Spike"
    - duration: 60
      arrivalRate: 1  # Recovery
      name: "After spike"
```

**Expected Results:**
- System doesn't crash
- Some requests may fail during spike (acceptable)
- Recovery after spike within 30 seconds
- No permanent degradation

---

### Scenario 5: Duplicate Webhook Test

**Objective:** Verify idempotent webhook processing.

**Test Script: `webhook-duplicate.js` (k6)**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,  // 10 concurrent users
  duration: '60s',
};

const EVENT_ID = 'evt_test_duplicate_12345';

export default function () {
  const url = 'http://localhost:3000/api/webhooks/stripe';

  const payload = JSON.stringify({
    id: EVENT_ID,  // Same event ID
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_test',
        customer: 'cus_test',
        status: 'active'
      }
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'dummy'
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

**Run Test:**
```bash
k6 run webhook-duplicate.js
```

**Verify:**
```javascript
// In MongoDB
use automation_platform

// Should only be ONE entry for this event ID
db.webhook_logs.countDocuments({eventId: 'evt_test_duplicate_12345'})
// Expected: 1 (not 600, even though we sent 600 requests)
```

**Expected Results:**
- All requests return 200 OK
- Only one webhook log entry created
- No duplicate processing
- No database errors (unique index works)

---

### Scenario 6: Slow Database Test

**Objective:** Test webhook handling when database is slow.

**Simulate Slow DB:**
```javascript
// In MongoDB, enable profiling
use automation_platform
db.setProfilingLevel(2)  // Log all operations

// Add artificial delay (for testing only!)
db.webhook_logs.createIndex(
  { eventId: 1 },
  { unique: true, name: 'idx_slow', commitDelay: 1000 }  // 1 second delay
)
```

**Test Configuration:**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 120
      arrivalRate: 5  # 300 req/min
      name: "Slow database"

  # Set timeout expectations
  timeout: 5  # 5 second timeout
```

**Expected Results:**
- Response times increase (expected)
- Some timeouts (< 10%)
- No crashes
- Queue builds up but processes eventually
- System recovers when DB returns to normal speed

**Cleanup:**
```javascript
// Remove slow index
db.webhook_logs.dropIndex('idx_slow')
db.setProfilingLevel(0)
```

---

## Performance Metrics

### Response Time Targets
| Metric | Target | Critical |
|--------|--------|----------|
| p50 (median) | < 200ms | < 500ms |
| p95 | < 500ms | < 1000ms |
| p99 | < 1000ms | < 2000ms |

### Throughput Targets
| Load Level | Requests/min | Success Rate |
|------------|-------------|--------------|
| Normal | 100 | 99.9% |
| Peak | 500 | 99% |
| Spike | 1000 | 95% |

### Resource Usage Targets
| Resource | Normal | Peak | Critical |
|----------|--------|------|----------|
| CPU | < 30% | < 70% | < 90% |
| Memory | < 500MB | < 1.5GB | < 3GB |
| Disk I/O | < 50MB/s | < 200MB/s | < 500MB/s |

---

## Monitoring During Tests

### Real-Time Metrics

**Producer Service Logs:**
```bash
# Watch for errors
docker-compose logs -f producer | grep -E "ERROR|WARN"

# Count webhook processing
docker-compose logs producer | grep "Webhook verified" | wc -l

# Average processing time (approximate)
docker-compose logs producer | grep "Webhook verified" | tail -100
```

**MongoDB Metrics:**
```javascript
// In mongosh
use automation_platform

// Current operations
db.currentOp()

// Slow queries
db.system.profile.find().sort({millis: -1}).limit(10)

// Connection count
db.serverStatus().connections

// Operation counters
db.serverStatus().opcounters
```

**Docker Stats:**
```bash
# Live resource usage
docker stats

# Watch specific service
docker stats automation-producer
```

### Post-Test Analysis

**Webhook Processing Summary:**
```javascript
// Total webhooks processed
db.webhook_logs.countDocuments()

// By event type
db.webhook_logs.aggregate([
  { $group: { _id: '$eventType', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Success vs error rate
db.webhook_logs.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
])

// Processing time distribution
db.webhook_logs.aggregate([
  {
    $project: {
      processingTime: {
        $subtract: ['$processedAt', '$createdAt']
      }
    }
  },
  {
    $bucket: {
      groupBy: '$processingTime',
      boundaries: [0, 100, 250, 500, 1000, 2000, 5000],
      default: 'over 5s',
      output: { count: { $sum: 1 } }
    }
  }
])
```

**Database Performance:**
```javascript
// Index usage
db.webhook_logs.aggregate([
  { $indexStats: {} }
])

// Collection stats
db.webhook_logs.stats()

// Slow queries
db.getProfilingStatus()
db.system.profile.find({ millis: { $gt: 1000 } })
```

---

## Optimization Recommendations

### If Response Times Too Slow (> 1s p95)

**1. Add Database Indexes**
```javascript
// Check existing indexes
db.webhook_logs.getIndexes()

// Add missing indexes
db.webhook_logs.createIndex({ organizationId: 1, processedAt: -1 })
db.webhook_logs.createIndex({ status: 1, processedAt: -1 })
```

**2. Optimize Queries**
```javascript
// Use projection to limit fields
db.webhook_logs.find(
  { eventType: 'customer.subscription.created' },
  { eventId: 1, status: 1 }  // Only return needed fields
)

// Use explain() to analyze queries
db.webhook_logs.find({ organizationId: 'xxx' }).explain('executionStats')
```

**3. Enable Connection Pooling**
```typescript
// In server.ts
const mongoClient = new MongoClient(MONGO_URI, {
  maxPoolSize: 50,  // Increase pool size
  minPoolSize: 10,
  maxIdleTimeMS: 30000
});
```

### If CPU Usage Too High (> 80%)

**1. Scale Horizontally**
```bash
# Add more producer instances
docker-compose up -d --scale producer=3

# Use load balancer (Nginx)
```

**2. Optimize Webhook Processing**
```typescript
// Move heavy operations to background queue
// Quick acknowledge, async processing

app.post('/api/webhooks/stripe', async (request, reply) => {
  // Verify and acknowledge immediately
  const event = verifyWebhook(request);
  reply.send({ received: true });

  // Process in background
  await webhookQueue.push(event);
});
```

### If Memory Usage Too High (> 2GB)

**1. Limit Webhook Payload Storage**
```javascript
// Don't store full payload, only essential fields
await webhookLogsCollection.insertOne({
  eventId: event.id,
  eventType: event.type,
  organizationId,
  status: 'success',
  // payload: event.data.object,  // REMOVE (can be large)
  essentials: {  // Store only what's needed
    subscriptionId: event.data.object.id,
    status: event.data.object.status
  }
});
```

**2. Cleanup Old Logs**
```javascript
// TTL index already set to 90 days
// Verify it's working
db.webhook_logs.find({
  processedAt: { $lt: new Date(Date.now() - 90*24*60*60*1000) }
}).count()
// Should be 0 (old logs auto-deleted)
```

### If Database Connection Errors

**1. Increase Connection Pool**
```typescript
const mongoClient = new MongoClient(MONGO_URI, {
  maxPoolSize: 100,  // Increase from default 50
  waitQueueTimeoutMS: 5000
});
```

**2. Implement Connection Retry**
```typescript
async function connectWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mongoClient.connect();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## Load Test Execution Checklist

### Pre-Test
- [ ] All services running
- [ ] Monitoring setup
- [ ] Database backups created
- [ ] Baseline metrics recorded
- [ ] Team notified (if testing production)

### During Test
- [ ] Monitor logs for errors
- [ ] Watch resource usage
- [ ] Track response times
- [ ] Note any anomalies
- [ ] Be ready to stop test if critical issues

### Post-Test
- [ ] Collect all metrics
- [ ] Analyze results
- [ ] Compare to targets
- [ ] Document findings
- [ ] Create optimization plan
- [ ] Clean up test data

---

## Sample Load Test Report

```markdown
# Webhook Load Test Report

**Date:** 2026-02-06
**Environment:** Local Development
**Test Duration:** 10 minutes
**Total Requests:** 1,000

## Results Summary

### Response Times
- p50: 185ms ✅ (target: < 200ms)
- p95: 420ms ✅ (target: < 500ms)
- p99: 850ms ✅ (target: < 1000ms)

### Success Rate
- Success: 998 (99.8%) ✅ (target: > 99%)
- Failed: 2 (0.2%)
- Errors: Connection timeout (2)

### Resource Usage
- CPU Average: 35% ✅ (target: < 50%)
- CPU Peak: 62%
- Memory Average: 680MB ✅ (target: < 1GB)
- Memory Peak: 820MB

### Database Performance
- Total operations: 1,000
- Average query time: 45ms
- Slow queries (>1s): 0 ✅
- Connection errors: 0 ✅

## Issues Found
1. **Connection Timeouts (2):** During peak load spike
   - Root cause: Connection pool exhausted
   - Fix: Increase maxPoolSize to 100

2. **Memory Growth:** Gradual increase over 10 minutes
   - From: 400MB → 820MB
   - Concern: May leak in long-running tests
   - Action: Monitor in production

## Recommendations
1. ✅ System ready for production
2. Increase connection pool size
3. Add memory monitoring alerts
4. Retest after optimizations

## Next Steps
1. Deploy optimizations
2. Run 24-hour soak test
3. Monitor first week in production
4. Review and adjust limits

**Test conducted by:** [Name]
**Reviewed by:** [Name]
**Approved for production:** [Yes/No]
```

---

## Related Documents

- `docs/testing/billing-test-scenarios.md` - Functional test scenarios
- `docs/testing/billing-edge-cases.md` - Edge case handling
- `docs/deployment/stripe-production-checklist.md` - Production deployment
- `docs/implementation/phase-3/webhook-testing-guide.md` - Webhook testing

---

## Additional Resources

**Load Testing Tools:**
- Artillery: https://www.artillery.io/docs
- k6: https://k6.io/docs/
- Apache Bench: https://httpd.apache.org/docs/2.4/programs/ab.html

**Stripe Performance:**
- Webhooks Best Practices: https://docs.stripe.com/webhooks/best-practices
- Performance Tips: https://docs.stripe.com/api/performance

**MongoDB Performance:**
- Performance Best Practices: https://www.mongodb.com/docs/manual/administration/performance-tuning/
- Monitoring: https://www.mongodb.com/docs/manual/administration/monitoring/
