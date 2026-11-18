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
   valid phone number. Phone values are normalized to digits and an optional
   leading `+`; Meta test placeholders and values that cannot fit the CRM field
   are rejected rather than truncated.

Umrah forms (form names containing `umrah`) are assigned to `META_UMRAH_AGENT_ID`.
Other forms are assigned in round-robin order to CRM users with the `agent`
role, excluding the Umrah agent and the accounts named Altamash, Joti Ashok,
Sameer Khan, Maqsood Khan, Amna, and test. The assignment cursor is stored in
`meta_lead_assignment_state`; all Meta lead IDs are stored in
`meta_lead_imports` to prevent webhook retries from creating duplicate leads.
Destination is mapped only from explicit destination fields or travel-location
questions; generic city and traveler-count answers are not treated as destinations.

The webhook first saves each lead event in `meta_lead_webhook_events` and only
then acknowledges Meta. A background worker fetches and imports the lead, retries
transient failures with capped exponential backoff, and records permanent
failures for review. Successfully imported event payloads are cleared from the
queue; payloads for failed imports remain available for recovery. To inspect
failures, query:

```sql
SELECT meta_lead_id, form_id, status, retry_count, last_error, created_at
FROM meta_lead_webhook_events
WHERE status = 'failed'
ORDER BY created_at DESC;
```

Meta access-token errors (Graph API code `190`) are retried with backoff even
after the normal retry limit. Previously failed token-error events are picked
up for another attempt after 15 minutes, so replacing an expired token in the
backend environment does not require manually requeuing those events.

After correcting a configuration or data issue, an administrator can requeue
one event from the database:

```sql
UPDATE meta_lead_webhook_events
SET status = 'pending', retry_count = 0, last_error = NULL,
    next_attempt_at = CURRENT_TIMESTAMP
WHERE meta_lead_id = '<Meta lead ID>' AND status = 'failed';
```

## Build

```bash
npm run build
npm start
```
