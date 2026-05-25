# Database Setup

PostgreSQL database schema and seed data for TRIPNEXUS.

## Schema

Tables include:
- `users` - Admin/Agent accounts
- `leads` - Lead information with temperature scoring
- `follow_ups` - Scheduled follow-ups and tasks
- `itineraries` - Trip plans and details
- `payments` - Payment records
- `availability` - Triple-lock confirmations
- `client_profiles` - Client 360° profiles
- `audit_logs` - Change tracking

## Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE tripnexus;
```

2. Load schema:
```bash
psql tripnexus < schema.sql
```

3. Load seed data:
```bash
psql tripnexus < seed-data.sql
```

## Sample Data

Demo users:
- Admin: admin@tripnexus.com / Admin@123 (password hash)
- Agent: agent@tripnexus.com / Agent@123 (password hash)

Sample leads with various statuses and temperatures for testing.

## Connection

Update `.env` in backend:
```
DATABASE_URL=postgresql://user:password@localhost:5432/tripnexus
```
