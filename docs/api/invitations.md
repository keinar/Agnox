# Invitations API

Base URL: `/api/invitations`

The Invitations API manages team member invitations with secure token handling, multi-tenant support, and plan limit enforcement.

---

## Security Features

- **Token Hashing:** Invitation tokens stored as SHA-256 hashes (never plain text)
- **Token Expiration:** 7-day validity period
- **Single Use:** Tokens invalidated after acceptance
- **Plan Enforcement:** User limits checked before invitation creation

---

## POST `/api/invitations`

Send an invitation to join the organization.

**Authentication:** Required  
**Authorization:** Admin role only

### Request Body

```json
{
  "email": "newuser@example.com",
  "role": "developer"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `role` | string | Yes | One of: `admin`, `developer`, `viewer` |

### Response (201 Created)

```json
{
  "success": true,
  "message": "Invitation sent. User will create an account.",
  "invitation": {
    "id": "507f1f77bcf86cd799439011",
    "email": "newuser@example.com",
    "role": "developer",
    "expiresAt": "2026-02-16T10:00:00.000Z",
    "userExists": false,
    "actionType": "signup"
  }
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `userExists` | `true` if user already has an account (in any org) |
| `actionType` | `signup` (new user) or `join` (existing user) |

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing required fields` | Email or role not provided |
| 400 | `Invalid email format` | Email doesn't match pattern |
| 400 | `Invalid role` | Role not admin/developer/viewer |
| 403 | `Forbidden` | User is not an admin |
| 403 | `User limit reached` | Plan's max users exceeded |
| 404 | `Organization not found` | Organization doesn't exist |
| 409 | `User already in organization` | Email already a member |
| 409 | `Invitation already sent` | Pending invitation exists |
| 500 | `Failed to send invitation` | Internal server error |

### Email Notification

An email is sent to the invitee containing:
- Organization name
- Inviter's name
- Assigned role
- Invitation link with token
- Expiration date (7 days)

---

## GET `/api/invitations`

List pending invitations for the organization.

**Authentication:** Required  
**Authorization:** Admin role only

### Response (200 OK)

```json
{
  "success": true,
  "invitations": [
    {
      "id": "507f1f77bcf86cd799439011",
      "email": "pending@example.com",
      "role": "developer",
      "status": "pending",
      "invitedBy": "507f191e810c19729de860ea",
      "invitedByName": "John Admin",
      "expiresAt": "2026-02-16T10:00:00.000Z",
      "createdAt": "2026-02-09T10:00:00.000Z"
    }
  ]
}
```

### Invitation Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting acceptance |
| `accepted` | User joined organization |
| `expired` | Token expired (7+ days) |

---

## DELETE `/api/invitations/:id`

Revoke a pending invitation.

**Authentication:** Required  
**Authorization:** Admin role only

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Invitation ID (MongoDB ObjectId) |

### Response (200 OK)

```json
{
  "success": true,
  "message": "Invitation revoked successfully"
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Invalid invitation ID` | Invalid ObjectId format |
| 401 | `Authentication required` | No valid JWT token |
| 403 | `Forbidden` | User is not an admin |
| 404 | `Invitation not found` | ID not found or different org |
| 500 | `Failed to revoke invitation` | Internal server error |

---

## GET `/api/invitations/validate/:token`

Validate an invitation token (public endpoint).

**Authentication:** Not required

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | 64-character hex token from email |

### Response (200 OK - Valid)

```json
{
  "success": true,
  "valid": true,
  "organizationName": "Acme Corp",
  "role": "developer",
  "inviterName": "John Admin",
  "userExists": false
}
```

### Response (404 - Invalid/Expired)

```json
{
  "success": false,
  "valid": false,
  "error": "Invitation has expired"
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Invalid token format` | Token not 64 hex chars |
| 404 | `Invitation not found or already used` | Token invalid |
| 404 | `Invitation has expired` | Past 7-day window |
| 500 | `Failed to validate invitation` | Internal server error |

---

## POST `/api/invitations/accept`

Accept an invitation (for existing users who login first).

**Authentication:** Required

### Request Body

```json
{
  "token": "a1b2c3d4e5f6..."
}
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "Successfully joined Acme Corp",
  "organization": {
    "id": "507f191e810c19729de860ea",
    "name": "Acme Corp"
  }
}
```

### Flow

1. User receives invitation email
2. User clicks link → validates token
3. **If new user:** Signs up via `/api/auth/signup` with `inviteToken`
4. **If existing user:** Logs in, then calls this endpoint with token

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing token` | Token not provided |
| 400 | `Invalid token format` | Token format invalid |
| 401 | `Authentication required` | User not logged in |
| 403 | `Email mismatch` | Logged-in email ≠ invitation email |
| 404 | `Invalid or expired invitation` | Token not found |
| 404 | `Invitation has expired` | Past 7-day window |
| 500 | `Failed to accept invitation` | Internal server error |

---

## Invitation Flow Diagram

```
┌─────────────────┐
│ Admin sends     │
│ POST /api/      │
│ invitations     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Token generated │
│ Hash stored     │
│ Email sent      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ GET /validate/  │────▶│ Valid?          │
│ :token          │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
    ┌─────────────────┐               ┌─────────────────┐
    │ New User        │               │ Existing User   │
    │                 │               │                 │
    │ POST /signup    │               │ POST /login     │
    │ with inviteToken│               │ then            │
    │                 │               │ POST /accept    │
    └────────┬────────┘               └────────┬────────┘
             │                                  │
             └──────────────┬───────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │ User joins org  │
                  │ Token consumed  │
                  └─────────────────┘
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST `/api/invitations` | 5 requests | 1 minute |
| Other endpoints | 100 requests | 1 minute |

---

## Related Documentation

- [Authentication API](./authentication.md)
- [Users API](./users.md)
- [Organizations API](./organizations.md)
