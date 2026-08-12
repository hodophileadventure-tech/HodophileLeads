-- ============================================================================
-- MIGRATION: Migrate Users from String Role to Role_ID FK
-- Date: 2026-08-12
-- Description: Convert users.role (VARCHAR) to users.role_id (UUID FK)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD role_id COLUMN TO USERS TABLE
-- ============================================================================
ALTER TABLE users 
ADD COLUMN role_id UUID;

-- ============================================================================
-- 2. MIGRATE EXISTING ROLE DATA
-- ============================================================================
-- Map existing string roles to new role UUIDs

UPDATE users u
SET role_id = (
  SELECT id FROM roles r
  WHERE r.slug = u.role
    AND u.role IN ('admin', 'agent', 'manager')
)
WHERE u.role IN ('admin', 'agent', 'manager');

-- ============================================================================
-- 3. VERIFY MIGRATION
-- ============================================================================

-- Check that all users have role_id assigned
DO $$
DECLARE
  unassigned_count INT;
BEGIN
  SELECT COUNT(*) INTO unassigned_count FROM users WHERE role_id IS NULL;
  IF unassigned_count > 0 THEN
    RAISE WARNING 'WARNING: % users do not have role_id assigned', unassigned_count;
  ELSE
    RAISE NOTICE 'All users have role_id assigned successfully';
  END IF;
END $$;

-- Check role references are valid
DO $$
DECLARE
  invalid_count INT;
BEGIN
  SELECT COUNT(*) INTO invalid_count 
  FROM users u
  WHERE u.role_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.id = u.role_id);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'WARNING: % users have invalid role_id references', invalid_count;
  ELSE
    RAISE NOTICE 'All role_id references are valid';
  END IF;
END $$;

-- ============================================================================
-- 4. ADD FOREIGN KEY CONSTRAINT
-- ============================================================================
ALTER TABLE users
ADD CONSTRAINT fk_users_role_id 
FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;

-- ============================================================================
-- 5. MAKE role_id NOT NULL
-- ============================================================================
ALTER TABLE users
ALTER COLUMN role_id SET NOT NULL;

-- ============================================================================
-- 6. REMOVE OLD ROLE COLUMN CONSTRAINT
-- ============================================================================
ALTER TABLE users
DROP CONSTRAINT valid_role;

-- ============================================================================
-- 7. REMOVE OLD ROLE COLUMN
-- ============================================================================
ALTER TABLE users
DROP COLUMN role;

-- ============================================================================
-- 8. ADD INDEX FOR role_id
-- ============================================================================
CREATE INDEX idx_users_role_id ON users(role_id);

-- ============================================================================
-- 9. FINAL VERIFICATION
-- ============================================================================

-- Count users by role
SELECT 
  r.name,
  r.slug,
  COUNT(u.id) as user_count
FROM roles r
LEFT JOIN users u ON u.role_id = r.id
GROUP BY r.id, r.name, r.slug
ORDER BY user_count DESC;

COMMIT;
