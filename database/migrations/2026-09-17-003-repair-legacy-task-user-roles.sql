BEGIN;

-- Older accounts may still have only the legacy users.role value.
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
  AND LOWER(REPLACE(COALESCE(u.role, ''), ' ', '_')) = r.slug;

-- Ensure repaired sales-agent accounts can use their personal task sheet.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'agent'
  AND p.resource = 'tasks'
  AND p.action IN ('view', 'start', 'submit')
ON CONFLICT DO NOTHING;

COMMIT;