# Database Migrations

This directory contains database migration scripts for the Agnostic Automation Center.

## Prerequisites

- MongoDB running locally or accessible via connection string
- Node.js 18+
- Dependencies installed (`npm install` at root)

## Migration 001: Add Organization Support

**File:** `001-add-organization-to-existing-data.ts`

**Purpose:** Transform the system from single-tenant to multi-tenant by adding organization support.

### What This Migration Does

1. ✅ Creates `organizations` collection with default organization
2. ✅ Creates `users` collection with default admin user
3. ✅ Creates `invitations` collection (empty)
4. ✅ Adds `organizationId` field to all existing `executions`
5. ✅ Creates indexes on all collections for performance
6. ✅ Verifies migration completed successfully

### Usage

#### Dry Run (Recommended First)

Test the migration without making any changes:

```bash
# From project root
npm run migration:dry-run

# Or directly with ts-node
npx ts-node migrations/001-add-organization-to-existing-data.ts --dry-run
```

#### Execute Migration

Run the actual migration:

```bash
# From project root
npm run migration:run

# Or directly with ts-node
npx ts-node migrations/001-add-organization-to-existing-data.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |

**Example:**
```bash
MONGO_URI=mongodb://localhost:27017 npm run migration:run
```

### Default Credentials Created

After migration, you can login with:

- **Email:** `admin@default.local`
- **Password:** `admin123`

⚠️ **IMPORTANT:** Change this password immediately after first login!

### Default Organization

The migration creates a default organization with:

- **Name:** Default Organization
- **Slug:** `default-org`
- **Plan:** `enterprise` (unlimited usage)
- **Purpose:** Contains all existing executions from single-tenant era

### Verification

After running the migration, verify success:

```bash
# Connect to MongoDB
mongosh automation_platform

# Check organizations
db.organizations.find().pretty()

# Check users
db.users.find({}, { hashedPassword: 0 }).pretty()

# Check executions have organizationId
db.executions.countDocuments({ organizationId: { $exists: true } })
db.executions.countDocuments({ organizationId: { $exists: false } })

# List indexes
db.organizations.getIndexes()
db.users.getIndexes()
db.executions.getIndexes()
```

### Expected Output

```
Organizations: 1
Users: 1 (admin@default.local)
Invitations: 0
Executions (total): <count>
Executions (with organizationId): <count> (should match total)
```

### Rollback

If migration fails or needs to be rolled back:

```javascript
// Connect to MongoDB
use automation_platform

// Remove organizationId from executions
db.executions.updateMany(
  { organizationId: { $exists: true } },
  { $unset: { organizationId: "" } }
)

// Drop new collections
db.organizations.drop()
db.users.drop()
db.invitations.drop()

// Drop indexes (if needed)
db.executions.dropIndex("organizationId_1")
db.executions.dropIndex("organizationId_1_startTime_-1")
db.executions.dropIndex("organizationId_1_taskId_1")
db.executions.dropIndex("organizationId_1_status_1")
```

### Troubleshooting

#### Connection Error

```
MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:** Ensure MongoDB is running:
```bash
# Using Docker
docker-compose up -d mongodb

# Check if running
docker ps | grep mongodb
```

#### Index Creation Error

```
MongoServerError: Index already exists with different options
```

**Solution:** This means migration was partially run before. Either:
1. Run the migration again (it handles existing data)
2. Drop conflicting indexes manually and re-run

#### Missing Dependencies

```
Cannot find module 'bcrypt'
```

**Solution:** Install dependencies:
```bash
npm install
```

### Next Steps After Migration

1. ✅ Verify migration success (see Verification section)
2. ✅ Deploy updated producer-service with auth middleware
3. ✅ Deploy updated worker-service
4. ✅ Deploy updated dashboard-client with login UI
5. ✅ Test login with default credentials
6. ✅ Change default admin password
7. ✅ Test multi-tenant isolation (create second organization)

### Notes

- This migration is **idempotent** - safe to run multiple times
- Existing data is preserved (added to default organization)
- Default organization has enterprise plan (unlimited usage)
- Migration takes ~1-5 seconds depending on execution count
