# TRIPNEXUS Backend API

Node.js + Express.js + PostgreSQL backend for the Travel Agency Lead Management System.

## Features

- JWT authentication with role-based access control
- Lead management REST API
- Dashboard analytics and statistics
- Database models for leads, users, follow-ups, itineraries, payments
- Error handling and logging
- Security: Helmet, CORS, bcrypt password hashing

## Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Backend runs on http://localhost:5000

## Office Login Restriction

Agent logins are restricted to the office network by IP allowlist. Set `OFFICE_ALLOWED_IPS` in `.env` with your office PC IPs, for example:

```env
OFFICE_ALLOWED_IPS=192.168.1.103,192.168.1.162,192.168.1.246
```

Admins can still log in from anywhere.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new user

### Leads
- `GET /api/leads` - List all leads
- `POST /api/leads` - Create new lead
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead
- `PATCH /api/leads/:id/status` - Update lead status
- `DELETE /api/leads/:id` - Delete lead

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/pipeline` - Pipeline overview
- `GET /api/dashboard/analytics` - Team analytics
- `GET /api/dashboard/health` - Booking health score

## Environment Variables

See `.env.example` for all required variables.

## Database

PostgreSQL is required. See database/ folder for schema and seed data.

## Build

```bash
npm run build
npm start
```
