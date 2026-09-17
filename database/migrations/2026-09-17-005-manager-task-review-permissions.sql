BEGIN;

-- Managers can review submitted tasks from the team task workspace.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'manager'
  AND p.resource = 'tasks'
  AND p.action IN ('approve', 'request_revision')
ON CONFLICT DO NOTHING;

COMMIT;