BEGIN;

-- Existing creative roles were created before the role form assigned permissions.
-- Give them the permissions required by CreativeWorkPanel.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('content_creator', 'video_editor')
  AND p.resource = 'tasks'
  AND p.action IN ('view', 'start', 'submit')
ON CONFLICT DO NOTHING;

COMMIT;
