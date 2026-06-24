-- Fix lead temperatures: Update old auto-calculated 'dead' leads to 'warm'
-- This migration addresses the issue where leads were auto-marked as dead
-- based on engagement metrics. Now leads should only be 'dead' when explicitly marked.

UPDATE leads
SET temperature = 'warm'
WHERE temperature = 'dead' 
  AND status NOT IN ('completed', 'canceled')
  AND created_at > '2026-01-01'::timestamp;

-- For completed/canceled leads that have 'dead' temperature, 
-- keep them as is since they reached a terminal state
-- New leads should default to 'warm' going forward
