BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'qa', 'agent', 'manager'));

COMMIT;