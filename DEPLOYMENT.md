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

## Production notes

- Use a managed Postgres instance.
- Set a strong `JWT_SECRET`.
- Point `VITE_API_BASE_URL` to your backend origin or reverse proxy path.
- Run `npm run db:migrate` and `npm run db:seed` before first launch.
