# Railway Quick Deployment Guide

## What was fixed

✅ **Frontend SPA Routing** - Added nginx.conf with `try_files` to route all requests to index.html  
✅ **API URL Configuration** - Removed hardcoded localhost URL from Dockerfile  
✅ **Caching & Security** - Added proper cache headers and security headers  

## Deploy to Railway in 5 Steps

### 1. Create Railway Project
- Go to [railway.app](https://railway.app)
- Create a new project

### 2. Add PostgreSQL Database
- Click "+ New" → Add PostgreSQL plugin
- Railway will generate a `DATABASE_URL`

### 3. Deploy Backend
- Click "+ New" → GitHub repository
- Select your repo, set root directory to `backend`
- Add environment variables:
  ```
  PORT=5000
  DATABASE_URL=<copy from PostgreSQL plugin>
  JWT_SECRET=your-secret-key-here-make-it-long-and-random
  JWT_EXPIRY=7d
  NODE_ENV=production
  ```
- In Deployments tab → Edit → Post Deploy Hook:
  - Add: `npm run db:migrate && npm run db:seed`
- Deploy!

### 4. Deploy Frontend
- Click "+ New" → GitHub repository  
- Select your repo, set root directory to `frontend`
- Add environment variable:
  ```
  VITE_API_BASE_URL=/api
  ```
- Build Command: `npm run build`
- Deploy!

### 5. Connect Frontend to Backend

**Simple Setup (Frontend calls Backend directly):**

Your frontend now makes API calls to `/api/*` (relative URL).  
Since the frontend and backend are on different domains on Railway, this won't work yet.

Add to Backend environment variables:
```
FRONTEND_URL=https://your-frontend-railway-url.up.railway.app
```

Update `backend/src/index.ts` - Change the CORS setup (around line 30):
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

Then update Frontend environment variable:
```
VITE_API_BASE_URL=https://your-backend-railway-url.up.railway.app/api
```

Redeploy both services.

## Verify Deployment

1. **Frontend loads** - Visit your frontend URL, should see the login page
2. **API works** - Open browser DevTools → Network tab
3. **Try login** - Should see POST to API endpoint (may fail due to DB, but shouldn't be 404)

## Common Issues

| Problem | Solution |
|---------|----------|
| Blank white page | Frontend is loading but React isn't working. Check browser console for errors. |
| 404 on page refresh | Should be fixed by nginx.conf SPA routing. Verify frontend deployment includes nginx.conf |
| API calls 404 | Check that `VITE_API_BASE_URL` environment variable is set correctly on frontend |
| API calls CORS error | Update backend CORS to include frontend URL |
| Database errors | Verify `DATABASE_URL` is set on backend. Run `railway run npm run db:migrate` |

## Next Steps

- Set up custom domain in Railway settings
- Configure environment-specific settings (.env files)
- Set up monitoring and error logging
- Configure scheduled backups for database
