# Users API

Base URL: `/api/users`

The Users API handles user listing, profile management, role changes, and user removal with full RBAC (Role-Based Access Control) enforcement.

---

## Roles and Permissions

| Role | View Users | View Details | Change Roles | Remove Users |
|------|------------|--------------|--------------|--------------|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `developer` | ✅ | ✅ | ❌ | ❌ |
| `viewer` | ✅ | ✅ | ❌ | ❌ |

---

## GET `/api/users`

List all users in the organization.

**Authentication:** Required (All roles)

### Response (200 OK)

```json
{
  "success": true,
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "email": "admin@example.com",
      "name": "John Admin",
      "role": "admin",
      "status": "active",
      "lastLoginAt": "2026-02-09T10:30:00.000Z",
      "createdAt": "2026-01-15T08:00:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "email": "dev@example.com",
      "name": "Jane Developer",
      "role": "developer",
      "status": "active",
      "lastLoginAt": "2026-02-08T14:20:00.000Z",
      "createdAt": "2026-01-20T09:00:00.000Z"
    }
  ]
}
```

### User Status Values

| Status | Description |
|--------|-------------|
| `active` | Normal active user |
| `suspended` | Account suspended by admin |
| `pending` | Awaiting email verification |

---

## GET `/api/users/:id`

Get detailed information about a specific user.

**Authentication:** Required (All roles)

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID (MongoDB ObjectId) |

### Response (200 OK)

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "admin@example.com",
    "name": "John Admin",
    "role": "admin",
    "status": "active",
    "lastLoginAt": "2026-02-09T10:30:00.000Z",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-02-08T16:00:00.000Z"
  }
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Invalid user ID format` | ID is not a valid ObjectId |
| 401 | `Authentication required` | No valid JWT token |
| 404 | `User not found` | User doesn't exist or belongs to different org |
| 500 | `Failed to fetch user` | Internal server error |

> **Note:** For security (tenant isolation), users from other organizations return 404, not 403.

---

## PATCH `/api/users/:id/role`

Change a user's role.

**Authentication:** Required  
**Authorization:** Admin role only

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID (MongoDB ObjectId) |

### Request Body

```json
{
  "role": "developer"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `role` | string | Yes | `admin`, `developer`, `viewer` |

### Response (200 OK)

```json
{
  "success": true,
  "message": "User role updated to developer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "Jane User",
    "role": "developer"
  }
}
```

### Business Rules

1. **Cannot change own role:** Admins cannot demote themselves
2. **Last admin protection:** Cannot demote the last admin to a lower role

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing required field` | Role not provided |
| 400 | `Invalid role` | Role not admin/developer/viewer |
| 400 | `Invalid user ID format` | Invalid ObjectId |
| 401 | `Authentication required` | No valid JWT token |
| 403 | `Forbidden` | Caller is not an admin |
| 403 | `Cannot change own role` | Tried to change own role |
| 403 | `Cannot remove last admin` | Would leave org without admin |
| 404 | `User not found` | User doesn't exist or different org |
| 500 | `Failed to update role` | Internal server error |

### Audit Logging

Role changes are logged to `audit_logs`:

```json
{
  "action": "user.role_changed",
  "targetType": "user",
  "targetId": "507f1f77bcf86cd799439011",
  "details": {
    "oldRole": "viewer",
    "newRole": "developer",
    "targetEmail": "user@example.com"
  }
}
```

---

## DELETE `/api/users/:id`

Remove a user from the organization.

**Authentication:** Required  
**Authorization:** Admin role only

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID (MongoDB ObjectId) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "User user@example.com has been removed from the organization"
}
```

### Business Rules

1. **Cannot delete self:** Admins cannot remove their own account
2. **Last admin protection:** Cannot delete the last admin
3. **Data retention:** User's executions and data remain for audit trail

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Invalid user ID format` | Invalid ObjectId |
| 401 | `Authentication required` | No valid JWT token |
| 403 | `Forbidden` | Caller is not an admin |
| 403 | `Cannot delete yourself` | Tried to delete own account |
| 403 | `Cannot delete last admin` | Would leave org without admin |
| 404 | `User not found` | User doesn't exist or different org |
| 500 | `Failed to remove user` | Internal server error |

### Audit Logging

User removals are logged to `audit_logs`:

```json
{
  "action": "user.removed",
  "targetType": "user",
  "targetId": "507f1f77bcf86cd799439011",
  "details": {
    "targetEmail": "user@example.com",
    "targetRole": "developer",
    "targetName": "Jane User"
  }
}
```

> **Important:** When a user is removed, their historical data (test runs, executions) remains in the system for audit and reporting purposes.

---

## Example Usage

### List Organization Members

```bash
curl -X GET https://api.agnox.dev/api/users \
  -H "Authorization: Bearer <jwt-token>"
```

### Get User Details

```bash
curl -X GET https://api.agnox.dev/api/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <jwt-token>"
```

### Change User Role

```bash
curl -X PATCH https://api.agnox.dev/api/users/507f1f77bcf86cd799439011/role \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

### Remove User

```bash
curl -X DELETE https://api.agnox.dev/api/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <jwt-token>"
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Role change / Delete | 5 requests | 1 minute |
| List / Get details | 100 requests | 1 minute |

---

## Related Documentation

- [Authentication API](./authentication.md)
- [Organizations API](./organizations.md)
- [Invitations API](./invitations.md)
