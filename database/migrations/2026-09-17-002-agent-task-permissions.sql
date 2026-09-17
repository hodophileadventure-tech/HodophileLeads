BEGIN;

-- Sales agents can work on tasks assigned to themselves.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'agent'
  AND p.resource = 'tasks'
  AND p.action IN ('view', 'start', 'submit')
ON CONFLICT DO NOTHING;

COMMIT;