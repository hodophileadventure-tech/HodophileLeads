# Railway Deployment - Complete Guide

**This guide provides step-by-step instructions for deploying TRIPNEXUS to Railway.app with zero downtime and full functionality.**

## Table of Contents
1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Railway Setup (First Time)](#railway-setup-first-time)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Troubleshooting](#troubleshooting)

---

## Pre-deployment Checklist

Before deploying, ensure:

- [ ] Git repository is up to date: `git status` shows clean working directory
- [ ] All changes are committed: `git log --oneline | head -5`
- [ ] Backend builds successfully: `npm run build --prefix backend`
- [ ] Frontend builds successfully: `npm run build --prefix frontend`
- [ ] Database migrations are tested locally: `npm run db:migrate --prefix backend`
- [ ] Environment variables are documented in `.env.example` files
- [ ] No hardcoded URLs in code (use environment variables)
- [ ] Latest code is pushed to main branch: `git push`

### Generate Required Secrets

```bash
# Generate a strong JWT secret (save this, you'll need it for Railway)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

---

## Railway Setup (First Time)

### Step 1: Create a Railway Account
- Go to [railway.app](https://railway.app)
- Sign up with GitHub (recommended for easy integration)

### Step 2: Create a New Project
- Click "Create New Project" or "New"
- Select "Blank Project"
- Name it: `tripnexus` (or your preferred name)
- Click "Create"

### Step 3: Add PostgreSQL Database
- In your project, click "+ New"
- Select "PostgreSQL"
- Railway will provision a database automatically
- Copy the `DATABASE_URL` from the PostgreSQL service environment variables (click on the service → Variables tab)
- You'll need this in Step 5 below

### Step 4: Deploy Backend Service
1. Click "+ New"
2. Select "GitHub Repo"
3. Connect your GitHub account if prompted
4. Select your `Hodophile Leads` repository
5. Select `backend` as the root directory
6. Under "Deploy" tab:
   - Build Command: `npm run build`
   - Start Command: `npm start`
7. Click "Create"

### Step 5: Configure Backend Environment Variables
Once backend service is created:
1. Click on the "backend" service
2. Go to the "Variables" tab
3. Add the following environment variables:

| Key | Value | Notes |
|-----|-------|-------|
| `PORT` | `5000` | Standard port |
| `NODE_ENV` | `production` | Production environment |
| `DATABASE_URL` | (paste from PostgreSQL service) | Connection string |
| `JWT_SECRET` | (use generated secret from checklist) | Keep this secret! |
| `JWT_EXPIRY` | `7d` | Token expiry time |
| `FRONTEND_URL` | (deploy frontend first, then return here) | Will update after frontend deployment |
| `OFFICE_ALLOWED_IPS` | (optional, leave empty or add IPs) | IP whitelist for office |

### Step 6: Set Post-Deploy Hook
1. Still in backend service, go to "Deployments" tab
2. Click "Edit Deploy"
3. In "Post Deploy Command" field, add:
   ```
   npm run db:migrate
   ```
4. Save and redeploy

### Step 7: Deploy Frontend Service
1. Click "+ New"
2. Select "GitHub Repo"
3. Select your `Hodophile Leads` repository
4. Select `frontend` as the root directory
5. Under "Deploy" tab:
   - Build Command: `npm run build`
   - Start Command: `npm preview` (or configure Nginx reverse proxy)
6. Click "Create"

### Step 8: Configure Frontend Environment Variables
Once frontend service is created:
1. Click on the "frontend" service
2. Go to the "Variables" tab
3. Add:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://your-backend-url/api` |

**How to get backend URL:**
- Click on backend service
- Copy the generated Railway domain URL from "Networking" or "Public URL"
- Format: `https://projectname-prod.up.railway.app`
- Append `/api` → `https://projectname-prod.up.railway.app/api`

### Step 9: Update Backend FRONTEND_URL Variable
1. Go back to backend service
2. Click "Variables" tab
3. Update `FRONTEND_URL` with your frontend Railway URL:
   - Format: `https://your-frontend-url.up.railway.app`
   - Do NOT include `/api` in FRONTEND_URL
4. Save

### Step 10: Redeploy Services
1. Click on backend service
2. Click "Deployments" tab
3. Click "Redeploy" on the latest deployment
4. Wait for it to complete
5. Repeat for frontend service

---

## Deployment Steps

### Summary Flow

```
1. Push code to GitHub main branch
   ↓
2. Railway detects changes (auto-trigger)
   ↓
3. Backend builds & runs migrations
   ↓
4. Frontend builds
   ↓
5. Services start
   ↓
6. Test deployment
```

### Manual Deployment Trigger

If Railway doesn't auto-trigger:

1. Go to backend service → Deployments tab
2. Click "Deploy" button
3. Repeat for frontend
4. Monitor logs in real-time

### Monitor Deployment Logs

1. Click on service (backend or frontend)
2. View the "Logs" tab
3. Look for:
   - ✅ `npm run build` - compiled successfully
   - ✅ `npm run db:migrate` - database migrations ran (backend only)
   - ✅ `Server running on port 5000` - backend started
   - ✅ `Ready in XXms` - frontend built

---

## Post-Deployment Verification

### 1. Check Service Status

- Go to each service (backend & frontend)
- Verify status shows "Healthy" or "Running"
- Check no recent errors in "Logs" tab

### 2. Test API Endpoint

```bash
# Get your backend URL from Railway dashboard
BACKEND_URL="https://your-backend-url.up.railway.app"

# Test health endpoint
curl "$BACKEND_URL/health"

# Expected response:
# {"status":"OK","timestamp":"2026-06-23T10:30:45.123Z"}
```

### 3. Test Frontend Loading

- Open frontend URL in browser (get from Railway dashboard)
- Should see login page
- No errors in browser console (F12 → Console tab)

### 4. Test Login

1. Go to frontend URL
2. Login with test credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
3. If you get logged in, the backend API is working!

### 5. Verify Database

```bash
# SSH into backend (if needed for debugging)
# Click backend service → "Shell" tab
# Run:
psql $DATABASE_URL -c "\dt"

# Should list tables: users, leads, quote_requests, etc.
```

---

## Troubleshooting

### ❌ Blank White Page

**Symptoms:** Frontend loads but shows blank page

**Solutions:**
1. Open browser DevTools (F12)
2. Check "Console" tab for JavaScript errors
3. Check "Network" tab:
   - Frontend HTML should load ✅
   - API calls should go to backend URL ✅
   - No CORS errors ✅

**Fix:** Verify `VITE_API_BASE_URL` environment variable is set correctly

### ❌ 404 API Errors

**Symptoms:** API calls return 404

**Solutions:**
1. Verify backend is running: `curl $BACKEND_URL/health`
2. Check API URL format: Should be `https://your-backend-url/api/...`
3. Verify all environment variables are set:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PORT`

**Fix:** Re-check Step 5 & 6 of setup

### ❌ Database Connection Errors

**Symptoms:** Backend logs show "ECONNREFUSED" or database errors

**Solutions:**
1. Verify `DATABASE_URL` is set and correct
2. Check PostgreSQL service is "Running" (not stopped)
3. Verify migrations ran: check deployment logs for `✅ Database migration completed`

**Fix:** 
- Ensure post-deploy hook is set: `npm run db:migrate`
- Manually re-run: `railway run npm run db:migrate`

### ❌ CORS Errors

**Symptoms:** API calls blocked by CORS

**Solutions:**
1. Check browser console for: `Access-Control-Allow-Origin` error
2. Verify `FRONTEND_URL` is set on backend service
3. Check that frontend URL doesn't have trailing `/`

**Fix:** Update backend environment variable `FRONTEND_URL` and redeploy

### ❌ Timeout During Deployment

**Symptoms:** Deployment takes >10 minutes or times out

**Solutions:**
1. Check logs for what's stuck
2. Manually cancel and redeploy
3. Check if node_modules is in `.gitignore` (it should be)

**Fix:** Verify `.gitignore` includes `node_modules/`

---

## Environment Variables Reference

### Backend Variables

```
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/tripnexus
JWT_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6...
JWT_EXPIRY=7d
FRONTEND_URL=https://your-frontend-url.up.railway.app
OFFICE_ALLOWED_IPS=         (optional)
SMTP_HOST=                  (optional for email)
SMTP_PORT=                  (optional for email)
SMTP_USER=                  (optional for email)
SMTP_PASS=                  (optional for email)
```

### Frontend Variables

```
VITE_API_BASE_URL=https://your-backend-url.up.railway.app/api
```

---

## Advanced Configuration

### Custom Domain

1. In Railway project settings
2. Go to "Networking"
3. Click "Add Custom Domain"
4. Follow DNS configuration instructions

### Scheduled Database Backups

1. Go to PostgreSQL service
2. Click on service menu
3. Look for "Backups" or "Snapshots"
4. Enable automatic backups

### Environment-Specific Configs

Create separate Railway projects for:
- **Production** (main branch)
- **Staging** (develop branch)
- **Development** (local)

Each gets its own database and can have different configurations.

---

## Quick Reference Commands

```bash
# View logs locally during testing
docker-compose logs -f backend

# Rebuild Docker images
docker-compose up --build

# Test build without deploying
npm run build --prefix backend
npm run build --prefix frontend

# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Support & Documentation

- **Railway Docs:** https://docs.railway.app
- **TRIPNEXUS Architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Project README:** See [README.md](README.md)
- **Local Development:** See [DEVELOPMENT.md](DEVELOPMENT.md)

---

**Last Updated:** 2026-06-23  
**Status:** ✅ Production Ready
