-- ============================================================================
-- MIGRATION: Create Roles & Permissions System
-- Date: 2026-08-12
-- Description: Create dynamic role management and permission-based RBAC
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE ROLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  
  -- System Metadata
  is_system_role BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for roles table
CREATE INDEX IF NOT EXISTS idx_roles_slug ON roles(slug);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_is_system_role ON roles(is_system_role);

-- ============================================================================
-- 2. CREATE PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Naming
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  
  -- Display
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(resource, action)
);

-- Indexes for permissions table
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- ============================================================================
-- 3. CREATE ROLE_PERMISSIONS TABLE (MANY-TO-MANY)
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite unique constraint
  UNIQUE(role_id, permission_id)
);

-- Indexes for role_permissions table
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ============================================================================
-- 4. SEED INITIAL SYSTEM ROLES
-- ============================================================================
INSERT INTO roles (name, slug, description, is_system_role, is_active)
VALUES
  ('Admin', 'admin', 'System administrator with full access', true, true),
  ('Sales Executive', 'agent', 'Sales executive / CRM agent', true, true),
  ('Sales Manager', 'manager', 'Sales team manager and supervisor', true, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. SEED PERMISSIONS
-- ============================================================================

-- Task Permissions
INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('tasks', 'view', 'View Own Tasks', 'View tasks assigned to user'),
  ('tasks', 'view_all', 'View All Tasks', 'View all tasks in system'),
  ('tasks', 'create', 'Create Task', 'Create new tasks'),
  ('tasks', 'assign', 'Assign Task', 'Assign tasks to team members'),
  ('tasks', 'reassign', 'Reassign Task', 'Reassign tasks to different users'),
  ('tasks', 'edit', 'Edit Task', 'Edit task details'),
  ('tasks', 'start', 'Start Task', 'Start working on task'),
  ('tasks', 'submit', 'Submit Task', 'Submit completed task'),
  ('tasks', 'review', 'Review Submissions', 'Review task submissions'),
  ('tasks', 'approve', 'Approve Task', 'Approve submitted tasks'),
  ('tasks', 'request_revision', 'Request Revision', 'Request revision from employee'),
  ('tasks', 'cancel', 'Cancel Task', 'Cancel task'),
  ('tasks', 'delete', 'Delete Task', 'Delete task permanently')
ON CONFLICT DO NOTHING;

-- Lead Permissions (preserve existing)
INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('leads', 'view', 'View Own Leads', 'View leads assigned to user'),
  ('leads', 'view_all', 'View All Leads', 'View all leads in system'),
  ('leads', 'create', 'Create Lead', 'Create new leads'),
  ('leads', 'edit', 'Edit Lead', 'Edit lead details'),
  ('leads', 'delete', 'Delete Lead', 'Delete leads'),
  ('leads', 'transfer', 'Transfer Lead', 'Transfer leads to other agents')
ON CONFLICT DO NOTHING;

-- Quotation Permissions
INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('quotations', 'view', 'View Quotations', 'View quotations'),
  ('quotations', 'create', 'Create Quotation', 'Create quotations'),
  ('quotations', 'approve', 'Approve Quotation', 'Approve quotations')
ON CONFLICT DO NOTHING;

-- Invoice Permissions
INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('invoices', 'view', 'View Invoices', 'View invoices'),
  ('invoices', 'create', 'Create Invoice', 'Create invoices')
ON CONFLICT DO NOTHING;

-- Report Permissions
INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('reports', 'view', 'View Own Reports', 'View own reports'),
  ('reports', 'view_all', 'View All Reports', 'View all reports')
ON CONFLICT DO NOTHING;

-- Admin Permissions (future)
INSERT INTO permissions (resource, action, display_name, description)
VALUES
  ('roles', 'manage', 'Manage Roles', 'Create, edit, delete roles'),
  ('permissions', 'manage', 'Manage Permissions', 'Assign permissions to roles'),
  ('users', 'manage', 'Manage Users', 'Create, edit users'),
  ('system', 'configure', 'System Configuration', 'Configure system settings')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. ASSIGN PERMISSIONS TO ADMIN ROLE (ALL PERMISSIONS)
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. ASSIGN PERMISSIONS TO SALES EXECUTIVE (AGENT) ROLE
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'agent' 
  AND p.resource IN ('leads', 'quotations', 'invoices', 'reports')
  AND NOT (p.resource = 'reports' AND p.action = 'view_all')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. ASSIGN PERMISSIONS TO SALES MANAGER (MANAGER) ROLE
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'manager' 
  AND (
    p.resource IN ('leads', 'quotations', 'invoices', 'reports', 'tasks')
    OR (p.resource = 'tasks' AND p.action IN ('view_all', 'create', 'assign', 'reassign', 'edit', 'review', 'cancel'))
  )
  AND NOT (p.resource = 'tasks' AND p.action IN ('approve', 'delete'))
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. VERIFICATION CHECKS
-- ============================================================================
-- These checks are optional but helpful for debugging

-- Check roles created
SELECT COUNT(*) as roles_count FROM roles;

-- Check permissions created
SELECT COUNT(*) as permissions_count FROM permissions;

-- Check role_permissions assigned
SELECT COUNT(*) as role_permissions_count FROM role_permissions;

COMMIT;
