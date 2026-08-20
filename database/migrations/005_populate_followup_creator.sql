-- Migration: Populate created_by for existing follow-ups
-- This ensures all follow-ups have a creator assigned
-- For follow-ups without a creator, assign the lead's agent as the creator

UPDATE follow_ups fu
SET created_by = l.agent_id
FROM leads l
WHERE fu.created_by IS NULL
  AND fu.lead_id = l.id
  AND l.agent_id IS NOT NULL;
