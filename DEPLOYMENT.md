# Deployment Guide

## Environment variables

Backend:
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRY`

Frontend:
- `VITE_API_BASE_URL`

## Local Docker

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend: http://localhost:5001
- Postgres: localhost:5432

Health endpoints:
- Backend health: http://localhost:5001/health
- API docs: http://localhost:5001/api/docs

## Railway Deployment

### Setup Services

1. **Database Service**
   - Add a PostgreSQL plugin
   - Copy the `DATABASE_URL` from the plugin settings

2. **Backend Service**
   - Set the GitHub repository
   - Select the `backend` root directory in deployment settings
   - Environment variables:
     ```
     PORT=5000
     DATABASE_URL=<from Postgres plugin>
     JWT_SECRET=<strong-random-secret>
     JWT_EXPIRY=7d
     NODE_ENV=production
     ```
   - Run migrations:
     - Go to Deployments → Edit → Post Deploy Hook
     - Add: `npm run db:migrate`

3. **Frontend Service**
   - Set the GitHub repository
   - Select the `frontend` root directory in deployment settings
   - Build command: `npm run build`
   - Start command: (leave empty - Dockerfile handles it)
   - Public networking: Enable
   - Environment variables:
     ```
     VITE_API_BASE_URL=/api
     ```

### Connect Frontend to Backend

The frontend uses `/api` as the base URL, so you need a reverse proxy layer. There are two options:

**Option A: Frontend + Backend on Same Domain (Recommended)**
- Deploy an nginx container as the main entry point
- Route `/api/*` to backend service
- Route all other requests to frontend
- See [nginx-reverse-proxy.conf](./nginx-reverse-proxy.conf) for configuration

**Option B: Frontend Service with CORS**
- Update Frontend `VITE_API_BASE_URL` to point to Backend service URL:
  ```
  VITE_API_BASE_URL=https://your-backend-service.up.railway.app/api
  ```
- Update Backend CORS to allow frontend origin:
  ```
  BACKEND_CORS_ORIGIN=https://your-frontend-service.up.railway.app
  ```
- Update [backend/src/index.ts](./backend/src/index.ts) CORS configuration:
    ```typescript
    app.use(cors({
      origin: process.env.BACKEND_CORS_ORIGIN || 'http://localhost:3000'
    }));
    ```

### Troubleshooting

**Frontend shows 404 error:**
- Ensure nginx.conf is included in the frontend build
- Check that `VITE_API_BASE_URL` environment variable is set correctly
- Verify backend service is running and healthy

**API calls return 404:**
- Check backend logs: `POST /api/auth/login` should return 401 (not found) if credentials are wrong
- Verify `DATABASE_URL` is set and database is running
- Run migrations: `railway run npm run db:migrate`

**Database connection errors:**
- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/dbname`
- Ensure PostgreSQL plugin is running and connected
- Check firewall/networking rules

## Production notes

- Use a managed Postgres instance (e.g., Railway PostgreSQL plugin)
- Set a strong `JWT_SECRET` (minimum 32 characters)
- Enable HTTPS on all services
- Use environment-specific configurations
- Monitor logs and health endpoints regularly
- Set up automated backups for the database

