# Railway Deployment Checklist

Quick checklist to follow when deploying to Railway. Print this out or keep it handy!

## Pre-Deployment (Local)

- [ ] All code changes are committed: `git status` is clean
- [ ] Backend builds: `npm run build --prefix backend`
- [ ] Frontend builds: `npm run build --prefix frontend`
- [ ] Database migrations work: `npm run db:migrate --prefix backend`
- [ ] Latest code pushed to GitHub: `git push origin main`
- [ ] JWT secret generated: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Railway Setup (First Time Only)

### Create Services
- [ ] Create Railway account at railway.app
- [ ] Create new Railway project
- [ ] Add PostgreSQL service
- [ ] Copy `DATABASE_URL` from PostgreSQL variables
- [ ] Add Backend service (set root directory: `backend`)
- [ ] Add Frontend service (set root directory: `frontend`)

### Configure Backend
- [ ] Set build command: `npm run build`
- [ ] Set start command: `npm start`
- [ ] Add environment variables:
  - [ ] `PORT` = `5000`
  - [ ] `NODE_ENV` = `production`
  - [ ] `DATABASE_URL` = (from PostgreSQL)
  - [ ] `JWT_SECRET` = (generated secret)
  - [ ] `JWT_EXPIRY` = `7d`
  - [ ] `FRONTEND_URL` = (set after frontend deployment)
- [ ] Add post-deploy hook: `npm run db:migrate`
- [ ] Deploy!

### Configure Frontend
- [ ] Set build command: `npm run build`
- [ ] Set start command: `npm preview`
- [ ] Copy frontend Railway URL (e.g., `https://xxx.up.railway.app`)
- [ ] Add environment variable: `VITE_API_BASE_URL` = (backend URL + `/api`)
- [ ] Deploy!

### Update Backend FRONTEND_URL
- [ ] Go to backend service
- [ ] Update `FRONTEND_URL` variable with frontend Railway URL
- [ ] Redeploy backend

## Post-Deployment Verification

- [ ] Check backend logs for errors
- [ ] Check frontend logs for errors
- [ ] Test health endpoint: `curl https://your-backend/health`
- [ ] Visit frontend URL in browser
- [ ] Check browser console for errors (F12)
- [ ] Test login with admin credentials
- [ ] Test API calls in Network tab

## Troubleshooting

| Issue | Check |
|-------|-------|
| Blank page | F12 → Console for JS errors, Network for failed requests |
| 404 API errors | Verify VITE_API_BASE_URL is set correctly |
| Database errors | Verify DATABASE_URL is set, run migrations manually |
| CORS errors | Update FRONTEND_URL on backend, redeploy |

## Redeployment (After Code Changes)

- [ ] Commit changes: `git add -A && git commit -m "..."`
- [ ] Push to GitHub: `git push origin main`
- [ ] Railway auto-deploys, OR manually trigger:
  - [ ] Backend service → Deployments → Redeploy
  - [ ] Frontend service → Deployments → Redeploy
- [ ] Monitor logs
- [ ] Test in browser

## Quick URLs

| Service | Location |
|---------|----------|
| Deployment docs | [RAILWAY_COMPLETE_SETUP.md](RAILWAY_COMPLETE_SETUP.md) |
| Project README | [README.md](README.md) |
| Local development | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Railway docs | https://docs.railway.app |

---

**Save this! You'll need it for each deployment.**
