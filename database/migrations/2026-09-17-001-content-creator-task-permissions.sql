BEGIN;

-- Content creators manage the assignment sheet and review submitted tasks.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'content_creator'
  AND p.resource = 'tasks'
  AND p.action IN ('view_all', 'create', 'approve', 'request_revision')
ON CONFLICT DO NOTHING;

COMMIT;