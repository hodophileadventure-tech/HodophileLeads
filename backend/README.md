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

## Meta Lead Ads integration

The backend can receive Facebook and Instagram instant-form submissions at
`https://<your-public-backend-host>/api/integrations/meta/webhook`. The endpoint
verifies Meta's webhook challenge and request signature, fetches each lead from
the Graph API, and imports it once into the CRM.

1. Deploy the backend at a public HTTPS URL and run the database migrations.
2. Create/configure a Meta app with the Webhooks product and subscribe to the
   Page `leadgen` webhook field. The app needs `leads_retrieval` and
   `pages_manage_metadata`; Meta may require app review/business verification
   for production.
3. Configure the following backend environment variables (never put these in
   frontend code): `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`,
   `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, and `META_UMRAH_AGENT_ID`.
   The Umrah agent ID must be an existing CRM user whose role is `agent`
   (find candidates with `SELECT id, name, email FROM users WHERE role = 'agent';`).
   `META_GRAPH_API_VERSION` is optional and defaults to `v27.0`.
4. Set the Meta webhook callback URL to the endpoint above and use the exact
   `META_WEBHOOK_VERIFY_TOKEN` value as its verify token. Subscribe the Page
   to `leadgen` for the app.
5. Include a phone-number field in each instant form. CRM leads require a
   phone number; submissions without one cannot be imported and are reported
   in backend logs. Those submissions need to be handled from Meta separately.

Umrah forms (form names containing `umrah`) are assigned to `META_UMRAH_AGENT_ID`.
Other forms are assigned in round-robin order to the remaining CRM users with
the `agent` role. The assignment cursor is stored in
`meta_lead_assignment_state`; all Meta lead IDs are stored in
`meta_lead_imports` to prevent webhook retries from creating duplicate leads.

## Build

```bash
npm run build
npm start
```
