BEGIN;

-- Content creators can review submitted tasks assigned to their team.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('content_creator', 'content-creator', 'content creator')
  AND p.resource = 'tasks'
  AND p.action IN ('view_all', 'create', 'approve', 'request_revision')
ON CONFLICT DO NOTHING;

COMMIT;