BEGIN;

-- Software engineers can view, start, and submit tasks assigned to them.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('software_engineer', 'software-engineer', 'software engineer')
  AND p.resource = 'tasks'
  AND p.action IN ('view', 'start', 'submit')
ON CONFLICT DO NOTHING;

COMMIT;