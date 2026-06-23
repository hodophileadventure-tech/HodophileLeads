# Database Backup Plan - Prevent Data Loss

## Problem Identified
- **Before deployment:** 160 leads in database
- **After deployment:** 50 leads (only seed data)
- **Root cause:** Railway created new PostgreSQL instance with fresh `DATABASE_URL`

## Why This Happened
Railway PostgreSQL plugin sometimes creates new instances during redeploys. When `DATABASE_URL` changes, your app connects to a fresh database, losing all previous data.

## Prevention Strategy

### 1. Backup Before Every Deployment
Before deploying changes, backup your database:

```bash
# Local backup
pg_dump $OLD_DATABASE_URL > backup-$(date +%Y-%m-%d).sql

# Or use Railway's backup feature in the PostgreSQL plugin
```

### 2. Use Railway's Built-in Backups
- Go to Railway > PostgreSQL Plugin
- Enable "Backups" (if available in your plan)
- Railway should automatically backup before recreating instances

### 3. Monitor DATABASE_URL Changes
Add this check to your deployment:

```bash
# Check if DATABASE_URL changed
if [ "$OLD_DB_URL" != "$NEW_DB_URL" ]; then
  echo "⚠️ WARNING: DATABASE_URL changed! This usually means a new database was created."
  echo "Previous URL: $OLD_DB_URL"
  echo "New URL: $NEW_DB_URL"
fi
```

### 4. Manual Data Migration (If Needed)
If you need to migrate data from old database to new:

```bash
# Export from old database
pg_dump "OLD_DATABASE_URL" > old_db.sql

# Import into new database  
psql "NEW_DATABASE_URL" < old_db.sql
```

## Recommended Railway Configuration

1. **Keep PostgreSQL persistent:**
   - In Railway dashboard > PostgreSQL > Settings
   - Ensure "Keep After Delete" is enabled (if available)
   - Use the same PostgreSQL service across deployments

2. **Use Environment Variables Wisely:**
   - Pin `DATABASE_URL` in Railway environment
   - Don't let it auto-regenerate between deploys

3. **Test Deployments:**
   - Always test on a staging environment first
   - Verify data persists after redeployment

## Immediate Action
1. Check Railway dashboard for old PostgreSQL service URL
2. If found, export data from old database
3. Keep backup of current 50 leads before next deployment
4. Contact Railway support if DATABASE_URL keeps changing
