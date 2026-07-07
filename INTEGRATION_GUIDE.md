# Lead Manager & Employee Portal Integration Guide

## Overview

This guide documents the integration between the **Lead Manager** application (travel agency lead management system) and the **Employee Portal** application (employee and payroll management system).

When a lead is confirmed in the Lead Manager, an automated commission is calculated and communicated to the Employee Portal, where it's recorded as a payroll entry for the sales agent.

## Architecture

```
Lead Manager (Express.js + PostgreSQL)
    ↓ [Lead Confirmed]
    ├─ Calculate Commission (Rule-Based)
    ├─ Update Lead Status
    └─ Enqueue Commission Event (Outbox Pattern)
         ↓
    [Outbox Worker - Runs every minute]
         ├─ Validates Event
         ├─ Calls Employee Portal API
         ├─ Retries on failure (exponential backoff)
         └─ Marks as Completed/Failed
             ↓
    Employee Portal (Next.js + Prisma + PostgreSQL)
         ├─ Validates API Key
         ├─ Validates Commission Payload
         ├─ Checks for Duplicates (using leadId)
         ├─ Updates/Creates Salary Record
         └─ Returns Success Response
```

## Commission Rules

### Commission Calculation
- **Tier 1**: Lead worth ≤ Rs. 25,000 → **Rs. 500 commission**
- **Tier 2**: Lead worth > Rs. 25,000 → **Rs. 1,000 commission**

### Monthly Incentive
- If total confirmed sales in a month ≥ **Rs. 1 Crore (10,000,000)** → **Additional Rs. 30,000 incentive**

### Payroll Impact
```
Net Salary = Basic Salary
           + Total Commission (from all confirmed leads)
           + Monthly Incentive (if applicable)
           - Deductions
```

## Setup Instructions

### 1. Environment Variables

#### Lead Manager (.env)
```bash
# Employee Portal Integration
EMPLOYEE_PORTAL_URL=http://localhost:3000
INTERNAL_API_KEY=your-secure-api-key-here

# Outbox Worker Configuration
OUTBOX_MAX_RETRY=5
OUTBOX_RETRY_BASE_SECONDS=30
```

#### Employee Portal (.env.local)
```bash
# Internal API Configuration
INTERNAL_API_KEY=your-secure-api-key-here
ENABLE_API_KEY_AUTH=true
```

### 2. Database Migrations

**Employee Portal** - Run migrations to add `leadId` field to `SalaryRecord`:
```bash
cd "Hodophile Employee Portal"
npx prisma migrate dev --name add_leadId_to_salary_record
```

This adds:
- `leadId` field (String, unique) to track external lead IDs
- Index on `leadId` for fast lookups

### 3. Verify Configuration

**Lead Manager** - Check outbox worker is running:
```bash
# Should see in logs:
# [OutboxWorker] Worker started
# [OutboxWorker] Processing commission event: ...
```

**Employee Portal** - Test the commission endpoint:
```bash
curl -X POST http://localhost:3000/api/external/commission \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey your-api-key" \
  -d '{
    "leadId": "uuid-here",
    "employeeId": "emp-id",
    "leadWorth": 30000,
    "commission": 1000,
    "confirmedAt": "2024-01-15T10:30:00Z"
  }'
```

## API Endpoints

### Commission Receiver Endpoint

**Endpoint**: `POST /api/external/commission`

**Authentication**: API Key in `Authorization` header
- Format: `Authorization: ApiKey <API_KEY>` or `Authorization: Bearer <API_KEY>`

**Request Body**:
```json
{
  "leadId": "uuid",
  "employeeId": "employee-id",
  "leadWorth": 32000,
  "commission": 1000,
  "confirmedAt": "2024-01-15T10:30:00Z",
  "customerName": "John Doe",
  "customerNumber": "+923001234567",
  "destination": "Dubai",
  "persons": 4,
  "employeeEmail": "agent@company.com",
  "commissionRule": "TIER_2_ABOVE_25K",
  "ruleDescription": "Commission Tier 2: Lead worth > Rs. 25,000 → Rs. 1,000",
  "sourceSystem": "lead-manager"
}
```

**Response (201 - Created)**:
```json
{
  "success": true,
  "message": "Commission processed successfully",
  "data": {
    "leadId": "uuid",
    "salaryRecordId": "salary-record-uuid",
    "commission": 1000,
    "totalMonthlyCommission": 3500,
    "month": "2024-01-01"
  }
}
```

**Response (200 - Idempotent Success)**:
```json
{
  "success": true,
  "message": "Commission already processed for this lead",
  "data": {
    "leadId": "uuid",
    "salaryRecordId": "salary-record-uuid"
  }
}
```

**Error Responses**:
- `400` - Invalid payload or malformed JSON
- `401` - Missing or invalid API key
- `404` - Employee not found
- `500` - Server error

## Idempotency

The integration is designed to be **fully idempotent**:

1. **Lead Manager**: Uses `externalId` in outbox events to prevent duplicate enqueueing
2. **Employee Portal**: Uses `leadId` as unique identifier to prevent duplicate commission records

If the same lead is confirmed multiple times:
- The outbox worker will retry with the same external ID
- The commission endpoint will return the existing salary record (status 200)
- No duplicate commission records are created

## Flow Diagram

### Happy Path
```
1. Lead Manager: Lead status → "confirmed"
   ↓
2. Lead Manager: Commission calculated (rule-based)
   ↓
3. Lead Manager: Event enqueued in outbox_events table
   ↓
4. Outbox Worker: Dequeues event (every minute)
   ↓
5. Outbox Worker: POST to /api/external/commission
   ↓
6. Employee Portal: Validates API key
   ↓
7. Employee Portal: Validates payload schema
   ↓
8. Employee Portal: Checks for duplicate (leadId)
   ↓
9. Employee Portal: Creates/Updates SalaryRecord
   ↓
10. Employee Portal: Returns 201 success
   ↓
11. Outbox Worker: Marks event as completed
```

### Retry Path (on failure)
```
1-5. [Same as happy path]
   ↓
5. Outbox Worker: POST fails (network error, timeout, etc.)
   ↓
6. Outbox Worker: Mark event as failed with error message
   ↓
7. Outbox Worker: Calculate next attempt time (exponential backoff)
   ↓
8. [Wait until next_attempt_at]
   ↓
9. Outbox Worker: Retry from step 5
   ↓
10. [After MAX_RETRY (5) failures: Mark as permanently failed]
```

## Code Changes Summary

### Lead Manager

**New File**: `src/services/commissionRuleService.ts`
- Stateless commission calculation based on lead worth
- Extensible rule system for future changes
- Validation and rule descriptions for logging

**Updated File**: `src/services/employeePortalService.ts`
- Uses `CommissionRuleService` instead of percentage-based calculation
- Includes rule information in outbox payload
- Better logging for audit trail

**Updated File**: `src/workers/outboxWorker.ts`
- Routes `employee_portal_confirmed_lead` events to `/api/external/commission`
- Uses API Key authentication (ApiKey header)
- Enhanced logging for commission delivery

### Employee Portal

**New File**: `lib/internal-api-key.ts`
- API Key validation utility
- Support for both "ApiKey" and "Bearer" header formats
- Configurable via environment variables

**New File**: `lib/commission-validation.ts`
- Zod schema for commission payload validation
- Type-safe payload parsing

**New File**: `app/api/external/commission/route.ts`
- Commission receiver endpoint
- API key authentication
- Idempotent commission record creation
- Comprehensive error handling and logging

**Updated File**: `prisma/schema.prisma`
- Added `leadId` field to `SalaryRecord` model
- Unique constraint on `leadId` for idempotency
- Index on `leadId` for performance

## Testing

### Manual Testing

1. **Start both applications**:
   ```bash
   # Terminal 1: Lead Manager
   cd "Hodophile Leads/backend"
   npm run dev
   
   # Terminal 2: Employee Portal
   cd "Hodophile Employee Portal"
   npm run dev
   ```

2. **Confirm a lead in Lead Manager**:
   ```bash
   # Call the lead confirmation endpoint
   curl -X PATCH http://localhost:5000/api/leads/{leadId}/status \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"status": "booked"}'
   ```

3. **Monitor outbox worker** (check Lead Manager console):
   ```
   [OutboxWorker] Processing commission event: {eventId}
   [Commission API] Sending commission event to Employee Portal:
   ...
   [OutboxWorker] Commission event delivered successfully:
   ```

4. **Verify commission in Employee Portal**:
   ```bash
   # Query salary record
   curl http://localhost:3000/api/admin/salary/records \
     -H "Authorization: Bearer {token}"
   ```

### Automated Testing

Test cases to implement:

1. **Commission Calculation**:
   - Lead worth ≤ 25,000 → Rs. 500
   - Lead worth > 25,000 → Rs. 1,000

2. **Idempotency**:
   - Same lead confirmed twice → no duplicate commission
   - Same API request retried → same response

3. **Error Handling**:
   - Invalid API key → 401
   - Invalid payload → 400 with error details
   - Employee not found → 404
   - Missing fields → 400

4. **Monthly Incentive**:
   - Total sales < 1 Crore → no incentive
   - Total sales ≥ 1 Crore → Rs. 30,000 incentive

## Troubleshooting

### Commission Not Received

1. **Check outbox events in database**:
   ```sql
   SELECT * FROM outbox_events 
   WHERE event_type = 'employee_portal_confirmed_lead' 
   ORDER BY created_at DESC LIMIT 5;
   ```

2. **Check outbox worker logs**:
   - Is worker running? (`[OutboxWorker]` logs)
   - Any delivery failures? (retry count, error messages)

3. **Verify environment variables**:
   - `EMPLOYEE_PORTAL_URL` correct?
   - `INTERNAL_API_KEY` configured?

4. **Test API endpoint directly**:
   ```bash
   curl -X POST http://localhost:3000/api/external/commission \
     -H "Authorization: ApiKey test-key" \
     -H "Content-Type: application/json" \
     -d '{...}'
   ```

### Duplicate Commission Records

1. **Check `leadId` uniqueness**:
   ```sql
   SELECT leadId, COUNT(*) FROM salary_records 
   WHERE leadId IS NOT NULL 
   GROUP BY leadId 
   HAVING COUNT(*) > 1;
   ```

2. **Manual cleanup** (if needed):
   ```sql
   -- Keep the first record, delete duplicates
   DELETE FROM salary_records 
   WHERE leadId IN (
     SELECT leadId FROM salary_records 
     WHERE leadId IS NOT NULL 
     GROUP BY leadId 
     HAVING COUNT(*) > 1
   ) AND created_at != (
     SELECT MIN(created_at) 
     FROM salary_records sr2 
     WHERE sr2.leadId = salary_records.leadId
   );
   ```

### API Key Authentication Failures

1. **Verify API key is set**:
   ```bash
   # Employee Portal .env.local
   echo $INTERNAL_API_KEY  # Should print the key
   ```

2. **Test with curl**:
   ```bash
   curl -H "Authorization: ApiKey your-key" \
     http://localhost:3000/api/external/commission
   ```

3. **Check request headers in logs**:
   - Lead Manager should send: `Authorization: ApiKey {key}`
   - Look for `[Commission API] Unauthorized` in logs

## Performance Considerations

1. **Outbox Worker Frequency**: Runs every minute (configurable via cron)
   - Adjust based on commission volume
   - High volume? Consider more frequent runs

2. **Retry Strategy**: Exponential backoff starting at 30 seconds
   - Min delay: 30 seconds
   - Max delay: 3600 seconds (1 hour)
   - Max retries: 5 attempts

3. **Database Indexes**:
   - `SalaryRecord.leadId` - indexed for idempotency checks
   - `Employee.id` - indexed for lookups

## Security Considerations

1. **API Key Management**:
   - Store in secure environment variables
   - Never commit to version control
   - Rotate periodically
   - Different keys for dev/staging/prod

2. **Payload Validation**:
   - Schema validation on all inputs
   - Sanitize error messages (don't leak database info)

3. **Database Access**:
   - Use parameterized queries (Prisma handles this)
   - Proper index management to prevent full table scans

4. **Rate Limiting** (Future Enhancement):
   - Consider adding rate limits on commission endpoint
   - Prevent API abuse

## Future Enhancements

1. **Webhook Retries with Dead Letter Queue**:
   - Move permanently failed events to DLQ
   - Manual inspection and recovery

2. **Commission Rule Engine**:
   - Admin UI to modify commission tiers
   - Versioning for rule changes

3. **Real-time Notifications**:
   - Email notifications when commission is recorded
   - Dashboard real-time updates via WebSockets

4. **Audit Trail**:
   - Full audit log of commission events
   - Who confirmed the lead, when, how much commission

5. **Commission Reports**:
   - Agent-wise commission summary
   - Monthly commission trending
   - Commission payout history

## Support & Debugging

For issues or questions:

1. Check application logs for error messages
2. Review database state (outbox_events, salary_records)
3. Test endpoints manually with curl
4. Verify environment variables are set correctly
5. Check network connectivity between services

## Glossary

| Term | Definition |
|------|-----------|
| **Lead Manager** | Express.js backend for lead/sales management |
| **Employee Portal** | Next.js frontend/backend for employee management |
| **Commission** | Financial reward for confirmed leads |
| **Outbox Pattern** | Event sourcing pattern ensuring event delivery |
| **Idempotency** | Operation can be called multiple times safely |
| **Exponential Backoff** | Retry delay increases exponentially |
| **Payroll Record** | Monthly salary calculation for an employee |
| **Lead Worth** | Total transaction value of a lead |
| **API Key** | Secret token for service-to-service authentication |
