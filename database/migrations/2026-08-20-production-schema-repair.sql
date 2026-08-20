BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Lead status protection used by the Lead model.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS has_progressed BOOLEAN DEFAULT false;

UPDATE leads
SET has_progressed = true
WHERE status NOT IN ('new', 'spam')
  AND has_progressed = false;

CREATE INDEX IF NOT EXISTS idx_leads_has_progressed ON leads(has_progressed);
CREATE INDEX IF NOT EXISTS idx_leads_status_progressed ON leads(status, has_progressed);

-- Dynamic roles and permissions used by Admin Users & Roles.
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_slug ON roles(slug);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

INSERT INTO roles (name, slug, description, is_system_role, is_active)
VALUES
  ('Admin', 'admin', 'System administrator with full access', true, true),
  ('Sales Executive', 'agent', 'Sales executive / CRM agent', true, true),
  ('Sales Manager', 'manager', 'Sales team manager and supervisor', true, true)
ON CONFLICT DO NOTHING;

INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('leads', 'view', 'View Own Leads', 'View leads assigned to the user'),
  ('leads', 'view_all', 'View All Leads', 'View all leads'),
  ('leads', 'create', 'Create Lead', 'Create leads'),
  ('leads', 'edit', 'Edit Lead', 'Edit leads'),
  ('leads', 'delete', 'Delete Lead', 'Delete leads'),
  ('leads', 'transfer', 'Transfer Lead', 'Transfer leads'),
  ('quotations', 'view', 'View Quotations', 'View quotations'),
  ('quotations', 'create', 'Create Quotation', 'Create quotations'),
  ('quotations', 'approve', 'Approve Quotation', 'Approve quotations'),
  ('invoices', 'view', 'View Invoices', 'View invoices'),
  ('invoices', 'create', 'Create Invoice', 'Create invoices'),
  ('reports', 'view', 'View Own Reports', 'View own reports'),
  ('reports', 'view_all', 'View All Reports', 'View all reports'),
  ('roles', 'manage', 'Manage Roles', 'Create, edit, and delete roles'),
  ('permissions', 'manage', 'Manage Permissions', 'Assign permissions to roles'),
  ('users', 'manage', 'Manage Users', 'Create and manage users'),
  ('system', 'configure', 'System Configuration', 'Configure system settings')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'agent'
  AND p.resource IN ('leads', 'quotations', 'invoices', 'reports')
  AND NOT (p.resource = 'reports' AND p.action = 'view_all')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'manager'
  AND p.resource IN ('leads', 'quotations', 'invoices', 'reports')
ON CONFLICT DO NOTHING;

-- Keep the legacy role column for compatibility while enabling RBAC queries.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID;

UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
  AND u.role IN ('admin', 'agent', 'manager')
  AND r.slug = u.role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_role_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_role_id
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

COMMIT;
