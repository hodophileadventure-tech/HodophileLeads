-- ============================================================================
-- MIGRATION: Add has_progressed flag to prevent leads reverting to 'new'
-- Date: 2026-08-13
-- Description: 
--   Adds a has_progressed flag to track if a lead has ever changed status 
--   away from 'new'. Once has_progressed=true, status cannot return to 'new'.
--   This ensures 'new leads' export only includes truly new, untouched leads.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD has_progressed COLUMN
-- ============================================================================
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS has_progressed BOOLEAN DEFAULT false;

-- ============================================================================
-- 2. AUTO-FIX EXISTING LEADS
-- ============================================================================
-- For any lead that currently has status != 'new', mark it as progressed
UPDATE leads 
SET has_progressed = true
WHERE status NOT IN ('new', 'spam') 
  AND has_progressed = false;

-- ============================================================================
-- 3. ADD INDEX FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_has_progressed ON leads(has_progressed);
CREATE INDEX IF NOT EXISTS idx_leads_status_progressed ON leads(status, has_progressed);

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================
-- Count leads marked as progressed
SELECT 
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE has_progressed = true) as progressed_leads,
  COUNT(*) FILTER (WHERE has_progressed = false) as new_leads
FROM leads;

COMMIT;
