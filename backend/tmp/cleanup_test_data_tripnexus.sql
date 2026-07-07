SELECT id, external_id, status FROM outbox_events WHERE external_id IN ('employee_portal_confirmed_lead:55592607-1f37-4759-b540-917dc741cf6c', 'employee_portal_confirmed_lead:55592607-real-test');
DELETE FROM outbox_events WHERE external_id IN ('employee_portal_confirmed_lead:55592607-1f37-4759-b540-917dc741cf6c', 'employee_portal_confirmed_lead:55592607-real-test');
SELECT count(*) FROM outbox_events WHERE external_id IN ('employee_portal_confirmed_lead:55592607-1f37-4759-b540-917dc741cf6c', 'employee_portal_confirmed_lead:55592607-real-test');
