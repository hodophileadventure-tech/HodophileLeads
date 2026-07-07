INSERT INTO outbox_events (external_id, event_type, payload, status, retry_count, last_error, next_attempt_at, created_at, updated_at)
VALUES (
  'employee_portal_confirmed_lead:55592607-1f37-4759-b540-917dc741cf6c',
  'employee_portal_confirmed_lead',
  $$
  {"leadId":"55592607-1f37-4759-b540-917dc741cf6c","employeeId":"ecdde89f-975f-4f37-9da7-22e803c2ca63","employeeEmail":"test-portal-employee-1@example.com","customerName":"John Doe","customerNumber":"+1234567890","destination":"Paris","persons":2,"leadWorth":1000,"commission":100,"sourceSystem":"lead-manager","confirmedAt":"2026-07-06T00:00:00.000Z"}
  $$::jsonb,
  'pending', 0, NULL, NOW(), NOW(), NOW()
);
