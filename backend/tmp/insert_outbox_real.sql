INSERT INTO outbox_events (id, event_type, payload, external_id, next_attempt_at, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'employee_portal_confirmed_lead',
  '{"leadId":"55592607-1f37-4759-b540-917dc741cf6c","persons":1,"leadWorth":1000,"commission":100,"employeeId":"ecdde89f-975f-4f37-9da7-22e803c2ca63","confirmedAt":"2026-07-06T11:39:01.474Z","destination":"Paris, France","customerName":"John Doe","sourceSystem":"lead-manager","employeeEmail":"test-portal-employee-1@example.com","customerNumber":"+1-555-0101"}',
  'employee_portal_confirmed_lead:55592607-real-test',
  NOW(),
  'pending',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
SELECT id, external_id FROM outbox_events WHERE external_id='employee_portal_confirmed_lead:55592607-real-test';
