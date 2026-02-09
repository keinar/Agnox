# Organizations API

Base URL: `/api/organization`

All organization endpoints require authentication via JWT token in the `Authorization: Bearer <token>` header.

---

## GET `/api/organization`

Get current organization details.

**Authentication:** Required (All roles)

### Response (200 OK)

```json
{
  "success": true,
  "organization": {
    "id": "507f191e810c19729de860ea",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "free",
    "limits": {
      "maxProjects": 1,
      "maxTestRuns": 100,
      "maxUsers": 3,
      "maxConcurrentRuns": 1,
      "maxStorage": 10737418240
    },
    "userCount": 2,
    "userLimit": 3,
    "aiAnalysisEnabled": true,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-02-08T14:30:00.000Z"
  }
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Authentication required` | No valid JWT token provided |
| 404 | `Organization not found` | Organization doesn't exist |
| 500 | `Failed to fetch organization` | Internal server error |

---

## PATCH `/api/organization`

Update organization settings.

**Authentication:** Required  
**Authorization:** Admin role only

### Request Body

```json
{
  "name": "New Organization Name",
  "aiAnalysisEnabled": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Organization name (2-100 characters) |
| `aiAnalysisEnabled` | boolean | No | Enable/disable AI failure analysis |

> **Note:** At least one field must be provided.

### Response (200 OK)

```json
{
  "success": true,
  "message": "Organization settings updated successfully",
  "organization": {
    "id": "507f191e810c19729de860ea",
    "name": "New Organization Name",
    "aiAnalysisEnabled": false
  }
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing fields` | No fields provided |
| 400 | `Invalid name` | Name empty, too short, or too long |
| 400 | `Invalid aiAnalysisEnabled` | Must be boolean |
| 401 | `Authentication required` | No valid JWT token |
| 403 | `Forbidden` | User is not an admin |
| 404 | `Organization not found` | Organization doesn't exist |
| 500 | `Failed to update organization` | Internal server error |

### Audit Logging

All settings changes are logged to the `audit_logs` collection:

```json
{
  "action": "org.settings_updated",
  "targetType": "organization",
  "details": {
    "changes": { "name": "New Name", "aiAnalysisEnabled": false }
  }
}
```

---

## GET `/api/organization/usage`

Get organization usage statistics for the current billing period.

**Authentication:** Required (All roles)

### Response (200 OK)

```json
{
  "success": true,
  "usage": {
    "currentPeriod": {
      "startDate": "2026-02-01T00:00:00.000Z",
      "endDate": "2026-02-28T23:59:59.999Z"
    },
    "testRuns": {
      "used": 45,
      "limit": 100,
      "percentUsed": 45
    },
    "users": {
      "active": 2,
      "limit": 3
    },
    "storage": {
      "usedBytes": 524288000,
      "limitBytes": 10737418240
    }
  },
  "alerts": [
    {
      "type": "warning",
      "resource": "testRuns",
      "message": "You've used 80% of your monthly test runs",
      "percentUsed": 80
    }
  ]
}
```

### Usage Calculation

- **Test Runs:** Counted from `executions` collection for current calendar month
- **Storage:** Calculated by scanning `reports/<organizationId>/` directory
- **Users:** Count of active users in organization

### Plan Limits

| Plan | Test Runs/Month | Users | Storage |
|------|-----------------|-------|---------|
| Free | 100 | 3 | 10 GB |
| Team | 1,000 | 20 | 100 GB |
| Enterprise | 10,000 | Unlimited | 1 TB |

---

## GET `/api/organization/usage/alerts`

Get usage alerts (warnings when approaching limits).

**Authentication:** Required (All roles)

### Response (200 OK)

```json
{
  "success": true,
  "alerts": [
    {
      "type": "warning",
      "resource": "testRuns",
      "message": "You've used 80% of your monthly test runs",
      "percentUsed": 80
    },
    {
      "type": "critical",
      "resource": "users",
      "message": "You've reached your user limit",
      "percentUsed": 100
    }
  ]
}
```

### Alert Types

| Type | Trigger |
|------|---------|
| `info` | 50-79% of limit used |
| `warning` | 80-99% of limit used |
| `critical` | 100% of limit reached |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| All organization endpoints | 100 requests | 1 minute per organization |

---

## Related Documentation

- [Authentication API](./authentication.md)
- [Users API](./users.md)
- [Invitations API](./invitations.md)
