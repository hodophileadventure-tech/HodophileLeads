# Integration Setup Checklist

Complete these steps to activate the Lead Manager ↔ Employee Portal integration.

## Lead Manager Setup

### 1. Environment Variables

Add to `backend/.env`:

```bash
# Employee Portal Integration
EMPLOYEE_PORTAL_URL=http://localhost:3000
# Or for production: https://employee-portal.example.com

# API Key for secure communication (generate a strong random key)
INTERNAL_API_KEY=your-super-secure-api-key-at-least-32-chars-random

# Outbox Worker Configuration (optional, defaults shown)
OUTBOX_MAX_RETRY=5
OUTBOX_RETRY_BASE_SECONDS=30
```

### 2. Verify Commission Service is Loaded

Check that `src/services/commissionRuleService.ts` is present and contains:
- `calculateCommission()` function
- `calculateMonthlyIncentive()` function
- Rules: ≤25k=500, >25k=1000

### 3. Verify Outbox Worker is Running

In `backend/src/index.ts` or main entry point, ensure:
```typescript
import { startOutboxWorker } from './workers/outboxWorker';
startOutboxWorker();
```

### 4. Test Commission Calculation

```bash
# In Lead Manager backend directory
npm test -- commissionRuleService
```

Or test manually:
```bash
# Confirm a lead with leadWorth = 30000 (should get 1000 commission)
# Check logs for: [Commission API] Sending commission event
```

---

## Employee Portal Setup

### 1. Update Database Schema

```bash
cd "Hodophile Employee Portal"

# Load environment variables from .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Create and apply migration
npx prisma migrate dev --name add_leadId_to_salary_record

# Verify migration
npx prisma db push --skip-generate
```

### 2. Update Environment Variables

Add to `.env.local`:

```bash
# Internal API Key (must match Lead Manager's INTERNAL_API_KEY)
INTERNAL_API_KEY=your-super-secure-api-key-at-least-32-chars-random

# Enable API Key authentication
ENABLE_API_KEY_AUTH=true
```

### 3. Verify New Files Exist

Check these files are present:

- `lib/internal-api-key.ts` - API key validation
- `lib/commission-validation.ts` - Zod schema validation
- `app/api/external/commission/route.ts` - Commission receiver endpoint

### 4. Test Commission Endpoint

```bash
# From terminal or Postman
curl -X POST http://localhost:3000/api/external/commission \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey your-super-secure-api-key-at-least-32-chars-random" \
  -d '{
    "leadId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "employeeId": "emp-001",
    "leadWorth": 30000,
    "commission": 1000,
    "confirmedAt": "2024-01-15T10:30:00Z",
    "customerName": "Test Customer"
  }'
```

Expected response (201):
```json
{
  "success": true,
  "message": "Commission processed successfully",
  "data": {
    "leadId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "salaryRecordId": "...",
    "commission": 1000,
    "totalMonthlyCommission": 1000,
    "month": "2024-01-01"
  }
}
```

---

## Integration Testing

### Step 1: Start Both Services

```bash
# Terminal 1: Lead Manager
cd "Hodophile Leads/backend"
npm run dev
# Should see: [OutboxWorker] Worker started

# Terminal 2: Employee Portal
cd "Hodophile Employee Portal"
npm run dev
# Should be running on http://localhost:3000
```

### Step 2: Create Test Employee

```bash
# Create an employee in Employee Portal
curl -X POST http://localhost:3000/api/admin/employees \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Agent",
    "email": "agent@example.com",
    "cnicNumber": "42101-1234567-1",
    "phoneNumber": "+923001234567",
    "address": "123 Main St",
    "emergencyContactName": "Emergency",
    "emergencyContactNumber": "+923009999999",
    "designation": "Sales Executive",
    "department": "Sales",
    "joiningDate": "2024-01-01",
    "monthlySalary": 50000
  }'
```

Note the `id` returned → this is `employeeId` for testing

### Step 3: Create Corresponding Agent in Lead Manager

```bash
# Create an agent in Lead Manager with same ID as Employee Portal
# Verify they're linked properly
```

### Step 4: Confirm a Lead in Lead Manager

```bash
# Update a lead status to "booked" or pipelineStage to "confirmed"
curl -X PATCH http://localhost:5000/api/leads/{leadId} \
  -H "Authorization: Bearer {agent-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "pipelineStage": "confirmed",
    "actualPrice": 30000
  }'
```

### Step 5: Monitor Commission Flow

**Lead Manager Console** (should see):
```
[LeadsController] Enqueued confirmed lead notification for Employee Portal
[OutboxWorker] Processing commission event: {eventId}
[Commission API] Sending commission event to Employee Portal:
  leadId: {leadId}
  commission: 1000
[OutboxWorker] Commission event delivered successfully
```

**Employee Portal Console** (should see):
```
[Commission API] Commission processed successfully
  leadId: {leadId}
  commission: 1000
  salaryRecordId: {salaryRecordId}
```

### Step 6: Verify Commission in Database

```bash
# Query Employee Portal database
psql postgresql://postgres:postgres@localhost:5432/hodophile_portal

# Check if commission was recorded
SELECT * FROM "SalaryRecord" 
WHERE "employeeId" = 'emp-id' 
AND "leadId" = 'lead-id';

# Should see commission: 1000 or incremented
```

---

## Verification Checklist

- [ ] Lead Manager `INTERNAL_API_KEY` set and matches Employee Portal
- [ ] Employee Portal `INTERNAL_API_KEY` set
- [ ] Employee Portal migration applied (`leadId` field exists)
- [ ] Outbox worker logs show it's running
- [ ] Commission endpoint responds to test request
- [ ] Lead confirmation triggers commission event
- [ ] Commission received endpoint logs show success
- [ ] Database contains commission record with correct leadId
- [ ] Salary records show incremented commission for employee

---

## Troubleshooting

### Commission Not Appearing

1. Check outbox_events table:
   ```sql
   SELECT * FROM outbox_events 
   WHERE event_type = 'employee_portal_confirmed_lead' 
   ORDER BY created_at DESC LIMIT 5;
   ```
   - Status should be 'completed' (not 'pending' or 'failed')
   - Check `last_error` if failed

2. Check console logs for errors

3. Verify API key matches between both applications

### API Key Authentication Failure

```bash
# Test with invalid key (should get 401)
curl -X POST http://localhost:3000/api/external/commission \
  -H "Authorization: ApiKey wrong-key" \
  -d '...'
# Response: {"success": false, "message": "Unauthorized: Invalid or missing API key"}

# Test with correct key (should succeed)
curl -X POST http://localhost:3000/api/external/commission \
  -H "Authorization: ApiKey {INTERNAL_API_KEY}" \
  -d '...'
```

### Employee Not Found

Ensure `employeeId` in commission payload matches exactly with Employee Portal database:
```sql
SELECT id, "fullName", "employeeId" FROM "Employee" LIMIT 5;
```

### Duplicate Commission

This is actually idempotent behavior (should not happen):
```sql
-- Check for duplicates
SELECT "leadId", COUNT(*) FROM "SalaryRecord" 
WHERE "leadId" IS NOT NULL 
GROUP BY "leadId" 
HAVING COUNT(*) > 1;
```

---

## Next Steps

After integration is working:

1. **Test Monthly Incentive**: Confirm leads worth ≥ 10 Crore to verify Rs. 30,000 incentive calculation
2. **Monitor Outbox**: Watch for any failed events and implement alerting
3. **Production Deployment**: Update URLs and API keys for production environment
4. **Load Testing**: Test with high commission volume
5. **Documentation**: Update internal wiki with integration details

---

## Support

For issues:
- Check `INTEGRATION_GUIDE.md` troubleshooting section
- Review console logs in both applications
- Verify environment variables and database state
- Test endpoints with curl manually
