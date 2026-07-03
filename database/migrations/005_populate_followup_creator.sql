-- Migration: Populate created_by for existing follow-ups
-- This ensures all follow-ups have a creator assigned
-- For follow-ups without a creator, assign the lead's agent as the creator

UPDATE follow_ups fu
SET created_by = l.agent_id
WHERE fu.created_by IS NULL
  AND fu.lead_id IN (SELECT id FROM leads);
